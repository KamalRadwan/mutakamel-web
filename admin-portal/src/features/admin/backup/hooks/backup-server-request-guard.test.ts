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
