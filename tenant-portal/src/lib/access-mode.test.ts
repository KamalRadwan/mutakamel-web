import { describe, expect, it } from "vitest";
import { ACCESS_MODES, accessModeCapabilities, isAccessMode } from "./access-mode";

describe("access-mode", () => {
  it("carries exactly the four wire values AccessModeEnum declares", () => {
    expect([...ACCESS_MODES]).toEqual(["FULL", "DUNNING", "READ_ONLY", "BLOCKED"]);
  });

  it("rejects anything that is not one of them, including near-misses", () => {
    expect(isAccessMode("FULL")).toBe(true);
    expect(isAccessMode("full")).toBe(false);
    expect(isAccessMode("READONLY")).toBe(false);
    expect(isAccessMode(undefined)).toBe(false);
    expect(isAccessMode(null)).toBe(false);
    expect(isAccessMode(0)).toBe(false);
  });

  it("mirrors SubscriptionEnforcementGuard: BLOCKED refuses reads as well as writes", () => {
    expect(accessModeCapabilities("BLOCKED")).toEqual({
      canRead: false,
      canMutate: false,
      isRestricted: true,
    });
  });

  it("mirrors the guard: READ_ONLY and DUNNING read but do not write", () => {
    for (const mode of ["READ_ONLY", "DUNNING"] as const) {
      expect(accessModeCapabilities(mode)).toEqual({
        canRead: true,
        canMutate: false,
        isRestricted: true,
      });
    }
  });

  it("reports full capability for FULL", () => {
    expect(accessModeCapabilities("FULL")).toEqual({
      canRead: true,
      canMutate: true,
      isRestricted: false,
    });
  });

  it("fails OPEN on an unresolved mode — a client check is advisory, and failing closed would seal the product", () => {
    expect(accessModeCapabilities(null)).toEqual({
      canRead: true,
      canMutate: true,
      isRestricted: false,
    });
  });
});
