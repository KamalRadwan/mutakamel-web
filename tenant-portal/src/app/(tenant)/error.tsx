"use client";

import { SegmentErrorScreen } from "@/components/tenant/SegmentErrorScreen";
import { useI18n } from "@/i18n/I18nContext";

// Wraps the children of (tenant)/layout.tsx, never the layout itself — so
// TenantPortalRuntime's providers and AppShell stay mounted and the user
// keeps the navigation. See node_modules/next/dist/docs/01-app/
// 03-api-reference/03-file-conventions/error.md.
export default function TenantWorkspaceError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  const { t } = useI18n();

  return (
    <SegmentErrorScreen
      description={t.boundaries.workspaceErrorDescription}
      digest={error.digest}
      onRetry={unstable_retry}
    />
  );
}
