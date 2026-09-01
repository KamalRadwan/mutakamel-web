"use client";

import Link from "next/link";
import { Users, UserPlus, Mail, CheckCircle2, Clock, ShieldCheck, PhoneCall, Ban, RefreshCw, Trash2, MoreHorizontal } from "lucide-react";
import {
  PageHeader,
  StatGrid,
  StatCard,
  FilterBar,
  DataTable,
  Badge,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
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
      sortable: true,
      sortField: "firstName",
      headerEn: t.users.staffMember,
      headerAr: t.users.staffMember,
      cell: (usr) => {
        const rowPermissions = getUserRowPermissions(currentUser, usr.id, usr.status);
        return (
          <Link href={`/users/${usr.id}`} className="flex items-center gap-2 font-semibold hover:underline">
            <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
              {usr.firstName[0]}
            </div>
            <div>
              <div className="flex items-center gap-1.5 text-foreground">
                <span>
                  {usr.firstName} {usr.lastName}
                </span>
                {rowPermissions.isSelf && <Badge tone="info">{t.users.youBadge}</Badge>}
              </div>
              <div className="flex items-center gap-1 font-mono text-xs text-muted-foreground">
                <Mail className="size-3" aria-hidden="true" />
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
          {usr.isSuperAdmin ? "Super Admin" : usr.role?.nameI18n?.[lang] || usr.role?.name || t.users.noRole}
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
            <Badge tone="success">
              <CheckCircle2 className="size-3" aria-hidden="true" />
              {t.users.active}
            </Badge>
          );
        }
        if (usr.status === "INVITED") {
          return (
            <Badge tone="warn">
              <Clock className="size-3" aria-hidden="true" />
              {t.users.invited}
            </Badge>
          );
        }
        return (
          <Badge tone={usr.status === "SUSPENDED" ? "danger" : "neutral"}>
            <Ban className="size-3" aria-hidden="true" />
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
          <span className="flex w-fit items-center gap-1 rounded-md bg-info-subtle px-2 py-0.5 font-mono text-xs text-info-subtle-foreground">
            <PhoneCall className="size-3 text-info" aria-hidden="true" />
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
        const hasActions = rowPermissions.canSuspend || rowPermissions.canActivate || rowPermissions.canDelete;
        if (!hasActions) return <span aria-hidden="true" className="text-muted-foreground">—</span>;

        return (
          <div className="flex justify-end">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="md"
                  disabled={isActionLoading}
                  aria-label={`${t.users.actions}: ${usr.firstName} ${usr.lastName}`}
                  className="size-8 p-0"
                >
                  <MoreHorizontal className="size-4" aria-hidden="true" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {rowPermissions.canSuspend && (
                  <DropdownMenuItem onSelect={() => openModal(usr.id, "suspend")} className="text-warning">
                    <Ban className="size-4" aria-hidden="true" />
                    {t.users.suspendAccount}
                  </DropdownMenuItem>
                )}
                {rowPermissions.canActivate && (
                  <DropdownMenuItem onSelect={() => openModal(usr.id, "activate")}>
                    <RefreshCw className="size-4 text-success" aria-hidden="true" />
                    {t.users.activateAccount}
                  </DropdownMenuItem>
                )}
                {rowPermissions.canDelete && (
                  <DropdownMenuItem destructive onSelect={() => openModal(usr.id, "delete")}>
                    <Trash2 className="size-4" aria-hidden="true" />
                    {t.users.delete}
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
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
            title={t.users.listAccessDeniedTitle}
            error={{
              isNormalized: true,
              httpStatus: 403,
              errorCode: "ADMIN_PERMISSION_DENIED",
              errorCategory: "AUTHORIZATION",
              message: t.users.listAccessDeniedMessage,
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
              sort={{
                sortBy,
                sortDir: sortDir === "ASC" ? "ASC" : "DESC",
                onSortChange: (nextSortBy, nextSortDir) => {
                  setSortBy(nextSortBy);
                  setSortDir(nextSortDir);
                  setPage(1);
                },
              }}
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
              ? t.users.suspendActionTitle
              : modalActionType === "activate"
                ? t.users.activateActionTitle
                : t.users.deleteActionTitle
          }
          description={
            modalActionType === "suspend"
              ? t.users.suspendActionDescription(`${activeModalUser.firstName} ${activeModalUser.lastName}`)
              : modalActionType === "activate"
                ? t.users.activateActionDescription(`${activeModalUser.firstName} ${activeModalUser.lastName}`)
                : t.users.deleteActionDescription(`${activeModalUser.firstName} ${activeModalUser.lastName}`)
          }
          targetName={`${activeModalUser.firstName} ${activeModalUser.lastName}`}
          actionType={modalActionType}
          requireNameTyping={false}
        />
      )}
    </div>
  );
}
