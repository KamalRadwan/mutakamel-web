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
  Star,
  Trash2,
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  cn,
  type PageInfo,
} from "@/design-system";
import { useAccessMode } from "@/hooks/useAccessMode";
import { useTenantAuth } from "@/context/AuthContext";
import { canCreateActivities } from "@/components/activities/activity-presentation";
import { useI18n } from "@/i18n/I18nContext";
import { localizedName } from "@/lib/format/localized";
import { formatNumber } from "@/lib/format/number";
import { formatTemplate } from "@/lib/format/template";
import { countryIsoFromName } from "@/lib/geo/country-data";
import { OpportunityPhoneActions } from "./OpportunityQuickEditModal";
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
  canUpdate: canUpdateByScope,
  canDelete: canDeleteByScope,
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
  const { canMutate } = useAccessMode();
  const { user } = useTenantAuth();
  const canOpenActivities = canMutate && canCreateActivities(user);
  const canUpdate = (item: OpportunityListItem) => canMutate && canUpdateByScope(item);
  const canDelete = (item: OpportunityListItem) => canMutate && canDeleteByScope(item);
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
      <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-border bg-card shadow-2xs">
        <Table className="w-full border-collapse text-start text-xs">
          <TableHeader className="sticky top-0 z-(--z-sticky-header) border-b border-border bg-muted/95 text-2xs font-semibold text-muted-foreground">
            <TableRow>
              <TableHead className="w-10 px-3 py-2.5 text-center">
                <input
                  type="checkbox"
                  checked={isAllSelected}
                  onChange={toggleSelectAll}
                  aria-label={t.views.selectAll}
                  className="size-4 rounded-xs border-input text-primary focus:ring-primary"
                />
              </TableHead>
              <TableHead className="px-3 py-2.5 text-start">
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  onClick={() =>
                    onSortChange?.({
                      id: "title",
                      direction:
                        isSortedByTitle && sort?.direction === "asc"
                          ? "desc"
                          : "asc",
                    })
                  }
                  className="inline-flex h-auto items-center gap-1 p-0 font-semibold text-foreground hover:bg-transparent hover:text-primary"
                >
                  <span>
                    {t.crmOpportunities.opportunityAndCustomer}
                  </span>
                  {isSortedByTitle && sort?.direction === "desc" ? (
                    <ArrowDown className="size-3" aria-hidden="true" />
                  ) : (
                    <ArrowUp className="size-3" aria-hidden="true" />
                  )}
                </Button>
              </TableHead>
              <TableHead className="px-3 py-2.5 text-start">
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  onClick={() =>
                    onSortChange?.({
                      id: "amount",
                      direction:
                        isSortedByAmount && sort?.direction === "desc"
                          ? "asc"
                          : "desc",
                    })
                  }
                  className="inline-flex h-auto items-center gap-1 p-0 font-semibold text-foreground hover:bg-transparent hover:text-primary"
                >
                  <span>
                    {t.crmOpportunities.dealValueAndProbability}
                  </span>
                  {isSortedByAmount && sort?.direction === "asc" ? (
                    <ArrowUp className="size-3" aria-hidden="true" />
                  ) : (
                    <ArrowDown className="size-3" aria-hidden="true" />
                  )}
                </Button>
              </TableHead>
              <TableHead className="px-3 py-2.5 text-start">
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  onClick={() =>
                    onSortChange?.({
                      id: "expectedCloseDate",
                      direction:
                        isSortedByCloseDate && sort?.direction === "asc"
                          ? "desc"
                          : "asc",
                    })
                  }
                  className="inline-flex h-auto items-center gap-1 p-0 font-semibold text-foreground hover:bg-transparent hover:text-primary"
                >
                  <span>{t.crmOpportunities.expectedClose}</span>
                  {isSortedByCloseDate && sort?.direction === "desc" ? (
                    <ArrowDown className="size-3" aria-hidden="true" />
                  ) : (
                    <ArrowUp className="size-3" aria-hidden="true" />
                  )}
                </Button>
              </TableHead>
              <TableHead className="px-3 py-2.5 text-start">
                {t.crmOpportunities.contactChannels}
              </TableHead>
              <TableHead className="px-3 py-2.5 text-start">
                {t.crmOpportunities.country}
              </TableHead>
              <TableHead className="px-3 py-2.5 text-start">
                {t.crmOpportunities.inlineStage}
              </TableHead>
              <TableHead className="px-3 py-2.5 text-start">
                {t.crmOpportunities.salesperson}
              </TableHead>
              <TableHead className="px-3 py-2.5 text-start">
                {t.crmOpportunities.importanceAndFollowUp}
              </TableHead>
              <TableHead className="px-3 py-2.5 text-end">
                {t.crmOpportunities.samePageActions}
              </TableHead>
            </TableRow>
          </TableHeader>

          <TableBody className="divide-y divide-border">
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

              const primaryPhone =
                item.primaryContact?.phones[0] ?? item.customerPhone ?? "";

              const actState = mapActivityState(item.activityState);
              const ownerInit = getInitials(item.ownerDisplayName ?? "");
              const ownerName =
                item.ownerDisplayName ||
                t.crmOpportunities.unassigned;
              const isStagePopoverOpen = openStageMenuId === item.id;

              const probabilityLabel =
                item.probabilityPercent === null
                  ? null
                  : formatTemplate(t.crmOpportunityDetail.probabilityValue, {
                      percent: formatNumber(item.probabilityPercent, lang),
                    });

              return (
                <TableRow
                  key={item.id}
                  className={cn(
                    "transition-colors hover:bg-muted/50",
                    isSelected && "bg-selected",
                  )}
                >
                  {/* 1. Checkbox */}
                  <TableCell className="px-3 py-2.5 text-center">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleRow(item.id)}
                      aria-label={`Select ${item.title}`}
                      className="size-4 rounded-xs border-input text-primary focus:ring-primary"
                    />
                  </TableCell>

                  {/* 2. Opportunity Title + Customer + Corporate/Individual Badge */}
                  <TableCell className="px-3 py-2.5">
                    <div className="flex flex-col gap-0.5">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/crm/opportunities/${item.id}`}
                          className="font-semibold text-foreground hover:text-primary hover:underline"
                        >
                          {item.title}
                        </Link>
                        <StatusBadge
                          value={item.status}
                          kind="OpportunityStatus"
                          className="px-1.5 py-0 text-2xs font-semibold"
                        />
                      </div>
                      <div className="flex items-center gap-1.5 text-2xs text-muted-foreground">
                        <span className="truncate">{customerName}</span>
                        <span
                          className={cn(
                            "rounded-md border px-1.5 py-0 text-2xs font-semibold",
                            isCorporate
                              ? "border-info bg-info-subtle text-info-subtle-foreground"
                              : "border-border bg-muted text-foreground",
                          )}
                        >
                          {isCorporate ? cardDict.company : cardDict.individual}
                        </span>
                      </div>
                    </div>
                  </TableCell>

                  {/* 3. Deal Value & Probability */}
                  <TableCell className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      {item.amount ? (
                        <span className="inline-flex items-center gap-1 font-semibold text-success">
                          <Banknote className="size-3.5 shrink-0" aria-hidden="true" />
                          <Money
                            value={item.amount}
                            currency={item.currencyCode ?? undefined}
                            language={lang}
                            className="font-semibold"
                          />
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                      {probabilityLabel && (
                        <span className="inline-flex items-center gap-0.5 rounded-full bg-info-subtle px-1.5 py-0.5 text-2xs font-semibold text-info-subtle-foreground">
                          <CirclePercent className="size-3" aria-hidden="true" />
                          {probabilityLabel}
                        </span>
                      )}
                    </div>
                  </TableCell>

                  {/* 4. Expected Close Date */}
                  <TableCell className="px-3 py-2.5 text-foreground">
                    {item.expectedCloseDate ? (
                      <span className="inline-flex items-center gap-1 font-medium">
                        <Calendar className="size-3 text-muted-foreground" aria-hidden="true" />
                        <DateTime
                          value={`${item.expectedCloseDate.slice(0, 10)}T00:00:00.000Z`}
                          precision="date"
                          language={lang}
                          timeZone="UTC"
                        />
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>

                  {/* 5. Contact & Instant Channels */}
                  <TableCell className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <div className="min-w-0">
                        <div className="truncate font-medium text-foreground">
                          {item.primaryContact?.displayName || customerName}
                        </div>
                        {primaryPhone && (
                          <div
                            className="font-mono text-2xs text-muted-foreground"
                            dir="ltr"
                          >
                            {primaryPhone}
                          </div>
                        )}
                      </div>

                      {primaryPhone && (
                        <div className="flex items-center gap-1">
                          <OpportunityPhoneActions phone={primaryPhone} country={item.customerCountry} />
                        </div>
                      )}
                    </div>
                  </TableCell>

                  {/* 6. Country */}
                  <TableCell className="px-3 py-2.5 text-foreground">
                    {countryIso && (
                      <span className="font-semibold text-muted-foreground">
                        {countryIso}{" "}
                      </span>
                    )}
                    <span>{item.customerCountry || "—"}</span>
                  </TableCell>

                  {/* 7. Stage (Inline Editable Custom Popover) */}
                  <TableCell className="relative px-3 py-2.5">
                    {canUpdate(item) ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="xs"
                        disabled={!canUpdate(item)}
                        onClick={() =>
                          setOpenStageMenuId(
                            isStagePopoverOpen ? null : item.id,
                          )
                        }
                        className={cn(
                          "inline-flex h-auto items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold transition-all",
                          isStagePopoverOpen && "ring-2 ring-primary",
                          isWon
                            ? "border-success bg-success-subtle text-success-subtle-foreground"
                            : isLost
                              ? "border-destructive bg-destructive-subtle text-destructive-subtle-foreground"
                              : stage?.flag === "NEW"
                                ? "border-info bg-info-subtle text-info-subtle-foreground"
                                : "border-border bg-muted text-foreground",
                        )}
                      >
                        <span>{stage ? localizedName(stage, lang) : "—"}</span>
                        {canUpdate(item) && (
                          <ChevronDown className="size-3" aria-hidden="true" />
                        )}
                      </Button>
                    ) : <span>{stage ? localizedName(stage, lang) : "\u2014"}</span>}

                    {canUpdate(item) && isStagePopoverOpen && (
                      <div className="absolute start-3 top-10 z-(--z-dropdown) w-48 rounded-lg border border-border bg-popover p-1.5 shadow-xl">
                        <div className="px-2 py-1 text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
                          {t.crmOpportunities.changeStageInline}
                        </div>
                        {stages.map((st) => {
                          const active = st.id === item.stageId;
                          return (
                            <Button
                              key={st.id}
                              type="button"
                              variant="ghost"
                              size="xs"
                              onClick={() => {
                                setOpenStageMenuId(null);
                                if (!active) onMoveStage(item, st.id);
                              }}
                              className={cn(
                                "flex h-auto w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-start text-xs font-semibold transition-colors",
                                active
                                  ? "bg-info-subtle text-info-subtle-foreground"
                                  : st.flag === "WON"
                                    ? "text-success hover:bg-success-subtle"
                                    : st.flag === "LOST"
                                      ? "text-destructive hover:bg-destructive-subtle"
                                      : "text-foreground hover:bg-muted",
                              )}
                            >
                              <span>{localizedName(st, lang)}</span>
                              {active && (
                                <Check
                                  className="size-3.5 text-primary"
                                  aria-hidden="true"
                                />
                              )}
                            </Button>
                          );
                        })}
                      </div>
                    )}
                  </TableCell>

                  {/* 8. Salesperson */}
                  <TableCell className="px-3 py-2.5">
                    <Button
                      type="button"
                      variant="ghost"
                      size="xs"
                      onClick={() => onOpenQuickModal(item)}
                      className="inline-flex h-auto items-center gap-1.5 rounded-lg border border-transparent px-1.5 py-0.5 hover:border-border hover:bg-muted"
                    >
                      {ownerInit && (
                        <span className="flex size-5 items-center justify-center rounded-md bg-info-subtle text-2xs font-semibold text-info-subtle-foreground">
                          {ownerInit}
                        </span>
                      )}
                      <span className="font-medium text-foreground">
                        {ownerName}
                      </span>
                    </Button>
                  </TableCell>

                  {/* 9. Importance & Follow-up */}
                  <TableCell className="px-3 py-2.5">
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
                                    ? "fill-warning text-warning"
                                    : "text-muted-foreground/40",
                                )}
                              />
                            </Button>
                          );
                        })}
                      </div>

                      {canOpenActivities && (
                        <Button
                          type="button"
                          variant="outline"
                          size="xs"
                          onClick={() => onOpenActivities(item)}
                          className={cn(
                            "inline-flex h-auto items-center gap-1 rounded-md border px-2 py-0.5 text-2xs font-semibold",
                            actState === "OVERDUE"
                              ? "border-destructive bg-destructive-subtle text-destructive-subtle-foreground"
                              : actState === "TODAY"
                                ? "border-warning bg-warning-subtle text-warning-subtle-foreground"
                                : actState === "FUTURE"
                                  ? "border-success bg-success-subtle text-success-subtle-foreground"
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
                      )}
                    </div>
                  </TableCell>

                  {/* 10. Same-Page Actions */}
                  <TableCell className="px-3 py-2.5 text-end">
                    <div className="inline-flex items-center justify-end gap-1.5">
                      <Button
                        type="button"
                        variant="outline"
                        size="xs"
                        onClick={() => onOpenQuickModal(item)}
                        className="inline-flex h-7 items-center gap-1 rounded-lg border border-swatch-indigo-soft bg-swatch-indigo-soft px-2.5 text-xs font-semibold text-swatch-indigo-deep hover:bg-swatch-indigo-soft/80"
                      >
                        <Eye className="size-3.5" aria-hidden="true" />
                        <span>{t.crmOpportunities.peek}</span>
                      </Button>

                      {canDelete(item) && (
                        <Button
                          type="button"
                          variant="outline"
                          size="xs"
                          onClick={() => onDeleteOpportunity(item)}
                          title={t.common.delete}
                          aria-label={t.common.delete}
                          className="flex size-7 items-center justify-center rounded-lg border border-destructive bg-destructive-subtle text-destructive hover:bg-destructive-subtle/80"
                        >
                          <Trash2 className="size-3.5" aria-hidden="true" />
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
