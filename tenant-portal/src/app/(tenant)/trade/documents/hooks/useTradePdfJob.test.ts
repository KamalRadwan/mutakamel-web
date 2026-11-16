// @vitest-environment jsdom
import { act, render, renderHook, screen } from "@testing-library/react";
import { createElement, useLayoutEffect } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TenantApiClientError } from "@/lib/api/axiosClient";
import { TradePdfPanel } from "../components/TradePdfPanel";
import { useTradePdfJob } from "./useTradePdfJob";

const mocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), actor: null as string | null, authGeneration: null as string | null,
  purchaseRead: null as string | null,
  toast: { success: vi.fn(), error: vi.fn(), errorFromApi: vi.fn(), outcomeFromApi: vi.fn(() => false) } }));
vi.mock("@/design-system", async importOriginal => ({
  ...await importOriginal<typeof import("@/design-system")>(), useToast: () => mocks.toast,
}));
vi.mock("@/context/AuthContext", () => ({
  useTenantAuth: () => ({
    user: mocks.actor ? {
      id: mocks.actor,
      permissions: mocks.purchaseRead ? [mocks.purchaseRead] : [],
      permissionScopes: mocks.purchaseRead ? { [mocks.purchaseRead]: { tenantWide: false, branchIds: [REV], companyIds: [] } } : {},
      accessibleBranchCompanies: [{ companyId: QUOTE, branchId: REV }],
    } : null,
    realtimeAuthGeneration: mocks.authGeneration, readReadyProfileCommit: () => null, subscribeProfileReadiness: () => () => {},
  }),
}));
vi.mock("@/i18n/I18nContext", async () => {
  const { en } = await import("@/i18n/dictionaries/en");
  return { useI18n: () => ({ t: en }) };
});
vi.mock("../../trade-api", () => ({ tradeGet: mocks.get, tradePost: mocks.post, isTradeReplay: () => false }));
const QUOTE = "01890000-0000-7000-8000-000000000001";
const JOB = "01890000-0000-7000-8000-000000000009";
const REV = "01890000-0000-7000-8000-000000000003";
const base = "/api/tenant/trade/v1/quotations";
const scope = { "x-company-id": QUOTE, "x-branch-id": REV };
const request = { revisionId: REV, purpose: "CUSTOMER_QUOTATION" };
function response(status: string, expires = "2026-11-04T12:05:00Z") {
  return { data: { renderJobId: JOB, status, attemptCount: 1, statusUrl: `${base}/${QUOTE}/render-jobs/${JOB}`, quotationId: QUOTE, quotationRevisionId: REV, ...(status === "COMPLETED" ? { artifact: { checksum: "abc", sizeBytes: 100, pageCount: 2, completedAt: "2026-11-04T12:00:00Z", downloadUrl: "https://storage.example/quote.pdf", downloadExpiresAt: expires } } : {}) }, status: 202, headers: new Headers() };
}

