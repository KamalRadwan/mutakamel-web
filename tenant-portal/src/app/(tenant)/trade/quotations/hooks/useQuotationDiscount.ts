"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { defaultQuotationDiscount, hasQuotationDiscountEntries, pruneQuotationLineDiscounts,
  resetQuotationFixedDiscounts, type QuotationDiscountDraft } from "../quotation-discount-draft";
import type { QuotationDiscountScope, QuotationDiscountType, QuotationPricingMode } from "../quotation-discount-contract";

type DiscountChange = { mode: QuotationPricingMode } | { scope: QuotationDiscountScope } | { type: QuotationDiscountType };
interface DiscountOptions {
  draft: QuotationDiscountDraft;
  update: (change: (current: QuotationDiscountDraft) => QuotationDiscountDraft) => void;
  contextKey: string; currencyCode: string; lineIds: string[];
  enabled: boolean; locked: boolean;
}
function changeDiscount(current: QuotationDiscountDraft, change: DiscountChange): QuotationDiscountDraft {
  if ("mode" in change) return { ...defaultQuotationDiscount(), mode: change.mode };
  if ("scope" in change) return { ...current, scope: change.scope, type: "PERCENT", value: "0", lineDiscounts: {} };
  return { ...current, type: change.type, value: "0" };
}

export function useQuotationDiscount(options: DiscountOptions) {
  const { draft, update, enabled, locked, contextKey, currencyCode } = options;
  const [pendingChange, setPendingChange] = useState<DiscountChange | null>(null);
  const [notice, setNotice] = useState<"currency" | "context" | null>(null);
  const previous = useRef<{ context: string; currency: string } | null>(null);
  const lineIdsKey = JSON.stringify([...options.lineIds].sort());
  useEffect(() => {
    if (!enabled) return;
    const last = previous.current;
    previous.current = { context: contextKey, currency: currencyCode };
    if (!last || locked) return;
    if (last.context === contextKey && last.currency === currencyCode) return;
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      if (last.context !== contextKey) {
        update(() => defaultQuotationDiscount()); setNotice("context");
      } else {
        update(resetQuotationFixedDiscounts); setNotice("currency");
      }
      setPendingChange(null);
    });
    return () => { cancelled = true; };
  }, [contextKey, currencyCode, enabled, locked, update]);
  useEffect(() => {
    if (!enabled || locked) return;
    let cancelled = false;
    queueMicrotask(() => { if (!cancelled) update((current) => pruneQuotationLineDiscounts(current, new Set(JSON.parse(lineIdsKey) as string[]))); });
    return () => { cancelled = true; };
  }, [enabled, lineIdsKey, locked, update]);

  const requestChange = useCallback((change: DiscountChange) => {
    if (locked) return;
    if (("mode" in change && change.mode === draft.mode) || ("scope" in change && change.scope === draft.scope)
      || ("type" in change && change.type === draft.type)) return;
    if (hasQuotationDiscountEntries(draft)) setPendingChange(change);
    else update((current) => changeDiscount(current, change));
  }, [draft, locked, update]);
  const confirmChange = useCallback(() => {
    if (locked || !pendingChange) return;
    update((current) => changeDiscount(current, pendingChange)); setPendingChange(null);
  }, [locked, pendingChange, update]);
  return {
    draft, pendingChange, notice,
    setMode: (mode: QuotationPricingMode) => requestChange({ mode }),
    setScope: (scope: QuotationDiscountScope) => requestChange({ scope }),
    setType: (type: QuotationDiscountType) => requestChange({ type }),
    setValue: (value: string) => { if (!locked) update((current) => ({ ...current, value })); },
    setReason: (reason: string) => { if (!locked) update((current) => ({ ...current, reason })); },
    setLineType: (clientLineId: string, type: QuotationDiscountType) => {
      if (!locked) update((current) => (current.lineDiscounts[clientLineId]?.type ?? "PERCENT") === type
        ? current
        : { ...current, lineDiscounts: { ...current.lineDiscounts, [clientLineId]: { type, value: "0" } } });
    },
    setLineValue: (clientLineId: string, value: string) => {
      if (!locked) update((current) => ({ ...current, lineDiscounts: { ...current.lineDiscounts,
        [clientLineId]: { type: current.lineDiscounts[clientLineId]?.type ?? "PERCENT", value } } }));
    },
    confirmChange,
    cancelChange: () => { if (!locked) setPendingChange(null); },
    dismissNotice: () => setNotice(null),
  };
}
