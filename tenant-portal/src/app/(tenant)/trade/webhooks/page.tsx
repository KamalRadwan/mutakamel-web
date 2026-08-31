"use client";

import Link from "next/link";
import { RefreshCw } from "lucide-react";
import {
  Badge,
  Button,
  DataTable,
  DegradedBanner,
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
import { tradeStatusLabel } from "../trade-advanced-validation";
import { TRADE_WEBHOOK_NAV_ITEMS } from "./webhooks-nav";
import {
  WEBHOOK_MANAGE_PERMISSION,
  WEBHOOK_SUBSCRIPTION_STATUSES,
  isWebhookSubscriptionStatus,
  type WebhookSubscription,
} from "./webhook-contract";
import { CreateWebhookSubscriptionModal } from "./components/CreateWebhookSubscriptionModal";
import { useWebhookSubscriptions } from "./hooks/useWebhookSubscriptions";

export default function WebhookSubscriptionsPage() {
  const {
    t,
    lang,
    canManage,
    branchIds,
    branchId,
    selectBranch,
    items,
    events,
    eventsUnavailable,
    pageInfo,
    status,
    isLoading,
    isRefreshing,
    queryError,
    createOpen,
    isSubmitting,
    formError,
    setPage,
    setStatus,
    openCreate,
    closeCreate,
    create,
    reload,
  } = useWebhookSubscriptions();

  const filterValues: FilterValues = status
    ? { status: { kind: "select", value: status } }
    : {};

  const columns: ColumnDef<WebhookSubscription>[] = [
    {
      id: "code",
      header: t.tradeAutomation.code,
      cell: (subscription) => (
        <Link
          href={`${TENANT_ROUTES.tradeWebhooks}/${subscription.id}`}
          className="font-medium text-foreground underline-offset-2 hover:underline"
        >
          {subscription.code}
        </Link>
      ),
    },
    {
      id: "endpoint",
      header: t.tradeAutomation.endpointUri,
      // The server sends origin and pathname separately — never the full URI
      // with its query — so the two halves are joined for display only.
      cell: (subscription) => `${subscription.endpoint.origin}${subscription.endpoint.pathname}`,
    },
    {
      id: "status",
      header: t.common.status,
      cell: (subscription) => (
        <Badge tone={subscription.status === "ACTIVE" ? "positive" : "neutral"}>
          {tradeStatusLabel(t.tradeStatus, subscription.status)}
        </Badge>
      ),
    },
    {
      id: "secret",
      header: t.tradeAutomation.secretStatus,
      cell: (subscription) =>
        subscription.secretStatus
          ? tradeStatusLabel(t.tradeStatus, subscription.secretStatus)
          : "—",
    },
    {
      id: "updatedAt",
      header: t.tradeCommon.updatedAt,
      cell: (subscription) => formatDateTime(subscription.updatedAt, lang),
    },
  ];

  const content = (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={t.tradeAutomation.subscriptionsTitle}
        description={t.tradeAutomation.subscriptionsSubtitle}
        primaryAction={
          canManage
            ? { label: t.tradeAutomation.subscriptionCreate, onClick: openCreate }
            : undefined
        }
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

      {/* Not a fault: no route returns the signing secret, so the portal has
          nothing to show the caller after a rotation. */}
      <DegradedBanner message={t.tradeAutomation.secretNeverReturned} />

      {eventsUnavailable ? (
        <DegradedBanner message={t.tradeAutomation.eventsUnavailable} />
      ) : null}

      <FilterBar
        filters={[
          {
            id: "status",
            kind: "select",
            label: t.common.status,
            placeholder: t.tradeCommon.anyStatus,
            options: WEBHOOK_SUBSCRIPTION_STATUSES.map((value) => ({
              value,
              label: tradeStatusLabel(t.tradeStatus, value),
            })),
          },
        ]}
        values={filterValues}
        onChange={(next) => {
          const value = next.status;
          setStatus(
            value?.kind === "select" && isWebhookSubscriptionStatus(value.value)
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
        rowKey={(subscription) => subscription.id}
        labels={{
          retry: t.common.retry,
          errorTitle: t.tradeAutomation.subscriptionsLoadFailed,
          emptyTitle: status ? t.tradeCommon.emptyForFilter : t.tradeAutomation.subscriptionsEmpty,
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

      <CreateWebhookSubscriptionModal
        key={createOpen ? "create-open" : "create-closed"}
        events={events}
        eventsUnavailable={eventsUnavailable}
        isOpen={createOpen}
        onClose={closeCreate}
        onSubmit={create}
        isSubmitting={isSubmitting}
        error={formError}
      />
    </div>
  );

  return canManage ? (
    content
  ) : (
    <PermissionGate require={WEBHOOK_MANAGE_PERMISSION}>{content}</PermissionGate>
  );
}
