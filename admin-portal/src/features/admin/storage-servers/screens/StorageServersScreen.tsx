"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  HardDrive,
  Plus,
  RefreshCw,
  Search,
} from "lucide-react";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { useI18n } from "@/i18n/I18nContext";
import { useStorageServers } from "../hooks/useStorageServers";
import type { StorageServerView } from "../types";

export function StorageServersScreen() {
  const { lang } = useI18n();
  const isArabic = lang === "ar";
  const view = useStorageServers();
  const activeOnPage = view.servers.filter((server) => server.status === "ACTIVE").length;
  const freshOnPage = view.servers.filter((server) => server.connectionEvidenceFresh).length;

  if (view.isAuthLoading) {
    return <div className="grid min-h-80 place-items-center text-sm font-semibold text-slate-500"><span className="flex items-center gap-2"><RefreshCw className="size-5 animate-spin" />{isArabic ? "جارٍ التحقق من الصلاحيات…" : "Checking permissions…"}</span></div>;
  }
  if (!view.canRead) {
    return <section className="mx-auto max-w-xl rounded-xl border border-rose-200 bg-rose-50 p-8 text-center text-rose-900 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100"><AlertCircle className="mx-auto size-10" /><h1 className="mt-3 text-lg font-semibold">{isArabic ? "تم رفض الوصول" : "Access denied"}</h1><p className="mt-2 text-sm">{isArabic ? "لا تملك صلاحية قراءة خوادم التخزين." : "You do not have permission to read Storage Servers."}</p></section>;
  }

  return (
    <div className="space-y-6">
      <header className="rounded-xl border border-slate-200 bg-white px-4 py-3 sm:px-5 sm:py-3.5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-indigo-600 text-white shadow-xs">
              <HardDrive className="size-4" aria-hidden="true" />
            </span>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-base sm:text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-100">
                  {isArabic ? "خوادم التخزين" : "Storage servers"}
                </h1>
                <span className="text-2xs font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded-md border border-indigo-200/50 dark:border-indigo-900/50">
                  {isArabic ? "البنية التحتية" : "Infrastructure"}
                </span>
              </div>
              <p className="mt-0.5 max-w-2xl text-xs leading-tight text-slate-600 dark:text-slate-400">
                {isArabic
                  ? "سجل خوادم S3 وحالة اختبار الاتصال الآمن. يجدول Worker الاختبار كل 12 ساعة."
                  : "S3 registry and safe connection evidence. Worker schedules checks every 12 hours."}
              </p>
            </div>
          </div>
          {view.canCreate ? (
            <Link
              href="/storage-servers/new"
              className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 text-xs font-semibold text-white hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 shrink-0"
            >
              <Plus className="size-3.5" aria-hidden="true" />
              {isArabic ? "تسجيل خادم" : "Register server"}
            </Link>
          ) : null}
        </div>
      </header>

      <section aria-label={isArabic ? "ملخص الصفحة الحالية" : "Current page summary"} className="grid gap-3 sm:grid-cols-3">
        <SummaryCard label={isArabic ? "إجمالي النتائج" : "Total results"} value={view.total} icon={<HardDrive className="size-4" />} tone="indigo" />
        <SummaryCard label={isArabic ? "نشط في الصفحة" : "Active on this page"} value={activeOnPage} icon={<CheckCircle2 className="size-4" />} tone="emerald" />
        <SummaryCard label={isArabic ? "دليل حديث في الصفحة" : "Fresh evidence on this page"} value={freshOnPage} icon={<Clock3 className="size-4" />} tone="amber" />
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
        <div className="grid gap-3 lg:grid-cols-[minmax(240px,1fr)_180px_220px_auto] lg:items-end">
          <label className="block">
            <span className={labelClass}>{isArabic ? "بحث" : "Search"}</span>
            <span className="relative block">
              <Search className="pointer-events-none absolute start-3 top-3.5 size-4 text-slate-400" aria-hidden="true" />
              <input
                value={view.search}
                onChange={(event) => view.setSearch(event.target.value)}
                placeholder={isArabic ? "الاسم أو الرمز أو نقطة النهاية" : "Name, code, or endpoint"}
                className={`${inputClass} ps-10`}
              />
            </span>
          </label>
          <label className="block">
            <span className={labelClass}>{isArabic ? "الحالة" : "Status"}</span>
            <select value={view.status} onChange={(event) => view.setStatus(event.target.value as typeof view.status)} className={inputClass}>
              <option value="ALL">{isArabic ? "كل الحالات" : "All statuses"}</option>
              <option value="ACTIVE">ACTIVE</option>
              <option value="DRAFT">DRAFT</option>
              <option value="OFFLINE">OFFLINE</option>
            </select>
          </label>
          <label className="block">
            <span className={labelClass}>{isArabic ? "الترتيب" : "Sort"}</span>
            <select
              value={`${view.sortBy}:${view.sortDir}`}
              onChange={(event) => {
                const [sortBy, sortDir] = event.target.value.split(":") as [typeof view.sortBy, typeof view.sortDir];
                view.setSortBy(sortBy);
                view.setSortDir(sortDir);
              }}
              className={inputClass}
            >
              <option value="name:ASC">{isArabic ? "الاسم تصاعدياً" : "Name A–Z"}</option>
              <option value="name:DESC">{isArabic ? "الاسم تنازلياً" : "Name Z–A"}</option>
              <option value="lastConnectionTestedAt:DESC">{isArabic ? "أحدث اختبار" : "Newest test"}</option>
              <option value="lastConnectionTestedAt:ASC">{isArabic ? "أقدم اختبار" : "Oldest test"}</option>
              <option value="createdAt:DESC">{isArabic ? "الأحدث تسجيلاً" : "Newest registration"}</option>
            </select>
          </label>
          <button
            type="button"
            onClick={() => void view.refresh()}
            disabled={view.isLoading}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 px-4 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:hover:bg-slate-900"
          >
            <RefreshCw className={`size-4 ${view.isLoading ? "animate-spin" : ""}`} aria-hidden="true" />
            {isArabic ? "تحديث" : "Refresh"}
          </button>
        </div>
      </section>

      {view.error ? (
        <section role="alert" className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100">
          <AlertCircle className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
          <div><p className="font-semibold">{isArabic ? "تعذر تحميل خوادم التخزين" : "Storage servers could not be loaded"}</p><p className="mt-1">{view.error.message}</p>{view.error.correlationId ? <p className="mt-1 font-mono text-xs">Correlation ID: {view.error.correlationId}</p> : null}</div>
        </section>
      ) : null}

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-sm">
            <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:bg-slate-900">
              <tr><th className="px-5 py-3 text-start">{isArabic ? "الخادم" : "Server"}</th><th className="px-5 py-3 text-start">{isArabic ? "الموقع" : "Location"}</th><th className="px-5 py-3 text-start">{isArabic ? "المستأجرون" : "Tenants"}</th><th className="px-5 py-3 text-start">{isArabic ? "دليل الاتصال" : "Connection evidence"}</th><th className="px-5 py-3 text-start">{isArabic ? "الحالة" : "Status"}</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {view.isLoading ? <StateRow label={isArabic ? "جارٍ تحميل الخوادم…" : "Loading storage servers…"} /> : null}
              {!view.isLoading && !view.error && view.servers.length === 0 ? <StateRow label={isArabic ? "لا توجد نتائج مطابقة." : "No matching storage servers."} /> : null}
              {!view.isLoading && !view.error ? view.servers.map((server) => <ServerRow key={server.id} server={server} isArabic={isArabic} />) : null}
            </tbody>
          </table>
        </div>
        <div className="flex flex-col gap-3 border-t border-slate-200 px-5 py-4 text-sm dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-slate-500">
            {isArabic ? `صفحة ${view.page} من ${Math.max(view.totalPages, 1)} · ${view.total} نتيجة` : `Page ${view.page} of ${Math.max(view.totalPages, 1)} · ${view.total} results`}
          </p>
          <div className="flex gap-2">
            <button type="button" onClick={() => view.setPage(Math.max(1, view.page - 1))} disabled={view.page <= 1 || view.isLoading} aria-label={isArabic ? "الصفحة السابقة" : "Previous page"} className={pageButtonClass}><ChevronLeft className={`size-4 ${isArabic ? "rotate-180" : ""}`} /></button>
            <button type="button" onClick={() => view.setPage(Math.min(view.totalPages, view.page + 1))} disabled={view.page >= view.totalPages || view.isLoading || view.totalPages === 0} aria-label={isArabic ? "الصفحة التالية" : "Next page"} className={pageButtonClass}><ChevronRight className={`size-4 ${isArabic ? "rotate-180" : ""}`} /></button>
          </div>
        </div>
      </section>
    </div>
  );
}

