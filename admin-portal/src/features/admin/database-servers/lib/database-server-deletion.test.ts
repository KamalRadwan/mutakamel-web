import { describe, expect, it } from "vitest";
import {
  canDestroyDatabaseServer,
  canSoftDeleteDatabaseServer,
} from "./database-server-deletion";

describe("database server deletion eligibility", () => {
  it.each(["DRAINING", "OFFLINE"] as const)(
    "allows an empty %s server to be soft deleted",
    (status) => {
      expect(
        canSoftDeleteDatabaseServer({
          status,
          currentTenants: 0,
          deletedAt: null,
        }),
      ).toBe(true);
    },
  );

  it.each(["DRAFT", "ACTIVE"] as const)(
    "rejects an empty %s server",
    (status) => {
      expect(
        canSoftDeleteDatabaseServer({
          status,
          currentTenants: 0,
          deletedAt: null,
        }),
      ).toBe(false);
    },
  );

  it("rejects a server that still hosts tenants", () => {
    expect(
      canSoftDeleteDatabaseServer({
        status: "OFFLINE",
        currentTenants: 1,
        deletedAt: null,
      }),
    ).toBe(false);
  });

  it("never offers soft delete for an already deleted server", () => {
    expect(
      canSoftDeleteDatabaseServer({
        status: "OFFLINE",
        currentTenants: 0,
        deletedAt: "2026-08-04T12:00:00.000Z",
      }),
    ).toBe(false);
  });

  it("offers Destroy only for an authoritative deleted projection", () => {
    expect(canDestroyDatabaseServer({ deletedAt: null })).toBe(false);
    expect(
      canDestroyDatabaseServer({
        deletedAt: "2026-08-04T12:00:00.000Z",
      }),
    ).toBe(true);
  });
});
