// @vitest-environment jsdom
import { Blob as NodeBlob } from "node:buffer";
import { createHash } from "node:crypto";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import { ar } from "@/i18n/dictionaries/ar";
import { axiosClient, TenantApiClientError } from "@/lib/api/axiosClient";
import { BRANCH_SCOPE_HEADER, COMPANY_SCOPE_HEADER } from "@/lib/api/organization-scope";
import { isUUIDv7 } from "@/lib/uuid";
import type { TenantAuthEvent } from "@/lib/auth/sessionCoordinator";
import { DETAIL_WITH_REVISION, HEADERS, QUOTE_ID } from "./quotation-composer.test-fixtures";
import { useQuotationPdfWorkspace } from "./useQuotationPdfWorkspace";
import type { QuotationDetail } from "../quotation-contract";
import type { QuotationTemplateChoice } from "../quotation-template-library";

const mocks = vi.hoisted(() => ({
  user: { id: "actor", isTenantOwner: true },
  language: "en" as "en" | "ar",
  libraryError: null as { status: number } | null,
  sessionId: "session-a",
  generation: "tenant:session-a:actor",
  latest: null as TenantAuthEvent | null,
  subscriber: null as ((event: TenantAuthEvent) => void) | null,
  get: vi.fn(), post: vi.fn(), setOpen: vi.fn(),
  toast: { success: vi.fn(), error: vi.fn(), errorFromApi: vi.fn(), outcomeFromApi: vi.fn(() => false) },
}));
vi.mock("@/context/AuthContext", () => ({ useTenantAuth: () => ({ user: mocks.user, realtimeAuthGeneration: mocks.generation }) }));
vi.mock("@/design-system", () => ({ useToast: () => mocks.toast }));
vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ t: mocks.language === "ar" ? ar : en }) }));
vi.mock("@/lib/api/axiosClient", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/api/axiosClient")>(),
  getStoredTenantSessionMeta: () => ({ sessionId: mocks.sessionId }),
}));
vi.mock("@/lib/auth/sessionCoordinator", () => ({
  readLatestTenantAuthEvent: () => mocks.latest,
  subscribeToTenantAuthEvents: (listener: (event: TenantAuthEvent) => void) => {
    mocks.subscriber = listener;
    return () => { mocks.subscriber = null; };
  },
}));
vi.mock("../../trade-api", () => ({
  tradeGet: mocks.get, tradePost: mocks.post,
  isTradeReplay: (headers: Headers) => headers.get("idempotency-replayed") === "true",
}));
vi.mock("./useQuotationTemplateLibrary", () => ({
  useQuotationTemplateLibrary: () => ({ items: [choice], error: mocks.libraryError, setOpen: mocks.setOpen }),
}));

const JOB_ID = "01890000-0000-7000-8000-000000000091";
const TEMPLATE_ID = "01890000-0000-7000-8000-000000000092";
const TEMPLATE_VERSION_ID = "01890000-0000-7000-8000-000000000093";
const WRONG_ID = "01890000-0000-7000-8000-000000000094";
const NEXT_JOB_ID = "01890000-0000-7000-8000-000000000095";
const NEXT_REVISION_ID = "01890000-0000-7000-8000-000000000096";
const BASE = `/api/tenant/trade/v1/quotations/${QUOTE_ID}`;
const JOB_PATH = `${BASE}/render-jobs/${JOB_ID}`;
const NEXT_JOB_PATH = `${BASE}/render-jobs/${NEXT_JOB_ID}`;
const quote: QuotationDetail = {
  ...DETAIL_WITH_REVISION,
  lifecycleStatus: "SENT",
  revisions: DETAIL_WITH_REVISION.revisions.map((revision) => ({ ...revision, status: "SENT" })),
};
const revisedQuote: QuotationDetail = {
  ...quote,
  currentRevisionId: NEXT_REVISION_ID,
  revisions: [...quote.revisions, { ...quote.revisions[0]!, id: NEXT_REVISION_ID, revisionNumber: 2 }],
};
const choice = { templateId: TEMPLATE_ID, templateVersionId: TEMPLATE_VERSION_ID, locale: en.quotationPdf.defaultLocale } as QuotationTemplateChoice;
const artifact = {
  checksum: "a".repeat(64), sizeBytes: 1024, pageCount: 1, completedAt: "2026-11-13T12:00:00Z",
  downloadUrl: "https://storage.example/quote.pdf?signature=first", downloadExpiresAt: "2026-11-13T12:00:10Z",
};

function jobResponse(status: string, httpStatus: 200 | 202 = 200, fields: Record<string, unknown> = {}) {
  return {
    status: httpStatus,
    headers: new Headers(httpStatus === 202 ? { Location: JOB_PATH } : {}),
    data: {
      status, renderJobId: JOB_ID, statusUrl: JOB_PATH, quotationId: QUOTE_ID, quotationRevisionId: quote.currentRevisionId,
      templateDefinitionId: TEMPLATE_ID, templateVersionId: TEMPLATE_VERSION_ID, attemptCount: 1,
      createdAt: "2026-11-13T11:59:50Z", updatedAt: "2026-11-13T12:00:00Z", ...fields,
    },
  };
}

function nextJobResponse(status: string, httpStatus: 200 | 202 = 200, fields: Record<string, unknown> = {}) {
  const response = jobResponse(status, httpStatus, {
    renderJobId: NEXT_JOB_ID, statusUrl: NEXT_JOB_PATH, quotationRevisionId: NEXT_REVISION_ID, ...fields,
  });
  if (httpStatus === 202) response.headers.set("Location", NEXT_JOB_PATH);
  return response;
}

