// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useTemplateDesignPdfPort, type TemplateDesignPdfPortInput } from "./useTemplateDesignPdfPort";
import { TemplateDesignPdfPort } from "../components/TemplateDesignPdfPort";
import { parsePdfPreviewJob, type AcceptedPdfPreview } from "../../template-preview-session-contract";
import { currentPreviewCapabilities } from "../../template-preview-availability";
import { en } from "@/i18n/dictionaries/en";
import { templatePreviewMessages } from "@/i18n/dictionaries/template-preview";
import { createDesignerCommandStore } from "../../designer-command-store";
import { createDesignerLocalSessions } from "../../designer-local-sessions";
import { useTemplatePdfSession } from "./useTemplatePdfSession";
import type { PdfPreviewJob } from "../../template-preview-session-contract";
import { createDesignerInteractionExit } from "../../designer-interaction-exit";
import { TemplateDetailPdfPort } from "../components/TemplateDetailPdfPort";
import { useTemplateDetailPdfPort } from "./useTemplateDetailPdfPort";

const io = vi.hoisted(() => ({ detail: vi.fn(), create: vi.fn(), read: vi.fn(), artifact: vi.fn(), auth: vi.fn(), session: vi.fn(), listen: vi.fn(), reload: vi.fn(), schema: vi.fn() }));
vi.mock("../../templates-api", () => ({ fetchTemplate: io.detail }));
vi.mock("../../template-design-api", () => ({ fetchTemplateDataSchema: io.schema }));
vi.mock("../../template-preview-session-api", () => ({
  createPinnedPdfPreview: io.create, readPinnedPdfPreview: io.read, fetchPinnedPdfArtifact: io.artifact,
}));
vi.mock("@/context/AuthContext", () => ({ useTenantAuth: io.auth }));
vi.mock("@/lib/api/axiosClient", () => ({ getStoredTenantSessionMeta: io.session }));
vi.mock("@/lib/auth/permission-scope", () => ({ can: () => true }));
vi.mock("@/lib/auth/sessionCoordinator", () => ({ subscribeToTenantAuthEvents: (callback: unknown) => { io.listen(callback); return () => undefined; } }));
vi.mock("@/lib/api/errors", () => ({ normalizeApiError: (error: unknown) => error }));
vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ lang: "en", dir: "ltr", t: en }) }));
const id = "01900100-0000-7000-8000-000000000001";
const draftId = "01900100-0000-7000-8000-000000000002";
const oldDetail: TemplateDesignPdfPortInput["template"] = {
  id, code: "QUOTE", name: "Quotation", description: null, documentType: "QUOTATION", outputChannel: "PRINT",
  layoutMode: "HYBRID_DOCUMENT", lifecycleStatus: "ACTIVE", locale: "en-US", direction: "LTR", dataSourceKey: "TRADE_QUOTATION_PRINT_V1",
  scope: { type: "TENANT" }, systemProtected: false, definitionRevision: 2, definitionEtag: '"2"', etag: '"2"',
  draft: { draftId, revision: 3, validationState: "PASSED" }, currentPublishedVersion: null,
  currentDraft: { draftId, revision: 3, validationState: "PASSED", contentChecksum: "a".repeat(64), etag: '"3"' },
  createdAt: "2026-11-10T10:00:00.000Z", updatedAt: "2026-11-10T10:00:00.000Z",
};
const freshDetail = { ...oldDetail, currentDraft: { ...oldDetail.currentDraft, revision: 4, contentChecksum: "b".repeat(64), etag: '"4"' } };
const commandStore = createDesignerCommandStore(), localSessions = createDesignerLocalSessions("test-designer-owner");
function actualExit(store: ReturnType<typeof createDesignerCommandStore>) {
  return createDesignerInteractionExit({ bridgeKey:"test-designer-owner",generation:store.getSnapshot().generation },
    () => ({ bridgeKey:"test-designer-owner",generation:store.getSnapshot().generation }));
}
let fixtureExit = actualExit(commandStore);
const base: TemplateDesignPdfPortInput = { template: oldDetail, canPreview: true, reload: io.reload, editor: {
  draft: { templateId: id, draftId, revision: 4, etag: '"4"', editorDocument: { schemaVersion: 1, rootNodeIds: [], nodes: {}, theme: {}, direction: "LTR" } },
  schema: { syntheticFixtures: [{ fixtureKey: "quotation-minimal-en", locale: "en-US" }] },
  loading: false, dirty: false, hasPending: false, conflict: false, gestureActive: false, isCurrentAuthority: () => true,
  commandStore, localSessions, localPending: false, localSessionEpoch: 0,
  get interactionExit() {
    if(fixtureExit.ticket.generation!==commandStore.getSnapshot().generation) fixtureExit=actualExit(commandStore);
    return fixtureExit;
  },
  interactionBridge: { context: () => ({ key: "test-designer-owner", canRead: true }) },
} };
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; }
beforeEach(() => {
  vi.clearAllMocks();
  io.auth.mockReturnValue({ authState: "AUTHENTICATED", user: { id: "actor", permissions: ["templates.preview"] }, realtimeAuthGeneration: "tenant:session:actor" });
  io.session.mockReturnValue({ sessionId: "session" }); io.detail.mockResolvedValue(freshDetail);
  io.schema.mockResolvedValue({syntheticFixtures:[{fixtureKey:"quotation-minimal-en",locale:"en-US"}]});
  commandStore.reset(base.editor.draft!.editorDocument); localSessions.dispose();
});
afterEach(() => cleanup());

