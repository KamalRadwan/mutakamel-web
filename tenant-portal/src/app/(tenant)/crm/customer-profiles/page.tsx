"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import {
  BoardView,
  Button,
  CardView,
  ConfirmActionModal,
  DegradedBanner,
  EmptyState,
  PageHeader,
  PermissionGate,
  StageBar,
  TableView,
  PageActions,
  ViewSwitcher,
  useWorkspaceState,
  type BoardCardMove,
  type BoardColumnDef,
  type MoveToTarget,
  type WorkspaceViewLabels,
} from "@/design-system";
import { TenantBranchSelect } from "@/components/tenant/TenantBranchSelect";
import { useI18n } from "@/i18n/I18nContext";
import { formatTemplate } from "@/lib/format/template";
import {
  type CustomerProfileItem,
  type CustomerProfileStatus,
  useCustomerProfiles,
} from "./hooks/useCustomerProfiles";
import { CreateCustomerProfileModal } from "./components/CreateCustomerProfileModal";
import { CustomerProfileSearchBar } from "./components/CustomerProfileSearchBar";
import { useCustomerProfileColumns } from "./components/useCustomerProfileColumns";
import { useCustomerProfilesCapabilities } from "./hooks/useCustomerProfilesCapabilities";
import { useCreateCustomerProfile } from "./hooks/useCreateCustomerProfile";
import { useDeleteCustomerProfile } from "./hooks/useDeleteCustomerProfile";
import { useCrmCreateCustomFields } from "../shared/hooks/useCrmCreateCustomFields";
import { useCrmFieldMessages } from "../shared/hooks/useCrmFieldMessages";
import { useCustomerProfileBoardMove } from "./hooks/useCustomerProfileBoardMove";
import { useCustomerProfileCardSlots } from "./components/useCustomerProfileCardSlots";
import { crmCapabilityAllowsOwner } from "../shared/crm-capabilities";
import { useCrmAcquisitionSources } from "../shared/hooks/useCrmAcquisitionSources";
import { crmActivitySegments } from "../shared/crm-activity-tone";
import { CrmActivityDialog } from "../shared/components/CrmActivityDialog";
import {
  CUSTOMER_PROFILE_BOARD_STATUSES,
  useCustomerProfileBoard,
} from "./hooks/useCustomerProfileBoard";
import {
  customerProfileSearchValuesOf,
  customerProfileSearchWithField,
} from "./customer-profile-search-contract";

const BOARD_STATUS_ORDER: readonly CustomerProfileStatus[] =
  CUSTOMER_PROFILE_BOARD_STATUSES;
const TERMINAL_STATUS: CustomerProfileStatus = "BLACKLISTED";

