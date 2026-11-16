"use client";

import { createContext, useContext, type RefObject } from "react";

export interface InspectorFeedbackScope {
  readonly current: () => boolean;
  readonly root: RefObject<HTMLDivElement | null>;
}

export const InspectorFeedbackContext = createContext<InspectorFeedbackScope | null>(null);

export function useInspectorFeedbackScope() {
  return useContext(InspectorFeedbackContext);
}

export function isTemplateFocusTarget(element: HTMLElement, root: HTMLElement) {
  if (!element.isConnected || !root.contains(element) || element.matches(':disabled, [aria-disabled="true"]')) return false;
  for (let ancestor: HTMLElement | null = element; ancestor; ancestor = ancestor.parentElement) {
    if (ancestor.matches('[inert], [hidden], [aria-hidden="true"]')) return false;
    const style = ancestor.ownerDocument.defaultView?.getComputedStyle(ancestor);
    if (style?.display === "none" || style?.visibility === "hidden" || style?.visibility === "collapse") return false;
  }
  return true;
}
