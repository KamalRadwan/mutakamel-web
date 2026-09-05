import { describe, expect, it } from "vitest";
import {
  isCurrentBackupServerRequest,
  ownsSelectedBackupServerState,
  resolveBackupServerSelection,
} from "./backup-server-request-guard";

describe("backup server request ownership", () => {
  it("accepts only the latest request for the currently selected server", () => {
    expect(
      isCurrentBackupServerRequest({
        requestServerId: "server-b",
        selectedServerId: "server-b",
        requestGeneration: 4,
        currentGeneration: 4,
      }),
    ).toBe(true);

    expect(
      isCurrentBackupServerRequest({
        requestServerId: "server-a",
        selectedServerId: "server-b",
        requestGeneration: 4,
        currentGeneration: 4,
      }),
    ).toBe(false);

    expect(
      isCurrentBackupServerRequest({
        requestServerId: "server-b",
        selectedServerId: "server-b",
        requestGeneration: 3,
        currentGeneration: 4,
      }),
    ).toBe(false);
  });

  it("permits mutations only when loaded state belongs to the selection", () => {
    expect(ownsSelectedBackupServerState("server-b", "server-b")).toBe(true);
    expect(ownsSelectedBackupServerState("server-b", "server-a")).toBe(false);
    expect(ownsSelectedBackupServerState("server-b", null)).toBe(false);
    expect(ownsSelectedBackupServerState("", "server-b")).toBe(false);
  });

  it("prioritizes a new route selection and fails closed for an unknown deep link", () => {
    const available = ["server-a", "server-b"];

    expect(resolveBackupServerSelection(available, "server-b", "server-a")).toBe(
      "server-b",
    );
    expect(resolveBackupServerSelection(available, "missing", "server-a")).toBe(
      "",
    );
    expect(resolveBackupServerSelection(available, "", "server-a")).toBe(
      "server-a",
    );
  });
});

/**
 * FE-BK01. `useBackupOverview.refreshAccess` compared its captured `serverId`
 * against `serverContext.selectedServerId` read from the SAME closure - the
 * same value twice, so the comparison was always true. It read like an
 * ownership guard and was not one, and `refresh` awaits two other reloads
 * before calling the captured `refreshAccess`, so a selection change in that
 * window landed server A's readiness under server B.
 *
 * The guard is only meaningful when the selection is read from a ref that
 * tracks the live value, which is what these cases pin.
 */
describe("selection read from a ref, not the closure", () => {
  const inFlight = {
    requestServerId: "server-a",
    requestGeneration: 3,
    currentGeneration: 3,
  };

  it("rejects a response whose server is no longer selected", () => {
    expect(
      isCurrentBackupServerRequest({ ...inFlight, selectedServerId: "server-b" }),
    ).toBe(false);
  });

  it("accepts it while that server is still selected", () => {
    expect(
      isCurrentBackupServerRequest({ ...inFlight, selectedServerId: "server-a" }),
    ).toBe(true);
  });

  it("is always true when both sides come from one stale closure", () => {
    // The defect, stated as a property: comparing a value with itself can only
    // ever pass, whatever the operator has since selected.
    const captured = "server-a";
    expect(
      isCurrentBackupServerRequest({
        ...inFlight,
        requestServerId: captured,
        selectedServerId: captured,
      }),
    ).toBe(true);
  });
});
