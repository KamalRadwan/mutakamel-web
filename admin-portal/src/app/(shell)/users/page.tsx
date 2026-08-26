"use client";

import Link from "next/link";
import { Navbar } from "@/components/layout/Navbar";
import {
  Users,
  Search,
  UserPlus,
  Mail,
  ShieldCheck,
  PhoneCall,
  CheckCircle2,
  Clock,
  Ban,
  Trash2,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useUsers } from "./hooks/useUsers";
import { DestructiveActionModal } from "@/components/shared/DestructiveActionModal";
import { useUserPermissions, getUserRowPermissions } from "./hooks/useUserPermissions";
import { useAuth } from "@/context/AuthContext";
import { InviteUserModal } from "./components/InviteUserModal";
import { UsersTableSkeleton } from "./components/UsersTableSkeleton";
import { UsersPermissionDenied } from "./components/UsersPermissionDenied";
import { UsersErrorState } from "./components/UsersErrorState";
import { UsersEmptyState } from "./components/UsersEmptyState";

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

  const startRecord = totalCount > 0 ? (page - 1) * limit + 1 : 0;
  const endRecord = Math.min(page * limit, totalCount);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-canvas text-slate-900 dark:text-slate-100 flex flex-col">
      <Navbar />

      <main className="flex-1 space-y-6 w-full px-4 py-4 sm:py-6">
        {/* Header Title Section */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 px-4 py-3 sm:px-5 sm:py-3.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div>
            <h1 className="text-base sm:text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span>{t.users.pageTitle}</span>
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-tight">
              {t.users.pageSubtitle}
            </p>
          </div>

          {permissions.canInvite && (
            <button
              onClick={() => setIsInviteModalOpen(true)}
              className="px-3.5 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-md shadow-blue-600/20 transition-colors flex items-center gap-1.5 cursor-pointer ms-auto sm:ms-0"
            >
              <UserPlus className="w-4 h-4" />
              <span>{t.users.inviteMember}</span>
            </button>
          )}
        </div>

        {permissionDenied ? (
          <UsersPermissionDenied />
        ) : error ? (
          <UsersErrorState message={error} onRetry={refresh} />
        ) : isLoading ? (
          <UsersTableSkeleton />
        ) : (
          <>
            {/* Metric Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center border border-blue-100 dark:border-blue-800 shrink-0">
                  <Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <span className="block text-lg font-semibold text-slate-900 dark:text-slate-100">
                    {summaryMetrics.total}
                  </span>
                  <span className="block text-xs text-slate-500 font-medium">
                    {t.users.totalMembers}
                  </span>
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center border border-emerald-100 dark:border-emerald-800 shrink-0">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <span className="block text-lg font-semibold text-slate-900 dark:text-slate-100">
                    {summaryMetrics.active}
                  </span>
                  <span className="block text-xs text-slate-500 font-medium">
                    {t.users.activeAccounts}
                  </span>
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center border border-amber-100 dark:border-amber-800 shrink-0">
                  <Clock className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <span className="block text-lg font-semibold text-slate-900 dark:text-slate-100">
                    {summaryMetrics.invited}
                  </span>
                  <span className="block text-xs text-slate-500 font-medium">
                    {t.users.pendingInvites}
                  </span>
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-red-50 dark:bg-red-900/30 flex items-center justify-center border border-red-100 dark:border-red-800 shrink-0">
                  <ShieldCheck className="w-5 h-5 text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <span className="block text-lg font-semibold text-slate-900 dark:text-slate-100">
                    {summaryMetrics.superAdmins}
                  </span>
                  <span className="block text-xs text-slate-500 font-medium">
                    {t.users.superAdmins}
                  </span>
                </div>
              </div>
            </div>

            {/* Search & Filter Bar */}
            <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs flex flex-col gap-3">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="relative w-full sm:w-80">
                  <Search className="w-4 h-4 text-slate-400 absolute top-3 start-3" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder={t.users.searchPlaceholder}
                    className="w-full ps-9 pe-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-600"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-600 cursor-pointer"
                  >
                    <option value="ALL">{t.users.allStatuses}</option>
                    <option value="ACTIVE">{t.users.active}</option>
                    <option value="INVITED">{t.users.invited}</option>
                    <option value="SUSPENDED">{t.users.suspended}</option>
                    <option value="DEACTIVATED">{t.users.deactivated}</option>
                  </select>

                  <select
                    value={isSuperAdminFilter}
                    onChange={(e) => setIsSuperAdminFilter(e.target.value)}
                    className="px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-600 cursor-pointer"
                  >
                    <option value="ALL">{t.users.allTiers}</option>
                    <option value="TRUE">{t.users.superAdminOnly}</option>
                    <option value="FALSE">{t.users.nonSuperAdmin}</option>
                  </select>

                  <select
                    value={roleFilter}
                    onChange={(e) => setRoleFilter(e.target.value)}
                    disabled={rolesForbidden}
                    className="px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-600 cursor-pointer max-w-[150px] truncate disabled:opacity-50"
                  >
                    <option value="ALL">
                      {rolesForbidden ? t.users.rolesUnavailable : t.users.allRoles}
                    </option>
                    {!rolesForbidden &&
                      roles.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.nameI18n?.[lang] || r.name}
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 dark:border-slate-800/60 pt-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500 font-semibold">{t.users.sortBy}</span>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="px-2 py-1 text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-600 cursor-pointer"
                  >
                    <option value="createdAt">{t.users.createdDate}</option>
                    <option value="email">{t.users.email}</option>
                    <option value="firstName">{t.users.firstName}</option>
                    <option value="lastName">{t.users.lastName}</option>
                  </select>
                  <select
                    value={sortDir}
                    onChange={(e) => setSortDir(e.target.value)}
                    className="px-2 py-1 text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-600 cursor-pointer"
                  >
                    <option value="DESC">{t.users.descending}</option>
                    <option value="ASC">{t.users.ascending}</option>
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500 font-medium">
                    {t.users.showingCountOfTotal
                      .replace("{from}", startRecord.toString())
                      .replace("{to}", endRecord.toString())
                      .replace("{total}", totalCount.toString())}
                  </span>
                  <select
                    value={limit}
                    onChange={(e) => setLimit(Number(e.target.value))}
                    className="px-2 py-1 text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-600 cursor-pointer"
                  >
                    <option value={10}>10 / page</option>
                    <option value={20}>20 / page</option>
                    <option value={50}>50 / page</option>
                    <option value={100}>100 / page</option>
                  </select>
                </div>
              </div>
            </div>

            {/* High-Density Data Table */}
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-start">
                  <thead>
                    <tr className="bg-slate-50/80 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider">
                      <th className="py-3 px-4 text-start">{t.users.staffMember}</th>
                      <th className="py-3 px-4 text-start">{t.users.role}</th>
                      <th className="py-3 px-4 text-start">{t.users.status}</th>
                      <th className="py-3 px-4 text-start">{t.users.sipExtension}</th>
                      <th className="py-3 px-4 text-end">{t.users.actions}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                    {users.length === 0 ? (
                      <tr>
                        <td colSpan={5}>
                          <UsersEmptyState hasFilters={hasActiveFilters} />
                        </td>
                      </tr>
                    ) : (
                      users.map((usr) => {
                        const rowPermissions = getUserRowPermissions(currentUser, usr.id, usr.status);

                        return (
                          <tr
                            key={usr.id}
                            className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors h-12 group ${
                              rowPermissions.isSelf ? "bg-blue-50/20 dark:bg-blue-950/10" : ""
                            }`}
                          >
                            <td className="py-2.5 px-4">
                              <Link
                                href={`/users/${usr.id}`}
                                className="font-semibold text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-2"
                              >
                                <div className="w-7 h-7 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-200 font-semibold text-xs shrink-0">
                                  {usr.firstName[0]}
                                </div>
                                <div>
                                  <div className="text-slate-900 dark:text-slate-100 font-semibold flex items-center gap-1.5">
                                    <span>
                                      {usr.firstName} {usr.lastName}
                                    </span>
                                    {rowPermissions.isSelf && (
                                      <span className="px-1.5 py-0.2 rounded text-xs bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-300 font-mono">
                                        YOU
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-xs text-slate-500 font-mono flex items-center gap-1">
                                    <Mail className="w-3 h-3 text-slate-400" />
                                    {usr.email}
                                  </div>
                                </div>
                              </Link>
                            </td>
                            <td className="py-2.5 px-4 font-mono text-xs">
                              <span
                                className={`px-2 py-0.5 rounded-md font-medium border ${
                                  usr.isSuperAdmin
                                    ? "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800"
                                    : "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800"
                                }`}
                              >
                                {usr.isSuperAdmin
                                  ? "Super Admin"
                                  : usr.role?.nameI18n?.[lang] || usr.role?.name || "No Role"}
                              </span>
                            </td>
                            <td className="py-2.5 px-4">
                              {usr.status === "ACTIVE" && (
                                <span className="flex items-center gap-1 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 dark:bg-emerald-900/30 dark:border-emerald-800 dark:text-emerald-400 px-2 py-0.5 rounded-md w-fit font-medium">
                                  <CheckCircle2 className="w-3 h-3" />
                                  {t.users.active}
                                </span>
                              )}
                              {usr.status === "INVITED" && (
                                <span className="flex items-center gap-1 text-xs text-amber-700 bg-amber-50 border border-amber-200 dark:bg-amber-900/30 dark:border-amber-800 dark:text-amber-400 px-2 py-0.5 rounded-md w-fit font-medium">
                                  <Clock className="w-3 h-3" />
                                  {t.users.invited}
                                </span>
                              )}
                              {usr.status === "SUSPENDED" && (
                                <span className="flex items-center gap-1 text-xs text-red-700 bg-red-50 border border-red-200 dark:bg-red-900/30 dark:border-red-800 dark:text-red-400 px-2 py-0.5 rounded-md w-fit font-medium">
                                  <Ban className="w-3 h-3" />
                                  {t.users.suspended}
                                </span>
                              )}
                              {usr.status === "DEACTIVATED" && (
                                <span className="flex items-center gap-1 text-xs text-slate-600 bg-slate-100 border border-slate-200 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400 px-2 py-0.5 rounded-md w-fit font-medium">
                                  <Ban className="w-3 h-3" />
                                  {t.users.deactivated}
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-4 text-xs font-mono text-slate-500">
                              {usr.webphoneExtension ? (
                                <span className="flex items-center gap-1 text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md w-fit">
                                  <PhoneCall className="w-3 h-3 text-blue-500" />
                                  Ext {usr.webphoneExtension}
                                </span>
                              ) : (
                                <span className="text-slate-400 italic text-xs">
                                  {t.users.notConfigured}
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-4 text-end">
                              <div className="flex items-center justify-end gap-1">
                                {rowPermissions.canSuspend && (
                                  <button
                                    onClick={() => openModal(usr.id, "suspend")}
                                    disabled={isActionLoading}
                                    className="p-1.5 text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/30 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                                    title={t.users.suspendAccount}
                                  >
                                    <Ban className="w-3.5 h-3.5" />
                                  </button>
                                )}
                                {rowPermissions.canActivate && (
                                  <button
                                    onClick={() => openModal(usr.id, "activate")}
                                    disabled={isActionLoading}
                                    className="p-1.5 text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                                    title={t.users.activateAccount}
                                  >
                                    <RefreshCw className="w-3.5 h-3.5" />
                                  </button>
                                )}
                                {rowPermissions.canDelete && (
                                  <button
                                    onClick={() => openModal(usr.id, "delete")}
                                    disabled={isActionLoading}
                                    className="p-1.5 text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                                    title={t.users.delete}
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between gap-4 mt-4 bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1.5 text-xs font-semibold bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-300 disabled:opacity-40 transition-colors flex items-center gap-1 cursor-pointer"
                >
                  {lang === "ar" ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
                  <span>{t.users.previous}</span>
                </button>

                <span className="text-xs font-medium text-slate-600 dark:text-slate-400 font-mono">
                  {t.users.pageOf
                    .replace("{page}", page.toString())
                    .replace("{total}", totalPages.toString())}
                </span>

                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-3 py-1.5 text-xs font-semibold bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-300 disabled:opacity-40 transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <span>{t.users.next}</span>
                  {lang === "ar" ? <ChevronLeft className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                </button>
              </div>
            )}
          </>
        )}
      </main>

      {isInviteModalOpen && (
        <InviteUserModal
          onClose={() => setIsInviteModalOpen(false)}
          onSuccess={refresh}
        />
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
