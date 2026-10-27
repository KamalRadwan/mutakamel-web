"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
  Loader2,
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
  Button,
  Combobox,
  Field,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  cn,
  useToast,
  type BoardCardMove,
  type CardColor,
  type ComboboxOption,
  type MoveToTarget,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { axiosClient } from "@/lib/api/axiosClient";
import { normalizeApiError } from "@/lib/api/errors";
import { createWriteAttempt, runIdempotentWrite } from "@/lib/api/idempotent-write";
import { localizedName, localizedValue } from "@/lib/format/localized";
import { formatTemplate } from "@/lib/format/template";
import { isUUIDv7 } from "@/lib/uuid";
import type { AcquisitionSource } from "../../acquisition-sources/acquisition-source-contract";
import { useLeadCompanyOptions } from "../../leads/hooks/useLeadCompanyOptions";
import {
  normalizePhoneDigits,
  normalizeWhatsAppDigits,
} from "../../leads/lead-phone-links";
import {
  AcquisitionSourceIcon,
  AcquisitionSourceOption,
} from "../../shared/components/AcquisitionSourceIcon";
import { CrmPhoneListField } from "../../shared/components/CrmPhoneListField";
import {
  crmActivityState,
  type CrmActivityState,
} from "../../shared/crm-activity-tone";
import { CrmErrorBag } from "../../shared/crm-form-validation";
import { useCrmFieldMessages } from "../../shared/hooks/useCrmFieldMessages";
import type {
  PartyDocumentCountVisibility,
  PartyDocumentCounts,
} from "../../shared/party-document-counts-contract";
import {
  BLACKLISTED_STATUS,
  parseCustomerProfileDetailResponse,
  type CustomerProfileDetail,
} from "../customer-profile-contract";
import type { CustomerProfileCardPatch } from "../customer-profile-card-contract";
import {
  CUSTOMER_PROFILE_CREATE_LIMITS,
  buildCreateCustomerProfileFullRequest,
  emptyCreateCustomerProfileForm,
} from "../customer-profile-create-contract";
import {
  CUSTOMER_PROFILE_BOARD_STATUSES,
  type CustomerProfileBoardLane,
} from "../hooks/useCustomerProfileBoard";
import {
  CUSTOMER_PROFILES_PATH,
  customerProfilePath,
  type CustomerProfileItem,
  type CustomerProfileOwner,
  type CustomerProfileStatus,
} from "../hooks/useCustomerProfiles";
import { getCustomerStatusVisual } from "./CustomerProfileStatusFunnelBar";
import { CustomerProfileCardMenu } from "./customer-card/CustomerProfileCardMenu";

export interface QuickCreateCustomerDraft {
  profileType: "INDIVIDUAL" | "CORPORATE";
  status: CustomerProfileStatus;
  acquisitionSourceId: string;
  firstName: string;
  lastName: string;
  phones: string[];
  companyName: string;
  companyPhones: string[];
  contactFirstName: string;
  contactLastName: string;
  contactPhones: string[];
}

export interface CustomerExecutiveBoardViewProps {
  items: readonly CustomerProfileItem[];
  statusTotals: ReadonlyMap<CustomerProfileStatus, number>;
  lanes: Record<string, CustomerProfileBoardLane>;
  loadingStatuses: ReadonlySet<string>;
  onLoadMoreStatus: (status: string) => void;
  branchId: string | null;
  sources?: ReadonlyArray<AcquisitionSource>;
  canCreate?: boolean;
  canUpdate: (item: CustomerProfileItem) => boolean;
  canDelete: (item: CustomerProfileItem) => boolean;
  onOpen: (item: CustomerProfileItem) => void;
  onOpenQuickModal?: (item: CustomerProfileItem) => void;
  onOpenFullCreate?: (
    status?: CustomerProfileStatus,
    draft?: QuickCreateCustomerDraft,
  ) => void;
  onDelete?: (item: CustomerProfileItem) => void;
  onOpenActivities?: (item: CustomerProfileItem) => void;
  onCardChange: (
    item: CustomerProfileItem,
    patch: CustomerProfileCardPatch,
  ) => void;
  onCardMove: (move: BoardCardMove) => void;
  onRefreshBoard?: () => void;
  documentCountsByParty?: ReadonlyMap<string, PartyDocumentCounts>;
  documentCountVisibility?: PartyDocumentCountVisibility;
}

const CARD_BORDER_ACCENT: Partial<Record<CardColor, string>> = {
  RED: "border-swatch-red-soft border-s-4 border-s-swatch-red",
  ORANGE: "border-swatch-orange-soft border-s-4 border-s-swatch-orange",
  AMBER: "border-swatch-amber-soft border-s-4 border-s-swatch-amber",
  YELLOW: "border-swatch-yellow-soft border-s-4 border-s-swatch-yellow",
  GREEN: "border-swatch-green-soft border-s-4 border-s-swatch-green",
  TEAL: "border-swatch-teal-soft border-s-4 border-s-swatch-teal",
  BLUE: "border-swatch-blue-soft border-s-4 border-s-swatch-blue",
  INDIGO: "border-swatch-indigo-soft border-s-4 border-s-swatch-indigo",
  PURPLE: "border-swatch-purple-soft border-s-4 border-s-swatch-purple",
  PINK: "border-swatch-pink-soft border-s-4 border-s-swatch-pink",
  SLATE: "border-swatch-slate-soft border-s-4 border-s-swatch-slate",
};

function customerOwnerInitials(owner: CustomerProfileOwner): string {
  return [owner.firstName, owner.lastName]
    .map((part) => Array.from(part.trim())[0] ?? "")
    .join("");
}

function customerCardHeading(item: CustomerProfileItem): {
  title: string;
  contactName: string | null;
} {
  if (item.profileType === "INDIVIDUAL") {
    return { title: item.displayName, contactName: null };
  }
  const contactName = (item.primaryContactName ?? "").trim();
  return {
    title: item.companyName || item.displayName,
    contactName: contactName || null,
  };
}

function formatRelativeAge(
  isoDate: string | undefined,
  t: ReturnType<typeof useI18n>["t"],
): string {
  if (!isoDate) return t.crmCustomerProfiles.ui.board.just_now;
  const time = new Date(isoDate).getTime();
  if (Number.isNaN(time)) return "";
  const diffMinutes = Math.max(1, Math.floor((Date.now() - time) / (1000 * 60)));
  if (diffMinutes < 60) {
    return formatTemplate(t.crmCustomerProfiles.ui.board.value_m_ago, {
      diffMinutes,
    });
  }
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return formatTemplate(t.crmCustomerProfiles.ui.board.value_h_in_stage, {
      diffHours,
    });
  }
  const diffDays = Math.floor(diffHours / 24);
  return formatTemplate(t.crmCustomerProfiles.ui.board.value_d_in_stage, {
    diffDays,
  });
}

