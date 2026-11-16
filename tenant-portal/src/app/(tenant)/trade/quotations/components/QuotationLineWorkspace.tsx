"use client";

import { Layers, Plus, Trash2 } from "lucide-react";
import { Badge, Button, Field, Money,
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Table,
  TableBody, TableCell, TableHead, TableHeader, TableRow, Tooltip, TooltipContent, TooltipProvider, TooltipTrigger, cn } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatNumber } from "@/lib/format/number";
import { compareFixedDecimal, multiplyFixedDecimal } from "../../documents/fixed-decimal";
import { emptyTradeLine, type TradeLineDraftState } from "../../documents/hooks/useTradeLineDraft";
import { itemDescriptionPreview, itemDisplayName } from "../../documents/trade-lookup-contract";
import { canonicalTradeQuantity, TRADE_DOCUMENT_MAX_LINES } from "../../documents/trade-line-validation";
import { useQuotationItemPicker } from "../hooks/useQuotationItemPicker";
import type { QuotationPricingState } from "../hooks/useQuotationPricing";
import { useQuotationBasePrices } from "../hooks/useQuotationBasePrices";
import { QuotationItemIdentity, QuotationItemThumbnail } from "./QuotationItemIdentity";
import { QuotationItemPickerModal } from "./QuotationItemPickerModal";
import { QuotationLineMobileCards, type QuotationLineDisplay, type QuotationLineDisplayMap } from "./QuotationLineMobileCards";
import { QuotationLineDiscount } from "./QuotationLineDiscount";
import { QuotationDeductionRow } from "./QuotationDeductionRow";
import { QuotationPriceDetails } from "./QuotationPriceDetails";
import { QuotationPricingTotals } from "./QuotationPricingTotals";
import { QuotationQuantityControl } from "./QuotationQuantityControl";

export type { QuotationLineDisplay, QuotationLineDisplay as QuotationLineDisplayInfo, QuotationLineDisplayMap };

