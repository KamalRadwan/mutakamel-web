"use client";

import Link from "next/link";
import { Navbar } from "@/components/layout/Navbar";
import {
  Building2,
  Search,
  Plus,
  Globe,
  Server,
  ExternalLink,
  RotateCcw,
  Trash2,
  Loader2,
  HardDrive
} from "lucide-react";
import { useTenants } from "./hooks/useTenants";
import { TenantSummary } from "./components/TenantSummary";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { DestructiveActionModal } from "@/components/shared/DestructiveActionModal";
import { useAuth } from "@/context/AuthContext";
import { adminCanAll, ADMIN_RBAC_CRITICAL } from "@/lib/auth/rbac";
import { useI18n } from "@/i18n/I18nContext";

export default function TenantsDirectoryPage() {
  const {
    t,
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    serverFilter,
    setServerFilter,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    page,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    setPage,
    tenants,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    totalItems,
    summaryMetrics,
    activeModalTenant,
    modalActionType,
    closeModal,
    confirmModalAction,
    openActivateModal,
    openSuspendModal,
    openDeleteModal,
    handleReprovision,
    isLoading,
  } = useTenants();

  const { lang } = useI18n();
  const { user } = useAuth();
  const canDeleteTenant = adminCanAll(user, ADMIN_RBAC_CRITICAL.TENANTS_DESTROY);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#090d16] text-slate-900 dark:text-slate-100 flex flex-col">
      <Navbar />

      <main className="flex-1 p-4 sm:p-6 max-w-7xl w-full mx-auto space-y-6">
        {/* Header Title Section with Vibrant Cyan/Blue Gradient */}
        <div className="relative overflow-hidden bg-gradient-to-r from-slate-900 via-cyan-950 to-slate-900 text-white p-6 rounded-3xl border border-cyan-500/20 shadow-xl">
          <div className="absolute top-0 end-0 -mt-10 -me-10 w-72 h-72 bg-gradient-to-br from-cyan-500/20 via-blue-500/20 to-indigo-500/0 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 start-1/3 -mb-10 w-60 h-60 bg-teal-500/15 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-5">
            <div className="flex items-center gap-4">
              <div className="p-3.5 bg-gradient-to-tr from-cyan-500 via-blue-600 to-indigo-600 text-white rounded-2xl shadow-lg shadow-cyan-500/30 flex items-center justify-center shrink-0">
                <Building2 className="w-7 h-7" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-black tracking-tight text-white">
                    {t.tenants.pageTitle}
                  </h1>
                  <span className="px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 rounded-full">
                    Multi-Tenant Isolation
                  </span>
                </div>
                <p className="text-xs text-cyan-100/80 mt-1 max-w-xl leading-relaxed">
                  {t.tenants.pageSubtitle}
                </p>
              </div>
            </div>

            <Link
              href="/tenants/new"
              className="px-5 py-2.5 text-xs font-bold bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-500 hover:from-cyan-400 hover:to-indigo-400 text-white rounded-xl shadow-lg shadow-blue-500/25 transition-all transform hover:-translate-y-0.5 flex items-center gap-2 cursor-pointer shrink-0 border border-white/20"
            >
              <Plus className="w-4 h-4" />
              <span>{t.tenants.registerTenant}</span>
            </Link>
          </div>
        </div>

        {/* Summary Metrics Bar */}
        <TenantSummary metrics={summaryMetrics} />

        {/* Search & Filter Bar */}
        <div className="bg-white dark:bg-slate-900/90 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-cyan-500 absolute top-3.5 start-3.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t.tenants.searchPlaceholder}
              className="w-full ps-10 pe-4 py-2.5 text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2.5 text-xs font-semibold bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:border-cyan-500 cursor-pointer"
            >
              <option value="ALL">{t.tenants.allStatuses}</option>
              <option value="ACTIVE">{t.tenants.statusNames.ACTIVE}</option>
              <option value="PROVISIONING">{t.tenants.statusNames.PROVISIONING}</option>
              <option value="FAILED">{t.tenants.statusNames.FAILED}</option>
              <option value="SUSPENDED">{t.tenants.statusNames.SUSPENDED}</option>
              <option value="DELETED">{t.tenants.statusNames.DELETED}</option>
            </select>

            <select
              value={serverFilter}
              onChange={(e) => setServerFilter(e.target.value)}
              className="px-4 py-2.5 text-xs font-semibold bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:border-cyan-500 cursor-pointer"
            >
              <option value="ALL">{t.tenants.allServers}</option>
              <option value="srv-eg-01">{t.tenants.servers.srvEg01}</option>
              <option value="srv-eg-02">{t.tenants.servers.srvEg02}</option>
              <option value="srv-sa-01">{t.tenants.servers.srvSa01}</option>
              <option value="srv-ae-01">{t.tenants.servers.srvAe01}</option>
            </select>
          </div>
        </div>

        {/* Dynamic Colorful Table View */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-start">
              <thead>
                <tr className="bg-slate-100/70 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 font-extrabold uppercase tracking-wider">
                  <th className="py-4 px-5 text-start">{t.tenants.tenantName}</th>
                  <th className="py-4 px-5 text-start">{t.tenants.primaryFqdn}</th>
                  <th className="py-4 px-5 text-start">{lang === "ar" ? "البنية التحتية" : "Infrastructure Nodes"}</th>
                  <th className="py-4 px-5 text-start">{t.tenants.subscriptionPlan}</th>
                  <th className="py-4 px-5 text-start">{t.tenants.status}</th>
                  <th className="py-4 px-5 text-end">{t.tenants.actions}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-500" />
                      Loading...
                    </td>
                  </tr>
                ) : tenants.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">
                      {t.tenants.emptyState}
                    </td>
                  </tr>
                ) : (
                  tenants.map((ten) => (
                    <tr
                      key={ten.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors h-11"
                    >
                      <td className="py-2.5 px-4 font-semibold text-slate-900 dark:text-slate-100">
                        <Link
                          href={`/tenants/${ten.id}`}
                          className="group inline-flex flex-col hover:underline"
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs text-blue-600 dark:text-blue-400 group-hover:underline">
                              {ten.companyName}
                            </span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-mono text-slate-500">
                              {ten.name}
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono font-normal">
                            {ten.ownerEmail}
                          </div>
                        </Link>
                      </td>

                      <td className="py-2.5 px-4 font-mono text-slate-700 dark:text-slate-300">
                        <div className="flex items-center gap-1.5">
                          <Globe className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                          <span className="text-xs font-semibold">{ten.primaryFqdn}</span>
                        </div>
                      </td>

                      <td className="py-2.5 px-4 text-slate-600 dark:text-slate-400">
                        <div className="flex flex-col gap-1.5">
                          <div className="flex items-center gap-1.5" title="Database Server">
                            <Server className="w-3.5 h-3.5 text-purple-500 shrink-0" />
                            <span className="font-mono text-xs font-semibold">{ten.databaseServerName}</span>
                          </div>
                          <div className="flex items-center gap-1.5" title="Storage Server">
                            <HardDrive className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                            <span className="font-mono text-[11px] font-semibold">{ten.storageServer?.name || ten.storageServerId || "N/A"}</span>
                          </div>
                        </div>
                        <div className="text-[10px] text-slate-400 mt-1">{ten.countryName}</div>
                      </td>

                      <td className="py-2.5 px-4 text-slate-700 dark:text-slate-300">
                        <span className="font-bold text-xs">{ten.planName}</span>
                        <div className="text-[10px] text-slate-400 font-mono">{ten.seats} مقعد</div>
                      </td>

                      <td className="py-2.5 px-4">
                        <StatusBadge status={ten.status} enumType="tenant" size="sm" />
                      </td>

                      <td className="py-2.5 px-4 text-end">
                        <div className="flex items-center justify-end gap-1">
                          <Link
                            href={`/tenants/${ten.id}`}
                            className="px-2 py-1 text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/60 rounded-lg transition-colors inline-flex items-center gap-1"
                          >
                            <span>{t.tenants.detailsLink}</span>
                            <ExternalLink className="w-3 h-3" />
                          </Link>

                          {ten.status === "SUSPENDED" ? (
                            <button
                              onClick={() => openActivateModal(ten)}
                              className="px-2 py-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/60 rounded-lg transition-colors cursor-pointer"
                            >
                              تفعيل
                            </button>
                          ) : ten.status === "ACTIVE" ? (
                            <button
                              onClick={() => openSuspendModal(ten)}
                              className="px-2 py-1 text-[11px] font-semibold text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/60 rounded-lg transition-colors cursor-pointer"
                            >
                              إيقاف مؤقت
                            </button>
                          ) : ten.status === "FAILED" ? (
                            <button
                              onClick={() => handleReprovision(ten.id)}
                              className="px-2 py-1 text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/60 rounded-lg transition-colors cursor-pointer inline-flex items-center gap-1"
                            >
                              <RotateCcw className="w-3 h-3" />
                              <span>إعادة محاولة</span>
                            </button>
                          ) : null}

                          {canDeleteTenant && (
                            <button
                              onClick={() => openDeleteModal(ten)}
                              className="p-1.5 text-rose-500 hover:text-rose-700 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/60 transition-colors cursor-pointer"
                              title={t.tenants.delete}
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
        </div>
      </main>

      {/* Confirmation Modal */}
      {activeModalTenant && modalActionType && (
        <DestructiveActionModal
          isOpen={true}
          onClose={closeModal}
          onConfirm={confirmModalAction}
          actionType={modalActionType}
          targetName={activeModalTenant.name}
          requireNameTyping={modalActionType !== "activate"}
          title={
            modalActionType === "activate"
              ? `تأكيد تفعيل المستأجر (${activeModalTenant.companyName})`
              : modalActionType === "suspend"
              ? `تأكيد إيقاف المستأجر (${activeModalTenant.companyName})`
              : `تأكيد حذف المستأجر (${activeModalTenant.companyName})`
          }
          description={
            modalActionType === "activate"
              ? "سيعيد هذا الإجراء تفعيل بيئة المستأجر والسماح للمستخدمين بالوصول مباشرة."
              : modalActionType === "suspend"
              ? "سيعطل هذا الإجراء بيئة المستأجر مؤقتاً ولن يتمكن مستخدموه من تسجيل الدخول حتى الإعادة."
              : "سيعمل هذا الإجراء على نقل المستأجر لحالة الحذف المؤقت وإلغاء الربط بالسيرفر."
          }
        />
      )}
    </div>
  );
}
