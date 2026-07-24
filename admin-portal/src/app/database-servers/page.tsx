"use client";

import Link from "next/link";
import { Navbar } from "@/components/layout/Navbar";
import { 
  Server, 
  Search, 
  Plus, 
  History, 
  Trash2, 
  Globe, 
  ExternalLink, 
  RotateCcw 
} from "lucide-react";
import { useDatabaseServers } from "./hooks/useDatabaseServers";
import { DatabaseServerSummary } from "./components/DatabaseServerSummary";
import { DatabaseServerAuditDrawer } from "./components/DatabaseServerAuditDrawer";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { DestructiveActionModal } from "@/components/shared/DestructiveActionModal";

export default function DatabaseServersPage() {
  const {
    t,
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    countryFilter,
    setCountryFilter,
    page,
    setPage,
    auditServerId,
    setAuditServerId,
    servers,
    totalItems,
    summaryMetrics,
    activeModalServer,
    modalActionType,
    closeModal,
    confirmModalAction,
    openActivateModal,
    openDrainModal,
    openDeleteModal,
  } = useDatabaseServers();

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#090d16] text-slate-900 dark:text-slate-100 flex flex-col">
      <Navbar />

      <main className="flex-1 p-4 sm:p-6 max-w-7xl w-full mx-auto space-y-6">
        {/* Header Title Section */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Server className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <span>{t.dbServers.pageTitle}</span>
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {t.dbServers.pageSubtitle}
            </p>
          </div>

          <Link
            href="/database-servers/new"
            className="px-3.5 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-md shadow-blue-600/20 transition-colors flex items-center gap-1.5 cursor-pointer ms-auto sm:ms-0"
          >
            <Plus className="w-4 h-4" />
            <span>{t.dbServers.registerServer}</span>
          </Link>
        </div>

        {/* Summary Metrics Bar */}
        <DatabaseServerSummary metrics={summaryMetrics} />

        {/* Search & Filter Bar */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute top-3 start-3" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t.dbServers.searchPlaceholder}
              className="w-full ps-9 pe-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-600"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-600 cursor-pointer"
            >
              <option value="ALL">{t.dbServers.allStatuses}</option>
              <option value="ACTIVE">ACTIVE (نشط)</option>
              <option value="DRAINING">DRAINING (تفريغ)</option>
              <option value="OFFLINE">OFFLINE (متوقف)</option>
            </select>

            <select
              value={countryFilter}
              onChange={(e) => setCountryFilter(e.target.value)}
              className="px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-600 cursor-pointer"
            >
              <option value="ALL">{t.dbServers.allCountries}</option>
              <option value="EG">مصر (Egypt)</option>
              <option value="SA">السعودية (KSA)</option>
              <option value="AE">الإمارات (UAE)</option>
            </select>
          </div>
        </div>

        {/* Table View */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-start">
              <thead>
                <tr className="bg-slate-50/80 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">
                  <th className="py-3 px-4 text-start">{t.dbServers.serverName}</th>
                  <th className="py-3 px-4 text-start">{t.dbServers.hostAddress}</th>
                  <th className="py-3 px-4 text-start">{t.dbServers.countryRegion}</th>
                  <th className="py-3 px-4 text-start">{t.dbServers.tenantsCapacity}</th>
                  <th className="py-3 px-4 text-start">{t.dbServers.placementStatus}</th>
                  <th className="py-3 px-4 text-end">{t.dbServers.actions}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {servers.map((srv) => (
                  <tr key={srv.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 h-11">
                    <td className="py-2.5 px-4 font-bold text-slate-900 dark:text-slate-100">
                      <Link href={`/database-servers/${srv.id}`} className="hover:underline flex items-center gap-2">
                        <Server className="w-4 h-4 text-purple-500" />
                        <span>{srv.name}</span>
                      </Link>
                    </td>
                    <td className="py-2.5 px-4 font-mono text-slate-600 dark:text-slate-400">
                      {srv.host}:{srv.port}
                    </td>
                    <td className="py-2.5 px-4 text-slate-600 dark:text-slate-400">
                      <div className="flex items-center gap-1.5">
                        <Globe className="w-3.5 h-3.5 text-blue-500" />
                        <span>{srv.countryName}</span>
                      </div>
                    </td>
                    <td className="py-2.5 px-4 font-mono">
                      {srv.currentTenants} / {srv.maxTenants} ({srv.utilization}%)
                    </td>
                    <td className="py-2.5 px-4">
                      <StatusBadge status={srv.status} enumType="db-server" size="sm" />
                    </td>
                    <td className="py-2.5 px-4 text-end">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setAuditServerId(srv.id)}
                          className="p-1.5 text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                          title="عرض سجل التدقيق"
                        >
                          <History className="w-3.5 h-3.5" />
                        </button>

                        <Link
                          href={`/database-servers/${srv.id}`}
                          className="px-2 py-1 text-[11px] font-semibold text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/60 rounded-lg transition-colors inline-flex items-center gap-1"
                        >
                          <span>تفاصيل</span>
                          <ExternalLink className="w-3 h-3" />
                        </Link>

                        {srv.status === "DRAINING" ? (
                          <button
                            onClick={() => openActivateModal(srv)}
                            className="px-2 py-1 text-[11px] font-semibold text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                          >
                            تفعيل
                          </button>
                        ) : srv.status === "ACTIVE" ? (
                          <button
                            onClick={() => openDrainModal(srv)}
                            className="px-2 py-1 text-[11px] font-semibold text-purple-600 hover:bg-purple-50 rounded-lg transition-colors cursor-pointer inline-flex items-center gap-1"
                          >
                            <RotateCcw className="w-3 h-3" />
                            <span>تفريغ</span>
                          </button>
                        ) : null}

                        <button
                          onClick={() => openDeleteModal(srv)}
                          className="p-1.5 text-rose-500 hover:text-rose-700 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/60 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Confirmation Modal */}
      {activeModalServer && modalActionType && (
        <DestructiveActionModal
          isOpen={true}
          onClose={closeModal}
          onConfirm={confirmModalAction}
          actionType={modalActionType}
          targetName={activeModalServer.name}
          requireNameTyping={modalActionType !== "activate"}
          title={
            modalActionType === "activate"
              ? `تأكيد إعادة تفعيل السيرفر (${activeModalServer.name})`
              : modalActionType === "drain"
              ? `تأكيد تفريغ السيرفر (${activeModalServer.name})`
              : `تأكيد حذف السيرفر (${activeModalServer.name})`
          }
          description={
            modalActionType === "activate"
              ? "سيسمح هذا الإجراء باستقبال مستأجرين جدد على هذا السيرفر."
              : modalActionType === "drain"
              ? "سيعمل هذا الإجراء على منع تخصيص أي مستأجرين جدد على هذا السيرفر ونقل المستأجرين الحاليين عند الطلب."
              : "سيقوم هذا الإجراء بإزالة السيرفر نهائياً بشرط عدم وجود مستأجرين مرتبطين به."
          }
        />
      )}

      {/* Audit Logs Drawer */}
      <DatabaseServerAuditDrawer
        serverId={auditServerId}
        onClose={() => setAuditServerId(null)}
      />
    </div>
  );
}
