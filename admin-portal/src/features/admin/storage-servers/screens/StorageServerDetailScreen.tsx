"use client";

import { useEffect, useId, useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Clock3,
  Edit3,
  HardDrive,
  KeyRound,
  Loader2,
  Play,
  RefreshCw,
  ShieldCheck,
  StopCircle,
  Trash2,
  X,
} from "lucide-react";
import { DestructiveActionModal } from "@/components/shared/DestructiveActionModal";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { useToast } from "@/components/ui/ToastContext";
import { useI18n } from "@/i18n/I18nContext";
import { useStorageServerDetail } from "../hooks/useStorageServerDetail";
import type { NormalizedApiError } from "@/shared/api/normalized-api-error";
import {
  isSecureStorageEndpoint,
  probeFreshnessPercent,
} from "../lib/storage-server-contract";
import type { StorageServerView, UpdateStorageServerDto } from "../types";
import { useAccessibleDialog } from "@/shared/hooks/useAccessibleDialog";

export function StorageServerDetailScreen({ id }: { id: string }) {
  const { lang } = useI18n();
  const isArabic = lang === "ar";
  const router = useRouter();
  const toast = useToast();
  const view = useStorageServerDetail(id);
  const [editor, setEditor] = useState<"configuration" | "credentials" | null>(null);
  const [confirmation, setConfirmation] = useState<"offline" | "delete" | null>(null);

  useEffect(() => {
    queueMicrotask(() => {
      setEditor(null);
      setConfirmation(null);
    });
  }, [id]);

  if (view.isAuthLoading) return <LoadingState isArabic={isArabic} />;
  if (!view.canRead) return <AccessDenied isArabic={isArabic} />;
  if (view.isLoading && !view.server) return <LoadingState isArabic={isArabic} />;
  if (!view.server) return <ErrorState message={view.error} isArabic={isArabic} />;
  const server = view.server;

  const run = async (action: () => Promise<unknown>, success: string): Promise<boolean> => {
    try {
      await action();
      toast.success(isArabic ? "تم تنفيذ الإجراء" : "Action completed", success);
      return true;
    } catch (caught) {
      toast.error(isArabic ? "فشل الإجراء" : "Action failed", readErrorMessage(caught, isArabic ? "تعذر تنفيذ الطلب." : "The request could not be completed."));
      return false;
    }
  };

  const runProbe = async () => {
    try {
      const result = await view.probe();
      if (result.outcome === "PASSED") {
        toast.success(isArabic ? "نجح اختبار الاتصال" : "Connection test passed", isArabic ? "تم تحديث دليل الاتصال من دون تغيير حالة الخادم." : "Connection evidence was refreshed without changing lifecycle state.");
      } else {
        toast.warning(
          result.outcome === "SKIPPED" ? isArabic ? "تم تجاوز الاختبار" : "Connection test skipped" : isArabic ? "فشل اختبار الاتصال" : "Connection test failed",
          result.errorCode ?? (isArabic ? "تغيرت مراجعة الإعداد قبل التنفيذ." : "The configuration revision changed before execution."),
        );
      }
    } catch (caught) {
      toast.error(isArabic ? "تعذر تنفيذ الاختبار" : "Connection test could not run", readErrorMessage(caught, isArabic ? "تعذر تنفيذ الطلب." : "The request could not be completed."));
    }
  };

  const deleteBlocked = server.isPlatformDefault || server.assignedTenants > 0 || !["DRAFT", "OFFLINE"].includes(server.status);
  const connectionEditBlocked = server.assignedTenants > 0 && server.status !== "OFFLINE";
  const canMakeDefault = server.status === "ACTIVE" && server.connectionEvidenceFresh && !server.isPlatformDefault;

  return (
    <div className="space-y-6">
      <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950 sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-3">
            <Link href="/storage-servers" aria-label={isArabic ? "العودة" : "Back"} className="grid size-11 shrink-0 place-items-center rounded-xl border border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-900"><ArrowLeft className={`size-4 ${isArabic ? "rotate-180" : ""}`} /></Link>
            <div>
              <div className="flex flex-wrap items-center gap-2"><h1 className="text-2xl font-black">{server.name}</h1><StatusBadge status={server.status} enumType="db-server" />{server.isPlatformDefault ? <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-[10px] font-bold uppercase text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300">{isArabic ? "الافتراضي" : "Platform default"}</span> : null}</div>
              <p className="mt-2 font-mono text-xs text-slate-500">{server.code} · {server.id}</p>
            </div>
          </div>

          {view.canUpdate ? (
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => void runProbe()} disabled={view.isMutating} className={secondaryActionClass}><RefreshCw className={`size-4 ${view.isMutating ? "animate-spin" : ""}`} />{isArabic ? "اختبار الاتصال" : "Run connection test"}</button>
              {["DRAFT", "OFFLINE"].includes(server.status) ? <button type="button" onClick={() => void run(view.activate, isArabic ? "نجح اختبار التفعيل وأصبح الخادم نشطاً." : "Activation test passed and the server is now ACTIVE.")} disabled={view.isMutating} className={primaryActionClass}><Play className="size-4" />{isArabic ? "اختبار وتفعيل" : "Test & activate"}</button> : null}
              {server.status === "ACTIVE" && !server.isPlatformDefault ? <button type="button" onClick={() => setConfirmation("offline")} disabled={view.isMutating} className={dangerOutlineClass}><StopCircle className="size-4" />{isArabic ? "إيقاف" : "Take offline"}</button> : null}
            </div>
          ) : null}
        </div>
      </header>

      {view.error ? <div role="alert" className="whitespace-pre-line rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100">{readErrorMessage(view.error, "")}</div> : null}
      {view.lastProbe ? <ProbeResultBanner result={view.lastProbe} isArabic={isArabic} /> : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.55fr)_minmax(320px,0.8fr)]">
        <div className="space-y-6">
          <Panel title={isArabic ? "إعدادات الخادم" : "Server configuration"} icon={<HardDrive className="size-4" />} action={view.canUpdate ? <button type="button" onClick={() => setEditor("configuration")} className={smallButtonClass}><Edit3 className="size-3.5" />{isArabic ? "تعديل" : "Edit"}</button> : undefined}>
            <dl className="grid gap-5 sm:grid-cols-2">
              <Datum label={isArabic ? "نقطة النهاية" : "Endpoint"} value={server.endpoint} mono wide />
              <Datum label={isArabic ? "المنطقة" : "Region"} value={server.region} mono />
              <Datum label={isArabic ? "الحاوية" : "Bucket"} value={server.bucketName} mono />
              <Datum label={isArabic ? "المستأجرون" : "Tenant capacity"} value={`${server.assignedTenants} / ${server.maxTenants ?? "∞"}`} />
              <Datum label={isArabic ? "مراجعة الإعداد" : "Configuration revision"} value={`v${server.configRevision}`} mono />
            </dl>
            {connectionEditBlocked ? <p className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">{isArabic ? "يجب إيقاف الخادم قبل تغيير نقطة النهاية أو المنطقة أو الحاوية أو بيانات الاعتماد لأنه يحتوي مستأجرين." : "Take this assigned server OFFLINE before changing its endpoint, region, bucket, or credentials."}</p> : null}
          </Panel>

          <Panel title={isArabic ? "بيانات الاعتماد" : "Credentials"} icon={<KeyRound className="size-4" />} action={view.canUpdate ? <button type="button" onClick={() => setEditor("credentials")} disabled={connectionEditBlocked} className={smallButtonClass}><KeyRound className="size-3.5" />{isArabic ? "تدوير" : "Rotate"}</button> : undefined}>
            <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100">
              <ShieldCheck className="mt-0.5 size-5 shrink-0" />
              <div><p className="font-bold">{server.credentialsConfigured ? isArabic ? "مشفرة ومهيأة" : "Encrypted and configured" : isArabic ? "غير مهيأة" : "Not configured"}</p><p className="mt-1 text-xs leading-5">{isArabic ? "لا يعيد Core المفاتيح الخام إلى المتصفح. التدوير يستبدلها ويجعل حالة الخادم DRAFT حتى إعادة التفعيل." : "Core never returns raw keys to the browser. Rotation replaces them and moves the server to DRAFT until it is activated again."}</p></div>
            </div>
          </Panel>
        </div>

        <div className="space-y-6">
          <FreshnessPanel server={server} isArabic={isArabic} />

          <Panel title={isArabic ? "سياسات التشغيل" : "Operational policies"} icon={<ShieldCheck className="size-4" />}>
            <div className="space-y-3">
              <PolicyRow label={isArabic ? "التوزيع الجديد" : "New placement"} value={server.status === "ACTIVE" && server.connectionEvidenceFresh ? isArabic ? "مسموح" : "Allowed" : isArabic ? "محجوب" : "Blocked"} good={server.status === "ACTIVE" && server.connectionEvidenceFresh} />
              <PolicyRow label={isArabic ? "التشغيل المعين" : "Assigned runtime"} value={isArabic ? "لا يتغير بفشل الاختبار" : "Unaffected by probe failure"} good />
              <PolicyRow label={isArabic ? "الاختبار المجدول" : "Scheduled check"} value={isArabic ? "Worker كل 12 ساعة" : "Worker every 12 hours"} good />
            </div>
            {view.canUpdate && !server.isPlatformDefault ? <button type="button" onClick={() => void run(view.makePlatformDefault, isArabic ? "أصبح الخادم الافتراضي للمنصة." : "The server is now the platform default.")} disabled={!canMakeDefault || view.isMutating} title={!canMakeDefault ? isArabic ? "يتطلب حالة ACTIVE ودليل اتصال حديث." : "Requires ACTIVE state and fresh connection evidence." : undefined} className="mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-indigo-300 px-4 text-sm font-bold text-indigo-700 hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-45 dark:border-indigo-800 dark:text-indigo-300 dark:hover:bg-indigo-950/40"><ShieldCheck className="size-4" />{isArabic ? "تعيين كافتراضي" : "Make platform default"}</button> : null}
          </Panel>

          {view.canDelete ? <Panel title={isArabic ? "منطقة خطرة" : "Danger zone"} icon={<Trash2 className="size-4" />}><p className="text-xs leading-5 text-slate-500">{isArabic ? "يمكن حذف خادم DRAFT أو OFFLINE غير افتراضي ومن دون مستأجرين فقط." : "Only an unassigned, non-default DRAFT or OFFLINE server can be deleted."}</p><button type="button" onClick={() => setConfirmation("delete")} disabled={deleteBlocked || view.isMutating} className={`mt-4 w-full ${dangerOutlineClass}`}><Trash2 className="size-4" />{isArabic ? "حذف خادم التخزين" : "Delete storage server"}</button></Panel> : null}
        </div>
      </div>

      {editor ? <StorageServerEditor key={`${editor}:${server.configRevision}:${server.updatedAt}`} mode={editor} server={server} isArabic={isArabic} connectionEditBlocked={connectionEditBlocked} isSubmitting={view.isMutating} onClose={() => setEditor(null)} onSubmit={async (dto) => { await view.update(dto); setEditor(null); toast.success(isArabic ? "تم الحفظ" : "Saved", isArabic ? "تم تحديث خادم التخزين." : "Storage server was updated."); }} /> : null}

      <DestructiveActionModal isOpen={confirmation === "offline"} onClose={() => setConfirmation(null)} onConfirm={() => void run(view.offline, isArabic ? "تم إيقاف الخادم؛ لا يغير ذلك بيانات المستأجرين المعينين." : "The server is OFFLINE; assigned tenant data was not changed.").then((succeeded) => { if (succeeded) setConfirmation(null); })} title={isArabic ? "إيقاف خادم التخزين" : "Take storage server offline"} description={isArabic ? "يمنع ذلك التوزيع الجديد ويسمح بصيانة إعداد الاتصال." : "This blocks new placement and permits connection maintenance."} targetName={server.name} actionType="offline" requireNameTyping={false} isSubmitting={view.isMutating} />
      <DestructiveActionModal isOpen={confirmation === "delete"} onClose={() => setConfirmation(null)} onConfirm={() => void view.remove().then(() => { setConfirmation(null); router.push("/storage-servers"); }).catch((caught) => toast.error(isArabic ? "فشل الحذف" : "Delete failed", readErrorMessage(caught, isArabic ? "تعذر الحذف." : "Delete request failed.")))} title={isArabic ? "حذف خادم التخزين" : "Delete storage server"} description={isArabic ? "حذف منطقي لسجل غير معين. لا يمكن استخدامه للتوزيع." : "Soft-delete this unassigned record so it can no longer be used for placement."} targetName={server.name} actionType="delete" requireNameTyping isSubmitting={view.isMutating} />
    </div>
  );
}

