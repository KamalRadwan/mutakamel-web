"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { generateUUIDv7 } from "@/lib/uuid";
import { findDuplicateClientLineId, computeDocumentTotals } from "../document-totals";
import { canonicalizeDecimalInput } from "../fixed-decimal";
import {
  isItemEligibleForPurpose,
  type TradeItemOption, type TradePriceDecision, type TradePricePurpose, type TradeUomOption,
} from "../trade-lookup-contract";
import {
  canonicalTradeQuantity, validateTradeLine, TRADE_DOCUMENT_MAX_LINES,
  type TradeLineInputErrors,
} from "../trade-line-validation";
import { useTradeDocumentPricing } from "./useTradeDocumentPricing";
import { useTradeLineCatalog } from "./useTradeLineCatalog";
import type { NormalizedApiError } from "@/lib/api/errors";

export interface TradeLineDraft {
  clientLineId: string;
  itemId: string;
  uomId: string;
  quantity: string;
  unitPrice: string | null;
  priceBreakdown?: TradePriceDecision | null;
  isPricing: boolean;
  priceError: string | null;
}

export interface TradeLineSelection { itemId: string; uomId: string; quantity: string }
export interface TradeLineDraftSnapshot {
  lines: TradeLineDraft[];
  items: TradeItemOption[];
  uomsByItem: Record<string, TradeUomOption[]>;
}

export interface TradeLineDraftState {
  lines: TradeLineDraft[];
  items: TradeItemOption[];
  itemsById: Record<string, TradeItemOption>;
  uomsByItem: Record<string, TradeUomOption[]>;
  lookupError: NormalizedApiError | null;
  isLoadingItems: boolean;
  runningTotal: string | null;
  invalidLineIndex: number | null;
  lineErrors: TradeLineInputErrors[];
  purpose: TradePricePurpose;
  searchItems: (query: string) => void;
  addLine: () => void;
  removeLine: (index: number) => void;
  setItem: (index: number, itemId: string) => void;
  setUom: (index: number, uomId: string) => void;
  setQuantity: (index: number, quantity: string) => void;
  commitQuantity: (index: number) => void;
  reset: (lines: TradeLineDraft[]) => void;
  appendItems: (items: TradeLineSelection[]) => void;
  ensureItemUoms: (itemId: string) => Promise<TradeUomOption[]>;
  retryLookups: () => void;
  restore: (snapshot: TradeLineDraftSnapshot) => void;
}

export function emptyTradeLine(): TradeLineDraft {
  return { clientLineId: generateUUIDv7(), itemId: "", uomId: "", quantity: "1",
    unitPrice: null, isPricing: false, priceError: null };
}

