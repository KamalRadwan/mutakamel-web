"use client";

import { useCallback, useEffect, useState } from "react";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { generateUUIDv7 } from "@/lib/uuid";
import { tradeGet } from "../../trade-api";
import { canonicalizeDecimalInput } from "../fixed-decimal";
import { computeDocumentTotals, findDuplicateClientLineId } from "../document-totals";
import {
  TRADE_LOOKUP_RESPONSE_BYTES,
  TRADE_ITEM_SEARCH_MAX_LENGTH,
  parseTradeItems,
  parseTradeUoms,
  tradeItemsPath,
  tradeUomCataloguePath,
  isItemEligibleForPurpose,
  type TradeItemOption,
  type TradePricePurpose,
  type TradeUomOption,
} from "../trade-lookup-contract";
import { isAbortError } from "./useTradeDocumentList";
import { useTradeDocumentPricing } from "./useTradeDocumentPricing";

interface TradeLineDraft {
  /** UUID v7 — `@Matches(UUID_V7_PATTERN)` on every line DTO. */
  clientLineId: string;
  itemId: string;
  uomId: string;
  quantity: string;
  /** The server-resolved price, for the running total only. Never submitted. */
  unitPrice: string | null;
  isPricing: boolean;
  priceError: string | null;
}

export interface TradeLineDraftState {
  lines: TradeLineDraft[];
  items: TradeItemOption[];
  itemsById: Record<string, TradeItemOption>;
  uomsByItem: Record<string, TradeUomOption[]>;
  lookupError: NormalizedApiError | null;
  isLoadingItems: boolean;
  /** null until every line has a price; the running total otherwise. */
  runningTotal: string | null;
  /** The first reason the server would refuse this line set, if any. */
  invalidLineIndex: number | null;
  purpose: TradePricePurpose;
  searchItems: (query: string) => void;
  addLine: () => void;
  removeLine: (index: number) => void;
  setItem: (index: number, itemId: string) => void;
  setUom: (index: number, uomId: string) => void;
  setQuantity: (index: number, quantity: string) => void;
  commitQuantity: (index: number) => void;
  reset: (lines: TradeLineDraft[]) => void;
}

function emptyLineDraft(): TradeLineDraft {
  return {
    clientLineId: generateUUIDv7(),
    itemId: "",
    uomId: "",
    quantity: "1",
    unitPrice: null,
    isPricing: false,
    priceError: null,
  };
}

/**
 * The line set behind every document line editor — MASTER-PLAN 11.20.
 *
 * The running total is real, not decorative. `CommercialLineInputDto` and
 * `PurchaseQuotationLineDto` carry `clientLineId`, `itemId`, `uomId`,
 * `quantity` and an optional `priceBookId` and **no price at all**, so the only
 * way to show a person what they are about to commit to is to ask the pricing
 * engine per line — `POST /pricing/evaluate` — and multiply through the same
 * fixed-decimal arithmetic the server uses. Nothing computed here is submitted
 * on these two families; it is a preview of what the server will write.
 *
 * On the families that *do* submit figures the same arithmetic is what makes
 * the submission acceptable, which is why it lives in one module rather than
 * two.
 */
