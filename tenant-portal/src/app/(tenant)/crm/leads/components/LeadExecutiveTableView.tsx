"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Activity,
  ArrowDown,
  ArrowUp,
  Check,
  ChevronDown,
  Eye,
  MessageCircle,
  Pencil,
  Phone,
  Send,
  Star,
  Trash2,
  X,
} from "lucide-react";
import {
  EmptyState,
  ErrorState,
  Pagination,
  Skeleton,
  cn,
  type PageInfo,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { localizedName, localizedValue } from "@/lib/format/localized";
import { formatTemplate } from "@/lib/format/template";
import { countryIsoFromName } from "@/lib/geo/country-data";
import {
  leadActivityState,
  leadCardHeading,
  leadOwnerInitials,
  type LeadCardPatch,
} from "../lead-card-contract";
import {
  normalizePhoneDigits,
  normalizeWhatsAppDigits,
} from "../lead-phone-links";
import type { LeadItem, LeadStage } from "../hooks/useLeads";

export interface LeadExecutiveTableViewProps {
  items: readonly LeadItem[];
  stages: readonly LeadStage[];
  branchId: string | null;
  selectedIds: ReadonlySet<string>;
  onSelectionChange: (next: Set<string>) => void;
  canUpdate: (lead: LeadItem) => boolean;
  canDelete: (lead: LeadItem) => boolean;
  isLoading: boolean;
  error: string | null;
  onRetry: () => void;
  page?: PageInfo;
  onPageChange?: (page: number) => void;
  sort?: { id: string; direction: "asc" | "desc" };
  onSortChange?: (next: { id: string; direction: "asc" | "desc" }) => void;
  onOpenQuickModal: (lead: LeadItem) => void;
  onOpenActivities: (lead: LeadItem) => void;
  onDeleteLead: (lead: LeadItem) => void;
  onMoveStage: (lead: LeadItem, stageId: string) => void;
  onCardChange: (leadId: string, patch: LeadCardPatch, lead: LeadItem) => void;
  onInlinePhoneSave: (lead: LeadItem, nextPhone: string) => void;
}

function resolveCountryIso(country: string): string {
  const trimmed = country.trim();
  if (!trimmed) return "";
  if (/^[A-Z]{2}$/i.test(trimmed)) return trimmed.toUpperCase();
  return countryIsoFromName(trimmed) ?? trimmed.slice(0, 2).toUpperCase();
}

/**
 * High-Density Spreadsheet Table View matching Screens `06-table-view-inline-edit.png`
 * and `07-table-view-bulk-actions.png` pixel-for-pixel:
 * 1. Checkbox
 * 2. Lead / Organization ↑ (Bold Name + Company / Individual badge)
 * 3. Primary Contact (Name · Job Title)
 * 4. Phone & Instant Channels (Click/Pencil inline cell edit `[EG +20 ... ✓ ✕]` + `📞 💬 ✈️`)
 * 5. Country (`EG Egypt`)
 * 6. Stage (Inline Editable custom popover menu `CHANGE STAGE INLINE`)
 * 7. Source (Pill)
 * 8. Salesperson (Inline pill `KR Kamal Radwan`)
 * 9. Rating & Follow-up (`★★★` + Colored Activity Pill)
 * 10. Same-Page Actions (`[👁 Peek]` + `✏️` + `🗑`)
 */
export function LeadExecutiveTableView({
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
  onDeleteLead,
  onMoveStage,
  onCardChange,
  onInlinePhoneSave,
}: LeadExecutiveTableViewProps) {
  const { t, lang } = useI18n();
  const isAr = lang === "ar";
  const cardDict = t.crmLeads.card;

  const [editingPhoneLeadId, setEditingPhoneLeadId] = useState<string | null>(null);
  const [phoneDraft, setPhoneDraft] = useState("");
  const [openStageMenuLeadId, setOpenStageMenuLeadId] = useState<string | null>(null);

  if (!branchId) {
    return <EmptyState title={t.crmLeads.selectBranchFirst} />;
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-2">
        {Array.from({ length: 8 }).map((_, idx) => (
          <Skeleton key={`table-row-skel-${idx}`} className="h-12 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (error) {
    return <ErrorState title={t.crmLeads.loadFailed} onRetry={onRetry} retryLabel={t.common.retry} />;
  }

  if (items.length === 0) {
    return <EmptyState title={t.crmLeads.empty} />;
  }

  const stageById = new Map(stages.map((s) => [s.id, s]));
  const nonTerminalStages = stages.filter((s) => s.flag !== "CONVERTED");
  const isAllSelected = items.length > 0 && items.every((item) => selectedIds.has(item.id));

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

  function startPhoneEdit(lead: LeadItem, currentPhone: string) {
    setEditingPhoneLeadId(lead.id);
    setPhoneDraft(currentPhone || "+20 ");
  }

  function commitPhoneEdit(lead: LeadItem) {
    onInlinePhoneSave(lead, phoneDraft.trim());
    setEditingPhoneLeadId(null);
  }

  const isSortedByName = sort?.id === "displayName";

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
                      id: "displayName",
                      direction:
                        isSortedByName && sort?.direction === "asc" ? "desc" : "asc",
                    })
                  }
                  className="inline-flex items-center gap-1 font-bold text-slate-700 hover:text-blue-600 dark:text-slate-200"
                >
                  <span>{isAr ? "العميل / المؤسسة" : "Lead / Organization"}</span>
                  {isSortedByName && sort?.direction === "desc" ? (
                    <ArrowDown className="size-3" aria-hidden="true" />
                  ) : (
                    <ArrowUp className="size-3" aria-hidden="true" />
                  )}
                </button>
              </th>
              <th className="px-3 py-2.5 text-start">
                {isAr ? "مسؤول التواصل" : "Primary Contact"}
              </th>
              <th className="px-3 py-2.5 text-start">
                {isAr ? "الهاتف وقنوات التواصل الفوري" : "Phone & Instant Channels"}
              </th>
              <th className="px-3 py-2.5 text-start">{isAr ? "الدولة" : "Country"}</th>
              <th className="px-3 py-2.5 text-start">
                {isAr ? "المرحلة (تعديل فوري)" : "Stage (Inline Editable)"}
              </th>
              <th className="px-3 py-2.5 text-start">{isAr ? "المصدر" : "Source"}</th>
              <th className="px-3 py-2.5 text-start">
                {isAr ? "مسؤول المبيعات" : "Salesperson (Inline)"}
              </th>
              <th className="px-3 py-2.5 text-start">
                {isAr ? "التقييم والمتابعة" : "Rating & Follow-up"}
              </th>
              <th className="px-3 py-2.5 text-end">
                {isAr ? "إجراءات بنفس الصفحة" : "Same-Page Actions"}
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
            {items.map((lead) => {
              const isSelected = selectedIds.has(lead.id);
              const { title, contactName } = leadCardHeading(lead);
              const isCompany = lead.leadProfileType === "CORPORATE";
              const stage = stageById.get(lead.stageId);
              const isTerminal = stage?.flag === "CONVERTED";
              const isQualified = stage?.flag === "QUALIFIED";
              const isDisqualified = stage?.flag === "DISQUALIFIED";
              const sourceLabel = localizedValue(lead.sourceNameAr, lead.sourceNameEn, lang);
              const countryIso = resolveCountryIso(lead.country);
              const primaryPhone =
                (isCompany ? lead.primaryContact?.phones[0] || lead.phone : lead.phone) ||
                lead.phones[0] ||
                "";

              const callDigits = primaryPhone ? normalizePhoneDigits(primaryPhone) : "";
              const waDigits = primaryPhone
                ? normalizeWhatsAppDigits(primaryPhone, lead.country)
                : null;
              const tgDigits = waDigits;

              const activityState = leadActivityState(lead.nextActivity);
              const ownerInitials = lead.owner ? leadOwnerInitials(lead.owner) : "";
              const ownerName = lead.owner
                ? `${lead.owner.firstName} ${lead.owner.lastName}`.trim()
                : isAr
                  ? "غير معين"
                  : "Unassigned";

              const isEditingPhone = editingPhoneLeadId === lead.id;
              const isStagePopoverOpen = openStageMenuLeadId === lead.id;

              return (
                <tr
                  key={lead.id}
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
                      onChange={() => toggleRow(lead.id)}
                      aria-label={`Select ${title}`}
                      className="size-4 rounded-xs border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                  </td>

                  {/* 2. Lead / Organization + Badge */}
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/crm/leads/${lead.id}`}
                        className="font-bold text-slate-900 hover:text-blue-600 hover:underline dark:text-slate-100 dark:hover:text-blue-400"
                      >
                        {title}
                      </Link>
                      <span
                        className={cn(
                          "rounded-md border px-1.5 py-0.5 text-[10px] font-bold",
                          isCompany
                            ? "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300"
                            : "border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300",
                        )}
                      >
                        {isCompany ? cardDict.company : cardDict.individual}
                      </span>
                    </div>
                  </td>

                  {/* 3. Primary Contact · Role */}
                  <td className="px-3 py-2.5">
                    <Link
                      href={`/crm/leads/${lead.id}`}
                      className="inline-flex items-center gap-1 text-slate-700 hover:text-blue-600 dark:text-slate-300"
                    >
                      <span className="font-medium">{contactName || title}</span>
                      <span className="text-slate-400">
                        ·{" "}
                        {lead.primaryContact?.jobTitle ||
                          (isCompany
                            ? isAr
                              ? "مسؤول التواصل"
                              : "Primary"
                            : isAr
                              ? "عميل مباشر"
                              : "Direct")}
                      </span>
                    </Link>
                  </td>

                  {/* 4. Phone & Instant Channels (Inline Editable like Screen 06) */}
                  <td className="px-3 py-2.5">
                    {isEditingPhone ? (
                      <div className="inline-flex items-center gap-1 rounded-lg border-2 border-blue-600 bg-blue-50/40 px-2 py-0.5 dark:bg-blue-950/40">
                        <span className="text-[10px] font-bold text-slate-500">
                          {countryIso}
                        </span>
                        <input
                          type="text"
                          dir="ltr"
                          value={phoneDraft}
                          onChange={(e) => setPhoneDraft(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") commitPhoneEdit(lead);
                            if (e.key === "Escape") setEditingPhoneLeadId(null);
                          }}
                          className="w-36 bg-transparent font-mono text-xs font-bold text-slate-900 focus:outline-hidden dark:text-white"
                          autoFocus
                        />
                        <button
                          type="button"
                          onClick={() => commitPhoneEdit(lead)}
                          aria-label="Save phone"
                          className="flex size-5 items-center justify-center rounded-xs bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                        >
                          <Check className="size-3" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingPhoneLeadId(null)}
                          aria-label="Cancel phone edit"
                          className="flex size-5 items-center justify-center rounded-xs bg-slate-200 text-slate-700 hover:bg-slate-300"
                        >
                          <X className="size-3" aria-hidden="true" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => canUpdate(lead) && startPhoneEdit(lead, primaryPhone)}
                          className="font-mono text-xs font-bold text-slate-800 hover:text-blue-600 dark:text-slate-100"
                          dir="ltr"
                        >
                          {primaryPhone || (isAr ? "+ إضافة هاتف" : "+ Add phone")}
                        </button>

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
                            <a
                              href={`https://wa.me/${waDigits}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              aria-label={`Message ${primaryPhone} on WhatsApp`}
                              className="flex size-6 items-center justify-center rounded-full border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                            >
                              <MessageCircle className="size-3" aria-hidden="true" />
                            </a>
                          )}
                          {tgDigits && (
                            <a
                              href={`https://t.me/+${tgDigits}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              aria-label={`Message ${primaryPhone} on Telegram`}
                              className="flex size-6 items-center justify-center rounded-full border border-sky-200 bg-sky-50 text-sky-600 hover:bg-sky-100 dark:border-sky-800 dark:bg-sky-950 dark:text-sky-300"
                            >
                              <Send className="size-3" aria-hidden="true" />
                            </a>
                          )}
                        </div>
                      </div>
                    )}
                  </td>

                  {/* 5. Country */}
                  <td className="px-3 py-2.5 text-slate-700 dark:text-slate-300">
                    {countryIso && <span className="font-bold text-slate-400">{countryIso} </span>}
                    <span>{lead.country || "—"}</span>
                  </td>

                  {/* 6. Stage (Inline Editable Custom Popover matching Screen 06) */}
                  <td className="relative px-3 py-2.5">
                    <button
                      type="button"
                      disabled={!canUpdate(lead) || isTerminal}
                      onClick={() =>
                        setOpenStageMenuLeadId(isStagePopoverOpen ? null : lead.id)
                      }
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-bold transition-all",
                        isStagePopoverOpen && "ring-2 ring-blue-600",
                        isQualified || isTerminal
                          ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                          : isDisqualified
                            ? "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300"
                            : stage?.flag === "NEW"
                              ? "border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300"
                              : "border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200",
                      )}
                    >
                      <span>{stage ? localizedName(stage, lang) : "—"}</span>
                      {!isTerminal && <ChevronDown className="size-3" aria-hidden="true" />}
                    </button>

                    {isStagePopoverOpen && (
                      <div className="absolute start-3 top-10 z-30 w-44 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl dark:border-slate-700 dark:bg-slate-900">
                        <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          {isAr ? "تغيير المرحلة فورياً" : "CHANGE STAGE INLINE"}
                        </div>
                        {nonTerminalStages.map((st) => {
                          const active = st.id === lead.stageId;
                          return (
                            <button
                              key={st.id}
                              type="button"
                              onClick={() => {
                                setOpenStageMenuLeadId(null);
                                if (!active) onMoveStage(lead, st.id);
                              }}
                              className={cn(
                                "flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-start text-xs font-semibold transition-colors",
                                active
                                  ? "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                                  : st.flag === "QUALIFIED"
                                    ? "text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400"
                                    : st.flag === "DISQUALIFIED"
                                      ? "text-red-600 hover:bg-red-50 dark:text-red-400"
                                      : "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800",
                              )}
                            >
                              <span>{localizedName(st, lang)}</span>
                              {active && <Check className="size-3.5 text-blue-600" aria-hidden="true" />}
                              {!active && st.flag === "QUALIFIED" && (
                                <Star className="size-3 fill-emerald-600 text-emerald-600" aria-hidden="true" />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </td>

                  {/* 7. Source */}
                  <td className="px-3 py-2.5">
                    {sourceLabel ? (
                      <span className="inline-flex rounded-md border border-slate-200 bg-slate-100/80 px-2 py-0.5 text-[11px] font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                        {sourceLabel}
                      </span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>

                  {/* 8. Salesperson (Inline Pill) */}
                  <td className="px-3 py-2.5">
                    <button
                      type="button"
                      onClick={() => onOpenQuickModal(lead)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-transparent px-1.5 py-0.5 hover:border-blue-200 hover:bg-blue-50/50 dark:hover:border-slate-700"
                    >
                      {ownerInitials && (
                        <span className="flex size-5 items-center justify-center rounded-md bg-blue-50 text-[10px] font-bold text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                          {ownerInitials}
                        </span>
                      )}
                      <span className="font-medium text-slate-700 dark:text-slate-200">
                        {ownerName}
                      </span>
                    </button>
                  </td>

                  {/* 9. Rating & Follow-up */}
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-0.5">
                        {[1, 2, 3].map((st) => {
                          const filled = st <= lead.rating;
                          return (
                            <button
                              key={st}
                              type="button"
                              disabled={!canUpdate(lead)}
                              onClick={() =>
                                onCardChange(
                                  lead.id,
                                  { rating: lead.rating === st ? 0 : st },
                                  lead,
                                )
                              }
                              aria-label={`Rate ${st} of 3`}
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
                        onClick={() => onOpenActivities(lead)}
                        className={cn(
                          "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-semibold",
                          activityState === "OVERDUE"
                            ? "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300"
                            : activityState === "TODAY"
                              ? "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300"
                              : activityState === "FUTURE"
                                ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300"
                                : "border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-400",
                        )}
                      >
                        <Activity className="size-3 shrink-0" aria-hidden="true" />
                        <span>{cardDict.activityStates[activityState]}</span>
                      </button>
                    </div>
                  </td>

                  {/* 10. Same-Page Actions (`[👁 Peek]` + `✏️` + `🗑`) */}
                  <td className="px-3 py-2.5 text-end">
                    <div className="inline-flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => onOpenQuickModal(lead)}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-bold text-slate-700 shadow-2xs transition-colors hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                      >
                        <Eye className="size-3.5" aria-hidden="true" />
                        <span>{isAr ? "معاينة" : "Peek"}</span>
                      </button>

                      {canUpdate(lead) && (
                        <button
                          type="button"
                          onClick={() => startPhoneEdit(lead, primaryPhone)}
                          title={isAr ? "تعديل الهاتف بالصف" : "Edit cell inline"}
                          aria-label={isAr ? "تعديل الهاتف بالصف" : "Edit cell inline"}
                          className="flex size-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                        >
                          <Pencil className="size-3.5" aria-hidden="true" />
                        </button>
                      )}

                      {canDelete(lead) && (
                        <button
                          type="button"
                          onClick={() => onDeleteLead(lead)}
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
              summary: (from, to, total) => formatTemplate(t.common.showingOf, { from, to, total }),
            }}
          />
        </div>
      )}
    </div>
  );
}
