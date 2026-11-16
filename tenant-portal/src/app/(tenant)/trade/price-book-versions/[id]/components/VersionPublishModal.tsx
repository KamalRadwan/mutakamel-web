"use client";

import { AlertTriangle, CalendarClock, CheckCircle2, ShieldAlert, ShieldCheck, XCircle } from "lucide-react";
import {
  Badge,
  Button,
  Checkbox,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
  IdentifierText,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatDateTime } from "@/lib/format/date";
import { tradeStatusLabel } from "../../../trade-advanced-validation";
import { usePricingClock } from "../../../price-books/workspace/usePricingClock";
import {
  SOLO_OWNER_APPROVAL_NOTES_MAX_LENGTH,
  type PriceBookVersionDetail,
} from "../../../price-books/pricing-contract";
import {
  eligiblePredecessorVersions,
  findOverlappingActiveVersions,
  type TemporalVersionInput,
} from "../../../price-books/version-temporal";

const NO_SUPERSEDE = "__NONE__";
const REASONS_DOM_ID = "modal-publish-disabled-reasons";

interface VersionPublishModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  detail: PriceBookVersionDetail;
  siblingVersions?: readonly TemporalVersionInput[];
  currentUserId?: string;
  currentUserDisplayName?: string;
  currentUserEmail?: string;
  canPublishGrant: boolean;
  savedEvidenceMatchesChecksum: boolean;
  canPublish: boolean;
  publishDisabledReasons: string[];
  supersedesVersionId: string;
  onChangeSupersedesVersionId: (id: string) => void;
  soloOwnerAttestation: boolean;
  onChangeSoloOwnerAttestation: (checked: boolean) => void;
  approvalNotes: string;
  onChangeApprovalNotes: (notes: string) => void;
  isPublishing: boolean;
  onConfirmPublish: () => Promise<boolean | void>;
}

