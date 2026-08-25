import { beforeEach, describe, expect, it, vi } from "vitest";

const post = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api/axiosClient", () => ({
  axiosClient: { post },
  unwrapCoreData: (value: unknown) => {
    if (value && typeof value === "object" && "data" in value) {
      return (value as { data: unknown }).data;
    }
    return value;
  },
}));

import {
  buildAuthInvalidationReplayCommand,
  readAuthInvalidationReplayReceipt,
  replayAuthInvalidationOutbox,
  shouldRetainAuthInvalidationReplayIntent,
  type AuthInvalidationReplayCommand,
} from "./authInvalidationReplay";

const TENANT_ID = "019fc7e0-bcef-727f-90cb-ff6028ed3301";
const EVENT_ID_1 = "019fc7e0-bcef-727f-90cb-ff6028ed3302";
const EVENT_ID_2 = "019fc7e0-bcef-727f-90cb-ff6028ed3304";
const COMMAND_ID = "019fc7e0-bcef-727f-90cb-ff6028ed3303";

describe("authentication invalidation outbox replay contract", () => {
  beforeEach(() => post.mockReset());

  it("builds the exact trimmed, sorted tenant DTO and validates Core bounds", () => {
    expect(buildAuthInvalidationReplayCommand({
      target: "TENANT",
      tenantId: `  ${TENANT_ID.toUpperCase()}  `,
      eventIdsText: `${EVENT_ID_2}\n${EVENT_ID_1}`,
      reason: "  Recover terminal invalidation  ",
    }, "DRY_RUN")).toEqual({
      command: {
        target: "TENANT",
        tenantId: TENANT_ID,
        mode: "DRY_RUN",
        eventIds: [EVENT_ID_1, EVENT_ID_2],
        reason: "Recover terminal invalidation",
      },
      errors: {},
    });

    expect(buildAuthInvalidationReplayCommand({
      target: "TENANT",
      tenantId: "",
      eventIdsText: `${EVENT_ID_1},${EVENT_ID_1}`,
      reason: "short",
    }, "APPLY").errors).toEqual({
      tenantId: "tenantRequired",
      eventIds: "eventDuplicate",
      reason: "reasonTooShort",
    });

    expect(buildAuthInvalidationReplayCommand({
      target: "CONTROL_PLANE",
      tenantId: TENANT_ID,
      eventIdsText: Array.from({ length: 26 }, (_, index) =>
        `019fc7e0-bcef-7${index.toString(16).padStart(3, "0")}-90cb-ff6028ed3302`).join("\n"),
      reason: "A sufficiently descriptive recovery reason",
    }, "DRY_RUN").errors.eventIds).toBe("eventTooMany");
  });

  it("sends one caller-keyed, exact-body write with no automatic transport retry", async () => {
    const command = dryRunCommand();
    post.mockResolvedValue({
      data: { data: receipt(command) },
      status: 200,
      statusText: "OK",
      headers: new Headers({ "x-correlation-id": "corr-replay-1" }),
    });

    await expect(replayAuthInvalidationOutbox(command, COMMAND_ID)).resolves
      .toMatchObject({
        commandId: COMMAND_ID,
        outcome: "DRY_RUN_VALIDATED",
        correlationId: "corr-replay-1",
      });
    expect(post).toHaveBeenCalledWith(
      "/api/admin/core/v1/auth-invalidation-outbox/replay",
      command,
      {
        headers: { "x-idempotency-key": COMMAND_ID },
        skipAutoIdempotency: true,
        replayAfterRefresh: true,
        cache: "no-store",
      },
    );
  });

  it("rejects mismatched receipts and identifies only ambiguous retry evidence", () => {
    const command = dryRunCommand();
    expect(() => readAuthInvalidationReplayReceipt(
      { ...receipt(command), replayedEventCount: 1 },
      command,
      COMMAND_ID,
    )).toThrow("INVALID_AUTH_INVALIDATION_REPLAY_RESPONSE");

    expect(shouldRetainAuthInvalidationReplayIntent({
      httpStatus: 503,
      errorCode: "UPSTREAM_UNAVAILABLE",
    })).toBe(true);
    expect(shouldRetainAuthInvalidationReplayIntent({
      httpStatus: 409,
      errorCode: "GW.IDEM.IN_FLIGHT",
    })).toBe(true);
    expect(shouldRetainAuthInvalidationReplayIntent({
      httpStatus: 409,
      errorCode: "CORE.AUTH_INVALIDATION_REPLAY.EVENT_NOT_ELIGIBLE",
    })).toBe(false);
  });
});

function dryRunCommand(): AuthInvalidationReplayCommand {
  return {
    target: "CONTROL_PLANE",
    mode: "DRY_RUN",
    eventIds: [EVENT_ID_1],
    reason: "Validate terminal invalidation",
  };
}

function receipt(command: AuthInvalidationReplayCommand) {
  return {
    commandId: COMMAND_ID,
    target: command.target,
    tenantId: command.tenantId ?? null,
    mode: command.mode,
    eventIds: command.eventIds,
    eligibleEventCount: command.eventIds.length,
    replayedEventCount: command.mode === "APPLY" ? command.eventIds.length : 0,
    outcome: command.mode === "APPLY" ? "REPLAY_SCHEDULED" : "DRY_RUN_VALIDATED",
  };
}
