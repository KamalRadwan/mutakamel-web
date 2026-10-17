"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  ExternalLink,
  Eye,
  Filter,
  Globe,
  LayoutGrid,
  Layers,
  List,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Store,
} from "lucide-react";
import {
  Badge,
  Button,
  ConflictDialog,
  DataTable,
  DegradedBanner,
  EmptyState,
  IdentifierText,
  Input,
  PageHeader,
  PermissionGate,
  SWATCH_SURFACE_PALETTES,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  cn,
  type ColumnDef,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatDate } from "@/lib/format/date";
import { formatTemplate } from "@/lib/format/template";
import { TENANT_ROUTES } from "@/lib/navigation/tenant-routes";
import { TradeScopeBar } from "../TradeScopeBar";
import { TRADE_PERMISSIONS } from "../trade-scope";
import {
  ChannelInspectModal,
  CreateChannelModal,
  EditChannelModal,
} from "./components/ChannelModals";
import { useChannels } from "./hooks/useChannels";
import {
  CHANNEL_KNOWN_STATUSES,
  CHANNEL_TYPES,
  isChannelType,
  type Channel,
  type ChannelType,
} from "./channel-contract";
import {
  CHANNEL_TYPE_PALETTES,
  CHANNEL_UI_COPY,
  getChannelPaletteText,
} from "./channel-catalogue-metadata";

function isKnownStatus(status: string): boolean {
  return (CHANNEL_KNOWN_STATUSES as readonly string[]).includes(status);
}