function FreshnessPanel({ server, isArabic }: { server: StorageServerView; isArabic: boolean }) {
  const percent = probeFreshnessPercent(server.lastConnectionTestedAt, server.connectionEvidenceExpiresAt);
  const passed = server.lastConnectionTestStatus === "PASSED";
  const color = server.connectionEvidenceFresh && passed ? "bg-emerald-500" : server.lastConnectionTestStatus === "FAILED" ? "bg-rose-500" : "bg-amber-500";
  return <Panel title={isArabic ? "حداثة دليل الاتصال" : "Connection evidence freshness"} icon={<Clock3 className="size-4" />}><div className="flex items-center justify-between gap-3"><div><p className="font-black">{server.connectionEvidenceFresh && passed ? isArabic ? "حديث" : "Fresh" : server.lastConnectionTestStatus === "FAILED" ? isArabic ? "فشل" : "Failed" : isArabic ? "قديم أو غير مختبر" : "Stale or untested"}</p><p className="mt-1 text-xs text-slate-500">{isArabic ? "نافذة الصلاحية 24 ساعة" : "24-hour validity window"}</p></div><span className={`grid size-10 place-items-center rounded-full text-white ${color}`}>{server.connectionEvidenceFresh && passed ? <CheckCircle2 className="size-5" /> : <AlertCircle className="size-5" />}</span></div><div className="mt-5 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800" aria-label={isArabic ? "نسبة الوقت المتبقي" : "Remaining freshness window"} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(percent)} role="progressbar"><div className={`h-full rounded-full ${color}`} style={{ width: `${percent}%` }} /></div><dl className="mt-4 space-y-3 text-xs"><DatumRow label={isArabic ? "آخر اختبار" : "Last tested"} value={formatDate(server.lastConnectionTestedAt, isArabic)} /><DatumRow label={isArabic ? "انتهاء الدليل" : "Evidence expires"} value={formatDate(server.connectionEvidenceExpiresAt, isArabic)} /><DatumRow label={isArabic ? "موعد الاختبار التلقائي" : "Automatic check due"} value={formatDate(server.nextAutomaticProbeDueAt, isArabic)} />{server.lastConnectionTestErrorCode ? <DatumRow label={isArabic ? "رمز الفشل الآمن" : "Safe failure code"} value={server.lastConnectionTestErrorCode} mono /> : null}</dl></Panel>;
}

