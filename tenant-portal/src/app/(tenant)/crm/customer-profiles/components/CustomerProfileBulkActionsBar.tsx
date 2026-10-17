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
import { ConfirmActionModal, cn, useToast } from "@/design-system";
import { useTenantAuth } from "@/context/AuthContext";
import { useI18n } from "@/i18n/I18nContext";
import { axiosClient } from "@/lib/api/axiosClient";
import { isUUIDv7 } from "@/lib/uuid";
import { readOwnerOptions } from "../../leads/[id]/hooks/readLeadOwnerOptions";
import type { LeadDetailsUser } from "../../leads/[id]/lead-details-edit-contract";
import { BLACKLISTED_STATUS } from "../customer-profile-contract";
import { CUSTOMER_PROFILE_BOARD_STATUSES } from "../hooks/useCustomerProfileBoard";
import {
  customerProfilePath,
  type CustomerProfileItem,
  type CustomerProfileStatus,
} from "../hooks/useCustomerProfiles";
import { getCustomerStatusVisual } from "./CustomerProfileStatusFunnelBar";

export interface CustomerProfileBulkActionsBarProps {
  selectedItems: CustomerProfileItem[];
  totalAvailable: number;
  branchId: string | null;
  canUpdate: (item: CustomerProfileItem) => boolean;
  canDelete: (item: CustomerProfileItem) => boolean;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onScheduleActivity: (item: CustomerProfileItem) => void;
  onCompleted: () => void;
}

type OpenMenu = "status" | "owner" | "rating" | null;

