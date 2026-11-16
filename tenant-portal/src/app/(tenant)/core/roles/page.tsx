"use client";

import { Lock, Plus, RefreshCw } from "lucide-react";
import {
  Button,
  Card,
  ConfirmActionModal,
  DataTable,
  DataTableSort,
  DeletionBlockerDialog,
  FilterBar,
  PageHeader,
  PermissionGate,
  TooltipProvider,
} from "@/design-system";
import { localizedValue } from "@/lib/format/localized";
import { formatTemplate } from "@/lib/format/template";
import { TENANT_ROUTES } from "@/lib/navigation/tenant-routes";
import { useCoreErrorText } from "../hooks/useCoreErrorText";
import {
  RoleCreatedDialog,
  RolePermissionsSavedDialog,
  SystemRoleProtectedDialog,
} from "./components/RoleBranchDialogs";
import { RoleBranchPermissionsModal } from "./components/RoleBranchPermissionsModal";
import { RoleFormModal } from "./components/RoleFormDrawer";
import { useRoleColumns } from "./components/useRoleColumns";
import { useTenantRoles } from "./hooks/useTenantRoles";
import { useRoleBranchModalScopeKey } from "./hooks/useRoleBranchModalScopeKey";

export default function TenantRolesPage() {
  const scopeKey = useRoleBranchModalScopeKey(null, true);
  return <TenantRolesContent key={scopeKey} />;
}

