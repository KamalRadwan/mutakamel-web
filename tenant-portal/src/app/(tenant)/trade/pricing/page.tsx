"use client";

import Link from "next/link";
import { BookOpen, Building2, Calculator } from "lucide-react";
import {
  Button,
  EmptyState,
  ErrorState,
  PageHeader,
  PermissionGate,
  Skeleton,
} from "@/design-system";
import { TENANT_ROUTES } from "@/lib/navigation/tenant-routes";
import { PRICING_READ_PERMISSION } from "../price-books/pricing-contract";
import { PricingComparisonCard } from "./components/PricingComparisonCard";
import { PricingInputsCard } from "./components/PricingInputsCard";
import { PricingResultSummaryCard } from "./components/PricingResultSummaryCard";
import { PricingScopeBar } from "./components/PricingScopeBar";
import { PricingWaterfallCard } from "./components/PricingWaterfallCard";
import { usePricingWorkbench } from "./hooks/usePricingWorkbench";

export default function PricingEvaluationPage() {
  const workbench = usePricingWorkbench();
  const {
    t,
    lang,
    canRead,
    isScopeResolved,
    values,
    result,
    evaluatedInputs,
    hasStaleEdits,
    pinnedEvaluations,
    pinCurrentResult,
    clearPinnedEvaluations,
    noPrice,
    isEvaluating,
    queryError,
    queryErrorMessage,
    evaluate,
    scopeOptions,
    totals,
    waterfall,
    resolvedBook,
    resolvedVersionNumber,
    evaluatedItem,
    evaluatedUom,
    resolutionSourceTier,
    isTraceOpen,
    setIsTraceOpen,
    showRawReceipt,
    setShowRawReceipt,
  } = workbench;

  const evaluatedQuantity = evaluatedInputs?.quantity ?? values.quantity;
  const isAlreadyPinned = Boolean(
    result && pinnedEvaluations.some((entry) => entry.id === result.decisionId),
  );

  return (
    <div className="flex flex-col gap-3.5">
      <PageHeader
        className="sr-only"
        title={t.tradePricing.evaluateTitle}
        description={t.tradePricing.evaluateSubtitle}
        secondaryActions={
          <Button asChild size="sm" variant="outline">
            <Link href={TENANT_ROUTES.tradePriceBooks}>
              <BookOpen className="size-3.5" aria-hidden="true" />
              <span>{t.tradePricing.booksTitle}</span>
            </Link>
          </Button>
        }
      />

      <PricingScopeBar scope={scopeOptions} />

      {isScopeResolved && !canRead ? (
        <div className="rounded-column border border-line-card bg-card shadow-column">
          <PermissionGate denied require={PRICING_READ_PERMISSION}>
            {null}
          </PermissionGate>
        </div>
      ) : (
        <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-12">
          <PricingInputsCard workbench={workbench} />

          <div className="flex flex-col gap-4 lg:col-span-8">
            {!isScopeResolved ? (
              <div className="rounded-column border border-line-card bg-card shadow-column">
                <EmptyState
                  icon={Building2}
                  title={t.tradePricing.evalScopeSelectPromptTitle}
                  description={t.tradePricing.evalScopeSelectPromptDesc}
                  className="py-8"
                />
              </div>
            ) : isEvaluating ? (
              <div
                aria-busy="true"
                aria-label={t.common.loading}
                className="flex flex-col gap-4"
              >
                <div className="flex flex-col gap-3 rounded-column border border-line-card bg-card p-4 shadow-column">
                  <Skeleton className="h-5 w-40" />
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                    <Skeleton className="h-20 w-full" />
                    <Skeleton className="h-20 w-full" />
                    <Skeleton className="h-20 w-full" />
                  </div>
                  <Skeleton className="h-9 w-full" />
                </div>
                <div className="flex flex-col gap-3 rounded-column border border-line-card bg-card p-4 shadow-column">
                  <Skeleton className="h-5 w-48" />
                  <Skeleton className="h-36 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              </div>
            ) : noPrice ? (
              <div className="rounded-column border border-line-card bg-card shadow-column">
                <EmptyState
                  icon={Calculator}
                  title={t.tradePricing.errorNoEligiblePrice}
                  description={t.tradePricing.noEligiblePriceDescription}
                  className="py-8"
                />
              </div>
            ) : queryError ? (
              <div className="rounded-column border border-line-card bg-card shadow-column">
                {queryError.status === 403 ? (
                  <PermissionGate denied require={PRICING_READ_PERMISSION}>
                    {null}
                  </PermissionGate>
                ) : (
                  <ErrorState
                    title={t.tradePricing.evaluateFailed}
                    description={queryErrorMessage}
                    onRetry={() => void evaluate()}
                    retryLabel={t.common.retry}
                    className="py-8"
                  />
                )}
              </div>
            ) : result && waterfall ? (
              <>
                <PricingResultSummaryCard
                  t={t}
                  lang={lang}
                  result={result}
                  evaluatedQuantity={evaluatedQuantity}
                  evaluatedPurpose={evaluatedInputs?.purpose ?? values.purpose}
                  totals={totals}
                  waterfall={waterfall}
                  resolvedBook={resolvedBook}
                  resolvedVersionNumber={resolvedVersionNumber}
                  evaluatedItem={evaluatedItem}
                  evaluatedUom={evaluatedUom}
                  resolutionSourceTier={resolutionSourceTier}
                />
                <PricingWaterfallCard
                  t={t}
                  lang={lang}
                  result={result}
                  evaluatedQuantity={evaluatedQuantity}
                  subtotal={totals.subtotal}
                  waterfall={waterfall}
                  resolvedBook={resolvedBook}
                  isAlreadyPinned={isAlreadyPinned}
                  onPin={pinCurrentResult}
                  isTraceOpen={isTraceOpen}
                  onTraceOpenChange={setIsTraceOpen}
                  showRawReceipt={showRawReceipt}
                  onToggleRawReceipt={() => setShowRawReceipt((prev) => !prev)}
                />
              </>
            ) : (
              <div className="rounded-column border border-line-card bg-card shadow-column">
                <EmptyState
                  icon={Calculator}
                  title={t.tradePricing.evalReadyTitle}
                  description={
                    hasStaleEdits
                      ? t.tradePricing.evalStaleInputsHint
                      : t.tradePricing.evalReadyDesc
                  }
                  className="py-8"
                />
              </div>
            )}

            <PricingComparisonCard
              t={t}
              lang={lang}
              pinnedEvaluations={pinnedEvaluations}
              onClear={clearPinnedEvaluations}
            />
          </div>
        </div>
      )}
    </div>
  );
}
