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
          <Sparkles className="size-5 animate-spin text-brand-500" />
          <span>{lang === "ar" ? "جاري تحميل تفاصيل الدور..." : "Loading role details..."}</span>
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
              ? lang === "ar" ? "لا تملك صلاحية قراءة هذا الدور." : "You do not have permission to read this role."
              : roleError.httpStatus === 404
                ? lang === "ar" ? "لم يتم العثور على الدور." : "Role not found."
                : undefined
          }
          error={roleError}
          onRetry={reloadRole}
        />
        <div className="flex justify-center pb-6">
          <Button type="button" variant="outline" size="sm" onClick={() => router.push("/roles")}>
            {lang === "ar" ? "العودة للأدوار" : "Back to roles"}
          </Button>
        </div>
      </Card>
    );
  }

  const metadataReadOnly = !canUpdateMetadata || metadataAmbiguous;
  const permissionsReadOnly = !canReplacePermissions || permissionsAmbiguous;

  return (
    <div className="w-full space-y-6">
      <PageHeader
        title={name || (lang === "ar" ? "دور بدون اسم" : "Unnamed Role")}
        description={`ID: ${id}`}
        status={
          isSuperAdmin ? (
            <Badge tone="warn">
              <Zap className="size-3" aria-hidden="true" />
              {lang === "ar" ? "سوبر أدمن" : "Super Admin"}
            </Badge>
          ) : isSystem ? (
            <Badge tone="neutral">
              <Lock className="size-3" aria-hidden="true" />
              {lang === "ar" ? "نظام" : "System"}
            </Badge>
          ) : (
            <Badge tone="brand">{lang === "ar" ? "دور مخصص" : "Custom Role"}</Badge>
          )
        }
        action={
          <Button type="button" variant="outline" size="sm" onClick={() => router.push("/roles")}>
            {lang === "ar" ? <ArrowRight className="size-4" /> : <ArrowLeft className="size-4" />}
            {lang === "ar" ? "الأدوار" : "Roles"}
          </Button>
        }
      />

      {isSuperAdmin && (
        <div className="flex items-center justify-between gap-4 rounded-lg border border-warn-200 bg-warn-50 p-4 dark:border-warn-800/60 dark:bg-warn-950/30">
          <div className="flex items-center gap-3">
            <div className="rounded-md bg-warn-500 p-2.5 text-ink-950 shrink-0">
              <Zap className="size-5" aria-hidden="true" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">
                {lang === "ar" ? "صلاحيات المدير الفائق المطلقة" : "Full Super Admin privileges granted"}
              </h3>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {lang === "ar"
                  ? "يمتلك دور السوبر أدمن الوصول الكامل لكافة وظائف وصلاحيات النظام تلقائياً دون الحاجة لتحديد الصلاحيات يدوياً."
                  : "Super Admin roles automatically inherit full unrestricted access to every permission on the platform."}
              </p>
            </div>
          </div>
          <span className="hidden shrink-0 rounded-md bg-warn-500 px-3 py-1 text-xs font-semibold text-ink-950 sm:inline-flex">
            {catalogueLength} / {catalogueLength} {lang === "ar" ? "ممررة" : "granted"}
          </span>
        </div>
      )}

      {isSystem && !isSuperAdmin && (
        <div className="flex gap-3 rounded-lg border border-border bg-ink-50 p-4 text-foreground dark:bg-ink-900/40">
          <Info className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
          <div className="text-xs">
            <h4 className="mb-1 font-semibold">{lang === "ar" ? "دور مدمج بالنظام" : "Protected system role"}</h4>
            <p className="leading-relaxed text-muted-foreground">
              {lang === "ar"
                ? "أدوار النظام الأساسية محمية ضد التعديل أو الحذف لضمان استقرار العمليات المركزية."
                : "System roles are protected baseline roles and cannot be manually modified or deleted."}
            </p>
          </div>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <ShieldAlert className="size-4 text-brand-500" aria-hidden="true" />
            {lang === "ar" ? "المعلومات الأساسية للدور" : "Role general information"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {metadataAmbiguous && (
            <AmbiguousOutcomePanel
              idempotencyKey={metadataIdempotencyKey}
              correlationId={metadataError?.correlationId}
              message={
                lang === "ar"
                  ? "نتيجة التحديث غير مؤكدة. أعد المحاولة بنفس البيانات والمفتاح."
                  : "Update outcome is unconfirmed. Retry the exact data and command key."
              }
              onRetryExact={() => void saveMetadata()}
              retrying={isSavingMetadata}
            />
          )}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field label={lang === "ar" ? "اسم الدور" : "Role Name"} error={nameError ?? undefined}>
              {(fieldProps) => (
                <Input
                  {...fieldProps}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={metadataReadOnly}
                  minLength={2}
                  maxLength={120}
                />
              )}
            </Field>
            <Field label={lang === "ar" ? "الوصف" : "Description"} error={descriptionError ?? undefined}>
              {(fieldProps) => (
                <Textarea
                  {...fieldProps}
                  value={description}
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
          <CardFooter className="justify-end">
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={() => void saveMetadata()}
              disabled={isSavingMetadata || !metadataDirty || Boolean(nameError || descriptionError)}
              loading={isSavingMetadata}
            >
              <Save className="size-3.5" />
              {metadataAmbiguous
                ? lang === "ar" ? "إعادة التحديث بنفس العملية" : "Retry exact update"
                : lang === "ar" ? "حفظ بيانات الدور" : "Save role details"}
            </Button>
          </CardFooter>
        )}
      </Card>

      <Card className="overflow-hidden">
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-4 space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2 text-sm">
              <ShieldCheck className="size-4 text-brand-500" aria-hidden="true" />
              {lang === "ar" ? "مصفوفة الصلاحيات" : "Permissions matrix"}
            </CardTitle>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {permissionsReadOnly
                ? lang === "ar"
                  ? "عرض فقط؛ يلزم admin.roles.update وadmin.roles.critical للاستبدال."
                  : "Read-only; replacement requires admin.roles.update and admin.roles.critical."
                : lang === "ar"
                  ? "راجع التحديد ثم احفظ مجموعة الصلاحيات كاملة."
                  : "Review the selection, then explicitly save the complete permission set."}
            </p>
          </div>
          <div className="flex w-full items-center gap-3 sm:w-auto">
            <div className="relative w-full sm:w-72">
              <Search className="pointer-events-none absolute start-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                placeholder={lang === "ar" ? "ابحث عن الصلاحية..." : "Search permissions..."}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="ps-9"
              />
            </div>
            <Badge tone="brand" className="shrink-0 px-3 py-1.5">
              {assignedPermissions.size} {lang === "ar" ? "محددة" : "selected"}
            </Badge>
          </div>
        </CardHeader>

        {isCatalogueLoading && (
          <div className="flex items-center gap-2 border-b border-border p-4 text-xs text-muted-foreground">
            <Sparkles className="size-3.5 animate-spin" />
            {lang === "ar" ? "جاري تحميل دليل الصلاحيات..." : "Loading the permission catalogue..."}
          </div>
        )}

        {catalogueError && (
          <div className="m-4">
            <ErrorState
              title={
                catalogueError.httpStatus === 403
                  ? lang === "ar" ? "لا تملك admin.permissions.read." : "admin.permissions.read is unavailable."
                  : undefined
              }
              error={catalogueError}
              onRetry={reloadCatalogue}
            />
          </div>
        )}

        {permissionsError && (
          <div className="m-4">
            <AmbiguousOutcomePanel
              idempotencyKey={permissionsAmbiguous ? permissionsIdempotencyKey : undefined}
              correlationId={permissionsAmbiguous ? permissionsError.correlationId : undefined}
              message={
                permissionsAmbiguous
                  ? lang === "ar"
                    ? "نتيجة الاستبدال غير مؤكدة. أعد العملية نفسها دون تغيير التحديد."
                    : "Replacement outcome is unconfirmed. Retry the unchanged permission set."
                  : permissionsError.message
              }
              onRetryExact={permissionsAmbiguous ? () => void savePermissions() : undefined}
              retrying={isSavingPermissions}
            />
          </div>
        )}

        <div className="divide-y divide-border">
          {Object.entries(groupedPermissions).map(([groupName, perms]) => {
            const checkedCount = perms.filter((p) => assignedPermissions.has(p.id)).length;
            const isAllChecked = perms.length > 0 && checkedCount === perms.length;

            return (
              <div key={groupName} className="space-y-3 p-4">
                <div className="flex items-center justify-between rounded-md border border-border bg-ink-50 p-3 dark:bg-ink-900/40">
                  <div className="flex items-center gap-2.5">
                    <span className="size-2 shrink-0 rounded-full bg-brand-500" />
                    <h3 className="text-xs font-semibold text-foreground">{groupName}</h3>
                    <Badge tone="neutral">
                      {checkedCount} / {perms.length}
                    </Badge>
                  </div>
                  {!permissionsReadOnly && (
                    <button
                      type="button"
                      onClick={() => toggleGroup(groupName, !isAllChecked)}
                      className="text-xs font-semibold text-brand-700 hover:underline dark:text-brand-400"
                    >
                      {isAllChecked
                        ? lang === "ar" ? "إلغاء تحديد الكل" : "Deselect all"
                        : lang === "ar" ? "تحديد الكل" : "Select all"}
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3">
                  {perms.map((p) => {
                    const isChecked = assignedPermissions.has(p.id) || isSuperAdmin;
                    const isCritical = p.key.includes(".critical");
                    return (
                      <label
                        key={p.id}
                        className={`flex items-start justify-between gap-2 rounded-md border p-3 transition-colors ${
                          isChecked
                            ? "border-brand-300 bg-brand-500/5 dark:border-brand-700/60"
                            : "border-border bg-card"
                        } ${!permissionsReadOnly ? "cursor-pointer hover:border-brand-400" : "opacity-90"}`}
                      >
                        <span className="flex flex-wrap items-center gap-1.5 text-xs font-medium text-foreground">
                          {getPermissionName(p, lang as "ar" | "en")}
                          {isCritical && <Badge tone="danger">{lang === "ar" ? "حرج" : "CRITICAL"}</Badge>}
                        </span>
                        <Checkbox
                          checked={isChecked}
                          onCheckedChange={() => togglePermission(p.id)}
                          disabled={permissionsReadOnly}
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
              {permissionsAmbiguous
                ? lang === "ar" ? "إعادة الاستبدال بنفس العملية" : "Retry exact replacement"
                : lang === "ar" ? "حفظ مجموعة الصلاحيات" : "Save permission set"}
            </Button>
          </CardFooter>
        )}
      </Card>
    </div>
  );
}
