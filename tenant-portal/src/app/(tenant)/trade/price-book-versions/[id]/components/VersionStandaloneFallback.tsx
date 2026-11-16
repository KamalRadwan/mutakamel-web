"use client";

import Link from "next/link";
import {
  Calculator,
  FlaskConical,
  MoreHorizontal,
  Play,
  RotateCcw,
  Save,
  Send,
  ShieldCheck,
  Trash2,
  XCircle,
} from "lucide-react";
import {
  Badge,
  Button,
  DetailHeader,
  DetailSection,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Field,
  IdentifierText,
  Input,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { TENANT_ROUTES } from "@/lib/navigation/tenant-routes";
import {
  localizedBookDisplayName,
  type PriceBookVersionDetail,
  type PriceBookVersionTestReport,
} from "../../../price-books/pricing-contract";
import type { VersionPendingAction } from "../../../price-books/workspace/useVersionWorkspaceController";

interface VersionDetailHeaderBarProps {
  isUnavailable?: boolean;
  detail: PriceBookVersionDetail;
  backHref: string;
  hasDraft: boolean;
  isDirty: boolean;
  isOffline: boolean;
  canManage: boolean;
  canTest: boolean;
  canPublish: boolean;
  canPublishGrant?: boolean;
  canRetire: boolean;
  canDeleteDraft: boolean;
  publishDisabledReasons: readonly string[];
  pending: VersionPendingAction;
  onSaveDraft: () => void;
  onDiscardDraft?: () => void;
  onRunTest: () => void;
  onOpenPublishModal: () => void;
  onDirectPublish: () => void;
  onOpenRetire: () => void;
  onOpenDeleteDraft: () => void;
}

export function VersionDetailHeaderBar({
  isUnavailable = false,
  detail,
  backHref,
  hasDraft,
  isDirty,
  isOffline,
  canManage,
  canTest,
  canPublish,
  canPublishGrant = false,
  canRetire,
  canDeleteDraft,
  publishDisabledReasons,
  pending,
  onSaveDraft,
  onDiscardDraft,
  onRunTest,
  onOpenPublishModal,
  onDirectPublish,
  onOpenRetire,
  onOpenDeleteDraft,
}: VersionDetailHeaderBarProps) {
  const { t, lang } = useI18n();

  const resolvePrimaryAction = () => {
    if (!hasDraft) return undefined;
    if (isDirty && canManage) {
      return {
        label: t.tradePricing.saveDraftChanges,
        icon: <Save className="size-3.5" aria-hidden="true" />,
        disabled: isUnavailable || isOffline || pending !== null,
        loading: pending === "save",
        onClick: onSaveDraft,
      };
    }
    if (detail.version.status === "TESTED" && (canPublishGrant || canPublish || pending === "publish")) {
      return {
        label: t.tradePricing.publishScheduleAction,
        icon: <ShieldCheck className="size-3.5" aria-hidden="true" />,
        loading: pending === "publish",
        disabled: isOffline || pending !== null,
        onClick: onOpenPublishModal,
      };
    }
    if (detail.version.status === "DRAFT" && (canTest || pending === "test")) {
      return {
        label: t.tradePricing.runTest,
        icon: <Play className="size-3.5" aria-hidden="true" />,
        disabled: isOffline || pending !== null,
        loading: pending === "test",
        onClick: onRunTest,
      };
    }
    return undefined;
  };

  const evaluateHref = detail.book.id
    ? `${TENANT_ROUTES.tradePricing}?priceBookId=${encodeURIComponent(detail.book.id)}&purpose=${encodeURIComponent(detail.book.purpose)}&currencyCode=${encodeURIComponent(detail.book.currencyCode)}`
    : TENANT_ROUTES.tradePricing;

  return (
    <DetailHeader
      backHref={backHref}
      backLabel={detail.book.id ? t.tradePricing.backToBook : t.tradePricing.backToBooks}
      title={`${localizedBookDisplayName(detail.book, lang)} · v${detail.version.versionNumber}`}
      primaryAction={resolvePrimaryAction()}
      secondaryActions={
        <div className="flex flex-wrap items-center gap-2">
          {hasDraft && isDirty && onDiscardDraft ? (
            <Button size="sm" variant="outline" disabled={isUnavailable || pending !== null} onClick={onDiscardDraft}>
              <RotateCcw className="size-3.5" aria-hidden="true" />
              {t.tradePricing.discardDraftChanges}
            </Button>
          ) : null}
          {!hasDraft ? (
            <>
              <Button type="button" size="sm" variant="outline" disabled={!canTest || pending !== null} loading={pending === "test"} onClick={onRunTest}>
                <FlaskConical className="size-3.5" aria-hidden="true" />
                {t.tradePricing.runTest}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="primary"
                disabled={!canPublish || pending !== null}
                aria-describedby={!canPublish && publishDisabledReasons.length > 0 ? "price-book-publish-reasons" : undefined}
                loading={pending === "publish"}
                onClick={onDirectPublish}
              >
                <Send className="size-3.5" aria-hidden="true" />
                {t.tradeCommon.publish}
              </Button>
            </>
          ) : (
            <>
              <Button size="sm" variant="outline" asChild>
                <Link href={evaluateHref}>
                  <Calculator className="size-3.5" aria-hidden="true" />
                  {t.tradePricing.evaluateBookPrices}
                </Link>
              </Button>
              {canRetire || canDeleteDraft ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="sm" variant="outline" aria-label={t.tradePricing.moreActions}>
                      <MoreHorizontal className="size-4" aria-hidden="true" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {canRetire ? (
                      <DropdownMenuItem disabled={isOffline} onSelect={onOpenRetire}>
                        <XCircle className="me-2 size-3.5 text-destructive" aria-hidden="true" />
                        {t.tradePricing.retireVersionAction}
                      </DropdownMenuItem>
                    ) : null}
                    {canDeleteDraft ? (
                      <DropdownMenuItem disabled={isOffline} onSelect={onOpenDeleteDraft}>
                        <Trash2 className="me-2 size-3.5 text-destructive" aria-hidden="true" />
                        {t.tradePricing.deleteDraftAction}
                      </DropdownMenuItem>
                    ) : null}
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : null}
            </>
          )}
        </div>
      }
    />
  );
}

interface VersionStandaloneFallbackProps {
  canPublish: boolean;
  publishDisabledReasons: readonly string[];
  supersedesVersionId: string;
  onChangeSupersedesVersionId: (val: string) => void;
  pending: VersionPendingAction;
  testReport: PriceBookVersionTestReport | null;
}

export function VersionStandaloneFallback({
  canPublish,
  publishDisabledReasons,
  supersedesVersionId,
  onChangeSupersedesVersionId,
  pending,
  testReport,
}: VersionStandaloneFallbackProps) {
  const { t } = useI18n();

  return (
    <div className="flex flex-col gap-3">
      {publishDisabledReasons.length > 0 ? (
        <ul id="price-book-publish-reasons" className="list-disc ps-5 text-xs text-muted-foreground">
          {publishDisabledReasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      ) : null}

      {canPublish ? (
        <Field showLabel label={t.tradeCommon.supersedesVersionId} hint={t.tradeCommon.supersedesVersionHint}>
          <Input
            value={supersedesVersionId}
            onChange={(e) => onChangeSupersedesVersionId(e.target.value)}
            disabled={pending !== null}
          />
        </Field>
      ) : null}

      {testReport ? (
        <DetailSection title={t.tradePricing.lastTest}>
          <div role={testReport.passed ? "status" : "alert"} className="flex flex-col gap-2.5 text-xs">
            <Badge tone={testReport.passed ? "positive" : "negative"}>
              {testReport.passed ? t.tradePricing.testPassedShort : t.tradePricing.testFailedShort}
            </Badge>
            {testReport.entryCount === 0 ? <p>{t.tradePricing.noEntries}</p> : null}
            {[
              { label: t.tradePricing.entryConflicts, conflicts: testReport.conflicts },
              { label: t.tradePricing.promotionConflicts, conflicts: testReport.promotionConflicts },
            ].map((group) =>
              group.conflicts.length > 0 ? (
                <div key={group.label}>
                  <h3 className="font-semibold">{group.label}</h3>
                  <ul aria-label={group.label} className="flex flex-col gap-1">
                    {group.conflicts.map((conflict, index) => (
                      <li key={`${conflict}-${index}`}>
                        <IdentifierText className="text-xs">{conflict}</IdentifierText>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null,
            )}
          </div>
        </DetailSection>
      ) : null}
    </div>
  );
}
