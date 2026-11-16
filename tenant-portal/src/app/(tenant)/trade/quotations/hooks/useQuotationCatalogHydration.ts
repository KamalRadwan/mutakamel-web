"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { TradePath } from "@/lib/api/envelope";
import { tradeGet } from "../../trade-api";
import { TRADE_V1 } from "../../documents/trade-document-contract";
import {
  TRADE_LOOKUP_RESPONSE_BYTES,
  itemDisplayName,
  parseTradeItems,
  tradeItemsPath,
  type TradeItemOption,
} from "../../documents/trade-lookup-contract";
import type { TradeLineDraftState } from "../../documents/hooks/useTradeLineDraft";
import type { QuotationDetail } from "../quotation-contract";
import {
  hydrateQuotationWorkspace,
  parseTradeItemDetailForHydration,
  type HydratedQuotationWorkspaceData,
  type QuotationLineDisplayMap,
} from "../quotation-workspace-hydration";

interface CatalogHydrationOptions {
  quotation: QuotationDetail | null;
  headers: Record<string, string>;
  enabled: boolean;
  canReadItems: boolean;
  language: string;
  fallbackValidUntil: string;
  lineDraft: TradeLineDraftState;
  onHydrateFields: (hydrated: HydratedQuotationWorkspaceData, quotation: QuotationDetail) => void;
}

interface ResolvedLookupState {
  key: string;
  itemsById: Record<string, TradeItemOption>;
  ineligibleLineIds: Record<string, true>;
  resolvedLegacyItemByLine: Record<string, string>;
}

