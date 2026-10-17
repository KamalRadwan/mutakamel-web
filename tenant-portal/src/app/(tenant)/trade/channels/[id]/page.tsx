"use client";

import { use } from "react";
import {
  Building2,
  CheckCircle2,
  Filter,
  GitBranch,
  Lock,
  ShieldCheck,
  Store,
} from "lucide-react";
import {
  Badge,
  Button,
  DetailHeader,
  DetailSection,
  EmptyState,
  ErrorState,
  IdentifierText,
  NotFoundState,
  PermissionGate,
  Skeleton,
  Switch,
  SWATCH_SURFACE_PALETTES,
  cn,
} from "@/design-system";
import { formatDateTime } from "@/lib/format/date";
import { TENANT_ROUTES } from "@/lib/navigation/tenant-routes";
import { TradeScopeBar } from "../../TradeScopeBar";
import { TRADE_PERMISSIONS } from "../../trade-scope";
import { useChannelDetail } from "../hooks/useChannelDetail";
import { CHANNEL_KNOWN_STATUSES, isChannelType } from "../channel-contract";
import {
  CHANNEL_TYPE_PALETTES,
  CHANNEL_UI_COPY,
  getChannelPaletteText,
} from "../channel-catalogue-metadata";

export default function TradeChannelDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const detail = useChannelDetail(id);
  const { t, lang, channel } = detail;
  const copy = CHANNEL_UI_COPY[lang];
  const isKnownStatus =
    channel !== null && (CHANNEL_KNOWN_STATUSES as readonly string[]).includes(channel.status);

  const knownType =
    channel && isChannelType(channel.channelType) ? channel.channelType : "POS";
  const palette = CHANNEL_TYPE_PALETTES[knownType];
  const paletteText = getChannelPaletteText(palette, lang);

  const activeBranchesCount = channel
    ? channel.branches.filter((b) => b.isActive).length
    : 0;

  const greenSwatch = SWATCH_SURFACE_PALETTES.green;
  const blueSwatch = SWATCH_SURFACE_PALETTES.blue;
  const purpleSwatch = SWATCH_SURFACE_PALETTES.purple;

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
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-0.5 text-xs font-semibold",
                    palette.badgeClass,
                  )}
                >
                  <span className={cn("size-1.5 rounded-full", palette.dotClass)} />
                  {isChannelType(channel.channelType)
                    ? t.trade[`channelType_${channel.channelType}`]
                    : channel.channelType}
                </span>
                <Badge tone={isKnownStatus && channel.status === "ACTIVE" ? "positive" : "neutral"}>
                  {isKnownStatus ? (
                    t.trade[`channelStatus_${channel.status as "ACTIVE" | "INACTIVE"}`]
                  ) : (
                    <IdentifierText>{channel.status}</IdentifierText>
                  )}
                </Badge>
              </div>
            ) : null
          }
        />

        <TradeScopeBar hideWhenSingleScope />

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
            {/* Colorful Dossier KPI Strip */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div
                className={cn(
                  "relative overflow-hidden rounded-lg border bg-card p-3.5 shadow-xs",
                  palette.cardBorderClass,
                )}
              >
                <div className={cn("absolute inset-x-0 top-0 h-1", palette.topAccentClass)} />
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-muted-foreground">
                    {t.trade.channelType}
                  </span>
                  <span
                    className={cn(
                      "flex size-7 items-center justify-center rounded-md",
                      palette.iconBgClass,
                    )}
                  >
                    <Store className="size-4" aria-hidden="true" />
                  </span>
                </div>
                <p className="mt-2 text-base font-semibold text-foreground">
                  {isChannelType(channel.channelType)
                    ? t.trade[`channelType_${channel.channelType}`]
                    : channel.channelType}
                </p>
                <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                  {paletteText.description}
                </p>
              </div>

              <div
                className={cn(
                  "relative overflow-hidden rounded-lg border bg-card p-3.5 shadow-xs",
                  greenSwatch.sectionCard,
                )}
              >
                <div className={cn("absolute inset-x-0 top-0 h-1", greenSwatch.dot)} />
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-muted-foreground">
                    {copy.activeMappedBranches}
                  </span>
                  <span
                    className={cn(
                      "flex size-7 items-center justify-center rounded-md",
                      greenSwatch.iconBoxIdle,
                    )}
                  >
                    <CheckCircle2 className="size-4" aria-hidden="true" />
                  </span>
                </div>
                <p className={cn("mt-2 text-2xl font-semibold", greenSwatch.iconText)}>
                  {activeBranchesCount}{" "}
                  <span className="text-sm font-normal text-muted-foreground">
                    / {channel.branches.length}
                  </span>
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">{copy.branchesMappedSub}</p>
              </div>

              <div
                className={cn(
                  "relative overflow-hidden rounded-lg border bg-card p-3.5 shadow-xs",
                  blueSwatch.sectionCard,
                )}
              >
                <div className={cn("absolute inset-x-0 top-0 h-1", blueSwatch.dot)} />
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-muted-foreground">
                    {copy.currentOperatingBranch}
                  </span>
                  <span
                    className={cn(
                      "flex size-7 items-center justify-center rounded-md",
                      blueSwatch.iconBoxIdle,
                    )}
                  >
                    <Building2 className="size-4" aria-hidden="true" />
                  </span>
                </div>
                <p className="mt-2 truncate text-sm font-semibold text-foreground">
                  {detail.selectedBranchId ? (
                    <IdentifierText>{detail.selectedBranchId}</IdentifierText>
                  ) : (
                    copy.noBranchSelected
                  )}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {detail.selectedBranchMapping
                    ? detail.selectedBranchMapping.isActive
                      ? copy.activeInSelectedBranch
                      : copy.inactiveInSelectedBranch
                    : copy.notMappedToSelectedBranch}
                </p>
              </div>

              <div
                className={cn(
                  "relative overflow-hidden rounded-lg border bg-card p-3.5 shadow-xs",
                  purpleSwatch.sectionCard,
                )}
              >
                <div className={cn("absolute inset-x-0 top-0 h-1", purpleSwatch.dot)} />
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-muted-foreground">
                    {t.trade.version}
                  </span>
                  <span
                    className={cn(
                      "flex size-7 items-center justify-center rounded-md",
                      purpleSwatch.iconBoxIdle,
                    )}
                  >
                    <ShieldCheck className="size-4" aria-hidden="true" />
                  </span>
                </div>
                <p className="mt-2 text-xl font-semibold text-foreground">
                  <IdentifierText>v{channel.version}</IdentifierText>
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {formatDateTime(channel.updatedAt, lang)}
                </p>
              </div>
            </div>

            <DetailSection
              title={t.trade.channelDetailTitle}
              emptyValueLabel="—"
              fields={[
                {
                  label: t.trade.channelCode,
                  value: <IdentifierText>{channel.code}</IdentifierText>,
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
                  value: <IdentifierText>{channel.version}</IdentifierText>,
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
                  {channel.branches.map((branch) => {
                    const isContextBranch = branch.branchId === detail.selectedBranchId;
                    return (
                      <li
                        key={branch.id}
                        className={cn(
                          "flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3 transition-colors",
                          isContextBranch
                            ? "border-primary/40 bg-primary/5"
                            : "border-border bg-card",
                        )}
                      >
                        <div className="flex items-center gap-2.5">
                          <span
                            className={cn(
                              "flex size-7 items-center justify-center rounded-md",
                              isContextBranch
                                ? "bg-primary/15 text-primary"
                                : "bg-muted text-muted-foreground",
                            )}
                          >
                            <GitBranch className="size-3.5" aria-hidden="true" />
                          </span>
                          <div>
                            <div className="flex items-center gap-2">
                              <IdentifierText className="min-w-0 text-xs font-semibold text-foreground">
                                {branch.branchId}
                              </IdentifierText>
                              {isContextBranch ? (
                                <Badge tone="brand">{copy.activeScopeBadge}</Badge>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                                  <Lock className="size-3" aria-hidden="true" />
                                  {copy.otherBranchBadge}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {t.trade.version}: <IdentifierText>v{branch.version}</IdentifierText>{" "}
                              • {formatDateTime(branch.updatedAt, lang)}
                            </p>
                          </div>
                        </div>
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
                              !isContextBranch
                            }
                            onCheckedChange={(next) => void detail.saveBranchMapping(next)}
                          />
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </DetailSection>
          </>
        )}
      </div>
    </PermissionGate>
  );
}
