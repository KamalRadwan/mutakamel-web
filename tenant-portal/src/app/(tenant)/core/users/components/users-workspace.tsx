"use client";

import Link from "next/link";
import { Plus, RefreshCw } from "lucide-react";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  ConfirmActionModal,
  DataTable,
  DataTableSort,
  FilterBar,
  PageHeader,
  PermissionGate,
  TooltipProvider,
} from "@/design-system";
import { formatTemplate } from "@/lib/format/template";
import { TENANT_ROUTES } from "@/lib/navigation/tenant-routes";
import { userDisplayName } from "../../contracts/user-contract";
import { useCoreErrorText } from "../../hooks/useCoreErrorText";
import { useTenantUsers } from "../hooks/useTenantUsers";
import { useUsersWorkplaceLookups } from "../hooks/useUsersWorkplaceLookups";
import {
  EMPTY_USER_FORM,
  toInviteInput,
  userToFormValues,
} from "../user-payloads";
import { UserFormDrawer } from "./UserFormDrawer";
import { useUserColumns } from "./useUserColumns";

export function UsersWorkspace() {
  const screen = useTenantUsers();
  const { t } = screen;
  const copy = t.coreIdentity.users;
  const describeError = useCoreErrorText();
  const mutationText = describeError(screen.mutationError);
  const workplace = useUsersWorkplaceLookups(screen.filters);

  const columns = useUserColumns({
    t,
    resolveActions: screen.resolveActions,
    resolvePlacement: workplace.resolvePlacement,
    onEdit: screen.openEdit,
    onAction: screen.requestAction,
  });

  const pendingCopy = screen.pendingAction
    ? copy.confirm[screen.pendingAction.action]
    : null;
  const pendingDescription =
    pendingCopy && screen.pendingAction
      ? [
          formatTemplate(pendingCopy.description, {
            name: userDisplayName(screen.pendingAction.user),
          }),
          mutationText,
        ]
          .filter(Boolean)
          .join("\n\n")
      : "";
  const isModalOpen =
    screen.isInviteOpen ||
    screen.editingUser !== null ||
    screen.pendingAction !== null;

  return (
    <PermissionGate
      require="users.user.read"
      denied={screen.queryError?.status === 403}
    >
      <div className="flex min-w-0 flex-col gap-3 px-2 pb-4 pt-0 sm:px-5 sm:pb-5">
        <PageHeader
          className="sr-only p-0"
          title={copy.title}
          primaryAction={
            screen.canInvite
              ? {
                  label: copy.invite,
                  icon: <Plus className="size-4" aria-hidden="true" />,
                  onClick: screen.openInvite,
                  disabled: !screen.canInvitePlacement,
                }
              : undefined
          }
          secondaryActions={
            <Button
              size="sm"
              variant="outline"
              onClick={screen.reload}
              disabled={screen.isLoading}
            >
              <RefreshCw
                className={`size-4 ${screen.isLoading ? "animate-spin" : ""}`}
                aria-hidden="true"
              />
              {t.coreIdentity.actions.refresh}
            </Button>
          }
        />

        {screen.canInvite && !screen.canInvitePlacement ? (
          <p
            role="status"
            className="rounded-sm border border-border bg-muted/40 p-2.5 text-xs text-muted-foreground"
          >
            {copy.invitePlacementReadRequired}
          </p>
        ) : null}

        {screen.inviteQueuedUser ? (
          <div
            role="status"
            className="flex flex-wrap items-center justify-between gap-2 rounded-sm border border-warning/30 bg-warning-subtle p-2.5 text-xs text-warning-subtle-foreground"
          >
            <div className="flex flex-col gap-0.5">
              <span className="font-medium">
                {copy.inviteQueued} —{" "}
                <span dir="ltr">{screen.inviteQueuedUser.email}</span>
              </span>
              <span>{copy.inviteQueuedDescription}</span>
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={screen.dismissInviteQueued}
            >
              {t.common.dismiss}
            </Button>
          </div>
        ) : null}

        {screen.seatLimitReached ? (
          <Card className="border-warning/40">
            <CardHeader>
              <CardTitle>{copy.seatLimitTitle}</CardTitle>
              <CardDescription>{copy.seatLimitDescription}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap items-center gap-2">
              {screen.canReadBilling ? (
                <Button asChild size="sm" variant="outline">
                  <Link href={TENANT_ROUTES.coreBilling}>{copy.seatLimitAction}</Link>
                </Button>
              ) : null}
              <Button size="sm" variant="ghost" onClick={screen.dismissSeatLimit}>
                {t.common.dismiss}
              </Button>
            </CardContent>
          </Card>
        ) : null}

        <Card className="min-w-0 overflow-hidden p-0">
        <FilterBar
          placement="inline"
          className="border-b border-border p-4"
          trailing={<DataTableSort columns={columns} value={screen.sort} onChange={screen.setSort} labels={{ label: t.coreIdentity.sortBy, ascending: t.views.sortAscending, descending: t.views.sortDescending }} />}
          filters={workplace.filterDefinitions}
          values={workplace.filterValues}
          onChange={(next) => screen.setFilters(workplace.parseFilterValues(next))}
          onReset={() => screen.setFilters({})}
          searchValue={screen.searchQuery}
          onSearchChange={screen.setSearchQuery}
          searchPlaceholder={copy.searchPlaceholder}
          filtersLabel={t.filters.label}
          clearAllLabel={t.filters.clearAll}
        />

        {mutationText && !isModalOpen ? (
          <p
            role="alert"
            className="rounded-sm border border-destructive/30 bg-destructive-subtle p-2.5 text-xs text-destructive-subtle-foreground"
          >
            {mutationText}
          </p>
        ) : null}

        <TooltipProvider>
          <DataTable
            surface="embedded"
            columns={columns}
            rows={screen.rows}
            isLoading={screen.isLoading}
            error={screen.queryError}
            onRetry={screen.reload}
            page={screen.pageInfo}
            onPageChange={screen.setPage}
            sort={screen.sort}
            onSortChange={screen.setSort}
            rowKey={(user) => user.id}
            labels={{
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
                summary: (from, to, total) =>
                  formatTemplate(t.common.showingOf, { from, to, total }),
              },
            }}
          />
        </TooltipProvider>
        </Card>

        {screen.isInviteOpen ? (
          <UserFormDrawer
            mode="invite"
            isOpen={screen.isInviteOpen}
            initial={EMPTY_USER_FORM}
            onClose={screen.closeInvite}
            onSubmit={(values) => screen.handleInvite(toInviteInput(values))}
            isSubmitting={screen.isSubmitting}
            error={mutationText}
          />
        ) : null}

        {screen.editingUser ? (
          <UserFormDrawer
            key={screen.editingUser.id}
            mode="edit"
            isOpen
            initial={userToFormValues(screen.editingUser)}
            onClose={screen.closeEdit}
            onSubmit={screen.handleUpdate}
            isSubmitting={screen.isSubmitting}
            error={mutationText}
          />
        ) : null}

        <ConfirmActionModal
          open={screen.pendingAction !== null}
          onOpenChange={(open) => {
            if (!open) screen.cancelAction();
          }}
          title={pendingCopy?.title ?? ""}
          description={pendingDescription}
          confirmLabel={
            screen.pendingAction?.action === "suspend" &&
            screen.pendingAction.user.status === "INVITED"
              ? copy.revokeInvite
              : (pendingCopy?.confirm ?? "")
          }
          cancelLabel={t.common.cancel}
          onConfirm={() => void screen.confirmAction()}
          loading={screen.isSubmitting}
        />
      </div>
    </PermissionGate>
  );
}
