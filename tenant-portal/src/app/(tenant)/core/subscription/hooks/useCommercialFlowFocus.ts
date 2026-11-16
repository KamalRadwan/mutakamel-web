"use client";

import { useEffect, useRef } from "react";

/** Keep a stable destination when a flow transition removes its action. */
export function useCommercialFlowFocus(phase: string | undefined, previewId: string | undefined, enabled: boolean) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const previous = useRef<{ phase: string | undefined; previewId: string | undefined } | null>(null);
  useEffect(() => {
    const before = previous.current;
    previous.current = enabled && phase ? { phase, previewId } : null;
    if (!enabled || !before || !phase) return;
    if ((before.phase !== phase && ["pending", "saved", "complete", "idle"].includes(phase))
      || (previewId !== undefined && before.previewId !== previewId)) headingRef.current?.focus();
  }, [phase, previewId, enabled]);
  return headingRef;
}