export function useTradeLineDraft(
  headers: Record<string, string>,
  currencyCode: string,
  partyId: string | null,
  purpose: TradePricePurpose,
  isEnabled: boolean,
): TradeLineDraftState {
  const [drafts, setLines] = useState<TradeLineDraft[]>([emptyLineDraft()]);
  const [items, setItems] = useState<TradeItemOption[]>([]);
  const [itemsById, setItemsById] = useState<Record<string, TradeItemOption>>({});
  const [itemSearch, setItemSearch] = useState("");
  const [uomsByItem, setUomsByItem] = useState<Record<string, TradeUomOption[]>>({});
  const [lookupError, setLookupError] = useState<NormalizedApiError | null>(null);
  const [isLoadingItems, setIsLoadingItems] = useState(false);

  useEffect(() => {
    if (!isEnabled) return undefined;
    const controller = new AbortController();
    // Deferred to a microtask so the first `setState` is not synchronous with
    // the effect body, which cascades a render — the same shape every other
    // list loader in this app uses.
    queueMicrotask(() => {
      if (controller.signal.aborted) return;
      setIsLoadingItems(true);
      void (async () => {
        try {
          const result = await tradeGet(tradeItemsPath(1, purpose, itemSearch), {
            signal: controller.signal,
            headers,
            maxResponseBytes: TRADE_LOOKUP_RESPONSE_BYTES,
          });
          const page = parseTradeItems(result.data, purpose);
          setItems(page.items);
          setItemsById((current) => ({
            ...current,
            ...Object.fromEntries(page.items.map((item) => [item.id, item])),
          }));
          setLookupError(null);
        } catch (error) {
          if (isAbortError(error)) return;
          setItems([]);
          setLookupError(normalizeApiError(error));
        } finally {
          if (!controller.signal.aborted) setIsLoadingItems(false);
        }
      })();
    });
    return () => controller.abort();
  }, [headers, isEnabled, itemSearch, purpose]);

  const loadUoms = useCallback(
    async (itemId: string): Promise<void> => {
      if (uomsByItem[itemId]) return;
      try {
        const result = await tradeGet(tradeUomCataloguePath(itemId, purpose), {
          headers,
          maxResponseBytes: TRADE_LOOKUP_RESPONSE_BYTES,
        });
        setUomsByItem((current) => ({ ...current, [itemId]: parseTradeUoms(result.data).items }));
      } catch (error) {
        setLookupError(normalizeApiError(error));
      }
    },
    [headers, purpose, uomsByItem],
  );

  // Keep preview evidence tied to the complete request, including line IDs and
  // scope. The shared lifecycle clears obsolete prices before effects run and
  // discards late successes and failures, even when line positions are reused.
  const pricing = useTradeDocumentPricing({
    headers, currencyCode, partyId, purpose, enabled: isEnabled,
    lines: drafts.map(({ clientLineId, itemId, uomId, quantity }) => ({
      clientLineId, itemId, uomId, quantity,
    })),
  });
  const lines = drafts.map((line, index) => ({
    ...line,
    unitPrice: pricing.prices[index]?.unitPrice ?? null,
    isPricing: pricing.prices[index]?.isPricing ?? false,
    priceError: pricing.prices[index]?.error ? (pricing.prices[index]?.error?.code ?? "") : null,
  }));

  const update = useCallback(
    (index: number, patch: Partial<TradeLineDraft>): void => {
      const line = drafts[index];
      if (!line) return;
      const next = { ...line, ...patch, unitPrice: null };
      setLines((current) =>
        current.map((entry, position) => (position === index ? next : entry)),
      );
    },
    [drafts],
  );

  const priced = lines.every((line) => line.unitPrice !== null);
  const outcome = priced
    ? computeDocumentTotals({
        dialect: "ORDER",
        lines: lines.map((line) => ({
          quantity: canonicalizeDecimalInput(line.quantity) ?? line.quantity,
          unitPrice: canonicalizeDecimalInput(line.unitPrice ?? "0") ?? (line.unitPrice ?? "0"),
          discountTotal: "0",
          chargeTotal: "0",
          taxTotal: "0",
        })),
        roundingTotal: "0",
      })
    : null;

  const duplicateIndex = findDuplicateClientLineId(lines.map((line) => line.clientLineId));

  return {
    lines,
    items,
    itemsById,
    uomsByItem,
    lookupError,
    isLoadingItems,
    runningTotal: outcome?.ok ? outcome.value.totals.grandTotal : null,
    invalidLineIndex:
      duplicateIndex ?? (outcome && !outcome.ok ? (outcome.lineIndex ?? null) : null),
    purpose,
    searchItems: (query: string) => setItemSearch(query.slice(0, TRADE_ITEM_SEARCH_MAX_LENGTH)),
    addLine: () => setLines((current) => [...current, emptyLineDraft()]),
    removeLine: (index: number) =>
      setLines((current) =>
        current.length > 1 ? current.filter((_, position) => position !== index) : current,
      ),
    setItem: (index: number, itemId: string) => {
      const item = itemsById[itemId];
      if (!item || !isItemEligibleForPurpose(item, purpose)) return;
      void loadUoms(itemId);
      // The UOM set is item-scoped, so keeping the previous one would submit a
      // pairing `/catalog/uoms` never authorised.
      update(index, { itemId, uomId: "" });
    },
    setUom: (index: number, uomId: string) => update(index, { uomId }),
    // Rewriting intermediate text such as "1." would turn the next "5" into "15".
    setQuantity: (index: number, quantity: string) => update(index, { quantity }),
    commitQuantity: (index: number) => {
      const quantity = drafts[index]?.quantity;
      if (quantity === undefined) return;
      const canonical = canonicalizeDecimalInput(quantity);
      if (canonical !== null && canonical !== quantity) update(index, { quantity: canonical });
    },
    reset: (next: TradeLineDraft[]) => setLines(next.length > 0 ? next : [emptyLineDraft()]),
  };
}
