"use client";

import { Field, IdentifierText, Input, Money, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, cn } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { compareFixedDecimal } from "../../documents/fixed-decimal";
import type { QuotationPricingState } from "../hooks/useQuotationPricing";
import { discountValue } from "../quotation-discount-draft";

export function QuotationLineDiscount({
  state,
  clientLineId,
  number,
  currencyCode,
  disabled = false,
  compact = false,
}: {
  state: QuotationPricingState;
  clientLineId: string;
  number: number;
  currencyCode: string;
  disabled?: boolean;
  compact?: boolean;
}) {
  const { t, dir } = useI18n();
  const copy = t.quotationDiscount;
  const draft = state.discount.draft;
  const calculated = state.byLineId[clientLineId];
  const intent = draft.lineDiscounts[clientLineId] ?? { type: "PERCENT" as const, value: "0" };

  const canonical = discountValue(intent.value, intent.type);
  const error = canonical === null ? (intent.type === "PERCENT" ? copy.invalidPercent : copy.invalidValue) : undefined;
  const maxAllowed = calculated
    ? intent.type === "PERCENT"
      ? calculated.maxDiscountPercent
      : calculated.maxDiscountAmount
    : null;
  const exceedsMax = Boolean(maxAllowed && canonical !== null && compareFixedDecimal(canonical, maxAllowed) > 0);
  const showCapInline = !compact || Boolean(error) || exceedsMax;

  return (
    <div
      className={cn(compact ? "min-w-46 space-y-0.5" : "w-full space-y-1.5")}
      title={
        maxAllowed
          ? `${intent.type === "PERCENT" ? copy.maximumPercent : copy.maximumAmount}: ${maxAllowed}${intent.type === "PERCENT" ? "%" : ` ${currencyCode}`}`
          : undefined
      }
    >
      <div className={cn("flex items-start gap-1", !compact && "w-full")}>
        <Field label={`${copy.type} ${number}`} className="shrink-0 gap-0">
          <Select
            dir={dir}
            value={intent.type}
            disabled={disabled}
            onValueChange={(value) => {
              if (value === "PERCENT" || value === "AMOUNT") state.discount.setLineType(clientLineId, value);
            }}
          >
            <SelectTrigger size={compact ? "sm" : "md"} className={cn(compact ? "h-6 w-27 px-1.5 text-xs" : "min-h-11 w-28 lg:min-h-9")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="PERCENT">{copy.percent}</SelectItem>
              <SelectItem value="AMOUNT">{copy.amount}</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field
          label={`${copy.lineDiscount} ${number}`}
          error={error}
          className={cn(!error && "gap-0", compact ? "w-18 gap-0 [&>p]:sr-only" : "min-w-0 flex-1")}
        >
          <div dir="ltr" className="relative">
            <Input
              size={compact ? "sm" : "md"}
              inputMode="decimal"
              dir="ltr"
              value={intent.value}
              maxLength={40}
              disabled={disabled}
              className={cn(
                "scroll-mt-16 text-end tabular-nums",
                compact ? "h-6 ps-1.5" : "min-h-11 lg:min-h-9",
                intent.type === "PERCENT" ? "pe-6" : "pe-9",
              )}
              onChange={(event) => state.discount.setLineValue(clientLineId, event.target.value)}
            />
            <span aria-hidden="true" className="pointer-events-none absolute end-1.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
              <IdentifierText>{intent.type === "PERCENT" ? "%" : currencyCode}</IdentifierText>
            </span>
          </div>
        </Field>
      </div>
      {compact && error ? <p role="alert" className="max-w-46 text-start text-xs text-destructive">{error}</p> : null}
      {calculated && showCapInline ? (
        <p className={cn("text-end text-xs", exceedsMax ? "text-warning" : "text-muted-foreground")}>
          {intent.type === "PERCENT" ? copy.maximumPercent : copy.maximumAmount}:{" "}
          <Money
            value={intent.type === "PERCENT" ? calculated.maxDiscountPercent : calculated.maxDiscountAmount}
            currency={intent.type === "AMOUNT" ? currencyCode : undefined}
            maximumFractionDigits={8}
          />
          {intent.type === "PERCENT" ? "%" : null}
        </p>
      ) : null}
    </div>
  );
}
