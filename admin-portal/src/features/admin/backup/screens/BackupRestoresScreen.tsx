"use client";

import { useState } from "react";
import Link from "next/link";
import { ArchiveRestore, CheckCircle2, Play, RefreshCw, ShieldAlert } from "lucide-react";
import { RestoreRunStatus, type RestoreRun } from "../types";
import { BackupDialog } from "../components/BackupDialog";
import { BackupErrorBanner } from "../components/BackupErrorBanner";
import { BackupPageHeader } from "../components/BackupPageHeader";
import { BackupStatePanel } from "../components/BackupStatePanel";
import { BackupStatusBadge } from "../components/BackupStatusBadge";
import { useBackupRestores } from "../hooks/useBackupRestores";
import { formatBackupDate, shortBackupId } from "../lib/backup-format";
import { useI18n } from "@/i18n/I18nContext";

export function BackupRestoresScreen() {
  const { lang } = useI18n();
  const isArabic = lang === "ar";
  const view = useBackupRestores();
  const [handledArtifactRequest, setHandledArtifactRequest] = useState<string | undefined>();
  const [tenantId, setTenantId] = useState("");
  const [status, setStatus] = useState<RestoreRunStatus | "">("");
  const [startOpen, setStartOpen] = useState(false);
  const [artifactId, setArtifactId] = useState("");
  const [targetDatabaseName, setTargetDatabaseName] = useState("");
  const [reason, setReason] = useState("");
  const [promotingRun, setPromotingRun] = useState<RestoreRun | null>(null);
  const [promotionReason, setPromotionReason] = useState("");
  const [confirmationText, setConfirmationText] = useState("");

  if (!view.isLoading && handledArtifactRequest !== view.requestedArtifactId) {
    setHandledArtifactRequest(view.requestedArtifactId);
    setStartOpen(false);
    setArtifactId("");
    setTargetDatabaseName("");
    setReason("");

    const requestedArtifact = view.artifacts.find(
      (artifact) => artifact.id === view.requestedArtifactId,
    );
    if (requestedArtifact) {
      setArtifactId(requestedArtifact.id);
      setStartOpen(true);
    }
  }

  const openStart = () => {
    const requestedArtifact = view.artifacts.find(
      (artifact) => artifact.id === view.requestedArtifactId,
    );
    setArtifactId(requestedArtifact?.id ?? view.artifacts[0]?.id ?? "");
    setTargetDatabaseName("");
    setReason("");
    setStartOpen(true);
  };

  const targetValid = !targetDatabaseName || /^[A-Za-z_][A-Za-z0-9_]{0,62}$/.test(targetDatabaseName);
  const tenantValid = !tenantId || uuidPattern.test(tenantId);

  return (
    <div className="space-y-6">
      <BackupPageHeader
        eyebrow={isArabic ? "حد الاستعادة الحرج" : "Critical recovery boundary"}
        title={isArabic ? "اختبارات الاستعادة والترقية" : "Restore tests and promotion"}
        description={isArabic
          ? "تبدأ الاستعادة في قاعدة معزولة للتحقق. الترقية أمر حرج منفصل ويتطلب اسم قاعدة الهدف حرفيًا."
          : "Restores begin as isolated verification runs. Promotion is a separate critical command requiring the exact target database name."}
        actions={view.canRestore ? (
          <button type="button" onClick={openStart} disabled={view.artifacts.length === 0 || view.commandGuardBlocked} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-cyan-700 px-4 text-sm font-bold text-white hover:bg-cyan-800 disabled:cursor-not-allowed disabled:opacity-50"><Play className="size-4" />{isArabic ? "بدء اختبار استعادة" : "Start restore test"}</button>
        ) : undefined}
      />

      {view.unknownOutcome ? (
        <section role="alert" className="rounded-2xl border border-amber-300 bg-amber-50 p-5 text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
          <div className="flex items-start gap-3">
            <ShieldAlert className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <h2 className="font-bold">
                {view.unknownOutcome.kind === "RESTORE_PROMOTE"
                  ? (isArabic ? "أمر ترقية الاستعادة ما زال غير محسوم" : "Restore promotion remains unresolved")
                  : view.unknownOutcome.kind === "RESTORE_START"
                    ? (isArabic ? "أمر بدء الاستعادة ما زال غير محسوم" : "Restore start remains unresolved")
                    : (isArabic ? "يوجد أمر نسخ احتياطي غير محسوم" : "A backup command is unresolved")}
              </h2>
              <p className="mt-2 text-sm leading-6">
                {view.unknownOutcome.kind === "BACKUP_START"
                  ? (isArabic ? "يجب حسم أمر النسخ من شاشة العمليات قبل إرسال أمر استعادة." : "Resolve the backup command from Backup Runs before sending a restore command.")
                  : view.unknownOutcome.kind === "RESTORE_PROMOTE"
                    ? (isArabic ? "تمت إعادة قراءة عملية الاستعادة المحددة، لكن القراءة لا تثبت تلقائيًا أن أمر الترقية قد نُفذ." : "The exact restore run was reread, but that read does not automatically prove the promotion command was applied.")
                    : (isArabic ? "تمت قراءة النسخة المستهدفة وسجل مستأجرها دون فلتر حالة، لكن القراءة لا تثبت تلقائيًا قبول أمر البدء." : "The target artifact and its tenant restore history were read without a status filter, but that read does not automatically prove the start command was accepted.")}
              </p>
              <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-3">
                <div><dt className="font-semibold opacity-70">{isArabic ? "الحالة" : "Guard status"}</dt><dd className="font-mono font-bold">{view.unknownOutcome.status}</dd></div>
                <div><dt className="font-semibold opacity-70">{isArabic ? "وقت الإصدار" : "Issued"}</dt><dd className="font-mono">{formatBackupDate(view.unknownOutcome.issuedAt, isArabic ? "ar-EG" : "en-US")}</dd></div>
                <div><dt className="font-semibold opacity-70">{isArabic ? "معرف الأمر المحلي" : "Local command ID"}</dt><dd className="break-all font-mono">{view.unknownOutcome.localCommandId}</dd></div>
              </dl>
              {view.ambiguousError?.correlationId ? <p className="mt-2 text-xs">Correlation ID: <code>{view.ambiguousError.correlationId}</code></p> : null}

              {view.unknownOutcome.kind === "BACKUP_START" ? (
                <Link href="/backup/runs" className="mt-4 inline-flex min-h-11 items-center rounded-xl bg-amber-900 px-4 text-sm font-bold text-white dark:bg-amber-200 dark:text-amber-950">{isArabic ? "فتح عمليات النسخ" : "Open Backup Runs"}</Link>
              ) : (
                <div className="mt-4 rounded-xl border border-amber-300/70 bg-white/60 p-4 dark:bg-slate-950/40">
                  <p className="text-xs font-bold uppercase tracking-wider">
                    {view.unknownOutcome.kind === "RESTORE_PROMOTE"
                      ? (isArabic ? "قراءة Worker للعملية المحددة" : "Exact Worker restore-run read")
                      : (isArabic ? "قراءة Worker للنسخة والمستأجر" : "Worker artifact and tenant-history read")}
                  </p>
                  {view.unknownOutcome.kind === "RESTORE_START" && view.reconciliationArtifactFound !== null ? (
                    <p className="mt-2 text-sm">
                      {view.reconciliationArtifactFound
                        ? (isArabic ? "النسخة المستهدفة موجودة؛ تم تحديث سجل الاستعادة الكامل لمستأجرها." : "The target artifact exists; its tenant restore history was refreshed without a status filter.")
                        : (isArabic ? "النسخة المستهدفة غير موجودة في القراءة الحالية غير المفلترة." : "The target artifact was not present in the current unfiltered artifact read.")}
                    </p>
                  ) : null}
                  {view.isReconcilingAttempt ? (
                    <p className="mt-2 text-sm">{isArabic ? "جارٍ تحديث القراءة المرجعية…" : "Refreshing authoritative evidence…"}</p>
                  ) : view.reconciliationError ? (
                    <p className="mt-2 text-sm text-rose-700 dark:text-rose-300">{view.reconciliationError.message}</p>
                  ) : view.reconciliationRestores.length === 0 ? (
                    <p className="mt-2 text-sm">{isArabic ? "لم تُرجع القراءة الحالية أي عملية استعادة مرتبطة." : "The current read returned no related restore run."}</p>
                  ) : (
                    <ul className="mt-2 space-y-2">
                      {view.reconciliationRestores.slice(0, 5).map((restore) => (
                        <li key={restore.id} className="flex flex-wrap items-center justify-between gap-2 text-xs">
                          <code>{shortBackupId(restore.id)}</code>
                          <span>{restore.status}</span>
                          <span className="font-mono">{restore.targetDatabaseName}</span>
                          <span>{formatBackupDate(restore.startedAt, isArabic ? "ar-EG" : "en-US")}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  <p className="mt-3 text-xs leading-5 opacity-80">{isArabic ? "هذه القراءة للمراجعة البشرية فقط؛ لا تربط العملية بهوية أمر المتصفح." : "This evidence is for operator review only; it cannot bind a Worker run to this browser command."}</p>
                </div>
              )}

              {view.unknownOutcome.kind !== "BACKUP_START" ? (
                <button type="button" onClick={view.acknowledgeUnknownOutcome} disabled={view.isReconcilingAttempt || Boolean(view.reconciliationError)} className="mt-4 min-h-11 rounded-xl bg-amber-900 px-4 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50 dark:bg-amber-200 dark:text-amber-950">{isArabic ? "أكد أنني راجعت حالة Worker الموثوقة — امسح القفل" : "I verified authoritative Worker state — clear lock"}</button>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}

      {view.commandGuardError ? <section role="alert" className="rounded-xl border border-rose-300 bg-rose-50 p-4 text-sm font-semibold text-rose-900 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200">{isArabic ? "الحماية الدائمة للأوامر غير متاحة؛ تم تعطيل أوامر الاستعادة والترقية." : view.commandGuardError}</section> : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-950">
        <div className="grid gap-4 md:grid-cols-[1fr_1fr_auto_auto] md:items-end">
          <label><span className={labelClass}>{isArabic ? "معرف المستأجر" : "Tenant ID"}</span><input value={tenantId} onChange={(event) => setTenantId(event.target.value.trim())} placeholder="UUIDv7" className={inputClass} /></label>
          <label><span className={labelClass}>{isArabic ? "الحالة" : "Status"}</span><select value={status} onChange={(event) => setStatus(event.target.value as RestoreRunStatus | "")} className={inputClass}><option value="">{isArabic ? "كل الحالات" : "All statuses"}</option>{Object.values(RestoreRunStatus).map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
          <button type="button" disabled={!tenantValid} onClick={() => view.setQuery(tenantId, status)} className="min-h-11 rounded-xl bg-cyan-700 px-4 text-sm font-bold text-white hover:bg-cyan-800 disabled:opacity-50">{isArabic ? "تطبيق" : "Apply"}</button>
          <button type="button" onClick={() => void view.refresh()} disabled={view.isLoading} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 px-4 text-sm font-bold hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:hover:bg-slate-900"><RefreshCw className={`size-4 ${view.isLoading ? "animate-spin" : ""}`} />{isArabic ? "تحديث" : "Refresh"}</button>
        </div>
        {!tenantValid ? <p className="mt-3 text-xs font-semibold text-rose-600">{isArabic ? "معرف المستأجر غير صحيح." : "Tenant ID must be a valid UUID."}</p> : null}
      </section>

      {view.error ? <BackupErrorBanner error={view.error} /> : null}
      {view.enrichmentWarning ? (
        <section role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
          <p className="font-bold">{isArabic ? "تعذر تحميل أسماء خوادم قواعد البيانات" : "Database server names are unavailable"}</p>
          <p className="mt-1 text-xs leading-5">{isArabic ? "تظل بيانات الاستعادة من Worker متاحة، وتُعرض معرفات الخوادم بدلاً من الأسماء." : "Worker restore data remains available; server IDs are shown instead of names."}</p>
          {view.enrichmentWarning.correlationId ? <p className="mt-2 text-xs">Correlation ID: <code className="font-mono">{view.enrichmentWarning.correlationId}</code></p> : null}
        </section>
      ) : null}

      {view.isLoading ? (
        <BackupStatePanel kind="loading" title={isArabic ? "جارٍ تحميل الاستعادات" : "Loading restore history"} description={isArabic ? "قراءة حالة الاختبار والترقية من Worker." : "Reading verification and promotion state from Worker."} />
      ) : view.error ? null : view.restores.length === 0 ? (
        <BackupStatePanel kind="empty" title={isArabic ? "لا توجد عمليات استعادة" : "No restore runs"} description={view.artifacts.length === 0 ? (isArabic ? "لا توجد نسخة مكتملة متاحة لبدء الاختبار." : "No completed artifact is available for a restore test.") : (isArabic ? "ابدأ اختبار استعادة لإثبات قابلية الاسترجاع." : "Start an isolated restore test to prove recoverability.")} />
      ) : (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
          <div className="overflow-x-auto"><table className="w-full min-w-[1040px] text-sm"><thead className="bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-500 dark:bg-slate-900"><tr><th className="px-5 py-3 text-start">{isArabic ? "الاستعادة" : "Restore"}</th><th className="px-5 py-3 text-start">{isArabic ? "المصدر" : "Source"}</th><th className="px-5 py-3 text-start">{isArabic ? "الهدف" : "Target"}</th><th className="px-5 py-3 text-start">{isArabic ? "الدليل" : "Verification"}</th><th className="px-5 py-3 text-start">{isArabic ? "بدأت" : "Started"}</th><th className="px-5 py-3 text-start">{isArabic ? "الحالة" : "Status"}</th><th className="px-5 py-3 text-end">{isArabic ? "الإجراء" : "Action"}</th></tr></thead><tbody className="divide-y divide-slate-100 dark:divide-slate-800">{view.restores.map((restore) => {
            const server = view.servers.find((item) => item.id === restore.databaseServerId);
            return <tr key={restore.id} className="align-top hover:bg-slate-50/70 dark:hover:bg-slate-900/50"><td className="px-5 py-4"><div className="flex gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-cyan-50 text-cyan-700 dark:bg-cyan-950/50 dark:text-cyan-300"><ArchiveRestore className="size-4" /></span><div><p className="font-mono font-bold" title={restore.id}>{shortBackupId(restore.id)}</p><p className="mt-1 text-xs text-slate-500">{server?.name ?? shortBackupId(restore.databaseServerId)}</p></div></div></td><td className="px-5 py-4 font-mono font-bold">{restore.sourceDatabaseName}</td><td className="px-5 py-4 font-mono font-bold">{restore.targetDatabaseName}</td><td className="px-5 py-4">{restore.hasVerification ? <span className="inline-flex items-center gap-2 text-emerald-700 dark:text-emerald-300"><CheckCircle2 className="size-4" />{isArabic ? "دليل مسجل" : "Evidence recorded"}</span> : <span className="text-slate-500">{isArabic ? "غير متاح" : "Not available"}</span>}</td><td className="px-5 py-4 text-slate-600 dark:text-slate-300">{formatBackupDate(restore.startedAt, isArabic ? "ar-EG" : "en-US")}</td><td className="px-5 py-4"><BackupStatusBadge status={restore.status} />{restore.hasFailure ? <p className="mt-2 max-w-xs text-xs text-rose-600 dark:text-rose-300">{isArabic ? "تم تسجيل تفاصيل الفشل بأمان في Worker." : "Failure details are retained in Worker logs."}</p> : null}</td><td className="px-5 py-4 text-end">{view.canRestore && restore.status === RestoreRunStatus.VERIFIED ? <button type="button" onClick={() => { setPromotingRun(restore); setPromotionReason(""); setConfirmationText(""); }} disabled={view.commandGuardBlocked} className="min-h-11 rounded-xl bg-rose-700 px-3 text-xs font-bold text-white hover:bg-rose-800 disabled:cursor-not-allowed disabled:opacity-50">{isArabic ? "ترقية" : "Promote"}</button> : <span className="text-slate-400">—</span>}</td></tr>;
          })}</tbody></table></div>
          <p className="border-t border-slate-200 px-5 py-3 text-xs text-slate-500 dark:border-slate-800">{isArabic ? "يُعرض وجود دليل التحقق فقط؛ لا تُعرض حمولة verification الخام." : "Only verification presence is shown; the raw verification payload is not rendered."}</p>
        </section>
      )}

      <BackupDialog open={startOpen} title={isArabic ? "بدء اختبار استعادة" : "Start restore test"} description={isArabic ? "يحفظ المتصفح قفلًا دائمًا قبل إرسال أمر الاستعادة غير القابل لإعادة التشغيل تلقائيًا." : "A durable browser lock is saved before this non-replayable restore command is sent."} confirmLabel={isArabic ? "بدء الاختبار" : "Start test"} onClose={() => { if (!view.activeAction) setStartOpen(false); }} onConfirm={() => void view.startRestore({ artifactId, ...(targetDatabaseName ? { targetDatabaseName } : {}), reason: reason.trim() }).then((run) => { if (run) setStartOpen(false); }).catch(() => undefined)} isSubmitting={view.activeAction === "start"} confirmDisabled={view.commandGuardBlocked || !artifactId || !reason.trim() || reason.length > 500 || !targetValid}>
        <label><span className={labelClass}>{isArabic ? "النسخة المكتملة" : "Completed artifact"}</span><select value={artifactId} onChange={(event) => setArtifactId(event.target.value)} className={inputClass}><option value="">{isArabic ? "اختر نسخة" : "Select an artifact"}</option>{view.artifacts.map((artifact) => <option key={artifact.id} value={artifact.id}>{artifact.databaseName} · {shortBackupId(artifact.id)}</option>)}</select></label>
        <label><span className={labelClass}>{isArabic ? "اسم قاعدة الهدف (اختياري)" : "Target database name (optional)"}</span><input value={targetDatabaseName} onChange={(event) => setTargetDatabaseName(event.target.value)} maxLength={63} className={inputClass} placeholder="restore_tenant_..." /></label>
        {!targetValid ? <p className="text-xs font-semibold text-rose-600">{isArabic ? "استخدم حروفًا وأرقامًا وشرطة سفلية، وابدأ بحرف أو شرطة سفلية." : "Use letters, numbers, and underscores; start with a letter or underscore."}</p> : null}
        <label><span className={labelClass}>{isArabic ? "سبب موثق" : "Audit reason"}</span><textarea value={reason} onChange={(event) => setReason(event.target.value)} maxLength={500} rows={4} className={`${inputClass} py-3`} /></label>
      </BackupDialog>

      <BackupDialog open={promotingRun !== null} title={isArabic ? "ترقية الاستعادة" : "Promote verified restore"} description={isArabic ? "أمر حرج وغير قابل لإعادة الإرسال تلقائيًا؛ يُحفظ قفل دائم قبل الإرسال. اكتب اسم قاعدة الهدف حرفيًا." : "This critical command is not auto-replayed; a durable browser lock is saved before send. Type the exact target database name."} confirmLabel={isArabic ? "ترقية الاستعادة" : "Promote restore"} onClose={() => { if (!view.activeAction) setPromotingRun(null); }} onConfirm={() => { if (!promotingRun) return; void view.promoteRestore(promotingRun.id, { reason: promotionReason.trim(), confirmationText }).then((run) => { if (run) setPromotingRun(null); }).catch(() => undefined); }} isSubmitting={promotingRun ? view.activeAction === `promote:${promotingRun.id}` : false} confirmDisabled={view.commandGuardBlocked || !promotingRun || promotionReason.trim().length === 0 || promotionReason.length > 500 || confirmationText !== promotingRun.targetDatabaseName} destructive>
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200"><p className="font-bold">{promotingRun?.targetDatabaseName}</p><p className="mt-1 text-xs">{isArabic ? "الترقية مسموحة فقط لحالة VERIFIED." : "Promotion is allowed only from VERIFIED state."}</p></div>
        <label><span className={labelClass}>{isArabic ? "سبب الترقية" : "Promotion reason"}</span><textarea value={promotionReason} onChange={(event) => setPromotionReason(event.target.value)} maxLength={500} rows={3} className={`${inputClass} py-3`} /></label>
        <label><span className={labelClass}>{isArabic ? "اسم قاعدة الهدف للتأكيد" : "Target database confirmation"}</span><input value={confirmationText} onChange={(event) => setConfirmationText(event.target.value)} maxLength={63} className={inputClass} /></label>
      </BackupDialog>
    </div>
  );
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const labelClass = "mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500";
const inputClass = "min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-600/20 dark:border-slate-700 dark:bg-slate-900 dark:text-white";
