"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { normalizeApiError } from "@/lib/api/errors";
import { tradeGet, tradePost } from "../../trade-api";
import {
  TRADE_LOOKUP_RESPONSE_BYTES, parseTradeUoms, tradeUomCataloguePath,
  type TradeItemOption, type TradeUomOption,
} from "../../documents/trade-lookup-contract";
import type { TradeLineDraft } from "../../documents/hooks/useTradeLineDraft";
import { isAbortError } from "../../documents/hooks/useTradeDocumentList";
import {
  TRADE_ITEMS_SEARCH_PATH, parseQuotationItemDetailLookup, parseQuotationLegacySkuSearch,
  tradeItemDetailPath, type QuotationDetail,
} from "../quotation-contract";
import type { QuotationDiscountDraft } from "../quotation-discount-draft";
import {
  buildHydratedQuotationPricingRequest, buildHydratedQuotationTerms,
  hydrateQuotationEditSnapshot, reconcileHydratedLineDrafts,
  type HydratedQuotationPricingRequest, type QuotationEditHydrationSnapshot,
  type QuotationHydratedLineDisplay, type QuotationHydrationLookupOutcome,
  type QuotationTermsBuildResult,
} from "../quotation-edit-hydration";

export interface UseQuotationEditHydrationOptions {
  quotation: QuotationDetail | null;
  enabled: boolean;
  canReadCatalogue?: boolean;
  language?: string;
  activeLines?: readonly TradeLineDraft[];
  catalogItemsById?: Record<string, TradeItemOption>;
  catalogUomsByItem?: Record<string, TradeUomOption[]>;
  onHydrated?: (payload: {
    snapshot: QuotationEditHydrationSnapshot;
    items: TradeItemOption[];
    uomsByItem: Record<string, TradeUomOption[]>;
  }) => void;
  onCatalogResolved?: (payload: {
    items: TradeItemOption[];
    uomsByItem: Record<string, TradeUomOption[]>;
    resolvedLegacyItemByLineId: Record<string, string>;
    ineligibleLineIds: string[];
  }) => void;
}

export interface QuotationEditHydrationState {
  hydrationKey: string | null;
  snapshot: QuotationEditHydrationSnapshot | null;
  isHydrating: boolean;
  scopeHeaders: Record<string, string>;
  lineDisplayById: Record<string, QuotationHydratedLineDisplay>;
  priceBookIdByLineId: Record<string, string>;
  blockingLineIds: string[];
  hasBlockingLines: boolean;
  canPreviewPricing: boolean;
  canSubmitRevision: boolean;
  resolvedItemsById: Record<string, TradeItemOption>;
  resolvedUomsByItem: Record<string, TradeUomOption[]>;
  retryHydrationLookups: () => void;
  buildPricingRequest: (
    draft: QuotationDiscountDraft, lines: readonly TradeLineDraft[],
  ) => HydratedQuotationPricingRequest | null;
  buildRevisionTerms: (input: {
    paymentTermCode: string; incotermCode: string; deliveryDays: string; warrantyMonths: string;
  }) => QuotationTermsBuildResult | null;
}

interface ScopedHydrationLookups {
  key: string;
  itemsById: Record<string, TradeItemOption>;
  uomsByItem: Record<string, TradeUomOption[]>;
  itemLookups: Record<string, QuotationHydrationLookupOutcome>;
  legacyLookups: Record<string, QuotationHydrationLookupOutcome>;
}

const EMPTY_ITEMS: Record<string, TradeItemOption> = {};
const EMPTY_UOMS: Record<string, TradeUomOption[]> = {};

function emptyLookups(key: string): ScopedHydrationLookups {
  return { key, itemsById: {}, uomsByItem: {}, itemLookups: {}, legacyLookups: {} };
}