function ServerRow({ server, isArabic }: { server: StorageServerView; isArabic: boolean }) {
  const evidenceTone = server.connectionEvidenceFresh && server.lastConnectionTestStatus === "PASSED" ? "text-emerald-700 dark:text-emerald-300" : server.lastConnectionTestStatus === "FAILED" ? "text-rose-700 dark:text-rose-300" : "text-amber-700 dark:text-amber-300";
  return (
    <tr className="align-top hover:bg-slate-50/70 dark:hover:bg-slate-900/50">
      <td className="px-5 py-4"><Link href={`/storage-servers/${server.id}`} className="font-semibold text-indigo-700 hover:underline dark:text-indigo-300">{server.name}</Link><p className="mt-1 font-mono text-xs text-slate-500">{server.code}</p>{server.isPlatformDefault ? <span className="mt-2 inline-flex rounded-full bg-indigo-50 px-2 py-0.5 text-2xs font-semibold uppercase text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300">{isArabic ? "الافتراضي" : "Platform default"}</span> : null}</td>
      <td className="px-5 py-4"><p className="max-w-xs truncate font-mono text-xs" title={server.endpoint}>{server.endpoint}</p><p className="mt-1 text-xs text-slate-500">{server.region} · {server.bucketName}</p></td>
      <td className="px-5 py-4 font-mono font-semibold">{server.assignedTenants} / {server.maxTenants ?? "∞"}</td>
      <td className={`px-5 py-4 ${evidenceTone}`}><p className="font-semibold">{evidenceLabel(server, isArabic)}</p><p className="mt-1 text-xs text-slate-500">{formatDate(server.lastConnectionTestedAt, isArabic)}</p>{server.lastConnectionTestErrorCode ? <code className="mt-1 block max-w-xs truncate text-xs" title={server.lastConnectionTestErrorCode}>{server.lastConnectionTestErrorCode}</code> : null}</td>
      <td className="px-5 py-4"><StatusBadge status={server.status} enumType="db-server" /></td>
    </tr>
  );
}

