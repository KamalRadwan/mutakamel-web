"use client";

import Link from "next/link";
import {
  ArrowUpRight, BookOpen, Calculator, CheckCircle2, Edit3, GitCompare, Lock,
  MoreHorizontal, Play, Plus, RotateCcw, Save, ShieldCheck, Star, Trash2, Users, XCircle,
} from "lucide-react";
import {
  Badge, Button, DetailHeader, DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger, IdentifierText,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatNumber } from "@/lib/format/number";
import { TENANT_ROUTES } from "@/lib/navigation/tenant-routes";
import { tradeStatusLabel } from "../../trade-advanced-validation";
import {
  localizedBookDisplayName,
  type PriceBookDetail,
  type PriceBookTimelineVersion,
} from "../pricing-contract";
import { PriceBookContextBanners } from "./PriceBookContextBanners";
import type { VersionPendingAction } from "./useVersionWorkspaceController";

interface PriceBookIdentityHeaderProps {
  detail: PriceBookDetail;
  companyScopeLabel: string | null;
  selectedVersion: PriceBookTimelineVersion | null;
  hasEffectiveVersionNow: boolean;
  canManage: boolean;
  canManageDefaults: boolean;
  canViewCost: boolean | undefined;
  isOffline: boolean;
  isDirty: boolean;
  canTest: boolean;
  canPublish: boolean;
  canPublishGrant?: boolean;
  canRetire: boolean;
  canDeleteDraft: boolean;
  pending: VersionPendingAction;
  isBookBusy: boolean;
  onSaveDraft: () => void;
  onDiscardDraft: () => void;
  onRunTest: () => void;
  onOpenPublish: () => void;
  onOpenCreateDraft: (sourceVersionId?: string) => void;
  onOpenEditBook: () => void;
  onToggleBookActive: () => void;
  onToggleCompanyDefault: () => void;
  onOpenCompareTab: () => void;
  onOpenRetire: () => void;
  onOpenDeleteDraft: () => void;
}

