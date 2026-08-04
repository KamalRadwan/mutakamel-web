"use client";

import Link from "next/link";
import { Navbar } from "@/components/layout/Navbar";
import {
  Server,
  Search,
  Plus,
  ShieldAlert,
  Trash2,
} from "lucide-react";
import { useDatabaseServers } from "@/features/admin/database-servers/hooks/useDatabaseServers";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { TablePagination } from "@/components/shared/TablePagination";
import { useAuth } from "@/context/AuthContext";
import { ADMIN_RBAC_CRITICAL, adminCanAll } from "@/lib/auth/rbac";
import { CountrySelect } from "@/components/shared/CountrySelect";
import { DestructiveActionModal } from "@/components/shared/DestructiveActionModal";
import {
  canDestroyDatabaseServer,
  canSoftDeleteDatabaseServer,
} from "@/features/admin/database-servers/lib/database-server-deletion";
import { useI18n } from "@/i18n/I18nContext";

export default function DatabaseServersPage() {
  const {
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    countryFilter,
    setCountryFilter,
    deletionFilter,
    setDeletionFilter,
    page,
    setPage,
    servers,
    summaryMetrics,
    isLoading,
    error,
    meta,
    serverPendingDelete,
    deletingServerId,
    openSoftDelete,
    closeSoftDelete,
    confirmSoftDelete,
    serverPendingDestroy,
    destroyingServerId,
    openDestroy,
    closeDestroy,
    confirmDestroy,
  } = useDatabaseServers();

  const { user } = useAuth();
  const { lang } = useI18n();
  const canCreate = adminCanAll(user, ["admin.database_servers.create"]);
  const canDelete = adminCanAll(user, [
    "admin.database_servers.delete",
    "admin.database_servers.critical",
  ]);
  const canDestroy = adminCanAll(
    user,
    ADMIN_RBAC_CRITICAL.DB_SERVERS_DESTROY,
  );

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#090d16] text-slate-900 dark:text-slate-100 flex flex-col">
      <Navbar />

      <main className="flex-1 p-4 sm:p-6 max-w-7xl w-full mx-auto space-y-6">
        {/* Header Title Section with Vibrant Gradient Accents */}
        <div className="relative overflow-hidden bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 text-white p-6 rounded-3xl border border-blue-500/20 shadow-xl">
          <div className="absolute top-0 end-0 -mt-10 -me-10 w-72 h-72 bg-gradient-to-br from-blue-500/20 via-cyan-500/20 to-teal-500/0 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 start-1/3 -mb-10 w-60 h-60 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-5">
            <div className="flex items-center gap-4">
              <div className="p-3.5 bg-gradient-to-tr from-blue-600 via-cyan-600 to-teal-500 text-white rounded-2xl shadow-lg shadow-blue-500/30 flex items-center justify-center shrink-0">
                <Server className="w-7 h-7" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-black tracking-tight text-white">
                    Database Servers
                  </h1>
                  <span className="px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider bg-blue-500/20 text-blue-300 border border-blue-500/30 rounded-full">
                    PostgreSQL Nodes
                  </span>
                </div>
                <p className="text-xs text-blue-200/80 mt-1 max-w-xl leading-relaxed">
                  Physical PostgreSQL database host nodes, application placement targets, and tenant schema allocations.
                </p>
              </div>
            </div>

            {canCreate && (
              <Link
                href="/database-servers/new"
                className="px-5 py-2.5 text-xs font-bold bg-gradient-to-r from-blue-500 via-cyan-500 to-teal-500 hover:from-blue-400 hover:to-teal-400 text-white rounded-xl shadow-lg shadow-cyan-500/25 transition-all transform hover:-translate-y-0.5 flex items-center gap-2 cursor-pointer shrink-0 border border-white/20"
              >
                <Plus className="w-4 h-4" />
                <span>Register Server</span>
              </Link>
            )}
          </div>
        </div>

        {/* Summary Metrics Cards with Distinct Colorful Glows */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Total Servers */}
          <div className="relative overflow-hidden bg-white dark:bg-slate-900/90 p-5 rounded-2xl border border-slate-200/80 dark:border-blue-500/20 shadow-sm hover:shadow-md transition-all">
            <div className="absolute top-0 end-0 w-24 h-24 bg-blue-500/10 rounded-full blur-2xl pointer-events-none" />
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Total Hosts
              </span>
              <div className="p-2 bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 rounded-xl border border-blue-200 dark:border-blue-800/50">
                <Server className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-2 font-mono">
              {summaryMetrics.totalServers}
            </div>
            <div className="text-[11px] text-blue-600 dark:text-blue-400 font-semibold mt-1">
              Registered Physical Cluster
            </div>
          </div>

          {/* Active Servers */}
          <div className="relative overflow-hidden bg-white dark:bg-slate-900/90 p-5 rounded-2xl border border-slate-200/80 dark:border-emerald-500/20 shadow-sm hover:shadow-md transition-all">
            <div className="absolute top-0 end-0 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Active Nodes
              </span>
              <div className="p-2 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 rounded-xl border border-emerald-200 dark:border-emerald-800/50">
                <Server className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-2 font-mono flex items-center gap-2">
              {summaryMetrics.activeServers}
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
            </div>
            <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold mt-1">
              Healthy & Accepting Placements
            </div>
          </div>

          {/* Draining Servers */}
          <div className="relative overflow-hidden bg-white dark:bg-slate-900/90 p-5 rounded-2xl border border-slate-200/80 dark:border-amber-500/20 shadow-sm hover:shadow-md transition-all">
            <div className="absolute top-0 end-0 w-24 h-24 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Draining
              </span>
              <div className="p-2 bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 rounded-xl border border-amber-200 dark:border-amber-800/50">
                <Server className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-2 font-mono">
              {summaryMetrics.drainingServers}
            </div>
            <div className="text-[11px] text-amber-600 dark:text-amber-400 font-semibold mt-1">
              Migrating & Evacuated
            </div>
          </div>

          {/* Offline Servers */}
          <div className="relative overflow-hidden bg-white dark:bg-slate-900/90 p-5 rounded-2xl border border-slate-200/80 dark:border-rose-500/20 shadow-sm hover:shadow-md transition-all">
            <div className="absolute top-0 end-0 w-24 h-24 bg-rose-500/10 rounded-full blur-2xl pointer-events-none" />
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Offline Hosts
              </span>
              <div className="p-2 bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 rounded-xl border border-rose-200 dark:border-rose-800/50">
                <Server className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-2 font-mono">
              {summaryMetrics.offlineServers}
            </div>
            <div className="text-[11px] text-rose-600 dark:text-rose-400 font-semibold mt-1">
              Disabled / Maintenance
            </div>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="bg-white dark:bg-slate-900/90 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-blue-500 absolute top-3.5 start-3.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or host..."
              className="w-full ps-10 pe-4 py-2.5 text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <select
              value={deletionFilter}
              onChange={(e) =>
                setDeletionFilter(e.target.value as typeof deletionFilter)
              }
              aria-label={lang === "ar" ? "حالة السجل" : "Record state"}
              className="min-w-32 flex-1 sm:flex-none px-4 py-2.5 text-xs font-semibold bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500 cursor-pointer"
            >
              <option value="CURRENT">
                {lang === "ar" ? "الخوادم الحالية" : "Current servers"}
              </option>
              <option value="DELETED">
                {lang === "ar" ? "الخوادم المحذوفة" : "Deleted servers"}
              </option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
              className="px-4 py-2.5 text-xs font-semibold bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500 cursor-pointer"
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">ACTIVE</option>
              <option value="DRAINING">DRAINING</option>
              <option value="OFFLINE">OFFLINE</option>
              <option value="DRAFT">DRAFT</option>
            </select>

            <CountrySelect
              value={countryFilter}
              onChange={(isoCode) => setCountryFilter(isoCode)}
              allowAll={true}
              allLabel={"All Countries"}
            />
          </div>
        </div>

        {/* Dynamic Colorful Table View */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-start">
              <thead>
                <tr className="bg-slate-100/70 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 font-extrabold uppercase tracking-wider">
                  <th className="py-4 px-5 text-start">Server Name</th>
                  <th className="py-4 px-5 text-start">Host & Port</th>
                  <th className="py-4 px-5 text-start">Location</th>
                  <th className="py-4 px-5 text-start">Tenant Capacity</th>
                  <th className="py-4 px-5 text-start">Status</th>
                  <th className="py-4 px-5 text-end">{lang === "ar" ? "الإجراءات" : "Actions"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-500 font-medium">Loading database servers...</td>
                  </tr>
                ) : error ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-rose-500 font-bold">{error}</td>
                  </tr>
                ) : servers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-16 text-center text-slate-400 font-semibold">No database servers found</td>
                  </tr>
                ) : (
                  servers.map((srv) => (
                    <tr key={srv.id} className="group hover:bg-blue-50/40 dark:hover:bg-blue-950/20 transition-all">
                      <td className="py-4 px-5">
                        {srv.deletedAt ? (
                          <span className="inline-block font-bold text-sm text-slate-500 dark:text-slate-400">
                            {srv.name}
                          </span>
                        ) : (
                          <Link
                            href={`/database-servers/${srv.id}`}
                            className="group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors inline-block font-bold text-sm text-slate-900 dark:text-slate-100"
                          >
                            {srv.name}
                          </Link>
                        )}
                      </td>
                      <td className="py-4 px-5 font-mono">
                        <span className="bg-slate-100 dark:bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700/60 font-semibold text-[11px] text-slate-700 dark:text-slate-300">
                          {srv.host}:{srv.port}
                        </span>
                      </td>
                      <td className="py-4 px-5">
                        <span className="px-2.5 py-1 bg-cyan-50 text-cyan-700 dark:bg-cyan-950/40 dark:text-cyan-300 rounded-lg border border-cyan-200 dark:border-cyan-900/60 font-semibold text-[11px]">
                          {srv.countryName || srv.countryIsoCode}
                        </span>
                      </td>
                      <td className="py-4 px-5">
                        <div className="flex items-center gap-2">
                          <div className="w-24 bg-slate-200 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                            <div
                              className="bg-gradient-to-r from-blue-500 to-cyan-500 h-full rounded-full"
                              style={{ width: `${Math.min(100, (srv.currentTenants / Math.max(1, srv.maxTenants)) * 100)}%` }}
                            />
                          </div>
                          <span className="font-bold text-slate-700 dark:text-slate-300 font-mono">
                            {srv.currentTenants} / {srv.maxTenants}
                          </span>
                        </div>
                      </td>
                      <td className="py-4 px-5">
                        <div className="flex flex-col items-start gap-1">
                          <StatusBadge
                            status={srv.deletedAt ? "DELETED" : srv.status}
                            enumType="db-server"
                          />
                          {srv.deletedAt && (
                            <span className="text-[10px] font-medium text-slate-400">
                              {lang === "ar"
                                ? `الحالة السابقة: ${srv.status}`
                                : `Previous state: ${srv.status}`}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-4 px-5 text-end">
                        {canDestroy && canDestroyDatabaseServer(srv) ? (
                          <button
                            type="button"
                            onClick={() => openDestroy(srv)}
                            disabled={destroyingServerId === srv.id}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-rose-300 bg-rose-700 px-2.5 py-1.5 text-[11px] font-bold text-white shadow-sm transition-colors hover:bg-rose-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-rose-700 dark:bg-rose-800 dark:hover:bg-rose-900 dark:focus-visible:ring-offset-slate-900"
                          >
                            <ShieldAlert
                              className="h-3.5 w-3.5"
                              aria-hidden="true"
                            />
                            {lang === "ar" ? "إتلاف نهائي" : "Destroy"}
                          </button>
                        ) : canDelete && canSoftDeleteDatabaseServer(srv) ? (
                          <button
                            type="button"
                            onClick={() => openSoftDelete(srv)}
                            disabled={deletingServerId === srv.id}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-[11px] font-bold text-rose-700 transition-colors hover:bg-rose-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-rose-900/70 dark:bg-rose-950/30 dark:text-rose-300 dark:hover:bg-rose-950/60 dark:focus-visible:ring-offset-slate-900"
                          >
                            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                            {lang === "ar" ? "حذف" : "Delete"}
                          </button>
                        ) : (
                          <span className="text-[11px] text-slate-400">—</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <TablePagination meta={meta} page={page} setPage={setPage} />
        </div>
      </main>

      <DestructiveActionModal
        isOpen={serverPendingDelete !== null}
        onClose={closeSoftDelete}
        onConfirm={() => void confirmSoftDelete()}
        title={lang === "ar" ? "حذف خادم قاعدة البيانات" : "Delete database server"}
        description={lang === "ar"
          ? "حذف منطقي لخادم فارغ في حالة التفريغ أو عدم الاتصال. لن يعود متاحًا للتوزيع."
          : "Soft delete this empty drained or offline server. It will no longer be available for placement."}
        targetName={serverPendingDelete?.name ?? ""}
        actionType="delete"
        requireNameTyping
        isSubmitting={serverPendingDelete?.id === deletingServerId}
      />

      <DestructiveActionModal
        isOpen={serverPendingDestroy !== null}
        onClose={closeDestroy}
        onConfirm={() => void confirmDestroy()}
        title={
          lang === "ar"
            ? "إتلاف خادم قاعدة البيانات نهائيًا"
            : "Permanently destroy database server"
        }
        description={
          lang === "ar"
            ? "سيتم حذف سجل الخادم المحذوف منطقيًا والبيانات التابعة المؤهلة نهائيًا. لا يمكن التراجع عن هذا الإجراء."
            : "This permanently removes the soft-deleted server record and its eligible dependent data. This action cannot be undone."
        }
        targetName={serverPendingDestroy?.name ?? ""}
        actionType="destroy"
        requireNameTyping
        isSubmitting={serverPendingDestroy?.id === destroyingServerId}
      />
    </div>
  );
}
