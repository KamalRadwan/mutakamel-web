"use client";

import Link from "next/link";
import { Calculator, ExternalLink, ShieldCheck, Tag, Trash2 } from "lucide-react";
import {
  Badge,
  Button,
  Combobox,
  DegradedBanner,
  Field,
  IdentifierText,
  Input,
  Money,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Separator,
  SWATCH_SURFACE_PALETTES,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  cn,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { multiplyFixedDecimal } from "../fixed-decimal";
import { tradeDocumentMessage } from "../trade-document-errors";
import { itemDescriptionPreview, itemDisplayName } from "../trade-lookup-contract";
import type { TradeLineDraftState } from "../hooks/useTradeLineDraft";

export interface TradeLineEditorProps {
  state: TradeLineDraftState;
  currencyCode: string;
  disabled: boolean;
  priceBookCodeById?: ReadonlyMap<string, string>;
  accountAssignedPriceBookId?: string | null;
}

/**
 * The document line editor — MASTER-PLAN 11.20.
 *
 * Item through `Combobox`, UOM through `Select` narrowed to the item, quantity
 * as text, and a running total computed from the pricing engine's own resolved
 * `unitPrice`. The price column is read-only because it is not a field on any
 * of these line DTOs: the server resolves it, and typing one here would be
 * inventing a number the request has nowhere to carry.
 */
export function TradeLineEditor({
  state,
  currencyCode,
  disabled,
  priceBookCodeById,
  accountAssignedPriceBookId,
}: TradeLineEditorProps) {
  const { t, lang } = useI18n();

  return (
    <div className="flex flex-col gap-3">
      {state.lookupError ? (
        <DegradedBanner
          message={
            tradeDocumentMessage(state.lookupError.code, t.tradeDocuments.errors) ??
            t.tradeDocuments.lineEditor.lookupUnavailable
          }
        />
      ) : null}

      <ul className="flex flex-col gap-3">
        {state.lines.map((line, index) => {
          const uoms = state.uomsByItem[line.itemId] ?? [];
          const selected = state.itemsById[line.itemId];
          const description = selected
            ? itemDescriptionPreview(selected, lang, state.purpose)
            : null;
          const isInvalid = state.invalidLineIndex === index;
          return (
            <li
              key={line.clientLineId}
              className="grid gap-3 rounded-sm border border-border p-3 sm:grid-cols-12"
              aria-busy={line.isPricing || undefined}
            >
              <div className="sm:col-span-5">
                <Field label={t.tradeDocuments.item} required>
                  <Combobox
                    value={line.itemId || undefined}
                    selectedLabel={selected ? itemDisplayName(selected, lang) : undefined}
                    onValueChange={(next) => state.setItem(index, next ?? "")}
                    options={state.items.map((item) => ({
                      value: item.id,
                      label: itemDisplayName(item, lang),
                      description: [item.canonicalCode, item.barcode].filter(Boolean).join(" · "),
                    }))}
                    onSearch={state.searchItems}
                    loading={state.isLoadingItems}
                    disabled={disabled}
                    placeholder={t.tradeDocuments.lineEditor.selectItem}
                    searchPlaceholder={t.tradeDocuments.lineEditor.searchItem}
                    loadingLabel={t.common.loading}
                    emptyLabel={t.tradeDocuments.lineEditor.noItems}
                  />
                </Field>
                {description ? (
                  <p className="mt-1.5 text-xs text-muted-foreground" aria-live="polite">
                    <span className="font-semibold text-foreground">
                      {t.tradeDocuments.lineEditor.descriptionPreview}:
                    </span>{" "}
                    {description}
                  </p>
                ) : null}
              </div>

              <div className="sm:col-span-3">
                <Field label={t.tradeDocuments.uom} required>
                  <Select
                    value={line.uomId}
                    onValueChange={(next) => state.setUom(index, next)}
                    disabled={disabled || uoms.length === 0}
                  >
                    <SelectTrigger size="sm">
                      <SelectValue placeholder={t.tradeDocuments.lineEditor.selectUom} />
                    </SelectTrigger>
                    <SelectContent>
                      {uoms.map((uom) => (
                        <SelectItem key={uom.id} value={uom.id}>
                          {uom.displayName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>

              <div className="sm:col-span-2">
                <Field
                  label={t.tradeDocuments.quantity}
                  required
                  error={isInvalid ? t.tradeDocuments.lineEditor.quantityInvalid : undefined}
                >
                  <Input size="sm" placeholder={t.tradeDocuments.quantity}
                    inputMode="decimal"
                    value={line.quantity}
                    onChange={(event) => state.setQuantity(index, event.target.value)}
                    onBlur={() => state.commitQuantity(index)}
                    disabled={disabled}
                  />
                </Field>
              </div>

              <div className="flex items-end justify-between gap-2 sm:col-span-2">
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">{t.tradeDocuments.lineTotal}</p>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-foreground">
                    {line.unitPrice === null ? (
                      <span className="text-muted-foreground">
                        {line.priceError !== null
                          ? (tradeDocumentMessage(line.priceError, t.tradeDocuments.errors) ??
                            t.tradeDocuments.lineEditor.priceUnavailable)
                          : t.tradeDocuments.lineEditor.awaitingPrice}
                      </span>
                    ) : (
                      <>
                        <Money
                          value={multiplyFixedDecimal(line.quantity, line.unitPrice)}
                          currency={currencyCode}
                          minimumFractionDigits={2}
                          maximumFractionDigits={8}
                        />
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 gap-1 px-1.5 text-xs"
                              aria-label={t.tradePricing.linePriceBreakdownTitle}
                            >
                              <ShieldCheck className="size-3.5 text-primary" aria-hidden="true" />
                              <Money
                                value={line.unitPrice}
                                currency={currencyCode}
                                minimumFractionDigits={2}
                                maximumFractionDigits={4}
                              />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent
                            align="end"
                            className="w-96 space-y-3 rounded-card border-primary/30 p-4 shadow-column"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="space-y-0.5">
                                <p className="text-xs font-bold text-primary">
                                  {t.tradePricing.linePriceBreakdownTitle}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {t.tradePricing.lineResolvedFromBook}
                                </p>
                              </div>
                              <span
                                className={cn(
                                  "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-bold",
                                  SWATCH_SURFACE_PALETTES.blue.badge,
                                )}
                              >
                                <Calculator className="size-3" aria-hidden="true" />
                                <IdentifierText>{state.purpose}</IdentifierText>
                              </span>
                            </div>

                            <Separator />

                            <dl className="space-y-2 text-xs">
                              {line.priceBreakdown?.priceBookId ? (
                                <>
                                  <div className="flex items-center justify-between gap-2">
                                    <dt className="text-muted-foreground">
                                      {t.tradePricing.priceBookId}
                                    </dt>
                                    <dd className="shrink-0 whitespace-nowrap">
                                      <Link
                                        href={`/trade/price-books/${line.priceBreakdown.priceBookId}`}
                                        className="inline-flex items-center rounded-md border border-kpi-new-line bg-kpi-new-surface px-2 py-0.5 font-bold text-kpi-new-text underline-offset-4 hover:underline"
                                      >
                                        <IdentifierText>
                                          {(() => {
                                            const bookLabel =
                                              priceBookCodeById?.get(
                                                line.priceBreakdown.priceBookId,
                                              ) ?? `#${line.priceBreakdown.priceBookId.slice(0, 8)}`;
                                            return line.priceBreakdown.priceBookVersion
                                              ? `${bookLabel} · v${line.priceBreakdown.priceBookVersion}`
                                              : bookLabel;
                                          })()}
                                        </IdentifierText>
                                      </Link>
                                    </dd>
                                  </div>
                                  {accountAssignedPriceBookId !== undefined ? (
                                    <div className="flex items-center justify-between gap-2">
                                      <dt className="text-muted-foreground">
                                        {t.tradePricing.simHeroResolvedSource}
                                      </dt>
                                      <dd className="shrink-0">
                                        <span className="inline-flex items-center rounded-md border border-line-divider bg-surface-subtle px-2 py-0.5 font-bold text-foreground">
                                          <IdentifierText>
                                            {accountAssignedPriceBookId &&
                                            accountAssignedPriceBookId ===
                                              line.priceBreakdown.priceBookId
                                              ? "ACCOUNT"
                                              : "COMPANY_DEFAULT"}
                                          </IdentifierText>
                                        </span>
                                      </dd>
                                    </div>
                                  ) : null}
                                </>
                              ) : null}

                              <div className="flex items-center justify-between gap-2">
                                <dt className="text-muted-foreground">
                                  {t.tradePricing.baselineUnitPrice}
                                </dt>
                                <dd className="font-bold text-foreground">
                                  <Money
                                    value={line.priceBreakdown?.baselineUnitPrice ?? line.unitPrice}
                                    currency={currencyCode}
                                    minimumFractionDigits={2}
                                    maximumFractionDigits={8}
                                  />
                                </dd>
                              </div>

                              <div className="space-y-1">
                                <div className="flex items-center justify-between gap-2">
                                  <dt className="text-muted-foreground">
                                    {t.tradePricing.matchedPromotions}
                                  </dt>
                                  {!line.priceBreakdown?.matchedPromotions?.length ? (
                                    <dd className="text-muted-foreground">
                                      {t.tradePricing.noPromotions}
                                    </dd>
                                  ) : null}
                                </div>
                                {line.priceBreakdown?.matchedPromotions?.map((promo) => (
                                  <div
                                    key={promo.code}
                                    className={cn(
                                      "flex items-center justify-between gap-2 rounded-md border px-2.5 py-1.5",
                                      SWATCH_SURFACE_PALETTES.teal.sectionCard,
                                    )}
                                  >
                                    <span className="inline-flex items-center gap-1 font-bold text-foreground">
                                      <Tag className="size-3" aria-hidden="true" />
                                      <IdentifierText>{promo.code}</IdentifierText>
                                    </span>
                                    <span
                                      className={cn(
                                        "font-bold",
                                        SWATCH_SURFACE_PALETTES.teal.iconText,
                                      )}
                                    >
                                      -
                                      <Money
                                        value={promo.discountAmount}
                                        currency={currencyCode}
                                        minimumFractionDigits={2}
                                        maximumFractionDigits={8}
                                      />
                                    </span>
                                  </div>
                                ))}
                              </div>

                              <div className="flex items-center justify-between gap-2 border-t border-dashed border-line-divider pt-2">
                                <dt className="font-bold text-foreground">
                                  {t.tradePricing.unitPrice}
                                </dt>
                                <dd className="text-sm font-extrabold text-kpi-qualified-text">
                                  <Money
                                    value={line.unitPrice}
                                    currency={currencyCode}
                                    minimumFractionDigits={2}
                                    maximumFractionDigits={8}
                                  />
                                </dd>
                              </div>

                              <div className="flex items-center justify-between gap-2">
                                <dt className="text-muted-foreground">
                                  {t.tradePricing.minimumAllowedPrice}
                                </dt>
                                <dd className="flex items-center gap-1.5">
                                  {line.priceBreakdown?.minimumAllowedPrice ? (
                                    <>
                                      <Money
                                        value={line.priceBreakdown.minimumAllowedPrice}
                                        currency={currencyCode}
                                        minimumFractionDigits={2}
                                        maximumFractionDigits={8}
                                      />
                                      <Badge tone="positive" size="sm">
                                        {t.tradePricing.floorGuardSafe}
                                      </Badge>
                                    </>
                                  ) : (
                                    <span className="text-muted-foreground">
                                      {t.tradePricing.floorGuardNone}
                                    </span>
                                  )}
                                </dd>
                              </div>
                            </dl>

                            <div className="rounded-lg border border-kpi-new-line bg-kpi-new-surface/40 p-2.5 text-xs text-kpi-new-text">
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-bold">
                                  {t.tradePricing.activePriceLocksTitle}
                                </span>
                                {line.priceBreakdown?.decisionId ? (
                                  <Link
                                    href={`/trade/decisions/${line.priceBreakdown.decisionId}`}
                                    className="shrink-0 whitespace-nowrap font-bold underline underline-offset-2"
                                  >
                                    <IdentifierText>
                                      {`#${line.priceBreakdown.decisionId.slice(0, 8)}`}
                                    </IdentifierText>
                                  </Link>
                                ) : null}
                              </div>
                              <p className="mt-0.5 text-muted-foreground">
                                {t.tradePricing.activePriceLocksDesc}
                              </p>
                            </div>

                            <Separator />

                            <Button asChild variant="outline" size="sm" className="w-full gap-1.5">
                              <Link
                                href={`/trade/pricing?purpose=${encodeURIComponent(state.purpose)}&currencyCode=${encodeURIComponent(currencyCode)}&itemId=${encodeURIComponent(line.itemId)}&uomId=${encodeURIComponent(line.uomId)}&quantity=${encodeURIComponent(line.quantity)}`}
                              >
                                <ExternalLink className="size-3.5" aria-hidden="true" />
                                {t.tradePricing.lineOpenSimulator}
                              </Link>
                            </Button>
                          </PopoverContent>
                        </Popover>
                      </>
                    )}
                  </div>
                </div>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={t.tradeDocuments.lineEditor.removeLine}
                      disabled={disabled || state.lines.length === 1}
                      onClick={() => state.removeLine(index)}
                    >
                      <Trash2 className="size-4 text-destructive" aria-hidden="true" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{t.tradeDocuments.lineEditor.removeLine}</TooltipContent>
                </Tooltip>
              </div>
            </li>
          );
        })}
      </ul>

      <div className="flex items-center justify-between gap-3">
        <Button variant="outline" size="sm" onClick={state.addLine} disabled={disabled}>
          {t.tradeDocuments.lineEditor.addLine}
        </Button>
        <p className="text-xs text-muted-foreground">
          {t.tradeDocuments.lineEditor.runningTotal}{" "}
          {state.runningTotal === null ? (
            t.tradeDocuments.lineEditor.awaitingPrice
          ) : (
            <Money
              value={state.runningTotal}
              currency={currencyCode}
              minimumFractionDigits={2}
              maximumFractionDigits={8}
              className="text-foreground"
            />
          )}
        </p>
      </div>

      {/* The engine's own price is what the server will use, so a preview that
          disagreed with it would be worse than none. This says which figures
          are the server's and which are not. */}
      <p className="text-xs text-muted-foreground">{t.tradeDocuments.lineEditor.previewNote}</p>
    </div>
  );
}
