"use client";

import Link from "next/link";
import {
  ArrowDownRight,
  Calculator,
  CheckCircle2,
  ExternalLink,
  FileSearch,
  GitCompare,
  Layers,
  Pin,
  Play,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  TrendingDown,
} from "lucide-react";
import {
  Badge,
  Button,
  DetailSection,
  EmptyState,
  ErrorState,
  Field,
  IdentifierText,
  Input,
  Money,
  PageHeader,
  PermissionGate,
  SWATCH_SURFACE_PALETTES,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
  cn,
} from "@/design-system";
import { TenantBranchSelect } from "@/components/tenant/TenantBranchSelect";
import { formatDateTime } from "@/lib/format/date";
import { TENANT_ROUTES } from "@/lib/navigation/tenant-routes";
import { tradeStatusLabel } from "../trade-advanced-validation";
import { formatTradeDecimal, isTradeDecimalString } from "../trade-validation";
import {
  COMMON_CURRENCY_PRESETS,
  PRICE_BOOK_PURPOSES,
  PRICING_READ_PERMISSION,
} from "../price-books/pricing-contract";
import { usePricingEvaluation, type EvaluateFormValues } from "./hooks/usePricingEvaluation";

export default function PricingEvaluationPage() {
  const {
    t,
    lang,
    canRead,
    isScopeResolved,
    branchIds,
    branchId,
    selectBranch,
    values,
    result,
    activeTab,
    setActiveTab,
    pinnedEvaluations,
    pinCurrentResult,
    clearPinnedEvaluations,
    applyPreset,
    noPrice,
    isEvaluating,
    queryError,
    queryErrorMessage,
    formError,
    setValue,
    reset,
    evaluate,
  } = usePricingEvaluation();

  const quantityNum = Number(values.quantity) > 0 ? Number(values.quantity) : 1;
  const baselineNum = result ? Number(result.baselineUnitPrice) : 0;
  const finalUnitNum = result ? Number(result.unitPrice) : 0;
  const subtotalStr = result ? (finalUnitNum * quantityNum).toFixed(2) : "0.00";
  const totalSavingsStr = result
    ? Math.max(0, (baselineNum - finalUnitNum) * quantityNum).toFixed(2)
    : "0.00";
  const activeCurrency = result?.currencyCode || values.currencyCode.trim().toUpperCase() || "SAR";

  const content = (
    <div className="flex flex-col gap-4">
      <PageHeader
        className="sr-only"
        title={t.tradePricing.evaluateTitle}
        description={t.tradePricing.evaluateSubtitle}
        primaryAction={{
          label: t.tradePricing.evaluate,
          onClick: () => void evaluate(),
          disabled: isEvaluating || !isScopeResolved,
          loading: isEvaluating,
        }}
        secondaryActions={
          <>
            <TenantBranchSelect
              branchIds={branchIds}
              branchId={branchId}
              onChange={selectBranch}
              disabled={isEvaluating}
            />
            <Button size="sm" variant="outline" onClick={reset} disabled={isEvaluating}>
              <RotateCcw className="size-4" aria-hidden="true" />
              {t.tradeInventory.clearLookup}
            </Button>
          </>
        }
      />

      {/* Colorful 4-Card Simulator KPI Strip */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div
          className={cn(
            "flex items-start justify-between gap-3 rounded-lg border border-s-4 bg-card p-3.5 shadow-2xs",
            SWATCH_SURFACE_PALETTES.indigo.accentBorder,
          )}
        >
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted-foreground">
              {t.tradePricing.evaluateSimKpiBaseline}
            </span>
            <div className="text-lg font-semibold text-foreground">
              {result ? (
                <Money
                  value={result.baselineUnitPrice}
                  currency={activeCurrency}
                  language={lang}
                  minimumFractionDigits={2}
                  maximumFractionDigits={8}
                />
              ) : (
                <IdentifierText className="tabular-nums">—</IdentifierText>
              )}
            </div>
            <span className="text-xs text-muted-foreground">{t.tradePricing.waterfallBaselineStep}</span>
          </div>
          <span
            className={cn(
              "flex size-9 items-center justify-center rounded-lg border",
              SWATCH_SURFACE_PALETTES.indigo.iconBoxIdle,
            )}
          >
            <Layers className="size-4" aria-hidden="true" />
          </span>
        </div>

        <div
          className={cn(
            "flex items-start justify-between gap-3 rounded-lg border border-s-4 bg-card p-3.5 shadow-2xs",
            SWATCH_SURFACE_PALETTES.green.accentBorder,
          )}
        >
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted-foreground">
              {t.tradePricing.evaluateSimKpiFinalUnit}
            </span>
            <div className="text-lg font-semibold text-foreground">
              {result ? (
                <Money
                  value={result.unitPrice}
                  currency={activeCurrency}
                  language={lang}
                  minimumFractionDigits={2}
                  maximumFractionDigits={8}
                />
              ) : (
                <IdentifierText className="tabular-nums">—</IdentifierText>
              )}
            </div>
            <span className="text-xs text-muted-foreground">
              {result
                ? tradeStatusLabel(t.tradeStatus, result.outcome, t.common.unknownCode)
                : t.tradePricing.unitPrice}
            </span>
          </div>
          <span
            className={cn(
              "flex size-9 items-center justify-center rounded-lg border",
              SWATCH_SURFACE_PALETTES.green.iconBoxIdle,
            )}
          >
            <CheckCircle2 className="size-4" aria-hidden="true" />
          </span>
        </div>

        <div
          className={cn(
            "flex items-start justify-between gap-3 rounded-lg border border-s-4 bg-card p-3.5 shadow-2xs",
            SWATCH_SURFACE_PALETTES.blue.accentBorder,
          )}
        >
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted-foreground">
              {t.tradePricing.evaluateSimKpiSubtotal}
            </span>
            <div className="text-lg font-semibold text-foreground">
              {result ? (
                <Money
                  value={subtotalStr}
                  currency={activeCurrency}
                  language={lang}
                  minimumFractionDigits={2}
                  maximumFractionDigits={2}
                />
              ) : (
                <IdentifierText className="tabular-nums">—</IdentifierText>
              )}
            </div>
            <span className="text-xs text-muted-foreground">
              {`${t.tradeInventory.quantity}: ${values.quantity || "0"}`}
            </span>
          </div>
          <span
            className={cn(
              "flex size-9 items-center justify-center rounded-lg border",
              SWATCH_SURFACE_PALETTES.blue.iconBoxIdle,
            )}
          >
            <Calculator className="size-4" aria-hidden="true" />
          </span>
        </div>

        <div
          className={cn(
            "flex items-start justify-between gap-3 rounded-lg border border-s-4 bg-card p-3.5 shadow-2xs",
            SWATCH_SURFACE_PALETTES.purple.accentBorder,
          )}
        >
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted-foreground">
              {t.tradePricing.evaluateSimKpiSavings}
            </span>
            <div className="text-lg font-semibold text-foreground">
              {result ? (
                <Money
                  value={totalSavingsStr}
                  currency={activeCurrency}
                  language={lang}
                  minimumFractionDigits={2}
                  maximumFractionDigits={2}
                />
              ) : (
                <IdentifierText className="tabular-nums">—</IdentifierText>
              )}
            </div>
            <span className="text-xs text-muted-foreground">
              {result
                ? `${result.matchedPromotions.length} ${t.tradePricing.matchedPromotions}`
                : t.tradePricing.promotions}
            </span>
          </div>
          <span
            className={cn(
              "flex size-9 items-center justify-center rounded-lg border",
              SWATCH_SURFACE_PALETTES.purple.iconBoxIdle,
            )}
          >
            <TrendingDown className="size-4" aria-hidden="true" />
          </span>
        </div>
      </div>

      {/* Simulation Scenario Presets & Simulator Input Card */}
      <div
        className={cn(
          "flex flex-col gap-4 rounded-lg border border-s-4 bg-card p-4 shadow-2xs",
          SWATCH_SURFACE_PALETTES.indigo.accentBorder,
        )}
      >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
          <div className="flex flex-wrap items-center gap-2">
            <Sparkles
              className={cn("size-4", SWATCH_SURFACE_PALETTES.indigo.iconText)}
              aria-hidden="true"
            />
            <span className="text-xs font-semibold text-foreground">
              {t.tradePricing.presetsLabel}:
            </span>
            <Button
              size="xs"
              variant="outline"
              disabled={isEvaluating}
              onClick={() => applyPreset("retail")}
            >
              {t.tradePricing.presetRetailTitle}
            </Button>
            <Button
              size="xs"
              variant="outline"
              disabled={isEvaluating}
              onClick={() => applyPreset("wholesale")}
            >
              {t.tradePricing.presetWholesaleTitle}
            </Button>
            <Button
              size="xs"
              variant="outline"
              disabled={isEvaluating}
              onClick={() => applyPreset("vip")}
            >
              {t.tradePricing.presetVipBulkTitle}
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Button size="xs" variant="ghost" onClick={reset} disabled={isEvaluating}>
              <RotateCcw className="size-3.5" aria-hidden="true" />
              {t.tradeInventory.clearLookup}
            </Button>
            <Button
              size="xs"
              variant="primary"
              loading={isEvaluating}
              disabled={isEvaluating || !isScopeResolved}
              onClick={() => void evaluate()}
            >
              <Play className="size-3.5" aria-hidden="true" />
              {t.tradePricing.evaluate}
            </Button>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-4">
          <Field
            label={t.tradePricing.bookPurpose}
            hint={t.tradePricing.guideBookPurpose}
            showLabel
            hintPlacement="tooltip"
            required
            error={formError ?? undefined}
          >
            <Select
              value={values.purpose}
              disabled={isEvaluating}
              onValueChange={(next) => setValue({ purpose: next as EvaluateFormValues["purpose"] })}
            >
              <SelectTrigger size="sm" aria-label={t.tradePricing.bookPurpose}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRICE_BOOK_PURPOSES.map((value) => (
                  <SelectItem key={value} value={value}>
                    {tradeStatusLabel(t.tradeStatus, value, t.common.unknownCode)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label={t.tradePricing.itemId} showLabel required>
            <Input
              size="sm"
              dir="ltr"
              className="font-mono"
              value={values.itemId}
              disabled={isEvaluating}
              placeholder={t.tradeInventory.uuidPlaceholder}
              onChange={(event) => setValue({ itemId: event.target.value })}
            />
          </Field>
          <Field label={t.tradePricing.uomId} showLabel required>
            <Input
              size="sm"
              dir="ltr"
              className="font-mono"
              value={values.uomId}
              disabled={isEvaluating}
              placeholder={t.tradeInventory.uuidPlaceholder}
              onChange={(event) => setValue({ uomId: event.target.value })}
            />
          </Field>
          <Field
            label={t.tradeInventory.quantity}
            hint={t.tradeCommon.decimalHint}
            showLabel
            hintPlacement="tooltip"
            required
          >
            <Input
              size="sm"
              dir="ltr"
              className="font-mono tabular-nums"
              placeholder={t.tradeInventory.quantity}
              value={values.quantity}
              inputMode="decimal"
              disabled={isEvaluating}
              onChange={(event) => setValue({ quantity: event.target.value })}
              onBlur={() => {
                if (values.quantity.trim() && isTradeDecimalString(values.quantity.trim())) {
                  setValue({ quantity: formatTradeDecimal(values.quantity) });
                }
              }}
            />
          </Field>
          <div className="flex flex-col gap-1.5">
            <Field
              label={t.tradePricing.currencyCode}
              hint={t.tradePricing.guideCurrencyCode}
              showLabel
              hintPlacement="tooltip"
              required
            >
              <Input
                size="sm"
                dir="ltr"
                className="font-mono uppercase"
                placeholder={t.tradePricing.currencyCode}
                value={values.currencyCode}
                maxLength={3}
                disabled={isEvaluating}
                onChange={(event) => setValue({ currencyCode: event.target.value.toUpperCase() })}
              />
            </Field>
            <div className="flex flex-wrap gap-1">
              {COMMON_CURRENCY_PRESETS.slice(0, 4).map((preset) => (
                <Button
                  key={preset}
                  type="button"
                  size="xs"
                  variant={
                    values.currencyCode.trim().toUpperCase() === preset ? "primary" : "ghost"
                  }
                  disabled={isEvaluating}
                  onClick={() => setValue({ currencyCode: preset })}
                >
                  <IdentifierText className="text-xs">{preset}</IdentifierText>
                </Button>
              ))}
            </div>
          </div>
          <Field
            label={t.tradePricing.priceBookId}
            hint={t.tradePricing.optionalHint}
            showLabel
            hintPlacement="tooltip"
          >
            <Input
              size="sm"
              dir="ltr"
              className="font-mono"
              placeholder={t.tradePricing.priceBookId}
              value={values.priceBookId}
              disabled={isEvaluating}
              onChange={(event) => setValue({ priceBookId: event.target.value })}
            />
          </Field>
          <Field
            label={t.tradePricing.partyId}
            hint={t.tradePricing.optionalHint}
            showLabel
            hintPlacement="tooltip"
          >
            <Input
              size="sm"
              dir="ltr"
              className="font-mono"
              placeholder={t.tradePricing.partyId}
              value={values.partyId}
              disabled={isEvaluating}
              onChange={(event) => setValue({ partyId: event.target.value })}
            />
          </Field>
        </div>
      </div>

      {!isScopeResolved ? (
        <EmptyState
          icon={Calculator}
          title={t.tradeInventory.selectBranchFirst}
          description={t.tradeInventory.selectBranchFirstDescription}
        />
      ) : isEvaluating ? (
        <Skeleton className="h-40" />
      ) : noPrice ? (
        <EmptyState
          icon={Calculator}
          title={t.tradePricing.errorNoEligiblePrice}
          description={t.tradePricing.noEligiblePriceDescription}
        />
      ) : queryError ? (
        <ErrorState
          title={t.tradePricing.evaluateFailed}
          description={queryErrorMessage ?? queryError.message}
          onRetry={() => void evaluate()}
          retryLabel={t.common.retry}
        />
      ) : result ? (
        <div className="flex flex-col gap-4">
          {/* Explainability View Switcher & Pin Action */}
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-card p-2.5">
            <div className="flex flex-wrap items-center gap-1.5">
              <Button
                size="xs"
                variant={activeTab === "waterfall" ? "primary" : "ghost"}
                onClick={() => setActiveTab("waterfall")}
              >
                <ArrowDownRight className="size-3.5" aria-hidden="true" />
                {t.tradePricing.waterfallTab}
              </Button>
              <Button
                size="xs"
                variant={activeTab === "candidates" ? "primary" : "ghost"}
                onClick={() => setActiveTab("candidates")}
              >
                <Sparkles className="size-3.5" aria-hidden="true" />
                {t.tradePricing.candidatesTab}
              </Button>
              <Button
                size="xs"
                variant={activeTab === "comparison" ? "primary" : "ghost"}
                onClick={() => setActiveTab("comparison")}
              >
                <GitCompare className="size-3.5" aria-hidden="true" />
                {`${t.tradePricing.comparisonTab} (${pinnedEvaluations.length})`}
              </Button>
              <Button
                size="xs"
                variant={activeTab === "receipt" ? "primary" : "ghost"}
                onClick={() => setActiveTab("receipt")}
              >
                <FileSearch className="size-3.5" aria-hidden="true" />
                {t.tradePricing.receiptPayloadTab}
              </Button>
            </div>
            <div className="flex items-center gap-1.5">
              <Button size="xs" variant="outline" onClick={pinCurrentResult}>
                <Pin className="size-3.5" aria-hidden="true" />
                {t.tradePricing.pinToComparison}
              </Button>
              <Link
                href={`${TENANT_ROUTES.trade}/decisions/${result.decisionId}`}
                className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2.5 py-1 text-xs font-semibold text-foreground hover:bg-muted"
              >
                <ExternalLink className="size-3.5" aria-hidden="true" />
                {t.tradePricing.decisionReceipt}
              </Link>
            </div>
          </div>

          {activeTab === "waterfall" && (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
              {/* Step 1: Baseline */}
              <div
                className={cn(
                  "flex flex-col justify-between gap-2 rounded-lg border border-s-4 bg-card p-3.5",
                  SWATCH_SURFACE_PALETTES.indigo.accentBorder,
                )}
              >
                <span className="text-xs font-semibold text-muted-foreground">
                  {t.tradePricing.waterfallBaselineStep}
                </span>
                <div className="text-base font-semibold text-foreground">
                  <Money
                    value={result.baselineUnitPrice}
                    currency={result.currencyCode}
                    language={lang}
                    minimumFractionDigits={2}
                    maximumFractionDigits={8}
                  />
                </div>
                {result.matchedEntryId && (
                  <IdentifierText className="truncate text-xs text-muted-foreground">
                    {result.matchedEntryId}
                  </IdentifierText>
                )}
              </div>

              {/* Step 2: Promotions */}
              <div
                className={cn(
                  "flex flex-col justify-between gap-2 rounded-lg border border-s-4 bg-card p-3.5",
                  SWATCH_SURFACE_PALETTES.purple.accentBorder,
                )}
              >
                <span className="text-xs font-semibold text-muted-foreground">
                  {`2. ${t.tradePricing.waterfallPromoStep}`}
                </span>
                {result.matchedPromotions.length === 0 ? (
                  <span className="text-xs text-muted-foreground">{t.tradePricing.noPromotions}</span>
                ) : (
                  <div className="flex flex-wrap gap-1">
                    {result.matchedPromotions.map((promotion) => (
                      <Badge key={promotion.code} tone="brand">
                        {`${promotion.code} · -${formatTradeDecimal(promotion.discountAmount)}`}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              {/* Step 3: Floor Guard */}
              <div
                className={cn(
                  "flex flex-col justify-between gap-2 rounded-lg border border-s-4 bg-card p-3.5",
                  SWATCH_SURFACE_PALETTES.amber.accentBorder,
                )}
              >
                <span className="text-xs font-semibold text-muted-foreground">
                  {`3. ${t.tradePricing.waterfallFloorStep}`}
                </span>
                <div className="text-base font-semibold text-foreground">
                  {result.minimumAllowedPrice === null ? (
                    <span className="text-xs text-muted-foreground">{t.tradeCommon.notSet}</span>
                  ) : (
                    <Money
                      value={result.minimumAllowedPrice}
                      currency={result.currencyCode}
                      language={lang}
                      minimumFractionDigits={2}
                      maximumFractionDigits={8}
                    />
                  )}
                </div>
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <ShieldCheck className="size-3.5" aria-hidden="true" />
                  {tradeStatusLabel(t.tradeStatus, result.outcome, t.common.unknownCode)}
                </span>
              </div>

              {/* Step 4: Final Net Price */}
              <div
                className={cn(
                  "flex flex-col justify-between gap-2 rounded-lg border border-s-4 bg-card p-3.5",
                  SWATCH_SURFACE_PALETTES.green.accentBorder,
                )}
              >
                <span className="text-xs font-semibold text-muted-foreground">
                  {`4. ${t.tradePricing.waterfallFinalStep}`}
                </span>
                <div className="text-base font-semibold text-foreground">
                  <Money
                    value={result.unitPrice}
                    currency={result.currencyCode}
                    language={lang}
                    minimumFractionDigits={2}
                    maximumFractionDigits={8}
                  />
                </div>
                <span className="text-xs text-muted-foreground">
                  {result.taxFinal ? t.tradePricing.taxFinalTaxed : t.tradePricing.taxFinalPreTax}
                </span>
              </div>
            </div>
          )}

          {activeTab === "candidates" && (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div
                className={cn(
                  "flex flex-col gap-2.5 rounded-lg border p-4",
                  SWATCH_SURFACE_PALETTES.purple.sectionCard,
                )}
              >
                <span className="text-xs font-semibold text-foreground">
                  {t.tradePricing.rejectedPromotionsTitle} (
                  {(result.rejectedPromotions ?? []).length})
                </span>
                {(result.rejectedPromotions ?? []).length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    {t.tradePricing.noRejectedPromotions}
                  </p>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {(result.rejectedPromotions ?? []).map((rej, idx) => (
                      <li
                        key={`${rej.code}-${idx}`}
                        className="flex items-center justify-between rounded-md border border-border bg-card p-2.5 text-xs"
                      >
                        <IdentifierText className="font-semibold text-foreground">
                          {rej.code}
                        </IdentifierText>
                        <Badge tone="caution">{rej.reason}</Badge>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div
                className={cn(
                  "flex flex-col gap-2.5 rounded-lg border p-4",
                  SWATCH_SURFACE_PALETTES.amber.sectionCard,
                )}
              >
                <span className="text-xs font-semibold text-foreground">
                  {t.tradePricing.rejectedCandidatesTitle} (
                  {(result.rejectedCandidates ?? []).length})
                </span>
                {(result.rejectedCandidates ?? []).length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    {t.tradePricing.noRejectedCandidates}
                  </p>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {(result.rejectedCandidates ?? []).map((cand, idx) => (
                      <li
                        key={`${cand.entryId}-${idx}`}
                        className="flex items-center justify-between rounded-md border border-border bg-card p-2.5 text-xs"
                      >
                        <IdentifierText className="font-semibold text-foreground">
                          {cand.entryId}
                        </IdentifierText>
                        <Badge tone="neutral">{cand.reason}</Badge>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}

          {activeTab === "comparison" && (
            <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-foreground">
                  {t.tradePricing.comparisonTab} ({pinnedEvaluations.length})
                </span>
                {pinnedEvaluations.length > 0 && (
                  <Button size="xs" variant="ghost" onClick={clearPinnedEvaluations}>
                    {t.tradePricing.clearComparison}
                  </Button>
                )}
              </div>
              {pinnedEvaluations.length === 0 ? (
                <p className="text-xs text-muted-foreground">{t.tradePricing.comparisonEmpty}</p>
              ) : (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  {pinnedEvaluations.map((pinned) => (
                    <div
                      key={pinned.id}
                      className={cn(
                        "flex flex-col gap-2 rounded-lg border border-s-4 bg-muted/20 p-3",
                        SWATCH_SURFACE_PALETTES.indigo.accentBorder,
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <Badge tone="brand">{`${t.tradeInventory.quantity}: ${pinned.inputs.quantity}`}</Badge>
                        <Badge tone={pinned.decision.outcome === "ALLOW" ? "positive" : "caution"}>
                          {tradeStatusLabel(
                            t.tradeStatus,
                            pinned.decision.outcome,
                            t.common.unknownCode,
                          )}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">{t.tradePricing.unitPrice}</span>
                        <Money
                          value={pinned.decision.unitPrice}
                          currency={pinned.decision.currencyCode}
                          language={lang}
                          minimumFractionDigits={2}
                          maximumFractionDigits={8}
                        />
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">
                          {t.tradePricing.baselineUnitPrice}
                        </span>
                        <Money
                          value={pinned.decision.baselineUnitPrice}
                          currency={pinned.decision.currencyCode}
                          language={lang}
                          minimumFractionDigits={2}
                          maximumFractionDigits={8}
                        />
                      </div>
                      <Link
                        href={`${TENANT_ROUTES.trade}/decisions/${pinned.id}`}
                        className="text-xs font-semibold text-primary underline-offset-2 hover:underline"
                      >
                        <IdentifierText className="text-xs">{pinned.id}</IdentifierText>
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === "receipt" && (
            <div
              className={cn(
                "flex flex-col gap-3 rounded-lg border p-4",
                SWATCH_SURFACE_PALETTES.indigo.sectionCard,
              )}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-semibold text-foreground">
                  {t.tradePricing.receiptPayloadTab}
                </span>
                <Link
                  href={`${TENANT_ROUTES.trade}/decisions/${result.decisionId}`}
                  className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2.5 py-1 text-xs font-semibold text-foreground hover:bg-muted"
                >
                  <ExternalLink className="size-3.5" aria-hidden="true" />
                  {t.tradePricing.decisionReceipt}
                </Link>
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <div className="rounded-md border border-border bg-card p-2.5 text-xs">
                  <span className="block text-muted-foreground">
                    {t.tradePricing.decisionReceipt}
                  </span>
                  <IdentifierText className="mt-0.5 block truncate font-semibold text-foreground">
                    {result.decisionId}
                  </IdentifierText>
                </div>
                <div className="rounded-md border border-border bg-card p-2.5 text-xs">
                  <span className="block text-muted-foreground">
                    {t.tradePricing.priceBookId}
                  </span>
                  <IdentifierText className="mt-0.5 block truncate font-semibold text-foreground">
                    {result.priceBookId}
                  </IdentifierText>
                </div>
                <div className="rounded-md border border-border bg-card p-2.5 text-xs">
                  <span className="block text-muted-foreground">
                    {t.tradePricing.inputFingerprintLabel}
                  </span>
                  <IdentifierText className="mt-0.5 block truncate font-semibold text-foreground">
                    {result.inputFingerprint ?? result.checksum ?? result.priceBookVersionId}
                  </IdentifierText>
                </div>
              </div>
              <pre
                dir="ltr"
                className="max-h-72 overflow-auto rounded-lg border border-border bg-card p-3 font-mono text-xs text-foreground"
              >
                {JSON.stringify(result, null, 2)}
              </pre>
            </div>
          )}

          {/* Always keep main DetailSection summary visible for full contract fidelity */}
          <DetailSection
            title={t.tradePricing.decision}
            description={t.tradePricing.decisionDescription}
            emptyValueLabel={t.tradeCommon.notSet}
            fields={[
              {
                label: t.tradeInventory.outcome,
                value: (
                  <Badge tone={result.outcome === "ALLOW" ? "positive" : "caution"}>
                    {tradeStatusLabel(t.tradeStatus, result.outcome, t.common.unknownCode)}
                  </Badge>
                ),
              },
              {
                label: t.tradePricing.unitPrice,
                value: (
                  <Money
                    value={result.unitPrice}
                    currency={result.currencyCode}
                    language={lang}
                    minimumFractionDigits={2}
                    maximumFractionDigits={8}
                  />
                ),
              },
              {
                label: t.tradePricing.baselineUnitPrice,
                value: (
                  <Money
                    value={result.baselineUnitPrice}
                    currency={result.currencyCode}
                    language={lang}
                    minimumFractionDigits={2}
                    maximumFractionDigits={8}
                  />
                ),
              },
              {
                label: t.tradePricing.minimumAllowedPrice,
                value:
                  result.minimumAllowedPrice === null ? null : (
                    <Money
                      value={result.minimumAllowedPrice}
                      currency={result.currencyCode}
                      language={lang}
                      minimumFractionDigits={2}
                      maximumFractionDigits={8}
                    />
                  ),
              },
              {
                label: t.tradePricing.matchedPromotions,
                wide: true,
                value:
                  result.matchedPromotions.length === 0 ? null : (
                    <span className="flex flex-wrap gap-1">
                      {result.matchedPromotions.map((promotion) => (
                        <Badge key={promotion.code} tone="brand">
                          {`${promotion.code} · ${formatTradeDecimal(promotion.discountAmount)}`}
                        </Badge>
                      ))}
                    </span>
                  ),
              },
              {
                label: t.tradePricing.inputFingerprintLabel,
                value: result.inputFingerprint ? (
                  <IdentifierText className="text-xs">{result.inputFingerprint}</IdentifierText>
                ) : null,
              },
              {
                label: t.tradePricing.evaluatedAtLabel,
                value: result.evaluatedAt ? formatDateTime(result.evaluatedAt, lang) : null,
              },
              {
                label: t.tradePricing.decisionReceipt,
                wide: true,
                value: (
                  <Link
                    href={`${TENANT_ROUTES.trade}/decisions/${result.decisionId}`}
                    className="underline-offset-2 hover:underline"
                  >
                    <IdentifierText className="text-xs font-semibold">
                      {result.decisionId}
                    </IdentifierText>
                  </Link>
                ),
              },
            ]}
          />
        </div>
      ) : (
        <EmptyState
          icon={Calculator}
          title={t.tradePricing.evaluateNotAsked}
          description={t.tradePricing.evaluateNotAskedDescription}
        />
      )}
    </div>
  );

  return canRead ? (
    content
  ) : (
    <PermissionGate require={PRICING_READ_PERMISSION}>{content}</PermissionGate>
  );
}
