"use client";

import { escapeCsvCell } from "@/lib/export/csv-cell";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Activity,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Building2,
  Check,
  CheckSquare,
  ChevronDown,
  Download,
  Eye,
  Loader2,
  Mail,
  Pencil,
  Square,
  Trash2,
  User,
  X,
} from "lucide-react";
import {
  Button,
  Pagination,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  cn,
  useToast,
  type CardColor,
  type PageInfo,
  type SortState,
} from "@/design-system";
import { useTenantAuth } from "@/context/AuthContext";
import { useI18n } from "@/i18n/I18nContext";
import { axiosClient } from "@/lib/api/axiosClient";
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
import type { CustomerProfileCardPatch } from "../customer-profile-card-contract";
import { CUSTOMER_PROFILE_BOARD_STATUSES } from "../hooks/useCustomerProfileBoard";
import {
  customerProfilePath,
  type CustomerProfileItem,
  type CustomerProfileStatus,
} from "../hooks/useCustomerProfiles";
import { CustomerPhoneActionsRow } from "./CustomerPhoneActionsRow";
import { getCustomerStatusVisual } from "./CustomerProfileStatusFunnelBar";
import {
  CustomerOwnerAvatar,
  CustomerProfileAvatar,
} from "./customer-card/CustomerProfileAvatar";
import { CustomerProfileTagList } from "./customer-card/CustomerProfileTagList";

export interface CustomerExecutiveTableViewProps {
  items: readonly CustomerProfileItem[];
  selectedIds: ReadonlySet<string>;
  onSelectionChange: (next: Set<string>) => void;
  sort?: SortState;
  onSortChange?: (next: SortState) => void;
  canUpdate: (item: CustomerProfileItem) => boolean;
  canDelete: (item: CustomerProfileItem) => boolean;
  onOpen: (item: CustomerProfileItem) => void;
  onOpenQuickModal?: (item: CustomerProfileItem) => void;
  onDelete?: (item: CustomerProfileItem) => void;
  onOpenActivities?: (item: CustomerProfileItem) => void;
  onCardChange: (
    item: CustomerProfileItem,
    patch: CustomerProfileCardPatch,
  ) => void;
  onMoveStatus: (item: CustomerProfileItem, status: CustomerProfileStatus) => void;
  onRefresh?: () => void;
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
    bg: "bg-swatch-red-soft border-swatch-red hover:bg-swatch-red-soft/80",
    text: "text-swatch-red-deep",
    dot: "bg-swatch-red",
  },
  TODAY: {
    bg: "bg-swatch-amber-soft border-swatch-amber hover:bg-swatch-amber-soft/80",
    text: "text-swatch-amber-deep",
    dot: "bg-swatch-amber",
  },
  FUTURE: {
    bg: "bg-swatch-green-soft border-swatch-green hover:bg-swatch-green-soft/80",
    text: "text-swatch-green-deep",
    dot: "bg-swatch-green",
  },
  NONE: {
    bg: "bg-muted/60 border-border/70 hover:bg-muted",
    text: "text-muted-foreground",
    dot: "bg-swatch-slate",
  },
};