function TenantRolesContent() {
  const screen = useTenantRoles();
  const { t, lang } = screen;
  const copy = t.coreIdentity.roles;
  const describeError = useCoreErrorText();
  const mutationText = describeError(screen.mutationError);
  const blockerText =
    describeError(screen.blockerError) ?? t.coreIdentity.errors.ROLE_IN_USE;

  const columns = useRoleColumns({
    canUpdate: screen.canUpdate,
    canDelete: screen.canDelete,
    canAssignBranchPermissions: screen.canAssignBranchPermissions,
    canViewBranchPermissions: screen.canViewBranchPermissions,
    roleBranchSummaries: screen.roleBranchSummaries,
    onAssignPermissions: screen.openAssignPermissions,
    onInspectSystemRole: screen.openSystemRoleDialog,
    onEdit: screen.startEdit,
    onDelete: screen.requestDelete,
  });

  return (
    <PermissionGate require="roles.role.read" denied={screen.queryError?.status === 403}>
      <div className="flex min-w-0 flex-col gap-3 px-2 pb-4 pt-0 sm:px-5 sm:pb-5">
        <PageHeader
          className="sr-only p-0"
          title={copy.title}
          primaryAction={
            screen.canCreate
              ? {
                  label: copy.create,
                  icon: <Plus className="size-4" aria-hidden="true" />,
                  onClick: screen.openCreate,
                }
              : undefined
          }
          secondaryActions={
            <Button size="sm" variant="outline" onClick={screen.reload} disabled={screen.isLoading}>
              <RefreshCw
                className={`size-4 ${screen.isLoading ? "animate-spin" : ""}`}
                aria-hidden="true"
              />
              {t.coreIdentity.actions.refresh}
            </Button>
          }
        />

        <Card className="min-w-0 overflow-hidden p-0">
          <FilterBar
            placement="inline"
            className="border-b border-border p-4"
            trailing={
              <DataTableSort
                columns={columns}
                value={screen.sort}
                onChange={screen.setSort}
                labels={{
                  label: t.coreIdentity.sortBy,
                  ascending: t.views.sortAscending,
                  descending: t.views.sortDescending,
                }}
              />
            }
            filters={screen.filterDefs}
            values={screen.filterValues}
            onChange={screen.handleFilterChange}
            onReset={screen.resetFilters}
            searchValue={screen.searchQuery}
            onSearchChange={screen.setSearchQuery}
            searchPlaceholder={copy.searchPlaceholder}
            filtersLabel={t.filters.label}
            clearAllLabel={t.filters.clearAll}
          />

          {screen.hasSystemRow ? (
            <p
              role="status"
              className="flex items-center gap-2 border-b border-border bg-muted/50 px-3 py-2 text-xs text-muted-foreground"
            >
              <Lock className="size-3.5 shrink-0" aria-hidden="true" />
              <span>{t.coreIdentity.errors.ROLE_IS_SYSTEM}</span>
            </p>
          ) : null}

          {mutationText && !screen.isModalOpen ? (
            <p
              role="alert"
              className="border-b border-border bg-destructive-subtle p-2.5 text-xs text-destructive-subtle-foreground"
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
              rowKey={(role) => role.id}
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

        <RoleFormModal
          key={screen.isCreateOpen ? "role-create-open" : "role-create-closed"}
          mode="create"
          isOpen={screen.isCreateOpen}
          initial={{ name: "", description: "" }}
          title={copy.createTitle}
          description={copy.createDescription}
          onClose={screen.closeCreate}
          onSubmit={screen.handleCreate}
          isSubmitting={screen.isSubmitting}
          error={screen.isCreateOpen ? mutationText : undefined}
        />

        <RoleFormModal
          key={screen.editingRole ? `role-edit-${screen.editingRole.id}` : "role-edit-closed"}
          mode="edit"
          isOpen={screen.editingRole !== null}
          initial={{
            name: screen.editingRole?.name ?? "",
            description: screen.editingRole
              ? localizedValue(
                  screen.editingRole.descriptionAr,
                  screen.editingRole.descriptionEn,
                  lang,
                )
              : "",
          }}
          title={copy.renameTitle}
          description={copy.renameDescription}
          onClose={screen.closeEdit}
          onSubmit={screen.handleUpdate}
          isSubmitting={screen.isSubmitting}
          error={screen.editingRole ? mutationText : undefined}
        />

        <RoleCreatedDialog
          open={screen.createdRole !== null}
          roleName={
            screen.createdRole
              ? localizedValue(screen.createdRole.nameAr, screen.createdRole.nameEn, lang)
              : ""
          }
          canAssign={screen.canAssignBranchPermissions}
          t={t}
          onAssign={screen.assignCreatedRolePermissions}
          onClose={screen.closeCreatedRole}
        />

        <SystemRoleProtectedDialog
          open={screen.systemDialogRole !== null}
          roleName={
            screen.systemDialogRole
              ? localizedValue(
                  screen.systemDialogRole.nameAr,
                  screen.systemDialogRole.nameEn,
                  lang,
                )
              : ""
          }
          t={t}
          onViewPermissions={screen.viewSystemRolePermissions}
          onClose={screen.closeSystemRoleDialog}
        />

        <RoleBranchPermissionsModal
          key={
            screen.branchModalTarget
              ? `role-branch-${screen.branchModalTarget.roleId}-${screen.branchModalTarget.session}`
              : "role-branch-closed"
          }
          open={screen.branchModalTarget !== null}
          roleId={screen.branchModalTarget?.roleId ?? null}
          roleDisplayName={screen.branchModalTarget?.roleName ?? ""}
          isSystemHint={screen.branchModalTarget?.isSystem ?? false}
          initialMode={screen.branchModalTarget?.mode ?? "view"}
          onClose={screen.closeBranchModal}
          onSaved={screen.handleBranchPermissionsSaved}
        />

        <RolePermissionsSavedDialog
          open={screen.savedReceipt !== null}
          roleName={screen.savedReceipt?.roleName ?? ""}
          summaryLines={screen.savedReceipt?.lines ?? []}
          t={t}
          onViewPermissions={screen.viewSavedPermissions}
          onClose={screen.closeSavedReceipt}
        />

        <ConfirmActionModal
          open={screen.pendingDelete !== null}
          onOpenChange={screen.handleDeleteOpenChange}
          title={copy.deleteTitle}
          description={formatTemplate(copy.deleteMessage, {
            name: screen.pendingDelete
              ? localizedValue(screen.pendingDelete.nameAr, screen.pendingDelete.nameEn, lang)
              : "",
          })}
          confirmLabel={t.coreIdentity.actions.delete}
          cancelLabel={t.common.cancel}
          onConfirm={screen.confirmDelete}
          loading={screen.isSubmitting}
        />

        <DeletionBlockerDialog
          open={screen.blockedRole !== null}
          onOpenChange={screen.handleBlockerOpenChange}
          recordName={
            screen.blockedRole
              ? localizedValue(screen.blockedRole.nameAr, screen.blockedRole.nameEn, lang)
              : ""
          }
          blockers={[
            {
              id: "role-in-use",
              label: blockerText,
              href: screen.canReadUsers ? TENANT_ROUTES.coreUsers : undefined,
            },
          ]}
          labels={{
            title: t.deletionBlocker.title,
            description: t.deletionBlocker.description,
            blockersHeading: t.deletionBlocker.blockersHeading,
            view: t.deletionBlocker.view,
            close: t.deletionBlocker.close,
          }}
        />
      </div>
    </PermissionGate>
  );
}
