// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { RolesDialog } from "./tenant-access-dialogs";
import { tenantAccessCopy } from "../copy";
import type { TenantAccessController } from "../use-tenant-access";
import type { TenantUserRoleAssignment } from "../types";
import { BRANCH_ID, ROLE_ID, TENANT_ID, branchFixture, pageFixture, roleFixture, userFixture } from "../__tests__/fixtures";

const mocks = vi.hoisted(() => ({ listRoles: vi.fn(), listBranches: vi.fn() }));
vi.mock("../api", () => ({ tenantAccessApi: mocks }));

vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => ({ lang: "en", dir: "ltr", t: { common: { close: "Close" } } }),
  useOptionalI18n: () => ({ lang: "en", dir: "ltr", t: { common: { close: "Close" } } }),
}));

// Radix scrolls the focused option into view. jsdom has no layout scrolling;
// retain the real Select and Dialog handlers and supply only that missing API.
const scrollDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "scrollIntoView");
beforeAll(() => {
  if (!scrollDescriptor) {
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", { configurable: true, value: () => {} });
  }
});
afterAll(() => {
  if (!scrollDescriptor) Reflect.deleteProperty(HTMLElement.prototype, "scrollIntoView");
});

afterEach(cleanup);
beforeEach(() => {
  mocks.listRoles.mockReset().mockResolvedValue(pageFixture([roleFixture]));
  mocks.listBranches.mockReset().mockResolvedValue(pageFixture([branchFixture]));
});

function setup(locale: "en" | "ar", scopedOnly = false) {
  const branch = userFixture().roleAssignments[0];
  const scoped: TenantUserRoleAssignment[] = [
    { ...branch, assignmentId: "019ff251-3000-7000-8000-000000000003", source: "SCOPE_ROLE" },
    { ...branch, assignmentId: "019ff251-3000-7000-8000-000000000004", source: "SCOPE_ROLE", scope: "COMPANY", branchId: null },
    { ...branch, assignmentId: "019ff251-3000-7000-8000-000000000005", source: "SCOPE_ROLE", scope: "TENANT", companyId: null, branchId: null },
  ];
  const user = userFixture({ roleAssignments: scopedOnly ? scoped : [branch, ...scoped] });
  const replaceRoles = vi.fn().mockResolvedValue(userFixture({ roleAssignments: scoped }));
  const controller = {
    tenantId: TENANT_ID, enabled: true, ready: true, isAuthLoading: false,
    permissions: { canRead: true, canReadRoles: true, canAssignRoles: true },
    branches: { data: pageFixture([branchFixture]) },
    roles: { data: pageFixture([roleFixture]) },
    command: { pending: false, error: null },
    replaceRoles,
  } as unknown as TenantAccessController;
  const copy = tenantAccessCopy(locale);
  const onSuccess = vi.fn();
  render(<RolesDialog controller={controller} copy={copy} locale={locale} user={user} onClose={vi.fn()} onSuccess={onSuccess} />);
  return { user, copy, onSuccess, replaceRoles };
}

describe.each(["en", "ar"] as const)("role assignment provenance (%s)", (locale) => {
  it("saves only the branch-role grant without copying scoped grants", async () => {
    const { user, copy, replaceRoles, onSuccess } = setup(locale);
    const readOnly = screen.getByRole("region", { name: copy.scopedRoles });
    expect(within(readOnly).getAllByRole("listitem")).toHaveLength(3);
    expect(within(readOnly).queryByRole("button")).not.toBeInTheDocument();
    expect(within(readOnly).getByText(copy.scopedRolesReadOnly)).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: copy.remove })).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: copy.save }));
    await waitFor(() => expect(replaceRoles).toHaveBeenCalledWith(user, { assignments: [{ branchId: BRANCH_ID, roleId: ROLE_ID }] }));
    expect(onSuccess).toHaveBeenCalledWith(copy.branchRolesSaved);
  });

  it("removes the branch grant while showing that overlapping scoped grants stay effective", async () => {
    const { user, copy, replaceRoles, onSuccess } = setup(locale);
    fireEvent.click(screen.getByRole("button", { name: copy.remove }));
    expect(within(screen.getByRole("region", { name: copy.scopedRoles })).getAllByRole("listitem")).toHaveLength(3);
    fireEvent.click(screen.getByRole("button", { name: copy.save }));
    await waitFor(() => expect(replaceRoles).toHaveBeenCalledWith(user, { assignments: [] }));
    expect(onSuccess).toHaveBeenCalledWith(copy.branchRolesSaved);
  });

  it("keeps scoped-only readback read-only on the next edit", async () => {
    const { user, copy, replaceRoles } = setup(locale, true);
    expect(screen.queryByRole("button", { name: copy.remove })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: copy.save }));
    await waitFor(() => expect(replaceRoles).toHaveBeenCalledWith(user, { assignments: [] }));
  });
});

