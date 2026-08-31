"use client";

import Link from "next/link";
import { Filter, Pencil, RefreshCw } from "lucide-react";
import {
  Badge,
  Button,
  DataTable,
  EmptyState,
  FilterBar,
  Money,
  PageHeader,
  PermissionGate,
  SubNav,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TRADE_FOUNDATION_NAV_ITEMS,
  type ColumnDef,
  type FilterValues,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatDate } from "@/lib/format/date";
import { formatTemplate } from "@/lib/format/template";
import { TENANT_ROUTES } from "@/lib/navigation/tenant-routes";
import { TradeScopeBar } from "../TradeScopeBar";
import { TRADE_PERMISSIONS } from "../trade-scope";
import { CreateAccountDrawer, EditAccountDrawer } from "./components/AccountDrawers";
import { useCommercialAccounts } from "./hooks/useCommercialAccounts";
import {
  ACCOUNT_KNOWN_STATUSES,
  ACCOUNT_ROLES,
  isAccountRole,
  type AccountRole,
  type CommercialAccount,
} from "./commercial-account-contract";

export default function TradeCommercialAccountsPage() {
  const { t, lang } = useI18n();
  const accounts = useCommercialAccounts();

  const filterValues: FilterValues = {
    ...(accounts.roleFilter
      ? { accountRole: { kind: "select" as const, value: accounts.roleFilter } }
      : {}),
    ...(accounts.statusFilter
      ? { status: { kind: "select" as const, value: accounts.statusFilter } }
      : {}),
  };

  const columns: ColumnDef<CommercialAccount>[] = [
    {
      id: "partyId",
      header: t.trade.accountParty,
      cell: (account) => (
        <Link
          href={`${TENANT_ROUTES.tradeCommercialAccounts}/${account.id}`}
          className="font-mono text-xs font-medium text-foreground hover:underline"
        >
          {account.partyId}
        </Link>
      ),
    },
    {
      id: "accountRole",
      header: t.trade.accountRole,
      cell: (account) => (
        <Badge tone="neutral">
          {isAccountRole(account.accountRole)
            ? t.trade[`accountRole_${account.accountRole}`]
            : account.accountRole}
        </Badge>
      ),
    },
    {
      id: "creditLimit",
      header: t.trade.accountCreditLimit,
      numeric: true,
      // A decimal string through `Money`, never `Number()`. Trailing zeros are
      // stripped upstream, so `10.50` arrives as "10.5".
      cell: (account) =>
        account.creditLimit === null ? (
          "—"
        ) : (
          <Money value={account.creditLimit} currency={account.creditCurrencyCode ?? undefined} />
        ),
    },
    {
      id: "status",
      header: t.common.status,
      cell: (account) =>
        (ACCOUNT_KNOWN_STATUSES as readonly string[]).includes(account.status) ? (
          <Badge tone={account.status === "ACTIVE" ? "positive" : "negative"}>
            {t.trade[`accountStatus_${account.status as "ACTIVE" | "BLOCKED"}`]}
          </Badge>
        ) : (
          <Badge tone="neutral">
            <span className="font-mono">{account.status}</span>
          </Badge>
        ),
    },
    {
      id: "updatedAt",
      header: t.trade.updatedAt,
      cell: (account) => formatDate(account.updatedAt, lang),
    },
    ...(accounts.canManage && !accounts.writeScopeGap
      ? [
          {
            id: "actions",
            header: t.common.actions,
            align: "end" as const,
            sticky: "end" as const,
            cell: (account: CommercialAccount) => (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={t.trade.accountEditTitle}
                    disabled={accounts.isSubmitting}
                    onClick={() => accounts.openEdit(account)}
                  >
                    <Pencil className="size-4" aria-hidden="true" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{t.trade.accountEditTitle}</TooltipContent>
              </Tooltip>
            ),
          },
        ]
      : []),
  ];

  return (
    <PermissionGate require={TRADE_PERMISSIONS.commercialAccountsRead}>
      <div className="flex flex-col gap-4">
        <PageHeader
          title={t.trade.accountsTitle}
          description={t.trade.accountsSubtitle}
          primaryAction={
            accounts.canManage && !accounts.writeScopeGap
              ? { label: t.trade.accountCreate, onClick: accounts.openCreate }
              : undefined
          }
          secondaryActions={
            <Button
              variant="outline"
              onClick={() => void accounts.reload()}
              disabled={accounts.isRefreshing}
            >
              <RefreshCw
                className={accounts.isRefreshing ? "size-4 animate-spin" : "size-4"}
                aria-hidden="true"
              />
              {t.trade.reload}
            </Button>
          }
        />

        <SubNav items={TRADE_FOUNDATION_NAV_ITEMS} />

        <TradeScopeBar />

        {accounts.scopeGap ? (
          <EmptyState
            icon={Filter}
            title={t.trade.scopeRequiredTitle}
            description={t.trade.accountScopeRequiredDescription}
          />
        ) : (
          <>
            <FilterBar
              filters={[
                {
                  id: "accountRole",
                  kind: "select",
                  label: t.trade.accountRole,
                  placeholder: t.trade.statusAny,
                  options: ACCOUNT_ROLES.map((role) => ({
                    value: role,
                    label: t.trade[`accountRole_${role}`],
                  })),
                },
                {
                  id: "status",
                  kind: "select",
                  label: t.common.status,
                  placeholder: t.trade.statusAny,
                  // Only the two proven members are offered. The filter accepts
                  // any string, but offering an invented one would be a guess.
                  options: ACCOUNT_KNOWN_STATUSES.map((status) => ({
                    value: status,
                    label: t.trade[`accountStatus_${status}`],
                  })),
                },
              ]}
              values={filterValues}
              onChange={(next) => {
                const role = next.accountRole;
                const status = next.status;
                accounts.setRoleFilter(
                  role?.kind === "select" && role.value ? (role.value as AccountRole) : undefined,
                );
                accounts.setStatusFilter(
                  status?.kind === "select" && status.value ? status.value : undefined,
                );
              }}
              onReset={() => {
                accounts.setRoleFilter(undefined);
                accounts.setStatusFilter(undefined);
              }}
              searchValue=""
              onSearchChange={() => undefined}
              clearAllLabel={t.trade.clearFilters}
              filtersLabel={t.common.filter}
            />

            <DataTable
              columns={columns}
              rows={accounts.items}
              isLoading={accounts.isLoading}
              error={accounts.queryError}
              onRetry={() => void accounts.reload()}
              page={accounts.pageInfo}
              onPageChange={accounts.setPage}
              rowKey={(account) => account.id}
              labels={{
                retry: t.common.retry,
                errorTitle: t.trade.accountLoadFailed,
                emptyTitle: t.trade.accountEmpty,
                selectAll: t.common.actions,
                selectRow: t.common.actions,
                sortAscending: t.common.actions,
                sortDescending: t.common.actions,
                notSorted: t.common.actions,
                pagination: {
                  previous: t.common.previousPage,
                  next: t.common.nextPage,
                  summary: (from, to, total) =>
                    formatTemplate(t.common.showingOf, { from, to, total }),
                },
              }}
            />
          </>
        )}

        <CreateAccountDrawer
          key={accounts.createOpen ? "create-open" : "create-closed"}
          isOpen={accounts.createOpen}
          isSubmitting={accounts.isSubmitting}
          error={accounts.formError}
          onClose={accounts.closeCreate}
          onSubmit={accounts.create}
        />

        {accounts.editing ? (
          <EditAccountDrawer
            key={accounts.editing.id}
            account={accounts.editing}
            isSubmitting={accounts.isSubmitting}
            error={accounts.formError}
            onClose={accounts.closeEdit}
            onSubmit={accounts.update}
          />
        ) : null}
      </div>
    </PermissionGate>
  );
}
