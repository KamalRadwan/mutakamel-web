"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Server, Database, Activity, AlertCircle, Plus, Search, Filter, ServerCrash, CheckCircle2, ChevronRight, XCircle, RefreshCw } from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";
import { useStorageServers } from "./hooks/useStorageServers";
import { StorageServersTableSkeleton } from "./components/StorageServersTableSkeleton";
import { formatBytes } from "@/lib/utils/formatters";
import type { StorageServer } from "./types";

function StorageServersDirectory() {
  const { lang, t } = useI18n();
  const {
    servers,
    isLoading,
    error,
    search,
    setSearch,
    status,
    setStatus,
    canRead,
    canCreate,
    refresh
  } = useStorageServers();

  const [searchInput, setSearchInput] = useState(search);

  if (!canRead) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center h-[calc(100vh-200px)]">
        <div className="w-16 h-16 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mb-4">
          <AlertCircle className="w-8 h-8 text-red-500" />
        </div>
        <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-2">
          {lang === "ar" ? "تم رفض الوصول" : "Access Denied"}
        </h2>
        <p className="text-sm text-slate-500 max-w-md">
          {lang === "ar"
            ? "ليس لديك الصلاحيات الكافية لعرض خوادم التخزين."
            : "You do not have the required permissions to view storage servers."}
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/50 rounded-2xl p-6 flex flex-col items-center justify-center text-center">
          <ServerCrash className="w-12 h-12 text-red-500 mb-4" />
          <h3 className="text-base font-bold text-red-900 dark:text-red-400 mb-2">
            {lang === "ar" ? "تعذر تحميل الخوادم" : "Failed to load servers"}
          </h3>
          <p className="text-sm text-red-600 dark:text-red-400/80 mb-6">
            {error?.message || (lang === "ar" ? "حدث خطأ غير متوقع." : "An unexpected error occurred.")}
          </p>
          <button
            onClick={() => refresh()}
            className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            {lang === "ar" ? "إعادة المحاولة" : "Retry"}
          </button>
        </div>
      </div>
    );
  }

  const activeCount = servers.filter((s: StorageServer) => s.status === 'ACTIVE').length;
  const offlineCount = servers.filter((s: StorageServer) => s.status === 'OFFLINE').length;
  const totalTenants = servers.reduce((acc: number, s: StorageServer) => acc + (s.currentTenants || 0), 0);
  
  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Database className="w-6 h-6 text-blue-600 dark:text-blue-500" />
            {lang === "ar" ? "خوادم التخزين" : "Storage Servers"}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {lang === "ar"
              ? "إدارة ومراقبة بنية التخزين التحتية"
              : "Manage and monitor storage infrastructure"}
          </p>
        </div>
        
        {canCreate && (
          <Link
            href="/storage-servers/new"
            className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-all shadow-sm shadow-blue-600/20"
          >
            <Plus className="w-4 h-4" />
            {lang === "ar" ? "إضافة خادم" : "Add Server"}
          </Link>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <MetricCard
          title={lang === "ar" ? "إجمالي الخوادم" : "Total Servers"}
          value={servers.length}
          icon={<Server className="w-5 h-5 text-blue-500" />}
          trend={null}
        />
        <MetricCard
          title={lang === "ar" ? "نشط" : "Active"}
          value={activeCount}
          icon={<CheckCircle2 className="w-5 h-5 text-emerald-500" />}
          trend={null}
        />
        <MetricCard
          title={lang === "ar" ? "غير متصل" : "Offline"}
          value={offlineCount}
          icon={<XCircle className="w-5 h-5 text-rose-500" />}
          trend={null}
        />
        <MetricCard
          title={lang === "ar" ? "إجمالي المستأجرين" : "Total Tenants"}
          value={totalTenants}
          icon={<Activity className="w-5 h-5 text-indigo-500" />}
          trend={null}
        />
      </div>

      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute top-2.5 start-3" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && setSearch(searchInput)}
            placeholder={lang === "ar" ? "بحث برمز الخادم أو الاسم..." : "Search by code or name..."}
            className="w-full ps-9 pe-3 py-2 text-sm bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/80 rounded-xl focus:outline-none focus:border-blue-600 text-slate-900 dark:text-slate-100"
          />
        </div>
        
        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-2 sm:pb-0">
          <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 whitespace-nowrap bg-slate-50 dark:bg-slate-800/50 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700/80">
            <Filter className="w-4 h-4" />
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="bg-transparent font-medium focus:outline-none cursor-pointer"
            >
              <option value="ALL">{lang === "ar" ? "جميع الحالات" : "All Statuses"}</option>
              <option value="ACTIVE">{lang === "ar" ? "نشط" : "Active"}</option>
              <option value="DRAFT">{lang === "ar" ? "مسودة" : "Draft"}</option>
              <option value="DRAINING">{lang === "ar" ? "قيد الاستنزاف" : "Draining"}</option>
              <option value="OFFLINE">{lang === "ar" ? "غير متصل" : "Offline"}</option>
            </select>
          </div>
        </div>
      </div>

      {isLoading ? (
        <StorageServersTableSkeleton />
      ) : servers.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-12 flex flex-col items-center justify-center text-center shadow-2xs">
          <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
            <Database className="w-8 h-8 text-slate-400" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-2">
            {search || status !== "ALL"
              ? (lang === "ar" ? "لا توجد نتائج" : "No results found")
              : (lang === "ar" ? "لا يوجد خوادم تخزين" : "No storage servers")}
          </h3>
          <p className="text-sm text-slate-500 max-w-sm mb-6">
            {search || status !== "ALL"
              ? (lang === "ar" ? "جرب تعديل مرشحات البحث." : "Try adjusting your search filters.")
              : (lang === "ar" ? "قم بإضافة خادم جديد للبدء." : "Add a new server to get started.")}
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-slate-50/80 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-xs text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3 font-semibold">{lang === "ar" ? "الخادم" : "Server"}</th>
                  <th className="px-4 py-3 font-semibold">{lang === "ar" ? "المنطقة" : "Region"}</th>
                  <th className="px-4 py-3 font-semibold">{lang === "ar" ? "الحالة" : "Status"}</th>
                  <th className="px-4 py-3 font-semibold">{lang === "ar" ? "المستأجرين" : "Tenants"}</th>
                  <th className="px-4 py-3 font-semibold">{lang === "ar" ? "السعة المستخدمة" : "Used Cap."}</th>
                  <th className="px-4 py-3 font-semibold text-end">{lang === "ar" ? "الإجراءات" : "Actions"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {servers.map((server: StorageServer) => (
                  <tr
                    key={server.id}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors group"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center shrink-0 border border-blue-100 dark:border-blue-800">
                          <Server className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                          <div className="font-bold text-slate-900 dark:text-slate-100 text-[13px]">
                            {server.name}
                          </div>
                          <div className="text-[11px] text-slate-500 font-mono">
                            {server.code}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                        {server.region}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={server.status} lang={lang} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300 font-medium">
                        <Activity className="w-3.5 h-3.5 text-slate-400" />
                        {server.currentTenants || 0} / {server.maxTenants}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs font-mono text-slate-600 dark:text-slate-300">
                      {server.usedCapacityBytes ? formatBytes(parseInt(server.usedCapacityBytes)) : "0 B"}
                    </td>
                    <td className="px-4 py-3 text-end">
                      <Link
                        href={`/storage-servers/${server.id}`}
                        className="inline-flex items-center justify-center p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:text-blue-400 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                      >
                        <ChevronRight className={`w-4 h-4 ${lang === "ar" ? "rotate-180" : ""}`} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function MetricCard({ title, value, icon, trend }: any) {
  return (
    <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs flex items-center gap-3">
      <div className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center shrink-0">
        {icon}
      </div>
      <div>
        <div className="text-[11px] text-slate-500 font-medium mb-0.5">{title}</div>
        <div className="text-lg font-bold text-slate-900 dark:text-slate-100">{value}</div>
      </div>
    </div>
  );
}

function StatusBadge({ status, lang }: { status: string; lang: string }) {
  const map: Record<string, { cls: string; ar: string; en: string }> = {
    ACTIVE: { cls: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900", ar: "نشط", en: "Active" },
    DRAFT: { cls: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900", ar: "مسودة", en: "Draft" },
    DRAINING: { cls: "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-400 dark:border-indigo-900", ar: "استنزاف", en: "Draining" },
    OFFLINE: { cls: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-900", ar: "غير متصل", en: "Offline" },
  };

  const c = map[status] || { cls: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700", ar: status, en: status };

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border ${c.cls}`}>
      {lang === "ar" ? c.ar : c.en}
    </span>
  );
}

export default function Page() {
  return (
    <StorageServersDirectory />
  );
}
