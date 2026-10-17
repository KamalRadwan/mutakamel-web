"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  DragDropContext,
  Draggable,
  Droppable,
  type DropResult,
  type DragStart,
  type DragUpdate,
} from "@hello-pangea/dnd";
import {
  Activity,
  Building2,
  Check,
  ChevronDown,
  ChevronUp,
  ChevronsLeft,
  ChevronsRight,
  ExternalLink,
  Eye,
  GripVertical,
  Lock,
  MessageCircle,
  Phone,
  Plus,
  Send,
  Sparkles,
  Star,
  UserRound,
  AlertTriangle,
  X,
} from "lucide-react";
import {
  Button,
  Combobox,
  EmptyState,
  ErrorState,
  Field,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
  cn,
  type CardColor,
  type ComboboxOption,
} from "@/design-system";
import { useCollapsedColumns } from "@/design-system/views/board/useCollapsedColumns";
import { useI18n } from "@/i18n/I18nContext";
import { axiosClient } from "@/lib/api/axiosClient";
import { localizedName, localizedValue } from "@/lib/format/localized";
import { formatTemplate } from "@/lib/format/template";
import { isUUIDv7 } from "@/lib/uuid";
import type { AcquisitionSource } from "../../acquisition-sources/acquisition-source-contract";
import {
  AcquisitionSourceIcon,
  AcquisitionSourceOption,
} from "../../shared/components/AcquisitionSourceIcon";
import { CrmPhoneListField } from "../../shared/components/CrmPhoneListField";
import { CrmErrorBag } from "../../shared/crm-form-validation";
import { useCrmAcquisitionSources } from "../../shared/hooks/useCrmAcquisitionSources";
import { useCrmFieldMessages } from "../../shared/hooks/useCrmFieldMessages";
import { useLeadCompanyOptions } from "../hooks/useLeadCompanyOptions";
import {
  leadPath,
  parseLeadDetailResponse,
  type LeadDetail,
} from "../lead-contract";
import {
  leadActivityState,
  leadCardHeading,
  leadOwnerInitials,
  type LeadActivityState,
  type LeadCardPatch,
} from "../lead-card-contract";
import {
  LEAD_CREATE_LIMITS,
  type CreateLeadRequest,
  type QuickCreateLeadDraft,
} from "../lead-create-contract";
import type { LeadItem, LeadStage } from "../hooks/useLeads";
import { LeadCardMenu, type LeadCardMoveTarget } from "./lead-card/LeadCardMenu";
import {
  normalizePhoneDigits,
  normalizeWhatsAppDigits,
} from "../lead-phone-links";

export interface LeadExecutiveBoardViewProps {
  stages: readonly LeadStage[];
  items: readonly LeadItem[];
  totals?: ReadonlyMap<string, number>;
  branchId: string | null;
  canCreate: boolean;
  canUpdate: (lead: LeadItem) => boolean;
  canDelete: (lead: LeadItem) => boolean;
  isMovePending: boolean;
  isLoading: boolean;
  error: string | null;
  onRetry: () => void;
  onOpenLead: (lead: LeadItem) => void;
  onOpenQuickModal: (lead: LeadItem) => void;
  onOpenActivities: (lead: LeadItem) => void;
  onDeleteLead: (lead: LeadItem) => void;
  onMoveStage: (leadId: string, toStageId: string, lead?: LeadItem) => void;
  onCardChange: (leadId: string, patch: LeadCardPatch, lead: LeadItem) => void;
  onOpenCreateModal: (stageId: string | null, draft?: QuickCreateLeadDraft) => void;
  onQuickCreateLead: (payload: CreateLeadRequest, rating?: number) => Promise<boolean>;
  hasMoreStage: (stageId: string) => boolean;
  isLoadingMoreStage: (stageId: string) => boolean;
  onLoadMoreStage: (stageId: string) => void;
}

const CARD_BORDER_ACCENT: Partial<Record<CardColor, string>> = {
  RED: "border-red-300 border-s-4 border-s-red-500 dark:border-red-800 dark:border-s-red-500",
  ORANGE: "border-amber-300 border-s-4 border-s-amber-500 dark:border-amber-800",
  AMBER: "border-amber-300 border-s-4 border-s-amber-500 dark:border-amber-800",
  YELLOW: "border-yellow-300 border-s-4 border-s-yellow-500 dark:border-yellow-800",
  GREEN: "border-emerald-300 border-s-4 border-s-emerald-500 dark:border-emerald-800",
  TEAL: "border-teal-300 border-s-4 border-s-teal-500 dark:border-teal-800",
  BLUE: "border-blue-300 border-s-4 border-s-blue-600 dark:border-blue-800",
  INDIGO: "border-indigo-300 border-s-4 border-s-indigo-500 dark:border-indigo-800",
  PURPLE: "border-purple-300 border-s-4 border-s-purple-500 dark:border-purple-800",
  PINK: "border-pink-300 border-s-4 border-s-pink-500 dark:border-pink-800",
  SLATE: "border-slate-300 border-s-4 border-s-slate-500 dark:border-slate-700",
};

