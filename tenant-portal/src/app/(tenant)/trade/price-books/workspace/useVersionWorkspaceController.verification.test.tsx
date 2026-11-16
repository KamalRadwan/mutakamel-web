// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import { useVersionWorkspaceController } from "./useVersionWorkspaceController";

const BOOK = "01902001-3000-7000-8000-000000000001";
const VERSION = "01902001-3000-7000-8000-000000000002";
const NEXT = "01902001-3000-7000-8000-000000000003";
const ACTOR = "01902001-3000-7000-8000-000000000009";
const h = vi.hoisted(() => ({
  get: vi.fn(), post: vi.fn(), patch: vi.fn(), del: vi.fn(),
  headers: { "x-mutakamel-company-id": "01902001-3000-7000-8000-000000000001" },
  user: { id: "01902001-3000-7000-8000-000000000009" },
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), outcomeFromApi: vi.fn(() => false) },
}));
vi.mock("@/design-system", () => ({ useToast: () => h.toast, useConnectivity: () => ({ status: "online" }) }));
vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ t: en, lang: "en" }) }));
vi.mock("@/context/AuthContext", () => ({ useTenantAuth: () => ({ user: h.user, authState: "AUTHENTICATED" }) }));
vi.mock("@/lib/api/errors", () => ({ normalizeApiError: (error: unknown) => error }));
vi.mock("../../trade-advanced-scope", () => ({
  useTradeScope: () => ({ headers: h.headers, isResolved: true, permissions: [], isTenantOwner: true }),
  hasTradePermission: (_permissions: readonly string[], owner: boolean) => owner,
}));
vi.mock("../../trade-api", () => ({
  tradeGet: h.get, tradePost: h.post, tradePatch: h.patch, tradeDelete: h.del,
  tradeIfMatch: (version: number) => `"${version}"`,
  isTradeReplay: (headers: Headers) => headers.get("idempotency-replayed") === "true",
}));

function detail(status = "DRAFT", id = VERSION, version = 1, creator: string | null = NEXT) {
  return {
    book: { id: BOOK, code: "WHOLESALE", currencyCode: "EGP", purpose: "SALES", status: "ACTIVE", version: 1 },
    version: { id, versionNumber: 1, status, version, createdByUserId: creator, checksum: "a".repeat(64),
      effectiveFrom: "2026-11-15T12:34:56.789Z", effectiveTo: null, notes: null },
    entries: [], promotions: [], latestTestEvidence: status === "TESTED" ? {
      passed: true, testedAt: "2026-11-01T10:00:00.000Z", contentHash: "a".repeat(64),
      report: { passed: true, entryCount: 1, promotionCount: 0, conflicts: [], promotionConflicts: [] },
    } : null,
  };
}
const success = () => ({ data: {}, headers: new Headers(), status: 200 });
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}
afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
  h.get.mockReset().mockResolvedValue({ data: detail() });
  h.post.mockReset().mockResolvedValue(success());
  h.patch.mockReset().mockResolvedValue(success());
  h.del.mockReset().mockResolvedValue(success());
});
async function load(status = "DRAFT") {
  h.get.mockResolvedValue({ data: detail(status) });
  const hook = renderHook(() => useVersionWorkspaceController({ versionId: VERSION }));
  await waitFor(() => expect(hook.result.current.detail?.version.id).toBe(VERSION));
  return hook;
}

