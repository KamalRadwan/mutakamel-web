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
  Plus,
  Sparkles,
  Star,
  UserRound,
  X,
} from "lucide-react";
import {
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
import { useAccessMode } from "@/hooks/useAccessMode";
import { useTenantAuth } from "@/context/AuthContext";
import { canCreateActivities } from "@/components/activities/activity-presentation";
import { useI18n } from "@/i18n/I18nContext";
import type { Dictionary } from "@/i18n/dictionaries/ar";
import type { Language } from "@/i18n/useLanguage";
import { axiosClient } from "@/lib/api/axiosClient";
import { createWriteAttempt, runIdempotentWrite } from "@/lib/api/idempotent-write";
import { localizedName } from "@/lib/format/localized";
import { formatNumber } from "@/lib/format/number";
import { formatTemplate } from "@/lib/format/template";
import {
  countryIsoFromName,
  getCountryOptions,
} from "@/lib/geo/country-data";
import { OpportunityPhoneActions } from "./OpportunityQuickEditModal";
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
  type OpportunityActionCapability,
  type OpportunityBoard,
  type OpportunityCardRecord,
  type OpportunityPipeline,
  type OpportunityStage,
  type StageFlag,
} from "../hooks/pipeline-types";
import { useOpportunityCurrencyOptions } from "../hooks/useCreateOpportunity";
import { useCustomerProfileOptions } from "../hooks/useCustomerProfileOptions";
import { opportunityCapabilityAllowsOwner } from "../hooks/usePipelineWorkspace";
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
  createCapability: OpportunityActionCapability | null;
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
  onForbidden?: () => void;
}

const CARD_BORDER_ACCENT: Partial<Record<CardColor, string>> = {
  RED: "border-swatch-red/40 border-s-4 border-s-swatch-red",
  ORANGE: "border-swatch-amber/40 border-s-4 border-s-swatch-amber",
  AMBER: "border-swatch-amber/40 border-s-4 border-s-swatch-amber",
  YELLOW: "border-swatch-yellow/40 border-s-4 border-s-swatch-yellow",
  GREEN: "border-swatch-green/40 border-s-4 border-s-swatch-green",
  TEAL: "border-swatch-teal/40 border-s-4 border-s-swatch-teal",
  BLUE: "border-swatch-blue/40 border-s-4 border-s-swatch-blue",
  INDIGO: "border-swatch-indigo/40 border-s-4 border-s-swatch-indigo",
  PURPLE: "border-swatch-purple/40 border-s-4 border-s-swatch-purple",
  PINK: "border-swatch-pink/40 border-s-4 border-s-swatch-pink",
  SLATE: "border-swatch-slate/40 border-s-4 border-s-swatch-slate",
};

