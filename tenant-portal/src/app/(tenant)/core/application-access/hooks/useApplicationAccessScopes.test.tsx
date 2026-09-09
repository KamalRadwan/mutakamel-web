// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
const mocks = vi.hoisted(() => ({ push: vi.fn(), auth: { isAuthenticated: true, user: { id: "actor", isTenantOwner: false,
  permissions: ["applications.activation.read"], accessibleCompanies: ["018ef54e-2222-7777-8888-000000000001"], accessibleBranches: ["018ef54e-2222-7777-8888-000000000002"] } } }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock("@/context/AuthContext", () => ({ useTenantAuth: () => mocks.auth }));
vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ t: en, lang: "en" }) }));
const { useApplicationAccessScopes } = await import("./useApplicationAccessScopes");
beforeEach(() => { mocks.push.mockReset(); mocks.auth.isAuthenticated = true; mocks.auth.user.permissions = ["applications.activation.read"]; mocks.auth.user.isTenantOwner = false; });
afterEach(cleanup);
describe("Application scope discovery", () => {
  it("navigates a known Company and Branch without fetching organization data", () => {
    const { result } = renderHook(useApplicationAccessScopes);
    act(() => result.current.open(`companies:${mocks.auth.user.accessibleCompanies[0]}`));
    expect(mocks.push).toHaveBeenLastCalledWith(`/core/application-access/companies/${mocks.auth.user.accessibleCompanies[0]}`);
    act(() => result.current.open(`branches:${mocks.auth.user.accessibleBranches[0]}`));
    expect(mocks.push).toHaveBeenLastCalledWith(`/core/application-access/branches/${mocks.auth.user.accessibleBranches[0]}`);
  });
  it.each(["companies:../other", "tenants:018ef54e-2222-7777-8888-000000000001", "companies:018ef54e-2222-7777-8888-000000000099", "companies:018ef54e-2222-7777-8888-000000000001:extra"])("does not navigate arbitrary picker input %s", (value) => {
    const { result } = renderHook(useApplicationAccessScopes);
    act(() => result.current.open(value)); expect(mocks.push).not.toHaveBeenCalled();
  });
  it("distinguishes discovery from admission", () => {
    mocks.auth.user.permissions = ["org.company.read"];
    const { result } = renderHook(useApplicationAccessScopes);
    expect(result.current.companies).toHaveLength(1);
    expect(result.current.allowed).toBe(false);
    act(() => result.current.open(`companies:${mocks.auth.user.accessibleCompanies[0]}`));
    expect(mocks.push).not.toHaveBeenCalled();
  });
  it("allows administrative owner discovery but not an unauthenticated owner claim", () => {
    mocks.auth.user.permissions = []; mocks.auth.user.isTenantOwner = true;
    const { result, rerender } = renderHook(useApplicationAccessScopes);
    expect(result.current.allowed).toBe(true);
    mocks.auth.isAuthenticated = false; rerender();
    expect(result.current.allowed).toBe(false);
  });
});
