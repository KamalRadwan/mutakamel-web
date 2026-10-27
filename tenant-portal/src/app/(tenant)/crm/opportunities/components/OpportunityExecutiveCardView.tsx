"use client";

import { useState } from "react";
import { escapeCsvCell } from "@/lib/export/csv-cell";
import Link from "next/link";
import {
  Activity,
  Banknote,
  Building2,
  Calendar,
  CirclePercent,
  Clock,
  ExternalLink,
  Mail,
  Star,
  UserRound,
} from "lucide-react";
import {
  Button,
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
import type { Dictionary } from "@/i18n/dictionaries/ar";
import type { Language } from "@/i18n/useLanguage";
import { useAccessMode } from "@/hooks/useAccessMode";
import { useTenantAuth } from "@/context/AuthContext";
import { localizedName } from "@/lib/format/localized";
import { formatNumber } from "@/lib/format/number";
import { formatTemplate } from "@/lib/format/template";
import { countryIsoFromName } from "@/lib/geo/country-data";
import { OpportunityPhoneActions } from "./OpportunityQuickEditModal";
import { AcquisitionSourceIcon } from "../../shared/components/AcquisitionSourceIcon";
import type { CrmActivityState } from "../../shared/crm-activity-tone";
import { buildPartyDocumentHref } from "../../shared/party-document-counts-contract";
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
  RED: "border-s-4 border-s-swatch-red",
  ORANGE: "border-s-4 border-s-swatch-amber",
  AMBER: "border-s-4 border-s-swatch-amber",
  YELLOW: "border-s-4 border-s-swatch-yellow",
  GREEN: "border-s-4 border-s-swatch-green",
  TEAL: "border-s-4 border-s-swatch-teal",
  BLUE: "border-s-4 border-s-swatch-blue",
  INDIGO: "border-s-4 border-s-swatch-indigo",
  PURPLE: "border-s-4 border-s-swatch-purple",
  PINK: "border-s-4 border-s-swatch-pink",
  SLATE: "border-s-4 border-s-swatch-slate",
};

function getInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "OP";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0] ?? ""}${words[1][0] ?? ""}`.toUpperCase();
}

function formatStageAgeBadge(isoDate: string | undefined, labels: Dictionary["crmOpportunities"], lang: Language): string {
  if (!isoDate) return labels.justNow;
  const time = new Date(isoDate).getTime();
  if (Number.isNaN(time)) return labels.inStage;
  const diffMins = Math.max(1, Math.floor((Date.now() - time) / (1000 * 60)));
  if (diffMins < 60) return formatTemplate(labels.minutesInStage, { count: formatNumber(diffMins, lang) });
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return formatTemplate(labels.hoursInStage, { count: formatNumber(diffHours, lang) });
  const diffDays = Math.floor(diffHours / 24);
  return formatTemplate(labels.daysInStage, { count: formatNumber(diffDays, lang) });
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
  canUpdate: canUpdateByScope,
  canDelete: canDeleteByScope,
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
  onDeleteOpportunity,
  onMoveStage,
  onCardChange,
  onBulkMoveStage,
}: OpportunityExecutiveCardViewProps) {
  const { t, lang } = useI18n();
  const { canMutate } = useAccessMode();
  const canUpdate = (item: OpportunityListItem) => canMutate && canUpdateByScope(item);
  const canDelete = (item: OpportunityListItem) => canMutate && canDeleteByScope(item);
  const { user } = useTenantAuth();
  const canExport = user?.permissions.includes("crm.opportunities.export") ?? false;
  const cardDict = t.crmLeads.card;
  const [bulkStageValue, setBulkStageValue] = useState("");
  const canUpdateAny = items.some((item) => selectedIds.has(item.id) && canUpdate(item));

  if (!branchId) {
    return <EmptyState title={t.crmOpportunities.selectBranchFirst} />;
  }

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, idx) => (
          <Skeleton key={`opp-card-skel-${idx}`} className="h-80 rounded-lg" />
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
    if (!canExport) return;
    const rowsToExport = items.filter((item) => selectedIds.has(item.id));
    if (rowsToExport.length === 0) return;
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
      header.map(escapeCsvCell).join(","),
      ...rowsToExport.map((r) =>
        [
          r.id,
          r.title,
          r.customerCompanyName || r.customerDisplayName || "",
          r.status,
          r.amount ?? "",
          r.currencyCode ?? "",
          r.probabilityPercent ?? "",
          r.expectedCloseDate ?? "",
          r.importance,
        ].map(escapeCsvCell).join(","),
      ),
    ];
    const blob = new Blob(["\uFEFF", csvLines.join("\r\n")], {
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
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-card px-3.5 py-2 shadow-2xs">
        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-semibold text-foreground">
            <input
              type="checkbox"
              checked={isAllSelected}
              onChange={toggleSelectAll}
              className="size-4 rounded-xs border-input text-primary focus:ring-ring"
            />
            <span>
              {selectedIds.size > 0
                ? formatTemplate(t.crmOpportunities.selectedCount, { count: formatNumber(selectedIds.size, lang) })
                : t.crmOpportunities.selectAll}
            </span>
          </label>

          {/* Move Stage Dropdown */}
          {canMutate && (
            <select
              value={bulkStageValue}
              disabled={!canUpdateAny}
              aria-label={t.crmOpportunities.bulkMoveStage}
              onChange={(e) => {
                const target = e.target.value;
                setBulkStageValue("");
                if (target && canUpdateAny) void onBulkMoveStage(target);
              }}
              className="h-7 rounded-lg border border-primary/30 bg-primary-subtle px-2.5 text-xs font-semibold text-primary-subtle-foreground disabled:cursor-not-allowed disabled:border-border disabled:bg-muted disabled:text-muted-foreground"
            >
              <option value="">{t.crmOpportunities.moveStage}</option>
              {nonLostStages.map((st) => (
                <option key={st.id} value={st.id}>
                  {localizedName(st, lang)}
                </option>
              ))}
            </select>
          )}

          {canExport && (
            <Button
              type="button"
              variant="outline"
              size="xs"
              disabled={!items.some((item) => selectedIds.has(item.id))}
              onClick={exportCsv}
              className="h-7 rounded-lg border border-border bg-card px-2.5 text-xs font-semibold text-foreground hover:bg-muted/50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {t.crmOpportunities.exportSelectedOnPage}
            </Button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>
            <strong className="font-semibold text-foreground">
              {t.crmOpportunities.detailedCards}
            </strong>
          </span>
          <span className="text-border">|</span>
          <span>{t.crmOpportunities.sortBy}</span>
          <select
            value={`${sort?.id ?? "createdAt"}:${sort?.direction ?? "desc"}`}
            onChange={(e) => {
              const [id, dir] = e.target.value.split(":");
              onSortChange?.({
                id: id || "createdAt",
                direction: dir === "asc" ? "asc" : "desc",
              });
            }}
            className="h-7 rounded-lg border border-border bg-card px-2 text-xs font-semibold text-foreground"
          >
            <option value="createdAt:desc">
              {t.crmOpportunities.sortNewest}
            </option>
            <option value="createdAt:asc">
              {t.crmOpportunities.sortOldest}
            </option>
            <option value="amount:desc">
              {t.crmOpportunities.sortValue}
            </option>
            <option value="probabilityPercent:desc">
              {t.crmOpportunities.sortProbability}
            </option>
            <option value="expectedCloseDate:asc">
              {t.crmOpportunities.sortCloseDate}
            </option>
            <option value="title:asc">
              {t.crmOpportunities.sortTitle}
            </option>
          </select>
          <span className="text-2xs font-medium tabular-nums text-muted-foreground">
            {formatTemplate(t.crmOpportunities.showingRange, {
              from: formatNumber(items.length ? (page ? (page.page - 1) * page.limit + 1 : 1) : 0, lang),
              to: formatNumber((page ? (page.page - 1) * page.limit : 0) + items.length, lang),
              total: formatNumber(page?.total ?? items.length, lang),
            })}
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
                  "flex flex-col justify-between gap-3 rounded-lg border-2 bg-card p-3.5 shadow-2xs transition-all hover:shadow-md",
                  item.cardColor ? CARD_BORDER_ACCENT[item.cardColor] : "",
                  isSelected
                    ? "border-primary ring-2 ring-primary/15"
                    : "border-border hover:border-primary/40",
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
                        className="mt-1.5 size-4 shrink-0 rounded-xs border-input text-primary focus:ring-ring"
                      />
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-primary/30 bg-primary-subtle text-xs font-semibold text-primary-subtle-foreground">
                        {getInitials(item.title)}
                      </span>
                      <div className="min-w-0">
                        <Button
                          type="button"
                          variant="ghost"
                          size="xs"
                          onClick={() => onOpenOpportunity(item)}
                          className="block h-auto max-w-full truncate p-0 text-start text-sm font-semibold text-foreground hover:bg-transparent hover:text-primary"
                        >
                          {item.title}
                        </Button>
                        <p className="truncate text-2xs text-muted-foreground">
                          {countryIso && (
                            <span className="font-semibold text-foreground">
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
                      {canUpdate(item) ? (
                        <select
                          value={item.stageId}
                          onChange={(e) => onMoveStage(item, e.target.value)}
                          aria-label={`Stage for ${item.title}`}
                          className={cn(
                            "h-6 max-w-24 truncate rounded-md border px-1.5 text-2xs font-semibold",
                            isWon
                              ? "border-success/30 bg-success-subtle text-success-subtle-foreground"
                              : isLost
                                ? "border-destructive/30 bg-destructive-subtle text-destructive-subtle-foreground"
                                : "border-primary/30 bg-primary-subtle text-primary-subtle-foreground",
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
                            "rounded-md border px-2 py-0.5 text-2xs font-semibold",
                            isWon
                              ? "border-success/30 bg-success-subtle text-success-subtle-foreground"
                              : isLost
                                ? "border-destructive/30 bg-destructive-subtle text-destructive-subtle-foreground"
                                : "border-border bg-muted text-foreground",
                          )}
                        >
                          {stage ? localizedName(stage, lang) : "—"}
                        </span>
                      )}

                      <Button
                        type="button"
                        variant="ghost"
                        size="xs"
                        onClick={() => onOpenOpportunity(item)}
                        title={t.crmOpportunities.openOpportunity}
                        aria-label={t.crmOpportunities.openOpportunity}
                        className="flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                      >
                        <ExternalLink className="size-3" aria-hidden="true" />
                      </Button>

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
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-success/30 bg-success-subtle/50 px-3 py-2">
                    <div className="flex items-center gap-1.5 text-sm font-semibold text-success-subtle-foreground">
                      <Banknote className="size-4 shrink-0" aria-hidden="true" />
                      {item.amount ? (
                        <Money
                          value={item.amount}
                          currency={item.currencyCode ?? undefined}
                          language={lang}
                          className="font-semibold"
                        />
                      ) : (
                        <span className="text-xs font-medium text-muted-foreground">
                          {t.crmOpportunities.notProvided}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {probabilityLabel && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-card px-2 py-0.5 text-2xs font-semibold text-primary shadow-2xs">
                          <CirclePercent className="size-3" aria-hidden="true" />
                          {probabilityLabel}
                        </span>
                      )}
                      {item.expectedCloseDate && (
                        <span className="inline-flex items-center gap-1 text-2xs font-semibold text-muted-foreground">
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
                        className="px-2 py-0.5 text-2xs font-semibold"
                      />

                      <span
                        className={cn(
                          "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-2xs font-semibold",
                          isCorporate
                            ? "border-primary/30 bg-primary-subtle text-primary-subtle-foreground"
                            : "border-border bg-muted text-foreground",
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
                        <span className="inline-flex items-center gap-1 rounded-md border border-border bg-muted/40 px-2 py-0.5 text-2xs font-medium text-foreground">
                          <AcquisitionSourceIcon
                            source={{ iconUrl: item.leadSourceIconUrl }}
                          />
                          <span className="max-w-24 truncate">
                            {item.leadSourceName}
                          </span>
                        </span>
                      )}
                    </div>

                    <span className="inline-flex items-center gap-1 text-2xs font-medium text-muted-foreground">
                      <Clock className="size-3" aria-hidden="true" />
                      <span>{formatStageAgeBadge(item.createdAt, t.crmOpportunities, lang)}</span>
                    </span>
                  </div>

                  {/* LAYER 4: Primary Contact & Instant Channels Box */}
                  <div className="flex flex-col gap-1.5 rounded-lg border border-border bg-muted/40 p-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex min-w-0 items-center gap-1 text-xs">
                        <UserRound
                          className="size-3.5 shrink-0 text-muted-foreground"
                          aria-hidden="true"
                        />
                        <strong className="truncate font-semibold text-foreground">
                          {item.primaryContact?.displayName || customerName}
                        </strong>
                        {item.primaryContact?.jobTitle && (
                          <span className="truncate text-muted-foreground">
                            · {item.primaryContact.jobTitle}
                          </span>
                        )}
                      </span>
                      {item.primaryContact?.isPrimary && (
                        <span className="shrink-0 rounded-md border border-primary/30 bg-primary-subtle px-1.5 py-0.5 text-2xs font-semibold text-primary-subtle-foreground">
                          {cardDict.primary}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between gap-2 text-2xs text-muted-foreground">
                      <div className="min-w-0 truncate">
                        {primaryPhone ? (
                          <span className="font-mono font-semibold tabular-nums text-foreground" dir="ltr">
                            {primaryPhone}
                          </span>
                        ) : primaryEmail ? (
                          <span className="truncate">{primaryEmail}</span>
                        ) : (
                          <span>{t.crmOpportunities.notProvided}</span>
                        )}
                      </div>

                      <div className="flex shrink-0 items-center gap-1">
                        {primaryPhone && <OpportunityPhoneActions phone={primaryPhone} country={item.customerCountry} />}
                        {primaryEmail && (
                          <a
                            href={`mailto:${primaryEmail}`}
                            aria-label={`Email ${primaryEmail}`}
                            className="flex size-6 items-center justify-center rounded-md border border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-primary"
                          >
                            <Mail className="size-3" aria-hidden="true" />
                          </a>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* LAYER 5: Trade Document Counters Strip (PQ | SO | INV) */}
                  <div className="grid grid-cols-3 gap-1.5 text-center text-2xs">
                    {documentCountVisibility?.quotations !== false && (
                      <Link
                        href={buildPartyDocumentHref("quotations", item.customerPartyId)}
                        onClick={(e) => e.stopPropagation()}
                        data-testid={`opportunity-card-pq-${item.id}`}
                        className="rounded-lg border border-border bg-muted/40 py-1 transition-colors hover:border-primary/40 hover:bg-primary-subtle/40"
                      >
                        <span className="font-semibold text-muted-foreground">
                          {t.crmLeadViews.documentCountsShort.quotations}:{" "}
                        </span>
                        <strong className="font-semibold text-foreground">
                          {counts?.quotations ?? 0}
                        </strong>
                      </Link>
                    )}
                    {documentCountVisibility?.salesOrders !== false && (
                      <Link
                        href={buildPartyDocumentHref("salesOrders", item.customerPartyId)}
                        onClick={(e) => e.stopPropagation()}
                        data-testid={`opportunity-card-so-${item.id}`}
                        className="rounded-lg border border-border bg-muted/40 py-1 transition-colors hover:border-primary/40 hover:bg-primary-subtle/40"
                      >
                        <span className="font-semibold text-muted-foreground">
                          {t.crmLeadViews.documentCountsShort.salesOrders}:{" "}
                        </span>
                        <strong className="font-semibold text-foreground">
                          {counts?.salesOrders ?? 0}
                        </strong>
                      </Link>
                    )}
                    {documentCountVisibility?.invoices !== false && (
                      <Link
                        href={buildPartyDocumentHref("invoices", item.customerPartyId)}
                        onClick={(e) => e.stopPropagation()}
                        data-testid={`opportunity-card-inv-${item.id}`}
                        className="rounded-lg border border-border bg-muted/40 py-1 transition-colors hover:border-primary/40 hover:bg-primary-subtle/40"
                      >
                        <span className="font-semibold text-muted-foreground">
                          {t.crmLeadViews.documentCountsShort.invoices}:{" "}
                        </span>
                        <strong className="font-semibold text-foreground">
                          {counts?.invoices ?? 0}
                        </strong>
                      </Link>
                    )}
                  </div>

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
                        <span className="text-2xs font-semibold text-muted-foreground">
                          +{item.tags.length - 3}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* LAYER 7: Footer (1★-3★ Importance + Activity Pill + Owner Avatar) */}
                <div className="flex items-center justify-between gap-2 border-t border-border pt-2.5">
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-0.5">
                      {[1, 2, 3].map((st) => {
                        const filled = st <= item.importance;
                        if (!canUpdate(item)) return <Star key={st} className={cn("size-3.5", filled ? "fill-warning text-warning" : "text-muted-foreground")} aria-hidden="true" />;
                        return (
                          <Button
                            key={st}
                            type="button"
                            variant="ghost"
                            size="xs"
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
                            className="h-auto w-auto p-0.5 hover:bg-transparent disabled:cursor-default"
                          >
                            <Star
                              className={cn(
                                "size-3.5",
                                filled
                                  ? "fill-warning text-warning"
                                  : "text-muted-foreground/40",
                              )}
                            />
                          </Button>
                        );
                      })}
                    </div>

                    <Button
                      type="button"
                      variant="ghost"
                      size="xs"
                      onClick={() => onOpenOpportunity(item)}
                      className={cn(
                        "inline-flex h-auto items-center gap-1 rounded-md border px-2 py-0.5 text-2xs font-semibold",
                        actState === "OVERDUE"
                          ? "border-destructive/30 bg-destructive-subtle text-destructive-subtle-foreground"
                          : actState === "TODAY"
                            ? "border-warning/30 bg-warning-subtle text-warning-subtle-foreground"
                            : actState === "FUTURE"
                              ? "border-success/30 bg-success-subtle text-success-subtle-foreground"
                              : "border-border bg-muted text-muted-foreground",
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
                    </Button>
                  </div>

                  {item.ownerDisplayName && (
                    <div className="flex shrink-0 items-center gap-1.5">
                      <span className="flex size-5 items-center justify-center rounded-md border border-primary/30 bg-primary-subtle text-2xs font-semibold text-primary-subtle-foreground">
                        {ownerInit}
                      </span>
                      <span className="max-w-20 truncate text-2xs font-medium text-muted-foreground">
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