export function PriceBookIdentityHeader(props: PriceBookIdentityHeaderProps) {
  const {
    detail, companyScopeLabel, selectedVersion, hasEffectiveVersionNow,
    canManage, canManageDefaults, canViewCost, isOffline, isDirty,
    canTest, canPublish, canPublishGrant = false, canRetire, canDeleteDraft, pending, isBookBusy,
    onSaveDraft, onDiscardDraft, onRunTest, onOpenPublish, onOpenCreateDraft,
    onOpenEditBook, onToggleBookActive, onToggleCompanyDefault,
    onOpenCompareTab, onOpenRetire, onOpenDeleteDraft,
  } = props;
  const { t, lang } = useI18n();
  const { book } = detail;
  const displayName = localizedBookDisplayName(book, lang);
  const arName = book.localizedNames?.ar?.trim() || "";
  const enName = book.localizedNames?.en?.trim() || "";
  const secondaryName =
    arName && enName && arName !== enName ? (displayName === arName ? enName : arName) : null;
  const isInactive = book.status === "INACTIVE";
  const evaluateHref = `${TENANT_ROUTES.tradePricing}?priceBookId=${encodeURIComponent(book.id)}&purpose=${encodeURIComponent(book.purpose)}&currencyCode=${encodeURIComponent(book.currencyCode)}`;

  const resolvePrimaryAction = () => {
    if (isDirty && canManage) {
      return {
        label: t.tradePricing.saveDraftChanges,
        icon: <Save className="size-3.5" aria-hidden="true" />,
        disabled: isOffline || isBookBusy || pending !== null,
        loading: pending === "save",
        onClick: onSaveDraft,
      };
    }
    if (selectedVersion?.status === "TESTED" && (canPublishGrant || canPublish || pending === "publish")) {
      return {
        label: t.tradePricing.publishScheduleAction,
        icon: <ShieldCheck className="size-3.5" aria-hidden="true" />,
        loading: pending === "publish",
        disabled: isOffline || pending !== null,
        onClick: onOpenPublish,
      };
    }
    if (selectedVersion?.status === "DRAFT" && (canTest || pending === "test")) {
      return {
        label: t.tradePricing.runTest,
        icon: <Play className="size-3.5" aria-hidden="true" />,
        disabled: isOffline || pending !== null,
        loading: pending === "test",
        onClick: onRunTest,
      };
    }
    if (!canManage) return undefined;
    const label =
      detail.versions.length === 0
        ? t.tradePricing.createFirstDraft
        : selectedVersion
          ? t.tradePricing.createDraftFromVersion.replace("{version}", String(selectedVersion.versionNumber))
          : t.tradePricing.createNewDraft;
    return {
      label,
      icon: <Plus className="size-3.5" aria-hidden="true" />,
      disabled: isOffline || isBookBusy,
      onClick: () => onOpenCreateDraft(selectedVersion?.id),
    };
  };

  return (
    <div className="flex flex-col gap-3">
      <DetailHeader
        backHref={TENANT_ROUTES.tradePriceBooks}
        backLabel={t.tradePricing.backToBooks}
        title={displayName}
        subtitle={book.description ?? undefined}
        primaryAction={resolvePrimaryAction()}
        secondaryActions={
          <div className="flex flex-wrap items-center gap-2">
            {isDirty ? (
              <Button size="sm" variant="outline" disabled={isBookBusy || pending !== null} onClick={onDiscardDraft}>
                <RotateCcw className="size-3.5" aria-hidden="true" />
                {t.tradePricing.discardDraftChanges}
              </Button>
            ) : null}
            <Button size="sm" variant="outline" asChild>
              <Link href={evaluateHref}>
                <Calculator className="size-3.5" aria-hidden="true" />
                {t.tradePricing.evaluateBookPrices}
              </Link>
            </Button>
            {canManage ? (
              <Button size="sm" variant="outline" disabled={isOffline || isBookBusy} onClick={onOpenEditBook}>
                <Edit3 className="size-3.5" aria-hidden="true" />
                {t.tradePricing.editBookDetails}
              </Button>
            ) : null}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline" aria-label={t.tradePricing.moreActions}>
                  <MoreHorizontal className="size-4" aria-hidden="true" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                {canManage && detail.versions.length > 0 ? (
                  <DropdownMenuItem disabled={isOffline || isBookBusy} onSelect={() => onOpenCreateDraft(selectedVersion?.id)}>
                    <Plus className="me-2 size-3.5" aria-hidden="true" />
                    {t.tradePricing.createNewDraft}
                  </DropdownMenuItem>
                ) : null}
                {selectedVersion ? (
                  <DropdownMenuItem asChild>
                    <Link href={`/trade/price-book-versions/${encodeURIComponent(selectedVersion.id)}`}>
                      <ArrowUpRight className="me-2 size-3.5" aria-hidden="true" />
                      {t.tradePricing.openVersionPage}
                    </Link>
                  </DropdownMenuItem>
                ) : null}
                {detail.versions.length > 1 ? (
                  <DropdownMenuItem onSelect={onOpenCompareTab}>
                    <GitCompare className="me-2 size-3.5" aria-hidden="true" />
                    {t.tradePricing.workspaceTabComparison}
                  </DropdownMenuItem>
                ) : null}
                {canManageDefaults ? (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      disabled={isOffline || isBookBusy || (isInactive && !book.isCompanyDefault)}
                      onSelect={onToggleCompanyDefault}
                    >
                      <Star className="me-2 size-3.5" aria-hidden="true" />
                      {book.isCompanyDefault ? t.tradePricing.removeCompanyDefault : t.tradePricing.setAsCompanyDefault}
                    </DropdownMenuItem>
                  </>
                ) : null}
                {canManage ? (
                  <DropdownMenuItem
                    disabled={isOffline || isBookBusy || (!isInactive && book.isCompanyDefault)}
                    onSelect={onToggleBookActive}
                  >
                    {isInactive ? <CheckCircle2 className="me-2 size-3.5" aria-hidden="true" /> : <XCircle className="me-2 size-3.5" aria-hidden="true" />}
                    {isInactive ? t.tradePricing.reactivateBookAction : t.tradePricing.deactivateBookAction}
                  </DropdownMenuItem>
                ) : null}
                {canRetire || canDeleteDraft ? <DropdownMenuSeparator /> : null}
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
          </div>
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-card border border-border bg-card px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex size-7 items-center justify-center rounded-md bg-info-subtle text-info-subtle-foreground">
            <BookOpen className="size-4" aria-hidden="true" />
          </span>
          <IdentifierText className="text-xs font-semibold">{book.code}</IdentifierText>
          {secondaryName && secondaryName !== displayName ? (
            <span className="text-xs text-muted-foreground">· {secondaryName}</span>
          ) : null}
          <Badge tone={isInactive ? "neutral" : "positive"}>
            {tradeStatusLabel(t.tradeStatus, book.status, t.common.unknownCode)}
          </Badge>
          <Badge tone={book.purpose === "SALES" ? "brand" : "caution"}>
            {tradeStatusLabel(t.tradeStatus, book.purpose, t.common.unknownCode)}
          </Badge>
          <Badge tone="neutral">
            <IdentifierText className="text-badge">{book.currencyCode}</IdentifierText>
          </Badge>
          {book.isCompanyDefault ? (
            <Badge tone="positive">
              <Star className="me-1 size-3 fill-current" aria-hidden="true" />
              {t.tradePricing.isCompanyDefault}
            </Badge>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          {companyScopeLabel ? <span>{t.tradePricing.companyScopeMeta.replace("{company}", companyScopeLabel)}</span> : null}
          <span>{t.tradePricing.versionsCountMeta.replace("{count}", formatNumber(detail.versions.length, lang))}</span>
          <span className="inline-flex items-center gap-1">
            <Users className="size-3.5" aria-hidden="true" />
            {t.tradePricing.linkedAccountsShownMeta.replace("{count}", formatNumber(detail.linkedAccounts.length, lang))}
          </span>
          <span className="inline-flex items-center gap-1">
            <Lock className="size-3.5" aria-hidden="true" />
            {t.tradePricing.activeLocksCountMeta.replace("{count}", formatNumber(detail.activeLocksCount, lang))}
          </span>
        </div>
      </div>

      <PriceBookContextBanners
        detail={detail}
        hasEffectiveVersionNow={hasEffectiveVersionNow}
        canManage={canManage}
        canViewCost={canViewCost}
        isOffline={isOffline}
        isBookBusy={isBookBusy}
        onToggleBookActive={onToggleBookActive}
        onOpenCreateDraft={() => onOpenCreateDraft()}
      />
    </div>
  );
}
