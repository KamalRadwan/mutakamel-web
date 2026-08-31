"use client";

import { SegmentErrorScreen } from "@/components/tenant/SegmentErrorScreen";
import { useI18n } from "@/i18n/I18nContext";

// Scoped to /core/*, which holds the account screens. A failure there must
// not unmount the navigation the user needs to leave it.
export default function CoreSegmentError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  const { t } = useI18n();

  return (
    <SegmentErrorScreen
      description={t.boundaries.coreErrorDescription}
      digest={error.digest}
      onRetry={unstable_retry}
    />
  );
}