export default function CustomerProfilesPage() {
  const { t } = useI18n();
  const {
    items,
    branchIds,
    branchId,
    selectBranch,
    pagination,
    search,
    appliedSearch,
    setSearch,
    submitSearch,
    isLoading,
    precondition,
    loadError,
    previousPage,
    nextPage,
    reload,
    setSort,
    sort,
    activeView,
    setActiveView,
    dataRevision,
  } = useCustomerProfiles();

  const { capabilities, error: capabilitiesError } =
    useCustomerProfilesCapabilities(branchId);

  const canUpdateProfile = useCallback(
    (item: CustomerProfileItem) =>
      crmCapabilityAllowsOwner(capabilities.update, item.ownerUserId),
    [capabilities.update],
  );

  const router = useRouter();

  const applyPage = useCallback(
    (target: number) => {
      if (target > (pagination?.page ?? 1)) nextPage();
      else previousPage();
    },
    [nextPage, pagination?.page, previousPage],
  );

  const applySort = useCallback(
    (next: { id: string; direction: "asc" | "desc" }) => setSort(next),
    [setSort],
  );

  const workspace = useWorkspaceState("customerProfiles", {
    defaultView: "board",
    onPageChange: applyPage,
    onSortChange: applySort,
  });
  const { view, setView } = workspace;

  useEffect(() => {
    const next = view === "table" ? "list" : view;
    if (activeView !== next) setActiveView(next);
  }, [activeView, setActiveView, view]);

  const board = useCustomerProfileBoard({
    enabled: view === "board",
    branchId,
    search: appliedSearch,
    sort,
    revision: dataRevision,
  });
  const { displayItems, handleCardMove } = useCustomerProfileBoardMove(
    board.items,
    reload,
    canUpdateProfile,
  );

  const [pendingTerminalMove, setPendingTerminalMove] = useState<{
    move: BoardCardMove;
    resolve: (confirmed: boolean) => void;
  } | null>(null);

  const [activityCustomer, setActivityCustomer] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [selectedForDelete, setSelectedForDelete] = useState<{
    id: string;
    name: string;
  } | null>(null);

  const {
    deleteProfile,
    isDeleting: isDeletingProfile,
    error: deleteError,
    clearError: clearDeleteError,
  } = useDeleteCustomerProfile();

  const moveTargets: MoveToTarget[] = useMemo(
    () =>
      BOARD_STATUS_ORDER.map((status) => ({
        id: status,
        label: t.statusValues[`CustomerStatus.${status}`] ?? status,
      })),
    [t],
  );

  const cardSlots = useCustomerProfileCardSlots({
    canUpdate: canUpdateProfile,
    canDelete: (item) => Boolean(capabilities.delete) && canUpdateProfile(item),
    onOpen: (item) => openProfile(item),
    onDelete: (item) => {
      clearDeleteError();
      setSelectedForDelete({ id: item.id, name: item.displayName });
    },
    onOpenActivities: (item) => {
      setActivityCustomer({ id: item.id, name: item.displayName });
    },
    moveTargets:
      view === "board"
        ? (item) => moveTargets.filter((target) => target.id !== item.status)
        : undefined,
    onMove: view === "board" ? (item, status) => {
      const move: BoardCardMove = {
        itemId: item.id,
        fromColumnId: item.status,
        toColumnId: status,
        toIndex: 0,
      };
      if (status === TERMINAL_STATUS) {
        setPendingTerminalMove({
          move,
          resolve: (confirmed) => {
            if (confirmed) {
              void handleCardMove(move);
            }
          },
        });
      } else {
        void handleCardMove(move);
      }
    } : undefined,
  });

  const boardColumns: BoardColumnDef[] = useMemo(
    () =>
      BOARD_STATUS_ORDER.map((status) => ({
        id: status,
        label: t.statusValues[`CustomerStatus.${status}`] ?? status,
        count: board.totals.get(status) ?? 0,
        outcomeRole:
          status === "ACTIVE_CUSTOMER"
            ? "positive"
            : status === "BLACKLISTED"
              ? "negative"
              : status === "INACTIVE"
                ? "caution"
                : undefined,
        segments: crmActivitySegments(
          displayItems
            .filter((item) => item.status === status)
            .map((item) => ({ nextActivity: item.nextActivity })),
          t.crmLeads.card.activityStates,
        ),
        segmentsLabel: t.crmLeads.card.activityBar,
      })),
    [board.totals, displayItems, t],
  );

  const sources = useCrmAcquisitionSources();
  const customFields = useCrmCreateCustomFields("CUSTOMER_PROFILE", true);
  const fieldMessages = useCrmFieldMessages();
  const create = useCreateCustomerProfile(
    branchId,
    fieldMessages,
    customFields.requiredFieldKeys,
    (profileId) => router.push(`/crm/customer-profiles/${profileId}`),
    reload,
  );
  const tableColumns = useCustomerProfileColumns({
    canDelete: (item) => Boolean(capabilities.delete) && canUpdateProfile(item),
    onDelete: (item) => {
      clearDeleteError();
      setSelectedForDelete({ id: item.id, name: item.displayName });
    },
    onOpenActivities: (item) => {
      setActivityCustomer({ id: item.id, name: item.displayName });
    },
  });

  const preconditionState = precondition ? <EmptyState title={precondition} /> : undefined;

  const viewLabels: WorkspaceViewLabels = {
    retry: t.common.retry,
    errorTitle: t.crmCustomerProfiles.loadFailed,
    emptyTitle: t.crmCustomerProfiles.empty,
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

  const pageInfo = {
    page: pagination?.page ?? 1,
    limit: pagination?.limit ?? 25,
    total: pagination?.total ?? 0,
  };

  function openProfile(item: CustomerProfileItem) {
    router.push(`/crm/customer-profiles/${encodeURIComponent(item.id)}`);
  }

  return (
    <PermissionGate require="crm.customer_profiles.read" scoped>
      <div className="flex h-full flex-col gap-4 overflow-hidden">
        {/* Preserve the accessible heading; actions render in the shell's action bar. */}
        <PageHeader
          className="sr-only"
          title={t.crm.customerProfilesAndCards}
          primaryAction={
            capabilities.create && branchId
              ? {
                  label: t.crmCustomerProfileActions.createAction,
                  onClick: create.openModal,
                }
              : undefined
          }
          secondaryActions={
            <>
              <TenantBranchSelect
                branchIds={branchIds}
                branchId={branchId}
                onChange={selectBranch}
                disabled={isLoading}
              />
              <Button size="sm" variant="outline" onClick={reload} disabled={isLoading}>
                <RefreshCw
                  className={`size-4 ${isLoading ? "animate-spin" : ""}`}
                  aria-hidden="true"
                />
                {t.common.retry}
              </Button>
            </>
          }
        />

        <CustomerProfileSearchBar
          value={search}
          onChange={setSearch}
          onSubmit={submitSearch}
          sources={sources.items}
          sourcesDegraded={sources.degraded}
          resetKey={branchId ?? "no-branch"}
          disabled={!branchId}
        />

        <PageActions slot="view">
          <ViewSwitcher
            value={view}
            onChange={setView}
            available={["board", "card", "table"]}
            labels={{ board: t.views.board, card: t.views.card, table: t.views.table }}
          />
        </PageActions>

        {capabilitiesError && (
          <DegradedBanner message={t.crmCustomerProfiles.capabilitiesUnavailable} />
        )}

        {view !== "board" && search.mode === "basic" && (
          <StageBar
            label={t.common.status}
            allLabel={t.crmCustomerProfiles.basicSearch.any}
            steps={BOARD_STATUS_ORDER.map((status) => ({
              id: status,
              label: t.statusValues[`CustomerStatus.${status}`] ?? status,
              tone:
                status === "ACTIVE_CUSTOMER"
                  ? "positive"
                  : status === "BLACKLISTED"
                    ? "negative"
                    : undefined,
            }))}
            value={customerProfileSearchValuesOf(search, "status")}
            onChange={(status: string | undefined) =>
              setSearch(
                customerProfileSearchWithField(
                  search,
                  "status",
                  status ?? "",
                ),
              )
            }
            disabled={!branchId}
          />
        )}

        <div className="min-h-0 flex-1">
          {view === "board" && (
            <BoardView
              columns={boardColumns}
              columnOf={(item) => item.status}
              items={displayItems}
              itemKey={(item) => item.id}
              renderCard={cardSlots.renderCard}
              renderActions={cardSlots.renderActions}
              renderFooter={cardSlots.renderFooter}
              cardClassName={cardSlots.cardClassName}
              canDrag={canUpdateProfile}
              confirmMove={(move) =>
                move.toColumnId === TERMINAL_STATUS
                  ? new Promise<boolean>((resolve) => setPendingTerminalMove({ move, resolve }))
                  : true
              }
              onCardMove={(move) => void handleCardMove(move)}
              onActivate={openProfile}
              onAddToColumn={
                capabilities.create && branchId ? () => create.openModal() : undefined
              }
              isLoading={board.isLoading}
              error={board.error}
              onRetry={() => void board.reload()}
              columnPage={(status) => ({
                hasMore: board.lanes[status]?.hasMore ?? false,
                isLoadingMore: board.loadingStatuses.has(status),
              })}
              onLoadMoreColumn={(status) => void board.loadMoreStatus(status)}
              emptyState={preconditionState}
              labels={{
                ...viewLabels,
                emptyColumn: t.crmCustomerProfiles.empty,
                moveTo: t.views.moveTo,
                collapseColumn: t.views.collapseColumn,
                expandColumn: t.views.expandColumn,
                addToColumn: t.crmCustomerProfileActions.createAction,
                loadMore: t.crmLeads.loadMore,
                loadingMore: t.crmLeads.loadingMore,
              }}
            />
          )}

          {view === "card" && (
            <CardView
              items={items}
              itemKey={(item) => item.id}
              renderCard={cardSlots.renderCardViewCard}
              renderActions={cardSlots.renderActions}
              renderFooter={cardSlots.renderCardViewFooter}
              cardClassName={cardSlots.cardClassName}
              density="compact"
              onActivate={openProfile}
              isLoading={isLoading}
              error={loadError}
              onRetry={reload}
              page={pageInfo}
              onPageChange={workspace.setPage}
              sort={workspace.sort}
              emptyState={preconditionState}
              labels={{ ...viewLabels, sortBy: t.views.sortBy }}
            />
          )}

          {view === "table" && (
            <TableView
              columns={tableColumns}
              density="compact"
              items={items}
              itemKey={(item) => item.id}
              onActivate={openProfile}
              selection={workspace.selection}
              isLoading={isLoading}
              error={loadError}
              onRetry={reload}
              page={pageInfo}
              onPageChange={workspace.setPage}
              sort={workspace.sort}
              onSortChange={workspace.setSort}
              emptyState={preconditionState}
              labels={viewLabels}
            />
          )}
        </div>

        <CreateCustomerProfileModal
          create={create}
          sources={sources.items}
          sourcesDegraded={sources.degraded}
          customFields={customFields}
        />

        <ConfirmActionModal
          open={pendingTerminalMove !== null}
          onOpenChange={(open) => {
            if (!open) {
              pendingTerminalMove?.resolve(false);
              setPendingTerminalMove(null);
            }
          }}
          title={t.crmCustomerProfiles.confirmBlacklistTitle}
          description={t.crmCustomerProfiles.confirmBlacklistMessage}
          confirmLabel={t.crmCustomerProfiles.confirmBlacklistAction}
          cancelLabel={t.common.cancel}
          onConfirm={() => {
            pendingTerminalMove?.resolve(true);
            setPendingTerminalMove(null);
          }}
        />

        <ConfirmActionModal
          open={selectedForDelete !== null}
          onOpenChange={(open) => {
            if (!open) {
              clearDeleteError();
              setSelectedForDelete(null);
            }
          }}
          title={t.crmCustomerProfileActions.deleteTitle}
          description={
            deleteError ??
            (selectedForDelete
              ? formatTemplate(t.crmCustomerProfileActions.deleteDescription, {
                  name: selectedForDelete.name,
                })
              : "")
          }
          confirmLabel={t.common.delete}
          cancelLabel={t.common.cancel}
          loading={isDeletingProfile}
          onConfirm={async () => {
            if (!selectedForDelete) return;
            if (await deleteProfile(selectedForDelete.id)) {
              setSelectedForDelete(null);
              void reload();
            }
          }}
        />

        <CrmActivityDialog
          key={`activity-${activityCustomer?.id ?? "closed"}`}
          target={
            activityCustomer
              ? {
                  id: activityCustomer.id,
                  name: activityCustomer.name,
                  targetType: "CUSTOMER_PROFILE",
                }
              : null
          }
          onClose={() => setActivityCustomer(null)}
          onCreated={reload}
        />
      </div>
    </PermissionGate>
  );
}
