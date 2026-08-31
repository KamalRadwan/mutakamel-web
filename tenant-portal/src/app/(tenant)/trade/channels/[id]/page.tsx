"use client";

import { use } from "react";
import { Filter } from "lucide-react";
import {
  Badge,
  Button,
  DetailHeader,
  DetailSection,
  EmptyState,
  ErrorState,
  NotFoundState,
  PermissionGate,
  Skeleton,
  Switch,
} from "@/design-system";
import { formatDateTime } from "@/lib/format/date";
import { TENANT_ROUTES } from "@/lib/navigation/tenant-routes";
import { TradeScopeBar } from "../../TradeScopeBar";
import { TRADE_PERMISSIONS } from "../../trade-scope";
import { useChannelDetail } from "../hooks/useChannelDetail";
import { CHANNEL_KNOWN_STATUSES, isChannelType } from "../channel-contract";

export default function TradeChannelDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const detail = useChannelDetail(id);
  const { t, lang, channel } = detail;
  const isKnownStatus =
    channel !== null && (CHANNEL_KNOWN_STATUSES as readonly string[]).includes(channel.status);

  return (
    <PermissionGate require={TRADE_PERMISSIONS.itemsRead}>
      <div className="flex flex-col gap-4">
        <DetailHeader
          title={channel?.code ?? t.trade.channelsTitle}
          subtitle={channel?.name}
          backHref={TENANT_ROUTES.tradeChannels}
          backLabel={t.trade.backToChannels}
          status={
            channel ? (
              <Badge tone={isKnownStatus && channel.status === "ACTIVE" ? "positive" : "neutral"}>
                {isKnownStatus ? (
                  t.trade[`channelStatus_${channel.status as "ACTIVE" | "INACTIVE"}`]
                ) : (
                  <span className="font-mono">{channel.status}</span>
                )}
              </Badge>
            ) : null
          }
        />

        <TradeScopeBar />

        {detail.scopeGap ? (
          <EmptyState
            icon={Filter}
            title={t.trade.scopeRequiredTitle}
            description={t.trade.channelScopeRequiredDescription}
          />
        ) : detail.isLoading ? (
          <Skeleton className="h-64" />
        ) : detail.isGone ? (
          <NotFoundState
            title={t.trade.channelNotFoundTitle}
            description={t.trade.channelNotFoundDescription}
            backHref={TENANT_ROUTES.tradeChannels}
            backLabel={t.trade.backToChannels}
          />
        ) : detail.error || !channel ? (
          <ErrorState
            title={t.trade.channelLoadFailed}
            onRetry={detail.reload}
            retryLabel={t.common.retry}
          />
        ) : (
          <>
            <DetailSection
              title={t.trade.channelDetailTitle}
              emptyValueLabel="—"
              fields={[
                {
                  label: t.trade.channelCode,
                  value: <span className="font-mono">{channel.code}</span>,
                },
                { label: t.trade.channelName, value: channel.name },
                {
                  label: t.trade.channelType,
                  value: isChannelType(channel.channelType)
                    ? t.trade[`channelType_${channel.channelType}`]
                    : channel.channelType,
                },
                {
                  label: t.trade.version,
                  value: <span className="font-mono">{channel.version}</span>,
                },
                { label: t.trade.updatedAt, value: formatDateTime(channel.updatedAt, lang) },
              ]}
            />

            <DetailSection
              title={t.trade.channelBranchesTitle}
              description={t.trade.channelBranchesDescription}
              emptyValueLabel="—"
              action={
                detail.canManage && !detail.branchScopeGap ? (
                  <Button
                    variant="outline"
                    size="sm"
                    loading={detail.isSubmitting}
                    onClick={() =>
                      void detail.saveBranchMapping(!detail.selectedBranchMapping?.isActive)
                    }
                  >
                    {detail.selectedBranchMapping
                      ? t.trade.channelBranchActive
                      : t.trade.channelBranchAdd}
                  </Button>
                ) : null
              }
            >
              {detail.branchScopeGap ? (
                <p className="text-xs text-muted-foreground">
                  {t.trade.channelBranchScopeRequired}
                </p>
              ) : channel.branches.length === 0 ? (
                <p className="text-xs text-muted-foreground">{t.trade.channelBranchEmpty}</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {channel.branches.map((branch) => (
                    <li
                      key={branch.id}
                      className="flex items-center justify-between gap-3 rounded-sm border border-border p-2"
                    >
                      <span className="min-w-0 font-mono text-xs text-foreground">
                        {branch.branchId}
                      </span>
                      <span className="flex items-center gap-2">
                        <Badge tone={branch.isActive ? "positive" : "neutral"}>
                          {branch.isActive ? t.common.active : t.common.inactive}
                        </Badge>
                        {/* Only the branch in the operating context can be
                            changed: the service refuses any other branchId. */}
                        <Switch
                          checked={branch.isActive}
                          aria-label={t.trade.channelBranchActive}
                          disabled={
                            !detail.canManage ||
                            detail.isSubmitting ||
                            branch.branchId !== detail.selectedBranchId
                          }
                          onCheckedChange={(next) => void detail.saveBranchMapping(next)}
                        />
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </DetailSection>
          </>
        )}
      </div>
    </PermissionGate>
  );
}
