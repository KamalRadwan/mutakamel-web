// @vitest-environment jsdom

import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import { usePipelineWorkspace } from "./usePipelineWorkspace";

const api = vi.hoisted(() => ({ get: vi.fn() }));
const branchId = "01900100-0000-7000-8000-000000000111";
const pipelineId = "01900100-0000-7000-8000-000000000100";
const stageId = "01900100-0000-7000-8000-000000000101";
const user = { id: "01900100-0000-7000-8000-000000000113" };
const scope = { ready: true, headers: {} };
const access = { canMutate: true };
const router = { replace: vi.fn() };
let searchParams: URLSearchParams;

vi.mock("next/navigation", () => ({
  usePathname: () => "/crm/opportunities",
  useSearchParams: () => searchParams,
  useRouter: () => router,
}));
vi.mock("@/context/AuthContext", () => ({ useTenantAuth: () => ({ user }) }));
vi.mock("@/hooks/useAccessMode", () => ({ useAccessMode: () => access }));
vi.mock("@/hooks/useOrganizationScope", () => ({
  SCOPE_UNRESOLVED_ERROR: { code: "SCOPE_UNRESOLVED" },
  useOrganizationScopeHeaders: () => scope,
}));
vi.mock("@/hooks/useTenantBranchSelection", () => ({
  useTenantBranchSelection: () => ({
    branchId, branchIds: [branchId], selectBranch: vi.fn(),
  }),
}));
vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ t: en, lang: "en" }) }));
vi.mock("@/lib/api/axiosClient", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/axiosClient")>()),
  axiosClient: api,
}));

const stage = {
  id: stageId, pipelineId,
  opportunityStageId: "01900100-0000-7000-8000-000000000102",
  nameEn: "Qualification", nameAr: "Qualification",
  flag: "QUALIFICATION", category: "IN_PROGRESS", rank: 1,
  isActive: true, isSystem: true,
};
const pipeline = {
  id: pipelineId, code: "SALES", nameEn: "Sales", nameAr: "Sales",
  isDefault: true, isActive: true, stages: [stage],
};
const lane = {
  stage, items: [],
  summary: { totalCount: 100, amountsByCurrency: [] },
  activitySummary: {
    totalCount: 100, noOpenCount: 100, overdueCount: 0, todayCount: 0, futureCount: 0,
  },
  pageInfo: { limit: 50, hasMore: true, nextCursor: "opaque_cursor" },
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("Opportunity board sort contract", () => {
  // crm-app/src/crm/opportunities/dto/opportunity-board.dto.ts accepts no sort;
  // opportunity-board.service.ts cursors bind the repository's fixed ordering.
  it("keeps lanes unchanged on a URL sort change and paginates without sort keys", async () => {
    searchParams = new URLSearchParams({ pipelineId, sort: "createdAt", dir: "desc" });
    api.get.mockImplementation(async (path: string) => {
      if (path === "/api/tenant/crm/v1/pipelines") return { data: [pipeline] };
      if (path.includes("/capabilities?")) {
        return { data: {
          branchId, opportunities: { create: null, update: null, delete: null },
        } };
      }
      if (path.includes("/board?")) return { data: { pipeline, stages: [lane] } };
      if (path.includes(`/stages/${stageId}/opportunities?`)) {
        return { data: {
          ...lane, stageId,
          pageInfo: { limit: 50, hasMore: false, nextCursor: null },
        } };
      }
      throw new Error(`Unexpected GET: ${path}`);
    });

    const { result, rerender } = renderHook(() => usePipelineWorkspace());
    await waitFor(() => expect(result.current.board?.stages).toHaveLength(1));
    const board = result.current.board;
    const requestsBeforeSort = api.get.mock.calls.length;

    searchParams = new URLSearchParams({ pipelineId, sort: "title", dir: "asc" });
    await act(async () => { rerender(); });

    expect(result.current.board).toBe(board);
    expect(api.get.mock.calls).toHaveLength(requestsBeforeSort);

    await act(async () => { await result.current.loadMoreStage(stageId); });
    expect(result.current.error).toBeNull();
    expect(result.current.board?.stages[0]?.pageInfo.hasMore).toBe(false);
    const laneRequests = api.get.mock.calls
      .map(([path]) => new URL(String(path), "http://tenant.example"))
      .filter(({ pathname }) => pathname.endsWith("/board") || pathname.endsWith("/opportunities"));
    expect(laneRequests).toHaveLength(2);
    for (const { searchParams: query } of laneRequests) {
      expect(query.get("branchId")).toBe(branchId);
      expect(query.get("ownerUserId")).toBe(user.id);
      for (const key of ["sort", "dir", "sortBy", "sortDir"]) {
        expect(query.has(key)).toBe(false);
      }
    }
    expect(laneRequests[0]?.searchParams.get("limitPerStage")).toBe("50");
    expect(laneRequests[1]?.searchParams.get("cursor")).toBe("opaque_cursor");
    expect(laneRequests[1]?.searchParams.get("limit")).toBe("50");
  });
});
