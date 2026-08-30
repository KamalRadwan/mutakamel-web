"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Building2, Eye, RefreshCw, UserRound } from "lucide-react";
import {
  Badge,
  BoardView,
  Button,
  CardView,
  ConfirmActionModal,
  DegradedBanner,
  EmptyState,
  FilterBar,
  PageHeader,
  StatusBadge,
  TableView,
  ViewSwitcher,
  useToast,
  useWorkspaceView,
  type BoardCardMove,
  type BoardColumnDef,
  type ColumnDef,
} from "@/design-system";
import { TenantBranchSelect } from "@/components/tenant/TenantBranchSelect";
import { useI18n } from "@/i18n/I18nContext";
import { formatTemplate } from "@/lib/format/template";
import {
  type CustomerProfileItem,
  type CustomerProfileStatus,
  useCustomerProfiles,
} from "./hooks/useCustomerProfiles";
import { useCustomerProfilesCapabilities } from "./hooks/useCustomerProfilesCapabilities";
import { useUpdateCustomerProfileStatus } from "./hooks/useUpdateCustomerProfileStatus";

// Board axis is CustomerStatusEnum — fixed, 4 values, no catalogue fetch,
// unlike leads/opportunities. See
// docs/api/crm-customer-profiles.md#frontend-notes.
const BOARD_STATUS_ORDER: CustomerProfileStatus[] = ["PROSPECT", "ACTIVE_CUSTOMER", "INACTIVE", "BLACKLISTED"];
const TERMINAL_STATUS: CustomerProfileStatus = "BLACKLISTED";

