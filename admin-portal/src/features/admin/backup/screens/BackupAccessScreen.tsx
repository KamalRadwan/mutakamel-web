"use client";

import { useState } from "react";
import { KeyRound, RefreshCw, RotateCcw, Settings2, ShieldCheck } from "lucide-react";
import { BackupDialog } from "../components/BackupDialog";
import { BackupErrorBanner } from "../components/BackupErrorBanner";
import { BackupPageHeader } from "../components/BackupPageHeader";
import { BackupServerSelect } from "../components/BackupServerSelect";
import { BackupStatePanel } from "../components/BackupStatePanel";
import { BackupStatusBadge } from "../components/BackupStatusBadge";
import { useBackupDatabaseAccess } from "../hooks/useBackupDatabaseAccess";
import { formatBackupDate } from "../lib/backup-format";
import { useI18n } from "@/i18n/I18nContext";

type DialogName = "policy" | "regenerate" | "reconcile" | null;

export function BackupAccessScreen() {
  const { lang } = useI18n();
  const isArabic = lang === "ar";
  const view = useBackupDatabaseAccess();
  const [dialog, setDialog] = useState<DialogName>(null);
  const [reason, setReason] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [rotationEnabled, setRotationEnabled] = useState(false);
  const [intervalHours, setIntervalHours] = useState(720);
  const [windowStart, setWindowStart] = useState(0);
  const [windowHours, setWindowHours] = useState(1);

  const [prevBinding, setPrevBinding] = useState(view.binding);
  if (view.binding !== prevBinding) {
    setPrevBinding(view.binding);
    if (view.binding) {
      setRotationEnabled(view.binding.rotationEnabled);
      setIntervalHours(view.binding.rotationIntervalHours);
      setWindowStart(view.binding.maintenanceWindowStartUtc);
      setWindowHours(view.binding.maintenanceWindowHours);
    }
  }

  const closeDialog = () => {
    if (view.activeAction) return;
    setDialog(null);
    setReason("");
    setConfirmation("");
  };

  if (!view.canRead) {
    return (
      <BackupStatePanel
        kind="forbidden"
        title={isArabic ? "دليل صلاحية قاعدة البيانات غير متاح" : "Database access evidence is restricted"}
        description={isArabic
          ? "تحتاج إلى admin.database_servers.read. صلاحيات النسخ الاحتياطي وحدها لا تكشف حالة بيانات اعتماد Core."
          : "This view requires admin.database_servers.read. Backup permissions alone do not expose Core credential state."}
      />
    );
  }

  return (
    <div className="space-y-6">
      <BackupPageHeader
        eyebrow={isArabic ? "حد أمان Core" : "Core security boundary"}
        title={isArabic ? "صلاحية قاعدة بيانات النسخ الاحتياطي" : "Backup database access"}
        description={isArabic
          ? "إدارة الحساب الثابت وسياسة تدوير كلمة المرور. كلمات المرور لا تظهر ولا تنتقل إلى المتصفح."
          : "Manage the fixed Backup principal and its password-rotation policy. Passwords are never returned to the browser."}
      />

      <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-950">
        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
          <BackupServerSelect
            label={isArabic ? "خادم قاعدة البيانات" : "Database server"}
            value={view.selectedServerId}
            servers={view.servers}
            onChange={view.setSelectedServerId}
            disabled={view.isLoading || Boolean(view.activeAction)}
            placeholder={isArabic ? "اختر خادم قاعدة بيانات" : "Select a database server"}
          />
          <button type="button" onClick={() => void view.refreshBinding()} disabled={!view.selectedServerId || view.isLoadingBinding} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 px-4 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:hover:bg-slate-900">
            <RefreshCw className={`size-4 ${view.isLoadingBinding ? "animate-spin" : ""}`} aria-hidden="true" />
            {isArabic ? "تحديث الدليل" : "Refresh evidence"}
          </button>
        </div>
      </section>

      {view.error ? <BackupErrorBanner error={view.error} /> : null}

      {view.isLoading || view.isLoadingBinding ? (
        <BackupStatePanel kind="loading" title={isArabic ? "جارٍ تحميل الحساب" : "Loading database access"} description={isArabic ? "قراءة دليل آمن بدون أسرار من Core." : "Reading secret-free evidence from Core."} />
      ) : view.error ? null : !view.selectedServerId ? (
        <BackupStatePanel kind="empty" title={isArabic ? "لا يوجد خادم محدد" : "No server selected"} description={isArabic ? "اختر خادمًا لعرض حساب النسخ الاحتياطي." : "Choose a server to inspect its Backup principal."} />
      ) : !view.binding ? (
        <BackupStatePanel kind="empty" title={isArabic ? "حساب النسخ الاحتياطي غير موجود" : "Backup principal is not provisioned"} description={isArabic ? "لا يمكن تفعيل الحماية حتى ينشئ Core الحساب المخصص ويتحقق منه." : "Protection remains fail-closed until Core creates and verifies the dedicated principal."} />
      ) : (
        <>
          <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-950">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span className="grid size-11 place-items-center rounded-xl bg-cyan-50 text-cyan-700 dark:bg-cyan-950/50 dark:text-cyan-300"><KeyRound className="size-5" aria-hidden="true" /></span>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{isArabic ? "الحساب الثابت" : "Fixed principal"}</p>
                    <p className="mt-1 font-mono text-base font-semibold">{view.binding.databasePrincipal}</p>
                  </div>
                </div>
                <BackupStatusBadge status={view.binding.status} />
              </div>

              <dl className="mt-6 grid gap-4 sm:grid-cols-2">
                {[
                  [isArabic ? "مراجعة الاعتماد" : "Credential revision", view.binding.credentialRevision],
                  [isArabic ? "موعد التدوير" : "Rotation due", formatBackupDate(view.binding.rotationDueAt, isArabic ? "ar-EG" : "en-US")],
                  [isArabic ? "آخر تدوير ناجح" : "Last successful rotation", formatBackupDate(view.binding.lastRotationSucceededAt, isArabic ? "ar-EG" : "en-US")],
                  [isArabic ? "إعادة المحاولة" : "Retry at", formatBackupDate(view.binding.retryAt, isArabic ? "ar-EG" : "en-US")],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-xl bg-slate-50 p-4 dark:bg-slate-900">
                    <dt className="text-xs font-semibold text-slate-500">{label}</dt>
                    <dd className="mt-1 break-all text-sm font-semibold text-slate-900 dark:text-white">{value}</dd>
                  </div>
                ))}
              </dl>
              {view.binding.safeFailureCode ? (
                <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                  {isArabic ? "رمز الفشل الآمن" : "Safe failure code"}: <code>{view.binding.safeFailureCode}</code>
                </div>
              ) : null}
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-950">
              <div className="flex items-center gap-3">
                <ShieldCheck className="size-5 text-cyan-700 dark:text-cyan-300" aria-hidden="true" />
                <h2 className="text-base font-semibold">{isArabic ? "سياسة التدوير" : "Rotation policy"}</h2>
              </div>
              <dl className="mt-5 space-y-3 text-sm">
                <div className="flex justify-between gap-4"><dt className="text-slate-500">{isArabic ? "الحالة" : "Status"}</dt><dd className="font-semibold">{view.binding.rotationEnabled ? (isArabic ? "مفعلة" : "Enabled") : (isArabic ? "متوقفة" : "Disabled")}</dd></div>
                <div className="flex justify-between gap-4"><dt className="text-slate-500">{isArabic ? "الفترة" : "Interval"}</dt><dd className="font-semibold">{view.binding.rotationIntervalHours}h</dd></div>
                <div className="flex justify-between gap-4"><dt className="text-slate-500">{isArabic ? "نافذة الصيانة" : "Maintenance window"}</dt><dd className="font-semibold">UTC {view.binding.maintenanceWindowStartUtc}:00 +{view.binding.maintenanceWindowHours}h</dd></div>
              </dl>
              {view.canUpdatePolicy ? (
                <button type="button" onClick={() => setDialog("policy")} disabled={!view.ownsSelectedServerState || Boolean(view.activeAction)} className="mt-6 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-cyan-700 px-4 text-sm font-semibold text-white hover:bg-cyan-800 disabled:cursor-not-allowed disabled:opacity-50">
                  <Settings2 className="size-4" aria-hidden="true" />{isArabic ? "تعديل السياسة" : "Edit policy"}
                </button>
              ) : null}
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-950">
            <h2 className="text-base font-semibold">{isArabic ? "أوامر الاعتماد" : "Credential commands"}</h2>
            <p className="mt-1 text-sm text-slate-500">{isArabic ? "كل أمر مرتبط بمراجعة متوقعة ويعيد إيصالًا بدون سر." : "Every command is revision-bound and returns a secret-free receipt."}</p>
            <div className="mt-5 flex flex-wrap gap-3">
              {view.canRegenerate ? (
                <button type="button" onClick={() => setDialog("regenerate")} disabled={!view.ownsSelectedServerState || view.binding.status !== "READY" || view.binding.hasStagedCandidate || Boolean(view.activeAction)} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-rose-700 px-4 text-sm font-semibold text-white hover:bg-rose-800 disabled:cursor-not-allowed disabled:opacity-50">
                  <RotateCcw className="size-4" aria-hidden="true" />{isArabic ? "تدوير كلمة المرور" : "Rotate password"}
                </button>
              ) : null}
              {view.canReconcile ? (
                <button type="button" onClick={() => setDialog("reconcile")} disabled={!view.ownsSelectedServerState || Boolean(view.activeAction)} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-300 px-4 text-sm font-semibold hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:hover:bg-slate-900">
                  <RefreshCw className="size-4" aria-hidden="true" />{isArabic ? "مطابقة الاعتماد" : "Reconcile credential"}
                </button>
              ) : null}
            </div>
          </section>
        </>
      )}

      <BackupDialog
        open={dialog === "policy"}
        title={isArabic ? "تعديل سياسة التدوير" : "Edit rotation policy"}
        description={isArabic ? "القيم بالساعات وتطبق على حساب النسخ الاحتياطي فقط." : "Hour-based values apply only to the Backup principal."}
        confirmLabel={isArabic ? "حفظ السياسة" : "Save policy"}
        onClose={closeDialog}
        onConfirm={() => void view.updatePolicy({ rotationEnabled, rotationIntervalHours: intervalHours, maintenanceWindowStartUtc: windowStart, maintenanceWindowHours: windowHours, reason }).then(closeDialog).catch(() => undefined)}
        isSubmitting={view.activeAction === "policy"}
        confirmDisabled={!view.ownsSelectedServerState || reason.trim().length < 8 || intervalHours < 24 || intervalHours > 8760 || windowStart < 0 || windowStart > 23 || windowHours < 1 || windowHours > 24}
      >
        <label className="flex items-center gap-3 text-sm font-semibold"><input type="checkbox" checked={rotationEnabled} onChange={(event) => setRotationEnabled(event.target.checked)} className="size-4" />{isArabic ? "تفعيل التدوير التلقائي" : "Enable automatic rotation"}</label>
        <div className="grid gap-4 sm:grid-cols-3">
          <NumberField label={isArabic ? "الفترة بالساعات" : "Interval hours"} value={intervalHours} min={24} max={8760} onChange={setIntervalHours} />
          <NumberField label={isArabic ? "بداية UTC" : "UTC start"} value={windowStart} min={0} max={23} onChange={setWindowStart} />
          <NumberField label={isArabic ? "مدة النافذة" : "Window hours"} value={windowHours} min={1} max={24} onChange={setWindowHours} />
        </div>
        <ReasonField value={reason} onChange={setReason} isArabic={isArabic} />
      </BackupDialog>

      <BackupDialog
        open={dialog === "regenerate"}
        title={isArabic ? "تدوير كلمة مرور النسخ الاحتياطي" : "Rotate Backup password"}
        description={isArabic ? "ينشئ Core كلمة مرور جديدة دون عرضها. اكتب ROTATE للتأكيد." : "Core generates and adopts a new password without revealing it. Type ROTATE to confirm."}
        confirmLabel={isArabic ? "بدء التدوير" : "Start rotation"}
        onClose={closeDialog}
        onConfirm={() => void view.regenerate(reason).then(closeDialog).catch(() => undefined)}
        isSubmitting={view.activeAction === "regenerate"}
        confirmDisabled={!view.ownsSelectedServerState || reason.trim().length < 8 || confirmation !== "ROTATE"}
        destructive
      >
        <ReasonField value={reason} onChange={setReason} isArabic={isArabic} />
        <TextField label={isArabic ? "نص التأكيد" : "Confirmation text"} value={confirmation} onChange={setConfirmation} placeholder="ROTATE" />
      </BackupDialog>

      <BackupDialog
        open={dialog === "reconcile"}
        title={isArabic ? "مطابقة اعتماد النسخ الاحتياطي" : "Reconcile Backup credential"}
        description={isArabic ? "يتحقق Core من المرشح الحالي ويعيد بناء الحالة الآمنة عند الحاجة." : "Core verifies the exact candidate and repairs safe state when possible."}
        confirmLabel={isArabic ? "بدء المطابقة" : "Start reconciliation"}
        onClose={closeDialog}
        onConfirm={() => void view.reconcile(reason).then(closeDialog).catch(() => undefined)}
        isSubmitting={view.activeAction === "reconcile"}
        confirmDisabled={!view.ownsSelectedServerState || reason.trim().length < 8}
      >
        <ReasonField value={reason} onChange={setReason} isArabic={isArabic} />
      </BackupDialog>
    </div>
  );
}

function NumberField({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (value: number) => void }) {
  return <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">{label}<input type="number" value={value} min={min} max={max} onChange={(event) => onChange(Number(event.target.value))} className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900" /></label>;
}

function TextField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string }) {
  return <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">{label}<input type="text" value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900" /></label>;
}

function ReasonField({ value, onChange, isArabic }: { value: string; onChange: (value: string) => void; isArabic: boolean }) {
  return <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">{isArabic ? "سبب موثق (8 أحرف على الأقل)" : "Audit reason (at least 8 characters)"}<textarea value={value} onChange={(event) => onChange(event.target.value)} maxLength={500} rows={3} className="mt-2 w-full rounded-xl border border-slate-300 bg-white p-3 text-sm dark:border-slate-700 dark:bg-slate-900" /></label>;
}
