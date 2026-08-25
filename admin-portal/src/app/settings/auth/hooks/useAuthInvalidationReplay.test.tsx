// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  replay: vi.fn(),
  uuid: vi.fn(),
}));

vi.mock("@/lib/utils/uuid", () => ({ generateUUIDv7: mocks.uuid }));
vi.mock("../authInvalidationReplay", async (importOriginal) => ({
  ...await importOriginal<typeof import("../authInvalidationReplay")>(),
  replayAuthInvalidationOutbox: mocks.replay,
}));

import { useAuthInvalidationReplay } from "./useAuthInvalidationReplay";
import type {
  AuthInvalidationReplayCommand,
  AuthInvalidationReplayReceipt,
} from "../authInvalidationReplay";

const EVENT_ID = "019fc7e0-bcef-727f-90cb-ff6028ed3302";
const DRY_COMMAND_ID = "019fc7e0-bcef-727f-90cb-ff6028ed3303";
const APPLY_COMMAND_ID = "019fc7e0-bcef-727f-90cb-ff6028ed3304";

describe("useAuthInvalidationReplay", () => {
  beforeEach(() => {
    mocks.replay.mockReset().mockImplementation(
      async (command: AuthInvalidationReplayCommand, commandId: string) =>
        makeReceipt(command, commandId),
    );
    mocks.uuid.mockReset()
      .mockReturnValueOnce(DRY_COMMAND_ID)
      .mockReturnValueOnce(APPLY_COMMAND_ID);
  });

  it("requires a successful exact dry run before apply and uses a fresh key for changed mode", async () => {
    const { result } = renderHook(() => useAuthInvalidationReplay());
    populate(result.current);

    act(() => expect(result.current.requestConfirmation("DRY_RUN")).toBe(true));
    await act(async () => result.current.confirm());

    expect(mocks.replay).toHaveBeenNthCalledWith(1, {
      target: "CONTROL_PLANE",
      mode: "DRY_RUN",
      eventIds: [EVENT_ID],
      reason: "Recover terminal invalidation",
    }, DRY_COMMAND_ID);
    expect(result.current.canApply).toBe(true);
    expect(result.current.receipt?.outcome).toBe("DRY_RUN_VALIDATED");

    act(() => expect(result.current.requestConfirmation("APPLY")).toBe(true));
    await act(async () => result.current.confirm());

    expect(mocks.replay).toHaveBeenNthCalledWith(2, {
      target: "CONTROL_PLANE",
      mode: "APPLY",
      eventIds: [EVENT_ID],
      reason: "Recover terminal invalidation",
    }, APPLY_COMMAND_ID);
    expect(result.current.receipt?.outcome).toBe("REPLAY_SCHEDULED");
    expect(result.current.canApply).toBe(false);
  });

  it("reuses the same body and UUIDv7 only after an explicit ambiguous retry", async () => {
    mocks.replay
      .mockRejectedValueOnce({
        isNormalized: true,
        httpStatus: 503,
        errorCode: "UPSTREAM_UNAVAILABLE",
        message: "Unavailable",
        correlationId: "corr-ambiguous",
      })
      .mockImplementationOnce(
        async (command: AuthInvalidationReplayCommand, commandId: string) =>
          makeReceipt(command, commandId),
      );
    const { result } = renderHook(() => useAuthInvalidationReplay());
    populate(result.current);

    act(() => result.current.requestConfirmation("DRY_RUN"));
    await act(async () => result.current.confirm());
    expect(result.current.retryMode).toBe("DRY_RUN");
    expect(result.current.error?.correlationId).toBe("corr-ambiguous");

    act(() => result.current.requestConfirmation("DRY_RUN"));
    await act(async () => result.current.confirm());

    expect(mocks.replay).toHaveBeenCalledTimes(2);
    expect(mocks.replay.mock.calls[0]).toEqual(mocks.replay.mock.calls[1]);
    expect(mocks.uuid).toHaveBeenCalledTimes(1);
    expect(result.current.retryMode).toBeNull();
  });

  it("invalidates apply eligibility whenever the exact intent changes", async () => {
    const { result } = renderHook(() => useAuthInvalidationReplay());
    populate(result.current);
    act(() => result.current.requestConfirmation("DRY_RUN"));
    await act(async () => result.current.confirm());
    expect(result.current.canApply).toBe(true);

    act(() => result.current.setReason("A different recovery intent"));
    expect(result.current.canApply).toBe(false);
    act(() => expect(result.current.requestConfirmation("APPLY")).toBe(false));
    expect(result.current.validationErrors.workflow).toBe("dryRunRequired");
  });
});

function populate(current: ReturnType<typeof useAuthInvalidationReplay>) {
  act(() => {
    current.setEventIdsText(EVENT_ID);
    current.setReason("Recover terminal invalidation");
  });
}

function makeReceipt(
  command: AuthInvalidationReplayCommand,
  commandId: string,
): AuthInvalidationReplayReceipt {
  return {
    commandId,
    target: command.target,
    tenantId: command.tenantId ?? null,
    mode: command.mode,
    eventIds: command.eventIds,
    eligibleEventCount: command.eventIds.length,
    replayedEventCount: command.mode === "APPLY" ? command.eventIds.length : 0,
    outcome: command.mode === "APPLY" ? "REPLAY_SCHEDULED" : "DRY_RUN_VALIDATED",
  };
}
