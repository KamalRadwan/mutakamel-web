"use client";

import type { ReactNode } from "react";
import { EmptyState, ErrorState, PermissionGate, Skeleton } from "@/design-system";
import type { NormalizedApiError } from "@/lib/api/errors";
import { useI18n } from "@/i18n/I18nContext";

export interface TradeDocumentListBoundaryProps {
  isLoading: boolean;
  error: NormalizedApiError | null;
  /** Table owns its empty surface so server pagination remains available. */
  recordCount: number | undefined;
  permission: string;
  emptyTitle: string;
  errorTitle: string;
  onRetry: () => void;
  children: ReactNode;
}

/** All list views replace unavailable records with the same authoritative state. */
export function TradeDocumentListBoundary({
  isLoading, error, recordCount, permission, emptyTitle, errorTitle, onRetry, children,
}: TradeDocumentListBoundaryProps) {
  const { t } = useI18n();
  if (isLoading) {
    return <div role="status" aria-busy="true" aria-label={t.common.loading} className="space-y-3">
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-48 w-full" />
    </div>;
  }
  if (error?.status === 403) {
    return <PermissionGate require={permission} denied>{null}</PermissionGate>;
  }
  if (error) {
    return <ErrorState title={errorTitle} onRetry={onRetry} retryLabel={t.common.retry} />;
  }
  if (recordCount === 0) return <EmptyState title={emptyTitle} />;
  return <>{children}</>;
}
