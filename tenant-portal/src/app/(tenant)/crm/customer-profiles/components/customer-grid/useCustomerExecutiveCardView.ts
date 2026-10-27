"use client";

import { useMemo, useState } from "react";
import type { MoveToTarget } from "@/design-system";
import { useTenantAuth } from "@/context/AuthContext";
import { useAccessMode } from "@/hooks/useAccessMode";
import { useI18n } from "@/i18n/I18nContext";
import { escapeCsvCell } from "@/lib/export/csv-cell";
import { CUSTOMER_PROFILE_BOARD_STATUSES } from "../../hooks/useCustomerProfileBoard";
import type {
  CustomerProfileItem,
  CustomerProfileStatus,
} from "../../hooks/useCustomerProfiles";

export type QuickSortKey = "default" | "name_asc" | "name_desc" | "rating_desc";

interface UseCustomerExecutiveCardViewParams {
  items: readonly CustomerProfileItem[];
  selectedIds: ReadonlySet<string>;
  onSelectionChange: (next: Set<string>) => void;
  canUpdate: (item: CustomerProfileItem) => boolean;
  canDelete: (item: CustomerProfileItem) => boolean;
}

export function useCustomerExecutiveCardView({
  items,
  selectedIds,
  onSelectionChange,
  canUpdate: capabilityCanUpdate,
  canDelete: capabilityCanDelete,
}: UseCustomerExecutiveCardViewParams) {
  const { t } = useI18n();
  const { user } = useTenantAuth();
  const { canMutate } = useAccessMode();
  const statusLabels: Record<string, string | undefined> = t.statusValues;

  const [quickSort, setQuickSort] = useState<QuickSortKey>("default");
  const [localStatusFilter, setLocalStatusFilter] =
    useState<CustomerProfileStatus | null>(null);

  const canExport =
    user?.permissions.includes("crm.customer_profiles.export") ?? false;
  const canUpdateCustomer = (item: CustomerProfileItem) =>
    canMutate && capabilityCanUpdate(item);
  const canDeleteCustomer = (item: CustomerProfileItem) =>
    canMutate && capabilityCanDelete(item);

  const statusCounts = useMemo(() => {
    const counts = new Map<CustomerProfileStatus, number>();
    for (const status of CUSTOMER_PROFILE_BOARD_STATUSES) {
      counts.set(status, 0);
    }
    for (const item of items) {
      counts.set(item.status, (counts.get(item.status) ?? 0) + 1);
    }
    return counts;
  }, [items]);

  const displayedItems = useMemo(() => {
    const filtered = localStatusFilter
      ? items.filter((item) => item.status === localStatusFilter)
      : [...items];

    if (quickSort === "name_asc") {
      return [...filtered].sort((a, b) =>
        a.displayName.localeCompare(b.displayName),
      );
    }
    if (quickSort === "name_desc") {
      return [...filtered].sort((a, b) =>
        b.displayName.localeCompare(a.displayName),
      );
    }
    if (quickSort === "rating_desc") {
      return [...filtered].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
    }
    return filtered;
  }, [items, localStatusFilter, quickSort]);

  const exportRows = useMemo(
    () => displayedItems.filter((item) => selectedIds.has(item.id)),
    [displayedItems, selectedIds],
  );

  const isAllSelected =
    displayedItems.length > 0 && exportRows.length === displayedItems.length;
  const isSomeSelected = exportRows.length > 0 && !isAllSelected;

  function toggleSelectAll() {
    if (isAllSelected) {
      onSelectionChange(new Set());
      return;
    }
    onSelectionChange(new Set(displayedItems.map((item) => item.id)));
  }

  function toggleSelectOne(id: string) {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    onSelectionChange(next);
  }

  function exportCsv() {
    if (!canExport || exportRows.length === 0) return;
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
      ...exportRows.map((item) => {
        const ownerName = item.owner
          ? [item.owner.firstName, item.owner.lastName].filter(Boolean).join(" ")
          : "";
        const phone =
          item.profileType === "CORPORATE"
            ? item.primaryContact?.phones[0] || item.phone
            : item.phone;
        return [
          item.displayName,
          t.crmCustomerProfiles.profileTypes[item.profileType],
          statusLabels[`CustomerStatus.${item.status}`] ??
            t.crmCustomerProfiles.unavailable,
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
    link.download = `customers-export-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function moveTargetsForCustomer(item: CustomerProfileItem): MoveToTarget[] {
    return CUSTOMER_PROFILE_BOARD_STATUSES.filter(
      (candidate) => candidate !== item.status,
    ).map((candidate) => ({
      id: candidate,
      label: statusLabels[`CustomerStatus.${candidate}`] ?? candidate,
    }));
  }

  return {
    quickSort,
    setQuickSort,
    localStatusFilter,
    setLocalStatusFilter,
    statusCounts,
    displayedItems,
    exportCount: exportRows.length,
    isAllSelected,
    isSomeSelected,
    canExport,
    canUpdateCustomer,
    canDeleteCustomer,
    toggleSelectAll,
    toggleSelectOne,
    exportCsv,
    moveTargetsForCustomer,
  };
}
