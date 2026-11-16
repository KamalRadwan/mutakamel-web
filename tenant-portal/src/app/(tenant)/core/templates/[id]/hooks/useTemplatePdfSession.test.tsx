// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, renderHook, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useTemplatePdfSession, type TemplatePdfSessionInput } from "./useTemplatePdfSession";
import type { AcceptedPdfPreview, PdfPreviewJob } from "../../template-preview-session-contract";
import { TemplatePdfPreviewBridge } from "../components/TemplatePdfPreviewBridge";
import { en } from "@/i18n/dictionaries/en";
import { ar } from "@/i18n/dictionaries/ar";
import { templatePreviewMessages } from "@/i18n/dictionaries/template-preview";

const io = vi.hoisted(() => ({ create: vi.fn(), read: vi.fn(), artifact: vi.fn(), auth: vi.fn(), session: vi.fn(), listener: vi.fn(), opened: vi.fn(), key: vi.fn(), navigate: vi.fn(), close: vi.fn(), i18n: vi.fn() }));
vi.mock("@/i18n/I18nContext", () => ({ useI18n: io.i18n }));
vi.mock("@/context/AuthContext", () => ({ useTenantAuth: io.auth }));
vi.mock("@/lib/api/axiosClient", () => ({ getStoredTenantSessionMeta: io.session }));
vi.mock("@/lib/auth/permission-scope", () => ({ can: () => true }));
vi.mock("@/lib/auth/sessionCoordinator", () => ({ subscribeToTenantAuthEvents: (callback: unknown) => { io.listener(callback); return () => undefined; } }));
vi.mock("@/lib/uuid", () => ({ generateUUIDv7: io.key }));
vi.mock("@/lib/api/errors", () => ({ normalizeApiError: (error: unknown) => error }));
vi.mock("../../template-preview-session-api", () => ({
  createPinnedPdfPreview: io.create, readPinnedPdfPreview: io.read, fetchPinnedPdfArtifact: io.artifact,
}));

const templateId = "01900100-0000-7000-8000-000000000001";
const draftId = "01900100-0000-7000-8000-000000000002";
const jobId = "01900100-0000-7000-8000-000000000003";
const accepted: AcceptedPdfPreview = { templateId, draftId, draftRevision: 3, templateContentChecksum: "a".repeat(64),
  compiledArtifactChecksum: "b".repeat(64), renderJobId: jobId, status: "PENDING",
  createdAt: "2026-11-10T10:00:00.000Z", expiresAt: "2026-11-10T10:15:00.000Z" };
const pending: PdfPreviewJob = { ...accepted, lifecycleRevision: 1, attemptCount: 0, artifact: null, nextRetryAt: null, failureCode: null };
const completed: PdfPreviewJob = { ...pending, status: "COMPLETED", lifecycleRevision: 2, attemptCount: 1,
  artifact: { downloadUrl: `/api/tenant/core/v1/templates/preview-jobs/${jobId}/artifact`,
    downloadUrlExpiresAt: "2026-11-10T11:00:00.000Z", checksum: "c".repeat(64), sizeBytes: 1200, pageCount: 2,
    rendererVersion: "renderer-1", browserBuildFingerprint: "chromium-pinned" } };
