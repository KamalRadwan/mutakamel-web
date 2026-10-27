"use client";

import { useEffect, useState } from "react";
import {
  ArrowRightLeft,
  CalendarPlus,
  CheckSquare,
  ChevronDown,
  Loader2,
  Star,
  Trash2,
  UserCheck,
  X,
} from "lucide-react";
import { Button, ConfirmActionModal, cn, useToast } from "@/design-system";
import { useTenantAuth } from "@/context/AuthContext";
import { useI18n } from "@/i18n/I18nContext";
import { axiosClient } from "@/lib/api/axiosClient";
import { normalizeApiError } from "@/lib/api/errors";
import { formatTemplate } from "@/lib/format/template";
import { isUUIDv7 } from "@/lib/uuid";
import { readOwnerOptions } from "../../leads/[id]/hooks/readLeadOwnerOptions";
import type { LeadDetailsUser } from "../../leads/[id]/lead-details-edit-contract";
import { useCrmErrorText } from "../../shared/hooks/useCrmErrorText";
import { BLACKLISTED_STATUS } from "../customer-profile-contract";
import { CUSTOMER_PROFILE_BOARD_STATUSES } from "../hooks/useCustomerProfileBoard";
import {
  customerProfilePath,
  type CustomerProfileItem,
  type CustomerProfileStatus,
} from "../hooks/useCustomerProfiles";
import { getCustomerStatusVisual } from "./CustomerProfileStatusFunnelBar";

export interface CustomerProfileBulkActionsBarProps {
  allowedOwnerIds: string[] | null;
  selectedItems: CustomerProfileItem[];
  totalAvailable: number;
  branchId: string | null;
  canUpdate: (item: CustomerProfileItem) => boolean;
  canDelete: (item: CustomerProfileItem) => boolean;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onScheduleActivity: (item: CustomerProfileItem) => void;
  onCompleted: (succeededIds: string[]) => void;
}

type OpenMenu = "status" | "owner" | "rating" | null;

