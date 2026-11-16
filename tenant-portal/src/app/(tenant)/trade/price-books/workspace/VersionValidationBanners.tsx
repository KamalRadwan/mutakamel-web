"use client";

import { useRef } from "react";
import { AlertCircle, CheckCircle2, RefreshCw, RotateCcw, Save } from "lucide-react";
import { Button, PermissionGate } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatNumber } from "@/lib/format/number";
import type { NormalizedApiError } from "@/lib/api/errors";
import { formatDraftValidationIssue } from "../pricing-messages";
import type { DraftValidationIssue } from "../version-draft";
import type { AmbiguousMutationState } from "./idempotent-mutation";
import type { VersionPendingAction } from "./useVersionWorkspaceController";
import { PriceBookWriteRecovery } from "./PriceBookWriteRecovery";

interface VersionValidationBannersProps {
  isRefreshing?: boolean;
  versionError?: NormalizedApiError | null;
  onRetryVersion?: () => void;
  mutationError?: NormalizedApiError | null;
  mutationPermission?: string;
  isDirty: boolean;
  canManage: boolean;
  isOffline: boolean;
  pending: VersionPendingAction;
  issues: readonly DraftValidationIssue[];
  referenceError: NormalizedApiError | null;
  ambiguous: AmbiguousMutationState | null;
  replayNotice: string | null;
  onSaveDraft: () => void;
  onDiscardDraft: () => void;
  onRetryReference: () => void;

  onJumpToIssue: (issue: DraftValidationIssue) => void;
}

export function VersionValidationBanners({
  isDirty,
  canManage,
  isOffline,
  pending,
  issues,
  referenceError,
  ambiguous,
  replayNotice,
  onSaveDraft,
  onDiscardDraft,
  onRetryReference,

  onJumpToIssue,
  mutationError,
  mutationPermission,
  versionError,
  isRefreshing,
  onRetryVersion,
}: VersionValidationBannersProps) {
  const { t, lang } = useI18n();
  const errorSummaryRef = useRef<HTMLDivElement | null>(null);

  return (
    <div className="flex flex-col gap-2.5">
      {versionError ? (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-warning/30 bg-warning-subtle p-3 text-xs text-warning-subtle-foreground">
          <span>{t.tradePricing.versionLoadFailed}</span>
          <Button size="xs" variant="outline" onClick={onRetryVersion}>{t.common.retry}</Button>
        </div>
      ) : null}
      {mutationError?.status === 403 && mutationPermission ? <PermissionGate require={mutationPermission} denied>{null}</PermissionGate> : null}
      {ambiguous ? (
        <PriceBookWriteRecovery command={ambiguous} pending={pending !== null} />
      ) : null}

      {replayNotice ? (
        <div
          role="status"
          className="flex items-center gap-2 rounded-lg border border-info/30 bg-info-subtle px-3.5 py-2 text-xs text-info-subtle-foreground"
        >
          <CheckCircle2 className="size-4 shrink-0" aria-hidden="true" />
          <span>{replayNotice}</span>
        </div>
      ) : null}

      {referenceError ? (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-warning/30 bg-warning-subtle px-3.5 py-2.5 text-xs"
        >
          <div className="flex items-start gap-2">
            <AlertCircle className="mt-0.5 size-4 shrink-0 text-warning-subtle-foreground" aria-hidden="true" />
            <div>
              <p className="font-semibold text-foreground">
                {t.tradePricing.referenceDataPartialErrorTitle}
              </p>
              <p className="text-muted-foreground">
                {t.tradePricing.referenceDataPartialErrorDesc}
              </p>
            </div>
          </div>
          <Button size="xs" variant="outline" onClick={onRetryReference}>
            <RefreshCw className="me-1 size-3" aria-hidden="true" />
            {t.common.retry}
          </Button>
        </div>
      ) : null}

      {isDirty && canManage ? (
        <div
          role="status"
          className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-warning/30 bg-warning-subtle px-3.5 py-2 text-xs"
        >
          <span className="font-medium text-foreground">
            {t.tradePricing.dirtyTestedResetNotice}
          </span>
          <div className="flex items-center gap-2">
            <Button
              size="xs"
              variant="outline"
              disabled={pending !== null || ambiguous !== null || Boolean(versionError) || isRefreshing}
              onClick={onDiscardDraft}
            >
              <RotateCcw className="me-1 size-3" aria-hidden="true" />
              {t.tradePricing.discardDraftChanges}
            </Button>
            <Button
              size="xs"
              variant="secondary"
              disabled={isOffline || pending !== null || ambiguous !== null || Boolean(versionError) || isRefreshing || issues.length > 0}
              loading={pending === "save"}
              onClick={onSaveDraft}
            >
              <Save className="me-1 size-3" aria-hidden="true" />
              {t.tradePricing.saveDraftChanges}
            </Button>
          </div>
        </div>
      ) : null}

      {canManage && issues.length > 0 ? (
        <div
          ref={errorSummaryRef}
          tabIndex={-1}
          role="alert"
          aria-labelledby="version-validation-summary-title"
          className="flex flex-col gap-2 rounded-lg border border-destructive/30 bg-destructive-subtle px-3.5 py-3 text-xs"
        >
          <div className="flex items-center gap-2 font-semibold text-destructive-subtle-foreground">
            <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
            <span id="version-validation-summary-title">
              {t.tradePricing.fixValidationIssuesTitle.replace(
                "{count}",
                formatNumber(issues.length, lang),
              )}
            </span>
          </div>
          <ul className="flex max-h-40 flex-col gap-1 overflow-y-auto ps-5 list-disc">
            {issues.slice(0, 25).map((issue) => (
              <li key={issue.id} className="text-foreground">
                <Button
                  type="button"
                  variant="link"
                  size="xs"
                  onClick={() => onJumpToIssue(issue)}
                  className="text-start font-normal text-destructive-subtle-foreground"
                >
                  {formatDraftValidationIssue(issue, t.tradePricing)}
                </Button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