export function useQuotationCatalogHydration(options: CatalogHydrationOptions) {
  const { quotation, headers, enabled, canReadItems, language, fallbackValidUntil, lineDraft, onHydrateFields } = options;
  const revisionKey = quotation
    ? `${quotation.id}:${quotation.currentRevisionId ?? "empty"}`
    : null;

  const hydrated = useMemo(
    () => (quotation ? hydrateQuotationWorkspace(quotation, fallbackValidUntil) : null),
    // Recompute synchronous snapshot only when quotation identity or currentRevisionId changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [revisionKey, fallbackValidUntil],
  );

  const [appliedRevisionKey, setAppliedRevisionKey] = useState<string | null>(null);
  const [lookupState, setLookupState] = useState<ResolvedLookupState>({
    key: "",
    itemsById: {},
    ineligibleLineIds: {},
    resolvedLegacyItemByLine: {},
  });
  const onHydrateRef = useRef(onHydrateFields);
  useLayoutEffect(() => {
    onHydrateRef.current = onHydrateFields;
  }, [onHydrateFields]);

  const restoreLines = lineDraft.restore;
  const ensureItemUoms = lineDraft.ensureItemUoms;

  useEffect(() => {
    if (!quotation || !hydrated || !revisionKey || appliedRevisionKey === revisionKey) return;
    let cancelled = false;
    restoreLines({ lines: hydrated.lines, items: [], uomsByItem: {} });
    onHydrateRef.current(hydrated, quotation);
    queueMicrotask(() => {
      if (!cancelled) setAppliedRevisionKey(revisionKey);
    });
    return () => { cancelled = true; };
  }, [appliedRevisionKey, hydrated, quotation, restoreLines, revisionKey]);

  const headersKey = JSON.stringify(Object.entries(headers).sort());

  useEffect(() => {
    if (!enabled || !canReadItems || !quotation || !hydrated || !revisionKey || lineDraft.isLoadingItems) return;
    const controller = new AbortController();
    const scopedHeaders = JSON.parse(headersKey) as Record<string, string>;

    void (async () => {
      const nextItems: Record<string, TradeItemOption> = {};
      const nextIneligible: Record<string, true> = {};
      const nextLegacy: Record<string, string> = {};

      for (const draftLine of hydrated.lines) {
        if (controller.signal.aborted) return;
        const rawLine = hydrated.rawLinesByClientId[draftLine.clientLineId];
        if (!rawLine) continue;
        const expectedProfileId = typeof (rawLine as { itemCompanyProfileId?: unknown }).itemCompanyProfileId === "string"
          ? (rawLine as { itemCompanyProfileId: string }).itemCompanyProfileId
          : undefined;
        const display = hydrated.lineDisplayById[draftLine.clientLineId];

        if (draftLine.itemId) {
          const cached = lineDraft.itemsById[draftLine.itemId];
          if (cached) {
            if (expectedProfileId && cached.eligibility.companyProfileId !== expectedProfileId) {
              nextIneligible[draftLine.clientLineId] = true;
            } else {
              nextItems[cached.id] = cached;
            }
            continue;
          }
          try {
            const response = await tradeGet(`${TRADE_V1}/items/${draftLine.itemId}` as TradePath, {
              headers: scopedHeaders,
              signal: controller.signal,
              maxResponseBytes: TRADE_LOOKUP_RESPONSE_BYTES,
              suppressForbiddenToast: true,
            });
            const detail = parseTradeItemDetailForHydration(response.data);
            if (!detail.item || (expectedProfileId && detail.companyProfileId !== expectedProfileId)) {
              nextIneligible[draftLine.clientLineId] = true;
            } else {
              nextItems[detail.item.id] = detail.item;
            }
          } catch (error) {
            const status = (error as { status?: number })?.status ?? (error as { response?: { status?: number } })?.response?.status;
            // 403 means actor lacks item-catalog read; keep persisted itemId usable for pricing/save.
            if (status === 404) nextIneligible[draftLine.clientLineId] = true;
          }
          continue;
        }

        // Legacy row without discountSnapshot.itemId: reconcile ONLY by exact companyProfileId (+ SKU when present).
        if (!expectedProfileId) continue;
        const sku = display?.sku;
        const localMatch = Object.values(lineDraft.itemsById).find((item) =>
          item.eligibility.companyProfileId === expectedProfileId && (!sku || item.canonicalCode === sku));
        if (localMatch) {
          nextItems[localMatch.id] = localMatch;
          nextLegacy[draftLine.clientLineId] = localMatch.id;
          continue;
        }
        if (!sku) continue;
        try {
          const searchResp = await tradeGet(tradeItemsPath(1, "SALES", sku), {
            headers: scopedHeaders,
            signal: controller.signal,
            maxResponseBytes: TRADE_LOOKUP_RESPONSE_BYTES,
            suppressForbiddenToast: true,
          });
          const page = parseTradeItems(searchResp.data, "SALES");
          const exact = page.items.filter((item) =>
            item.canonicalCode === sku && item.eligibility.companyProfileId === expectedProfileId);
          if (exact.length === 1 && exact[0]) {
            nextItems[exact[0].id] = exact[0];
            nextLegacy[draftLine.clientLineId] = exact[0].id;
          }
        } catch {
          // Keep unresolved row marked unavailable.
        }
      }

      if (controller.signal.aborted) return;
      setLookupState({
        key: revisionKey,
        itemsById: nextItems,
        ineligibleLineIds: nextIneligible,
        resolvedLegacyItemByLine: nextLegacy,
      });

      const resolvedItems = Object.values(nextItems);
      const legacyIds = Object.keys(nextLegacy);
      if (resolvedItems.length > 0 || legacyIds.length > 0) {
        for (const item of resolvedItems) void ensureItemUoms(item.id);
      }
    })();

    return () => controller.abort();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canReadItems, enabled, ensureItemUoms, headersKey, hydrated, lineDraft.isLoadingItems, revisionKey]);

  const activeLookups = lookupState.key === revisionKey ? lookupState : null;
  const syncedLookupKey = useRef<string | null>(null);

  // Merge off-page items and resolved legacy itemIds into lineDraft once per revision lookup.
  useEffect(() => {
    if (!activeLookups || !hydrated || syncedLookupKey.current === activeLookups.key) return;
    syncedLookupKey.current = activeLookups.key;
    const extraItems = Object.values(activeLookups.itemsById).filter((item) => !lineDraft.itemsById[item.id]);
    const needsLegacyPatch = lineDraft.lines.some((line) =>
      line.itemId === "" && Boolean(activeLookups.resolvedLegacyItemByLine[line.clientLineId]));
    if (extraItems.length === 0 && !needsLegacyPatch) return;
    restoreLines({
      lines: lineDraft.lines.map((line) => {
        const resolvedId = activeLookups.resolvedLegacyItemByLine[line.clientLineId];
        return line.itemId === "" && resolvedId ? { ...line, itemId: resolvedId } : line;
      }),
      items: [...Object.values(lineDraft.itemsById), ...extraItems],
      uomsByItem: lineDraft.uomsByItem,
    });
  }, [activeLookups, hydrated, lineDraft.itemsById, lineDraft.lines, lineDraft.uomsByItem, restoreLines]);

  const initialItemsByLineId = useMemo(
    () => Object.fromEntries((hydrated?.lines ?? []).map((line) => [line.clientLineId, line.itemId])),
    [hydrated],
  );

  const activePriceBooksByLineId = useMemo(() => {
    if (!hydrated) return {};
    const out: Record<string, string> = {};
    for (const line of lineDraft.lines) {
      const bookId = hydrated.priceBooksByLineId[line.clientLineId];
      const origItem = initialItemsByLineId[line.clientLineId] || activeLookups?.resolvedLegacyItemByLine[line.clientLineId] || "";
      if (bookId && origItem && line.itemId === origItem) out[line.clientLineId] = bookId;
    }
    return out;
  }, [activeLookups, hydrated, initialItemsByLineId, lineDraft.lines]);

  const lineDisplayById = useMemo<QuotationLineDisplayMap>(() => {
    if (!hydrated) return {};
    const out: QuotationLineDisplayMap = {};
    for (const line of lineDraft.lines) {
      const base = hydrated.lineDisplayById[line.clientLineId];
      if (!base) continue;
      const origItem = initialItemsByLineId[line.clientLineId] || activeLookups?.resolvedLegacyItemByLine[line.clientLineId] || "";
      const itemReplaced = line.itemId !== "" && line.itemId !== origItem;
      if (itemReplaced) continue;
      const item = lineDraft.itemsById[line.itemId] ?? activeLookups?.itemsById[line.itemId];
      const ineligible = Boolean(activeLookups?.ineligibleLineIds[line.clientLineId]) && line.itemId === origItem;
      const unresolved = line.itemId === "" || ineligible;
      out[line.clientLineId] = {
        ...base,
        ...(item ? { itemName: itemDisplayName(item, language), sku: item.canonicalCode } : {}),
        unavailable: unresolved,
      };
    }
    return out;
  }, [activeLookups, hydrated, initialItemsByLineId, language, lineDraft.itemsById, lineDraft.lines]);

  const hasUnavailableLines = useMemo(
    () => Boolean(hydrated?.corruptedDiscountSnapshot) || Object.values(lineDisplayById).some((entry) => entry.unavailable === true),
    [hydrated?.corruptedDiscountSnapshot, lineDisplayById],
  );

  const hydrationReady = !quotation || appliedRevisionKey === revisionKey;

  const forceRehydrate = useCallback((target: QuotationDetail) => {
    const nextKey = `${target.id}:${target.currentRevisionId ?? "empty"}`;
    const next = hydrateQuotationWorkspace(target, fallbackValidUntil);
    const matchingLookups = lookupState.key === nextKey ? lookupState : null;
    syncedLookupKey.current = matchingLookups ? nextKey : null;
    const mergedItemsMap: Record<string, TradeItemOption> = {
      ...lineDraft.itemsById,
      ...(matchingLookups?.itemsById ?? {}),
    };
    restoreLines({
      lines: next.lines.map((line) => {
        const resolvedId = matchingLookups?.resolvedLegacyItemByLine[line.clientLineId];
        return line.itemId === "" && resolvedId ? { ...line, itemId: resolvedId } : line;
      }),
      items: Object.values(mergedItemsMap),
      uomsByItem: lineDraft.uomsByItem,
    });
    onHydrateRef.current(next, target);
    setAppliedRevisionKey(nextKey);
  }, [fallbackValidUntil, lineDraft.itemsById, lineDraft.uomsByItem, lookupState, restoreLines]);

  return {
    hydrated,
    hydrationReady,
    activePriceBooksByLineId,
    resolvedLegacyItemByLine: activeLookups?.resolvedLegacyItemByLine ?? {},
    lineDisplayById,
    hasUnavailableLines,
    forceRehydrate,
  };
}
