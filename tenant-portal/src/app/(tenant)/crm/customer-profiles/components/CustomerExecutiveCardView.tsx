"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Activity,
  ArrowUpDown,
  Building2,
  CheckSquare,
  Download,
  Eye,
  FileCheck,
  FileSpreadsheet,
  FileText,
  Globe,
  Mail,
  Square,
  Target,
  User,
} from "lucide-react";
import {
  Pagination,
  cn,
  type CardColor,
  type MoveToTarget,
  type PageInfo,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { localizedValue } from "@/lib/format/localized";
import { formatTemplate } from "@/lib/format/template";
import {
  countryIsoFromName,
  getCountryOptions,
} from "@/lib/geo/country-data";
import { AcquisitionSourceIcon } from "../../shared/components/AcquisitionSourceIcon";
import { CrmRating } from "../../shared/components/CrmRating";
import {
  crmActivityState,
  type CrmActivityState,
} from "../../shared/crm-activity-tone";
import type {
  PartyDocumentCountVisibility,
  PartyDocumentCounts,
} from "../../shared/party-document-counts-contract";
import type { CustomerProfileCardPatch } from "../customer-profile-card-contract";
import { CUSTOMER_PROFILE_BOARD_STATUSES } from "../hooks/useCustomerProfileBoard";
import type {
  CustomerProfileItem,
  CustomerProfileStatus,
} from "../hooks/useCustomerProfiles";
import { CustomerPhoneActionsRow } from "./CustomerPhoneActionsRow";
import { getCustomerStatusVisual } from "./CustomerProfileStatusFunnelBar";
import {
  CustomerOwnerAvatar,
  CustomerProfileAvatar,
} from "./customer-card/CustomerProfileAvatar";
import { CustomerProfileCardMenu } from "./customer-card/CustomerProfileCardMenu";
import { CustomerProfileTagList } from "./customer-card/CustomerProfileTagList";

export interface CustomerExecutiveCardViewProps {
  items: readonly CustomerProfileItem[];
  selectedIds: ReadonlySet<string>;
  onSelectionChange: (next: Set<string>) => void;
  canUpdate: (item: CustomerProfileItem) => boolean;
  canDelete: (item: CustomerProfileItem) => boolean;
  onOpen: (item: CustomerProfileItem) => void;
  onOpenQuickModal?: (item: CustomerProfileItem) => void;
  onDelete?: (item: CustomerProfileItem) => void;
  onOpenActivities: (item: CustomerProfileItem) => void;
  onCardChange: (
    item: CustomerProfileItem,
    patch: CustomerProfileCardPatch,
  ) => void;
  onMoveStatus: (item: CustomerProfileItem, status: CustomerProfileStatus) => void;
  documentCountsByParty?: ReadonlyMap<string, PartyDocumentCounts>;
  documentCountVisibility?: PartyDocumentCountVisibility;
  page?: PageInfo;
  onPageChange?: (page: number) => void;
}

const CARD_COLOR_HEX: Record<CardColor, string> = {
  RED: "#ef4444",
  ORANGE: "#f97316",
  AMBER: "#f59e0b",
  YELLOW: "#eab308",
  GREEN: "#22c55e",
  TEAL: "#14b8a6",
  BLUE: "#3b82f6",
  INDIGO: "#6366f1",
  PURPLE: "#a855f7",
  PINK: "#ec4899",
  SLATE: "#64748b",
};

const ACTIVITY_PILL_STYLE: Record<
  CrmActivityState,
  { bg: string; text: string; dot: string }
> = {
  OVERDUE: {
    bg: "bg-red-500/12 border-red-500/30 hover:bg-red-500/20",
    text: "text-red-700 dark:text-red-300",
    dot: "bg-red-500",
  },
  TODAY: {
    bg: "bg-amber-500/12 border-amber-500/30 hover:bg-amber-500/20",
    text: "text-amber-700 dark:text-amber-300",
    dot: "bg-amber-500",
  },
  FUTURE: {
    bg: "bg-emerald-500/12 border-emerald-500/30 hover:bg-emerald-500/20",
    text: "text-emerald-700 dark:text-emerald-300",
    dot: "bg-emerald-500",
  },
  NONE: {
    bg: "bg-muted/60 border-border/70 hover:bg-muted",
    text: "text-muted-foreground",
    dot: "bg-slate-400",
  },
};

type QuickSortKey = "default" | "name_asc" | "rating_desc";

export function CustomerExecutiveCardView({
  items,
  selectedIds,
  onSelectionChange,
  canUpdate,
  canDelete,
  onOpen,
  onOpenQuickModal,
  onDelete,
  onOpenActivities,
  onCardChange,
  onMoveStatus,
  documentCountsByParty,
  documentCountVisibility,
  page,
  onPageChange,
}: CustomerExecutiveCardViewProps) {
  const { t, lang } = useI18n();
  const isAr = lang === "ar";
  const card = t.crmLeads.card;
  const statusLabels: Record<string, string | undefined> = t.statusValues;

  const [quickSort, setQuickSort] = useState<QuickSortKey>("default");
  const [localStatusFilter, setLocalStatusFilter] =
    useState<CustomerProfileStatus | null>(null);

  const countryFlags = useMemo(
    () =>
      new Map(
        getCountryOptions(lang).map(({ isoCode, flag }) => [isoCode, flag]),
      ),
    [lang],
  );

  const displayedItems = useMemo(() => {
    const filtered = localStatusFilter
      ? items.filter((item) => item.status === localStatusFilter)
      : [...items];

    if (quickSort === "name_asc") {
      return [...filtered].sort((a, b) =>
        a.displayName.localeCompare(b.displayName),
      );
    }
    if (quickSort === "rating_desc") {
      return [...filtered].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
    }
    return filtered;
  }, [items, localStatusFilter, quickSort]);

  const allSelected =
    displayedItems.length > 0 &&
    displayedItems.every((item) => selectedIds.has(item.id));

  const toggleSelectAll = () => {
    if (allSelected) {
      onSelectionChange(new Set());
    } else {
      onSelectionChange(new Set(displayedItems.map((item) => item.id)));
    }
  };

  const toggleSelectOne = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    onSelectionChange(next);
  };

  const handleExportCsv = () => {
    const rows =
      selectedIds.size > 0
        ? displayedItems.filter((item) => selectedIds.has(item.id))
        : displayedItems;
    const headers = [
      "Customer Name",
      "Profile Type",
      "Status",
      "Primary Contact",
      "Phone",
      "Email",
      "Country",
      "City",
      "Rating",
      "Salesperson",
    ];
    const csvLines = [
      headers.join(","),
      ...rows.map((item) => {
        const ownerName = item.owner
          ? [item.owner.firstName, item.owner.lastName].filter(Boolean).join(" ")
          : "";
        const phone =
          item.profileType === "CORPORATE"
            ? item.primaryContact?.phones[0] || item.phone
            : item.phone;
        return [
          item.displayName,
          item.profileType,
          item.status,
          item.primaryContactName ?? "",
          phone,
          item.email ?? "",
          item.country,
          item.city,
          String(item.rating ?? 0),
          ownerName,
        ]
          .map((val) => `"${String(val).replace(/"/g, '""')}"`)
          .join(",");
      }),
    ];
    const blob = new Blob(["\uFEFF" + csvLines.join("\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `customers-export-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col gap-3.5">
      {/* Top Batch & Sort Sub-Toolbar */}
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 rounded-xl border border-border/80 bg-card px-3.5 py-2 shadow-2xs">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={toggleSelectAll}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 py-1 text-xs font-semibold text-foreground transition-colors hover:bg-muted"
          >
            {allSelected ? (
              <CheckSquare className="size-3.5 text-blue-600 dark:text-blue-400" />
            ) : (
              <Square className="size-3.5 text-muted-foreground" />
            )}
            <span>
              {selectedIds.size > 0
                ? isAr
                  ? `${selectedIds.size} محدد`
                  : `${selectedIds.size} selected`
                : isAr
                  ? "تحديد الكل"
                  : "Select all"}
            </span>
          </button>

          {/* Quick Status Filter Pills */}
          <div className="hidden items-center gap-1 sm:flex">
            <button
              type="button"
              onClick={() => setLocalStatusFilter(null)}
              className={cn(
                "rounded-lg px-2 py-1 text-[11px] font-bold transition-colors",
                localStatusFilter === null
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {isAr ? "الكل" : "All"} ({items.length})
            </button>
            {CUSTOMER_PROFILE_BOARD_STATUSES.map((status) => {
              const count = items.filter((i) => i.status === status).length;
              const isSelected = localStatusFilter === status;
              const visual = getCustomerStatusVisual(status);
              return (
                <button
                  key={status}
                  type="button"
                  onClick={() =>
                    setLocalStatusFilter(isSelected ? null : status)
                  }
                  className={cn(
                    "inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-bold transition-colors",
                    isSelected
                      ? visual.badgeClass
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  <span
                    className={cn("size-1.5 rounded-full", visual.dotClass)}
                  />
                  <span>
                    {statusLabels[`CustomerStatus.${status}`] ?? status}
                  </span>
                  <span className="opacity-75">({count})</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: Quick Sort & Export CSV */}
        <div className="flex items-center gap-2">
          <div className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-2 py-1 text-xs">
            <ArrowUpDown className="size-3.5 text-muted-foreground" />
            <select
              value={quickSort}
              onChange={(e) => setQuickSort(e.target.value as QuickSortKey)}
              aria-label={isAr ? "ترتيب البطاقات" : "Sort cards"}
              className="bg-transparent text-xs font-semibold text-foreground focus:outline-none"
            >
              <option value="default">
                {isAr ? "الترتيب الافتراضي" : "Default Order"}
              </option>
              <option value="name_asc">
                {isAr ? "الاسم (أ - ي)" : "Name (A–Z)"}
              </option>
              <option value="rating_desc">
                {isAr ? "الأعلى تقييمًا (★)" : "Highest Rating (★)"}
              </option>
            </select>
          </div>

          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 py-1 text-xs font-semibold text-foreground transition-colors hover:bg-muted"
          >
            <Download className="size-3.5 text-muted-foreground" />
            <span>{isAr ? "تصدير CSV" : "Export CSV"}</span>
          </button>
        </div>
      </div>

      {/* 7-Layer Executive Bento Card Grid */}
      <div className="min-h-0 flex-1 overflow-y-auto pb-2">
        <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2 xl:grid-cols-3">
        {displayedItems.map((item) => {
          const isSelected = selectedIds.has(item.id);
          const isCorporate = item.profileType === "CORPORATE";
          const visual = getCustomerStatusVisual(item.status);
          const editable = canUpdate(item);
          const deletable = canDelete(item);

          const topAccentHex = item.cardColor
            ? CARD_COLOR_HEX[item.cardColor]
            : visual.accentHex;

          const primaryPhone = isCorporate
            ? item.primaryContact?.phones[0] || item.phone
            : item.phone;
          const contactEmail = isCorporate
            ? item.primaryContact?.email || item.email
            : item.email;

          const sourceName = localizedValue(
            item.acquisitionSourceNameAr,
            item.acquisitionSourceNameEn,
            lang,
          );
          const storedCountry = item.country.trim();
          const iso = /^[A-Z]{2}$/u.test(storedCountry.toUpperCase())
            ? storedCountry.toUpperCase()
            : countryIsoFromName(storedCountry);
          const flag = iso ? (countryFlags.get(iso) ?? "") : "";
          const locationText = [item.country, item.city]
            .filter(Boolean)
            .join(" · ");

          const activityState = crmActivityState(item.nextActivity);
          const activityPill = ACTIVITY_PILL_STYLE[activityState];
          const activityLabel = card.activityStates[activityState];

          const ownerName = item.owner
            ? [item.owner.firstName, item.owner.lastName]
                .filter(Boolean)
                .join(" ")
            : "";

          const counts = documentCountsByParty?.get(item.partyId);
          const moveTargets: MoveToTarget[] =
            CUSTOMER_PROFILE_BOARD_STATUSES.filter(
              (candidate) => candidate !== item.status,
            ).map((candidate) => ({
              id: candidate,
              label: statusLabels[`CustomerStatus.${candidate}`] ?? candidate,
            }));

          return (
            <article
              key={item.id}
              className={cn(
                "group relative flex flex-col justify-between overflow-hidden rounded-2xl border bg-card shadow-xs transition-all duration-150",
                "hover:-translate-y-0.5 hover:border-border hover:shadow-md",
                isSelected
                  ? "border-blue-500 ring-2 ring-blue-500/40 bg-blue-500/[0.02]"
                  : "border-border/80",
              )}
            >
              {/* Layer 1: Top 3.5px Color Bar */}
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 top-0 h-[3.5px]"
                style={{ backgroundColor: topAccentHex }}
              />

              <div className="flex flex-col gap-3 p-4 pt-4">
                {/* Layer 2: Header (Checkbox + Avatar + Name + Status Pill + Eye + Menu) */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 flex-1 items-start gap-2.5">
                    <button
                      type="button"
                      onClick={() => toggleSelectOne(item.id)}
                      aria-label={item.displayName}
                      className="mt-1 shrink-0 text-muted-foreground hover:text-foreground"
                    >
                      {isSelected ? (
                        <CheckSquare className="size-4 text-blue-600 dark:text-blue-400" />
                      ) : (
                        <Square className="size-4 opacity-60 group-hover:opacity-100" />
                      )}
                    </button>

                    <CustomerProfileAvatar
                      imageUrl={item.imageUrl}
                      displayName={item.displayName}
                      profileType={item.profileType}
                      className="size-10 shrink-0 ring-1 ring-border/70"
                    />

                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/crm/customer-profiles/${encodeURIComponent(item.id)}`}
                        className="block truncate text-sm font-extrabold text-foreground hover:text-blue-600 hover:underline dark:hover:text-blue-400"
                      >
                        {item.displayName}
                      </Link>
                      <p className="truncate text-xs font-medium text-muted-foreground">
                        {isCorporate
                          ? item.companyName &&
                            item.companyName !== item.displayName
                            ? item.companyName
                            : item.primaryContactName ||
                              t.crmCustomerProfiles.profileTypes.CORPORATE
                          : item.email ||
                            t.crmCustomerProfiles.profileTypes.INDIVIDUAL}
                      </p>
                    </div>
                  </div>

                  {/* Status Select Pill + Quick 360° Modal + Menu */}
                  <div className="flex shrink-0 items-center gap-1">
                    {editable ? (
                      <select
                        value={item.status}
                        aria-label={t.common.status}
                        onChange={(e) =>
                          onMoveStatus(
                            item,
                            e.target.value as CustomerProfileStatus,
                          )
                        }
                        className={cn(
                          "h-6 cursor-pointer rounded-full border px-2 text-[10px] font-extrabold focus:outline-none",
                          visual.badgeClass,
                        )}
                      >
                        {CUSTOMER_PROFILE_BOARD_STATUSES.map((status) => (
                          <option
                            key={status}
                            value={status}
                            className="bg-card text-foreground"
                          >
                            {statusLabels[`CustomerStatus.${status}`] ?? status}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-extrabold",
                          visual.badgeClass,
                        )}
                      >
                        {statusLabels[`CustomerStatus.${item.status}`] ??
                          item.status}
                      </span>
                    )}

                    {onOpenQuickModal && (
                      <button
                        type="button"
                        onClick={() => onOpenQuickModal(item)}
                        title={
                          isAr
                            ? "معاينة وتعديل سريع 360°"
                            : "Quick 360° Inspect & Edit"
                        }
                        aria-label={
                          isAr
                            ? "معاينة وتعديل سريع 360°"
                            : "Quick 360° Inspect & Edit"
                        }
                        className="inline-flex size-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-blue-500/10 hover:text-blue-600 dark:hover:text-blue-400"
                      >
                        <Eye className="size-4" />
                      </button>
                    )}

                    <CustomerProfileCardMenu
                      cardColor={item.cardColor}
                      onOpen={() => onOpen(item)}
                      onDelete={
                        deletable && onDelete
                          ? () => onDelete(item)
                          : undefined
                      }
                      moveTargets={editable ? moveTargets : undefined}
                      onMove={
                        editable
                          ? (status) =>
                              onMoveStatus(item, status as CustomerProfileStatus)
                          : undefined
                      }
                      onColorChange={
                        editable
                          ? (cardColor: CardColor | null) =>
                              onCardChange(item, { cardColor })
                          : undefined
                      }
                      labels={{
                        trigger: formatTemplate(card.more, {
                          name: item.displayName,
                        }),
                        open: card.open,
                        delete: t.common.delete,
                        moveTo: t.views.moveTo,
                        cardColor: card.cardColor,
                        colorNone: card.colorNone,
                        colorNames: card.colors,
                        selected: card.colorSelected,
                      }}
                    />
                  </div>
                </div>

                {/* Layer 3: Identity, Location & Source Badges */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-bold leading-none",
                      isCorporate
                        ? "border-blue-500/25 bg-blue-500/10 text-blue-700 dark:text-blue-300"
                        : "border-violet-500/25 bg-violet-500/10 text-violet-700 dark:text-violet-300",
                    )}
                  >
                    {isCorporate ? (
                      <Building2 className="size-3" />
                    ) : (
                      <User className="size-3" />
                    )}
                    {t.crmCustomerProfiles.profileTypes[item.profileType] ??
                      item.profileType}
                  </span>

                  {locationText && (
                    <span className="inline-flex items-center gap-1 rounded-md border border-border/70 bg-muted/50 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                      {flag && <span aria-hidden="true">{flag}</span>}
                      <span className="max-w-[160px] truncate">
                        {locationText}
                      </span>
                    </span>
                  )}

                  {sourceName && (
                    <span className="inline-flex items-center gap-1 rounded-md border border-border/70 bg-muted/50 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                      <AcquisitionSourceIcon
                        source={{ iconUrl: item.sourceIconUrl }}
                      />
                      <span className="max-w-[140px] truncate">
                        {sourceName}
                      </span>
                    </span>
                  )}
                </div>

                {/* Layer 4: Primary Contact & Instant Communication Channels Box */}
                <div className="flex flex-col gap-1.5 rounded-xl border border-border/70 bg-muted/35 p-2.5 text-xs">
                  {isCorporate && item.primaryContactName && (
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex min-w-0 items-center gap-1.5 font-bold text-foreground">
                        <User className="size-3.5 shrink-0 text-teal-600 dark:text-teal-400" />
                        <span className="truncate">
                          {item.primaryContactName}
                        </span>
                        <span className="rounded bg-teal-500/15 px-1.5 py-0.5 text-[9px] font-extrabold uppercase text-teal-700 dark:text-teal-300">
                          {card.primary}
                        </span>
                      </span>
                      {item.primaryContact?.jobTitle && (
                        <span className="max-w-[130px] truncate text-[11px] text-muted-foreground">
                          {item.primaryContact.jobTitle}
                        </span>
                      )}
                    </div>
                  )}

                  {primaryPhone ? (
                    <CustomerPhoneActionsRow
                      phone={primaryPhone}
                      country={item.country}
                    />
                  ) : (
                    <span className="text-[11px] text-muted-foreground">
                      {t.crmCustomerProfiles.unavailable}
                    </span>
                  )}

                  {(contactEmail || item.companyWebsite) && (
                    <div className="flex flex-wrap items-center gap-3 border-t border-border/50 pt-1.5 text-[11px]">
                      {contactEmail && (
                        <a
                          href={`mailto:${contactEmail}`}
                          dir="ltr"
                          className="inline-flex max-w-[180px] items-center gap-1 truncate text-blue-600 hover:underline dark:text-blue-400"
                        >
                          <Mail className="size-3 shrink-0" />
                          <span className="truncate">{contactEmail}</span>
                        </a>
                      )}
                      {item.companyWebsite && (
                        <a
                          href={item.companyWebsite}
                          target="_blank"
                          rel="noreferrer"
                          dir="ltr"
                          className="inline-flex max-w-[160px] items-center gap-1 truncate text-blue-600 hover:underline dark:text-blue-400"
                        >
                          <Globe className="size-3 shrink-0" />
                          <span className="truncate">
                            {item.companyWebsite.replace(/^https?:\/\//, "")}
                          </span>
                        </a>
                      )}
                    </div>
                  )}
                </div>

                {/* Layer 5: Tags Row */}
                {item.tags.length > 0 && (
                  <CustomerProfileTagList
                    tags={item.tags}
                    moreLabel={card.moreTags}
                    maxVisible={4}
                  />
                )}

                {/* Layer 6: 4-Cell Related Documents Strip (OPP | PQ | SO | INV) */}
                <div className="grid grid-cols-4 gap-1.5">
                  {[
                    {
                      code: "OPP",
                      label: isAr ? "الفرص" : "Opps",
                      value: counts?.opportunities ?? 0,
                      icon: Target,
                      visible: documentCountVisibility?.opportunities !== false,
                      tone: "border-blue-500/20 bg-blue-500/[0.06] text-blue-700 dark:text-blue-300",
                    },
                    {
                      code: "PQ",
                      label: isAr ? "عروض" : "Quotes",
                      value: counts?.quotations ?? 0,
                      icon: FileText,
                      visible: documentCountVisibility?.quotations !== false,
                      tone: "border-violet-500/20 bg-violet-500/[0.06] text-violet-700 dark:text-violet-300",
                    },
                    {
                      code: "SO",
                      label: isAr ? "أوامر" : "Orders",
                      value: counts?.salesOrders ?? 0,
                      icon: FileSpreadsheet,
                      visible: documentCountVisibility?.salesOrders !== false,
                      tone: "border-amber-500/20 bg-amber-500/[0.06] text-amber-700 dark:text-amber-300",
                    },
                    {
                      code: "INV",
                      label: isAr ? "فواتير" : "Invoices",
                      value: counts?.invoices ?? 0,
                      icon: FileCheck,
                      visible: documentCountVisibility?.invoices !== false,
                      tone: "border-emerald-500/20 bg-emerald-500/[0.06] text-emerald-700 dark:text-emerald-300",
                    },
                  ]
                    .filter((c) => c.visible)
                    .map((cell) => {
                      const CellIcon = cell.icon;
                      return (
                        <div
                          key={cell.code}
                          className={cn(
                            "flex items-center justify-between rounded-lg border px-2 py-1 text-[11px] font-bold tabular-nums",
                            cell.tone,
                          )}
                        >
                          <span className="inline-flex items-center gap-1 opacity-85">
                            <CellIcon className="size-3" />
                            <span>{cell.code}</span>
                          </span>
                          <span className="font-extrabold">{cell.value}</span>
                        </div>
                      );
                    })}
                </div>
              </div>

              {/* Layer 7: Card Footer (3-Star Rating + Activity Pill + Owner Badge) */}
              <div className="flex items-center justify-between gap-2 border-t border-border/70 bg-muted/25 px-4 py-2.5">
                <CrmRating
                  value={item.rating}
                  onChange={(rating) => onCardChange(item, { rating })}
                  disabled={!editable}
                  labels={{
                    group: card.rating,
                    setStars: card.rateStars,
                    clear: card.clearRating,
                  }}
                />

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onOpenActivities(item)}
                    title={formatTemplate(card.activityOpen, {
                      state: activityLabel,
                    })}
                    aria-label={formatTemplate(card.activityOpen, {
                      state: activityLabel,
                    })}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-bold transition-colors",
                      activityPill.bg,
                      activityPill.text,
                    )}
                  >
                    <span
                      className={cn("size-1.5 rounded-full", activityPill.dot)}
                    />
                    <Activity className="size-3" />
                    <span className="max-w-[95px] truncate">
                      {activityLabel}
                    </span>
                  </button>

                  {item.owner && (
                    <span
                      title={formatTemplate(card.owner, { name: ownerName })}
                      className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-card px-2 py-0.5 text-[11px] font-semibold text-foreground"
                    >
                      <CustomerOwnerAvatar
                        owner={item.owner}
                        className="size-4"
                      />
                      <span className="max-w-[85px] truncate">{ownerName}</span>
                    </span>
                  )}
                </div>
              </div>
            </article>
          );
        })}
        </div>
      </div>

      {/* Pagination Footer — Always pinned to the bottom of the page */}
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