function getStageVisual(flag: StageFlag) {
  switch (flag) {
    case "WON":
      return {
        topAccent: "border-t-[3px] border-t-success",
        dotColor: "bg-success",
        pillTone:
          "bg-success-subtle text-success-subtle-foreground border-success/30",
      };
    case "LOST":
      return {
        topAccent: "border-t-[3px] border-t-destructive",
        dotColor: "bg-destructive",
        pillTone:
          "bg-destructive-subtle text-destructive-subtle-foreground border-destructive/30",
      };
    case "ON_HOLD":
      return {
        topAccent: "border-t-[3px] border-t-warning",
        dotColor: "bg-warning",
        pillTone:
          "bg-warning-subtle text-warning-subtle-foreground border-warning/30",
      };
    case "PROPOSAL":
    case "NEGOTIATION":
    case "CONTRACTING":
      return {
        topAccent: "border-t-[3px] border-t-swatch-purple",
        dotColor: "bg-swatch-purple",
        pillTone:
          "bg-swatch-purple/10 text-swatch-purple border-swatch-purple/30",
      };
    case "QUALIFICATION":
    case "DISCOVERY":
      return {
        topAccent: "border-t-[3px] border-t-swatch-indigo",
        dotColor: "bg-swatch-indigo",
        pillTone:
          "bg-swatch-indigo/10 text-swatch-indigo border-swatch-indigo/30",
      };
    default:
      return {
        topAccent: "border-t-[3px] border-t-primary",
        dotColor: "bg-primary",
        pillTone:
          "bg-primary-subtle text-primary-subtle-foreground border-primary/30",
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

function formatRelativeAge(isoDate: string | undefined, labels: Dictionary["crmOpportunities"], lang: Language): string {
  if (!isoDate) return labels.justNow;
  const time = new Date(isoDate).getTime();
  if (Number.isNaN(time)) return "";
  const diffMinutes = Math.max(1, Math.floor((Date.now() - time) / (1000 * 60)));
  if (diffMinutes < 60) return formatTemplate(labels.minutesAgo, { count: formatNumber(diffMinutes, lang) });
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return formatTemplate(labels.hoursInStage, { count: formatNumber(diffHours, lang) });
  const diffDays = Math.floor(diffHours / 24);
  return formatTemplate(labels.daysInStage, { count: formatNumber(diffDays, lang) });
}

export function OpportunityExecutiveBoardView({
  pipeline,
  board,
  branchId,
  isMutating,
  loadingStageId,
  canCreate: canCreateByScope,
  createCapability,
  canUpdate: canUpdateByScope,
  canDelete: canDeleteByScope,
  onOpen,
  onOpenQuickModal,
  onOpenFullCreate,
  onDelete,
  onOpenActivities,
  onCardChange,
  onMoveCard,
  onLoadMoreStage,
  onRefreshBoard,
  onForbidden,
}: OpportunityExecutiveBoardViewProps) {
  const { t, lang } = useI18n();
  const { canMutate } = useAccessMode();
  const canCreate = canMutate && canCreateByScope;
  const canUpdate = (item: OpportunityCardRecord) => canMutate && canUpdateByScope(item);
  const canDelete = (item: OpportunityCardRecord) => canMutate && canDeleteByScope(item);

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
      canUpdate(item)
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
                "flex h-full w-12 shrink-0 flex-col items-center gap-2.5 rounded-lg border border-border bg-muted/60 px-1.5 py-3 transition-colors",
                visual.topAccent,
                isDropTarget && "ring-2 ring-primary bg-primary-subtle/40",
              )}
            >
              <Button
                type="button"
                variant="ghost"
                size="xs"
                onClick={() => toggleCollapse(stage.id)}
                title={t.views.expandColumn}
                aria-label={`${t.views.expandColumn}: ${stageLabel}`}
                className="flex size-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-card hover:text-foreground"
              >
                <ChevronsRight className="size-4 rtl:-scale-x-100" aria-hidden="true" />
              </Button>
              <span className="rounded-full bg-card px-2 py-0.5 text-xs font-semibold tabular-nums text-foreground shadow-2xs">
                {totalCount}
              </span>
              <span className="flex-1 select-none text-xs font-semibold tracking-wide text-muted-foreground [writing-mode:vertical-rl]">
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
              "flex h-full w-80 shrink-0 flex-col overflow-hidden rounded-lg border border-border bg-muted/50 shadow-2xs transition-colors",
              visual.topAccent,
              isDropTarget && "ring-2 ring-primary bg-primary-subtle/30",
            )}
          >
            {/* Column Header */}
            <header className="flex flex-col gap-2 border-b border-border bg-card px-3 py-2.5">
              <div className="flex items-center justify-between gap-1.5">
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    className={cn("size-2 shrink-0 rounded-full", visual.dotColor)}
                    aria-hidden="true"
                  />
                  <h3 className="truncate text-xs font-semibold tracking-tight text-foreground">
                    {stageLabel}
                  </h3>
                  <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-muted px-1.5 py-0.5 text-2xs font-semibold tabular-nums text-foreground">
                    {totalCount}
                  </span>
                </div>

                <div className="flex shrink-0 items-center gap-0.5">
                  {canCreate && !isTerminal && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="xs"
                      onClick={() =>
                        setQuickAddStageId((curr) =>
                          curr === stage.id ? null : stage.id,
                        )
                      }
                      aria-label={`${t.crmOpportunityDetail.createAction}: ${stageLabel}`}
                      title={
                        t.crmOpportunities.quickAddInStage
                      }
                      className={cn(
                        "flex size-6 items-center justify-center rounded-md transition-colors",
                        quickAddStageId === stage.id
                          ? "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground",
                      )}
                    >
                      <Plus className="size-3.5" aria-hidden="true" />
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    onClick={() => toggleCollapse(stage.id)}
                    title={t.views.collapseColumn}
                    aria-label={`${t.views.collapseColumn}: ${stageLabel}`}
                    className="flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <ChevronsLeft className="size-3.5 rtl:-scale-x-100" aria-hidden="true" />
                  </Button>
                </div>
              </div>

              {amountSummary && (
                <div className="flex items-center justify-between text-2xs font-semibold tabular-nums text-success">
                  <span className="truncate">{amountSummary}</span>
                </div>
              )}

              {/* Interactive 4-Color Activity Bar */}
              <div className="space-y-1">
                <div
                  role="group"
                  aria-label={t.crmLeads.card.activityBar}
                  className="flex h-1.5 w-full overflow-hidden rounded-full bg-muted"
                >
                  {overdueCount > 0 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="xs"
                      onClick={() => toggleActivityFilter(stage.id, "OVERDUE")}
                      style={{ flexGrow: overdueCount }}
                      title={`${t.crmLeads.card.activityStates.OVERDUE}: ${overdueCount}`}
                      className={cn(
                        "h-full min-w-0 rounded-none bg-destructive p-0 transition-opacity hover:bg-destructive hover:opacity-90",
                        activeFilter && activeFilter !== "OVERDUE" && "opacity-30",
                      )}
                    />
                  )}
                  {todayCount > 0 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="xs"
                      onClick={() => toggleActivityFilter(stage.id, "TODAY")}
                      style={{ flexGrow: todayCount }}
                      title={`${t.crmLeads.card.activityStates.TODAY}: ${todayCount}`}
                      className={cn(
                        "h-full min-w-0 rounded-none bg-warning p-0 transition-opacity hover:bg-warning hover:opacity-90",
                        activeFilter && activeFilter !== "TODAY" && "opacity-30",
                      )}
                    />
                  )}
                  {futureCount > 0 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="xs"
                      onClick={() => toggleActivityFilter(stage.id, "FUTURE")}
                      style={{ flexGrow: futureCount }}
                      title={`${t.crmLeads.card.activityStates.FUTURE}: ${futureCount}`}
                      className={cn(
                        "h-full min-w-0 rounded-none bg-success p-0 transition-opacity hover:bg-success hover:opacity-90",
                        activeFilter && activeFilter !== "FUTURE" && "opacity-30",
                      )}
                    />
                  )}
                  {noneCount > 0 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="xs"
                      onClick={() => toggleActivityFilter(stage.id, "NONE")}
                      style={{ flexGrow: noneCount }}
                      title={`${t.crmLeads.card.activityStates.NONE}: ${noneCount}`}
                      className={cn(
                        "h-full min-w-0 rounded-none bg-muted-foreground/30 p-0 transition-opacity hover:bg-muted-foreground/30 hover:opacity-90",
                        activeFilter && activeFilter !== "NONE" && "opacity-30",
                      )}
                    />
                  )}
                </div>

                {activeFilter && (
                  <div className="flex items-center justify-between text-2xs font-semibold text-primary">
                    <span>
                      {formatTemplate(t.crmOpportunities.filteredActivity, { activity: t.crmLeads.card.activityStates[activeFilter] })} (
                      {filteredItems.length})
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="xs"
                      onClick={() =>
                        setColumnActivityFilter((prev) => ({
                          ...prev,
                          [stage.id]: null,
                        }))
                      }
                      className="h-auto p-0 text-2xs underline hover:bg-transparent hover:no-underline"
                    >
                      {t.crmOpportunities.clearFilter}
                    </Button>
                  </div>
                )}
              </div>
            </header>

            {/* Quick-Add Opportunity Inline Card */}
            {canCreate && createCapability && quickAddStageId === stage.id && pipeline && (
              <div className="border-b border-primary/30 bg-primary-subtle/40 p-2.5">
                <BoardColumnQuickAddOpportunityCard
                  pipeline={pipeline}
                  stage={stage}
                  branchId={branchId}
                  createCapability={createCapability}
                  onForbidden={onForbidden}
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
                <div className="flex h-36 flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card/50 p-4 text-center text-xs text-muted-foreground">
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
  createCapability,
  onClose,
  onCreated,
  onForbidden,
  onOpenFullForm,
}: {
  pipeline: OpportunityPipeline;
  stage: OpportunityStage;
  branchId: string | null;
  createCapability: OpportunityActionCapability;
  onClose: () => void;
  onCreated: () => void;
  onForbidden?: () => void;
  onOpenFullForm: (draft: QuickCreateOpportunityDraft) => void;
}) {
  const { t } = useI18n();
  const toast = useToast();

  const [customerProfileId, setCustomerProfileId] = useState("");
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [currencyCode, setCurrencyCode] = useState("");
  const currencyOptions = useOpportunityCurrencyOptions(true);
  const [probabilityPercent, setProbabilityPercent] = useState("50");
  const [expectedCloseDate, setExpectedCloseDate] = useState("");
  const [importance, setImportance] = useState<number>(2);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const customers = useCustomerProfileOptions(branchId, true);
  const customerOptions: ComboboxOption[] = useMemo(
    () =>
      customers.items
        .filter((item) =>
          opportunityCapabilityAllowsOwner(createCapability, item.ownerUserId),
        )
        .map((item) => ({
          value: item.id,
          label: item.displayName,
          description:
            item.companyName && item.companyName !== item.displayName
              ? item.companyName
              : undefined,
        })),
    [customers.items, createCapability],
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
        t.crmOpportunities.customerRequired,
      );
      return;
    }
    if (!title.trim()) {
      setErrorMsg(
        t.crmOpportunities.titleRequired,
      );
      return;
    }
    const trimmedAmount = amount.trim();
    if (trimmedAmount.length > 0 && !isExactMoneyDecimal(trimmedAmount, currencyCode)) {
      setErrorMsg(t.crmShared.refusals.CRM_AMOUNT_SCALE_INVALID);
      return;
    }

    setIsSaving(true);
    try {
      const wireAmount = toMoneyWireNumber(trimmedAmount, currencyCode);
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
      }
      if (currencyCode) body.currencyCode = currencyCode;
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
        if (outcome.error.status === 403) onForbidden?.();
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
      className="space-y-2.5 rounded-lg border border-primary/40 bg-card p-3 shadow-md"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-wider text-primary">
          <Sparkles className="size-3.5" aria-hidden="true" />
          {t.crmOpportunities.quickAdd}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="xs"
          onClick={onClose}
          aria-label={t.common.cancel}
          className="h-auto w-auto rounded-md p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X className="size-3.5" aria-hidden="true" />
        </Button>
      </div>

      {errorMsg && (
        <div
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive-subtle px-2.5 py-1.5 text-2xs font-medium text-destructive-subtle-foreground"
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
            t.crmOpportunities.titleExample
          }
          disabled={isSaving}
          maxLength={255}
        />
      </Field>

      {/* Deal Value + Currency + Probability */}
      <div className="grid grid-cols-12 gap-1.5">
        <div className="col-span-6">
          <label className="mb-1 block text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
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
          <label className="mb-1 block text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t.crmLeadConvert.currencyCode}
          </label>
          <Select
            value={currencyCode || "__workspace_default__"}
            onValueChange={(code) =>
              setCurrencyCode(code === "__workspace_default__" ? "" : code)
            }
            disabled={isSaving}
          >
            <SelectTrigger size="sm" aria-label={t.crmLeadConvert.currencyCode}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__workspace_default__">
                {t.crmOpportunities.workspaceDefaultCurrency}
              </SelectItem>
              {currencyOptions.map((code) => (
                <SelectItem key={code} value={code}>
                  {code}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="col-span-3">
          <label className="mb-1 block text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t.crmOpportunities.probabilityShort}
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
          <label className="mb-1 block text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
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
          <span className="mb-1 block text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t.crmOpportunities.importance}
          </span>
          <div className="flex items-center gap-0.5 rounded-lg border border-border bg-muted/40 px-2 py-1.5">
            {[1, 2, 3].map((star) => (
              <Button
                key={star}
                type="button"
                variant="ghost"
                size="xs"
                onClick={() => setImportance(importance === star ? 0 : star)}
                className="h-auto w-auto p-0.5 hover:bg-transparent"
              >
                <Star
                  className={cn(
                    "size-3.5 transition-colors",
                    star <= importance
                      ? "fill-warning text-warning"
                      : "text-muted-foreground/40",
                  )}
                />
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* Footer Actions */}
      <div className="flex items-center justify-between gap-2 border-t border-border pt-2">
        <Button
          type="button"
          variant="ghost"
          size="xs"
          onClick={() => onOpenFullForm(buildDraft())}
          className="inline-flex h-auto items-center gap-1 p-0 text-2xs font-semibold text-primary hover:bg-transparent hover:underline"
        >
          <span>{t.crmOpportunities.fullForm}</span>
          <ExternalLink className="size-3" aria-hidden="true" />
        </Button>
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
  const { canMutate } = useAccessMode();
  const { user } = useTenantAuth();
  const canOpenActivities = canMutate && canCreateActivities(user);

  const [detail, setDetail] = useState<OpportunityDetail | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  useEffect(() => {
    if (!isExpanded) return;
    const controller = new AbortController();
    queueMicrotask(() => {
      if (!controller.signal.aborted) setIsLoadingDetail(true);
    });
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
    : "border-border";

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
        "group relative flex flex-col gap-2 rounded-lg border bg-card p-3 shadow-2xs transition-all hover:shadow-md",
        borderAccent,
        isDragging && " scale-[0.98] opacity-50 ring-2 ring-primary",
      )}
    >
      {/* Row 1: Customer Header + Expand / Quick Inspect / Card Menu */}
      <div className="flex items-start justify-between gap-1.5">
        <div className="flex min-w-0 flex-1 items-center gap-1.5">
          {canDrag && (
            <GripVertical
              className="size-3.5 shrink-0 cursor-grab text-muted-foreground/40 opacity-0 transition-opacity group-hover:opacity-100"
              aria-hidden="true"
            />
          )}
          <span className="flex size-5 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
            <ProfileIcon className="size-3" aria-hidden="true" />
          </span>
          <span className="truncate text-2xs font-semibold text-muted-foreground">
            {customerName}
          </span>
        </div>

        <div
          className="flex shrink-0 items-center gap-0.5"
          onClick={(e) => e.stopPropagation()}
        >
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={onToggleExpand}
            aria-label={isExpanded ? t.crmOpportunities.collapseCard : t.crmOpportunities.expandCard}
            title={
              isExpanded ? t.crmOpportunities.collapseCard : t.crmOpportunities.expandCard
            }
            className="flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            {isExpanded ? (
              <ChevronUp className="size-3.5" aria-hidden="true" />
            ) : (
              <ChevronDown className="size-3.5" aria-hidden="true" />
            )}
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={onOpenQuickModal}
            aria-label={t.crmOpportunities.quickInspect}
            title={t.crmOpportunities.quickInspect}
            className="flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-primary-subtle hover:text-primary"
          >
            <Eye className="size-3.5" aria-hidden="true" />
          </Button>

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
        <Button
          type="button"
          variant="ghost"
          size="xs"
          onClick={onOpen}
          className="h-auto min-w-0 flex-1 justify-start p-0 text-start text-sm font-semibold leading-snug text-foreground hover:bg-transparent hover:text-primary"
        >
          <span className="line-clamp-2">{item.title}</span>
        </Button>
        <StatusBadge
          value={item.status}
          kind="OpportunityStatus"
          className="shrink-0 px-1.5 py-0 text-2xs font-semibold"
        />
      </div>

      {/* Row 3: Commercial Value + Probability + Expected Close Strip */}
      {(effective.amount || probabilityLabel || effective.expectedCloseDate) && (
        <div className="flex flex-wrap items-center justify-between gap-1.5 rounded-lg border border-border bg-muted/40 px-2.5 py-1.5 text-xs">
          <div className="flex items-center gap-1.5 font-semibold text-success">
            <Banknote className="size-3.5 shrink-0" aria-hidden="true" />
            {effective.amount ? (
              <Money
                value={effective.amount}
                currency={effective.currencyCode ?? undefined}
                language={lang}
                className="font-semibold"
              />
            ) : (
              <span className="text-muted-foreground">—</span>
            )}
          </div>

          <div className="flex items-center gap-2 text-2xs font-semibold text-muted-foreground">
            {probabilityLabel && (
              <span className="inline-flex items-center gap-0.5 rounded-full bg-primary-subtle px-1.5 py-0.5 text-2xs font-semibold text-primary-subtle-foreground">
                <CirclePercent className="size-3" aria-hidden="true" />
                {probabilityLabel}
              </span>
            )}
            {effective.expectedCloseDate && (
              <span className="inline-flex items-center gap-1 text-2xs text-muted-foreground">
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
          <div className="min-w-0 flex-1 truncate text-muted-foreground">
            {effective.primaryContact ? (
              <span className="inline-flex items-center gap-1 truncate font-medium">
                <BriefcaseBusiness className="size-3 shrink-0 text-muted-foreground" />
                <span className="truncate">
                  {effective.primaryContact.displayName}
                </span>
              </span>
            ) : item.contactDisplayName ? (
              <span className="inline-flex items-center gap-1 truncate font-medium">
                <BriefcaseBusiness className="size-3 shrink-0 text-muted-foreground" />
                <span className="truncate">{item.contactDisplayName}</span>
              </span>
            ) : (
              primaryPhone && (
                <span className="font-mono text-2xs tabular-nums" dir="ltr">
                  {primaryPhone}
                </span>
              )
            )}
          </div>

          {primaryPhone && <OpportunityPhoneActions phone={primaryPhone} country={effective.customerCountry} />}
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
            <span className="text-2xs font-semibold text-muted-foreground">
              +{effective.tags.length - 3}
            </span>
          )}
        </div>
      )}

      {/* Expanded Same-Page Details Drawer */}
      {isExpanded && (
        <div
          className="mt-1 space-y-2.5 rounded-lg border border-border bg-muted/40 p-2.5 text-xs"
          onClick={(e) => e.stopPropagation()}
        >
          {isLoadingDetail && (
            <div className="flex items-center gap-1.5 text-2xs text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
              <span>{t.crmOpportunities.loadingDetails}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2 text-2xs">
            <div>
              <span className="block text-2xs font-semibold uppercase text-muted-foreground">
                {t.crmOpportunities.stage}
              </span>
              <span className="font-semibold text-foreground">
                {localizedName(stage, lang)}
              </span>
            </div>
            <div>
              <span className="block text-2xs font-semibold uppercase text-muted-foreground">
                {t.crmOpportunities.stageAge}
              </span>
              <span className="font-semibold text-foreground">
                {formatRelativeAge(item.updatedAt || item.createdAt, t.crmOpportunities, lang)}
              </span>
            </div>
          </div>

          {primaryEmail && (
            <a
              href={`mailto:${primaryEmail}`}
              className="flex items-center gap-1.5 truncate text-2xs font-medium text-primary hover:underline"
            >
              <Mail className="size-3 shrink-0" aria-hidden="true" />
              <span className="truncate">{primaryEmail}</span>
            </a>
          )}

          {location && (
            <div className="flex items-center gap-1.5 text-2xs text-muted-foreground">
              <MapPin className="size-3 shrink-0 text-muted-foreground" aria-hidden="true" />
              <span className="truncate">{location}</span>
              {country?.flag && <span aria-hidden="true">{country.flag}</span>}
            </div>
          )}

          {effective.leadSourceName && (
            <div className="flex items-center gap-1.5 text-2xs text-muted-foreground">
              <AcquisitionSourceIcon
                source={{ iconUrl: effective.leadSourceIconUrl }}
              />
              <span className="truncate">{effective.leadSourceName}</span>
            </div>
          )}

          {effective.description && (
            <p className="line-clamp-3 rounded-lg border border-border bg-card p-2 text-2xs text-muted-foreground">
              {effective.description}
            </p>
          )}

          <div className="flex items-center justify-between gap-2 border-t border-border pt-2">
            <Button
              type="button"
              variant="ghost"
              size="xs"
              onClick={onOpenQuickModal}
              className="inline-flex h-auto items-center gap-1 p-0 text-2xs font-semibold text-foreground hover:bg-transparent hover:text-primary"
            >
              <Eye className="size-3" aria-hidden="true" />
              <span>{t.crmOpportunities.quick360}</span>
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="xs"
              onClick={onOpen}
              className="inline-flex h-auto items-center gap-1 p-0 text-2xs font-semibold text-primary hover:bg-transparent hover:underline"
            >
              <span>{t.crmOpportunities.fullDossier}</span>
              <ExternalLink className="size-3" aria-hidden="true" />
            </Button>
          </div>
        </div>
      )}

      {/* Row 6: Footer (1★-3★ Importance Stars + Activity Pill + Owner Avatar) */}
      <div
        className="mt-0.5 flex items-center justify-between gap-2 border-t border-border pt-2"
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
              if (!canUpdate) return <Star key={star} className={cn("size-3.5", active ? "fill-warning text-warning" : "text-muted-foreground")} aria-hidden="true" />;
              return (
                <Button
                  key={star}
                  type="button"
                  variant="ghost"
                  size="xs"
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
                  className="h-auto w-auto rounded-xs p-0.5 transition-transform hover:scale-110 hover:bg-transparent disabled:cursor-default"
                >
                  <Star
                    className={cn(
                      "size-3.5",
                      active
                        ? "fill-warning text-warning"
                        : "text-muted-foreground/40 hover:text-warning",
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
              size="xs"
              onClick={onOpenActivities}
              title={t.activities.title}
              className={cn(
                "inline-flex h-auto items-center gap-1 rounded-full border px-2 py-0.5 text-2xs font-semibold transition-colors",
                actState === "OVERDUE"
                  ? "border-destructive/30 bg-destructive-subtle text-destructive-subtle-foreground"
                  : actState === "TODAY"
                    ? "border-warning/30 bg-warning-subtle text-warning-subtle-foreground"
                    : actState === "FUTURE"
                      ? "border-success/30 bg-success-subtle text-success-subtle-foreground"
                      : "border-border bg-muted/50 text-muted-foreground hover:bg-muted",
              )}
            >
              <Activity className="size-3" aria-hidden="true" />
              <span>
                {effective.openActivityCount > 0
                  ? formatNumber(effective.openActivityCount, lang)
                  : "+"}
              </span>
            </Button>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {effective.ownerDisplayName ? (
            <span
              title={`${t.crmOpportunities.owner}: ${effective.ownerDisplayName}`}
              className="inline-flex items-center gap-1 text-2xs font-semibold text-muted-foreground"
            >
              <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary-subtle text-2xs font-semibold text-primary-subtle-foreground">
                {initials || "U"}
              </span>
              <span className="max-w-20 truncate">
                {effective.ownerDisplayName}
              </span>
            </span>
          ) : (
            <span className="text-2xs text-muted-foreground">
              {formatRelativeAge(item.createdAt, t.crmOpportunities, lang)}
            </span>
          )}
        </div>
      </div>
    </article>
  );
}
