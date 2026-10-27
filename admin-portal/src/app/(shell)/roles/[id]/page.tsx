"use client";

import { use } from "react";
import { ArrowLeft, ArrowRight, ShieldAlert, Save, Lock, Search, Info, ShieldCheck, Zap, Sparkles } from "lucide-react";
import {
  PageHeader,
  Badge,
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
  Field,
  Input,
  Textarea,
  Checkbox,
  ErrorState,
  AmbiguousOutcomePanel,
} from "@/design-system";
import { useRoleDetail } from "../hooks/useRoleDetail";
import { getPermissionName } from "@/lib/auth/rbac";

export default function RoleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const {
    lang,
    t,
    router,
    role,
    roleError,
    reloadRole,
    name,
    setName,
    description,
    setDescription,
    nameError,
    descriptionError,
    metadataDirty,
    permissionsDirty,
    isSystem,
    isSuperAdmin,
    canUpdateMetadata,
    canReplacePermissions,
    delegablePermissionIds,
    permissionsDelegationBlocked,
    search,
    setSearch,
    groupedPermissions,
    assignedPermissions,
    catalogueLength,
    catalogueError,
    isCatalogueLoading,
    reloadCatalogue,
    isSavingMetadata,
    isSavingPermissions,
    isLoading,
    metadataError,
    permissionsError,
    metadataAmbiguous,
    permissionsAmbiguous,
    metadataIdempotencyKey,
    permissionsIdempotencyKey,
    saveMetadata,
    savePermissions,
    togglePermission,
    toggleGroup,
  } = useRoleDetail(id);

  if (isLoading) {
    return (
      <div className="grid place-items-center py-16">
        <div className="flex items-center gap-3 text-muted-foreground">
          <Sparkles className="size-5 animate-spin text-info motion-reduce:animate-none" aria-hidden="true" />
          <span>{t.roles.loadingDetail}</span>
        </div>
      </div>
    );
  }

  if (roleError && !role) {
    return (
      <Card>
        <ErrorState
          title={
            roleError.httpStatus === 403
              ? t.roles.forbiddenDetail
              : roleError.httpStatus === 404
                ? t.roles.notFoundDetail
                : undefined
          }
          error={roleError}
          onRetry={reloadRole}
        />
        <div className="flex justify-center pb-6">
          <Button type="button" variant="outline" size="sm" onClick={() => router.push("/roles")}>
            {t.roles.backToRoles}
          </Button>
        </div>
      </Card>
    );
  }

  const metadataReadOnly = !canUpdateMetadata || metadataAmbiguous;
  const permissionsReadOnly = !canReplacePermissions || permissionsAmbiguous;

  return (
    <div className="w-full space-y-3">
      <PageHeader
        title={name || t.roles.unnamedRole}
        description={`ID: ${id}`}
        status={
          isSuperAdmin ? (
            <Badge tone="warn">
              <Zap className="size-3" aria-hidden="true" />
              {t.roles.superAdminBadge}
            </Badge>
          ) : isSystem ? (
            <Badge tone="neutral">
              <Lock className="size-3" aria-hidden="true" />
              {t.roles.badgeSystem}
            </Badge>
          ) : (
            <Badge tone="brand">{t.roles.customRoleBadge}</Badge>
          )
        }
        action={
          <Button type="button" variant="outline" size="sm" onClick={() => router.push("/roles")}>
            {lang === "ar" ? <ArrowRight className="size-3.5" /> : <ArrowLeft className="size-3.5" />}
            {t.roles.rolesNavLabel}
          </Button>
        }
      />

      {isSuperAdmin && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-warning/30 bg-warning-subtle p-3 text-warning-subtle-foreground">
          <div className="flex items-center gap-2.5">
            <div className="shrink-0 rounded-md bg-warning p-2 text-warning-foreground">
              <Zap className="size-4" aria-hidden="true" />
            </div>
            <div>
              <h3 className="text-xs font-semibold text-foreground">
                {t.roles.superAdminGrantedTitle}
              </h3>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {t.roles.superAdminGrantedDesc}
              </p>
            </div>
          </div>
          <span className="hidden shrink-0 rounded-md bg-warning px-2.5 py-1 text-xs font-semibold text-warning-foreground sm:inline-flex">
            {catalogueLength} / {catalogueLength} {t.roles.grantedSuffix}
          </span>
        </div>
      )}

      {isSystem && !isSuperAdmin && (
        <div className="flex gap-2.5 rounded-lg border border-border bg-muted/40 p-3 text-foreground">
          <Info className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <div className="text-xs">
            <h4 className="mb-0.5 font-semibold">{t.roles.protectedSystemTitle}</h4>
            <p className="leading-relaxed text-muted-foreground">
              {t.roles.protectedSystemDesc}
            </p>
          </div>
        </div>
      )}

      <Card>
        <CardHeader className="p-3 sm:p-3.5 pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <ShieldAlert className="size-4 text-info" aria-hidden="true" />
            {t.roles.generalInfoTitle}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3 sm:p-3.5 pt-0 space-y-2.5">
          {metadataAmbiguous && (
            <AmbiguousOutcomePanel
              idempotencyKey={metadataIdempotencyKey}
              correlationId={metadataError?.correlationId}
              message={t.roles.metadataAmbiguousMessage}
              onRetryExact={() => void saveMetadata()}
              retrying={isSavingMetadata}
            />
          )}
          <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
            <Field label={t.roles.roleNameLabel} hideLabel error={nameError ?? undefined}>
              {(fieldProps) => (
                <Input
                  {...fieldProps}
                  size="sm"
                  value={name}
                  placeholder={`${t.roles.roleNameLabel} *`}
                  onChange={(e) => setName(e.target.value)}
                  disabled={metadataReadOnly}
                  minLength={2}
                  maxLength={120}
                />
              )}
            </Field>
            <Field label={t.roles.descriptionLabel} hideLabel error={descriptionError ?? undefined}>
              {(fieldProps) => (
                <Textarea
                  {...fieldProps}
                  value={description}
                  placeholder={t.roles.descriptionLabel}
                  onChange={(e) => setDescription(e.target.value)}
                  disabled={metadataReadOnly}
                  maxLength={2_001}
                  rows={2}
                />
              )}
            </Field>
          </div>
        </CardContent>
        {canUpdateMetadata && (
          <CardFooter className="p-3 sm:p-3.5 pt-0 justify-end">
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={() => void saveMetadata()}
              disabled={isSavingMetadata || !metadataDirty || Boolean(nameError || descriptionError)}
              loading={isSavingMetadata}
            >
              <Save className="size-3.5" />
              {metadataAmbiguous ? t.roles.retryExactUpdate : t.roles.saveRoleDetails}
            </Button>
          </CardFooter>
        )}
      </Card>

      <Card className="overflow-hidden">
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-4 space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2 text-sm">
              <ShieldCheck className="size-4 text-info" aria-hidden="true" />
              {t.roles.permissionsMatrixTitle}
            </CardTitle>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {permissionsDelegationBlocked
                ? t.roles.protectedPermissionSetHint
                : permissionsReadOnly
                  ? t.roles.permissionsReadOnlyHint
                  : t.roles.permissionsEditableHint}
            </p>
          </div>
          <div className="flex w-full items-center gap-3 sm:w-auto">
            <div className="relative w-full sm:w-72">
              <Search className="pointer-events-none absolute start-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                size="sm"
                placeholder={t.roles.searchPermissionsPlaceholder}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="ps-9"
              />
            </div>
            <Badge tone="brand" className="shrink-0 px-3 py-1.5">
              {assignedPermissions.size} {t.roles.selectedSuffix}
            </Badge>
          </div>
        </CardHeader>

        {isCatalogueLoading && (
          <div className="flex items-center gap-2 border-b border-border p-3 text-xs text-muted-foreground">
            <Sparkles className="size-3.5 animate-spin motion-reduce:animate-none" aria-hidden="true" />
            {t.roles.loadingCatalogue}
          </div>
        )}

        {catalogueError && (
          <div className="m-3">
            <ErrorState
              title={catalogueError.httpStatus === 403 ? t.roles.catalogueForbidden : undefined}
              error={catalogueError}
              onRetry={reloadCatalogue}
            />
          </div>
        )}

        {permissionsError && (
          <div className="m-3">
            <AmbiguousOutcomePanel
              idempotencyKey={permissionsAmbiguous ? permissionsIdempotencyKey : undefined}
              correlationId={permissionsAmbiguous ? permissionsError.correlationId : undefined}
              message={
                permissionsAmbiguous ? t.roles.permissionsAmbiguousMessage : permissionsError.message
              }
              onRetryExact={permissionsAmbiguous ? () => void savePermissions() : undefined}
              retrying={isSavingPermissions}
            />
          </div>
        )}

        <div className="divide-y divide-border">
          {Object.entries(groupedPermissions).map(([groupName, perms]) => {
            const checkedCount = perms.filter((p) => assignedPermissions.has(p.id)).length;
            const delegable = perms.filter((p) => delegablePermissionIds.has(p.id));
            const isAllChecked =
              delegable.length > 0 && delegable.every((p) => assignedPermissions.has(p.id));

            return (
              <div key={groupName} className="space-y-3 p-3 sm:p-3.5">
                <div className="flex items-center justify-between rounded-md border border-border bg-muted/40 p-2.5">
                  <div className="flex items-center gap-2.5">
                    <span className="size-2 shrink-0 rounded-full bg-primary" aria-hidden="true" />
                    <h3 className="text-xs font-semibold text-foreground">{groupName}</h3>
                    <Badge tone="neutral">
                      {checkedCount} / {perms.length}
                    </Badge>
                  </div>
                  {!permissionsReadOnly && (
                    <Button
                      type="button"
                      variant="link"
                      size="sm"
                      disabled={delegable.length === 0}
                      onClick={() => toggleGroup(groupName, !isAllChecked)}
                      className="h-auto px-1.5 py-1 text-xs font-semibold"
                    >
                      {isAllChecked ? t.roles.deselectAll : t.roles.selectAll}
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3">
                  {perms.map((p) => {
                    const isChecked = assignedPermissions.has(p.id) || isSuperAdmin;
                    const isCritical = p.key.includes(".critical");
                    const isDelegable = delegablePermissionIds.has(p.id);
                    const isDisabled = permissionsReadOnly || !isDelegable;
                    const reasonId = `permission-delegation-${p.id}`;
                    return (
                      <label
                        key={p.id}
                        className={`flex items-start justify-between gap-2 rounded-md border p-2 sm:p-2.5 transition-colors motion-reduce:transition-none ${
                          isChecked
                            ? "border-primary/40 bg-selected"
                            : "border-border bg-card"
                        } ${!isDisabled ? "cursor-pointer hover:border-primary/50" : "cursor-not-allowed opacity-90"}`}
                      >
                        <span className="flex flex-wrap items-center gap-1.5 text-xs font-medium text-foreground">
                          {getPermissionName(p, lang as "ar" | "en")}
                          {isCritical && <Badge tone="danger">{t.roles.criticalBadge}</Badge>}
                          {!isDelegable && (
                            <span id={reasonId} className="w-full text-xs font-normal text-muted-foreground">
                              {t.roles.permissionNotDelegableHint}
                            </span>
                          )}
                        </span>
                        <Checkbox
                          checked={isChecked}
                          onCheckedChange={() => togglePermission(p.id)}
                          disabled={isDisabled}
                          aria-label={getPermissionName(p, lang as "ar" | "en")}
                          aria-describedby={!isDelegable ? reasonId : undefined}
                          className="mt-0.5 shrink-0"
                        />
                      </label>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {canReplacePermissions && !catalogueError && !isCatalogueLoading && (
          <CardFooter className="justify-end">
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={() => void savePermissions()}
              disabled={isSavingPermissions || !permissionsDirty}
              loading={isSavingPermissions}
            >
              <ShieldCheck className="size-3.5" />
              {permissionsAmbiguous ? t.roles.retryExactReplace : t.roles.savePermissionSet}
            </Button>
          </CardFooter>
        )}
      </Card>
    </div>
  );
}
