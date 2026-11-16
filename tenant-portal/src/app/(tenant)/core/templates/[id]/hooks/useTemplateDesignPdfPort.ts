"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useTenantAuth } from "@/context/AuthContext";
import { getStoredTenantSessionMeta } from "@/lib/api/axiosClient";
import { subscribeToTenantAuthEvents } from "@/lib/auth/sessionCoordinator";
import { invalidCoreResponse } from "../../../contracts/core-page";
import { fetchTemplate } from "../../templates-api";
import type { TemplateDetail } from "../../templates-contract";
import { classifyPreviewFailure, supportsCurrentPdfPreview, type PreviewPreparationFailure } from "../../template-preview-availability";
import type { useTemplateDesignEditor } from "./useTemplateDesignEditor";
import type { TemplatePdfSessionInput } from "./useTemplatePdfSession";

type Editor = ReturnType<typeof useTemplateDesignEditor>;
export type TemplateDesignPdfEditorPort = Pick<Editor,
  "draft" | "loading" | "dirty" | "hasPending" | "conflict" | "gestureActive" | "isCurrentAuthority" |
  "commandStore" | "localSessions" | "localPending" | "localSessionEpoch" | "interactionExit"> & {
    interactionBridge: Pick<Editor["interactionBridge"], "context">;
    schema: TemplatePdfSessionInput["schema"];
  };
export interface TemplateDesignPdfPortInput {
  template: TemplateDetail; editor: TemplateDesignPdfEditorPort; canPreview: boolean;
  draftPdfRecovery?: TemplatePdfSessionInput["draftPdfRecovery"];
  /** Pass the existing parent's guard.requestDiscard(editor.reload), not an unguarded reload. */
  reload: () => void;
}

function tuple(template: TemplateDetail): string {
  return JSON.stringify([template.id, template.dataSourceKey, template.documentType, template.outputChannel,
    template.layoutMode, template.locale, template.direction, template.scope.type, template.scope.companyId ?? null, template.scope.branchId ?? null]);
}