describe("PDF request recovery and monitoring", () => {
  beforeEach(() => { vi.clearAllMocks(); vi.useFakeTimers(); vi.setSystemTime(new Date("2026-11-04T12:00:00Z")); });
  afterEach(() => vi.useRealTimers());

  it("recovers the exact request and idempotency key before allowing another PDF", async () => {
    mocks.post.mockRejectedValueOnce(new Error("Response lost")).mockResolvedValueOnce(response("COMPLETED"));
    const { result } = renderHook(() => useTradePdfJob(base, QUOTE, scope));
    await act(async () => { await result.current.render(request, "PDF"); });
    const pending = result.current.write.ambiguous!;
    expect(result.current.write.isBlocked).toBe(true);
    await act(async () => { await result.current.render({ ...request, locale: "en-US" }, "Changed"); });
    expect(mocks.post).toHaveBeenCalledTimes(1);
    await act(async () => { await pending.retry(); });
    expect(mocks.post.mock.calls[1]).toEqual(mocks.post.mock.calls[0]);
    expect(result.current.job?.renderJobId).toBe(JOB);
    expect(result.current.write.ambiguous).toBeNull();
  });

  it("refreshes an expired completed job using GET without rendering again", async () => {
    mocks.post.mockResolvedValueOnce(response("COMPLETED", "2026-11-04T11:59:00Z"));
    mocks.get.mockResolvedValueOnce(response("COMPLETED"));
    const { result } = renderHook(() => useTradePdfJob(base, QUOTE, scope));
    await act(async () => { await result.current.render(request, "PDF"); });
    expect(result.current.uiStatus).toBe("ARTIFACT_EXPIRED");
    await act(async () => { await result.current.refresh(); });
    expect(mocks.get.mock.calls[0][0]).toBe(`${base}/${QUOTE}/render-jobs/${JOB}`);
    expect(mocks.post).toHaveBeenCalledTimes(1);
    expect(result.current.uiStatus).toBe("SUCCEEDED");
  });

  it("stops on a terminal failure inside a successful polling response", async () => {
    mocks.post.mockResolvedValueOnce(response("PENDING"));
    mocks.get.mockResolvedValueOnce({ ...response("FAILED"), data: { ...response("FAILED").data, failure: { code: "TRADE.QUOTE.PDF_RENDER_FAILED", terminal: true } } });
    const { result } = renderHook(() => useTradePdfJob(base, QUOTE, scope));
    await act(async () => { await result.current.render(request, "PDF"); });
    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
    expect(result.current.uiStatus).toBe("FAILED");
    expect(result.current.isPolling).toBe(false);
    await act(async () => { await vi.advanceTimersByTimeAsync(10000); });
    expect(mocks.get).toHaveBeenCalledTimes(1);
  });

  it("discards a late poll after the quotation context changes", async () => {
    let finish!: (value: ReturnType<typeof response>) => void;
    mocks.post.mockResolvedValueOnce(response("PENDING"));
    mocks.get.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    const { result, rerender } = renderHook(({ id }) => useTradePdfJob(base, id, scope), { initialProps: { id: QUOTE } });
    await act(async () => { await result.current.render(request, "PDF"); });
    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
    rerender({ id: "01890000-0000-7000-8000-000000000002" });
    await act(async () => { finish(response("COMPLETED")); });
    expect(result.current.job).toBeNull();
    expect(result.current.isPolling).toBe(false);
    expect(result.current.pollError).toBeNull();
  });
});

const TEMPLATE = "01890000-0000-7000-8000-000000000011";
const VERSION = "01890000-0000-7000-8000-000000000012";
const DIFFERENT = "01890000-0000-7000-8000-000000000013";
const PURCHASE_SCOPE = { "x-mutakamel-company-id": QUOTE, "x-mutakamel-branch-id": REV };