export function CustomerProfileBulkActionsBar({
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
  const isAr = lang === "ar";
  const toast = useToast();
  const { user: actor } = useTenantAuth();
  const canReadUsers = actor?.permissions.includes("users.user.read") ?? false;
  const statusLabels: Record<string, string | undefined> = t.statusValues;

  const [openMenu, setOpenMenu] = useState<OpenMenu>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [confirmBlacklistOpen, setConfirmBlacklistOpen] = useState(false);
  const [owners, setOwners] = useState<LeadDetailsUser[]>([]);
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
      const succeeded = results.filter((r) => r.status === "fulfilled").length;
      const failed = results.length - succeeded;
      if (succeeded > 0) {
        toast.success(
          successTitle,
          isAr
            ? `تم تحديث ${succeeded} عميل بنجاح${failed > 0 ? ` (${failed} فشل)` : ""}`
            : `Updated ${succeeded} customer(s)${failed > 0 ? ` (${failed} failed)` : ""}`,
        );
      } else {
        toast.error(
          isAr ? "تعذّر تحديث العملاء" : "Bulk update failed",
          isAr ? "يرجى المحاولة مرة أخرى." : "Please try again.",
        );
      }
      onClearSelection();
      onCompleted();
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
      isAr ? "تم تحديث الحالة" : "Status Updated",
    );
  }

  async function handleConfirmBulkBlacklist() {
    setConfirmBlacklistOpen(false);
    await runBulkPatch(
      "status",
      { status: BLACKLISTED_STATUS },
      isAr ? "تم حظر العملاء المحددين" : "Customers Blacklisted",
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
      const succeeded = results.filter((r) => r.status === "fulfilled").length;
      if (succeeded > 0) {
        toast.success(
          isAr ? "تم حذف العملاء المحددين" : "Customers Deleted",
          isAr
            ? `تم حذف ${succeeded} ملف عميل`
            : `Deleted ${succeeded} customer profile(s)`,
        );
      }
      onClearSelection();
      onCompleted();
    } finally {
      setBusyAction(null);
    }
  }

  return (
    <>
      <div
        role="region"
        aria-label={isAr ? "شريط الإجراءات الجماعية" : "Bulk Actions Bar"}
        className="fixed inset-x-0 bottom-5 z-40 mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-700/80 bg-slate-900/95 px-4 py-2.5 text-white shadow-2xl backdrop-blur-md"
      >
        {/* Left: Selection Counter & Select All */}
        <div className="flex items-center gap-2.5">
          <span className="inline-flex size-7 items-center justify-center rounded-lg bg-blue-600 text-xs font-extrabold tabular-nums text-white shadow-sm">
            {count}
          </span>
          <div className="flex flex-col">
            <span className="text-xs font-bold leading-tight">
              {isAr ? "عميل محدد" : count === 1 ? "Customer Selected" : "Customers Selected"}
            </span>
            <div className="flex items-center gap-2 text-[10px] text-slate-300">
              {count < totalAvailable && (
                <button
                  type="button"
                  onClick={onSelectAll}
                  className="inline-flex items-center gap-1 font-semibold text-blue-400 hover:text-blue-300 hover:underline"
                >
                  <CheckSquare className="size-2.5" />
                  {isAr
                    ? `تحديد الكل (${totalAvailable})`
                    : `Select all (${totalAvailable})`}
                </button>
              )}
              <button
                type="button"
                onClick={onClearSelection}
                className="font-medium text-slate-400 hover:text-white hover:underline"
              >
                {isAr ? "إلغاء التحديد" : "Clear"}
              </button>
            </div>
          </div>
        </div>

        {/* Right: Action Buttons */}
        <div className="flex flex-wrap items-center gap-1.5">
          {/* 1. Move Status */}
          {updatableItems.length > 0 && (
            <div className="relative">
              <button
                type="button"
                disabled={busyAction !== null}
                onClick={() =>
                  setOpenMenu((cur) => (cur === "status" ? null : "status"))
                }
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800/90 px-3 py-1.5 text-xs font-semibold text-slate-100 transition-colors hover:bg-slate-700",
                  openMenu === "status" && "border-blue-500 bg-slate-800",
                )}
              >
                {busyAction === "status" ? (
                  <Loader2 className="size-3.5 animate-spin text-blue-400" />
                ) : (
                  <ArrowRightLeft className="size-3.5 text-blue-400" />
                )}
                <span>{isAr ? "نقل الحالة" : "Move Status"}</span>
                <ChevronDown className="size-3 text-slate-400" />
              </button>

              {openMenu === "status" && (
                <div className="absolute bottom-full start-0 mb-2 w-52 overflow-hidden rounded-xl border border-slate-700 bg-slate-900 p-1 shadow-2xl">
                  <p className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    {isAr ? "اختر الحالة الجديدة" : "Select Target Status"}
                  </p>
                  {CUSTOMER_PROFILE_BOARD_STATUSES.map((status) => {
                    const visual = getCustomerStatusVisual(status);
                    const StatusIcon = visual.icon;
                    return (
                      <button
                        key={status}
                        type="button"
                        onClick={() => void handleBulkMoveStatus(status)}
                        className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-start text-xs font-semibold text-slate-100 transition-colors hover:bg-slate-800"
                      >
                        <StatusIcon
                          className="size-3.5 shrink-0"
                          style={{ color: visual.accentHex }}
                        />
                        <span className="truncate">
                          {statusLabels[`CustomerStatus.${status}`] ?? status}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* 2. Assign Salesperson */}
          {updatableItems.length > 0 && canReadUsers && (
            <div className="relative">
              <button
                type="button"
                disabled={busyAction !== null}
                onClick={() =>
                  setOpenMenu((cur) => (cur === "owner" ? null : "owner"))
                }
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800/90 px-3 py-1.5 text-xs font-semibold text-slate-100 transition-colors hover:bg-slate-700",
                  openMenu === "owner" && "border-emerald-500 bg-slate-800",
                )}
              >
                {busyAction === "owner" ? (
                  <Loader2 className="size-3.5 animate-spin text-emerald-400" />
                ) : (
                  <UserCheck className="size-3.5 text-emerald-400" />
                )}
                <span>{isAr ? "إسناد مسؤول" : "Assign Owner"}</span>
                <ChevronDown className="size-3 text-slate-400" />
              </button>

              {openMenu === "owner" && (
                <div className="absolute bottom-full start-0 mb-2 max-h-60 w-56 overflow-y-auto rounded-xl border border-slate-700 bg-slate-900 p-1 shadow-2xl">
                  <p className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    {isAr ? "اختر مسؤول المبيعات" : "Assign Salesperson"}
                  </p>
                  {ownersLoading ? (
                    <div className="flex items-center justify-center py-4 text-xs text-slate-400">
                      <Loader2 className="me-1.5 size-3.5 animate-spin" />
                      {t.common.loading}
                    </div>
                  ) : owners.length === 0 ? (
                    <p className="px-2.5 py-2 text-xs text-slate-400">
                      {isAr ? "لا يوجد مستخدمون متاحون" : "No active users"}
                    </p>
                  ) : (
                    owners.map((owner) => {
                      const fullName = [owner.firstName, owner.lastName]
                        .filter(Boolean)
                        .join(" ");
                      return (
                        <button
                          key={owner.id}
                          type="button"
                          onClick={() =>
                            void runBulkPatch(
                              "owner",
                              { ownerUserId: owner.id },
                              isAr ? "تم إسناد المسؤول" : "Salesperson Assigned",
                            )
                          }
                          className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-start text-xs font-medium text-slate-100 transition-colors hover:bg-slate-800"
                        >
                          <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-[10px] font-bold text-emerald-300">
                            {(owner.firstName[0] ?? "U").toUpperCase()}
                          </span>
                          <span className="truncate">{fullName}</span>
                        </button>
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
              <button
                type="button"
                disabled={busyAction !== null}
                onClick={() =>
                  setOpenMenu((cur) => (cur === "rating" ? null : "rating"))
                }
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800/90 px-3 py-1.5 text-xs font-semibold text-slate-100 transition-colors hover:bg-slate-700",
                  openMenu === "rating" && "border-amber-500 bg-slate-800",
                )}
              >
                {busyAction === "rating" ? (
                  <Loader2 className="size-3.5 animate-spin text-amber-400" />
                ) : (
                  <Star className="size-3.5 fill-amber-400 text-amber-400" />
                )}
                <span>{isAr ? "التقييم" : "Set Rating"}</span>
                <ChevronDown className="size-3 text-slate-400" />
              </button>

              {openMenu === "rating" && (
                <div className="absolute bottom-full start-0 mb-2 w-44 overflow-hidden rounded-xl border border-slate-700 bg-slate-900 p-1 shadow-2xl">
                  {[3, 2, 1, 0].map((stars) => (
                    <button
                      key={stars}
                      type="button"
                      onClick={() =>
                        void runBulkPatch(
                          "rating",
                          { rating: stars },
                          isAr ? "تم تحديث التقييم" : "Rating Updated",
                        )
                      }
                      className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-100 transition-colors hover:bg-slate-800"
                    >
                      <span>
                        {stars === 0
                          ? isAr
                            ? "بدون تقييم"
                            : "Clear rating"
                          : `${stars} ★`}
                      </span>
                      {stars > 0 && (
                        <span className="flex items-center gap-0.5 text-amber-400">
                          {Array.from({ length: stars }).map((_, idx) => (
                            <Star
                              key={idx}
                              className="size-3 fill-amber-400 text-amber-400"
                            />
                          ))}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 4. Schedule Activity */}
          {selectedItems[0] && (
            <button
              type="button"
              disabled={busyAction !== null}
              onClick={() => onScheduleActivity(selectedItems[0])}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800/90 px-3 py-1.5 text-xs font-semibold text-slate-100 transition-colors hover:bg-slate-700"
            >
              <CalendarPlus className="size-3.5 text-violet-400" />
              <span>{isAr ? "جدولة نشاط" : "Schedule Activity"}</span>
            </button>
          )}

          {/* 5. Bulk Delete */}
          {deletableItems.length > 0 && (
            <button
              type="button"
              disabled={busyAction !== null}
              onClick={() => setConfirmDeleteOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-red-500/40 bg-red-500/15 px-3 py-1.5 text-xs font-bold text-red-300 transition-colors hover:bg-red-500/25"
            >
              {busyAction === "delete" ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Trash2 className="size-3.5" />
              )}
              <span>
                {isAr
                  ? `حذف (${deletableItems.length})`
                  : `Delete (${deletableItems.length})`}
              </span>
            </button>
          )}

          <button
            type="button"
            onClick={onClearSelection}
            aria-label={t.common.close}
            className="ms-1 inline-flex size-7 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
          >
            <X className="size-4" />
          </button>
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
          isAr
            ? `هل أنت متأكد من حذف ${deletableItems.length} ملف عميل؟ لا يمكن التراجع عن هذا الإجراء.`
            : `Delete ${deletableItems.length} selected customer profile(s)? This cannot be undone.`
        }
        confirmLabel={t.common.confirmDelete}
        cancelLabel={t.common.cancel}
        loading={busyAction === "delete"}
        onConfirm={() => void handleBulkDelete()}
      />
    </>
  );
}
