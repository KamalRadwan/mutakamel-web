"use client";

import Link from "next/link";
import { GitCompare } from "lucide-react";
import { Badge, Button, IdentifierText, Money } from "@/design-system";
import type { Dictionary } from "@/i18n/dictionaries/ar";
import type { Language } from "@/i18n/useLanguage";
import { TENANT_ROUTES } from "@/lib/navigation/tenant-routes";
import { tradeStatusLabel } from "../../trade-advanced-validation";
import type { PinnedEvaluationItem } from "../hooks/usePricingEvaluation";
import { pricingDisplayTotals } from "../pricing-display";

interface PricingComparisonCardProps {
  t: Dictionary;
  lang: Language;
  pinnedEvaluations: readonly PinnedEvaluationItem[];
  onClear: () => void;
}

export function PricingComparisonCard({
  t,
  lang,
  pinnedEvaluations,
  onClear,
}: PricingComparisonCardProps) {
  if (pinnedEvaluations.length === 0) return null;

  return (
    <section
      aria-label={t.tradePricing.comparisonTab}
      className="flex flex-col gap-3 rounded-column border border-line-card bg-card p-4 shadow-column"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <GitCompare className="size-4 text-primary" aria-hidden="true" />
          <h3 className="text-sm font-semibold text-foreground">
            {`${t.tradePricing.comparisonTab} (${pinnedEvaluations.length})`}
          </h3>
        </div>
        <Button type="button" size="xs" variant="ghost" onClick={onClear}>
          {t.tradePricing.clearComparison}
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-2.5 md:grid-cols-3">
        {pinnedEvaluations.map((pinned) => {
          const { subtotal } = pricingDisplayTotals(
            pinned.decision.baselineUnitPrice,
            pinned.decision.unitPrice,
            pinned.inputs.quantity,
          );
          return (
            <div
              key={pinned.id}
              className="flex flex-col gap-1.5 rounded-card border border-line-card bg-surface-subtle/50 p-3"
            >
              <div className="flex items-center justify-between gap-2">
                <Badge tone="brand" size="sm">
                  {`${t.tradeInventory.quantity}: `}
                  <IdentifierText className="tabular-nums">
                    {pinned.inputs.quantity}
                  </IdentifierText>
                </Badge>
                <Badge
                  tone={pinned.decision.outcome === "ALLOW" ? "positive" : "caution"}
                  size="sm"
                >
                  {tradeStatusLabel(
                    t.tradeStatus,
                    pinned.decision.outcome,
                    t.common.unknownCode,
                  )}
                </Badge>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{t.tradePricing.unitPrice}</span>
                <span className="font-semibold text-foreground">
                  <Money
                    value={pinned.decision.unitPrice}
                    currency={pinned.decision.currencyCode}
                    language={lang}
                    minimumFractionDigits={2}
                    maximumFractionDigits={8}
                  />
                </span>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{t.tradePricing.baselineUnitPrice}</span>
                <Money
                  value={pinned.decision.baselineUnitPrice}
                  currency={pinned.decision.currencyCode}
                  language={lang}
                  minimumFractionDigits={2}
                  maximumFractionDigits={8}
                />
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{t.tradePricing.simHeroLineTotal}</span>
                <span className="font-semibold text-success-subtle-foreground">
                  <Money
                    value={subtotal}
                    currency={pinned.decision.currencyCode}
                    language={lang}
                  />
                </span>
              </div>

              <div className="flex items-center justify-between border-t border-line-divider pt-1.5 text-xs">
                <span className="text-muted-foreground">{t.tradePricing.decisionReceipt}</span>
                <Link
                  href={`${TENANT_ROUTES.trade}/decisions/${encodeURIComponent(pinned.id)}`}
                  className="font-medium text-primary hover:underline"
                >
                  <IdentifierText>{`#${pinned.id.slice(0, 8)}`}</IdentifierText>
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