export function useQuotationEditHydration(options: UseQuotationEditHydrationOptions): QuotationEditHydrationState {
  const { quotation, enabled, canReadCatalogue = true, language = "en" } = options;
  const catalogItems = options.catalogItemsById ?? EMPTY_ITEMS;
  const catalogUoms = options.catalogUomsByItem ?? EMPTY_UOMS;
  const hydrationKey = quotation
    ? `${quotation.id}:${quotation.version}:${quotation.currentRevisionId ?? "none"}`
    : null;
  const [lookupRevision, setLookupRevision] = useState(0);
  const [state, setState] = useState<ScopedHydrationLookups>(() => emptyLookups(hydrationKey ?? ""));
  const current = hydrationKey && state.key === hydrationKey ? state : emptyLookups(hydrationKey ?? "");
  const canLookup = enabled && canReadCatalogue && quotation !== null;

  const mergedItemsById = useMemo(
    () => ({ ...catalogItems, ...current.itemsById }),
    [catalogItems, current.itemsById],
  );
  const mergedUomsByItem = useMemo(
    () => ({ ...catalogUoms, ...current.uomsByItem }),
    [catalogUoms, current.uomsByItem],
  );

  const snapshot = useMemo(
    () => quotation
      ? hydrateQuotationEditSnapshot(quotation, {
          itemsById: mergedItemsById, uomsByItem: mergedUomsByItem,
          resolvedLookups: current.itemLookups, legacyLookups: current.legacyLookups,
          canLookup, language,
        })
      : null,
    [canLookup, current.itemLookups, current.legacyLookups, language, mergedItemsById, mergedUomsByItem, quotation],
  );

  const reconciled = useMemo(
    () => snapshot
      ? reconcileHydratedLineDrafts(snapshot, options.activeLines ?? snapshot.lines, {
          itemsById: mergedItemsById, uomsByItem: mergedUomsByItem, language,
        })
      : null,
    [language, mergedItemsById, mergedUomsByItem, options.activeLines, snapshot],
  );

  const isHydrating = Boolean(
    canLookup && snapshot && (snapshot.pendingItemIds.length > 0 || snapshot.pendingLegacyLines.length > 0),
  );

  const callbacksRef = useRef({ onHydrated: options.onHydrated, onCatalogResolved: options.onCatalogResolved, activeLines: options.activeLines });
  useEffect(() => {
    callbacksRef.current = { onHydrated: options.onHydrated, onCatalogResolved: options.onCatalogResolved, activeLines: options.activeLines };
  });

  const hydratedEmittedKey = useRef<string | null>(null);
  const resolvedEmittedSignature = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled || !snapshot) return;
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      const { onHydrated, onCatalogResolved, activeLines: externalLines } = callbacksRef.current;
      const items = Object.values(mergedItemsById);
      if (hydratedEmittedKey.current !== snapshot.hydrationKey) {
        hydratedEmittedKey.current = snapshot.hydrationKey;
        onHydrated?.({ snapshot, items, uomsByItem: mergedUomsByItem });
        return;
      }
      if (isHydrating) return;
      const legacyResolved = Object.fromEntries(
        Object.entries(current.legacyLookups).flatMap(([lineId, res]) =>
          typeof res === "object" && res.isSellEligible && res.item ? [[lineId, res.item.id]] : []),
      );
      const ineligibleLineIds = snapshot.persistedLineIds.filter(
        (lineId) => snapshot.lineDisplayById[lineId]?.status === "INELIGIBLE_ITEM",
      );
      const hasLookupOutcomes = Object.keys(current.itemLookups).length > 0 || Object.keys(current.legacyLookups).length > 0;
      const signature = `${snapshot.hydrationKey}:${Object.keys(current.itemLookups).sort().join(",")}:${Object.keys(current.legacyLookups).sort().join(",")}`;
      if (resolvedEmittedSignature.current === signature) return;
      resolvedEmittedSignature.current = signature;
      if (!hasLookupOutcomes) return;
      if (onCatalogResolved) {
        onCatalogResolved({ items, uomsByItem: mergedUomsByItem, resolvedLegacyItemByLineId: legacyResolved, ineligibleLineIds });
      } else if (
        onHydrated &&
        (!externalLines || externalLines.every((line, idx) =>
          line.clientLineId === snapshot.lines[idx]?.clientLineId &&
          line.quantity === snapshot.lines[idx]?.quantity &&
          line.uomId === snapshot.lines[idx]?.uomId))
      ) {
        onHydrated({ snapshot, items, uomsByItem: mergedUomsByItem });
      }
    });
    return () => { cancelled = true; };
  }, [current.itemLookups, current.legacyLookups, enabled, isHydrating, mergedItemsById, mergedUomsByItem, snapshot]);

  const pendingItemsKey = snapshot ? snapshot.pendingItemIds.join(",") : "";
  const pendingLegacyKey = snapshot ? JSON.stringify(snapshot.pendingLegacyLines) : "";
  const scopeHeaders = snapshot?.scopeHeaders;

  useEffect(() => {
    if (!canLookup || !hydrationKey || !scopeHeaders) return;
    const itemIds = pendingItemsKey ? pendingItemsKey.split(",") : [];
    const legacyLines = pendingLegacyKey
      ? (JSON.parse(pendingLegacyKey) as Array<{ clientLineId: string; itemCompanyProfileId: string; sku: string }>)
      : [];
    if (itemIds.length === 0 && legacyLines.length === 0) return;
    const controller = new AbortController();

    const fetchUoms = async (itemId: string): Promise<TradeUomOption[]> => {
      try {
        const res = await tradeGet(tradeUomCataloguePath(itemId, "SALES"), {
          headers: scopeHeaders, signal: controller.signal, maxResponseBytes: TRADE_LOOKUP_RESPONSE_BYTES,
        });
        return parseTradeUoms(res.data).items;
      } catch { return []; }
    };

    void Promise.all([
      ...itemIds.map(async (itemId) => {
        try {
          const res = await tradeGet(tradeItemDetailPath(itemId), {
            headers: scopeHeaders, signal: controller.signal, maxResponseBytes: TRADE_LOOKUP_RESPONSE_BYTES,
          });
          const detail = parseQuotationItemDetailLookup(res.data);
          const uoms = detail.isSellEligible && detail.item ? await fetchUoms(detail.item.id) : [];
          return { kind: "item" as const, id: itemId, outcome: detail as QuotationHydrationLookupOutcome, uoms };
        } catch (error) {
          if (isAbortError(error) || controller.signal.aborted) return null;
          const status = normalizeApiError(error).status;
          return { kind: "item" as const, id: itemId, outcome: (status === 404 ? "NOT_FOUND" : "DEGRADED") as QuotationHydrationLookupOutcome, uoms: [] };
        }
      }),
      ...legacyLines.map(async (entry) => {
        try {
          const res = await tradePost(
            TRADE_ITEMS_SEARCH_PATH,
            { page: 1, limit: 100, filters: [{ field: "canonicalCode", value: entry.sku }] },
            { headers: scopeHeaders, signal: controller.signal, maxResponseBytes: TRADE_LOOKUP_RESPONSE_BYTES },
          );
          const match = parseQuotationLegacySkuSearch(res.data, entry.sku, entry.itemCompanyProfileId);
          const uoms = match?.isSellEligible && match.item ? await fetchUoms(match.item.id) : [];
          return { kind: "legacy" as const, id: entry.clientLineId, outcome: (match ?? "NOT_FOUND") as QuotationHydrationLookupOutcome, uoms };
        } catch (error) {
          if (isAbortError(error) || controller.signal.aborted) return null;
          return { kind: "legacy" as const, id: entry.clientLineId, outcome: "DEGRADED" as QuotationHydrationLookupOutcome, uoms: [] };
        }
      }),
    ]).then((results) => {
      if (controller.signal.aborted) return;
      setState((prev) => {
        const base = prev.key === hydrationKey ? prev : emptyLookups(hydrationKey);
        const itemsById = { ...base.itemsById };
        const uomsByItem = { ...base.uomsByItem };
        const itemLookups = { ...base.itemLookups };
        const legacyLookups = { ...base.legacyLookups };
        for (const entry of results) {
          if (!entry) continue;
          if (entry.kind === "item") itemLookups[entry.id] = entry.outcome;
          else legacyLookups[entry.id] = entry.outcome;
          if (typeof entry.outcome === "object" && entry.outcome.isSellEligible && entry.outcome.item) {
            itemsById[entry.outcome.item.id] = entry.outcome.item;
            if (entry.uoms.length > 0) uomsByItem[entry.outcome.item.id] = entry.uoms;
          }
        }
        return { key: hydrationKey, itemsById, uomsByItem, itemLookups, legacyLookups };
      });
    });

    return () => controller.abort();
  }, [canLookup, hydrationKey, lookupRevision, pendingItemsKey, pendingLegacyKey, scopeHeaders]);

  const retryHydrationLookups = useCallback(() => {
    if (!hydrationKey) return;
    setState((prev) => {
      if (prev.key !== hydrationKey) return prev;
      const itemLookups = Object.fromEntries(Object.entries(prev.itemLookups).filter(([, v]) => v !== "DEGRADED"));
      const legacyLookups = Object.fromEntries(Object.entries(prev.legacyLookups).filter(([, v]) => v !== "DEGRADED"));
      return { ...prev, itemLookups, legacyLookups };
    });
    setLookupRevision((rev) => rev + 1);
  }, [hydrationKey]);

  const buildPricingRequest = useCallback(
    (draft: QuotationDiscountDraft, lines: readonly TradeLineDraft[]): HydratedQuotationPricingRequest | null => {
      if (!snapshot || !reconciled || isHydrating || !reconciled.canPreviewPricing) return null;
      return buildHydratedQuotationPricingRequest({
        draft, lines, partyId: snapshot.partyId, currencyCode: snapshot.currencyCode,
        crmCustomerProfileId: snapshot.crmCustomerProfileId,
        persistedLineIds: snapshot.persistedLineIds, blockingLineIds: reconciled.blockingLineIds,
        priceBookIdByLineId: reconciled.priceBookIdByLineId, hydratedItemIdByLineId: snapshot.hydratedItemIdByLineId,
      });
    },
    [isHydrating, reconciled, snapshot],
  );

  const buildRevisionTerms = useCallback(
    (input: { paymentTermCode: string; incotermCode: string; deliveryDays: string; warrantyMonths: string }): QuotationTermsBuildResult | null =>
      snapshot ? buildHydratedQuotationTerms(snapshot.terms, input) : null,
    [snapshot],
  );

  return {
    hydrationKey, snapshot, isHydrating,
    scopeHeaders: snapshot?.scopeHeaders ?? {},
    lineDisplayById: reconciled?.lineDisplayById ?? {},
    priceBookIdByLineId: reconciled?.priceBookIdByLineId ?? {},
    blockingLineIds: reconciled?.blockingLineIds ?? [],
    hasBlockingLines: reconciled?.hasBlockingLines ?? false,
    canPreviewPricing: !isHydrating && (reconciled?.canPreviewPricing ?? true),
    canSubmitRevision: !isHydrating && (reconciled?.canSubmitRevision ?? true),
    resolvedItemsById: mergedItemsById,
    resolvedUomsByItem: mergedUomsByItem,
    retryHydrationLookups, buildPricingRequest, buildRevisionTerms,
  };
}
