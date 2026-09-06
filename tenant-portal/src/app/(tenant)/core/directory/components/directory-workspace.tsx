"use client";

import { RefreshCw, Trash2 } from "lucide-react";
import {
  BoardView,
  Button,
  CardView,
  ConfirmActionModal,
  FilterBar,
  PageHeader,
  PermissionGate,
  SubNav,
  TableView,
  PageActions,
  ViewSwitcher,
  CORE_DIRECTORY_NAV_ITEMS,
  type BoardColumnDef,
  type FilterValue,
  type WorkspaceViewLabels,
} from "@/design-system";
import { formatTemplate } from "@/lib/format/template";
import {
  PARTY_READ_PERMISSION,
  PARTY_STATUSES,
  PARTY_TYPES,
  type Party,
  type PartyStatus,
} from "../directory-contract";
import { PARTY_ROLE_TYPES } from "../directory-children-contract";
import { useDirectoryParties } from "../hooks/useDirectoryParties";
import { PartyCard } from "./PartyCard";
import { CreatePartyDrawer } from "./CreatePartyDrawer";
import { useDirectoryColumns } from "./useDirectoryColumns";

export function DirectoryWorkspace() {
  const directory = useDirectoryParties();
  const {
    t,
    canManage,
    workspace,
    items,
    pageInfo,
    search,
    filters,
    isLoading,
    isRefreshing,
    queryError,
    pendingId,
    deleting,
  } = directory;
  const copy = t.coreOperations.directory;
  const columns = useDirectoryColumns();

  const viewLabels: WorkspaceViewLabels = {
    retry: t.common.retry,
    errorTitle: copy.loadFailed,
    emptyTitle: copy.empty,
    selectAll: t.views.selectAll,
    selectRow: t.views.selectItem,
    sortAscending: t.views.sortAscending,
    sortDescending: t.views.sortDescending,
    notSorted: t.views.notSorted,
    pagination: {
      previous: t.common.previousPage,
      next: t.common.nextPage,
      summary: (from, to, total) => formatTemplate(t.common.showingOf, { from, to, total }),
    },
  };

  // The grouping axis is `status` — the only party field a board move can
  // legitimately write, since `UpdatePartyDto` is the sole route that accepts it.
  const boardColumns: BoardColumnDef[] = PARTY_STATUSES.map((status) => ({
    id: status,
    label: copy.partyStatuses[status],
    count: items.filter((party) => party.status === status).length,
    outcomeRole: status === "BLOCKED" ? ("negative" as const) : undefined,
  }));

  const renderDeleteAction = (party: Party) =>
    canManage ? (
      <Button
        variant="ghost"
        size="xs"
        disabled={pendingId !== null}
        onClick={() => directory.openDelete(party)}
        aria-label={`${t.common.delete}: ${party.displayName}`}
      >
        <Trash2 className="size-3.5 text-destructive" aria-hidden="true" />
      </Button>
    ) : null;

  const sharedViewProps = {
    items,
    itemKey: (party: Party) => party.id,
    isLoading,
    error: queryError,
    onRetry: directory.reload,
    page: pageInfo,
    onPageChange: workspace.setPage,
    selection: workspace.selection,
    onActivate: directory.openParty,
  };

  return (
    <PermissionGate require={PARTY_READ_PERMISSION}>
      <div className="flex h-full flex-col gap-4">
        <PageHeader
          title={copy.listTitle}
          description={copy.listSubtitle}
          primaryAction={
            canManage ? { label: copy.partyCreate, onClick: directory.openCreate } : undefined
          }
          secondaryActions={
            <Button variant="outline" onClick={directory.reload} disabled={isRefreshing}>
              <RefreshCw
                className={isRefreshing ? "size-4 animate-spin" : "size-4"}
                aria-hidden="true"
              />
              {copy.reload}
            </Button>
          }
        />

        <SubNav items={CORE_DIRECTORY_NAV_ITEMS} />

        <FilterBar
          filters={[
            {
              id: "partyType",
              kind: "select",
              label: copy.columnType,
              placeholder: copy.anyValue,
              options: PARTY_TYPES.map((type) => ({
                value: type,
                label: copy.partyTypes[type],
              })),
            },
            {
              id: "status",
              kind: "select",
              label: t.common.status,
              placeholder: copy.anyValue,
              options: PARTY_STATUSES.map((status) => ({
                value: status,
                label: copy.partyStatuses[status],
              })),
            },
            {
              id: "roleType",
              kind: "select",
              label: copy.columnRoles,
              placeholder: copy.anyValue,
              options: PARTY_ROLE_TYPES.map((role) => ({
                value: role,
                label: copy.roleTypes[role],
              })),
            },
          ]}
          values={{
            ...(filters.partyType
              ? { partyType: { kind: "select" as const, value: filters.partyType } }
              : {}),
            ...(filters.status
              ? { status: { kind: "select" as const, value: filters.status } }
              : {}),
            ...(filters.roleType
              ? { roleType: { kind: "select" as const, value: filters.roleType } }
              : {}),
          }}
          onChange={(next) =>
            directory.setFilters({
              partyType: selected(next.partyType) as Party["partyType"] | undefined,
              status: selected(next.status) as PartyStatus | undefined,
              roleType: selected(next.roleType),
            })
          }
          onReset={() => directory.setFilters({})}
          searchValue={search}
          onSearchChange={directory.setSearch}
          searchPlaceholder={copy.searchPlaceholder}
          clearAllLabel={copy.clearFilters}
        filtersLabel={t.common.filter}
        />

        <PageActions slot="view">
          <ViewSwitcher
            value={workspace.view}
            onChange={workspace.setView}
            available={["board", "card", "table"]}
            labels={{ board: t.views.board, card: t.views.card, table: t.views.table }}
          />
        </PageActions>

        <div className="min-h-0 flex-1">
          {workspace.view === "board" && (
            <BoardView
              {...sharedViewProps}
              columns={boardColumns}
              columnOf={(party) => party.status}
              renderCard={(party) => <PartyCard party={party} />}
              renderActions={renderDeleteAction}
              canDrag={() => canManage && pendingId === null}
              onCardMove={(move) =>
                void directory.moveStatus(move.itemId, move.toColumnId as PartyStatus)
              }
              labels={{ ...viewLabels, emptyColumn: copy.emptyColumn, moveTo: t.views.moveTo }}
            />
          )}
          {workspace.view === "card" && (
            <CardView
              {...sharedViewProps}
              renderCard={(party) => <PartyCard party={party} />}
              renderActions={renderDeleteAction}
              sort={workspace.sort}
              onSortChange={workspace.setSort}
              sortOptions={[
                { id: "displayName", label: copy.columnName },
                { id: "updatedAt", label: copy.columnUpdated },
              ]}
              labels={{ ...viewLabels, sortBy: t.views.sortBy }}
            />
          )}
          {workspace.view === "table" && (
            <TableView
              {...sharedViewProps}
              columns={columns}
              sort={workspace.sort}
              onSortChange={workspace.setSort}
              labels={viewLabels}
            />
          )}
        </div>

        <CreatePartyDrawer
          isOpen={directory.isCreateOpen}
          onClose={directory.closeCreate}
          onSubmit={directory.create}
          isSubmitting={directory.isSubmitting}
          error={directory.formError}
        />

        <ConfirmActionModal
          open={deleting !== null}
          onOpenChange={(open) => {
            if (!open) directory.closeDelete();
          }}
          title={copy.partyDeleteTitle}
          description={
            deleting
              ? formatTemplate(copy.partyDeleteDescription, { name: deleting.displayName })
              : copy.partyDeleteTitle
          }
          confirmLabel={t.common.confirmDelete}
          cancelLabel={t.common.cancel}
          onConfirm={() => void directory.remove()}
          loading={pendingId !== null}
        />
      </div>
    </PermissionGate>
  );
}

function selected(value: FilterValue | undefined): string | undefined {
  return value?.kind === "select" && value.value ? value.value : undefined;
}
