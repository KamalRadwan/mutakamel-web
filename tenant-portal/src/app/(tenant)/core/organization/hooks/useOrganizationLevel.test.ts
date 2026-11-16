// @vitest-environment jsdom

import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import { TenantApiClientError } from "@/lib/api/axiosClient";
import { writeCoreData } from "@/lib/api/envelope";
import type { OrgLevel, OrgNodeOf } from "../../contracts/organization-contract";
import { EMPTY_ORG_NODE_FORM } from "../organization-payloads";
import { useOrganizationForm } from "./useOrganizationForm";
import { useOrganizationLevel } from "./useOrganizationLevel";

const ALL_ORG_PERMISSIONS = [
  "org.company.read",
  "org.company.manage",
  "org.branch.read",
  "org.branch.manage",
  "org.department.read",
  "org.department.manage",
  "org.team.read",
  "org.team.manage",
  "users.user.read",
];

const io = vi.hoisted(() => ({ list: vi.fn() }));

vi.mock("@/context/AuthContext", () => ({
  useTenantAuth: () => ({
    user: {
      permissions: ALL_ORG_PERMISSIONS,
      permissionScopes: Object.fromEntries(
        ALL_ORG_PERMISSIONS.map((key) => [
          key,
          { tenantWide: true, companyIds: [], branchIds: [] },
        ]),
      ),
    },
  }),
}));

vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ t: en, lang: "en" }) }));
vi.mock("@/design-system", async (original) => {
  const actual = await original<typeof import("@/design-system")>();
  return {
    ...actual,
    useCan: () => true,
    useRealtimeResync: () => undefined,
  };
});
vi.mock("@/lib/api/envelope", () => ({
  readCoreData: vi.fn(),
  readCorePage: vi.fn(),
  writeCoreData: vi.fn(),
}));
vi.mock("../../contracts/organization-contract", async (original) => ({
  ...(await original<typeof import("../../contracts/organization-contract")>()),
  fetchOrgNodes: io.list,
}));

const id = "01900100-0000-7000-8000-000000000001";
const parentId = "01900100-0000-7000-8000-000000000002";
const leadUserId = "01900100-0000-7000-8000-000000000003";

const base = {
  id,
  code: "ORG",
  name: "Organization",
  status: "ACTIVE" as const,
  createdAt: "2026-10-17T00:00:00.000Z",
  updatedAt: "2026-10-17T00:00:00.000Z",
};

const nodes = {
  companies: { ...base, legalName: "Legal name", taxNumber: "123", currencyCode: "SAR" },
  branches: { ...base, companyId: parentId, address: "Old address", phone: "123", isHeadquarters: true },
  departments: { ...base, branchId: parentId },
  teams: { ...base, departmentId: parentId, leadUserId },
} satisfies { [L in OrgLevel]: OrgNodeOf<L> };

function apiError(status: number, data: Record<string, unknown>) {
  return new TenantApiClientError("request failed", {
    status,
    statusText: "Conflict",
    headers: new Headers(),
    data,
  });
}

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

