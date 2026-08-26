"use client";

import Link from "next/link";
import { useState } from "react";
import { ArchiveRestore, FileArchive, Filter, RefreshCw, Trash2 } from "lucide-react";
import { BackupArtifactStatus, type BackupArtifact } from "../types";
import { BackupErrorBanner } from "../components/BackupErrorBanner";
import { BackupPageHeader } from "../components/BackupPageHeader";
import { BackupStatePanel } from "../components/BackupStatePanel";
import { BackupStatusBadge } from "../components/BackupStatusBadge";
import { useBackupArtifacts } from "../hooks/useBackupArtifacts";
import { formatBackupBytes, formatBackupDate, shortBackupId } from "../lib/backup-format";
import { DestructiveActionModal } from "@/components/shared/DestructiveActionModal";
import { useI18n } from "@/i18n/I18nContext";

export function BackupArtifactsScreen() {
  const { lang } = useI18n();
  const isArabic = lang === "ar";
  const view = useBackupArtifacts();
  const [runId, setRunId] = useState(view.query.runId ?? "");
  const [databaseServerId, setDatabaseServerId] = useState(view.query.databaseServerId ?? "");
  const [tenantId, setTenantId] = useState(view.query.tenantId ?? "");
  const [deletingArtifact, setDeletingArtifact] = useState<BackupArtifact | null>(null);

  const [prevQuery, setPrevQuery] = useState(view.query);
  if (view.query !== prevQuery) {
    setPrevQuery(view.query);
    setRunId(view.query.runId ?? "");
    setDatabaseServerId(view.query.databaseServerId ?? "");
    setTenantId(view.query.tenantId ?? "");
  }

  const invalidUuid = [runId, databaseServerId, tenantId].some((value) => value && !uuidPattern.test(value));

  return (
    <div className="space-y-6">
      <BackupPageHeader
        eyebrow={isArabic ? "دليل قابل للاستعادة" : "Recoverable evidence"}
        title={isArabic ? "النسخ المحفوظة" : "Backup artifacts"}
        description={isArabic
          ? "عرض النسخ المكتملة وحجمها وبصمتها الآمنة. مفاتيح ومسارات التخزين لا تظهر في الواجهة."
          : "Inspect retained copies, sizes, and safe checksum evidence. Storage keys and paths are intentionally never rendered."}
      />

      <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-950">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_auto_auto] xl:items-end">
          <label><span className={labelClass}>{isArabic ? "معرف العملية" : "Run ID"}</span><input value={runId} onChange={(event) => setRunId(event.target.value.trim())} placeholder="UUIDv7" className={inputClass} /></label>
          <label><span className={labelClass}>{isArabic ? "الخادم" : "Server"}</span><select value={databaseServerId} onChange={(event) => setDatabaseServerId(event.target.value)} className={inputClass}><option value="">{isArabic ? "كل الخوادم" : "All servers"}</option>{view.servers.map((server) => <option key={server.id} value={server.id}>{server.name}</option>)}</select></label>
          <label><span className={labelClass}>{isArabic ? "معرف المستأجر" : "Tenant ID"}</span><input value={tenantId} onChange={(event) => setTenantId(event.target.value.trim())} placeholder="UUIDv7" className={inputClass} /></label>
          <button type="button" onClick={() => view.setQuery({ ...(runId ? { runId } : {}), ...(databaseServerId ? { databaseServerId } : {}), ...(tenantId ? { tenantId } : {}) })} disabled={invalidUuid} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-cyan-700 px-4 text-sm font-semibold text-white hover:bg-cyan-800 disabled:opacity-50"><Filter className="size-4" />{isArabic ? "تطبيق" : "Apply"}</button>
          <button type="button" onClick={() => void view.refresh()} disabled={view.isLoading} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 px-4 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:hover:bg-slate-900"><RefreshCw className={`size-4 ${view.isLoading ? "animate-spin" : ""}`} />{isArabic ? "تحديث" : "Refresh"}</button>
        </div>
        {invalidUuid ? <p className="mt-3 text-xs font-semibold text-rose-600">{isArabic ? "الفلاتر المعرّفة يجب أن تكون UUID صحيحة." : "Entered ID filters must be valid UUIDs."}</p> : null}
      </section>

      {view.error ? <BackupErrorBanner error={view.error} /> : null}
      {view.enrichmentWarning ? (
        <section role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
          <p className="font-semibold">{isArabic ? "تعذر تحميل أسماء خوادم قواعد البيانات" : "Database server names are unavailable"}</p>
          <p className="mt-1 text-xs leading-5">{isArabic ? "تظل بيانات النسخ المحفوظة من Worker متاحة، بينما خيارات فلترة أسماء الخوادم غير متاحة مؤقتًا." : "Worker artifact data remains available; server-name filter options are temporarily unavailable."}</p>
          {view.enrichmentWarning.correlationId ? <p className="mt-2 text-xs">Correlation ID: <code className="font-mono">{view.enrichmentWarning.correlationId}</code></p> : null}
        </section>
      ) : null}

      {view.isLoading ? (
        <BackupStatePanel kind="loading" title={isArabic ? "جارٍ تحميل النسخ" : "Loading artifacts"} description={isArabic ? "قراءة دليل النسخ من Worker." : "Reading safe artifact evidence from Worker."} />
      ) : view.error ? null : view.artifacts.length === 0 ? (
        <BackupStatePanel kind="empty" title={isArabic ? "لا توجد نسخ مطابقة" : "No matching artifacts"} description={isArabic ? "غيّر الفلاتر أو راجع عمليات النسخ." : "Change the filters or inspect backup runs."} />
      ) : (
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
          <div className="overflow-x-auto"><table className="w-full min-w-[1040px] text-sm"><thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:bg-slate-900"><tr><th className="px-5 py-3 text-start">{isArabic ? "النسخة" : "Artifact"}</th><th className="px-5 py-3 text-start">{isArabic ? "قاعدة البيانات" : "Database"}</th><th className="px-5 py-3 text-start">{isArabic ? "الحجم" : "Size"}</th><th className="px-5 py-3 text-start">SHA-256</th><th className="px-5 py-3 text-start">{isArabic ? "الاكتمال" : "Finished"}</th><th className="px-5 py-3 text-start">{isArabic ? "الحالة" : "Status"}</th><th className="px-5 py-3 text-end">{isArabic ? "الإجراءات" : "Actions"}</th></tr></thead><tbody className="divide-y divide-slate-100 dark:divide-slate-800">{view.artifacts.map((artifact) => {
            const terminal = artifact.status !== BackupArtifactStatus.PENDING && artifact.status !== BackupArtifactStatus.RUNNING;
            return <tr key={artifact.id} className="align-top hover:bg-slate-50/70 dark:hover:bg-slate-900/50"><td className="px-5 py-4"><div className="flex gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-cyan-50 text-cyan-700 dark:bg-cyan-950/50 dark:text-cyan-300"><FileArchive className="size-4" /></span><div><p className="font-mono font-semibold" title={artifact.id}>{shortBackupId(artifact.id)}</p><p className="mt-1 font-mono text-xs text-slate-500" title={artifact.runId}>{isArabic ? "العملية" : "Run"}: {shortBackupId(artifact.runId)}</p></div></div></td><td className="px-5 py-4"><p className="font-mono font-semibold">{artifact.databaseName}</p><p className="mt-1 font-mono text-xs text-slate-500" title={artifact.tenantId}>{shortBackupId(artifact.tenantId)}</p></td><td className="px-5 py-4 font-mono font-semibold">{formatBackupBytes(artifact.sizeBytes, isArabic ? "ar-EG" : "en-US")}</td><td className="px-5 py-4 font-mono text-xs" title={artifact.sha256 ?? ""}>{artifact.sha256 ? `${artifact.sha256.slice(0, 12)}…` : "—"}</td><td className="px-5 py-4 text-slate-600 dark:text-slate-300">{formatBackupDate(artifact.finishedAt, isArabic ? "ar-EG" : "en-US")}</td><td className="px-5 py-4"><BackupStatusBadge status={artifact.status} />{artifact.hasFailure ? <p className="mt-2 max-w-xs text-xs text-rose-600 dark:text-rose-300">{isArabic ? "تم تسجيل تفاصيل الفشل بأمان في Worker." : "Failure details are retained in Worker logs."}</p> : null}</td><td className="px-5 py-4 text-end"><div className="inline-flex items-center gap-1">{view.canRestore && artifact.status === BackupArtifactStatus.COMPLETED ? <Link href={`/backup/restores?artifactId=${encodeURIComponent(artifact.id)}`} className="inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-xs font-semibold text-cyan-700 hover:bg-cyan-50 dark:text-cyan-300 dark:hover:bg-cyan-950/40"><ArchiveRestore className="size-4" />{isArabic ? "استعادة" : "Restore"}</Link> : null}{view.canDelete && terminal ? <button type="button" onClick={() => setDeletingArtifact(artifact)} className="grid size-11 place-items-center rounded-xl text-rose-700 hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-950/40" aria-label={isArabic ? "حذف النسخة" : "Delete artifact"}><Trash2 className="size-4" /></button> : null}</div></td></tr>;
          })}</tbody></table></div>
          <p className="border-t border-slate-200 px-5 py-3 text-xs text-slate-500 dark:border-slate-800">{isArabic ? "لا تعرض هذه الصفحة storageKey أو metadata أو أي مرجع اعتماد." : "This page never renders storageKey, raw metadata, or credential references."}</p>
        </section>
      )}

      <DestructiveActionModal isOpen={deletingArtifact !== null} onClose={() => { if (!view.activeAction) setDeletingArtifact(null); }} onConfirm={() => { if (!deletingArtifact) return; void view.deleteArtifact(deletingArtifact.id).then(() => setDeletingArtifact(null)).catch(() => undefined); }} title={isArabic ? "حذف النسخة المحفوظة نهائيًا" : "Permanently delete backup artifact"} description={isArabic ? "يحذف Worker ملف النسخة وسجلها. وإذا كانت آخر نسخة في العملية فسيحذف أيضًا سجل العملية وملف manifest؛ لن تعود نقطة الاستعادة متاحة." : "Worker deletes this backup object and row. If it is the run's last artifact, Worker also deletes the parent run and manifest; this recovery point will no longer be available."} targetName={deletingArtifact?.id ?? ""} actionType="destroy" requireNameTyping isSubmitting={deletingArtifact ? view.activeAction === `delete:${deletingArtifact.id}` : false} />
    </div>
  );
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const labelClass = "mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-500";
const inputClass = "min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-600/20 dark:border-slate-700 dark:bg-slate-900 dark:text-white";
