"use client";

import { SegmentErrorScreen } from "@/components/tenant/SegmentErrorScreen";
import { useI18n } from "@/i18n/I18nContext";

// Scoped to /crm/* so one CRM screen throwing does not take the shell — or
// the rest of CRM — down with it.
export default function CrmSegmentError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  const { t } = useI18n();

  return (
    <SegmentErrorScreen
      description={t.boundaries.crmErrorDescription}
      digest={error.digest}
      onRetry={unstable_retry}
    />
  );
}
