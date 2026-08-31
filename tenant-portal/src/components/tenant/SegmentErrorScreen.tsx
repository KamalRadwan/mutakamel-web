"use client";

import { ErrorState } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";

export interface SegmentErrorScreenProps {
  // Names the part of the app that stopped. Each segment boundary passes its
  // own, because the whole point of a per-segment error.tsx is that the rest
  // of the shell is still usable.
  description: string;
  // Next's hash of the server-side error. It is the only handle a user report
  // has on the corresponding server log, so it is surfaced the same way
  // correlationId is — see docs/reference/errors.md#normalized-shape.
  digest?: string;
  onRetry: () => void;
}

// The body every `(tenant)/**/error.tsx` renders. Those files are route files
// Next requires one of per segment; keeping the markup here means four
// boundaries, one implementation.
export function SegmentErrorScreen({ description, digest, onRetry }: SegmentErrorScreenProps) {
  const { t } = useI18n();

  return (
    <ErrorState
      title={t.boundaries.segmentErrorTitle}
      description={digest ? `${description} — ${t.errors.reference}: ${digest}` : description}
      onRetry={onRetry}
      retryLabel={t.boundaries.retry}
    />
  );
}