export function CustomerProfileBulkActionsBar({
  allowedOwnerIds,
  selectedItems,
  totalAvailable,
  branchId,
  canUpdate,
  canDelete,
  onSelectAll,
  onClearSelection,
  onScheduleActivity,
  onCompleted,
}: CustomerProfileBulkActionsBarProps) {
  const { t, lang } = useI18n();
  const toast = useToast();
  const errorText = useCrmErrorText();
  const bulkText = t.crmCustomerProfiles.bulkActions;
  const { user: actor } = useTenantAuth();
  const canReadUsers = actor?.permissions.includes("users.user.read") ?? false;
  const statusLabels: Record<string, string | undefined> = t.statusValues;

  const [openMenu, setOpenMenu] = useState<OpenMenu>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [confirmBlacklistOpen, setConfirmBlacklistOpen] = useState(false);
  const [owners, setOwners] = useState<LeadDetailsUser[]>([]);
  const visibleOwners = owners.filter(
    (owner) => allowedOwnerIds === null || allowedOwnerIds.includes(owner.id),
  );
  const [ownersLoadedBranch, setOwnersLoadedBranch] = useState<string | null>(
    null,
  );

  const count = selectedItems.length;
  const updatableItems = selectedItems.filter(canUpdate);
  const deletableItems = selectedItems.filter(canDelete);
  const canLoadOwners =
    openMenu === "owner" &&
    canReadUsers &&
    Boolean(branchId) &&
    isUUIDv7(branchId ?? "");
  const ownersLoading = canLoadOwners && ownersLoadedBranch !== branchId;

  useEffect(() => {
    if (!canLoadOwners || !branchId) {
      return;
    }
    const controller = new AbortController();
    void readOwnerOptions(branchId, controller.signal)
      .then((list) => {
        if (!controller.signal.aborted) {
          setOwners(list);
          setOwnersLoadedBranch(branchId);
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setOwners([]);
          setOwnersLoadedBranch(branchId);
        }
      });
    return () => controller.abort();
  }, [branchId, canLoadOwners]);

  if (count === 0) return null;

  function reportResults(
    results: PromiseSettledResult<unknown>[],
    eligibleItems: CustomerProfileItem[],
    successTitle: string,
  ) {
    const succeededIds: string[] = [];
    const reasons = new Map<string, number>();
    for (const [index, result] of results.entries()) {
      if (result.status === "fulfilled") {
        succeededIds.push(eligibleItems[index].id);
      } else {
        const reason =
          errorText(normalizeApiError(result.reason)) ?? t.crmShared.errorGeneric;
        reasons.set(reason, (reasons.get(reason) ?? 0) + 1);
      }
    }
    const failed = results.length - succeededIds.length;
    const skipped = count - eligibleItems.length;
    const number = new Intl.NumberFormat({ ar: "ar-EG-u-nu-latn", en: "en" }[lang]);
    const summary = formatTemplate(bulkText.summary, {
      eligible: number.format(eligibleItems.length),
      succeeded: number.format(succeededIds.length),
      skipped: number.format(skipped),
      failed: number.format(failed),
    });
    const description = [
      summary,
      ...(skipped > 0 ? [bulkText.skippedReason] : []),
      ...Array.from(reasons, ([reason, reasonCount]) =>
        formatTemplate(bulkText.reasonCount, {
          reason,
          count: number.format(reasonCount),
        }),
      ),
    ].join(" ");
    if (failed > 0) toast.error(bulkText.incompleteTitle, description);
    else toast.success(successTitle, description);
    onCompleted(succeededIds);
  }

  async function runBulkPatch(
    actionKey: string,
    body: Record<string, unknown>,
    successTitle: string,
  ) {
    if (updatableItems.length === 0 || busyAction) return;
    setBusyAction(actionKey);
    setOpenMenu(null);
    try {
      const results = await Promise.allSettled(
        updatableItems.map((item) =>
          axiosClient.patch(customerProfilePath(item.id), body, {
            nonReplayable: true,
            skipAutoIdempotency: true,
            cache: "no-store",
            maxResponseBytes: 256 * 1024,
          }),
        ),
      );
      reportResults(results, updatableItems, successTitle);
    } finally {
      setBusyAction(null);
    }
  }

  async function handleBulkMoveStatus(status: CustomerProfileStatus) {
    if (status === BLACKLISTED_STATUS) {
      setOpenMenu(null);
      setConfirmBlacklistOpen(true);
      return;
    }
    await runBulkPatch(
      "status",
      { status },
      t.crmCustomerProfiles.ui.bulkActions.status_updated,
    );
  }

  async function handleConfirmBulkBlacklist() {
    setConfirmBlacklistOpen(false);
    await runBulkPatch(
      "status",
      { status: BLACKLISTED_STATUS },
      t.crmCustomerProfiles.ui.bulkActions.customers_blacklisted,
    );
  }

  async function handleBulkDelete() {
    if (deletableItems.length === 0 || busyAction) return;
    setBusyAction("delete");
    setConfirmDeleteOpen(false);
    setOpenMenu(null);
    try {
      const results = await Promise.allSettled(
        deletableItems.map((item) =>
          axiosClient.delete(customerProfilePath(item.id), {
            nonReplayable: true,
            skipAutoIdempotency: true,
            cache: "no-store",
            maxResponseBytes: 64 * 1024,
          }),
        ),
      );
      reportResults(results, deletableItems, bulkText.deletedTitle);
    } finally {
      setBusyAction(null);
    }
  }

  return (
    <>
      <div
        role="region"
        aria-label={t.crmCustomerProfiles.ui.bulkActions.bulk_actions_bar}
        className="fixed inset-x-0 bottom-5 z-(--z-overlay) mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-2.5 text-foreground shadow-2xl"
      >
        {/* Left: Selection Counter & Select All */}
        <div className="flex items-center gap-2.5">
          <span className="inline-flex size-7 items-center justify-center rounded-lg bg-primary text-xs font-semibold tabular-nums text-primary-foreground shadow-sm">
            {count}
          </span>
          <div className="flex flex-col">
            <span className="text-xs font-semibold leading-tight">
              {formatTemplate(t.crmCustomerProfiles.ui.bulkActions.selected_count, { count })}
            </span>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {count < totalAvailable && (
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  onClick={onSelectAll}
                  className="h-auto p-0 font-semibold text-primary hover:bg-transparent hover:underline"
                >
                  <CheckSquare className="size-2.5" />
                  {formatTemplate(
                    t.crmCustomerProfiles.ui.bulkActions.select_all_count,
                    { totalAvailable },
                  )}
                </Button>
              )}
              <Button
                type="button"
                variant="ghost"
                size="xs"
                onClick={onClearSelection}
                className="h-auto p-0 font-medium text-muted-foreground hover:bg-transparent hover:text-foreground hover:underline"
              >
                {t.crmCustomerProfiles.ui.bulkActions.clear}
              </Button>
            </div>
          </div>
        </div>

        {/* Right: Action Buttons */}
        <div className="flex flex-wrap items-center gap-1.5">
          {/* 1. Move Status */}
          {updatableItems.length > 0 && (
            <div className="relative">
              <Button
                type="button"
                variant="outline"
                size="xs"
                disabled={busyAction !== null}
                onClick={() =>
                  setOpenMenu((cur) => (cur === "status" ? null : "status"))
                }
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-lg border border-border bg-muted px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-muted/80",
                  openMenu === "status" && "border-swatch-blue bg-swatch-blue-soft/40",
                )}
              >
                {busyAction === "status" ? (
                  <Loader2 className="size-3.5 animate-spin text-swatch-blue" />
                ) : (
                  <ArrowRightLeft className="size-3.5 text-swatch-blue" />
                )}
                <span>{t.crmCustomerProfiles.ui.bulkActions.move_status}</span>
                <ChevronDown className="size-3 text-muted-foreground" />
              </Button>

              {openMenu === "status" && (
                <div className="absolute bottom-full start-0 mb-2 w-52 overflow-hidden rounded-lg border border-border bg-card p-1 shadow-2xl">
                  <p className="px-2.5 py-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {t.crmCustomerProfiles.ui.bulkActions.select_target_status}
                  </p>
                  {CUSTOMER_PROFILE_BOARD_STATUSES.map((status) => {
                    const visual = getCustomerStatusVisual(status);
                    const StatusIcon = visual.icon;
                    return (
                      <Button
                        key={status}
                        type="button"
                        variant="ghost"
                        size="xs"
                        onClick={() => void handleBulkMoveStatus(status)}
                        className="flex w-full items-center justify-start gap-2 rounded-lg px-2.5 py-1.5 text-start text-xs font-semibold text-foreground transition-colors hover:bg-muted"
                      >
                        <StatusIcon
                          className="size-3.5 shrink-0"
                          style={{ color: visual.accentHex }}
                        />
                        <span className="truncate">
                          {statusLabels[`CustomerStatus.${status}`] ?? status}
                        </span>
                      </Button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* 2. Assign Salesperson */}
          {updatableItems.length > 0 && canReadUsers && (
            <div className="relative">
              <Button
                type="button"
                variant="outline"
                size="xs"
                disabled={busyAction !== null}
                onClick={() =>
                  setOpenMenu((cur) => (cur === "owner" ? null : "owner"))
                }
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-lg border border-border bg-muted px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-muted/80",
                  openMenu === "owner" && "border-swatch-green bg-swatch-green-soft/40",
                )}
              >
                {busyAction === "owner" ? (
                  <Loader2 className="size-3.5 animate-spin text-swatch-green" />
                ) : (
                  <UserCheck className="size-3.5 text-swatch-green" />
                )}
                <span>{t.crmCustomerProfiles.ui.bulkActions.assign_owner}</span>
                <ChevronDown className="size-3 text-muted-foreground" />
              </Button>

              {openMenu === "owner" && (
                <div className="absolute bottom-full start-0 mb-2 max-h-60 w-56 overflow-y-auto rounded-lg border border-border bg-card p-1 shadow-2xl">
                  <p className="px-2.5 py-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {t.crmCustomerProfiles.ui.bulkActions.assign_salesperson}
                  </p>
                  {ownersLoading ? (
                    <div className="flex items-center justify-center py-4 text-xs text-muted-foreground">
                      <Loader2 className="me-1.5 size-3.5 animate-spin" />
                      {t.common.loading}
                    </div>
                  ) : visibleOwners.length === 0 ? (
                    <p className="px-2.5 py-2 text-xs text-muted-foreground">
                      {t.crmCustomerProfiles.ui.bulkActions.no_active_users}
                    </p>
                  ) : (
                    visibleOwners.map((owner) => {
                      const fullName = [owner.firstName, owner.lastName]
                        .filter(Boolean)
                        .join(" ");
                      return (
                        <Button
                          key={owner.id}
                          type="button"
                          variant="ghost"
                          size="xs"
                          onClick={() =>
                            void runBulkPatch(
                              "owner",
                              { ownerUserId: owner.id },
                              t.crmCustomerProfiles.ui.bulkActions.salesperson_assigned,
                            )
                          }
                          className="flex w-full items-center justify-start gap-2 rounded-lg px-2.5 py-1.5 text-start text-xs font-medium text-foreground transition-colors hover:bg-muted"
                        >
                          <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-swatch-green-soft text-xs font-semibold text-swatch-green-deep">
                            {(owner.firstName[0] ?? "U").toUpperCase()}
                          </span>
                          <span className="truncate">{fullName}</span>
                        </Button>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          )}

          {/* 3. Set Rating */}
          {updatableItems.length > 0 && (
            <div className="relative">
              <Button
                type="button"
                variant="outline"
                size="xs"
                disabled={busyAction !== null}
                onClick={() =>
                  setOpenMenu((cur) => (cur === "rating" ? null : "rating"))
                }
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-lg border border-border bg-muted px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-muted/80",
                  openMenu === "rating" && "border-swatch-amber bg-swatch-amber-soft/40",
                )}
              >
                {busyAction === "rating" ? (
                  <Loader2 className="size-3.5 animate-spin text-warning" />
                ) : (
                  <Star className="size-3.5 fill-warning text-warning" />
                )}
                <span>{t.crmCustomerProfiles.ui.bulkActions.set_rating}</span>
                <ChevronDown className="size-3 text-muted-foreground" />
              </Button>

              {openMenu === "rating" && (
                <div className="absolute bottom-full start-0 mb-2 w-44 overflow-hidden rounded-lg border border-border bg-card p-1 shadow-2xl">
                  {[3, 2, 1, 0].map((stars) => (
                    <Button
                      key={stars}
                      type="button"
                      variant="ghost"
                      size="xs"
                      onClick={() =>
                        void runBulkPatch(
                          "rating",
                          { rating: stars },
                          t.crmCustomerProfiles.ui.bulkActions.rating_updated,
                        )
                      }
                      className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
                    >
                      <span>
                        {stars === 0
                          ? t.crmCustomerProfiles.ui.bulkActions.clear_rating
                          : `${stars} ★`}
                      </span>
                      {stars > 0 && (
                        <span className="flex items-center gap-0.5 text-warning">
                          {Array.from({ length: stars }).map((_, idx) => (
                            <Star
                              key={idx}
                              className="size-3 fill-warning text-warning"
                            />
                          ))}
                        </span>
                      )}
                    </Button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 4. Schedule Activity */}
          {count === 1 && selectedItems[0] && (
            <Button
              type="button"
              variant="outline"
              size="xs"
              disabled={busyAction !== null}
              onClick={() => onScheduleActivity(selectedItems[0])}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-muted px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-muted/80"
            >
              <CalendarPlus className="size-3.5 text-swatch-purple" />
              <span>{bulkText.scheduleActivity}</span>
            </Button>
          )}

          {/* 5. Bulk Delete */}
          {deletableItems.length > 0 && (
            <Button
              type="button"
              variant="outline"
              size="xs"
              disabled={busyAction !== null}
              onClick={() => setConfirmDeleteOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-destructive bg-destructive-subtle px-3 py-1.5 text-xs font-semibold text-destructive-subtle-foreground transition-colors hover:bg-destructive/20"
            >
              {busyAction === "delete" ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Trash2 className="size-3.5" />
              )}
              <span>
                {formatTemplate(
                  t.crmCustomerProfiles.ui.bulkActions.delete_count,
                  { deletableItems_length: deletableItems.length },
                )}
              </span>
            </Button>
          )}

          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={onClearSelection}
            aria-label={t.common.close}
            className="ms-1 inline-flex size-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="size-4" />
          </Button>
        </div>
      </div>

      {/* Confirm Bulk Blacklist */}
      <ConfirmActionModal
        open={confirmBlacklistOpen}
        onOpenChange={setConfirmBlacklistOpen}
        title={t.crmCustomerProfiles.confirmBlacklistTitle}
        description={t.crmCustomerProfiles.confirmBlacklistMessage}
        confirmLabel={t.crmCustomerProfiles.confirmBlacklistAction}
        cancelLabel={t.common.cancel}
        loading={busyAction === "status"}
        onConfirm={() => void handleConfirmBulkBlacklist()}
      />

      {/* Confirm Bulk Delete */}
      <ConfirmActionModal
        open={confirmDeleteOpen}
        onOpenChange={setConfirmDeleteOpen}
        title={t.crmCustomerProfileActions.deleteTitle}
        description={
          formatTemplate(
            t.crmCustomerProfiles.ui.bulkActions.delete_confirmation,
            { deletableItems_length: deletableItems.length },
          )
        }
        confirmLabel={t.common.confirmDelete}
        cancelLabel={t.common.cancel}
        loading={busyAction === "delete"}
        onConfirm={() => void handleBulkDelete()}
      />
    </>
  );
}
