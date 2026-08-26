// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthInvalidationReplayPanel } from "./AuthInvalidationReplayPanel";
import type {
  AuthInvalidationReplayCommand,
  AuthInvalidationReplayReceipt,
} from "../authInvalidationReplay";

const state = vi.hoisted(() => ({
  user: { isSuperAdmin: false, permissions: [] as string[] },
  replay: vi.fn(),
  uuid: vi.fn(),
}));

vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({ user: state.user }),
}));
vi.mock("@/lib/utils/uuid", () => ({ generateUUIDv7: state.uuid }));
vi.mock("../authInvalidationReplay", async (importOriginal) => ({
  ...await importOriginal<typeof import("../authInvalidationReplay")>(),
  replayAuthInvalidationOutbox: state.replay,
}));
vi.mock("@/i18n/I18nContext", async () => {
  const { en } = await import("@/i18n/dictionaries/en");
  return { useI18n: () => ({ lang: "en", dir: "ltr", t: en }) };
});

const EVENT_ID = "019fc7e0-bcef-727f-90cb-ff6028ed3302";
const DRY_COMMAND_ID = "019fc7e0-bcef-727f-90cb-ff6028ed3303";
const APPLY_COMMAND_ID = "019fc7e0-bcef-727f-90cb-ff6028ed3304";

describe("AuthInvalidationReplayPanel", () => {
  beforeEach(() => {
    state.user = { isSuperAdmin: false, permissions: [] };
    state.uuid.mockReset()
      .mockReturnValueOnce(DRY_COMMAND_ID)
      .mockReturnValueOnce(APPLY_COMMAND_ID);
    state.replay.mockReset().mockImplementation(
      async (command: AuthInvalidationReplayCommand, commandId: string) =>
        makeReceipt(command, commandId),
    );
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      callback(0);
      return 1;
    });
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => undefined);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("does not mount the operator control without its dedicated permission", () => {
    render(<AuthInvalidationReplayPanel />);
    expect(screen.queryByText("Authentication invalidation recovery")).toBeNull();
    expect(state.replay).not.toHaveBeenCalled();
  });

  it("confirmation-gates dry run and typed APPLY after the exact intent validates", async () => {
    authorize();
    render(<AuthInvalidationReplayPanel />);
    fillIntent();

    fireEvent.click(screen.getByRole("button", { name: "Validate dry run" }));
    expect(state.replay).not.toHaveBeenCalled();
    const dryDialog = screen.getByRole("alertdialog", {
      name: "Validate this replay intent?",
    });
    expect(dryDialog).toBeInTheDocument();
    fireEvent.click(within(dryDialog).getByRole("button", { name: "Run validation" }));

    await waitFor(() => expect(screen.getByText("Dry run validated")).toBeInTheDocument());
    expect(screen.getByText("corr-DRY_RUN")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Apply replay" })).toBeEnabled();

    fireEvent.click(screen.getByRole("button", { name: "Apply replay" }));
    const applyDialog = screen.getByRole("alertdialog", {
      name: "Requeue these authentication invalidations?",
    });
    const confirmInput = within(applyDialog).getByPlaceholderText("APPLY");
    fireEvent.change(confirmInput, { target: { value: "APPLY" } });
    fireEvent.click(within(applyDialog).getByRole("button", { name: "Apply replay" }));

    await waitFor(() => expect(screen.getByText("Replay scheduled")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Apply replay" })).toBeDisabled();
    expect(state.replay).toHaveBeenNthCalledWith(1, expect.objectContaining({
      mode: "DRY_RUN",
      eventIds: [EVENT_ID],
    }), DRY_COMMAND_ID);
    expect(state.replay).toHaveBeenNthCalledWith(2, expect.objectContaining({
      mode: "APPLY",
      eventIds: [EVENT_ID],
    }), APPLY_COMMAND_ID);
  });

  it("shows localized error, code, correlation, and explicit exact-retry state", async () => {
    authorize();
    state.replay.mockRejectedValueOnce({
      isNormalized: true,
      httpStatus: 503,
      errorCode: "CORE.AUTH_INVALIDATION_REPLAY.TENANT_UNAVAILABLE",
      message: "Unavailable",
      correlationId: "corr-outbox-503",
    });
    render(<AuthInvalidationReplayPanel />);
    fillIntent();
    fireEvent.click(screen.getByRole("button", { name: "Validate dry run" }));
    fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", {
      name: "Run validation",
    }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("The exact tenant database target is currently unavailable.");
    expect(alert).toHaveTextContent("CORE.AUTH_INVALIDATION_REPLAY.TENANT_UNAVAILABLE");
    expect(alert).toHaveTextContent("corr-outbox-503");
    expect(within(alert).getByRole("button", { name: "Retry the exact request" }))
      .toBeInTheDocument();
  });
});

function authorize() {
  state.user = {
    isSuperAdmin: false,
    permissions: ["admin.auth_invalidation_outbox.replay"],
  };
}

function fillIntent() {
  fireEvent.change(screen.getByLabelText("Failed event IDs"), {
    target: { value: EVENT_ID },
  });
  fireEvent.change(screen.getByLabelText("Recovery reason"), {
    target: { value: "Recover terminal invalidation" },
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
    correlationId: `corr-${command.mode}`,
  };
}
