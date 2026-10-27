// @vitest-environment jsdom

import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import { writeCoreData } from "@/lib/api/envelope";
import type { OrgLevel, OrgNodeOf } from "../../contracts/organization-contract";
import { EMPTY_ORG_NODE_FORM, useOrganizationLevel } from "./useOrganizationLevel";

const io = vi.hoisted(() => ({ list: vi.fn() }));
vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ t: en, lang: "en" }) }));
vi.mock("@/design-system", () => ({ useCan: () => true, useRealtimeResync: () => undefined }));
vi.mock("@/lib/api/envelope", () => ({
  readCoreData: vi.fn(), readCorePage: vi.fn(), writeCoreData: vi.fn(),
}));
vi.mock("../../contracts/organization-contract", async (original) => ({
  ...await original<typeof import("../../contracts/organization-contract")>(),
  fetchOrgNodes: io.list,
}));

const id = "01900100-0000-7000-8000-000000000001";
const parentId = "01900100-0000-7000-8000-000000000002";
const leadUserId = "01900100-0000-7000-8000-000000000003";
const base = {
  id, code: "ORG", name: "Organization", status: "ACTIVE" as const,
  createdAt: "2026-10-17T00:00:00.000Z", updatedAt: "2026-10-17T00:00:00.000Z",
};
const nodes = {
  companies: { ...base, legalName: "Legal name", taxNumber: "123", currencyCode: "SAR" },
  branches: { ...base, companyId: parentId, address: "Old address", phone: "123", isHeadquarters: true },
  departments: { ...base, branchId: parentId },
  teams: { ...base, departmentId: parentId, leadUserId },
} satisfies { [L in OrgLevel]: OrgNodeOf<L> };

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

describe("organization edit payloads", () => {
  it.each([
    { level: "companies", cleared: { legalName: "", taxNumber: "" },
      expected: { name: base.name, status: "ACTIVE", legalName: "", taxNumber: "", currencyCode: "SAR" } },
    { level: "branches", cleared: { address: "", phone: "   " },
      expected: { name: base.name, status: "ACTIVE", address: "", phone: "", isHeadquarters: true } },
    { level: "teams", cleared: { leadUserId: "" },
      expected: { name: base.name, status: "ACTIVE", leadUserId: null } },
  ] as const)("clears existing $level values and reloads the cleared response", async ({ level, cleared, expected }) => {
    let stored: OrgNodeOf<typeof level> = { ...nodes[level] };
    io.list.mockImplementation(async () => ({ items: [stored], page: 1, limit: 25, total: 1 }));
    vi.mocked(writeCoreData).mockImplementation(async (_method, _path, body) => {
      // Emulate JSON transport: undefined keys disappear, explicit clears survive.
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
      "patch", `/api/tenant/core/v1/organization/${level}/${id}`, expected, expect.any(Object),
    );
    await waitFor(() => expect(result.current.rows[0]).toMatchObject(expected));
    expect(result.current.editing).toBeNull();
    expect(result.current.mutationError).toBeNull();
  });

  it("keeps populated optional values trimmed and excludes create-only and unrelated fields", async () => {
    io.list.mockResolvedValue({ items: [nodes.teams], page: 1, limit: 25, total: 1 });
    vi.mocked(writeCoreData).mockResolvedValue(nodes.teams);
    const { result } = renderHook(() => useOrganizationLevel("teams"));
    await waitFor(() => expect(result.current.rows).toHaveLength(1));
    act(() => result.current.startEdit(nodes.teams));
    await act(async () => {
      await result.current.handleUpdate({
        ...EMPTY_ORG_NODE_FORM, name: " Team ", code: "IMMUTABLE", parentId,
        leadUserId: ` ${leadUserId} `, address: "Unrelated",
      });
    });
    expect(writeCoreData).toHaveBeenCalledWith(
      "patch", `/api/tenant/core/v1/organization/teams/${id}`,
      { name: "Team", status: "ACTIVE", leadUserId }, expect.any(Object),
    );
  });

  it.each(["companies", "branches", "teams"] as const)("still omits blank optional fields when creating %s", async (level) => {
    io.list.mockResolvedValue({ items: [], page: 1, limit: 25, total: 0 });
    vi.mocked(writeCoreData).mockResolvedValue(nodes[level]);
    const { result } = renderHook(() => useOrganizationLevel(level));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await act(async () => {
      expect(await result.current.handleCreate({ ...EMPTY_ORG_NODE_FORM, code: " org ", name: base.name, parentId })).toBe(true);
    });
    const expected = level === "companies" ? { code: "ORG", name: base.name }
      : level === "branches" ? { code: "ORG", name: base.name, companyId: parentId, isHeadquarters: false }
        : { code: "ORG", name: base.name, departmentId: parentId };
    expect(writeCoreData).toHaveBeenCalledWith(
      "post", `/api/tenant/core/v1/organization/${level}`, expected, expect.any(Object),
    );
  });
});
