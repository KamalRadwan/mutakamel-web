"use client";

import Link from "next/link";
import { Navbar } from "@/components/layout/Navbar";
import {
  ShieldCheck,
  Search,
  Plus,
  Trash2,
  Lock,
  Edit2,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Eye,
} from "lucide-react";
import { useRoles } from "./hooks/useRoles";
import { DestructiveActionModal } from "@/components/shared/DestructiveActionModal";
import { CreateRoleModal } from "./components/CreateRoleModal";
import { useAuth } from "@/context/AuthContext";
import { adminCan, adminCanAll, ADMIN_RBAC_CRITICAL } from "@/lib/auth/rbac";

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
    hasNext,
    hasPrev,
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
    isRefreshing,
    listError,
    isDeleting,
    deleteError,
    isDeleteAmbiguous,
    lang,
    t
  } = useRoles();

  const { user } = useAuth();
  const canUpdate = adminCan(user, "admin.roles.update");
  const canCreate = adminCanAll(user, ADMIN_RBAC_CRITICAL.ROLES_CREATE);
  const canDelete = adminCanAll(user, ADMIN_RBAC_CRITICAL.ROLES_DELETE);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#090d16] text-slate-900 dark:text-slate-100 flex flex-col">
      <Navbar />

      <main className="flex-1 space-y-6 w-full px-[10px] py-4 sm:py-6">
        {/* Header Title Section with Compact Gradient Banner */}
        <div className="relative overflow-hidden bg-gradient-to-r from-slate-900 via-purple-950 to-slate-900 text-white px-4 py-3 sm:px-5 sm:py-3.5 rounded-2xl border border-purple-500/20 shadow-md">
          <div className="absolute top-0 end-0 -mt-10 -me-10 w-72 h-72 bg-gradient-to-br from-purple-500/20 via-indigo-500/20 to-pink-500/0 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-gradient-to-tr from-indigo-500 via-purple-600 to-pink-600 text-white rounded-xl shadow-xs flex items-center justify-center shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-base sm:text-lg font-bold tracking-tight text-white">
                    {t.roles.pageTitle}
                  </h1>
                  <span className="px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider bg-purple-500/20 text-purple-300 border border-purple-500/30 rounded-md">
                    RBAC Manifest
                  </span>
                </div>
                <p className="text-[11px] text-purple-100/80 mt-0.5 max-w-xl leading-tight">
                  {t.roles.pageSubtitle}
                </p>
              </div>
            </div>

            {canCreate && (
              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="px-3.5 py-2 text-xs font-bold bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 hover:from-indigo-400 hover:to-pink-400 text-white rounded-xl shadow-md transition-all flex items-center gap-1.5 cursor-pointer shrink-0 border border-white/20"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{t.roles.createRole}</span>
              </button>
            )}
          </div>
        </div>

        {/* Summary Metrics Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="relative overflow-hidden bg-white dark:bg-slate-900/90 p-4 rounded-2xl border border-slate-200/80 dark:border-indigo-500/20 shadow-sm hover:shadow-md transition-all">
            <div className="absolute top-0 end-0 w-20 h-20 bg-indigo-500/10 rounded-full blur-xl pointer-events-none" />
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
              <span className="text-xs font-bold uppercase tracking-wider">{lang === "ar" ? "إجمالي الأدوار" : "Total Roles"}</span>
              <div className="p-1.5 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 rounded-lg">
                <ShieldCheck className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black text-slate-900 dark:text-slate-100 font-mono mt-1">
              {totalItems}
            </div>
          </div>

          <div className="relative overflow-hidden bg-white dark:bg-slate-900/90 p-4 rounded-2xl border border-slate-200/80 dark:border-purple-500/20 shadow-sm hover:shadow-md transition-all">
            <div className="absolute top-0 end-0 w-20 h-20 bg-purple-500/10 rounded-full blur-xl pointer-events-none" />
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
              <span className="text-xs font-bold uppercase tracking-wider">{lang === "ar" ? "أدوار النظام (المعروضة)" : "System Roles (Visible)"}</span>
              <div className="p-1.5 bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 rounded-lg">
                <Lock className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black text-purple-600 dark:text-purple-400 font-mono mt-1">
              {roles.filter(r => r.isSystem).length}
            </div>
          </div>

          <div className="relative overflow-hidden bg-white dark:bg-slate-900/90 p-4 rounded-2xl border border-slate-200/80 dark:border-emerald-500/20 shadow-sm hover:shadow-md transition-all">
            <div className="absolute top-0 end-0 w-20 h-20 bg-emerald-500/10 rounded-full blur-xl pointer-events-none" />
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
              <span className="text-xs font-bold uppercase tracking-wider">{lang === "ar" ? "أدوار مخصصة (المعروضة)" : "Custom Roles (Visible)"}</span>
              <div className="p-1.5 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 rounded-lg">
                <Edit2 className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono mt-1">
              {roles.filter(r => !r.isSystem).length}
            </div>
          </div>

          <div className="relative overflow-hidden bg-white dark:bg-slate-900/90 p-4 rounded-2xl border border-slate-200/80 dark:border-pink-500/20 shadow-sm hover:shadow-md transition-all">
            <div className="absolute top-0 end-0 w-20 h-20 bg-pink-500/10 rounded-full blur-xl pointer-events-none" />
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
              <span className="text-xs font-bold uppercase tracking-wider">{lang === "ar" ? "سياسات الوصول" : "Access Policies"}</span>
              <div className="p-1.5 bg-pink-50 dark:bg-pink-950/50 text-pink-600 dark:text-pink-400 rounded-lg">
                <ShieldCheck className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black text-pink-600 dark:text-pink-400 font-mono mt-1 flex items-center gap-2">
              Active
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
            </div>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="bg-white dark:bg-slate-900/90 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-purple-500 absolute top-3.5 start-3.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t.roles.searchPlaceholder}
              className="w-full ps-10 pe-4 py-2.5 text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all"
            />
            <p className="mt-1 px-1 text-[10px] text-slate-500">
              {lang === "ar"
                ? "يُطبّق البحث على الصفحة الحالية فقط."
                : "Search filters the current server page only."}
            </p>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <select
              value={isSystemFilter}
              onChange={(e) => setIsSystemFilter(e.target.value)}
              className="px-4 py-2.5 text-xs font-semibold bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:border-purple-500 cursor-pointer"
            >
              <option value="ALL">{t.roles.allTypes}</option>
              <option value="TRUE">{t.roles.systemRoles}</option>
              <option value="FALSE">{t.roles.customRoles}</option>
            </select>
          </div>
        </div>

        {listError ? (
          <div role="alert" className="flex flex-col gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800 sm:flex-row sm:items-center sm:justify-between dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="font-bold">
                  {listError.httpStatus === 403
                    ? lang === "ar" ? "لا تملك صلاحية قراءة الأدوار." : "You do not have permission to read roles."
                    : [502, 503, 504].includes(listError.httpStatus)
                      ? lang === "ar" ? "خدمة الأدوار غير متاحة مؤقتاً." : "The roles service is temporarily unavailable."
                      : listError.message}
                </p>
                {rolesOnPage.length ? (
                  <p className="mt-1">
                    {lang === "ar" ? "تُعرض آخر صفحة مؤكدة." : "The last confirmed page remains visible."}
                  </p>
                ) : null}
                {listError.correlationId ? <p className="mt-1 font-mono">{listError.correlationId}</p> : null}
              </div>
            </div>
            <button type="button" onClick={refreshRoles} className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-rose-300 px-3 py-2 font-bold hover:bg-rose-100 dark:border-rose-800 dark:hover:bg-rose-900/50">
              <RefreshCw className="h-3.5 w-3.5" />
              {lang === "ar" ? "إعادة المحاولة" : "Retry"}
            </button>
          </div>
        ) : null}

        {deleteError ? (
          <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
            <p className="font-bold">
              {isDeleteAmbiguous
                ? lang === "ar" ? "نتيجة الحذف غير مؤكدة؛ أعد التأكيد لإعادة استخدام العملية نفسها." : "Delete outcome is unconfirmed; confirm again to retry the exact operation."
                : deleteError.message}
            </p>
            {deleteError.correlationId ? <p className="mt-1 font-mono">{deleteError.correlationId}</p> : null}
          </div>
        ) : null}

        {/* High-Density Data Table */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-start">
              <thead>
                <tr className="bg-slate-50/80 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">
                  <th className="py-3 px-4 text-start">{t.roles.roleName}</th>
                  <th className="py-3 px-4 text-start">{t.roles.systemStatus}</th>
                  <th className="py-3 px-4 text-start">{t.roles.createdAt}</th>
                  <th className="py-3 px-4 text-end">{t.roles.actions}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {isLoading ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-slate-400">
                      {lang === "ar" ? "جاري تحميل الأدوار..." : "Loading roles..."}
                    </td>
                  </tr>
                ) : roles.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-slate-400">
                      {lang === "ar" ? "لا توجد أدوار مطابقة للبحث." : "No roles match your search."}
                    </td>
                  </tr>
                ) : (
                  roles.map((role) => (
                    <tr
                      key={role.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors h-11 group"
                    >
                      <td className="py-2.5 px-4">
                        <Link
                          href={`/roles/${role.id}`}
                          className="font-bold text-xs text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1.5"
                        >
                          {role.name}
                        </Link>
                        {role.description && (
                          <div className="text-[10px] text-slate-500 truncate max-w-xs mt-0.5">
                            {role.description}
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 px-4">
                        {role.isSystem ? (
                          <span className="flex items-center gap-1 text-[10px] text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md w-fit font-medium">
                            <Lock className="w-3 h-3" />
                            {lang === "ar" ? "نظام (للقراءة فقط)" : "System (Read-only)"}
                          </span>
                        ) : (
                          <span className="text-[10px] text-emerald-600 bg-emerald-50 border border-emerald-200 dark:bg-emerald-900/30 dark:border-emerald-800 dark:text-emerald-400 px-2 py-0.5 rounded-md w-fit font-medium">
                            {lang === "ar" ? "مخصص" : "Custom"}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-4 text-slate-500 dark:text-slate-400 text-[10px]">
                        {new Date(role.createdAt).toLocaleDateString(lang === "ar" ? "ar-EG" : "en-US", { year: "numeric", month: "short", day: "numeric" })}
                      </td>
                      <td className="py-2.5 px-4 text-end">
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Link
                            href={`/roles/${role.id}`}
                            className="p-1.5 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-colors cursor-pointer"
                            title={
                              canUpdate
                                ? lang === "ar" ? "تعديل" : "Edit"
                                : lang === "ar" ? "عرض" : "View"
                            }
                          >
                            {canUpdate ? <Edit2 className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </Link>
                          {!role.isSystem && canDelete && (
                            <button
                              onClick={() => openDeleteModal(role.id)}
                              className="p-1.5 text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors cursor-pointer"
                              title={lang === "ar" ? "حذف" : "Delete"}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="flex flex-col gap-3 border-t border-slate-200 bg-slate-50/50 p-3 text-[10px] text-slate-500 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800 dark:bg-slate-800/30">
            <span className="sr-only">
              {lang === "ar" ? `عرض ${roles.length} من أصل ${totalItems} دور` : `Showing ${roles.length} of ${totalItems} roles`}
            </span>
            <div className="flex items-center gap-2">
              {isRefreshing ? <RefreshCw className="h-3 w-3 animate-spin" /> : null}
              <span>
                {totalItems === 0
                  ? lang === "ar" ? "لا توجد أدوار" : "No roles"
                  : lang === "ar"
                    ? `عرض ${Math.min((page - 1) * pageSize + 1, totalItems)}–${Math.min((page - 1) * pageSize + rolesOnPage.length, totalItems)} من ${totalItems}`
                    : `Showing ${Math.min((page - 1) * pageSize + 1, totalItems)}–${Math.min((page - 1) * pageSize + rolesOnPage.length, totalItems)} of ${totalItems}`}
                {search.trim()
                  ? lang === "ar"
                    ? ` (${roles.length} مطابق في الصفحة)`
                    : ` (${roles.length} page matches)`
                  : ""}
              </span>
            </div>
            <div className="flex items-center justify-end gap-2">
              <span>
                {lang === "ar"
                  ? `صفحة ${page} من ${Math.max(totalPages, 1)}`
                  : `Page ${page} of ${Math.max(totalPages, 1)}`}
              </span>
              <button
                type="button"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={!hasPrev || isLoading}
                aria-label={lang === "ar" ? "الصفحة السابقة" : "Previous page"}
                className="rounded-lg border border-slate-200 p-1.5 disabled:opacity-40 dark:border-slate-700"
              >
                {lang === "ar" ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
              </button>
              <button
                type="button"
                onClick={() => setPage((current) => current + 1)}
                disabled={!hasNext || isLoading}
                aria-label={lang === "ar" ? "الصفحة التالية" : "Next page"}
                className="rounded-lg border border-slate-200 p-1.5 disabled:opacity-40 dark:border-slate-700"
              >
                {lang === "ar" ? <ChevronLeft className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>
        </div>
      </main>

      {isCreateModalOpen && (
        <CreateRoleModal onClose={() => setIsCreateModalOpen(false)} onSuccess={refreshRoles} />
      )}

      {isDeleteModalOpen && activeModalRole && (
        <DestructiveActionModal
          isOpen={isDeleteModalOpen}
          onClose={closeDeleteModal}
          onConfirm={confirmDelete}
          isSubmitting={isDeleting}
          confirmLabel={isDeleteAmbiguous ? (lang === "ar" ? "إعادة الحذف بنفس العملية" : "Retry exact delete") : undefined}
          title={lang === "ar" ? "حذف الدور" : "Delete Role"}
          description={lang === "ar" ? `هل أنت متأكد من رغبتك في حذف هذا الدور؟` : `Are you sure you want to delete this role?`}
          targetName={activeModalRole.name}
          actionType="delete"
        />
      )}
    </div>
  );
}
