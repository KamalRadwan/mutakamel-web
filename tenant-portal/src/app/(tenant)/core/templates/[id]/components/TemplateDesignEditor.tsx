"use client";

import { useCallback, useLayoutEffect, useRef, useState, type MouseEventHandler, type Ref } from "react";
import { DesignerFocusScopeContext } from "./designer-focus-scope";
import { isTemplateFocusTarget } from "../feedback/inspector-feedback-context";
import { useTenantAuth } from "@/context/AuthContext";
import { usePublishedPreviewReturnFocus } from "../feedback/published-preview-focus";

import { Badge, Button, ConfirmActionModal, DetailHeader, Dialog, DialogContent, DialogDescription, DialogTitle, ErrorState, NotFoundState, PermissionGate, Skeleton, UnavailableState } from "@/design-system";
import { useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard";
import { useI18n } from "@/i18n/I18nContext";
import { templateAuthoringHostCopy } from "@/i18n/template-authoring-host-copy";
import { useTemplateFeedbackCopy } from "../../feedback/useTemplateFeedbackCopy";
import { TEMPLATE_READ_PERMISSION, TEMPLATE_UPDATE_PERMISSION, type TemplateDetail } from "../../templates-contract";
import { useTemplateDesignEditor } from "../hooks/useTemplateDesignEditor";
import type { TemplateDesignDraftRefresh } from "../design/useTemplateDesignDefinition";
import { DesignerAuthoringWorkspace } from "./DesignerAuthoringWorkspace";
import { TemplateDesignPdfPort } from "./TemplateDesignPdfPort";
import type { DesignerNativeRuntime } from "../../designer-native-runtime";
import { DesignerConflictRecovery } from "./DesignerConflictRecovery";
import type { DraftPdfRecovery } from "../hooks/useDraftPdfRecovery";

export function TemplateDesignEditor({ template, canPreview, canMutate, backHref, nativeRuntime, draftRefresh, draftPdfRecovery }: {
  template: TemplateDetail; canPreview: boolean; canMutate: boolean; backHref: string; nativeRuntime?: DesignerNativeRuntime;
  draftRefresh?: TemplateDesignDraftRefresh;
  draftPdfRecovery?: DraftPdfRecovery;
}) {
  const editor = useTemplateDesignEditor(template, canMutate, nativeRuntime, draftRefresh);
  const focusScope = useRef<HTMLDivElement>(null);
  const { authState, realtimeAuthGeneration } = useTenantAuth();
  usePublishedPreviewReturnFocus(`${backHref}/design`, realtimeAuthGeneration, focusScope,
    authState === "AUTHENTICATED" && !editor.loading && !editor.loadFailure);
  const { lang } = useI18n(), hostCopy = templateAuthoringHostCopy[lang];
  const c = editor.t.quotationPdf;
  const copy = editor.t.coreOperations.templates;
  const pending = editor.hasPending;
  const refreshedSave = editor.refreshedSave;
  const [discardSaveFor, setDiscardSaveFor] = useState<string | null>(null);
  const localPending = editor.localPending;
  const recovery = c.draftRecovery;
  const mutationsDisabled = !editor.editable || pending || localPending || editor.conflict;
  const saveAuthorityNotice = editor.dirty && !pending && !editor.conflict && editor.saveAuthority
    ? editor.saveAuthority === "waiting" ? c.draftSaveAuthorityWaiting : c.draftSaveAuthorityUnavailable
    : null;
  const guard = useUnsavedChangesGuard(editor.dirty || (pending && !refreshedSave) || localPending);
  const { readOnly: readOnlyNotice } = useTemplateFeedbackCopy();
  const { key: ownerKey, epoch: ownerEpoch } = editor.recoveryAuthority;
  const refreshOwner = JSON.stringify([ownerKey, ownerEpoch]);
  const saveRecoveryNotice = useRef<HTMLDivElement>(null);
  const saveErrorNotice = useRef<HTMLParagraphElement>(null);
  const draftAction = useRef<{
    action: "save" | "recovery";
    draft: typeof editor.draft;
    focus: NonNullable<ReturnType<typeof trackDraftActionFocus>>;
  } | null>(null);
  const runDraftAction = (trigger: HTMLButtonElement, action: "save" | "recovery", run: () => Promise<void>) => {
    draftAction.current?.focus.release();
    const focus = trackDraftActionFocus(trigger);
    draftAction.current = focus ? { action, draft: editor.draft, focus } : null;
    void run();
  };
  useLayoutEffect(() => () => {
    draftAction.current?.focus.release();
    draftAction.current = null;
  }, [refreshOwner]);
  useLayoutEffect(() => {
    const attempt = draftAction.current;
    if (!attempt || editor.saving || refreshedSave?.checking) return;
    draftAction.current = null;
    const owned = attempt.focus.ownsFocus();
    attempt.focus.release();
    const scope = focusScope.current;
    if (!owned || !scope || !editor.editable || !editor.isCurrentAuthority()) return;
    const recovered = !pending && editor.draft && editor.draft !== attempt.draft;
    const target = attempt.action === "save"
      ? (editor.unknown ? saveRecoveryNotice.current : saveErrorNotice.current)
      : (recovered ? scope : null);
    if (target && isTemplateFocusTarget(target, scope)) target.focus({ preventScroll: true });
  });
  const displacedPrintFocus = useRef<{ origin: Element; ownerKey: string; ownerEpoch: number } | null>(null);
  const printPanelRef = useCallback((panel: HTMLDivElement | null) => {
    if (!panel) return;
    return () => {
      const origin = panel.ownerDocument.activeElement;
      if (origin && panel.contains(origin)) displacedPrintFocus.current = { origin, ownerKey, ownerEpoch };
    };
  }, [ownerKey, ownerEpoch]);
  useLayoutEffect(() => {
    const displaced = displacedPrintFocus.current;
    displacedPrintFocus.current = null;
    const target = focusScope.current;
    if (!displaced || displaced.origin.isConnected || !editor.loading || !canPreview || !target ||
      displaced.ownerKey !== ownerKey || displaced.ownerEpoch !== ownerEpoch ||
      !editor.isCurrentAuthority() || !isTemplateFocusTarget(target, target)) return;
    const document = target.ownerDocument;
    const active = document.activeElement;
    if (active && active.isConnected && active !== document.body && active !== document.documentElement) return;
    const dialogs = Array.from(document.querySelectorAll('[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"]'));
    const topDialog = dialogs.at(-1);
    if (!topDialog || topDialog.contains(target)) target.focus();
  });
  if (editor.loadFailure === "unavailable") return <UnavailableState backHref={backHref} />;
  if (editor.loadFailure === "denied") return <PermissionGate require={[TEMPLATE_READ_PERMISSION, TEMPLATE_UPDATE_PERMISSION]} denied>{null}</PermissionGate>;
  if (editor.loadFailure === "missing") return <NotFoundState title={copy.notFoundTitle} description={copy.notFoundDescription}
    backLabel={copy.definitionTitle} backHref={backHref} />;
  const retry = () => guard.requestDiscard(editor.reload);
  return <DesignerFocusScopeContext.Provider value={focusScope}>
    <div ref={focusScope} role="region" aria-label={c.editorTitle} tabIndex={-1}>
    <DetailHeader title={c.editorTitle} subtitle={template.name} backLabel={copy.definitionTitle} backHref={backHref}
      status={editor.draft ? <Badge tone="neutral">{c.draft} {editor.draft.revision}</Badge> : undefined}
      primaryAction={{ label: c.saveDraft, onClick: event => runDraftAction(event.currentTarget, "save", editor.save),
        loading: editor.saving && !editor.unknown,
        disabled: mutationsDisabled || !!editor.saveAuthority || editor.gestureActive || !editor.dirty }} />
    {editor.unknown && <DraftSaveRecoveryNotice noticeRef={saveRecoveryNotice} title={recovery.pendingTitle} description={recovery.pendingHelp}
      label={recovery.recover} busy={editor.saving} disabled={!editor.editable}
      onRecover={event => runDraftAction(event.currentTarget, "recovery", editor.recover)} />}
    {refreshedSave && <DraftSaveRecoveryNotice title={recovery.pendingTitle} description={refreshedSave.unconfirmed ? recovery.checkUnconfirmed : recovery.refreshHelp}
      label={recovery.checkSave} busy={refreshedSave.checking} disabled={!refreshedSave.canCheck}
      onRecover={event => runDraftAction(event.currentTarget, "recovery", refreshedSave.check)}
      discard={refreshedSave.canDiscard ? { label: recovery.useSavedDraft, onClick: () => setDiscardSaveFor(refreshOwner) } : undefined} />}
    {saveAuthorityNotice
      ? <div className="flex flex-wrap items-center gap-2">
        <p ref={saveErrorNotice} tabIndex={-1} role="status" className="text-sm text-muted-foreground">{saveAuthorityNotice}</p>
        {editor.retrySaveVerification && <Button type="button" variant="outline" size="sm" disabled={mutationsDisabled || editor.gestureActive}
          onClick={editor.retrySaveVerification}>{c.draftSaveAuthorityRetry}</Button>}
      </div>
      : editor.error && !editor.unknown && !editor.conflict
        ? <p ref={saveErrorNotice} tabIndex={-1} role="alert" className="text-sm text-destructive">{editor.error}</p>
        : null}
    {localPending && <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border p-3"><p role="status" className="text-sm">{hostCopy.localPending}</p>
      <Button type="button" variant="outline" onClick={editor.discardLocalChanges}>{hostCopy.discardLocal}</Button></div>}
    {!canMutate && <p role="status" className="text-sm text-muted-foreground">{readOnlyNotice}</p>}
    {editor.loading ? <Skeleton className="h-[600px] w-full" /> : !editor.document ?
      <ErrorState title={c.editorUnavailable} onRetry={retry} retryLabel={c.retry} /> : <>
      {!editor.schema && <ErrorState title={c.schemaUnavailable} onRetry={retry} retryLabel={c.retry} />}
      {editor.assetsUnavailable && <p role="status" className="text-sm text-muted-foreground">{c.assetsUnavailable}</p>}
      <div className="flex flex-col gap-4 p-4 sm:p-6">
        <DesignerConflictRecovery editor={editor} focusScope={focusScope} />
        <div className="flex flex-wrap items-center gap-2">
          {canPreview && <Button variant="outline" size="sm" loading={editor.previewing}
            disabled={editor.dirty || pending || localPending || editor.conflict} onClick={() => void editor.preview()}>{c.preview}</Button>}
        </div>
        <DesignerAuthoringWorkspace key={JSON.stringify([editor.interactionBridge.context().key, editor.nativeSource?.bindingKey, editor.localSessionEpoch])} editor={editor} nativeSource={editor.nativeSource} layoutMode={template.layoutMode} />
        <div ref={printPanelRef} className="contents">
          <TemplateDesignPdfPort key={JSON.stringify([editor.interactionExit.ticket.bridgeKey, editor.interactionExit.ticket.generation, editor.nativeSource?.bindingKey, editor.localSessionEpoch])}
            template={template} editor={editor} canPreview={canPreview} draftPdfRecovery={draftPdfRecovery}
            reload={() => guard.requestDiscard(editor.reload)} />
        </div>
        <p className="text-xs text-muted-foreground">{editor.dirty ? c.saveBeforePreview : c.staticPreview}</p>
      </div>
    </>}
    <ConfirmActionModal open={guard.isDiscardOpen && !pending} onOpenChange={open => { if (!open) guard.cancelDiscard(); }}
      title={editor.t.common.discardTitle} description={editor.t.common.discardDescription}
      confirmLabel={editor.t.common.discardConfirm} cancelLabel={c.cancel}
      onConfirm={() => { editor.discardRetainedTyping(); guard.confirmDiscard(); }} />
    <ConfirmActionModal open={refreshedSave?.canDiscard === true && discardSaveFor === refreshOwner}
      onOpenChange={open => { if (!open) setDiscardSaveFor(null); }} title={recovery.useSavedDraft} description={recovery.useSavedDraftHelp}
      confirmLabel={recovery.useSavedDraft} cancelLabel={c.cancel}
      onConfirm={() => { setDiscardSaveFor(null); refreshedSave?.discard(); }} />
    <Dialog open={guard.isDiscardOpen && pending && !refreshedSave} onOpenChange={open => { if (!open) guard.cancelDiscard(); }}>
      <DialogContent>
        <DialogTitle>{c.editorTitle}</DialogTitle>
        <DialogDescription>{c.leavePending}</DialogDescription>
        <Button variant="outline" onClick={guard.cancelDiscard}>{c.cancel}</Button>
      </DialogContent>
    </Dialog>
    <Dialog open={canPreview && editor.sample !== null} onOpenChange={editor.closeSample}>
      <DialogContent size="2xl" className="flex h-[90dvh] w-[calc(100vw-2rem)] max-w-[1100px] flex-col gap-4 p-6">
        <DialogTitle>{c.sample}</DialogTitle>
        <DialogDescription>{editor.emailSample ? hostCopy.emailSampleHint : c.sampleHint}</DialogDescription>
        {editor.emailSample && <dl className="grid max-h-32 shrink-0 gap-2 overflow-y-auto text-sm sm:grid-cols-3">
          <div className="min-w-0">
            <dt className="text-muted-foreground">{copy.emailSubject}</dt>
            <dd dir="auto" lang={editor.emailSample.locale} className="break-words">{editor.emailSample.subject}</dd>
          </div>
          {editor.emailSample.preheader !== null && <div className="min-w-0">
            <dt className="text-muted-foreground">{hostCopy.emailSamplePreheader}</dt>
            <dd dir="auto" lang={editor.emailSample.locale} className="break-words">{editor.emailSample.preheader}</dd>
          </div>}
          <div>
            <dt className="text-muted-foreground">{copy.locale}</dt>
            <dd><bdi dir="ltr">{editor.emailSample.locale}</bdi></dd>
          </div>
        </dl>}
        {editor.sample ? <iframe title={c.sample} srcDoc={editor.sample} sandbox="" referrerPolicy="no-referrer"
          className="min-h-80 w-full flex-1 rounded-lg border border-border bg-white" /> : null}
      </DialogContent>
    </Dialog>
  </div></DesignerFocusScopeContext.Provider>;
}

function trackDraftActionFocus(trigger: HTMLButtonElement) {
  const document = trigger.ownerDocument;
  if (document.activeElement !== trigger) return null;
  const controller = new AbortController();
  const { signal } = controller;
  const release = () => controller.abort();
  const options = { capture: true, signal };
  document.addEventListener("focusin", event => {
    if (event.target !== trigger && event.target !== document.body && event.target !== document.documentElement) release();
  }, options);
  document.addEventListener("pointerdown", event => {
    if (!event.composedPath().includes(trigger)) release();
  }, options);
  document.addEventListener("keydown", event => {
    if (event.key === "Tab") release();
  }, options);
  document.defaultView?.addEventListener("blur", release, { signal });
  return {
    release,
    ownsFocus: () => {
      const active = document.activeElement;
      // A disabled or removed trigger can leave focus on the document.
      return !signal.aborted && (active === trigger || active === document.body || active === document.documentElement);
    },
  };
}

function DraftSaveRecoveryNotice({ noticeRef, title, description, label, busy, disabled, onRecover, discard }: {
  noticeRef?: Ref<HTMLDivElement>;
  title: string; description: string; label: string; busy: boolean; disabled: boolean; onRecover: MouseEventHandler<HTMLButtonElement>;
  discard?: { label: string; onClick: () => void };
}) {
  return (
    <section className="grid gap-2 rounded-lg border border-border bg-muted/30 p-4">
      <div ref={noticeRef} role="alert" tabIndex={-1}>
        <h2 className="font-medium">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" loading={busy} disabled={disabled} onClick={onRecover}>{label}</Button>
        {discard && <Button variant="ghost" onClick={discard.onClick}>{discard.label}</Button>}
      </div>
    </section>
  );
}
