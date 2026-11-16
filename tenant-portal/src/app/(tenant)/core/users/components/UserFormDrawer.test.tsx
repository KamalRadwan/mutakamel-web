// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import { TenantApiClientError } from "@/lib/api/axiosClient";
import type { PermissionScope } from "@/lib/auth/permission-scope";
import type { CorePage } from "../../contracts/core-page";
import { fetchOrgNodes, type OrgLevel, type OrgNodeOf } from "../../contracts/organization-contract";
import { fetchTenantUsers } from "../../contracts/user-contract";
import { EMPTY_USER_FORM, type UserFormValues } from "../user-payloads";
import { UserFormDrawer } from "./UserFormDrawer";

const COMPANY_A = "019f3100-0000-7000-8000-000000000001";
const COMPANY_B = "019f3100-0000-7000-8000-000000000002";
const BRANCH_A = "019f3100-0000-7000-8000-000000000011";
const BRANCH_B1 = "019f3100-0000-7000-8000-000000000012";
const BRANCH_B2 = "019f3100-0000-7000-8000-000000000013";
const DEPT_A = "019f3100-0000-7000-8000-000000000021";
const TEAM_A = "019f3100-0000-7000-8000-000000000031";
const NOW = "2026-11-01T10:00:00.000Z";

const FORM_PERMISSIONS = [
  "users.user.read",
  "org.company.read",
  "org.branch.read",
  "org.department.read",
  "org.team.read",
] as const;

const FORM_SCOPES: Record<string, PermissionScope> = Object.fromEntries(
  FORM_PERMISSIONS.map((key) => [
    key,
    { tenantWide: true, companyIds: [], branchIds: [] },
  ]),
);

vi.mock("@/context/AuthContext", () => ({
  useTenantAuth: () => ({
    user: {
      id: "019f3100-0000-7000-8000-000000000099",
      permissions: FORM_PERMISSIONS,
      permissionScopes: FORM_SCOPES,
    },
  }),
}));
vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => ({ t: en, lang: "en", dir: "ltr" }),
}));
vi.mock("@/i18n/useLanguage", () => ({
  useLanguage: () => "en",
  useDictionary: () => en,
  useDirection: () => "ltr",
}));
vi.mock("../../contracts/organization-contract", () => ({
  fetchOrgNodes: vi.fn(),
}));
vi.mock("../../contracts/user-contract", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../contracts/user-contract")>()),
  fetchTenantUsers: vi.fn(),
}));

function makePage<T>(items: T[], extra: Partial<CorePage<T>> = {}): CorePage<T> {
  return {
    items,
    page: 1,
    limit: 100,
    total: items.length,
    totalPages: items.length === 0 ? 0 : 1,
    hasNext: false,
    hasPrev: false,
    ...extra,
  };
}

function makeNode(level: OrgLevel, id: string, name: string, parentId = COMPANY_A): OrgNodeOf<OrgLevel> {
  const base = { id, code: id.slice(-4), name, status: "ACTIVE" as const, createdAt: NOW, updatedAt: NOW };
  if (level === "companies") return { ...base, legalName: null, taxNumber: null, currencyCode: "SAR" };
  if (level === "branches") return { ...base, companyId: parentId, address: null, phone: null, isHeadquarters: false };
  if (level === "departments") return { ...base, branchId: parentId };
  return { ...base, departmentId: parentId, leadUserId: null };
}

