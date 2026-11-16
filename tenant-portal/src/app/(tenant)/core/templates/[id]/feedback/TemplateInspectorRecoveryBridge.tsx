"use client";

import { useCallback, useMemo, useRef, type ComponentProps, type RefObject } from "react";
import { TemplateInspectorDialogHost } from "./TemplateInspectorDialogHost";
import type { TemplateDesignInspectorProps } from "../inspector/TemplateDesignInspector";
import type { TemplateConflictReview } from "../components/TemplateConflictReview";
import type { TemplateRecoveryAuthority } from "../../template-recovery-policy";
import { InspectorFeedbackContext } from "./inspector-feedback-context";
import { TemplateInspectorFeedback } from "./TemplateInspectorFeedback";
import { TemplateRecoveryFocusHost } from "./TemplateRecoveryFocusHost";
import { useTemplateInspectorAuthority } from "./useTemplateInspectorAuthority";
import { useTemplateInspectorDialog, type InspectorGestureOwner } from "./useTemplateInspectorDialog";
import { useTemplateInspectorSessions } from "./useTemplateInspectorSessions";

export interface TemplateInspectorRecoveryBridgeProps {
  inspector: TemplateDesignInspectorProps;
  authority: TemplateRecoveryAuthority;
  gestures: InspectorGestureOwner;
  focusScope?: RefObject<HTMLElement | null>;
  recovery?: Omit<ComponentProps<typeof TemplateConflictReview>, "authority">;
}

/** T01 supplies its existing subscribed bridge/controller and T18 authority envelope. */
export function TemplateInspectorRecoveryBridge(props: TemplateInspectorRecoveryBridgeProps) {
  const owner = useTemplateInspectorAuthority(props.authority, props.inspector.bridge);
  if (!owner.readable) return null;
  return <CurrentInspectorRecoveryBridge key={owner.scopeKey} {...props} currentOwner={owner.current} />;
}

function CurrentInspectorRecoveryBridge({ inspector, authority, gestures, recovery, focusScope, currentOwner }: TemplateInspectorRecoveryBridgeProps & {
  currentOwner: (key: string, epoch: number, bridgeKey: string, generation: number) => boolean;
}) {
  const root = useRef<HTMLDivElement>(null);
  const bridgeKey = inspector.bridge.context().key;
  const generation = inspector.bridge.read().generation;
  const current = useCallback(() => currentOwner(authority.key, authority.epoch, bridgeKey, generation), [currentOwner, authority.key, authority.epoch, bridgeKey, generation]);
  const scope = useMemo(() => ({ root, current }), [current]);
  const lifecycle = useTemplateInspectorDialog(current, root, gestures);
  const sessions = useTemplateInspectorSessions(bridgeKey, current, inspector.onLocalStateChange);
  const extensions = useMemo(() => ({ ...inspector.extensions, Feedback: TemplateInspectorFeedback }), [inspector.extensions]);
  return <InspectorFeedbackContext.Provider value={scope}>
    <div ref={root} className="contents">
      <TemplateInspectorDialogHost inspector={{ ...inspector, extensions, onLocalStateChange: sessions.change }} lifecycle={lifecycle} />
      {recovery && <TemplateRecoveryFocusHost current={current} focusScope={focusScope}
        review={{ ...recovery, authority, blocked: recovery.blocked || sessions.pending }} />}
    </div>
  </InspectorFeedbackContext.Provider>;
}