export default function TradeChannelsPage() {
  const { t, lang } = useI18n();
  const copy = CHANNEL_UI_COPY[lang];
  const channels = useChannels();

  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<ChannelType | "ALL">("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");
  const [viewMode, setViewMode] = useState<"table" | "cards">("table");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [inspecting, setInspecting] = useState<Channel | null>(null);

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return channels.items.filter((item) => {
      if (typeFilter !== "ALL" && item.channelType !== typeFilter) return false;
      if (statusFilter === "ACTIVE" && item.status !== "ACTIVE") return false;
      if (statusFilter === "INACTIVE" && item.status === "ACTIVE") return false;
      if (
        q.length > 0 &&
        !item.code.toLowerCase().includes(q) &&
        !item.name.toLowerCase().includes(q) &&
        !item.channelType.toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [channels.items, searchQuery, typeFilter, statusFilter]);

  const activeInspectorChannel = useMemo(() => {
    if (filteredItems.length === 0) return null;
    if (selectedId) {
      const found = filteredItems.find((c) => c.id === selectedId);
      if (found) return found;
    }
    return filteredItems[0] ?? null;
  }, [filteredItems, selectedId]);

  const kpiStats = useMemo(() => {
    const total = channels.items.length;
    const activeCount = channels.items.filter((c) => c.status === "ACTIVE").length;
    const distinctTypes = new Set(channels.items.map((c) => c.channelType)).size;
    const digitalCount = channels.items.filter((c) =>
      ["ECOMMERCE", "B2B_PORTAL", "MARKETPLACE", "API"].includes(c.channelType),
    ).length;
    return { total, activeCount, distinctTypes, digitalCount };
  }, [channels.items]);

  const columns: ColumnDef<Channel>[] = [
    {
      id: "code",
      header: t.trade.channelCode,
      cell: (channel) => {
        const known = isChannelType(channel.channelType) ? channel.channelType : "POS";
        const palette = CHANNEL_TYPE_PALETTES[known];
        return (
          <div className="flex items-center gap-2">
            <span className={cn("size-2 shrink-0 rounded-full", palette.dotClass)} />
            <Link
              href={`${TENANT_ROUTES.tradeChannels}/${channel.id}`}
              className="font-semibold text-foreground hover:text-primary hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              <IdentifierText>{channel.code}</IdentifierText>
            </Link>
          </div>
        );
      },
    },
    {
      id: "name",
      header: t.trade.channelName,
      cell: (channel) => (
        <Button
          type="button"
          variant="ghost"
          size="xs"
          onClick={() => setSelectedId(channel.id)}
          className="h-auto px-1 py-0.5 text-start font-medium text-foreground hover:text-primary"
        >
          {channel.name}
        </Button>
      ),
    },
    {
      id: "channelType",
      header: t.trade.channelType,
      cell: (channel) => {
        if (isChannelType(channel.channelType)) {
          const palette = CHANNEL_TYPE_PALETTES[channel.channelType];
          return (
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-semibold",
                palette.badgeClass,
              )}
            >
              <span className={cn("size-1.5 rounded-full", palette.dotClass)} />
              {t.trade[`channelType_${channel.channelType}`]}
            </span>
          );
        }
        return (
          <Badge tone="neutral">
            <IdentifierText>{channel.channelType}</IdentifierText>
          </Badge>
        );
      },
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
    {
      id: "actions",
      header: t.common.actions,
      align: "end" as const,
      sticky: "end" as const,
      width: "6.5rem",
      cell: (channel: Channel) => (
        <span className="flex items-center justify-end gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="xs"
                className="w-7 px-0"
                aria-label={t.trade.channelDetailTitle}
                onClick={() => setInspecting(channel)}
              >
                <Eye className="size-3.5" aria-hidden="true" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t.trade.channelDetailTitle}</TooltipContent>
          </Tooltip>
          {channels.canManage && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="xs"
                  className="w-7 px-0"
                  aria-label={t.trade.channelEditTitle}
                  disabled={channels.isSubmitting}
                  onClick={() => channels.openEdit(channel)}
                >
                  <Pencil className="size-3.5" aria-hidden="true" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t.trade.channelEditTitle}</TooltipContent>
            </Tooltip>
          )}
        </span>
      ),
    },
  ];

  const indigoSwatch = SWATCH_SURFACE_PALETTES.indigo;
  const greenSwatch = SWATCH_SURFACE_PALETTES.green;
  const blueSwatch = SWATCH_SURFACE_PALETTES.blue;
  const purpleSwatch = SWATCH_SURFACE_PALETTES.purple;

  return (
    <PermissionGate require={TRADE_PERMISSIONS.itemsRead}>
      <div className="flex flex-col gap-4">
        <PageHeader
          className="sr-only"
          title={t.trade.channelsTitle}
          description={t.trade.channelsSubtitle}
          primaryAction={
            channels.canManage && !channels.scopeGap
              ? { label: t.trade.channelCreate, onClick: channels.openCreate }
              : undefined
          }
          secondaryActions={
            <Button
              size="sm"
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

        <TradeScopeBar hideWhenSingleScope />

        {channels.scopeGap ? (
          <EmptyState
            icon={Filter}
            title={t.trade.scopeRequiredTitle}
            description={t.trade.channelScopeRequiredDescription}
          />
        ) : (
          <>
            {/* Executive Colorful KPI Strip */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div
                className={cn(
                  "relative overflow-hidden rounded-lg border bg-card p-3.5 shadow-xs",
                  indigoSwatch.sectionCard,
                )}
              >
                <div className={cn("absolute inset-x-0 top-0 h-1", indigoSwatch.dot)} />
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-muted-foreground">
                    {copy.totalChannels}
                  </span>
                  <span
                    className={cn(
                      "flex size-7 items-center justify-center rounded-md",
                      indigoSwatch.iconBoxIdle,
                    )}
                  >
                    <Store className="size-4" aria-hidden="true" />
                  </span>
                </div>
                <p className="mt-2 text-2xl font-semibold text-foreground">{kpiStats.total}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{copy.totalChannelsSub}</p>
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
                    {copy.activeChannels}
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
                  {kpiStats.activeCount}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {kpiStats.total > 0
                    ? `${Math.round((kpiStats.activeCount / kpiStats.total) * 100)}% ${copy.operationalReadiness}`
                    : copy.readyFirstChannel}
                </p>
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
                    {copy.typeCoverage}
                  </span>
                  <span
                    className={cn(
                      "flex size-7 items-center justify-center rounded-md",
                      blueSwatch.iconBoxIdle,
                    )}
                  >
                    <Layers className="size-4" aria-hidden="true" />
                  </span>
                </div>
                <p className="mt-2 text-2xl font-semibold text-foreground">
                  {kpiStats.distinctTypes}{" "}
                  <span className="text-sm font-normal text-muted-foreground">/ 7</span>
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">{copy.typeCoverageSub}</p>
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
                    {copy.digitalAutomated}
                  </span>
                  <span
                    className={cn(
                      "flex size-7 items-center justify-center rounded-md",
                      purpleSwatch.iconBoxIdle,
                    )}
                  >
                    <Globe className="size-4" aria-hidden="true" />
                  </span>
                </div>
                <p className="mt-2 text-2xl font-semibold text-foreground">
                  {kpiStats.digitalCount}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">{copy.digitalAutomatedSub}</p>
              </div>
            </div>

            {/* Not a failure — a persistent property of the route worth stating
                once, because every other Trade list on this page is paged. */}
            <DegradedBanner message={t.trade.channelUnpaged} />

            {/* Filter & View Switcher Ribbon */}
            <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="relative min-w-[220px] flex-1 sm:max-w-xs">
                  <Search
                    className="pointer-events-none absolute start-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <Input
                    size="sm"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={copy.searchPlaceholder}
                    className="ps-8"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {/* Status Filter */}
                  <div className="inline-flex rounded-md border border-border bg-muted/30 p-0.5">
                    {(["ALL", "ACTIVE", "INACTIVE"] as const).map((statusKey) => (
                      <Button
                        key={statusKey}
                        type="button"
                        size="xs"
                        variant={statusFilter === statusKey ? "outline" : "ghost"}
                        onClick={() => setStatusFilter(statusKey)}
                        className="text-xs font-medium"
                      >
                        {statusKey === "ALL" ? copy.all : t.trade[`channelStatus_${statusKey}`]}
                      </Button>
                    ))}
                  </div>

                  {/* Table / Bento Cards Switcher */}
                  <div className="inline-flex rounded-md border border-border bg-muted/30 p-0.5">
                    <Button
                      type="button"
                      size="xs"
                      variant={viewMode === "table" ? "outline" : "ghost"}
                      onClick={() => setViewMode("table")}
                      className="gap-1 text-xs font-medium"
                    >
                      <List className="size-3.5" aria-hidden="true" />
                      {copy.tableView}
                    </Button>
                    <Button
                      type="button"
                      size="xs"
                      variant={viewMode === "cards" ? "outline" : "ghost"}
                      onClick={() => setViewMode("cards")}
                      className="gap-1 text-xs font-medium"
                    >
                      <LayoutGrid className="size-3.5" aria-hidden="true" />
                      {copy.cardsView}
                    </Button>
                  </div>

                  {channels.canManage && (
                    <Button size="sm" variant="primary" onClick={channels.openCreate}>
                      <Plus className="size-3.5" aria-hidden="true" />
                      {t.trade.channelCreate}
                    </Button>
                  )}
                </div>
              </div>

              {/* 7-ChannelType Colorful Filter Pills */}
              <div className="flex flex-wrap items-center gap-1.5 border-t border-border/60 pt-2.5">
                <Button
                  type="button"
                  size="xs"
                  variant={typeFilter === "ALL" ? "primary" : "outline"}
                  onClick={() => setTypeFilter("ALL")}
                  className="text-xs font-semibold"
                >
                  {copy.allTypes} ({channels.items.length})
                </Button>
                {CHANNEL_TYPES.map((type) => {
                  const palette = CHANNEL_TYPE_PALETTES[type];
                  const count = channels.items.filter((c) => c.channelType === type).length;
                  const active = typeFilter === type;
                  return (
                    <Button
                      key={type}
                      type="button"
                      size="xs"
                      variant="outline"
                      onClick={() => setTypeFilter(active ? "ALL" : type)}
                      className={cn(
                        "gap-1.5 text-xs font-medium",
                        active && palette.badgeClass,
                      )}
                    >
                      <span className={cn("size-1.5 rounded-full", palette.dotClass)} />
                      <span>{t.trade[`channelType_${type}`]}</span>
                      <span className="opacity-70">({count})</span>
                    </Button>
                  );
                })}
              </div>
            </div>

            {/* Split Workspace: Primary List/Cards + 360° Live Channel Inspector */}
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
              <div className={cn(activeInspectorChannel ? "xl:col-span-8" : "xl:col-span-12")}>
                {viewMode === "table" ? (
                  <DataTable
                    density="compact"
                    columns={columns}
                    rows={filteredItems}
                    isLoading={channels.isLoading}
                    error={channels.queryError}
                    onRetry={() => void channels.reload()}
                    page={{
                      page: 1,
                      limit: Math.max(filteredItems.length, 1),
                      total: filteredItems.length,
                    }}
                    onPageChange={() => undefined}
                    rowKey={(channel) => channel.id}
                    onRowClick={(channel) => setSelectedId(channel.id)}
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
                ) : (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {filteredItems.map((channel) => {
                      const knownType = isChannelType(channel.channelType)
                        ? channel.channelType
                        : "POS";
                      const palette = CHANNEL_TYPE_PALETTES[knownType];
                      const isSelected = activeInspectorChannel?.id === channel.id;
                      return (
                        <div
                          key={channel.id}
                          onClick={() => setSelectedId(channel.id)}
                          className={cn(
                            "group relative cursor-pointer overflow-hidden rounded-lg border bg-card p-4 shadow-xs transition-all hover:shadow-md",
                            isSelected
                              ? cn("ring-2 ring-primary/30", palette.cardBorderClass)
                              : "border-border",
                          )}
                        >
                          <div
                            className={cn(
                              "absolute inset-x-0 top-0 h-1.5",
                              palette.topAccentClass,
                            )}
                          />
                          <div className="flex items-start justify-between gap-2 pt-1">
                            <div className="min-w-0">
                              <Link
                                href={`${TENANT_ROUTES.tradeChannels}/${channel.id}`}
                                onClick={(e) => e.stopPropagation()}
                                className="text-sm font-semibold text-foreground hover:text-primary hover:underline"
                              >
                                <IdentifierText>{channel.code}</IdentifierText>
                              </Link>
                              <p className="mt-0.5 truncate text-xs font-medium text-muted-foreground">
                                {channel.name}
                              </p>
                            </div>
                            <Badge tone={channel.status === "ACTIVE" ? "positive" : "neutral"}>
                              {isKnownStatus(channel.status)
                                ? t.trade[
                                    `channelStatus_${channel.status as "ACTIVE" | "INACTIVE"}`
                                  ]
                                : channel.status}
                            </Badge>
                          </div>

                          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-3">
                            <span
                              className={cn(
                                "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-semibold",
                                palette.badgeClass,
                              )}
                            >
                              <span className={cn("size-1.5 rounded-full", palette.dotClass)} />
                              {isChannelType(channel.channelType)
                                ? t.trade[`channelType_${channel.channelType}`]
                                : channel.channelType}
                            </span>

                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="xs"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setInspecting(channel);
                                }}
                              >
                                <Eye className="size-3.5" aria-hidden="true" />
                              </Button>
                              {channels.canManage && (
                                <Button
                                  variant="ghost"
                                  size="xs"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    channels.openEdit(channel);
                                  }}
                                >
                                  <Pencil className="size-3.5" aria-hidden="true" />
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Right-Side 360° Live Channel Inspector */}
              {activeInspectorChannel && (
                <aside className="xl:col-span-4">
                  {(() => {
                    const known = isChannelType(activeInspectorChannel.channelType)
                      ? activeInspectorChannel.channelType
                      : "POS";
                    const palette = CHANNEL_TYPE_PALETTES[known];
                    const paletteText = getChannelPaletteText(palette, lang);
                    return (
                      <div
                        className={cn(
                          "sticky top-4 overflow-hidden rounded-lg border bg-card p-4 shadow-xs",
                          palette.cardBorderClass,
                        )}
                      >
                        <div
                          className={cn(
                            "-mx-4 -mt-4 mb-3.5 h-1.5",
                            palette.topAccentClass,
                          )}
                        />
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                              {copy.inspectorTitle}
                            </span>
                            <h3 className="mt-0.5 text-sm font-semibold text-foreground">
                              <IdentifierText>{activeInspectorChannel.code}</IdentifierText>
                            </h3>
                            <p className="text-xs text-muted-foreground">
                              {activeInspectorChannel.name}
                            </p>
                          </div>
                          <Badge
                            tone={
                              activeInspectorChannel.status === "ACTIVE" ? "positive" : "neutral"
                            }
                          >
                            {isKnownStatus(activeInspectorChannel.status)
                              ? t.trade[
                                  `channelStatus_${
                                    activeInspectorChannel.status as "ACTIVE" | "INACTIVE"
                                  }`
                                ]
                              : activeInspectorChannel.status}
                          </Badge>
                        </div>

                        <div className="mt-3 rounded-md border border-border/80 bg-muted/25 p-2.5 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">{t.trade.channelType}</span>
                            <span
                              className={cn(
                                "inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-xs font-semibold",
                                palette.badgeClass,
                              )}
                            >
                              {isChannelType(activeInspectorChannel.channelType)
                                ? t.trade[`channelType_${activeInspectorChannel.channelType}`]
                                : activeInspectorChannel.channelType}
                            </span>
                          </div>
                          <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                            {paletteText.description}
                          </p>
                        </div>

                        <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
                          <div className="rounded-md border border-border/60 bg-card p-2">
                            <dt className="text-xs text-muted-foreground">{t.trade.version}</dt>
                            <dd className="mt-0.5 font-semibold text-foreground">
                              <IdentifierText>v{activeInspectorChannel.version}</IdentifierText>
                            </dd>
                          </div>
                          <div className="rounded-md border border-border/60 bg-card p-2">
                            <dt className="text-xs text-muted-foreground">{t.trade.updatedAt}</dt>
                            <dd className="mt-0.5 font-semibold text-foreground">
                              {formatDate(activeInspectorChannel.updatedAt, lang)}
                            </dd>
                          </div>
                        </dl>

                        <div className="mt-3.5 flex flex-wrap items-center gap-2 border-t border-border pt-3">
                          <Button asChild variant="outline" size="xs" className="flex-1">
                            <Link
                              href={`${TENANT_ROUTES.tradeChannels}/${activeInspectorChannel.id}`}
                            >
                              <ExternalLink className="size-3.5" aria-hidden="true" />
                              {copy.branchRolloutBtn}
                            </Link>
                          </Button>
                          {channels.canManage && (
                            <Button
                              variant="primary"
                              size="xs"
                              onClick={() => channels.openEdit(activeInspectorChannel)}
                            >
                              <Pencil className="size-3.5" aria-hidden="true" />
                              {t.trade.channelEditTitle}
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                </aside>
              )}
            </div>
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
