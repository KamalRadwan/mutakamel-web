"use client";

import { AlertTriangle, CheckCircle2, FlaskConical, ShieldCheck } from "lucide-react";
import {
  Badge,
  Button,
  IdentifierText,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatDateTime } from "@/lib/format/date";
import { formatNumber } from "@/lib/format/number";
import type {
  PriceBookVersionDetail,
  PriceBookVersionTestReport,
} from "../../../price-books/pricing-contract";
import { formatDraftValidationIssue } from "../../../price-books/pricing-messages";
import type { VersionDraftConflictReport } from "../../../price-books/version-draft";

export interface VersionTestReadinessPanelProps {
  detail: PriceBookVersionDetail;
  canTest: boolean;
  isTesting: boolean;
  isDirty?: boolean;
  draftEntryCount?: number;
  savedEvidenceMatchesChecksum?: boolean;
  conflictReport: VersionDraftConflictReport | null;
  testReport: PriceBookVersionTestReport | null;
  onRunTest: () => Promise<void> | void;
}

export function VersionTestReadinessPanel({
  detail,
  canTest,
  isTesting,
  isDirty = false,
  draftEntryCount = 0,
  savedEvidenceMatchesChecksum = false,
  conflictReport,
  testReport,
  onRunTest,
}: VersionTestReadinessPanelProps) {
  const { t, lang } = useI18n();
  const report = testReport ?? detail.latestTestEvidence?.report ?? null;

  return (
    <div className="flex flex-col gap-3">
      {/* 1. Local Pre-flight Validation Radar */}
      <section className="flex flex-col gap-2.5 rounded-card border border-border bg-card p-4 text-xs">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-semibold text-foreground">{t.tradePricing.conflictRadarTitle}</h3>
          <Badge tone={conflictReport?.hasConflicts ? "negative" : "positive"}>
            {conflictReport?.hasConflicts
              ? t.tradePricing.testFailedShort
              : t.tradePricing.testPassedShort}
          </Badge>
        </div>
        {conflictReport?.issues && conflictReport.issues.length > 0 ? (
          <ul className="list-disc space-y-1 ps-5 text-destructive-subtle-foreground">
            {conflictReport.issues.slice(0, 15).map((issue) => (
              <li key={issue.id}>{formatDraftValidationIssue(issue, t.tradePricing)}</li>
            ))}
          </ul>
        ) : (
          <div className="flex items-center gap-2 text-success-subtle-foreground">
            <ShieldCheck className="size-4 shrink-0" aria-hidden="true" />
            <span>{t.tradePricing.conflictRadarClean}</span>
          </div>
        )}
      </section>

      {/* 2. Saved Server Test Evidence */}
      <section className="flex flex-col gap-3 rounded-card border border-border bg-card p-4 text-xs">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-foreground">{t.tradePricing.latestSavedTestTitle}</h3>
            {detail.latestTestEvidence ? (
              <span className="text-caption text-muted-foreground">
                {formatDateTime(detail.latestTestEvidence.testedAt, lang)}
              </span>
            ) : null}
          </div>
          <Button
            size="sm"
            variant="outline"
            disabled={!canTest || isTesting}
            loading={isTesting}
            onClick={() => void onRunTest()}
          >
            <FlaskConical className="me-1.5 size-3.5" aria-hidden="true" />
            {t.tradePricing.runTest}
          </Button>
        </div>

        {isDirty ? (
          <div className="rounded-lg border border-warning/30 bg-warning-subtle px-3 py-2 text-warning-subtle-foreground">
            {t.tradePricing.savedTestOutdatedByDraft.replace(
              "{count}",
              formatNumber(draftEntryCount, lang),
            )}
          </div>
        ) : null}

        {report ? (
          <div
            role={report.passed ? "status" : "alert"}
            className="flex flex-col gap-2.5 rounded-lg border border-border bg-surface-subtle p-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Badge tone={report.passed ? "positive" : "negative"}>
                {report.passed ? t.tradePricing.testPassedShort : t.tradePricing.testFailedShort}
              </Badge>
              <div className="flex items-center gap-3 text-caption text-muted-foreground">
                <span>
                  {t.tradePricing.entries}:{" "}
                  <IdentifierText className="text-caption font-medium text-foreground">
                    {formatNumber(report.entryCount, lang)}
                  </IdentifierText>
                </span>
                <span>
                  {t.tradePricing.promotions}:{" "}
                  <IdentifierText className="text-caption font-medium text-foreground">
                    {formatNumber(report.promotionCount, lang)}
                  </IdentifierText>
                </span>
              </div>
            </div>

            {report.entryCount === 0 && !report.passed ? (
              <p className="text-destructive-subtle-foreground">{t.tradePricing.noEntries}</p>
            ) : null}

            {report.conflicts.length > 0 ? (
              <div className="flex flex-col gap-1">
                <h4 className="font-semibold text-foreground">{t.tradePricing.entryConflicts}</h4>
                <ul aria-label={t.tradePricing.entryConflicts} className="flex flex-col gap-1">
                  {report.conflicts.map((conflict, idx) => (
                    <li key={`${conflict}-${idx}`}>
                      <IdentifierText className="text-xs text-destructive">{conflict}</IdentifierText>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {report.promotionConflicts.length > 0 ? (
              <div className="flex flex-col gap-1">
                <h4 className="font-semibold text-foreground">{t.tradePricing.promotionConflicts}</h4>
                <ul aria-label={t.tradePricing.promotionConflicts} className="flex flex-col gap-1">
                  {report.promotionConflicts.map((conflict, idx) => (
                    <li key={`${conflict}-${idx}`}>
                      <IdentifierText className="text-xs text-destructive">{conflict}</IdentifierText>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : (
          <p className="text-muted-foreground">{t.tradePricing.noSavedTestYet}</p>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-2.5 text-caption text-muted-foreground">
          <span>
            {t.tradePricing.checksumLabel}:{" "}
            <IdentifierText className="text-caption">{detail.version.checksum.slice(0, 24)}…</IdentifierText>
          </span>
          {detail.latestTestEvidence ? (
            <span className="inline-flex items-center gap-1">
              {savedEvidenceMatchesChecksum ? (
                <>
                  <CheckCircle2 className="size-3.5 text-success-subtle-foreground" aria-hidden="true" />
                  <span className="text-success-subtle-foreground">{t.tradePricing.publishChecksumVerified}</span>
                </>
              ) : (
                <>
                  <AlertTriangle className="size-3.5 text-warning-subtle-foreground" aria-hidden="true" />
                  <span className="text-warning-subtle-foreground">{t.tradePricing.savedTestChecksumMismatch}</span>
                </>
              )}
            </span>
          ) : null}
        </div>
      </section>
    </div>
  );
}