function StorageServerEditor({ mode, server, isArabic, connectionEditBlocked, isSubmitting, onClose, onSubmit }: { mode: "configuration" | "credentials"; server: StorageServerView; isArabic: boolean; connectionEditBlocked: boolean; isSubmitting: boolean; onClose: () => void; onSubmit: (dto: UpdateStorageServerDto) => Promise<void> }) {
  const [name, setName] = useState(server.name);
  const [endpoint, setEndpoint] = useState(server.endpoint);
  const [region, setRegion] = useState(server.region);
  const [bucketName, setBucketName] = useState(server.bucketName);
  const [maxTenants, setMaxTenants] = useState(server.maxTenants?.toString() ?? "");
  const [accessKeyId, setAccessKeyId] = useState("");
  const [secretAccessKey, setSecretAccessKey] = useState("");
  const [error, setError] = useState<string | null>(null);
  const titleId = useId();
  const descriptionId = useId();
  const { dialogRef, onKeyDown, onBackdropMouseDown } = useAccessibleDialog({
    open: true,
    onClose,
    isSubmitting,
    initialFocusSelector: mode === "credentials" ? 'input:not([type="password"])' : "input",
  });
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    try {
      if (mode === "credentials") {
        await onSubmit({ credentials: { accessKeyId: accessKeyId.trim(), secretAccessKey } });
        return;
      }
      if (!connectionEditBlocked && !isSecureStorageEndpoint(endpoint.trim())) throw new Error(isArabic ? "نقطة النهاية يجب أن تكون أصلاً آمناً بصيغة HTTPS فقط." : "Endpoint must be an HTTPS root origin.");
      const dto: UpdateStorageServerDto = {};
      const nextName = name.trim();
      const nextMaximum = maxTenants ? Number(maxTenants) : null;
      if (nextName !== server.name) dto.name = nextName;
      if (nextMaximum !== server.maxTenants) dto.maxTenants = nextMaximum;
      if (!connectionEditBlocked) {
        const nextEndpoint = new URL(endpoint.trim()).origin;
        const nextRegion = region.trim().toLowerCase();
        const nextBucket = bucketName.trim().toLowerCase();
        if (nextEndpoint !== server.endpoint) dto.endpoint = nextEndpoint;
        if (nextRegion !== server.region) dto.region = nextRegion;
        if (nextBucket !== server.bucketName) dto.bucketName = nextBucket;
      }
      if (Object.keys(dto).length === 0) {
        onClose();
        return;
      }
      await onSubmit(dto);
    } catch (caught) { setError(readErrorMessage(caught, isArabic ? "تعذر الحفظ." : "Save failed.")); }
  };

  const title = mode === "credentials" ? isArabic ? "تدوير بيانات الاعتماد" : "Rotate credentials" : isArabic ? "تعديل خادم التخزين" : "Edit storage server";
  const description = mode === "credentials" ? isArabic ? "لا يمكن استرجاع المفاتيح الحالية. أدخل زوجاً جديداً كاملاً." : "Current keys cannot be retrieved. Enter a complete replacement pair." : connectionEditBlocked ? isArabic ? "إعدادات الاتصال مقفلة حتى يصبح الخادم OFFLINE." : "Connection settings are locked until the server is OFFLINE." : isArabic ? "تغيير الاتصال يلغي الدليل الحالي ويعيد الحالة إلى DRAFT." : "Changing connectivity invalidates current evidence and returns the server to DRAFT.";
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-4" role="presentation" onMouseDown={onBackdropMouseDown}>
      <section ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={descriptionId} tabIndex={-1} onKeyDown={onKeyDown} className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-800 dark:bg-slate-950">
        <div className="flex items-start justify-between gap-3"><div><h2 id={titleId} className="text-lg font-black">{title}</h2><p id={descriptionId} className="mt-1 text-xs leading-5 text-slate-500">{description}</p></div><button type="button" onClick={onClose} disabled={isSubmitting} aria-label={isArabic ? "إغلاق" : "Close"} className="grid size-11 place-items-center rounded-xl hover:bg-slate-100 disabled:opacity-50 dark:hover:bg-slate-900"><X className="size-4" /></button></div>
        <form onSubmit={submit} className="mt-5 space-y-4">
          {error ? <div role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-900 dark:bg-rose-950/40 dark:text-rose-100">{error}</div> : null}
          {mode === "credentials" ? <><EditorField label={isArabic ? "معرف مفتاح الوصول" : "Access key ID"}><input required minLength={3} maxLength={128} autoComplete="off" value={accessKeyId} onChange={(event) => setAccessKeyId(event.target.value)} className={`${inputClass} font-mono`} /></EditorField><EditorField label={isArabic ? "مفتاح الوصول السري" : "Secret access key"}><input required type="password" minLength={16} maxLength={256} autoComplete="new-password" value={secretAccessKey} onChange={(event) => setSecretAccessKey(event.target.value)} className={`${inputClass} font-mono`} /></EditorField></> : <div className="grid gap-4 sm:grid-cols-2"><EditorField label={isArabic ? "الاسم" : "Name"}><input required maxLength={120} value={name} onChange={(event) => setName(event.target.value)} className={inputClass} /></EditorField><EditorField label={isArabic ? "الحد الأقصى للمستأجرين" : "Maximum tenants"}><input type="number" min={Math.max(1, server.assignedTenants)} max={1_000_000} value={maxTenants} onChange={(event) => setMaxTenants(event.target.value)} className={inputClass} /></EditorField><EditorField wide label={isArabic ? "نقطة النهاية" : "Endpoint"}><input required disabled={connectionEditBlocked} type="url" value={endpoint} onChange={(event) => setEndpoint(event.target.value)} className={`${inputClass} font-mono disabled:opacity-55`} /></EditorField><EditorField label={isArabic ? "المنطقة" : "Region"}><input required disabled={connectionEditBlocked} value={region} onChange={(event) => setRegion(event.target.value)} className={`${inputClass} font-mono disabled:opacity-55`} /></EditorField><EditorField label={isArabic ? "الحاوية" : "Bucket"}><input required disabled={connectionEditBlocked} value={bucketName} onChange={(event) => setBucketName(event.target.value)} className={`${inputClass} font-mono disabled:opacity-55`} /></EditorField></div>}
          <div className="flex justify-end gap-2 pt-2"><button type="button" onClick={onClose} disabled={isSubmitting} className="min-h-11 rounded-xl px-4 text-sm font-bold hover:bg-slate-100 dark:hover:bg-slate-900">{isArabic ? "إلغاء" : "Cancel"}</button><button type="submit" disabled={isSubmitting} className={primaryActionClass}>{isSubmitting ? <Loader2 className="size-4 animate-spin" /> : null}{isArabic ? "حفظ" : "Save"}</button></div>
        </form>
      </section>
    </div>
  );
}