describe("version workspace independent contract verification", () => {
  it("publishes a saved tested version for an authenticated independent checker", async () => {
    const { result } = await load("TESTED");
    expect(result.current.canPublish).toBe(true);
    await act(async () => { await result.current.publish(); });
    expect(h.post).toHaveBeenCalledWith(expect.stringContaining("/publish"), expect.anything(), expect.objectContaining({
      headers: expect.objectContaining({ "If-Match": '"1"', "x-idempotency-key": expect.any(String) }),
    }));
  });
  it("does not invent a maker restriction when a legacy record has no creator", async () => {
    h.get.mockResolvedValue({ data: detail("TESTED", VERSION, 1, null) });
    const { result } = renderHook(() => useVersionWorkspaceController({ versionId: VERSION }));
    await waitFor(() => expect(result.current.detail).not.toBeNull());
    expect(result.current.canPublish).toBe(true);
  });
  it("requires a server eligible maker to explicitly attest before publication", async () => {
    h.get.mockResolvedValue({ data: { ...detail("TESTED", VERSION, 1, ACTOR), soloOwnerGovernanceEligible: true } });
    const { result } = renderHook(() => useVersionWorkspaceController({ versionId: VERSION }));
    await waitFor(() => expect(result.current.detail).not.toBeNull());
    expect(result.current.canPublish).toBe(false);
    expect(result.current.publishDisabledReasons).toContain(en.tradePricing.publishAttestationRequired);
    expect(result.current.publishDisabledReasons).not.toContain(en.tradePricing.publishCheckerRequired);
    await act(async () => { result.current.setSoloOwnerAttestation(true); });
    expect(result.current.canPublish).toBe(true);
  });
  it("blocks testing and publishing unsaved content, including direct handler calls", async () => {
    const { result } = await load("TESTED");
    await act(async () => { result.current.setDraft(previous => previous ? { ...previous, notes: "unsaved" } : previous); });
    expect(result.current.isDirty).toBe(true);
    await act(async () => { await result.current.test(); await result.current.publish(); });
    expect(h.post).not.toHaveBeenCalled();
  });
  it.each(["PUBLISHED", "SCHEDULED", "RETIRED"])("does not save or delete immutable %s content", async status => {
    const { result } = await load(status);
    await act(async () => { await result.current.saveDraft(); await result.current.deleteDraft(); });
    expect(h.patch).not.toHaveBeenCalled(); expect(h.del).not.toHaveBeenCalled();
  });
  it("suppresses two saves issued before React has rendered the pending state", async () => {
    const { result } = await load();
    const pending = deferred<ReturnType<typeof success>>(); h.patch.mockReturnValue(pending.promise);
    let first!: Promise<boolean>; let second!: Promise<boolean>;
    act(() => { first = result.current.saveDraft(); second = result.current.saveDraft(); });
    expect(h.patch).toHaveBeenCalledTimes(1);
    await act(async () => { pending.resolve(success()); await Promise.all([first, second]); });
  });
  it("retains the exact body, revision and key for a timeout retry and blocks another write", async () => {
    const { result } = await load();
    h.patch.mockRejectedValueOnce({ status: 504, code: "CLIENT_REQUEST_TIMEOUT" });
    await act(async () => { result.current.setDraft(previous => previous ? { ...previous, notes: "original intent" } : previous); });
    await act(async () => { await result.current.saveDraft(); });
    expect(result.current.ambiguous).not.toBeNull();
    const original = h.patch.mock.calls[0];
    await act(async () => {
      result.current.setDraft(previous => previous ? { ...previous, notes: "different intent" } : previous);
    });
    await act(async () => { await result.current.saveDraft(); });
    expect(h.patch).toHaveBeenCalledTimes(1);
    await act(async () => { result.current.ambiguous?.retry(); });
    await waitFor(() => expect(h.patch).toHaveBeenCalledTimes(2));
    expect(h.patch.mock.calls[1]).toEqual(original);
  });
  it("retains a stale edit without adopting the newer revision as overwrite permission", async () => {
    const { result } = await load();
    await act(async () => { result.current.setDraft(previous => previous ? { ...previous, notes: "local" } : previous); });
    h.patch.mockRejectedValueOnce({ status: 409, code: "TRADE.CONCURRENCY.STALE_VERSION" });
    h.get.mockResolvedValue({ data: detail("DRAFT", VERSION, 2) });
    await act(async () => { await result.current.saveDraft(); });
    expect(result.current.staleConflict?.retainedDraft.notes).toBe("local");
    await act(async () => { await result.current.saveDraft(); });
    expect(h.patch).toHaveBeenCalledTimes(1);
    expect(result.current.draft?.notes).toBe("local");
  });
  it("does not let an old pending save replace a newly selected version", async () => {
    const hook = renderHook(({ id }) => useVersionWorkspaceController({ versionId: id }), { initialProps: { id: VERSION } });
    await waitFor(() => expect(hook.result.current.detail?.version.id).toBe(VERSION));
    const pending = deferred<ReturnType<typeof success>>(); h.patch.mockReturnValue(pending.promise);
    let saving!: Promise<boolean>;
    act(() => { saving = hook.result.current.saveDraft(); });
    h.get.mockImplementation((path: string) => Promise.resolve({ data: detail("DRAFT", path.endsWith(NEXT) ? NEXT : VERSION) }));
    hook.rerender({ id: NEXT });
    await waitFor(() => expect(hook.result.current.detail?.version.id).toBe(NEXT));
    await act(async () => { pending.resolve(success()); await saving; });
    expect(hook.result.current.detail?.version.id).toBe(NEXT);
  });
  it("keeps readable content and local edits after an action permission rejection", async () => {
    const { result } = await load();
    await act(async () => { result.current.setDraft(previous => previous ? { ...previous, notes: "retained edit" } : previous); });
    h.patch.mockRejectedValueOnce({ status: 403, code: "FORBIDDEN" });
    await act(async () => { await result.current.saveDraft(); });
    expect(result.current.error).toBeNull();
    expect(result.current.detail?.version.id).toBe(VERSION);
    expect(result.current.draft?.notes).toBe("retained edit");
    expect(result.current.mutationError?.status).toBe(403);
    expect(result.current.mutationPermission).toBe("trade.pricing.manage");
    expect(result.current.canTest).toBe(false);
    await act(async () => { await result.current.reload(); });
    expect(result.current.mutationError).toBeNull();
    expect(result.current.draft?.notes).toBe("retained edit");
  });
  it("retains separate failed-test diagnostics after HTTP200 without celebrating success", async () => {
    const { result } = await load();
    const report = { passed: false, entryCount: 2, promotionCount: 1, conflicts: ["tier-conflict"], promotionConflicts: ["promo-conflict"] };
    h.post.mockResolvedValue({ ...success(), data: report });
    h.get.mockResolvedValue({ data: { ...detail(), latestTestEvidence: {
      passed: false, testedAt: "2026-11-01T10:00:00.000Z", contentHash: "a".repeat(64), report,
    } } });
    await act(async () => { await result.current.test(); });
    expect(result.current.testReport).toEqual(report);
    expect(result.current.savedEvidenceMatchesChecksum).toBe(true);
    expect(h.toast.warning).toHaveBeenCalled();
    expect(h.toast.success).not.toHaveBeenCalled();
  });
  it("rejects an unreadable HTTP200 test result without claiming a pass", async () => {
    const { result } = await load();
    h.post.mockResolvedValue({ ...success(), data: { passed: "false" } });
    await act(async () => { await result.current.test(); });
    expect(h.toast.error).toHaveBeenCalled();
    expect(h.toast.success).not.toHaveBeenCalled();
    expect(result.current.ambiguous).toBeNull();
  });
  it("does not classify a successful write followed by a failed refresh as an unknown write", async () => {
    const parent = vi.fn().mockRejectedValue(new Error("refresh unavailable"));
    const { result } = renderHook(() => useVersionWorkspaceController({ versionId: VERSION, onParentMutated: parent }));
    await waitFor(() => expect(result.current.detail).not.toBeNull());
    let saved = false;
    await act(async () => { saved = await result.current.saveDraft(); });
    expect(saved).toBe(true);
    expect(result.current.ambiguous).toBeNull();
    expect(h.patch).toHaveBeenCalledTimes(1);
  });
  it("establishes the saved revision on retry after a confirmed save's read fails", async () => {
    const { result } = await load();
    await act(async () => { result.current.setDraft(previous => previous ? { ...previous, notes: "saved note" } : previous); });
    h.get.mockRejectedValue({ status: 503, code: "UNAVAILABLE" });
    await act(async () => { expect(await result.current.saveDraft()).toBe(true); });
    expect(result.current.ambiguous).toBeNull();
    expect(result.current.error?.status).toBe(503);
    await act(async () => { result.current.setDraft(previous => previous ? { ...previous, notes: "blocked until refreshed" } : previous); });
    expect(result.current.draft?.notes).toBe("saved note");
    h.get.mockResolvedValue({ data: { ...detail("DRAFT", VERSION, 2), version: { ...detail("DRAFT", VERSION, 2).version, notes: "saved note" } } });
    await act(async () => { await result.current.reload(); });
    expect(result.current.detail?.version.version).toBe(2);
    expect(result.current.isDirty).toBe(false);
    expect(result.current.canTest).toBe(true);
    expect(h.patch).toHaveBeenCalledTimes(1);
  });
  it("treats a replay as one confirmed success and preserves unchanged timestamp precision", async () => {
    const { result } = await load();
    h.patch.mockResolvedValue({ ...success(), headers: new Headers({ "idempotency-replayed": "true" }) });
    await act(async () => { result.current.setDraft(previous => previous ? { ...previous, notes: "new note" } : previous); });
    await act(async () => { await result.current.saveDraft(); });
    expect(h.patch.mock.calls[0]?.[1]?.effectiveFrom).toBe("2026-11-15T12:34:56.789Z");
    expect(result.current.replayNotice).toBe(en.tradePricing.replayAlreadyCompletedNotice);
    expect(h.toast.success).toHaveBeenCalledTimes(1);
  });
});
