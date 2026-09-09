import { describe, expect, it } from "vitest";
import { initialId } from "./initial-commercial.fixture";
import { initialOptionsFixture } from "./initial-create-options.fixture";
import { readInitialCreateOptions, type InitialCreateOptions } from "./initial-create-options";

describe("Closed initial-create display options", () => {
  it("preserves sealed labels, negative ranks, bigint revisions and empty collections", () => {
    const options = initialOptionsFixture();
    options.applications[0].technicalDefinitionRevision = "9223372036854775807";
    expect(readInitialCreateOptions(options)).toEqual(options);
    expect(readInitialCreateOptions({ quoteRequired: true, applications: [] }).applications).toEqual([]);
    expect(options.applications[0]).not.toHaveProperty("selectionAllowed");
  });
  it.each(["ready", "canApply", "price", "selectionAllowed", "provisioningIntent"])("rejects uncontracted authority %s at every object level", field => {
    for (const level of ["root", "app", "tier", "addon"] as const) {
      const value = initialOptionsFixture();
      const target = level === "root" ? value : level === "app" ? value.applications[0] : level === "tier" ? value.applications[0].tiers[0] : value.applications[0].addons[0];
      Object.assign(target, { [field]: true });
      expect(() => readInitialCreateOptions(value)).toThrow();
    }
  });
  it.each([
    ["unknown version", (x: InitialCreateOptions): unknown => Object.assign(x, { contractVersion: 1 })],
    ["quote bypass", (x: InitialCreateOptions): unknown => Object.assign(x, { quoteRequired: false })],
    ["rank overflow", (x: InitialCreateOptions): unknown => x.applications[0].rank = 2147483648],
    ["zero revision", (x: InitialCreateOptions): unknown => x.applications[0].technicalDefinitionRevision = "0"],
    ["revision overflow", (x: InitialCreateOptions): unknown => x.applications[0].technicalDefinitionRevision = "9223372036854775808"],
    ["empty name", (x: InitialCreateOptions): unknown => x.applications[0].name = ""],
    ["duplicate application", (x: InitialCreateOptions): unknown => x.applications.push(x.applications[0])],
    ["duplicate tier", (x: InitialCreateOptions): unknown => x.applications[0].tiers.push(x.applications[0].tiers[0])],
    ["duplicate addon", (x: InitialCreateOptions): unknown => x.applications[0].addons.push(x.applications[0].addons[0])],
    ["wrong addon namespace", (x: InitialCreateOptions): unknown => x.applications[0].addons[0].key = "trade.logistics"],
    ["legacy addon identity", (x: InitialCreateOptions): unknown => x.applications[0].addons[0].addonId = initialId(14).replace("-7000-", "-4000-")],
    ["foreign compatible tier", (x: InitialCreateOptions): unknown => x.applications[0].addons[0].compatibleTierIds = [initialId(80)]],
    ["duplicate compatible tier", (x: InitialCreateOptions): unknown => x.applications[0].addons[0].compatibleTierIds.push(initialId(12))],
    ["missing tier diagnostic", (x: InitialCreateOptions): unknown => x.applications[0].tiers = []],
    ["false no-compatible diagnostic", (x: InitialCreateOptions): unknown => x.applications[0].addons[0].catalogueReasons = ["ACTIVE_COMPATIBLE_TIER_REQUIRED"]],
    ["duplicate diagnostics", (x: InitialCreateOptions): unknown => x.applications[0].selectionBlockers = ["TECHNICAL_READINESS_BLOCKED", "TECHNICAL_READINESS_BLOCKED"]],
  ] as const)("rejects %s", (_label, change) => {
    const value = initialOptionsFixture(); change(value);
    expect(() => readInitialCreateOptions(value)).toThrow();
  });
  it("preserves revoked and no-compatible diagnostics without upgrading readiness", () => {
    const value = initialOptionsFixture(), app = value.applications[0];
    app.tiers = []; app.catalogueReasons = ["ACTIVE_TIER_REQUIRED"];
    app.addons[0].compatibleTierIds = [];
    app.addons[0].catalogueReasons = ["ADDON_DEFINITION_REVOKED", "ACTIVE_COMPATIBLE_TIER_REQUIRED"];
    expect(readInitialCreateOptions(value)).toEqual(value);
    app.addons[0].catalogueReasons.reverse(); expect(() => readInitialCreateOptions(value)).toThrow();
  });
  it("requires source ordering and compatible tiers in parent order", () => {
    const value = initialOptionsFixture(), app = value.applications[0];
    app.tiers.push({ id: initialId(80), key: "plus", name: "CRM Plus", rank: 1 });
    app.addons[0].compatibleTierIds.push(initialId(80));
    expect(readInitialCreateOptions(value)).toEqual(value);
    app.addons[0].compatibleTierIds.reverse(); expect(() => readInitialCreateOptions(value)).toThrow();
    app.addons[0].compatibleTierIds.reverse(); app.tiers.reverse(); expect(() => readInitialCreateOptions(value)).toThrow();
  });
  it("rejects collection overflow without truncating", () => {
    const value = initialOptionsFixture();
    value.applications = Array.from({ length: 101 }, (_, index) => ({ ...value.applications[0], applicationId: initialId(1000 + index), key: `app${index}`, tiers: [], addons: [], catalogueReasons: ["ACTIVE_TIER_REQUIRED"] }));
    expect(() => readInitialCreateOptions(value)).toThrow();
    const tiers = initialOptionsFixture(); tiers.applications[0].tiers = Array.from({ length: 101 }, (_, index) => ({ id: initialId(1000 + index), key: `tier${index}`, name: "Tier", rank: index }));
    expect(() => readInitialCreateOptions(tiers)).toThrow();
  });
});
