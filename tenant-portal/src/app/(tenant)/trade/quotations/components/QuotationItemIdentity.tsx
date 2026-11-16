"use client";

import { Badge } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { itemDisplayName, type TradeItemOption } from "../../documents/trade-lookup-contract";
import { ItemThumb } from "../../items/components/ItemThumb";
import { quotationSecondaryItemName } from "../quotation-presentation";

export interface QuotationItemFallback {
  itemName?: string;
  sku?: string;
  unavailable?: boolean;
}

export function QuotationItemThumbnail({ item }: { item?: TradeItemOption | null }) {
  return (
    <ItemThumb itemId={item?.id ?? ""} kind={item?.itemKind ?? ""} image={item?.image ?? null} alt=""
      className="size-6 shrink-0 border-primary/10 bg-primary/10 text-primary" iconClassName="size-3.5" />
  );
}

export function QuotationItemIdentity({ item, fallback }: {
  item?: TradeItemOption | null;
  fallback?: QuotationItemFallback;
}) {
  const { t, lang } = useI18n();
  const primaryName = item ? itemDisplayName(item, lang)
    : fallback?.itemName?.trim() || fallback?.sku?.trim() || t.quotationExperience.itemUnknown;
  const secondaryName = item ? quotationSecondaryItemName(item, lang) : null;

  return <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5">
    <bdi className="min-w-0 text-xs font-medium text-foreground wrap-anywhere"
      title={secondaryName ? `${primaryName} — ${secondaryName}` : primaryName}>{primaryName}</bdi>
    {fallback?.unavailable ? <Badge tone="caution" size="compact" className="shrink-0 font-normal">
      {t.audit.valueUnavailable}
    </Badge> : null}
  </div>;
}

export function QuotationItemType({ item }: { item: TradeItemOption }) {
  const { t } = useI18n();
  const labels = {
    PRODUCT: t.quotationExperience.itemProduct,
    SERVICE: t.quotationExperience.itemService,
    COMBO: t.quotationExperience.itemCombo,
  };
  return <span className="text-sm font-normal">{item.itemKind ? labels[item.itemKind] : t.quotationExperience.itemUnknown}</span>;
}