describe("Sales Quotation PDF workspace", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.user = { id: "actor", isTenantOwner: true };
    mocks.language = "en";
    mocks.libraryError = null;
    mocks.sessionId = "session-a";
    mocks.generation = "tenant:session-a:actor";
    mocks.latest = null;
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-13T12:00:00Z"));
  });
  afterEach(() => {
    cleanup();
    mocks.get.mockReset();
    mocks.post.mockReset();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it.each([
    { name: "older default refusal", explicit: false, details: undefined, copy: en.quotationPdf.defaultTemplateUnavailable },
    { name: "older explicit-version refusal", explicit: true, details: undefined, copy: en.tradeDocuments.errors.pdfTemplateIncompatible },
    { name: "confirmed missing default", explicit: false, details: { reason: ["no_eligible_default_assignment"] }, copy: en.quotationPdf.noEligibleDefaultTemplate },
    { name: "incompatible default version", explicit: false, details: { reason: ["immutable_template_incompatible"] }, copy: en.quotationPdf.immutableTemplateIncompatible },
    { name: "incompatible explicit version", explicit: true, details: { reason: ["immutable_template_incompatible"] }, copy: en.quotationPdf.immutableTemplateIncompatible },
    { name: "default reason on explicit selection", explicit: true, details: { reason: ["no_eligible_default_assignment"] }, copy: en.tradeDocuments.errors.pdfTemplateIncompatible },
    { name: "future reason", explicit: false, details: { reason: ["new_reason"] }, copy: en.tradeDocuments.errors.pdfTemplateIncompatible },
    { name: "malformed reason", explicit: false, details: { reason: "no_eligible_default_assignment" }, copy: en.tradeDocuments.errors.pdfTemplateIncompatible },
    { name: "multiple reasons", explicit: false, details: { reason: ["no_eligible_default_assignment", "immutable_template_incompatible"] }, copy: en.tradeDocuments.errors.pdfTemplateIncompatible },
  ])("shows the right template 422 copy and skips polling for $name", async ({ explicit, details, copy }) => {
    const code = "TRADE.QUOTE.PDF_TEMPLATE_INCOMPATIBLE";
    const correlationId = "019f0000-0000-7000-8000-000000000090";
    const message = "No compatible published quotation template is available for this scope.";
    mocks.post.mockRejectedValueOnce(new TenantApiClientError(message, {
      status: 422, statusText: "Unprocessable Entity", headers: new Headers(),
      data: { success: false, statusCode: 422, errorCode: code, message, correlationId, ...(details ? { details } : {}) },
    }, "http"));
    const { result } = renderHook(() => useQuotationPdfWorkspace(quote, HEADERS, true));
    if (explicit) act(() => result.current.choose(choice));

    await act(async () => result.current.render());
    await act(async () => vi.advanceTimersByTimeAsync(2_001));

    expect(mocks.post).toHaveBeenCalledOnce();
    const intent = mocks.post.mock.lastCall?.[1];
    expect(intent.revisionId).toBe(quote.currentRevisionId);
    if (explicit) expect(intent.templateVersionId).toBe(TEMPLATE_VERSION_ID);
    else expect(intent).not.toHaveProperty("templateVersionId");
    const generic = copy === en.tradeDocuments.errors.pdfTemplateIncompatible;
    const guidance = copy === en.quotationPdf.immutableTemplateIncompatible ? en.quotationPdf.templateVersionAdminHelp
      : en.quotationPdf.defaultTemplateAdminHelp;
    const toastMessage = generic ? copy : `${copy} ${guidance}`;
    const expected = generic ? copy : `${toastMessage} ${en.quotationPdf.templateLibraryCheck}`;
    expect(result.current.writeErrorMessage).toBe(expected);
    expect(result.current.templateErrorReference).toBe(correlationId);
    expect(result.current.pdf.write.writeError).toMatchObject({ status: 422, code, correlationId });
    expect(result.current.pdf.write.ambiguous).toBeNull();
    expect(result.current.pdf.job).toBeNull();
    expect(mocks.get).not.toHaveBeenCalled();
    expect(mocks.toast.errorFromApi).toHaveBeenCalledWith(en.quotationPdf.generate,
      expect.objectContaining({ message: toastMessage, correlationId }));
  });

  it.each([
    { name: "quote branch grant", language: "en", templateBranch: HEADERS[BRANCH_SCOPE_HEADER], denied: false, allowed: true },
    { name: "Arabic quote branch grant", language: "ar", templateBranch: HEADERS[BRANCH_SCOPE_HEADER], denied: false, allowed: true },
    { name: "another branch grant", language: "en", templateBranch: WRONG_ID, denied: false, allowed: false },
    { name: "Arabic quotation read alone", language: "ar", templateBranch: null, denied: false, allowed: false },
    { name: "authoritative library 403", language: "en", templateBranch: HEADERS[BRANCH_SCOPE_HEADER], denied: true, allowed: false },
  ] as const)("allows checking another template only with current library access for $name", async ({ language, templateBranch, denied, allowed }) => {
    mocks.language = language;
    const quoteScope = { tenantWide: false, companyIds: [HEADERS[COMPANY_SCOPE_HEADER]], branchIds: [HEADERS[BRANCH_SCOPE_HEADER]] };
    const permissionScopes = {
      "trade.quotations.read": quoteScope,
      ...(templateBranch ? { "templates.read": { ...quoteScope, branchIds: [templateBranch] } } : {}),
    };
    const user = { id: "actor", isTenantOwner: false, permissions: Object.keys(permissionScopes), permissionScopes };
    mocks.user = user;
    mocks.libraryError = denied ? { status: 403 } : null;
    mocks.post.mockRejectedValueOnce(new TenantApiClientError("Template unavailable", {
      status: 422, statusText: "Unprocessable Entity", headers: new Headers(),
      data: { errorCode: "TRADE.QUOTE.PDF_TEMPLATE_INCOMPATIBLE" },
    }, "http"));
    const { result, rerender } = renderHook(() => useQuotationPdfWorkspace(quote, HEADERS, true));

    await act(async () => result.current.render());
    const copy = (language === "ar" ? ar : en).quotationPdf;
    const help = [copy.defaultTemplateUnavailable, copy.defaultTemplateAdminHelp].join(" ");
    expect(result.current.canChangeTemplate).toBe(allowed);
    expect(result.current.writeErrorMessage).toBe(allowed ? `${help} ${copy.templateLibraryCheck}` : help);
    expect(mocks.post).toHaveBeenCalledOnce();
    expect(mocks.post.mock.lastCall?.[1]).not.toHaveProperty("templateVersionId");
    expect(mocks.get).not.toHaveBeenCalled();
    expect(mocks.setOpen).not.toHaveBeenCalled();
    if (allowed) {
      mocks.libraryError = { status: 403 };
      rerender();
      expect(result.current.canChangeTemplate).toBe(false);
      expect(result.current.writeErrorMessage).toBe(help);
    }
  });

  it.each([
    [409, "TRADE.QUOTE.PDF_TEMPLATE_INCOMPATIBLE"],
    [422, "TRADE.QUOTE.PDF_TEMPLATE_CHANGED"],
  ])("leaves %s %s on its existing path even if details include a template reason", async (status, code) => {
    mocks.post.mockRejectedValueOnce(new TenantApiClientError("Template changed", {
      status, statusText: "Fixture refusal", headers: new Headers(),
      data: { errorCode: code, details: { reason: ["no_eligible_default_assignment"] } },
    }, "http"));
    const { result } = renderHook(() => useQuotationPdfWorkspace(quote, HEADERS, true));

    await act(async () => result.current.render());

    expect(result.current.writeErrorMessage).toBe(en.tradeDocuments.errors.pdfTemplateIncompatible);
    expect(result.current.templateErrorReference).toBeUndefined();
    expect(mocks.toast.error).toHaveBeenCalledWith(en.quotationPdf.generate, en.tradeDocuments.errors.pdfTemplateIncompatible);
    expect(mocks.get).not.toHaveBeenCalled();
  });

  it("opens a completed job with one scoped GET and rechecks that job on refresh", async () => {
    mocks.get.mockResolvedValueOnce(jobResponse("COMPLETED", 200, { artifact }));
    const { result } = renderHook(() => useQuotationPdfWorkspace(quote, HEADERS, true, JOB_ID));
    await act(async () => {});

    expect(result.current.pdf.job?.renderJobId).toBe(JOB_ID);
    expect(result.current.pdf.uiStatus).toBe("SUCCEEDED");
    expect(mocks.get).toHaveBeenCalledExactlyOnceWith(JOB_PATH, expect.objectContaining({
      headers: HEADERS, redirect: "error", requireExactResponseTarget: true,
    }));
    expect(mocks.post).not.toHaveBeenCalled();

    mocks.get.mockResolvedValueOnce(jobResponse("COMPLETED", 200, { artifact }));
    await act(async () => result.current.pdf.refresh());
    expect(mocks.get.mock.calls.map(([path]) => path)).toEqual([JOB_PATH, JOB_PATH]);
    expect(mocks.post).not.toHaveBeenCalled();
  });

  it.each([
    { renderJobId: NEXT_JOB_ID, statusUrl: NEXT_JOB_PATH },
    { quotationId: WRONG_ID },
    { quotationRevisionId: NEXT_REVISION_ID },
    { status: "COMPLETED", artifact: null },
    { status: "PENDING", artifact: null },
  ])("refuses an unusable status response for a reopened job (%j)", async (fields) => {
    mocks.get.mockResolvedValueOnce(jobResponse("COMPLETED", 200, { artifact, ...fields }));
    const { result } = renderHook(() => useQuotationPdfWorkspace(quote, HEADERS, true, JOB_ID));
    await act(async () => {});

    expect(result.current.pdf.job).toBeNull();
    expect(result.current.pdf.pollError).toBeTruthy();
    act(() => result.current.viewer.setOpen(true));
    expect(result.current.viewer.open).toBe(false);
    expect(mocks.get).toHaveBeenCalledOnce();
    expect(mocks.post).not.toHaveBeenCalled();
  });

  it("aborts a pending reopen when navigating and ignores its late completion", async () => {
    let finish!: (response: ReturnType<typeof jobResponse>) => void;
    mocks.get.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const initialProps: { id?: string } = { id: JOB_ID };
    const { result, rerender } = renderHook(({ id }: typeof initialProps) =>
      useQuotationPdfWorkspace(quote, HEADERS, true, id),
    { initialProps });
    const signal = mocks.get.mock.calls[0]?.[1].signal as AbortSignal;
    expect(signal.aborted).toBe(false);

    rerender({ id: undefined });
    expect(signal.aborted).toBe(true);
    await act(async () => finish(jobResponse("COMPLETED", 200, { artifact })));

    expect(result.current.pdf.job).toBeNull();
    expect(result.current.pdf.pollError).toBeNull();
    expect(result.current.pdf.isPolling).toBe(false);
    expect(mocks.get).toHaveBeenCalledOnce();
    expect(mocks.post).not.toHaveBeenCalled();
  });

  it("keeps the current reopened PDF when an earlier job read finishes late after a revision change", async () => {
    let finishPrevious!: (response: ReturnType<typeof jobResponse>) => void;
    const nextArtifact = { ...artifact, checksum: "b".repeat(64) };
    mocks.get.mockImplementationOnce(() => new Promise(resolve => { finishPrevious = resolve; }))
      .mockResolvedValueOnce(nextJobResponse("COMPLETED", 200, { artifact: nextArtifact }));
    const { result, rerender } = renderHook(({ quotation, jobId }) =>
      useQuotationPdfWorkspace(quotation, HEADERS, true, jobId),
    { initialProps: { quotation: quote, jobId: JOB_ID } });
    const previousSignal = mocks.get.mock.calls[0]?.[1].signal as AbortSignal;
    rerender({ quotation: revisedQuote, jobId: NEXT_JOB_ID });
    await act(async () => {});
    expect(previousSignal.aborted).toBe(true);
    expect(result.current.pdf.job).toMatchObject({
      renderJobId: NEXT_JOB_ID, quotationRevisionId: NEXT_REVISION_ID, artifact: nextArtifact,
    });

    await act(async () => finishPrevious(jobResponse("COMPLETED", 200, { artifact })));
    expect(result.current.pdf.job).toMatchObject({
      renderJobId: NEXT_JOB_ID, quotationRevisionId: NEXT_REVISION_ID, artifact: nextArtifact,
    });
    expect(result.current.pdf.pollError).toBeNull();
    expect(mocks.get.mock.calls.map(([path]) => path)).toEqual([JOB_PATH, NEXT_JOB_PATH]);
    expect(mocks.post).not.toHaveBeenCalled();
  });

  it("clears the reopened artifact on navigation and lets Generate start its normal render", async () => {
    mocks.get.mockResolvedValueOnce(jobResponse("COMPLETED", 200, { artifact }));
    const initialProps: { id?: string } = { id: JOB_ID };
    const { result, rerender } = renderHook(({ id }: typeof initialProps) =>
      useQuotationPdfWorkspace(quote, HEADERS, true, id),
    { initialProps });
    await act(async () => {});
    expect(result.current.pdf.job?.artifact).toEqual(artifact);

    rerender({ id: undefined });
    expect(result.current.pdf.job).toBeNull();
    act(() => result.current.viewer.setOpen(true));
    expect(result.current.viewer.open).toBe(false);
    expect(mocks.get).toHaveBeenCalledOnce();

    mocks.post.mockResolvedValueOnce(jobResponse("PENDING", 202));
    await act(async () => result.current.render());
    expect(mocks.post).toHaveBeenCalledExactlyOnceWith(`${BASE}/render-pdf`, {
      revisionId: quote.currentRevisionId, purpose: "CUSTOMER_QUOTATION", locale: en.quotationPdf.defaultLocale,
      timeZone: "Africa/Cairo",
    }, expect.objectContaining({ headers: expect.objectContaining(HEADERS) }));
  });

  it.each([0, 1])("rejects completion from attempt %i after a scheduled retry and renews the accepted artifact", async (staleAttempt) => {
    const renewed = { ...artifact, downloadUrl: "https://storage.example/quote.pdf?signature=second", downloadExpiresAt: "2026-11-13T12:05:00Z" };
    mocks.post.mockResolvedValueOnce(jobResponse("PENDING", 202, { attemptCount: 0 }));
    mocks.get.mockResolvedValueOnce(jobResponse("RETRYING"))
      .mockResolvedValueOnce(jobResponse("COMPLETED", 200, { attemptCount: staleAttempt, artifact }))
      .mockResolvedValueOnce(jobResponse("COMPLETED", 200, { attemptCount: 2, artifact }))
      .mockResolvedValueOnce(jobResponse("COMPLETED", 200, { attemptCount: 2, artifact: renewed }));
    const { result } = renderHook(() => useQuotationPdfWorkspace(quote, HEADERS, true));
    act(() => result.current.choose(choice));
    await act(async () => result.current.render());
    expect(result.current.pdf.uiStatus).toBe("QUEUED");
    expect(mocks.post).toHaveBeenCalledWith(`${BASE}/render-pdf`, {
      revisionId: quote.currentRevisionId, purpose: "CUSTOMER_QUOTATION", locale: choice.locale,
      timeZone: "Africa/Cairo", templateVersionId: TEMPLATE_VERSION_ID,
    }, expect.objectContaining({ headers: expect.objectContaining(HEADERS), redirect: "error", requireExactResponseTarget: true }));
    expect(isUUIDv7(mocks.post.mock.lastCall?.[2].headers["x-idempotency-key"])).toBe(true);
    await act(async () => vi.advanceTimersByTimeAsync(2_000));
    expect(result.current.pdf.uiStatus).toBe("RUNNING");
    await act(async () => vi.advanceTimersByTimeAsync(2_000));
    expect(result.current.pdf.pollError).toBeTruthy();
    expect(result.current.pdf.job).toMatchObject({ status: "RETRYING", attemptCount: 1, artifact: null });
    await act(async () => result.current.pdf.refresh());
    expect(result.current.pdf.uiStatus).toBe("SUCCEEDED");
    expect(result.current.pdf.job?.artifact).toEqual(artifact);
    await act(async () => vi.advanceTimersByTimeAsync(6_001));
    expect(result.current.pdf.uiStatus).toBe("ARTIFACT_EXPIRED");
    await act(async () => result.current.pdf.refresh());
    expect(result.current.pdf.job?.artifact).toEqual(renewed);
    expect(mocks.post).toHaveBeenCalledOnce();
    expect(mocks.get.mock.calls.map(([path]) => path)).toEqual([JOB_PATH, JOB_PATH, JOB_PATH, JOB_PATH]);
    expect(mocks.get.mock.lastCall?.[1]).toMatchObject({ headers: HEADERS, redirect: "error", requireExactResponseTarget: true });
  });

  it("recovers the frozen POST after an unknown outcome and reads a completed replay for artifact metadata", async () => {
    mocks.post.mockRejectedValueOnce(new Error("Connection closed")).mockResolvedValueOnce(jobResponse("COMPLETED", 202));
    mocks.get.mockResolvedValueOnce(jobResponse("COMPLETED", 200, { artifact }));
    const { result, rerender } = renderHook(({ enabled }) => useQuotationPdfWorkspace(quote, HEADERS, enabled), { initialProps: { enabled: true } });
    await act(async () => result.current.render());
    expect(result.current.pdf.write.isBlocked).toBe(true);
    expect(mocks.post.mock.calls[0]?.[1]).not.toHaveProperty("templateVersionId");
    rerender({ enabled: false });
    expect(result.current.eligible).toBe(false);
    await act(async () => result.current.pdf.write.ambiguous?.retry());
    expect(mocks.post.mock.calls[1]?.slice(0, 2)).toEqual(mocks.post.mock.calls[0]?.slice(0, 2));
    expect(mocks.post.mock.calls[1]?.[2].headers).toEqual(mocks.post.mock.calls[0]?.[2].headers);
    expect(mocks.get.mock.lastCall?.[0]).toBe(JOB_PATH);
    expect(result.current.pdf.job).toBeNull();
    rerender({ enabled: true });
    expect(result.current.pdf.job?.artifact).toEqual(artifact);
  });

  it("admits the completed receipt even if its untrusted artifact is malformed", async () => {
    mocks.post.mockResolvedValueOnce(jobResponse("COMPLETED", 202, { artifact: { downloadUrl: "broken" } }));
    mocks.get.mockResolvedValueOnce(jobResponse("COMPLETED", 200, { artifact }));
    const { result } = renderHook(() => useQuotationPdfWorkspace(quote, HEADERS, true));

    await act(async () => result.current.render());

    expect(result.current.pdf.write.ambiguous).toBeNull();
    expect(result.current.pdf.job).toMatchObject({ renderJobId: JOB_ID, artifact });
    expect(mocks.get).toHaveBeenCalledExactlyOnceWith(JOB_PATH, expect.objectContaining({ headers: HEADERS }));
    expect(mocks.post).toHaveBeenCalledOnce();
  });

  it("rejects an unexpected status job and resumes the accepted job through a terminal worker failure", async () => {
    mocks.post.mockResolvedValueOnce(jobResponse("PENDING", 202));
    mocks.get.mockResolvedValueOnce(jobResponse("COMPLETED", 200, {
      renderJobId: WRONG_ID, statusUrl: `${BASE}/render-jobs/${WRONG_ID}`, artifact,
    })).mockResolvedValueOnce(jobResponse("FAILED", 200, {
      failure: { code: "TRADE.QUOTE.PDF_RENDER_FAILED", terminal: true },
    }));
    const { result } = renderHook(() => useQuotationPdfWorkspace(quote, HEADERS, true));
    await act(async () => result.current.render());
    await act(async () => vi.advanceTimersByTimeAsync(2_000));
    expect(result.current.pdf.pollError).toBeTruthy();
    expect(result.current.pdf.job?.artifact).toBeNull();
    await act(async () => result.current.pdf.refresh());
    expect(result.current.pdf.uiStatus).toBe("FAILED");
    expect(result.current.pdf.job?.failure?.code).toBe("TRADE.QUOTE.PDF_RENDER_FAILED");
    expect(result.current.pdf.isPolling).toBe(false);
    await act(async () => vi.advanceTimersByTimeAsync(10_000));
    expect(mocks.get.mock.calls.map(([path]) => path)).toEqual([JOB_PATH, JOB_PATH]);
  });

  it("rejects a replacement artifact when refreshing the same completed job", async () => {
    mocks.post.mockResolvedValueOnce(jobResponse("COMPLETED", 202));
    mocks.get.mockResolvedValueOnce(jobResponse("COMPLETED", 200, { artifact }))
      .mockResolvedValueOnce(jobResponse("COMPLETED", 200, {
        artifact: { ...artifact, checksum: "b".repeat(64), downloadUrl: "https://storage.example/different.pdf" },
      }));
    const { result } = renderHook(() => useQuotationPdfWorkspace(quote, HEADERS, true));
    await act(async () => result.current.render());
    await act(async () => result.current.pdf.refresh());
    expect(result.current.pdf.pollError).toBeTruthy();
    expect(result.current.pdf.job?.artifact).toEqual(artifact);
    expect(mocks.get.mock.calls.map(([path]) => path)).toEqual([JOB_PATH, JOB_PATH]);
  });

  it.each([
    { response: "matching", fields: { artifact }, readsArtifact: true },
    { response: "different revision", fields: { artifact, quotationRevisionId: NEXT_REVISION_ID } },
    { response: "missing artifact", fields: {} },
    { response: "missing digest", fields: { artifact: { ...artifact, checksum: undefined } } },
    { response: "invalid digest", fields: { artifact: { ...artifact, checksum: "g".repeat(64) } } },
    { response: "changed digest", fields: { artifact: { ...artifact, checksum: "b".repeat(64) } } },
    { response: "missing size", fields: { artifact: { ...artifact, sizeBytes: undefined } } },
    { response: "invalid size", fields: { artifact: { ...artifact, sizeBytes: 0 } } },
    { response: "changed size", fields: { artifact: { ...artifact, sizeBytes: artifact.sizeBytes + 1 } } },
  ])("rechecks the scoped job before downloading ($response status)", async ({ fields, readsArtifact }) => {
    let finishRecheck!: (response: ReturnType<typeof jobResponse>) => void;
    const fetchArtifact = vi.spyOn(axiosClient, "get").mockRejectedValueOnce(new Error("Binary unavailable"));
    mocks.post.mockResolvedValueOnce(jobResponse("COMPLETED", 202));
    mocks.get.mockResolvedValueOnce(jobResponse("COMPLETED", 200, { artifact }))
      .mockImplementationOnce(() => new Promise((resolve) => { finishRecheck = resolve; }));
    const { result } = renderHook(() => useQuotationPdfWorkspace(quote, HEADERS, true));
    await act(async () => result.current.render());
    expect(result.current.pdf.uiStatus).toBe("SUCCEEDED");

    act(() => result.current.download());
    expect(mocks.get).toHaveBeenCalledTimes(2);
    expect(mocks.get).toHaveBeenLastCalledWith(JOB_PATH, expect.objectContaining({
      headers: HEADERS, redirect: "error", requireExactResponseTarget: true,
    }));
    expect(fetchArtifact).not.toHaveBeenCalled();

    await act(async () => finishRecheck(jobResponse("COMPLETED", 200, fields)));

    if (readsArtifact) {
      expect(fetchArtifact).toHaveBeenCalledExactlyOnceWith(`${JOB_PATH}/artifact`, expect.objectContaining({
        headers: HEADERS, responseType: "blob", cache: "no-store", redirect: "error", requireExactResponseTarget: true,
      }));
    } else {
      expect(result.current.pdf.pollError).toBeTruthy();
      expect(result.current.pdf.job?.artifact).toEqual(artifact);
      expect(fetchArtifact).not.toHaveBeenCalled();
    }
  });

  it("resumes a reopened Preview after the same-job access recovery returns", async () => {
    const complete = jobResponse("COMPLETED", 200, { artifact });
    let finish!: (response: typeof complete) => void;
    mocks.get.mockResolvedValueOnce(complete)
      .mockImplementationOnce(() => new Promise<typeof complete>((resolve) => { finish = resolve; }));
    const fetchArtifact = vi.spyOn(axiosClient, "get")
      .mockRejectedValueOnce(new TenantApiClientError("Access denied", {
        status: 403, statusText: "Forbidden", headers: new Headers(), data: {},
      }, "http"))
      .mockRejectedValue(new TenantApiClientError("Artifact unavailable", {
        status: 503, statusText: "Service Unavailable", headers: new Headers(), data: {},
      }, "http"));
    const { result } = renderHook(() => useQuotationPdfWorkspace(quote, HEADERS, true, JOB_ID));
    await act(async () => {});
    await act(async () => result.current.viewer.setOpen(true));
    expect(result.current.viewer.accessError?.status).toBe(403);
    act(() => result.current.viewer.setOpen(false));

    let recovery!: Promise<void>;
    act(() => { recovery = result.current.pdf.refresh(); });
    expect(mocks.get).toHaveBeenCalledTimes(2);
    act(() => result.current.viewer.setOpen(true));
    expect(fetchArtifact).toHaveBeenCalledOnce();
    await act(async () => { finish(complete); await recovery; });

    expect(result.current.viewer.accessError).toBeUndefined();
    expect(fetchArtifact.mock.calls.map(([path]) => path)).toEqual(Array(2).fill(`${JOB_PATH}/artifact`));
    expect(result.current.viewer.loading).toBe(false);
    expect(result.current.viewer.error).toBe(true);
    expect(result.current.viewer.url).toBeNull();
    expect(mocks.post).not.toHaveBeenCalled();
  });

  it("uses the exact scoped artifact read when signing is unavailable and honors its permission refusal", async () => {
    const unavailable = new TenantApiClientError("Artifact signing unavailable", {
      status: 503, statusText: "Service Unavailable", headers: new Headers(),
      data: { errorCode: "TRADE.QUOTE.PDF_ARTIFACT_UNAVAILABLE" },
    }, "http");
    const forbidden = new TenantApiClientError("Quotation access revoked", {
      status: 403, statusText: "Forbidden", headers: new Headers(),
      data: { errorCode: "TRADE.AUTH.TARGET_DENIED" },
    }, "http");
    const readArtifact = vi.spyOn(axiosClient, "get").mockRejectedValueOnce(forbidden);
    mocks.get.mockResolvedValueOnce(jobResponse("COMPLETED", 200, { artifact }))
      .mockRejectedValueOnce(unavailable);
    const { result } = renderHook(() => useQuotationPdfWorkspace(quote, HEADERS, true, JOB_ID));
    await act(async () => {});

    await act(async () => result.current.download());

    expect(mocks.get.mock.calls.map(([path]) => path)).toEqual([JOB_PATH, JOB_PATH]);
    expect(readArtifact).toHaveBeenCalledExactlyOnceWith(`${JOB_PATH}/artifact`, expect.objectContaining({
      headers: HEADERS, responseType: "blob", cache: "no-store", redirect: "error", requireExactResponseTarget: true,
    }));
    expect(result.current.pdf.pollError).toBeNull();
    expect(result.current.viewer.accessError?.status).toBe(403);
    expect(result.current.viewer.url).toBeNull();
    expect(mocks.post).not.toHaveBeenCalled();
  });

  it.each([401, 403, 404, 410])("blocks the artifact when status refresh denies access (%s)", async (status) => {
    const readArtifact = vi.spyOn(axiosClient, "get").mockRejectedValue(new Error("Unexpected artifact read"));
    mocks.get.mockResolvedValueOnce(jobResponse("COMPLETED", 200, { artifact }))
      .mockRejectedValueOnce(new TenantApiClientError("Status token or scope refused", {
        status, statusText: "Access refused", headers: new Headers(),
        data: { errorCode: "TRADE.QUOTE.PDF_ARTIFACT_UNAVAILABLE" },
      }, "http"));
    const { result } = renderHook(() => useQuotationPdfWorkspace(quote, HEADERS, true, JOB_ID));
    await act(async () => {});

    await act(async () => result.current.download());

    expect(mocks.get.mock.calls.map(([path]) => path)).toEqual([JOB_PATH, JOB_PATH]);
    expect(result.current.pdf.pollError?.status).toBe(status);
    expect(result.current.pdf.job?.artifact).toBeNull();
    expect(readArtifact).not.toHaveBeenCalled();
  });

  it("does not fall back when the status refresh fails for another reason", async () => {
    const readArtifact = vi.spyOn(axiosClient, "get").mockRejectedValue(new Error("Unexpected artifact read"));
    mocks.get.mockResolvedValueOnce(jobResponse("COMPLETED", 200, { artifact }))
      .mockRejectedValueOnce(new TenantApiClientError("Upstream unavailable", {
        status: 503, statusText: "Service Unavailable", headers: new Headers(),
        data: { errorCode: "UPSTREAM_UNAVAILABLE" },
      }, "http"));
    const { result } = renderHook(() => useQuotationPdfWorkspace(quote, HEADERS, true, JOB_ID));
    await act(async () => {});

    await act(async () => result.current.download());

    expect(result.current.pdf.pollError?.code).toBe("UPSTREAM_UNAVAILABLE");
    expect(readArtifact).not.toHaveBeenCalled();
  });

  it("does not use a late signer error after changing branches", async () => {
    const readArtifact = vi.spyOn(axiosClient, "get").mockRejectedValue(new Error("Unexpected artifact read"));
    let rejectRefresh!: (error: TenantApiClientError) => void;
    mocks.get.mockResolvedValueOnce(jobResponse("COMPLETED", 200, { artifact }))
      .mockImplementationOnce(() => new Promise((_, reject) => { rejectRefresh = reject; }));
    const { result, rerender } = renderHook(
      ({ headers }) => useQuotationPdfWorkspace(quote, headers, true, JOB_ID),
      { initialProps: { headers: HEADERS } },
    );
    await act(async () => {});
    act(() => result.current.download());

    rerender({ headers: { ...HEADERS, [BRANCH_SCOPE_HEADER]: WRONG_ID } });
    await act(async () => rejectRefresh(new TenantApiClientError("Artifact signing unavailable", {
      status: 503, statusText: "Service Unavailable", headers: new Headers(),
      data: { errorCode: "TRADE.QUOTE.PDF_ARTIFACT_UNAVAILABLE" },
    }, "http")));

    expect(result.current.pdf.job).toBeNull();
    expect(readArtifact).not.toHaveBeenCalled();
  });

  it("rejects an acceptance for another template version and retires its retry on a session handoff", async () => {
    mocks.post.mockResolvedValueOnce(jobResponse("PENDING", 202, { templateVersionId: WRONG_ID }));
    const { result, rerender } = renderHook(() => useQuotationPdfWorkspace(quote, HEADERS, true));
    act(() => result.current.choose(choice));
    await act(async () => result.current.render());
    const retry = result.current.pdf.write.ambiguous?.retry;
    expect(retry).toBeTypeOf("function");
    expect(result.current.pdf.job).toBeNull();
    mocks.sessionId = "session-b";
    mocks.generation = "tenant:session-b:actor";
    rerender();
    await act(async () => retry?.());
    expect(result.current.selected).toBeNull();
    expect(result.current.pdf.write.ambiguous).toBeNull();
    expect(mocks.post).toHaveBeenCalledOnce();
    expect(mocks.get).not.toHaveBeenCalled();
  });

  it("aborts a late poll and hides its artifact when the same user changes sessions", async () => {
    let complete!: (response: ReturnType<typeof jobResponse>) => void;
    mocks.post.mockResolvedValueOnce(jobResponse("PENDING", 202));
    mocks.get.mockImplementationOnce(() => new Promise((resolve) => { complete = resolve; }));
    const { result } = renderHook(() => useQuotationPdfWorkspace(quote, HEADERS, true));
    await act(async () => result.current.render());
    await act(async () => vi.advanceTimersByTimeAsync(2_000));
    act(() => {
      mocks.latest = {
        realm: "tenant", kind: "session-updated", sessionId: "session-b",
        sourceId: "other-tab", eventId: "handoff", issuedAt: Date.now(),
      };
      mocks.subscriber?.(mocks.latest);
    });
    expect(mocks.get.mock.lastCall?.[1].signal.aborted).toBe(true);
    await act(async () => { complete(jobResponse("COMPLETED", 200, { artifact })); });
    expect(result.current.pdf.job).toBeNull();
    expect(result.current.pdf.isPolling).toBe(false);
    expect(result.current.viewer.open).toBe(false);
  });

  it("drops the completed job, download link, and open preview when the quotation revision changes", async () => {
    vi.useRealTimers();
    const downloadExpiresAt = new Date(Date.now() + 60_000).toISOString();
    const content = "%PDF-1.7\nprevious revision";
    const blob = new NodeBlob([content], { type: "application/pdf" });
    const previousArtifact = {
      ...artifact, sizeBytes: blob.size, checksum: createHash("sha256").update(content).digest("hex"),
      downloadExpiresAt,
      downloadUrl: `https://storage.example/${QUOTE_ID}-revision-${quote.currentRevisionId}.pdf?signature=previous`,
    };
    const nextArtifact = {
      ...artifact, downloadExpiresAt,
      downloadUrl: `https://storage.example/${QUOTE_ID}-revision-${NEXT_REVISION_ID}.pdf?signature=next`,
    };
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", Object.assign(class extends URL {}, {
      createObjectURL: vi.fn(() => "blob:previous-revision"), revokeObjectURL,
    }));
    const fetchArtifact = vi.spyOn(axiosClient, "get").mockResolvedValueOnce({
      data: blob, status: 200, statusText: "OK", headers: new Headers(),
    });
    mocks.post.mockResolvedValueOnce(jobResponse("COMPLETED", 202));
    mocks.post.mockResolvedValueOnce(nextJobResponse("COMPLETED", 202));
    mocks.get.mockResolvedValueOnce(jobResponse("COMPLETED", 200, { artifact: previousArtifact }));
    mocks.get.mockResolvedValueOnce(nextJobResponse("COMPLETED", 200, { artifact: nextArtifact }));
    const { result, rerender } = renderHook(({ quotation }) => useQuotationPdfWorkspace(quotation, HEADERS, true),
      { initialProps: { quotation: quote } });
    await act(async () => result.current.render());
    expect(result.current.pdf.uiStatus).toBe("SUCCEEDED");
    expect(result.current.pdf.job?.artifact?.downloadUrl).toBe(previousArtifact.downloadUrl);
    act(() => result.current.viewer.setOpen(true));
    await waitFor(() => expect(result.current.viewer).toMatchObject({ open: true, url: "blob:previous-revision" }));
    expect(fetchArtifact).toHaveBeenCalledWith(`${JOB_PATH}/artifact`, expect.anything());
    const refresh = result.current.pdf.refresh;

    rerender({ quotation: revisedQuote });
    expect(result.current.pdf.job).toBeNull();
    expect(result.current.viewer).toMatchObject({ open: false, url: null });
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:previous-revision");

    await act(async () => result.current.render());
    expect(result.current.pdf.job).toMatchObject({ renderJobId: NEXT_JOB_ID, artifact: nextArtifact });
    expect(result.current.viewer).toMatchObject({ open: false, url: null });
    rerender({ quotation: quote });
    await act(async () => refresh());
    expect(result.current.pdf.job).toBeNull();
    expect(mocks.get.mock.calls.map(([path]) => path)).toEqual([JOB_PATH, NEXT_JOB_PATH]);
  });

  it("resumes only the accepted job for the new revision while an old status response is still in flight", async () => {
    let finishPrevious!: (response: ReturnType<typeof jobResponse>) => void;
    const nextArtifact = { ...artifact, checksum: "b".repeat(64), downloadUrl: "https://storage.example/revision-2.pdf" };
    mocks.post.mockResolvedValueOnce(jobResponse("PENDING", 202))
      .mockResolvedValueOnce(nextJobResponse("PENDING", 202));
    mocks.get.mockImplementationOnce(() => new Promise((resolve) => { finishPrevious = resolve; }))
      .mockRejectedValueOnce(new Error("Status temporarily unavailable"))
      .mockResolvedValueOnce(nextJobResponse("COMPLETED", 200, { artifact: nextArtifact }));
    const { result, rerender } = renderHook(({ quotation }) => useQuotationPdfWorkspace(quotation, HEADERS, true),
      { initialProps: { quotation: quote } });

    await act(async () => result.current.render());
    await act(async () => vi.advanceTimersByTimeAsync(2_000));
    const previousRefresh = result.current.pdf.refresh;
    const previousSignal = mocks.get.mock.lastCall?.[1].signal as AbortSignal;
    rerender({ quotation: revisedQuote });
    expect(previousSignal.aborted).toBe(true);
    expect(result.current.pdf.job).toBeNull();

    act(() => result.current.choose(choice));
    await act(async () => result.current.render());
    expect(mocks.post.mock.lastCall?.[1]).toMatchObject({
      revisionId: NEXT_REVISION_ID, purpose: "CUSTOMER_QUOTATION", templateVersionId: TEMPLATE_VERSION_ID,
    });
    await act(async () => vi.advanceTimersByTimeAsync(2_000));
    expect(result.current.pdf.pollError).toBeTruthy();
    await act(async () => {
      finishPrevious(jobResponse("COMPLETED", 200, { artifact }));
      await previousRefresh();
    });
    expect(result.current.pdf.job).toMatchObject({ renderJobId: NEXT_JOB_ID, artifact: null });
    expect(result.current.pdf.pollError).toBeTruthy();

    await act(async () => result.current.pdf.refresh());
    expect(result.current.pdf.job).toMatchObject({ renderJobId: NEXT_JOB_ID, artifact: nextArtifact });
    expect(result.current.pdf.uiStatus).toBe("SUCCEEDED");
    expect(mocks.get.mock.calls.map(([path]) => path)).toEqual([JOB_PATH, NEXT_JOB_PATH, NEXT_JOB_PATH]);
    expect(mocks.post).toHaveBeenCalledTimes(2);
  });

  it("retires the old revision's unknown write without blocking same-key recovery for the new revision", async () => {
    mocks.post.mockRejectedValueOnce(new Error("Previous response lost"))
      .mockRejectedValueOnce(new Error("Current response lost"))
      .mockResolvedValueOnce(nextJobResponse("COMPLETED", 202));
    mocks.get.mockResolvedValueOnce(nextJobResponse("COMPLETED", 200, { artifact }));
    const { result, rerender } = renderHook(({ quotation }) => useQuotationPdfWorkspace(quotation, HEADERS, true),
      { initialProps: { quotation: quote } });

    await act(async () => result.current.render());
    const previousAttempt = result.current.pdf.write.ambiguous!;
    rerender({ quotation: revisedQuote });
    expect(result.current.pdf.write.ambiguous).toBeNull();
    await act(async () => result.current.render());
    const currentAttempt = result.current.pdf.write.ambiguous!;
    expect(currentAttempt.idempotencyKey).not.toBe(previousAttempt.idempotencyKey);
    await act(async () => previousAttempt.retry());
    expect(mocks.post).toHaveBeenCalledTimes(2);
    await act(async () => currentAttempt.retry());

    const [, current, retried] = mocks.post.mock.calls;
    expect(current[1]).toMatchObject({ revisionId: NEXT_REVISION_ID });
    expect(retried.slice(0, 2)).toEqual(current.slice(0, 2));
    expect(retried[2].headers).toEqual(current[2].headers);
    expect(result.current.pdf.job).toMatchObject({ renderJobId: NEXT_JOB_ID, artifact });
  });

  it.each([
    { returnScope: "the same branch", branchChanges: false },
    { returnScope: "another branch", branchChanges: true },
  ])("checks completed replay artifacts after returning to the same revision under $returnScope", async ({ branchChanges }) => {
    const previousArtifact = { ...artifact, downloadUrl: "https://storage.example/previous.pdf" };
    const currentArtifact = { ...artifact, checksum: "b".repeat(64), downloadUrl: "https://storage.example/current.pdf" };
    const currentQuote = branchChanges ? { ...quote, branchId: WRONG_ID } : quote;
    const currentHeaders = { ...HEADERS, [BRANCH_SCOPE_HEADER]: currentQuote.branchId };
    const revision = { quotationRevisionId: quote.currentRevisionId };
    let completePrevious!: (response: ReturnType<typeof jobResponse>) => void;
    let completeCurrent!: (response: ReturnType<typeof jobResponse>) => void;
    mocks.post.mockImplementationOnce(() => new Promise((resolve) => { completePrevious = resolve; }))
      .mockResolvedValueOnce(nextJobResponse("COMPLETED", 202, { ...revision, artifact: previousArtifact }));
    mocks.get.mockImplementationOnce(() => new Promise((resolve) => { completeCurrent = resolve; }))
      .mockResolvedValueOnce(nextJobResponse("COMPLETED", 200, { ...revision, artifact: currentArtifact }));
    const { result, rerender } = renderHook(
      ({ quotation, headers }) => useQuotationPdfWorkspace(quotation, headers, true),
      { initialProps: { quotation: quote, headers: HEADERS } },
    );

    let previousRender: Promise<void> | undefined;
    act(() => { previousRender = result.current.render(); });
    const previousSignal = mocks.post.mock.lastCall?.[2].signal as AbortSignal;
    rerender({ quotation: { ...revisedQuote, id: WRONG_ID }, headers: HEADERS });
    expect(previousSignal.aborted).toBe(true);
    rerender({ quotation: currentQuote, headers: currentHeaders });

    await act(async () => result.current.render());
    expect(result.current.pdf.job).toMatchObject({ renderJobId: NEXT_JOB_ID, artifact: null });
    expect(result.current.viewer).toMatchObject({ open: false, url: null });
    expect(mocks.post).toHaveBeenLastCalledWith(`${BASE}/render-pdf`, expect.objectContaining({ revisionId: quote.currentRevisionId }),
      expect.objectContaining({ headers: expect.objectContaining(currentHeaders) }));
    await act(async () => {
      completePrevious(jobResponse("COMPLETED", 202, { artifact: previousArtifact }));
      await previousRender;
    });
    expect(result.current.pdf.job).toMatchObject({ renderJobId: NEXT_JOB_ID, artifact: null });
    expect(mocks.get).toHaveBeenCalledExactlyOnceWith(NEXT_JOB_PATH, expect.objectContaining({ headers: currentHeaders }));

    await act(async () => { completeCurrent(nextJobResponse("COMPLETED", 200, { artifact: previousArtifact })); });
    expect(result.current.pdf.pollError).toBeTruthy();
    expect(result.current.pdf.job).toMatchObject({ renderJobId: NEXT_JOB_ID, artifact: null });
    await act(async () => result.current.pdf.refresh());
    expect(result.current.pdf.job).toMatchObject({ renderJobId: NEXT_JOB_ID, artifact: currentArtifact });
    expect(mocks.get.mock.calls.map(([path, request]) => [path, request.headers])).toEqual([
      [NEXT_JOB_PATH, currentHeaders], [NEXT_JOB_PATH, currentHeaders],
    ]);
  });

  it.each([
    { scope: "company", field: "companyId", header: COMPANY_SCOPE_HEADER },
    { scope: "branch", field: "branchId", header: BRANCH_SCOPE_HEADER },
  ] as const)("requires matching $scope scope before accepting another job for the same quotation", async ({ field, header }) => {
    const nextHeaders = { ...HEADERS, [header]: WRONG_ID };
    const scopedQuote = { ...quote, [field]: WRONG_ID };
    const previousRenewal = { ...artifact, downloadUrl: "https://storage.example/quote.pdf?signature=old-renewal" };
    const nextArtifact = { ...artifact, checksum: "b".repeat(64), downloadUrl: "https://storage.example/quote.pdf?signature=new-scope" };
    const nextRenewal = { ...nextArtifact, downloadUrl: "https://storage.example/quote.pdf?signature=new-renewal",
      downloadExpiresAt: "2026-11-13T12:05:00Z" };
    const sameRevision = { quotationRevisionId: quote.currentRevisionId };
    let completePrevious!: (response: ReturnType<typeof jobResponse>) => void;
    mocks.post.mockResolvedValueOnce(jobResponse("COMPLETED", 202))
      .mockResolvedValueOnce(nextJobResponse("COMPLETED", 202, sameRevision));
    mocks.get.mockResolvedValueOnce(jobResponse("COMPLETED", 200, { artifact }))
      .mockImplementationOnce(() => new Promise((resolve) => { completePrevious = resolve; }))
      .mockResolvedValueOnce(nextJobResponse("COMPLETED", 200, { ...sameRevision, artifact: nextArtifact }))
      .mockResolvedValueOnce(nextJobResponse("COMPLETED", 200, { ...sameRevision, artifact: nextRenewal }));
    const { result, rerender } = renderHook(
      ({ quotation, headers }) => useQuotationPdfWorkspace(quotation, headers, true),
      { initialProps: { quotation: quote, headers: HEADERS } },
    );

    await act(async () => result.current.render());
    expect(result.current.pdf.job).toMatchObject({ renderJobId: JOB_ID, artifact });
    const { render: previousRender, pdf: { refresh: previousRefresh } } = result.current;
    let previousRead: Promise<void> | undefined;
    act(() => { previousRead = previousRefresh(); });
    expect(mocks.get).toHaveBeenCalledTimes(2);
    const previousRequest = mocks.get.mock.lastCall?.[1];

    rerender({ quotation: quote, headers: nextHeaders });
    expect(previousRequest.signal.aborted).toBe(true);
    expect(result.current.eligible).toBe(false);
    expect(result.current.pdf.job).toBeNull();
    expect(result.current.viewer).toMatchObject({ open: false, url: null });
    await act(async () => result.current.render());
    expect(mocks.post).toHaveBeenCalledOnce();

    rerender({ quotation: scopedQuote, headers: nextHeaders });
    expect(result.current.eligible).toBe(true);
    expect(result.current.pdf.job).toBeNull();
    await act(async () => previousRender());
    expect(mocks.post).toHaveBeenCalledOnce();
    await act(async () => result.current.render());
    expect(mocks.post.mock.lastCall?.[1]).toMatchObject({ revisionId: quote.currentRevisionId });
    const [previousPost, nextPost] = mocks.post.mock.calls;
    const nextKey = nextPost[2].headers["x-idempotency-key"];
    expect(isUUIDv7(nextKey)).toBe(true);
    expect(nextKey).not.toBe(previousPost[2].headers["x-idempotency-key"]);
    expect(nextPost[2].headers).toEqual({ ...nextHeaders, "x-idempotency-key": nextKey });

    await act(async () => {
      completePrevious(jobResponse("COMPLETED", 200, { artifact: previousRenewal }));
      await previousRead;
    });
    expect(result.current.pdf.job).toMatchObject({ renderJobId: NEXT_JOB_ID, artifact: nextArtifact });
    await act(async () => vi.advanceTimersByTimeAsync(10_001));
    expect(result.current.pdf.uiStatus).toBe("ARTIFACT_EXPIRED");
    await act(async () => result.current.pdf.refresh());
    expect(result.current.pdf.uiStatus).toBe("SUCCEEDED");
    expect(result.current.pdf.job).toMatchObject({ renderJobId: NEXT_JOB_ID, artifact: nextRenewal });
    expect(mocks.post).toHaveBeenCalledTimes(2);
    expect(mocks.get.mock.calls.map(([path, request]) => [path, request.headers])).toEqual([
      [JOB_PATH, HEADERS], [JOB_PATH, HEADERS], [NEXT_JOB_PATH, nextHeaders], [NEXT_JOB_PATH, nextHeaders],
    ]);
  });
});

