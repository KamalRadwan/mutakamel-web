// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { TenantUserProfile } from "@/context/AuthContext";
import { useAuthScopeKey } from "./useAuthScopeKey";
import { useStablePermissions } from "./useStablePermissions";
import { useUserProfiles } from "./useUserProfiles";
import { useAuditReferenceLabels } from "./useAuditReferenceLabels";

const auth = vi.hoisted(() => ({ user: null as TenantUserProfile | null, realtimeAuthGeneration: "session" }));
vi.mock("@/context/AuthContext", () => ({ useTenantAuth: () => auth }));
vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ lang: "en", t: { audit: { valueUnavailable: "Unavailable" } } }) }));
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

it("stabilizes permissions and scope by value while detecting scope changes", () => {
  const user = { id: "actor", permissions: ["users.user.read"], accessibleBranches: ["branch"], accessibleCompanies: [], teamMemberships: [] } as unknown as TenantUserProfile;
  const { result, rerender } = renderHook(({ user }) => ({ permissions: useStablePermissions(user), key: useAuthScopeKey(user) }), { initialProps: { user } });
  const previous = result.current;
  rerender({ user: { ...user, permissions: [...user.permissions], accessibleBranches: [...user.accessibleBranches] } });
  expect(result.current.permissions).toBe(previous.permissions);
  expect(result.current.key).toBe(previous.key);
  rerender({ user: { ...user, accessibleBranches: ["other"] } });
  expect(result.current.key).not.toBe(previous.key);
  rerender({ user: { ...user, permissions: [] } });
  expect(result.current.permissions).not.toBe(previous.permissions);
});

it("treats missing and undefined scope arrays as empty", () => {
  const user = { id: "actor", permissions: [] } as unknown as TenantUserProfile;
  const { result, rerender } = renderHook(({ user }) => useAuthScopeKey(user), { initialProps: { user } });
  const key = result.current;
  rerender({ user: { ...user, accessibleBranches: [], accessibleCompanies: [], teamMemberships: [] } });
  expect(result.current).toBe(key);
  rerender({ user: { ...user, accessibleBranches: undefined, accessibleCompanies: undefined, teamMemberships: undefined } as unknown as TenantUserProfile });
  expect(result.current).toBe(key);
});

it("keeps reordered scope arrays stable without mutating the profile", () => {
  const membership = { id: "membership-b", teamId: "team-b", companyId: "company-b", branchId: null, departmentId: null, role: "member", isPrimary: false };
  const otherMembership = { ...membership, id: "membership-a", teamId: "team-a" };
  const user = {
    id: "actor", permissions: [],
    accessibleBranches: Object.freeze(["branch-b", "branch-a"]),
    accessibleCompanies: Object.freeze(["company-b", "company-a"]),
    teamMemberships: Object.freeze([membership, otherMembership]),
  } as unknown as TenantUserProfile;
  const { result, rerender } = renderHook(({ user }) => useAuthScopeKey(user), { initialProps: { user } });
  const key = result.current;
  rerender({ user: {
    ...user,
    accessibleBranches: [...user.accessibleBranches].reverse(),
    accessibleCompanies: [...user.accessibleCompanies].reverse(),
    teamMemberships: [...user.teamMemberships].reverse().map((item) => ({ ...item })),
  } });
  expect(result.current).toBe(key);
  expect(user.accessibleBranches).toEqual(["branch-b", "branch-a"]);
  expect(user.accessibleCompanies).toEqual(["company-b", "company-a"]);
  expect(user.teamMemberships).toEqual([membership, otherMembership]);
  rerender({ user: { ...user, teamMemberships: user.teamMemberships.map((item) => ({ ...item, isPrimary: true })) } });
  expect(result.current).not.toBe(key);
});

it("does not serialize either lookup scope on unchanged renders or identical profile refreshes", async () => {
  auth.user = { id: "actor", permissions: [], accessibleBranches: [], accessibleCompanies: [], teamMemberships: [] } as unknown as TenantUserProfile;
  const { rerender } = renderHook(() => {
    useUserProfiles([]);
    useAuditReferenceLabels([], undefined, true);
  });
  await act(async () => {});
  const stringify = vi.spyOn(JSON, "stringify");
  await act(async () => rerender());
  expect(stringify).not.toHaveBeenCalled();
  auth.user = { ...auth.user, permissions: [], accessibleBranches: [], accessibleCompanies: [], teamMemberships: [] };
  await act(async () => rerender());
  expect(stringify).not.toHaveBeenCalled();
});
