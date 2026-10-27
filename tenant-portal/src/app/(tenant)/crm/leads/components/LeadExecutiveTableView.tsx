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
  Pencil,
  Star,
  Trash2,
  X,
} from "lucide-react";
import {
  Button,
  EmptyState,
  ErrorState,
  Pagination,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  cn,
  type PageInfo,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { useTenantAuth } from "@/context/AuthContext";
import { useAccessMode } from "@/hooks/useAccessMode";
import { canCreateActivities } from "@/components/activities/activity-presentation";
import { localizedName, localizedValue } from "@/lib/format/localized";
import { formatTemplate } from "@/lib/format/template";
import { CRM_RATING_STARS } from "../../shared/crm-rating-contract";
import {
  leadActivityState,
  leadCardHeading,
  leadCountryIso,
  leadOwnerInitials,
  type LeadCardPatch,
} from "../lead-card-contract";
import { LeadPhoneActionsRow } from "./LeadPhoneActionsRow";
import type { LeadItem, LeadStage } from "../hooks/useLeads";

interface LeadExecutiveTableViewProps {
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
 * 8. Salesperson (Inline pill with initials and name)
 * 9. Rating & Follow-up (`★★★` + Colored Activity Pill)
 * 10. Same-Page Actions (`[👁 Peek]` + `✏️` + `🗑`)
 */
export function LeadExecutiveTableView({
  items,
  stages,
  branchId,
  selectedIds,
  onSelectionChange,
  canUpdate: capabilityCanUpdate,
  canDelete: capabilityCanDelete,
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
  const { user } = useTenantAuth();
  const { canMutate } = useAccessMode();
  const canUpdate = (lead: LeadItem) => canMutate && capabilityCanUpdate(lead);
  const canDelete = (lead: LeadItem) => canMutate && capabilityCanDelete(lead);
  const canOpenActivities = canMutate && canCreateActivities(user);
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
      <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-border bg-card shadow-2xs">
        <Table className="w-full border-collapse text-start text-xs">
          <TableHeader className="sticky top-0 z-(--z-sticky-header) border-b border-border bg-muted/95 text-xs font-semibold text-muted-foreground">
            <TableRow>
              <TableHead className="w-10 px-3 py-2.5 text-center">
                <input
                  type="checkbox"
                  checked={isAllSelected}
                  onChange={toggleSelectAll}
                  aria-label={t.views.selectAll}
                  className="size-4 rounded-xs border-border text-primary focus:ring-primary"
                />
              </TableHead>
              <TableHead className="px-3 py-2.5 text-start">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() =>
                    onSortChange?.({
                      id: "displayName",
                      direction:
                        isSortedByName && sort?.direction === "asc" ? "desc" : "asc",
                    })
                  }
                  className="inline-flex h-auto items-center gap-1 p-0 text-xs font-semibold text-foreground hover:bg-transparent hover:text-primary"
                >
                <span>{t.crmLeads.executive.leadOrganization}</span>
                  {isSortedByName && sort?.direction === "desc" ? (
                    <ArrowDown className="size-3" aria-hidden="true" />
                  ) : (
                    <ArrowUp className="size-3" aria-hidden="true" />
                  )}
                </Button>
              </TableHead>
              <TableHead className="px-3 py-2.5 text-start">
                {t.crmLeads.executive.primaryContact}
              </TableHead>
              <TableHead className="px-3 py-2.5 text-start">
                {t.crmLeads.executive.instantChannels}
              </TableHead>
              <TableHead className="px-3 py-2.5 text-start">{t.crmLeads.executive.country}</TableHead>
              <TableHead className="px-3 py-2.5 text-start">
                {t.crmLeads.executive.inlineStage}
              </TableHead>
              <TableHead className="px-3 py-2.5 text-start">{t.crmLeads.executive.source}</TableHead>
              <TableHead className="px-3 py-2.5 text-start">
                {t.crmLeads.executive.inlineSalesperson}
              </TableHead>
              <TableHead className="px-3 py-2.5 text-start">
                {t.crmLeads.executive.ratingFollowUp}
              </TableHead>
              <TableHead className="px-3 py-2.5 text-end">
                {t.crmLeads.executive.samePageActions}
              </TableHead>
            </TableRow>
          </TableHeader>

          <TableBody className="divide-y divide-border/60">
            {items.map((lead) => {
              const isSelected = selectedIds.has(lead.id);
              const { title, contactName } = leadCardHeading(lead);
              const isCompany = lead.leadProfileType === "CORPORATE";
              const stage = stageById.get(lead.stageId);
              const isTerminal = stage?.flag === "CONVERTED";
              const isQualified = stage?.flag === "QUALIFIED";
              const isDisqualified = stage?.flag === "DISQUALIFIED";
              const sourceLabel = localizedValue(lead.sourceNameAr, lead.sourceNameEn, lang);
              const countryIso = leadCountryIso(lead.country);
              const primaryPhone =
                (isCompany ? lead.primaryContact?.phones[0] || lead.phone : lead.phone) ||
                lead.phones[0] ||
                "";

              const activityState = leadActivityState(lead.nextActivity);
              const ownerInitials = lead.owner ? leadOwnerInitials(lead.owner) : "";
              const ownerName = lead.owner
                ? `${lead.owner.firstName} ${lead.owner.lastName}`.trim()
                : t.crmLeads.executive.unassigned;

              const isEditingPhone = editingPhoneLeadId === lead.id && canUpdate(lead) && !isTerminal;
              const isStagePopoverOpen = canUpdate(lead) && !isTerminal && openStageMenuLeadId === lead.id;

              return (
                <TableRow
                  key={lead.id}
                  className={cn(
                    "transition-colors hover:bg-muted/40",
                    isSelected && "bg-primary/10",
                  )}
                >
                  {/* 1. Checkbox */}
                  <TableCell className="px-3 py-2.5 text-center">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleRow(lead.id)}
                      aria-label={`Select ${title}`}
                      className="size-4 rounded-xs border-border text-primary focus:ring-primary"
                    />
                  </TableCell>

                  {/* 2. Lead / Organization + Badge */}
                  <TableCell className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/crm/leads/${lead.id}`}
                        className="font-semibold text-foreground hover:text-primary hover:underline"
                      >
                        {title}
                      </Link>
                      <span
                        className={cn(
                          "rounded-md border px-1.5 py-0.5 text-xs font-semibold",
                          isCompany
                            ? "border-border bg-muted text-foreground"
                            : "border-border/60 bg-muted/60 text-muted-foreground",
                        )}
                      >
                        {isCompany ? cardDict.company : cardDict.individual}
                      </span>
                    </div>
                  </TableCell>

                  {/* 3. Primary Contact · Role */}
                  <TableCell className="px-3 py-2.5">
                    <Link
                      href={`/crm/leads/${lead.id}`}
                      className="inline-flex items-center gap-1 text-foreground hover:text-primary"
                    >
                      <span className="font-medium">{contactName || title}</span>
                      <span className="text-muted-foreground">
                        ·{" "}
                        {lead.primaryContact?.jobTitle ||
                          (isCompany
                            ? t.crmLeads.executive.primaryContactShort
                            : t.crmLeads.executive.directProspectShort)}
                      </span>
                    </Link>
                  </TableCell>

                  {/* 4. Phone & Instant Channels (Inline Editable like Screen 06) */}
                  <TableCell className="px-3 py-2.5">
                    {isEditingPhone ? (
                      <div className="inline-flex items-center gap-1 rounded-lg border-2 border-primary bg-primary/10 px-2 py-0.5">
                        <span className="text-xs font-semibold text-muted-foreground">
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
                          className="w-36 bg-transparent font-mono text-xs font-semibold tabular-nums text-foreground focus:outline-hidden"
                          autoFocus
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => commitPhoneEdit(lead)}
                          aria-label="Save phone"
                          className="flex size-5 items-center justify-center rounded-xs bg-success-subtle p-0 text-success-subtle-foreground hover:bg-success-subtle/80"
                        >
                          <Check className="size-3" aria-hidden="true" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => setEditingPhoneLeadId(null)}
                          aria-label="Cancel phone edit"
                          className="flex size-5 items-center justify-center rounded-xs bg-muted p-0 text-foreground hover:bg-muted/80"
                        >
                          <X className="size-3" aria-hidden="true" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        {canUpdate(lead) && !isTerminal ? (
                          <Button
                            type="button"
                            variant="ghost"
                            onClick={() => startPhoneEdit(lead, primaryPhone)}
                            className="h-auto p-0 font-mono text-xs font-semibold tabular-nums text-foreground hover:bg-transparent hover:text-primary"
                            dir="ltr"
                          >
                              {primaryPhone || t.crmLeads.executive.addPhone}
                          </Button>
                        ) : (
                          <span className="font-mono text-xs font-semibold tabular-nums text-foreground" dir="ltr">
                            {primaryPhone || "—"}
                          </span>
                        )}

                        <LeadPhoneActionsRow phone={primaryPhone} country={lead.country} actionsOnly />
                      </div>
                    )}
                  </TableCell>

                  {/* 5. Country */}
                  <TableCell className="px-3 py-2.5 text-foreground">
                    {countryIso && <span className="font-semibold text-muted-foreground">{countryIso} </span>}
                    <span>{lead.country || "—"}</span>
                  </TableCell>

                  {/* 6. Stage (Inline Editable Custom Popover matching Screen 06) */}
                  <TableCell className="relative px-3 py-2.5">
                    {!canMutate ? <span>{stage ? localizedName(stage, lang) : "—"}</span> : (
                    <Button
                      type="button"
                      variant="ghost"
                      aria-disabled={!canUpdate(lead) || isTerminal}
                      aria-label={!canUpdate(lead) || isTerminal
                        ? `${stage ? localizedName(stage, lang) : t.crmLeads.executive.changeStageInline}. ${t.crmLeadDetail.stageMoveUnavailable}`
                        : undefined}
                      onClick={() => {
                        if (canUpdate(lead) && !isTerminal) {
                          setOpenStageMenuLeadId(isStagePopoverOpen ? null : lead.id);
                        }
                      }}
                      className={cn(
                        "inline-flex h-auto items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold transition-all aria-disabled:cursor-not-allowed aria-disabled:opacity-50",
                        isStagePopoverOpen && "ring-2 ring-primary",
                        isQualified || isTerminal
                          ? "border-success/30 bg-success-subtle text-success-subtle-foreground"
                          : isDisqualified
                            ? "border-destructive/30 bg-destructive-subtle text-destructive-subtle-foreground"
                            : stage?.flag === "NEW"
                              ? "border-primary/40 bg-primary/10 text-primary"
                              : "border-border bg-muted text-foreground",
                      )}
                    >
                      <span>{stage ? localizedName(stage, lang) : "—"}</span>
                      {!isTerminal && <ChevronDown className="size-3" aria-hidden="true" />}
                    </Button>
                    )}

                    {isStagePopoverOpen && (
                      <div className="absolute start-3 top-10 z-(--z-popover) w-44 rounded-lg border border-border bg-popover p-1.5 shadow-xl">
                        <div className="px-2 py-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                              {t.crmLeads.executive.changeStageInline}
                        </div>
                        {nonTerminalStages.map((st) => {
                          const active = st.id === lead.stageId;
                          return (
                            <Button
                              key={st.id}
                              type="button"
                              variant="ghost"
                              onClick={() => {
                                setOpenStageMenuLeadId(null);
                                if (!active) onMoveStage(lead, st.id);
                              }}
                              className={cn(
                                "flex h-auto w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-start text-xs font-semibold transition-colors",
                                active
                                  ? "bg-primary/10 text-primary"
                                  : st.flag === "QUALIFIED"
                                    ? "text-success hover:bg-success-subtle"
                                    : st.flag === "DISQUALIFIED"
                                      ? "text-destructive hover:bg-destructive-subtle"
                                      : "text-foreground hover:bg-muted",
                              )}
                            >
                              <span>{localizedName(st, lang)}</span>
                              {active && <Check className="size-3.5 text-primary" aria-hidden="true" />}
                              {!active && st.flag === "QUALIFIED" && (
                                <Star className="size-3 fill-success text-success" aria-hidden="true" />
                              )}
                            </Button>
                          );
                        })}
                      </div>
                    )}
                  </TableCell>

                  {/* 7. Source */}
                  <TableCell className="px-3 py-2.5">
                    {sourceLabel ? (
                      <span className="inline-flex rounded-md border border-border bg-muted/80 px-2 py-0.5 text-xs font-medium text-foreground">
                        {sourceLabel}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>

                  {/* 8. Salesperson (Inline Pill) */}
                  <TableCell className="px-3 py-2.5">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => onOpenQuickModal(lead)}
                      className="inline-flex h-auto items-center gap-1.5 rounded-lg border border-transparent px-1.5 py-0.5 hover:border-border hover:bg-muted/50"
                    >
                      {ownerInitials && (
                        <span className="flex size-5 items-center justify-center rounded-md bg-muted text-xs font-semibold text-foreground">
                          {ownerInitials}
                        </span>
                      )}
                      <span className="font-medium text-foreground">
                        {ownerName}
                      </span>
                    </Button>
                  </TableCell>

                  {/* 9. Rating & Follow-up */}
                  <TableCell className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-0.5">
                        {CRM_RATING_STARS.map((st) => {
                          const filled = st <= lead.rating;
                          if (!canMutate) return <Star key={st} className={cn("size-3.5", filled ? "fill-warning text-warning" : "text-muted-foreground/40")} aria-hidden="true" />;
                          return (
                            <Button
                              key={st}
                              type="button"
                              variant="ghost"
                              disabled={!canUpdate(lead) || isTerminal}
                              onClick={() =>
                                onCardChange(
                                  lead.id,
                                  { rating: lead.rating === st ? 0 : st },
                                  lead,
                                )
                              }
                              aria-label={formatTemplate(t.crmLeads.ratingStarLabel, { rating: st, name: lead.leadName })}
                              className="h-auto p-0.5 hover:bg-transparent disabled:cursor-default"
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
                          variant="ghost"
                          onClick={() => onOpenActivities(lead)}
                          className={cn(
                            "inline-flex h-auto items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-semibold",
                            activityState === "OVERDUE"
                              ? "border-destructive/30 bg-destructive-subtle text-destructive-subtle-foreground"
                              : activityState === "TODAY"
                                ? "border-warning/30 bg-warning-subtle text-warning-subtle-foreground"
                                : activityState === "FUTURE"
                                  ? "border-success/30 bg-success-subtle text-success-subtle-foreground"
                                  : "border-border bg-muted text-muted-foreground",
                          )}
                        >
                          <Activity className="size-3 shrink-0" aria-hidden="true" />
                          <span>{cardDict.activityStates[activityState]}</span>
                        </Button>
                      )}
                    </div>
                  </TableCell>

                  {/* 10. Same-Page Actions (`[👁 Peek]` + `✏️` + `🗑`) */}
                  <TableCell className="px-3 py-2.5 text-end">
                    <div className="inline-flex items-center justify-end gap-1.5">
                      <Button
                        type="button"
                        variant="outline"
                        size="xs"
                        onClick={() => onOpenQuickModal(lead)}
                        className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold"
                      >
                        <Eye className="size-3.5" aria-hidden="true" />
                            <span>{t.crmLeads.executive.peek}</span>
                      </Button>

                      {canUpdate(lead) && !isTerminal && (
                        <Button
                          type="button"
                          variant="outline"
                          size="xs"
                          onClick={() => startPhoneEdit(lead, primaryPhone)}
                              title={t.crmLeads.executive.editCell}
                              aria-label={t.crmLeads.executive.editCell}
                          className="flex size-7 items-center justify-center rounded-lg p-0"
                        >
                          <Pencil className="size-3.5" aria-hidden="true" />
                        </Button>
                      )}

                      {canDelete(lead) && (
                        <Button
                          type="button"
                          variant="outline"
                          size="xs"
                          onClick={() => onDeleteLead(lead)}
                          title={t.common.delete}
                          aria-label={t.common.delete}
                          className="flex size-7 items-center justify-center rounded-lg border-destructive/30 bg-destructive-subtle p-0 text-destructive hover:bg-destructive-subtle/80"
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
              summary: (from, to, total) => formatTemplate(t.common.showingOf, { from, to, total }),
            }}
          />
        </div>
      )}
    </div>
  );
}