// Explicit source/unit fixture; it is never sent to a production owner or presented as an actual PDF.
const input: TemplatePdfSessionInput = {
  template: { id: templateId, dataSourceKey: "TRADE_QUOTATION_PRINT_V1", outputChannel: "PRINT", layoutMode: "HYBRID_DOCUMENT",
    code: "QUOTE", name: "Quotation", description: null, documentType: "QUOTATION", lifecycleStatus: "ACTIVE", direction: "LTR",
    systemProtected: false, definitionRevision: 2, definitionEtag: '"2"', etag: '"2"', currentPublishedVersion: null,
    draft: { draftId, revision: 3, validationState: "PASSED" }, createdAt: accepted.createdAt, updatedAt: accepted.createdAt,
    locale: "en-US", scope: { type: "TENANT" }, currentDraft: { draftId, revision: 3, contentChecksum: accepted.templateContentChecksum, validationState: "PASSED", etag: '"3"' } },
  draft: { templateId, draftId, revision: 3 },
  schema: { syntheticFixtures: [{ fixtureKey: "quotation-minimal-en", locale: "en-US" }] },
  canPreview: true, blocked: false, current: () => true, reload: () => undefined,
};
const nextDraft = { ...input.template.currentDraft, revision: 4, contentChecksum: "d".repeat(64), etag: '"4"' };
const nextRevision: TemplatePdfSessionInput = {
  ...input,
  template: { ...input.template, currentDraft: nextDraft },
  draft: { templateId, draftId, revision: nextDraft.revision },
};
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; }
beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(new Date("2026-11-10T10:01:00.000Z")); vi.clearAllMocks();
  io.i18n.mockReturnValue({ lang: "en", dir: "ltr", t: en });
  io.auth.mockReturnValue({ authState: "AUTHENTICATED", user: { id: "actor" }, realtimeAuthGeneration: "tenant:session:actor" });
  io.session.mockReturnValue({ sessionId: "session" }); io.key.mockReturnValue(jobId);
  io.create.mockResolvedValue(accepted); io.read.mockResolvedValue(pending);
  io.artifact.mockReset().mockResolvedValue(new Blob(["verified"], { type: "application/pdf" }));
  vi.stubGlobal("URL", class extends URL {
    static createObjectURL = vi.fn(() => "blob:verified");
    static revokeObjectURL = vi.fn();
  });
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
  vi.spyOn(window, "open").mockImplementation(io.opened); io.opened.mockReturnValue({ opener: null, location: { replace: io.navigate }, close: io.close });
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("pinned PDF session", () => {
  it.each([["en", en], ["ar", ar]] as const)("renders a safe terminal Core failure in %s without exposing raw Worker/provider diagnostics or receipt links", async (lang, dictionary) => {
    const privateDiagnostic = "WORKER.RENDER.PRIVATE_PROVIDER_DETAIL/object-key-secret";
    io.read.mockResolvedValue({ ...pending, status: "FAILED", lifecycleRevision: 2, nextRetryAt: null,
      artifact: null, failureCode: privateDiagnostic });
    io.i18n.mockReturnValue({ lang, dir: { en: "ltr", ar: "rtl" }[lang], t: dictionary });
    const copy = templatePreviewMessages[lang];
    render(<TemplatePdfPreviewBridge {...input} />);
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: copy.create })); });
    expect(screen.getByRole("alert")).toHaveTextContent(copy.draftFeedback.failed);
    expect(screen.queryByText(privateDiagnostic)).toBeNull();
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByRole("button", { name: copy.receipt })).toBeDisabled();
    expect(screen.getByRole("button", { name: copy.serverCancel })).toBeDisabled();
    expect(io.opened).not.toHaveBeenCalled();
  });
  it("keeps an authorized artifact usable after the input deadline without extending its actual expiry", async () => {
    vi.setSystemTime(new Date("2026-11-10T10:16:00.000Z")); io.read.mockResolvedValue(completed);
    const { result } = renderHook(() => useTemplatePdfSession(input));
    await act(async () => { await result.current.start(); });
    expect(result.current.status).toBe("completed");
    expect(result.current.job?.artifact?.downloadUrlExpiresAt).toBe(completed.artifact!.downloadUrlExpiresAt);
    await act(async () => { await result.current.download(); });
    expect(io.artifact).toHaveBeenCalledExactlyOnceWith(completed, expect.any(AbortSignal), expect.any(Function));
    expect(io.navigate).not.toHaveBeenCalled();
  });
  it.each([["en", en], ["ar", ar]] as const)("shows real zero-attempt retry metadata in %s without creating another render", async (lang, dictionary) => {
    const nextRetryAt = "2026-11-10T10:05:00.000Z";
    io.read.mockResolvedValue({ ...pending, status: "RETRYING", lifecycleRevision: 2, attemptCount: 0, nextRetryAt });
    io.i18n.mockReturnValue({ lang, dir: { en: "ltr", ar: "rtl" }[lang], t: dictionary });
    const copy = templatePreviewMessages[lang];
    render(<TemplatePdfPreviewBridge {...input} />);
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: copy.create })); });
    const locale = { en: "en-US", ar: "ar-EG-u-nu-latn" }[lang];
    expect(screen.getByText(`${copy.attempt}: ${new Intl.NumberFormat(locale).format(0)}`)).toBeTruthy();
    expect(screen.getByText(`${copy.nextRetry}: ${new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Cairo" }).format(new Date(nextRetryAt))}`)).toBeTruthy();
    expect(screen.queryByRole("button", { name: copy.download })).toBeNull();
    await act(async () => { await vi.advanceTimersByTimeAsync(4_000); });
    expect(io.create).toHaveBeenCalledTimes(1);
    expect(io.read).toHaveBeenCalledTimes(3);
    expect(screen.getByRole("button", { name: copy.create })).toBeDisabled();
    expect(screen.queryByRole("button", { name: copy.retry })).toBeNull();
  });
  it.each([
    { status: 404 }, { status: 503, code: "WORKER.RENDER.PUBLICATION_SCHEMA_UNAVAILABLE" },
  ])("keeps an unavailable dependency/resource on the same Core job %j", async refusal => {
    io.read.mockRejectedValueOnce(refusal).mockResolvedValue(pending);
    const { result } = renderHook(() => useTemplatePdfSession(input));
    await act(async () => { await result.current.start(); });
    expect(result.current.status).toBe("unavailable"); expect(result.current.canResume).toBe(true);
    expect(result.current.attempts).toBeNull(); expect(result.current.job).toBeNull();
    await act(async () => { await result.current.resume(); });
    expect(result.current.status).toBe("pending"); expect(result.current.attempts).toBe(0);
    expect(io.create).toHaveBeenCalledTimes(1); expect(io.opened).not.toHaveBeenCalled();
  });
  it("treats a create 404 as an unavailable resource without claiming a render failed", async () => {
    io.create.mockRejectedValue({ status: 404 });
    const { result } = renderHook(() => useTemplatePdfSession(input));
    await act(async () => { await result.current.start(); });
    expect(result.current.status).toBe("unavailable"); expect(result.current.canRefresh).toBe(true);
    expect(result.current.canCreate).toBe(false); expect(result.current.job).toBeNull();
  });
  it("deduplicates a double create and pauses after a bounded polling window", async () => {
    const { result } = renderHook(() => useTemplatePdfSession(input));
    await act(async () => { await Promise.all([result.current.start(), result.current.start()]); });
    expect(io.create).toHaveBeenCalledTimes(1);
    for (let index = 0; index < 59; index += 1) await act(async () => { await vi.advanceTimersByTimeAsync(2_000); });
    expect(result.current.status).toBe("paused"); expect(io.read).toHaveBeenCalledTimes(60);
    await act(async () => { await vi.advanceTimersByTimeAsync(10_000); });
    expect(io.read).toHaveBeenCalledTimes(60);
    io.read.mockResolvedValue(completed);
    await act(async () => { await result.current.resume(); });
    expect(result.current.status).toBe("completed"); expect(io.create).toHaveBeenCalledTimes(1);
  });
  it("pauses at the monitoring deadline during a slow read and resumes the same job", async () => {
    const delayed = deferred<PdfPreviewJob>();
    io.read.mockReturnValueOnce(delayed.promise).mockResolvedValue(completed);
    const { result } = renderHook(() => useTemplatePdfSession(input));
    let task!: Promise<void>;
    await act(async () => { task = result.current.start(); });
    const signal = io.read.mock.calls[0][1] as AbortSignal;

    await act(async () => { await vi.advanceTimersByTimeAsync(120_000); });
    expect(signal.aborted).toBe(true);
    expect(result.current.status).toBe("paused");
    expect(result.current.canResume).toBe(true);
    expect(result.current.job).toBeNull();

    await act(async () => { await result.current.resume(); });
    expect(io.read.mock.calls[1][0]).toBe(io.read.mock.calls[0][0]);
    expect(io.create).toHaveBeenCalledTimes(1);
    await act(async () => {
      delayed.resolve({ ...pending, status: "FAILED", lifecycleRevision: 2, failureCode: "LATE_FAILURE" });
      await task;
    });
    expect(result.current.status).toBe("completed");
    expect(result.current.job?.artifact).toEqual(completed.artifact);
  });
  it("retains exact body and key for an unknown create outcome", async () => {
    io.create.mockRejectedValueOnce({ status: 0 }).mockResolvedValue(accepted);
    const { result } = renderHook(() => useTemplatePdfSession(input));
    await act(async () => { await result.current.start(); });
    expect(result.current.status).toBe("unknown");
    const original = io.create.mock.calls[0];
    await act(async () => { await result.current.start(); });
    expect(io.create).toHaveBeenCalledTimes(1);
    await act(async () => { await result.current.recover(); });
    expect(io.create.mock.calls[1].slice(0, 3)).toEqual(original.slice(0, 3));
    expect(io.key).toHaveBeenCalledTimes(1);
  });
  it("shows a definitive validation rejection and permits a new explicit request", async () => {
    io.create.mockRejectedValueOnce({ status: 422, code: "CORE.TEMPLATE.PAGE.MISSING" }).mockResolvedValue(accepted);
    const { result } = renderHook(() => useTemplatePdfSession(input));
    await act(async () => { await result.current.start(); });
    expect(result.current.status).toBe("failed"); expect(result.current.canCreate).toBe(true);
    await act(async () => { await result.current.start(); }); expect(io.create).toHaveBeenCalledTimes(2);
  });
  it("offers reload after Core reports a stale revision and blocks another stale submission", async () => {
    const reload = vi.fn();
    const props = { ...input, reload };
    io.create.mockRejectedValue({ status: 409, code: "CORE.TEMPLATE.PREVIEW.SOURCE_STALE" });
    const { result } = renderHook(() => useTemplatePdfSession(props));
    await act(async () => { await result.current.start(); });
    expect(result.current.status).toBe("stale");
    expect(result.current.canCreate).toBe(false);
    expect(result.current.canChooseFixture).toBe(false);
    expect(result.current.canRefresh).toBe(true);
    await act(async () => { await result.current.start(); });
    expect(io.create).toHaveBeenCalledTimes(1);
    act(() => result.current.refresh());
    expect(reload).toHaveBeenCalledTimes(1);
  });
  it.each([
    ["en", en, "ltr", "Detailed quotation (Arabic)", "Reload saved revision"],
    ["ar", ar, "rtl", "عرض سعر تفصيلي (بالعربية)", "إعادة تحميل المراجعة المحفوظة"],
  ] as const)("localizes the Sales sample and stale recovery in %s while keeping the Arabic PDF source", async (lang, dictionary, dir, sampleLabel, action) => {
    const fixtureKey = "trade.quotation.rich.ar-EG.v1";
    const reload = vi.fn();
    const copy = templatePreviewMessages[lang];
    io.i18n.mockReturnValue({ lang, dir, t: dictionary });
    io.create.mockRejectedValue({ status: 409, code: "CORE.TEMPLATE.PREVIEW.SOURCE_STALE" });
    render(<TemplatePdfPreviewBridge {...input} reload={reload} template={{ ...input.template, locale: "ar-EG", direction: "RTL" }}
      schema={{ syntheticFixtures: [{ fixtureKey, locale: "ar-EG" }] }} />);

    expect(screen.getByRole("combobox", { name: copy.fixture })).toHaveTextContent(sampleLabel);
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: copy.create })); });
    expect(io.create.mock.calls[0][1]).toMatchObject({ fixtureKey, locale: "ar-EG" });
    expect(screen.getByRole("alert")).toHaveTextContent(copy.draftFeedback.stale);
    expect(screen.getByRole("alert")).toHaveTextContent(action);
    expect(screen.queryByRole("button", { name: copy.create })).toBeNull();
    expect(screen.queryByRole("button", { name: copy.retry })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: action }));
    expect(reload).toHaveBeenCalledOnce();
  });
  it.each([["en", en, "ltr"], ["ar", ar, "rtl"]] as const)("distinguishes loading, unavailable and empty sample descriptors in %s", (lang, dictionary, dir) => {
    const copy = templatePreviewMessages[lang];
    io.i18n.mockReturnValue({ lang, dir, t: dictionary });
    const props = { ...input, template: { ...input.template, locale: "ar-EG" as const, direction: "RTL" as const } };
    const view = (overrides?: Partial<TemplatePdfSessionInput>) => <div lang={lang} dir={dir}>
      <button type="button">{dictionary.common.back}</button>
      <TemplatePdfPreviewBridge {...props} {...overrides} />
    </div>;
    const { rerender } = render(view({ schema: null, preparation: "preparing" }));
    const outside = screen.getByRole("button", { name: dictionary.common.back });
    outside.focus();
    const panel = screen.getByRole("region", { name: copy.title });
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent(copy.draftFeedback.preparing);
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuetext", copy.draftFeedback.preparing);
    expect(screen.queryByRole("combobox")).toBeNull();
    expect(within(panel).queryByRole("button")).toBeNull();
    expect(screen.queryByText(copy.noFixture)).toBeNull();
    expect(outside).toHaveFocus();

    rerender(view({ schema: null }));
    expect(screen.getByRole("status")).toBe(status);
    expect(status).toHaveTextContent(copy.draftFeedback.samplesUnavailable);
    expect(screen.queryByRole("progressbar")).toBeNull();
    expect(screen.queryByRole("combobox")).toBeNull();
    expect(within(panel).queryByRole("button")).toBeNull();
    expect(outside).toHaveFocus();

    rerender(view());
    expect(screen.getByRole("status")).toBe(status);
    expect(status).toHaveTextContent(copy.noFixture);
    expect(screen.getByRole("combobox", { name: copy.fixture })).toBeDisabled();
    expect(screen.getByRole("button", { name: copy.create })).toBeDisabled();
    expect(outside).toHaveFocus();
    expect(io.create).not.toHaveBeenCalled();
  });
  it.each([["en", en, "ltr"], ["ar", ar, "rtl"]] as const)("announces Core's denial and recovers keyboard focus in %s", async (lang, dictionary, dir) => {
    const copy = templatePreviewMessages[lang];
    io.i18n.mockReturnValue({ lang, dir, t: dictionary });
    io.create.mockRejectedValue({ status: 403 });
    render(<div lang={lang} dir={dir}><TemplatePdfPreviewBridge {...input} /></div>);
    const create = screen.getByRole("button", { name: copy.create });
    create.focus();
    expect(create).toHaveFocus();
    await act(async () => { fireEvent.click(create); });
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent(dictionary.permissionGate.title);
    expect(alert).toHaveTextContent(dictionary.permissionGate.description);
    expect(screen.getByRole("region", { name: copy.title })).toHaveFocus();
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByRole("combobox")).toBeNull();
    expect(screen.queryByText(copy.boundaries)).toBeNull();
    expect(io.read).not.toHaveBeenCalled();
  });
  it.each([["en", en, "ltr"], ["ar", ar, "rtl"]] as const)("explains how to resume the same Sales PDF request in %s", async (lang, dictionary, dir) => {
    const copy = templatePreviewMessages[lang];
    io.i18n.mockReturnValue({ lang, dir, t: dictionary });
    io.read.mockRejectedValueOnce({ status: 503 }).mockResolvedValue(pending);
    render(<TemplatePdfPreviewBridge {...input} />);
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: copy.create })); });
    expect(screen.getByRole("alert")).toHaveTextContent(copy.draftFeedback.resumeUnavailable);
    expect(screen.queryByRole("button", { name: copy.refresh })).toBeNull();

    await act(async () => { fireEvent.click(screen.getByRole("button", { name: copy.resume })); });
    expect(io.read.mock.calls[1][0]).toBe(io.read.mock.calls[0][0]);
    expect(io.create).toHaveBeenCalledOnce();
  });
  it.each(["FIXED_CANVAS", "FLOW_DOCUMENT", "EMAIL_FLOW"])("keeps unsupported %s unavailable without fallback", async layoutMode => {
    const props = { ...input, template: { ...input.template, layoutMode } };
    const { result } = renderHook(() => useTemplatePdfSession(props));
    expect(result.current.status).toBe("unsupported"); expect(result.current.canCreate).toBe(false);
    await act(async () => { await result.current.start(); }); expect(io.create).not.toHaveBeenCalled();
    render(<TemplatePdfPreviewBridge {...props} />);
    expect(screen.getByRole("status")).toHaveTextContent(templatePreviewMessages.en.draftFeedback.unsupported);
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByRole("combobox")).toBeNull();
  });
  it.each(["FIXED_CANVAS", "FLOW_DOCUMENT", "HYBRID_DOCUMENT"])("polls the exact pinned draft through completion for the %s quotation enabled by Core", async layoutMode => {
    io.read.mockResolvedValueOnce(pending).mockResolvedValueOnce(completed);
    const { result } = renderHook(() => useTemplatePdfSession({ ...input, template: {
      ...input.template, layoutMode, previewPdf: { state: "ENABLED", reason: null },
    } }));
    expect(result.current.canCreate).toBe(true);
    await act(async () => { await result.current.start(); });
    expect(io.create).toHaveBeenCalledWith(expect.objectContaining({ templateId, draftId, draftRevision: 3 }),
      expect.objectContaining({ source: { kind: "DRAFT", draftRevision: 3 } }), jobId, expect.any(AbortSignal));
    expect(result.current.status).toBe("pending");
    await act(async () => { await vi.advanceTimersByTimeAsync(2_000); });
    expect(result.current.status).toBe("completed");
    expect(result.current.job?.artifact).toEqual(completed.artifact);
    expect(io.create).toHaveBeenCalledTimes(1);
  });
  it("does not issue a request for Fixed when Core withholds the capability", async () => {
    const { result } = renderHook(() => useTemplatePdfSession({ ...input, template: {
      ...input.template, layoutMode: "FIXED_CANVAS", previewPdf: { state: "HIDDEN", reason: null },
    } }));
    expect(result.current.canCreate).toBe(false);
    await act(async () => { await result.current.start(); });
    expect(io.create).not.toHaveBeenCalled();
  });
  it.each([
    { title: "enabled Purchase draft", enabled: true, dataSourceKey: "TRADE_PURCHASE_QUOTATION_PRINT_V1", canCreate: true },
    { title: "Purchase draft without a capability", enabled: false, dataSourceKey: "TRADE_PURCHASE_QUOTATION_PRINT_V1", canCreate: false },
    { title: "Purchase draft paired with the Sales adapter", enabled: true, dataSourceKey: "TRADE_QUOTATION_PRINT_V1", canCreate: false },
  ] as const)("checks capability and source for $title", async ({ enabled, dataSourceKey, canCreate }) => {
    const fixtureKey = "trade.purchase-quotation.standard.en-US.v1";
    const { result } = renderHook(() => useTemplatePdfSession({ ...input,
      template: { ...input.template, documentType: "PURCHASE_QUOTATION", dataSourceKey,
        previewPdf: enabled ? { state: "ENABLED", reason: null } : undefined },
      schema: { syntheticFixtures: [{ fixtureKey, locale: "en-US" }] },
    }));

    expect(result.current.canCreate).toBe(canCreate);
    await act(async () => { await result.current.start(); });
    if (canCreate) {
      expect(io.create).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ templateId, draftId, draftRevision: 3 }),
        { source: { kind: "DRAFT", draftRevision: 3 }, fixtureKey, locale: "en-US", timeZone: "Africa/Cairo" },
        jobId, expect.any(AbortSignal));
    } else {
      expect(io.create).not.toHaveBeenCalled();
    }
  });
  it("does not turn local stop into server cancellation or accept its late response", async () => {
    const delayed = deferred<PdfPreviewJob>(); io.read.mockReturnValueOnce(delayed.promise);
    const { result } = renderHook(() => useTemplatePdfSession(input));
    let task!: Promise<void>;
    await act(async () => { task = result.current.start(); });
    act(() => result.current.stop()); expect(result.current.status).toBe("stopped");
    await act(async () => { delayed.resolve(completed); await task; });
    expect(result.current.status).toBe("stopped"); expect(result.current.job).toBeNull();
    io.read.mockResolvedValue(completed);
    await act(async () => { await result.current.resume(); });
    expect(result.current.status).toBe("completed"); expect(io.create).toHaveBeenCalledTimes(1);
  });
  it.each(["revision", "actor", "blocked", "permission"])("retires late content after %s changes", async change => {
    const delayed = deferred<AcceptedPdfPreview>(); io.create.mockReturnValue(delayed.promise);
    let props = input;
    const { result, rerender } = renderHook(() => useTemplatePdfSession(props));
    let task!: Promise<void>;
    await act(async () => { task = result.current.start(); });
    if (change === "revision") props = { ...input, template: { ...input.template, currentDraft: { ...input.template.currentDraft, revision: 4 } } };
    if (change === "actor") io.auth.mockReturnValue({ authState: "AUTHENTICATED", user: { id: "other" }, realtimeAuthGeneration: "tenant:session:other" });
    if (change === "blocked") props = { ...input, blocked: true };
    if (change === "permission") props = { ...input, canPreview: false };
    rerender();
    await act(async () => { delayed.resolve(accepted); await task; });
    expect(result.current.job).toBeNull(); expect(io.read).not.toHaveBeenCalled();
    expect(io.opened).not.toHaveBeenCalled();
  });
  it("clears pending announcements on a revision change and downloads only the new revision", async () => {
    const copy = templatePreviewMessages.en;
    const delayed = deferred<PdfPreviewJob>();
    const nextJobId = "01900100-0000-7000-8000-000000000004";
    const nextPin = { draftRevision: nextDraft.revision, templateContentChecksum: nextDraft.contentChecksum, renderJobId: nextJobId };
    const nextAccepted = { ...accepted, ...nextPin };
    const nextArtifact = { ...completed.artifact!, downloadUrl: `/api/tenant/core/v1/templates/preview-jobs/${nextJobId}/artifact` };
    io.key.mockReturnValueOnce(jobId).mockReturnValueOnce(nextJobId);
    io.create.mockResolvedValueOnce(accepted).mockResolvedValueOnce(nextAccepted);
    io.read.mockReturnValueOnce(delayed.promise).mockResolvedValue({ ...completed, ...nextPin, artifact: nextArtifact });
    const { rerender } = render(<TemplatePdfPreviewBridge {...input} />);
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: copy.create })); });
    expect(screen.getByRole("status")).toHaveTextContent(copy.draftFeedback.pending);
    const signal = io.read.mock.calls[0][1] as AbortSignal;

    rerender(<TemplatePdfPreviewBridge {...nextRevision} />);
    expect(signal.aborted).toBe(true);
    await act(async () => { delayed.resolve(completed); await vi.advanceTimersByTimeAsync(120_000); });
    expect(io.read).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("status")).toHaveTextContent(copy.states.idle);
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByRole("progressbar")).toBeNull();
    expect(screen.queryByRole("button", { name: copy.download })).toBeNull();

    await act(async () => { fireEvent.click(screen.getByRole("button", { name: copy.create })); });
    expect(io.create).toHaveBeenLastCalledWith(expect.objectContaining({ templateId, draftId,
      draftRevision: nextDraft.revision, templateContentChecksum: nextDraft.contentChecksum }),
      expect.objectContaining({ source: { kind: "DRAFT", draftRevision: nextDraft.revision } }), nextJobId, expect.any(AbortSignal));
    expect(screen.getByRole("status")).toHaveTextContent(copy.states.completed);
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: copy.download })); });
    expect(io.read).toHaveBeenLastCalledWith(nextAccepted, expect.any(AbortSignal));
    expect(io.artifact).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ artifact: nextArtifact }), expect.any(AbortSignal), expect.any(Function));
    expect(io.navigate).not.toHaveBeenCalled();
  });
  it("discards pending state and ignores retirement callbacks from a replaced host subscription", async () => {
    const oldRetirement = vi.fn<(retire: () => void) => () => void>(() => () => undefined);
    const newRetirement = vi.fn<(retire: () => void) => () => void>(() => () => undefined);
    const { result, rerender } = renderHook(useTemplatePdfSession, { initialProps: { ...input, subscribeRetirement: oldRetirement } });
    await act(async () => { await result.current.start(); });
    expect(result.current.status).toBe("pending");
    rerender({ ...input, subscribeRetirement: newRetirement });
    act(() => oldRetirement.mock.lastCall?.[0]());
    await act(async () => { await vi.advanceTimersByTimeAsync(120_000); });
    expect(io.read).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe("idle");
    expect(result.current.canCreate).toBe(true);
  });
  it("retires immediately on a same-session end event", async () => {
    io.read.mockResolvedValue(completed);
    const { result } = renderHook(() => useTemplatePdfSession(input));
    await act(async () => { await result.current.start(); });
    const callback = io.listener.mock.lastCall?.[0];
    act(() => callback({ kind: "session-ended", sessionId: "session" }));
    expect(result.current.status).toBe("denied"); expect(result.current.job).toBeNull();
    await act(async () => { await result.current.download(); }); expect(io.opened).not.toHaveBeenCalled();
  });
  it("preflights current access and keeps the actual owner filename", async () => {
    io.read.mockResolvedValue(completed);
    const { result } = renderHook(() => useTemplatePdfSession(input));
    await act(async () => { await result.current.start(); });
    expect(result.current.filename).toBe(`template-preview-${jobId}.pdf`);
    await act(async () => { await result.current.download(); });
    expect(io.read).toHaveBeenCalledTimes(1);
    expect(io.opened).toHaveBeenCalledWith("about:blank", "_blank");
    expect(io.artifact).toHaveBeenCalledExactlyOnceWith(completed, expect.any(AbortSignal), expect.any(Function));
    expect(io.navigate).not.toHaveBeenCalled();
  });
  it.each([
    [{ status: 403 }, "denied"], [{ status: 410, code: "CORE.TEMPLATE.PREVIEW.ARTIFACT_EXPIRED" }, "expired"],
    [{ status: 409, code: "CORE.TEMPLATE.PREVIEW.SOURCE_STALE" }, "stale"],
  ])("withholds download on current owner refusal %j", async (error, state) => {
    io.read.mockResolvedValue(completed);
    io.artifact.mockRejectedValue(error);
    const { result } = renderHook(() => useTemplatePdfSession(input));
    await act(async () => { await result.current.start(); });
    await act(async () => { await result.current.download(); });
    expect(result.current.status).toBe(state); expect(result.current.job).toBeNull(); expect(io.navigate).not.toHaveBeenCalled();
    expect(io.close).toHaveBeenCalledTimes(1);
  });
  it("expires an idle completed output without waiting for a click", async () => {
    io.read.mockResolvedValue({ ...completed, artifact: { ...completed.artifact!, downloadUrlExpiresAt: "2026-11-10T10:01:01.000Z" } });
    const { result } = renderHook(() => useTemplatePdfSession(input));
    await act(async () => { await result.current.start(); });
    await act(async () => { await vi.advanceTimersByTimeAsync(1_001); });
    expect(result.current.status).toBe("expired"); expect(result.current.job).toBeNull(); expect(io.opened).not.toHaveBeenCalled();
  });
  it.each(["en", "ar"] as const)("discards verified bytes when the %s draft artifact expires during download", async language => {
    io.i18n.mockReturnValue({ lang: language, dir: { en: "ltr", ar: "rtl" }[language], t: { en, ar }[language] });
    const delayed = deferred<Blob>();
    io.read.mockResolvedValue(completed);
    io.artifact.mockReturnValueOnce(delayed.promise);
    const { result } = renderHook(() => useTemplatePdfSession(input));
    await act(async () => { await result.current.start(); });
    let task!: Promise<void>;
    await act(async () => { task = result.current.download(); });
    vi.setSystemTime(new Date(completed.artifact!.downloadUrlExpiresAt));
    await act(async () => { delayed.resolve(new Blob()); await task; });
    expect(result.current.status).toBe("expired");
    expect(io.close).toHaveBeenCalledOnce();
    expect(URL.createObjectURL).not.toHaveBeenCalled();
    expect(HTMLAnchorElement.prototype.click).not.toHaveBeenCalled();
  });
  it("refuses silent transport session replacement and owner predicate retirement", async () => {
    io.read.mockResolvedValue(completed);
    let ready = true;
    const { result } = renderHook(() => useTemplatePdfSession({ ...input, current: () => ready }));
    await act(async () => { await result.current.start(); });
    io.session.mockReturnValue({ sessionId: "replacement" });
    await act(async () => { await result.current.download(); });
    io.session.mockReturnValue({ sessionId: "session" }); ready = false;
    await act(async () => { await result.current.download(); }); expect(io.opened).not.toHaveBeenCalled();
    expect(result.current.status).toBe("denied"); expect(result.current.job).toBeNull();
  });
  it.each([
    ["session end", "en"], ["revision change", "en"], ["revision change", "ar"],
  ] as const)("closes a preallocated download window immediately on %s in %s", async (change, language) => {
    io.i18n.mockReturnValue({ lang: language, dir: { en: "ltr", ar: "rtl" }[language], t: { en, ar }[language] });
    const delayed = deferred<Blob>();
    io.read.mockResolvedValue(completed);
    io.artifact.mockReturnValueOnce(delayed.promise);
    const { result, rerender } = renderHook(useTemplatePdfSession, { initialProps: input });
    await act(async () => { await result.current.start(); });
    let task!: Promise<void>;
    await act(async () => { task = result.current.download(); });
    if (change === "session end") act(() => io.listener.mock.lastCall?.[0]({ kind: "session-ended", sessionId: "session" }));
    else rerender(nextRevision);
    expect(io.close).toHaveBeenCalledTimes(1);
    expect((io.artifact.mock.calls[0][1] as AbortSignal).aborted).toBe(true);
    await act(async () => { delayed.resolve(new Blob()); await task; });
    expect(io.navigate).not.toHaveBeenCalled(); expect(io.close).toHaveBeenCalledTimes(1);
    expect(HTMLAnchorElement.prototype.click).not.toHaveBeenCalled();
  });
  it("withholds mutated completed bytes and handles a blocked popup", async () => {
    io.read.mockResolvedValue(completed);
    io.artifact.mockRejectedValue(new Error("Invalid Core identity response."));
    const { result } = renderHook(() => useTemplatePdfSession(input));
    await act(async () => { await result.current.start(); });
    io.opened.mockReturnValueOnce(null);
    await act(async () => { await result.current.download(); });
    expect(result.current.status).toBe("popup"); expect(io.read).toHaveBeenCalledTimes(1);
    expect(io.artifact).not.toHaveBeenCalled();
    await act(async () => { await result.current.download(); });
    expect(result.current.status).toBe("invalid"); expect(io.navigate).not.toHaveBeenCalled();
  });
  it.each([["en", en], ["ar", ar]] as const)("renders actionable progress and unavailable native outputs in %s", async (lang, dictionary) => {
    const copy = templatePreviewMessages[lang];
    io.i18n.mockReturnValue({ lang, dir: { en: "ltr", ar: "rtl" }[lang], t: dictionary });
    render(<TemplatePdfPreviewBridge {...input} />);
    expect(screen.getByRole("button", { name: copy.print })).toBeDisabled();
    expect(screen.getByRole("button", { name: copy.receipt })).toBeDisabled();
    expect(screen.getByRole("button", { name: copy.thumbnail })).toBeDisabled();
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: copy.create })); });
    expect(screen.getByRole("progressbar", { name: copy.title })).not.toHaveAttribute("aria-valuenow");
    act(() => fireEvent.click(screen.getByRole("button", { name: copy.stop })));
    expect(screen.getByRole("status")).toHaveTextContent(copy.states.stopped);
    expect(screen.queryByRole("progressbar")).toBeNull();
    io.read.mockResolvedValue(completed);
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: copy.resume })); });
    expect(screen.getByRole("button", { name: copy.download })).toBeEnabled();
    expect(screen.getByText(`template-preview-${jobId}.pdf`)).toHaveAttribute("dir", "ltr");
  });
});