/** Reads genuine current definition pins after a T01 save without replacing its draft/editor authority. */
export function useTemplateDesignPdfPort(input: TemplateDesignPdfPortInput): TemplatePdfSessionInput {
  const { template, editor, canPreview } = input;
  const { authState, user, realtimeAuthGeneration } = useTenantAuth();
  const draft = editor.draft;
  const explicitFixed = template.layoutMode === "FIXED_CANVAS" && draft !== null && Object.hasOwn(draft.editorDocument, "canvasPages");
  const store = editor.commandStore, sessions = editor.localSessions, exit = editor.interactionExit;
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  const localPending = useSyncExternalStore(sessions.subscribe, sessions.getSnapshot, sessions.getSnapshot);
  // This is T01's actual interaction ticket; no client-maintained generation counter is introduced.
  const generation = exit.ticket.generation, contextKey = exit.ticket.bridgeKey;
  const blocked = editor.loading || editor.dirty || snapshot.dirty || editor.hasPending ||
    editor.conflict || editor.gestureActive || snapshot.gestureActive || editor.localPending || localPending;
  const [retry, setRetry] = useState(0);
  const key = JSON.stringify([tuple(template), draft?.draftId, draft?.revision, draft?.etag,
    generation, contextKey, editor.localSessionEpoch, canPreview, blocked, authState, user?.id, realtimeAuthGeneration, retry]);
  const owner = useMemo(() => ({ key, store, sessions, exit }), [key, store, sessions, exit]);
  const live = useRef<object | null>(null);
  const readController = useRef<AbortController | null>(null);
  const latest = useRef(input);
  const transportCurrent = useCallback(() => {
    const sessionId = getStoredTenantSessionMeta()?.sessionId;
    return authState === "AUTHENTICATED" && Boolean(sessionId && user?.id) &&
      realtimeAuthGeneration === `tenant:${sessionId}:${user?.id}`;
  }, [authState, user?.id, realtimeAuthGeneration]);
  const current = useCallback(() => {
    const host = latest.current.editor, document = store.getSnapshot(), context = host.interactionBridge.context();
    return live.current === owner && canPreview && !blocked && transportCurrent() &&
      host.commandStore === store && host.localSessions === sessions && host.interactionExit === exit && host.draft === draft &&
      host.interactionExit.ticket.bridgeKey === contextKey && host.interactionExit.ticket.generation === generation &&
      document.generation === generation && document.document !== null && !document.dirty && !document.gestureActive &&
      !sessions.has() && !host.localPending && !host.loading && !host.hasPending && !host.conflict &&
      context.key === contextKey && context.canRead && host.isCurrentAuthority();
  }, [owner, canPreview, blocked, transportCurrent, draft, store, sessions, exit, generation, contextKey]);
  const subscribeRetirement = useCallback((retire: () => void) => {
    const check = () => { if (!current()) retire(); };
    const unsubscribeDocument = store.subscribe(check), unsubscribeSessions = sessions.subscribe(check);
    return () => { unsubscribeDocument(); unsubscribeSessions(); };
  }, [store, sessions, current]);
  const [state, setState] = useState<{ owner: object; template: TemplateDetail | null; error: PreviewPreparationFailure | null } | null>(null);
  useLayoutEffect(() => { latest.current = input; });
  useLayoutEffect(() => {
    live.current = owner;
    const unsubscribeHost = subscribeRetirement(() => {
      if (live.current !== owner) return;
      live.current = null; readController.current?.abort(); setState({ owner, template: null, error: "stale" });
    });
    const unsubscribe = subscribeToTenantAuthEvents(event => {
      const same = realtimeAuthGeneration === `tenant:${event.sessionId}:${user?.id}`;
      if (event.kind === "session-ended" ? same : !same) {
        live.current = null; readController.current?.abort(); setState({ owner, template: null, error: "denied" });
      }
    });
    return () => { unsubscribe(); unsubscribeHost(); live.current = null; readController.current?.abort(); };
  }, [owner, realtimeAuthGeneration, user?.id, subscribeRetirement]);
  useEffect(() => {
    if (!draft || blocked || !canPreview || explicitFixed || !supportsCurrentPdfPreview(template)) return;
    const controller = new AbortController();
    readController.current = controller;
    const load = async () => {
      if (!current()) { setState({ owner, template: null, error: "denied" }); return; }
      try {
        const fresh = await fetchTemplate(template.id, controller.signal);
        if (controller.signal.aborted) return;
        if (!current()) { if (live.current === owner) setState({ owner, template: null, error: "denied" }); return; }
        if (tuple(fresh) !== tuple(template)) invalidCoreResponse();
        if (!/^[a-f0-9]{64}$/u.test(fresh.currentDraft.contentChecksum)) invalidCoreResponse();
        if (fresh.currentDraft.draftId !== draft.draftId || fresh.currentDraft.revision !== draft.revision ||
          fresh.currentDraft.etag !== draft.etag) {
          setState({ owner, template: null, error: "stale" }); return;
        }
        setState({ owner, template: fresh, error: null });
      } catch (error) {
        if (!controller.signal.aborted && live.current === owner) {
          setState({ owner, template: null, error: current() ? classifyPreviewFailure(error) : "denied" });
        }
      }
    };
    void load();
    return () => controller.abort();
  }, [owner, current, draft, blocked, canPreview, explicitFixed, template]);
  const fresh = state?.owner === owner ? state.template : null;
  const error = state?.owner === owner ? state.error : null;
  const reload = useCallback(() => {
    latest.current.reload();
    if (current()) setRetry(value => value + 1);
  }, [current, setRetry]);
  const pdfTemplate: TemplateDetail = explicitFixed ? { ...template, previewPdf: { state: "HIDDEN", reason: null } } : fresh ?? template;
  return { template: pdfTemplate, draft, schema: editor.schema, canPreview, blocked, draftPdfRecovery: input.draftPdfRecovery,
    current, reload, reloadInvalidPreparation: reload, lifetime: owner, subscribeRetirement, preparation: error ?? (fresh ? undefined : "preparing") };
}
