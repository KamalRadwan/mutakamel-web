"use client";

import { AlertTriangle, EyeOff, Plus, WifiOff } from "lucide-react";
import { Button } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import type { PriceBookDetail } from "../pricing-contract";

interface PriceBookContextBannersProps {
  detail: PriceBookDetail;
  hasEffectiveVersionNow: boolean;
  canManage: boolean;
  canViewCost: boolean | undefined;
  isOffline: boolean;
  isBookBusy: boolean;
  onToggleBookActive: () => void;
  onOpenCreateDraft: () => void;
}

export function PriceBookContextBanners({
  detail,
  hasEffectiveVersionNow,
  canManage,
  canViewCost,
  isOffline,
  isBookBusy,
  onToggleBookActive,
  onOpenCreateDraft,
}: PriceBookContextBannersProps) {
  const { t } = useI18n();
  const isInactive = detail.book.status === "INACTIVE";

  return (
    <>
      {isOffline ? (
        <div
          role="status"
          className="flex items-center gap-2.5 rounded-lg border border-warning/30 bg-warning-subtle px-3.5 py-2 text-xs text-warning-subtle-foreground"
        >
          <WifiOff className="size-4 shrink-0" aria-hidden="true" />
          <span>{t.tradePricing.offlineWriteBanner}</span>
        </div>
      ) : null}

      {!canManage || canViewCost === false ? (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-muted/40 px-3.5 py-2 text-xs text-muted-foreground">
          {!canManage ? <span>{t.tradePricing.readOnlyAccessBanner}</span> : null}
          {canViewCost === false ? (
            <span className="inline-flex items-center gap-1.5">
              <EyeOff className="size-3.5 shrink-0" aria-hidden="true" />
              {t.tradePricing.costRedactedNotice}
            </span>
          ) : null}
        </div>
      ) : null}

      {isInactive ? (
        <div
          role="status"
          className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-warning/30 bg-warning-subtle px-3.5 py-2.5 text-xs"
        >
          <div className="flex items-start gap-2">
            <AlertTriangle
              className="mt-0.5 size-4 shrink-0 text-warning-subtle-foreground"
              aria-hidden="true"
            />
            <div>
              <p className="font-semibold text-foreground">
                {t.tradePricing.inactiveBookBannerTitle}
              </p>
              <p className="text-muted-foreground">{t.tradePricing.inactiveBookBannerDesc}</p>
            </div>
          </div>
          {canManage ? (
            <Button
              size="xs"
              variant="outline"
              disabled={isOffline || isBookBusy}
              onClick={onToggleBookActive}
            >
              {t.tradePricing.reactivateBookAction}
            </Button>
          ) : null}
        </div>
      ) : null}

      {detail.book.isCompanyDefault && !hasEffectiveVersionNow ? (
        <div
          role="status"
          className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-warning/30 bg-warning-subtle px-3.5 py-2.5 text-xs"
        >
          <div className="flex items-start gap-2">
            <AlertTriangle
              className="mt-0.5 size-4 shrink-0 text-warning-subtle-foreground"
              aria-hidden="true"
            />
            <div>
              <p className="font-semibold text-foreground">
                {t.tradePricing.defaultNoEffectiveWarningTitle}
              </p>
              <p className="text-muted-foreground">
                {t.tradePricing.defaultNoEffectiveWarningDesc}
              </p>
            </div>
          </div>
          {canManage && detail.versions.length === 0 ? (
            <Button size="xs" variant="outline" disabled={isOffline} onClick={onOpenCreateDraft}>
              <Plus className="me-1 size-3" aria-hidden="true" />
              {t.tradePricing.createFirstDraft}
            </Button>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
