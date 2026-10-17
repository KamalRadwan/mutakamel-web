"use client";

import { useState } from "react";
import {
  Activity,
  Clock,
  ExternalLink,
  Eye,
  MessageCircle,
  Pencil,
  Phone,
  Send,
  Star,
  Target,
  UserRound,
} from "lucide-react";
import {
  EmptyState,
  ErrorState,
  Pagination,
  Skeleton,
  cn,
  type CardColor,
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
import type {
  LeadDocumentCounts,
} from "../lead-document-counts-contract";
import {
  normalizePhoneDigits,
  normalizeWhatsAppDigits,
} from "../lead-phone-links";
import type { LeadItem, LeadStage } from "../hooks/useLeads";
import { LeadCardMenu, type LeadCardMoveTarget } from "./lead-card/LeadCardMenu";

export interface LeadExecutiveCardViewProps {
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
  documentCountsByParty?: ReadonlyMap<string, LeadDocumentCounts>;
  onOpenLead: (lead: LeadItem) => void;
  onOpenQuickModal: (lead: LeadItem) => void;
  onOpenActivities: (lead: LeadItem) => void;
  onDeleteLead: (lead: LeadItem) => void;
  onMoveStage: (lead: LeadItem, stageId: string) => void;
  onCardChange: (leadId: string, patch: LeadCardPatch, lead: LeadItem) => void;
  onBulkMoveStage: (stageId: string) => Promise<void>;
}

function getLeadInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "LD";
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

function resolveCountryIso(country: string): string {
  const trimmed = country.trim();
  if (!trimmed) return "";
  if (/^[A-Z]{2}$/i.test(trimmed)) return trimmed.toUpperCase();
  return countryIsoFromName(trimmed) ?? trimmed.slice(0, 2).toUpperCase();
}

/**
 * Rich 7-Layer Executive Bento Card View matching Screen `05-card-view-grid.png`
 * pixel-for-pixel:
 * - Top batch & sort sub-toolbar (`N Selected | Move Stage | Assign Salesperson | Add/Remove Tags | Export Selected` + `Card Density: Detailed 360° | Sort by...`)
 * - 4-Column responsive Bento Grid of 7-Layer Executive Cards
 */
export function LeadExecutiveCardView({
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
  onOpenLead,
  onOpenQuickModal,
  onOpenActivities,
  onDeleteLead,
  onMoveStage,
  onCardChange,
  onBulkMoveStage,
}: LeadExecutiveCardViewProps) {
  const { t, lang } = useI18n();
  const isAr = lang === "ar";
  const cardDict = t.crmLeads.card;
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [bulkStageValue, setBulkStageValue] = useState("");

  if (!branchId) {
    return <EmptyState title={t.crmLeads.selectBranchFirst} />;
  }

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, idx) => (
          <Skeleton key={`card-bento-skel-${idx}`} className="h-80 rounded-xl" />
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

  function toggleOne(id: string) {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onSelectionChange(next);
  }

  function exportCsv() {
    const rowsToExport =
      selectedIds.size > 0 ? items.filter((i) => selectedIds.has(i.id)) : items;
    const header = ["ID", "Name", "Type", "Phone", "Email", "Country", "Rating"];
    const csvLines = [
      header.join(","),
      ...rowsToExport.map((r) =>
        [
          r.id,
          `"${(r.leadName || "").replace(/"/g, '""')}"`,
          r.leadProfileType,
          `"${r.phone || ""}"`,
          `"${r.email || ""}"`,
          `"${r.country || ""}"`,
          r.rating,
        ].join(","),
      ),
    ];
    const blob = new Blob([csvLines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "mutakamel-crm-leads.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      {/* Screen 05: Sub-Toolbar Bar (Selection + Batch Controls + Sort & Density) */}
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
            {nonTerminalStages.map((st) => (
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
            {isAr ? "إضافة / إزالة وسوم ▾" : "Add / Remove Tags ▾"}
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
            <option value="displayName:asc">
              {isAr ? "الاسم (أ - ي)" : "Name (A → Z)"}
            </option>
          </select>
          <span className="text-[11px] font-medium tabular-nums text-slate-400">
            {isAr
              ? `عرض 1–${items.length} من ${page?.total ?? items.length}`
              : `Showing 1–${items.length} of ${page?.total ?? items.length} leads`}
          </span>
        </div>
      </div>

      {/* 4-Column Rich 360° Bento Card Grid (Screen 05) */}
      <div className="min-h-0 flex-1 overflow-y-auto pb-2">
        <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2 xl:grid-cols-4">
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
            const cityOrCountry = [lead.country, lead.city].filter(Boolean).join(" · ");
            const legalIdentityText = lead.taxNumber
              ? `Tax: ${lead.taxNumber}`
              : lead.commercialRegistrationNumber
                ? `CR: ${lead.commercialRegistrationNumber}`
                : "";

            const primaryPhone =
              (isCompany ? lead.primaryContact?.phones[0] || lead.phone : lead.phone) ||
              lead.phones[0] ||
              "";
            const primaryEmail =
              (isCompany ? lead.primaryContact?.email || lead.email : lead.email) || "";

            const callDigits = primaryPhone ? normalizePhoneDigits(primaryPhone) : "";
            const waDigits = primaryPhone ? normalizeWhatsAppDigits(primaryPhone, lead.country) : null;
            const tgDigits = waDigits;

            const counts = documentCountsByParty?.get(lead.partyId);
            const activityState = leadActivityState(lead.nextActivity);
            const ownerInitials = lead.owner ? leadOwnerInitials(lead.owner) : "";
            const ownerName = lead.owner
              ? `${lead.owner.firstName} ${lead.owner.lastName ? `${lead.owner.lastName[0]}.` : ""}`.trim()
              : "";

            const moveTargets: LeadCardMoveTarget[] = nonTerminalStages
              .filter((s) => s.id !== lead.stageId)
              .map((s) => ({ id: s.id, label: localizedName(s, lang) }));

            const needSnippet =
              lead.interestSummary ||
              lead.expectedNeed ||
              lead.description ||
              "";

            const targetLine = lead.expectedNeed || "";

            return (
              <div
                key={lead.id}
                className={cn(
                  "flex flex-col justify-between gap-3 rounded-xl border-2 bg-white p-3.5 shadow-2xs transition-all hover:shadow-md dark:bg-slate-900",
                  isSelected
                    ? "border-blue-600 ring-2 ring-blue-500/15"
                    : "border-slate-200/90 hover:border-blue-300 dark:border-slate-800",
                )}
              >
                <div className="flex flex-col gap-2.5">
                  {/* LAYER 1: Checkbox + Initials Avatar + Name & Tax/Geo Subtitle + Stage Select + Quick Edit + Open + Menu */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-start gap-2">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleOne(lead.id)}
                        aria-label={`Select ${title}`}
                        className="mt-1.5 size-4 shrink-0 rounded-xs border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-blue-200 bg-blue-50 text-xs font-bold text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300">
                        {getLeadInitials(title)}
                      </span>
                      <div className="min-w-0">
                        <button
                          type="button"
                          onClick={() => onOpenLead(lead)}
                          className="block max-w-full truncate text-start text-sm font-bold text-slate-900 hover:text-blue-600 dark:text-slate-100 dark:hover:text-blue-400"
                        >
                          {title}
                        </button>
                        {(countryIso || cityOrCountry || legalIdentityText) && (
                          <p className="truncate text-[11px] text-slate-400 dark:text-slate-500">
                            {countryIso && (
                              <span className="font-semibold text-slate-500">{countryIso} </span>
                            )}
                            {[cityOrCountry, legalIdentityText].filter(Boolean).join(" · ")}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-1">
                      {/* Inline Stage Pill Select */}
                      {canUpdate(lead) && !isTerminal ? (
                        <select
                          value={lead.stageId}
                          onChange={(e) => onMoveStage(lead, e.target.value)}
                          aria-label={`Stage for ${title}`}
                          className={cn(
                            "h-6 max-w-24 truncate rounded-md border px-1.5 text-[11px] font-bold",
                            isQualified
                              ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                              : isDisqualified
                                ? "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300"
                                : "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300",
                          )}
                        >
                          {nonTerminalStages.map((st) => (
                            <option key={st.id} value={st.id}>
                              {localizedName(st, lang)}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span
                          className={cn(
                            "rounded-md border px-2 py-0.5 text-[11px] font-bold",
                            isTerminal || isQualified
                              ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                              : "border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300",
                          )}
                        >
                          {stage ? localizedName(stage, lang) : "—"}
                        </span>
                      )}

                      <button
                        type="button"
                        onClick={() => onOpenQuickModal(lead)}
                        title={isAr ? "معاينة وتعديل سريع 360°" : "Open 360° Quick-Edit Modal"}
                        aria-label={isAr ? "معاينة وتعديل سريع 360°" : "Open 360° Quick-Edit Modal"}
                        className="flex size-6 items-center justify-center rounded-md border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:border-indigo-800 dark:bg-indigo-950 dark:text-indigo-300"
                      >
                        <Eye className="size-3.5" aria-hidden="true" />
                      </button>

                      <button
                        type="button"
                        onClick={() => onOpenLead(lead)}
                        title={isAr ? "فتح الصفحة الكاملة" : "Open Full Standalone Page"}
                        aria-label={isAr ? "فتح الصفحة الكاملة" : "Open Full Standalone Page"}
                        className="flex size-6 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"
                      >
                        <ExternalLink className="size-3" aria-hidden="true" />
                      </button>

                      <LeadCardMenu
                        cardColor={lead.cardColor}
                        onOpen={() => onOpenLead(lead)}
                        onDelete={canDelete(lead) ? () => onDeleteLead(lead) : undefined}
                        onColorChange={
                          canUpdate(lead)
                            ? (next: CardColor | null) =>
                                onCardChange(lead.id, { cardColor: next }, lead)
                            : undefined
                        }
                        moveTargets={moveTargets}
                        onMove={(stageId) => onMoveStage(lead, stageId)}
                        labels={{
                          trigger: formatTemplate(cardDict.more, { name: lead.leadName }),
                          open: cardDict.open,
                          delete: t.common.delete,
                          moveTo: t.views.moveTo,
                          cardColor: cardDict.cardColor,
                          colorNone: cardDict.colorNone,
                          colorNames: cardDict.colors,
                          selected: cardDict.colorSelected,
                        }}
                      />
                    </div>
                  </div>

                  {/* LAYER 2: Identity & Metadata Pills Row (Corporate/Individual + Source + CR + Stage Age) */}
                  <div className="flex flex-wrap items-center justify-between gap-1.5">
                    <div className="flex flex-wrap items-center gap-1">
                      <span
                        className={cn(
                          "rounded-md border px-2 py-0.5 text-[11px] font-semibold",
                          isCompany
                            ? "border-blue-200 bg-blue-50/80 text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300"
                            : "border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300",
                        )}
                      >
                        {isCompany
                          ? isAr
                            ? "مؤسسة"
                            : "Corporate"
                          : isAr
                            ? "فرد"
                            : "Individual"}
                      </span>

                      {sourceLabel && (
                        <span className="inline-flex items-center gap-1 rounded-md border border-blue-100 bg-blue-50/50 px-2 py-0.5 text-[11px] font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                          <Phone className="size-2.5 text-rose-500" aria-hidden="true" />
                          <span className="max-w-28 truncate">{sourceLabel}</span>
                        </span>
                      )}

                      <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 font-mono text-[10px] font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
                        {lead.commercialRegistrationNumber
                          ? lead.commercialRegistrationNumber
                          : isCompany
                            ? "B2B Account"
                            : "Direct B2C"}
                      </span>
                    </div>

                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-400">
                      <Clock className="size-3" aria-hidden="true" />
                      <span>{formatStageAgeBadge(lead.updatedAt ?? lead.createdAt, isAr)}</span>
                    </span>
                  </div>

                  {/* LAYER 3: Primary Contact & Instant Channels Box */}
                  <div className="flex flex-col gap-1.5 rounded-xl border border-slate-200/80 bg-slate-50/80 p-2.5 dark:border-slate-800 dark:bg-slate-800/40">
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex min-w-0 items-center gap-1 text-xs">
                        <UserRound className="size-3.5 shrink-0 text-slate-500" aria-hidden="true" />
                        <strong className="truncate font-bold text-slate-800 dark:text-slate-100">
                          {contactName || title}
                        </strong>
                        <span className="truncate text-slate-400">
                          ·{" "}
                          {lead.primaryContact?.jobTitle ||
                            (isCompany
                              ? isAr
                                ? "مسؤول التواصل"
                                : "Primary Contact"
                              : isAr
                                ? "عميل مباشر"
                                : "Direct Prospect")}
                        </span>
                      </span>

                      <span className="shrink-0 rounded-md border border-blue-200 bg-blue-50 px-1.5 py-0.5 text-[10px] font-bold text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300">
                        {lead.contactsCount && lead.contactsCount > 1
                          ? `+${lead.contactsCount - 1} Contacts`
                          : isCompany
                            ? cardDict.primary
                            : "Solo Decision"}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500">
                      <span className="truncate">
                        {primaryEmail || (isAr ? "لا يوجد بريد مسجل" : "No email recorded")}
                      </span>
                      {primaryEmail && (
                        <button
                          type="button"
                          onClick={() => {
                            void navigator.clipboard?.writeText(primaryEmail);
                            setCopiedId(lead.id);
                            setTimeout(() => setCopiedId(null), 1500);
                          }}
                          className="shrink-0 font-semibold text-blue-600 hover:underline dark:text-blue-400"
                        >
                          {copiedId === lead.id ? (isAr ? "تم النسخ ✓" : "Copied ✓") : "Copy"}
                        </button>
                      )}
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-0.5">
                      {primaryPhone ? (
                        <span
                          dir="ltr"
                          className="truncate font-mono text-xs font-bold text-slate-900 dark:text-slate-100"
                        >
                          {primaryPhone}
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onOpenQuickModal(lead)}
                          className="text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
                        >
                          {isAr ? "+ إضافة رقم هاتف" : "+ Add phone number"}
                        </button>
                      )}

                      <div className="flex shrink-0 items-center gap-1">
                        {callDigits ? (
                          <a
                            href={`tel:${callDigits}`}
                            aria-label={`Call ${primaryPhone}`}
                            className="flex size-6 items-center justify-center rounded-md border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                          >
                            <Phone className="size-3" aria-hidden="true" />
                          </a>
                        ) : (
                          <span className="flex size-6 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-300 dark:border-slate-700 dark:bg-slate-800">
                            <Phone className="size-3" aria-hidden="true" />
                          </span>
                        )}

                        {waDigits ? (
                          <a
                            href={`https://wa.me/${waDigits}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label={`WhatsApp ${primaryPhone}`}
                            className="flex size-6 items-center justify-center rounded-md border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                          >
                            <MessageCircle className="size-3" aria-hidden="true" />
                          </a>
                        ) : (
                          <span className="flex size-6 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-300 dark:border-slate-700 dark:bg-slate-800">
                            <MessageCircle className="size-3" aria-hidden="true" />
                          </span>
                        )}

                        {tgDigits ? (
                          <a
                            href={`https://t.me/+${tgDigits}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label={`Telegram ${primaryPhone}`}
                            className="flex size-6 items-center justify-center rounded-md border border-sky-200 bg-sky-50 text-sky-600 hover:bg-sky-100 dark:border-sky-800 dark:bg-sky-950 dark:text-sky-300"
                          >
                            <Send className="size-3" aria-hidden="true" />
                          </a>
                        ) : (
                          <span className="flex size-6 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-300 dark:border-slate-700 dark:bg-slate-800">
                            <Send className="size-3" aria-hidden="true" />
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* LAYER 4: Need Summary & Target Strip (`border-s-2 border-s-blue-600`) */}
                  {(needSnippet || targetLine) && (
                    <div className="flex flex-col gap-1 border-s-2 border-s-blue-600 ps-2.5">
                      {needSnippet && (
                        <p className="line-clamp-2 text-xs font-medium leading-snug text-slate-700 dark:text-slate-300">
                          {needSnippet}
                        </p>
                      )}
                      {targetLine && (
                        <div className="flex items-center justify-between gap-2 text-[11px] font-bold text-blue-600 dark:text-blue-400">
                          <span className="flex min-w-0 items-center gap-1 truncate">
                            <Target className="size-3 shrink-0 text-rose-500" aria-hidden="true" />
                            <span className="truncate">{targetLine}</span>
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* LAYER 5: Tenant Tags Row + `+ Tag` */}
                  <div className="flex items-center justify-between gap-1.5">
                    <div className="flex min-w-0 flex-wrap items-center gap-1">
                      {lead.tags.length > 0 ? (
                        lead.tags.slice(0, 3).map((tag) => (
                          <span
                            key={tag.id}
                            style={
                              tag.backgroundColor
                                ? {
                                    backgroundColor: tag.backgroundColor,
                                    color: tag.textColor ?? "#0f172a",
                                  }
                                : undefined
                            }
                            className={cn(
                              "inline-flex max-w-28 items-center truncate rounded-md px-2 py-0.5 text-[11px] font-semibold",
                              !tag.backgroundColor &&
                                "border border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
                            )}
                          >
                            {tag.name}
                          </span>
                        ))
                      ) : (
                        <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-500 dark:border-slate-800 dark:bg-slate-800/60">
                          {isAr ? "بدون وسوم" : "Untagged"}
                        </span>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => onOpenQuickModal(lead)}
                      className="shrink-0 text-[11px] font-bold text-blue-600 hover:underline dark:text-blue-400"
                    >
                      + Tag
                    </button>
                  </div>
                </div>

                <div className="flex flex-col gap-2.5 pt-1">
                  {/* LAYER 6: 4-Cell Trade & Commercial Counters Strip (OPP | PQ | SO | INV) */}
                  <div className="grid grid-cols-4 gap-1.5">
                    {[
                      { code: "OPP", val: counts?.opportunities ?? 0 },
                      { code: "PQ", val: counts?.quotations ?? 0 },
                      { code: "SO", val: counts?.salesOrders ?? 0 },
                      { code: "INV", val: counts?.invoices ?? 0 },
                    ].map((cell) => (
                      <div
                        key={cell.code}
                        className="flex items-center justify-between rounded-lg border border-slate-200/90 bg-slate-50/70 px-2 py-1 text-[11px] dark:border-slate-800 dark:bg-slate-800/40"
                      >
                        <span className="font-bold text-slate-500 dark:text-slate-400">
                          {cell.code}
                        </span>
                        <span className="font-bold tabular-nums text-blue-600 dark:text-blue-400">
                          {cell.val}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* LAYER 7: Footer Strip (3 Stars + Activity Badge + Owner Initials & Name) */}
                  <div className="flex items-center justify-between gap-2 border-t border-slate-100 pt-2 dark:border-slate-800">
                    <div className="flex min-w-0 items-center gap-2">
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
                        <span className="max-w-28 truncate">
                          {cardDict.activityStates[activityState]}
                        </span>
                      </button>
                    </div>

                    {ownerInitials && (
                      <div className="flex shrink-0 items-center gap-1.5">
                        <span className="flex size-5 items-center justify-center rounded-md border border-blue-200 bg-blue-50 text-[10px] font-bold text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300">
                          {ownerInitials}
                        </span>
                        <span className="max-w-20 truncate text-[11px] font-medium text-slate-600 dark:text-slate-400">
                          {ownerName}
                        </span>
                      </div>
                    )}
                  </div>
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
              summary: (from, to, total) => formatTemplate(t.common.showingOf, { from, to, total }),
            }}
          />
        </div>
      )}
    </div>
  );
}
