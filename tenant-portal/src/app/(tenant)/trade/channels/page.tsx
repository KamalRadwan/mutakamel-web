"use client";

import Link from "next/link";
import { Filter, Pencil, RefreshCw } from "lucide-react";
import {
  Badge,
  Button,
  ConflictDialog,
  DataTable,
  DegradedBanner,
  EmptyState,
  IdentifierText,
  PageHeader,
  PermissionGate,
  SubNav,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TRADE_FOUNDATION_NAV_ITEMS,
  type ColumnDef,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatDate } from "@/lib/format/date";
import { formatTemplate } from "@/lib/format/template";
import { TENANT_ROUTES } from "@/lib/navigation/tenant-routes";
import { TradeScopeBar } from "../TradeScopeBar";
import { TRADE_PERMISSIONS } from "../trade-scope";
import { CreateChannelDrawer, EditChannelDrawer } from "./components/ChannelDrawers";
import { useChannels } from "./hooks/useChannels";
import { CHANNEL_KNOWN_STATUSES, isChannelType, type Channel } from "./channel-contract";

function isKnownStatus(status: string): boolean {
  return (CHANNEL_KNOWN_STATUSES as readonly string[]).includes(status);
}

export default function TradeChannelsPage() {
  const { t, lang } = useI18n();
  const channels = useChannels();

  const columns: ColumnDef<Channel>[] = [
    {
      id: "code",
      header: t.trade.channelCode,
      cell: (channel) => (
        <Link
          href={`${TENANT_ROUTES.tradeChannels}/${channel.id}`}
          className="font-medium text-foreground hover:underline"
        >
          <IdentifierText>{channel.code}</IdentifierText>
        </Link>
      ),
    },
    { id: "name", header: t.trade.channelName, cell: (channel) => channel.name },
    {
      id: "channelType",
      header: t.trade.channelType,
      cell: (channel) => (
        <Badge tone="neutral">
          {isChannelType(channel.channelType) ? (
            t.trade[`channelType_${channel.channelType}`]
          ) : (
            <IdentifierText>{channel.channelType}</IdentifierText>
          )}
        </Badge>
      ),
    },
    {
      id: "status",
      header: t.common.status,
      // The value set is open (Q31): a known member gets its label, anything
      // else renders neutral and monospace so a backend addition is visible.
      cell: (channel) =>
        isKnownStatus(channel.status) ? (
          <Badge tone={channel.status === "ACTIVE" ? "positive" : "neutral"}>
            {t.trade[`channelStatus_${channel.status as "ACTIVE" | "INACTIVE"}`]}
          </Badge>
        ) : (
          <Badge tone="neutral">
            <IdentifierText>{channel.status}</IdentifierText>
          </Badge>
        ),
    },
    {
      id: "updatedAt",
      header: t.trade.updatedAt,
      cell: (channel) => formatDate(channel.updatedAt, lang),
    },
    ...(channels.canManage
      ? [
          {
            id: "actions",
            header: t.common.actions,
            align: "end" as const,
            sticky: "end" as const,
            cell: (channel: Channel) => (
              <span className="flex items-center justify-end gap-1">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={t.trade.channelEditTitle}
                      disabled={channels.isSubmitting}
                      onClick={() => channels.openEdit(channel)}
                    >
                      <Pencil className="size-4" aria-hidden="true" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{t.trade.channelEditTitle}</TooltipContent>
                </Tooltip>
              </span>
            ),
          },
        ]
      : []),
  ];

  return (
    <PermissionGate require={TRADE_PERMISSIONS.itemsRead}>
      <div className="flex flex-col gap-4">
        <PageHeader
          title={t.trade.channelsTitle}
          description={t.trade.channelsSubtitle}
          primaryAction={
            channels.canManage && !channels.scopeGap
              ? { label: t.trade.channelCreate, onClick: channels.openCreate }
              : undefined
          }
          secondaryActions={
            <Button
              variant="outline"
              onClick={() => void channels.reload()}
              disabled={channels.isRefreshing}
            >
              <RefreshCw
                className={channels.isRefreshing ? "size-4 animate-spin" : "size-4"}
                aria-hidden="true"
              />
              {t.trade.reload}
            </Button>
          }
        />

        <SubNav items={TRADE_FOUNDATION_NAV_ITEMS} />

        <TradeScopeBar />

        {channels.scopeGap ? (
          <EmptyState
            icon={Filter}
            title={t.trade.scopeRequiredTitle}
            description={t.trade.channelScopeRequiredDescription}
          />
        ) : (
          <>
            {/* Not a failure — a persistent property of the route worth stating
                once, because every other Trade list on this page is paged. */}
            <DegradedBanner message={t.trade.channelUnpaged} />

            <DataTable
              columns={columns}
              rows={channels.items}
              isLoading={channels.isLoading}
              error={channels.queryError}
              onRetry={() => void channels.reload()}
              page={channels.pageInfo}
              onPageChange={() => undefined}
              rowKey={(channel) => channel.id}
              labels={{
                retry: t.common.retry,
                errorTitle: t.trade.channelLoadFailed,
                emptyTitle: t.trade.channelEmpty,
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

        <CreateChannelDrawer
          key={channels.createOpen ? "create-open" : "create-closed"}
          isOpen={channels.createOpen}
          isSubmitting={channels.isSubmitting}
          error={channels.formError}
          onClose={channels.closeCreate}
          onSubmit={channels.create}
        />

        {channels.editing ? (
          <EditChannelDrawer
            key={channels.editing.id}
            channel={channels.editing}
            isSubmitting={channels.isSubmitting}
            error={channels.formError}
            onClose={channels.closeEdit}
            onSubmit={channels.update}
          />
        ) : null}

        <ConflictDialog
          open={channels.conflict !== null}
          onOpenChange={(open) => {
            if (!open) channels.dismissConflict();
          }}
          title={t.trade.conflictTitle}
          description={t.trade.conflictDescription}
          theirChanges={
            channels.conflict ? (
              <span className="block text-xs">
                {channels.conflict.name}
                <IdentifierText className="ms-2 text-muted-foreground">
                  v{channels.conflict.version}
                </IdentifierText>
              </span>
            ) : null
          }
          onReload={channels.resolveConflict}
          onCancel={channels.dismissConflict}
          labels={{
            yourChanges: t.trade.conflictYours,
            theirChanges: t.trade.conflictTheirs,
            reload: t.trade.conflictReload,
            overwrite: t.trade.conflictReload,
            cancel: t.common.cancel,
          }}
        />
      </div>
    </PermissionGate>
  );
}