export function CustomerExecutiveBoardView({
  items,
  statusTotals,
  lanes,
  loadingStatuses,
  onLoadMoreStatus,
  branchId,
  sources = [],
  canCreate = false,
  canUpdate,
  canDelete,
  onOpen,
  onOpenQuickModal,
  onOpenFullCreate,
  onDelete,
  onOpenActivities,
  onCardChange,
  onCardMove,
  onRefreshBoard,
}: CustomerExecutiveBoardViewProps) {
  const { t } = useI18n();
  const statusLabels: Record<string, string | undefined> = t.statusValues;

  // Drag & Drop State
  const [draggingItem, setDraggingItem] = useState<CustomerProfileItem | null>(
    null,
  );
  const [dragOverStatus, setDragOverStatus] =
    useState<CustomerProfileStatus | null>(null);

  // Collapsed Columns & Auto-Peek on Drag
  const [collapsedStatuses, setCollapsedStatuses] = useState<
    Set<CustomerProfileStatus>
  >(new Set());
  const [peekStatus, setPeekStatus] = useState<CustomerProfileStatus | null>(
    null,
  );
  const peekTimerRef = useRef<number | null>(null);

  // Per-Column Activity State Filter
  const [columnActivityFilter, setColumnActivityFilter] = useState<
    Partial<Record<CustomerProfileStatus, CrmActivityState | null>>
  >({});

  // Quick-Add Customer State per Column
  const [quickAddStatus, setQuickAddStatus] =
    useState<CustomerProfileStatus | null>(null);

  // Expanded Card ID (Same-Page Expanded View Mode matching Leads `editingLeadId`)
  const [expandedCustomerId, setExpandedCustomerId] = useState<string | null>(
    null,
  );

  const itemsByStatus = useMemo(() => {
    const map = new Map<CustomerProfileStatus, CustomerProfileItem[]>();
    for (const status of CUSTOMER_PROFILE_BOARD_STATUSES) {
      map.set(status, []);
    }
    for (const item of items) {
      const list = map.get(item.status);
      if (list) list.push(item);
    }
    return map;
  }, [items]);

  useEffect(
    () => () => {
      if (peekTimerRef.current) {
        window.clearTimeout(peekTimerRef.current);
      }
    },
    [],
  );

  function toggleColumnActivityFilter(
    status: CustomerProfileStatus,
    state: CrmActivityState,
  ) {
    setColumnActivityFilter((prev) => ({
      ...prev,
      [status]: prev[status] === state ? null : state,
    }));
  }

  const draggingFromLabel = draggingItem
    ? (statusLabels[`CustomerStatus.${draggingItem.status}`] ?? draggingItem.status)
    : "";
  const draggingToLabel = dragOverStatus
    ? (statusLabels[`CustomerStatus.${dragOverStatus}`] ?? dragOverStatus)
    : "";

  return (
    <div className="relative flex h-full min-h-0 flex-col">
      {/* Horizontal Kanban Board Container */}
      <div
        role="region"
        aria-label={t.crmCustomerProfiles.ui.board.customer_status_board}
        className="flex h-full min-h-0 flex-1 items-stretch gap-3 overflow-x-auto pb-3"
      >
        {CUSTOMER_PROFILE_BOARD_STATUSES.map((status) => {
          const statusTitle =
            statusLabels[`CustomerStatus.${status}`] ?? status;
          const allStatusItems = itemsByStatus.get(status) ?? [];
          const activeActivityState = columnActivityFilter[status] ?? null;
          const visibleItems = activeActivityState
            ? allStatusItems.filter(
                (item) => crmActivityState(item.nextActivity) === activeActivityState,
              )
            : allStatusItems;
          const totalInStatus = statusTotals.get(status) ?? allStatusItems.length;
          const lane = lanes[status];
          const isLoadingMore = loadingStatuses.has(status);
          const isQuickAddOpen = quickAddStatus === status;

          const isCollapsed =
            collapsedStatuses.has(status) &&
            !(draggingItem !== null && peekStatus === status);
          const isDropTarget =
            draggingItem !== null &&
            draggingItem.status !== status &&
            dragOverStatus === status;
          const isActiveCustomer = status === "ACTIVE_CUSTOMER";
          const isBlacklisted = status === BLACKLISTED_STATUS;
          const isInactive = status === "INACTIVE";

          // Activity task counts in this column: Green (FUTURE), Orange (TODAY), Red (OVERDUE), Gray (NONE)
          const activitySegments: ReadonlyArray<{
            state: CrmActivityState;
            label: string;
            count: number;
            barClass: string;
            dotClass: string;
            badgeClass: string;
          }> = [
            {
              state: "FUTURE",
              label: t.crmCustomerProfiles.ui.board.future,
              count: allStatusItems.filter(
                (c) => crmActivityState(c.nextActivity) === "FUTURE",
              ).length,
              barClass: "bg-swatch-green hover:bg-swatch-green/90",
              dotClass: "bg-swatch-green",
              badgeClass:
                "border-swatch-green bg-swatch-green-soft text-swatch-green-deep",
            },
            {
              state: "TODAY",
              label: t.crmCustomerProfiles.ui.board.today,
              count: allStatusItems.filter(
                (c) => crmActivityState(c.nextActivity) === "TODAY",
              ).length,
              barClass: "bg-swatch-orange hover:bg-swatch-orange/90",
              dotClass: "bg-swatch-orange",
              badgeClass:
                "border-swatch-orange bg-swatch-orange-soft text-swatch-orange-deep",
            },
            {
              state: "OVERDUE",
              label: t.crmCustomerProfiles.ui.board.overdue,
              count: allStatusItems.filter(
                (c) => crmActivityState(c.nextActivity) === "OVERDUE",
              ).length,
              barClass: "bg-swatch-red hover:bg-swatch-red/90",
              dotClass: "bg-swatch-red",
              badgeClass:
                "border-swatch-red bg-swatch-red-soft text-swatch-red-deep",
            },
            {
              state: "NONE",
              label: t.crmCustomerProfiles.ui.board.none,
              count: allStatusItems.filter(
                (c) => crmActivityState(c.nextActivity) === "NONE",
              ).length,
              barClass:
                "bg-swatch-slate/60 hover:bg-swatch-slate",
              dotClass: "bg-swatch-slate",
              badgeClass:
                "border-swatch-slate-soft bg-swatch-slate-soft text-swatch-slate-deep",
            },
          ];
          const visibleActivitySegments = activitySegments.filter(
            (seg) => seg.count > 0 || activeActivityState === seg.state,
          );
          const activeSegment =
            activitySegments.find((seg) => seg.state === activeActivityState) ??
            null;

          const topBorderClass = isActiveCustomer
            ? "border-t-4 border-t-swatch-green"
            : isBlacklisted
              ? "border-t-4 border-t-swatch-red"
              : isInactive
                ? "border-t-4 border-t-swatch-amber"
                : "border-t-4 border-t-swatch-blue";

          if (isCollapsed) {
            return (
              <div
                key={status}
                onDragOver={(e) => {
                  e.preventDefault();
                  if (!peekTimerRef.current) {
                    peekTimerRef.current = window.setTimeout(() => {
                      setPeekStatus(status);
                      peekTimerRef.current = null;
                    }, 400);
                  }
                }}
                onDragLeave={() => {
                  if (peekTimerRef.current) {
                    window.clearTimeout(peekTimerRef.current);
                    peekTimerRef.current = null;
                  }
                }}
                className={cn(
                  "flex h-full min-h-0 w-11 shrink-0 flex-col items-center gap-2.5 rounded-lg border border-border bg-card py-2.5 shadow-2xs transition-all",
                  topBorderClass,
                  draggingItem &&
                    "border-dashed border-swatch-blue bg-swatch-blue-soft/30",
                )}
              >
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  onClick={() =>
                    setCollapsedStatuses((prev) => {
                      const next = new Set(prev);
                      next.delete(status);
                      return next;
                    })
                  }
                  aria-label={`${t.views.expandColumn}: ${statusTitle}`}
                  title={`${t.views.expandColumn}: ${statusTitle}`}
                  className="flex size-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <ChevronsRight
                    className="size-4 rtl:-scale-x-100"
                    aria-hidden="true"
                  />
                </Button>

                <span className="inline-flex size-6 items-center justify-center rounded-full bg-swatch-blue-soft text-xs font-semibold tabular-nums text-swatch-blue-deep">
                  {totalInStatus}
                </span>

                <span className="min-h-0 truncate text-xs font-semibold tracking-wide text-foreground [writing-mode:vertical-rl]">
                  {statusTitle}
                </span>

                {draggingItem && (
                  <span className="mt-auto px-1 text-center text-xs font-medium text-primary [writing-mode:vertical-rl]">
                    {t.crmCustomerProfiles.ui.board.hover_to_peek}
                  </span>
                )}
              </div>
            );
          }

          return (
            <section
              key={status}
              aria-label={statusTitle}
              onDragOver={(e) => {
                if (!draggingItem || draggingItem.status === status) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                if (dragOverStatus !== status) setDragOverStatus(status);
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                  if (dragOverStatus === status) setDragOverStatus(null);
                }
              }}
              onDrop={(e) => {
                e.preventDefault();
                setDragOverStatus(null);
                if (!draggingItem || draggingItem.status === status) return;
                onCardMove({
                  itemId: draggingItem.id,
                  fromColumnId: draggingItem.status,
                  toColumnId: status,
                  toIndex: 0,
                });
                setDraggingItem(null);
              }}
              className={cn(
                "flex h-full min-h-0 w-[300px] max-w-[300px] shrink-0 flex-col rounded-lg border bg-muted/40 shadow-2xs transition-all",
                topBorderClass,
                isDropTarget
                  ? isBlacklisted
                    ? "border-2 border-swatch-red bg-swatch-red-soft/25"
                    : "border-2 border-swatch-green bg-swatch-green-soft/25"
                  : "border-border",
              )}
            >
              {/* Status Column Header (Matches LeadExecutiveBoardView Column Header) */}
              <div className="flex shrink-0 flex-col gap-2 rounded-t-lg border-b border-border bg-card px-3 py-2.5">
                <div className="flex items-center justify-between gap-1.5">
                  <div className="flex min-w-0 items-center gap-1.5">
                    <span className="truncate text-sm font-semibold text-foreground">
                      {statusTitle}
                    </span>
                    <span
                      className={cn(
                        "inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-xs font-semibold tabular-nums",
                        isActiveCustomer
                          ? "bg-swatch-green-soft text-swatch-green-deep"
                          : isBlacklisted
                            ? "bg-swatch-red-soft text-swatch-red-deep"
                            : "bg-swatch-blue-soft text-swatch-blue-deep",
                      )}
                    >
                      {totalInStatus}
                    </span>
                  </div>

                  <div className="flex shrink-0 items-center gap-1">
                    {isQuickAddOpen && (
                      <span className="inline-flex items-center gap-1 rounded-md border border-swatch-blue bg-swatch-blue-soft px-1.5 py-0.5 text-xs font-semibold text-swatch-blue-deep">
                        {t.crmCustomerProfiles.ui.board.quick_adding}
                      </span>
                    )}

                    {canCreate &&
                      branchId &&
                      status !== BLACKLISTED_STATUS &&
                      !isQuickAddOpen && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="xs"
                          onClick={() => setQuickAddStatus(status)}
                          aria-label={
                            formatTemplate(
                              t.crmCustomerProfiles.ui.board.quick_add_in_status,
                              { statusTitle },
                            )
                          }
                          title={
                            formatTemplate(
                              t.crmCustomerProfiles.ui.board.quick_add_in_status,
                              { statusTitle },
                            )
                          }
                          className="flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-swatch-blue-soft hover:text-swatch-blue-deep"
                        >
                          <Plus className="size-4" aria-hidden="true" />
                        </Button>
                      )}

                    <Button
                      type="button"
                      variant="ghost"
                      size="xs"
                      onClick={() =>
                        setCollapsedStatuses((prev) =>
                          new Set(prev).add(status),
                        )
                      }
                      aria-label={`${t.views.collapseColumn}: ${statusTitle}`}
                      title={`${t.views.collapseColumn}: ${statusTitle}`}
                      className="flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    >
                      <ChevronsLeft
                        className="size-3.5 rtl:-scale-x-100"
                        aria-hidden="true"
                      />
                    </Button>
                  </div>
                </div>

                {/* Interactive 4-Color Activity Filter Bar: only shows colors with matching tasks */}
                {visibleActivitySegments.length > 0 && (
                  <div
                    role="group"
                    aria-label={
                      formatTemplate(
                        t.crmCustomerProfiles.ui.board.filter_tasks_by_status,
                        { statusTitle },
                      )
                    }
                    className="flex h-2 w-full items-stretch gap-0.5 overflow-hidden rounded-full bg-muted"
                  >
                    {visibleActivitySegments.map((seg) => {
                      const isSelected = activeActivityState === seg.state;
                      const isDimmed =
                        activeActivityState !== null && !isSelected;
                      return (
                        <Button
                          key={seg.state}
                          type="button"
                          variant="ghost"
                          onClick={() =>
                            toggleColumnActivityFilter(status, seg.state)
                          }
                          style={{ flexGrow: Math.max(seg.count, 1) }}
                          aria-pressed={isSelected}
                          aria-label={`${seg.label}: ${seg.count}`}
                          title={
                            formatTemplate(
                              t.crmCustomerProfiles.ui.board.tasks_click_to_filter,
                              { seg_label: seg.label, seg_count: seg.count },
                            )
                          }
                          className={cn(
                            "h-full min-w-4 cursor-pointer rounded-none p-0 transition-all",
                            seg.barClass,
                            isSelected &&
                              "ring-1 ring-foreground",
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
                        "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-semibold",
                        activeSegment.badgeClass,
                      )}
                    >
                      <span
                        className={cn(
                          "size-1.5 rounded-full",
                          activeSegment.dotClass,
                        )}
                      />
                      <span>
                        {activeSegment.label} ({activeSegment.count})
                      </span>
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="xs"
                      onClick={() =>
                        setColumnActivityFilter((prev) => ({
                          ...prev,
                          [status]: null,
                        }))
                      }
                      className="inline-flex h-auto items-center gap-0.5 p-0 text-xs font-semibold text-muted-foreground hover:bg-transparent hover:text-foreground"
                    >
                      <X className="size-3" aria-hidden="true" />
                      <span>{t.crmCustomerProfiles.ui.board.clear}</span>
                    </Button>
                  </div>
                )}
              </div>

              {/* Column Cards List */}
              <div
                className={cn(
                  "flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto p-2.5",
                  isDropTarget && "bg-swatch-blue-soft/30",
                )}
              >
                {/* In-Column Quick-Add Customer Composer Card */}
                {isQuickAddOpen && branchId && (
                  <BoardColumnQuickAddCustomerCard
                    status={status}
                    statusTitle={statusTitle}
                    branchId={branchId}
                    sources={sources}
                    onCancel={() => setQuickAddStatus(null)}
                    onOpenFullModal={(draft) => {
                      setQuickAddStatus(null);
                      onOpenFullCreate?.(status, draft);
                    }}
                    onCreated={() => {
                      setQuickAddStatus(null);
                      onRefreshBoard?.();
                    }}
                  />
                )}

                {visibleItems.length === 0 && !isQuickAddOpen ? (
                  <div className="flex min-h-32 flex-1 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-card/50 p-4 text-center">
                    <span className="text-xs text-muted-foreground">
                      {t.crmCustomerProfiles.ui.board.no_customers_in_this_status}
                    </span>
                    {canCreate && branchId && status !== BLACKLISTED_STATUS && (
                      <Button
                        type="button"
                        variant="outline"
                        size="xs"
                        onClick={() => setQuickAddStatus(status)}
                        className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-2.5 py-1 text-xs font-semibold text-primary shadow-2xs hover:bg-swatch-blue-soft/40"
                      >
                        <Plus className="size-3" aria-hidden="true" />
                        <span>
                          {t.crmCustomerProfiles.ui.board.quick_add_customer}
                        </span>
                      </Button>
                    )}
                  </div>
                ) : (
                  visibleItems.map((item) => {
                    const isCardExpanded = expandedCustomerId === item.id;
                    const moveTargets: MoveToTarget[] =
                      CUSTOMER_PROFILE_BOARD_STATUSES.filter(
                        (candidate) => candidate !== item.status,
                      ).map((candidate) => ({
                        id: candidate,
                        label:
                          statusLabels[`CustomerStatus.${candidate}`] ??
                          candidate,
                      }));

                    return isCardExpanded ? (
                      <CustomerBoardCardExpandedView
                        key={item.id}
                        item={item}
                        sources={sources}
                        canUpdate={canUpdate(item)}
                        canDelete={canDelete(item)}
                        moveTargets={moveTargets}
                        onCollapse={() => setExpandedCustomerId(null)}
                        onOpen={() => onOpen(item)}
                        onOpenQuickModal={
                          onOpenQuickModal
                            ? () => onOpenQuickModal(item)
                            : undefined
                        }
               onOpenActivities={
                 onOpenActivities && item.status !== "BLACKLISTED"
                   ? () => onOpenActivities(item)
                   : undefined
               }
                        onDelete={onDelete ? () => onDelete(item) : undefined}
                        onMove={(targetStatus) =>
                          onCardMove({
                            itemId: item.id,
                            fromColumnId: item.status,
                            toColumnId: targetStatus,
                            toIndex: 0,
                          })
                        }
                        onCardChange={(patch) => onCardChange(item, patch)}
                      />
                    ) : (
                      <ExecutiveBoardCustomerCard
                        key={item.id}
                        item={item}
                        isDragging={draggingItem?.id === item.id}
                        draggingFromLabel={draggingFromLabel}
                        draggingToLabel={draggingToLabel}
                        canUpdate={canUpdate(item)}
                        canDelete={canDelete(item)}
                        moveTargets={moveTargets}
                        onOpen={() => onOpen(item)}
                        onExpandView={() => setExpandedCustomerId(item.id)}
                        onOpenQuickModal={
                          onOpenQuickModal
                            ? () => onOpenQuickModal(item)
                            : undefined
                        }
               onOpenActivities={
                 onOpenActivities && item.status !== "BLACKLISTED"
                   ? () => onOpenActivities(item)
                   : undefined
               }
                        onDelete={onDelete ? () => onDelete(item) : undefined}
                        onMove={(targetStatus) =>
                          onCardMove({
                            itemId: item.id,
                            fromColumnId: item.status,
                            toColumnId: targetStatus,
                            toIndex: 0,
                          })
                        }
                        onCardChange={(patch) => onCardChange(item, patch)}
                        onDragStart={() => setDraggingItem(item)}
                        onDragEnd={() => setDraggingItem(null)}
                      />
                    );
                  })
                )}
              </div>

              {/* Load More Button */}
              {lane?.hasMore && (
                <div className="shrink-0 border-t border-border bg-card p-2">
                  <Button
                    variant="ghost"
                    size="xs"
                    className="w-full"
                    disabled={isLoadingMore}
                    onClick={() => onLoadMoreStatus(status)}
                  >
                    {isLoadingMore
                      ? t.crmLeads.loadingMore
                      : t.crmLeads.loadMore(
                          allStatusItems.length,
                          totalInStatus,
                        )}
                  </Button>
                </div>
              )}
            </section>
          );
        })}
      </div>

      {/* Floating Bottom Quick-Drop Status Dock when dragging */}
      {draggingItem && (
        <div className="fixed inset-x-0 bottom-4 z-(--z-overlay) mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-foreground shadow-2xl">
          <div className="flex items-center gap-2 text-xs font-semibold text-warning">
            <Sparkles className="size-4" aria-hidden="true" />
            <span>{t.crmCustomerProfiles.ui.board.quick_drop_status}</span>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {CUSTOMER_PROFILE_BOARD_STATUSES.map((status) => {
              const isCurrent = status === draggingItem.status;
              const visual = getCustomerStatusVisual(status);
              const StatusIcon = visual.icon;
              const title = statusLabels[`CustomerStatus.${status}`] ?? status;
              return (
                <Button
                  key={status}
                  type="button"
                  variant="outline"
                  size="xs"
                  disabled={isCurrent}
                  onDragOver={(e) => {
                    if (isCurrent) return;
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "move";
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (isCurrent) return;
                    onCardMove({
                      itemId: draggingItem.id,
                      fromColumnId: draggingItem.status,
                      toColumnId: status,
                      toIndex: 0,
                    });
                    setDraggingItem(null);
                  }}
                  onClick={() => {
                    if (isCurrent) return;
                    onCardMove({
                      itemId: draggingItem.id,
                      fromColumnId: draggingItem.status,
                      toColumnId: status,
                      toIndex: 0,
                    });
                    setDraggingItem(null);
                  }}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-semibold transition-all",
                    isCurrent
                      ? "border-border bg-muted/50 text-muted-foreground"
                      : status === "ACTIVE_CUSTOMER"
                        ? "border-swatch-green bg-swatch-green-soft text-swatch-green-deep hover:bg-swatch-green-soft/80"
                        : status === BLACKLISTED_STATUS
                          ? "border-swatch-red bg-swatch-red-soft text-swatch-red-deep hover:bg-swatch-red-soft/80"
                          : "border-border bg-muted text-foreground hover:bg-muted/80",
                  )}
                >
                  <StatusIcon
                    className="size-3"
                    style={{ color: visual.accentHex }}
                  />
                  <span>{title}</span>
                </Button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================================================================
 * Executive Board Card (Collapsed Normal View — Matches LeadExecutiveBoardView)
 * - Row 1: Building2/UserRound Icon + Bold Title + Expand ChevronDown + Menu
 * - Row 2: Contact Person (Corporate only)
 * - Row 3: Tags on Left + Relative Age on Right (No Phone & No Source in Normal Mode)
 * - Row 4: Footer Strip (3 Stars + Activity Badge + Quick 360° Trigger + Owner Initials)
 * ========================================================================== */

interface ExecutiveBoardCustomerCardProps {
  item: CustomerProfileItem;
  isDragging: boolean;
  draggingFromLabel: string;
  draggingToLabel: string;
  canUpdate: boolean;
  canDelete: boolean;
  moveTargets: readonly MoveToTarget[];
  onOpen: () => void;
  onExpandView: () => void;
  onOpenQuickModal?: () => void;
  onOpenActivities?: () => void;
  onDelete?: () => void;
  onMove: (status: string) => void;
  onCardChange: (patch: CustomerProfileCardPatch) => void;
  onDragStart: () => void;
  onDragEnd: () => void;
}

function ExecutiveBoardCustomerCard({
  item,
  isDragging,
  draggingFromLabel,
  draggingToLabel,
  canUpdate,
  canDelete,
  moveTargets,
  onOpen,
  onExpandView,
  onOpenQuickModal,
  onOpenActivities,
  onDelete,
  onMove,
  onCardChange,
  onDragStart,
  onDragEnd,
}: ExecutiveBoardCustomerCardProps) {
  const { t } = useI18n();
  const cardDict = t.crmLeads.card;

  const { title, contactName } = customerCardHeading(item);
  const isCompany = item.profileType === "CORPORATE";

  const activityState = crmActivityState(item.nextActivity);
  const initials = item.owner ? customerOwnerInitials(item.owner) : "";
  const ownerFullName = item.owner
    ? [item.owner.firstName, item.owner.lastName].filter(Boolean).join(" ")
    : "";

  const borderAccent = item.cardColor
    ? CARD_BORDER_ACCENT[item.cardColor] ?? "border-border"
    : item.status === "ACTIVE_CUSTOMER"
      ? "border-swatch-green-soft border-s-4 border-s-swatch-green"
      : activityState === "OVERDUE"
        ? "border-swatch-amber-soft border-s-4 border-s-swatch-amber"
        : "border-border";

  const activityBadgeTone =
    activityState === "OVERDUE"
      ? "border-swatch-red bg-swatch-red-soft text-swatch-red-deep"
      : activityState === "TODAY"
        ? "border-swatch-amber bg-swatch-amber-soft text-swatch-amber-deep"
        : activityState === "FUTURE"
          ? "border-swatch-green bg-swatch-green-soft text-swatch-green-deep"
          : "border-border bg-muted text-muted-foreground";

  const activityLabelText =
    item.status === BLACKLISTED_STATUS
      ? t.crmCustomerProfiles.ui.board.closed
      : cardDict.activityStates[activityState];

  return (
    <div
      draggable={canUpdate}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", item.id);
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      className={cn(
        "group relative flex flex-col gap-2 rounded-lg border bg-card p-3 shadow-2xs transition-all hover:border-swatch-blue hover:shadow-md",
        borderAccent,
        canUpdate && "cursor-grab active:cursor-grabbing",
        isDragging &&
          "rotate-1 scale-[1.02] border-2 border-primary shadow-2xl ring-4 ring-primary/15",
      )}
    >
      {/* Floating Dragging Header Banner */}
      {isDragging && (
        <div className="-mx-3 -mt-3 mb-1 flex items-center justify-between rounded-t-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground">
          <span className="flex items-center gap-1 truncate">
            <GripVertical className="size-3.5 shrink-0" aria-hidden="true" />
            <span>
              {t.crmCustomerProfiles.ui.board.dragging_customer} ·{" "}
              {draggingFromLabel} → {draggingToLabel || draggingFromLabel}
            </span>
          </span>
          <span className="rounded-xs bg-primary-foreground/20 px-1.5 py-0.5 text-xs">
            Space / Drop
          </span>
        </div>
      )}

      {/* Row 1: Icon + Bold Title + Expand ChevronDown + Menu */}
      <div className="flex items-center justify-between gap-1.5">
        <Button
          type="button"
          variant="ghost"
          onClick={onOpen}
          className="flex h-auto min-w-0 flex-1 items-center justify-start gap-1.5 p-0 text-start hover:bg-transparent hover:text-primary"
        >
          {isCompany ? (
            <Building2
              className="size-3.5 shrink-0 text-swatch-blue"
              aria-hidden="true"
            />
          ) : (
            <UserRound
              className="size-3.5 shrink-0 text-muted-foreground"
              aria-hidden="true"
            />
          )}
          <span className="truncate text-sm font-semibold text-foreground group-hover:text-primary">
            {title}
          </span>
        </Button>

        <div
          className="flex shrink-0 items-center gap-1"
          onClick={(e) => e.stopPropagation()}
        >
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={onExpandView}
            title={t.crmCustomerProfiles.ui.board.expand_card_details}
            aria-label={t.crmCustomerProfiles.ui.board.expand_card_details}
            className="flex size-6 items-center justify-center rounded-md border border-border bg-muted text-muted-foreground transition-colors hover:border-swatch-blue hover:bg-swatch-blue-soft hover:text-swatch-blue-deep"
          >
            <ChevronDown className="size-3.5" aria-hidden="true" />
          </Button>

          <CustomerProfileCardMenu
            cardColor={item.cardColor}
            onOpen={onOpen}
            onDelete={canDelete ? onDelete : undefined}
            moveTargets={canUpdate ? moveTargets : undefined}
            onMove={canUpdate ? onMove : undefined}
            onColorChange={
              canUpdate
                ? (cardColor: CardColor | null) => onCardChange({ cardColor })
                : undefined
            }
            labels={{
              trigger: formatTemplate(cardDict.more, {
                name: item.displayName,
              }),
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
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="flex min-w-0 items-center gap-1 truncate">
            <UserRound
              className="size-3 shrink-0 text-muted-foreground"
              aria-hidden="true"
            />
            <span className="truncate font-medium text-foreground">
              {contactName ||
                item.primaryContact?.displayName ||
                item.primaryContactName ||
                title}
            </span>
            {item.primaryContact?.jobTitle && (
              <span className="truncate text-muted-foreground">
                · {item.primaryContact.jobTitle}
              </span>
            )}
          </span>
        </div>
      )}

      {/* Row 3: Tags on Left + Relative Stage Age on Right (No Phone & No Source in Normal Mode) */}
      <div className="flex flex-wrap items-center justify-between gap-1.5">
        <div className="flex min-w-0 flex-wrap items-center gap-1">
          {item.tags.slice(0, 2).map((tag) => (
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
                "inline-flex max-w-28 items-center truncate rounded-md px-2 py-0.5 text-xs font-semibold",
                !tag.backgroundColor &&
                  "border border-swatch-green bg-swatch-green-soft text-swatch-green-deep",
              )}
            >
              {tag.name}
            </span>
          ))}
          {item.tags.length > 2 && (
            <span className="rounded-md bg-muted px-1.5 py-0.5 text-xs font-semibold text-muted-foreground">
              +{item.tags.length - 2}
            </span>
          )}
        </div>

        <span className="ms-auto shrink-0 text-xs font-medium tabular-nums text-muted-foreground">
          {formatRelativeAge(undefined, t)}
        </span>
      </div>

      {/* Row 4: Footer Strip (3 Stars + Activity Badge + Quick 360° Trigger + Owner Initials) */}
      <div
        className="flex items-center justify-between gap-2 border-t border-border/60 pt-2"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex min-w-0 items-center gap-2">
          {/* Interactive 3-Star Rating */}
          <div
            className="flex items-center gap-0.5"
            role="group"
            aria-label={cardDict.rating}
          >
            {[1, 2, 3].map((star) => {
              const filled = star <= item.rating;
              return (
                <Button
                  key={star}
                  type="button"
                  variant="ghost"
                  size="xs"
                  disabled={!canUpdate}
                  onClick={() =>
                    onCardChange({ rating: item.rating === star ? 0 : star })
                  }
                  aria-label={`Rate ${star} of 3`}
                  className="size-5 p-0.5 transition-transform hover:scale-110 hover:bg-transparent disabled:cursor-default"
                >
                  <Star
                    className={cn(
                      "size-3.5",
                      filled
                        ? "fill-warning text-warning"
                        : "text-muted-foreground/40",
                    )}
                    aria-hidden="true"
                  />
                </Button>
              );
            })}
          </div>

          {/* Colored Activity Pill Trigger */}
          {onOpenActivities && item.status !== "BLACKLISTED" && (
            <Button
              type="button"
              variant="ghost"
              size="xs"
              onClick={onOpenActivities}
              className={cn(
                "inline-flex h-auto items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-semibold transition-opacity hover:opacity-85",
                activityBadgeTone,
              )}
            >
              <Activity className="size-3 shrink-0" aria-hidden="true" />
              <span className="max-w-28 truncate">{activityLabelText}</span>
            </Button>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {onOpenQuickModal && (
            <Button
              type="button"
              variant="ghost"
              size="xs"
              onClick={onOpenQuickModal}
              title={
                t.crmCustomerProfiles.ui.board.open_360_quick_edit_modal
              }
              aria-label={
                t.crmCustomerProfiles.ui.board.open_360_quick_edit_modal
              }
              className="flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-primary"
            >
              <Eye className="size-3.5" aria-hidden="true" />
            </Button>
          )}

          {initials && (
            <span
              title={formatTemplate(cardDict.owner, { name: ownerFullName })}
              className="flex size-6 items-center justify-center rounded-md border border-swatch-blue bg-swatch-blue-soft text-xs font-semibold text-swatch-blue-deep"
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
}: {
  phone: string;
  country: string;
}) {
  const { t } = useI18n();
  const callDigits = phone ? normalizePhoneDigits(phone) : "";
  const waDigits = phone ? normalizeWhatsAppDigits(phone, country) : null;
  const tgDigits = waDigits;

  return (
    <div className="flex items-center justify-between gap-2 rounded-lg border border-border bg-muted/50 px-2.5 py-1.5">
      {phone ? (
        <span
          dir="ltr"
          className="truncate font-mono text-xs font-semibold tabular-nums tracking-tight text-foreground"
        >
          {phone}
        </span>
      ) : (
        <span className="text-xs text-muted-foreground">
          {t.crmCustomerProfiles.ui.board.no_phone_number}
        </span>
      )}

      <div className="flex shrink-0 items-center gap-1">
        {callDigits ? (
          <a
            href={`tel:${callDigits}`}
            title={`Call ${phone}`}
            aria-label={`Call ${phone}`}
            className="flex size-6 items-center justify-center rounded-md border border-swatch-green bg-swatch-green-soft text-swatch-green-deep transition-colors hover:bg-swatch-green-soft/80"
          >
            <Phone className="size-3" aria-hidden="true" />
          </a>
        ) : (
          <span className="flex size-6 items-center justify-center rounded-md border border-border bg-card text-muted-foreground/40">
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
            className="flex size-6 items-center justify-center rounded-md border border-swatch-green bg-swatch-green-soft text-swatch-green-deep transition-colors hover:bg-swatch-green-soft/80"
          >
            <MessageCircle className="size-3" aria-hidden="true" />
          </a>
        ) : (
          <span className="flex size-6 items-center justify-center rounded-md border border-border bg-card text-muted-foreground/40">
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
            className="flex size-6 items-center justify-center rounded-md border border-swatch-blue bg-swatch-blue-soft text-swatch-blue-deep transition-colors hover:bg-swatch-blue-soft/80"
          >
            <Send className="size-3" aria-hidden="true" />
          </a>
        ) : (
          <span className="flex size-6 items-center justify-center rounded-md border border-border bg-card text-muted-foreground/40">
            <Send className="size-3" aria-hidden="true" />
          </span>
        )}
      </div>
    </div>
  );
}

/* ============================================================================
 * Expanded Card View Mode (Matches LeadExecutiveBoardView BoardCardExpandedView)
 * - Individual: up to 2 phone numbers + action icons
 * - Corporate with 1 primary contact: primary contact's 1 or at most 2 phones + icons
 * - Corporate with >1 contacts: up to 3 contacts, each with their first phone + icons
 * - Displays Salesperson (Owner), Acquisition Source (icon + name), Tags, and Footer
 * ========================================================================== */

interface CustomerBoardCardExpandedViewProps {
  item: CustomerProfileItem;
  sources: ReadonlyArray<AcquisitionSource>;
  canUpdate: boolean;
  canDelete: boolean;
  moveTargets: readonly MoveToTarget[];
  onCollapse: () => void;
  onOpen: () => void;
  onOpenQuickModal?: () => void;
  onOpenActivities?: () => void;
  onDelete?: () => void;
  onMove: (status: string) => void;
  onCardChange: (patch: CustomerProfileCardPatch) => void;
}

function CustomerBoardCardExpandedView({
  item,
  sources,
  canUpdate,
  canDelete,
  moveTargets,
  onCollapse,
  onOpen,
  onOpenQuickModal,
  onOpenActivities,
  onDelete,
  onMove,
  onCardChange,
}: CustomerBoardCardExpandedViewProps) {
  const { t, lang } = useI18n();
  const cardDict = t.crmLeads.card;
  const isCompany = item.profileType === "CORPORATE";
  const { title, contactName } = customerCardHeading(item);

  const [detail, setDetail] = useState<CustomerProfileDetail | null>(null);

  useEffect(() => {
    if (!isUUIDv7(item.id)) return;
    const controller = new AbortController();
    axiosClient
      .get(customerProfilePath(item.id), {
        signal: controller.signal,
        cache: "no-store",
        maxResponseBytes: 512 * 1024,
      })
      .then((res) => {
        if (controller.signal.aborted) return;
        setDetail(parseCustomerProfileDetailResponse(res.data));
      })
      .catch(() => {
        // Fallback to CustomerProfileItem summary data if detail endpoint fails
      });
    return () => controller.abort();
  }, [item.id]);

  const matchedSource = useMemo(
    () =>
      sources.find(
        (s) =>
          (detail?.acquisitionSourceId &&
            s.id === detail.acquisitionSourceId) ||
          (item.acquisitionSourceNameEn &&
            s.nameEn === item.acquisitionSourceNameEn) ||
          (item.acquisitionSourceNameAr &&
            s.nameAr === item.acquisitionSourceNameAr),
      ) ?? null,
    [
      detail,
      item.acquisitionSourceNameAr,
      item.acquisitionSourceNameEn,
      sources,
    ],
  );
  const sourceLabel =
    localizedValue(
      item.acquisitionSourceNameAr ?? detail?.acquisitionSourceNameAr,
      item.acquisitionSourceNameEn ?? detail?.acquisitionSourceNameEn,
      lang,
    ) || (matchedSource ? localizedName(matchedSource, lang) : "");
  const resolvedSourceIconUrl =
    item.sourceIconUrl ?? matchedSource?.iconUrl ?? null;

  // Resolve Individual phones (max 2)
  const individualPhones = useMemo(() => {
    const raw = [
      ...(detail?.phones ?? []),
      ...item.phones,
      detail?.primaryMobile,
      item.phone,
    ]
      .map((p) => (p ?? "").trim())
      .filter((p) => p.length > 0);
    return Array.from(new Set(raw)).slice(0, 2);
  }, [detail?.phones, detail?.primaryMobile, item.phone, item.phones]);

  // Resolve Corporate contacts from detail (or fallback to item.primaryContact)
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
    if (item.primaryContact) {
      return [item.primaryContact];
    }
    const fallbackName = contactName || item.primaryContactName || "";
    const fallbackPhone = item.phone || item.phones[0] || "";
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
    item.phone,
    item.phones,
    item.primaryContact,
    item.primaryContactName,
    title,
  ]);

  // Resolve Company's own phone numbers (up to 2)
  const companyPhones = useMemo(() => {
    if (!isCompany) return [];
    const raw = [
      detail?.companyPhone,
      ...(detail?.phones ?? []),
      item.phone,
      ...item.phones,
    ]
      .map((p) => (p ?? "").trim())
      .filter((p) => p.length > 0);
    return Array.from(new Set(raw)).slice(0, 2);
  }, [detail?.companyPhone, detail?.phones, isCompany, item.phone, item.phones]);

  const hasMultipleCorporateContacts =
    isCompany && corporateContacts.length > 1;
  const singleCorporateContact = isCompany
    ? (corporateContacts[0] ?? null)
    : null;
  const singleCorporateContactPhones = useMemo(() => {
    if (!isCompany) return [];
    const raw = [
      ...(singleCorporateContact?.phones ?? []),
      ...(item.primaryContact?.phones ?? []),
      detail?.primaryMobile,
    ]
      .map((p) => (p ?? "").trim())
      .filter((p) => p.length > 0);
    return Array.from(new Set(raw)).slice(0, 2);
  }, [
    detail?.primaryMobile,
    isCompany,
    item.primaryContact?.phones,
    singleCorporateContact?.phones,
  ]);

  const activityState = crmActivityState(item.nextActivity);
  const initials = item.owner ? customerOwnerInitials(item.owner) : "";
  const ownerFullName = item.owner
    ? [item.owner.firstName, item.owner.lastName].filter(Boolean).join(" ")
    : "";

  const activityBadgeTone =
    activityState === "OVERDUE"
      ? "border-swatch-red bg-swatch-red-soft text-swatch-red-deep"
      : activityState === "TODAY"
        ? "border-swatch-amber bg-swatch-amber-soft text-swatch-amber-deep"
        : activityState === "FUTURE"
          ? "border-swatch-green bg-swatch-green-soft text-swatch-green-deep"
          : "border-border bg-muted text-muted-foreground";

  const activityLabelText =
    item.status === BLACKLISTED_STATUS
      ? t.crmCustomerProfiles.ui.board.closed
      : cardDict.activityStates[activityState];

  return (
    <div
      className="flex flex-col gap-2.5 rounded-lg border-2 border-primary bg-card p-3 shadow-lg"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header Row: Icon + Title + Collapse ChevronUp + Menu */}
      <div className="flex items-center justify-between gap-1.5">
        <Button
          type="button"
          variant="ghost"
          onClick={onOpen}
          className="flex h-auto min-w-0 flex-1 items-center justify-start gap-1.5 p-0 text-start hover:bg-transparent hover:text-primary"
        >
          {isCompany ? (
            <Building2
              className="size-3.5 shrink-0 text-swatch-blue"
              aria-hidden="true"
            />
          ) : (
            <UserRound
              className="size-3.5 shrink-0 text-muted-foreground"
              aria-hidden="true"
            />
          )}
          <span className="truncate text-sm font-semibold text-foreground hover:text-primary">
            {title}
          </span>
        </Button>

        <div className="flex shrink-0 items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={onCollapse}
            title={t.crmCustomerProfiles.ui.board.collapse_card}
            aria-label={t.crmCustomerProfiles.ui.board.collapse_card}
            className="flex size-6 items-center justify-center rounded-md border border-swatch-blue bg-swatch-blue-soft text-swatch-blue-deep transition-colors hover:bg-swatch-blue-soft/80"
          >
            <ChevronUp className="size-3.5" aria-hidden="true" />
          </Button>

          <CustomerProfileCardMenu
            cardColor={item.cardColor}
            onOpen={onOpen}
            onDelete={canDelete ? onDelete : undefined}
            moveTargets={canUpdate ? moveTargets : undefined}
            onMove={canUpdate ? onMove : undefined}
            onColorChange={
              canUpdate
                ? (cardColor: CardColor | null) => onCardChange({ cardColor })
                : undefined
            }
            labels={{
              trigger: formatTemplate(cardDict.more, {
                name: item.displayName,
              }),
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
      <div className="flex items-center justify-end gap-2 text-xs text-muted-foreground">
        <span className="shrink-0 text-xs font-medium tabular-nums text-muted-foreground">
          {formatRelativeAge(detail?.createdAt, t)}
        </span>
      </div>

      {/* Contacts & Phones Section according to Profile & Contact Count Rules */}
      {!isCompany ? (
        /* INDIVIDUAL: Show mobile numbers up to 2 at most + action icons */
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">
            {t.crmCustomerProfiles.ui.board.phone_numbers_up_to_2}
          </span>
          {individualPhones.length > 0 ? (
            individualPhones.map((ph, idx) => (
              <PhoneActionRow
                key={`ind-ph-${idx}-${ph}`}
                phone={ph}
                country={item.country}
              />
            ))
          ) : (
            <PhoneActionRow phone="" country={item.country} />
          )}
        </div>
      ) : (
        <>
          {/* COMPANY PHONE SECTION */}
          <div className="flex flex-col gap-1.5">
            <span className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
              <Building2
                className="size-3 shrink-0 text-swatch-blue"
                aria-hidden="true"
              />
              <span>{t.crmCustomerProfiles.ui.board.company_phone}</span>
            </span>
            {companyPhones.length > 0 ? (
              companyPhones.map((ph, idx) => (
                <PhoneActionRow
                  key={`corp-company-ph-${idx}-${ph}`}
                  phone={ph}
                  country={item.country}
                />
              ))
            ) : (
              <PhoneActionRow phone="" country={item.country} />
            )}
          </div>

          {hasMultipleCorporateContacts ? (
            /* COMPANY WITH > 1 CONTACT: Show up to 3 contacts at most, each with their first phone only + icons */
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">
                {formatTemplate(
                  t.crmCustomerProfiles.ui.board.contact_count,
                  {
                    Math_min_corporateContacts_length_3: Math.min(
                      corporateContacts.length,
                      3,
                    ),
                    corporateContacts_length: corporateContacts.length,
                  },
                )}
              </span>
              {corporateContacts.slice(0, 3).map((contact, idx) => {
                const firstPhone = contact.phones[0] ?? "";
                return (
                  <div
                    key={contact.partyId || `corp-contact-${idx}`}
                    className="flex flex-col gap-1 rounded-lg border border-border bg-muted/40 p-2"
                  >
                    <div className="flex items-center justify-between gap-1.5 text-xs">
                      <span className="flex min-w-0 items-center gap-1 truncate font-semibold text-foreground">
                        <UserRound
                          className="size-3 shrink-0 text-swatch-blue"
                          aria-hidden="true"
                        />
                        <span className="truncate">{contact.displayName}</span>
                        {contact.jobTitle && (
                          <span className="truncate text-xs font-normal text-muted-foreground">
                            · {contact.jobTitle}
                          </span>
                        )}
                      </span>
                      {contact.isPrimary && (
                        <span className="shrink-0 rounded-xs bg-swatch-blue-soft px-1.5 py-0.5 text-xs font-semibold text-swatch-blue-deep">
                          {t.crmCustomerProfiles.ui.board.primary}
                        </span>
                      )}
                    </div>
                    <PhoneActionRow
                      phone={firstPhone}
                      country={item.country}
                    />
                  </div>
                );
              })}
            </div>
          ) : (
            /* COMPANY WITH 1 PRIMARY CONTACT: Show primary contact + 1 or at most 2 phones + icons */
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between gap-1.5 text-xs">
                <span className="flex min-w-0 items-center gap-1 truncate font-semibold text-foreground">
                  <UserRound
                    className="size-3 shrink-0 text-swatch-blue"
                    aria-hidden="true"
                  />
                  <span className="truncate">
                    {singleCorporateContact?.displayName ||
                      contactName ||
                      item.primaryContact?.displayName ||
                      item.primaryContactName ||
                      title}
                  </span>
                  {(singleCorporateContact?.jobTitle ||
                    item.primaryContact?.jobTitle) && (
                    <span className="truncate text-xs font-normal text-muted-foreground">
                      ·{" "}
                      {singleCorporateContact?.jobTitle ||
                        item.primaryContact?.jobTitle}
                    </span>
                  )}
                </span>
                <span className="shrink-0 rounded-xs bg-swatch-blue-soft px-1.5 py-0.5 text-xs font-semibold text-swatch-blue-deep">
                  {t.crmCustomerProfiles.ui.board.primary}
                </span>
              </div>
              {singleCorporateContactPhones.length > 0 ? (
                singleCorporateContactPhones.map((ph, idx) => (
                  <PhoneActionRow
                    key={`corp-single-ph-${idx}-${ph}`}
                    phone={ph}
                    country={item.country}
                  />
                ))
              ) : (
                <PhoneActionRow phone="" country={item.country} />
              )}
            </div>
          )}
        </>
      )}

      {/* Owner & Acquisition Source (Read-Only View Mode) */}
      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">
            {t.crmCustomerProfiles.ui.board.salesperson}
          </span>
          <div className="flex h-7 items-center rounded-md border border-border bg-muted/50 px-2 text-xs font-medium text-foreground">
            <span className="truncate">
              {ownerFullName || (t.crmCustomerProfiles.ui.board.unassigned)}
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">
            {t.crmCustomerProfiles.ui.board.acquisition_source}
          </span>
          <div className="flex h-7 items-center gap-1.5 rounded-md border border-border bg-muted/50 px-2 text-xs font-medium text-foreground">
            {sourceLabel ? (
              <>
                <AcquisitionSourceIcon
                  source={{ iconUrl: resolvedSourceIconUrl }}
                />
                <span className="truncate">{sourceLabel}</span>
              </>
            ) : (
              <span className="truncate text-muted-foreground">
                {t.crmCustomerProfiles.ui.board.not_set}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Tags (All tags shown in Expanded View Mode) */}
      {item.tags.length > 0 && (
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">
            {t.crmCustomerProfiles.ui.board.tags}
          </span>
          <div className="flex flex-wrap items-center gap-1">
            {item.tags.map((tag) => (
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
                  "inline-flex items-center truncate rounded-md px-2 py-0.5 text-xs font-semibold",
                  !tag.backgroundColor &&
                    "border border-swatch-green bg-swatch-green-soft text-swatch-green-deep",
                )}
              >
                {tag.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Footer Strip (3 Stars + Activity Badge + Quick 360° Trigger + Owner Initials) */}
      <div className="flex items-center justify-between gap-2 border-t border-border/60 pt-2">
        <div className="flex min-w-0 items-center gap-2">
          <div
            className="flex items-center gap-0.5"
            role="group"
            aria-label={cardDict.rating}
          >
            {[1, 2, 3].map((star) => {
              const filled = star <= item.rating;
              return (
                <Button
                  key={star}
                  type="button"
                  variant="ghost"
                  size="xs"
                  disabled={!canUpdate}
                  onClick={() =>
                    onCardChange({ rating: item.rating === star ? 0 : star })
                  }
                  aria-label={`Rate ${star} of 3`}
                  className="size-5 p-0.5 transition-transform hover:scale-110 hover:bg-transparent disabled:cursor-default"
                >
                  <Star
                    className={cn(
                      "size-3.5",
                      filled
                        ? "fill-warning text-warning"
                        : "text-muted-foreground/40",
                    )}
                    aria-hidden="true"
                  />
                </Button>
              );
            })}
          </div>

          {onOpenActivities && item.status !== "BLACKLISTED" && (
            <Button
              type="button"
              variant="ghost"
              size="xs"
              onClick={onOpenActivities}
              className={cn(
                "inline-flex h-auto items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-semibold transition-opacity hover:opacity-85",
                activityBadgeTone,
              )}
            >
              <Activity className="size-3 shrink-0" aria-hidden="true" />
              <span className="max-w-28 truncate">{activityLabelText}</span>
            </Button>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {onOpenQuickModal && (
            <Button
              type="button"
              variant="ghost"
              size="xs"
              onClick={onOpenQuickModal}
              title={
                t.crmCustomerProfiles.ui.board.open_360_quick_edit_modal
              }
              aria-label={
                t.crmCustomerProfiles.ui.board.open_360_quick_edit_modal
              }
              className="flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-primary"
            >
              <Eye className="size-3.5" aria-hidden="true" />
            </Button>
          )}

          {initials && (
            <span
              title={formatTemplate(cardDict.owner, { name: ownerFullName })}
              className="flex size-6 items-center justify-center rounded-md border border-swatch-blue bg-swatch-blue-soft text-xs font-semibold text-swatch-blue-deep"
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
 * In-Column Quick-Add Customer Composer Card (Matches Leads BoardColumnQuickAddCard)
 * ========================================================================== */

interface BoardColumnQuickAddCustomerCardProps {
  status: CustomerProfileStatus;
  statusTitle: string;
  branchId: string;
  sources: ReadonlyArray<AcquisitionSource>;
  onCancel: () => void;
  onOpenFullModal: (draft: QuickCreateCustomerDraft) => void;
  onCreated: () => void;
}

function BoardColumnQuickAddCustomerCard({
  status,
  statusTitle,
  branchId,
  sources,
  onCancel,
  onOpenFullModal,
  onCreated,
}: BoardColumnQuickAddCustomerCardProps) {
  const { t, lang } = useI18n();
  const toast = useToast();
  const fieldMessages = useCrmFieldMessages();

  // Individual is first and default (matching Leads Quick-Add)
  const [profileType, setProfileType] = useState<"INDIVIDUAL" | "CORPORATE">(
    "INDIVIDUAL",
  );

  // Individual state (First + Last Name + Phone Number list)
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [individualPhones, setIndividualPhones] = useState<string[]>([""]);

  // Company state (New Company vs Existing Company; Primary Contact First + Last + Phone list)
  const [companyMode, setCompanyMode] = useState<"new" | "existing">("new");
  const [existingCompanyPartyId, setExistingCompanyPartyId] = useState("");
  const [selectedCompanyName, setSelectedCompanyName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [contactFirstName, setContactFirstName] = useState("");
  const [contactLastName, setContactLastName] = useState("");
  const [companyPhones, setCompanyPhones] = useState<string[]>([""]);
  const [contactPhones, setContactPhones] = useState<string[]>([""]);

  // Shared fields: optional source + rating
  const [sourceId, setSourceId] = useState("");
  const [rating, setRating] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Company lookup (reuses the same hook as Leads)
  const companyLookup = useLeadCompanyOptions(
    branchId,
    profileType === "CORPORATE",
  );

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
    () =>
      companyLookup.companies.find((c) => c.id === existingCompanyPartyId) ??
      null,
    [companyLookup.companies, existingCompanyPartyId],
  );

  function clearError(prefix: string) {
    setErrors((prev) => {
      if (
        !Object.keys(prev).some(
          (k) => k === prefix || k.startsWith(`${prefix}.`),
        )
      ) {
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
    onOpenFullModal({
      profileType,
      status,
      acquisitionSourceId: sourceId,
      firstName,
      lastName,
      phones: individualPhones.length > 0 ? [...individualPhones] : [""],
      companyName:
        companyMode === "existing"
          ? selectedCompany?.displayName || selectedCompanyName || ""
          : companyName,
      companyPhones:
        companyMode === "new" && companyPhones.length > 0
          ? [...companyPhones]
          : [""],
      contactFirstName,
      contactLastName,
      contactPhones: contactPhones.length > 0 ? [...contactPhones] : [""],
    });
  }

  async function handleQuickSave() {
    if (isSubmitting) return;

    const bag = new CrmErrorBag(fieldMessages);
    if (sources.length > 0) {
      bag.required("acquisitionSourceId", sourceId);
    }

    if (profileType === "CORPORATE") {
      if (companyMode === "existing") {
        bag.required("existingCompanyPartyId", existingCompanyPartyId);
      } else {
        if (bag.required("companyName", companyName)) {
          bag.maxLength(
            "companyName",
            companyName,
            CUSTOMER_PROFILE_CREATE_LIMITS.companyName,
          );
        }
        bag.phones("companyPhones", companyPhones);
      }

      if (bag.required("contactFirstName", contactFirstName)) {
        bag.maxLength(
          "contactFirstName",
          contactFirstName,
          CUSTOMER_PROFILE_CREATE_LIMITS.firstName,
        );
      }
      bag.maxLength(
        "contactLastName",
        contactLastName,
        CUSTOMER_PROFILE_CREATE_LIMITS.lastName,
      );
      bag.phones("contactPhones", contactPhones);
    } else {
      if (bag.required("firstName", firstName)) {
        bag.maxLength(
          "firstName",
          firstName,
          CUSTOMER_PROFILE_CREATE_LIMITS.firstName,
        );
      }
      if (bag.required("lastName", lastName)) {
        bag.maxLength(
          "lastName",
          lastName,
          CUSTOMER_PROFILE_CREATE_LIMITS.lastName,
        );
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
      const draft = emptyCreateCustomerProfileForm("quick-contact-1");
      draft.profileType = profileType;
      draft.status = status;
      draft.acquisitionSourceId = sourceId;

      if (profileType === "CORPORATE") {
        const resolvedCompanyName =
          companyMode === "existing"
            ? (selectedCompany?.displayName || selectedCompanyName).trim()
            : companyName.trim();
        draft.companyName = resolvedCompanyName;
        draft.companyPhones =
          companyMode === "new" && companyPhones.length > 0
            ? [...companyPhones]
            : [""];
        const composedContactName = [
          contactFirstName.trim(),
          contactLastName.trim(),
        ]
          .filter(Boolean)
          .join(" ");
        draft.contacts = [
          {
            key: "quick-contact-1",
            honorificTitle: "",
            firstName: contactFirstName.trim(),
            lastName: contactLastName.trim(),
            fullName: composedContactName,
            jobTitle: "",
            email: "",
            phones: contactPhones.length > 0 ? [...contactPhones] : [""],
            isPrimary: true,
          },
        ];
      } else {
        draft.firstName = firstName.trim();
        draft.lastName = lastName.trim();
        draft.phones =
          individualPhones.length > 0 ? [...individualPhones] : [""];
      }

      const body = buildCreateCustomerProfileFullRequest(draft, branchId);
      const outcome = await runIdempotentWrite({
        attempt: createWriteAttempt(),
        method: "post",
        path: CUSTOMER_PROFILES_PATH,
        body,
        parse: parseCustomerProfileDetailResponse,
        config: { maxResponseBytes: 512 * 1024 },
      });

      if (outcome.kind === "success") {
        let ratingFollowUpFailed = false;
        if (rating > 0) {
          try {
            await axiosClient.patch(
              customerProfilePath(outcome.value.id),
              { rating },
              {
                nonReplayable: true,
                skipAutoIdempotency: true,
                cache: "no-store",
              },
            );
          } catch (error) {
            ratingFollowUpFailed = normalizeApiError(error).status !== 403;
          }
        }
        toast.success(
          t.crmCustomerProfiles.ui.board.customer_created,
          outcome.value.displayName,
        );
        if (ratingFollowUpFailed) {
          toast.warning(
            t.crmCustomerProfiles.followUpWarningTitle,
            t.crmCustomerProfiles.followUpWarningMessage,
          );
        }
        onCreated();
      } else {
        toast.errorFromApi(
          t.crmCustomerProfiles.ui.board.unable_to_create_customer,
          outcome.error,
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  const sourceFieldNode = (
    <Field
      label={t.crmLeads.source}
      required={sources.length > 0}
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
          <SelectValue
            placeholder={t.crmLeads.create.selectSourcePlaceholder}
          />
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
    <div className="flex flex-col gap-2.5 rounded-lg border-2 border-swatch-green bg-swatch-green-soft/20 p-3 shadow-md">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1 text-xs font-semibold text-swatch-green-deep">
          <Sparkles className="size-3.5 text-swatch-green" aria-hidden="true" />
          <span>
            {formatTemplate(t.crmCustomerProfiles.ui.board.quick_add_in_status_2, { statusTitle: statusTitle })}
          </span>
        </span>
        <Button
          type="button"
          variant="ghost"
          size="xs"
          onClick={handleOpenFullModal}
          className="inline-flex h-auto items-center gap-0.5 p-0 text-xs font-semibold text-swatch-green-deep hover:bg-transparent hover:underline"
        >
          <span>{t.crmCustomerProfiles.ui.board.full_modal}</span>
          <ExternalLink className="size-2.5" aria-hidden="true" />
        </Button>
      </div>

      {/* Individual vs Company segmented toggle (Individual first & default) */}
      <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
        <Button
          type="button"
          variant="ghost"
          size="xs"
          onClick={() => {
            setProfileType("INDIVIDUAL");
            setErrors({});
          }}
          className={cn(
            "flex items-center justify-center gap-1 rounded-md py-1 text-xs font-semibold transition-all",
            profileType === "INDIVIDUAL"
              ? "bg-card text-primary shadow-2xs hover:bg-card"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <UserRound className="size-3.5" aria-hidden="true" />
          <span>{t.crmCustomerProfiles.ui.board.individual}</span>
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="xs"
          onClick={() => {
            setProfileType("CORPORATE");
            setErrors({});
          }}
          className={cn(
            "flex items-center justify-center gap-1 rounded-md py-1 text-xs font-semibold transition-all",
            profileType === "CORPORATE"
              ? "bg-card text-primary shadow-2xs hover:bg-card"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <Building2 className="size-3.5" aria-hidden="true" />
          <span>{t.crmCustomerProfiles.ui.board.company}</span>
        </Button>
      </div>

      {/* ====================================================================
       * INDIVIDUAL MODE:
       * 1) First Name + Last Name
       * 2) Source
       * 3) Phone Number (with + Add phone)
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
                maxLength={CUSTOMER_PROFILE_CREATE_LIMITS.firstName}
                onChange={(e) => {
                  setFirstName(e.target.value);
                  clearError("firstName");
                }}
                placeholder={t.crmCustomerProfiles.ui.board.first_name}
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
                maxLength={CUSTOMER_PROFILE_CREATE_LIMITS.lastName}
                onChange={(e) => {
                  setLastName(e.target.value);
                  clearError("lastName");
                }}
                placeholder={t.crmCustomerProfiles.ui.board.last_name}
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
              setIndividualPhones((prev) =>
                prev.map((p, i) => (i === index ? value : p)),
              );
              clearError("phones");
            }}
            onAdd={() =>
              setIndividualPhones((prev) =>
                prev.length < CUSTOMER_PROFILE_CREATE_LIMITS.phones
                  ? [...prev, ""]
                  : prev,
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
          <div className="grid grid-cols-2 gap-1 rounded-lg border border-border bg-card p-0.5">
            <Button
              type="button"
              variant="ghost"
              size="xs"
              onClick={() => {
                setCompanyMode("new");
                setExistingCompanyPartyId("");
                setSelectedCompanyName("");
                setCompanyQuery("");
                void companyLookup.selectCompany(null);
                setErrors({});
              }}
              className={cn(
                "rounded-md py-1 text-xs font-semibold transition-all",
                companyMode === "new"
                  ? "bg-swatch-green text-primary-foreground shadow-2xs hover:bg-swatch-green/90 hover:text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t.crmCustomerProfiles.ui.board.new_company}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="xs"
              onClick={() => {
                setCompanyMode("existing");
                setErrors({});
              }}
              className={cn(
                "rounded-md py-1 text-xs font-semibold transition-all",
                companyMode === "existing"
                  ? "bg-swatch-green text-primary-foreground shadow-2xs hover:bg-swatch-green/90 hover:text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t.crmCustomerProfiles.ui.board.existing_company}
            </Button>
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
                maxLength={CUSTOMER_PROFILE_CREATE_LIMITS.companyName}
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
              label={t.crmCustomerProfiles.ui.board.existing_company}
              required
              error={errors.existingCompanyPartyId}
            >
              <Combobox
                size="sm"
                options={companyComboboxOptions}
                value={existingCompanyPartyId}
                selectedLabel={
                  selectedCompany?.displayName ||
                  selectedCompanyName ||
                  undefined
                }
                onValueChange={(id) => {
                  const nextId = id ?? "";
                  const matched = companyLookup.companies.find(
                    (c) => c.id === nextId,
                  );
                  setExistingCompanyPartyId(nextId);
                  setSelectedCompanyName(matched?.displayName ?? "");
                  setCompanyQuery("");
                  void companyLookup.selectCompany(nextId || null);
                  clearError("existingCompanyPartyId");
                }}
                onSearch={setCompanyQuery}
                debounceMs={0}
                loading={companyLookup.isLoadingCompanies}
                loadingLabel={t.common.loading}
                placeholder={
                  t.crmCustomerProfiles.ui.board.select_existing_company
                }
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
                setCompanyPhones((prev) =>
                  prev.map((p, i) => (i === index ? value : p)),
                );
                clearError("companyPhones");
              }}
              onAdd={() =>
                setCompanyPhones((prev) =>
                  prev.length < CUSTOMER_PROFILE_CREATE_LIMITS.phones
                    ? [...prev, ""]
                    : prev,
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
                maxLength={CUSTOMER_PROFILE_CREATE_LIMITS.firstName}
                onChange={(e) => {
                  setContactFirstName(e.target.value);
                  clearError("contactFirstName");
                }}
                placeholder={t.crmCustomerProfiles.ui.board.first_name}
              />
            </Field>
            <Field
              label={t.crmLeads.create.lastName}
              error={errors.contactLastName}
            >
              <Input
                size="sm"
                value={contactLastName}
                maxLength={CUSTOMER_PROFILE_CREATE_LIMITS.lastName}
                onChange={(e) => {
                  setContactLastName(e.target.value);
                  clearError("contactLastName");
                }}
                placeholder={t.crmCustomerProfiles.ui.board.last_name}
              />
            </Field>
          </div>

          {/* 5) Contact Phone */}
          <CrmPhoneListField
            label={t.crmCustomerProfiles.ui.board.contact_phone}
            phones={contactPhones}
            path="contactPhones"
            errors={errors}
            disabled={isSubmitting}
            onChange={(index, value) => {
              setContactPhones((prev) =>
                prev.map((p, i) => (i === index ? value : p)),
              );
              clearError("contactPhones");
            }}
            onAdd={() =>
              setContactPhones((prev) =>
                prev.length < CUSTOMER_PROFILE_CREATE_LIMITS.phones
                  ? [...prev, ""]
                  : prev,
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
        <div
          className="flex items-center gap-0.5"
          role="group"
          aria-label={t.crmLeads.card.rating}
        >
          {[1, 2, 3].map((st) => (
            <Button
              key={st}
              type="button"
              variant="ghost"
              size="xs"
              onClick={() => setRating((prev) => (prev === st ? 0 : st))}
              aria-label={`Rate ${st} of 3`}
              className="size-5 p-0.5 transition-transform hover:scale-110 hover:bg-transparent"
            >
              <Star
                className={cn(
                  "size-3.5",
                  st <= rating
                    ? "fill-warning text-warning"
                    : "text-muted-foreground/40",
                )}
              />
            </Button>
          ))}
        </div>

        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            variant="outline"
            size="xs"
            onClick={onCancel}
            disabled={isSubmitting}
            className="rounded-lg border border-border bg-card px-2.5 py-1 text-xs font-semibold text-foreground hover:bg-muted"
          >
            {t.crmCustomerProfiles.ui.board.cancel}
          </Button>
          <Button
            type="button"
            size="xs"
            disabled={isSubmitting}
            onClick={() => void handleQuickSave()}
            className="inline-flex items-center gap-1 rounded-lg bg-swatch-green px-3 py-1 text-xs font-semibold text-primary-foreground shadow-xs hover:bg-swatch-green/90 disabled:opacity-50"
          >
            {isSubmitting ? (
              <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <Check className="size-3.5" aria-hidden="true" />
            )}
            <span>{t.crmCustomerProfiles.ui.board.save}</span>
          </Button>
        </div>
      </div>
    </div>
  );
}