beforeEach(() => {
  vi.mocked(fetchTenantUsers).mockResolvedValue(makePage([]));
  vi.mocked(fetchOrgNodes).mockImplementation(async (level, options) => {
    if (level === "companies") {
      return makePage([makeNode("companies", COMPANY_A, "Mersany Holding")]);
    }
    if (level === "branches") {
      if (options.parentId === COMPANY_A) {
        return makePage([makeNode("branches", BRANCH_A, "Riyadh HQ", COMPANY_A)]);
      }
      return makePage([
        makeNode("branches", BRANCH_B1, "Jeddah North", COMPANY_B),
        makeNode("branches", BRANCH_B2, "Jeddah South", COMPANY_B),
      ]);
    }
    if (level === "departments") {
      return makePage([makeNode("departments", DEPT_A, "Engineering", BRANCH_A)]);
    }
    return makePage([makeNode("teams", TEAM_A, "Platform Team", DEPT_A)]);
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("UserFormDrawer", () => {
  it("renders a centered FormModal without rails, auto-selects singletons with visible labels, and keeps optional team unselected", async () => {
    const onSubmit = vi.fn().mockResolvedValue(true);
    render(
      <UserFormDrawer
        mode="invite"
        isOpen
        initial={EMPTY_USER_FORM}
        onClose={vi.fn()}
        onSubmit={onSubmit}
        isSubmitting={false}
      />,
    );

    const dialog = screen.getByRole("dialog", { name: en.coreIdentity.users.inviteTitle });
    expect(dialog.querySelector("aside")).toBeNull();
    expect(screen.getByText(en.coreIdentity.levels.companies.parentLabel)).toBeVisible();
    expect(screen.getByText(en.coreIdentity.levels.branches.parentLabel)).toBeVisible();
    expect(screen.getByText(en.coreIdentity.levels.departments.parentLabel)).toBeVisible();
    expect(screen.getByText(en.coreIdentity.levels.teams.parentLabel)).toBeVisible();

    await waitFor(() => {
      expect(screen.getByText("Mersany Holding")).toBeInTheDocument();
      expect(screen.getByText("Riyadh HQ")).toBeInTheDocument();
      expect(screen.getByText("Engineering")).toBeInTheDocument();
    });
    expect(screen.getAllByText(en.coreIdentity.cascade.singleOption).length).toBeGreaterThanOrEqual(3);

    fireEvent.change(screen.getByLabelText(new RegExp(en.coreIdentity.users.email)), {
      target: { value: "new.user@example.com" },
    });
    fireEvent.change(screen.getByLabelText(new RegExp(en.coreIdentity.users.firstName)), {
      target: { value: "Lina" },
    });
    fireEvent.change(screen.getByLabelText(new RegExp(en.coreIdentity.users.lastName)), {
      target: { value: "Kamel" },
    });

    const submit = screen.getByRole("button", { name: en.coreIdentity.users.inviteSubmit });
    expect(submit).toBeEnabled();
    fireEvent.click(submit);

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          email: "new.user@example.com",
          firstName: "Lina",
          lastName: "Kamel",
          companyId: COMPANY_A,
          branchId: BRANCH_A,
          departmentId: DEPT_A,
          teamId: "",
        }),
      ),
    );
  });

  it("keeps email read-only in edit mode, preserves dirty drafts on failed save, and guards accidental discard", async () => {
    const initial: UserFormValues = {
      email: "locked@example.com",
      firstName: "Tariq",
      lastName: "Nasser",
      employeeCode: "EMP-7",
      jobTitle: "Analyst",
      companyId: COMPANY_A,
      branchId: BRANCH_A,
      departmentId: DEPT_A,
      teamId: TEAM_A,
      managerId: "",
    };
    const onClose = vi.fn();
    const onSubmit = vi.fn().mockResolvedValue(false);

    render(
      <UserFormDrawer
        mode="edit"
        isOpen
        initial={initial}
        onClose={onClose}
        onSubmit={onSubmit}
        isSubmitting={false}
        error="Conflict while saving"
      />,
    );

    const emailInput = screen.getByDisplayValue("locked@example.com");
    expect(emailInput).toHaveAttribute("readonly");
    expect(screen.getByText(en.coreIdentity.users.emailFixed)).toBeInTheDocument();

    const firstNameInput = screen.getByDisplayValue("Tariq");
    fireEvent.change(firstNameInput, { target: { value: "Tariq Edited" } });
    fireEvent.click(screen.getByRole("button", { name: en.common.save }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(screen.getByDisplayValue("Tariq Edited")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: en.common.cancel }));
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByText(en.common.discardTitle)).toBeInTheDocument();
  });

  it("resets downstream branch, department, and team when company changes", async () => {
    vi.mocked(fetchOrgNodes).mockImplementation(async (level, options) => {
      if (level === "companies") {
        return makePage([
          makeNode("companies", COMPANY_A, "Mersany Holding"),
          makeNode("companies", COMPANY_B, "Mersany Logistics"),
        ]);
      }
      if (level === "branches") {
        if (options.parentId === COMPANY_A) {
          return makePage([makeNode("branches", BRANCH_A, "Riyadh HQ", COMPANY_A)]);
        }
        return makePage([
          makeNode("branches", BRANCH_B1, "Jeddah North", COMPANY_B),
          makeNode("branches", BRANCH_B2, "Jeddah South", COMPANY_B),
        ]);
      }
      if (level === "departments") {
        return makePage([makeNode("departments", DEPT_A, "Engineering", BRANCH_A)]);
      }
      return makePage([makeNode("teams", TEAM_A, "Platform Team", DEPT_A)]);
    });

    const initial: UserFormValues = {
      email: "user@example.com",
      firstName: "Maha",
      lastName: "Adel",
      employeeCode: "",
      jobTitle: "",
      companyId: COMPANY_A,
      branchId: BRANCH_A,
      departmentId: DEPT_A,
      teamId: TEAM_A,
      managerId: "",
    };

    render(
      <UserFormDrawer
        mode="edit"
        isOpen
        initial={initial}
        onClose={vi.fn()}
        onSubmit={vi.fn().mockResolvedValue(true)}
        isSubmitting={false}
      />,
    );

    await waitFor(() => expect(screen.getByText("Mersany Holding")).toBeInTheDocument());

    fireEvent.click(
      screen.getByLabelText(new RegExp(en.coreIdentity.levels.companies.parentLabel)),
    );
    // Organization directory company options expose the name alone; codes are
    // not part of their visible or accessible labels.
    fireEvent.click(await screen.findByRole("option", { name: "Mersany Logistics" }));

    await waitFor(() => {
      expect(screen.queryByText("Riyadh HQ")).toBeNull();
      expect(screen.queryByText("Engineering")).toBeNull();
      expect(screen.queryByText("Platform Team")).toBeNull();
    });
    expect(screen.getByRole("button", { name: en.common.save })).toBeDisabled();
  });

  it("never labels partial pages as sole options, distinguishes 403 permission denial, and retries transient failures", async () => {
    let companyAttempts = 0;
    vi.mocked(fetchOrgNodes).mockImplementation(async (level) => {
      if (level === "companies") {
        companyAttempts += 1;
        if (companyAttempts === 1) {
          throw new Error("Network failure");
        }
        return makePage([makeNode("companies", COMPANY_A, "Mersany Holding")], {
          total: 2,
          totalPages: 2,
          hasNext: true,
        });
      }
      if (level === "branches") {
        throw new TenantApiClientError("Forbidden", {
          status: 403,
          statusText: "Forbidden",
          headers: new Headers(),
          data: { errorCode: "PERMISSION_DENIED", message: "Forbidden" },
        });
      }
      return makePage([]);
    });

    render(
      <UserFormDrawer
        mode="invite"
        isOpen
        initial={EMPTY_USER_FORM}
        onClose={vi.fn()}
        onSubmit={vi.fn().mockResolvedValue(true)}
        isSubmitting={false}
      />,
    );

    expect(await screen.findByText(en.coreIdentity.cascade.loadFailed)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: en.coreIdentity.cascade.retry }));

    // Opening the picker and awaiting the settled option proves the retry resolved
    // (`!loading && !errorContent`) while partial-page metadata (`total: 2, hasNext: true`)
    // kept the field unselected and omitted the sole-option hint.
    const companyTrigger = screen.getByLabelText(
      new RegExp(en.coreIdentity.levels.companies.parentLabel),
    );
    fireEvent.click(companyTrigger);
    const companyOption = await screen.findByRole("option", {
      name: "Mersany Holding",
    });

    expect(companyAttempts).toBe(2);
    expect(companyOption).toHaveAttribute("aria-selected", "false");
    expect(companyTrigger).toHaveTextContent(en.coreIdentity.picker.placeholder);
    expect(screen.queryByText(en.coreIdentity.cascade.singleOption)).toBeNull();
    expect(screen.queryByText(en.coreIdentity.cascade.loadFailed)).toBeNull();

    // Manually choosing company triggers branch read -> 403 renders permission error without retry
    fireEvent.click(companyOption);

    expect(
      await screen.findByText(en.coreIdentity.errors.MISSING_REQUIRED_PERMISSIONS),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: en.coreIdentity.cascade.retry })).toBeNull();
  });
});