describe.each([
  ["Purchase Quotation", "purchase-quotations", "PURCHASE_QUOTATION", "SUPPLIER_QUOTATION"],
  ["Purchase Order", "purchase-orders", "PURCHASE_ORDER", "PURCHASE_ORDER"],
])("%s issued render result", (_label, segment, documentType, purpose) => {
  const purchaseBase = "/api/tenant/trade/v1/" + segment;
  const statusUrl = purchaseBase + "/" + QUOTE + "/render-jobs/" + JOB;
  const intent = { sourceVersion: 4, purpose, templateVersionId: VERSION };
  const pending = {
    renderJobId: JOB, documentType, documentId: QUOTE, sourceVersion: 4,
    status: "PENDING", attemptCount: 1, statusUrl, templateDefinitionId: TEMPLATE, templateVersionId: VERSION,
  };
  const artifact = {
    checksum: "a".repeat(64), sizeBytes: 100, pageCount: 1, completedAt: "2026-11-04T12:00:00Z",
    downloadUrl: "https://storage.invalid/private-result", downloadExpiresAt: "2026-11-04T12:05:00Z",
  };
  const completed = { ...pending, status: "COMPLETED", artifact };
  const reply = (data: Record<string, unknown>, status: number) => ({ data, status, headers: new Headers() });

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.actor = "first-actor";
    mocks.authGeneration = "first-generation";
    mocks.purchaseRead = documentType === "PURCHASE_QUOTATION" ? "trade.purchase_quotations.read" : "trade.purchase_orders.read";
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-04T12:00:00Z"));
  });
  afterEach(() => vi.useRealTimers());

  it.each([
    { sourceVersion: 3 },
    { templateVersionId: DIFFERENT },
    { renderJobId: DIFFERENT },
  ])("suppresses the mismatched completed status %j", async (change) => {
    mocks.post.mockResolvedValueOnce(reply(pending, 202));
    mocks.get.mockResolvedValueOnce(reply({ ...completed, ...change }, 200));
    const { result } = renderHook(() => useTradePdfJob(purchaseBase, QUOTE, PURCHASE_SCOPE, "4"));
    await act(async () => { await result.current.render(intent, "Render"); });
    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
    expect(result.current.job?.renderJobId).toBe(JOB);
    expect(result.current.job?.status).toBe("PENDING");
    expect(result.current.job?.artifact).toBeNull();
    expect(result.current.pollError?.message).toBe("Invalid Trade document response.");
    expect(mocks.get.mock.calls.map(call => call[0])).toEqual([statusUrl]);
    expect(mocks.post.mock.calls.map(call => call[1])).toEqual([intent]);
  });

  it("rejects an acceptance that replaces an explicit immutable version", async () => {
    mocks.post.mockResolvedValueOnce(reply({ ...pending, templateVersionId: DIFFERENT }, 202));
    const { result } = renderHook(() => useTradePdfJob(purchaseBase, QUOTE, PURCHASE_SCOPE, "4"));
    await act(async () => { await result.current.render(intent, "Render"); });
    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
    expect(mocks.post).toHaveBeenCalledTimes(1);
    expect(mocks.post.mock.calls[0][1]).toEqual(intent);
    expect(result.current.job).toBeNull();
    expect(mocks.get).not.toHaveBeenCalled();
  });

  it("removes the previous link on a stale terminal status and re-verifies the same job", async () => {
    mocks.post.mockResolvedValueOnce(reply(pending, 202));
    mocks.get.mockResolvedValueOnce(reply(completed, 200))
      .mockResolvedValueOnce(reply(pending, 200))
      .mockResolvedValueOnce(reply(completed, 200));
    const { result } = renderHook(() => useTradePdfJob(purchaseBase, QUOTE, PURCHASE_SCOPE, "4"));
    await act(async () => { await result.current.render(intent, "Render"); });
    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
    expect(result.current.job?.artifact?.downloadUrl).toBe(artifact.downloadUrl);
    await act(async () => { await result.current.refresh(); });
    expect(result.current.job?.status).toBe("COMPLETED");
    expect(result.current.job?.artifact).toBeNull();
    await act(async () => { await result.current.refresh(); });
    expect(result.current.job?.artifact?.downloadUrl).toBe(artifact.downloadUrl);
    expect(mocks.get.mock.calls.map(call => call[0])).toEqual([statusUrl, statusUrl, statusUrl]);
    expect(mocks.post).toHaveBeenCalledTimes(1);
  });

  it("discards an in-flight result when the actor changes in the same branch", async () => {
    let finish!: (value: ReturnType<typeof reply>) => void;
    mocks.post.mockResolvedValueOnce(reply(pending, 202));
    mocks.get.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    const { result, rerender } = renderHook(() => useTradePdfJob(purchaseBase, QUOTE, PURCHASE_SCOPE, "4"));
    await act(async () => { await result.current.render(intent, "Render"); });
    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
    mocks.actor = "replacement-actor";
    mocks.authGeneration = "replacement-generation";
    rerender();
    await act(async () => { finish(reply(completed, 200)); });
    expect(result.current.job).toBeNull();
    expect(result.current.isPolling).toBe(false);
    await act(async () => { await result.current.refresh(); });
    expect(mocks.get).toHaveBeenCalledTimes(1);
    expect(mocks.post).toHaveBeenCalledTimes(1);
  });

  it("withdraws the existing download on branch 403 and discards an obsolete completion", async () => {
    let finishObsolete!: (value: ReturnType<typeof reply>) => void;
    const denied = new TenantApiClientError("The requested scope is not available.", {
      status: 403, statusText: "Forbidden", headers: new Headers(),
      data: { errorCode: "TRADE.AUTH.TARGET_DENIED", correlationId: "branch-revocation" },
    }, "http", { endpoint: statusUrl, method: "GET" });
    mocks.post.mockResolvedValueOnce(reply(pending, 202));
    mocks.get.mockResolvedValueOnce(reply(completed, 200))
      .mockImplementationOnce(() => new Promise(resolve => { finishObsolete = resolve; }))
      .mockRejectedValueOnce(denied);

    let controls!: ReturnType<typeof useTradePdfJob>;
    function PanelHarness() {
      const state = useTradePdfJob(purchaseBase, QUOTE, PURCHASE_SCOPE, "4");
      useLayoutEffect(() => { controls = state; }, [state]);
      return createElement(TradePdfPanel, { state, canRender: true, onRender: () => void state.render(intent, "Render") });
    }

    render(createElement(PanelHarness));
    await act(async () => { await controls.render(intent, "Render"); });
    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
    expect(controls.job?.artifact?.downloadUrl).toBe(artifact.downloadUrl);
    const download = screen.getByRole("button", { name: "Download" }) as HTMLButtonElement;
    expect(download.disabled).toBe(false);

    let obsolete!: Promise<void>;
    await act(async () => { obsolete = controls.refresh(); });
    const obsoleteSignal = mocks.get.mock.calls[1][1].signal as AbortSignal;
    await act(async () => { await controls.refresh(); });
    expect(obsoleteSignal.aborted).toBe(true);
    expect(controls.pollError).toMatchObject({ status: 403, code: "TRADE.AUTH.TARGET_DENIED" });
    expect.soft(controls.job?.artifact).toBeNull();
    expect.soft(screen.queryByRole("button", { name: "Download" })).toBeNull();

    await act(async () => {
      finishObsolete(reply({ ...completed,
        artifact: { ...artifact, downloadUrl: "https://storage.invalid/obsolete-result" },
      }, 200));
      await obsolete;
    });
    expect(controls.pollError).toMatchObject({ status: 403, code: "TRADE.AUTH.TARGET_DENIED" });
    expect(controls.job?.renderJobId).toBe(JOB);
    expect(controls.job?.artifact).toBeNull();
    expect(screen.queryByRole("button", { name: "Download" })).toBeNull();
    expect(mocks.get.mock.calls.map(([path, options]) => [path, options.headers])).toEqual([
      [statusUrl, PURCHASE_SCOPE], [statusUrl, PURCHASE_SCOPE], [statusUrl, PURCHASE_SCOPE],
    ]);
    expect(mocks.post.mock.calls.map(call => call[1])).toEqual([intent]);
  });

  it("blocks a fresh POST after branch denial while exact status-only settlement survives", async () => {
    const denied = new TenantApiClientError("The requested scope is not available.", {
      status: 403, statusText: "Forbidden", headers: new Headers(),
      data: { errorCode: "TRADE.AUTH.TARGET_DENIED", correlationId: "purchase-post-revocation" },
    }, "http", { endpoint: statusUrl, method: "GET" });
    mocks.post.mockReset().mockResolvedValue(reply(pending, 202));
    mocks.get.mockReset().mockResolvedValueOnce(reply(completed, 200)).mockRejectedValueOnce(denied)
      .mockResolvedValueOnce(reply(completed, 200));
    const { result, rerender } = renderHook(() => useTradePdfJob(purchaseBase, QUOTE, PURCHASE_SCOPE, "4"));
    try {
      await act(async () => { await result.current.render(intent, "Render"); });
      await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
      expect(result.current.job?.artifact?.downloadUrl).toBe(artifact.downloadUrl);
      const obsoleteRender = result.current.render;

      await act(async () => { await result.current.refresh(); });
      expect(result.current.pollError).toMatchObject({ status: 403, code: "TRADE.AUTH.TARGET_DENIED" });
      expect(result.current.job?.artifact).toBeNull();
      await act(async () => { await obsoleteRender(intent, "Render"); });
      await act(async () => { await result.current.render(intent, "Render"); });
      expect(mocks.post).toHaveBeenCalledTimes(1);

      mocks.purchaseRead = null;
      rerender();
      await act(async () => { await result.current.refresh(); });
      expect(result.current.job).toMatchObject({
        renderJobId: JOB, templateVersionId: VERSION, status: "COMPLETED",
        artifact: { checksum: artifact.checksum, downloadUrl: artifact.downloadUrl },
      });
      await act(async () => { await result.current.render(intent, "Render"); });
      expect(mocks.get.mock.calls.map(([path, options]) => [path, options.headers])).toEqual([
        [statusUrl, PURCHASE_SCOPE], [statusUrl, PURCHASE_SCOPE], [statusUrl, PURCHASE_SCOPE],
      ]);
      expect(mocks.post.mock.calls.map(call => call[1])).toEqual([intent]);
    } finally {
      mocks.post.mockReset();
      mocks.get.mockReset();
    }
  });

  it("settles the same authorized Branch job and only admits a new write callback", async () => {
    const branchPermission = mocks.purchaseRead;
    const denied = new TenantApiClientError("The requested scope is not available.", {
      status: 403, statusText: "Forbidden", headers: new Headers(),
      data: { errorCode: "TRADE.AUTH.TARGET_DENIED", correlationId: "purchase-reauthorization" },
    }, "http", { endpoint: statusUrl, method: "GET" });
    const latestArtifact = { ...artifact, downloadUrl: "https://storage.invalid/current-authorized-result" };
    const newJobId = "01890000-0000-7000-8000-000000000014";
    const nextJob = { ...pending, renderJobId: newJobId, statusUrl: purchaseBase + "/" + QUOTE + "/render-jobs/" + newJobId };
    mocks.post.mockReset().mockResolvedValueOnce(reply(pending, 202)).mockResolvedValueOnce(reply(nextJob, 202));
    mocks.get.mockReset().mockResolvedValueOnce(reply(completed, 200))
      .mockRejectedValueOnce(denied)
      .mockResolvedValueOnce(reply({ ...completed, templateVersionId: DIFFERENT }, 200))
      .mockResolvedValueOnce(reply({ ...completed, artifact: latestArtifact }, 200));
    const { result, rerender } = renderHook(() => useTradePdfJob(purchaseBase, QUOTE, PURCHASE_SCOPE, "4"));
    try {
      await act(async () => { await result.current.render(intent, "Render"); });
      await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
      expect(result.current.job?.artifact?.downloadUrl).toBe(artifact.downloadUrl);
      const preDenial = result.current.render;

      mocks.purchaseRead = null;
      rerender();
      await act(async () => { await result.current.refresh(); });
      expect(result.current.pollError).toMatchObject({ status: 403, code: "TRADE.AUTH.TARGET_DENIED" });
      expect(result.current.job?.artifact).toBeNull();
      const duringDenial = result.current.render;

      mocks.purchaseRead = branchPermission;
      rerender();
      await act(async () => { await result.current.refresh(); });
      expect(result.current.job?.artifact).toBeNull();
      expect(result.current.pollError?.message).toBe("Invalid Trade document response.");
      await act(async () => { await result.current.render(intent, "Render"); });
      expect(mocks.post).toHaveBeenCalledTimes(1);

      await act(async () => { await result.current.refresh(); });
      expect(result.current.job).toMatchObject({
        renderJobId: JOB, templateVersionId: VERSION, status: "COMPLETED",
        artifact: { checksum: latestArtifact.checksum, downloadUrl: latestArtifact.downloadUrl },
      });
      expect(result.current.pollError).toBeNull();
      await act(async () => { await preDenial(intent, "Render"); });
      await act(async () => { await duringDenial(intent, "Render"); });
      expect(mocks.post).toHaveBeenCalledTimes(1);
      expect(mocks.get.mock.calls.map(([path, options]) => [path, options.headers])).toEqual(
        Array.from({ length: 4 }, () => [statusUrl, PURCHASE_SCOPE]),
      );

      await act(async () => { await result.current.render(intent, "Render"); });
      expect(result.current.job?.renderJobId).toBe(newJobId);
      expect(mocks.post.mock.calls.map(([path, body]) => [path, body])).toEqual(
        Array.from({ length: 2 }, () => [purchaseBase + "/" + QUOTE + "/render-pdf", intent]),
      );
      expect(mocks.post.mock.calls[1][2].headers["x-idempotency-key"])
        .not.toBe(mocks.post.mock.calls[0][2].headers["x-idempotency-key"]);
      expect(mocks.get).toHaveBeenCalledTimes(4);
    } finally {
      mocks.post.mockReset();
      mocks.get.mockReset();
    }
  });

  it("explains read-only settlement while a retired request remains unresolved", async () => {
    const permission = mocks.purchaseRead;
    const denied = new TenantApiClientError("The requested scope is not available.", {
      status: 403, statusText: "Forbidden", headers: new Headers(),
      data: { errorCode: "TRADE.AUTH.TARGET_DENIED", correlationId: "purchase-ambiguity-regrant" },
    }, "http", { endpoint: statusUrl, method: "GET" });
    mocks.post.mockReset().mockResolvedValueOnce(reply(pending, 202))
      .mockRejectedValueOnce(new Error("The render acknowledgement is unknown"));
    mocks.get.mockReset().mockResolvedValueOnce(reply(completed, 200))
      .mockRejectedValueOnce(denied)
      .mockResolvedValueOnce(reply({ ...pending, status: "COMPLETED" }, 200));
    let controls!: ReturnType<typeof useTradePdfJob>;
    function PanelHarness() {
      const state = useTradePdfJob(purchaseBase, QUOTE, PURCHASE_SCOPE, "4");
      useLayoutEffect(() => { controls = state; }, [state]);
      return createElement(TradePdfPanel, { state, canRender: true, onRender: () => void state.render(intent, "Render") });
    }
    const panel = render(createElement(PanelHarness));
    try {
      await act(async () => { await controls.render(intent, "Render"); });
      await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
      expect(screen.getByRole("button", { name: "Download" })).toBeTruthy();
      const oldRender = controls.render;
      await act(async () => { await controls.render(intent, "Render"); });
      const oldRequest = controls.write.ambiguous!;
      expect(oldRequest.idempotencyKey).toBe(mocks.post.mock.calls[1][2].headers["x-idempotency-key"]);

      mocks.purchaseRead = null;
      panel.rerender(createElement(PanelHarness));
      await act(async () => { await controls.refresh(); });
      expect(mocks.get).toHaveBeenCalledTimes(2);
      expect(controls.pollError).toMatchObject({ status: 403, code: "TRADE.AUTH.TARGET_DENIED" });
      expect(screen.queryByRole("button", { name: "Download" })).toBeNull();

      mocks.purchaseRead = permission;
      panel.rerender(createElement(PanelHarness));
      const resume = screen.getByRole("button", { name: "Refresh job status" }) as HTMLButtonElement;
      expect(resume.disabled).toBe(false);
      await act(async () => { resume.click(); });
      expect(controls.job).toMatchObject({ renderJobId: JOB, templateVersionId: VERSION, status: "COMPLETED", artifact: null });
      expect(controls.pollError).toBeNull();
      expect(screen.queryByRole("button", { name: "Download" })).toBeNull();
      expect(screen.getByText("You can refresh the job status while the earlier render remains unresolved. Its original retry is blocked.")).toBeTruthy();
      expect((screen.getByRole("button", { name: /^(Retry|Try again)$/i }) as HTMLButtonElement).disabled).toBe(true);
      expect((screen.getByRole("button", { name: "Render PDF" }) as HTMLButtonElement).disabled).toBe(true);

      await act(async () => { await oldRequest.retry(); });
      await act(async () => { await oldRender(intent, "Render"); });
      await act(async () => { await controls.render(intent, "Render"); });
      expect(controls.write.ambiguous?.idempotencyKey).toBe(oldRequest.idempotencyKey);
      expect(mocks.post).toHaveBeenCalledTimes(2);
      expect(mocks.get.mock.calls.map(([path, options]) => [path, options.headers])).toEqual(
        Array.from({ length: 3 }, () => [statusUrl, PURCHASE_SCOPE]),
      );
    } finally {
      mocks.post.mockReset();
      mocks.get.mockReset();
    }
  });

  it("keeps newer job B after a retained status callback for A and preserves same-key recovery", async () => {
    const jobBId = "01890000-0000-7000-8000-000000000021";
    const jobCId = "01890000-0000-7000-8000-000000000022";
    const statusFor = (id: string) => purchaseBase + "/" + QUOTE + "/render-jobs/" + id;
    const jobB = { ...pending, renderJobId: jobBId, statusUrl: statusFor(jobBId) };
    const jobC = { ...pending, renderJobId: jobCId, statusUrl: statusFor(jobCId) };
    const completeA = { ...pending, status: "COMPLETED" };
    const completeB = { ...jobB, status: "COMPLETED" };
    mocks.post.mockReset()
      .mockRejectedValueOnce(new Error("First render acknowledgement is unknown"))
      .mockResolvedValueOnce(reply(pending, 202))
      .mockResolvedValueOnce(reply(jobB, 202))
      .mockRejectedValueOnce(new Error("Newest render acknowledgement is unknown"))
      .mockResolvedValueOnce(reply(jobC, 202));
    mocks.get.mockReset()
      .mockResolvedValueOnce(reply(completeA, 200))
      .mockResolvedValueOnce(reply(completeB, 200))
      .mockResolvedValueOnce(reply(completeA, 200));
    const { result } = renderHook(() => useTradePdfJob(purchaseBase, QUOTE, PURCHASE_SCOPE, "4"));
    try {
      await act(async () => { await result.current.render(intent, "Render"); });
      const retryA = result.current.write.ambiguous!.retry;
      await act(async () => { await retryA(); });
      await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
      expect(result.current.job).toMatchObject({ renderJobId: JOB, status: "COMPLETED", artifact: null });
      const refreshA = result.current.refresh;

      await act(async () => { await result.current.render(intent, "Render"); });
      await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
      expect(result.current.job).toMatchObject({ renderJobId: jobBId, status: "COMPLETED", artifact: null });
      expect(mocks.post.mock.calls[2][2].headers["x-idempotency-key"])
        .not.toBe(mocks.post.mock.calls[0][2].headers["x-idempotency-key"]);

      await act(async () => { await refreshA(); });
      expect.soft(result.current.job?.renderJobId).toBe(jobBId);
      expect.soft(mocks.get.mock.calls.map(([path, options]) => [path, options.headers])).toEqual([
        [statusUrl, PURCHASE_SCOPE], [statusFor(jobBId), PURCHASE_SCOPE],
      ]);

      await act(async () => { await result.current.render(intent, "Render"); });
      const retryC = result.current.write.ambiguous!;
      expect(retryC.idempotencyKey).toBe(mocks.post.mock.calls[3][2].headers["x-idempotency-key"]);
      await act(async () => { await retryA(); });
      expect(mocks.post).toHaveBeenCalledTimes(4);
      await act(async () => { await retryC.retry(); });
      expect(mocks.post).toHaveBeenCalledTimes(5);
      expect(mocks.post.mock.calls[4]).toEqual(mocks.post.mock.calls[3]);
      expect(result.current.job).toMatchObject({ renderJobId: jobCId, status: "PENDING", artifact: null });
      expect(result.current.write.ambiguous).toBeNull();
    } finally {
      mocks.post.mockReset();
      mocks.get.mockReset();
    }
  });
});

