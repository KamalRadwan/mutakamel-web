"use client";

import { useState } from "react";
import { ArchiveRestore, CheckCircle2, Play, RefreshCw } from "lucide-react";
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
    setArtifactId(
      view.pendingStartAttempt?.resource.kind === "BACKUP_ARTIFACT"
        ? view.pendingStartAttempt.resource.id
        : requestedArtifact?.id ?? view.artifacts[0]?.id ?? "",
    );
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
          <button type="button" onClick={openStart} disabled={view.artifacts.length === 0 || Boolean(view.activeAction)} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-cyan-700 px-4 text-sm font-semibold text-white hover:bg-cyan-800 disabled:cursor-not-allowed disabled:opacity-50"><Play className="size-4" />{isArabic ? "بدء اختبار استعادة" : "Start restore test"}</button>
        ) : undefined}
      />

      {view.retryableCommandError || view.pendingStartAttempt || view.pendingPromotionAttempt ? (
        <section role="status" className="rounded-xl border border-amber-300 bg-amber-50 p-5 text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
          <h2 className="font-semibold">{isArabic ? "هناك أمر استعادة لم تُحسم نتيجته" : "A restore command still has an unknown outcome"}</h2>
          <p className="mt-2 text-sm leading-6">{isArabic ? "يحتفظ هذا التبويب بالمفتاح وبصمة غير قابلة للقراءة ومعرف المورد فقط. افحص سجل الاستعادات ثم أعد إدخال القيم الأصلية حرفيًا عند الحاجة؛ أسباب التدقيق ونصوص التأكيد لا تُخزن." : "This tab retains only the key, a non-readable digest, and the resource ID. Check restore history before retrying, then re-enter the exact original values. Audit reasons and confirmation text are never stored."}</p>
          {view.retryableCommandError?.correlationId ? <p className="mt-2 text-xs">Correlation ID: <code>{view.retryableCommandError.correlationId}</code></p> : null}
        </section>
      ) : null}

      <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-950">
        <div className="grid gap-4 md:grid-cols-[1fr_1fr_auto_auto] md:items-end">
          <label><span className={labelClass}>{isArabic ? "معرف المستأجر" : "Tenant ID"}</span><input value={tenantId} onChange={(event) => setTenantId(event.target.value.trim())} placeholder="UUIDv7" className={inputClass} /></label>
          <label><span className={labelClass}>{isArabic ? "الحالة" : "Status"}</span><select value={status} onChange={(event) => setStatus(event.target.value as RestoreRunStatus | "")} className={inputClass}><option value="">{isArabic ? "كل الحالات" : "All statuses"}</option>{Object.values(RestoreRunStatus).map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
          <button type="button" disabled={!tenantValid} onClick={() => view.setQuery(tenantId, status)} className="min-h-11 rounded-xl bg-cyan-700 px-4 text-sm font-semibold text-white hover:bg-cyan-800 disabled:opacity-50">{isArabic ? "تطبيق" : "Apply"}</button>
          <button type="button" onClick={() => void view.refresh()} disabled={view.isLoading} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 px-4 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:hover:bg-slate-900"><RefreshCw className={`size-4 ${view.isLoading ? "animate-spin" : ""}`} />{isArabic ? "تحديث" : "Refresh"}</button>
        </div>
        {!tenantValid ? <p className="mt-3 text-xs font-semibold text-rose-600">{isArabic ? "معرف المستأجر غير صحيح." : "Tenant ID must be a valid UUID."}</p> : null}
      </section>

      {view.error ? <BackupErrorBanner error={view.error} /> : null}
      {view.enrichmentWarning ? (
        <section role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
          <p className="font-semibold">{isArabic ? "تعذر تحميل أسماء خوادم قواعد البيانات" : "Database server names are unavailable"}</p>
          <p className="mt-1 text-xs leading-5">{isArabic ? "تظل بيانات الاستعادة من Worker متاحة، وتُعرض معرفات الخوادم بدلاً من الأسماء." : "Worker restore data remains available; server IDs are shown instead of names."}</p>
          {view.enrichmentWarning.correlationId ? <p className="mt-2 text-xs">Correlation ID: <code className="font-mono">{view.enrichmentWarning.correlationId}</code></p> : null}
        </section>
      ) : null}

      {view.isLoading ? (
        <BackupStatePanel kind="loading" title={isArabic ? "جارٍ تحميل الاستعادات" : "Loading restore history"} description={isArabic ? "قراءة حالة الاختبار والترقية من Worker." : "Reading verification and promotion state from Worker."} />
      ) : view.error ? null : view.restores.length === 0 ? (
        <BackupStatePanel kind="empty" title={isArabic ? "لا توجد عمليات استعادة" : "No restore runs"} description={view.artifacts.length === 0 ? (isArabic ? "لا توجد نسخة مكتملة متاحة لبدء الاختبار." : "No completed artifact is available for a restore test.") : (isArabic ? "ابدأ اختبار استعادة لإثبات قابلية الاسترجاع." : "Start an isolated restore test to prove recoverability.")} />
      ) : (
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
          <div className="overflow-x-auto"><table className="w-full min-w-[1040px] text-sm"><thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:bg-slate-900"><tr><th className="px-5 py-3 text-start">{isArabic ? "الاستعادة" : "Restore"}</th><th className="px-5 py-3 text-start">{isArabic ? "المصدر" : "Source"}</th><th className="px-5 py-3 text-start">{isArabic ? "الهدف" : "Target"}</th><th className="px-5 py-3 text-start">{isArabic ? "الدليل" : "Verification"}</th><th className="px-5 py-3 text-start">{isArabic ? "بدأت" : "Started"}</th><th className="px-5 py-3 text-start">{isArabic ? "الحالة" : "Status"}</th><th className="px-5 py-3 text-end">{isArabic ? "الإجراء" : "Action"}</th></tr></thead><tbody className="divide-y divide-slate-100 dark:divide-slate-800">{view.restores.map((restore) => {
            const server = view.servers.find((item) => item.id === restore.databaseServerId);
            const anotherPromotionIsPending = Boolean(view.pendingPromotionAttempt && view.pendingPromotionAttempt.resource.id !== restore.id);
            return <tr key={restore.id} className="align-top hover:bg-slate-50/70 dark:hover:bg-slate-900/50"><td className="px-5 py-4"><div className="flex gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-cyan-50 text-cyan-700 dark:bg-cyan-950/50 dark:text-cyan-300"><ArchiveRestore className="size-4" /></span><div><p className="font-mono font-semibold" title={restore.id}>{shortBackupId(restore.id)}</p><p className="mt-1 text-xs text-slate-500">{server?.name ?? shortBackupId(restore.databaseServerId)}</p></div></div></td><td className="px-5 py-4 font-mono font-semibold">{restore.sourceDatabaseName}</td><td className="px-5 py-4 font-mono font-semibold">{restore.targetDatabaseName}</td><td className="px-5 py-4">{restore.hasVerification ? <span className="inline-flex items-center gap-2 text-emerald-700 dark:text-emerald-300"><CheckCircle2 className="size-4" />{isArabic ? "دليل مسجل" : "Evidence recorded"}</span> : <span className="text-slate-500">{isArabic ? "غير متاح" : "Not available"}</span>}</td><td className="px-5 py-4 text-slate-600 dark:text-slate-300">{formatBackupDate(restore.startedAt, isArabic ? "ar-EG" : "en-US")}</td><td className="px-5 py-4"><BackupStatusBadge status={restore.status} />{restore.hasFailure ? <p className="mt-2 max-w-xs text-xs text-rose-600 dark:text-rose-300">{isArabic ? "تم تسجيل تفاصيل الفشل بأمان في Worker." : "Failure details are retained in Worker logs."}</p> : null}</td><td className="px-5 py-4 text-end">{view.canRestore && restore.status === RestoreRunStatus.VERIFIED ? <button type="button" onClick={() => { setPromotingRun(restore); setPromotionReason(""); setConfirmationText(""); }} disabled={Boolean(view.activeAction) || anotherPromotionIsPending} title={anotherPromotionIsPending ? (isArabic ? "احسم أمر الترقية السابق أولًا" : "Resolve the previous promotion command first") : undefined} className="min-h-11 rounded-xl bg-rose-700 px-3 text-xs font-semibold text-white hover:bg-rose-800 disabled:cursor-not-allowed disabled:opacity-50">{isArabic ? "ترقية" : "Promote"}</button> : <span className="text-slate-400">—</span>}</td></tr>;
          })}</tbody></table></div>
          <p className="border-t border-slate-200 px-5 py-3 text-xs text-slate-500 dark:border-slate-800">{isArabic ? "يُعرض وجود دليل التحقق فقط؛ لا تُعرض حمولة verification الخام." : "Only verification presence is shown; the raw verification payload is not rendered."}</p>
        </section>
      )}

      <BackupDialog open={startOpen} title={isArabic ? "بدء اختبار استعادة" : "Start restore test"} description={isArabic ? "تُحفظ هوية الأمر وبصمة الطلب ومعرف النسخة فقط داخل هذا التبويب؛ لا يُحفظ سبب التدقيق أو اسم قاعدة الهدف." : "Only the command identity, request digest, and artifact ID stay in this tab; the audit reason and target database name are not stored."} confirmLabel={isArabic ? "بدء الاختبار" : "Start test"} onClose={() => { if (!view.activeAction) setStartOpen(false); }} onConfirm={() => void view.startRestore({ artifactId, ...(targetDatabaseName ? { targetDatabaseName } : {}), reason: reason.trim() }).then((run) => { if (run) setStartOpen(false); }).catch(() => undefined)} isSubmitting={view.activeAction === "start"} confirmDisabled={!artifactId || !reason.trim() || reason.length > 500 || !targetValid}>
        <label><span className={labelClass}>{isArabic ? "النسخة المكتملة" : "Completed artifact"}</span><select value={artifactId} onChange={(event) => setArtifactId(event.target.value)} className={inputClass}><option value="">{isArabic ? "اختر نسخة" : "Select an artifact"}</option>{view.artifacts.map((artifact) => <option key={artifact.id} value={artifact.id}>{artifact.databaseName} · {shortBackupId(artifact.id)}</option>)}</select></label>
        <label><span className={labelClass}>{isArabic ? "اسم قاعدة الهدف (اختياري)" : "Target database name (optional)"}</span><input value={targetDatabaseName} onChange={(event) => setTargetDatabaseName(event.target.value)} maxLength={63} className={inputClass} placeholder="restore_tenant_..." /></label>
        {!targetValid ? <p className="text-xs font-semibold text-rose-600">{isArabic ? "استخدم حروفًا وأرقامًا وشرطة سفلية، وابدأ بحرف أو شرطة سفلية." : "Use letters, numbers, and underscores; start with a letter or underscore."}</p> : null}
        <label><span className={labelClass}>{isArabic ? "سبب موثق" : "Audit reason"}</span><textarea value={reason} onChange={(event) => setReason(event.target.value)} maxLength={500} rows={4} className={`${inputClass} py-3`} /></label>
      </BackupDialog>

      <BackupDialog open={promotingRun !== null} title={isArabic ? "ترقية الاستعادة" : "Promote verified restore"} description={isArabic ? "يحتفظ هذا التبويب بهوية الأمر وبصمته ومعرف عملية الاستعادة فقط. اكتب اسم قاعدة الهدف حرفيًا؛ لا يُخزن نص التأكيد أو السبب." : "This tab retains only the command identity, digest, and restore-run ID. Type the exact target database name; confirmation text and reason are not stored."} confirmLabel={isArabic ? "ترقية الاستعادة" : "Promote restore"} onClose={() => { if (!view.activeAction) setPromotingRun(null); }} onConfirm={() => { if (!promotingRun) return; void view.promoteRestore(promotingRun.id, { reason: promotionReason.trim(), confirmationText }).then((run) => { if (run) setPromotingRun(null); }).catch(() => undefined); }} isSubmitting={promotingRun ? view.activeAction === `promote:${promotingRun.id}` : false} confirmDisabled={!promotingRun || promotionReason.trim().length === 0 || promotionReason.length > 500 || confirmationText !== promotingRun.targetDatabaseName} destructive>
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200"><p className="font-semibold">{promotingRun?.targetDatabaseName}</p><p className="mt-1 text-xs">{isArabic ? "الترقية مسموحة فقط لحالة VERIFIED." : "Promotion is allowed only from VERIFIED state."}</p></div>
        <label><span className={labelClass}>{isArabic ? "سبب الترقية" : "Promotion reason"}</span><textarea value={promotionReason} onChange={(event) => setPromotionReason(event.target.value)} maxLength={500} rows={3} className={`${inputClass} py-3`} /></label>
        <label><span className={labelClass}>{isArabic ? "اسم قاعدة الهدف للتأكيد" : "Target database confirmation"}</span><input value={confirmationText} onChange={(event) => setConfirmationText(event.target.value)} maxLength={63} className={inputClass} /></label>
      </BackupDialog>
    </div>
  );
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const labelClass = "mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-500";
const inputClass = "min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-600/20 dark:border-slate-700 dark:bg-slate-900 dark:text-white";
