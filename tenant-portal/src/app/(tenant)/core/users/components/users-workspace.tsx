"use client";

import Link from "next/link";
import { RefreshCw } from "lucide-react";
import {
  Button,
  Card,
  CardContent,
  ConfirmActionModal,
  CORE_IDENTITY_NAV_ITEMS,
  DataTable,
  FilterBar,
  PageHeader,
  PermissionGate,
  SubNav,
} from "@/design-system";
import { formatTemplate } from "@/lib/format/template";
import { TENANT_ROUTES } from "@/lib/navigation/tenant-routes";
import {
  USER_STATUSES,
  userDisplayName,
  type UserStatus,
} from "../../contracts/user-contract";
import { useCoreErrorText } from "../../hooks/useCoreErrorText";
import { UserFormDrawer, type UserFormValues } from "./UserFormDrawer";
import { useUserColumns } from "./useUserColumns";
import { useTenantUsers } from "../hooks/useTenantUsers";

function readUserStatus(value: string): UserStatus | undefined {
  return USER_STATUSES.find((status) => status === value);
}

/** `CreateTenantUserDto` — an empty optional is omitted, not sent as "". */
function toInviteInput(values: UserFormValues) {
  return {
    email: values.email,
    firstName: values.firstName,
    lastName: values.lastName,
    companyId: values.companyId,
    branchId: values.branchId,
    departmentId: values.departmentId,
    ...(values.teamId ? { teamId: values.teamId } : {}),
    ...(values.managerId ? { managerId: values.managerId } : {}),
    ...(values.employeeCode ? { employeeCode: values.employeeCode } : {}),
    ...(values.jobTitle ? { jobTitle: values.jobTitle } : {}),
  };
}

export function UsersWorkspace() {
  const screen = useTenantUsers();
  const { t } = screen;
  const copy = t.coreIdentity;
  const describeError = useCoreErrorText();
  const mutationText = describeError(screen.mutationError);

  const columns = useUserColumns({
    actingUserId: screen.actingUserId,
    canDeactivate: screen.canDeactivate,
    canDelete: screen.canDelete,
    onAction: screen.requestAction,
  });

  const pendingCopy = screen.pendingAction
    ? copy.users.confirm[screen.pendingAction.action]
    : null;

  return (
    <PermissionGate require="users.user.read">
      <div className="flex flex-col gap-4">
        <PageHeader
          title={copy.users.title}
          description={copy.users.subtitle}
          primaryAction={
            screen.canInvite
              ? { label: copy.users.invite, onClick: screen.openInvite }
              : undefined
          }
          secondaryActions={
            <Button variant="outline" onClick={screen.reload} disabled={screen.isLoading}>
              <RefreshCw
                className={`size-4 ${screen.isLoading ? "animate-spin" : ""}`}
                aria-hidden="true"
              />
              {t.common.retry}
            </Button>
          }
        />

        <SubNav items={CORE_IDENTITY_NAV_ITEMS} />

        {screen.isSeatLimitReached ? (
          // 403 USER_LIMIT_REACHED is an outcome with a next step, not a
          // permission problem — @CountsAgainstUsers() on POST /users.
          <Card>
            <CardContent className="flex flex-col items-start gap-2 py-5">
              <p className="text-sm font-medium text-foreground">{copy.users.seatLimitTitle}</p>
              <p className="max-w-prose text-xs text-muted-foreground">
                {copy.users.seatLimitDescription}
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" asChild>
                  <Link href={TENANT_ROUTES.coreSettings}>{copy.users.seatLimitAction}</Link>
                </Button>
                <Button variant="ghost" size="sm" onClick={screen.dismissSeatLimit}>
                  {t.common.dismiss}
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : null}

        <FilterBar
          filters={[
            {
              id: "status",
              kind: "select",
              label: copy.fields.status,
              options: USER_STATUSES.map((status) => ({
                value: status,
                label: copy.userStatus[status],
              })),
              placeholder: copy.filters.anyStatus,
            },
          ]}
          values={
            screen.statusFilter
              ? { status: { kind: "select", value: screen.statusFilter } }
              : {}
          }
          onChange={(next) => {
            const value = next.status;
            screen.setStatusFilter(
              value?.kind === "select" ? readUserStatus(value.value) : undefined,
            );
          }}
          onReset={screen.resetFilters}
          searchValue={screen.searchQuery}
          onSearchChange={screen.setSearchQuery}
          searchPlaceholder={copy.users.searchPlaceholder}
          filtersLabel={t.filters.label}
          clearAllLabel={t.filters.clearAll}
        />

        {mutationText && !screen.isInviteOpen ? (
          <p
            role="alert"
            className="rounded-sm border border-negative-200 bg-negative-100 p-2.5 text-xs text-negative-800 dark:border-negative-800 dark:bg-negative-950 dark:text-negative-300"
          >
            {mutationText}
          </p>
        ) : null}

        <DataTable
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
            errorTitle: copy.users.loadFailed,
            emptyTitle: copy.users.empty,
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

        <UserFormDrawer
          key={screen.isInviteOpen ? "invite-open" : "invite-closed"}
          mode="invite"
          isOpen={screen.isInviteOpen}
          onClose={screen.closeInvite}
          onSubmit={(values) => screen.handleInvite(toInviteInput(values))}
          isSubmitting={screen.isSubmitting}
          error={screen.isInviteOpen ? mutationText : undefined}
        />

        <ConfirmActionModal
          open={screen.pendingAction !== null}
          onOpenChange={(open) => {
            if (!open) screen.cancelAction();
          }}
          title={pendingCopy?.title ?? ""}
          description={formatTemplate(pendingCopy?.description ?? "", {
            name: screen.pendingAction ? userDisplayName(screen.pendingAction.user) : "",
          })}
          confirmLabel={pendingCopy?.confirm ?? t.common.confirmDelete}
          cancelLabel={t.common.cancel}
          onConfirm={() => void screen.confirmPendingAction()}
          loading={screen.isSubmitting}
        />
      </div>
    </PermissionGate>
  );
}
