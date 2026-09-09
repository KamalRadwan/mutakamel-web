import { describe, expect, it } from "vitest";
import { NAV_SECTIONS } from "@/design-system";
import { isSupportedCorePath, TENANT_ROUTES } from "@/lib/navigation/tenant-routes";
import { applicationAccessScopeRoute } from "./application-access-route";

describe("Application access navigation", () => {
  it("discovers exact-user Addon seats under its independent ANY pair and owner exception", () => {
    const entry = NAV_SECTIONS.flatMap((section) => section.items).find((item) => item.href === TENANT_ROUTES.coreAddonSeats);
    expect(entry?.hasAccess(["applications.addon_seats.read"])).toBe(true);
    expect(entry?.hasAccess(["applications.addon_seats.manage"])).toBe(true);
    expect(entry?.hasAccess([], true)).toBe(true);
    expect(entry?.hasAccess(["users.user.read", "applications.activation.manage"])).toBe(false);
    expect(isSupportedCorePath(TENANT_ROUTES.coreAddonSeats)).toBe(true);
    expect(isSupportedCorePath(`${TENANT_ROUTES.coreAddonSeats}/b4ce3816-3469-4039-9e3b-d020a24d3c9d`)).toBe(true);
    expect(isSupportedCorePath(`${TENANT_ROUTES.coreAddonSeats}/user/assign`)).toBe(false);
  });
  it("offers the activation read/manage pair plus explicit owner exception only", () => {
    const entry = NAV_SECTIONS.flatMap((section) => section.items).find((item) => item.href === TENANT_ROUTES.coreApplicationAccess);
    expect(entry).toBeDefined();
    expect(entry?.hasAccess(["applications.activation.read"])).toBe(true);
    expect(entry?.hasAccess(["applications.activation.manage"])).toBe(true);
    expect(entry?.hasAccess([], true)).toBe(true);
    expect(entry?.hasAccess([], false)).toBe(false);
    expect(entry?.hasAccess(["org.company.read", "applications.activation.read.all"])).toBe(false);
    expect(entry?.requiresTenantOwner).toBeUndefined();
  });
  it.each(["companies", "branches"])("admits the verified %s directory without admitting extra descendants", (scope) => {
    const id = "018ef54e-2222-7777-8888-000000000001";
    expect(isSupportedCorePath(`/core/application-access/${scope}/${id}`)).toBe(true);
    expect(applicationAccessScopeRoute([scope, id])?.scopeId).toBe(id);
    expect(applicationAccessScopeRoute([scope, id, "extra"])).toBeNull();
    expect(isSupportedCorePath(`/core/application-access/${scope}/${id}/extra`)).toBe(false);
  });
});