describe("organization create, update, cascade reset, and delete outcomes", () => {
  it.each([
    {
      level: "companies",
      cleared: { legalName: "", taxNumber: "" },
      expected: { name: base.name, status: "ACTIVE", legalName: "", taxNumber: "", currencyCode: "SAR" },
    },
    {
      level: "branches",
      cleared: { address: "", phone: "   " },
      expected: { name: base.name, status: "ACTIVE", address: "", phone: "", isHeadquarters: true },
    },
    {
      level: "teams",
      cleared: { leadUserId: "" },
      expected: { name: base.name, status: "ACTIVE", leadUserId: null },
    },
  ] as const)("clears existing $level values and reloads the cleared response", async ({ level, cleared, expected }) => {
    let stored: OrgNodeOf<typeof level> = { ...nodes[level] };
    io.list.mockImplementation(async () => ({ items: [stored], page: 1, limit: 25, total: 1 }));
    vi.mocked(writeCoreData).mockImplementation(async (_method, _path, body) => {
      const patch: Record<string, unknown> = JSON.parse(JSON.stringify(body));
      stored = { ...stored, ...patch };
      return stored;
    });
    const { result } = renderHook(() => useOrganizationLevel(level));
    await waitFor(() => expect(result.current.rows).toHaveLength(1));
    act(() => result.current.startEdit(stored));
    const values = { ...EMPTY_ORG_NODE_FORM, ...nodes[level], ...cleared, currencyCode: " sar " };
    await act(async () => {
      expect(await result.current.handleUpdate(values)).toBe(true);
    });
    expect(writeCoreData).toHaveBeenCalledWith(
      "patch",
      `/api/tenant/core/v1/organization/${level}/${id}`,
      expected,
      expect.any(Object),
    );
    await waitFor(() => expect(result.current.rows[0]).toMatchObject(expected));
    expect(result.current.editing).toBeNull();
    expect(result.current.mutationError).toBeNull();
  });

  it("allows editing an unset-currency company without currencyCode while blocking clearing a saved currencyCode", async () => {
    const unsetCompany = { ...nodes.companies, currencyCode: null };
    io.list.mockResolvedValue({ items: [unsetCompany, nodes.companies], page: 1, limit: 25, total: 2 });
    vi.mocked(writeCoreData).mockResolvedValue({ ...unsetCompany, name: "Renamed Holding" });

    const { result: formHook } = renderHook(() => useOrganizationForm("companies", "edit"));
    act(() => formHook.current.loadEditRecord(unsetCompany));
    expect(formHook.current.hasSavedCurrency).toBe(false);
    act(() => formHook.current.patch({ name: "Renamed Holding" }));
    let unsetValid = false;
    act(() => {
      unsetValid = formHook.current.validateForSubmit();
    });
    expect(unsetValid).toBe(true);

    const { result } = renderHook(() => useOrganizationLevel("companies"));
    await waitFor(() => expect(result.current.rows).toHaveLength(2));
    act(() => result.current.startEdit(unsetCompany));
    await act(async () => {
      expect(await result.current.handleUpdate(formHook.current.form)).toBe(true);
    });
    const sentUnsetBody = vi.mocked(writeCoreData).mock.calls[0]?.[2] as Record<string, unknown>;
    expect(sentUnsetBody).toEqual({
      name: "Renamed Holding",
      status: "ACTIVE",
      legalName: "Legal name",
      taxNumber: "123",
    });
    expect(sentUnsetBody).not.toHaveProperty("currencyCode");

    vi.mocked(writeCoreData).mockClear();
    act(() => formHook.current.loadEditRecord(nodes.companies));
    expect(formHook.current.hasSavedCurrency).toBe(true);
    act(() => formHook.current.patch({ currencyCode: "" }));
    let clearedValid = true;
    act(() => {
      clearedValid = formHook.current.validateForSubmit();
    });
    expect(clearedValid).toBe(false);

    act(() => result.current.startEdit(nodes.companies));
    await act(async () => {
      expect(await result.current.handleUpdate(formHook.current.form)).toBe(false);
    });
    expect(writeCoreData).not.toHaveBeenCalled();
  });

  it("retains server pagination metadata, preserves open draft on write failure, and distinguishes 409 delete outcomes", async () => {
    io.list.mockResolvedValue({ items: [nodes.branches], page: 1, limit: 25, total: 84 });
    vi.mocked(writeCoreData).mockRejectedValueOnce(
      apiError(409, { errorCode: "ORG_HQ_EXISTS", message: "HQ already exists" }),
    );

    const { result } = renderHook(() => useOrganizationLevel("branches"));
    await waitFor(() => expect(result.current.pageInfo.total).toBe(84));

    act(() => result.current.openCreate());
    await act(async () => {
      expect(
        await result.current.handleCreate({
          ...EMPTY_ORG_NODE_FORM,
          companyId: parentId,
          code: "BR2",
          name: "Second HQ",
          isHeadquarters: true,
        }),
      ).toBe(false);
    });
    expect(result.current.isCreateOpen).toBe(true);
    expect(result.current.mutationError?.code).toBe("ORG_HQ_EXISTS");

    vi.mocked(writeCoreData).mockRejectedValueOnce(
      apiError(409, {
        errorCode: "ORG_NODE_NOT_EMPTY",
        details: { blockers: ["branch has departments"] },
      }),
    );
    act(() => result.current.requestDelete(nodes.branches));
    await act(async () => {
      await result.current.handleDelete();
    });
    expect(result.current.blockedNode?.id).toBe(nodes.branches.id);
    expect(result.current.blockers).toEqual(["branch has departments"]);
    act(() => result.current.dismissBlockers());

    vi.mocked(writeCoreData).mockRejectedValueOnce(
      apiError(409, { errorCode: "ORG_HQ_TRANSFER_REQUIRED" }),
    );
    act(() => result.current.requestDelete(nodes.branches));
    await act(async () => {
      await result.current.handleDelete();
    });
    expect(result.current.hqTransferBlockedNode?.id).toBe(nodes.branches.id);
    expect(result.current.hqTransferError?.code).toBe("ORG_HQ_TRANSFER_REQUIRED");
  });

  it("recovers to Math.max(1, totalPages) with filters/sort preserved after deleting the last row on an out-of-range page", async () => {
    const lastPageRow = { ...nodes.branches, id: "01900100-0000-7000-8000-000000000095", name: "Page 3 Sole Branch" };
    let deleted = false;
    io.list.mockImplementation(async (_level: string, query: { page: number }) => {
      if (!deleted && query.page === 3) {
        return { items: [lastPageRow], page: 3, limit: 25, total: 51, totalPages: 3 };
      }
      if (deleted && query.page === 3) {
        return { items: [], page: 3, limit: 25, total: 50, totalPages: 2 };
      }
      if (deleted && query.page === 2) {
        return { items: [nodes.branches], page: 2, limit: 25, total: 50, totalPages: 2 };
      }
      return { items: [nodes.branches], page: 1, limit: 25, total: 51, totalPages: 3 };
    });
    vi.mocked(writeCoreData).mockImplementation(async () => {
      deleted = true;
      return undefined;
    });

    const { result } = renderHook(() => useOrganizationLevel("branches"));
    await waitFor(() => expect(result.current.rows).toHaveLength(1));

    act(() => {
      result.current.setStatusFilter("ACTIVE");
      result.current.setSort({ id: "code", direction: "desc" });
      result.current.setPage(3);
    });
    await waitFor(() => expect(result.current.rows[0]?.id).toBe(lastPageRow.id));

    act(() => result.current.requestDelete(lastPageRow));
    await act(async () => {
      await result.current.handleDelete();
    });

    await waitFor(() => expect(result.current.page).toBe(2));
    await waitFor(() => expect(result.current.rows[0]?.id).toBe(nodes.branches.id));
    expect(result.current.pageInfo).toEqual({ page: 2, limit: 25, total: 50 });
    expect(io.list).toHaveBeenLastCalledWith(
      "branches",
      expect.objectContaining({ page: 2, status: "ACTIVE", sortBy: "code", sortDir: "DESC" }),
    );
  });
});
