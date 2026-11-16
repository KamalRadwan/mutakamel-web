"use client";

import { Check, ChevronDown, Pin } from "lucide-react";
import {
  Badge,
  Button,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  IdentifierText,
  Money,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  cn,
} from "@/design-system";
import type { Dictionary } from "@/i18n/dictionaries/ar";
import type { Language } from "@/i18n/useLanguage";
import { formatTemplate } from "@/lib/format/template";
import { compareFixedDecimal, DECIMAL_ZERO } from "../../documents/fixed-decimal";
import {
  localizedBookDisplayName,
  type PriceBook,
  type PricingDecisionResult,
} from "../../price-books/pricing-contract";
import type { PricingWaterfallModel } from "../pricing-display";
import { PricingDecisionTraceSection } from "./PricingDecisionTraceSection";

interface PricingWaterfallCardProps {
  t: Dictionary;
  lang: Language;
  result: PricingDecisionResult;
  evaluatedQuantity: string;
  subtotal: string;
  waterfall: PricingWaterfallModel;
  resolvedBook?: PriceBook;
  isAlreadyPinned: boolean;
  onPin: () => void;
  isTraceOpen: boolean;
  onTraceOpenChange: (next: boolean) => void;
  showRawReceipt: boolean;
  onToggleRawReceipt: () => void;
}

