// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearWalletConfirmation,
  readWalletConfirmation,
  saveWalletConfirmation,
  walletConfirmationStorageKey,
  type WalletConfirmation,
} from "./wallet-adjustment-recovery";

const command: WalletConfirmation = {
  actorId: "admin",
  tenantId: "tenant",
  quoteId: "019f0000-0000-7000-8000-000000000001",
  note: "Reviewed credit",
  key: "019f0000-0000-7000-8000-000000000002",
};

describe("wallet confirmation recovery", () => {
  afterEach(() => vi.restoreAllMocks());
  beforeEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
  });

  it("persists only the original command, bound to its actor and tenant", () => {
    saveWalletConfirmation(command);
    expect(readWalletConfirmation("admin", "tenant")).toEqual(command);
    expect(readWalletConfirmation("other-admin", "tenant")).toBeNull();
    expect(readWalletConfirmation("admin", "other-tenant")).toBeNull();
    expect(JSON.parse(window.localStorage.getItem(walletConfirmationStorageKey("admin", "tenant"))!))
      .toEqual(command);
  });

  it("refuses to replace an unresolved command and clears only the matching key", () => {
    saveWalletConfirmation(command);
    const replacement = { ...command, note: "Another credit", key: "019f0000-0000-7000-8000-000000000003" };
    expect(saveWalletConfirmation(replacement)).toEqual(command);
    clearWalletConfirmation(replacement);
    expect(readWalletConfirmation("admin", "tenant")).toEqual(command);
    clearWalletConfirmation(command);
    expect(readWalletConfirmation("admin", "tenant")).toBeNull();
  });

  it.each([
    "{",
    JSON.stringify({ ...command, actorId: "other-admin" }),
    JSON.stringify({ ...command, tenantId: "other-tenant" }),
    JSON.stringify({ ...command, quoteId: "not-a-quote" }),
    JSON.stringify({ ...command, key: "not-a-key" }),
    JSON.stringify({ ...command, note: "" }),
  ])("fails closed without removing invalid evidence: %s", (raw) => {
    const storageKey = walletConfirmationStorageKey("admin", "tenant");
    window.localStorage.setItem(storageKey, raw);
    expect(() => readWalletConfirmation("admin", "tenant")).toThrow();
    expect(() => saveWalletConfirmation(command)).toThrow();
    expect(window.localStorage.getItem(storageKey)).toBe(raw);
  });

  it("requires persistence before a command can be returned for dispatch", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("quota"); });
    expect(() => saveWalletConfirmation(command)).toThrow();
  });
});
