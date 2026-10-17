"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Activity,
  ArrowDown,
  ArrowUp,
  Banknote,
  Calendar,
  Check,
  ChevronDown,
  CirclePercent,
  Eye,
  MessageCircle,
  Phone,
  Send,
  Star,
  Trash2,
} from "lucide-react";
import {
  DateTime,
  EmptyState,
  ErrorState,
  Money,
  Pagination,
  Skeleton,
  StatusBadge,
  cn,
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
import type { CrmActivityState } from "../../shared/crm-activity-tone";
import type { OpportunityCardPatch } from "../opportunity-card-contract";
import type { OpportunityListItem } from "../hooks/useOpportunitiesList";
import type {
  OpportunityActivityState,
  OpportunityStage,
} from "../hooks/pipeline-types";

export interface OpportunityExecutiveTableViewProps {
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
  onOpenQuickModal: (item: OpportunityListItem) => void;
  onOpenActivities: (item: OpportunityListItem) => void;
  onDeleteOpportunity: (item: OpportunityListItem) => void;
  onMoveStage: (item: OpportunityListItem, stageId: string) => void;
  onCardChange: (
    opportunityId: string,
    patch: OpportunityCardPatch,
    item: OpportunityListItem,
  ) => void;
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

function getInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0] ?? ""}${words[1][0] ?? ""}`.toUpperCase();
}

/**
 * High-Density Spreadsheet Table View for Opportunities matching
 * LeadExecutiveTableView & CustomerExecutiveTableView with bottom-pinned Pagination.
 */
export function OpportunityExecutiveTableView({
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
  onOpenQuickModal,
  onOpenActivities,
  onDeleteOpportunity,
  onMoveStage,
  onCardChange,
}: OpportunityExecutiveTableViewProps) {
  const { t, lang } = useI18n();
  const isAr = lang === "ar";
  const cardDict = t.crmLeads.card;

  const [openStageMenuId, setOpenStageMenuId] = useState<string | null>(null);

  if (!branchId) {
    return <EmptyState title={t.crmOpportunities.selectBranchFirst} />;
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-2">
        {Array.from({ length: 8 }).map((_, idx) => (
          <Skeleton
            key={`opp-table-row-skel-${idx}`}
            className="h-12 w-full rounded-lg"
          />
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
  const isAllSelected =
    items.length > 0 && items.every((item) => selectedIds.has(item.id));

  function toggleSelectAll() {
    if (isAllSelected) {
      onSelectionChange(new Set());
    } else {
      onSelectionChange(new Set(items.map((i) => i.id)));
    }
  }

  function toggleRow(id: string) {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onSelectionChange(next);
  }

  const isSortedByTitle = sort?.id === "title";
  const isSortedByAmount = sort?.id === "amount";
  const isSortedByCloseDate = sort?.id === "expectedCloseDate";

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="min-h-0 flex-1 overflow-auto rounded-xl border border-slate-200/90 bg-white shadow-2xs dark:border-slate-800 dark:bg-slate-900">
        <table className="w-full border-collapse text-start text-xs">
          <thead className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50/95 text-[11px] font-bold text-slate-600 backdrop-blur-xs dark:border-slate-800 dark:bg-slate-900/95 dark:text-slate-300">
            <tr>
              <th className="w-10 px-3 py-2.5 text-center">
                <input
                  type="checkbox"
                  checked={isAllSelected}
                  onChange={toggleSelectAll}
                  aria-label={t.views.selectAll}
                  className="size-4 rounded-xs border-slate-300 text-blue-600 focus:ring-blue-500"
                />
              </th>
              <th className="px-3 py-2.5 text-start">
                <button
                  type="button"
                  onClick={() =>
                    onSortChange?.({
                      id: "title",
                      direction:
                        isSortedByTitle && sort?.direction === "asc"
                          ? "desc"
                          : "asc",
                    })
                  }
                  className="inline-flex items-center gap-1 font-bold text-slate-700 hover:text-blue-600 dark:text-slate-200"
                >
                  <span>
                    {isAr ? "الفرصة والعميل" : "Opportunity & Customer"}
                  </span>
                  {isSortedByTitle && sort?.direction === "desc" ? (
                    <ArrowDown className="size-3" aria-hidden="true" />
                  ) : (
                    <ArrowUp className="size-3" aria-hidden="true" />
                  )}
                </button>
              </th>
              <th className="px-3 py-2.5 text-start">
                <button
                  type="button"
                  onClick={() =>
                    onSortChange?.({
                      id: "amount",
                      direction:
                        isSortedByAmount && sort?.direction === "desc"
                          ? "asc"
                          : "desc",
                    })
                  }
                  className="inline-flex items-center gap-1 font-bold text-slate-700 hover:text-blue-600 dark:text-slate-200"
                >
                  <span>
                    {isAr ? "قيمة الصفقة والاحتمال" : "Deal Value & Prob."}
                  </span>
                  {isSortedByAmount && sort?.direction === "asc" ? (
                    <ArrowUp className="size-3" aria-hidden="true" />
                  ) : (
                    <ArrowDown className="size-3" aria-hidden="true" />
                  )}
                </button>
              </th>
              <th className="px-3 py-2.5 text-start">
                <button
                  type="button"
                  onClick={() =>
                    onSortChange?.({
                      id: "expectedCloseDate",
                      direction:
                        isSortedByCloseDate && sort?.direction === "asc"
                          ? "desc"
                          : "asc",
                    })
                  }
                  className="inline-flex items-center gap-1 font-bold text-slate-700 hover:text-blue-600 dark:text-slate-200"
                >
                  <span>{t.crmOpportunities.expectedClose}</span>
                  {isSortedByCloseDate && sort?.direction === "desc" ? (
                    <ArrowDown className="size-3" aria-hidden="true" />
                  ) : (
                    <ArrowUp className="size-3" aria-hidden="true" />
                  )}
                </button>
              </th>
              <th className="px-3 py-2.5 text-start">
                {isAr
                  ? "التواصل الفوري"
                  : "Contact & Instant Channels"}
              </th>
              <th className="px-3 py-2.5 text-start">
                {isAr ? "الدولة" : "Country"}
              </th>
              <th className="px-3 py-2.5 text-start">
                {isAr ? "المرحلة (تعديل فوري)" : "Stage (Inline Editable)"}
              </th>
              <th className="px-3 py-2.5 text-start">
                {isAr ? "مسؤول المبيعات" : "Salesperson"}
              </th>
              <th className="px-3 py-2.5 text-start">
                {isAr ? "الأهمية والمتابعة" : "Importance & Follow-up"}
              </th>
              <th className="px-3 py-2.5 text-end">
                {isAr ? "إجراءات بنفس الصفحة" : "Same-Page Actions"}
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
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

              const primaryPhone =
                item.primaryContact?.phones[0] ?? item.customerPhone ?? "";
              const callDigits = primaryPhone
                ? normalizePhoneDigits(primaryPhone)
                : "";
              const waDigits = primaryPhone
                ? normalizeWhatsAppDigits(
                    primaryPhone,
                    item.customerCountry ?? undefined,
                  )
                : null;

              const actState = mapActivityState(item.activityState);
              const ownerInit = getInitials(item.ownerDisplayName ?? "");
              const ownerName =
                item.ownerDisplayName ||
                (isAr ? "غير معين" : "Unassigned");
              const isStagePopoverOpen = openStageMenuId === item.id;

              const probabilityLabel =
                item.probabilityPercent === null
                  ? null
                  : formatTemplate(t.crmOpportunityDetail.probabilityValue, {
                      percent: formatNumber(item.probabilityPercent, lang),
                    });

              return (
                <tr
                  key={item.id}
                  className={cn(
                    "transition-colors hover:bg-blue-50/30 dark:hover:bg-slate-800/40",
                    isSelected && "bg-blue-50/60 dark:bg-blue-950/30",
                  )}
                >
                  {/* 1. Checkbox */}
                  <td className="px-3 py-2.5 text-center">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleRow(item.id)}
                      aria-label={`Select ${item.title}`}
                      className="size-4 rounded-xs border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                  </td>

                  {/* 2. Opportunity Title + Customer + Corporate/Individual Badge */}
                  <td className="px-3 py-2.5">
                    <div className="flex flex-col gap-0.5">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/crm/opportunities/${item.id}`}
                          className="font-bold text-slate-900 hover:text-blue-600 hover:underline dark:text-slate-100 dark:hover:text-blue-400"
                        >
                          {item.title}
                        </Link>
                        <StatusBadge
                          value={item.status}
                          kind="OpportunityStatus"
                          className="px-1.5 py-0 text-[10px] font-bold"
                        />
                      </div>
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                        <span className="truncate">{customerName}</span>
                        <span
                          className={cn(
                            "rounded-md border px-1.5 py-0 text-[10px] font-bold",
                            isCorporate
                              ? "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300"
                              : "border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300",
                          )}
                        >
                          {isCorporate ? cardDict.company : cardDict.individual}
                        </span>
                      </div>
                    </div>
                  </td>

                  {/* 3. Deal Value & Probability */}
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      {item.amount ? (
                        <span className="inline-flex items-center gap-1 font-extrabold text-emerald-700 dark:text-emerald-400">
                          <Banknote className="size-3.5 shrink-0" aria-hidden="true" />
                          <Money
                            value={item.amount}
                            currency={item.currencyCode ?? undefined}
                            language={lang}
                            className="font-extrabold"
                          />
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                      {probabilityLabel && (
                        <span className="inline-flex items-center gap-0.5 rounded-full bg-blue-50 px-1.5 py-0.5 text-[10px] font-bold text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
                          <CirclePercent className="size-3" aria-hidden="true" />
                          {probabilityLabel}
                        </span>
                      )}
                    </div>
                  </td>

                  {/* 4. Expected Close Date */}
                  <td className="px-3 py-2.5 text-slate-700 dark:text-slate-300">
                    {item.expectedCloseDate ? (
                      <span className="inline-flex items-center gap-1 font-medium">
                        <Calendar className="size-3 text-slate-400" aria-hidden="true" />
                        <DateTime
                          value={`${item.expectedCloseDate.slice(0, 10)}T00:00:00.000Z`}
                          precision="date"
                          language={lang}
                          timeZone="UTC"
                        />
                      </span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>

                  {/* 5. Contact & Instant Channels */}
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <div className="min-w-0">
                        <div className="truncate font-medium text-slate-700 dark:text-slate-200">
                          {item.primaryContact?.displayName || customerName}
                        </div>
                        {primaryPhone && (
                          <div
                            className="font-mono text-[11px] text-slate-500"
                            dir="ltr"
                          >
                            {primaryPhone}
                          </div>
                        )}
                      </div>

                      {primaryPhone && (
                        <div className="flex items-center gap-1">
                          {callDigits && (
                            <a
                              href={`tel:${callDigits}`}
                              aria-label={`Call ${primaryPhone}`}
                              className="flex size-6 items-center justify-center rounded-full border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
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
                                className="flex size-6 items-center justify-center rounded-full border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                              >
                                <MessageCircle className="size-3" aria-hidden="true" />
                              </a>
                              <a
                                href={`https://t.me/+${waDigits}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                aria-label={`Telegram ${primaryPhone}`}
                                className="flex size-6 items-center justify-center rounded-full border border-sky-200 bg-sky-50 text-sky-600 hover:bg-sky-100 dark:border-sky-800 dark:bg-sky-950 dark:text-sky-300"
                              >
                                <Send className="size-3" aria-hidden="true" />
                              </a>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </td>

                  {/* 6. Country */}
                  <td className="px-3 py-2.5 text-slate-700 dark:text-slate-300">
                    {countryIso && (
                      <span className="font-bold text-slate-400">
                        {countryIso}{" "}
                      </span>
                    )}
                    <span>{item.customerCountry || "—"}</span>
                  </td>

                  {/* 7. Stage (Inline Editable Custom Popover) */}
                  <td className="relative px-3 py-2.5">
                    <button
                      type="button"
                      disabled={!canUpdate(item) || isTerminal}
                      onClick={() =>
                        setOpenStageMenuId(
                          isStagePopoverOpen ? null : item.id,
                        )
                      }
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-bold transition-all",
                        isStagePopoverOpen && "ring-2 ring-blue-600",
                        isWon
                          ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                          : isLost
                            ? "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300"
                            : stage?.flag === "NEW"
                              ? "border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300"
                              : "border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200",
                      )}
                    >
                      <span>{stage ? localizedName(stage, lang) : "—"}</span>
                      {!isTerminal && (
                        <ChevronDown className="size-3" aria-hidden="true" />
                      )}
                    </button>

                    {isStagePopoverOpen && (
                      <div className="absolute start-3 top-10 z-30 w-48 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl dark:border-slate-700 dark:bg-slate-900">
                        <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          {isAr
                            ? "تغيير المرحلة فورياً"
                            : "CHANGE STAGE INLINE"}
                        </div>
                        {stages.map((st) => {
                          const active = st.id === item.stageId;
                          return (
                            <button
                              key={st.id}
                              type="button"
                              onClick={() => {
                                setOpenStageMenuId(null);
                                if (!active) onMoveStage(item, st.id);
                              }}
                              className={cn(
                                "flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-start text-xs font-semibold transition-colors",
                                active
                                  ? "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                                  : st.flag === "WON"
                                    ? "text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400"
                                    : st.flag === "LOST"
                                      ? "text-red-600 hover:bg-red-50 dark:text-red-400"
                                      : "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800",
                              )}
                            >
                              <span>{localizedName(st, lang)}</span>
                              {active && (
                                <Check
                                  className="size-3.5 text-blue-600"
                                  aria-hidden="true"
                                />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </td>

                  {/* 8. Salesperson */}
                  <td className="px-3 py-2.5">
                    <button
                      type="button"
                      onClick={() => onOpenQuickModal(item)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-transparent px-1.5 py-0.5 hover:border-blue-200 hover:bg-blue-50/50 dark:hover:border-slate-700"
                    >
                      {ownerInit && (
                        <span className="flex size-5 items-center justify-center rounded-md bg-blue-50 text-[10px] font-bold text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                          {ownerInit}
                        </span>
                      )}
                      <span className="font-medium text-slate-700 dark:text-slate-200">
                        {ownerName}
                      </span>
                    </button>
                  </td>

                  {/* 9. Importance & Follow-up */}
                  <td className="px-3 py-2.5">
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
                                  {
                                    importance:
                                      item.importance === st ? 0 : st,
                                  },
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
                  </td>

                  {/* 10. Same-Page Actions */}
                  <td className="px-3 py-2.5 text-end">
                    <div className="inline-flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => onOpenQuickModal(item)}
                        className="inline-flex h-7 items-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 text-xs font-bold text-indigo-700 hover:bg-indigo-100 dark:border-indigo-800 dark:bg-indigo-950 dark:text-indigo-300"
                      >
                        <Eye className="size-3.5" aria-hidden="true" />
                        <span>{isAr ? "معاينة" : "Peek"}</span>
                      </button>

                      {canDelete(item) && (
                        <button
                          type="button"
                          onClick={() => onDeleteOpportunity(item)}
                          title={t.common.delete}
                          aria-label={t.common.delete}
                          className="flex size-7 items-center justify-center rounded-lg border border-red-200 bg-red-50/70 text-red-600 hover:bg-red-100 dark:border-red-900/60 dark:bg-red-950/50 dark:text-red-400"
                        >
                          <Trash2 className="size-3.5" aria-hidden="true" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
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
