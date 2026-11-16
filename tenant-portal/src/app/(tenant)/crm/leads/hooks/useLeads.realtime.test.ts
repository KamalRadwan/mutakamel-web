// @vitest-environment jsdom

import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { TenantApiClientError } from "@/lib/api/axiosClient";
import { publishTenantLeadRealtime, clearTenantLeadRealtime } from "@/context/tenant-lead-realtime";
import { en } from "@/i18n/dictionaries/en";
import { useLeads } from "./useLeads";

const { get, post, auth, branch } = vi.hoisted(() => ({
  get: vi.fn(), post: vi.fn(), auth: { generation: "tenant:session-a:user-a" },
  branch: { id: "0192f3a0-0000-7000-8000-000000000002" },
}));
const BRANCH = branch.id;
const OTHER_BRANCH = "0192f3a0-0000-7000-8000-000000000003";
const ACTOR = "0192f3a0-0000-7000-8000-000000000099";
const STAGE = "0192f3a0-0000-7000-8000-000000000004";
const DESTINATION = "0192f3a0-0000-7000-8000-000000000008";
const LEAD = "0192f3a0-0000-7000-8000-000000000005";
const PATH = "/api/tenant/crm/v1/leads";
const stages = [
  { id: STAGE, nameAr: "جديد", nameEn: "New", flag: "NEW", category: "IN_PROGRESS", sortOrder: 1, isActive: true, isDefault: true },
  { id: DESTINATION, nameAr: "تم التواصل", nameEn: "Contacted", flag: "CONTACTED", category: "IN_PROGRESS", sortOrder: 2, isActive: true, isDefault: false },
];
vi.mock("@/context/AuthContext", () => ({ useTenantAuth: () => ({
  user: { id: ACTOR }, realtimeAuthGeneration: auth.generation,
}) }));
vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ t: en }) }));
vi.mock("@/hooks/useTenantBranchSelection", () => ({ useTenantBranchSelection: () => ({
  branchId: branch.id, branchIds: [BRANCH, OTHER_BRANCH], selectBranch: (id: string) => { branch.id = id; },
}) }));
vi.mock("./useLeadStagesAndCapabilities", () => ({ useLeadStagesAndCapabilities: () => ({
  stages, capabilities: null, isLoading: false, degraded: {}, reload: vi.fn(),
}) }));
vi.mock("./useLeadMutations", () => ({ useLeadMutations: () => ({}) }));
vi.mock("./useLeadCardWrites", () => ({ useLeadCardWrites: () => ({}) }));
vi.mock("@/lib/api/axiosClient", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/api/axiosClient")>(), axiosClient: { get, post },
}));

let total = 0;
let stageId = STAGE;
function page(pageNumber = 1) {
  return { items: total ? [{ id: LEAD, partyId: LEAD, branchId: branch.id, stageId,
    leadProfileType: "INDIVIDUAL", displayName: "Mona", ownerUserId: ACTOR }] : [],
  total, page: pageNumber, limit: 50, totalPages: Math.ceil(total / 50),
  hasNext: pageNumber < Math.ceil(total / 50), hasPrev: pageNumber > 1 };
}
function board() {
  return { stages: stages.map((stage) => ({ stage, ...page(),
    ...(stage.id === stageId ? {} : { items: [], total: 0, totalPages: 0, hasNext: false }),
  })) };
}
function change() {
  act(() => publishTenantLeadRealtime({ generation: auth.generation, kind: "changed", payload: {
    tenantId: ACTOR, branchId: branch.id, leadId: LEAD, revision: String(total + 1), changeKind: "UPDATED",
  } }));
}
async function advance(ms = 250) {
  await act(async () => { await vi.advanceTimersByTimeAsync(ms); });
}
beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
  branch.id = BRANCH;
  auth.generation = "tenant:session-a:user-a";
  total = 0;
  stageId = STAGE;
  get.mockImplementation((url: string) => Promise.resolve({ data: page(Number(new URL(url, "http://portal").searchParams.get("page") ?? 1)) }));
  post.mockImplementation((url: string, body: { page?: number }) => Promise.resolve({
    data: url === `${PATH}/board` ? board() : page(body.page),
  }));
});
afterEach(() => {
  cleanup();
  clearTenantLeadRealtime();
  vi.useRealTimers();
  vi.resetAllMocks();
  vi.restoreAllMocks();
});