describe("T01 current-saved-draft preview port", () => {
  it("mounts the genuine detail session panel and localizes an actual Core Worker failure code", async () => {
    const descriptor = deferred<NonNullable<TemplateDesignPdfPortInput["editor"]["schema"]>>();
    io.schema.mockReturnValueOnce(descriptor.promise);
    io.create.mockResolvedValue(acceptedJob());
    io.read.mockResolvedValue({...acceptedJob(),status:"FAILED",lifecycleRevision:2,attemptCount:0,
      artifact:null,nextRetryAt:null,failureCode:"WORKER.RENDER.PUBLICATION_SCHEMA_UNAVAILABLE"});
    const copy=templatePreviewMessages.en;
    const { rerender } = render(<TemplateDetailPdfPort template={freshDetail} canPreview={false} reload={io.reload}/>);
    expect(screen.getByText(en.permissionGate.title)).toBeVisible();
    expect(screen.queryByRole("button")).toBeNull();
    expect(io.detail).not.toHaveBeenCalled();

    rerender(<TemplateDetailPdfPort template={freshDetail} canPreview reload={io.reload}/>);
    await waitFor(() => expect(io.schema).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("status")).toHaveTextContent(copy.draftFeedback.preparing);
    expect(screen.queryByRole("combobox")).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
    await act(async () => { descriptor.resolve(base.editor.schema!); });
    await waitFor(()=>expect(screen.getByRole("button",{name:copy.create})).toBeEnabled());
    await act(async()=>{fireEvent.click(screen.getByRole("button",{name:copy.create}));});
    expect(screen.getByRole("alert")).toHaveTextContent(copy.draftFeedback.failed);
    expect(screen.queryByText("WORKER.RENDER.PUBLICATION_SCHEMA_UNAVAILABLE")).toBeNull();
    expect(screen.getByRole("button",{name:copy.receipt})).toBeDisabled();
    expect(screen.getByRole("button",{name:copy.serverCancel})).toBeDisabled();
    expect(io.detail).toHaveBeenCalledTimes(1);expect(io.schema).toHaveBeenCalledTimes(1);
  });
  it("retires detail preview metadata on a route source revision replacement", async()=>{
    const delayed=deferred<typeof freshDetail>();
    const replacement={...freshDetail,currentDraft:{...freshDetail.currentDraft,revision:5,etag:'"5"',contentChecksum:"d".repeat(64)}};
    io.detail.mockReturnValueOnce(delayed.promise).mockResolvedValue(replacement);
    const {result,rerender}=renderHook(({template})=>useTemplateDetailPdfPort({template,canPreview:true,reload:io.reload}),
      {initialProps:{template:freshDetail}});
    await waitFor(()=>expect(io.detail).toHaveBeenCalledTimes(1));
    const oldSignal=io.detail.mock.calls[0][1] as AbortSignal;
    rerender({template:replacement});expect(oldSignal.aborted).toBe(true);
    await waitFor(()=>expect(result.current.preparation).toBeUndefined());
    await act(async()=>{delayed.resolve(freshDetail);});
    expect(result.current.draft?.revision).toBe(5);expect(result.current.template.currentDraft.contentChecksum).toBe("d".repeat(64));
    expect(io.schema).toHaveBeenCalledTimes(1);
  });
  it("retires a definition read on same-revision document generation replacement", async () => {
    const delayed = deferred<typeof freshDetail>(); io.detail.mockReturnValueOnce(delayed.promise).mockResolvedValue(freshDetail);
    const { result } = renderHook(() => useTemplateDesignPdfPort(base));
    await waitFor(() => expect(io.detail).toHaveBeenCalledTimes(1));
    const oldSignal = io.detail.mock.calls[0][1] as AbortSignal, oldLifetime = result.current.lifetime;
    act(() => commandStore.reset(base.editor.draft!.editorDocument));
    expect(oldSignal.aborted).toBe(true);
    await waitFor(() => expect(result.current.preparation).toBeUndefined());
    expect(result.current.lifetime).not.toBe(oldLifetime);
    await act(async () => { delayed.resolve({ ...freshDetail, currentDraft: { ...freshDetail.currentDraft, contentChecksum: "c".repeat(64) } }); });
    expect(result.current.template.currentDraft.contentChecksum).toBe("b".repeat(64));
  });
  it("aborts an old create before its result can attach to the newly opened design", async () => {
    const delayed = deferred<AcceptedPdfPreview>(); io.create.mockReturnValue(delayed.promise);
    const { result } = renderHook(() => useTemplatePdfSession(useTemplateDesignPdfPort(base)));
    await waitFor(() => expect(result.current.canCreate).toBe(true));
    let task!: Promise<void>;
    await act(async () => { task = result.current.start(); });
    const signal = io.create.mock.calls[0][3] as AbortSignal;
    act(() => commandStore.reset(base.editor.draft!.editorDocument));
    expect(signal.aborted).toBe(true);
    await act(async () => { delayed.resolve(acceptedJob()); await task; });
    await waitFor(() => expect(result.current.canCreate).toBe(true));
    expect(result.current.job).toBeNull(); expect(io.read).not.toHaveBeenCalled(); expect(io.create).toHaveBeenCalledTimes(1);
  });
  it("closes the download window when the canonical generation changes during artifact verification", async () => {
    const done: PdfPreviewJob = { ...acceptedJob(), status: "COMPLETED", lifecycleRevision: 2, attemptCount: 1, nextRetryAt: null, failureCode: null,
      artifact: { downloadUrl: `/api/tenant/core/v1/templates/preview-jobs/${id}/artifact`, checksum: "c".repeat(64), sizeBytes: 1000, pageCount: 1,
        rendererVersion: "renderer-1", browserBuildFingerprint: "browser-pinned", downloadUrlExpiresAt: "2099-01-01T00:00:00.000Z" } };
    const delayed = deferred<Blob>(), navigate = vi.fn(), close = vi.fn();
    const open = vi.spyOn(window,"open").mockReturnValue({ opener: null, location: { replace: navigate }, close } as unknown as Window);
    io.create.mockResolvedValue(acceptedJob()); io.read.mockResolvedValueOnce(done); io.artifact.mockReturnValueOnce(delayed.promise);
    const { result } = renderHook(() => useTemplatePdfSession(useTemplateDesignPdfPort(base)));
    await waitFor(() => expect(result.current.canCreate).toBe(true));
    await act(async () => { await result.current.start(); });
    let task!: Promise<void>; await act(async () => { task = result.current.download(); });
    act(() => commandStore.markSaved(base.editor.draft!.editorDocument));
    expect((io.artifact.mock.calls[0][1] as AbortSignal).aborted).toBe(true);
    await act(async () => { delayed.resolve(new Blob()); await task; });
    expect(navigate).not.toHaveBeenCalled(); expect(close).toHaveBeenCalledTimes(1); expect(result.current.job).toBeNull(); open.mockRestore();
  });
  it("blocks pending local input and retires create I/O without cancelling the editor's gesture or server job", async () => {
    const delayed = deferred<AcceptedPdfPreview>(); io.create.mockReturnValue(delayed.promise);
    const cancel = vi.spyOn(commandStore,"cancelGesture");
    const cancelAll = vi.spyOn(base.editor.interactionExit,"cancelAllCurrent");
    const { result } = renderHook(() => useTemplatePdfSession(useTemplateDesignPdfPort(base)));
    await waitFor(() => expect(result.current.canCreate).toBe(true));
    let task!: Promise<void>; await act(async () => { task = result.current.start(); });
    const reporter = localSessions.reporter("inspector");
    act(() => reporter.report(localSessions.ownerKey,true));
    expect((io.create.mock.calls[0][3] as AbortSignal).aborted).toBe(true);
    expect(result.current.status).toBe("blocked");
    await act(async () => { delayed.resolve(acceptedJob()); await task; });
    expect(result.current.job).toBeNull(); expect(io.read).not.toHaveBeenCalled(); expect(cancel).not.toHaveBeenCalled();
    expect(cancelAll).not.toHaveBeenCalled();
    act(() => reporter.dispose()); cancel.mockRestore(); cancelAll.mockRestore();
  });
  it("retirements distinguish a replacement command store even at the same generation and revision", async () => {
    const delayed = deferred<AcceptedPdfPreview>(); io.create.mockReturnValue(delayed.promise);
    const { result, rerender } = renderHook(({props}) => useTemplatePdfSession(useTemplateDesignPdfPort(props)), {initialProps:{props:base}});
    await waitFor(() => expect(result.current.canCreate).toBe(true));
    let task!: Promise<void>; await act(async () => { task = result.current.start(); });
    const replacement = createDesignerCommandStore();
    while (replacement.getSnapshot().generation < commandStore.getSnapshot().generation) replacement.reset(base.editor.draft!.editorDocument);
    rerender({props:{...base,editor:{...base.editor,commandStore:replacement,interactionExit:actualExit(replacement)}}});
    expect((io.create.mock.calls[0][3] as AbortSignal).aborted).toBe(true);
    await act(async () => { delayed.resolve(acceptedJob()); await task; });
    expect(result.current.job).toBeNull(); expect(io.read).not.toHaveBeenCalled();
  });
  it("refreshes the actual definition pin after save while the route prop still has the old revision", async () => {
    const { result } = renderHook(() => useTemplateDesignPdfPort(base));
    await waitFor(() => expect(result.current.preparation).toBeUndefined());
    expect(io.detail).toHaveBeenCalledWith(id, expect.any(AbortSignal));
    expect(result.current.template.currentDraft).toEqual(freshDetail.currentDraft);
    expect(result.current.draft).toBe(base.editor.draft); expect(result.current.current()).toBe(true);
    expect(oldDetail.currentDraft.revision).toBe(3);
  });
  it("withholds a server draft revision ahead of the loaded editor and invokes the parent's reload guard", async () => {
    io.detail.mockResolvedValue({ ...freshDetail, currentDraft: { ...freshDetail.currentDraft, revision: 5, etag: '"5"' } });
    const { result } = renderHook(() => useTemplateDesignPdfPort(base));
    await waitFor(() => expect(result.current.preparation).toBe("stale"));
    expect(result.current.template).toBe(oldDetail);
    act(() => result.current.reload()); expect(io.reload).toHaveBeenCalledTimes(1);
  });
  it.each([
    { scope: { type: "COMPANY" as const, companyId: id } }, { locale: "ar-EG" }, { layoutMode: "FIXED_CANVAS" },
    { currentDraft: { ...freshDetail.currentDraft, contentChecksum: "missing-proof" } },
  ])("withholds mismatched definition/scope/checksum %j", async mutation => {
    io.detail.mockResolvedValue({ ...freshDetail, ...mutation });
    const { result } = renderHook(() => useTemplateDesignPdfPort(base));
    await waitFor(() => expect(result.current.preparation).toBe("invalid"));
    expect(result.current.template).toBe(oldDetail);
  });
  it("aborts a late definition read when T01 enters an unresolved save and never adopts its content", async () => {
    const delayed = deferred<typeof freshDetail>(); io.detail.mockReturnValue(delayed.promise);
    const { result, rerender } = renderHook(({ props }) => useTemplateDesignPdfPort(props), { initialProps: { props: base } });
    await waitFor(() => expect(io.detail).toHaveBeenCalledTimes(1));
    const signal = io.detail.mock.calls[0][1] as AbortSignal;
    rerender({ props: { ...base, editor: { ...base.editor, hasPending: true } } });
    expect(signal.aborted).toBe(true);
    await act(async () => { delayed.resolve(freshDetail); });
    expect(result.current.blocked).toBe(true); expect(result.current.template).toBe(oldDetail);
    expect(result.current.current()).toBe(false);
  });
  it("blocks the PDF session while a save restored after refresh is unresolved", async () => {
    const editor = { ...base.editor, hasPending: true };
    const { result } = renderHook(() => useTemplatePdfSession(useTemplateDesignPdfPort({ ...base, editor })));
    expect(result.current.status).toBe("blocked");
    await act(async () => { await result.current.start(); });
    expect(io.detail).not.toHaveBeenCalled();
    expect(io.create).not.toHaveBeenCalled();
  });
  it("retires and aborts immediately on a current session-ended event", async () => {
    const delayed = deferred<typeof freshDetail>(); io.detail.mockReturnValue(delayed.promise);
    const { result } = renderHook(() => useTemplateDesignPdfPort(base));
    await waitFor(() => expect(io.detail).toHaveBeenCalledTimes(1));
    act(() => io.listen.mock.lastCall?.[0]({ kind: "session-ended", sessionId: "session" }));
    expect(io.detail.mock.calls[0][1].aborted).toBe(true);
    await act(async () => { delayed.resolve(freshDetail); });
    expect(result.current.preparation).toBe("denied"); expect(result.current.current()).toBe(false);
  });
  it("does not initiate an owner detail request without current T01 authority", async () => {
    const { result } = renderHook(() => useTemplateDesignPdfPort({ ...base, editor: { ...base.editor, isCurrentAuthority: () => false } }));
    await waitFor(() => expect(result.current.preparation).toBe("denied")); expect(io.detail).not.toHaveBeenCalled();
  });
  it.each([undefined, "replacement"])("withholds a late detail result after silent transport change to %s", async sessionId => {
    const delayed = deferred<typeof freshDetail>(); io.detail.mockReturnValue(delayed.promise);
    const { result } = renderHook(() => useTemplateDesignPdfPort(base));
    await waitFor(() => expect(io.detail).toHaveBeenCalledTimes(1));
    io.session.mockReturnValue(sessionId ? { sessionId } : undefined);
    await act(async () => { delayed.resolve(freshDetail); });
    expect(result.current.preparation).toBe("denied"); expect(result.current.template).toBe(oldDetail);
    expect(result.current.current()).toBe(false);
  });
  it("never translates Worker awaiting-adoption into a browser completed result", () => {
    const accepted: AcceptedPdfPreview = { templateId: id, draftId, draftRevision: 4, templateContentChecksum: "b".repeat(64),
      compiledArtifactChecksum: "c".repeat(64), renderJobId: id, createdAt: oldDetail.createdAt, expiresAt: "2026-11-10T10:15:00.000Z", status: "PENDING" };
    expect(() => parsePdfPreviewJob({ ...accepted, status: "AWAITING_ADOPTION" }, accepted)).toThrow();
    expect(currentPreviewCapabilities.receipt).toEqual({ state: "UNAVAILABLE", reason: "NO_PROTECTED_PAIRED_RECEIPT_ROUTE" });
  });
  it("mounts the real port, shows actionable detail-read failure, and leaves missing owner operations disabled", async () => {
    io.detail.mockRejectedValueOnce({ status: 503 }).mockResolvedValue(freshDetail);
    const copy = templatePreviewMessages.en;
    render(<TemplateDesignPdfPort {...base} />);
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(copy.draftFeedback.reloadUnavailable));
    for (const label of [copy.receipt, copy.thumbnail, copy.serverCancel, copy.snapshot, copy.print]) {
      expect(screen.getByRole("button", { name: label })).toBeDisabled();
    }
    expect(screen.queryByRole("link")).toBeNull(); expect(io.create).not.toHaveBeenCalled();
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: copy.refresh })); });
    await waitFor(() => expect(screen.getByRole("button", { name: copy.create })).toBeEnabled());
    expect(io.reload).toHaveBeenCalledTimes(1);
  });
});

function acceptedJob(): AcceptedPdfPreview {
  return { templateId:id, draftId, draftRevision:4, templateContentChecksum:"b".repeat(64), compiledArtifactChecksum:"c".repeat(64),
    renderJobId:id, status:"PENDING", createdAt:oldDetail.createdAt, expiresAt:"2026-11-10T10:15:00.000Z" };
}
