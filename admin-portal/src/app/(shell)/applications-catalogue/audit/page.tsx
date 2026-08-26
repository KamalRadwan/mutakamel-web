"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, History, Loader2, RefreshCw } from "lucide-react";
import { Navbar } from "@/components/layout/Navbar";
import { useAuth } from "@/context/AuthContext";
import { applicationsApi } from "@/features/admin/applications/api/applications.api";
import type {
  CatalogueAuditEntityType,
  CatalogueAuditPageView,
} from "@/features/admin/applications/types";
import { useI18n } from "@/i18n/I18nContext";
import { adminCanAll } from "@/lib/auth/rbac";
import {
  normalizeApiError,
  type NormalizedApiError,
} from "@/shared/api/normalized-api-error";

const ENTITY_TYPES = [
  "APPLICATION",
  "TIER",
  "FEATURE",
  "TIER_FEATURE_GRANTS",
  "PRICE_LADDER",
] as const satisfies readonly CatalogueAuditEntityType[];

export default function CatalogueAuditPage() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const { lang, dir } = useI18n();
  const text = auditCopy(lang);
  const canRead = adminCanAll(user, ["admin.catalog.read"]);
  const [data, setData] = useState<CatalogueAuditPageView | null>(null);
  const [page, setPage] = useState(1);
  const [entityType, setEntityType] =
    useState<CatalogueAuditEntityType | "ALL">("ALL");
  const [action, setAction] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<NormalizedApiError | null>(null);

  const load = useCallback(async () => {
    if (isAuthLoading || !canRead) return;
    setIsLoading(true);
    setError(null);
    try {
      setData(
        await applicationsApi.getGlobalAudit({
          page,
          limit: 20,
          ...(entityType !== "ALL" ? { entityType } : {}),
          ...(action.trim() ? { action: action.trim() } : {}),
        }),
      );
    } catch (requestError) {
      setData(null);
      setError(normalizeApiError(requestError));
    } finally {
      setIsLoading(false);
    }
  }, [action, canRead, entityType, isAuthLoading, page]);

  useEffect(() => {
    queueMicrotask(() => void load());
  }, [load]);

  return (
    <div
      dir={dir}
      className="flex min-h-screen flex-col bg-slate-50 text-slate-950 dark:bg-canvas dark:text-slate-100"
    >
      <Navbar />
      <main className="w-full flex-1 space-y-5 px-4 py-4 sm:py-6">
        <header className="rounded-xl border border-violet-500/20 bg-slate-950 px-4 py-3 text-white shadow-md sm:px-5 sm:py-3.5">
          <div className="flex items-center gap-3">
            <Link
              href="/applications-catalogue"
              aria-label={text.back}
              className="rounded-xl border border-white/15 bg-white/10 p-2 hover:bg-white/15"
            >
              <ArrowLeft
                className={`h-4 w-4 ${dir === "rtl" ? "rotate-180" : ""}`}
              />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-semibold sm:text-lg">{text.title}</h1>
                <span className="rounded-md border border-violet-400/30 bg-violet-500/20 px-2 py-0.5 font-mono text-2xs font-semibold uppercase tracking-wider text-violet-300">
                  {text.evidence}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-slate-300">
                {text.description}
              </p>
            </div>
          </div>
        </header>

        {isAuthLoading ? (
          <StateCard loading>{text.checking}</StateCard>
        ) : !canRead ? (
          <StateCard>{text.forbidden}</StateCard>
        ) : (
          <>
            <section className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row dark:border-slate-800 dark:bg-slate-900">
              <select
                aria-label={text.entityType}
                value={entityType}
                onChange={(event) => {
                  setEntityType(
                    event.target.value as CatalogueAuditEntityType | "ALL",
                  );
                  setPage(1);
                }}
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold dark:border-slate-700 dark:bg-slate-950"
              >
                <option value="ALL">{text.allEntityTypes}</option>
                {ENTITY_TYPES.map((value) => (
                  <option key={value} value={value}>
                    {text.entityNames[value]}
                  </option>
                ))}
              </select>
              <input
                aria-label={text.actionFilter}
                placeholder={text.actionPlaceholder}
                value={action}
                maxLength={100}
                onChange={(event) => {
                  setAction(event.target.value);
                  setPage(1);
                }}
                className="min-w-64 flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs outline-none focus:border-violet-500 dark:border-slate-700 dark:bg-slate-950"
              />
              <button
                type="button"
                onClick={() => void load()}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                {text.refresh}
              </button>
            </section>

            <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800">
                <h2 className="flex items-center gap-2 text-sm font-semibold">
                  <History className="h-4 w-4 text-violet-500" />
                  {text.globalEvents}
                </h2>
                <span className="font-mono text-xs text-slate-500">
                  {text.events(data?.total ?? 0)}
                </span>
              </div>
              <div className="p-5">
                {isLoading ? (
                  <div
                    role="status"
                    className="flex items-center justify-center gap-2 py-16 text-xs text-slate-500"
                  >
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {text.loading}
                  </div>
                ) : error ? (
                  <div
                    role="alert"
                    className="rounded-xl border border-rose-200 bg-rose-50 p-5 text-center text-xs text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300"
                  >
                    <p>{text.unavailable}</p>
                    <p className="mt-1 font-mono text-xs">
                      {error.errorCode}
                      {error.correlationId ? ` · ${error.correlationId}` : ""}
                    </p>
                    <button
                      type="button"
                      onClick={() => void load()}
                      className="mt-3 rounded-xl bg-rose-600 px-3 py-2 font-semibold text-white"
                    >
                      {text.retry}
                    </button>
                  </div>
                ) : !data?.items.length ? (
                  <div className="rounded-xl border border-dashed border-slate-300 py-16 text-center text-xs text-slate-500 dark:border-slate-700">
                    {text.empty}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {data.items.map((event) => (
                      <article
                        key={event.id}
                        className="rounded-xl border border-slate-200 p-4 dark:border-slate-800"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <span className="font-mono text-xs font-semibold text-violet-600 dark:text-violet-400">
                              {event.action}
                            </span>
                            <span className="ms-2 rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                              {text.entityNames[event.entityType] ?? event.entityType}
                            </span>
                          </div>
                          <time className="text-xs text-slate-500">
                            {new Date(event.occurredAt).toLocaleString(
                              lang === "ar" ? "ar-EG" : "en-US",
                            )}
                          </time>
                        </div>
                        <p className="mt-2 text-xs text-slate-600 dark:text-slate-300">
                          {text.actor}: {event.actorLabel || event.actorAdminId || text.system}
                        </p>
                        <p className="mt-1 font-mono text-xs text-slate-400">
                          {text.correlation}: {event.correlationId || text.notProvided}
                        </p>
                      </article>
                    ))}
                  </div>
                )}
              </div>
              {data && data.totalPages > 1 ? (
                <footer className="flex items-center justify-between border-t border-slate-200 px-5 py-4 text-xs dark:border-slate-800">
                  <span>{text.page(data.page, data.totalPages)}</span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={page <= 1}
                      onClick={() => setPage((current) => Math.max(1, current - 1))}
                      className="rounded-lg border border-slate-300 px-3 py-1.5 font-semibold disabled:opacity-40 dark:border-slate-700"
                    >
                      {text.previous}
                    </button>
                    <button
                      type="button"
                      disabled={page >= data.totalPages}
                      onClick={() => setPage((current) => current + 1)}
                      className="rounded-lg border border-slate-300 px-3 py-1.5 font-semibold disabled:opacity-40 dark:border-slate-700"
                    >
                      {text.next}
                    </button>
                  </div>
                </footer>
              ) : null}
            </section>
          </>
        )}
      </main>
    </div>
  );
}