// Appended to the exact private workspace-hook tests by recheck.config.mts.
it.each(["revoked scope", "library 403"] as const)(
  "omits Change template from a delayed 422 after %s",
  async (boundary) => {
    mocks.user = { id: "actor", isTenantOwner: true };
    mocks.libraryError = null;
    mocks.post.mockReset();
    mocks.get.mockReset();
    mocks.setOpen.mockClear();
    mocks.toast.errorFromApi.mockClear();
    const quoteScope = { tenantWide: false, companyIds: [quote.companyId], branchIds: [quote.branchId] };
    let rejectRender: (reason: unknown) => void = () => { throw new Error("Missing render request"); };
    mocks.post.mockImplementationOnce(() => new Promise((_resolve, reject) => { rejectRender = reject; }));
    const { result, rerender } = renderHook(() => useQuotationPdfWorkspace(quote, HEADERS, true));
    expect(result.current.canChangeTemplate).toBe(true);
    let pending: Promise<void> | undefined;
    act(() => { pending = result.current.render(); });
    expect(mocks.post).toHaveBeenCalledOnce();

    if (boundary === "revoked scope") {
      const user = { id: "actor", isTenantOwner: false, permissions: ["trade.quotations.read"],
        permissionScopes: { "trade.quotations.read": quoteScope } };
      mocks.user = user;
    } else {
      mocks.libraryError = { status: 403 };
    }
    rerender();
    expect(result.current.canChangeTemplate).toBe(false);
    const correlationId = "019f0000-0000-7000-8000-000000000090";
    try {
      await act(async () => {
        rejectRender(new TenantApiClientError("Template unavailable", {
          status: 422, statusText: "Unprocessable Entity", headers: new Headers(),
          data: { errorCode: "TRADE.QUOTE.PDF_TEMPLATE_INCOMPATIBLE", correlationId },
        }, "http"));
        await pending;
      });
      expect(result.current.writeErrorMessage).not.toContain(en.quotationPdf.templateLibraryCheck);
      expect(result.current.templateErrorReference).toBe(correlationId);
      expect(mocks.get).not.toHaveBeenCalled();
      expect(mocks.setOpen).not.toHaveBeenCalled();
      expect(mocks.toast.errorFromApi).toHaveBeenCalledOnce();
      expect(mocks.toast.errorFromApi.mock.calls[0]?.[1].message).not.toContain(en.quotationPdf.templateLibraryCheck);
    } finally {
      mocks.user = { id: "actor", isTenantOwner: true };
      mocks.libraryError = null;
    }
  },
);
