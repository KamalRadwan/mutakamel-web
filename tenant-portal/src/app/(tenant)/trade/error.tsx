"use client";

import { SegmentErrorScreen } from "@/components/tenant/SegmentErrorScreen";
import { useI18n } from "@/i18n/I18nContext";

// Scoped to /trade/*, which currently renders the unavailable boundary. The
// segment still needs its own error.tsx: without one, anything thrown here
// unwinds past AppShell to the root.
export default function TradeSegmentError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  const { t } = useI18n();

  return (
    <SegmentErrorScreen
      description={t.boundaries.tradeErrorDescription}
      digest={error.digest}
      onRetry={unstable_retry}
    />
  );
}