it("replays the frozen Purchase request only while the same branch still grants read access", async () => {
  vi.clearAllMocks();
  mocks.post.mockReset().mockRejectedValue(new Error("Render outcome is unknown"));
  mocks.get.mockReset();
  mocks.actor = "purchase-actor";
  mocks.authGeneration = "same-session";
  mocks.purchaseRead = "trade.purchase_orders.read";
  const purchaseBase = "/api/tenant/trade/v1/purchase-orders";
  const intent = {
    sourceVersion: 4, purpose: "PURCHASE_ORDER", templateVersionId: VERSION, locale: "ar-EG", timeZone: "Africa/Cairo",
  };
  const original = { ...intent };
  const { result, rerender } = renderHook(() => useTradePdfJob(purchaseBase, QUOTE, PURCHASE_SCOPE, "4"));
  try {
    await act(async () => { await result.current.render(intent, "Render"); });
    const uncertain = result.current.write.ambiguous!;
    expect(uncertain).toBeTruthy();
    intent.templateVersionId = DIFFERENT;
    intent.sourceVersion = 5;

    await act(async () => { await uncertain.retry(); });
    expect(mocks.post.mock.calls).toHaveLength(2);
    expect(mocks.post.mock.calls[0]).toEqual([
      purchaseBase + "/" + QUOTE + "/render-pdf", original,
      expect.objectContaining({ headers: { ...PURCHASE_SCOPE, "x-idempotency-key": uncertain.idempotencyKey } }),
    ]);
    expect(mocks.post.mock.calls[1]).toEqual(mocks.post.mock.calls[0]);
    const recover = result.current.write.ambiguous!.retry;

    mocks.purchaseRead = null;
    rerender();
    await act(async () => { await recover(); });
    expect(mocks.post).toHaveBeenCalledTimes(2);
    expect(mocks.get).not.toHaveBeenCalled();
    expect(result.current.write.ambiguous?.idempotencyKey).toBe(uncertain.idempotencyKey);
  } finally {
    mocks.purchaseRead = null;
    mocks.post.mockReset();
  }
});