function formatRelativeAge(isoDate?: string, isAr?: boolean): string {
  if (!isoDate) return isAr ? "الآن" : "Just now";
  const time = new Date(isoDate).getTime();
  if (Number.isNaN(time)) return "";
  const diffMinutes = Math.max(1, Math.floor((Date.now() - time) / (1000 * 60)));
  if (diffMinutes < 60) return isAr ? `منذ ${diffMinutes} د` : `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return isAr ? `منذ ${diffHours} س` : `${diffHours}h in stage`;
  const diffDays = Math.floor(diffHours / 24);
  return isAr ? `${diffDays} يوم بالمرحلة` : `${diffDays}d in stage`;
}

/**
 * Executive Kanban Board View matching Screens 01, 02, 03, and 16:
 * - Rich stage headers with top accent bars, stage velocity hints, and segmented progress bar
 * - Smart collapsed intermediate stages with 400ms auto-peek on drag hover
 * - In-Column Quick-Add Lead Composer Card (`⚡ Quick Add Lead in "<Stage>"`)
 * - 5-Row Executive Board Cards with dedicated phone & instant channels pill (`📞 💬 ✈️`),
 *   profile badge, amber `✏️` inline edit trigger, tags, stage age, 3-star rating,
 *   colored activity pill, 360° Quick Modal trigger, and owner initials badge
 * - In-Card Same-Page Inline Editor (`PATCH /crm/leads/:id`) right inside the column
 * - Live Drag & Drop banners, terminal stage protection card, and bottom Quick Drop Stage Dock
 */
export function LeadExecutiveBoardView({
  stages,
  items,
  totals,
  branchId,
  canCreate,
  canUpdate,
  canDelete,
  isMovePending,
  isLoading,
  error,
  onRetry,
  onOpenLead,
  onOpenQuickModal,
  onOpenActivities,
  onDeleteLead,
  onMoveStage,
  onCardChange,
  onOpenCreateModal,
  onQuickCreateLead,
  hasMoreStage,
  isLoadingMoreStage,
  onLoadMoreStage,
}: LeadExecutiveBoardViewProps) {
  const { t, lang } = useI18n();
  const isAr = lang === "ar";
  const { items: sources } = useCrmAcquisitionSources();

  const { isCollapsed: isColumnCollapsed, toggle: toggleCollapse } = useCollapsedColumns();
  const [columnActivityFilter, setColumnActivityFilter] = useState<
    Record<string, LeadActivityState | null>
  >({});
  const [editingLeadId, setEditingLeadId] = useState<string | null>(null);
  const [quickAddStageId, setQuickAddStageId] = useState<string | null>(null);
  const [draggingLeadId, setDraggingLeadId] = useState<string | null>(null);
  const [dragDestinationStageId, setDragDestinationStageId] = useState<string | null>(null);
  const hoverExpandTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (hoverExpandTimerRef.current) clearTimeout(hoverExpandTimerRef.current);
    };
  }, []);

  if (!branchId) {
    return <EmptyState title={t.crmLeads.selectBranchFirst} />;
  }

  if (isLoading && stages.length === 0) {
    return (
      <div className="flex h-full gap-3 overflow-x-auto pb-2">
        {Array.from({ length: 5 }).map((_, idx) => (
          <Skeleton key={`board-col-skel-${idx}`} className="h-full w-[300px] max-w-[300px] shrink-0 rounded-xl" />
        ))}
      </div>
    );
  }

  if (error && items.length === 0) {
    return <ErrorState title={t.crmLeads.loadFailed} onRetry={onRetry} retryLabel={t.common.retry} />;
  }

  const stageById = new Map(stages.map((s) => [s.id, s]));
  const nonTerminalStages = stages.filter((s) => s.flag !== "CONVERTED");

  function toggleColumnActivityFilter(stageId: string, state: LeadActivityState) {
    setColumnActivityFilter((prev) => ({
      ...prev,
      [stageId]: prev[stageId] === state ? null : state,
    }));
  }

  function handleDragStart(start: DragStart) {
    setDraggingLeadId(start.draggableId);
    setDragDestinationStageId(start.source.droppableId);
  }

  function handleDragUpdate(update: DragUpdate) {
    setDragDestinationStageId(update.destination?.droppableId ?? null);
  }

  function handleDragEnd(result: DropResult) {
    const draggedId = draggingLeadId;
    setDraggingLeadId(null);
    setDragDestinationStageId(null);
    if (!result.destination) return;
    const toStageId = result.destination.droppableId;
    const fromStageId = result.source.droppableId;
    if (toStageId === fromStageId) return;

    const targetStage = stageById.get(toStageId);
    const lead = items.find((item) => item.id === (draggedId ?? result.draggableId));
    if (!targetStage || !lead) return;

    // Terminal CONVERTED stage opens the Lead Details / Convert flow instead of raw stage move
    if (targetStage.flag === "CONVERTED") {
      onOpenLead(lead);
      return;
    }

    onMoveStage(lead.id, toStageId, lead);
  }

  const draggingLead = draggingLeadId ? items.find((item) => item.id === draggingLeadId) ?? null : null;
  const draggingFromStage = draggingLead ? stageById.get(draggingLead.stageId) : undefined;
  const draggingToStage = dragDestinationStageId ? stageById.get(dragDestinationStageId) : undefined;

  return (
    <div className="relative flex h-full min-h-0 flex-col">
      <DragDropContext
        onDragStart={handleDragStart}
        onDragUpdate={handleDragUpdate}
        onDragEnd={handleDragEnd}
      >
        <div className="flex h-full min-h-0 flex-1 items-stretch gap-3 overflow-x-auto pb-3">
          {stages.map((stage) => {
            const allStageLeads = items.filter((item) => item.stageId === stage.id);
            const activeActivityState = columnActivityFilter[stage.id] ?? null;
            const stageLeads = activeActivityState
              ? allStageLeads.filter(
                  (item) => leadActivityState(item.nextActivity) === activeActivityState,
                )
              : allStageLeads;
            const totalCount = totals?.get(stage.id) ?? allStageLeads.length;
            const collapsed = isColumnCollapsed(stage.id);
            const isTerminal = stage.flag === "CONVERTED";
            const isDisqualified = stage.flag === "DISQUALIFIED";
            const isQualified = stage.flag === "QUALIFIED";
            const isDragTarget = draggingLeadId !== null && dragDestinationStageId === stage.id;
            const isQuickAddOpen = quickAddStageId === stage.id;

            // Activity task counts in this column: Green (FUTURE), Orange (TODAY), Red (OVERDUE), Gray (NONE)
            const activitySegments: ReadonlyArray<{
              state: LeadActivityState;
              label: string;
              count: number;
              barClass: string;
              dotClass: string;
              badgeClass: string;
            }> = [
              {
                state: "FUTURE",
                label: isAr ? "مجدول مستقبلاً" : "Future",
                count: allStageLeads.filter((l) => leadActivityState(l.nextActivity) === "FUTURE")
                  .length,
                barClass: "bg-emerald-500 hover:bg-emerald-600",
                dotClass: "bg-emerald-500",
                badgeClass:
                  "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300",
              },
              {
                state: "TODAY",
                label: isAr ? "اليوم" : "Today",
                count: allStageLeads.filter((l) => leadActivityState(l.nextActivity) === "TODAY")
                  .length,
                barClass: "bg-orange-500 hover:bg-orange-600",
                dotClass: "bg-orange-500",
                badgeClass:
                  "border-orange-200 bg-orange-50 text-orange-800 dark:border-orange-800 dark:bg-orange-950/60 dark:text-orange-300",
              },
              {
                state: "OVERDUE",
                label: isAr ? "متأخر" : "Overdue",
                count: allStageLeads.filter((l) => leadActivityState(l.nextActivity) === "OVERDUE")
                  .length,
                barClass: "bg-red-500 hover:bg-red-600",
                dotClass: "bg-red-500",
                badgeClass:
                  "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/60 dark:text-red-300",
              },
              {
                state: "NONE",
                label: isAr ? "بدون مهام" : "None",
                count: allStageLeads.filter((l) => leadActivityState(l.nextActivity) === "NONE")
                  .length,
                barClass:
                  "bg-slate-300 hover:bg-slate-400 dark:bg-slate-600 dark:hover:bg-slate-500",
                dotClass: "bg-slate-400",
                badgeClass:
                  "border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300",
              },
            ];
            const visibleActivitySegments = activitySegments.filter(
              (seg) => seg.count > 0 || activeActivityState === seg.state,
            );
            const activeSegment =
              activitySegments.find((seg) => seg.state === activeActivityState) ?? null;

            const topBorderClass = isQualified || isTerminal
              ? "border-t-4 border-t-emerald-500"
              : isDisqualified
                ? "border-t-4 border-t-red-500"
                : stage.flag === "ON_HOLD"
                  ? "border-t-4 border-t-amber-500"
                  : "border-t-4 border-t-blue-600";

            if (collapsed) {
              return (
                <div
                  key={stage.id}
                  onMouseEnter={() => {
                    if (!draggingLeadId) return;
                    if (hoverExpandTimerRef.current) clearTimeout(hoverExpandTimerRef.current);
                    hoverExpandTimerRef.current = setTimeout(() => {
                      if (isColumnCollapsed(stage.id)) toggleCollapse(stage.id);
                    }, 400);
                  }}
                  onMouseLeave={() => {
                    if (hoverExpandTimerRef.current) clearTimeout(hoverExpandTimerRef.current);
                  }}
                  className={cn(
                    "flex h-full min-h-0 w-11 shrink-0 flex-col items-center gap-2.5 rounded-xl border border-slate-200/90 bg-white py-2.5 shadow-2xs transition-all dark:border-slate-800 dark:bg-slate-900",
                    topBorderClass,
                    draggingLeadId && "border-dashed border-blue-400 bg-blue-50/30 dark:bg-blue-950/20",
                  )}
                >
                  <button
                    type="button"
                    onClick={() => toggleCollapse(stage.id)}
                    aria-label={`${t.views.expandColumn}: ${localizedName(stage, lang)}`}
                    title={`${t.views.expandColumn}: ${localizedName(stage, lang)}`}
                    className="flex size-7 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800"
                  >
                    <ChevronsRight className="size-4 rtl:rotate-180" aria-hidden="true" />
                  </button>

                  <span className="inline-flex size-6 items-center justify-center rounded-full bg-blue-50 text-xs font-bold tabular-nums text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                    {totalCount}
                  </span>

                  <span className="min-h-0 truncate text-xs font-semibold tracking-wide text-slate-700 [writing-mode:vertical-rl] dark:text-slate-300">
                    {localizedName(stage, lang)}
                  </span>

                  {draggingLeadId && (
                    <span className="mt-auto px-1 text-center text-[10px] font-medium text-blue-600 [writing-mode:vertical-rl]">
                      {isAr ? "مرر للتوسيع" : "Hover to peek"}
                    </span>
                  )}
                </div>
              );
            }

            const stageSubtitle = "";

            return (
              <div
                key={stage.id}
                className={cn(
                  "flex h-full min-h-0 w-[300px] max-w-[300px] shrink-0 flex-col rounded-xl border bg-slate-50/70 shadow-2xs transition-all dark:bg-slate-900/60",
                  topBorderClass,
                  isDragTarget && !isTerminal
                    ? isDisqualified
                      ? "border-2 border-red-500 bg-red-50/25 dark:bg-red-950/20"
                      : "border-2 border-emerald-500 bg-emerald-50/25 dark:bg-emerald-950/20"
                    : "border-slate-200/90 dark:border-slate-800",
                )}
              >
                {/* Stage Column Header */}
                <div className="flex shrink-0 flex-col gap-2 rounded-t-xl border-b border-slate-200/80 bg-white px-3 py-2.5 dark:border-slate-800 dark:bg-slate-900">
                  <div className="flex items-center justify-between gap-1.5">
                    <div className="flex min-w-0 items-center gap-1.5">
                      <span className="truncate text-sm font-bold text-slate-900 dark:text-slate-100">
                        {localizedName(stage, lang)}
                      </span>
                      <span
                        className={cn(
                          "inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-xs font-bold tabular-nums",
                          isQualified || isTerminal
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                            : isDisqualified
                              ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"
                              : "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
                        )}
                      >
                        {totalCount}
                      </span>
                      {stageSubtitle && !isQuickAddOpen && (
                        <span className="truncate text-[11px] text-slate-400 dark:text-slate-500">
                          {stageSubtitle}
                        </span>
                      )}
                    </div>

                    <div className="flex shrink-0 items-center gap-1">
                      {isQuickAddOpen && (
                        <span className="inline-flex items-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300">
                          {isAr ? "+ إضافة سريعة..." : "+ Quick Adding..."}
                        </span>
                      )}

                      {isTerminal && (
                        <span className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                          <Lock className="size-3" aria-hidden="true" />
                          {isAr ? "نهائية" : "Terminal"}
                        </span>
                      )}

                      {canCreate && !isTerminal && !isQuickAddOpen && (
                        <button
                          type="button"
                          onClick={() => setQuickAddStageId(stage.id)}
                          aria-label={`${t.crmLeads.addLead}: ${localizedName(stage, lang)}`}
                          title={`${t.crmLeads.addLead}: ${localizedName(stage, lang)}`}
                          className="flex size-6 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-blue-50 hover:text-blue-600 dark:text-slate-400 dark:hover:bg-slate-800"
                        >
                          <Plus className="size-4" aria-hidden="true" />
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => toggleCollapse(stage.id)}
                        aria-label={`${t.views.collapseColumn}: ${localizedName(stage, lang)}`}
                        title={`${t.views.collapseColumn}: ${localizedName(stage, lang)}`}
                        className="flex size-6 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"
                      >
                        <ChevronsLeft className="size-3.5 rtl:rotate-180" aria-hidden="true" />
                      </button>
                    </div>
                  </div>

                  {/* Interactive 4-Color Activity Filter Bar: only shows colors with matching tasks */}
                  {visibleActivitySegments.length > 0 && (
                    <div
                      role="group"
                      aria-label={
                        isAr
                          ? `تصفية مهام المرحلة (${localizedName(stage, lang)})`
                          : `Filter column tasks by status (${localizedName(stage, lang)})`
                      }
                      className="flex h-2 w-full items-stretch gap-0.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"
                    >
                      {visibleActivitySegments.map((seg) => {
                        const isSelected = activeActivityState === seg.state;
                        const isDimmed = activeActivityState !== null && !isSelected;
                        return (
                          <button
                            key={seg.state}
                            type="button"
                            onClick={() => toggleColumnActivityFilter(stage.id, seg.state)}
                            style={{ flexGrow: Math.max(seg.count, 1) }}
                            aria-pressed={isSelected}
                            aria-label={`${seg.label}: ${seg.count}`}
                            title={
                              isAr
                                ? `${seg.label}: ${seg.count} — اضغط للتصفية`
                                : `${seg.label} tasks: ${seg.count} — Click to filter`
                            }
                            className={cn(
                              "h-full min-w-4 cursor-pointer transition-all",
                              seg.barClass,
                              isSelected && "ring-1 ring-slate-900 dark:ring-white",
                              isDimmed && "opacity-30 hover:opacity-75",
                            )}
                          />
                        );
                      })}
                    </div>
                  )}

                  {/* Active Activity Status Filter Pill inside Column Header */}
                  {activeSegment && (
                    <div className="flex items-center justify-between gap-1.5 pt-0.5">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[10px] font-bold",
                          activeSegment.badgeClass,
                        )}
                      >
                        <span className={cn("size-1.5 rounded-full", activeSegment.dotClass)} />
                        <span>
                          {activeSegment.label} ({activeSegment.count})
                        </span>
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setColumnActivityFilter((prev) => ({ ...prev, [stage.id]: null }))
                        }
                        className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
                      >
                        <X className="size-3" aria-hidden="true" />
                        <span>{isAr ? "إلغاء الفلتر" : "Clear"}</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Column Droppable Body */}
                <Droppable droppableId={stage.id} isDropDisabled={isMovePending}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={cn(
                        "flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto p-2.5",
                        snapshot.isDraggingOver && !isTerminal && "bg-blue-50/40 dark:bg-blue-950/20",
                      )}
                    >
                      {/* Screen 03: In-Column Quick-Add Lead Composer Card */}
                      {isQuickAddOpen && branchId && (
                        <BoardColumnQuickAddCard
                          stage={stage}
                          branchId={branchId}
                          sources={sources}
                          onCancel={() => setQuickAddStageId(null)}
                          onOpenFullModal={(draft) => {
                            setQuickAddStageId(null);
                            onOpenCreateModal(stage.id, draft);
                          }}
                          onSubmit={async (payload, rating) => {
                            const ok = await onQuickCreateLead(payload, rating);
                            if (ok) setQuickAddStageId(null);
                            return ok;
                          }}
                        />
                      )}

                      {/* Screen 02: Drag Drop Target Guidance Banners */}
                      {draggingLeadId && draggingLead?.stageId !== stage.id && !isTerminal && !isDisqualified && snapshot.isDraggingOver && (
                        <div className="flex flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-emerald-500 bg-emerald-50/90 p-3 text-center dark:bg-emerald-950/60">
                          <span className="flex size-6 items-center justify-center rounded-full bg-emerald-600 text-white">
                            <Check className="size-3.5" aria-hidden="true" />
                          </span>
                          <span className="text-xs font-bold text-emerald-900 dark:text-emerald-200">
                            {isAr
                              ? `أفلت للنقل إلى "${localizedName(stage, lang)}"`
                              : `Release to move to "${localizedName(stage, lang)}"`}
                          </span>
                          <span className="text-[11px] text-emerald-700 dark:text-emerald-300">
                            {isQualified
                              ? isAr
                                ? "يحدّث حالة التأهيل ويفتح خيار التحويل لعميل"
                                : "Snapshots stageFlag = QUALIFIED & unlocks Convert"
                              : isAr
                                ? "يتم الحفظ الفوري مع إمكانية التراجع"
                                : "Optimistic stage transition with instant sync"}
                          </span>
                        </div>
                      )}

                      {draggingLeadId && isDisqualified && (
                        <div className="flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-red-400 bg-red-50/80 px-3 py-2 text-center text-[11px] font-semibold text-red-700 dark:border-red-800 dark:bg-red-950/50 dark:text-red-300">
                          <AlertTriangle className="size-3.5 shrink-0" aria-hidden="true" />
                          <span>
                            {isAr
                              ? "الإفلات هنا ينقل العميل إلى مرحلة مستبعد"
                              : "Dropping here moves lead to Disqualified stage"}
                          </span>
                        </div>
                      )}

                      {draggingLeadId && isTerminal && (
                        <div className="my-auto flex flex-col items-center justify-center gap-2 rounded-xl border border-blue-200 bg-white p-4 text-center shadow-xs dark:border-slate-800 dark:bg-slate-900">
                          <span className="flex size-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400">
                            <Lock className="size-4" aria-hidden="true" />
                          </span>
                          <p className="text-xs font-bold text-slate-900 dark:text-slate-100">
                            {isAr ? "مرحلة تحويل محمية" : "Protected Terminal Stage"}
                          </p>
                          <p className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
                            {isAr
                              ? "النقل المباشر محمي؛ الإفلات هنا يفتح صفحة العميل ونافذة التحويل إلى عميل وفرصة بيعية."
                              : "Direct stage move is gated by backend rule. Dropping here opens the Lead Conversion flow to create Customer + Opportunity."}
                          </p>
                        </div>
                      )}

                      {stageLeads.length === 0 && !isQuickAddOpen && !(draggingLeadId && isTerminal) && (
                        <div className="flex min-h-32 flex-1 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-200/90 bg-white/50 p-4 text-center dark:border-slate-800 dark:bg-slate-900/40">
                          <span className="text-xs text-slate-400 dark:text-slate-500">
                            {t.crmLeads.emptyColumn}
                          </span>
                          {canCreate && !isTerminal && (
                            <button
                              type="button"
                              onClick={() => setQuickAddStageId(stage.id)}
                              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-blue-600 shadow-2xs hover:bg-blue-50 dark:border-slate-700 dark:bg-slate-800 dark:text-blue-400"
                            >
                              <Plus className="size-3" aria-hidden="true" />
                              <span>{isAr ? "إضافة عميل سريع" : "Quick Add Lead"}</span>
                            </button>
                          )}
                        </div>
                      )}

                      {stageLeads.map((lead, index) => {
                        const isCardExpanded = editingLeadId === lead.id;
                        const canEditLead = canUpdate(lead) && !isTerminal;
                        const moveTargets: LeadCardMoveTarget[] = nonTerminalStages
                          .filter((s) => s.id !== lead.stageId)
                          .map((s) => ({ id: s.id, label: localizedName(s, lang) }));

                        return (
                          <Draggable
                            key={lead.id}
                            draggableId={lead.id}
                            index={index}
                            isDragDisabled={isMovePending || !canEditLead || isCardExpanded}
                          >
                            {(dragProvided, dragSnapshot) => (
                              <div
                                ref={dragProvided.innerRef}
                                {...dragProvided.draggableProps}
                                {...dragProvided.dragHandleProps}
                              >
                                {isCardExpanded ? (
                                  <BoardCardExpandedView
                                    lead={lead}
                                    stage={stage}
                                    sources={sources}
                                    canUpdate={canUpdate(lead)}
                                    canDelete={canDelete(lead)}
                                    moveTargets={moveTargets}
                                    onCollapse={() => setEditingLeadId(null)}
                                    onOpenLead={() => onOpenLead(lead)}
                                    onOpenQuickModal={() => onOpenQuickModal(lead)}
                                    onOpenActivities={() => onOpenActivities(lead)}
                                    onDelete={() => onDeleteLead(lead)}
                                    onMoveStage={(targetStageId) =>
                                      onMoveStage(lead.id, targetStageId, lead)
                                    }
                                    onCardChange={(patch) => onCardChange(lead.id, patch, lead)}
                                  />
                                ) : (
                                  <ExecutiveBoardCard
                                    lead={lead}
                                    stage={stage}
                                    isDragging={dragSnapshot.isDragging}
                                    draggingFromLabel={
                                      draggingFromStage ? localizedName(draggingFromStage, lang) : ""
                                    }
                                    draggingToLabel={
                                      draggingToStage ? localizedName(draggingToStage, lang) : ""
                                    }
                                    canUpdate={canUpdate(lead)}
                                    canDelete={canDelete(lead)}
                                    moveTargets={moveTargets}
                                    onOpenLead={() => onOpenLead(lead)}
                                    onExpandView={() => setEditingLeadId(lead.id)}
                                    onOpenQuickModal={() => onOpenQuickModal(lead)}
                                    onOpenActivities={() => onOpenActivities(lead)}
                                    onDelete={() => onDeleteLead(lead)}
                                    onMoveStage={(targetStageId) =>
                                      onMoveStage(lead.id, targetStageId, lead)
                                    }
                                    onCardChange={(patch) => onCardChange(lead.id, patch, lead)}
                                  />
                                )}
                              </div>
                            )}
                          </Draggable>
                        );
                      })}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>

                {hasMoreStage(stage.id) && (
                  <div className="shrink-0 border-t border-slate-200/80 bg-white p-2 dark:border-slate-800 dark:bg-slate-900">
                    <Button
                      variant="ghost"
                      size="xs"
                      className="w-full"
                      disabled={isLoadingMoreStage(stage.id)}
                      onClick={() => onLoadMoreStage(stage.id)}
                    >
                      {isLoadingMoreStage(stage.id)
                        ? t.crmLeads.loadingMore
                        : t.crmLeads.loadMore(stageLeads.length, totalCount)}
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </DragDropContext>

      {/* Screen 02: Floating Bottom Quick-Drop Stage Dock (Visible during Drag or Quick Action) */}
      {draggingLead && (
        <div className="fixed inset-x-0 bottom-4 z-40 mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-700 bg-slate-950/95 px-4 py-2.5 text-white shadow-2xl backdrop-blur-md">
          <div className="flex items-center gap-2 text-xs font-semibold text-amber-400">
            <Sparkles className="size-4" aria-hidden="true" />
            <span>{isAr ? "نقل سريع للمرحلة:" : "Quick Drop Stage:"}</span>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {stages.map((st) => {
              const isCurrent = st.id === draggingLead.stageId;
              const isTerm = st.flag === "CONVERTED";
              const isQual = st.flag === "QUALIFIED";
              const isDisq = st.flag === "DISQUALIFIED";
              return (
                <button
                  key={st.id}
                  type="button"
                  disabled={isCurrent}
                  onClick={() => {
                    setDraggingLeadId(null);
                    if (isTerm) {
                      onOpenLead(draggingLead);
                    } else {
                      onMoveStage(draggingLead.id, st.id, draggingLead);
                    }
                  }}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-semibold transition-all",
                    isCurrent
                      ? "border-slate-700 bg-slate-800/50 text-slate-500"
                      : isTerm
                        ? "border-blue-500 bg-blue-600/30 text-blue-200 hover:bg-blue-600/50"
                        : isQual
                          ? "border-emerald-500 bg-emerald-950/80 text-emerald-300 hover:bg-emerald-900"
                          : isDisq
                            ? "border-red-500/70 bg-red-950/60 text-red-300 hover:bg-red-900"
                            : "border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800",
                  )}
                >
                  {isQual && <Check className="size-3" aria-hidden="true" />}
                  {isTerm && <Sparkles className="size-3" aria-hidden="true" />}
                  <span>
                    {isTerm
                      ? isAr
                        ? "تحويل إلى عميل..."
                        : "Convert to Customer..."
                      : localizedName(st, lang)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================================================================
 * Executive Board Card (Collapsed Normal View)
 * - Removes phone number and acquisition source from collapsed view
 * - Replaces top-right inline edit pencil with ChevronDown to expand View Mode
 * ========================================================================== */

interface ExecutiveBoardCardProps {
  lead: LeadItem;
  stage: LeadStage;
  isDragging: boolean;
  draggingFromLabel: string;
  draggingToLabel: string;
  canUpdate: boolean;
  canDelete: boolean;
  moveTargets: readonly LeadCardMoveTarget[];
  onOpenLead: () => void;
  onExpandView: () => void;
  onOpenQuickModal: () => void;
  onOpenActivities: () => void;
  onDelete: () => void;
  onMoveStage: (stageId: string) => void;
  onCardChange: (patch: LeadCardPatch) => void;
}

function ExecutiveBoardCard({
  lead,
  stage,
  isDragging,
  draggingFromLabel,
  draggingToLabel,
  canUpdate,
  canDelete,
  moveTargets,
  onOpenLead,
  onExpandView,
  onOpenQuickModal,
  onOpenActivities,
  onDelete,
  onMoveStage,
  onCardChange,
}: ExecutiveBoardCardProps) {
  const { t, lang } = useI18n();
  const isAr = lang === "ar";
  const cardDict = t.crmLeads.card;

  const { title, contactName } = leadCardHeading(lead);
  const isCompany = lead.leadProfileType === "CORPORATE";

  const activityState = leadActivityState(lead.nextActivity);
  const initials = lead.owner ? leadOwnerInitials(lead.owner) : "";
  const ownerFullName = lead.owner
    ? [lead.owner.firstName, lead.owner.lastName].filter(Boolean).join(" ")
    : "";

  const borderAccent = lead.cardColor
    ? CARD_BORDER_ACCENT[lead.cardColor] ?? "border-slate-200/90 dark:border-slate-800"
    : stage.flag === "QUALIFIED" || stage.flag === "CONVERTED"
      ? "border-emerald-200/90 border-s-4 border-s-emerald-500 dark:border-emerald-900/70"
      : activityState === "OVERDUE"
        ? "border-amber-300/90 border-s-4 border-s-amber-500 dark:border-amber-800"
        : "border-slate-200/90 dark:border-slate-800";

  const activityBadgeTone =
    activityState === "OVERDUE"
      ? "border-red-200 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/60 dark:text-red-300"
      : activityState === "TODAY"
        ? "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/60 dark:text-amber-300"
        : activityState === "FUTURE"
          ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/60 dark:text-emerald-300"
          : "border-slate-200 bg-slate-100/80 text-slate-600 dark:border-slate-800 dark:bg-slate-800/70 dark:text-slate-400";

  const activityLabelText =
    stage.flag === "CONVERTED"
      ? isAr
        ? "تم التحويل ✓"
        : "Converted ✓"
      : stage.flag === "DISQUALIFIED"
        ? isAr
          ? "مغلق"
          : "Closed"
        : cardDict.activityStates[activityState];

  return (
    <div
      className={cn(
        "group relative flex flex-col gap-2 rounded-xl border bg-white p-3 shadow-2xs transition-all hover:border-blue-300 hover:shadow-md dark:bg-slate-900",
        borderAccent,
        isDragging && "rotate-1 scale-[1.02] border-2 border-blue-600 shadow-2xl ring-4 ring-blue-500/15",
      )}
    >
      {/* Screen 02: Floating Dragging Header Banner */}
      {isDragging && (
        <div className="-mx-3 -mt-3 mb-1 flex items-center justify-between rounded-t-lg bg-blue-600 px-3 py-1.5 text-[11px] font-bold text-white">
          <span className="flex items-center gap-1 truncate">
            <GripVertical className="size-3.5 shrink-0" aria-hidden="true" />
            <span>
              {isAr ? "جاري نقل العميل" : "DRAGGING LEAD"} · {draggingFromLabel} →{" "}
              {draggingToLabel || draggingFromLabel}
            </span>
          </span>
          <span className="rounded-xs bg-white/20 px-1.5 py-0.5 text-[10px]">Space / Drop</span>
        </div>
      )}

      {/* Row 1: Icon + Bold Title + Expand ChevronDown + Menu */}
      <div className="flex items-center justify-between gap-1.5">
        <button
          type="button"
          onClick={onOpenLead}
          className="flex min-w-0 flex-1 items-center gap-1.5 text-start hover:text-blue-600"
        >
          {isCompany ? (
            <Building2 className="size-3.5 shrink-0 text-blue-600 dark:text-blue-400" aria-hidden="true" />
          ) : (
            <UserRound className="size-3.5 shrink-0 text-slate-500 dark:text-slate-400" aria-hidden="true" />
          )}
          <span className="truncate text-sm font-bold text-slate-900 group-hover:text-blue-600 dark:text-slate-100 dark:group-hover:text-blue-400">
            {title}
          </span>
        </button>

        <div
          className="flex shrink-0 items-center gap-1"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={onExpandView}
            title={isAr ? "عرض تفاصيل البطاقة" : "Expand Card Details"}
            aria-label={isAr ? "عرض تفاصيل البطاقة" : "Expand Card Details"}
            className="flex size-6 items-center justify-center rounded-md border border-slate-200 bg-slate-50 text-slate-600 transition-colors hover:border-blue-300 hover:bg-blue-50 hover:text-blue-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-blue-700 dark:hover:bg-blue-950/50 dark:hover:text-blue-400"
          >
            <ChevronDown className="size-3.5" aria-hidden="true" />
          </button>

          <LeadCardMenu
            cardColor={lead.cardColor}
            onOpen={onOpenLead}
            onDelete={canDelete ? onDelete : undefined}
            onColorChange={
              canUpdate ? (next: CardColor | null) => onCardChange({ cardColor: next }) : undefined
            }
            moveTargets={moveTargets}
            onMove={onMoveStage}
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

      {/* Row 2: Contact Person (Corporate only — Individual name is already shown once in Row 1) */}
      {isCompany && (
        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          <span className="flex min-w-0 items-center gap-1 truncate">
            <UserRound className="size-3 shrink-0 text-slate-400" aria-hidden="true" />
            <span className="truncate font-medium text-slate-700 dark:text-slate-300">
              {contactName || lead.primaryContact?.displayName || lead.primaryContactName || title}
            </span>
            {lead.primaryContact?.jobTitle && (
              <span className="truncate text-slate-400">
                · {lead.primaryContact.jobTitle}
              </span>
            )}
          </span>
        </div>
      )}

      {/* Row 3: Tags on Left + Relative Stage Age on Right (No Phone & No Source in Normal Mode) */}
      <div className="flex flex-wrap items-center justify-between gap-1.5">
        <div className="flex min-w-0 flex-wrap items-center gap-1">
          {lead.tags.slice(0, 2).map((tag) => (
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
          ))}
          {lead.tags.length > 2 && (
            <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              +{lead.tags.length - 2}
            </span>
          )}
        </div>

        <span className="ms-auto shrink-0 text-[11px] font-medium tabular-nums text-slate-400 dark:text-slate-500">
          {formatRelativeAge(lead.stageEnteredAt ?? lead.createdAt, isAr)}
        </span>
      </div>

      {/* Row 4: Footer Strip (3 Stars + Activity Badge + Quick 360° Trigger + Owner Initials) */}
      <div
        className="flex items-center justify-between gap-2 border-t border-slate-100 pt-2 dark:border-slate-800/80"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex min-w-0 items-center gap-2">
          {/* Interactive 3-Star Rating */}
          <div className="flex items-center gap-0.5" role="group" aria-label={cardDict.rating}>
            {[1, 2, 3].map((star) => {
              const filled = star <= lead.rating;
              return (
                <button
                  key={star}
                  type="button"
                  disabled={!canUpdate}
                  onClick={() => onCardChange({ rating: lead.rating === star ? 0 : star })}
                  aria-label={`Rate ${star} of 3`}
                  className="p-0.5 transition-transform hover:scale-110 disabled:cursor-default"
                >
                  <Star
                    className={cn(
                      "size-3.5",
                      filled
                        ? "fill-amber-400 text-amber-500"
                        : "text-slate-300 dark:text-slate-600",
                    )}
                    aria-hidden="true"
                  />
                </button>
              );
            })}
          </div>

          {/* Colored Activity Pill Trigger */}
          <button
            type="button"
            onClick={onOpenActivities}
            className={cn(
              "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-semibold transition-opacity hover:opacity-85",
              activityBadgeTone,
            )}
          >
            <Activity className="size-3 shrink-0" aria-hidden="true" />
            <span className="max-w-28 truncate">{activityLabelText}</span>
          </button>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={onOpenQuickModal}
            title={isAr ? "معاينة وتعديل سريع 360°" : "Open 360° Quick-Edit Modal"}
            aria-label={isAr ? "معاينة وتعديل سريع 360°" : "Open 360° Quick-Edit Modal"}
            className="flex size-6 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-blue-600 dark:hover:bg-slate-800"
          >
            <Eye className="size-3.5" aria-hidden="true" />
          </button>

          {initials && (
            <span
              title={formatTemplate(cardDict.owner, { name: ownerFullName })}
              className="flex size-6 items-center justify-center rounded-md border border-blue-200 bg-blue-50 text-[11px] font-bold text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300"
            >
              {initials}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/* ============================================================================
 * Phone Row with Instant Action Icons (Call / WhatsApp / Telegram)
 * ========================================================================== */

function PhoneActionRow({
  phone,
  country,
  isAr,
}: {
  phone: string;
  country: string;
  isAr: boolean;
}) {
  const callDigits = phone ? normalizePhoneDigits(phone) : "";
  const waDigits = phone ? normalizeWhatsAppDigits(phone, country) : null;
  const tgDigits = waDigits;

  return (
    <div className="flex items-center justify-between gap-2 rounded-lg border border-slate-200/80 bg-slate-50/90 px-2.5 py-1.5 dark:border-slate-800 dark:bg-slate-800/50">
      {phone ? (
        <span
          dir="ltr"
          className="truncate font-mono text-xs font-bold tracking-tight text-slate-800 dark:text-slate-100"
        >
          {phone}
        </span>
      ) : (
        <span className="text-xs text-slate-400 dark:text-slate-500">
          {isAr ? "لا يوجد رقم هاتف" : "No phone number"}
        </span>
      )}

      <div className="flex shrink-0 items-center gap-1">
        {callDigits ? (
          <a
            href={`tel:${callDigits}`}
            title={`Call ${phone}`}
            aria-label={`Call ${phone}`}
            className="flex size-6 items-center justify-center rounded-md border border-emerald-200 bg-emerald-50 text-emerald-700 transition-colors hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300"
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
            title={`WhatsApp ${phone}`}
            aria-label={`WhatsApp ${phone}`}
            className="flex size-6 items-center justify-center rounded-md border border-emerald-200 bg-emerald-50 text-emerald-700 transition-colors hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300"
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
            title={`Telegram ${phone}`}
            aria-label={`Telegram ${phone}`}
            className="flex size-6 items-center justify-center rounded-md border border-sky-200 bg-sky-50 text-sky-600 transition-colors hover:bg-sky-100 dark:border-sky-800 dark:bg-sky-950/70 dark:text-sky-300"
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
  );
}

/* ============================================================================
 * Expanded Card View Mode (Replaces Inline Editor in Board View)
 * - Individual: up to 2 phone numbers + action icons
 * - Corporate with 1 primary contact: primary contact's 1 or at most 2 phones + icons
 * - Corporate with >1 contacts: up to 3 contacts, each with their first phone + icons
 * - Displays Source (icon + name), Salesperson (Owner), Location, Tags, and Footer
 * - No bottom action buttons (Full Edit / Cancel / Save removed)
 * ========================================================================== */

interface BoardCardExpandedViewProps {
  lead: LeadItem;
  stage: LeadStage;
  sources: ReadonlyArray<AcquisitionSource>;
  canUpdate: boolean;
  canDelete: boolean;
  moveTargets: readonly LeadCardMoveTarget[];
  onCollapse: () => void;
  onOpenLead: () => void;
  onOpenQuickModal: () => void;
  onOpenActivities: () => void;
  onDelete: () => void;
  onMoveStage: (stageId: string) => void;
  onCardChange: (patch: LeadCardPatch) => void;
}

function BoardCardExpandedView({
  lead,
  stage,
  sources,
  canUpdate,
  canDelete,
  moveTargets,
  onCollapse,
  onOpenLead,
  onOpenQuickModal,
  onOpenActivities,
  onDelete,
  onMoveStage,
  onCardChange,
}: BoardCardExpandedViewProps) {
  const { t, lang } = useI18n();
  const isAr = lang === "ar";
  const cardDict = t.crmLeads.card;
  const isCompany = lead.leadProfileType === "CORPORATE";
  const { title, contactName } = leadCardHeading(lead);

  const [detail, setDetail] = useState<LeadDetail | null>(null);

  // Fetch full lead detail on expand so corporate leads with multiple contacts
  // display up to 3 contacts and all stored phone numbers accurately.
  useEffect(() => {
    if (!isUUIDv7(lead.id)) return;
    const controller = new AbortController();
    axiosClient
      .get(leadPath(lead.id), {
        signal: controller.signal,
        cache: "no-store",
        maxResponseBytes: 512 * 1024,
      })
      .then((res) => {
        if (controller.signal.aborted) return;
        setDetail(parseLeadDetailResponse(res.data));
      })
      .catch(() => {
        // Fallback to LeadItem summary data if detail endpoint fails
      });
    return () => controller.abort();
  }, [lead.id]);

  const matchedSource = useMemo(
    () =>
      sources.find(
        (s) =>
          (lead.acquisitionSourceId && s.id === lead.acquisitionSourceId) ||
          (lead.sourceNameEn && s.nameEn === lead.sourceNameEn) ||
          (lead.sourceNameAr && s.nameAr === lead.sourceNameAr),
      ) ?? null,
    [lead.acquisitionSourceId, lead.sourceNameAr, lead.sourceNameEn, sources],
  );
  const sourceLabel =
    localizedValue(lead.sourceNameAr, lead.sourceNameEn, lang) ||
    (matchedSource ? localizedName(matchedSource, lang) : "");
  const resolvedSourceIconUrl = lead.sourceIconUrl ?? matchedSource?.iconUrl ?? null;

  // Resolve Individual phones (max 2)
  const individualPhones = useMemo(() => {
    const raw = [
      ...(detail?.phones ?? []),
      ...lead.phones,
      lead.primaryMobile,
      lead.phone,
    ]
      .map((p) => (p ?? "").trim())
      .filter((p) => p.length > 0);
    return Array.from(new Set(raw)).slice(0, 2);
  }, [detail?.phones, lead.phone, lead.phones, lead.primaryMobile]);

  // Resolve Corporate contacts from detail (or fallback to lead.primaryContact)
  const corporateContacts = useMemo<
    ReadonlyArray<{
      partyId: string;
      displayName: string;
      jobTitle: string | null;
      isPrimary: boolean;
      phones: readonly string[];
    }>
  >(() => {
    if (detail && detail.contacts.length > 0) {
      return detail.contacts;
    }
    if (lead.primaryContact) {
      return [lead.primaryContact];
    }
    const fallbackName = contactName || lead.primaryContactName || "";
    const fallbackPhone = lead.primaryMobile || lead.phone || lead.phones[0] || "";
    if (fallbackName || fallbackPhone) {
      return [
        {
          partyId: "",
          displayName: fallbackName || title,
          jobTitle: "",
          isPrimary: true,
          phones: fallbackPhone ? [fallbackPhone] : [],
        },
      ];
    }
    return [];
  }, [
    contactName,
    detail,
    lead.phone,
    lead.phones,
    lead.primaryContact,
    lead.primaryContactName,
    lead.primaryMobile,
    title,
  ]);

  // Resolve Company's own phone numbers (up to 2)
  const companyPhones = useMemo(() => {
    if (!isCompany) return [];
    const raw = [
      detail?.companyPhone,
      ...(detail?.phones ?? []),
      lead.phone,
      ...lead.phones,
    ]
      .map((p) => (p ?? "").trim())
      .filter((p) => p.length > 0);
    return Array.from(new Set(raw)).slice(0, 2);
  }, [detail?.companyPhone, detail?.phones, isCompany, lead.phone, lead.phones]);

  const hasMultipleCorporateContacts = isCompany && corporateContacts.length > 1;
  const singleCorporateContact = isCompany ? (corporateContacts[0] ?? null) : null;
  const singleCorporateContactPhones = useMemo(() => {
    if (!isCompany) return [];
    const raw = [
      ...(singleCorporateContact?.phones ?? []),
      ...(lead.primaryContact?.phones ?? []),
      lead.primaryMobile,
    ]
      .map((p) => (p ?? "").trim())
      .filter((p) => p.length > 0);
    return Array.from(new Set(raw)).slice(0, 2);
  }, [
    isCompany,
    lead.primaryContact?.phones,
    lead.primaryMobile,
    singleCorporateContact?.phones,
  ]);

  const activityState = leadActivityState(lead.nextActivity);
  const initials = lead.owner ? leadOwnerInitials(lead.owner) : "";
  const ownerFullName = lead.owner
    ? [lead.owner.firstName, lead.owner.lastName].filter(Boolean).join(" ")
    : "";

  const activityBadgeTone =
    activityState === "OVERDUE"
      ? "border-red-200 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/60 dark:text-red-300"
      : activityState === "TODAY"
        ? "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/60 dark:text-amber-300"
        : activityState === "FUTURE"
          ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/60 dark:text-emerald-300"
          : "border-slate-200 bg-slate-100/80 text-slate-600 dark:border-slate-800 dark:bg-slate-800/70 dark:text-slate-400";

  const activityLabelText =
    stage.flag === "CONVERTED"
      ? isAr
        ? "تم التحويل ✓"
        : "Converted ✓"
      : stage.flag === "DISQUALIFIED"
        ? isAr
          ? "مغلق"
          : "Closed"
        : cardDict.activityStates[activityState];

  return (
    <div
      className="flex flex-col gap-2.5 rounded-xl border-2 border-blue-600 bg-white p-3 shadow-lg dark:bg-slate-900"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header Row: Icon + Title + Collapse ChevronUp + Menu */}
      <div className="flex items-center justify-between gap-1.5">
        <button
          type="button"
          onClick={onOpenLead}
          className="flex min-w-0 flex-1 items-center gap-1.5 text-start hover:text-blue-600"
        >
          {isCompany ? (
            <Building2 className="size-3.5 shrink-0 text-blue-600 dark:text-blue-400" aria-hidden="true" />
          ) : (
            <UserRound className="size-3.5 shrink-0 text-slate-500 dark:text-slate-400" aria-hidden="true" />
          )}
          <span className="truncate text-sm font-bold text-slate-900 hover:text-blue-600 dark:text-slate-100 dark:hover:text-blue-400">
            {title}
          </span>
        </button>

        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={onCollapse}
            title={isAr ? "طي البطاقة" : "Collapse Card"}
            aria-label={isAr ? "طي البطاقة" : "Collapse Card"}
            className="flex size-6 items-center justify-center rounded-md border border-blue-200 bg-blue-50 text-blue-700 transition-colors hover:bg-blue-100 dark:border-blue-800/70 dark:bg-blue-950/60 dark:text-blue-300"
          >
            <ChevronUp className="size-3.5" aria-hidden="true" />
          </button>

          <LeadCardMenu
            cardColor={lead.cardColor}
            onOpen={onOpenLead}
            onDelete={canDelete ? onDelete : undefined}
            onColorChange={
              canUpdate ? (next: CardColor | null) => onCardChange({ cardColor: next }) : undefined
            }
            moveTargets={moveTargets}
            onMove={onMoveStage}
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

      {/* Subheader: Stage Age */}
      <div className="flex items-center justify-end gap-2 text-xs text-slate-500 dark:text-slate-400">
        <span className="shrink-0 text-[11px] font-medium tabular-nums text-slate-400 dark:text-slate-500">
          {formatRelativeAge(lead.stageEnteredAt ?? lead.createdAt, isAr)}
        </span>
      </div>

      {/* Contacts & Phones Section according to Profile & Contact Count Rules */}
      {!isCompany ? (
        /* INDIVIDUAL: Show mobile numbers up to 2 at most + action icons */
        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
            {isAr ? "أرقام الهاتف (بحد أقصى ٢)" : "Phone Numbers (up to 2)"}
          </span>
          {individualPhones.length > 0 ? (
            individualPhones.map((ph, idx) => (
              <PhoneActionRow
                key={`ind-ph-${idx}-${ph}`}
                phone={ph}
                country={lead.country}
                isAr={isAr}
              />
            ))
          ) : (
            <PhoneActionRow phone="" country={lead.country} isAr={isAr} />
          )}
        </div>
      ) : (
        <>
          {/* COMPANY PHONE SECTION */}
          <div className="flex flex-col gap-1.5">
            <span className="flex items-center gap-1 text-[11px] font-medium text-slate-500 dark:text-slate-400">
              <Building2 className="size-3 shrink-0 text-blue-600 dark:text-blue-400" aria-hidden="true" />
              <span>{isAr ? "هاتف الشركة" : "Company Phone"}</span>
            </span>
            {companyPhones.length > 0 ? (
              companyPhones.map((ph, idx) => (
                <PhoneActionRow
                  key={`corp-company-ph-${idx}-${ph}`}
                  phone={ph}
                  country={lead.country}
                  isAr={isAr}
                />
              ))
            ) : (
              <PhoneActionRow phone="" country={lead.country} isAr={isAr} />
            )}
          </div>

          {hasMultipleCorporateContacts ? (
            /* COMPANY WITH > 1 CONTACT: Show up to 3 contacts at most, each with their first phone only + icons */
            <div className="flex flex-col gap-1.5">
              <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                {isAr
                  ? `جهات الاتصال (${Math.min(corporateContacts.length, 3)} من ${corporateContacts.length})`
                  : `Contacts (${Math.min(corporateContacts.length, 3)} of ${corporateContacts.length})`}
              </span>
              {corporateContacts.slice(0, 3).map((contact, idx) => {
                const firstPhone = contact.phones[0] ?? "";
                return (
                  <div
                    key={contact.partyId || `corp-contact-${idx}`}
                    className="flex flex-col gap-1 rounded-lg border border-slate-200/80 bg-slate-50/40 p-2 dark:border-slate-800 dark:bg-slate-800/30"
                  >
                    <div className="flex items-center justify-between gap-1.5 text-xs">
                      <span className="flex min-w-0 items-center gap-1 truncate font-semibold text-slate-800 dark:text-slate-200">
                        <UserRound className="size-3 shrink-0 text-blue-600 dark:text-blue-400" aria-hidden="true" />
                        <span className="truncate">{contact.displayName}</span>
                        {contact.jobTitle && (
                          <span className="truncate text-[11px] font-normal text-slate-400">
                            · {contact.jobTitle}
                          </span>
                        )}
                      </span>
                      {contact.isPrimary && (
                        <span className="shrink-0 rounded-xs bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700 dark:bg-blue-950/70 dark:text-blue-300">
                          {isAr ? "أساسي" : "Primary"}
                        </span>
                      )}
                    </div>
                    <PhoneActionRow phone={firstPhone} country={lead.country} isAr={isAr} />
                  </div>
                );
              })}
            </div>
          ) : (
            /* COMPANY WITH 1 PRIMARY CONTACT: Show primary contact + 1 or at most 2 phones + icons */
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between gap-1.5 text-xs">
                <span className="flex min-w-0 items-center gap-1 truncate font-semibold text-slate-800 dark:text-slate-200">
                  <UserRound className="size-3 shrink-0 text-blue-600 dark:text-blue-400" aria-hidden="true" />
                  <span className="truncate">
                    {singleCorporateContact?.displayName ||
                      contactName ||
                      lead.primaryContact?.displayName ||
                      lead.primaryContactName ||
                      title}
                  </span>
                  {(singleCorporateContact?.jobTitle || lead.primaryContact?.jobTitle) && (
                    <span className="truncate text-[11px] font-normal text-slate-400">
                      · {singleCorporateContact?.jobTitle || lead.primaryContact?.jobTitle}
                    </span>
                  )}
                </span>
                <span className="shrink-0 rounded-xs bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700 dark:bg-blue-950/70 dark:text-blue-300">
                  {isAr ? "أساسي" : "Primary"}
                </span>
              </div>
              {singleCorporateContactPhones.length > 0 ? (
                singleCorporateContactPhones.map((ph, idx) => (
                  <PhoneActionRow
                    key={`corp-single-ph-${idx}-${ph}`}
                    phone={ph}
                    country={lead.country}
                    isAr={isAr}
                  />
                ))
              ) : (
                <PhoneActionRow phone="" country={lead.country} isAr={isAr} />
              )}
            </div>
          )}
        </>
      )}

      {/* Owner & Acquisition Source (Read-Only View Mode) */}
      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-1">
          <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
            {isAr ? "مسؤول المبيعات" : "Salesperson"}
          </span>
          <div className="flex h-7 items-center rounded-md border border-slate-200/80 bg-slate-50 px-2 text-xs font-medium text-slate-700 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-200">
            <span className="truncate">
              {ownerFullName || (isAr ? "غير معين" : "Unassigned")}
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
            {isAr ? "مصدر الاستقطاب" : "Acquisition Source"}
          </span>
          <div className="flex h-7 items-center gap-1.5 rounded-md border border-slate-200/80 bg-slate-50 px-2 text-xs font-medium text-slate-700 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-200">
            {sourceLabel ? (
              <>
                <AcquisitionSourceIcon source={{ iconUrl: resolvedSourceIconUrl }} />
                <span className="truncate">{sourceLabel}</span>
              </>
            ) : (
              <span className="truncate text-slate-400">{isAr ? "غير محدد" : "Not set"}</span>
            )}
          </div>
        </div>
      </div>

      {/* Tags (All tags shown in Expanded View Mode) */}
      {lead.tags.length > 0 && (
        <div className="flex flex-col gap-1">
          <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
            {isAr ? "الوسوم" : "Tags"}
          </span>
          <div className="flex flex-wrap items-center gap-1">
            {lead.tags.map((tag) => (
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
                  "inline-flex items-center truncate rounded-md px-2 py-0.5 text-[11px] font-semibold",
                  !tag.backgroundColor &&
                    "border border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
                )}
              >
                {tag.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Footer Strip (3 Stars + Activity Badge + Quick 360° Trigger + Owner Initials — No Save/Cancel buttons) */}
      <div className="flex items-center justify-between gap-2 border-t border-slate-100 pt-2 dark:border-slate-800/80">
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex items-center gap-0.5" role="group" aria-label={cardDict.rating}>
            {[1, 2, 3].map((star) => {
              const filled = star <= lead.rating;
              return (
                <button
                  key={star}
                  type="button"
                  disabled={!canUpdate}
                  onClick={() => onCardChange({ rating: lead.rating === star ? 0 : star })}
                  aria-label={`Rate ${star} of 3`}
                  className="p-0.5 transition-transform hover:scale-110 disabled:cursor-default"
                >
                  <Star
                    className={cn(
                      "size-3.5",
                      filled
                        ? "fill-amber-400 text-amber-500"
                        : "text-slate-300 dark:text-slate-600",
                    )}
                    aria-hidden="true"
                  />
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={onOpenActivities}
            className={cn(
              "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-semibold transition-opacity hover:opacity-85",
              activityBadgeTone,
            )}
          >
            <Activity className="size-3 shrink-0" aria-hidden="true" />
            <span className="max-w-28 truncate">{activityLabelText}</span>
          </button>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={onOpenQuickModal}
            title={isAr ? "معاينة وتعديل سريع 360°" : "Open 360° Quick-Edit Modal"}
            aria-label={isAr ? "معاينة وتعديل سريع 360°" : "Open 360° Quick-Edit Modal"}
            className="flex size-6 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-blue-600 dark:hover:bg-slate-800"
          >
            <Eye className="size-3.5" aria-hidden="true" />
          </button>

          {initials && (
            <span
              title={formatTemplate(cardDict.owner, { name: ownerFullName })}
              className="flex size-6 items-center justify-center rounded-md border border-blue-200 bg-blue-50 text-[11px] font-bold text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300"
            >
              {initials}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/* ============================================================================
 * Screen 03: In-Column Quick-Add Lead Composer Card (`⚡ Quick Add Lead in "New"`)
 * ========================================================================== */

interface BoardColumnQuickAddCardProps {
  stage: LeadStage;
  branchId: string;
  sources: ReadonlyArray<AcquisitionSource>;
  onCancel: () => void;
  onOpenFullModal: (draft: QuickCreateLeadDraft) => void;
  onSubmit: (payload: CreateLeadRequest, rating?: number) => Promise<boolean>;
}

function findDefaultFacebookSourceId(sources: ReadonlyArray<AcquisitionSource>): string {
  const fb = sources.find((src) => {
    const en = (src.nameEn ?? "").trim().toLowerCase();
    const ar = (src.nameAr ?? "").trim().toLowerCase();
    return en.includes("facebook") || ar.includes("فيسبوك") || ar.includes("فيس بوك");
  });
  return fb?.id ?? sources[0]?.id ?? "";
}

function BoardColumnQuickAddCard({
  stage,
  branchId,
  sources,
  onCancel,
  onOpenFullModal,
  onSubmit,
}: BoardColumnQuickAddCardProps) {
  const { t, lang } = useI18n();
  const isAr = lang === "ar";
  const fieldMessages = useCrmFieldMessages();

  // Individual is first and default
  const [profileType, setProfileType] = useState<"INDIVIDUAL" | "CORPORATE">("INDIVIDUAL");

  // Individual state (always New Person: First + Last Name + Phone Number)
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [individualPhones, setIndividualPhones] = useState<string[]>([""]);

  // Company state (New Company vs Existing Company; Contact is always New)
  const [companyMode, setCompanyMode] = useState<"new" | "existing">("new");
  const [existingCompanyPartyId, setExistingCompanyPartyId] = useState("");
  const [selectedCompanyName, setSelectedCompanyName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [contactFirstName, setContactFirstName] = useState("");
  const [contactLastName, setContactLastName] = useState("");
  const [companyPhones, setCompanyPhones] = useState<string[]>([""]);
  const [contactPhones, setContactPhones] = useState<string[]>([""]);

  // Shared fields: Source (default Facebook) + Rating
  const [sourceId, setSourceId] = useState(() => findDefaultFacebookSourceId(sources));
  const [rating, setRating] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Sync default source (Facebook preferred) when sources load asynchronously
  useEffect(() => {
    if (!sourceId && sources.length > 0) {
      setSourceId(findDefaultFacebookSourceId(sources));
    }
  }, [sourceId, sources]);

  // Company lookup (reuses the same hook as Full Modal)
  const companyLookup = useLeadCompanyOptions(branchId, profileType === "CORPORATE");

  const [companyQuery, setCompanyQuery] = useState("");
  const companyComboboxOptions = useMemo<ComboboxOption[]>(() => {
    const needle = companyQuery.trim().toLowerCase();
    return companyLookup.companies
      .filter((c) => {
        if (!needle) return true;
        return [c.displayName, c.legalName, c.organizationName]
          .filter((name): name is string => Boolean(name))
          .some((name) => name.toLowerCase().includes(needle));
      })
      .map((c) => ({
        value: c.id,
        label: c.displayName,
        description: c.legalName ?? c.organizationName ?? undefined,
      }));
  }, [companyLookup.companies, companyQuery]);

  const selectedCompany = useMemo(
    () => companyLookup.companies.find((c) => c.id === existingCompanyPartyId) ?? null,
    [companyLookup.companies, existingCompanyPartyId],
  );

  function clearError(prefix: string) {
    setErrors((prev) => {
      if (!Object.keys(prev).some((k) => k === prefix || k.startsWith(`${prefix}.`))) {
        return prev;
      }
      const next: Record<string, string> = {};
      for (const [k, v] of Object.entries(prev)) {
        if (k !== prefix && !k.startsWith(`${prefix}.`)) {
          next[k] = v;
        }
      }
      return next;
    });
  }

  function handleOpenFullModal() {
    const effectiveSourceId = sourceId || findDefaultFacebookSourceId(sources);
    onOpenFullModal({
      leadProfileType: profileType,
      stageId: stage.id,
      acquisitionSourceId: effectiveSourceId,
      firstName,
      lastName,
      phones: individualPhones.length > 0 ? [...individualPhones] : [""],
      existingCompanyPartyId: companyMode === "existing" ? existingCompanyPartyId : "",
      companyName:
        companyMode === "existing"
          ? selectedCompany?.displayName || selectedCompanyName || ""
          : companyName,
      companyPhones:
        companyMode === "new" && companyPhones.length > 0 ? [...companyPhones] : [""],
      contactFirstName,
      contactLastName,
      contactPhones: contactPhones.length > 0 ? [...contactPhones] : [""],
    });
  }

  async function handleQuickSave() {
    if (isSubmitting) return;

    const bag = new CrmErrorBag(fieldMessages);
    const effectiveSourceId = sourceId || findDefaultFacebookSourceId(sources);
    bag.required("acquisitionSourceId", effectiveSourceId);

    if (profileType === "CORPORATE") {
      if (companyMode === "existing") {
        bag.required("existingCompanyPartyId", existingCompanyPartyId);
      } else {
        if (bag.required("companyName", companyName)) {
          bag.maxLength("companyName", companyName, LEAD_CREATE_LIMITS.companyName);
        }
        bag.phones("companyPhones", companyPhones);
      }

      if (bag.required("contactFirstName", contactFirstName)) {
        bag.maxLength("contactFirstName", contactFirstName, LEAD_CREATE_LIMITS.firstName);
      }
      bag.maxLength("contactLastName", contactLastName, LEAD_CREATE_LIMITS.lastName);
      bag.phones("contactPhones", contactPhones);
    } else {
      // INDIVIDUAL (always new person)
      if (bag.required("firstName", firstName)) {
        bag.maxLength("firstName", firstName, LEAD_CREATE_LIMITS.firstName);
      }
      if (bag.required("lastName", lastName)) {
        bag.maxLength("lastName", lastName, LEAD_CREATE_LIMITS.lastName);
      }
      bag.phones("phones", individualPhones);
    }

    if (Object.keys(bag.errors).length > 0) {
      setErrors(bag.errors);
      return;
    }

    setErrors({});
    setIsSubmitting(true);
    try {
      let payload: CreateLeadRequest;

      if (profileType === "CORPORATE") {
        const cleanCompanyPhones = companyPhones
          .map((p) => p.trim())
          .filter((p) => p.length > 0);
        const cleanContactPhones = contactPhones
          .map((p) => p.trim())
          .filter((p) => p.length > 0);

        const contactEntry = {
          firstName: contactFirstName.trim(),
          ...(contactLastName.trim() ? { lastName: contactLastName.trim() } : {}),
          isPrimary: true as const,
          ...(cleanContactPhones.length > 0 ? { phones: cleanContactPhones } : {}),
        };

        payload =
          companyMode === "existing"
            ? {
                branchId,
                leadProfileType: "CORPORATE",
                stageId: stage.id,
                existingCompanyPartyId,
                ...(effectiveSourceId ? { acquisitionSourceId: effectiveSourceId } : {}),
                contacts: [contactEntry],
              }
            : {
                branchId,
                leadProfileType: "CORPORATE",
                stageId: stage.id,
                companyName: companyName.trim(),
                ...(cleanCompanyPhones.length > 0 ? { companyPhones: cleanCompanyPhones } : {}),
                ...(effectiveSourceId ? { acquisitionSourceId: effectiveSourceId } : {}),
                contacts: [contactEntry],
              };
      } else {
        const cleanIndividualPhones = individualPhones
          .map((p) => p.trim())
          .filter((p) => p.length > 0);

        payload = {
          branchId,
          leadProfileType: "INDIVIDUAL",
          stageId: stage.id,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          ...(cleanIndividualPhones.length > 0 ? { phones: cleanIndividualPhones } : {}),
          ...(effectiveSourceId ? { acquisitionSourceId: effectiveSourceId } : {}),
        };
      }

      await onSubmit(payload, rating);
    } finally {
      setIsSubmitting(false);
    }
  }

  const sourceFieldNode = (
    <Field
      label={t.crmLeads.source}
      required
      error={errors.acquisitionSourceId}
    >
      <Select
        value={sourceId || undefined}
        onValueChange={(value) => {
          setSourceId(value);
          clearError("acquisitionSourceId");
        }}
      >
        <SelectTrigger size="sm">
          <SelectValue placeholder={t.crmLeads.create.selectSourcePlaceholder} />
        </SelectTrigger>
        <SelectContent>
          {sources.map((src) => (
            <SelectItem key={src.id} value={src.id}>
              <AcquisitionSourceOption
                source={src}
                label={localizedName(src, lang)}
              />
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );

  return (
    <div className="flex flex-col gap-2.5 rounded-xl border-2 border-emerald-500 bg-emerald-50/20 p-3 shadow-md dark:bg-emerald-950/20">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1 text-xs font-bold text-emerald-800 dark:text-emerald-300">
          <Sparkles className="size-3.5 text-emerald-600" aria-hidden="true" />
          <span>
            {isAr
              ? `إضافة سريعة في "${localizedName(stage, lang)}"`
              : `Quick Add Lead in "${localizedName(stage, lang)}"`}
          </span>
        </span>
        <button
          type="button"
          onClick={handleOpenFullModal}
          className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-emerald-700 hover:underline dark:text-emerald-400"
        >
          <span>{isAr ? "النموذج الكامل" : "Full Modal"}</span>
          <ExternalLink className="size-2.5" aria-hidden="true" />
        </button>
      </div>

      {/* Individual vs Company segmented toggle (Individual first & default) */}
      <div className="grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
        <button
          type="button"
          onClick={() => {
            setProfileType("INDIVIDUAL");
            setErrors({});
          }}
          className={cn(
            "flex items-center justify-center gap-1 rounded-md py-1 text-xs font-semibold transition-all",
            profileType === "INDIVIDUAL"
              ? "bg-white text-blue-700 shadow-2xs dark:bg-slate-900 dark:text-blue-400"
              : "text-slate-600 dark:text-slate-400",
          )}
        >
          <UserRound className="size-3.5" aria-hidden="true" />
          <span>{isAr ? "فرد" : "Individual"}</span>
        </button>
        <button
          type="button"
          onClick={() => {
            setProfileType("CORPORATE");
            setErrors({});
          }}
          className={cn(
            "flex items-center justify-center gap-1 rounded-md py-1 text-xs font-semibold transition-all",
            profileType === "CORPORATE"
              ? "bg-white text-blue-700 shadow-2xs dark:bg-slate-900 dark:text-blue-400"
              : "text-slate-600 dark:text-slate-400",
          )}
        >
          <Building2 className="size-3.5" aria-hidden="true" />
          <span>{isAr ? "شركة" : "Company"}</span>
        </button>
      </div>

      {/* ====================================================================
       * INDIVIDUAL MODE:
       * 1) First Name + Last Name
       * 2) Source
       * 3) Phone Number
       * ==================================================================== */}
      {profileType === "INDIVIDUAL" ? (
        <>
          <div className="grid grid-cols-2 gap-2">
            <Field
              label={t.crmLeads.create.firstName}
              required
              error={errors.firstName}
            >
              <Input
                size="sm"
                value={firstName}
                maxLength={LEAD_CREATE_LIMITS.firstName}
                onChange={(e) => {
                  setFirstName(e.target.value);
                  clearError("firstName");
                }}
                placeholder={isAr ? "الاسم الأول" : "First name"}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void handleQuickSave();
                  if (e.key === "Escape") onCancel();
                }}
              />
            </Field>
            <Field
              label={t.crmLeads.create.lastName}
              required
              error={errors.lastName}
            >
              <Input
                size="sm"
                value={lastName}
                maxLength={LEAD_CREATE_LIMITS.lastName}
                onChange={(e) => {
                  setLastName(e.target.value);
                  clearError("lastName");
                }}
                placeholder={isAr ? "اسم العائلة" : "Last name"}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void handleQuickSave();
                  if (e.key === "Escape") onCancel();
                }}
              />
            </Field>
          </div>

          {sourceFieldNode}

          <CrmPhoneListField
            label={t.crmLeads.create.phoneNumber}
            phones={individualPhones}
            path="phones"
            errors={errors}
            disabled={isSubmitting}
            onChange={(index, value) => {
              setIndividualPhones((prev) => prev.map((p, i) => (i === index ? value : p)));
              clearError("phones");
            }}
            onAdd={() =>
              setIndividualPhones((prev) =>
                prev.length < LEAD_CREATE_LIMITS.phones ? [...prev, ""] : prev,
              )
            }
            onRemove={(index) =>
              setIndividualPhones((prev) =>
                prev.length > 1 ? prev.filter((_, i) => i !== index) : [""],
              )
            }
            onBlur={() => {}}
          />
        </>
      ) : (
        /* ====================================================================
         * CORPORATE MODE:
         * 1) New Company / Existing Company toggle + Company Name (or Existing Company)
         * 2) Source
         * 3) Company Phone (when New Company)
         * 4) Contact Name (First Name + Last Name)
         * 5) Contact Phone
         * ==================================================================== */
        <>
          <div className="grid grid-cols-2 gap-1 rounded-lg border border-slate-200/80 bg-white p-0.5 dark:border-slate-700 dark:bg-slate-900">
            <button
              type="button"
              onClick={() => {
                setCompanyMode("new");
                setExistingCompanyPartyId("");
                setSelectedCompanyName("");
                setCompanyQuery("");
                companyLookup.selectCompany(null);
                setErrors({});
              }}
              className={cn(
                "rounded-md py-1 text-[11px] font-semibold transition-all",
                companyMode === "new"
                  ? "bg-emerald-600 text-white shadow-2xs"
                  : "text-slate-600 hover:text-slate-900 dark:text-slate-400",
              )}
            >
              {isAr ? "شركة جديدة" : "New Company"}
            </button>
            <button
              type="button"
              onClick={() => {
                setCompanyMode("existing");
                setErrors({});
              }}
              className={cn(
                "rounded-md py-1 text-[11px] font-semibold transition-all",
                companyMode === "existing"
                  ? "bg-emerald-600 text-white shadow-2xs"
                  : "text-slate-600 hover:text-slate-900 dark:text-slate-400",
              )}
            >
              {isAr ? "شركة حالية" : "Existing Company"}
            </button>
          </div>

          {/* 1) Company Name (or Existing Company selector) */}
          {companyMode === "new" ? (
            <Field
              label={t.crmLeads.companyName}
              required
              error={errors.companyName}
            >
              <Input
                size="sm"
                value={companyName}
                maxLength={LEAD_CREATE_LIMITS.companyName}
                onChange={(e) => {
                  setCompanyName(e.target.value);
                  clearError("companyName");
                }}
                placeholder="Palm Hills Commercial..."
                onKeyDown={(e) => {
                  if (e.key === "Enter") void handleQuickSave();
                  if (e.key === "Escape") onCancel();
                }}
              />
            </Field>
          ) : (
            <Field
              label={isAr ? "شركة حالية" : "Existing Company"}
              required
              error={errors.existingCompanyPartyId}
            >
              <Combobox
                size="sm"
                options={companyComboboxOptions}
                value={existingCompanyPartyId}
                selectedLabel={selectedCompany?.displayName || selectedCompanyName || undefined}
                onValueChange={(id) => {
                  const nextId = id ?? "";
                  const matched = companyLookup.companies.find((c) => c.id === nextId);
                  setExistingCompanyPartyId(nextId);
                  setSelectedCompanyName(matched?.displayName ?? "");
                  setCompanyQuery("");
                  companyLookup.selectCompany(nextId || null);
                  clearError("existingCompanyPartyId");
                }}
                onSearch={setCompanyQuery}
                debounceMs={0}
                loading={companyLookup.isLoadingCompanies}
                loadingLabel={t.common.loading}
                placeholder={isAr ? "اختر شركة حالية..." : "Select existing company..."}
                searchPlaceholder={t.crmShared.searchCompanies}
                emptyLabel={t.crmShared.noMatchingCompanies}
              />
            </Field>
          )}

          {/* 2) Acquisition Source */}
          {sourceFieldNode}

          {/* 3) Company Phone (only when New Company) */}
          {companyMode === "new" && (
            <CrmPhoneListField
              label={t.crmLeads.create.companyPhones}
              phones={companyPhones}
              path="companyPhones"
              errors={errors}
              disabled={isSubmitting}
              onChange={(index, value) => {
                setCompanyPhones((prev) => prev.map((p, i) => (i === index ? value : p)));
                clearError("companyPhones");
              }}
              onAdd={() =>
                setCompanyPhones((prev) =>
                  prev.length < LEAD_CREATE_LIMITS.phones ? [...prev, ""] : prev,
                )
              }
              onRemove={(index) =>
                setCompanyPhones((prev) =>
                  prev.length > 1 ? prev.filter((_, i) => i !== index) : [""],
                )
              }
              onBlur={() => {}}
            />
          )}

          {/* 4) Contact Name (First Name + Last Name) */}
          <div className="grid grid-cols-2 gap-2">
            <Field
              label={t.crmLeads.create.firstName}
              required
              error={errors.contactFirstName}
            >
              <Input
                size="sm"
                value={contactFirstName}
                maxLength={LEAD_CREATE_LIMITS.firstName}
                onChange={(e) => {
                  setContactFirstName(e.target.value);
                  clearError("contactFirstName");
                }}
                placeholder={isAr ? "الاسم الأول" : "First name"}
              />
            </Field>
            <Field
              label={t.crmLeads.create.lastName}
              error={errors.contactLastName}
            >
              <Input
                size="sm"
                value={contactLastName}
                maxLength={LEAD_CREATE_LIMITS.lastName}
                onChange={(e) => {
                  setContactLastName(e.target.value);
                  clearError("contactLastName");
                }}
                placeholder={isAr ? "اسم العائلة" : "Last name"}
              />
            </Field>
          </div>

          {/* 5) Contact Phone */}
          <CrmPhoneListField
            label={isAr ? "هاتف جهة الاتصال" : "Contact Phone"}
            phones={contactPhones}
            path="contactPhones"
            errors={errors}
            disabled={isSubmitting}
            onChange={(index, value) => {
              setContactPhones((prev) => prev.map((p, i) => (i === index ? value : p)));
              clearError("contactPhones");
            }}
            onAdd={() =>
              setContactPhones((prev) =>
                prev.length < LEAD_CREATE_LIMITS.phones ? [...prev, ""] : prev,
              )
            }
            onRemove={(index) =>
              setContactPhones((prev) =>
                prev.length > 1 ? prev.filter((_, i) => i !== index) : [""],
              )
            }
            onBlur={() => {}}
          />
        </>
      )}

      {/* Rating (default 0 stars; clicking active star a 2nd time resets to 0) & Footer Actions */}
      <div className="flex items-center justify-between gap-2 pt-1">
        <div className="flex items-center gap-0.5" role="group" aria-label={t.crmLeads.card.rating}>
          {[1, 2, 3].map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setRating((prev) => (prev === st ? 0 : st))}
              aria-label={`Rate ${st} of 3`}
              className="p-0.5 transition-transform hover:scale-110"
            >
              <Star
                className={cn(
                  "size-3.5",
                  st <= rating
                    ? "fill-amber-400 text-amber-500"
                    : "text-slate-300 dark:text-slate-600",
                )}
              />
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          >
            {isAr ? "إلغاء" : "Cancel"}
          </button>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => void handleQuickSave()}
            className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700 disabled:opacity-50"
          >
            <Check className="size-3.5" aria-hidden="true" />
            <span>{isAr ? "حفظ" : "Save"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

