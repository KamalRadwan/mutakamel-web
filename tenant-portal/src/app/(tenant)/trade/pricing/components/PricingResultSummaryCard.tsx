"use client";

import Link from "next/link";
import { Badge, IdentifierText, Money } from "@/design-system";
import type { Dictionary } from "@/i18n/dictionaries/ar";
import type { Language } from "@/i18n/useLanguage";
import { formatTemplate } from "@/lib/format/template";
import { TENANT_ROUTES } from "@/lib/navigation/tenant-routes";
import { tradeStatusLabel } from "../../trade-advanced-validation";
import {
  localizedBookDisplayName,
  localizedRecordName,
  type PriceBook,
  type PricingDecisionResult,
  type PricingReferenceItem,
  type PricingReferenceUom,
} from "../../price-books/pricing-contract";
import type { PricingResolutionSourceTier, PricingWaterfallModel } from "../pricing-display";

interface PricingResultSummaryCardProps {
  t: Dictionary;
  lang: Language;
  result: PricingDecisionResult;
  evaluatedQuantity: string;
  evaluatedPurpose: "SALES" | "PURCHASE";
  totals: { subtotal: string; savings: string };
  waterfall: PricingWaterfallModel;
  resolvedBook?: PriceBook;
  resolvedVersionNumber: number | null;
  evaluatedItem?: PricingReferenceItem;
  evaluatedUom?: PricingReferenceUom;
  resolutionSourceTier: PricingResolutionSourceTier;
}

export function PricingResultSummaryCard({
  t,
  lang,
  result,
  evaluatedQuantity,
  evaluatedPurpose,
  totals,
  waterfall,
  resolvedBook,
  resolvedVersionNumber,
  evaluatedItem,
  evaluatedUom,
  resolutionSourceTier,
}: PricingResultSummaryCardProps) {
  const taxNote = result.taxFinal
    ? t.tradePricing.evalTaxIncludedShort
    : t.tradePricing.evalPreTaxShort;
  const uomLabel = evaluatedUom
    ? localizedRecordName(
        evaluatedUom.localizedNames,
        evaluatedUom.displayName || evaluatedUom.code,
        lang,
      )
    : t.tradePricing.evalUnitsFallback;

  const sourceTierLabel =
    resolutionSourceTier === "EXPLICIT"
      ? t.tradePricing.evalSourceExplicitBook
      : t.tradePricing.evalSourceAutomatic;

  const versionBadgeText =
    resolvedVersionNumber !== null
      ? formatTemplate(t.tradePricing.evalVersionNumberBadge, {
          version: String(resolvedVersionNumber),
        })
      : t.tradePricing.evalSelectedVersion;

  const showCatalogRef =
    evaluatedPurpose === "SALES" && Boolean(evaluatedItem?.salesPrice) &&
    (!evaluatedItem?.currencyCode || evaluatedItem.currencyCode === result.currencyCode);

  return (
    <section
      aria-label={t.tradePricing.evalResultSummaryTitle}
      className="flex flex-col gap-3.5 rounded-column border border-line-card bg-card p-4 shadow-column"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-foreground">
          {t.tradePricing.evalResultSummaryTitle}
        </h2>
        <Badge tone={result.outcome === "ALLOW" ? "positive" : "caution"} size="sm">
          {tradeStatusLabel(t.tradeStatus, result.outcome, t.common.unknownCode)}
        </Badge>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="flex flex-col gap-1 rounded-lg border border-kpi-new-line bg-kpi-new-surface/45 p-3.5">
          <span className="text-xs font-medium text-kpi-new-text">
            {t.tradePricing.evalFinalUnitPriceLabel}
          </span>
          <span className="text-xl font-semibold text-kpi-new-text">
            <Money
              value={result.unitPrice}
              currency={result.currencyCode}
              language={lang}
              minimumFractionDigits={2}
              maximumFractionDigits={8}
            />
          </span>
          <span className="text-xs text-muted-foreground">{taxNote}</span>
        </div>

        <div className="flex flex-col gap-1 rounded-lg border border-border bg-surface-subtle/50 p-3.5">
          <span className="text-xs font-medium text-muted-foreground">
            {formatTemplate(t.tradePricing.evalExtendedTotalForQty, {
              qty: evaluatedQuantity,
              uom: uomLabel,
            })}
          </span>
          <span className="text-lg font-semibold text-foreground">
            <Money value={totals.subtotal} currency={result.currencyCode} language={lang} />
          </span>
          <span className="text-xs text-muted-foreground">{taxNote}</span>
        </div>

        <div className="flex flex-col gap-1 rounded-lg border border-border bg-surface-subtle/50 p-3.5">
          <span className="text-xs font-medium text-muted-foreground">
            {t.tradePricing.evalTotalSavingsLabel}
          </span>
          <span className="text-lg font-semibold text-success-subtle-foreground">
            <Money value={totals.savings} currency={result.currencyCode} language={lang} />
          </span>
          <span className="text-xs text-muted-foreground">
            {waterfall.discountPercent
              ? formatTemplate(t.tradePricing.evalOffBaselinePct, {
                  pct: waterfall.discountPercent,
                })
              : t.tradePricing.evalNoPromotionApplied}
          </span>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-surface-subtle/40 px-3 py-2 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-muted-foreground">{t.tradePricing.evalSourceLabel}</span>
          <Link
            href={`${TENANT_ROUTES.tradePriceBooks}/${result.priceBookId}`}
            className="font-semibold text-primary hover:underline"
          >
            {resolvedBook ? (
              localizedBookDisplayName(resolvedBook, lang)
            ) : (
              <IdentifierText>{result.priceBookId.slice(0, 8)}</IdentifierText>
            )}
          </Link>
          <Badge tone="positive" size="sm">
            {versionBadgeText}
          </Badge>
          <span className="text-muted-foreground">·</span>
          <span className="text-muted-foreground">{sourceTierLabel}</span>
        </div>

        {showCatalogRef && evaluatedItem?.salesPrice ? (
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <span>{`${t.tradePricing.evalCatalogRefLabel}:`}</span>
            <Money
              value={evaluatedItem.salesPrice}
              currency={result.currencyCode}
              language={lang}
              className="font-medium text-foreground"
            />
          </div>
        ) : null}
      </div>
    </section>
  );
}
