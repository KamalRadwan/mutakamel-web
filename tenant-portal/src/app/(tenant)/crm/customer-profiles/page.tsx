"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, RefreshCw } from "lucide-react";
import {
  Button,
  ConfirmActionModal,
  DegradedBanner,
  EmptyState,
  PageActions,
  PageHeader,
  PermissionGate,
  ViewSwitcher,
  useWorkspaceState,
  type BoardCardMove,
} from "@/design-system";
import { useAccessMode } from "@/hooks/useAccessMode";
import { ActivitiesWorkspaceLink } from "@/components/activities/ActivitiesWorkspaceLink";
import { ActivityModal } from "@/components/activities/ActivityModal";
import type { ActivityTargetSelection } from "@/components/activities/activity-contract";
import { TenantBranchSelect } from "@/components/tenant/TenantBranchSelect";
import { useI18n } from "@/i18n/I18nContext";
import { formatTemplate } from "@/lib/format/template";
import { crmCapabilityAllowsOwner } from "../shared/crm-capabilities";
import { useCrmAcquisitionSources } from "../shared/hooks/useCrmAcquisitionSources";
import { useCrmCreateCustomFields } from "../shared/hooks/useCrmCreateCustomFields";
import { useCrmFieldMessages } from "../shared/hooks/useCrmFieldMessages";
import { usePartyDocumentCounts } from "../shared/hooks/usePartyDocumentCounts";
import type { CustomerProfileCardPatch } from "./customer-profile-card-contract";
import {
  customerProfileSearchValuesOf,
  customerProfileSearchWithField,
} from "./customer-profile-search-contract";
import { CreateCustomerProfileModal } from "./components/CreateCustomerProfileModal";
import {
  CustomerExecutiveBoardView,
  type QuickCreateCustomerDraft,
} from "./components/CustomerExecutiveBoardView";
import { CustomerExecutiveCardView } from "./components/CustomerExecutiveCardView";
import { CustomerExecutiveTableView } from "./components/CustomerExecutiveTableView";
import { CustomerProfileBulkActionsBar } from "./components/CustomerProfileBulkActionsBar";
import { CustomerProfileSearchBar } from "./components/CustomerProfileSearchBar";
import { CustomerProfileStatusFunnelBar } from "./components/CustomerProfileStatusFunnelBar";
import { CustomerQuickEditModal } from "./components/CustomerQuickEditModal";
import { useCreateCustomerProfile } from "./hooks/useCreateCustomerProfile";
import { useCustomerProfileBoard } from "./hooks/useCustomerProfileBoard";
import { useCustomerProfileBoardMove } from "./hooks/useCustomerProfileBoardMove";
import {
  type CustomerProfileItem,
  type CustomerProfileStatus,
  useCustomerProfiles,
} from "./hooks/useCustomerProfiles";
import { useCustomerProfilesCapabilities } from "./hooks/useCustomerProfilesCapabilities";
import { useDeleteCustomerProfile } from "./hooks/useDeleteCustomerProfile";
import { useUpdateCustomerProfileCard } from "./hooks/useUpdateCustomerProfileCard";
import type { StatusUpdateResult } from "./hooks/useUpdateCustomerProfileStatus";
import { CrmScopeGate } from "../shared/components/CrmScopeGate";
import { useCrmErrorText } from "../shared/hooks/useCrmErrorText";

const TERMINAL_STATUS: CustomerProfileStatus = "BLACKLISTED";

