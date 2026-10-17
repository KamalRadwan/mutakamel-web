"use client";

import { useState } from "react";
import {
  Activity,
  Banknote,
  Building2,
  Calendar,
  CirclePercent,
  Clock,
  ExternalLink,
  Eye,
  Mail,
  MessageCircle,
  Phone,
  Send,
  Star,
  UserRound,
} from "lucide-react";
import {
  DateTime,
  EmptyState,
  ErrorState,
  Money,
  Pagination,
  Skeleton,
  StatusBadge,
  TagChip,
  cn,
  type CardColor,
  type MoveToTarget,
  type PageInfo,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { localizedName } from "@/lib/format/localized";
import { formatNumber } from "@/lib/format/number";
import { formatTemplate } from "@/lib/format/template";
import { countryIsoFromName } from "@/lib/geo/country-data";
import {
  normalizePhoneDigits,
  normalizeWhatsAppDigits,
} from "../../leads/lead-phone-links";
import { AcquisitionSourceIcon } from "../../shared/components/AcquisitionSourceIcon";
import type { CrmActivityState } from "../../shared/crm-activity-tone";
import type { OpportunityCardPatch } from "../opportunity-card-contract";
import type {
  OpportunityDocumentCountVisibility,
  OpportunityDocumentCounts,
} from "../opportunity-document-counts-contract";
import type { OpportunityListItem } from "../hooks/useOpportunitiesList";
import type {
  OpportunityActivityState,
  OpportunityStage,
} from "../hooks/pipeline-types";
import { OpportunityCardMenu } from "./opportunity-card/OpportunityCardMenu";

export interface OpportunityExecutiveCardViewProps {
  items: readonly OpportunityListItem[];
  stages: readonly OpportunityStage[];
  branchId: string | null;
  selectedIds: ReadonlySet<string>;
  onSelectionChange: (next: Set<string>) => void;
  canUpdate: (item: OpportunityListItem) => boolean;
  canDelete: (item: OpportunityListItem) => boolean;
  isLoading: boolean;
  error: string | null;
  onRetry: () => void;
  page?: PageInfo;
  onPageChange?: (page: number) => void;
  sort?: { id: string; direction: "asc" | "desc" };
  onSortChange?: (next: { id: string; direction: "asc" | "desc" }) => void;
  documentCountsByParty?: ReadonlyMap<string, OpportunityDocumentCounts>;
  documentCountVisibility?: OpportunityDocumentCountVisibility;
  onOpenOpportunity: (item: OpportunityListItem) => void;
  onOpenQuickModal: (item: OpportunityListItem) => void;
  onOpenActivities: (item: OpportunityListItem) => void;
  onDeleteOpportunity: (item: OpportunityListItem) => void;
  onMoveStage: (item: OpportunityListItem, stageId: string) => void;
  onCardChange: (
    opportunityId: string,
    patch: OpportunityCardPatch,
    item: OpportunityListItem,
  ) => void;
  onBulkMoveStage: (stageId: string) => Promise<void>;
}

const CARD_BORDER_ACCENT: Partial<Record<CardColor, string>> = {
  RED: "border-s-4 border-s-red-500",
  ORANGE: "border-s-4 border-s-amber-500",
  AMBER: "border-s-4 border-s-amber-500",
  YELLOW: "border-s-4 border-s-yellow-500",
  GREEN: "border-s-4 border-s-emerald-500",
  TEAL: "border-s-4 border-s-teal-500",
  BLUE: "border-s-4 border-s-blue-600",
  INDIGO: "border-s-4 border-s-indigo-500",
  PURPLE: "border-s-4 border-s-purple-500",
  PINK: "border-s-4 border-s-pink-500",
  SLATE: "border-s-4 border-s-slate-500",
};

function getInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "OP";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0] ?? ""}${words[1][0] ?? ""}`.toUpperCase();
}

function formatStageAgeBadge(isoDate?: string, isAr?: boolean): string {
  if (!isoDate) return isAr ? "الآن بالمرحلة" : "Just now";
  const time = new Date(isoDate).getTime();
  if (Number.isNaN(time)) return isAr ? "بالمرحلة" : "in stage";
  const diffMins = Math.max(1, Math.floor((Date.now() - time) / (1000 * 60)));
  if (diffMins < 60) return isAr ? `${diffMins} د بالمرحلة` : `${diffMins}m in stage`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return isAr ? `${diffHours} س بالمرحلة` : `${diffHours}h in stage`;
  const diffDays = Math.floor(diffHours / 24);
  return isAr ? `${diffDays} يوم بالمرحلة` : `${diffDays}d in stage`;
}

function resolveCountryIso(country: string | null): string {
  const trimmed = (country ?? "").trim();
  if (!trimmed) return "";
  if (/^[A-Z]{2}$/i.test(trimmed)) return trimmed.toUpperCase();
  return countryIsoFromName(trimmed) ?? trimmed.slice(0, 2).toUpperCase();
}

function mapActivityState(state: OpportunityActivityState): CrmActivityState {
  if (state === "OVERDUE") return "OVERDUE";
  if (state === "TODAY") return "TODAY";
  if (state === "FUTURE") return "FUTURE";
  return "NONE";
}

/**
 * Rich 7-Layer Executive Bento Card View for Opportunities matching
 * LeadExecutiveCardView & CustomerExecutiveCardView with bottom-pinned Pagination.
 */
export function OpportunityExecutiveCardView({
  items,
  stages,
  branchId,
  selectedIds,
  onSelectionChange,
  canUpdate,
  canDelete,
  isLoading,
  error,
  onRetry,
  page,
  onPageChange,
  sort,
  onSortChange,
  documentCountsByParty,
  documentCountVisibility,
  onOpenOpportunity,
  onOpenQuickModal,
  onOpenActivities,
  onDeleteOpportunity,
  onMoveStage,
  onCardChange,
  onBulkMoveStage,
}: OpportunityExecutiveCardViewProps) {
  const { t, lang } = useI18n();
  const isAr = lang === "ar";
  const cardDict = t.crmLeads.card;
  const [bulkStageValue, setBulkStageValue] = useState("");

  if (!branchId) {
    return <EmptyState title={t.crmOpportunities.selectBranchFirst} />;
  }

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, idx) => (
          <Skeleton key={`opp-card-skel-${idx}`} className="h-80 rounded-xl" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <ErrorState
        title={t.crmOpportunities.loadFailed}
        onRetry={onRetry}
        retryLabel={t.common.retry}
      />
    );
  }

  if (items.length === 0) {
    return <EmptyState title={t.crmOpportunities.empty} />;
  }

  const stageById = new Map(stages.map((s) => [s.id, s]));
  const nonLostStages = stages.filter((s) => s.flag !== "LOST");
  const isAllSelected =
    items.length > 0 && items.every((item) => selectedIds.has(item.id));

  function toggleSelectAll() {
    if (isAllSelected) {
      onSelectionChange(new Set());
    } else {
      onSelectionChange(new Set(items.map((i) => i.id)));
    }
  }

  function toggleOne(id: string) {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onSelectionChange(next);
  }

  function exportCsv() {
    const rowsToExport =
      selectedIds.size > 0
        ? items.filter((i) => selectedIds.has(i.id))
        : items;
    const header = [
      "ID",
      "Title",
      "Customer",
      "Status",
      "Amount",
      "Currency",
      "Probability",
      "ExpectedCloseDate",
      "Importance",
    ];
    const csvLines = [
      header.join(","),
      ...rowsToExport.map((r) =>
        [
          r.id,
          `"${(r.title || "").replace(/"/g, '""')}"`,
          `"${(r.customerCompanyName || r.customerDisplayName || "").replace(/"/g, '""')}"`,
          r.status,
          r.amount ?? "",
          r.currencyCode ?? "",
          r.probabilityPercent ?? "",
          r.expectedCloseDate ?? "",
          r.importance,
        ].join(","),
      ),
    ];
    const blob = new Blob([csvLines.join("\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "mutakamel-crm-opportunities.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      {/* Sub-Toolbar Bar (Selection + Batch Controls + Sort & Density) */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200/90 bg-white px-3.5 py-2 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-100">
            <input
              type="checkbox"
              checked={isAllSelected}
              onChange={toggleSelectAll}
              className="size-4 rounded-xs border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <span>
              {selectedIds.size > 0
                ? isAr
                  ? `${selectedIds.size} محدد`
                  : `${selectedIds.size} Selected`
                : isAr
                  ? "تحديد الكل"
                  : "Select All"}
            </span>
          </label>

          {/* Move Stage Dropdown */}
          <select
            value={bulkStageValue}
            disabled={selectedIds.size === 0}
            onChange={(e) => {
              const target = e.target.value;
              setBulkStageValue("");
              if (target) void onBulkMoveStage(target);
            }}
            className="h-7 rounded-lg border border-blue-200 bg-blue-50/70 px-2.5 text-xs font-semibold text-blue-700 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-50 disabled:text-slate-400 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300"
          >
            <option value="">{isAr ? "نقل المرحلة ▾" : "Move Stage ▾"}</option>
            {nonLostStages.map((st) => (
              <option key={st.id} value={st.id}>
                {localizedName(st, lang)}
              </option>
            ))}
          </select>

          <button
            type="button"
            disabled={selectedIds.size === 0}
            onClick={() => {
              const firstSelected = items.find((i) => selectedIds.has(i.id));
              if (firstSelected) onOpenQuickModal(firstSelected);
            }}
            className="h-7 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          >
            {isAr ? "تعيين مسؤول ▾" : "Assign Salesperson ▾"}
          </button>

          <button
            type="button"
            disabled={selectedIds.size === 0}
            onClick={() => {
              const firstSelected = items.find((i) => selectedIds.has(i.id));
              if (firstSelected) onOpenQuickModal(firstSelected);
            }}
            className="h-7 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          >
            {isAr ? "تعديل الأهمية / الوسوم ▾" : "Importance & Tags ▾"}
          </button>

          <button
            type="button"
            onClick={exportCsv}
            className="h-7 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          >
            {isAr ? "تصدير المحدد" : "Export Selected"}
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          <span>
            {isAr ? "كثافة البطاقات:" : "Card Density:"}{" "}
            <strong className="font-semibold text-slate-800 dark:text-slate-200">
              Detailed 360°
            </strong>
          </span>
          <span className="text-slate-300 dark:text-slate-700">|</span>
          <span>{isAr ? "ترتيب حسب:" : "Sort by:"}</span>
          <select
            value={`${sort?.id ?? "createdAt"}:${sort?.direction ?? "desc"}`}
            onChange={(e) => {
              const [id, dir] = e.target.value.split(":");
              onSortChange?.({
                id: id || "createdAt",
                direction: dir === "asc" ? "asc" : "desc",
              });
            }}
            className="h-7 rounded-lg border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          >
            <option value="createdAt:desc">
              {isAr ? "تاريخ الإنشاء (الأحدث)" : "Created Date (Newest)"}
            </option>
            <option value="createdAt:asc">
              {isAr ? "تاريخ الإنشاء (الأقدم)" : "Created Date (Oldest)"}
            </option>
            <option value="amount:desc">
              {isAr ? "قيمة الصفقة (الأعلى)" : "Deal Value (High → Low)"}
            </option>
            <option value="probabilityPercent:desc">
              {isAr ? "الاحتمال (الأعلى)" : "Probability (High → Low)"}
            </option>
            <option value="expectedCloseDate:asc">
              {isAr ? "تاريخ الإغلاق (الأقرب)" : "Close Date (Soonest)"}
            </option>
            <option value="title:asc">
              {isAr ? "العنوان (أ - ي)" : "Title (A → Z)"}
            </option>
          </select>
          <span className="text-[11px] font-medium tabular-nums text-slate-400">
            {isAr
              ? `عرض 1–${items.length} من ${page?.total ?? items.length}`
              : `Showing 1–${items.length} of ${page?.total ?? items.length} opportunities`}
          </span>
        </div>
      </div>

      {/* 4-Column Rich 360° Bento Card Grid */}
      <div className="min-h-0 flex-1 overflow-y-auto pb-2">
        <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2 xl:grid-cols-4">
          {items.map((item) => {
            const isSelected = selectedIds.has(item.id);
            const isCorporate = item.customerProfileType === "CORPORATE";
            const customerName =
              (isCorporate ? item.customerCompanyName : null) ??
              item.customerDisplayName ??
              t.crmOpportunities.notProvided;
            const stage = stageById.get(item.stageId);
            const isTerminal =
              stage?.flag === "WON" || stage?.flag === "LOST";
            const isWon = stage?.flag === "WON" || item.status === "WON";
            const isLost = stage?.flag === "LOST" || item.status === "LOST";

            const countryIso = resolveCountryIso(item.customerCountry);
            const cityOrCountry = [item.customerCountry, item.customerCity]
              .filter(Boolean)
              .join(" · ");

            const primaryPhone =
              item.primaryContact?.phones[0] ?? item.customerPhone ?? "";
            const primaryEmail =
              item.primaryContact?.email ?? item.customerEmail ?? "";
            const callDigits = primaryPhone
              ? normalizePhoneDigits(primaryPhone)
              : "";
            const waDigits = primaryPhone
              ? normalizeWhatsAppDigits(
                  primaryPhone,
                  item.customerCountry ?? undefined,
                )
              : null;

            const counts = documentCountsByParty?.get(item.customerPartyId);
            const actState = mapActivityState(item.activityState);
            const ownerInit = getInitials(item.ownerDisplayName ?? "");

            const moveTargets: MoveToTarget[] = stages
              .filter((s) => s.id !== item.stageId)
              .map((s) => ({ id: s.id, label: localizedName(s, lang) }));

            const probabilityLabel =
              item.probabilityPercent === null
                ? null
                : formatTemplate(t.crmOpportunityDetail.probabilityValue, {
                    percent: formatNumber(item.probabilityPercent, lang),
                  });

            return (
              <div
                key={item.id}
                className={cn(
                  "flex flex-col justify-between gap-3 rounded-xl border-2 bg-white p-3.5 shadow-2xs transition-all hover:shadow-md dark:bg-slate-900",
                  item.cardColor ? CARD_BORDER_ACCENT[item.cardColor] : "",
                  isSelected
                    ? "border-blue-600 ring-2 ring-blue-500/15"
                    : "border-slate-200/90 hover:border-blue-300 dark:border-slate-800",
                )}
              >
                <div className="flex flex-col gap-2.5">
                  {/* LAYER 1: Checkbox + Avatar + Title & Customer Subtitle + Stage Select + Quick Inspect + Open + Menu */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-start gap-2">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleOne(item.id)}
                        aria-label={`Select ${item.title}`}
                        className="mt-1.5 size-4 shrink-0 rounded-xs border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-blue-200 bg-blue-50 text-xs font-bold text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300">
                        {getInitials(item.title)}
                      </span>
                      <div className="min-w-0">
                        <button
                          type="button"
                          onClick={() => onOpenOpportunity(item)}
                          className="block max-w-full truncate text-start text-sm font-bold text-slate-900 hover:text-blue-600 dark:text-slate-100 dark:hover:text-blue-400"
                        >
                          {item.title}
                        </button>
                        <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">
                          {countryIso && (
                            <span className="font-semibold text-slate-600 dark:text-slate-300">
                              {countryIso}{" "}
                            </span>
                          )}
                          {[customerName, cityOrCountry]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-1">
                      {canUpdate(item) && !isTerminal ? (
                        <select
                          value={item.stageId}
                          onChange={(e) => onMoveStage(item, e.target.value)}
                          aria-label={`Stage for ${item.title}`}
                          className={cn(
                            "h-6 max-w-24 truncate rounded-md border px-1.5 text-[11px] font-bold",
                            isWon
                              ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                              : isLost
                                ? "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300"
                                : "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300",
                          )}
                        >
                          {stages.map((st) => (
                            <option key={st.id} value={st.id}>
                              {localizedName(st, lang)}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span
                          className={cn(
                            "rounded-md border px-2 py-0.5 text-[11px] font-bold",
                            isWon
                              ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                              : isLost
                                ? "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300"
                                : "border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300",
                          )}
                        >
                          {stage ? localizedName(stage, lang) : "—"}
                        </span>
                      )}

                      <button
                        type="button"
                        onClick={() => onOpenQuickModal(item)}
                        title={
                          isAr
                            ? "معاينة وتعديل سريع 360°"
                            : "Open 360° Quick-Edit Modal"
                        }
                        aria-label={
                          isAr
                            ? "معاينة وتعديل سريع 360°"
                            : "Open 360° Quick-Edit Modal"
                        }
                        className="flex size-6 items-center justify-center rounded-md border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:border-indigo-800 dark:bg-indigo-950 dark:text-indigo-300"
                      >
                        <Eye className="size-3.5" aria-hidden="true" />
                      </button>

                      <button
                        type="button"
                        onClick={() => onOpenOpportunity(item)}
                        title={
                          isAr
                            ? "فتح الصفحة الكاملة"
                            : "Open Full Standalone Page"
                        }
                        aria-label={
                          isAr
                            ? "فتح الصفحة الكاملة"
                            : "Open Full Standalone Page"
                        }
                        className="flex size-6 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"
                      >
                        <ExternalLink className="size-3" aria-hidden="true" />
                      </button>

                      <OpportunityCardMenu
                        cardColor={item.cardColor}
                        onOpen={() => onOpenOpportunity(item)}
                        onDelete={
                          canDelete(item)
                            ? () => onDeleteOpportunity(item)
                            : undefined
                        }
                        onColorChange={
                          canUpdate(item)
                            ? (next: CardColor | null) =>
                                onCardChange(item.id, { cardColor: next }, item)
                            : undefined
                        }
                        moveTargets={canUpdate(item) ? moveTargets : undefined}
                        onMove={(stageId) => onMoveStage(item, stageId)}
                        labels={{
                          trigger: cardDict.more,
                          open: cardDict.open,
                          moveTo: t.views.moveTo,
                          delete: t.common.delete,
                          cardColor: cardDict.cardColor,
                          colorNone: cardDict.colorNone,
                          colorNames: cardDict.colors,
                          selected: cardDict.colorSelected,
                        }}
                      />
                    </div>
                  </div>

                  {/* LAYER 2: Deal Commercials Highlight Box */}
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-200/80 bg-emerald-50/50 px-3 py-2 dark:border-emerald-900/50 dark:bg-emerald-950/20">
                    <div className="flex items-center gap-1.5 text-sm font-extrabold text-emerald-800 dark:text-emerald-300">
                      <Banknote className="size-4 shrink-0" aria-hidden="true" />
                      {item.amount ? (
                        <Money
                          value={item.amount}
                          currency={item.currencyCode ?? undefined}
                          language={lang}
                          className="font-extrabold"
                        />
                      ) : (
                        <span className="text-xs font-medium text-slate-400">
                          {t.crmOpportunities.notProvided}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {probabilityLabel && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-[11px] font-extrabold text-blue-700 shadow-2xs dark:bg-slate-900 dark:text-blue-300">
                          <CirclePercent className="size-3" aria-hidden="true" />
                          {probabilityLabel}
                        </span>
                      )}
                      {item.expectedCloseDate && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                          <Calendar className="size-3 shrink-0" aria-hidden="true" />
                          <DateTime
                            value={`${item.expectedCloseDate.slice(0, 10)}T00:00:00.000Z`}
                            precision="date"
                            language={lang}
                            timeZone="UTC"
                          />
                        </span>
                      )}
                    </div>
                  </div>

                  {/* LAYER 3: Identity & Metadata Pills Row */}
                  <div className="flex flex-wrap items-center justify-between gap-1.5">
                    <div className="flex flex-wrap items-center gap-1">
                      <StatusBadge
                        value={item.status}
                        kind="OpportunityStatus"
                        className="px-2 py-0.5 text-[10px] font-bold"
                      />

                      <span
                        className={cn(
                          "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-semibold",
                          isCorporate
                            ? "border-blue-200 bg-blue-50/80 text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300"
                            : "border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300",
                        )}
                      >
                        {isCorporate ? (
                          <Building2 className="size-3" aria-hidden="true" />
                        ) : (
                          <UserRound className="size-3" aria-hidden="true" />
                        )}
                        {isCorporate ? cardDict.company : cardDict.individual}
                      </span>

                      {item.leadSourceName && (
                        <span className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                          <AcquisitionSourceIcon
                            source={{ iconUrl: item.leadSourceIconUrl }}
                          />
                          <span className="max-w-24 truncate">
                            {item.leadSourceName}
                          </span>
                        </span>
                      )}
                    </div>

                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-400">
                      <Clock className="size-3" aria-hidden="true" />
                      <span>{formatStageAgeBadge(item.createdAt, isAr)}</span>
                    </span>
                  </div>

                  {/* LAYER 4: Primary Contact & Instant Channels Box */}
                  <div className="flex flex-col gap-1.5 rounded-xl border border-slate-200/80 bg-slate-50/80 p-2.5 dark:border-slate-800 dark:bg-slate-800/40">
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex min-w-0 items-center gap-1 text-xs">
                        <UserRound
                          className="size-3.5 shrink-0 text-slate-500"
                          aria-hidden="true"
                        />
                        <strong className="truncate font-bold text-slate-800 dark:text-slate-100">
                          {item.primaryContact?.displayName || customerName}
                        </strong>
                        {item.primaryContact?.jobTitle && (
                          <span className="truncate text-slate-400">
                            · {item.primaryContact.jobTitle}
                          </span>
                        )}
                      </span>
                      {item.primaryContact?.isPrimary && (
                        <span className="shrink-0 rounded-md border border-blue-200 bg-blue-50 px-1.5 py-0.5 text-[10px] font-bold text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300">
                          {cardDict.primary}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500">
                      <div className="min-w-0 truncate">
                        {primaryPhone ? (
                          <span className="font-mono font-bold text-slate-700 dark:text-slate-200" dir="ltr">
                            {primaryPhone}
                          </span>
                        ) : primaryEmail ? (
                          <span className="truncate">{primaryEmail}</span>
                        ) : (
                          <span>{t.crmOpportunities.notProvided}</span>
                        )}
                      </div>

                      <div className="flex shrink-0 items-center gap-1">
                        {callDigits && (
                          <a
                            href={`tel:${callDigits}`}
                            aria-label={`Call ${primaryPhone}`}
                            className="flex size-6 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 hover:border-blue-300 hover:text-blue-600 dark:border-slate-700 dark:bg-slate-800"
                          >
                            <Phone className="size-3" aria-hidden="true" />
                          </a>
                        )}
                        {waDigits && (
                          <>
                            <a
                              href={`https://wa.me/${waDigits}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              aria-label={`WhatsApp ${primaryPhone}`}
                              className="flex size-6 items-center justify-center rounded-md border border-slate-200 bg-white text-emerald-600 hover:border-emerald-300 dark:border-slate-700 dark:bg-slate-800"
                            >
                              <MessageCircle className="size-3" aria-hidden="true" />
                            </a>
                            <a
                              href={`https://t.me/+${waDigits}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              aria-label={`Telegram ${primaryPhone}`}
                              className="flex size-6 items-center justify-center rounded-md border border-slate-200 bg-white text-sky-600 hover:border-sky-300 dark:border-slate-700 dark:bg-slate-800"
                            >
                              <Send className="size-3" aria-hidden="true" />
                            </a>
                          </>
                        )}
                        {primaryEmail && (
                          <a
                            href={`mailto:${primaryEmail}`}
                            aria-label={`Email ${primaryEmail}`}
                            className="flex size-6 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 hover:border-blue-300 hover:text-blue-600 dark:border-slate-700 dark:bg-slate-800"
                          >
                            <Mail className="size-3" aria-hidden="true" />
                          </a>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* LAYER 5: Trade Document Counters Strip */}
                  {counts && (
                    <div className="grid grid-cols-3 gap-1.5 text-center text-[10px]">
                      {documentCountVisibility?.quotations !== false && (
                        <div className="rounded-lg border border-slate-200/80 bg-slate-50 py-1 dark:border-slate-800 dark:bg-slate-800/40">
                          <span className="font-bold text-slate-500">
                            {t.crmLeadViews.documentCountsShort.quotations}:{" "}
                          </span>
                          <strong className="font-extrabold text-slate-800 dark:text-slate-100">
                            {counts.quotations ?? 0}
                          </strong>
                        </div>
                      )}
                      {documentCountVisibility?.salesOrders !== false && (
                        <div className="rounded-lg border border-slate-200/80 bg-slate-50 py-1 dark:border-slate-800 dark:bg-slate-800/40">
                          <span className="font-bold text-slate-500">
                            {t.crmLeadViews.documentCountsShort.salesOrders}:{" "}
                          </span>
                          <strong className="font-extrabold text-slate-800 dark:text-slate-100">
                            {counts.salesOrders ?? 0}
                          </strong>
                        </div>
                      )}
                      {documentCountVisibility?.invoices !== false && (
                        <div className="rounded-lg border border-slate-200/80 bg-slate-50 py-1 dark:border-slate-800 dark:bg-slate-800/40">
                          <span className="font-bold text-slate-500">
                            {t.crmLeadViews.documentCountsShort.invoices}:{" "}
                          </span>
                          <strong className="font-extrabold text-slate-800 dark:text-slate-100">
                            {counts.invoices ?? 0}
                          </strong>
                        </div>
                      )}
                    </div>
                  )}

                  {/* LAYER 6: Tags */}
                  {item.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {item.tags.slice(0, 3).map((tag) => (
                        <TagChip
                          key={tag.id}
                          label={tag.name}
                          backgroundColor={tag.backgroundColor}
                          textColor={tag.textColor}
                        />
                      ))}
                      {item.tags.length > 3 && (
                        <span className="text-[10px] font-semibold text-slate-400">
                          +{item.tags.length - 3}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* LAYER 7: Footer (1★-3★ Importance + Activity Pill + Owner Avatar) */}
                <div className="flex items-center justify-between gap-2 border-t border-slate-100 pt-2.5 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-0.5">
                      {[1, 2, 3].map((st) => {
                        const filled = st <= item.importance;
                        return (
                          <button
                            key={st}
                            type="button"
                            disabled={!canUpdate(item)}
                            onClick={() =>
                              onCardChange(
                                item.id,
                                { importance: item.importance === st ? 0 : st },
                                item,
                              )
                            }
                            aria-label={formatTemplate(
                              t.crmOpportunities.setImportance,
                              { level: st },
                            )}
                            className="p-0.5 disabled:cursor-default"
                          >
                            <Star
                              className={cn(
                                "size-3.5",
                                filled
                                  ? "fill-amber-400 text-amber-500"
                                  : "text-slate-300 dark:text-slate-600",
                              )}
                            />
                          </button>
                        );
                      })}
                    </div>

                    <button
                      type="button"
                      onClick={() => onOpenActivities(item)}
                      className={cn(
                        "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-semibold",
                        actState === "OVERDUE"
                          ? "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300"
                          : actState === "TODAY"
                            ? "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300"
                            : actState === "FUTURE"
                              ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300"
                              : "border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-400",
                      )}
                    >
                      <Activity className="size-3 shrink-0" aria-hidden="true" />
                      <span className="max-w-28 truncate">
                        {item.openActivityCount > 0
                          ? t.crmOpportunities.openActivities(
                              item.openActivityCount,
                            )
                          : t.activities.title}
                      </span>
                    </button>
                  </div>

                  {item.ownerDisplayName && (
                    <div className="flex shrink-0 items-center gap-1.5">
                      <span className="flex size-5 items-center justify-center rounded-md border border-blue-200 bg-blue-50 text-[10px] font-bold text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300">
                        {ownerInit}
                      </span>
                      <span className="max-w-20 truncate text-[11px] font-medium text-slate-600 dark:text-slate-400">
                        {item.ownerDisplayName}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {page && onPageChange && (
        <div className="mt-auto shrink-0 border-t border-border/60 pt-2">
          <Pagination
            page={page}
            onPageChange={onPageChange}
            labels={{
              previous: t.common.previousPage,
              next: t.common.nextPage,
              summary: (from, to, total) =>
                formatTemplate(t.common.showingOf, { from, to, total }),
            }}
          />
        </div>
      )}
    </div>
  );
}
