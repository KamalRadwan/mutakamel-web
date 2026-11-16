"use client";

import { LayoutGrid, List } from "lucide-react";
import { Button, FilterBar } from "@/design-system";
import { ACCOUNT_KNOWN_STATUSES, ACCOUNT_ROLES } from "../commercial-account-contract";
import type { AccountWorkspace } from "../hooks/useAccountWorkspace";

export function AccountFilters({ workspace }: { workspace: AccountWorkspace }) {
  const { t } = workspace;
  return <FilterBar placement="inline" searchTextSize="compact"
    filters={[
      { id: "accountRole", kind: "select", label: t.trade.accountRole, placeholder: t.trade.statusAny,
        options: ACCOUNT_ROLES.map((role) => ({ value: role, label: t.trade[`accountRole_${role}`] })) },
      { id: "status", kind: "select", label: t.common.status, placeholder: t.trade.statusAny,
        options: ACCOUNT_KNOWN_STATUSES.map((status) => ({ value: status, label: t.trade[`accountStatus_${status}`] })) },
    ]}
    values={workspace.filterValues} onChange={workspace.changeFilters} onReset={workspace.resetFilters}
    searchValue={workspace.searchQuery} onSearchChange={workspace.setSearchQuery}
    clearAllLabel={t.trade.clearFilters} filtersLabel={t.common.filter}
    trailing={<div className="flex items-center gap-1 rounded-md border border-border p-0.5">
      <Button size="xs" variant={workspace.viewMode === "table" ? "secondary" : "ghost"}
        aria-pressed={workspace.viewMode === "table"} onClick={() => workspace.setViewMode("table")}>
        <List className="size-3.5" aria-hidden="true" />{workspace.copy.tableView}
      </Button>
      <Button size="xs" variant={workspace.viewMode === "cards" ? "secondary" : "ghost"}
        aria-pressed={workspace.viewMode === "cards"} onClick={() => workspace.setViewMode("cards")}>
        <LayoutGrid className="size-3.5" aria-hidden="true" />{workspace.copy.cardsView}
      </Button>
    </div>} />;
}