function ProbeResultBanner({ result, isArabic }: { result: { outcome: string; errorCode: string | null; lifecycleStatus: string }; isArabic: boolean }) { const passed = result.outcome === "PASSED"; return <section role="status" className={`rounded-xl border p-4 text-sm ${passed ? "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100" : "border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100"}`}><p className="font-bold">{passed ? isArabic ? "نجح اختبار الاتصال" : "Connection test passed" : isArabic ? "فشل اختبار الاتصال" : "Connection test failed"}</p><p className="mt-1 text-xs">{isArabic ? `لم تتغير حالة دورة الحياة: ${result.lifecycleStatus}.` : `Lifecycle state remains ${result.lifecycleStatus}.`}{result.errorCode ? ` · ${result.errorCode}` : ""}</p></section>; }
function Panel({ title, icon, action, children }: { title: string; icon: ReactNode; action?: ReactNode; children: ReactNode }) { return <section className="rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950"><div className="flex min-h-14 items-center justify-between gap-3 border-b border-slate-200 px-5 dark:border-slate-800"><h2 className="flex items-center gap-2 text-sm font-black"><span className="text-indigo-600 dark:text-indigo-400">{icon}</span>{title}</h2>{action}</div><div className="p-5">{children}</div></section>; }
function Datum({ label, value, mono, wide }: { label: string; value: string; mono?: boolean; wide?: boolean }) { return <div className={wide ? "sm:col-span-2" : ""}><dt className="text-xs font-bold uppercase tracking-wider text-slate-500">{label}</dt><dd className={`mt-2 break-all text-sm font-semibold ${mono ? "font-mono" : ""}`}>{value}</dd></div>; }
function DatumRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) { return <div className="flex items-start justify-between gap-4"><dt className="text-slate-500">{label}</dt><dd className={`text-end font-semibold ${mono ? "break-all font-mono" : ""}`}>{value}</dd></div>; }
function PolicyRow({ label, value, good }: { label: string; value: string; good: boolean }) { return <div className="flex items-center justify-between gap-4 rounded-xl bg-slate-50 p-3 text-xs dark:bg-slate-900"><span className="text-slate-500">{label}</span><span className={`text-end font-bold ${good ? "text-emerald-700 dark:text-emerald-300" : "text-amber-700 dark:text-amber-300"}`}>{value}</span></div>; }
function EditorField({ label, wide, children }: { label: string; wide?: boolean; children: ReactNode }) { return <label className={`block ${wide ? "sm:col-span-2" : ""}`}><span className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">{label}</span>{children}</label>; }
function AccessDenied({ isArabic }: { isArabic: boolean }) { return <section className="mx-auto max-w-xl rounded-2xl border border-rose-200 bg-rose-50 p-8 text-center text-rose-900 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100"><AlertCircle className="mx-auto size-10" /><h1 className="mt-3 text-lg font-black">{isArabic ? "تم رفض الوصول" : "Access denied"}</h1></section>; }
function LoadingState({ isArabic }: { isArabic: boolean }) { return <div className="grid min-h-80 place-items-center text-sm font-semibold text-slate-500"><span className="flex items-center gap-2"><Loader2 className="size-5 animate-spin" />{isArabic ? "جارٍ تحميل الخادم…" : "Loading storage server…"}</span></div>; }
function ErrorState({ message, isArabic }: { message: NormalizedApiError | null; isArabic: boolean }) { return <section className="mx-auto max-w-xl rounded-2xl border border-rose-200 bg-rose-50 p-8 text-center text-rose-900 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100"><AlertCircle className="mx-auto size-10" /><h1 className="mt-3 text-lg font-black">{isArabic ? "تعذر تحميل الخادم" : "Storage server unavailable"}</h1><p className="mt-2 whitespace-pre-line text-sm">{message ? readErrorMessage(message, "") : null}</p><Link href="/storage-servers" className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-white px-4 font-bold text-rose-800">{isArabic ? "العودة" : "Back"}</Link></section>; }
function formatDate(value: string | null, isArabic: boolean) { if (!value) return isArabic ? "غير متاح" : "Not available"; const date = new Date(value); return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat(isArabic ? "ar-EG" : "en-US", { year: "numeric", month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "UTC", timeZoneName: "short" }).format(date); }

const inputClass = "min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600/20 dark:border-slate-700 dark:bg-slate-900 dark:text-white";
const primaryActionClass = "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 text-sm font-bold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50";
const secondaryActionClass = "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-sm font-bold hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-950 dark:hover:bg-slate-900";
const dangerOutlineClass = "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-rose-300 px-4 text-sm font-bold text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-45 dark:border-rose-800 dark:text-rose-300 dark:hover:bg-rose-950/40";
const smallButtonClass = "inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-xs font-bold text-indigo-700 hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-45 dark:text-indigo-300 dark:hover:bg-indigo-950/40";

function readErrorMessage(value: unknown, fallback: string): string {
  if (typeof value !== "object" || value === null) return fallback;
  const candidate = value as { message?: unknown; correlationId?: unknown };
  const message = typeof candidate.message === "string" ? candidate.message : fallback;
  return typeof candidate.correlationId === "string"
    ? `${message}\nCorrelation ID: ${candidate.correlationId}`
    : message;
}
