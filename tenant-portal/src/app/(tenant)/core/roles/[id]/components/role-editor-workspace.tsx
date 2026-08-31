"use client";

import {
  Badge,
  Button,
  Card,
  CardContent,
  Checkbox,
  ConfirmActionModal,
  DetailHeader,
  ErrorState,
  NotFoundState,
  PermissionGate,
  Skeleton,
} from "@/design-system";
import { useLanguage } from "@/i18n/useLanguage";
import { localizedValue } from "@/lib/format/localized";
import { formatNumber } from "@/lib/format/number";
import { formatTemplate } from "@/lib/format/template";
import { TENANT_ROUTES } from "@/lib/navigation/tenant-routes";
import { useCoreErrorText } from "../../../hooks/useCoreErrorText";
import { RoleFormDrawer } from "../../components/RoleFormDrawer";
import { useRolePermissionEditor } from "../hooks/useRolePermissionEditor";

export function RoleEditorWorkspace({ id }: { id: string }) {
  const screen = useRolePermissionEditor(id);
  const lang = useLanguage();
  const { t, role } = screen;
  const copy = t.coreIdentity.roles;
  const describeError = useCoreErrorText();
  const writeText = describeError(screen.writeError);
  const isReadOnly = !screen.canUpdate || (role?.isSystem ?? false);

  if (screen.isMissing || screen.loadError || screen.isLoading || !role) {
    return (
      <PermissionGate require="roles.role.read">
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

  return (
    <PermissionGate require="roles.role.read">
      <div className="flex flex-col gap-4">
        <DetailHeader
          title={roleName}
          subtitle={localizedValue(role.descriptionAr, role.descriptionEn, lang)}
          backLabel={copy.backToList}
          backHref={TENANT_ROUTES.coreRoles}
          breadcrumbs={[{ label: copy.title, href: TENANT_ROUTES.coreRoles }, { label: roleName }]}
          status={role.isSystem ? <Badge tone="brand">{copy.systemRole}</Badge> : undefined}
          primaryAction={
            isReadOnly
              ? undefined
              : {
                  label: copy.savePermissions,
                  onClick: screen.openConfirm,
                  disabled: !screen.isDirty || screen.isOverCap || screen.isSubmitting,
                  loading: screen.isSubmitting,
                }
          }
          secondaryActions={
            <>
              {isReadOnly ? null : (
                <Button variant="outline" onClick={screen.openRename} disabled={screen.isSubmitting}>
                  {copy.rename}
                </Button>
              )}
              {screen.isDirty && !isReadOnly ? (
                <Button variant="outline" onClick={screen.resetSelection} disabled={screen.isSubmitting}>
                  {t.editDrawer.revert}
                </Button>
              ) : null}
            </>
          }
        />

        <RoleFormDrawer
          key={screen.isRenameOpen ? "rename-open" : "rename-closed"}
          isOpen={screen.isRenameOpen}
          initial={{
            name: role.name,
            description: role.descriptionEn ?? "",
          }}
          title={copy.renameTitle}
          description={copy.renameDescription}
          onClose={screen.closeRename}
          onSubmit={screen.rename}
          isSubmitting={screen.isSubmitting}
          error={screen.isRenameOpen ? writeText : undefined}
        />

        {role.isSystem ? (
          <p
            role="status"
            className="rounded-sm border border-border bg-muted p-2.5 text-xs text-muted-foreground"
          >
            {copy.systemRoleReadOnly}
          </p>
        ) : null}

        {writeText ? (
          <p
            role="alert"
            className="rounded-sm border border-negative-200 bg-negative-100 p-2.5 text-xs text-negative-800 dark:border-negative-800 dark:bg-negative-950 dark:text-negative-300"
          >
            {writeText}
          </p>
        ) : null}

        <p className="text-xs text-muted-foreground">
          {formatTemplate(copy.selectedCount, {
            count: formatNumber(screen.selectedIds.length, lang),
            max: formatNumber(screen.maxPermissions, lang),
          })}
        </p>

        {screen.isOverCap ? (
          <p
            role="alert"
            className="rounded-sm border border-caution-200 bg-caution-100 p-2.5 text-xs text-caution-800 dark:border-caution-800 dark:bg-caution-950 dark:text-caution-300"
          >
            {formatTemplate(copy.overCap, {
              max: formatNumber(screen.maxPermissions, lang),
            })}
          </p>
        ) : null}

        {screen.catalogueError ? (
          <ErrorState
            title={copy.catalogueFailed}
            description={describeError(screen.catalogueError)}
            onRetry={screen.reload}
            retryLabel={t.common.retry}
          />
        ) : null}

        {screen.groups.map((group) => (
          <Card key={group.key}>
            <CardContent className="flex flex-col gap-2 py-4">
              <h2 className="text-xs font-semibold text-foreground">{group.label}</h2>
              <ul className="grid gap-2 sm:grid-cols-2">
                {group.permissions.map((permission) => (
                  <li key={permission.id}>
                    <label className="flex items-start gap-2">
                      <Checkbox
                        checked={screen.selectedIds.includes(permission.id)}
                        onCheckedChange={() => screen.toggle(permission.id)}
                        disabled={isReadOnly || screen.isSubmitting}
                        aria-label={localizedValue(permission.nameAr, permission.nameEn, lang)}
                      />
                      <span className="flex flex-col">
                        {/* The catalogue ships localized labels; never write a
                            second description for a permission key here. */}
                        <span className="text-xs text-foreground">
                          {localizedValue(permission.nameAr, permission.nameEn, lang)}
                        </span>
                        <span dir="ltr" className="font-mono text-2xs text-muted-foreground">
                          {permission.key}
                        </span>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}

        <ConfirmActionModal
          open={screen.isConfirmOpen}
          onOpenChange={(open) => {
            if (!open) screen.closeConfirm();
          }}
          title={copy.savePermissionsTitle}
          // PUT /roles/:id/permissions bumps authorizationVersion for every
          // holder in one transaction, so the change is live immediately.
          description={copy.savePermissionsDescription}
          confirmLabel={copy.savePermissions}
          cancelLabel={t.common.cancel}
          onConfirm={() => void screen.save()}
          loading={screen.isSubmitting}
        />
      </div>
    </PermissionGate>
  );
}