export function PricingWaterfallCard({
  t,
  lang,
  result,
  evaluatedQuantity,
  subtotal,
  waterfall,
  resolvedBook,
  isAlreadyPinned,
  onPin,
  isTraceOpen,
  onTraceOpenChange,
  showRawReceipt,
  onToggleRawReceipt,
}: PricingWaterfallCardProps) {
  const bookTitle = resolvedBook
    ? localizedBookDisplayName(resolvedBook, lang)
    : result.priceBookId.slice(0, 8);
  const netDeltaNonZero = compareFixedDecimal(waterfall.netUnitDelta, DECIMAL_ZERO) !== 0;

  return (
    <section
      aria-label={t.tradePricing.evalWaterfallHeading}
      className="flex flex-col gap-3.5 rounded-column border border-line-card bg-card p-4 shadow-column"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-sm font-semibold text-foreground">
            {t.tradePricing.evalWaterfallHeading}
          </h2>
          <p className="text-xs text-muted-foreground">
            {formatTemplate(t.tradePricing.evalWaterfallUnitSubtitle, {
              currency: result.currencyCode,
            })}
          </p>
        </div>

        <Button type="button" size="xs" variant="outline" disabled={isAlreadyPinned} onClick={onPin}>
          <Pin className="size-3.5" aria-hidden="true" />
          <span>{isAlreadyPinned ? t.tradePricing.evalPinnedBadge : t.tradePricing.pinToComparison}</span>
        </Button>
      </div>

      <div className="overflow-hidden rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t.tradePricing.evalWaterfallColStep}</TableHead>
              <TableHead className="text-end">{t.tradePricing.evalWaterfallColChange}</TableHead>
              <TableHead className="text-end">{t.tradePricing.evalWaterfallColUnitPrice}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {waterfall.steps.map((step) => {
              if (step.kind === "BASELINE") {
                return (
                  <TableRow key="waterfall-step-baseline">
                    <TableCell>
                      <div className="flex items-start gap-2.5">
                        <span className="mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-info-subtle text-xs text-info-subtle-foreground">
                          <IdentifierText className="tabular-nums">{String(step.stepNumber)}</IdentifierText>
                        </span>
                        <div className="flex min-w-0 flex-col gap-0.5">
                          <span className="text-foreground">{t.tradePricing.evalStepBaselineTitle}</span>
                          <span className="text-xs text-muted-foreground">
                            {formatTemplate(t.tradePricing.evalStepBaselineMeta, {
                              book: bookTitle,
                              qty: evaluatedQuantity,
                            })}
                          </span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-end text-muted-foreground">—</TableCell>
                    <TableCell className="text-end">
                      <Money value={step.runningUnitPrice} currency={result.currencyCode} language={lang} minimumFractionDigits={2} maximumFractionDigits={8} />
                    </TableCell>
                  </TableRow>
                );
              }

              if (step.kind === "PROMOTION") {
                const { promotion } = step;
                const promoMeta =
                  typeof promotion.priority === "number"
                    ? formatTemplate(t.tradePricing.evalStepPromoMeta, {
                        code: promotion.code,
                        priority: String(promotion.priority),
                        stack: promotion.stackGroup ?? "DEFAULT",
                      })
                    : formatTemplate(t.tradePricing.evalStepPromoMetaSimple, { code: promotion.code });
                return (
                  <TableRow key={`waterfall-step-promo-${promotion.promotionId ?? promotion.code}-${step.stepNumber}`}>
                    <TableCell>
                      <div className="flex items-start gap-2.5">
                        <span className="mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-success-subtle text-xs text-success-subtle-foreground">
                          <IdentifierText className="tabular-nums">{String(step.stepNumber)}</IdentifierText>
                        </span>
                        <div className="flex min-w-0 flex-col gap-0.5">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-foreground">{promotion.name || t.tradePricing.waterfallPromoStep}</span>
                            {promotion.benefitType === "PERCENTAGE" && promotion.discountValue ? (
                              <Badge tone="positive" size="sm">
                                <IdentifierText className="tabular-nums">{`-${promotion.discountValue}%`}</IdentifierText>
                              </Badge>
                            ) : null}
                          </div>
                          <span className="text-xs text-muted-foreground">{promoMeta}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-end text-success-subtle-foreground">
                      -<Money value={step.deltaAmount} currency={result.currencyCode} language={lang} minimumFractionDigits={2} maximumFractionDigits={8} />
                    </TableCell>
                    <TableCell className="text-end">
                      <Money value={step.runningUnitPrice} currency={result.currencyCode} language={lang} minimumFractionDigits={2} maximumFractionDigits={8} />
                    </TableCell>
                  </TableRow>
                );
              }

              const isPositiveAdjust = compareFixedDecimal(step.deltaAmount, DECIMAL_ZERO) > 0;
              return (
                <TableRow key={`waterfall-step-floor-${step.stepNumber}`}>
                  <TableCell>
                    <div className="flex items-start gap-2.5">
                      <span className="mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-warning-subtle text-xs text-warning-subtle-foreground">
                        <IdentifierText className="tabular-nums">{String(step.stepNumber)}</IdentifierText>
                      </span>
                      <div className="flex min-w-0 flex-col gap-0.5">
                        <span className="text-foreground">{t.tradePricing.evalStepReconciliationTitle}</span>
                        <span className="text-xs text-muted-foreground">{t.tradePricing.evalStepReconciliationMeta}</span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-end text-warning-subtle-foreground">
                    {isPositiveAdjust ? "+" : ""}
                    <Money value={step.deltaAmount} currency={result.currencyCode} language={lang} minimumFractionDigits={2} maximumFractionDigits={8} />
                  </TableCell>
                  <TableCell className="text-end">
                    <Money value={step.runningUnitPrice} currency={result.currencyCode} language={lang} minimumFractionDigits={2} maximumFractionDigits={8} />
                  </TableCell>
                </TableRow>
              );
            })}

            <TableRow className="bg-kpi-new-surface/40 hover:bg-kpi-new-surface/55">
              <TableCell>
                <div className="flex items-center gap-2.5">
                  <span className="inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <Check className="size-3.5" aria-hidden="true" />
                  </span>
                  <span className="text-kpi-new-text">{t.tradePricing.evalFinalRowTitle}</span>
                </div>
              </TableCell>
              <TableCell className={cn("text-end", netDeltaNonZero ? "text-success-subtle-foreground" : "text-muted-foreground")}>
                {netDeltaNonZero ? (
                  <Money value={waterfall.netUnitDelta} currency={result.currencyCode} language={lang} minimumFractionDigits={2} maximumFractionDigits={8} />
                ) : (
                  "—"
                )}
              </TableCell>
              <TableCell className="text-end text-kpi-new-text">
                <Money value={result.unitPrice} currency={result.currencyCode} language={lang} minimumFractionDigits={2} maximumFractionDigits={8} />
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-surface-subtle/50 px-3.5 py-2.5">
        <span className="text-xs font-medium text-muted-foreground">
          {t.tradePricing.evalPreTaxQuantityTotalLabel}
        </span>
        <bdi className="inline-flex flex-wrap items-center gap-1.5 text-sm font-semibold tabular-nums text-foreground">
          <Money value={result.unitPrice} language={lang} minimumFractionDigits={2} maximumFractionDigits={8} />
          <span className="text-muted-foreground">×</span>
          <IdentifierText className="tabular-nums">{evaluatedQuantity}</IdentifierText>
          <span className="text-muted-foreground">=</span>
          <Money value={subtotal} currency={result.currencyCode} language={lang} />
        </bdi>
      </div>

      <Collapsible open={isTraceOpen} onOpenChange={onTraceOpenChange}>
        <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 rounded-md px-1 py-1 text-xs font-medium text-muted-foreground hover:text-foreground">
          <span>{t.tradePricing.evalDecisionAndTraceToggle}</span>
          <ChevronDown className={cn("size-4 shrink-0 transition-transform", isTraceOpen && "rotate-180")} aria-hidden="true" />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <PricingDecisionTraceSection
            t={t}
            lang={lang}
            result={result}
            showRawReceipt={showRawReceipt}
            onToggleRawReceipt={onToggleRawReceipt}
          />
        </CollapsibleContent>
      </Collapsible>
    </section>
  );
}
