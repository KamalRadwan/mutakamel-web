"use client";

import { useCallback, useLayoutEffect, useMemo, useRef, type RefObject } from "react";
import type { useTemplateDesignEditor } from "./useTemplateDesignEditor";
import type { InspectorBridge } from "../inspector/inspector-contract";
import type { InspectorGestureOwner } from "../feedback/useTemplateInspectorDialog";
import type { DesignerInteractionExit } from "../../designer-interaction-exit";
import { isCanonicalTemplateDraft, type TemplateRecoveryAuthority } from "../../template-recovery-policy";

type Editor = Pick<ReturnType<typeof useTemplateDesignEditor>, "draft" | "editable" | "conflict" | "hasPending" | "localPending" | "gestureActive" | "reload" | "isCurrentAuthority">;
export interface TemplateEditorRecoveryCallerInput { editor: Editor; bridge: InspectorBridge; gestures: InspectorGestureOwner; focusScope?: RefObject<HTMLElement | null>; interactionExit?: DesignerInteractionExit }
export type TemplateRecoveryBodyCapability = Readonly<{ state: "unavailable"; reason: "encrypted-recovery-body-api-missing" }>;
const unavailableBody: TemplateRecoveryBodyCapability = Object.freeze({ state: "unavailable", reason: "encrypted-recovery-body-api-missing" });
export type TemplateRecoveryExitCapability = Readonly<{ state: "unavailable"; reason: "owner-cancel-all-port-not-supplied" }> |
  Readonly<{ state: "provided"; cancelAllCurrent: () => boolean }>;
const unavailableExit: TemplateRecoveryExitCapability = Object.freeze({ state: "unavailable", reason: "owner-cancel-all-port-not-supplied" });

/** The existing T01 bridge supplies its opaque context and command generation; no identity is parsed or invented. */
export function useTemplateEditorRecoveryCaller(input: TemplateEditorRecoveryCallerInput) {
  const { editor, bridge, gestures, interactionExit } = input;
  const context = bridge.context(), state = bridge.read(), draft = editor.draft;
  const readable = context.canRead && !!draft && isCanonicalTemplateDraft(draft) && !!state.document;
  const key = JSON.stringify([context.key, draft?.templateId, draft?.draftId]);
  const generation = state.generation, revision = draft?.revision, etag = draft?.etag;
  const latest = useRef(input);
  const mounted = useRef(false);
  useLayoutEffect(() => { latest.current = input; });
  useLayoutEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const current = useCallback(() => {
    const now = latest.current, scope = now.bridge.context(), snapshot = now.bridge.read(), activeDraft = now.editor.draft;
    return mounted.current && scope.canRead && !!snapshot.document && !!activeDraft && isCanonicalTemplateDraft(activeDraft) &&
      JSON.stringify([scope.key, activeDraft.templateId, activeDraft.draftId]) === key && snapshot.generation === generation &&
      activeDraft.revision === revision && activeDraft.etag === etag && now.editor.isCurrentAuthority();
  }, [key, generation, revision, etag]);
  const bridgeKey = context.key;
  const cancelAllCurrent = useCallback(() => {
    const now = latest.current, exit = now.interactionExit;
    if (!current() || !exit || exit.ticket.bridgeKey !== bridgeKey || exit.ticket.generation !== generation) return false;
    return exit.cancelAllCurrent({ bridgeKey, generation }) && current() && !exit.hasActive() &&
      !now.bridge.read().gestureActive && !now.gestures.getSnapshot().active;
  }, [bridgeKey, generation, current]);
  const writable = readable && editor.editable && bridge.canEdit();
  // epoch is this review's actual command generation; the opaque bridge key already binds T01's owner epoch.
  const authority = useMemo<TemplateRecoveryAuthority>(() => ({ key, epoch: generation, readable, writable, current }), [key, generation, readable, writable, current]);
  const interaction = useMemo(() => ({
    active: () => gestures.getSnapshot().active || interactionExit?.hasActive() === true,
    cancel: () => { if (interactionExit) cancelAllCurrent(); else gestures.cancel(); },
  }), [gestures, interactionExit, cancelAllCurrent]);
  const exit: TemplateRecoveryExitCapability = interactionExit ? { state: "provided", cancelAllCurrent } : unavailableExit;
  const reload = () => {
    const now = latest.current;
    if (current() && !now.editor.hasPending && !now.editor.localPending && cancelAllCurrent()) now.editor.reload();
  };
  if (!readable || !draft || !state.document) return { state: "unavailable" as const, reason: "current-draft-unavailable" as const, body: unavailableBody, exit };
  return { state: "ready" as const, authority, focusScope: input.focusScope, body: unavailableBody, exit,
    review: editor.conflict ? { base: draft, local: state.document, blocked: editor.hasPending || editor.localPending || editor.gestureActive, onReload: reload, interaction } : null };
}
