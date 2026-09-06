"use client";

import { useCallback, useState } from "react";
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
  TableView,
  ViewSwitcher,
  useWorkspaceState,
  type BoardCardMove,
  type BoardColumnDef,
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
import { CustomerProfileCard } from "./components/CustomerProfileCard";
import { CustomerProfileSearchBar } from "./components/CustomerProfileSearchBar";
import { useCustomerProfileColumns } from "./components/useCustomerProfileColumns";
import { useCustomerProfilesCapabilities } from "./hooks/useCustomerProfilesCapabilities";
import { useCreateCustomerProfile } from "./hooks/useCreateCustomerProfile";
import { useCrmCreateCustomFields } from "../shared/hooks/useCrmCreateCustomFields";
import { useCrmFieldMessages } from "../shared/hooks/useCrmFieldMessages";
import { useCustomerProfileBoardMove } from "./hooks/useCustomerProfileBoardMove";
import { crmCapabilityAllowsOwner } from "../shared/crm-capabilities";
import { useCrmAcquisitionSources } from "../shared/hooks/useCrmAcquisitionSources";

// Board axis is CustomerStatusEnum — fixed, 4 values, no catalogue fetch,
// unlike leads/opportunities. See
// docs/api/crm-customer-profiles.md#frontend-notes.
const BOARD_STATUS_ORDER: CustomerProfileStatus[] = ["PROSPECT", "ACTIVE_CUSTOMER", "INACTIVE", "BLACKLISTED"];
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
    setSearch,
    submitSearch,
    isLoading,
    precondition,
    loadError,
    previousPage,
    nextPage,
    reload,
    setSort,
  } = useCustomerProfiles();
  const { capabilities, error: capabilitiesError } =
    useCustomerProfilesCapabilities(branchId);
  // D7. `capabilities.update !== null` says the actor may update SOMETHING in
  // this branch, not that they may update THIS card. With `read.all +
  // update.own` that let a user drag a colleague's customer, watch the
  // optimistic move land, and watch the backend reject it a moment later. The
  // detail workspace has always asked the owner-aware question; the board asks
  // it too now, per card.
  const canUpdateProfile = useCallback(
    (item: CustomerProfileItem) =>
      crmCapabilityAllowsOwner(capabilities.update, item.ownerUserId),
    [capabilities.update],
  );
  const { displayItems, handleCardMove } = useCustomerProfileBoardMove(
    items,
    reload,
    // The same owner-aware question `canDrag` asks, enforced on the drop.
    canUpdateProfile,
  );
  const router = useRouter();
  // The Pagination control only ever steps by one, and this hook exposes
  // cursors rather than a page setter — so a page written to the URL is
  // applied here as the equivalent step.
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
    defaultView: "table",
    onPageChange: applyPage,
    onSortChange: applySort,
  });
  const { view, setView } = workspace;
  // BLACKLISTED is terminal in practice — confirms via a real modal, not
  // window.confirm. confirmMove needs a Promise<boolean>, so the pending
  // move sits in state until the user resolves it here.
  const [pendingTerminalMove, setPendingTerminalMove] = useState<{
    move: BoardCardMove;
    resolve: (confirmed: boolean) => void;
  } | null>(null);

  const boardColumns: BoardColumnDef[] = BOARD_STATUS_ORDER.map((status) => ({
    id: status,
    label: t.statusValues[`CustomerStatus.${status}`] ?? status,
    count: displayItems.filter((item) => item.status === status).length,
    outcomeRole: status === "ACTIVE_CUSTOMER" ? "positive" : status === "BLACKLISTED" ? "negative" : status === "INACTIVE" ? "caution" : undefined,
  }));

  const sources = useCrmAcquisitionSources();
  // Fetched with the screen rather than with the modal: the create hook needs
  // the required-field keys to build its validator, and the modal's open state
  // comes back OUT of that hook — gating the fetch on it would be a cycle. The
  // catalogue is small, tenant-wide and already cached by the browser.
  const customFields = useCrmCreateCustomFields("CUSTOMER_PROFILE", true);
  // A new profile opens on its own detail screen: the list defaults to page
  // one sorted by createdAt DESC, but a filter or a later page would hide the
  // record that was just created.
  const fieldMessages = useCrmFieldMessages();
  const create = useCreateCustomerProfile(
    branchId,
    fieldMessages,
    customFields.requiredFieldKeys,
    (profileId) => router.push(`/crm/customer-profiles/${profileId}`),
    // D2: a create whose response could not be read has still created the
    // record, so the list re-reads instead of leaving a Save to press again.
    reload,
  );
  const tableColumns = useCustomerProfileColumns();

  // No session or no single trusted branch means the request was never
  // made. That is an empty state next to the control that resolves it, not
  // an error banner about a failure that did not happen.
  const preconditionState = precondition ? <EmptyState title={precondition} /> : undefined;

  // One label set, three views — the shared contract, so a view switch cannot
  // silently drop a control the way it used to. See
  // docs/design/views.md#the-shared-contract.
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

  // A CRM route is reachable by direct URL even when the sidebar hides it, so
  // the 403 is reachable in-body and gets the mandated surface rather than a
  // load error — AGENTS.md, docs/design/states.md. Permission string and
  // scoping mirror CRM_ENTRY_ROUTES in src/lib/navigation/tenant-routes.ts.
  return (
    <PermissionGate require="crm.customer_profiles.read" scoped>
      <div className="flex h-full flex-col gap-4">
        <PageHeader
          title={t.crm.customerProfilesAndCards}
          description={t.crmCustomerProfiles.subtitle}
          primaryAction={
            capabilities.create && branchId
              ? {
                  label: t.crmCustomerProfileActions.createAction,
                  onClick: create.openModal,
                }
              : undefined
          }
          secondaryActions={
            <Button variant="outline" onClick={reload} disabled={isLoading}>
              <RefreshCw className={`size-4 ${isLoading ? "animate-spin" : ""}`} aria-hidden="true" />
              {t.common.retry}
            </Button>
          }
        />

        <div className="flex flex-wrap items-center justify-between gap-2">
          {/* Not a FilterBar: that pattern's chips carry a fixed vocabulary,
              and its own 300ms debounce sat on top of the hook's 300ms. It was
              called here with `filters={[]}` and no-op handlers — a bare search
              box. The bar below asks one equality filter as you type, or the
              whole filter tree `POST /customer-profiles/search` accepts, which
              runs only on its own Search button. */}
          <CustomerProfileSearchBar
            value={search}
            onChange={setSearch}
            onSubmit={submitSearch}
            sources={sources.items}
            disabled={!branchId}
          />
          <div className="flex items-center gap-2">
            <TenantBranchSelect branchIds={branchIds} branchId={branchId} onChange={selectBranch} disabled={isLoading} />
            <ViewSwitcher
              value={view}
              onChange={setView}
              available={["board", "card", "table"]}
              labels={{ board: t.views.board, card: t.views.card, table: t.views.table }}
            />
          </div>
        </div>

        {/* A capabilities fetch that FAILED is not the same as a 403, and the
            hook no longer conflates them — the controls are hidden either way,
            but only this case is a degradation worth naming. */}
        {capabilitiesError && <DegradedBanner message={t.crmCustomerProfiles.capabilitiesUnavailable} />}

        <div className="min-h-0 flex-1">
          {view === "board" && (
            <BoardView
              columns={boardColumns}
              columnOf={(item) => item.status}
              items={displayItems}
              itemKey={(item) => item.id}
              renderCard={(item) => <CustomerProfileCard item={item} />}
              canDrag={canUpdateProfile}
              confirmMove={(move) =>
                move.toColumnId === TERMINAL_STATUS
                  ? new Promise<boolean>((resolve) => setPendingTerminalMove({ move, resolve }))
                  : true
              }
              onCardMove={(move) => void handleCardMove(move)}
              onActivate={openProfile}
              selection={workspace.selection}
              isLoading={isLoading}
              error={loadError}
              onRetry={reload}
              page={pageInfo}
              onPageChange={workspace.setPage}
              emptyState={preconditionState}
              labels={{
                ...viewLabels,
                emptyColumn: t.crmCustomerProfiles.empty,
                moveTo: t.views.moveTo,
              }}
            />
          )}
          {view === "card" && (
            <CardView
              items={displayItems}
              itemKey={(item) => item.id}
              renderCard={(item) => <CustomerProfileCard item={item} />}
              onActivate={openProfile}
              selection={workspace.selection}
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
              items={displayItems}
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
      </div>
    </PermissionGate>
  );
}
