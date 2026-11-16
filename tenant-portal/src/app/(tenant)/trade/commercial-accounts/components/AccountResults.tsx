"use client";

import Link from "next/link";
import { Eye, Pencil } from "lucide-react";
import { Badge, Button, DataTable, IdentifierText, Money, Pagination, cn, type ColumnDef } from "@/design-system";
import { formatDate } from "@/lib/format/date";
import { formatTemplate } from "@/lib/format/template";
import { TENANT_ROUTES } from "@/lib/navigation/tenant-routes";
import { ACCOUNT_KNOWN_STATUSES, isAccountRole, type CommercialAccount } from "../commercial-account-contract";
import { ACCOUNT_ROLE_PALETTES } from "../commercial-account-metadata";
import type { AccountWorkspace } from "../hooks/useAccountWorkspace";

export function AccountResults({ workspace }: { workspace: AccountWorkspace }) {
  const { t, accounts, filteredItems } = workspace;
  const roleBadge = (item: CommercialAccount) => <Badge size="compact" tone="neutral"
    className={cn("font-normal normal-case", isAccountRole(item.accountRole) && ACCOUNT_ROLE_PALETTES[item.accountRole].badgeClass)}>
    {isAccountRole(item.accountRole) ? t.trade[`accountRole_${item.accountRole}`] : <IdentifierText>{item.accountRole}</IdentifierText>}
  </Badge>;
  const statusBadge = (item: CommercialAccount) => <Badge size="compact"
    tone={item.status === "ACTIVE" ? "positive" : item.status === "BLOCKED" ? "negative" : "neutral"}
    className="font-normal normal-case">
    {(ACCOUNT_KNOWN_STATUSES as readonly string[]).includes(item.status)
      ? t.trade[`accountStatus_${item.status as "ACTIVE" | "BLOCKED"}`] : <IdentifierText>{item.status}</IdentifierText>}
  </Badge>;
  const partyLink = (item: CommercialAccount) => <Link
    href={`${TENANT_ROUTES.tradeCommercialAccounts}/${item.id}`} onClick={(event) => event.stopPropagation()}
    title={item.partyId} className="block min-w-0 max-w-72 truncate text-caption text-foreground hover:text-primary hover:underline">
    <IdentifierText>{item.partyId}</IdentifierText>
  </Link>;
  const actions = (item: CommercialAccount) => <div className="flex items-center justify-end gap-1">
    <Button variant="ghost" size="xs" className="size-7 p-0" aria-label={t.trade.accountDetailTitle} title={t.trade.accountDetailTitle}
      onClick={(event) => { event.stopPropagation(); workspace.setInspecting(item); }}>
      <Eye className="size-3.5" aria-hidden="true" />
    </Button>
    {workspace.canEdit && <Button variant="ghost" size="xs" className="size-7 p-0" aria-label={t.trade.accountEditTitle}
      title={t.trade.accountEditTitle} disabled={accounts.isSubmitting}
      onClick={(event) => { event.stopPropagation(); accounts.openEdit(item); }}>
      <Pencil className="size-3.5" aria-hidden="true" />
    </Button>}
  </div>;
  const pagination = { previous: t.common.previousPage, next: t.common.nextPage,
    summary: (from: number, to: number, total: number) => formatTemplate(t.common.showingOf, { from, to, total }) };
  const columns: ColumnDef<CommercialAccount>[] = [
    { id: "partyId", header: t.trade.accountParty, cell: partyLink },
    { id: "accountRole", header: t.trade.accountRole, width: "10rem", cell: roleBadge },
    { id: "creditLimit", header: t.trade.accountCreditLimit, numeric: true, width: "12rem", cell: (item) => item.creditLimit === null ? "—" :
      <Money value={item.creditLimit} currency={item.creditCurrencyCode ?? undefined} className="text-xs font-normal" /> },
    { id: "status", header: t.common.status, width: "7rem", cell: statusBadge },
    { id: "updatedAt", header: t.trade.updatedAt, width: "9rem", cell: (item) =>
      <span className="whitespace-nowrap text-caption text-muted-foreground">{formatDate(item.updatedAt, workspace.lang)}</span> },
    { id: "actions", header: t.common.actions, width: "6rem", align: "end", sticky: "end", cell: actions },
  ];
  if (workspace.viewMode === "table" || accounts.isLoading || accounts.queryError || filteredItems.length === 0) {
    return <div className="min-w-0 overflow-hidden rounded-lg border border-border bg-card">
      <DataTable surface="embedded" density="compact" showRowNumbers={false} columns={columns} rows={filteredItems}
        isLoading={accounts.isLoading} error={accounts.queryError} onRetry={() => void accounts.reload()}
        page={accounts.pageInfo} onPageChange={accounts.setPage} hideFirstLast
        rowKey={(item) => item.id} onRowClick={workspace.setInspecting}
        labels={{ retry: t.common.retry, errorTitle: t.trade.accountLoadFailed, emptyTitle: t.trade.accountEmpty,
          selectAll: t.views.selectAll, selectRow: t.views.selectRow, sortAscending: t.views.sortAscending,
          sortDescending: t.views.sortDescending, notSorted: t.views.notSorted, pagination }} />
    </div>;
  }
  return <div className="flex flex-col gap-2">
    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
      {filteredItems.map((item) => <article key={item.id} className="min-w-0 rounded-lg border border-border bg-card p-3">
        <div className="flex items-center justify-between gap-2">{roleBadge(item)}{statusBadge(item)}</div>
        <div className="mt-2">{partyLink(item)}</div>
        <div className="mt-2 flex items-center justify-between gap-2 border-t border-border pt-2">
          <span className="text-xs">{item.creditLimit === null ? "—" :
            <Money value={item.creditLimit} currency={item.creditCurrencyCode ?? undefined} />}</span>
          {actions(item)}
        </div>
      </article>)}
    </div>
    <Pagination page={accounts.pageInfo} onPageChange={accounts.setPage} labels={pagination} hideFirstLast />
  </div>;
}
