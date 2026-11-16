// @vitest-environment jsdom

import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TenantApiClientError } from "@/lib/api/axiosClient";
import {
  ORG_TREE_TOO_LARGE_CODE,
  type OrgTreeNode,
} from "../../contracts/organization-contract";
import {
  collectExpandableTreeIds,
  countTreeNodes,
  filterTreeNodes,
  useOrganizationTree,
} from "./useOrganizationTree";

const io = vi.hoisted(() => ({ tree: vi.fn() }));

vi.mock("@/design-system", () => ({
  useRealtimeResync: () => undefined,
}));

vi.mock("../../contracts/organization-contract", async (original) => ({
  ...(await original<typeof import("../../contracts/organization-contract")>()),
  fetchOrgTree: io.tree,
}));

const companyId = "01900100-0000-7000-8000-000000000010";
const branchId = "01900100-0000-7000-8000-000000000020";
const departmentId = "01900100-0000-7000-8000-000000000030";
const teamId = "01900100-0000-7000-8000-000000000040";

const sampleTree: OrgTreeNode[] = [
  {
    id: companyId,
    code: "ACME",
    name: "Acme Holding",
    status: "ACTIVE",
    children: [
      {
        id: branchId,
        code: "RIY-HQ",
        name: "Riyadh Headquarters",
        status: "ACTIVE",
        children: [
          {
            id: departmentId,
            code: "OPS",
            name: "Operations",
            status: "ACTIVE",
            children: [
              {
                id: teamId,
                code: "ENT-SALES",
                name: "Enterprise Sales",
                status: "INACTIVE",
                children: [],
              },
            ],
          },
        ],
      },
    ],
  },
];

function apiError(status: number, data: Record<string, unknown>) {
  return new TenantApiClientError("request failed", {
    status,
    statusText: "Error",
    headers: new Headers(),
    data,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(cleanup);

describe("useOrganizationTree", () => {
  it("loads the bounded tree, expands only root companies by default, and supports expand/collapse", async () => {
    io.tree.mockResolvedValue(sampleTree);

    const { result } = renderHook(() => useOrganizationTree());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.roots).toHaveLength(1);
    expect(result.current.totalCount).toBe(4);
    expect(result.current.visibleCount).toBe(4);
    expect(result.current.expandedIds.has(companyId)).toBe(true);
    expect(result.current.expandedIds.has(branchId)).toBe(false);
    expect(result.current.expandedIds.has(departmentId)).toBe(false);

    act(() => result.current.expandAll());
    expect(Array.from(result.current.expandedIds)).toEqual([
      companyId,
      branchId,
      departmentId,
    ]);

    act(() => result.current.collapseAll());
    expect(result.current.expandedIds.size).toBe(0);

    act(() => result.current.toggleExpanded(companyId));
    expect(result.current.expandedIds.has(companyId)).toBe(true);
    act(() => result.current.toggleExpanded(companyId));
    expect(result.current.expandedIds.has(companyId)).toBe(false);
  });

  it("filters by case-insensitive name or code, retaining and auto-expanding ancestor chains", async () => {
    io.tree.mockResolvedValue(sampleTree);

    const { result } = renderHook(() => useOrganizationTree());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.collapseAll();
      result.current.setSearchQuery("ent-sales");
    });

    expect(result.current.visibleCount).toBe(4);
    expect(result.current.expandedIds.has(companyId)).toBe(true);
    expect(result.current.expandedIds.has(branchId)).toBe(true);
    expect(result.current.expandedIds.has(departmentId)).toBe(true);

    act(() => result.current.setSearchQuery("non-existent-node"));
    expect(result.current.visibleRoots).toEqual([]);
    expect(result.current.visibleCount).toBe(0);
    expect(result.current.totalCount).toBe(4);
  });

  it("treats 422 ORG_TREE_TOO_LARGE as the bounded-tree guidance state rather than a load error", async () => {
    io.tree.mockRejectedValue(
      apiError(422, { errorCode: ORG_TREE_TOO_LARGE_CODE }),
    );

    const { result } = renderHook(() => useOrganizationTree());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.isTooLarge).toBe(true);
    expect(result.current.loadError).toBeNull();
    expect(result.current.roots).toEqual([]);
  });

  it("exposes recoverable load errors, reloads cleanly, and manages quick-view targets", async () => {
    io.tree
      .mockRejectedValueOnce(apiError(500, { errorCode: "INTERNAL_ERROR" }))
      .mockResolvedValueOnce(sampleTree);

    const { result } = renderHook(() => useOrganizationTree());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.isTooLarge).toBe(false);
    expect(result.current.loadError?.status).toBe(500);

    act(() => result.current.reload());
    await waitFor(() => expect(result.current.roots).toHaveLength(1));
    expect(result.current.loadError).toBeNull();

    const branchNode = sampleTree[0].children[0];
    act(() => result.current.openQuickView("branches", branchNode));
    expect(result.current.quickViewTarget).toEqual({
      kind: "summary",
      level: "branches",
      summary: {
        id: branchId,
        code: "RIY-HQ",
        name: "Riyadh Headquarters",
        status: "ACTIVE",
      },
    });

    act(() => result.current.closeQuickView());
    expect(result.current.quickViewTarget).toBeNull();
  });

  it("computes pure tree counts, expandable ids, and filtered subtrees accurately", () => {
    expect(countTreeNodes(sampleTree)).toBe(4);
    expect(Array.from(collectExpandableTreeIds(sampleTree))).toEqual([
      companyId,
      branchId,
      departmentId,
    ]);
    const filtered = filterTreeNodes(sampleTree, "Operations");
    expect(countTreeNodes(filtered.nodes)).toBe(4);
    expect(filtered.autoExpandedIds.size).toBe(2);
    expect(filtered.autoExpandedIds.has(companyId)).toBe(true);
    expect(filtered.autoExpandedIds.has(branchId)).toBe(true);
  });
});