export default function CustomerProfilesPage() {
  const { t } = useI18n();
  const describeError = useCrmErrorText();
  const router = useRouter();
  const { canMutate } = useAccessMode();
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
    applyCardFields: applyListCardFields,
  } = useCustomerProfiles();

  const { capabilities, error: capabilitiesError } =
    useCustomerProfilesCapabilities(branchId);

  const canUpdateProfile = useCallback(
    (item: CustomerProfileItem) =>
      canMutate && crmCapabilityAllowsOwner(capabilities.update, item.ownerUserId),
    [canMutate, capabilities.update],
  );
  const canDeleteProfile = useCallback(
    (item: CustomerProfileItem) =>
      canMutate && crmCapabilityAllowsOwner(capabilities.delete, item.ownerUserId),
    [canMutate, capabilities.delete],
  );

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
    totalsEnabled: view !== "board" && appliedSearch.mode === "basic",
    branchId,
    search: appliedSearch,
    sort,
    revision: dataRevision,
  });

  const activeItemsSource = view === "board" ? board.items : items;
  const { displayItems, handleCardMove } = useCustomerProfileBoardMove(
    activeItemsSource,
    reload,
    canUpdateProfile,
  );

  const applyBoardCardFields = board.applyCardFields;
  const applyCardFields = useCallback(
    (profileId: string, patch: CustomerProfileCardPatch) => {
      applyListCardFields(profileId, patch);
      applyBoardCardFields(profileId, patch);
    },
    [applyBoardCardFields, applyListCardFields],
  );

  const reconcileCards = useCallback(() => reload(), [reload]);
  const { updateCard } = useUpdateCustomerProfileCard({
    branchId,
    canUpdate: canUpdateProfile,
    applyCardFields,
    reconcile: reconcileCards,
  });

  const documentCounts = usePartyDocumentCounts(
    displayItems,
    branchId,
    Boolean(branchId) && (view === "card" || view === "board"),
  );

  const [quickEditCustomer, setQuickEditCustomer] =
    useState<CustomerProfileItem | null>(null);
  const [pendingTerminalMove, setPendingTerminalMove] = useState<{
    move: BoardCardMove;
    resolve: (confirmed: boolean) => void;
  } | null>(null);
  const [activityCustomer, setActivityCustomer] =
    useState<ActivityTargetSelection | null>(null);
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

  const visibleItems = displayItems;

  const selectedItems = useMemo(
    () =>
      visibleItems.filter((item) =>
        workspace.selection.selectedIds.has(item.id),
      ),
    [visibleItems, workspace.selection.selectedIds],
  );

  const requestMoveCustomerStatus = useCallback(
    async (move: BoardCardMove): Promise<StatusUpdateResult | null> => {
      const targetStatus = move.toColumnId as CustomerProfileStatus;
      const applyMove = async () => {
        const result = await handleCardMove(move);
        if (result.ok) {
          setQuickEditCustomer((prev) =>
            prev && prev.id === move.itemId
              ? { ...prev, status: targetStatus }
              : prev,
          );
        }
        return result;
      };
      if (targetStatus === TERMINAL_STATUS) {
        const confirmed = await new Promise<boolean>((resolve) => {
          setPendingTerminalMove({ move, resolve });
        });
        if (!confirmed) return null;
      }
      return applyMove();
    },
    [handleCardMove],
  );

  const handleMoveStatus = useCallback(
    (item: CustomerProfileItem, status: CustomerProfileStatus) => {
      if (item.status === status) return Promise.resolve(null);
      return requestMoveCustomerStatus({
        itemId: item.id,
        fromColumnId: item.status,
        toColumnId: status,
        toIndex: 0,
      });
    },
    [requestMoveCustomerStatus],
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

  const openCreateWithStatus = useCallback(
    (status?: CustomerProfileStatus, draft?: QuickCreateCustomerDraft) => {
      create.openModal();
      if (status) {
        create.setField("status", status);
      }
      if (draft) {
        create.setProfileType(draft.profileType);
        create.setField("status", draft.status);
        if (draft.acquisitionSourceId) {
          create.setField("acquisitionSourceId", draft.acquisitionSourceId);
        }
        if (draft.profileType === "INDIVIDUAL") {
          create.setField("firstName", draft.firstName);
          create.setField("lastName", draft.lastName);
          draft.phones.forEach((ph, idx) => {
            if (idx > 0) create.addPhone("phones");
            create.setPhone("phones", idx, ph);
          });
        } else {
          create.setField("companyName", draft.companyName);
          draft.companyPhones.forEach((ph, idx) => {
            if (idx > 0) create.addPhone("companyPhones");
            create.setPhone("companyPhones", idx, ph);
          });
          const fullName = [
            draft.contactFirstName.trim(),
            draft.contactLastName.trim(),
          ]
            .filter(Boolean)
            .join(" ");
          create.updateContact(0, {
            firstName: draft.contactFirstName,
            lastName: draft.contactLastName,
            fullName,
          });
          draft.contactPhones.forEach((ph, idx) => {
            if (idx > 0) create.addContactPhone(0);
            create.setContactPhone(0, idx, ph);
          });
        }
      }
    },
    [create],
  );

  const openProfile = useCallback(
    (item: CustomerProfileItem) => {
      router.push(`/crm/customer-profiles/${encodeURIComponent(item.id)}`);
    },
    [router],
  );

  const openActivities = useCallback((item: CustomerProfileItem) => {
    setActivityCustomer({
      app: "CRM",
      type: "CUSTOMER_PROFILE",
      id: item.id,
      label: item.displayName,
    });
  }, []);

  const promptDeleteCustomer = useCallback(
    (item: CustomerProfileItem) => {
      clearDeleteError();
      setSelectedForDelete({ id: item.id, name: item.displayName });
    },
    [clearDeleteError],
  );

  const pageInfo = {
    page: pagination?.page ?? 1,
    limit: pagination?.limit ?? 25,
    total: pagination?.total ?? 0,
  };

  const activeStatusFilter = useMemo<CustomerProfileStatus | null>(() => {
    if (search.mode !== "basic") return null;
    const raw = customerProfileSearchValuesOf(search, "status");
    return (raw[0] as CustomerProfileStatus | undefined) ?? null;
  }, [search]);

  return (
    <PermissionGate require="crm.customer_profiles.read" scoped>
      <div className="flex h-full flex-col gap-3 overflow-hidden">
        {/* Preserve the accessible heading; actions render in the shell's top action bar. */}
        <PageHeader
          className="sr-only"
          title={t.crm.customerProfilesAndCards}
          primaryAction={
            canMutate && capabilities.create && branchId
              ? {
                  label: t.crmCustomerProfileActions.createAction,
                  icon: <Plus className="size-4" aria-hidden="true" />,
                  onClick: () => openCreateWithStatus(),
                }
              : undefined
          }
          secondaryActions={
            <div className="flex flex-wrap items-center gap-2">
              <TenantBranchSelect
                branchIds={branchIds}
                branchId={branchId}
                onChange={selectBranch}
                disabled={isLoading}
              />
              <Button
                size="sm"
                variant="outline"
                onClick={reload}
                disabled={isLoading}
              >
                <RefreshCw
                  className={`size-4 ${isLoading ? "animate-spin" : ""}`}
                  aria-hidden="true"
                />
                {t.common.retry}
              </Button>
            </div>
          }
        />

        {/* Search & Advanced Filter Tree Command Bar */}
        <CustomerProfileSearchBar
          value={search}
          onChange={setSearch}
          onSubmit={submitSearch}
          sources={sources.items}
          sourcesDegraded={sources.degraded}
          resetKey={branchId ?? "no-branch"}
          disabled={!branchId}
        />

        {/* Full-Width Status Funnel Ribbon for Card & Table Views */}
        {view !== "board" && search.mode === "basic" && (
          <CustomerProfileStatusFunnelBar
            statusTotals={board.totals}
            activeStatus={activeStatusFilter}
            onSelect={(status) =>
              setSearch(
                customerProfileSearchWithField(search, "status", status ?? ""),
              )
            }
            disabled={!branchId}
          />
        )}

        {/* Floating Dark Bottom Bulk Action Command Bar */}
        {view !== "board" && selectedItems.length > 0 && (
          <CustomerProfileBulkActionsBar
            allowedOwnerIds={
              capabilities.update ? capabilities.update.ownerUserIds : []
            }
            selectedItems={selectedItems}
            totalAvailable={visibleItems.length}
            branchId={branchId}
            canUpdate={canUpdateProfile}
            canDelete={canDeleteProfile}
            onSelectAll={() =>
              workspace.selection.onSelectionChange(
                new Set(visibleItems.map((item) => item.id)),
              )
            }
            onClearSelection={() =>
              workspace.selection.onSelectionChange(new Set())
            }
            onScheduleActivity={openActivities}
            onCompleted={(succeededIds) => {
              const succeeded = new Set(succeededIds);
              workspace.selection.onSelectionChange(
                new Set(
                  [...workspace.selection.selectedIds].filter((id) => !succeeded.has(id)),
                ),
              );
              void reload();
            }}
          />
        )}

        <PageActions slot="view">
          <ViewSwitcher
            value={view}
            onChange={setView}
            available={["board", "card", "table"]}
            labels={{
              board: t.views.board,
              card: t.views.card,
              table: t.views.table,
            }}
          />
          <ActivitiesWorkspaceLink type="CUSTOMER_PROFILE" />
        </PageActions>

        {capabilitiesError && (
          <DegradedBanner
            message={t.crmCustomerProfiles.capabilitiesUnavailable}
          />
        )}
        {view === "board" && board.loadMoreError && (
          <DegradedBanner message={t.crmCustomerProfiles.loadMoreFailed} />
        )}

        {((loadError && loadError.status !== 403) ||
          (view === "board" && board.error && board.error.status !== 403)) && (
          <div
            role="alert"
            className="flex flex-wrap items-center justify-between gap-3 rounded-sm border border-destructive bg-destructive-subtle p-2.5 text-xs text-destructive-subtle-foreground"
          >
            <span>
              {describeError((view === "board" ? board.error : null) ?? loadError) ??
                t.crmCustomerProfiles.loadFailed}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                view === "board" ? void board.reload() : void reload()
              }
            >
              {t.common.retry}
            </Button>
          </div>
        )}

        <div className="flex min-h-0 flex-1 flex-col">
          {loadError?.status === 403 || (view === "board" && board.error?.status === 403) ? (
            <CrmScopeGate />
          ) : precondition ? (
            <EmptyState title={precondition} />
          ) : (
            <>
              {view === "board" && (
                <CustomerExecutiveBoardView
                  items={visibleItems}
                  statusTotals={board.totals}
                  lanes={board.lanes}
                  loadingStatuses={board.loadingStatuses}
                  onLoadMoreStatus={(status) => void board.loadMoreStatus(status)}
                  branchId={branchId}
                  sources={sources.items}
                  canCreate={Boolean(canMutate && capabilities.create && branchId)}
                  canUpdate={canUpdateProfile}
                  canDelete={canDeleteProfile}
                  onOpen={openProfile}
                  onOpenQuickModal={setQuickEditCustomer}
                  onOpenFullCreate={openCreateWithStatus}
                  onDelete={promptDeleteCustomer}
                  onOpenActivities={canMutate ? openActivities : undefined}
                  onCardChange={(item, patch) => void updateCard(item, patch)}
                  onCardMove={requestMoveCustomerStatus}
                  onRefreshBoard={() => void reload()}
                  documentCountsByParty={documentCounts.countsByParty}
                  documentCountVisibility={documentCounts.visible}
                />
              )}

              {view === "card" && (
                <CustomerExecutiveCardView
                  items={visibleItems}
                  selectedIds={workspace.selection.selectedIds}
                  onSelectionChange={workspace.selection.onSelectionChange}
                  canUpdate={canUpdateProfile}
                  canDelete={canDeleteProfile}
                  onOpen={openProfile}
                  onOpenQuickModal={setQuickEditCustomer}
                  onDelete={promptDeleteCustomer}
                  onOpenActivities={canMutate ? openActivities : undefined}
                  onCardChange={(item, patch) => void updateCard(item, patch)}
                  onMoveStatus={handleMoveStatus}
                  documentCountsByParty={documentCounts.countsByParty}
                  documentCountVisibility={documentCounts.visible}
                  page={pageInfo}
                  onPageChange={workspace.setPage}
                />
              )}

              {view === "table" && (
                <CustomerExecutiveTableView
                  items={visibleItems}
                  selectedIds={workspace.selection.selectedIds}
                  onSelectionChange={workspace.selection.onSelectionChange}
                  sort={workspace.sort}
                  onSortChange={workspace.setSort}
                  canUpdate={canUpdateProfile}
                  canDelete={canDeleteProfile}
                  onOpen={openProfile}
                  onOpenQuickModal={setQuickEditCustomer}
                  onDelete={promptDeleteCustomer}
                  onOpenActivities={canMutate ? openActivities : undefined}
                  onCardChange={(item, patch) => void updateCard(item, patch)}
                  onMoveStatus={handleMoveStatus}
                  onRefresh={() => void reload()}
                  page={pageInfo}
                  onPageChange={workspace.setPage}
                />
              )}
            </>
          )}
        </div>

        {/* Centered 360° Quick-Edit & Inspector Modal (Screen 04 — zero <aside>) */}
        <CustomerQuickEditModal
          allowedOwnerIds={
            capabilities.update ? capabilities.update.ownerUserIds : []
          }
          item={quickEditCustomer}
          allItems={visibleItems}
          canUpdate={canUpdateProfile}
          canDelete={canDeleteProfile}
          onClose={() => setQuickEditCustomer(null)}
          onSelectCustomer={setQuickEditCustomer}
          onOpenActivities={openActivities}
          onCardChange={async (item, patch) => {
            const result = await updateCard(item, patch);
            if (result.ok) {
              setQuickEditCustomer((prev) =>
                prev && prev.id === item.id ? { ...prev, ...result.patch } : prev,
              );
            }
            return result;
          }}
          onMoveStatus={handleMoveStatus}
          onDelete={(item) => {
            setQuickEditCustomer(null);
            promptDeleteCustomer(item);
          }}
          onSaved={() => void reload()}
        />

        <CreateCustomerProfileModal
          allowedOwnerIds={
            capabilities.create ? capabilities.create.ownerUserIds : []
          }
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

        <ActivityModal
          scope="CRM"
          branchId={branchId}
          request={
            activityCustomer
              ? { kind: "create", target: activityCustomer, agenda: true }
              : null
          }
          onClose={() => setActivityCustomer(null)}
          onChanged={() => reload()}
        />
      </div>
    </PermissionGate>
  );
}
