import { describe, expect, it } from "vitest";
import { NAV_SECTIONS } from "@/design-system";
import { isSupportedCorePath, TENANT_ROUTES } from "@/lib/navigation/tenant-routes";
import { routeTitleKey } from "@/lib/navigation/route-title";

describe("published offer route discovery", () => {
  it("admits only the exact implemented catalogue page", () => {
    expect(isSupportedCorePath(TENANT_ROUTES.coreSubscriptionCatalogue)).toBe(true);
    expect(isSupportedCorePath(`${TENANT_ROUTES.coreSubscriptionCatalogue}/purchase`)).toBe(false);
  });
  it("uses the existing explicit owner navigation gate, not a fabricated permission", () => {
    const entry = NAV_SECTIONS.flatMap((section) => section.items).find((item) => item.href === TENANT_ROUTES.coreSubscriptionCatalogue);
    expect(entry?.requiresTenantOwner).toBe(true); expect(entry?.hasAccess([])).toBe(true);
  });
  it("has a dedicated bilingual navigation title", () => {
    expect(routeTitleKey(TENANT_ROUTES.coreSubscriptionCatalogue)).toBe("coreSubscriptionCatalogue");
  });
});
