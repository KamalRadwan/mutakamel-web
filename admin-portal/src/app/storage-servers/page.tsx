"use client";

import React, { useState } from "react";
import Link from "next/link";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { Server, Database, Activity, AlertCircle, Plus, Search, Filter, ServerCrash, CheckCircle2, ChevronRight, XCircle, RefreshCw, Check, Key, HardDrive } from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";
import { useStorageServers } from "./hooks/useStorageServers";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { StorageServersTableSkeleton } from "./components/StorageServersTableSkeleton";
import type { StorageServerView } from "@/types/storage-server";
import { Navbar } from "@/components/layout/Navbar";
import { StatusBadge } from "@/components/shared/StatusBadge";

export default function StorageServersDirectory() {
  const { lang } = useI18n();
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
      <div className="min-h-screen bg-slate-50 dark:bg-[#090d16] flex flex-col items-center justify-center p-12 text-center">
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

  const activeCount = servers?.filter((s: StorageServerView) => s.status === 'ACTIVE').length || 0;
  const offlineCount = servers?.filter((s: StorageServerView) => s.status === 'OFFLINE').length || 0;
  const totalTenants = servers?.reduce((acc: number, s: StorageServerView) => acc + (s.assignedTenants || 0), 0) || 0;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#090d16] text-slate-900 dark:text-slate-100 flex flex-col">
      <Navbar />

      <main className="flex-1 p-4 sm:p-6 max-w-7xl w-full mx-auto space-y-6">
        {/* Header Title Section with Vibrant Gradient Accents */}
        <div className="relative overflow-hidden bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-6 rounded-3xl border border-indigo-500/20 shadow-xl">
          <div className="absolute top-0 end-0 -mt-10 -me-10 w-72 h-72 bg-gradient-to-br from-indigo-500/20 via-purple-500/20 to-pink-500/0 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 start-1/3 -mb-10 w-60 h-60 bg-blue-500/15 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-5">
            <div className="flex items-center gap-4">
              <div className="p-3.5 bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-500 text-white rounded-2xl shadow-lg shadow-indigo-500/30 flex items-center justify-center shrink-0">
                <HardDrive className="w-7 h-7" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-black tracking-tight text-white">
                    {lang === "ar" ? "خوادم التخزين السحابي" : "Storage Infrastructure"}
                  </h1>
                  <span className="px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded-full">
                    S3 Object Storage
                  </span>
                </div>
                <p className="text-xs text-indigo-200/80 mt-1 max-w-xl leading-relaxed">
                  {lang === "ar"
                    ? "إدارة بنية التخزين السحابي المحمية، تدوير مفاتيح الوصول، ومراقبة سعة المستأجرين"
                    : "Manage encrypted cloud storage nodes, S3 bucket endpoints, access credentials, and tenant capacity."}
                </p>
              </div>
            </div>

            {canCreate && (
              <Link
                href="/storage-servers/new"
                className="px-5 py-2.5 text-xs font-bold bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 hover:from-indigo-400 hover:to-pink-400 text-white rounded-xl shadow-lg shadow-purple-500/25 transition-all transform hover:-translate-y-0.5 flex items-center gap-2 cursor-pointer shrink-0 border border-white/20"
              >
                <Plus className="w-4 h-4" />
                <span>{lang === "ar" ? "إضافة خادم جديد" : "Register Storage Node"}</span>
              </Link>
            )}
          </div>
        </div>

        {/* Summary Metrics Cards with Distinct Colorful Glows */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Total Servers */}
          <div className="relative overflow-hidden bg-white dark:bg-slate-900/90 p-5 rounded-2xl border border-slate-200/80 dark:border-indigo-500/20 shadow-sm hover:shadow-md transition-all">
            <div className="absolute top-0 end-0 w-24 h-24 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                {lang === "ar" ? "إجمالي الخوادم" : "Total Nodes"}
              </span>
              <div className="p-2 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 rounded-xl border border-indigo-200 dark:border-indigo-800/50">
                <Server className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-2 font-mono">
              {servers?.length || 0}
            </div>
            <div className="text-[11px] text-indigo-600 dark:text-indigo-400 font-semibold mt-1 flex items-center gap-1">
              <Activity className="w-3 h-3" />
              <span>{lang === "ar" ? "خوادم مسجلة بالنظام" : "Registered Storage Cluster"}</span>
            </div>
          </div>

          {/* Active Servers */}
          <div className="relative overflow-hidden bg-white dark:bg-slate-900/90 p-5 rounded-2xl border border-slate-200/80 dark:border-emerald-500/20 shadow-sm hover:shadow-md transition-all">
            <div className="absolute top-0 end-0 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                {lang === "ar" ? "خوادم نشطة" : "Active Nodes"}
              </span>
              <div className="p-2 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 rounded-xl border border-emerald-200 dark:border-emerald-800/50">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-2 font-mono flex items-center gap-2">
              {activeCount}
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
            </div>
            <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold mt-1">
              {lang === "ar" ? "جاهزة للربط والخدمة" : "Operational & Healthy"}
            </div>
          </div>

          {/* Offline Servers */}
          <div className="relative overflow-hidden bg-white dark:bg-slate-900/90 p-5 rounded-2xl border border-slate-200/80 dark:border-rose-500/20 shadow-sm hover:shadow-md transition-all">
            <div className="absolute top-0 end-0 w-24 h-24 bg-rose-500/10 rounded-full blur-2xl pointer-events-none" />
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                {lang === "ar" ? "غير متصل / مسودة" : "Offline / Draft"}
              </span>
              <div className="p-2 bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 rounded-xl border border-rose-200 dark:border-rose-800/50">
                <ServerCrash className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-2 font-mono">
              {offlineCount}
            </div>
            <div className="text-[11px] text-rose-600 dark:text-rose-400 font-semibold mt-1">
              {lang === "ar" ? "تحتاج تفعيل واختبار" : "Requires Attention"}
            </div>
          </div>

          {/* Total Tenants */}
          <div className="relative overflow-hidden bg-white dark:bg-slate-900/90 p-5 rounded-2xl border border-slate-200/80 dark:border-purple-500/20 shadow-sm hover:shadow-md transition-all">
            <div className="absolute top-0 end-0 w-24 h-24 bg-purple-500/10 rounded-full blur-2xl pointer-events-none" />
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                {lang === "ar" ? "المستأجرين المربوطين" : "Allocated Tenants"}
              </span>
              <div className="p-2 bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 rounded-xl border border-purple-200 dark:border-purple-800/50">
                <Database className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black text-purple-600 dark:text-purple-400 mt-2 font-mono">
              {totalTenants}
            </div>
            <div className="text-[11px] text-purple-600 dark:text-purple-400 font-semibold mt-1">
              {lang === "ar" ? "موزعين على خوادم التخزين" : "Active Bucket Allocations"}
            </div>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="bg-white dark:bg-slate-900/90 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-indigo-500 absolute top-3.5 start-3.5" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && setSearch(searchInput)}
              placeholder={lang === "ar" ? "بحث برمز الخادم أو الاسم..." : "Search by code or name..."}
              className="w-full ps-10 pe-4 py-2.5 text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="px-4 py-2.5 text-xs font-semibold bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:border-indigo-500 cursor-pointer"
            >
              <option value="ALL">{lang === "ar" ? "جميع الحالات" : "All Statuses"}</option>
              <option value="ACTIVE">{lang === "ar" ? "نشط (ACTIVE)" : "Active (ACTIVE)"}</option>
              <option value="DRAFT">{lang === "ar" ? "مسودة (DRAFT)" : "Draft (DRAFT)"}</option>
              <option value="OFFLINE">{lang === "ar" ? "غير متصل (OFFLINE)" : "Offline (OFFLINE)"}</option>
            </select>

            <button
              onClick={() => refresh()}
              className="p-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 hover:border-indigo-500 text-slate-600 dark:text-slate-300 rounded-xl hover:text-indigo-600 transition-colors"
              title={lang === "ar" ? "تحديث" : "Refresh"}
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Dynamic Colorful Table View */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-start">
              <thead>
                <tr className="bg-slate-100/70 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 font-extrabold uppercase tracking-wider">
                  <th className="py-4 px-5 text-start">{lang === "ar" ? "اسم الخادم" : "Storage Server"}</th>
                  <th className="py-4 px-5 text-start">{lang === "ar" ? "نقطة النهاية (S3 Endpoint)" : "S3 Endpoint"}</th>
                  <th className="py-4 px-5 text-start">{lang === "ar" ? "المنطقة / الدلو" : "Region / Bucket"}</th>
                  <th className="py-4 px-5 text-start">{lang === "ar" ? "سعة المستأجرين" : "Tenant Capacity"}</th>
                  <th className="py-4 px-5 text-start">{lang === "ar" ? "الحالة" : "Status"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {isLoading ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-500">
                      <div className="flex flex-col items-center gap-2">
                        <RefreshCw className="w-6 h-6 animate-spin text-indigo-500" />
                        <span>{lang === "ar" ? "جاري تحميل خوادم التخزين..." : "Loading storage servers..."}</span>
                      </div>
                    </td>
                  </tr>
                ) : error ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-rose-500">
                      <div className="flex flex-col items-center gap-2">
                        <AlertCircle className="w-8 h-8 text-rose-500" />
                        <span className="font-bold">{lang === "ar" ? "فشل تحميل البيانات" : "Failed to load storage servers"}</span>
                        <button onClick={() => refresh()} className="mt-2 px-4 py-1.5 bg-rose-50 text-rose-600 dark:bg-rose-950/40 rounded-xl font-semibold border border-rose-200 dark:border-rose-900 text-xs">
                          {lang === "ar" ? "إعادة المحاولة" : "Retry"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : servers?.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-16 text-center text-slate-400">
                      <div className="flex flex-col items-center gap-3">
                        <div className="p-4 bg-slate-100 dark:bg-slate-800 rounded-full text-slate-400">
                          <HardDrive className="w-8 h-8" />
                        </div>
                        <span className="font-semibold text-slate-600 dark:text-slate-300">
                          {search || status !== "ALL"
                            ? (lang === "ar" ? "لا توجد خوادم مطابقة لفلاتر البحث" : "No storage servers match your criteria")
                            : (lang === "ar" ? "لم يتم تسجيل أي خوادم تخزين حتى الآن" : "No storage servers registered yet")}
                        </span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  servers?.map((server: StorageServerView) => (
                    <tr key={server.id} className="group hover:bg-indigo-50/40 dark:hover:bg-indigo-950/20 transition-all">
                      <td className="py-4 px-5">
                        <Link
                          href={`/storage-servers/${server.id}`}
                          className="group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors inline-block"
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-slate-900 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                              {server.name}
                            </span>
                            {server.isPlatformDefault && (
                              <span className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-[9px] px-2 py-0.5 rounded-full uppercase font-black tracking-wider shadow-xs">
                                Default
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] text-slate-400 font-mono block mt-0.5">{server.code}</span>
                        </Link>
                      </td>
                      <td className="py-4 px-5 font-mono text-slate-600 dark:text-slate-300">
                        <div className="flex items-center gap-2">
                          <span className="bg-slate-100 dark:bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700/60 font-semibold text-[11px]">
                            {server.endpoint}
                          </span>
                          {!server.credentialsConfigured && (
                            <span className="px-2 py-0.5 bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400 border border-amber-300 dark:border-amber-800 rounded-md text-[10px] font-bold flex items-center gap-1" title="Missing S3 Credentials">
                              <AlertCircle className="w-3 h-3" />
                              Keys Missing
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-4 px-5">
                        <div className="flex items-center gap-1.5 font-medium">
                          <span className="px-2.5 py-1 bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 rounded-lg border border-purple-200 dark:border-purple-900/60 font-mono text-[11px]">
                            {server.region}
                          </span>
                          <span className="text-slate-400">/</span>
                          <span className="px-2.5 py-1 bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 rounded-lg border border-indigo-200 dark:border-indigo-900/60 font-mono text-[11px]">
                            {server.bucketName}
                          </span>
                        </div>
                      </td>
                      <td className="py-4 px-5">
                        <div className="flex items-center gap-2">
                          <div className="w-24 bg-slate-200 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                            <div
                              className="bg-gradient-to-r from-indigo-500 to-purple-500 h-full rounded-full"
                              style={{ width: `${Math.min(100, ((server.assignedTenants || 0) / (server.maxTenants || 10)) * 100)}%` }}
                            />
                          </div>
                          <span className="font-bold text-slate-700 dark:text-slate-300 font-mono">
                            {server.assignedTenants || 0} / {server.maxTenants === null ? '∞' : server.maxTenants}
                          </span>
                        </div>
                      </td>
                      <td className="py-4 px-5">
                        <StatusBadge status={server.status} enumType="db-server" />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
