"use client";

import { Info, Lock, Pencil, RotateCcw, ShieldCheck, Trash2 } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  DateTime,
  DetailHeader,
  ErrorState,
  NotFoundState,
  PermissionGate,
  Skeleton,
} from "@/design-system";
import { localizedValue } from "@/lib/format/localized";
import { TENANT_ROUTES } from "@/lib/navigation/tenant-routes";
import { useCoreErrorText } from "../../../hooks/useCoreErrorText";
import { resolveRoleBranchErrorText } from "../../hooks/branch-permissions-reconcile";
import { useRolePermissionEditor } from "../hooks/useRolePermissionEditor";
import { useRoleBranchModalScopeKey } from "../../hooks/useRoleBranchModalScopeKey";
import { PermissionCatalogueMatrix } from "./PermissionCatalogueMatrix";
import { RoleEditorDialogs } from "./RoleEditorDialogs";

export function RoleEditorWorkspace(props: { id: string; onDeleted?: () => void }) {
  const scopeKey = useRoleBranchModalScopeKey(props.id, true);
  return <RoleEditorContent key={scopeKey} {...props} />;
}

function RoleEditorContent({
  id,
  onDeleted,
}: {
  id: string;
  onDeleted?: () => void;
}) {
  const screen = useRolePermissionEditor(id, onDeleted);
  const { t, lang, role } = screen;
  const copy = t.coreIdentity.roles;
  const branchCopy = t.coreIdentity.roleBranch;
  const describeError = useCoreErrorText();
  const writeText = resolveRoleBranchErrorText(screen.writeError, t);
  const blockerText =
    describeError(screen.blockedDeleteError) ?? t.coreIdentity.errors.ROLE_IN_USE;
  const isReadOnly = !screen.canUpdate || (role?.isSystem ?? false);
  const canOpenBranchEditor = screen.canAssignBranchPermissions || screen.canViewBranchPermissions;
  const branchButtonLabel = screen.canAssignBranchPermissions
    ? branchCopy.assignAction
    : branchCopy.viewAction;

  if (screen.isMissing || screen.loadError || screen.isLoading || !role) {
    return (
      <PermissionGate require="roles.role.read" denied={screen.loadError?.status === 403}>
        {screen.isMissing ? (
          <NotFoundState
            title={copy.notFoundTitle}
            description={copy.notFoundDescription}
            backLabel={copy.backToList}
            backHref={TENANT_ROUTES.coreRoles}
          />
        ) : screen.loadError ? (
          <ErrorState
            title={copy.loadFailed}
            description={describeError(screen.loadError)}
            onRetry={screen.reload}
            retryLabel={t.common.retry}
          />
        ) : (
          <div className="flex flex-col gap-3" role="status" aria-busy="true">
            <Skeleton className="h-7 w-64" />
            <Skeleton className="h-40 w-full" />
          </div>
        )}
      </PermissionGate>
    );
  }

  const roleName = localizedValue(role.nameAr, role.nameEn, lang);
  const roleDescription = localizedValue(role.descriptionAr, role.descriptionEn, lang);

  return (
    <PermissionGate require="roles.role.read">
      <div className="flex flex-col gap-4">
        <DetailHeader
          title={roleName}
          subtitle={roleDescription || undefined}
          backLabel={copy.backToList}
          backHref={TENANT_ROUTES.coreRoles}
          breadcrumbs={[
            { label: copy.title, href: TENANT_ROUTES.coreRoles },
            { label: roleName },
          ]}
          status={
            role.isSystem ? (
              <Badge tone="brand">{copy.systemRole}</Badge>
            ) : (
              <Badge tone="neutral">{copy.customOnly}</Badge>
            )
          }
          primaryAction={
            screen.isBranchMode
              ? canOpenBranchEditor
                ? {
                    label: branchButtonLabel,
                    icon: <ShieldCheck className="size-4" aria-hidden="true" />,
                    onClick: screen.openBranchPermissions,
                  }
                : undefined
              : isReadOnly
                ? undefined
                : {
                    label: copy.savePermissions,
                    onClick: screen.openConfirm,
                    disabled:
                      !screen.isDirty || !screen.canSavePermissions || screen.isSubmitting,
                    loading: screen.isSubmitting,
                  }
          }
          secondaryActions={
            <>
              {!screen.isBranchMode && canOpenBranchEditor ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={screen.openBranchPermissions}
                  disabled={screen.isSubmitting}
                >
                  <ShieldCheck className="size-4" aria-hidden="true" />
                  {branchButtonLabel}
                </Button>
              ) : null}
              {isReadOnly ? null : (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={screen.openRename}
                  disabled={screen.isSubmitting}
                >
                  <Pencil className="size-4" aria-hidden="true" />
                  {copy.rename}
                </Button>
              )}
              {screen.isDirty && screen.canEditPermissions ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={screen.resetSelection}
                  disabled={screen.isSubmitting}
                >
                  <RotateCcw className="size-4" aria-hidden="true" />
                  {t.editDrawer.revert}
                </Button>
              ) : null}
              {!role.isSystem && screen.canDelete ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={screen.openDelete}
                  disabled={screen.isSubmitting}
                >
                  <Trash2 className="size-4 text-destructive" aria-hidden="true" />
                  {t.coreIdentity.actions.delete}
                </Button>
              ) : null}
            </>
          }
        />

        <Card>
          <CardContent className="grid gap-3 py-3 sm:grid-cols-3">
            <div className="flex flex-col gap-0.5">
              <span className="text-2xs text-muted-foreground">{copy.description}</span>
              <span className="text-xs text-foreground">{roleDescription || t.detail.notRecorded}</span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-2xs text-muted-foreground">{t.coreIdentity.detail.createdAt}</span>
              <DateTime value={role.createdAt} className="text-xs text-foreground" />
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-2xs text-muted-foreground">{t.coreIdentity.detail.updatedAt}</span>
              <DateTime value={role.updatedAt} className="text-xs text-foreground" />
            </div>
          </CardContent>
        </Card>

        {screen.isBranchMode ? (
          <div role="status" className="flex flex-col gap-1 rounded-md border border-border bg-info-subtle px-3.5 py-2.5 text-xs text-info-subtle-foreground">
            <span className="font-medium">{branchCopy.detail.branchModeBannerTitle}</span>
            <span>{canOpenBranchEditor ? branchCopy.detail.branchModeBannerDescription : branchCopy.detail.nonOwnerBranchModeHint}</span>
          </div>
        ) : null}

        {role.isSystem ? (
          <p role="status" className="flex items-center gap-2 rounded-md border border-border bg-muted/60 px-3 py-2.5 text-xs text-muted-foreground">
            <Lock className="size-3.5 shrink-0" aria-hidden="true" />
            <span>{copy.systemRoleReadOnly}</span>
          </p>
        ) : null}

        {screen.hasUngrantablePermissions && !screen.isBranchMode ? (
          <p role="alert" className="rounded-sm border border-border bg-warning-subtle p-2.5 text-xs text-warning-subtle-foreground">
            {copy.outsideGrantAuthority}
          </p>
        ) : null}

        {writeText && !screen.isRenameOpen ? (
          <p role="alert" className="rounded-sm border border-border bg-destructive-subtle p-2.5 text-xs text-destructive-subtle-foreground">
            {writeText}
          </p>
        ) : null}

        {(screen.catalogueError && screen.catalogueError.status !== 403) || screen.isCatalogueTruncated ? (
          <ErrorState
            title={copy.catalogueFailed}
            description={screen.catalogueError ? describeError(screen.catalogueError) : undefined}
            onRetry={screen.reload}
            retryLabel={t.common.retry}
          />
        ) : null}

        <PermissionGate
          require="roles.permission.read"
          denied={!screen.canReadPermissions || screen.catalogueError?.status === 403}
        >
          {!screen.catalogueError && !screen.isCatalogueTruncated ? (
            <PermissionCatalogueMatrix
              t={t}
              lang={lang}
              groups={screen.groups}
              filteredGroups={screen.filteredGroups}
              permissionSearch={screen.permissionSearch}
              onPermissionSearchChange={screen.setPermissionSearch}
              onClearPermissionSearch={screen.clearPermissionSearch}
              isCatalogueLoaded={screen.isCatalogueLoaded}
              selectedCount={screen.selectedIds.length}
              selectedSet={screen.selectedSet}
              maxPermissions={screen.maxPermissions}
              isOverCap={screen.isOverCap}
              canEditPermissions={screen.canEditPermissions}
              canGrantPermission={screen.canGrantPermission}
              isSubmitting={screen.isSubmitting}
              onToggle={screen.toggle}
            />
          ) : null}
        </PermissionGate>

        {!isReadOnly && !screen.isBranchMode ? (
          <p className="flex items-center gap-2 rounded-md border border-border bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
            <Info className="size-3.5 shrink-0" aria-hidden="true" />
            <span>{copy.savePermissionsDescription}</span>
          </p>
        ) : null}

        <RoleEditorDialogs
          t={t}
          role={role}
          roleName={roleName}
          roleDescription={roleDescription}
          diff={screen.diff}
          formatCount={screen.formatCount}
          isSubmitting={screen.isSubmitting}
          writeText={writeText}
          blockerText={blockerText}
          canReadUsers={screen.canReadUsers}
          isRenameOpen={screen.isRenameOpen}
          onCloseRename={screen.closeRename}
          onRename={screen.rename}
          isConfirmOpen={screen.isConfirmOpen}
          onConfirmOpenChange={screen.handleConfirmOpenChange}
          onConfirmSave={screen.save}
          isDeleteOpen={screen.isDeleteOpen}
          onDeleteOpenChange={screen.handleDeleteOpenChange}
          onConfirmDelete={screen.confirmDelete}
          isDeleteBlocked={screen.blockedDeleteError !== null}
          onDeleteBlockerOpenChange={screen.handleDeleteBlockerOpenChange}
          branchModalSession={screen.branchModalSession}
          onCloseBranchModal={screen.closeBranchModal}
          onBranchSaved={screen.handleBranchSaved}
          savedBranchReceipt={screen.savedBranchReceipt}
          onCloseSavedBranchReceipt={screen.closeSavedBranchReceipt}
          onViewSavedBranchPermissions={screen.viewSavedBranchPermissions}
        />
      </div>
    </PermissionGate>
  );
}
