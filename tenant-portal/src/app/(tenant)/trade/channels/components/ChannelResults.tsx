"use client";

import Link from "next/link";
import { Eye, Pencil } from "lucide-react";
import { Badge, Button, DataTable, IdentifierText, cn, type ColumnDef } from "@/design-system";
import { formatDate } from "@/lib/format/date";
import { formatTemplate } from "@/lib/format/template";
import { TENANT_ROUTES } from "@/lib/navigation/tenant-routes";
import { CHANNEL_KNOWN_STATUSES, isChannelType, type Channel } from "../channel-contract";
import { CHANNEL_TYPE_PALETTES } from "../channel-catalogue-metadata";
import type { ChannelWorkspace } from "../hooks/useChannelWorkspace";

export function ChannelResults({ workspace }: { workspace: ChannelWorkspace }) {
  const { t, channels, filteredItems } = workspace;
  const typeBadge = (item: Channel) => (
    <Badge size="compact" tone="neutral" className={cn("font-normal normal-case",
      isChannelType(item.channelType) && CHANNEL_TYPE_PALETTES[item.channelType].badgeClass)}>
      {isChannelType(item.channelType) ? t.trade[`channelType_${item.channelType}`] : <IdentifierText>{item.channelType}</IdentifierText>}
    </Badge>
  );
  const statusBadge = (item: Channel) => (
    <Badge size="compact" tone={item.status === "ACTIVE" ? "positive" : "neutral"} className="font-normal normal-case">
      {(CHANNEL_KNOWN_STATUSES as readonly string[]).includes(item.status)
        ? t.trade[`channelStatus_${item.status as "ACTIVE" | "INACTIVE"}`] : <IdentifierText>{item.status}</IdentifierText>}
    </Badge>
  );
  const actions = (item: Channel) => (
    <div className="flex items-center justify-end gap-1">
      <Button variant="ghost" size="xs" className="size-7 p-0" aria-label={`${t.trade.channelDetailTitle}: ${item.name}`}
        title={t.trade.channelDetailTitle} onClick={(event) => { event.stopPropagation(); workspace.setInspecting(item); }}>
        <Eye className="size-3.5" aria-hidden="true" />
      </Button>
      {channels.canManage && <Button variant="ghost" size="xs" className="size-7 p-0"
        aria-label={`${t.trade.channelEditTitle}: ${item.name}`} title={t.trade.channelEditTitle}
        disabled={channels.isSubmitting} onClick={(event) => { event.stopPropagation(); channels.openEdit(item); }}>
        <Pencil className="size-3.5" aria-hidden="true" />
      </Button>}
    </div>
  );
  const columns: ColumnDef<Channel>[] = [
    { id: "name", header: t.trade.channelName, cell: (item) => (
      <Link href={`${TENANT_ROUTES.tradeChannels}/${item.id}`} onClick={(event) => event.stopPropagation()}
        className="block max-w-72 truncate text-xs font-medium text-foreground hover:text-primary hover:underline" title={item.name}>
        {item.name}
      </Link>
    ) },
    { id: "code", header: t.trade.channelCode, width: "14rem", cell: (item) =>
      <IdentifierText className="text-caption text-muted-foreground">{item.code}</IdentifierText> },
    { id: "channelType", header: t.trade.channelType, width: "13rem", cell: typeBadge },
    { id: "status", header: t.common.status, width: "7rem", cell: statusBadge },
    { id: "updatedAt", header: t.trade.updatedAt, width: "9rem", cell: (item) =>
      <span className="whitespace-nowrap text-caption text-muted-foreground">{formatDate(item.updatedAt, workspace.lang)}</span> },
    { id: "actions", header: t.common.actions, width: "6rem", align: "end", sticky: "end", cell: actions },
  ];
  if (workspace.viewMode === "table" || channels.isLoading || channels.queryError || filteredItems.length === 0) {
    return <div className="min-w-0 overflow-hidden rounded-lg border border-border bg-card">
      <DataTable surface="embedded" density="compact" columns={columns} rows={filteredItems} showRowNumbers={false}
      isLoading={channels.isLoading} error={channels.queryError} onRetry={() => void channels.reload()}
      rowKey={(item) => item.id} onRowClick={workspace.setInspecting}
      labels={{ retry: t.common.retry, errorTitle: t.trade.channelLoadFailed, emptyTitle: t.trade.channelEmpty,
        selectAll: t.views.selectAll, selectRow: t.views.selectRow, sortAscending: t.views.sortAscending,
        sortDescending: t.views.sortDescending, notSorted: t.views.notSorted,
        pagination: { previous: t.common.previousPage, next: t.common.nextPage,
          summary: (from, to, total) => formatTemplate(t.common.showingOf, { from, to, total }) } }} />
    </div>;
  }
  return (
    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
      {filteredItems.map((item) => (
        <article key={item.id} className="min-w-0 rounded-lg border border-border bg-card p-3">
          <div className="flex items-start justify-between gap-2">
            <Link href={`${TENANT_ROUTES.tradeChannels}/${item.id}`} className="min-w-0 truncate text-sm font-medium hover:text-primary hover:underline" title={item.name}>
              {item.name}
            </Link>
            {statusBadge(item)}
          </div>
          <IdentifierText className="mt-1 block text-caption text-muted-foreground">{item.code}</IdentifierText>
          <div className="mt-2 flex items-center justify-between gap-2 border-t border-border pt-2">
            {typeBadge(item)}{actions(item)}
          </div>
        </article>
      ))}
    </div>
  );
}
