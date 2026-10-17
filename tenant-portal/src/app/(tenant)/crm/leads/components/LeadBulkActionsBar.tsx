"use client";

import { useState } from "react";
import {
  Activity,
  ArrowUpRight,
  Star,
  Tag,
  Trash2,
  UserCheck,
  X,
} from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";
import { localizedName } from "@/lib/format/localized";
import type { LeadStage } from "../hooks/useLeads";

export interface LeadBulkActionsBarProps {
  selectedIds: ReadonlySet<string>;
  stages: readonly LeadStage[];
  canUpdateAny: boolean;
  canDeleteAny: boolean;
  onBulkMoveStage: (stageId: string) => Promise<void>;
  onBulkSetRating: (rating: number) => Promise<void>;
  onBulkDelete: () => Promise<void>;
  onClearSelection: () => void;
  onOpenFirstSelectedModal?: () => void;
  onOpenFirstSelectedActivities?: () => void;
}

/**
 * Floating dark bottom command bar matching Screen `07-table-view-bulk-actions.png`:
 * `[5] Leads Selected | [↗ Move Stage (5) ▾] [👤 Assign Salesperson ▾] [🏷 Add / Remove Tags ▾] [📈 Schedule Call Campaign] [🗑 Delete (5)]`
 */
export function LeadBulkActionsBar({
  selectedIds,
  stages,
  canUpdateAny,
  canDeleteAny,
  onBulkMoveStage,
  onBulkSetRating,
  onBulkDelete,
  onClearSelection,
  onOpenFirstSelectedModal,
  onOpenFirstSelectedActivities,
}: LeadBulkActionsBarProps) {
  const { lang } = useI18n();
  const isAr = lang === "ar";
  const [isBusy, setIsBusy] = useState(false);
  const [stageSelect, setStageSelect] = useState("");
  const [ratingSelect, setRatingSelect] = useState("");

  const count = selectedIds.size;
  if (count === 0) return null;

  async function handleMove(stageId: string) {
    if (!stageId || isBusy) return;
    setIsBusy(true);
    try {
      await onBulkMoveStage(stageId);
    } finally {
      setStageSelect("");
      setIsBusy(false);
    }
  }

  async function handleRating(value: string) {
    if (!value || isBusy) return;
    const parsed = Number(value);
    if (Number.isNaN(parsed)) return;
    setIsBusy(true);
    try {
      await onBulkSetRating(parsed);
    } finally {
      setRatingSelect("");
      setIsBusy(false);
    }
  }

  async function handleDelete() {
    if (isBusy) return;
    setIsBusy(true);
    try {
      await onBulkDelete();
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <div
      role="region"
      aria-label={isAr ? "إجراءات جماعية للعملاء المحددين" : "Bulk lead actions"}
      className="fixed inset-x-0 bottom-5 z-40 mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-2.5 rounded-2xl border border-slate-700 bg-slate-950/95 px-4 py-2.5 text-white shadow-2xl backdrop-blur-md"
    >
      <div className="flex items-center gap-2 text-xs font-bold">
        <span className="inline-flex size-6 items-center justify-center rounded-lg bg-blue-600 text-xs font-extrabold tabular-nums text-white">
          {count}
        </span>
        <span>{isAr ? "عملاء محددين" : "Leads Selected"}</span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {canUpdateAny && stages.length > 0 && (
          <div className="relative inline-flex items-center">
            <ArrowUpRight className="pointer-events-none absolute start-2.5 size-3.5 text-white" aria-hidden="true" />
            <select
              aria-label={isAr ? "نقل المرحلة جماعياً" : "Bulk move stage"}
              value={stageSelect}
              disabled={isBusy}
              onChange={(e) => void handleMove(e.target.value)}
              className="h-8 cursor-pointer rounded-lg bg-blue-600 ps-7 pe-3 text-xs font-bold text-white shadow-xs transition-colors hover:bg-blue-500 disabled:opacity-50"
            >
              <option value="">
                {isAr ? `نقل المرحلة (${count}) ▾` : `Move Stage (${count}) ▾`}
              </option>
              {stages
                .filter((st) => st.flag !== "CONVERTED")
                .map((stage) => (
                  <option key={stage.id} value={stage.id} className="bg-slate-900 text-white">
                    {localizedName(stage, lang)}
                  </option>
                ))}
            </select>
          </div>
        )}

        {canUpdateAny && (
          <button
            type="button"
            disabled={isBusy}
            onClick={onOpenFirstSelectedModal}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-3 text-xs font-semibold text-slate-200 transition-colors hover:bg-slate-800"
          >
            <UserCheck className="size-3.5 text-slate-400" aria-hidden="true" />
            <span>{isAr ? "تعيين مسؤول ▾" : "Assign Salesperson ▾"}</span>
          </button>
        )}

        {canUpdateAny && (
          <div className="relative inline-flex items-center">
            <Star className="pointer-events-none absolute start-2.5 size-3.5 text-amber-400" aria-hidden="true" />
            <select
              aria-label={isAr ? "تعيين التقييم جماعياً" : "Bulk set rating"}
              value={ratingSelect}
              disabled={isBusy}
              onChange={(e) => void handleRating(e.target.value)}
              className="h-8 cursor-pointer rounded-lg border border-slate-700 bg-slate-900 ps-7 pe-2.5 text-xs font-semibold text-slate-200 hover:bg-slate-800 disabled:opacity-50"
            >
              <option value="">
                {isAr ? "تعديل التقييم / الوسوم ▾" : "Add / Remove Tags & Rating ▾"}
              </option>
              <option value="3">★★★ (3)</option>
              <option value="2">★★☆ (2)</option>
              <option value="1">★☆☆ (1)</option>
              <option value="0">☆☆☆ (0)</option>
            </select>
          </div>
        )}

        <button
          type="button"
          disabled={isBusy}
          onClick={onOpenFirstSelectedActivities}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-3 text-xs font-semibold text-slate-200 transition-colors hover:bg-slate-800"
        >
          <Activity className="size-3.5 text-emerald-400" aria-hidden="true" />
          <span>{isAr ? "جدولة حملة اتصال" : "Schedule Call Campaign"}</span>
        </button>

        {canDeleteAny && (
          <button
            type="button"
            disabled={isBusy}
            onClick={() => void handleDelete()}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-red-600 px-3 text-xs font-bold text-white shadow-xs transition-colors hover:bg-red-500 disabled:opacity-50"
          >
            <Trash2 className="size-3.5" aria-hidden="true" />
            <span>{isAr ? `حذف (${count})` : `Delete (${count})`}</span>
          </button>
        )}

        <button
          type="button"
          disabled={isBusy}
          onClick={onClearSelection}
          title={isAr ? "إلغاء التحديد" : "Clear selection"}
          aria-label={isAr ? "إلغاء التحديد" : "Clear selection"}
          className="flex size-8 items-center justify-center rounded-lg border border-slate-700 bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-white"
        >
          <X className="size-3.5" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
