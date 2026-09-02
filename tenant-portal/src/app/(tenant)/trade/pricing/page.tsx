"use client";

import Link from "next/link";
import { Calculator, RotateCcw } from "lucide-react";
import {
  Badge,
  Button,
  DetailSection,
  EmptyState,
  ErrorState,
  Field,
  Input,
  Money,
  PageHeader,
  PermissionGate,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
} from "@/design-system";
import { TenantBranchSelect } from "@/components/tenant/TenantBranchSelect";
import { TENANT_ROUTES } from "@/lib/navigation/tenant-routes";
import { tradeStatusLabel } from "../trade-advanced-validation";
import {
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
    noPrice,
    isEvaluating,
    queryError,
    queryErrorMessage,
    formError,
    setValue,
    reset,
    evaluate,
  } = usePricingEvaluation();

  const content = (
    <div className="flex flex-col gap-4">
      <PageHeader
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
            <Button variant="outline" onClick={reset} disabled={isEvaluating}>
              <RotateCcw className="size-4" aria-hidden="true" />
              {t.tradeInventory.clearLookup}
            </Button>
          </>
        }
      />

      <div className="grid gap-3 md:grid-cols-3">
        <Field label={t.tradePricing.bookPurpose} required error={formError ?? undefined}>
          <Select
            value={values.purpose}
            disabled={isEvaluating}
            onValueChange={(next) => setValue({ purpose: next as EvaluateFormValues["purpose"] })}
          >
            <SelectTrigger aria-label={t.tradePricing.bookPurpose}>
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
        <Field label={t.tradePricing.itemId} required>
          <Input
            value={values.itemId}
            disabled={isEvaluating}
            placeholder={t.tradeInventory.uuidPlaceholder}
            onChange={(event) => setValue({ itemId: event.target.value })}
          />
        </Field>
        <Field label={t.tradePricing.uomId} required>
          <Input
            value={values.uomId}
            disabled={isEvaluating}
            placeholder={t.tradeInventory.uuidPlaceholder}
            onChange={(event) => setValue({ uomId: event.target.value })}
          />
        </Field>
        <Field label={t.tradeInventory.quantity} required hint={t.tradeCommon.decimalHint}>
          <Input
            value={values.quantity}
            inputMode="decimal"
            disabled={isEvaluating}
            onChange={(event) => setValue({ quantity: event.target.value })}
          />
        </Field>
        <Field label={t.tradePricing.currencyCode} required hint={t.tradePricing.currencyCodeHint}>
          <Input
            value={values.currencyCode}
            maxLength={3}
            disabled={isEvaluating}
            onChange={(event) => setValue({ currencyCode: event.target.value })}
          />
        </Field>
        <Field label={t.tradePricing.priceBookId} hint={t.tradePricing.optionalHint}>
          <Input
            value={values.priceBookId}
            disabled={isEvaluating}
            onChange={(event) => setValue({ priceBookId: event.target.value })}
          />
        </Field>
        <Field label={t.tradePricing.partyId} hint={t.tradePricing.optionalHint}>
          <Input
            value={values.partyId}
            disabled={isEvaluating}
            onChange={(event) => setValue({ partyId: event.target.value })}
          />
        </Field>
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
        // 404 here means "no price applies", not "not found" — it is an answer.
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
                <Money value={result.unitPrice} currency={result.currencyCode} language={lang} />
              ),
            },
            {
              label: t.tradePricing.baselineUnitPrice,
              value: (
                <Money
                  value={result.baselineUnitPrice}
                  currency={result.currencyCode}
                  language={lang}
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
                        {`${promotion.code} · ${promotion.discountAmount}`}
                      </Badge>
                    ))}
                  </span>
                ),
            },
            {
              label: t.tradePricing.decisionReceipt,
              wide: true,
              value: (
                <Link
                  href={`${TENANT_ROUTES.trade}/decisions/${result.decisionId}`}
                  className="underline-offset-2 hover:underline"
                >
                  {result.decisionId}
                </Link>
              ),
            },
          ]}
        />
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