function evidenceLabel(server: StorageServerView, isArabic: boolean) {
  if (server.lastConnectionTestStatus === "FAILED") return isArabic ? "فشل الاختبار" : "Test failed";
  if (server.connectionEvidenceFresh) return isArabic ? "حديث وجاهز للتوزيع" : "Fresh for placement";
  if (server.lastConnectionTestStatus === "PASSED") return isArabic ? "نجح لكنه قديم" : "Passed but stale";
  return isArabic ? "لم يُختبر" : "Not tested";
}

function formatDate(value: string | null, isArabic: boolean) {
  if (!value) return isArabic ? "لا يوجد وقت مسجل" : "No timestamp recorded";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat(isArabic ? "ar-EG" : "en-US", { year: "numeric", month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "UTC", timeZoneName: "short" }).format(date);
}

function StateRow({ label }: { label: string }) { return <tr><td colSpan={5} className="px-5 py-14 text-center font-semibold text-slate-500">{label}</td></tr>; }

function SummaryCard({ label, value, icon, tone }: { label: string; value: number; icon: ReactNode; tone: "indigo" | "emerald" | "amber" }) {
  const tones = { indigo: "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300", emerald: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300", amber: "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300" };
  return <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950"><div className="flex items-center justify-between"><p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</p><span className={`grid size-8 place-items-center rounded-lg ${tones[tone]}`}>{icon}</span></div><p className="mt-2 font-mono text-2xl font-semibold">{value}</p></div>;
}

const labelClass = "mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-500";
const inputClass = "min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600/20 dark:border-slate-700 dark:bg-slate-900 dark:text-white";
const pageButtonClass = "grid size-11 place-items-center rounded-xl border border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:hover:bg-slate-900";
