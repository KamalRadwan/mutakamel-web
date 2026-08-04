"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, History, Loader2, RefreshCw } from "lucide-react";
import { Navbar } from "@/components/layout/Navbar";
import { useAuth } from "@/context/AuthContext";
import { applicationsApi } from "@/features/admin/applications/api/applications.api";
import type { CatalogueAuditEntityType, CatalogueAuditPageView } from "@/features/admin/applications/types";
import { adminCanAll } from "@/lib/auth/rbac";
import { normalizeApiError } from "@/shared/api/normalized-api-error";

export default function CatalogueAuditPage() {
  const { user } = useAuth();
  const canRead = adminCanAll(user, ["admin.catalog.read"]);
  const [data, setData] = useState<CatalogueAuditPageView | null>(null);
  const [page, setPage] = useState(1);
  const [entityType, setEntityType] = useState<CatalogueAuditEntityType | "ALL">("ALL");
  const [action, setAction] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!canRead) return;
    setIsLoading(true);
    setError(null);
    try {
      setData(await applicationsApi.getGlobalAudit({ page, limit: 20, ...(entityType !== "ALL" ? { entityType } : {}), ...(action.trim() ? { action: action.trim() } : {}) }));
    } catch (requestError) {
      const normalized = normalizeApiError(requestError);
      setError(`${normalized.message}${normalized.correlationId ? ` · ${normalized.correlationId}` : ""}`);
    } finally {
      setIsLoading(false);
    }
  }, [action, canRead, entityType, page]);

  useEffect(() => { queueMicrotask(() => { void load(); }); }, [load]);

  return <div className="flex min-h-screen flex-col bg-slate-50 text-slate-950 dark:bg-[#090d16] dark:text-slate-100"><Navbar /><main className="mx-auto w-full max-w-7xl flex-1 space-y-5 p-4 sm:p-6">
    <header className="rounded-3xl border border-violet-500/20 bg-slate-950 p-6 text-white shadow-xl"><div className="flex items-center gap-4"><Link href="/applications-catalogue" aria-label="Back to Application Catalogue" className="rounded-2xl border border-white/15 bg-white/10 p-3 hover:bg-white/15"><ArrowLeft className="h-5 w-5" /></Link><div><p className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-violet-300">Immutable control-plane evidence</p><h1 className="mt-1 text-2xl font-black">Catalogue audit</h1><p className="mt-1 text-xs text-slate-300">Review application, tier, feature, entitlement, and pricing mutations.</p></div></div></header>
    {!canRead ? <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">Permission <code>admin.catalog.read</code> is required.</div> : <>
      <section className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:flex-row dark:border-slate-800 dark:bg-slate-900"><select aria-label="Entity type" value={entityType} onChange={(event) => { setEntityType(event.target.value as CatalogueAuditEntityType | "ALL"); setPage(1); }} className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold dark:border-slate-700 dark:bg-slate-950"><option value="ALL">All entity types</option>{["APPLICATION", "TIER", "FEATURE", "TIER_FEATURE_GRANTS", "PRICE_LADDER"].map((value) => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}</select><input aria-label="Action filter" placeholder="Filter by exact action" value={action} onChange={(event) => { setAction(event.target.value); setPage(1); }} className="min-w-64 flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs outline-none focus:border-violet-500 dark:border-slate-700 dark:bg-slate-950" /><button type="button" onClick={() => void load()} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 px-3 py-2 text-xs font-bold hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"><RefreshCw className="h-3.5 w-3.5" />Refresh</button></section>
      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900"><div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800"><h2 className="flex items-center gap-2 text-sm font-black"><History className="h-4 w-4 text-violet-500" />Global events</h2><span className="font-mono text-[11px] text-slate-500">{data?.total ?? 0} events</span></div><div className="p-5">{isLoading ? <div className="flex items-center justify-center gap-2 py-16 text-xs text-slate-500"><Loader2 className="h-4 w-4 animate-spin" />Loading audit…</div> : error ? <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-center text-xs text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300"><p>{error}</p><button type="button" onClick={() => void load()} className="mt-3 rounded-xl bg-rose-600 px-3 py-2 font-bold text-white">Retry</button></div> : !data?.items.length ? <div className="rounded-2xl border border-dashed border-slate-300 py-16 text-center text-xs text-slate-500 dark:border-slate-700">No matching catalogue audit events.</div> : <div className="space-y-3">{data.items.map((event) => <article key={event.id} className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800"><div className="flex flex-wrap items-center justify-between gap-2"><div><span className="font-mono text-xs font-black text-violet-600 dark:text-violet-400">{event.action}</span><span className="ms-2 rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">{event.entityType}</span></div><time className="text-[11px] text-slate-500">{new Date(event.occurredAt).toLocaleString()}</time></div><p className="mt-2 text-xs text-slate-600 dark:text-slate-300">Actor: {event.actorLabel || event.actorAdminId || "System"}</p><p className="mt-1 font-mono text-[10px] text-slate-400">Correlation: {event.correlationId || "not provided"}</p></article>)}</div>}</div>{data && data.totalPages > 1 && <footer className="flex items-center justify-between border-t border-slate-200 px-5 py-4 text-xs dark:border-slate-800"><span>Page {data.page} of {data.totalPages}</span><div className="flex gap-2"><button type="button" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))} className="rounded-lg border border-slate-300 px-3 py-1.5 font-bold disabled:opacity-40 dark:border-slate-700">Previous</button><button type="button" disabled={page >= data.totalPages} onClick={() => setPage((current) => current + 1)} className="rounded-lg border border-slate-300 px-3 py-1.5 font-bold disabled:opacity-40 dark:border-slate-700">Next</button></div></footer>}</section>
    </>}
  </main></div>;
}
