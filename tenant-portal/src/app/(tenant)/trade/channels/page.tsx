"use client";

import { CheckCircle2, Filter, Globe, Layers, RefreshCw, Store } from "lucide-react";
import { Button, ConflictDialog, EmptyState, IdentifierText, PageHeader, PermissionGate, SummaryStrip } from "@/design-system";
import { formatNumber } from "@/lib/format/number";
import { TradeScopeBar } from "../TradeScopeBar";
import { TRADE_PERMISSIONS } from "../trade-scope";
import { ChannelInspectModal, CreateChannelModal, EditChannelModal } from "./components/ChannelModals";
import { ChannelFilters } from "./components/ChannelFilters";
import { ChannelResults } from "./components/ChannelResults";
import { CHANNEL_TYPES } from "./channel-contract";
import { useChannelWorkspace } from "./hooks/useChannelWorkspace";

export default function TradeChannelsPage() {
  const workspace = useChannelWorkspace();
  const { t, lang, copy, channels, stats, inspecting, setInspecting } = workspace;
  const readiness = stats.total > 0
    ? `${formatNumber(stats.active / stats.total, lang, { style: "percent", maximumFractionDigits: 0 })} ${copy.operationalReadiness}`
    : copy.readyFirstChannel;
  return (
    <PermissionGate require={TRADE_PERMISSIONS.itemsRead}>
      <div className="flex min-w-0 flex-col gap-2.5">
        <PageHeader className="sr-only" title={t.trade.channelsTitle} description={t.trade.channelsSubtitle}
          primaryAction={channels.canManage && !channels.scopeGap ? { label: t.trade.channelCreate, onClick: channels.openCreate } : undefined}
          secondaryActions={<Button size="sm" variant="outline" onClick={() => void channels.reload()} disabled={channels.isRefreshing}>
            <RefreshCw className={channels.isRefreshing ? "size-4 animate-spin" : "size-4"} aria-hidden="true" />{t.trade.reload}
          </Button>} />
        {!channels.scopeGap && (
            <SummaryStrip items={[
              { label: copy.totalChannels, value: stats.total, description: copy.totalChannelsSub, icon: Store, hue: "indigo" },
              { label: copy.activeChannels, value: stats.active, description: readiness, icon: CheckCircle2, hue: "green" },
              { label: copy.typeCoverage, value: `${formatNumber(stats.types, lang)} / ${formatNumber(CHANNEL_TYPES.length, lang)}`, description: copy.typeCoverageSub, icon: Layers, hue: "blue" },
              { label: copy.digitalAutomated, value: stats.digital, description: copy.digitalAutomatedSub, icon: Globe, hue: "purple" },
            ]} />
        )}
        <TradeScopeBar hideWhenSingleScope />
        {channels.scopeGap ? (
          <EmptyState icon={Filter} title={t.trade.scopeRequiredTitle} description={t.trade.channelScopeRequiredDescription} />
        ) : (
          <>
            <ChannelFilters workspace={workspace} />
            <ChannelResults workspace={workspace} />
          </>
        )}

        <CreateChannelModal
          key={channels.createOpen ? "create-open" : "create-closed"}
          isOpen={channels.createOpen}
          isSubmitting={channels.isSubmitting}
          error={channels.formError}
          onClose={channels.closeCreate}
          onSubmit={channels.create}
          existingChannels={channels.items}
        />

        {channels.editing ? (
          <EditChannelModal
            key={channels.editing.id}
            channel={channels.editing}
            isSubmitting={channels.isSubmitting}
            error={channels.formError}
            onClose={channels.closeEdit}
            onSubmit={channels.update}
            existingChannels={channels.items}
          />
        ) : null}

        <ChannelInspectModal
          channel={inspecting}
          canManage={channels.canManage}
          onClose={() => setInspecting(null)}
          onEdit={(channel) => channels.openEdit(channel)}
        />

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
