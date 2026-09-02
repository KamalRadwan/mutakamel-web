"use client";

import Link from "next/link";
import { RefreshCw } from "lucide-react";
import {
  Badge,
  Button,
  DataTable,
  FilterBar,
  PageHeader,
  PermissionGate,
  SubNav,
  type ColumnDef,
  type FilterValues,
} from "@/design-system";
import { TenantBranchSelect } from "@/components/tenant/TenantBranchSelect";
import { formatDateTime } from "@/lib/format/date";
import { formatTemplate } from "@/lib/format/template";
import { TENANT_ROUTES } from "@/lib/navigation/tenant-routes";
import { tradeStatusLabel } from "../../trade-advanced-validation";
import { TRADE_WEBHOOK_NAV_ITEMS } from "../webhooks-nav";
import {
  WEBHOOK_DELIVERY_STATUSES,
  WEBHOOK_MANAGE_PERMISSION,
  isWebhookDeliveryStatus,
  type WebhookDelivery,
} from "../webhook-contract";
import { useWebhookDeliveries } from "./hooks/useWebhookDeliveries";

export default function WebhookDeliveriesPage() {
  const {
    t,
    lang,
    canManage,
    branchIds,
    branchId,
    selectBranch,
    items,
    pageInfo,
    status,
    isLoading,
    isRefreshing,
    queryError,
    setPage,
    setStatus,
    reload,
  } = useWebhookDeliveries();

  const filterValues: FilterValues = status
    ? { status: { kind: "select", value: status } }
    : {};

  const columns: ColumnDef<WebhookDelivery>[] = [
    {
      id: "createdAt",
      header: t.tradeAutomation.deliveredAt,
      cell: (delivery) => (
        <Link
          href={`${TENANT_ROUTES.tradeWebhookDeliveries}/${delivery.id}`}
          className="font-medium text-foreground underline-offset-2 hover:underline"
        >
          {formatDateTime(delivery.createdAt, lang)}
        </Link>
      ),
    },
    {
      id: "subscription",
      header: t.tradeAutomation.subscription,
      cell: (delivery) => delivery.subscriptionCode,
    },
    {
      id: "eventType",
      header: t.tradeAutomation.eventType,
      cell: (delivery) => delivery.sourceEventType,
    },
    {
      id: "status",
      header: t.common.status,
      cell: (delivery) => (
        <Badge tone={deliveryTone(delivery.status)}>
          {tradeStatusLabel(t.tradeStatus, delivery.status, t.common.unknownCode)}
        </Badge>
      ),
    },
    {
      id: "attempts",
      header: t.tradeAutomation.attemptCount,
      numeric: true,
      cell: (delivery) => String(delivery.attemptCount),
    },
    {
      id: "nextAttemptAt",
      header: t.tradeAutomation.nextAttemptAt,
      cell: (delivery) =>
        delivery.nextAttemptAt ? formatDateTime(delivery.nextAttemptAt, lang) : "—",
    },
  ];

  const content = (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={t.tradeAutomation.deliveriesTitle}
        description={t.tradeAutomation.deliveriesSubtitle}
        secondaryActions={
          <>
            <TenantBranchSelect
              branchIds={branchIds}
              branchId={branchId}
              onChange={selectBranch}
              disabled={isRefreshing}
            />
            <Button variant="outline" onClick={() => void reload()} disabled={isRefreshing}>
              <RefreshCw
                className={isRefreshing ? "size-4 animate-spin" : "size-4"}
                aria-hidden="true"
              />
              {t.tradeCommon.reload}
            </Button>
          </>
        }
      />

      <SubNav items={TRADE_WEBHOOK_NAV_ITEMS} />

      <FilterBar
        filters={[
          {
            id: "status",
            kind: "select",
            label: t.common.status,
            placeholder: t.tradeCommon.anyStatus,
            options: WEBHOOK_DELIVERY_STATUSES.map((value) => ({
              value,
              label: tradeStatusLabel(t.tradeStatus, value, t.common.unknownCode),
            })),
          },
        ]}
        values={filterValues}
        onChange={(next) => {
          const value = next.status;
          setStatus(
            value?.kind === "select" && isWebhookDeliveryStatus(value.value)
              ? value.value
              : undefined,
          );
        }}
        onReset={() => setStatus(undefined)}
        searchValue=""
        onSearchChange={() => undefined}
        filtersLabel={t.common.filter}
        clearAllLabel={t.filters.clearAll}
      />

      <DataTable
        columns={columns}
        rows={items}
        isLoading={isLoading}
        error={queryError}
        onRetry={() => void reload()}
        page={pageInfo}
        onPageChange={setPage}
        rowKey={(delivery) => delivery.id}
        labels={{
          retry: t.common.retry,
          errorTitle: t.tradeAutomation.deliveriesLoadFailed,
          emptyTitle: status ? t.tradeCommon.emptyForFilter : t.tradeAutomation.deliveriesEmpty,
          selectAll: t.common.actions,
          selectRow: t.common.actions,
          sortAscending: t.common.actions,
          sortDescending: t.common.actions,
          notSorted: t.common.actions,
          pagination: {
            previous: t.common.previousPage,
            next: t.common.nextPage,
            summary: (from, to, total) => formatTemplate(t.common.showingOf, { from, to, total }),
          },
        }}
      />
    </div>
  );

  return canManage ? (
    content
  ) : (
    <PermissionGate require={WEBHOOK_MANAGE_PERMISSION}>{content}</PermissionGate>
  );
}

/**
 * `EXHAUSTED` and `DISABLED` are distinct terminal states: attempts spent
 * versus subscription turned off. Neither is a plain failure.
 */
function deliveryTone(status: string): "positive" | "caution" | "negative" | "neutral" {
  if (status === "DELIVERED") return "positive";
  if (status === "RETRY_PENDING" || status === "EXHAUSTED") return "caution";
  if (status === "FAILED") return "negative";
  return "neutral";
}
