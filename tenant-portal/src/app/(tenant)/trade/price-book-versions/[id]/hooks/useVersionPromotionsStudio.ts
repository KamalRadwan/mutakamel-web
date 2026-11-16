"use client";

import { useMemo, useState } from "react";
import { useI18n } from "@/i18n/I18nContext";
import { generateUUIDv7 } from "@/lib/uuid";
import { useVersionEditorFocus, type VersionIssueFocus } from "../../../price-books/workspace/useVersionEditorFocus";
import { PROMOTIONS_MAX, localizedRecordName, type PricingReferenceAccount, type PricingReferenceBranch, type PricingReferenceChannel, type PricingReferenceItem, type PricingReferenceUom } from "../../../price-books/pricing-contract";
import { EMPTY_PROMOTION_DRAFT, detectVersionDraftConflicts, type PriceBookVersionDraft, type PromotionRuleDraft } from "../../../price-books/version-draft";

export interface VersionPromotionsStudioProps {
  purpose?: string;
  currencyCode: string;
  draft: PriceBookVersionDraft;
  onChangeDraft: (updater: (prev: PriceBookVersionDraft) => PriceBookVersionDraft) => void;
  editable: boolean;
  items: PricingReferenceItem[];
  uoms: PricingReferenceUom[];
  branches: PricingReferenceBranch[];
  channels: PricingReferenceChannel[];
  channelBranchIdsByChannel?: Record<string, string[]>;
  accounts: PricingReferenceAccount[];
  focusRequest?: VersionIssueFocus | null;
}



export function useVersionPromotionsStudio({
  purpose = "SALES",
  currencyCode,
  draft,
  onChangeDraft,
  editable,
  items,
  uoms,
  branches,
  channels,
  channelBranchIdsByChannel = {},
  accounts,
  focusRequest,
}: VersionPromotionsStudioProps) {
  const { t, lang } = useI18n();
  const [search, setSearch] = useState("");
  const [selectedKey, setSelectedKey] = useState<string | null>(
    draft.promotions[0]?.key ?? "promo-0",
  );

  const itemById = useMemo(() => new Map(items.map((i) => [i.itemId, i])), [items]);
  const uomById = useMemo(() => new Map(uoms.map((u) => [u.id, u])), [uoms]);
  const branchById = useMemo(() => new Map(branches.map((b) => [b.id, b])), [branches]);
  const channelById = useMemo(() => new Map(channels.map((c) => [c.id, c])), [channels]);
  const accountByPartyId = useMemo(() => new Map(accounts.map((a) => [a.partyId, a])), [accounts]);

  const report = useMemo(() => detectVersionDraftConflicts(draft, currencyCode), [draft, currencyCode]);
  const issuesByRowKey = useMemo(() => {
    const map = new Map<string, typeof report.issues>();
    for (const iss of report.issues) {
      if (!iss.rowKey || iss.tab !== "promotions") continue;
      const list = map.get(iss.rowKey) ?? [];
      list.push(iss);
      map.set(iss.rowKey, list);
    }
    return map;
  }, [report]);

  useVersionEditorFocus({ request: focusRequest, rowKeys: draft.promotions.map((row, index) => row.key ?? `promo-${index}`), selectRow: setSelectedKey, setSearch });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return draft.promotions
      .map((promo, idx) => ({ promo, idx, rowKey: promo.key ?? `promo-${idx}` }))
      .filter(({ promo }) =>
        !q ? true : [promo.code, promo.name, promo.stackGroup].filter(Boolean).join(" ").toLowerCase().includes(q),
      );
  }, [draft.promotions, search]);

  const activeSelection = useMemo(() => {
    const foundIdx = draft.promotions.findIndex((p, idx) => (p.key ?? `promo-${idx}`) === selectedKey);
    if (foundIdx >= 0) {
      const p = draft.promotions[foundIdx]!;
      const k = p.key ?? `promo-${foundIdx}`;
      return { promo: { ...p, key: k }, idx: foundIdx, rowKey: k };
    }
    const first = draft.promotions[0];
    if (!first) return null;
    const k = first.key ?? "promo-0";
    return { promo: { ...first, key: k }, idx: 0, rowKey: k };
  }, [draft.promotions, selectedKey]);

  const addPromotion = () => {
    if (draft.promotions.length >= PROMOTIONS_MAX) return;
    const key = generateUUIDv7();
    const next: PromotionRuleDraft = { ...EMPTY_PROMOTION_DRAFT, key, code: `PROMO-${draft.promotions.length + 1}` };
    onChangeDraft((prev) => ({ ...prev, promotions: [...prev.promotions, next] }));
    setSelectedKey(key);
  };
  const updatePromotion = (targetIdx: number, patch: Partial<PromotionRuleDraft>) => {
    onChangeDraft((prev) => ({
      ...prev,
      promotions: prev.promotions.map((p, i) => (i === targetIdx ? { ...p, ...patch } : p)),
    }));
  };
  const removePromotion = (targetIdx: number) => {
    onChangeDraft((prev) => ({ ...prev, promotions: prev.promotions.filter((_, i) => i !== targetIdx) }));
  };

  const summarizeAppliesTo = (p: PromotionRuleDraft): string => {
    const parts: string[] = [];
    if (p.itemId) {
      const it = itemById.get(p.itemId);
      parts.push(it ? localizedRecordName(it.localizedNames, it.canonicalCode, lang) : p.itemId.slice(0, 8));
    }
    if (p.uomId) parts.push(uomById.get(p.uomId)?.code ?? p.uomId.slice(0, 6));
    if (p.branchId) parts.push(branchById.get(p.branchId)?.name ?? t.common.nameUnavailable);
    if (p.channelId) parts.push(channelById.get(p.channelId)?.name ?? t.common.nameUnavailable);
    if (p.partyId) parts.push(accountByPartyId.get(p.partyId)?.displayName ?? p.partyId.slice(0, 8));
    return parts.length > 0 ? parts.join(" · ") : t.tradePricing.promoAllEligibleScope;
  };

  
  return { purpose, currencyCode, draft, editable, items, uoms, branches, channels, channelBranchIdsByChannel, accounts, t, lang, search, setSearch, setSelectedKey, issuesByRowKey, filtered, activeSelection, addPromotion, updatePromotion, removePromotion, summarizeAppliesTo };
}
