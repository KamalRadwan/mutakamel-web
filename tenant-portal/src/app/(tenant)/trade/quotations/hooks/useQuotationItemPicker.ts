"use client";

import { useEffect, useRef, useState } from "react";
import { isUUIDv7 } from "@/lib/uuid";
import type { TradeLineDraftState } from "../../documents/hooks/useTradeLineDraft";
import { canonicalTradeQuantity, TRADE_DOCUMENT_MAX_LINES } from "../../documents/trade-line-validation";
import { hasQuotationScope } from "../quotation-composer-draft";
import type { QuotationPricingMode, QuotationPricingRequest } from "../quotation-discount-contract";
import { useQuotationBasePrices } from "./useQuotationBasePrices";
import { useQuotationPricingPreview } from "./useQuotationPricingPreview";

interface PendingItem { itemId: string; uomId: string; quantity: string }

/** Pending selections are independent of the catalogue's current search page. */
export function useQuotationItemPicker({ draft, headers, currencyCode, partyId, crmCustomerProfileId, pricingMode = "NONE" }: {
  draft: TradeLineDraftState; headers: Record<string, string>;
  currencyCode: string; partyId: string | null; crmCustomerProfileId?: string | null; pricingMode?: QuotationPricingMode;
}) {
  const [open, setOpen] = useState(false);
  const key = JSON.stringify(Object.entries(headers).sort(([left], [right]) => left.localeCompare(right)));
  const [selection, setSelection] = useState<{ key: string; rows: PendingItem[] }>({ key, rows: [] });
  const pending = selection.key === key ? selection.rows : [];
  const setPending = (change: PendingItem[] | ((rows: PendingItem[]) => PendingItem[])) =>
    setSelection((current) => ({ key, rows: typeof change === "function"
      ? change(current.key === key ? current.rows : []) : change }));
  const [search, setSearch] = useState("");
  const [reviewSelection, setReviewSelection] = useState(false);
  const batchScope = useRef<string | null>(key);
  useEffect(() => { batchScope.current = key; return () => { batchScope.current = null; }; }, [key]);
  const loadUnits = (itemIds: string[]) => {
    void (async () => {
      for (let offset = 0; offset < itemIds.length; offset += 6) {
        if (batchScope.current !== key) return;
        await Promise.all(itemIds.slice(offset, offset + 6).map(draft.ensureItemUoms));
      }
    })();
  };
  const rows = pending.map((row) => {
    const units = draft.uomsByItem[row.itemId] ?? [];
    const preferred = draft.itemsById[row.itemId]?.eligibility.defaultSalesUomId;
    const defaultUnit = units.find((unit) => unit.id === preferred) ?? (units.length === 1 ? units[0] : undefined);
    return { ...row, uomId: row.uomId || defaultUnit?.id || "" };
  });
  const priceableLines = rows.flatMap(({ itemId, uomId, quantity: input }) => {
    const quantity = canonicalTradeQuantity(input);
    return quantity !== null && draft.uomsByItem[itemId]?.some((unit) => unit.id === uomId)
      ? [{ itemId, uomId, quantity, clientLineId: itemId }] : [];
  });
  const valid = rows.length > 0 && rows.length === priceableLines.length;
  const existingCount = draft.lines.filter((line) => line.itemId).length;
  const capacity = rows.length + existingCount <= TRADE_DOCUMENT_MAX_LINES;
  // Manual discounts are entered in the quotation; the picker shows the undiscounted customer price.
  const request: QuotationPricingRequest | null = isUUIDv7(partyId) && /^[A-Z]{3}$/u.test(currencyCode)
    && capacity && priceableLines.length > 0 && hasQuotationScope(headers)
    ? { partyId, currencyCode, ...(crmCustomerProfileId ? { crmCustomerProfileId } : {}),
      lines: priceableLines, pricing: { mode: pricingMode === "PROMOTIONS" ? "PROMOTIONS" : "NONE" } }
    : null;
  const preview = useQuotationPricingPreview({ request, headers, enabled: open });
  const basePrices = useQuotationBasePrices({
    headers, currencyCode, lines: priceableLines, enabled: open && capacity && partyId === null,
  });
  const quotedPrices = new Map(preview.calculation?.lines.map((line) => [line.clientLineId, line.unitPrice]));
  const priceableIds = new Set(priceableLines.map((line) => line.itemId));
  const calculatedTotal = preview.ready ? preview.calculation?.totals.grandTotal ?? null : null;
  const total = valid ? partyId === null ? basePrices.subtotal : calculatedTotal : null;
  const pricing = { ready: total !== null, prices: rows.map((row) => {
    const base = basePrices.byLineId[row.itemId];
    return { unitPrice: quotedPrices.get(row.itemId) ?? base?.unitPrice ?? null,
      isPricing: (preview.loading && priceableIds.has(row.itemId)) || base?.loading === true };
  }) };

  return {
    open, rows, pricing, total, search, reviewSelection, canAdd: valid && capacity, capacity,
    searchItems: (query: string) => { setReviewSelection(false); setSearch(query); draft.searchItems(query); },
    toggleReview: () => { setReviewSelection((current) => !current); setSearch(""); draft.searchItems(""); },
    retry: () => {
      draft.retryLookups();
      loadUnits(rows.map((row) => row.itemId));
      if (partyId === null) basePrices.retry();
      else preview.retry();
    },
    setOpen: (next: boolean) => { setOpen(next); if (!next) { setPending([]); setReviewSelection(false); } },
    toggle: (itemId: string) => {
      loadUnits([itemId]);
      setPending((current) => current.some((row) => row.itemId === itemId)
        ? current.filter((row) => row.itemId !== itemId)
        : [...current, { itemId, uomId: "", quantity: "1" }]);
    },
    toggleVisible: (itemIds: string[]) => {
      loadUnits(itemIds);
      setPending((current) => {
        const all = itemIds.every((itemId) => current.some((row) => row.itemId === itemId));
        return all ? current.filter((row) => !itemIds.includes(row.itemId)) : [...current,
          ...itemIds.filter((itemId) => !current.some((row) => row.itemId === itemId))
            .map((itemId) => ({ itemId, uomId: "", quantity: "1" }))];
      });
    },
    update: (itemId: string, patch: Partial<Omit<PendingItem, "itemId">>) =>
      setPending((current) => current.map((row) => row.itemId === itemId ? { ...row, ...patch } : row)),
    add: () => {
      if (!valid || !capacity) return;
      draft.appendItems(rows.map((row) => ({ ...row, quantity: canonicalTradeQuantity(row.quantity)! })));
      setPending([]);
      setReviewSelection(false);
      setOpen(false);
    },
  };
}

export type QuotationItemPickerState = ReturnType<typeof useQuotationItemPicker>;