export function VersionPublishModal({
  open,
  onOpenChange,
  detail,
  siblingVersions,
  currentUserId,
  currentUserDisplayName,
  currentUserEmail,
  canPublishGrant,
  savedEvidenceMatchesChecksum,
  canPublish,
  publishDisabledReasons,
  supersedesVersionId,
  onChangeSupersedesVersionId,
  soloOwnerAttestation,
  onChangeSoloOwnerAttestation,
  approvalNotes,
  onChangeApprovalNotes,
  isPublishing,
  onConfirmPublish,
}: VersionPublishModalProps) {
  const { t, lang } = useI18n();
  const ver = detail.version;
  const allVersions: readonly TemporalVersionInput[] = siblingVersions ?? detail.book.versions ?? [];
  const now = usePricingClock([ver.effectiveFrom, ver.effectiveTo, ...allVersions.flatMap(version => [version.effectiveFrom, version.effectiveTo, version.supersededAt])]);

  const isSameMaker = Boolean(currentUserId && ver.createdByUserId === currentUserId);
  const soloEligible = Boolean(detail.soloOwnerGovernanceEligible);
  const makerCheckerOk = !isSameMaker || (soloEligible && soloOwnerAttestation);

  const startsAtMs = Date.parse(ver.effectiveFrom);
  const isFutureStart = !Number.isNaN(startsAtMs) && startsAtMs > now;

  const pred = eligiblePredecessorVersions(allVersions, ver, now);
  const selectedPred = pred.eligible.find((v) => v.id === supersedesVersionId) ?? null;
  const overlapping = findOverlappingActiveVersions(allVersions, ver, selectedPred?.id ?? null);

  const checklist = [
    { label: t.tradePricing.checkSavedTestPassed, ok: Boolean(detail.latestTestEvidence?.passed) },
    { label: t.tradePricing.checkChecksumMatches, ok: savedEvidenceMatchesChecksum },
    { label: t.tradePricing.checkPublishPermission, ok: canPublishGrant },
    { label: t.tradePricing.checkMakerChecker, ok: makerCheckerOk },
  ];

  return (
    <Dialog open={open} onOpenChange={(next) => (isPublishing ? undefined : onOpenChange(next))}>
      <DialogContent size="2xl" className="max-h-[92dvh] overflow-y-auto p-4 sm:p-5">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="size-4 text-primary" aria-hidden="true" />
            {t.tradePricing.publishModalTitle}
          </DialogTitle>
          <DialogDescription>{t.tradePricing.publishModalSubtitle}</DialogDescription>
        </DialogHeader>

        <section className="flex flex-col gap-2 rounded-card border border-border bg-surface-subtle p-3.5 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <IdentifierText className="font-semibold text-foreground">
                {`${detail.book.code} · v${ver.versionNumber}`}
              </IdentifierText>
              <Badge tone="neutral">{detail.book.currencyCode}</Badge>
            </div>
            <Badge tone={isFutureStart ? "brand" : "positive"}>
              {tradeStatusLabel(t.tradeStatus, isFutureStart ? "SCHEDULED" : "PUBLISHED", t.common.unknownCode)}
            </Badge>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-muted-foreground">
            <CalendarClock className="size-3.5 shrink-0" aria-hidden="true" />
            <span>
              {`${formatDateTime(ver.effectiveFrom, lang)} → ${ver.effectiveTo ? formatDateTime(ver.effectiveTo, lang) : t.tradePricing.openEndedWindow}`}
            </span>
          </div>
          <p className="font-medium text-foreground">
            {isFutureStart
              ? t.tradePricing.publishScheduledOutcomeNotice.replace("{date}", formatDateTime(ver.effectiveFrom, lang))
              : t.tradePricing.publishImmediateOutcomeNotice}
          </p>
          <p className="text-caption text-muted-foreground">{t.tradePricing.publishDatesLockedHint}</p>
        </section>

        <section className="flex flex-col gap-2">
          <h3 className="text-xs font-semibold text-foreground">{t.tradePricing.publishReadinessChecklistTitle}</h3>
          <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            {checklist.map((item) => (
              <li key={item.label} className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-xs">
                {item.ok ? (
                  <CheckCircle2 className="size-4 shrink-0 text-success-subtle-foreground" aria-hidden="true" />
                ) : (
                  <XCircle className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                )}
                <span className="text-foreground">{item.label}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="flex flex-col gap-2.5 rounded-card border border-border bg-card p-3.5 text-xs">
          <Field label={t.tradePricing.supersedesSelectLabel} hint={t.tradeCommon.supersedesVersionHint} showLabel>
            <Select
              disabled={isPublishing || pred.eligible.length === 0}
              value={selectedPred ? selectedPred.id : NO_SUPERSEDE}
              onValueChange={(val) => onChangeSupersedesVersionId(val === NO_SUPERSEDE ? "" : val)}
            >
              <SelectTrigger size="sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_SUPERSEDE}>{t.tradePricing.supersedesNoneOption}</SelectItem>
                {pred.eligible.map((cand) => (
                  <SelectItem key={cand.id} value={cand.id}>
                    {`v${cand.versionNumber} · ${tradeStatusLabel(t.tradeStatus, cand.status, t.common.unknownCode)} (${formatDateTime(cand.effectiveFrom, lang)})`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          {pred.retroactiveBlocked && pred.candidates[0] ? (
            <div className="flex items-start gap-2 rounded-md border border-warning/30 bg-warning-subtle px-3 py-2 text-warning-subtle-foreground">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <span>
                {t.tradePricing.retroactiveSupersessionBlockedNotice.replace("{version}", String(pred.candidates[0].versionNumber))}
              </span>
            </div>
          ) : null}

          {selectedPred ? (
            <div className="flex flex-col gap-1 rounded-md border border-info/30 bg-info-subtle px-3 py-2 text-info-subtle-foreground">
              <span>
                {t.tradePricing.transitionOldClosesAt
                  .replace("{version}", String(selectedPred.versionNumber))
                  .replace("{date}", formatDateTime(ver.effectiveFrom, lang))}
              </span>
              <span>
                {t.tradePricing.transitionNewStartsAt
                  .replace("{version}", String(ver.versionNumber))
                  .replace("{date}", formatDateTime(ver.effectiveFrom, lang))}
              </span>
            </div>
          ) : null}

          {overlapping[0] ? (
            <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive-subtle px-3 py-2 text-destructive-subtle-foreground">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <span>
                {t.tradePricing.overlapWarningBanner
                  .replace("{version}", String(overlapping[0].versionNumber))
                  .replace("{date}", formatDateTime(ver.effectiveFrom, lang))}
              </span>
            </div>
          ) : null}
        </section>

        <section className="flex flex-col gap-2.5 rounded-card border border-border bg-card p-3.5 text-xs">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div className="rounded-md border border-border bg-surface-subtle px-3 py-2">
              <span className="text-caption text-muted-foreground">{t.tradePricing.makerIdentityLabel}</span>
              <p className="font-medium text-foreground">{ver.createdByDisplayName ?? ver.createdByEmail ?? "—"}</p>
            </div>
            <div className="rounded-md border border-border bg-surface-subtle px-3 py-2">
              <span className="text-caption text-muted-foreground">{t.tradePricing.checkerIdentityLabel}</span>
              <p className="font-medium text-foreground">{currentUserDisplayName ?? currentUserEmail ?? "—"}</p>
            </div>
          </div>

          {isSameMaker && !soloEligible ? (
            <div className="flex items-start gap-2 rounded-md border border-warning/30 bg-warning-subtle px-3 py-2.5 text-warning-subtle-foreground">
              <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <span>{t.tradePricing.selfApprovalBlockedBanner}</span>
            </div>
          ) : isSameMaker && soloEligible ? (
            <div className="flex flex-col gap-2.5 rounded-md border border-warning/30 bg-warning-subtle/50 p-3">
              <label className="flex cursor-pointer items-start gap-2.5">
                <Checkbox
                  checked={soloOwnerAttestation}
                  disabled={isPublishing}
                  onCheckedChange={(val) => onChangeSoloOwnerAttestation(val === true)}
                  className="mt-0.5"
                />
                <span className="text-xs text-foreground">{t.tradePricing.soloOwnerAttestationLabel}</span>
              </label>
              <Field label={t.tradeGovernance.reason} hint={t.tradeGovernance.reasonHint} showLabel>
                <Textarea
                  rows={2}
                  maxLength={SOLO_OWNER_APPROVAL_NOTES_MAX_LENGTH}
                  disabled={isPublishing || !soloOwnerAttestation}
                  value={approvalNotes}
                  placeholder={t.tradePricing.soloOwnerApprovalNotesPlaceholder}
                  onChange={(e) => onChangeApprovalNotes(e.target.value)}
                />
              </Field>
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-md border border-success/30 bg-success-subtle px-3 py-2 text-success-subtle-foreground">
              <CheckCircle2 className="size-4 shrink-0" aria-hidden="true" />
              <span>{t.tradePricing.readyForCheckerPublishBanner}</span>
            </div>
          )}
        </section>

        {publishDisabledReasons.length > 0 ? (
          <ul
            id={REASONS_DOM_ID}
            aria-live="polite"
            className="flex flex-col gap-1 rounded-md border border-border bg-muted/40 px-4 py-2.5 ps-7 text-xs text-muted-foreground list-disc"
          >
            {publishDisabledReasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        ) : null}

        <DialogFooter>
          <Button size="sm" variant="outline" disabled={isPublishing} onClick={() => onOpenChange(false)}>
            {t.common.cancel}
          </Button>
          <Button
            size="sm"
            variant="primary"
            loading={isPublishing}
            disabled={!canPublish || isPublishing}
            aria-describedby={!canPublish && publishDisabledReasons.length > 0 ? REASONS_DOM_ID : undefined}
            onClick={() => {
              void onConfirmPublish().then((ok) => {
                if (ok !== false) onOpenChange(false);
              });
            }}
          >
            {t.tradePricing.confirmPublishAction}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
