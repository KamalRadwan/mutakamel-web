import { describe, expect, it } from "vitest";
import { describeTenantPlacementBlocker } from "./placement-blockers";

const KNOWN_CODES = [
  "TENANT_NOT_RELOCATABLE",
  "RELOCATION_IN_PROGRESS",
  "PLACEMENT_CUTOVER_IN_PROGRESS",
  "MAINTENANCE_FENCE_OPEN",
  "STORAGE_MIGRATION_IN_PROGRESS",
] as const;

describe("describeTenantPlacementBlocker", () => {
  it("explains every blocker Core can return, in both languages", () => {
    for (const code of KNOWN_CODES) {
      for (const lang of ["ar", "en"] as const) {
        const described = describeTenantPlacementBlocker(code, lang);
        expect(described.code).toBe(code);
        expect(described.title.length).toBeGreaterThan(0);
        expect(described.explanation.length).toBeGreaterThan(0);
      }
    }
  });

  it("gives Arabic and English distinct copy rather than one shared string", () => {
    for (const code of KNOWN_CODES) {
      expect(describeTenantPlacementBlocker(code, "ar").title).not.toBe(
        describeTenantPlacementBlocker(code, "en").title,
      );
    }
  });

  it("still renders a blocker code this build does not know", () => {
    const described = describeTenantPlacementBlocker("SOME_NEW_FENCE", "en");
    expect(described.code).toBe("SOME_NEW_FENCE");
    expect(described.explanation).toContain("does not recognize");
  });
});
