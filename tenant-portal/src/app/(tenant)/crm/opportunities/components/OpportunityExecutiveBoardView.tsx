"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  Banknote,
  BriefcaseBusiness,
  Building2,
  Calendar,
  ChevronDown,
  ChevronUp,
  ChevronsLeft,
  ChevronsRight,
  CirclePercent,
  ExternalLink,
  Eye,
  GripVertical,
  Loader2,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  Plus,
  Send,
  Sparkles,
  Star,
  UserRound,
  X,
} from "lucide-react";
import {
  Badge,
  Button,
  Combobox,
  DateTime,
  Field,
  Input,
  Money,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  StatusBadge,
  TagChip,
  cn,
  useToast,
  type CardColor,
  type ComboboxOption,
  type MoveToTarget,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { axiosClient } from "@/lib/api/axiosClient";
import { createWriteAttempt, runIdempotentWrite } from "@/lib/api/idempotent-write";
import { localizedName, localizedValue } from "@/lib/format/localized";
import { formatNumber } from "@/lib/format/number";
import { formatTemplate } from "@/lib/format/template";
import {
  countryIsoFromName,
  getCountryOptions,
} from "@/lib/geo/country-data";
import {
  normalizePhoneDigits,
  normalizeWhatsAppDigits,
} from "../../leads/lead-phone-links";
import { AcquisitionSourceIcon } from "../../shared/components/AcquisitionSourceIcon";
import type { CrmActivityState } from "../../shared/crm-activity-tone";
import { isExactMoneyDecimal, toMoneyWireNumber } from "../../shared/money";
import {
  OPPORTUNITIES_PATH,
  opportunityPath,
  parseOpportunityDetailResponse,
  type OpportunityDetail,
} from "../opportunity-contract";
import type { OpportunityCardPatch } from "../opportunity-card-contract";
import {
  formatOpportunityAmountSummary,
  type OpportunityActivityState,
  type OpportunityBoard,
  type OpportunityBoardLane,
  type OpportunityCardRecord,
  type OpportunityPipeline,
  type OpportunityStage,
  type StageFlag,
} from "../hooks/pipeline-types";
import { useCustomerProfileOptions } from "../hooks/useCustomerProfileOptions";
import { OpportunityCardMenu } from "./opportunity-card/OpportunityCardMenu";

export interface QuickCreateOpportunityDraft {
  customerProfileId: string;
  pipelineId: string;
  stageId: string;
  title: string;
  amount: string;
  currencyCode: string;
  probabilityPercent: string;
  expectedCloseDate: string;
  importance: string;
}

export interface OpportunityExecutiveBoardViewProps {
  pipeline: OpportunityPipeline | null;
  board: OpportunityBoard | null;
  branchId: string | null;
  isLoading: boolean;
  isMutating: boolean;
  loadingStageId: string | null;
  canCreate: boolean;
  canUpdate: (item: OpportunityCardRecord) => boolean;
  canDelete: (item: OpportunityCardRecord) => boolean;
  onOpen: (item: OpportunityCardRecord) => void;
  onOpenQuickModal?: (item: OpportunityCardRecord) => void;
  onOpenFullCreate?: (
    stageId?: string,
    draft?: QuickCreateOpportunityDraft,
  ) => void;
  onDelete: (item: OpportunityCardRecord) => void;
  onOpenActivities: (item: OpportunityCardRecord) => void;
  onCardChange: (
    opportunityId: string,
    patch: OpportunityCardPatch,
    item: OpportunityCardRecord,
  ) => void;
  onMoveCard: (
    cardId: string,
    sourceStageId: string,
    destStageId: string,
  ) => void;
  onLoadMoreStage: (stageId: string) => void;
  onRefreshBoard?: () => void;
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

const CURRENCY_OPTIONS = ["EGP", "USD", "SAR", "AED", "EUR"] as const;

function getStageVisual(flag: StageFlag) {
  switch (flag) {
    case "WON":
      return {
        topAccent: "border-t-[3px] border-t-emerald-500",
        dotColor: "bg-emerald-500",
        pillTone:
          "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800",
      };
    case "LOST":
      return {
        topAccent: "border-t-[3px] border-t-red-500",
        dotColor: "bg-red-500",
        pillTone:
          "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/50 dark:text-red-300 dark:border-red-800",
      };
    case "ON_HOLD":
      return {
        topAccent: "border-t-[3px] border-t-amber-500",
        dotColor: "bg-amber-500",
        pillTone:
          "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800",
      };
    case "PROPOSAL":
    case "NEGOTIATION":
    case "CONTRACTING":
      return {
        topAccent: "border-t-[3px] border-t-purple-500",
        dotColor: "bg-purple-500",
        pillTone:
          "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/50 dark:text-purple-300 dark:border-purple-800",
      };
    case "QUALIFICATION":
    case "DISCOVERY":
      return {
        topAccent: "border-t-[3px] border-t-indigo-500",
        dotColor: "bg-indigo-500",
        pillTone:
          "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/50 dark:text-indigo-300 dark:border-indigo-800",
      };
    default:
      return {
        topAccent: "border-t-[3px] border-t-blue-600",
        dotColor: "bg-blue-600",
        pillTone:
          "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800",
      };
  }
}

function mapActivityState(state: OpportunityActivityState): CrmActivityState {
  if (state === "OVERDUE") return "OVERDUE";
  if (state === "TODAY") return "TODAY";
  if (state === "FUTURE") return "FUTURE";
  return "NONE";
}

function ownerInitials(name?: string | null): string {
  if (!name) return "";
  return name
    .split(/\s+/u)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => (Array.from(part)[0] ?? "").toUpperCase())
    .join("");
}

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

export function OpportunityExecutiveBoardView({
  pipeline,
  board,
  branchId,
  isMutating,
  loadingStageId,
  canCreate,
  canUpdate,
  canDelete,
  onOpen,
  onOpenQuickModal,
  onOpenFullCreate,
  onDelete,
  onOpenActivities,
  onCardChange,
  onMoveCard,
  onLoadMoreStage,
  onRefreshBoard,
}: OpportunityExecutiveBoardViewProps) {
  const { t, lang } = useI18n();
  const isAr = lang === "ar";

  const [draggingItem, setDraggingItem] = useState<OpportunityCardRecord | null>(null);
  const [dragOverStageId, setDragOverStageId] = useState<string | null>(null);
  const [collapsedStageIds, setCollapsedStageIds] = useState<Set<string>>(new Set());
  const [peekStageId, setPeekStageId] = useState<string | null>(null);
  const peekTimerRef = useRef<number | null>(null);

  const [columnActivityFilter, setColumnActivityFilter] = useState<
    Record<string, CrmActivityState | null>
  >({});

  const [quickAddStageId, setQuickAddStageId] = useState<string | null>(null);
  const [expandedOpportunityId, setExpandedOpportunityId] = useState<string | null>(
    null,
  );

  const stages = useMemo(() => pipeline?.stages ?? [], [pipeline]);
  const laneByStageId = useMemo(
    () => new Map((board?.stages ?? []).map((lane) => [lane.stage.id, lane])),
    [board],
  );

  const moveTargets: MoveToTarget[] = useMemo(
    () =>
      stages.map((st) => ({
        id: st.id,
        label: localizedName(st, lang),
      })),
    [stages, lang],
  );

  useEffect(
    () => () => {
      if (peekTimerRef.current !== null) window.clearTimeout(peekTimerRef.current);
    },
    [],
  );

  function clearPeekTimer() {
    if (peekTimerRef.current !== null) {
      window.clearTimeout(peekTimerRef.current);
      peekTimerRef.current = null;
    }
  }

  function clearDragState() {
    clearPeekTimer();
    setDraggingItem(null);
    setDragOverStageId(null);
    setPeekStageId(null);
  }

  function toggleCollapse(stageId: string) {
    setCollapsedStageIds((prev) => {
      const next = new Set(prev);
      if (next.has(stageId)) next.delete(stageId);
      else next.add(stageId);
      return next;
    });
  }

  function toggleActivityFilter(stageId: string, state: CrmActivityState) {
    setColumnActivityFilter((prev) => ({
      ...prev,
      [stageId]: prev[stageId] === state ? null : state,
    }));
  }

  function canDragItem(item: OpportunityCardRecord): boolean {
    return (
      !isMutating &&
      canUpdate(item) &&
      item.stageFlag !== "WON" &&
      item.stageFlag !== "LOST"
    );
  }

  return (
    <div className="flex h-full min-h-0 gap-3 overflow-x-auto pb-2">
      {stages.map((stage) => {
        const lane = laneByStageId.get(stage.id);
        const rawItems = lane?.items ?? [];
        const totalCount = lane?.summary.totalCount ?? rawItems.length;
        const amountSummary = lane
          ? formatOpportunityAmountSummary(lane.summary.amountsByCurrency)
          : undefined;
        const activeFilter = columnActivityFilter[stage.id] ?? null;

        const filteredItems = activeFilter
          ? rawItems.filter((item) => mapActivityState(item.activityState) === activeFilter)
          : rawItems;

        const overdueCount =
          lane?.activitySummary.overdueCount ??
          rawItems.filter((i) => i.activityState === "OVERDUE").length;
        const todayCount =
          lane?.activitySummary.todayCount ??
          rawItems.filter((i) => i.activityState === "TODAY").length;
        const futureCount =
          lane?.activitySummary.futureCount ??
          rawItems.filter((i) => i.activityState === "FUTURE").length;
        const noneCount =
          lane?.activitySummary.noOpenCount ??
          Math.max(0, rawItems.length - overdueCount - todayCount - futureCount);

        const isCollapsed =
          collapsedStageIds.has(stage.id) && peekStageId !== stage.id;
        const isDropTarget =
          draggingItem !== null &&
          dragOverStageId === stage.id &&
          draggingItem.stageId !== stage.id;
        const visual = getStageVisual(stage.flag);
        const stageLabel = localizedName(stage, lang);
        const isTerminal = stage.flag === "WON" || stage.flag === "LOST";

        if (isCollapsed) {
          return (
            <section
              key={stage.id}
              aria-label={stageLabel}
              onDragOver={(e) => {
                if (!draggingItem || draggingItem.stageId === stage.id) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                setDragOverStageId(stage.id);
                if (peekTimerRef.current === null) {
                  peekTimerRef.current = window.setTimeout(() => {
                    setPeekStageId(stage.id);
                    peekTimerRef.current = null;
                  }, 380);
                }
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
                  clearPeekTimer();
                  setDragOverStageId((curr) => (curr === stage.id ? null : curr));
                }
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (draggingItem && draggingItem.stageId !== stage.id) {
                  onMoveCard(draggingItem.id, draggingItem.stageId, stage.id);
                }
                clearDragState();
              }}
              className={cn(
                "flex h-full w-12 shrink-0 flex-col items-center gap-2.5 rounded-xl border border-slate-200/90 bg-slate-100/80 px-1.5 py-3 transition-colors dark:border-slate-800 dark:bg-slate-900/60",
                visual.topAccent,
                isDropTarget && "ring-2 ring-blue-500 bg-blue-50/40",
              )}
            >
              <button
                type="button"
                onClick={() => toggleCollapse(stage.id)}
                title={t.views.expandColumn}
                aria-label={`${t.views.expandColumn}: ${stageLabel}`}
                className="flex size-7 items-center justify-center rounded-lg text-slate-500 hover:bg-white hover:text-slate-900 dark:hover:bg-slate-800"
              >
                <ChevronsRight className="size-4 rtl:rotate-180" aria-hidden="true" />
              </button>
              <span className="rounded-full bg-white px-2 py-0.5 text-xs font-extrabold tabular-nums text-slate-700 shadow-2xs dark:bg-slate-800 dark:text-slate-200">
                {totalCount}
              </span>
              <span className="flex-1 select-none text-xs font-bold tracking-wide text-slate-600 [writing-mode:vertical-rl] dark:text-slate-300">
                {stageLabel}
              </span>
            </section>
          );
        }

        return (
          <section
            key={stage.id}
            aria-label={stageLabel}
            onDragOver={(e) => {
              if (!draggingItem || draggingItem.stageId === stage.id) return;
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
              setDragOverStageId(stage.id);
            }}
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
                setDragOverStageId((curr) => (curr === stage.id ? null : curr));
              }
            }}
            onDrop={(e) => {
              e.preventDefault();
              if (draggingItem && draggingItem.stageId !== stage.id) {
                onMoveCard(draggingItem.id, draggingItem.stageId, stage.id);
              }
              clearDragState();
            }}
            className={cn(
              "flex h-full w-80 shrink-0 flex-col overflow-hidden rounded-xl border border-slate-200/90 bg-slate-100/75 shadow-2xs transition-colors dark:border-slate-800 dark:bg-slate-900/50",
              visual.topAccent,
              isDropTarget && "ring-2 ring-blue-500 bg-blue-50/30 dark:bg-blue-950/20",
            )}
          >
            {/* Column Header */}
            <header className="flex flex-col gap-2 border-b border-slate-200/80 bg-white px-3 py-2.5 dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center justify-between gap-1.5">
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    className={cn("size-2 shrink-0 rounded-full", visual.dotColor)}
                    aria-hidden="true"
                  />
                  <h3 className="truncate text-xs font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
                    {stageLabel}
                  </h3>
                  <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-slate-100 px-1.5 py-0.5 text-[11px] font-bold tabular-nums text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                    {totalCount}
                  </span>
                </div>

                <div className="flex shrink-0 items-center gap-0.5">
                  {canCreate && !isTerminal && (
                    <button
                      type="button"
                      onClick={() =>
                        setQuickAddStageId((curr) =>
                          curr === stage.id ? null : stage.id,
                        )
                      }
                      aria-label={`${t.crmOpportunityDetail.createAction}: ${stageLabel}`}
                      title={
                        isAr
                          ? "إضافة سريعة لفرصة في هذه المرحلة"
                          : "Quick-add opportunity in this stage"
                      }
                      className={cn(
                        "flex size-6 items-center justify-center rounded-md transition-colors",
                        quickAddStageId === stage.id
                          ? "bg-blue-600 text-white"
                          : "text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-slate-100",
                      )}
                    >
                      <Plus className="size-3.5" aria-hidden="true" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => toggleCollapse(stage.id)}
                    title={t.views.collapseColumn}
                    aria-label={`${t.views.collapseColumn}: ${stageLabel}`}
                    className="flex size-6 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"
                  >
                    <ChevronsLeft className="size-3.5 rtl:rotate-180" aria-hidden="true" />
                  </button>
                </div>
              </div>

              {amountSummary && (
                <div className="flex items-center justify-between text-[11px] font-bold tabular-nums text-emerald-700 dark:text-emerald-400">
                  <span className="truncate">{amountSummary}</span>
                </div>
              )}

              {/* Interactive 4-Color Activity Bar */}
              <div className="space-y-1">
                <div
                  role="group"
                  aria-label={t.crmLeads.card.activityBar}
                  className="flex h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"
                >
                  {overdueCount > 0 && (
                    <button
                      type="button"
                      onClick={() => toggleActivityFilter(stage.id, "OVERDUE")}
                      style={{ flexGrow: overdueCount }}
                      title={`${t.crmLeads.card.activityStates.OVERDUE}: ${overdueCount}`}
                      className={cn(
                        "h-full bg-red-500 transition-opacity hover:opacity-90",
                        activeFilter && activeFilter !== "OVERDUE" && "opacity-30",
                      )}
                    />
                  )}
                  {todayCount > 0 && (
                    <button
                      type="button"
                      onClick={() => toggleActivityFilter(stage.id, "TODAY")}
                      style={{ flexGrow: todayCount }}
                      title={`${t.crmLeads.card.activityStates.TODAY}: ${todayCount}`}
                      className={cn(
                        "h-full bg-amber-500 transition-opacity hover:opacity-90",
                        activeFilter && activeFilter !== "TODAY" && "opacity-30",
                      )}
                    />
                  )}
                  {futureCount > 0 && (
                    <button
                      type="button"
                      onClick={() => toggleActivityFilter(stage.id, "FUTURE")}
                      style={{ flexGrow: futureCount }}
                      title={`${t.crmLeads.card.activityStates.FUTURE}: ${futureCount}`}
                      className={cn(
                        "h-full bg-emerald-500 transition-opacity hover:opacity-90",
                        activeFilter && activeFilter !== "FUTURE" && "opacity-30",
                      )}
                    />
                  )}
                  {noneCount > 0 && (
                    <button
                      type="button"
                      onClick={() => toggleActivityFilter(stage.id, "NONE")}
                      style={{ flexGrow: noneCount }}
                      title={`${t.crmLeads.card.activityStates.NONE}: ${noneCount}`}
                      className={cn(
                        "h-full bg-slate-300 transition-opacity hover:opacity-90 dark:bg-slate-700",
                        activeFilter && activeFilter !== "NONE" && "opacity-30",
                      )}
                    />
                  )}
                </div>

                {activeFilter && (
                  <div className="flex items-center justify-between text-[10px] font-semibold text-blue-600 dark:text-blue-400">
                    <span>
                      {isAr ? "مصفّى حسب النشاط" : `Filtered: ${activeFilter}`} (
                      {filteredItems.length})
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setColumnActivityFilter((prev) => ({
                          ...prev,
                          [stage.id]: null,
                        }))
                      }
                      className="underline hover:no-underline"
                    >
                      {isAr ? "مسح" : "Clear"}
                    </button>
                  </div>
                )}
              </div>
            </header>

            {/* Quick-Add Opportunity Inline Card */}
            {quickAddStageId === stage.id && pipeline && (
              <div className="border-b border-blue-200 bg-blue-50/40 p-2.5 dark:border-blue-900/60 dark:bg-blue-950/20">
                <BoardColumnQuickAddOpportunityCard
                  pipeline={pipeline}
                  stage={stage}
                  branchId={branchId}
                  onClose={() => setQuickAddStageId(null)}
                  onCreated={() => {
                    setQuickAddStageId(null);
                    onRefreshBoard?.();
                  }}
                  onOpenFullForm={(draft) => {
                    setQuickAddStageId(null);
                    onOpenFullCreate?.(stage.id, draft);
                  }}
                />
              </div>
            )}

            {/* Cards Stack */}
            <div className="flex-1 space-y-2.5 overflow-y-auto p-2.5">
              {filteredItems.length === 0 ? (
                <div className="flex h-36 flex-col items-center justify-center rounded-xl border border-dashed border-slate-200/90 bg-white/50 p-4 text-center text-xs text-slate-400 dark:border-slate-800 dark:bg-slate-900/30">
                  {t.crmOpportunities.emptyColumn}
                </div>
              ) : (
                filteredItems.map((item) => {
                  const isExpanded = expandedOpportunityId === item.id;
                  const canEditItem = canUpdate(item);
                  const canDeleteItem = canDelete(item);
                  const itemMoveTargets = moveTargets.filter(
                    (target) => target.id !== item.stageId,
                  );

                  return (
                    <OpportunityExecutiveBoardCard
                      key={item.id}
                      item={item}
                      stage={stage}
                      isExpanded={isExpanded}
                      canDrag={canDragItem(item) && !isExpanded}
                      canUpdate={canEditItem}
                      canDelete={canDeleteItem}
                      moveTargets={itemMoveTargets}
                      isDragging={draggingItem?.id === item.id}
                      onDragStart={() => setDraggingItem(item)}
                      onDragEnd={clearDragState}
                      onToggleExpand={() =>
                        setExpandedOpportunityId((curr) =>
                          curr === item.id ? null : item.id,
                        )
                      }
                      onOpen={() => onOpen(item)}
                      onOpenQuickModal={() => onOpenQuickModal?.(item)}
                      onDelete={() => onDelete(item)}
                      onOpenActivities={() => onOpenActivities(item)}
                      onCardChange={(patch) => onCardChange(item.id, patch, item)}
                      onMove={(targetStageId) =>
                        onMoveCard(item.id, item.stageId, targetStageId)
                      }
                    />
                  );
                })
              )}

              {lane?.pageInfo.hasMore && (
                <Button
                  variant="outline"
                  size="xs"
                  className="w-full"
                  disabled={loadingStageId === stage.id}
                  onClick={() => onLoadMoreStage(stage.id)}
                >
                  {loadingStageId === stage.id
                    ? t.crmOpportunities.loadingMore
                    : t.crmOpportunities.loadMore(
                        rawItems.length,
                        lane.summary.totalCount,
                      )}
                </Button>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}

/* ============================================================================
 * INLINE QUICK-ADD OPPORTUNITY CARD (Inside Kanban Column)
 * ========================================================================== */

function BoardColumnQuickAddOpportunityCard({
  pipeline,
  stage,
  branchId,
  onClose,
  onCreated,
  onOpenFullForm,
}: {
  pipeline: OpportunityPipeline;
  stage: OpportunityStage;
  branchId: string | null;
  onClose: () => void;
  onCreated: () => void;
  onOpenFullForm: (draft: QuickCreateOpportunityDraft) => void;
}) {
  const { t, lang } = useI18n();
  const isAr = lang === "ar";
  const toast = useToast();

  const [customerProfileId, setCustomerProfileId] = useState("");
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [currencyCode, setCurrencyCode] = useState("EGP");
  const [probabilityPercent, setProbabilityPercent] = useState("50");
  const [expectedCloseDate, setExpectedCloseDate] = useState("");
  const [importance, setImportance] = useState<number>(2);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const customers = useCustomerProfileOptions(branchId, true);
  const customerOptions: ComboboxOption[] = useMemo(
    () =>
      customers.items.map((item) => ({
        value: item.id,
        label: item.displayName,
        description:
          item.companyName && item.companyName !== item.displayName
            ? item.companyName
            : undefined,
      })),
    [customers.items],
  );

  function buildDraft(): QuickCreateOpportunityDraft {
    return {
      customerProfileId,
      pipelineId: pipeline.id,
      stageId: stage.id,
      title,
      amount,
      currencyCode,
      probabilityPercent,
      expectedCloseDate,
      importance: String(importance),
    };
  }

  async function handleQuickSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!branchId) return;
    setErrorMsg(null);

    if (!customerProfileId) {
      setErrorMsg(
        isAr ? "يرجى اختيار العميل أولاً." : "Please select a customer first.",
      );
      return;
    }
    if (!title.trim()) {
      setErrorMsg(
        isAr ? "يرجى إدخال عنوان الفرصة." : "Please enter an opportunity title.",
      );
      return;
    }
    const trimmedAmount = amount.trim();
    if (trimmedAmount.length > 0 && !isExactMoneyDecimal(trimmedAmount)) {
      setErrorMsg(t.crmOpportunityDetail.create.amountInvalid);
      return;
    }

    setIsSaving(true);
    try {
      const wireAmount = toMoneyWireNumber(trimmedAmount);
      const parsedProb = probabilityPercent.trim()
        ? Number(probabilityPercent.trim())
        : undefined;
      const body: Record<string, unknown> = {
        branchId,
        customerProfileId,
        pipelineId: pipeline.id,
        stageId: stage.id,
        title: title.trim(),
        importance,
      };
      if (wireAmount !== undefined) {
        body.amount = wireAmount;
        body.currencyCode = currencyCode;
      }
      if (
        parsedProb !== undefined &&
        Number.isSafeInteger(parsedProb) &&
        parsedProb >= 0 &&
        parsedProb <= 100
      ) {
        body.probabilityPercent = parsedProb;
      }
      if (expectedCloseDate.trim()) {
        body.expectedCloseDate = expectedCloseDate.trim();
      }

      const attempt = createWriteAttempt();
      const outcome = await runIdempotentWrite({
        attempt,
        method: "post",
        path: OPPORTUNITIES_PATH,
        body,
        parse: (payload) => payload,
      });

      if (outcome.kind === "success" || outcome.kind === "applied_unreadable") {
        toast.success(
          t.crmOpportunityDetail.createOperation,
          title.trim(),
        );
        onCreated();
      } else {
        setErrorMsg(outcome.error.message ?? t.crmOpportunities.cardUpdateFailed);
      }
    } catch {
      setErrorMsg(t.crmOpportunities.cardUpdateFailed);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form
      onSubmit={(e) => void handleQuickSubmit(e)}
      className="space-y-2.5 rounded-xl border border-blue-300 bg-white p-3 shadow-md dark:border-blue-800 dark:bg-slate-900"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wider text-blue-600 dark:text-blue-400">
          <Sparkles className="size-3.5" aria-hidden="true" />
          {isAr ? "إضافة سريعة لفرصة" : "Quick-Add Opportunity"}
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label={t.common.cancel}
          className="rounded-md p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"
        >
          <X className="size-3.5" aria-hidden="true" />
        </button>
      </div>

      {errorMsg && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-[11px] font-medium text-red-700 dark:border-red-900 dark:bg-red-950/60 dark:text-red-300"
        >
          {errorMsg}
        </div>
      )}

      {/* Customer Combobox */}
      <Field label={t.crmOpportunities.customer} required>
        <Combobox
          options={customerOptions}
          value={customerProfileId || undefined}
          onValueChange={(next) => setCustomerProfileId(next ?? "")}
          onSearch={customers.search}
          loading={customers.isLoading}
          placeholder={t.crmOpportunityDetail.selectCustomer}
          searchPlaceholder={t.crmCustomerProfiles.search}
          loadingLabel={t.common.loading}
          emptyLabel={t.crmOpportunityDetail.noCustomers}
          disabled={isSaving}
        />
      </Field>

      {/* Opportunity Title */}
      <Field label={t.crmOpportunities.title} required>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={
            isAr
              ? "مثال: توريد معدات خط إنتاج..."
              : "e.g. Annual Enterprise Supply Contract..."
          }
          disabled={isSaving}
          maxLength={255}
        />
      </Field>

      {/* Deal Value + Currency + Probability */}
      <div className="grid grid-cols-12 gap-1.5">
        <div className="col-span-6">
          <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500">
            {t.crmOpportunityDetail.amount}
          </label>
          <Input
            inputMode="decimal"
            dir="ltr"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            disabled={isSaving}
          />
        </div>
        <div className="col-span-3">
          <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500">
            {t.crmLeadConvert.currencyCode}
          </label>
          <Select
            value={currencyCode}
            onValueChange={setCurrencyCode}
            disabled={isSaving}
          >
            <SelectTrigger size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CURRENCY_OPTIONS.map((code) => (
                <SelectItem key={code} value={code}>
                  {code}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="col-span-3">
          <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500">
            {isAr ? "الاحتمال %" : "Prob %"}
          </label>
          <Input
            inputMode="numeric"
            dir="ltr"
            value={probabilityPercent}
            onChange={(e) => setProbabilityPercent(e.target.value)}
            placeholder="50"
            disabled={isSaving}
          />
        </div>
      </div>

      {/* Expected Close Date + Importance Stars */}
      <div className="flex items-center justify-between gap-2 pt-0.5">
        <div className="flex-1">
          <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500">
            {t.crmOpportunities.expectedClose}
          </label>
          <Input
            type="date"
            dir="ltr"
            value={expectedCloseDate}
            onChange={(e) => setExpectedCloseDate(e.target.value)}
            disabled={isSaving}
          />
        </div>
        <div>
          <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500">
            {t.crmOpportunities.importance}
          </span>
          <div className="flex items-center gap-0.5 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 dark:border-slate-800 dark:bg-slate-800/60">
            {[1, 2, 3].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => setImportance(importance === star ? 0 : star)}
                className="p-0.5"
              >
                <Star
                  className={cn(
                    "size-3.5 transition-colors",
                    star <= importance
                      ? "fill-amber-400 text-amber-400"
                      : "text-slate-300 dark:text-slate-600",
                  )}
                />
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Footer Actions */}
      <div className="flex items-center justify-between gap-2 border-t border-slate-100 pt-2 dark:border-slate-800">
        <button
          type="button"
          onClick={() => onOpenFullForm(buildDraft())}
          className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:underline dark:text-blue-400"
        >
          <span>{isAr ? "النموذج الكامل" : "Full Form"}</span>
          <ExternalLink className="size-3" aria-hidden="true" />
        </button>
        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={onClose}
            disabled={isSaving}
          >
            {t.common.cancel}
          </Button>
          <Button type="submit" size="xs" disabled={isSaving}>
            {isSaving ? (
              <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
            ) : (
              t.common.create
            )}
          </Button>
        </div>
      </div>
    </form>
  );
}

/* ============================================================================
 * EXECUTIVE KANBAN BOARD CARD (Collapsed + Same-Page Expanded Mode)
 * ========================================================================== */

function OpportunityExecutiveBoardCard({
  item,
  stage,
  isExpanded,
  canDrag,
  canUpdate,
  canDelete,
  moveTargets,
  isDragging,
  onDragStart,
  onDragEnd,
  onToggleExpand,
  onOpen,
  onOpenQuickModal,
  onDelete,
  onOpenActivities,
  onCardChange,
  onMove,
}: {
  item: OpportunityCardRecord;
  stage: OpportunityStage;
  isExpanded: boolean;
  canDrag: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  moveTargets: readonly MoveToTarget[];
  isDragging: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onToggleExpand: () => void;
  onOpen: () => void;
  onOpenQuickModal: () => void;
  onDelete: () => void;
  onOpenActivities: () => void;
  onCardChange: (patch: OpportunityCardPatch) => void;
  onMove: (targetStageId: string) => void;
}) {
  const { t, lang } = useI18n();
  const isAr = lang === "ar";

  const [detail, setDetail] = useState<OpportunityDetail | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  useEffect(() => {
    if (!isExpanded) return;
    const controller = new AbortController();
    setIsLoadingDetail(true);
    axiosClient
      .get<unknown>(opportunityPath(item.id), {
        signal: controller.signal,
        cache: "no-store",
      })
      .then((res) => {
        if (!controller.signal.aborted) {
          setDetail(parseOpportunityDetailResponse(res.data));
        }
      })
      .catch(() => {
        // Keep board item fallback if detail fetch fails
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoadingDetail(false);
      });
    return () => controller.abort();
  }, [isExpanded, item.id]);

  const effective = detail ?? item;
  const corporate = effective.customerProfileType === "CORPORATE";
  const ProfileIcon = corporate ? Building2 : UserRound;
  const customerName =
    (corporate ? effective.customerCompanyName : null) ??
    effective.customerDisplayName ??
    t.crmOpportunities.notProvided;

  const primaryPhone =
    effective.primaryContact?.phones[0] ?? effective.customerPhone ?? null;
  const callDigits = primaryPhone ? normalizePhoneDigits(primaryPhone) : "";
  const whatsappDigits = primaryPhone
    ? normalizeWhatsAppDigits(primaryPhone)
    : "";
  const primaryEmail =
    effective.primaryContact?.email ?? effective.customerEmail ?? null;

  const storedCountry = effective.customerCountry?.trim() ?? "";
  const countryIso = /^[A-Z]{2}$/u.test(storedCountry.toUpperCase())
    ? storedCountry.toUpperCase()
    : countryIsoFromName(storedCountry);
  const country = getCountryOptions(lang).find(
    ({ isoCode }) => isoCode === countryIso,
  );
  const location = [
    effective.customerCity,
    country?.name ?? effective.customerCountry,
  ]
    .filter(Boolean)
    .join(", ");

  const probabilityLabel =
    effective.probabilityPercent === null
      ? null
      : formatTemplate(t.crmOpportunityDetail.probabilityValue, {
          percent: formatNumber(effective.probabilityPercent, lang),
        });

  const actState = mapActivityState(effective.activityState);
  const initials = ownerInitials(effective.ownerDisplayName);
  const borderAccent = item.cardColor
    ? CARD_BORDER_ACCENT[item.cardColor]
    : "border-slate-200/90 dark:border-slate-800";

  return (
    <article
      draggable={canDrag}
      onDragStart={(e) => {
        if (!canDrag) {
          e.preventDefault();
          return;
        }
        e.dataTransfer.effectAllowed = "move";
        try {
          e.dataTransfer.setData("text/plain", item.id);
        } catch {
          // ignore
        }
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      className={cn(
        "group relative flex flex-col gap-2 rounded-xl border bg-white p-3 shadow-2xs transition-all hover:shadow-md dark:bg-slate-900",
        borderAccent,
        isDragging && " scale-[0.98] opacity-50 ring-2 ring-blue-500",
      )}
    >
      {/* Row 1: Customer Header + Expand / Quick Inspect / Card Menu */}
      <div className="flex items-start justify-between gap-1.5">
        <div className="flex min-w-0 flex-1 items-center gap-1.5">
          {canDrag && (
            <GripVertical
              className="size-3.5 shrink-0 cursor-grab text-slate-300 opacity-0 transition-opacity group-hover:opacity-100 dark:text-slate-600"
              aria-hidden="true"
            />
          )}
          <span className="flex size-5 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            <ProfileIcon className="size-3" aria-hidden="true" />
          </span>
          <span className="truncate text-[11px] font-semibold text-slate-600 dark:text-slate-300">
            {customerName}
          </span>
        </div>

        <div
          className="flex shrink-0 items-center gap-0.5"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={onToggleExpand}
            aria-label={isExpanded ? "Collapse card" : "Expand card"}
            title={
              isExpanded
                ? isAr
                  ? "طي البطاقة"
                  : "Collapse card"
                : isAr
                  ? "توسيع البطاقة"
                  : "Expand card"
            }
            className="flex size-6 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"
          >
            {isExpanded ? (
              <ChevronUp className="size-3.5" aria-hidden="true" />
            ) : (
              <ChevronDown className="size-3.5" aria-hidden="true" />
            )}
          </button>

          <button
            type="button"
            onClick={onOpenQuickModal}
            aria-label={isAr ? "معاينة سريعة 360" : "Quick inspect 360"}
            title={isAr ? "معاينة سريعة 360" : "Quick inspect 360"}
            className="flex size-6 items-center justify-center rounded-md text-slate-400 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-950/50 dark:hover:text-blue-400"
          >
            <Eye className="size-3.5" aria-hidden="true" />
          </button>

          <OpportunityCardMenu
            cardColor={item.cardColor}
            onOpen={onOpen}
            onDelete={canDelete ? onDelete : undefined}
            onColorChange={
              canUpdate ? (cardColor) => onCardChange({ cardColor }) : undefined
            }
            moveTargets={canUpdate && moveTargets.length > 0 ? moveTargets : undefined}
            onMove={canUpdate ? onMove : undefined}
            labels={{
              trigger: t.crmLeads.card.more,
              open: t.crmLeads.card.open,
              moveTo: t.views.moveTo,
              delete: t.common.delete,
              cardColor: t.crmLeads.card.cardColor,
              colorNone: t.crmLeads.card.colorNone,
              colorNames: t.crmLeads.card.colors,
              selected: t.crmLeads.card.colorSelected,
            }}
          />
        </div>
      </div>

      {/* Row 2: Opportunity Title + Status Badge */}
      <div className="flex items-start justify-between gap-2">
        <button
          type="button"
          onClick={onOpen}
          className="min-w-0 flex-1 text-start text-sm font-extrabold leading-snug text-slate-900 hover:text-blue-600 dark:text-slate-100 dark:hover:text-blue-400"
        >
          <span className="line-clamp-2">{item.title}</span>
        </button>
        <StatusBadge
          value={item.status}
          kind="OpportunityStatus"
          className="shrink-0 px-1.5 py-0 text-[10px] font-bold"
        />
      </div>

      {/* Row 3: Commercial Value + Probability + Expected Close Strip */}
      {(effective.amount || probabilityLabel || effective.expectedCloseDate) && (
        <div className="flex flex-wrap items-center justify-between gap-1.5 rounded-lg border border-slate-100 bg-slate-50/90 px-2.5 py-1.5 text-xs dark:border-slate-800/80 dark:bg-slate-800/40">
          <div className="flex items-center gap-1.5 font-extrabold text-emerald-700 dark:text-emerald-400">
            <Banknote className="size-3.5 shrink-0" aria-hidden="true" />
            {effective.amount ? (
              <Money
                value={effective.amount}
                currency={effective.currencyCode ?? undefined}
                language={lang}
                className="font-extrabold"
              />
            ) : (
              <span className="text-slate-400">—</span>
            )}
          </div>

          <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
            {probabilityLabel && (
              <span className="inline-flex items-center gap-0.5 rounded-full bg-blue-50 px-1.5 py-0.5 text-[10px] font-bold text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
                <CirclePercent className="size-3" aria-hidden="true" />
                {probabilityLabel}
              </span>
            )}
            {effective.expectedCloseDate && (
              <span className="inline-flex items-center gap-1 text-[11px] text-slate-500">
                <Calendar className="size-3 shrink-0" aria-hidden="true" />
                <DateTime
                  value={`${effective.expectedCloseDate.slice(0, 10)}T00:00:00.000Z`}
                  precision="date"
                  language={lang}
                  timeZone="UTC"
                />
              </span>
            )}
          </div>
        </div>
      )}

      {/* Row 4: Primary Contact / Phone Quick Channels */}
      {(effective.primaryContact ||
        item.contactDisplayName ||
        primaryPhone) && (
        <div
          className="flex items-center justify-between gap-2 text-xs"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="min-w-0 flex-1 truncate text-slate-600 dark:text-slate-300">
            {effective.primaryContact ? (
              <span className="inline-flex items-center gap-1 truncate font-medium">
                <BriefcaseBusiness className="size-3 shrink-0 text-slate-400" />
                <span className="truncate">
                  {effective.primaryContact.displayName}
                </span>
              </span>
            ) : item.contactDisplayName ? (
              <span className="inline-flex items-center gap-1 truncate font-medium">
                <BriefcaseBusiness className="size-3 shrink-0 text-slate-400" />
                <span className="truncate">{item.contactDisplayName}</span>
              </span>
            ) : (
              primaryPhone && (
                <span className="font-mono text-[11px]" dir="ltr">
                  {primaryPhone}
                </span>
              )
            )}
          </div>

          {primaryPhone && (
            <div className="flex shrink-0 items-center gap-1">
              {callDigits && (
                <a
                  href={`tel:${callDigits}`}
                  aria-label={formatTemplate(t.crmLeadDetail.callNumber, {
                    value: primaryPhone,
                  })}
                  title={t.crmLeadDetail.callAction}
                  className="flex size-6 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 hover:border-blue-300 hover:text-blue-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                >
                  <Phone className="size-3" aria-hidden="true" />
                </a>
              )}
              {whatsappDigits && (
                <>
                  <a
                    href={`https://wa.me/${whatsappDigits}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={formatTemplate(t.crmLeadDetail.whatsappNumber, {
                      value: primaryPhone,
                    })}
                    title={t.crmLeadDetail.whatsappAction}
                    className="flex size-6 items-center justify-center rounded-md border border-slate-200 bg-white text-emerald-600 hover:border-emerald-300 hover:bg-emerald-50 dark:border-slate-700 dark:bg-slate-800"
                  >
                    <MessageCircle className="size-3" aria-hidden="true" />
                  </a>
                  <a
                    href={`https://t.me/+${whatsappDigits}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={formatTemplate(t.crmLeadDetail.telegramNumber, {
                      value: primaryPhone,
                    })}
                    title={t.crmLeadDetail.telegramAction}
                    className="flex size-6 items-center justify-center rounded-md border border-slate-200 bg-white text-sky-600 hover:border-sky-300 hover:bg-sky-50 dark:border-slate-700 dark:bg-slate-800"
                  >
                    <Send className="size-3" aria-hidden="true" />
                  </a>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* Row 5: Tags */}
      {effective.tags.length > 0 && (
        <div className="flex flex-wrap items-center gap-1">
          {effective.tags.slice(0, 3).map((tag) => (
            <TagChip
              key={tag.id}
              label={tag.name}
              backgroundColor={tag.backgroundColor}
              textColor={tag.textColor}
            />
          ))}
          {effective.tags.length > 3 && (
            <span className="text-[10px] font-semibold text-slate-400">
              +{effective.tags.length - 3}
            </span>
          )}
        </div>
      )}

      {/* Expanded Same-Page Details Drawer */}
      {isExpanded && (
        <div
          className="mt-1 space-y-2.5 rounded-xl border border-slate-200/90 bg-slate-50/80 p-2.5 text-xs dark:border-slate-800 dark:bg-slate-800/40"
          onClick={(e) => e.stopPropagation()}
        >
          {isLoadingDetail && (
            <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
              <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
              <span>{isAr ? "جارٍ تحميل التفاصيل..." : "Loading details..."}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div>
              <span className="block text-[10px] font-bold uppercase text-slate-400">
                {t.crmOpportunities.stage}
              </span>
              <span className="font-bold text-slate-800 dark:text-slate-200">
                {localizedName(stage, lang)}
              </span>
            </div>
            <div>
              <span className="block text-[10px] font-bold uppercase text-slate-400">
                {isAr ? "العمر في المرحلة" : "Stage Age"}
              </span>
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                {formatRelativeAge(item.updatedAt || item.createdAt, isAr)}
              </span>
            </div>
          </div>

          {primaryEmail && (
            <a
              href={`mailto:${primaryEmail}`}
              className="flex items-center gap-1.5 truncate text-[11px] font-medium text-blue-600 hover:underline dark:text-blue-400"
            >
              <Mail className="size-3 shrink-0" aria-hidden="true" />
              <span className="truncate">{primaryEmail}</span>
            </a>
          )}

          {location && (
            <div className="flex items-center gap-1.5 text-[11px] text-slate-600 dark:text-slate-300">
              <MapPin className="size-3 shrink-0 text-slate-400" aria-hidden="true" />
              <span className="truncate">{location}</span>
              {country?.flag && <span aria-hidden="true">{country.flag}</span>}
            </div>
          )}

          {effective.leadSourceName && (
            <div className="flex items-center gap-1.5 text-[11px] text-slate-600 dark:text-slate-300">
              <AcquisitionSourceIcon
                source={{ iconUrl: effective.leadSourceIconUrl }}
              />
              <span className="truncate">{effective.leadSourceName}</span>
            </div>
          )}

          {effective.description && (
            <p className="line-clamp-3 rounded-lg border border-slate-200/70 bg-white p-2 text-[11px] text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
              {effective.description}
            </p>
          )}

          <div className="flex items-center justify-between gap-2 border-t border-slate-200/80 pt-2 dark:border-slate-700">
            <button
              type="button"
              onClick={onOpenQuickModal}
              className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-700 hover:text-blue-600 dark:text-slate-200"
            >
              <Eye className="size-3" aria-hidden="true" />
              <span>{isAr ? "معاينة 360°" : "Quick 360°"}</span>
            </button>
            <button
              type="button"
              onClick={onOpen}
              className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:underline dark:text-blue-400"
            >
              <span>{isAr ? "فتح الملف الكامل" : "Full Dossier"}</span>
              <ExternalLink className="size-3" aria-hidden="true" />
            </button>
          </div>
        </div>
      )}

      {/* Row 6: Footer (1★-3★ Importance Stars + Activity Pill + Owner Avatar) */}
      <div
        className="mt-0.5 flex items-center justify-between gap-2 border-t border-slate-100 pt-2 dark:border-slate-800/80"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-1.5">
          <div
            role="group"
            aria-label={t.crmOpportunities.importance}
            className="flex items-center gap-0.5"
          >
            {[1, 2, 3].map((star) => {
              const active = star <= item.importance;
              return (
                <button
                  key={star}
                  type="button"
                  disabled={!canUpdate}
                  onClick={() =>
                    onCardChange({
                      importance: item.importance === star ? 0 : star,
                    })
                  }
                  aria-label={
                    item.importance === star
                      ? t.crmOpportunities.clearImportance
                      : formatTemplate(t.crmOpportunities.setImportance, {
                          level: star,
                        })
                  }
                  className="rounded-xs p-0.5 transition-transform hover:scale-110 disabled:cursor-default"
                >
                  <Star
                    className={cn(
                      "size-3.5",
                      active
                        ? "fill-amber-400 text-amber-400"
                        : "text-slate-300 hover:text-amber-300 dark:text-slate-600",
                    )}
                  />
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={onOpenActivities}
            title={t.activities.title}
            className={cn(
              "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold transition-colors",
              actState === "OVERDUE"
                ? "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/60 dark:text-red-300"
                : actState === "TODAY"
                  ? "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/60 dark:text-amber-300"
                  : actState === "FUTURE"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-300"
                    : "border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400",
            )}
          >
            <Activity className="size-3" aria-hidden="true" />
            <span>
              {effective.openActivityCount > 0
                ? formatNumber(effective.openActivityCount, lang)
                : "+"}
            </span>
          </button>
        </div>

        <div className="flex items-center gap-1.5">
          {effective.ownerDisplayName ? (
            <span
              title={`${t.crmOpportunities.owner}: ${effective.ownerDisplayName}`}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600 dark:text-slate-300"
            >
              <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-blue-100 text-[10px] font-extrabold text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                {initials || "U"}
              </span>
              <span className="max-w-20 truncate">
                {effective.ownerDisplayName}
              </span>
            </span>
          ) : (
            <span className="text-[10px] text-slate-400">
              {formatRelativeAge(item.createdAt, isAr)}
            </span>
          )}
        </div>
      </div>
    </article>
  );
}
