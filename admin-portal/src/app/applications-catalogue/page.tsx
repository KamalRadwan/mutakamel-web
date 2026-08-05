"use client";

import { useState } from "react";
import Link from "next/link";
import { Navbar } from "@/components/layout/Navbar";
import {
  AppWindow,
  Search,
  Plus,
  History,
  RefreshCw,
} from "lucide-react";
import { useApplications } from "@/features/admin/applications/hooks/useApplications";
import { CreateApplicationModal } from "@/features/admin/applications/components/CreateApplicationModal";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { TablePagination } from "@/components/shared/TablePagination";
import { useAuth } from "@/context/AuthContext";
import { adminCanAll } from "@/lib/auth/rbac";

export default function ApplicationsPage() {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const {
    applications,
    isLoading,
    error,
    search,
    setSearch,
    typeFilter,
    setTypeFilter,
    commercialFilter,
    setCommercialFilter,
    visibilityFilter,
    setVisibilityFilter,
    lifecycleFilter,
    setLifecycleFilter,
    publicationFilter,
    setPublicationFilter,
    dbAccessFilter,
    setDbAccessFilter,
    meta,
    page,
    setPage,
    refresh,
    createApplication,
  } = useApplications();

  const { user } = useAuth();
  const canCreate = adminCanAll(user, ["admin.applications.create"]);
  const canReadAudit = adminCanAll(user, ["admin.catalog.read"]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#090d16] text-slate-900 dark:text-slate-100 flex flex-col">
      <Navbar />

      <main className="flex-1 p-4 sm:p-6 max-w-7xl w-full mx-auto space-y-6">
        <CreateApplicationModal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          onCreate={createApplication}
        />

        {/* Header Title Section with Vibrant Amber/Purple Gradient */}
        <div className="relative overflow-hidden bg-gradient-to-r from-slate-900 via-purple-950 to-slate-900 text-white p-6 rounded-3xl border border-amber-500/20 shadow-xl">
          <div className="absolute top-0 end-0 -mt-10 -me-10 w-72 h-72 bg-gradient-to-br from-amber-500/20 via-purple-500/20 to-pink-500/0 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 start-1/3 -mb-10 w-60 h-60 bg-blue-500/15 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-5">
            <div className="flex items-center gap-4">
              <div className="p-3.5 bg-gradient-to-tr from-amber-500 via-purple-600 to-indigo-600 text-white rounded-2xl shadow-lg shadow-purple-500/30 flex items-center justify-center shrink-0">
                <AppWindow className="w-7 h-7" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-black tracking-tight text-white">
                    Application Catalogue
                  </h1>
                  <span className="px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-full">
                    Control Plane Registry
                  </span>
                </div>
                <p className="text-xs text-amber-100/80 mt-1 max-w-xl leading-relaxed">
                  Platform application registry, commercial service definitions, database access boundaries, and subscription entitlement models.
                </p>
              </div>
            </div>

            {canCreate && (
              <button
                className="px-5 py-2.5 text-xs font-bold bg-gradient-to-r from-amber-500 via-purple-500 to-indigo-500 hover:from-amber-400 hover:to-indigo-400 text-white rounded-xl shadow-lg shadow-purple-500/25 transition-all transform hover:-translate-y-0.5 flex items-center gap-2 cursor-pointer shrink-0 border border-white/20"
                onClick={() => setIsCreateModalOpen(true)}
              >
                <Plus className="w-4 h-4" />
                <span>Register Application</span>
              </button>
            )}
            {canReadAudit && <Link href="/applications-catalogue/audit" className="flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-xs font-bold text-white hover:bg-white/15"><History className="h-4 w-4" />Catalogue audit</Link>}
          </div>
        </div>

        {/* Summary Metrics Bar */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="relative overflow-hidden bg-white dark:bg-slate-900/90 p-5 rounded-2xl border border-slate-200/80 dark:border-amber-500/20 shadow-sm hover:shadow-md transition-all">
            <div className="absolute top-0 end-0 w-24 h-24 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Total Apps
              </span>
              <div className="p-2 bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 rounded-xl border border-amber-200 dark:border-amber-800/50">
                <AppWindow className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-2 font-mono">
              {meta.total}
            </div>
            <div className="text-[11px] text-amber-600 dark:text-amber-400 font-semibold mt-1">
              Registered System Applications
            </div>
          </div>

          <div className="relative overflow-hidden bg-white dark:bg-slate-900/90 p-5 rounded-2xl border border-slate-200/80 dark:border-purple-500/20 shadow-sm hover:shadow-md transition-all">
            <div className="absolute top-0 end-0 w-24 h-24 bg-purple-500/10 rounded-full blur-2xl pointer-events-none" />
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Commercial Apps
              </span>
              <div className="p-2 bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 rounded-xl border border-purple-200 dark:border-purple-800/50">
                <AppWindow className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black text-purple-600 dark:text-purple-400 mt-2 font-mono">
              {applications?.filter(a => a.commercialMode === 'SUBSCRIPTION').length || 0}
            </div>
            <div className="text-[11px] text-purple-600 dark:text-purple-400 font-semibold mt-1">
              Tenant Subscription Offerings
            </div>
          </div>

          <div className="relative overflow-hidden bg-white dark:bg-slate-900/90 p-5 rounded-2xl border border-slate-200/80 dark:border-indigo-500/20 shadow-sm hover:shadow-md transition-all">
            <div className="absolute top-0 end-0 w-24 h-24 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Tenant DB Access
              </span>
              <div className="p-2 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 rounded-xl border border-indigo-200 dark:border-indigo-800/50">
                <AppWindow className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black text-indigo-600 dark:text-indigo-400 mt-2 font-mono">
              {applications?.filter(a => a.databaseAccessMode === 'TENANT_DATABASE').length || 0}
            </div>
            <div className="text-[11px] text-indigo-600 dark:text-indigo-400 font-semibold mt-1">
              Isolated Tenant DB Principals
            </div>
          </div>

          <div className="relative overflow-hidden bg-white dark:bg-slate-900/90 p-5 rounded-2xl border border-slate-200/80 dark:border-emerald-500/20 shadow-sm hover:shadow-md transition-all">
            <div className="absolute top-0 end-0 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Published Active
              </span>
              <div className="p-2 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 rounded-xl border border-emerald-200 dark:border-emerald-800/50">
                <AppWindow className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-2 font-mono flex items-center gap-2">
              {applications?.filter(a => a.lifecycleStatus === "ACTIVE" && a.publicationStatus === "PUBLISHED").length || 0}
            </div>
            <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold mt-1">
              Current page · readiness remains separate
            </div>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="bg-white dark:bg-slate-900/90 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-3">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-amber-500 absolute top-3.5 start-3.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search applications..."
              className="w-full ps-10 pe-4 py-2.5 text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all"
            />
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
            <Filter value={typeFilter} onChange={setTypeFilter} label="Type" options={["ALL", "SYSTEM", "TENANT"]} />
            <Filter value={commercialFilter} onChange={setCommercialFilter} label="Commercial" options={["ALL", "NON_BILLABLE", "INCLUDED", "SUBSCRIPTION"]} />
            <Filter value={visibilityFilter} onChange={setVisibilityFilter} label="Visibility" options={["ALL", "PUBLIC", "INTERNAL"]} />
            <Filter value={lifecycleFilter} onChange={setLifecycleFilter} label="Lifecycle" options={["ALL", "DRAFT", "ACTIVE", "DEPRECATED", "DISABLED"]} />
            <Filter value={publicationFilter} onChange={setPublicationFilter} label="Publication" options={["ALL", "UNPUBLISHED", "PUBLISHED"]} />
            <Filter value={dbAccessFilter} onChange={setDbAccessFilter} label="DB access" options={["ALL", "NONE", "TENANT_DATABASE"]} />
          </div>
        </div>

        {/* Dynamic Colorful Table View */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-start">
              <thead>
                <tr className="bg-slate-100/70 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 font-extrabold uppercase tracking-wider">
                  <th className="py-4 px-5 text-start">Application</th>
                  <th className="py-4 px-5 text-start">Key</th>
                  <th className="py-4 px-5 text-start">Type</th>
                  <th className="py-4 px-5 text-start">DB Access Mode</th>
                  <th className="py-4 px-5 text-start">Publication</th>
                  <th className="py-4 px-5 text-start">Lifecycle</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-500 font-medium">Loading applications...</td>
                  </tr>
                ) : error ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-rose-500 font-bold"><p>{error}</p><button type="button" onClick={() => void refresh()} className="mt-3 inline-flex items-center gap-2 rounded-xl bg-rose-600 px-3 py-2 text-xs text-white"><RefreshCw className="h-3.5 w-3.5" />Retry</button></td>
                  </tr>
                ) : applications.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-16 text-center text-slate-400 font-semibold">No applications found</td>
                  </tr>
                ) : (
                  applications.map((app) => (
                    <tr key={app.id} className="group hover:bg-amber-50/40 dark:hover:bg-amber-950/20 transition-all">
                      <td className="py-4 px-5">
                        <Link
                          href={`/applications-catalogue/${app.key}`}
                          className="group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors inline-block"
                        >
                          <span className="font-bold text-sm text-slate-900 dark:text-slate-100 group-hover:text-amber-600 dark:group-hover:text-amber-400">
                            {app.name}
                          </span>
                          <span className="text-slate-400 font-normal text-[11px] block mt-0.5">{app.description}</span>
                        </Link>
                      </td>
                      <td className="py-4 px-5 font-mono">
                        <span className="bg-slate-100 dark:bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700/60 font-bold text-slate-700 dark:text-slate-300 text-[11px]">
                          {app.key}
                        </span>
                      </td>
                      <td className="py-4 px-5">
                        <span className={`px-2.5 py-1 rounded-lg font-bold text-[11px] border ${
                          app.applicationType === "TENANT"
                            ? "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-900/60"
                            : "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700"
                        }`}>
                          {app.applicationType}
                        </span>
                      </td>
                      <td className="py-4 px-5">
                        <span className={`px-2.5 py-1 rounded-lg font-bold text-[11px] border ${
                          app.databaseAccessMode === "TENANT_DATABASE"
                            ? "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-900/60"
                            : "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700"
                        }`}>
                          {app.databaseAccessMode}
                        </span>
                      </td>
                      <td className="py-4 px-5">
                        <span className={`inline-flex rounded-lg border px-2.5 py-1 text-[11px] font-bold ${
                          app.publicationStatus === "PUBLISHED"
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300"
                            : "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200"
                        }`}>
                          {app.publicationStatus}
                        </span>
                      </td>
                      <td className="py-4 px-5">
                        <StatusBadge status={app.lifecycleStatus} />
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
    </div>
  );
}

function Filter<T extends string>({ value, onChange, label, options }: { value: T; onChange: (value: T) => void; label: string; options: readonly T[] }) {
  return <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500"><span className="sr-only">{label}</span><select aria-label={label} value={value} onChange={(event) => onChange(event.target.value as T)} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2.5 text-[11px] font-bold normal-case tracking-normal text-slate-700 outline-none focus:border-amber-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">{options.map((option) => <option key={option} value={option}>{option === "ALL" ? `All ${label.toLowerCase()}` : option.replaceAll("_", " ")}</option>)}</select></label>;
}