export function QuotationLineWorkspace({ draft, pricing, currencyCode, partyId, crmCustomerProfileId, headers, disabled = false, compact = false, lineDisplayById }: {
  draft: TradeLineDraftState; currencyCode: string; partyId: string | null; headers: Record<string, string>;
  crmCustomerProfileId?: string | null;
  pricing: QuotationPricingState; disabled?: boolean; compact?: boolean; lineDisplayById?: QuotationLineDisplayMap;
}) {
  const { t, lang, dir } = useI18n();
  const copy = t.quotationExperience;
  const picker = useQuotationItemPicker({
    draft, headers, currencyCode, partyId, crmCustomerProfileId, pricingMode: pricing.discount.draft.mode,
  });
  const populated = draft.lines.map((line, index) => ({ line, index }))
    .filter(({ line }) => Boolean(line.itemId) || Boolean(lineDisplayById?.[line.clientLineId]));
  const showBasePrices = partyId === null && populated.length > 0;
  const basePrices = useQuotationBasePrices({
    headers, currencyCode, lines: populated.map(({ line }) => line), enabled: showBasePrices,
  });


  const modalPicker = {
    ...picker,
    add: () => {
      if (!picker.canAdd) return;
      const hasUnresolvedProtected = draft.lines.some((line) => !line.itemId && Boolean(lineDisplayById?.[line.clientLineId]));
      if (!hasUnresolvedProtected) { picker.add(); return; }
      const additions = picker.rows.map((row) => ({
        ...emptyTradeLine(), itemId: row.itemId, uomId: row.uomId, quantity: canonicalTradeQuantity(row.quantity) ?? row.quantity,
      }));
      const realLines = draft.lines.filter((line) =>
        Boolean(line.itemId) || Boolean(line.uomId) || line.quantity !== "1" || Boolean(lineDisplayById?.[line.clientLineId]));
      draft.reset([...realLines, ...additions]);
      picker.setOpen(false);
    },
  };

  const { mode, scope } = pricing.discount.draft;
  const documentDiscount = mode === "DISCOUNT" && scope === "DOCUMENT";
  const showLineDiscount = mode === "DISCOUNT" && scope === "LINE";
  const totals = pricing.ready ? pricing.preview.calculation?.totals ?? null : null;
  const promotion = mode === "PROMOTIONS";
  const deduction = promotion ? totals?.promotionSavings : totals?.discountTotal;
  const showDeduction = populated.length > 0 && (documentDiscount || (deduction !== undefined && compareFixedDecimal(deduction, "0") > 0));

  return (
    <TooltipProvider>
      <section className={cn("min-w-0 bg-card", !compact && "rounded-lg border border-border shadow-xs")} aria-label={copy.itemSection}>
        <div className={cn("flex flex-wrap items-center justify-between gap-2", compact ? "pb-2 pt-0.5" : "px-3 py-2")}>
          <div className="flex items-center gap-2">
            <Layers className="size-4 text-muted-foreground" aria-hidden="true" />
            <h2 className="text-sm font-semibold text-foreground">{copy.itemSection}</h2>
            <Badge tone="neutral" size="compact">{String(populated.length)}</Badge>
          </div>
          <Button variant="outline" size="sm" className="gap-1.5 border-primary/50 text-primary"
            disabled={disabled || populated.length >= TRADE_DOCUMENT_MAX_LINES}
            onClick={() => picker.setOpen(true)}>
            <Plus className="size-3.5" aria-hidden="true" />{copy.addItems}
          </Button>
        </div>

        <div className={cn("space-y-2.5", !compact && "px-3 pb-3")}>
          {populated.length > 0 ? (
            <QuotationLineMobileCards draft={draft} pricing={pricing} currencyCode={currencyCode}
              basePrices={basePrices.byLineId} disabled={disabled} lineDisplayById={lineDisplayById} />
          ) : null}
          {showDeduction ? <QuotationDeductionRow amount={deduction} currencyCode={currencyCode} promotion={promotion} /> : null}

          <div className="overflow-hidden rounded-lg border border-border">
            <div className={cn("overflow-x-auto", populated.length > 0 && "hidden lg:block")}>
              <Table className="text-xs [&_td]:text-xs [&_th]:text-xs">
                <TableHeader className="bg-primary/5">
                  <TableRow className="h-8 hover:bg-transparent">
                    <TableHead scope="col" aria-label={t.common.rowNumber} className="h-8 w-9 px-2 py-1 text-center">{t.common.rowNumberShort}</TableHead>
                    <TableHead aria-hidden="true" className="h-8 w-9 p-0" />
                    <TableHead scope="col" className="h-8 w-[21%] px-2.5 py-1">{t.tradeDocuments.item}</TableHead>
                    <TableHead scope="col" className="h-8 w-[30%] px-2.5 py-1">{t.dashboard.description}</TableHead>
                    <TableHead scope="col" className="h-8 px-2 py-1">{copy.unit}</TableHead>
                    <TableHead scope="col" className="h-8 px-2 py-1 text-end">{copy.quantity}</TableHead>
                    <TableHead scope="col" className="h-8 px-2.5 py-1 text-end">{copy.unitPrice}</TableHead>
                    {showLineDiscount ? <TableHead scope="col" className="h-8 px-2 py-1">{t.quotationDiscount.lineDiscount}</TableHead> : null}
                    <TableHead scope="col" className="h-8 px-2.5 py-1 text-end">{copy.lineAmount}</TableHead>
                    <TableHead scope="col" className="h-8 w-10 px-1.5 py-1 text-end"><span className="sr-only">{copy.lineActions}</span></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {populated.length === 0 ? (
                    <TableRow className="h-9 hover:bg-transparent">
                      <TableCell colSpan={showLineDiscount ? 10 : 9} className="px-3 py-1.5 text-center text-sm font-normal text-muted-foreground">{copy.itemEmpty}</TableCell>
                    </TableRow>
                  ) : populated.map(({ line, index }) => {
                    const rowNumber = index + 1;
                    const display = lineDisplayById?.[line.clientLineId];
                    const item = line.itemId ? draft.itemsById[line.itemId] : undefined;
                    const isUnavailable = Boolean(display?.unavailable) || !line.itemId;
                    const errors = draft.lineErrors[index];
                    const calculated = pricing.byLineId[line.clientLineId];
                    const base = basePrices.byLineId[line.clientLineId];
                    const previewUnitPrice = promotion ? calculated?.baseUnitPrice : calculated?.unitPrice;
                    const unitPrice = previewUnitPrice ?? base?.unitPrice;
                    const lineAmount = promotion && calculated
                      ? multiplyFixedDecimal(calculated.quantity, calculated.baseUnitPrice)
                      : calculated?.subtotal ?? base?.lineAmount;
                    const descriptionText = display?.description !== undefined
                      ? display.description : item ? itemDescriptionPreview(item, lang, draft.purpose) : "";
                    const units = line.itemId ? (draft.uomsByItem[line.itemId] ?? []) : [];
                    const hasSelectedUom = Boolean(line.uomId && units.some((unit) => unit.id === line.uomId));
                    const rowItemLabel = item
                      ? itemDisplayName(item, lang) : display?.itemName?.trim() || display?.sku?.trim() || `${t.tradeDocuments.item} ${rowNumber}`;
  
                    return (
                      <TableRow key={line.clientLineId}
                        className={cn("h-8 scroll-mt-16", isUnavailable ? "bg-warning-subtle/30 hover:bg-warning-subtle/50" : "even:bg-primary/3 hover:bg-primary/5")}>
                        <TableCell className="w-9 px-2 py-0.5 text-center align-middle tabular-nums text-muted-foreground">
                          {formatNumber(rowNumber, lang)}
                        </TableCell>
                        <TableCell aria-hidden="true" className="w-9 px-1.5 py-0.5 align-middle">
                          <QuotationItemThumbnail item={item} />
                        </TableCell>
                        <TableCell className="min-w-36 max-w-56 px-2.5 py-0.5 align-middle">
                          <QuotationItemIdentity item={item}
                            fallback={display ? { ...display, unavailable: isUnavailable } : isUnavailable ? { unavailable: true } : undefined} />
                        </TableCell>
  
                        <TableCell className="min-w-44 max-w-80 px-2.5 py-0.5 align-middle text-start font-normal">
                          {descriptionText.trim() ? (
                            <bdi dir="auto" className="block leading-4 wrap-anywhere whitespace-pre-wrap text-foreground">{descriptionText}</bdi>
                          ) : <span className="text-muted-foreground">—</span>}
                        </TableCell>
  
                        <TableCell className="w-28 px-2 py-0.5 align-middle font-normal">
                          {isUnavailable ? <span className="text-muted-foreground">{display?.uomCode ?? "—"}</span> : (
                            <Field label={`${copy.unit} ${rowNumber}`} error={errors?.uom ? copy.selectUnit : undefined}
                              className={cn(!errors?.uom && "gap-0", errors?.uom && "gap-0.5")}>
                              <Select dir={dir} value={line.uomId || undefined} onValueChange={(value) => draft.setUom(index, value)} disabled={disabled}>
                                <SelectTrigger size="sm" className="h-6 w-24 px-2 text-xs"><SelectValue placeholder={copy.selectUnit} /></SelectTrigger>
                                <SelectContent>
                                  {!hasSelectedUom && line.uomId && display?.uomCode ? <SelectItem value={line.uomId}>{display.uomCode}</SelectItem> : null}
                                  {units.map((unit) => <SelectItem key={unit.id} value={unit.id}>{unit.displayName}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            </Field>
                          )}
                        </TableCell>
  
                        <TableCell className="w-18 px-2 py-0.5 align-middle text-end font-normal">
                          {isUnavailable ? <span dir="ltr" className="tabular-nums text-muted-foreground">{line.quantity}</span> : (
                            <QuotationQuantityControl compact label={`${copy.quantity} ${rowNumber}`} value={line.quantity}
                              onChange={(value) => draft.setQuantity(index, value)} onBlur={() => draft.commitQuantity(index)}
                              disabled={disabled} error={errors?.quantity ? copy.quantityInvalid : undefined} />
                          )}
                        </TableCell>
  
                        <TableCell className="w-32 px-2.5 py-0.5 align-middle text-end font-normal">
                          <div className="inline-flex items-center justify-end gap-1 tabular-nums">
                            {unitPrice != null ? <Money value={unitPrice} currency={currencyCode} maximumFractionDigits={8} />
                              : <span className="text-muted-foreground">{
                                !isUnavailable && (pricing.preview.loading || base?.loading) ? copy.pricePending
                                  : base?.unavailable ? copy.priceUnavailable : "—"
                              }</span>}
                            {calculated?.priceDecision ? <QuotationPriceDetails decision={calculated.priceDecision} /> : null}
                          </div>
                        </TableCell>
  
                        {showLineDiscount ? <TableCell className="px-2 py-0.5 align-middle text-end font-normal">
                          {isUnavailable ? <span className="text-muted-foreground">—</span> : (
                            <QuotationLineDiscount compact state={pricing} clientLineId={line.clientLineId}
                              number={rowNumber} currencyCode={currencyCode} disabled={disabled} />
                          )}
                        </TableCell> : null}
  
                        <TableCell className="w-32 px-2.5 py-0.5 align-middle text-end font-medium tabular-nums">
                          {lineAmount != null ? <Money value={lineAmount} currency={currencyCode} maximumFractionDigits={8} />
                            : <span className="text-muted-foreground">—</span>}
                        </TableCell>
  
                        <TableCell className="px-1.5 py-0.5 align-middle text-end">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button type="button" variant="ghost" size="xs" className="size-7 px-0 text-destructive"
                                disabled={disabled} aria-label={`${copy.removeItem}: ${rowItemLabel}`}
                                onClick={() => draft.removeLine(index)}>
                                <Trash2 className="size-3.5" aria-hidden="true" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>{copy.removeItem}</TooltipContent>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {showDeduction ? <QuotationDeductionRow amount={deduction} currencyCode={currencyCode} promotion={promotion}
                    labelColumns={showLineDiscount ? 8 : 7} hasActions /> : null}
                </TableBody>
              </Table>
            </div>
  
            <QuotationPricingTotals totals={totals} mode={mode} currencyCode={currencyCode}
              showBasePrices={showBasePrices} baseSubtotal={basePrices.subtotal} integrated />
          </div>
        </div>

        <QuotationItemPickerModal picker={modalPicker} draft={draft} currencyCode={currencyCode} showBasePrices={partyId === null} />
      </section>
    </TooltipProvider>
  );
}
