"use client";

import Link from "next/link";
import { Users, UserPlus, Mail, CheckCircle2, Clock, ShieldCheck, PhoneCall, Ban, RefreshCw, Trash2 } from "lucide-react";
import {
  PageHeader,
  StatGrid,
  StatCard,
  FilterBar,
  DataTable,
  Badge,
  Button,
  ErrorState,
  type ColumnDef,
} from "@/design-system";
import { useUsers } from "./hooks/useUsers";
import { DestructiveActionModal } from "@/components/shared/DestructiveActionModal";
import { useUserPermissions, getUserRowPermissions } from "./hooks/useUserPermissions";
import { useAuth } from "@/context/AuthContext";
import { InviteUserModal } from "./components/InviteUserModal";
import type { AdminUser } from "./types/adminUser";

export default function UsersDirectoryPage() {
  const {
    lang,
    t,
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    roleFilter,
    setRoleFilter,
    isSuperAdminFilter,
    setIsSuperAdminFilter,
    sortBy,
    setSortBy,
    sortDir,
    setSortDir,
    users,
    roles,
    rolesForbidden,
    summaryMetrics,
    isInviteModalOpen,
    setIsInviteModalOpen,
    activeModalUser,
    modalActionType,
    openModal,
    closeModal,
    confirmModalAction,
    isLoading,
    error,
    permissionDenied,
    isActionLoading,
    page,
    setPage,
    limit,
    setLimit,
    totalPages,
    totalCount,
    refresh,
  } = useUsers();

  const permissions = useUserPermissions();
  const { user: currentUser } = useAuth();

  const hasActiveFilters =
    Boolean(search) ||
    statusFilter !== "ALL" ||
    roleFilter !== "ALL" ||
    isSuperAdminFilter !== "ALL";

  const columns: ColumnDef<AdminUser>[] = [
    {
      key: "staffMember",
      headerEn: t.users.staffMember,
      headerAr: t.users.staffMember,
      cell: (usr) => {
        const rowPermissions = getUserRowPermissions(currentUser, usr.id, usr.status);
        return (
          <Link href={`/users/${usr.id}`} className="flex items-center gap-2 font-semibold hover:underline">
            <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-ink-200 text-xs font-semibold text-ink-700 dark:bg-ink-700 dark:text-ink-200">
              {usr.firstName[0]}
            </div>
            <div>
              <div className="flex items-center gap-1.5 text-foreground">
                <span>
                  {usr.firstName} {usr.lastName}
                </span>
                {rowPermissions.isSelf && <Badge tone="brand">{lang === "ar" ? "أنت" : "YOU"}</Badge>}
              </div>
              <div className="flex items-center gap-1 font-mono text-xs text-muted-foreground">
                <Mail className="size-3" />
                {usr.email}
              </div>
            </div>
          </Link>
        );
      },
    },
    {
      key: "role",
      headerEn: t.users.role,
      headerAr: t.users.role,
      cell: (usr) => (
        <Badge tone={usr.isSuperAdmin ? "danger" : "neutral"} className="font-mono">
          {usr.isSuperAdmin ? "Super Admin" : usr.role?.nameI18n?.[lang] || usr.role?.name || "No Role"}
        </Badge>
      ),
    },
    {
      key: "status",
      headerEn: t.users.status,
      headerAr: t.users.status,
      cell: (usr) => {
        if (usr.status === "ACTIVE") {
          return (
            <Badge tone="brand">
              <CheckCircle2 className="size-3" />
              {t.users.active}
            </Badge>
          );
        }
        if (usr.status === "INVITED") {
          return (
            <Badge tone="warn">
              <Clock className="size-3" />
              {t.users.invited}
            </Badge>
          );
        }
        return (
          <Badge tone={usr.status === "SUSPENDED" ? "danger" : "neutral"}>
            <Ban className="size-3" />
            {usr.status === "SUSPENDED" ? t.users.suspended : t.users.deactivated}
          </Badge>
        );
      },
    },
    {
      key: "sipExtension",
      headerEn: t.users.sipExtension,
      headerAr: t.users.sipExtension,
      cell: (usr) =>
        usr.webphoneExtension ? (
          <span className="flex w-fit items-center gap-1 rounded-md bg-ink-100 px-2 py-0.5 font-mono text-xs text-foreground dark:bg-ink-800">
            <PhoneCall className="size-3 text-brand-500" />
            Ext {usr.webphoneExtension}
          </span>
        ) : (
          <span className="text-xs italic text-muted-foreground">{t.users.notConfigured}</span>
        ),
    },
    {
      key: "actions",
      headerEn: t.users.actions,
      headerAr: t.users.actions,
      align: "end",
      cell: (usr) => {
        const rowPermissions = getUserRowPermissions(currentUser, usr.id, usr.status);
        return (
          <div className="flex items-center justify-end gap-1">
            {rowPermissions.canSuspend && (
              <button
                type="button"
                onClick={() => openModal(usr.id, "suspend")}
                disabled={isActionLoading}
                title={t.users.suspendAccount}
                className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-warn-50 hover:text-warn-600 disabled:opacity-50 dark:hover:bg-warn-950/40 dark:hover:text-warn-400"
              >
                <Ban className="size-3.5" />
              </button>
            )}
            {rowPermissions.canActivate && (
              <button
                type="button"
                onClick={() => openModal(usr.id, "activate")}
                disabled={isActionLoading}
                title={t.users.activateAccount}
                className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-brand-50 hover:text-brand-600 disabled:opacity-50 dark:hover:bg-brand-950/40 dark:hover:text-brand-400"
              >
                <RefreshCw className="size-3.5" />
              </button>
            )}
            {rowPermissions.canDelete && (
              <button
                type="button"
                onClick={() => openModal(usr.id, "delete")}
                disabled={isActionLoading}
                title={t.users.delete}
                className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-danger-50 hover:text-danger-600 disabled:opacity-50 dark:hover:bg-danger-950/40 dark:hover:text-danger-400"
              >
                <Trash2 className="size-3.5" />
              </button>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div className="w-full space-y-6">
      <PageHeader
        title={t.users.pageTitle}
        description={t.users.pageSubtitle}
        action={
          permissions.canInvite && (
            <Button type="button" variant="primary" onClick={() => setIsInviteModalOpen(true)}>
              <UserPlus className="size-4" />
              {t.users.inviteMember}
            </Button>
          )
        }
      />

      {permissionDenied ? (
        <div className="rounded-lg border border-border bg-card">
          <ErrorState
            title={lang === "ar" ? "وصول غير مصرح به" : "Access denied"}
            error={{
              isNormalized: true,
              httpStatus: 403,
              errorCode: "ADMIN_PERMISSION_DENIED",
              errorCategory: "AUTHORIZATION",
              message:
                lang === "ar"
                  ? "لا تملك صلاحية (admin.users.read) المطلوبة لعرض حسابات أعضاء الفريق."
                  : "You do not have the required permission (admin.users.read) to view the staff directory.",
            }}
          />
        </div>
      ) : (
        <>
          <StatGrid>
            <StatCard label={t.users.totalMembers} value={summaryMetrics.total} icon={Users} />
            <StatCard label={t.users.activeAccounts} value={summaryMetrics.active} icon={CheckCircle2} />
            <StatCard label={t.users.pendingInvites} value={summaryMetrics.invited} icon={Clock} />
            <StatCard label={t.users.superAdmins} value={summaryMetrics.superAdmins} icon={ShieldCheck} />
          </StatGrid>

          {error && (
            <div className="rounded-lg border border-border bg-card">
              <ErrorState title={error} onRetry={refresh} />
            </div>
          )}

          <div className="rounded-lg border border-border bg-card">
            <FilterBar
              fields={[
                { key: "search", type: "search", placeholderEn: t.users.searchPlaceholder, placeholderAr: t.users.searchPlaceholder },
                {
                  key: "status",
                  type: "select",
                  placeholderEn: t.users.allStatuses,
                  placeholderAr: t.users.allStatuses,
                  options: [
                    { value: "ALL", labelEn: t.users.allStatuses, labelAr: t.users.allStatuses },
                    { value: "ACTIVE", labelEn: t.users.active, labelAr: t.users.active },
                    { value: "INVITED", labelEn: t.users.invited, labelAr: t.users.invited },
                    { value: "SUSPENDED", labelEn: t.users.suspended, labelAr: t.users.suspended },
                    { value: "DEACTIVATED", labelEn: t.users.deactivated, labelAr: t.users.deactivated },
                  ],
                },
                {
                  key: "isSuperAdmin",
                  type: "select",
                  placeholderEn: t.users.allTiers,
                  placeholderAr: t.users.allTiers,
                  options: [
                    { value: "ALL", labelEn: t.users.allTiers, labelAr: t.users.allTiers },
                    { value: "TRUE", labelEn: t.users.superAdminOnly, labelAr: t.users.superAdminOnly },
                    { value: "FALSE", labelEn: t.users.nonSuperAdmin, labelAr: t.users.nonSuperAdmin },
                  ],
                },
                {
                  key: "role",
                  type: "select",
                  placeholderEn: rolesForbidden ? t.users.rolesUnavailable : t.users.allRoles,
                  placeholderAr: rolesForbidden ? t.users.rolesUnavailable : t.users.allRoles,
                  options: [
                    { value: "ALL", labelEn: t.users.allRoles, labelAr: t.users.allRoles },
                    ...(rolesForbidden
                      ? []
                      : roles.map((r) => ({ value: r.id, labelEn: r.nameI18n?.en || r.name, labelAr: r.nameI18n?.ar || r.name }))),
                  ],
                },
                {
                  key: "sortBy",
                  type: "select",
                  placeholderEn: t.users.sortBy,
                  placeholderAr: t.users.sortBy,
                  options: [
                    { value: "createdAt", labelEn: t.users.createdDate, labelAr: t.users.createdDate },
                    { value: "email", labelEn: t.users.email, labelAr: t.users.email },
                    { value: "firstName", labelEn: t.users.firstName, labelAr: t.users.firstName },
                    { value: "lastName", labelEn: t.users.lastName, labelAr: t.users.lastName },
                  ],
                },
                {
                  key: "sortDir",
                  type: "select",
                  placeholderEn: t.users.sortBy,
                  placeholderAr: t.users.sortBy,
                  options: [
                    { value: "DESC", labelEn: t.users.descending, labelAr: t.users.descending },
                    { value: "ASC", labelEn: t.users.ascending, labelAr: t.users.ascending },
                  ],
                },
              ]}
              values={{
                search,
                status: statusFilter === "ALL" ? "" : statusFilter,
                isSuperAdmin: isSuperAdminFilter === "ALL" ? "" : isSuperAdminFilter,
                role: roleFilter === "ALL" ? "" : roleFilter,
                sortBy,
                sortDir,
              }}
              onChange={(next) => {
                setSearch(typeof next.search === "string" ? next.search : "");
                setStatusFilter(typeof next.status === "string" && next.status ? next.status : "ALL");
                setIsSuperAdminFilter(typeof next.isSuperAdmin === "string" && next.isSuperAdmin ? next.isSuperAdmin : "ALL");
                setRoleFilter(typeof next.role === "string" && next.role ? next.role : "ALL");
                setSortBy(typeof next.sortBy === "string" && next.sortBy ? next.sortBy : "createdAt");
                setSortDir(typeof next.sortDir === "string" && next.sortDir ? next.sortDir : "DESC");
              }}
            />
            <DataTable
              columns={columns}
              data={users}
              isLoading={isLoading}
              getRowId={(usr) => usr.id}
              pagination={{
                page,
                limit,
                totalItems: totalCount,
                totalPages,
                onPageChange: setPage,
                onLimitChange: setLimit,
              }}
              emptyState={{
                titleEn: hasActiveFilters ? "No staff members match the selected filters." : "No admin staff users found.",
                titleAr: hasActiveFilters ? "لا تتوفر نتائج مطابقة للفلاتر المحددة." : "لا يوجد أعضاء مشرفين في النظام حالياً.",
                descriptionEn: hasActiveFilters
                  ? "Try adjusting or clearing your search filters."
                  : "Use the Invite Admin button to add your first staff member.",
                descriptionAr: hasActiveFilters
                  ? "جرب تغيير فلاتر البحث أو إلغائها."
                  : "استخدم زر (دعوة عضو جديد) لإضافة أول مشرف.",
              }}
            />
          </div>
        </>
      )}

      {isInviteModalOpen && (
        <InviteUserModal onClose={() => setIsInviteModalOpen(false)} onSuccess={refresh} />
      )}

      {modalActionType && activeModalUser && (
        <DestructiveActionModal
          isOpen={!!modalActionType}
          onClose={closeModal}
          onConfirm={confirmModalAction}
          title={
            modalActionType === "suspend"
              ? lang === "ar"
                ? "تعليق حساب المشرف"
                : "Suspend Admin User"
              : modalActionType === "activate"
                ? lang === "ar"
                  ? "تنشيط حساب المشرف"
                  : "Activate Admin User"
                : lang === "ar"
                  ? "حذف حساب المشرف"
                  : "Delete Admin User"
          }
          description={
            modalActionType === "suspend"
              ? lang === "ar"
                ? `هل أنت متأكد من تعليق حساب ${activeModalUser.firstName} ${activeModalUser.lastName}؟ سيتم إلغاء الجلسات الفعالة.`
                : `Are you sure you want to suspend ${activeModalUser.firstName} ${activeModalUser.lastName}? Active sessions will be terminated.`
              : modalActionType === "activate"
                ? lang === "ar"
                  ? `هل أنت متأكد من إعادة تنشيط حساب ${activeModalUser.firstName} ${activeModalUser.lastName}؟`
                  : `Are you sure you want to reactivate ${activeModalUser.firstName} ${activeModalUser.lastName}?`
                : lang === "ar"
                  ? `هل أنت متأكد من حذف حساب ${activeModalUser.firstName} ${activeModalUser.lastName} نهائياً؟`
                  : `Are you sure you want to delete ${activeModalUser.firstName} ${activeModalUser.lastName}?`
          }
          targetName={`${activeModalUser.firstName} ${activeModalUser.lastName}`}
          actionType={modalActionType}
          requireNameTyping={false}
        />
      )}
    </div>
  );
}
