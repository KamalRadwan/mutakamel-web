import { describe, expect, it } from "vitest";
import { resolveStatusRole, type StatusKind } from "./tone-map";

// Wire values transcribed from
// ../backend/mutakamel-apps/core-app/packages/common/src/enums/ on
// 2026-08-30. This test is the regression fence: if the backend adds a value
// and nobody extends the map, StatusBadge silently renders it as an unmapped
// neutral badge, and only an exhaustiveness check like this catches it.
const CORE_LIFECYCLES: Array<[StatusKind, string[]]> = [
  ["TenantStatus", ["PROVISIONING", "PROVISIONING_FAILED", "ACTIVE", "SUSPENDED", "DELETED"]],
  ["UserStatus", ["INVITED", "ACTIVE", "SUSPENDED", "DEACTIVATED"]],
  [
    "SubscriptionStatus",
    ["TRIAL", "PENDING_ACTIVATION", "ACTIVE", "PAST_DUE", "CANCELLED"],
  ],
  ["AccessMode", ["FULL", "DUNNING", "READ_ONLY", "BLOCKED"]],
];

describe("tone-map — Core lifecycles", () => {
  it.each(CORE_LIFECYCLES)("maps every %s value the backend enum declares", (kind, values) => {
    for (const value of values) {
      expect(resolveStatusRole(kind, value), `${kind}.${value}`).toBeDefined();
    }
  });

  it("gives the healthy value of each lifecycle the positive role", () => {
    expect(resolveStatusRole("TenantStatus", "ACTIVE")).toBe("positive");
    expect(resolveStatusRole("UserStatus", "ACTIVE")).toBe("positive");
    expect(resolveStatusRole("SubscriptionStatus", "ACTIVE")).toBe("positive");
    expect(resolveStatusRole("AccessMode", "FULL")).toBe("positive");
  });

  it("treats a terminal-bad value as negative, not merely cautionary", () => {
    expect(resolveStatusRole("TenantStatus", "PROVISIONING_FAILED")).toBe("negative");
    expect(resolveStatusRole("TenantStatus", "DELETED")).toBe("negative");
    expect(resolveStatusRole("UserStatus", "DEACTIVATED")).toBe("negative");
    expect(resolveStatusRole("SubscriptionStatus", "CANCELLED")).toBe("negative");
    expect(resolveStatusRole("AccessMode", "BLOCKED")).toBe("negative");
  });

  it("renders an in-flight value as ink + motion rather than spending a hue on it", () => {
    expect(resolveStatusRole("TenantStatus", "PROVISIONING")).toBe("pending");
    expect(resolveStatusRole("UserStatus", "INVITED")).toBe("pending");
    expect(resolveStatusRole("SubscriptionStatus", "TRIAL")).toBe("pending");
  });

  it("puts both suspended-style values in caution, matching the backend's dunning semantics", () => {
    expect(resolveStatusRole("TenantStatus", "SUSPENDED")).toBe("caution");
    expect(resolveStatusRole("UserStatus", "SUSPENDED")).toBe("caution");
    expect(resolveStatusRole("SubscriptionStatus", "PAST_DUE")).toBe("caution");
    expect(resolveStatusRole("AccessMode", "DUNNING")).toBe("caution");
    expect(resolveStatusRole("AccessMode", "READ_ONLY")).toBe("caution");
  });

  it("leaves a value the backend never declares unmapped, so an enum change stays visible", () => {
    expect(resolveStatusRole("TenantStatus", "ARCHIVED")).toBeUndefined();
    expect(resolveStatusRole("SubscriptionStatus", "EXPIRED")).toBeUndefined();
  });
});
