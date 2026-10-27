// @vitest-environment jsdom

import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import { TenantApiClientError } from "@/lib/api/axiosClient";
import { useLeads } from "./useLeads";

const { get, post } = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
const BRANCH = "0192f3a0-0000-7000-8000-000000000002";
const COMPANY = "0192f3a0-0000-7000-8000-000000000001";
const STAGE = "0192f3a0-0000-7000-8000-000000000004";
const DESTINATION = "0192f3a0-0000-7000-8000-000000000008";
const ADDED_STAGE = "0192f3a0-0000-7000-8000-000000000009";
const LEAD = "0192f3a0-0000-7000-8000-000000000005";
const ACTOR = "0192f3a0-0000-7000-8000-000000000099";
const PATH = "/api/tenant/crm/v1/leads";
const user = {
  id: ACTOR, accessibleBranches: [BRANCH], accessibleCompanies: [COMPANY],
  accessibleBranchCompanies: [{ branchId: BRANCH, companyId: COMPANY }],
  teamMemberships: [{ branchId: BRANCH, companyId: COMPANY, isPrimary: true }],
};

vi.mock("@/context/AuthContext", () => ({ useTenantAuth: () => ({ user }) }));
vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ t: en }) }));
vi.mock("@/lib/api/axiosClient", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/api/axiosClient")>(),
  axiosClient: { get, post },
}));

const stages = [
  { id: STAGE, nameAr: "جديد", nameEn: "New", flag: "NEW", category: "IN_PROGRESS",
    sortOrder: 1, isActive: true, isDefault: true },
  { id: DESTINATION, nameAr: "تم التواصل", nameEn: "Contacted", flag: "CONTACTED", category: "IN_PROGRESS",
    sortOrder: 2, isActive: true, isDefault: false },
];
function response(data: unknown) {
  return { data, status: 200, statusText: "OK", headers: new Headers() };
}
function boardResponse(stageId: string, catalogue = stages) {
  return response({ stages: catalogue.map((stage) => ({
    stage,
    items: stage.id === stageId ? [{
      id: LEAD, partyId: LEAD, branchId: BRANCH, stageId,
      leadProfileType: "INDIVIDUAL", displayName: "Mona Hassan", ownerUserId: ACTOR,
    }] : [],
    total: stage.id === stageId ? 1 : 0, page: 1, limit: 50,
    totalPages: stage.id === stageId ? 1 : 0, hasNext: false, hasPrev: false,
  })) });
}

afterEach(() => { cleanup(); vi.useRealTimers(); vi.clearAllMocks(); });

it("reconciles a 409 and keeps moves pending until the server column is loaded", async () => {
  vi.useFakeTimers();
  get.mockImplementation((url: string) => {
    if (url === "/api/tenant/crm/v1/lead-stages") return Promise.resolve(response(stages));
    if (url.startsWith(`${PATH}/capabilities?`)) return Promise.resolve(response({
      branchId: BRANCH,
      leads: { create: null, update: { scope: "all", ownerUserIds: null }, delete: null },
    }));
    return Promise.resolve(response({
      items: [], total: 0, page: 1, limit: 50, totalPages: 0, hasNext: false, hasPrev: false,
    }));
  });
  let boardReads = 0;
  let finishBoard!: (value: ReturnType<typeof response>) => void;
  post.mockImplementation((url: string) => {
    if (url === `${PATH}/board`) {
      boardReads += 1;
      return boardReads === 1
        ? Promise.resolve(boardResponse(STAGE))
        : new Promise((resolve) => { finishBoard = resolve; });
    }
    return Promise.reject(new TenantApiClientError("Stage changed", {
      status: 409, statusText: "Conflict", headers: new Headers(), data: { message: "Stage changed" },
    }));
  });
  const { result } = renderHook(() => useLeads());
  await act(async () => { await vi.advanceTimersByTimeAsync(250); });
  act(() => result.current.setActiveView("board"));
  await act(async () => { await vi.advanceTimersByTimeAsync(250); });
  const lead = result.current.board.items[0]!;
  expect(lead.stageId).toBe(STAGE);

  let move!: ReturnType<typeof result.current.moveLead>;
  await act(async () => { move = result.current.moveLead(LEAD, DESTINATION, lead); });
  expect(boardReads).toBe(2);
  expect(result.current.isMovePending).toBe(true);
  expect(await result.current.moveLead(LEAD, DESTINATION, lead)).toMatchObject({ kind: "blocked" });
  await act(async () => {
    finishBoard(boardResponse(DESTINATION));
    expect(await move).toMatchObject({ kind: "failed", error: { status: 409 } });
  });
  expect(result.current.board.lanes[STAGE]?.items).toEqual([]);
  expect(result.current.board.lanes[DESTINATION]?.items[0]?.id).toBe(LEAD);
  expect(result.current.isMovePending).toBe(false);
  await act(async () => { await vi.advanceTimersByTimeAsync(1_000); });
  expect(boardReads).toBe(2);
});

it("reloads the stage catalogue and retries once when a new stage appears", async () => {
  vi.useFakeTimers();
  const updatedStages = [...stages, {
    id: ADDED_STAGE, nameAr: "Ù…ØªØ§Ø¨Ø¹Ø©", nameEn: "Nurturing", flag: "NURTURING",
    category: "IN_PROGRESS", sortOrder: 3, isActive: true, isDefault: false,
  }];
  let catalogueReads = 0;
  get.mockImplementation((url: string) => {
    if (url === "/api/tenant/crm/v1/lead-stages") {
      catalogueReads += 1;
      return Promise.resolve(response(catalogueReads === 1 ? stages : updatedStages));
    }
    if (url.startsWith(`${PATH}/capabilities?`)) return Promise.resolve(response({
      branchId: BRANCH,
      leads: { create: null, update: null, delete: null },
    }));
    return Promise.resolve(response({
      items: [], total: 0, page: 1, limit: 50, totalPages: 0, hasNext: false, hasPrev: false,
    }));
  });
  let boardReads = 0;
  post.mockImplementation((url: string) => {
    if (url !== `${PATH}/board`) return Promise.reject(new Error("Unexpected request"));
    boardReads += 1;
    return Promise.resolve(boardReads === 1
      ? boardResponse(STAGE, updatedStages)
      : boardResponse(STAGE, updatedStages));
  });

  const { result } = renderHook(() => useLeads());
  await act(async () => { await vi.advanceTimersByTimeAsync(250); });
  act(() => result.current.setActiveView("board"));
  await act(async () => { await vi.advanceTimersByTimeAsync(250); });

  expect(catalogueReads).toBe(2);
  expect(boardReads).toBe(2);
  expect(result.current.stages.map(({ id }) => id)).toEqual([STAGE, DESTINATION, ADDED_STAGE]);
  expect(Object.keys(result.current.board.lanes)).toEqual([STAGE, DESTINATION, ADDED_STAGE]);
});