export default function CustomerProfilesPage() {
  const { t, lang } = useI18n();
  const toast = useToast();
  const {
    items,
    branchIds,
    branchId,
    selectBranch,
    pagination,
    searchQuery,
    setSearchQuery,
    isLoading,
    precondition,
    loadError,
    previousPage,
    nextPage,
    reload,
  } = useCustomerProfiles();
  const { capabilities, error: capabilitiesError } =
    useCustomerProfilesCapabilities(branchId);
  const { updateStatus } = useUpdateCustomerProfileStatus();
  const [view, setView] = useWorkspaceView("customerProfiles", "table");
  // Optimistic move overrides layered on top of the read-only paginated
  // fetch — the hook that owns items has no setter to reach into, and it
  // does not need one: a failed move just clears its own override.
  const [statusOverrides, setStatusOverrides] = useState<Record<string, CustomerProfileStatus>>({});
  // BLACKLISTED is terminal in practice — confirms via a real modal, not
  // window.confirm. confirmMove needs a Promise<boolean>, so the pending
  // move sits in state until the user resolves it here.
  const [pendingTerminalMove, setPendingTerminalMove] = useState<{
    move: BoardCardMove;
    resolve: (confirmed: boolean) => void;
  } | null>(null);

  const displayItems = useMemo(
    () => items.map((item) => (item.id in statusOverrides ? { ...item, status: statusOverrides[item.id] } : item)),
    [items, statusOverrides],
  );

  function clearOverride(id: string) {
    setStatusOverrides((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
  }

  async function handleCardMove(move: BoardCardMove) {
    const status = move.toColumnId as CustomerProfileStatus;
    setStatusOverrides((current) => ({ ...current, [move.itemId]: status }));
    const succeeded = await updateStatus(move.itemId, status);
    clearOverride(move.itemId);
    if (succeeded) {
      await reload();
    } else {
      toast.error(t.crmCustomerProfiles.moveFailed);
    }
  }

  function renderCard(item: CustomerProfileItem) {
    const ProfileIcon = item.profileType === "CORPORATE" ? Building2 : UserRound;
    const sourceName = lang === "ar" ? item.acquisitionSourceNameAr : item.acquisitionSourceNameEn;
    return (
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <ProfileIcon className="size-4 shrink-0 text-brand-600 dark:text-brand-400" aria-hidden="true" />
          <span className="truncate text-sm font-medium text-foreground">{item.displayName}</span>
        </div>
        {sourceName && <p className="truncate text-xs text-muted-foreground">{sourceName}</p>}
        {item.ownerUserId && <p className="truncate font-mono text-2xs text-muted-foreground">{item.ownerUserId}</p>}
        <StatusBadge value={item.status} kind="CustomerStatus" />
      </div>
    );
  }

  const boardColumns: BoardColumnDef[] = BOARD_STATUS_ORDER.map((status) => ({
    id: status,
    label: t.statusValues[`CustomerStatus.${status}`] ?? status,
    count: displayItems.filter((item) => item.status === status).length,
    outcomeRole: status === "ACTIVE_CUSTOMER" ? "positive" : status === "BLACKLISTED" ? "negative" : status === "INACTIVE" ? "caution" : undefined,
  }));

  const cardsByColumn = Object.fromEntries(
    BOARD_STATUS_ORDER.map((status) => [status, displayItems.filter((item) => item.status === status)]),
  );

  const canUpdate = capabilities.update !== null;

  const tableColumns: ColumnDef<CustomerProfileItem>[] = [
    {
      id: "name",
      header: t.crmCustomerProfiles.name,
      cell: (item) => {
        const ProfileIcon = item.profileType === "CORPORATE" ? Building2 : UserRound;
        return (
          <div className="flex items-center gap-2.5">
            <span className="flex size-7 items-center justify-center rounded-sm bg-muted">
              <ProfileIcon className="size-4 text-brand-600 dark:text-brand-400" aria-hidden="true" />
            </span>
            <div>
              <p className="font-medium text-foreground">{item.displayName}</p>
              {item.companyName && item.companyName !== item.displayName && (
                <p className="text-2xs text-muted-foreground">{item.companyName}</p>
              )}
            </div>
          </div>
        );
      },
    },
    {
      id: "type",
      header: t.crmCustomerProfiles.type,
      cell: (item) => <Badge tone="neutral">{t.crmCustomerProfiles.profileTypes[item.profileType] ?? item.profileType}</Badge>,
    },
    {
      id: "contact",
      header: t.crmCustomerProfiles.contact,
      cell: (item) => (
        <div dir="ltr">
          <p>{item.email ?? t.crmCustomerProfiles.unavailable}</p>
          {item.phone && <p className="text-2xs text-muted-foreground">{item.phone}</p>}
        </div>
      ),
    },
    {
      id: "status",
      header: t.common.status,
      cell: (item) => <StatusBadge value={item.status} kind="CustomerStatus" />,
    },
    {
      id: "actions",
      header: t.common.actions,
      align: "end",
      sticky: "end",
      cell: (item) => (
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/crm/customer-profiles/${encodeURIComponent(item.id)}`} aria-label={`${t.common.actions}: ${item.displayName}`}>
            <Eye className="size-4" aria-hidden="true" />
          </Link>
        </Button>
      ),
    },
  ];

  // No session or no single trusted branch means the request was never
  // made. That is an empty state next to the control that resolves it, not
  // an error banner about a failure that did not happen.
  const preconditionState = precondition ? <EmptyState title={precondition} /> : undefined;

  return (
    <div className="flex h-full flex-col gap-4">
      <PageHeader
        title={t.crm.customerProfilesAndCards}
        description={t.crmCustomerProfiles.subtitle}
        secondaryActions={
          <Button variant="outline" onClick={reload} disabled={isLoading}>
            <RefreshCw className={`size-4 ${isLoading ? "animate-spin" : ""}`} aria-hidden="true" />
            {t.common.retry}
          </Button>
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <FilterBar
          filters={[]}
          values={{}}
          onChange={() => undefined}
          onReset={() => undefined}
          searchValue={searchQuery}
          onSearchChange={setSearchQuery}
          searchPlaceholder={t.crmCustomerProfiles.search}
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
            cardsByColumn={cardsByColumn}
            itemKey={(item) => item.id}
            renderCard={renderCard}
            canDrag={() => canUpdate}
            confirmMove={(move) =>
              move.toColumnId === TERMINAL_STATUS
                ? new Promise<boolean>((resolve) => setPendingTerminalMove({ move, resolve }))
                : true
            }
            onCardMove={(move) => void handleCardMove(move)}
            isLoading={isLoading}
            error={loadError}
            onRetry={reload}
            errorTitle={t.crmCustomerProfiles.loadFailed}
            retryLabel={t.common.retry}
            emptyState={preconditionState}
            emptyColumnLabel={t.crmCustomerProfiles.empty}
          />
        )}
        {view === "card" && (
          <CardView
            items={displayItems}
            renderCard={renderCard}
            itemKey={(item) => item.id}
            isLoading={isLoading}
            error={loadError}
            onRetry={reload}
            errorTitle={t.crmCustomerProfiles.loadFailed}
            retryLabel={t.common.retry}
            emptyState={preconditionState ?? <EmptyState title={t.crmCustomerProfiles.empty} />}
          />
        )}
        {view === "table" && (
          <TableView
            columns={tableColumns}
            rows={displayItems}
            isLoading={isLoading}
            error={loadError}
            onRetry={reload}
            page={{ page: pagination?.page ?? 1, limit: pagination?.limit ?? 25, total: pagination?.total ?? 0 }}
            onPageChange={(page) => (page > (pagination?.page ?? 1) ? nextPage() : previousPage())}
            rowKey={(item) => item.id}
            emptyState={preconditionState}
            labels={{
              retry: t.common.retry,
              errorTitle: t.crmCustomerProfiles.loadFailed,
              emptyTitle: t.crmCustomerProfiles.empty,
              selectAll: t.common.actions,
              selectRow: t.common.actions,
              sortAscending: t.common.actions,
              sortDescending: t.common.actions,
              notSorted: t.common.actions,
              pagination: {
                previous: t.common.previousPage,
                next: t.common.nextPage,
                summary: (from, to, total) => formatTemplate(t.common.showingOf, { from, to, total }),
              },
            }}
          />
        )}
      </div>

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
  );
}
