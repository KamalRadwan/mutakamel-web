"use client";

import { useState } from "react";
import { DatabaseBackup, Play, RefreshCw, Trash2 } from "lucide-react";
import { BackupRunStatus, type BackupRun } from "../types";
import { BackupDialog } from "../components/BackupDialog";
import { BackupErrorBanner } from "../components/BackupErrorBanner";
import { BackupPageHeader } from "../components/BackupPageHeader";
import { BackupServerSelect } from "../components/BackupServerSelect";
import { BackupStatePanel } from "../components/BackupStatePanel";
import { BackupStatusBadge } from "../components/BackupStatusBadge";
import { useBackupRuns } from "../hooks/useBackupRuns";
import { formatBackupDate, shortBackupId } from "../lib/backup-format";
import { DestructiveActionModal } from "@/components/shared/DestructiveActionModal";
import { useI18n } from "@/i18n/I18nContext";

export function BackupRunsScreen() {
  const { lang } = useI18n();
  const isArabic = lang === "ar";
  const view = useBackupRuns();
  const [startOpen, setStartOpen] = useState(false);
  const [startServerId, setStartServerId] = useState("");
  const [reason, setReason] = useState("");
  const [tenantConcurrency, setTenantConcurrency] = useState(2);
  const [deletingRun, setDeletingRun] = useState<BackupRun | null>(null);

  const openStart = () => {
    setStartServerId(
      view.pendingCommandAttempt?.resource.kind === "DATABASE_SERVER"
        ? view.pendingCommandAttempt.resource.id
        : view.databaseServerId || view.servers[0]?.id || "",
    );
    setReason("");
    setTenantConcurrency(2);
    setStartOpen(true);
  };

  return (
    <div className="space-y-6">
      <BackupPageHeader
        eyebrow={isArabic ? "تنفيذ Worker" : "Worker execution"}
        title={isArabic ? "عمليات النسخ الاحتياطي" : "Backup runs"}
        description={isArabic
          ? "تابع العمليات المجدولة واليدوية. إعادة إرسال نفس الطلب تستخدم هوية أمر ثابتة وتعيد العملية الأصلية."
          : "Track scheduled and manual executions. Retrying the same request keeps one command identity and returns the original run."}
        actions={view.canStart ? (
          <button type="button" onClick={openStart} disabled={Boolean(view.activeAction)} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-cyan-700 px-4 text-sm font-bold text-white hover:bg-cyan-800 disabled:cursor-not-allowed disabled:opacity-50">
            <Play className="size-4" aria-hidden="true" />{isArabic ? "بدء نسخة يدوية" : "Start manual backup"}
          </button>
        ) : undefined}
      />

      {view.retryableCommandError || view.pendingCommandAttempt ? (
        <section role="status" className="rounded-2xl border border-amber-300 bg-amber-50 p-5 text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
          <h2 className="font-bold">{isArabic ? "هناك أمر نسخ لم تُحسم نتيجته" : "A backup command still has an unknown outcome"}</h2>
          <p className="mt-2 text-sm leading-6">{isArabic ? "يحتفظ هذا التبويب بالمفتاح وبصمة غير قابلة للقراءة فقط، ولا يخزن سبب التدقيق. افحص سجل العمليات ثم أعد إدخال القيم الأصلية حرفيًا إذا احتجت لإعادة المحاولة؛ لن يُقبل طلب مختلف بنفس المفتاح." : "This tab retains only the key and a non-readable intent digest; it does not store the audit reason. Check the run history, then re-enter the exact original values if a retry is needed. A different request will not be sent with that key."}</p>
          {view.retryableCommandError?.correlationId ? <p className="mt-2 text-xs">Correlation ID: <code>{view.retryableCommandError.correlationId}</code></p> : null}
        </section>
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-950">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.7fr)_auto] lg:items-end">
          <label className="block"><span className={labelClass}>{isArabic ? "الخادم" : "Server"}</span><select value={view.databaseServerId} onChange={(event) => view.setDatabaseServerId(event.target.value)} className={inputClass}><option value="">{isArabic ? "كل الخوادم" : "All servers"}</option>{view.servers.map((server) => <option key={server.id} value={server.id}>{server.name}</option>)}</select></label>
          <label className="block"><span className={labelClass}>{isArabic ? "الحالة" : "Status"}</span><select value={view.status} onChange={(event) => view.setStatus(event.target.value as BackupRunStatus | "")} className={inputClass}><option value="">{isArabic ? "كل الحالات" : "All statuses"}</option>{Object.values(BackupRunStatus).map((status) => <option key={status} value={status}>{status.replaceAll("_", " ")}</option>)}</select></label>
          <button type="button" onClick={() => void view.refresh()} disabled={view.isLoading} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 px-4 text-sm font-bold hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:hover:bg-slate-900"><RefreshCw className={`size-4 ${view.isLoading ? "animate-spin" : ""}`} />{isArabic ? "تحديث" : "Refresh"}</button>
        </div>
      </section>

      {view.error ? <BackupErrorBanner error={view.error} /> : null}
      {view.enrichmentWarning ? (
        <section role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
          <p className="font-bold">{isArabic ? "تعذر تحميل أسماء خوادم قواعد البيانات" : "Database server names are unavailable"}</p>
          <p className="mt-1 text-xs leading-5">{isArabic ? "تظل بيانات العمليات من Worker متاحة، وتُعرض معرفات الخوادم بدلاً من الأسماء." : "Worker run data remains available; server IDs are shown instead of names."}</p>
          {view.enrichmentWarning.correlationId ? <p className="mt-2 text-xs">Correlation ID: <code className="font-mono">{view.enrichmentWarning.correlationId}</code></p> : null}
        </section>
      ) : null}

      {view.isLoading ? (
        <BackupStatePanel kind="loading" title={isArabic ? "جارٍ تحميل العمليات" : "Loading backup runs"} description={isArabic ? "قراءة السجل التشغيلي من Worker." : "Reading the bounded operational history from Worker."} />
      ) : view.error ? null : view.runs.length === 0 ? (
        <BackupStatePanel kind="empty" title={isArabic ? "لا توجد عمليات" : "No backup runs"} description={isArabic ? "لا توجد نتائج مطابقة للفلاتر الحالية." : "No run matches the current filters."} />
      ) : (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-sm">
              <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-500 dark:bg-slate-900"><tr><th className="px-5 py-3 text-start">{isArabic ? "العملية" : "Run"}</th><th className="px-5 py-3 text-start">{isArabic ? "الخادم" : "Server"}</th><th className="px-5 py-3 text-start">{isArabic ? "النوع" : "Trigger"}</th><th className="px-5 py-3 text-start">{isArabic ? "النتيجة" : "Progress"}</th><th className="px-5 py-3 text-start">{isArabic ? "بدأت" : "Started"}</th><th className="px-5 py-3 text-start">{isArabic ? "الحالة" : "Status"}</th><th className="px-5 py-3 text-end">{isArabic ? "الإجراءات" : "Actions"}</th></tr></thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">{view.runs.map((run) => {
                const server = view.servers.find((item) => item.id === run.databaseServerId);
                const terminal = run.status !== BackupRunStatus.PENDING && run.status !== BackupRunStatus.RUNNING;
                return <tr key={run.id} className="align-top hover:bg-slate-50/70 dark:hover:bg-slate-900/50"><td className="px-5 py-4"><div className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-xl bg-cyan-50 text-cyan-700 dark:bg-cyan-950/50 dark:text-cyan-300"><DatabaseBackup className="size-4" /></span><div><p className="font-mono font-bold" title={run.id}>{shortBackupId(run.id)}</p>{run.reason ? <p className="mt-1 max-w-xs truncate text-xs text-slate-500" title={run.reason}>{run.reason}</p> : null}</div></div></td><td className="px-5 py-4"><p className="font-semibold">{server?.name ?? shortBackupId(run.databaseServerId)}</p></td><td className="px-5 py-4 font-semibold uppercase">{run.trigger}</td><td className="px-5 py-4"><p className="font-mono font-bold">{run.succeededTenants}/{run.totalTenants}</p><p className="mt-1 text-xs text-slate-500">{run.failedTenants} failed · {run.skippedTenants} skipped</p></td><td className="px-5 py-4 text-slate-600 dark:text-slate-300">{formatBackupDate(run.startedAt, isArabic ? "ar-EG" : "en-US")}</td><td className="px-5 py-4"><BackupStatusBadge status={run.status} />{run.hasFailure ? <p className="mt-2 max-w-xs text-xs text-rose-600 dark:text-rose-300">{isArabic ? "تم تسجيل تفاصيل الفشل بأمان في Worker." : "Failure details are retained in Worker logs."}</p> : null}</td><td className="px-5 py-4 text-end">{view.canDelete && terminal ? <button type="button" onClick={() => setDeletingRun(run)} className="inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-xs font-bold text-rose-700 hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-950/40"><Trash2 className="size-4" />{isArabic ? "حذف" : "Delete"}</button> : <span className="text-slate-400">—</span>}</td></tr>;
              })}</tbody>
            </table>
          </div>
          <p className="border-t border-slate-200 px-5 py-3 text-xs text-slate-500 dark:border-slate-800">{isArabic ? "يعرض Worker سجلًا محدودًا؛ لا يتم اختلاق إجمالي أو صفحات غير موجودة في العقد." : "Worker returns a bounded history; the UI does not invent totals or pagination metadata."}</p>
        </section>
      )}

      <BackupDialog open={startOpen} title={isArabic ? "بدء نسخة احتياطية يدوية" : "Start manual backup"} description={isArabic ? "تُحفظ هوية الأمر وبصمة الطلب فقط داخل هذا التبويب حتى تُحسم النتيجة؛ لا يُحفظ سبب التدقيق." : "The command identity and request digest stay in this tab until the outcome is known; the audit reason is not stored."} confirmLabel={isArabic ? "بدء العملية" : "Start run"} onClose={() => { if (!view.activeAction) setStartOpen(false); }} onConfirm={() => void view.startRun({ databaseServerId: startServerId, reason: reason.trim(), tenantConcurrency }).then((run) => { if (run) setStartOpen(false); }).catch(() => undefined)} isSubmitting={view.activeAction === "start"} confirmDisabled={!uuidV7Pattern.test(startServerId) || !reason.trim() || reason.length > 500 || tenantConcurrency < 1 || tenantConcurrency > 10}>
        {view.canReadServers ? <BackupServerSelect label={isArabic ? "الخادم" : "Database server"} value={startServerId} servers={view.servers} onChange={setStartServerId} placeholder={isArabic ? "اختر خادم قاعدة بيانات" : "Select a database server"} /> : <label className="block"><span className={labelClass}>{isArabic ? "معرف خادم قاعدة البيانات" : "Database server ID"}</span><input value={startServerId} onChange={(event) => setStartServerId(event.target.value.trim())} placeholder="UUIDv7" className={inputClass} /><span className="mt-2 block text-xs text-slate-500">{isArabic ? "يمكن تنفيذ الأمر بالمعرف دون كشف سجل الخوادم." : "The command can be authorized by ID without exposing the server registry."}</span></label>}
        <label className="block"><span className={labelClass}>{isArabic ? "التزامن" : "Tenant concurrency"}</span><input type="number" min={1} max={10} value={tenantConcurrency} onChange={(event) => setTenantConcurrency(Number(event.target.value))} className={inputClass} /></label>
        <label className="block"><span className={labelClass}>{isArabic ? "سبب موثق" : "Audit reason"}</span><textarea value={reason} onChange={(event) => setReason(event.target.value)} maxLength={500} rows={4} className={`${inputClass} py-3`} /></label>
      </BackupDialog>

      <DestructiveActionModal isOpen={deletingRun !== null} onClose={() => { if (!view.activeAction) setDeletingRun(null); }} onConfirm={() => { if (!deletingRun) return; void view.deleteRun(deletingRun.id).then(() => setDeletingRun(null)).catch(() => undefined); }} title={isArabic ? "حذف عملية النسخ وكل محتوياتها" : "Delete backup run and all recovery data"} description={isArabic ? "حذف نهائي لسجل العملية، وكل ملفات وسجلات النسخ التابعة لها، وملف manifest. لن يمكن استخدام هذه النسخ للاستعادة بعد ذلك." : "Permanently deletes the run record, every artifact object and row in the run, and its manifest. Those recovery points cannot be restored afterward."} targetName={deletingRun?.id ?? ""} actionType="destroy" requireNameTyping isSubmitting={deletingRun ? view.activeAction === `delete:${deletingRun.id}` : false} />
    </div>
  );
}

const labelClass = "mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500";
const inputClass = "min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-600/20 dark:border-slate-700 dark:bg-slate-900 dark:text-white";
const uuidV7Pattern = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
