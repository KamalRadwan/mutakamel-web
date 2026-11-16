"use client";

import { useMemo, useState } from "react";
import { useI18n } from "@/i18n/I18nContext";
import { generateUUIDv7 } from "@/lib/uuid";
import { localizedRecordName, type PriceBookVersionDetail, type PricingReferenceItem, type PricingReferenceUom } from "../../../price-books/pricing-contract";
import { detectVersionDraftConflicts, emptyPriceEntryDraft, type PriceBookVersionDraft, type PriceEntryDraft } from "../../../price-books/version-draft";
import { useVersionEditorFocus, type VersionIssueFocus } from "../../../price-books/workspace/useVersionEditorFocus";

export interface VersionMatrixEditorProps {
  detail: PriceBookVersionDetail;
  draft: PriceBookVersionDraft;
  onChangeDraft: (updater: (prev: PriceBookVersionDraft) => PriceBookVersionDraft) => void;
  editable: boolean;
  items: PricingReferenceItem[];
  uoms: PricingReferenceUom[];
  currencyDecimalPlaces?: number;
  focusRequest?: VersionIssueFocus | null;
}

const PAGE_SIZE = 50;

export function useVersionMatrixEditor({
  detail,
  draft,
  onChangeDraft,
  editable,
  items,
  uoms,
  currencyDecimalPlaces,
  focusRequest,
}: VersionMatrixEditorProps) {
  const { t, lang } = useI18n();
  const currency = detail.book.currencyCode;
  const showCost = detail.canViewCost === true;

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selectedKey, setSelectedKey] = useState<string | null>(draft.entries[0]?.key ?? "row-0");

  const itemById = useMemo(() => new Map(items.map((i) => [i.itemId, i])), [items]);
  const uomById = useMemo(() => new Map(uoms.map((u) => [u.id, u])), [uoms]);
  const storedByKey = useMemo(() => new Map(detail.entries.map((e) => [e.id, e])), [detail.entries]);

  const report = useMemo(() => detectVersionDraftConflicts(draft, currency), [draft, currency]);
  const issuesByRowKey = useMemo(() => {
    const map = new Map<string, typeof report.issues>();
    for (const iss of report.issues) {
      if (!iss.rowKey || iss.tab !== "matrix") continue;
      const arr = map.get(iss.rowKey) ?? [];
      arr.push(iss);
      map.set(iss.rowKey, arr);
    }
    return map;
  }, [report]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return draft.entries
      .map((entry, idx) => ({ entry, idx, rowKey: entry.key ?? `row-${idx}` }))
      .filter(({ entry, rowKey }) => {
        if (!q) return true;
        const it = itemById.get(entry.itemId);
        const st = storedByKey.get(rowKey);
        const uom = uomById.get(entry.uomId);
        const hay = [
          it?.canonicalCode, st?.itemCode,
          localizedRecordName(it?.localizedNames ?? st?.itemLocalizedNames, "", lang),
          uom?.code, st?.uomCode, entry.unitPrice,
        ].filter(Boolean).join(" ").toLowerCase();
        return hay.includes(q);
      });
  }, [draft.entries, itemById, lang, search, storedByKey, uomById]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagedRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  useVersionEditorFocus({ request: focusRequest, rowKeys: draft.entries.map((row, index) => row.key ?? `row-${index}`), selectRow: setSelectedKey, setSearch, setPage, pageSize: PAGE_SIZE });

  const activeSelection = useMemo(() => {
    const foundIdx = draft.entries.findIndex((e, idx) => (e.key ?? `row-${idx}`) === selectedKey);
    if (foundIdx >= 0) {
      const e = draft.entries[foundIdx]!;
      return { entry: { ...e, key: e.key ?? `row-${foundIdx}` }, idx: foundIdx, rowKey: e.key ?? `row-${foundIdx}` };
    }
    const first = draft.entries[0];
    return first ? { entry: { ...first, key: first.key ?? "row-0" }, idx: 0, rowKey: first.key ?? "row-0" } : null;
  }, [draft.entries, selectedKey]);

  const addRow = () => {
    const next = emptyPriceEntryDraft(currency);
    onChangeDraft((prev) => ({ ...prev, entries: [...prev.entries, next] }));
    setSelectedKey(next.key ?? null);
  };
  const updateRow = (targetIdx: number, patch: Partial<PriceEntryDraft>) => {
    onChangeDraft((prev) => ({
      ...prev,
      entries: prev.entries.map((r, i) => (i === targetIdx ? { ...r, ...patch } : r)),
    }));
  };
  const duplicateRow = (entry: PriceEntryDraft, idx: number) => {
    const newKey = generateUUIDv7();
    const copy: PriceEntryDraft = { ...entry, key: newKey };
    onChangeDraft((prev) => {
      const next = [...prev.entries];
      next.splice(idx + 1, 0, copy);
      return { ...prev, entries: next };
    });
    setSelectedKey(newKey);
  };
  const removeRow = (targetIdx: number) => {
    onChangeDraft((prev) => ({ ...prev, entries: prev.entries.filter((_, i) => i !== targetIdx) }));
  };

  
  return { detail, draft, onChangeDraft, editable, items, uoms, currencyDecimalPlaces, t, lang, currency, showCost, search, setSearch, setPage, setSelectedKey, itemById, uomById, storedByKey, report, issuesByRowKey, filtered, totalPages, safePage, pagedRows, activeSelection, addRow, updateRow, duplicateRow, removeRow, PAGE_SIZE };
}