it("loads a previously absent board card, updates lane totals, then moves it", async () => {
  const { result } = renderHook(() => useLeads());
  act(() => result.current.setActiveView("board"));
  await advance();
  expect(result.current.board.items).toEqual([]);
  total = 1;
  change();
  await advance(200);
  expect(result.current.board.items[0]?.id).toBe(LEAD);
  expect(result.current.board.totals.get(STAGE)).toBe(1);
  stageId = DESTINATION;
  act(() => publishTenantLeadRealtime({ generation: auth.generation, kind: "resync" }));
  await advance(200);
  expect(result.current.board.lanes[STAGE]?.items).toEqual([]);
  expect(result.current.board.totals.get(STAGE)).toBe(0);
  expect(result.current.board.totals.get(DESTINATION)).toBe(1);
});

it("preserves submitted filters, draft edits, sort and page when refreshing the list", async () => {
  total = 101;
  const { result } = renderHook(() => useLeads());
  await advance();
  act(() => result.current.setSearch({ ...result.current.search, mode: "advanced" }));
  await advance();
  act(() => result.current.setSearch({ ...result.current.search, groups: [{ conditions: [
    { field: "status", operator: "eq", value: "OPEN", valueTo: "" },
  ] }] }));
  act(() => result.current.submitSearch());
  act(() => result.current.setSort({ id: "displayName", direction: "asc" }));
  act(() => result.current.setPage(2));
  await advance();
  const before = post.mock.calls.filter(([url]) => url === `${PATH}/search`).at(-1)![1];
  act(() => result.current.setSearch({ ...result.current.search, groups: [{ conditions: [
    { field: "status", operator: "eq", value: "ON_HOLD", valueTo: "" },
  ] }] }));
  const draft = result.current.search;
  total = 102;
  change();
  await advance(200);
  expect(post.mock.calls.filter(([url]) => url === `${PATH}/search`).at(-1)![1]).toEqual(before);
  expect(result.current.search).toEqual(draft);
  expect(result.current.pageInfo).toMatchObject({ page: 2, total: 102 });
});

it.each(["card", "board"] as const)("preserves REST 403 handling in %s view", async (view) => {
  const { result } = renderHook(() => useLeads());
  act(() => result.current.setActiveView(view));
  await advance();
  const error = new TenantApiClientError("Forbidden", { status: 403, statusText: "Forbidden",
    headers: new Headers(), data: { message: "Forbidden" } });
  get.mockRejectedValue(error);
  post.mockRejectedValue(error);
  change();
  await advance(200);
  if (view === "board") {
    expect(result.current.board.error?.status).toBe(403);
    expect(result.current.board.items).toEqual([]);
  } else {
    expect(result.current.scopeDenied).toBe(true);
    expect(result.current.items).toEqual([]);
  }
  const reads = get.mock.calls.length + post.mock.calls.length;
  await advance(5_000);
  expect(get.mock.calls.length + post.mock.calls.length).toBe(reads);
});

it.each([
  ["card", "branch"], ["board", "branch"], ["card", "session"], ["board", "session"],
] as const)("discards late %s responses after a %s change", async (view, scope) => {
  const { result, rerender } = renderHook(() => useLeads());
  act(() => result.current.setActiveView(view));
  await advance();
  let finish!: (value: { data: unknown }) => void;
  let signal!: AbortSignal;
  const pending = (_url: string, options: { signal: AbortSignal }) => {
    signal = options.signal;
    return new Promise<{ data: unknown }>((resolve) => { finish = resolve; });
  };
  if (view === "card") get.mockImplementationOnce(pending);
  else post.mockImplementationOnce((url: string, _body: unknown, options: { signal: AbortSignal }) => pending(url, options));
  total = 1;
  change();
  await advance(200);
  const stale = view === "card" ? page() : board();
  const revision = result.current.dataRevision;
  if (scope === "branch") act(() => result.current.selectBranch(OTHER_BRANCH));
  else {
    auth.generation = "tenant:session-b:user-a";
    rerender();
  }
  expect(signal.aborted).toBe(true);
  await act(async () => { finish({ data: stale }); });
  expect(result.current.items).toEqual([]);
  expect(result.current.board.items).toEqual([]);
  expect(result.current.dataRevision).toBe(revision);
});

