"use client";

import Link from "next/link";
import {
  AlertCircle,
  ArrowUpRight,
  CheckCircle2,
  FlaskConical,
  History,
  Lock,
  ShieldAlert,
  ShieldCheck,
  Users,
} from "lucide-react";
import { Badge, Button, IdentifierText } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatDateTime } from "@/lib/format/date";
import { formatNumber } from "@/lib/format/number";
import { TENANT_ROUTES } from "@/lib/navigation/tenant-routes";
import { tradeStatusLabel } from "../../trade-advanced-validation";
import type {
  GovernanceAuditEvent,
  PriceBookDetail,
  PriceBookVersionDetail,
  PriceBookVersionTestReport,
} from "../pricing-contract";
import { localizedAuditAction } from "../pricing-messages";
import { usePricingClock } from "./usePricingClock";
import type { PriceBookVersionDraft } from "../version-draft";
import {
  deriveVersionTemporalState,
  resolveVersionPublisher,
  resolveVersionRetirement,
} from "../version-temporal";
import type { VersionPendingAction } from "./useVersionWorkspaceController";

interface VersionGovernanceSideRailProps {
  detail: PriceBookVersionDetail;
  bookDetail?: PriceBookDetail | null;
  draft: PriceBookVersionDraft | null;
  isDirty: boolean;
  canTest: boolean;
  canPublish: boolean;
  canPublishGrant: boolean;
  isMakerSameAsActor: boolean;
  soloEligible: boolean;
  savedEvidenceMatchesChecksum: boolean;
  isOffline: boolean;
  pending: VersionPendingAction;
  testReport: PriceBookVersionTestReport | null;
  onRunTest: () => void;
  onOpenPublish: () => void;
}