export function CustomerExecutiveTableView({
  items,
  selectedIds,
  onSelectionChange,
  sort,
  onSortChange,
  canUpdate,
  canDelete,
  onOpenQuickModal,
  onDelete,
  onOpenActivities,
  onCardChange,
  onMoveStatus,
  onRefresh,
  page,
  onPageChange,
}: CustomerExecutiveTableViewProps) {
  const { t, lang } = useI18n();
  const { user } = useTenantAuth();
  const canExport = user?.permissions.includes("crm.customer_profiles.export") ?? false;
  const toast = useToast();
  const card = t.crmLeads.card;
  const statusLabels: Record<string, string | undefined> = t.statusValues;

  const [localStatusFilter, setLocalStatusFilter] =
    useState<CustomerProfileStatus | null>(null);
  const [openStatusMenuId, setOpenStatusMenuId] = useState<string | null>(null);

  // Inline Phone Edit State
  const [editingPhoneId, setEditingPhoneId] = useState<string | null>(null);
  const [phoneDraft, setPhoneDraft] = useState("");
  const [savingPhoneId, setSavingPhoneId] = useState<string | null>(null);

  const countryFlags = useMemo(
    () =>
      new Map(
        getCountryOptions(lang).map(({ isoCode, flag }) => [isoCode, flag]),
      ),
    [lang],
  );

  const displayedItems = useMemo(
    () =>
      localStatusFilter
        ? items.filter((item) => item.status === localStatusFilter)
        : items,
    [items, localStatusFilter],
  );

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

  const toggleNameSort = () => {
    if (!onSortChange) return;
    if (sort?.id === "displayName") {
      onSortChange({
        id: "displayName",
        direction: sort.direction === "asc" ? "desc" : "asc",
      });
    } else {
      onSortChange({ id: "displayName", direction: "asc" });
    }
  };

  const handleSaveInlinePhone = async (item: CustomerProfileItem) => {
    const trimmed = phoneDraft.trim();
    if (!trimmed || savingPhoneId) return;
    setSavingPhoneId(item.id);
    try {
      const phones =
        item.phones.length > 0
          ? item.phones.map((phone, index) => (index === 0 ? trimmed : phone))
          : [trimmed];
      const body =
        item.profileType === "CORPORATE"
          ? { companyPhones: phones }
          : { primaryContact: { phones } };
      await axiosClient.patch(customerProfilePath(item.id), body, {
        nonReplayable: true,
        skipAutoIdempotency: true,
        cache: "no-store",
      });
      toast.success(t.common.save, item.displayName);
      setEditingPhoneId(null);
      onRefresh?.();
    } catch {
      toast.error(
        t.crmCustomerProfiles.cardUpdateFailed,
        item.displayName,
      );
    } finally {
      setSavingPhoneId(null);
    }
  };

  const exportRows = displayedItems.filter((item) => selectedIds.has(item.id));

  const handleExportCsv = () => {
    if (!canExport || exportRows.length === 0) return;
    const rows = exportRows;
    const csv = t.crmCustomerProfiles.csvExport;
    const headers = [
      csv.headers.name,
      csv.headers.profileType,
      csv.headers.status,
      csv.headers.primaryContact,
      csv.headers.phone,
      csv.headers.email,
      csv.headers.country,
      csv.headers.city,
      csv.headers.rating,
      csv.headers.salesperson,
    ];
    const csvLines = [
      headers.map(escapeCsvCell).join(","),
      ...rows.map((item) => {
        const ownerName = item.owner
          ? [item.owner.firstName, item.owner.lastName].filter(Boolean).join(" ")
          : "";
        const phone = item.phones[0] ?? item.phone;
        return [
          item.displayName,
          t.crmCustomerProfiles.profileTypes[item.profileType],
          statusLabels[`CustomerStatus.${item.status}`] ?? t.crmCustomerProfiles.unavailable,
          item.primaryContactName ?? "",
          phone,
          item.email ?? "",
          item.country,
          item.city,
          String(item.rating ?? 0),
          ownerName,
        ]
          .map((value) => escapeCsvCell(String(value ?? "")))
          .join(",");
      }),
    ];
    const blob = new Blob(["\uFEFF" + csvLines.join("\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `customers-table-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col gap-3">
      {/* Top Batch & Quick Status Sub-Toolbar */}
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 rounded-lg border border-border/80 bg-card px-3.5 py-2 shadow-2xs">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="xs"
            onClick={toggleSelectAll}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 py-1 text-xs font-semibold text-foreground transition-colors hover:bg-muted"
          >
            {allSelected ? (
              <CheckSquare className="size-3.5 text-primary" />
            ) : (
              <Square className="size-3.5 text-muted-foreground" />
            )}
            <span>
              {selectedIds.size > 0
                  ? t.crmCustomerProfiles.ui.table.selectedCount.replace(
                      "{count}",
                      String(selectedIds.size),
                    )
                  : t.crmCustomerProfiles.ui.table.selectAll}
            </span>
          </Button>

          <div className="hidden items-center gap-1 sm:flex">
            <Button
              type="button"
              variant="ghost"
              size="xs"
              onClick={() => setLocalStatusFilter(null)}
              className={cn(
                "rounded-lg px-2 py-1 text-xs font-semibold transition-colors",
                localStatusFilter === null
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {t.crmCustomerProfiles.ui.table.all} ({items.length})
            </Button>
            {CUSTOMER_PROFILE_BOARD_STATUSES.map((status) => {
              const count = items.filter((i) => i.status === status).length;
              const isSelected = localStatusFilter === status;
              const visual = getCustomerStatusVisual(status);
              return (
                <Button
                  key={status}
                  type="button"
                  variant="ghost"
                  size="xs"
                  onClick={() =>
                    setLocalStatusFilter(isSelected ? null : status)
                  }
                  className={cn(
                    "inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold transition-colors",
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
                </Button>
              );
            })}
          </div>
        </div>

        {canExport && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCsv}
            disabled={exportRows.length === 0}
            title={t.crmCustomerProfiles.csvExport.selectionHint}
          >
            <Download className="size-3.5" aria-hidden="true" />
            {formatTemplate(t.crmCustomerProfiles.csvExport.selected, {
              count: exportRows.length,
            })}
          </Button>
        )}
      </div>

      {/* High-Density 10-Column Spreadsheet Table */}
      <div className="min-h-0 overflow-auto rounded-lg border border-border/80 bg-card shadow-xs">
        <div className="overflow-x-auto">
          <Table className="w-full border-collapse text-start text-xs">
            <TableHeader>
              <TableRow className="border-b border-border/80 bg-muted/45 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <TableHead className="w-10 px-3 py-2.5 text-center">
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    onClick={toggleSelectAll}
                    aria-label={t.crmCustomerProfiles.ui.table.selectAll}
                    className="inline-flex size-5 items-center justify-center p-0 text-muted-foreground hover:bg-transparent hover:text-foreground"
                  >
                    {allSelected ? (
                      <CheckSquare className="size-3.5 text-primary" />
                    ) : (
                      <Square className="size-3.5" />
                    )}
                  </Button>
                </TableHead>
                <TableHead className="min-w-[230px] px-3 py-2.5 text-start">
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    onClick={toggleNameSort}
                    className="inline-flex h-auto items-center gap-1 p-0 font-semibold uppercase tracking-wider text-muted-foreground hover:bg-transparent hover:text-foreground"
                  >
                    <span>{t.crmCustomerProfiles.name}</span>
                    {sort?.id === "displayName" ? (
                      sort.direction === "asc" ? (
                        <ArrowUp className="size-3 text-primary" />
                      ) : (
                        <ArrowDown className="size-3 text-primary" />
                      )
                    ) : (
                      <ArrowUpDown className="size-3 opacity-50" />
                    )}
                  </Button>
                </TableHead>
                <TableHead className="min-w-[190px] px-3 py-2.5 text-start">
                  {t.crmCustomerProfiles.contact}
                </TableHead>
                <TableHead className="min-w-[195px] px-3 py-2.5 text-start">
                  {t.crmLeads.phone}
                </TableHead>
                <TableHead className="min-w-[125px] px-3 py-2.5 text-start">
                  {t.crmLeads.create.country}
                </TableHead>
                <TableHead className="min-w-[145px] px-3 py-2.5 text-start">
                  {t.common.status}
                </TableHead>
                <TableHead className="min-w-[95px] px-3 py-2.5 text-start">
                  {card.rating}
                </TableHead>
                <TableHead className="min-w-[130px] px-3 py-2.5 text-start">
                  {t.crmCustomerProfiles.source}
                </TableHead>
                <TableHead className="min-w-[140px] px-3 py-2.5 text-start">
                  {t.crmLeads.salesperson}
                </TableHead>
                <TableHead className="min-w-[175px] px-3 py-2.5 text-end">
                  {t.crmLeads.followUp} / {t.common.actions}
                </TableHead>
              </TableRow>
            </TableHeader>

            <TableBody className="divide-y divide-border/60">
              {displayedItems.map((item) => {
                const isSelected = selectedIds.has(item.id);
                const isCorporate = item.profileType === "CORPORATE";
                const editable = canUpdate(item);
                const deletable = canDelete(item);
                const visual = getCustomerStatusVisual(item.status);
                const StatusIcon = visual.icon;

                const primaryPhone = item.phones[0] ?? item.phone;
                const contactName = isCorporate
                  ? item.primaryContact?.displayName ||
                    item.primaryContactName ||
                    item.email ||
                    t.crmCustomerProfiles.unavailable
                  : item.email || t.crmCustomerProfiles.unavailable;
                const contactEmail = isCorporate
                  ? item.primaryContact?.email ?? ""
                  : item.email ?? "";
                const jobTitle = isCorporate
                  ? item.primaryContact?.jobTitle ?? ""
                  : "";

                const storedCountry = item.country.trim();
                const city = item.city.trim();
                const iso = /^[A-Z]{2}$/u.test(storedCountry.toUpperCase())
                  ? storedCountry.toUpperCase()
                  : countryIsoFromName(storedCountry);
                const flag = iso ? (countryFlags.get(iso) ?? "") : "";

                const sourceName = localizedValue(
                  item.acquisitionSourceNameAr,
                  item.acquisitionSourceNameEn,
                  lang,
                );
                const ownerName = item.owner
                  ? [item.owner.firstName, item.owner.lastName]
                      .filter(Boolean)
                      .join(" ")
                  : "";

                const activityState = crmActivityState(item.nextActivity);
                const activityPill = ACTIVITY_PILL_STYLE[activityState];
                const activityLabel = card.activityStates[activityState];

                return (
                  <TableRow
                    key={item.id}
                    className={cn(
                      "group transition-colors hover:bg-muted/40",
                      isSelected && "bg-swatch-blue-soft/30",
                    )}
                  >
                    {/* Col 1: Selection Checkbox + Card Color Indicator */}
                    <TableCell className="relative px-3 py-2.5 text-center">
                      {item.cardColor && (
                        <span
                          aria-hidden="true"
                          className="pointer-events-none absolute inset-y-0 start-0 w-[3px]"
                          style={{
                            backgroundColor: CARD_COLOR_HEX[item.cardColor],
                          }}
                        />
                      )}
                      <Button
                        type="button"
                        variant="ghost"
                        size="xs"
                        onClick={() => toggleSelectOne(item.id)}
                        aria-label={item.displayName}
                        className="inline-flex size-5 items-center justify-center p-0 text-muted-foreground hover:bg-transparent hover:text-foreground"
                      >
                        {isSelected ? (
                          <CheckSquare className="size-3.5 text-primary" />
                        ) : (
                          <Square className="size-3.5 opacity-60 group-hover:opacity-100" />
                        )}
                      </Button>
                    </TableCell>

                    {/* Col 2: Customer Name + Type Badge + Compact Tags */}
                    <TableCell className="px-3 py-2.5">
                      <div className="flex items-start gap-2">
                        <CustomerProfileAvatar
                          imageUrl={item.imageUrl}
                          displayName={item.displayName}
                          profileType={item.profileType}
                          className="mt-0.5 size-7 shrink-0"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <Link
                              href={`/crm/customer-profiles/${encodeURIComponent(item.id)}`}
                              className="truncate font-semibold text-foreground hover:text-primary hover:underline"
                            >
                              {item.displayName}
                            </Link>
                            <span
                              className={cn(
                                "inline-flex shrink-0 items-center gap-0.5 rounded border px-1 py-0.5 text-xs font-semibold leading-none",
                                isCorporate
                                  ? "border-swatch-blue bg-swatch-blue-soft text-swatch-blue-deep"
                                  : "border-swatch-purple bg-swatch-purple-soft text-swatch-purple-deep",
                              )}
                            >
                              {isCorporate ? (
                                <Building2 className="size-2.5" />
                              ) : (
                                <User className="size-2.5" />
                              )}
                              {t.crmCustomerProfiles.profileTypes[
                                item.profileType
                              ] ?? item.profileType}
                            </span>
                          </div>
                          {item.tags.length > 0 && (
                            <div className="mt-1">
                              <CustomerProfileTagList
                                tags={item.tags}
                                moreLabel={card.moreTags}
                                maxVisible={1}
                                compact
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    </TableCell>

                    {/* Col 3: Primary Contact */}
                    <TableCell className="px-3 py-2.5">
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-1">
                          <Link
                            href={`/crm/customer-profiles/${encodeURIComponent(item.id)}`}
                            className="max-w-[140px] truncate font-medium text-foreground hover:underline"
                          >
                            {contactName}
                          </Link>
                          {item.primaryContact?.isPrimary && (
                            <span className="rounded bg-swatch-blue-soft px-1 py-0.5 text-xs font-semibold text-swatch-blue-deep">
                              {card.primary}
                            </span>
                          )}
                        </div>
                        {(jobTitle || contactEmail) && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            {jobTitle && (
                              <span className="max-w-[90px] truncate">
                                {jobTitle}
                              </span>
                            )}
                            {jobTitle && contactEmail && <span>·</span>}
                            {contactEmail && (
                              <a
                                href={`mailto:${contactEmail}`}
                                dir="ltr"
                                className="inline-flex max-w-[110px] items-center gap-0.5 truncate text-primary hover:underline"
                              >
                                <Mail className="size-2.5 shrink-0" />
                                <span className="truncate">{contactEmail}</span>
                              </a>
                            )}
                          </div>
                        )}
                      </div>
                    </TableCell>

                    {/* Col 4: Phone & Instant Channels + Inline Phone Edit */}
                    <TableCell className="px-3 py-2.5">
                      {editingPhoneId === item.id ? (
                        <div className="flex items-center gap-1">
                          <input
                            type="tel"
                            dir="ltr"
                            value={phoneDraft}
                            onChange={(e) => setPhoneDraft(e.target.value)}
                            className="h-7 w-32 rounded border border-primary bg-background px-2 text-xs text-foreground focus:outline-none"
                          />
                          <Button
                            type="button"
                            size="xs"
                            disabled={savingPhoneId === item.id}
                            onClick={() => void handleSaveInlinePhone(item)}
                            className="inline-flex size-6 items-center justify-center rounded bg-primary text-primary-foreground hover:bg-primary/90"
                          >
                            {savingPhoneId === item.id ? (
                              <Loader2 className="size-3 animate-spin" />
                            ) : (
                              <Check className="size-3" />
                            )}
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="xs"
                            onClick={() => setEditingPhoneId(null)}
                            className="inline-flex size-6 items-center justify-center rounded text-muted-foreground hover:bg-muted"
                          >
                            <X className="size-3" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 whitespace-nowrap">
                          <Link
                            href={`/crm/customer-profiles/${encodeURIComponent(item.id)}`}
                            dir="ltr"
                            className="max-w-[115px] truncate font-mono font-medium tabular-nums text-foreground hover:underline"
                          >
                            {primaryPhone || t.crmCustomerProfiles.unavailable}
                          </Link>
                          {primaryPhone && (
                            <CustomerPhoneActionsRow
                              phone={primaryPhone}
                              country={item.country}
                              actionsOnly
                            />
                          )}
                          {editable && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="xs"
                              onClick={() => {
                                setEditingPhoneId(item.id);
                                setPhoneDraft(primaryPhone ?? "");
                              }}
                              title={t.crmTags.edit}
                              className="inline-flex size-5 items-center justify-center rounded p-0 text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground group-hover:opacity-100"
                            >
                              <Pencil className="size-2.5" />
                            </Button>
                          )}
                        </div>
                      )}
                    </TableCell>

                    {/* Col 5: Country & City */}
                    <TableCell className="px-3 py-2.5">
                      <div className="flex items-start gap-1.5">
                        {flag && (
                          <span
                            aria-hidden="true"
                            className="text-sm leading-none"
                          >
                            {flag}
                          </span>
                        )}
                        <div className="flex flex-col">
                          <span className="max-w-[110px] truncate font-medium text-foreground">
                            {storedCountry ||
                              city ||
                              t.crmCustomerProfiles.unavailable}
                          </span>
                          {storedCountry && city && (
                            <span className="max-w-[110px] truncate text-xs text-muted-foreground">
                              {city}
                            </span>
                          )}
                        </div>
                      </div>
                    </TableCell>

                    {/* Col 6: Status with Inline Popover Menu */}
                    <TableCell className="relative px-3 py-2.5">
                      {editable ? (
                        <div className="relative inline-block">
                          <Button
                            type="button"
                            variant="ghost"
                            size="xs"
                            onClick={() =>
                              setOpenStatusMenuId((cur) =>
                                cur === item.id ? null : item.id,
                              )
                            }
                            className={cn(
                              "inline-flex h-auto items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors",
                              visual.badgeClass,
                            )}
                          >
                            <StatusIcon className="size-3 shrink-0" />
                            <span>
                              {statusLabels[`CustomerStatus.${item.status}`] ??
                                item.status}
                            </span>
                            <ChevronDown className="size-2.5 opacity-75" />
                          </Button>

                          {openStatusMenuId === item.id && (
                            <div className="absolute start-0 top-full z-(--z-dropdown) mt-1 w-44 overflow-hidden rounded-lg border border-border bg-card p-1 shadow-xl">
                              {CUSTOMER_PROFILE_BOARD_STATUSES.map(
                                (candidate) => {
                                  const candVisual =
                                    getCustomerStatusVisual(candidate);
                                  const CandIcon = candVisual.icon;
                                  return (
                                    <Button
                                      key={candidate}
                                      type="button"
                                      variant="ghost"
                                      size="xs"
                                      onClick={() => {
                                        setOpenStatusMenuId(null);
                                        if (candidate !== item.status) {
                                          onMoveStatus(item, candidate);
                                        }
                                      }}
                                      className={cn(
                                        "flex w-full items-center justify-start gap-2 rounded-lg px-2 py-1.5 text-start text-xs font-semibold transition-colors hover:bg-muted",
                                        candidate === item.status &&
                                          "bg-muted/70",
                                      )}
                                    >
                                      <CandIcon
                                        className="size-3.5 shrink-0"
                                        style={{ color: candVisual.accentHex }}
                                      />
                                      <span className="truncate">
                                        {statusLabels[
                                          `CustomerStatus.${candidate}`
                                        ] ?? candidate}
                                      </span>
                                    </Button>
                                  );
                                },
                              )}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold",
                            visual.badgeClass,
                          )}
                        >
                          <StatusIcon className="size-3 shrink-0" />
                          <span>
                            {statusLabels[`CustomerStatus.${item.status}`] ??
                              item.status}
                          </span>
                        </span>
                      )}
                    </TableCell>

                    {/* Col 7: Rating */}
                    <TableCell className="px-3 py-2.5">
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
                    </TableCell>

                    {/* Col 8: Source */}
                    <TableCell className="px-3 py-2.5">
                      <div className="flex items-center gap-1.5 whitespace-nowrap">
                        <AcquisitionSourceIcon
                          source={{ iconUrl: item.sourceIconUrl }}
                        />
                        <span className="max-w-[115px] truncate text-foreground">
                          {sourceName || t.crmCustomerProfiles.unavailable}
                        </span>
                      </div>
                    </TableCell>

                    {/* Col 9: Salesperson */}
                    <TableCell className="px-3 py-2.5">
                      <div className="flex items-center gap-1.5">
                        {item.owner && (
                          <CustomerOwnerAvatar
                            owner={item.owner}
                            className="size-5 shrink-0"
                          />
                        )}
                        <span className="max-w-[115px] truncate text-foreground">
                          {ownerName || t.crmCustomerProfiles.unavailable}
                        </span>
                      </div>
                    </TableCell>

                    {/* Col 10: Follow-up & Quick Actions */}
                    <TableCell className="px-3 py-2.5 text-end">
                      <div className="flex items-center justify-end gap-1">
                {onOpenActivities && item.status !== "BLACKLISTED" && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    onClick={() => onOpenActivities(item)}
                    title={formatTemplate(card.activityOpen, {
                      state: activityLabel,
                    })}
                    aria-label={formatTemplate(card.activityOpen, {
                      state: activityLabel,
                    })}
                    className={cn(
                      "inline-flex h-auto items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold transition-colors",
                      activityPill.bg,
                      activityPill.text,
                    )}
                  >
                    <Activity className="size-2.5 shrink-0" />
                    <span className="max-w-[75px] truncate">
                      {activityLabel}
                    </span>
                  </Button>
                )}

                        {onOpenQuickModal && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="xs"
                            onClick={() => onOpenQuickModal(item)}
                            title={
                              t.crmCustomerProfiles.ui.table.quickInspect
                            }
                            aria-label={
                              t.crmCustomerProfiles.ui.table.quickInspect
                            }
                            className="inline-flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-swatch-blue-soft hover:text-swatch-blue-deep"
                          >
                            <Eye className="size-3.5" />
                          </Button>
                        )}

                        {deletable && onDelete && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="xs"
                            onClick={() => onDelete(item)}
                            aria-label={`${t.common.delete}: ${item.displayName}`}
                            title={t.common.delete}
                            className="inline-flex size-6 items-center justify-center rounded-md text-destructive/80 transition-colors hover:bg-destructive/10 hover:text-destructive"
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
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
