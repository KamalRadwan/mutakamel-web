"use client";

import { Trash2 } from "lucide-react";
import {
  Button,
  Field,
  Money,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  cn,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatNumber } from "@/lib/format/number";
import { multiplyFixedDecimal } from "../../documents/fixed-decimal";
import type { TradeLineDraftState } from "../../documents/hooks/useTradeLineDraft";
import { itemDescriptionPreview } from "../../documents/trade-lookup-contract";
import type { QuotationPricingState } from "../hooks/useQuotationPricing";
import type { QuotationBasePrices } from "../hooks/useQuotationBasePrices";
import { QuotationItemIdentity, QuotationItemThumbnail } from "./QuotationItemIdentity";
import { QuotationLineDiscount } from "./QuotationLineDiscount";
import { QuotationPriceDetails } from "./QuotationPriceDetails";
import { QuotationQuantityControl } from "./QuotationQuantityControl";

export interface QuotationLineDisplay {
  description?: string;
  itemName?: string;
  sku?: string;
  uomCode?: string;
  unavailable?: boolean;
}

export type QuotationLineDisplayMap = Record<string, QuotationLineDisplay>;

export function QuotationLineMobileCards({
  draft,
  pricing,
  basePrices,
  currencyCode,
  disabled,
  lineDisplayById,
}: {
  draft: TradeLineDraftState;
  pricing: QuotationPricingState;
  basePrices: QuotationBasePrices["byLineId"];
  currencyCode: string;
  disabled: boolean;
  lineDisplayById?: QuotationLineDisplayMap;
}) {
  const { t, lang, dir } = useI18n();
  const copy = t.quotationExperience;
  const { mode, scope } = pricing.discount.draft;
  const promotion = mode === "PROMOTIONS";
  const showLineDiscount = mode === "DISCOUNT" && scope === "LINE";

  return (
    <div className="space-y-2.5 lg:hidden">
      {draft.lines.map((line, index) => {
        const display = lineDisplayById?.[line.clientLineId];
        if (!line.itemId && !display) return null;
        const rowNumber = index + 1;
        const item = line.itemId ? draft.itemsById[line.itemId] : undefined;
        const isUnavailable = Boolean(display?.unavailable) || !line.itemId;
        const calculated = pricing.byLineId[line.clientLineId];
        const base = basePrices[line.clientLineId];
        const previewUnitPrice = promotion ? calculated?.baseUnitPrice : calculated?.unitPrice;
        const unitPrice = previewUnitPrice ?? base?.unitPrice;
        const lineAmount = promotion && calculated
          ? multiplyFixedDecimal(calculated.quantity, calculated.baseUnitPrice)
          : calculated?.subtotal ?? base?.lineAmount;
        const descriptionText =
          display?.description !== undefined
            ? display.description
            : item
              ? itemDescriptionPreview(item, lang, draft.purpose)
              : "";
        const units = line.itemId ? (draft.uomsByItem[line.itemId] ?? []) : [];
        const hasSelectedUom = Boolean(line.uomId && units.some((unit) => unit.id === line.uomId));

        return (
          <div
            key={line.clientLineId}
            className={cn(
              "space-y-2 rounded-lg border p-2.5",
              isUnavailable ? "border-warning/40 bg-warning-subtle/30" : "border-border bg-card",
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{formatNumber(rowNumber, lang)}</span>
                <QuotationItemThumbnail item={item} />
                <QuotationItemIdentity item={item} fallback={{
                  ...display, unavailable: isUnavailable,
                }} />
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-11 w-11 shrink-0 px-0 text-muted-foreground hover:text-destructive"
                disabled={disabled}
                aria-label={`${copy.removeItem} ${rowNumber}`}
                onClick={() => draft.removeLine(index)}
              >
                <Trash2 className="size-4" aria-hidden="true" />
              </Button>
            </div>

            <div className="min-w-0 space-y-0.5 rounded-md bg-primary/5 px-2.5 py-1.5">
              <p className="text-xs font-medium text-muted-foreground">{t.dashboard.description}</p>
              <p className="text-xs leading-4 text-foreground wrap-anywhere whitespace-pre-wrap">
                {descriptionText.trim() ? <bdi dir="auto">{descriptionText}</bdi> : <span className="text-muted-foreground">—</span>}
              </p>
            </div>

            {isUnavailable ? (
              <div className="space-y-2.5 border-t border-border pt-2">
                <dl className="flex flex-wrap items-center justify-between gap-3 text-sm">
                  <div className="flex items-center gap-1.5">
                    <dt className="text-xs text-muted-foreground">{copy.unit}:</dt>
                    <dd className="text-foreground">{display?.uomCode ?? "—"}</dd>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <dt className="text-xs text-muted-foreground">{copy.quantity}:</dt>
                    <dd dir="ltr" className="tabular-nums text-foreground">
                      {line.quantity}
                    </dd>
                  </div>
                </dl>
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-start justify-between gap-2.5">
                  <Field
                    label={`${copy.unit} ${rowNumber}`}
                    showLabel
                    error={draft.lineErrors[index]?.uom ? copy.selectUnit : undefined}
                    className="min-w-28 flex-1"
                  >
                    <Select
                      dir={dir}
                      value={line.uomId || undefined}
                      disabled={disabled}
                      onValueChange={(value) => draft.setUom(index, value)}
                    >
                      <SelectTrigger size="md" className="min-h-11">
                        <SelectValue placeholder={copy.selectUnit} />
                      </SelectTrigger>
                      <SelectContent>
                        {!hasSelectedUom && line.uomId && display?.uomCode ? (
                          <SelectItem value={line.uomId}>{display.uomCode}</SelectItem>
                        ) : null}
                        {units.map((unit) => (
                          <SelectItem key={unit.id} value={unit.id}>
                            {unit.displayName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium">{copy.quantity}</p>
                    <QuotationQuantityControl
                      label={`${copy.quantity} ${rowNumber}`}
                      value={line.quantity}
                      disabled={disabled}
                      onChange={(value) => draft.setQuantity(index, value)}
                      onBlur={() => draft.commitQuantity(index)}
                      error={draft.lineErrors[index]?.quantity ? copy.quantityInvalid : undefined}
                    />
                  </div>
                </div>

                {showLineDiscount ? <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">{t.quotationDiscount.lineDiscount}</p>
                  <QuotationLineDiscount
                    state={pricing}
                    clientLineId={line.clientLineId}
                    number={rowNumber}
                    currencyCode={currencyCode}
                    disabled={disabled}
                  />
                </div> : null}

                <dl className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-2">
                  <div className="space-y-0.5">
                    <dt className="text-xs text-muted-foreground">{copy.unitPrice}</dt>
                    <dd className="inline-flex items-center gap-1 text-sm tabular-nums">
                      {unitPrice != null ? (
                        <Money value={unitPrice} currency={currencyCode} maximumFractionDigits={8} />
                      ) : (
                        <span className="text-muted-foreground">{pricing.preview.loading || base?.loading ? copy.pricePending
                          : base?.unavailable ? copy.priceUnavailable : "—"}</span>
                      )}
                      {calculated?.priceDecision ? <QuotationPriceDetails decision={calculated.priceDecision} /> : null}
                    </dd>
                  </div>
                  <div className="space-y-0.5 text-end">
                    <dt className="text-xs text-muted-foreground">{copy.lineAmount}</dt>
                    <dd className="text-base font-semibold text-foreground tabular-nums">
                      {lineAmount != null ? (
                        <Money value={lineAmount} currency={currencyCode} maximumFractionDigits={8} />
                      ) : (
                        "—"
                      )}
                    </dd>
                  </div>
                </dl>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