export function useTradeLineDraft(
  headers: Record<string, string>, currencyCode: string, partyId: string | null,
  purpose: TradePricePurpose, isEnabled: boolean, resetOnScopeChange = false, pricingEnabled = true,
): TradeLineDraftState {
  const key = JSON.stringify([Object.entries(headers).sort(), purpose]);
  // A new operating scope needs new client-line identities, even before the first edit.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const empty = useMemo(() => [emptyTradeLine()], [key]);
  const [state, setState] = useState(() => ({ key, lines: empty }));
  const drafts = !resetOnScopeChange || state.key === key ? state.lines : empty;
  const catalog = useTradeLineCatalog(headers, purpose, isEnabled);
  const { restoreCatalog, ensureItemUoms } = catalog;
  const setLines = useCallback((change: (current: TradeLineDraft[]) => TradeLineDraft[]) => {
    setState((current) => ({ key, lines: change(!resetOnScopeChange || current.key === key ? current.lines : empty) }));
  }, [key, empty, resetOnScopeChange]);
  const itemIds = [...new Set(drafts.map((line) => line.itemId).filter(Boolean))].join(",");
  useEffect(() => {
    if (isEnabled && itemIds) itemIds.split(",").forEach((id) => { void ensureItemUoms(id); });
  }, [ensureItemUoms, isEnabled, itemIds]);
  const pricing = useTradeDocumentPricing({
    headers, currencyCode, partyId, purpose, enabled: isEnabled && pricingEnabled,
    lines: drafts.map(({ clientLineId, itemId, uomId, quantity }) => ({
      clientLineId, itemId, uomId, quantity: canonicalTradeQuantity(quantity) ?? quantity,
    })),
  });
  const lines = drafts.map((line, index) => ({
    ...line,
    unitPrice: pricing.prices[index]?.unitPrice ?? null,
    priceBreakdown: pricing.prices[index]?.decision ?? null,
    isPricing: pricing.prices[index]?.isPricing ?? false,
    priceError: pricing.prices[index]?.error?.code ?? null,
  }));
  const lineErrors = lines.map(validateTradeLine);
  const firstInvalid = lineErrors.findIndex((error) => Object.keys(error).length > 0);
  const duplicate = findDuplicateClientLineId(lines.map((line) => line.clientLineId));
  const priced = lines.every((line) => line.unitPrice !== null);
  const outcome = priced && firstInvalid === -1
    ? computeDocumentTotals({ dialect: "ORDER", lines: lines.map((line) => ({
      quantity: canonicalTradeQuantity(line.quantity) ?? line.quantity,
      unitPrice: canonicalizeDecimalInput(line.unitPrice ?? "0") ?? (line.unitPrice ?? "0"),
      discountTotal: "0", chargeTotal: "0", taxTotal: "0",
    })), roundingTotal: "0" }) : null;
  const update = useCallback((index: number, patch: Partial<TradeLineDraft>) => {
    setLines((current) => current.map((line, position) => position === index
      ? { ...line, ...patch, unitPrice: null, priceBreakdown: null } : line));
  }, [setLines]);
  const reset = useCallback((next: TradeLineDraft[]) => {
    setLines(() => next.length > 0 ? next.slice(0, TRADE_DOCUMENT_MAX_LINES) : [emptyTradeLine()]);
  }, [setLines]);
  const restore = useCallback((snapshot: TradeLineDraftSnapshot) => {
    restoreCatalog(snapshot.items, snapshot.uomsByItem);
    reset(snapshot.lines.map((line) => ({ ...line, unitPrice: null, priceBreakdown: null,
      isPricing: false, priceError: null })));
  }, [restoreCatalog, reset]);

  return {
    ...catalog, lines, lineErrors,
    runningTotal: outcome?.ok ? outcome.value.totals.grandTotal : null,
    invalidLineIndex: duplicate ?? (firstInvalid >= 0 ? firstInvalid
      : outcome && !outcome.ok ? outcome.lineIndex ?? 0 : null),
    purpose,
    addLine: () => setLines((current) => current.length < TRADE_DOCUMENT_MAX_LINES
      ? [...current, emptyTradeLine()] : current),
    removeLine: (index) => setLines((current) => current.length > 1
      ? current.filter((_, position) => position !== index) : [emptyTradeLine()]),
    setItem: (index, itemId) => {
      if (itemId === "") { update(index, { itemId: "", uomId: "" }); return; }
      const item = catalog.itemsById[itemId];
      if (!item || !isItemEligibleForPurpose(item, purpose)) return;
      void catalog.ensureItemUoms(itemId);
      update(index, { itemId, uomId: "" });
    },
    setUom: (index, uomId) => update(index, { uomId }),
    setQuantity: (index, quantity) => update(index, { quantity }),
    commitQuantity: (index) => {
      const canonical = canonicalizeDecimalInput(drafts[index]?.quantity ?? "");
      if (canonical !== null) update(index, { quantity: canonical });
    },
    appendItems: (inputs) => {
      if (inputs.length === 0) return;
      const selected = inputs.filter((input) => {
        const item = catalog.itemsById[input.itemId];
        return item && isItemEligibleForPurpose(item, purpose)
          && canonicalTradeQuantity(input.quantity) !== null
          && catalog.uomsByItem[input.itemId]?.some((unit) => unit.id === input.uomId);
      });
      if (selected.length !== inputs.length) return;
      setLines((current) => {
        const existing = current.filter((line) => line.itemId || line.uomId || line.quantity !== "1");
        if (existing.length + selected.length > TRADE_DOCUMENT_MAX_LINES) return current;
        return [...existing, ...selected.map((input) => ({ ...emptyTradeLine(), ...input,
          quantity: canonicalTradeQuantity(input.quantity) ?? input.quantity }))];
      });
    },
    reset, restore,
  };
}
