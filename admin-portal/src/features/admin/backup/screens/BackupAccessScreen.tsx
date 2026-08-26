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
import { Card, CardContent, Field, Input, Textarea, Checkbox, Button } from "@/design-system";

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
        description={
          isArabic
            ? "تحتاج إلى admin.database_servers.read. صلاحيات النسخ الاحتياطي وحدها لا تكشف حالة بيانات اعتماد Core."
            : "This view requires admin.database_servers.read. Backup permissions alone do not expose Core credential state."
        }
      />
    );
  }

  return (
    <div className="w-full space-y-6">
      <BackupPageHeader
        eyebrow={isArabic ? "حد أمان Core" : "Core security boundary"}
        title={isArabic ? "صلاحية قاعدة بيانات النسخ الاحتياطي" : "Backup database access"}
        description={
          isArabic
            ? "إدارة الحساب الثابت وسياسة تدوير كلمة المرور. كلمات المرور لا تظهر ولا تنتقل إلى المتصفح."
            : "Manage the fixed Backup principal and its password-rotation policy. Passwords are never returned to the browser."
        }
      />

      <Card>
        <CardContent className="grid gap-4 p-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
          <BackupServerSelect
            label={isArabic ? "خادم قاعدة البيانات" : "Database server"}
            value={view.selectedServerId}
            servers={view.servers}
            onChange={view.setSelectedServerId}
            disabled={view.isLoading || Boolean(view.activeAction)}
            placeholder={isArabic ? "اختر خادم قاعدة بيانات" : "Select a database server"}
          />
          <Button type="button" variant="outline" onClick={() => void view.refreshBinding()} disabled={!view.selectedServerId || view.isLoadingBinding}>
            <RefreshCw className={`size-4 ${view.isLoadingBinding ? "animate-spin" : ""}`} />
            {isArabic ? "تحديث الدليل" : "Refresh evidence"}
          </Button>
        </CardContent>
      </Card>

      {view.error && <BackupErrorBanner error={view.error} />}

      {view.isLoading || view.isLoadingBinding ? (
        <BackupStatePanel kind="loading" title={isArabic ? "جارٍ تحميل الحساب" : "Loading database access"} description={isArabic ? "قراءة دليل آمن بدون أسرار من Core." : "Reading secret-free evidence from Core."} />
      ) : view.error ? null : !view.selectedServerId ? (
        <BackupStatePanel kind="empty" title={isArabic ? "لا يوجد خادم محدد" : "No server selected"} description={isArabic ? "اختر خادمًا لعرض حساب النسخ الاحتياطي." : "Choose a server to inspect its Backup principal."} />
      ) : !view.binding ? (
        <BackupStatePanel kind="empty" title={isArabic ? "حساب النسخ الاحتياطي غير موجود" : "Backup principal is not provisioned"} description={isArabic ? "لا يمكن تفعيل الحماية حتى ينشئ Core الحساب المخصص ويتحقق منه." : "Protection remains fail-closed until Core creates and verifies the dedicated principal."} />
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <Card>
              <CardContent className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <span className="grid size-11 place-items-center rounded-md bg-brand-500/10 text-brand-700 dark:text-brand-400">
                      <KeyRound className="size-5" />
                    </span>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{isArabic ? "الحساب الثابت" : "Fixed principal"}</p>
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
                    <div key={label} className="rounded-md bg-ink-100 p-4 dark:bg-ink-900/40">
                      <dt className="text-xs font-semibold text-muted-foreground">{label}</dt>
                      <dd className="mt-1 break-all text-sm font-semibold text-foreground">{value}</dd>
                    </div>
                  ))}
                </dl>
                {view.binding.safeFailureCode && (
                  <div className="mt-4 rounded-md border border-warn-200 bg-warn-50 p-4 text-sm text-warn-900 dark:border-warn-800/60 dark:bg-warn-950/30 dark:text-warn-200">
                    {isArabic ? "رمز الفشل الآمن" : "Safe failure code"}: <code>{view.binding.safeFailureCode}</code>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-5">
                <div className="flex items-center gap-3">
                  <ShieldCheck className="size-5 text-brand-600 dark:text-brand-400" />
                  <h2 className="text-base font-semibold">{isArabic ? "سياسة التدوير" : "Rotation policy"}</h2>
                </div>
                <dl className="mt-5 space-y-3 text-sm">
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">{isArabic ? "الحالة" : "Status"}</dt>
                    <dd className="font-semibold">{view.binding.rotationEnabled ? (isArabic ? "مفعلة" : "Enabled") : isArabic ? "متوقفة" : "Disabled"}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">{isArabic ? "الفترة" : "Interval"}</dt>
                    <dd className="font-semibold">{view.binding.rotationIntervalHours}h</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">{isArabic ? "نافذة الصيانة" : "Maintenance window"}</dt>
                    <dd className="font-semibold">UTC {view.binding.maintenanceWindowStartUtc}:00 +{view.binding.maintenanceWindowHours}h</dd>
                  </div>
                </dl>
                {view.canUpdatePolicy && (
                  <Button
                    type="button"
                    variant="primary"
                    className="mt-6 w-full"
                    onClick={() => setDialog("policy")}
                    disabled={!view.ownsSelectedServerState || Boolean(view.activeAction)}
                  >
                    <Settings2 className="size-4" />
                    {isArabic ? "تعديل السياسة" : "Edit policy"}
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardContent className="p-5">
              <h2 className="text-base font-semibold">{isArabic ? "أوامر الاعتماد" : "Credential commands"}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{isArabic ? "كل أمر مرتبط بمراجعة متوقعة ويعيد إيصالًا بدون سر." : "Every command is revision-bound and returns a secret-free receipt."}</p>
              <div className="mt-5 flex flex-wrap gap-3">
                {view.canRegenerate && (
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={() => setDialog("regenerate")}
                    disabled={!view.ownsSelectedServerState || view.binding.status !== "READY" || view.binding.hasStagedCandidate || Boolean(view.activeAction)}
                  >
                    <RotateCcw className="size-4" />
                    {isArabic ? "تدوير كلمة المرور" : "Rotate password"}
                  </Button>
                )}
                {view.canReconcile && (
                  <Button type="button" variant="outline" onClick={() => setDialog("reconcile")} disabled={!view.ownsSelectedServerState || Boolean(view.activeAction)}>
                    <RefreshCw className="size-4" />
                    {isArabic ? "مطابقة الاعتماد" : "Reconcile credential"}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </>
      )}

      <BackupDialog
        open={dialog === "policy"}
        title={isArabic ? "تعديل سياسة التدوير" : "Edit rotation policy"}
        description={isArabic ? "القيم بالساعات وتطبق على حساب النسخ الاحتياطي فقط." : "Hour-based values apply only to the Backup principal."}
        confirmLabel={isArabic ? "حفظ السياسة" : "Save policy"}
        onClose={closeDialog}
        onConfirm={() =>
          void view
            .updatePolicy({ rotationEnabled, rotationIntervalHours: intervalHours, maintenanceWindowStartUtc: windowStart, maintenanceWindowHours: windowHours, reason })
            .then(closeDialog)
            .catch(() => undefined)
        }
        isSubmitting={view.activeAction === "policy"}
        confirmDisabled={!view.ownsSelectedServerState || reason.trim().length < 8 || intervalHours < 24 || intervalHours > 8760 || windowStart < 0 || windowStart > 23 || windowHours < 1 || windowHours > 24}
      >
        <label className="flex items-center gap-3 text-sm font-semibold">
          <Checkbox checked={rotationEnabled} onCheckedChange={(c) => setRotationEnabled(c === true)} />
          {isArabic ? "تفعيل التدوير التلقائي" : "Enable automatic rotation"}
        </label>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label={isArabic ? "الفترة بالساعات" : "Interval hours"}>
            {(fp) => <Input {...fp} type="number" value={intervalHours} min={24} max={8760} onChange={(e) => setIntervalHours(Number(e.target.value))} />}
          </Field>
          <Field label={isArabic ? "بداية UTC" : "UTC start"}>
            {(fp) => <Input {...fp} type="number" value={windowStart} min={0} max={23} onChange={(e) => setWindowStart(Number(e.target.value))} />}
          </Field>
          <Field label={isArabic ? "مدة النافذة" : "Window hours"}>
            {(fp) => <Input {...fp} type="number" value={windowHours} min={1} max={24} onChange={(e) => setWindowHours(Number(e.target.value))} />}
          </Field>
        </div>
        <Field label={isArabic ? "سبب موثق (8 أحرف على الأقل)" : "Audit reason (at least 8 characters)"}>
          {(fp) => <Textarea {...fp} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} rows={3} />}
        </Field>
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
        <Field label={isArabic ? "سبب موثق (8 أحرف على الأقل)" : "Audit reason (at least 8 characters)"}>
          {(fp) => <Textarea {...fp} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} rows={3} />}
        </Field>
        <Field label={isArabic ? "نص التأكيد" : "Confirmation text"}>
          {(fp) => <Input {...fp} value={confirmation} onChange={(e) => setConfirmation(e.target.value)} placeholder="ROTATE" />}
        </Field>
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
        <Field label={isArabic ? "سبب موثق (8 أحرف على الأقل)" : "Audit reason (at least 8 characters)"}>
          {(fp) => <Textarea {...fp} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} rows={3} />}
        </Field>
      </BackupDialog>
    </div>
  );
}