export function VersionGovernanceSideRail({
  detail,
  bookDetail,
  draft,
  isDirty,
  canTest,
  canPublish,
  canPublishGrant,
  isMakerSameAsActor,
  soloEligible,
  savedEvidenceMatchesChecksum,
  isOffline,
  pending,
  testReport,
  onRunTest,
  onOpenPublish,
}: VersionGovernanceSideRailProps) {
  const { t, lang } = useI18n();
  const auditTrail: readonly GovernanceAuditEvent[] =
    bookDetail?.auditTrail ?? detail.auditTrail ?? [];
  const now = usePricingClock([detail.version.effectiveFrom, detail.version.effectiveTo, detail.version.supersededAt]);
  const temporal = deriveVersionTemporalState(detail.version, now);
  const publisher = resolveVersionPublisher(detail.version.id, auditTrail);
  const retirement = resolveVersionRetirement(detail.version.id, auditTrail);
  const report = testReport ?? detail.latestTestEvidence?.report ?? null;

  return (
    <aside className="flex flex-col gap-3">
      <section className="flex flex-col gap-2.5 rounded-card border border-border bg-card p-3.5 text-xs">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-semibold text-foreground">{t.tradePricing.versionKpiGovernance}</h3>
          <Badge tone={temporal.isEffectiveNow ? "positive" : detail.version.status === "TESTED" ? "caution" : "neutral"}>
            {tradeStatusLabel(t.tradeStatus, detail.version.status, t.common.unknownCode)}
          </Badge>
        </div>

        <dl className="flex flex-col gap-1.5 text-muted-foreground">
          <div className="flex items-center justify-between gap-2">
            <dt>{t.tradePricing.makerIdentityLabel}</dt>
            <dd className="truncate font-medium text-foreground">{detail.version.createdByDisplayName ?? "—"}</dd>
          </div>
          {publisher ? (
            <div className="flex items-center justify-between gap-2">
              <dt>{t.tradePricing.publishedByLabel}</dt>
              <dd className="truncate font-medium text-foreground">{publisher.actorDisplayName ?? publisher.actorEmail ?? "—"}</dd>
            </div>
          ) : null}
          <div className="flex items-center justify-between gap-2">
            <dt>{t.tradePricing.effectiveFrom}</dt>
            <dd className="font-medium text-foreground">{formatDateTime(detail.version.effectiveFrom, lang)}</dd>
          </div>
          <div className="flex items-center justify-between gap-2">
            <dt>{t.tradePricing.effectiveTo}</dt>
            <dd className="font-medium text-foreground">
              {detail.version.effectiveTo ? formatDateTime(detail.version.effectiveTo, lang) : t.tradePricing.openEndedWindow}
            </dd>
          </div>
        </dl>

        {detail.version.status === "RETIRED" || retirement ? (
          <div className="flex flex-col gap-1 rounded-lg border border-border bg-muted/40 p-2.5 text-caption text-muted-foreground">
            <span className="text-xs font-semibold text-foreground">{t.tradePricing.retiredCardTitle}</span>
            {retirement ? (
              <>
                <span>
                  {t.tradePricing.retiredByLabel}:{" "}
                  <strong className="font-medium text-foreground">{retirement.actorDisplayName ?? retirement.actorEmail ?? "—"}</strong>
                </span>
                <span>{t.tradePricing.retiredAtLabel}: {formatDateTime(retirement.occurredAt, lang)}</span>
                <span>{t.tradePricing.retiredReasonLabel}: {retirement.reason || t.tradePricing.noReasonRecorded}</span>
              </>
            ) : (
              <span>{t.tradePricing.noReasonRecorded}</span>
            )}
          </div>
        ) : null}
      </section>

      <section className="flex flex-col gap-2.5 rounded-card border border-border bg-card p-3.5 text-xs">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-semibold text-foreground">{t.tradePricing.latestSavedTestTitle}</h3>
          {report ? (
            <Badge tone={report.passed ? "positive" : "negative"}>
              {report.passed ? t.tradePricing.testPassedShort : t.tradePricing.testFailedShort}
            </Badge>
          ) : null}
        </div>

        {isDirty && draft ? (
          <div className="rounded-md border border-warning/30 bg-warning-subtle px-2.5 py-2 text-caption text-warning-subtle-foreground">
            {t.tradePricing.savedTestOutdatedByDraft.replace("{count}", formatNumber(draft.entries.length, lang))}
          </div>
        ) : null}

        {report ? (
          <div className="flex flex-col gap-1.5 text-muted-foreground">
            <div className="flex items-center justify-between gap-2">
              <span>{t.tradePricing.entries}</span>
              <IdentifierText className="text-xs font-medium text-foreground">{formatNumber(report.entryCount, lang)}</IdentifierText>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span>{t.tradePricing.promotions}</span>
              <IdentifierText className="text-xs font-medium text-foreground">{formatNumber(report.promotionCount, lang)}</IdentifierText>
            </div>
            {detail.latestTestEvidence ? (
              <div className="flex items-center gap-1.5 text-caption">
                {savedEvidenceMatchesChecksum ? (
                  <>
                    <CheckCircle2 className="size-3.5 shrink-0 text-success-subtle-foreground" aria-hidden="true" />
                    <span className="text-success-subtle-foreground">{t.tradePricing.publishChecksumVerified}</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="size-3.5 shrink-0 text-warning-subtle-foreground" aria-hidden="true" />
                    <span className="text-warning-subtle-foreground">{t.tradePricing.savedTestChecksumMismatch}</span>
                  </>
                )}
              </div>
            ) : null}
            {!report.passed && report.entryCount === 0 ? (
              <p className="rounded-md bg-destructive-subtle px-2.5 py-1.5 text-caption text-destructive-subtle-foreground">
                {t.tradePricing.savedTestZeroEntriesFailed}
              </p>
            ) : null}
          </div>
        ) : (
          <p className="text-caption text-muted-foreground">{t.tradePricing.noSavedTestYet}</p>
        )}

        <div className="flex flex-wrap items-center gap-2 pt-1">
          {detail.version.status === "DRAFT" || detail.version.status === "TESTED" ? (
            <Button size="xs" variant="outline" disabled={!canTest || isOffline || pending !== null} loading={pending === "test"} onClick={onRunTest}>
              <FlaskConical className="me-1 size-3.5" aria-hidden="true" />
              {t.tradePricing.runTest}
            </Button>
          ) : null}
          {detail.version.status === "TESTED" ? (
            <Button size="xs" variant="outline" disabled={isOffline || pending !== null} onClick={onOpenPublish}>
              <ShieldCheck className="me-1 size-3.5" aria-hidden="true" />
              {t.tradePricing.publishScheduleAction}
            </Button>
          ) : null}
        </div>
      </section>

      {detail.version.status === "TESTED" && isMakerSameAsActor && !soloEligible ? (
        <div className="flex items-start gap-2 rounded-card border border-warning/30 bg-warning-subtle p-3 text-xs text-warning-subtle-foreground">
          <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>{t.tradePricing.selfApprovalBlockedBanner}</span>
        </div>
      ) : null}

      {detail.version.status === "TESTED" && !canPublishGrant && !canPublish ? (
        <div className="rounded-card border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
          {t.tradePricing.publishNeedsPolicyGrant}
        </div>
      ) : null}

      {detail.version.status === "DRAFT" || detail.version.status === "TESTED" ? (
        <section className="flex flex-col gap-1.5 rounded-card border border-border bg-card p-3.5 text-xs">
        <h3 className="font-semibold text-foreground">{t.tradePricing.nextStepsHeading}</h3>
        <p className="text-caption text-muted-foreground">{t.tradePricing.nextStep1Author}</p>
        <p className="text-caption text-muted-foreground">{t.tradePricing.nextStep2Test}</p>
        <p className="text-caption text-muted-foreground">{t.tradePricing.nextStep3Publish}</p>
      </section>
      ) : null}

      {bookDetail ? (
        <section className="flex flex-col gap-2 rounded-card border border-border bg-card p-3.5 text-xs">
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 font-semibold text-foreground">
              <Users className="size-3.5 text-muted-foreground" aria-hidden="true" />
              {t.tradePricing.linkedAccountsTitle}
            </span>
            <Badge tone="neutral">{formatNumber(bookDetail.linkedAccounts.length, lang)}</Badge>
          </div>
          <p className="text-caption text-muted-foreground">
            {bookDetail.linkedAccounts.length === 0 ? t.tradePricing.linkedAccountsEmpty : t.tradePricing.linkedAccountsCappedHint}
          </p>
          <Button size="xs" variant="link" asChild className="justify-start px-0">
            <Link href={TENANT_ROUTES.tradeCommercialAccounts}>
              {t.tradePricing.manageAccountsLink}
              <ArrowUpRight className="ms-1 size-3" aria-hidden="true" />
            </Link>
          </Button>
          <div className="border-t border-border pt-2">
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
                <Lock className="size-3.5 text-muted-foreground" aria-hidden="true" />
                {t.tradePricing.activePriceLocksTitle}
              </span>
              <Badge tone="neutral">{formatNumber(bookDetail.activeLocksCount, lang)}</Badge>
            </div>
            <p className="mt-1 text-caption text-muted-foreground">{t.tradePricing.activeLocksInfoNote}</p>
          </div>
        </section>
      ) : null}

      {auditTrail.length > 0 ? (
        <section className="flex flex-col gap-2 rounded-card border border-border bg-card p-3.5 text-xs">
          <div className="flex items-center gap-1.5 font-semibold text-foreground">
            <History className="size-3.5 text-muted-foreground" aria-hidden="true" />
            <h3>{t.tradePricing.governanceAuditTitle}</h3>
          </div>
          <ul className="flex flex-col gap-2">
            {auditTrail.slice(0, 5).map((ev) => (
              <li key={ev.id} className="flex flex-col gap-0.5 border-b border-border pb-1.5 last:border-b-0 last:pb-0">
                <span className="font-medium text-foreground">{localizedAuditAction(ev.action, t.tradePricing)}</span>
                <span className="text-caption text-muted-foreground">
                  {(ev.actorDisplayName ?? ev.actorEmail ?? "—")} · {formatDateTime(ev.occurredAt, lang)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </aside>
  );
}
