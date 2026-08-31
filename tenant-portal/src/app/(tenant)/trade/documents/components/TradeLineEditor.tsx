"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import {
  Button,
  Combobox,
  DegradedBanner,
  Field,
  Input,
  Money,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatTemplate } from "@/lib/format/template";
import { multiplyFixedDecimal } from "../fixed-decimal";
import { tradeDocumentMessage } from "../trade-document-errors";
import { itemDisplayName } from "../trade-lookup-contract";
import type { TradeLineDraftState } from "../hooks/useTradeLineDraft";

export interface TradeLineEditorProps {
  state: TradeLineDraftState;
  currencyCode: string;
  disabled: boolean;
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
export function TradeLineEditor({ state, currencyCode, disabled }: TradeLineEditorProps) {
  const { t, lang } = useI18n();
  const [search, setSearch] = useState("");

  const query = search.trim().toLowerCase();
  const visibleItems = state.items.filter(
    (item) =>
      query.length === 0 ||
      itemDisplayName(item, lang).toLowerCase().includes(query) ||
      item.canonicalCode.toLowerCase().includes(query),
  );

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

      {/* `CatalogListQueryDto` has no search term and `POST /items/search`
          filters only on exact `canonicalCode`, so this box narrows the page
          that is loaded and nothing beyond it. Saying so is the difference
          between a filter and a lie. */}
      {state.itemTotal > state.items.length ? (
        <DegradedBanner
          message={formatTemplate(t.tradeDocuments.lineEditor.partialCatalogue, {
            loaded: state.items.length,
            total: state.itemTotal,
          })}
        />
      ) : null}

      <ul className="flex flex-col gap-3">
        {state.lines.map((line, index) => {
          const uoms = state.uomsByItem[line.itemId] ?? [];
          const selected = state.items.find((item) => item.id === line.itemId);
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
                    options={visibleItems.map((item) => ({
                      value: item.id,
                      label: itemDisplayName(item, lang),
                      description: item.canonicalCode,
                    }))}
                    onSearch={setSearch}
                    loading={state.isLoadingItems}
                    disabled={disabled}
                    placeholder={t.tradeDocuments.lineEditor.selectItem}
                    searchPlaceholder={t.tradeDocuments.lineEditor.searchItem}
                    loadingLabel={t.common.loading}
                    emptyLabel={t.tradeDocuments.lineEditor.noItems}
                  />
                </Field>
              </div>

              <div className="sm:col-span-3">
                <Field label={t.tradeDocuments.uom} required>
                  <Select
                    value={line.uomId}
                    onValueChange={(next) => state.setUom(index, next)}
                    disabled={disabled || uoms.length === 0}
                  >
                    <SelectTrigger>
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
                  <Input
                    inputMode="decimal"
                    value={line.quantity}
                    onChange={(event) => state.setQuantity(index, event.target.value)}
                    disabled={disabled}
                  />
                </Field>
              </div>

              <div className="flex items-end justify-between gap-2 sm:col-span-2">
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">{t.tradeDocuments.lineTotal}</p>
                  <p className="mt-0.5 text-xs text-foreground">
                    {line.unitPrice === null ? (
                      <span className="text-muted-foreground">
                        {line.priceError
                          ? (tradeDocumentMessage(line.priceError, t.tradeDocuments.errors) ??
                            t.tradeDocuments.lineEditor.priceUnavailable)
                          : t.tradeDocuments.lineEditor.awaitingPrice}
                      </span>
                    ) : (
                      <Money
                        value={multiplyFixedDecimal(line.quantity, line.unitPrice)}
                        currency={currencyCode}
                        minimumFractionDigits={2}
                        maximumFractionDigits={8}
                      />
                    )}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={t.tradeDocuments.lineEditor.removeLine}
                  disabled={disabled || state.lines.length === 1}
                  onClick={() => state.removeLine(index)}
                >
                  <Trash2 className="size-4 text-destructive" aria-hidden="true" />
                </Button>
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
