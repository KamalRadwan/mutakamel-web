"use client";

import type { ComponentProps, RefObject } from "react";
import { TemplateConflictReview } from "../components/TemplateConflictReview";
import { useTemplateRecoveryFocusGuard } from "./useTemplateRecoveryFocusGuard";

export function TemplateRecoveryFocusHost({ review, current, focusScope }: {
  review: ComponentProps<typeof TemplateConflictReview>;
  current: () => boolean;
  focusScope?: RefObject<HTMLElement | null>;
}) {
  const { root, onFocusCapture } = useTemplateRecoveryFocusGuard({ blocked: review.blocked, current, scope: focusScope });
  if (!review.authority.readable) return null;
  return <div ref={root} className="contents" onFocusCapture={onFocusCapture}>
    <TemplateConflictReview {...review} />
  </div>;
}
