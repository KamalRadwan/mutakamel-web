"use client";

import { useCallback, useEffect, useState } from "react";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { generateUUIDv7, isUUIDv7 } from "@/lib/uuid";
import { tradeGet, tradePost } from "../../trade-api";
import { canonicalizeDecimalInput, POSITIVE_DECIMAL, isCanonicalDecimal } from "../fixed-decimal";
import { computeDocumentTotals, findDuplicateClientLineId } from "../document-totals";
import {
  TRADE_LOOKUP_RESPONSE_BYTES,
  parseTradeItems,
  parseTradePriceDecision,
  parseTradeUoms,
  tradeItemsPath,
  tradeUomCataloguePath,
  TRADE_PRICING_EVALUATE_PATH,
  type TradeItemOption,
  type TradePricePurpose,
  type TradeUomOption,
} from "../trade-lookup-contract";
import { isAbortError } from "./useTradeDocumentList";

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
  itemTotal: number;
  uomsByItem: Record<string, TradeUomOption[]>;
  lookupError: NormalizedApiError | null;
  isLoadingItems: boolean;
  /** null until every line has a price; the running total otherwise. */
  runningTotal: string | null;
  /** The first reason the server would refuse this line set, if any. */
  invalidLineIndex: number | null;
  addLine: () => void;
  removeLine: (index: number) => void;
  setItem: (index: number, itemId: string) => void;
  setUom: (index: number, uomId: string) => void;
  setQuantity: (index: number, quantity: string) => void;
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
  const [lines, setLines] = useState<TradeLineDraft[]>([emptyLineDraft()]);
  const [items, setItems] = useState<TradeItemOption[]>([]);
  const [itemTotal, setItemTotal] = useState(0);
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
          const result = await tradeGet(tradeItemsPath(1), {
            signal: controller.signal,
            headers,
            maxResponseBytes: TRADE_LOOKUP_RESPONSE_BYTES,
          });
          const page = parseTradeItems(result.data);
          setItems(page.items);
          setItemTotal(page.total);
        } catch (error) {
          if (isAbortError(error)) return;
          setLookupError(normalizeApiError(error));
        } finally {
          if (!controller.signal.aborted) setIsLoadingItems(false);
        }
      })();
    });
    return () => controller.abort();
  }, [headers, isEnabled]);

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

  const priceLine = useCallback(
    async (index: number, draft: TradeLineDraft): Promise<void> => {
      if (!isUUIDv7(draft.itemId) || !isUUIDv7(draft.uomId)) return;
      if (!isCanonicalDecimal(draft.quantity, POSITIVE_DECIMAL)) return;
      setLines((current) =>
        current.map((line, position) =>
          position === index ? { ...line, isPricing: true, priceError: null } : line,
        ),
      );
      try {
        const result = await tradePost(
          TRADE_PRICING_EVALUATE_PATH,
          {
            purpose,
            itemId: draft.itemId,
            uomId: draft.uomId,
            quantity: draft.quantity,
            currencyCode,
            ...(partyId && isUUIDv7(partyId) ? { partyId } : {}),
          },
          { headers, maxResponseBytes: TRADE_LOOKUP_RESPONSE_BYTES },
        );
        const decision = parseTradePriceDecision(result.data);
        setLines((current) =>
          current.map((line, position) =>
            position === index && line.clientLineId === draft.clientLineId
              ? { ...line, unitPrice: decision.unitPrice, isPricing: false }
              : line,
          ),
        );
      } catch (error) {
        const normalized = normalizeApiError(error);
        setLines((current) =>
          current.map((line, position) =>
            position === index
              ? { ...line, unitPrice: null, isPricing: false, priceError: normalized.code ?? null }
              : line,
          ),
        );
      }
    },
    [currencyCode, headers, partyId, purpose],
  );

  const update = useCallback(
    (index: number, patch: Partial<TradeLineDraft>): void => {
      const line = lines[index];
      if (!line) return;
      // The next draft is computed outside the updater on purpose: repricing is
      // a request, and React may call a state updater twice.
      const next = { ...line, ...patch, unitPrice: null };
      setLines((current) =>
        current.map((entry, position) => (position === index ? next : entry)),
      );
      void priceLine(index, next);
    },
    [lines, priceLine],
  );

  const priced = lines.every((line) => line.unitPrice !== null);
  const outcome = priced
    ? computeDocumentTotals({
        dialect: "ORDER",
        lines: lines.map((line) => ({
          quantity: line.quantity,
          unitPrice: line.unitPrice ?? "0",
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
    itemTotal,
    uomsByItem,
    lookupError,
    isLoadingItems,
    runningTotal: outcome?.ok ? outcome.value.totals.grandTotal : null,
    invalidLineIndex:
      duplicateIndex ?? (outcome && !outcome.ok ? (outcome.lineIndex ?? null) : null),
    addLine: () => setLines((current) => [...current, emptyLineDraft()]),
    removeLine: (index: number) =>
      setLines((current) =>
        current.length > 1 ? current.filter((_, position) => position !== index) : current,
      ),
    setItem: (index: number, itemId: string) => {
      void loadUoms(itemId);
      // The UOM set is item-scoped, so keeping the previous one would submit a
      // pairing `/catalog/uoms` never authorised.
      update(index, { itemId, uomId: "" });
    },
    setUom: (index: number, uomId: string) => update(index, { uomId }),
    setQuantity: (index: number, quantity: string) =>
      update(index, { quantity: canonicalizeDecimalInput(quantity) ?? quantity }),
    reset: (next: TradeLineDraft[]) => setLines(next.length > 0 ? next : [emptyLineDraft()]),
  };
}
