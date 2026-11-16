"use client";

import { useEffect, useRef, type ComponentProps } from "react";
import type { InspectorExtensionPorts } from "../inspector/inspector-ports";
import { useInspectorCopy } from "../inspector/useInspectorForm";
import { isTemplateFocusTarget, useInspectorFeedbackScope } from "./inspector-feedback-context";

type FeedbackProps = ComponentProps<NonNullable<InspectorExtensionPorts["Feedback"]>>;

/** Exact T02 ComponentType Feedback port; it never acknowledges a server save. */
export function TemplateInspectorFeedback({ result, dirty, stale, disabled }: FeedbackProps) {
  const c = useInspectorCopy(), scope = useInspectorFeedbackScope();
  const notice = useRef<HTMLParagraphElement>(null);
  const failed = result !== "applied" && result !== "unchanged";
  useEffect(() => {
    const element = notice.current, root = scope?.root.current;
    if (!failed || !element || !root || !scope?.current()) return;
    const form = element.closest("form"), focused = element.ownerDocument.activeElement;
    // A newer nested dialog or another form retains its own reading position.
    if (!form || !focused || !form.contains(focused)) return;
    const invalid = Array.from(form.querySelectorAll<HTMLElement>('[aria-invalid="true"]')).find(field => isTemplateFocusTarget(field, form));
    if (!scope.current() || !isTemplateFocusTarget(invalid ?? element, form)) return;
    (invalid ?? element).focus();
  }, [result, failed, dirty, stale, disabled, scope]);
  // The host's pure render admission removes this subtree on read loss.
  // current() is imperative: the existing T18 owner callback can fence state.
  if (!scope) return null;
  return <div className="min-w-0 text-sm">
    <p role="status" aria-atomic="true">{!failed && c[result]}</p>
    <p ref={notice} role="alert" aria-atomic="true" tabIndex={-1}
      className="break-words rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{failed && c[result]}</p>
  </div>;
}