function StateCard({ children, loading = false }: { children: React.ReactNode; loading?: boolean }) {
  return (
    <div role={loading ? "status" : "alert"} className="flex items-center justify-center gap-2 rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
      {children}
    </div>
  );
}

function auditCopy(lang: "ar" | "en") {
  return lang === "ar"
    ? {
        back: "العودة إلى كتالوج التطبيقات",
        title: "تدقيق الكتالوج",
        evidence: "دليل ثابت لطائرة التحكم",
        description: "راجع تغييرات التطبيقات والباقات والميزات والاستحقاقات والأسعار.",
        checking: "جارٍ التحقق من صلاحية قراءة الكتالوج…",
        forbidden: "تلزم صلاحية قراءة الكتالوج لعرض سجل التدقيق.",
        entityType: "نوع الكيان",
        allEntityTypes: "كل أنواع الكيانات",
        actionFilter: "تصفية الإجراء",
        actionPlaceholder: "صفِّ حسب اسم الإجراء الدقيق",
        refresh: "تحديث",
        globalEvents: "الأحداث العامة",
        events: (count: number) => `${count} حدث`,
        loading: "جارٍ تحميل سجل التدقيق…",
        unavailable: "تعذر تحميل سجل تدقيق الكتالوج.",
        retry: "إعادة المحاولة",
        empty: "لا توجد أحداث تدقيق مطابقة.",
        actor: "المنفذ",
        system: "النظام",
        correlation: "معرّف الارتباط",
        notProvided: "غير متوفر",
        page: (page: number, total: number) => `الصفحة ${page} من ${total}`,
        previous: "السابق",
        next: "التالي",
        entityNames: {
          APPLICATION: "تطبيق",
          TIER: "باقة",
          FEATURE: "ميزة",
          TIER_FEATURE_GRANTS: "منح ميزات الباقة",
          PRICE_LADDER: "سلم الأسعار",
        } as Record<CatalogueAuditEntityType, string>,
      }
    : {
        back: "Back to Application Catalogue",
        title: "Catalogue audit",
        evidence: "Immutable control-plane evidence",
        description: "Review application, tier, feature, entitlement, and pricing mutations.",
        checking: "Checking catalogue-read permission…",
        forbidden: "Catalogue-read permission is required to view audit history.",
        entityType: "Entity type",
        allEntityTypes: "All entity types",
        actionFilter: "Action filter",
        actionPlaceholder: "Filter by exact action",
        refresh: "Refresh",
        globalEvents: "Global events",
        events: (count: number) => `${count} events`,
        loading: "Loading audit…",
        unavailable: "Catalogue audit is unavailable.",
        retry: "Retry",
        empty: "No matching catalogue audit events.",
        actor: "Actor",
        system: "System",
        correlation: "Correlation",
        notProvided: "not provided",
        page: (page: number, total: number) => `Page ${page} of ${total}`,
        previous: "Previous",
        next: "Next",
        entityNames: {
          APPLICATION: "Application",
          TIER: "Tier",
          FEATURE: "Feature",
          TIER_FEATURE_GRANTS: "Tier feature grants",
          PRICE_LADDER: "Price ladder",
        } as Record<CatalogueAuditEntityType, string>,
      };
}