describe.each(["en", "ar"] as const)("role catalogue reach (%s)", (locale) => {
  it("assigns entries beyond page one and keeps their labels after searching", async () => {
    const laterRole = { ...roleFixture, id: "later-role", name: "Payroll" };
    const laterBranch = { ...branchFixture, id: "later-branch", name: "Alexandria" };
    const meta = { total: 51, totalPages: 2, limit: 50 };
    mocks.listRoles.mockImplementation(async (_tenant, query) => query.q
      ? pageFixture([])
      : query.page === 2 ? pageFixture([laterRole], { ...meta, page: 2, hasPrev: true })
        : pageFixture(Array.from({ length: 50 }, (_, index) => ({ ...roleFixture, id: `role-${index}` })), { ...meta, hasNext: true }));
    mocks.listBranches.mockImplementation(async (_tenant, query) => query.q
      ? pageFixture([])
      : query.page === 2 ? pageFixture([laterBranch], { ...meta, page: 2, hasPrev: true })
        : pageFixture(Array.from({ length: 50 }, (_, index) => ({ ...branchFixture, id: `branch-${index}` })), { ...meta, hasNext: true }));
    const { copy, user, replaceRoles } = setup(locale);
    const rolePaging = screen.getByRole("region", { name: copy.roles });
    const branchPaging = screen.getByRole("region", { name: copy.branch });
    await waitFor(() => {
      expect(within(rolePaging).getByRole("button", { name: copy.next })).toBeEnabled();
      expect(within(branchPaging).getByRole("button", { name: copy.next })).toBeEnabled();
    });
    fireEvent.click(within(rolePaging).getByRole("button", { name: copy.next }));
    fireEvent.click(within(branchPaging).getByRole("button", { name: copy.next }));
    await waitFor(() => expect(screen.getByRole("combobox", { name: copy.roles })).toBeEnabled());
    fireEvent.click(screen.getByRole("combobox", { name: copy.roles }));
    const roleOption = await screen.findByRole("option", { name: laterRole.name });
    await act(async () => { fireEvent.click(roleOption); });
    await waitFor(() => expect(screen.queryByRole("listbox")).not.toBeInTheDocument());
    expect(await screen.findByRole("combobox", { name: copy.roles })).toHaveTextContent(laterRole.name);
    fireEvent.click(await screen.findByRole("combobox", { name: copy.branch }));
    const branchOption = await screen.findByRole("option", { name: "Acme · Alexandria" });
    await act(async () => { fireEvent.click(branchOption); });
    await waitFor(() => expect(screen.queryByRole("listbox")).not.toBeInTheDocument());
    expect(await screen.findByRole("combobox", { name: copy.branch })).toHaveTextContent("Alexandria");
    fireEvent.click(await screen.findByRole("button", { name: copy.addAssignment }));
    expect(screen.getByText("Acme · Alexandria · Payroll")).toBeInTheDocument();
    fireEvent.change(screen.getByRole("searchbox", { name: copy.searchRoles }), { target: { value: "  missing  " } });
    fireEvent.change(screen.getByRole("searchbox", { name: copy.searchBranches }), { target: { value: "  missing  " } });
    await waitFor(() => expect(screen.getAllByText(copy.catalogueNoMatches)).toHaveLength(2));
    expect(mocks.listRoles).toHaveBeenLastCalledWith(TENANT_ID, { q: "missing", page: 1, limit: 50 }, expect.any(AbortSignal));
    expect(mocks.listBranches).toHaveBeenLastCalledWith(TENANT_ID, { q: "missing", page: 1, limit: 50 }, expect.any(AbortSignal));
    expect(screen.getByRole("combobox", { name: copy.roles })).toHaveTextContent("Payroll");
    expect(screen.getByRole("combobox", { name: copy.branch })).toHaveTextContent("Alexandria");
    expect(screen.getByText("Acme · Alexandria · Payroll")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: copy.save }));
    await waitFor(() => expect(replaceRoles).toHaveBeenCalledWith(user, { assignments: [
      { branchId: BRANCH_ID, roleId: ROLE_ID },
      { branchId: laterBranch.id, roleId: laterRole.id },
    ] }));
  });
});

it("shows an existing off-page assignment under its role and branch names", async () => {
  const assignedBranch = { ...branchFixture, id: "assigned-branch", name: "Alexandria" };
  const user = userFixture({ roleAssignments: [{
    ...userFixture().roleAssignments[0], roleName: "Existing role", branchId: assignedBranch.id,
  }] });
  mocks.listRoles.mockResolvedValue(pageFixture([]));
  mocks.listBranches.mockImplementation(async (_tenant, query) => query.limit === 50
    ? pageFixture([branchFixture], { total: 101, totalPages: 3, hasNext: true })
    : query.page === 1
      ? pageFixture([branchFixture], { total: 101, totalPages: 2, hasNext: true })
      : pageFixture([assignedBranch], { page: 2, total: 101, totalPages: 2, hasPrev: true }));
  const copy = tenantAccessCopy("en");
  render(<RolesDialog controller={{
    tenantId: TENANT_ID, enabled: true, ready: true, isAuthLoading: false,
    permissions: { canRead: true, canReadRoles: true, canAssignRoles: true },
    command: { pending: false, error: null },
  } as unknown as TenantAccessController} copy={copy} locale="en" user={user} onClose={vi.fn()} onSuccess={vi.fn()} />);
  await screen.findByText("Acme · Alexandria · Existing role");
  fireEvent.change(screen.getByRole("searchbox", { name: copy.searchBranches }), { target: { value: "missing" } });
  await waitFor(() => expect(mocks.listBranches).toHaveBeenLastCalledWith(TENANT_ID, { q: "missing", page: 1, limit: 50 }, expect.any(AbortSignal)));
  expect(screen.getByText("Acme · Alexandria · Existing role")).toBeInTheDocument();
});
