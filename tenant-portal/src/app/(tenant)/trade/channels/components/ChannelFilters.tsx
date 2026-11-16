"use client";

import { LayoutGrid, List, Search } from "lucide-react";
import { Button, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/design-system";
import { CHANNEL_TYPES, type ChannelType } from "../channel-contract";
import type { ChannelWorkspace } from "../hooks/useChannelWorkspace";

export function ChannelFilters({ workspace }: { workspace: ChannelWorkspace }) {
  const { t, copy } = workspace;
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card p-2">
      <div className="relative min-w-48 flex-1">
        <Search className="pointer-events-none absolute start-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <Input size="sm" value={workspace.searchQuery} onChange={(event) => workspace.setSearchQuery(event.target.value)}
          aria-label={copy.searchPlaceholder} placeholder={copy.searchPlaceholder} className="ps-8" />
      </div>
      <Select dir={workspace.dir} value={workspace.typeFilter} onValueChange={(value) => workspace.setTypeFilter(value as ChannelType | "ALL")}>
        <SelectTrigger size="sm" className="w-44 text-caption sm:text-caption" aria-label={t.trade.channelType}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="ALL">{copy.allTypes}</SelectItem>
          {CHANNEL_TYPES.map((type) => <SelectItem key={type} value={type}>{t.trade[`channelType_${type}`]}</SelectItem>)}
        </SelectContent>
      </Select>
      <Select dir={workspace.dir} value={workspace.statusFilter} onValueChange={(value) => workspace.setStatusFilter(value as "ALL" | "ACTIVE" | "INACTIVE")}>
        <SelectTrigger size="sm" className="w-36 text-caption sm:text-caption" aria-label={t.common.status}><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="ALL">{t.trade.statusAny}</SelectItem>
          <SelectItem value="ACTIVE">{t.trade.channelStatus_ACTIVE}</SelectItem>
          <SelectItem value="INACTIVE">{t.trade.channelStatus_INACTIVE}</SelectItem>
        </SelectContent>
      </Select>
      <div className="flex items-center gap-1 rounded-md border border-border p-0.5">
        <Button size="xs" variant={workspace.viewMode === "table" ? "secondary" : "ghost"}
          aria-pressed={workspace.viewMode === "table"} onClick={() => workspace.setViewMode("table")}>
          <List className="size-3.5" aria-hidden="true" />{copy.tableView}
        </Button>
        <Button size="xs" variant={workspace.viewMode === "cards" ? "secondary" : "ghost"}
          aria-pressed={workspace.viewMode === "cards"} onClick={() => workspace.setViewMode("cards")}>
          <LayoutGrid className="size-3.5" aria-hidden="true" />{copy.cardsView}
        </Button>
      </div>
    </div>
  );
}
