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
  Trash2 
} from "lucide-react";
import { useTenants } from "./hooks/useTenants";
import { TenantSummary } from "./components/TenantSummary";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { DestructiveActionModal } from "@/components/shared/DestructiveActionModal";

export default function TenantsDirectoryPage() {
  const {
    t,
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    serverFilter,
    setServerFilter,
    page,
    setPage,
    tenants,
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
  } = useTenants();

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#090d16] text-slate-900 dark:text-slate-100 flex flex-col">
      <Navbar />

      <main className="flex-1 p-4 sm:p-6 max-w-7xl w-full mx-auto space-y-6">
        {/* Header Title Section */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <span>{t.tenants.pageTitle}</span>
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {t.tenants.pageSubtitle}
            </p>
          </div>

          <Link
            href="/tenants/new"
            className="px-3.5 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-md shadow-blue-600/20 transition-colors flex items-center gap-1.5 cursor-pointer ms-auto sm:ms-0"
          >
            <Plus className="w-4 h-4" />
            <span>{t.tenants.registerTenant}</span>
          </Link>
        </div>

        {/* Summary Metrics Bar */}
        <TenantSummary metrics={summaryMetrics} />

        {/* Search & Filter Bar */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute top-3 start-3" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t.tenants.searchPlaceholder}
              className="w-full ps-9 pe-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-600"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-600 cursor-pointer"
            >
              <option value="ALL">{t.tenants.allStatuses}</option>
              <option value="ACTIVE">نشط</option>
              <option value="PROVISIONING">تجهيز</option>
              <option value="FAILED">فشل التجهيز</option>
              <option value="SUSPENDED">معلق</option>
              <option value="DELETED">محذوف</option>
            </select>

            <select
              value={serverFilter}
              onChange={(e) => setServerFilter(e.target.value)}
              className="px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-600 cursor-pointer"
            >
              <option value="ALL">{t.tenants.allServers}</option>
              <option value="srv-eg-01">DB-PRIMARY-EG-01</option>
              <option value="srv-eg-02">DB-PRIMARY-EG-02</option>
              <option value="srv-sa-01">DB-PRIMARY-SA-01</option>
              <option value="srv-ae-01">DB-PRIMARY-AE-01</option>
            </select>
          </div>
        </div>

        {/* High-Density Data Table */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-start">
              <thead>
                <tr className="bg-slate-50/80 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">
                  <th className="py-3 px-4 text-start">{t.tenants.tenantName}</th>
                  <th className="py-3 px-4 text-start">{t.tenants.primaryFqdn}</th>
                  <th className="py-3 px-4 text-start">{t.tenants.hostingServer}</th>
                  <th className="py-3 px-4 text-start">{t.tenants.subscriptionPlan}</th>
                  <th className="py-3 px-4 text-start">{t.tenants.status}</th>
                  <th className="py-3 px-4 text-end">{t.tenants.actions}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {tenants.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">
                      لا توجد شركات مطابقة للفلاتر المحددة.
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
                        <div className="flex items-center gap-1.5">
                          <Server className="w-3.5 h-3.5 text-purple-500 shrink-0" />
                          <span className="font-mono text-xs font-semibold">{ten.databaseServerName}</span>
                        </div>
                        <div className="text-[10px] text-slate-400">{ten.countryName}</div>
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
                            <span>تفاصيل</span>
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

                          <button
                            onClick={() => openDeleteModal(ten)}
                            className="p-1.5 text-rose-500 hover:text-rose-700 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/60 transition-colors cursor-pointer"
                            title={t.tenants.delete}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
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
