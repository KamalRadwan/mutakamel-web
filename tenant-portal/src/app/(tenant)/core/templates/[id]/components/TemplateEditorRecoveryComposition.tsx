"use client";

import type { TemplateConflictCopy } from "@/i18n/dictionaries/template-conflict";
import { TemplateInspectorRecoveryBridge, type TemplateInspectorRecoveryBridgeProps } from "../feedback/TemplateInspectorRecoveryBridge";
import { useTemplateEditorRecoveryCaller, type TemplateEditorRecoveryCallerInput } from "../hooks/useTemplateEditorRecoveryCaller";
import { TemplateRecoveryBodyUnavailable } from "./TemplateConflictReview";

/** One actual T20 inspector adapter and one T18 recovery mount; T01 remains the only authored/save owner. */
export function TemplateEditorRecoveryComposition({ inspector, copy, locale, showRecoveryBodyStatus = false, ...input }: TemplateEditorRecoveryCallerInput & {
  inspector: Omit<TemplateInspectorRecoveryBridgeProps["inspector"], "bridge">; copy: TemplateConflictCopy; locale: string; showRecoveryBodyStatus?: boolean;
}) {
  const caller = useTemplateEditorRecoveryCaller(input);
  if (caller.state !== "ready") return null;
  return <>
    <TemplateInspectorRecoveryBridge inspector={{ ...inspector, bridge: input.bridge }} gestures={input.gestures} authority={caller.authority} focusScope={caller.focusScope}
      recovery={caller.review ? { ...caller.review, copy, locale } : undefined} />
    {showRecoveryBodyStatus && caller.body.state === "unavailable" && <TemplateRecoveryBodyUnavailable copy={copy} />}
  </>;
}
