"use client";

import Link from "next/link";
import { ShieldCheck, Plus, Trash2, Lock, Edit2, Eye } from "lucide-react";
import {
  PageHeader,
  StatGrid,
  StatCard,
  FilterBar,
  DataTable,
  Badge,
  Button,
  ErrorState,
  DegradedBanner,
  type ColumnDef,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { localeForLanguage } from "@/i18n/locale";
import { useRoles } from "./hooks/useRoles";
import { DestructiveActionModal } from "@/components/shared/DestructiveActionModal";
import { CreateRoleModal } from "./components/CreateRoleModal";
import { useAuth } from "@/context/AuthContext";
import { adminCan, adminCanAll, ADMIN_RBAC_CRITICAL } from "@/lib/auth/rbac";
import type { AdminRole } from "./hooks/useRoles";

export default function RolesDirectoryPage() {
  const {
    search,
    setSearch,
    isSystemFilter,
    setIsSystemFilter,
    roles,
    rolesOnPage,
    totalItems,
    totalPages,
    page,
    pageSize,
    setPage,
    isCreateModalOpen,
    setIsCreateModalOpen,
    activeModalRole,
    isDeleteModalOpen,
    closeDeleteModal,
    openDeleteModal,
    confirmDelete,
    refreshRoles,
    isLoading,
    listError,
    isDeleting,
    isDeleteAmbiguous,
    t,
  } = useRoles();
  const { lang } = useI18n();

  const { user } = useAuth();
  const canUpdate = adminCan(user, "admin.roles.update");
  const canCreate = adminCanAll(user, ADMIN_RBAC_CRITICAL.ROLES_CREATE);
  const canDelete = adminCanAll(user, ADMIN_RBAC_CRITICAL.ROLES_DELETE);

  const columns: ColumnDef<AdminRole>[] = [
    {
      key: "name",
      headerEn: t.roles.roleName,
      headerAr: t.roles.roleName,
      cell: (role) => (
        <div>
          <Link href={`/roles/${role.id}`} className="font-semibold text-primary hover:underline">
            {role.name}
          </Link>
          {role.description && (
            <div className="mt-0.5 max-w-xs truncate text-xs text-muted-foreground">{role.description}</div>
          )}
        </div>
      ),
    },
    {
      key: "isSystem",
      headerEn: t.roles.systemStatus,
      headerAr: t.roles.systemStatus,
      cell: (role) =>
        role.isSystem ? (
          <Badge tone="neutral">
            <Lock className="size-3" aria-hidden="true" />
            {t.roles.badgeSystem}
          </Badge>
        ) : (
          <Badge tone="brand">{t.roles.custom}</Badge>
        ),
    },
    {
      key: "createdAt",
      headerEn: t.roles.createdAt,
      headerAr: t.roles.createdAt,
      cell: (role) =>
        new Date(role.createdAt).toLocaleDateString(localeForLanguage(lang), {
          year: "numeric",
          month: "short",
          day: "numeric",
        }),
    },
    {
      key: "actions",
      headerEn: t.roles.actions,
      headerAr: t.roles.actions,
      align: "end",
      cell: (role) => (
        <div className="flex items-center justify-end gap-1">
          <Link
            href={`/roles/${role.id}`}
            title={canUpdate ? t.roles.edit : t.roles.view}
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground motion-reduce:transition-none"
          >
            {canUpdate ? <Edit2 className="size-3.5" /> : <Eye className="size-3.5" />}
          </Link>
          {!role.isSystem && canDelete && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => openDeleteModal(role.id)}
              aria-label={t.roles.delete}
              className="size-8 p-0 text-destructive hover:bg-destructive-subtle hover:text-destructive-subtle-foreground"
            >
              <Trash2 className="size-3.5" aria-hidden="true" />
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="w-full space-y-6">
      <PageHeader
        title={t.roles.pageTitle}
        description={t.roles.pageSubtitle}
        action={
          canCreate && (
            <Button type="button" variant="primary" onClick={() => setIsCreateModalOpen(true)}>
              <Plus className="size-4" />
              {t.roles.createRole}
            </Button>
          )
        }
      />

      <StatGrid className="sm:grid-cols-3">
        <StatCard label={t.roles.statTotalRoles} value={totalItems} icon={ShieldCheck} />
        <StatCard
          label={t.roles.statSystemVisible}
          value={roles.filter((r) => r.isSystem).length}
          icon={Lock}
        />
        <StatCard
          label={t.roles.statCustomVisible}
          value={roles.filter((r) => !r.isSystem).length}
          icon={Edit2}
        />
      </StatGrid>

      {listError && rolesOnPage.length > 0 && (
        <DegradedBanner>
          <p className="font-medium">
            {listError.httpStatus === 403 ? t.roles.forbiddenList : t.roles.refreshFailed}
          </p>
          <Button type="button" variant="ghost" size="sm" className="mt-1 -ms-2" onClick={refreshRoles}>
            {t.roles.retry}
          </Button>
        </DegradedBanner>
      )}

      {listError && rolesOnPage.length === 0 ? (
        <div className="rounded-lg border border-border bg-card">
          <ErrorState error={listError} onRetry={refreshRoles} />
        </div>
      ) : (
        <div className="space-y-0 rounded-lg border border-border bg-card">
          <FilterBar
            fields={[
              { key: "search", type: "search", placeholderEn: t.roles.searchPlaceholder, placeholderAr: t.roles.searchPlaceholder },
              {
                key: "isSystem",
                type: "select",
                placeholderEn: t.roles.allTypes,
                placeholderAr: t.roles.allTypes,
                options: [
                  { value: "ALL", labelEn: t.roles.allTypes, labelAr: t.roles.allTypes },
                  { value: "TRUE", labelEn: t.roles.systemRoles, labelAr: t.roles.systemRoles },
                  { value: "FALSE", labelEn: t.roles.customRoles, labelAr: t.roles.customRoles },
                ],
              },
            ]}
            values={{ search, isSystem: isSystemFilter === "ALL" ? "" : isSystemFilter }}
            onChange={(next) => {
              setSearch(typeof next.search === "string" ? next.search : "");
              setIsSystemFilter(typeof next.isSystem === "string" && next.isSystem ? next.isSystem : "ALL");
            }}
          />
          <DataTable
            columns={columns}
            data={roles}
            isLoading={isLoading}
            getRowId={(role) => role.id}
            pagination={{ page, limit: pageSize, totalItems, totalPages, onPageChange: setPage }}
            emptyState={{
              titleEn: "No roles match your search.",
              titleAr: "لا توجد أدوار مطابقة للبحث.",
            }}
          />
        </div>
      )}

      {isCreateModalOpen && (
        <CreateRoleModal onClose={() => setIsCreateModalOpen(false)} onSuccess={refreshRoles} />
      )}

      {isDeleteModalOpen && activeModalRole && (
        <DestructiveActionModal
          isOpen={isDeleteModalOpen}
          onClose={closeDeleteModal}
          onConfirm={confirmDelete}
          isSubmitting={isDeleting}
          confirmLabel={isDeleteAmbiguous ? t.roles.retryExactDelete : undefined}
          title={t.roles.deleteRoleTitle}
          description={t.roles.deleteRoleDescription}
          targetName={activeModalRole.name}
          actionType="delete"
        />
      )}
    </div>
  );
}
