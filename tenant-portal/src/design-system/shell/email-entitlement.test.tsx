// @vitest-environment jsdom
import { cleanup, render, renderHook, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import { CORE_SETTINGS_NAV_ITEMS } from "./nav-config";
import { useNavTree } from "./useNavTree";
import { SubNav } from "./SubNav";

const state = vi.hoisted(() => ({
  user: {
    permissions: ["workspace.email.read"],
    isTenantOwner: false,
    featureEntitlements: { "crm.outbound_email": false },
  },
}));
vi.mock("@/context/AuthContext", () => ({ useTenantAuth: () => state }));
vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ t: en, lang: "en", dir: "ltr" }) }));
vi.mock("next/navigation", () => ({ usePathname: () => "/core/settings/email" }));
afterEach(cleanup);

describe.each([false, true])("email navigation for owner=%s", (owner) => {
  it.each([false, true])("requires the email entitlement (%s) in both navigation surfaces", (entitled) => {
    state.user.isTenantOwner = owner;
    state.user.permissions = ["workspace.email.read"];
    state.user.featureEntitlements["crm.outbound_email"] = entitled;
    const { result } = renderHook(() => useNavTree());
    expect(result.current.flatMap((section) => section.items).some((item) => item.id === "coreEmail")).toBe(entitled);
    render(<SubNav items={CORE_SETTINGS_NAV_ITEMS} />);
    expect(screen.queryByRole("link", { name: en.nav.coreEmail }) !== null).toBe(entitled);
  });
});

it("does not let an entitlement replace the read permission", () => {
  const item = CORE_SETTINGS_NAV_ITEMS.find((entry) => entry.id === "coreEmail");
  expect(item?.hasAccess([], false, { "crm.outbound_email": true })).toBe(false);
  expect(item?.hasAccess(["workspace.email.read"], true)).toBe(false);
});
