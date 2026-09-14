"use client";

import { useState } from "react";
import { KeyRound, RefreshCw, RotateCcw, Settings2, ShieldCheck } from "lucide-react";
import { BackupDialog } from "../components/BackupDialog";
import { BackupErrorBanner } from "../components/BackupErrorBanner";
import { BackupPageHeader } from "../components/BackupPageHeader";
import { BackupServerSelect } from "../components/BackupServerSelect";
import { BackupStatePanel } from "../components/BackupStatePanel";
import { useBackupDatabaseAccess } from "../hooks/useBackupDatabaseAccess";
import { formatBackupDate, formatBackupNumber } from "../lib/backup-format";
import { useI18n } from "@/i18n/I18nContext";
import { Card, CardContent, Field, Input, Textarea, Checkbox, Button, CodeRef, StatusBadge } from "@/design-system";

type DialogName = "policy" | "regenerate" | "reconcile" | null;

export function BackupAccessScreen() {
  const { lang, t } = useI18n();
  const copy = t.backup.accessScreen;
  const locale = lang === "ar" ? "ar-EG" : "en-US";
  const view = useBackupDatabaseAccess();
  const [dialog, setDialog] = useState<DialogName>(null);
  const [reason, setReason] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [rotationEnabled, setRotationEnabled] = useState(false);
  const [intervalHours, setIntervalHours] = useState(720);
  const [windowStart, setWindowStart] = useState(0);
  const [windowHours, setWindowHours] = useState(1);

  const openPolicyDialog = () => {
    if (!view.binding) return;
    setRotationEnabled(view.binding.rotationEnabled);
    setIntervalHours(view.binding.rotationIntervalHours);
    setWindowStart(view.binding.maintenanceWindowStartUtc);
    setWindowHours(view.binding.maintenanceWindowHours);
    setReason("");
    setConfirmation("");
    setDialog("policy");
  };

  const closeDialog = () => {
    if (view.activeAction) return;
    setDialog(null);
    setReason("");
    setConfirmation("");
  };
  const reasonError = reason.trim().length < 8
    ? lang === "ar" ? "أدخل سبباً موثقاً من 8 أحرف على الأقل." : "Enter an audit reason of at least 8 characters."
    : undefined;
  const intervalError = intervalHours < 24 || intervalHours > 8760
    ? lang === "ar" ? "يجب أن تكون الفترة بين 24 و8760 ساعة." : "Interval must be between 24 and 8760 hours."
    : undefined;
  const windowStartError = windowStart < 0 || windowStart > 23
    ? lang === "ar" ? "يجب أن تكون بداية UTC بين 0 و23." : "UTC start must be between 0 and 23."
    : undefined;
  const windowHoursError = windowHours < 1 || windowHours > 24
    ? lang === "ar" ? "يجب أن تكون مدة النافذة بين 1 و24 ساعة." : "Window length must be between 1 and 24 hours."
    : undefined;

  if (!view.canRead) {
    return (
      <BackupStatePanel
        kind="forbidden"
        title={copy.restrictedTitle}
        description={copy.restrictedDescription}
      />
    );
  }

  return (
    <div className="w-full space-y-3">
      <BackupPageHeader
        eyebrow={copy.eyebrow}
        title={copy.title}
      />

      <Card>
        <CardContent className="grid gap-2.5 p-3 sm:p-3.5 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
          <BackupServerSelect
            label={t.backup.policiesScreen.databaseServerLabel}
            value={view.selectedServerId}
            servers={view.servers}
            onChange={view.setSelectedServerId}
            disabled={view.isLoading || Boolean(view.activeAction)}
            placeholder={t.backup.policiesScreen.selectServerPlaceholder}
            required
          />
          <Button type="button" variant="outline" size="sm" onClick={() => void view.refreshBinding()} disabled={!view.selectedServerId || view.isLoadingBinding} loading={view.isLoadingBinding}>
            {!view.isLoadingBinding && <RefreshCw className="size-3.5" aria-hidden="true" />}
            {copy.refreshEvidenceButton}
          </Button>
        </CardContent>
      </Card>

      {view.error && !dialog && <BackupErrorBanner error={view.error} />}

      {view.isLoading || view.isLoadingBinding ? (
        <BackupStatePanel kind="loading" title={copy.loadingTitle} description={copy.loadingDescription} />
      ) : !view.selectedServerId ? (
        view.error ? null : <BackupStatePanel kind="empty" title={copy.noServerTitle} description={copy.noServerDescription} />
      ) : !view.binding ? (
        view.error ? null : <BackupStatePanel kind="empty" title={copy.notProvisionedTitle} description={copy.notProvisionedDescription} />
      ) : (
        <>
          <div className="grid gap-3 lg:grid-cols-[1.2fr_0.8fr]">
            <Card>
              <CardContent className="p-3 sm:p-3.5">
                <div className="flex flex-col items-start justify-between gap-3 sm:flex-row">
                  <div className="flex items-center gap-2.5">
                    <span className="grid size-9 place-items-center rounded-md bg-info-subtle text-info-subtle-foreground">
                      <KeyRound className="size-4" aria-hidden="true" />
                    </span>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground rtl:normal-case rtl:tracking-normal">{copy.fixedPrincipalLabel}</p>
                      <p dir="ltr" className="mt-0.5 break-all font-mono text-xs font-semibold">{view.binding.databasePrincipal}</p>
                    </div>
                  </div>
                  <StatusBadge status={view.binding.status} />
                </div>

                <dl className="mt-3 grid gap-2.5 sm:grid-cols-2">
                  {[
                    [copy.credentialRevisionLabel, view.binding.credentialRevision],
                    [copy.rotationDueLabel, formatBackupDate(view.binding.rotationDueAt, locale)],
                    [copy.lastRotationLabel, formatBackupDate(view.binding.lastRotationSucceededAt, locale)],
                    [copy.retryAtLabel, formatBackupDate(view.binding.retryAt, locale)],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-md bg-muted p-2.5">
                      <dt className="text-xs font-semibold text-muted-foreground">{label}</dt>
                      <dd dir={label === copy.credentialRevisionLabel ? "ltr" : undefined} className="mt-0.5 break-all text-xs font-semibold text-foreground">{value}</dd>
                    </div>
                  ))}
                </dl>
                {view.binding.safeFailureCode && (
                  <div className="mt-3 flex flex-wrap items-center gap-2 rounded-md border border-warning/30 bg-warning-subtle p-2.5 text-xs text-warning-subtle-foreground">
                    <span>{copy.safeFailureCodeLabel}:</span> <CodeRef value={view.binding.safeFailureCode} />
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-3 sm:p-3.5">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="size-4 text-info" aria-hidden="true" />
                  <h2 className="text-xs font-semibold">{copy.rotationPolicyTitle}</h2>
                </div>
                <dl className="mt-3 space-y-2 text-xs">
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">{copy.statusLabel}</dt>
                    <dd className="font-semibold">{view.binding.rotationEnabled ? t.backup.policiesScreen.policyEnabledBadge : t.backup.policiesScreen.policyDisabledBadge}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">{copy.intervalLabel}</dt>
                    <dd className="font-semibold"><bdi>{formatBackupNumber(view.binding.rotationIntervalHours, locale)}</bdi>{lang === "ar" ? " س" : "h"}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">{copy.maintenanceWindowLabel}</dt>
                    <dd dir="ltr" className="font-semibold">UTC {view.binding.maintenanceWindowStartUtc}:00 +{view.binding.maintenanceWindowHours}h</dd>
                  </div>
                </dl>
                {view.canUpdatePolicy && (
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    className="mt-4 w-full"
                    onClick={openPolicyDialog}
                    disabled={!view.ownsSelectedServerState || Boolean(view.activeAction)}
                    loading={view.activeAction === "policy"}
                  >
                    {view.activeAction !== "policy" && <Settings2 className="size-3.5" aria-hidden="true" />}
                    {copy.editPolicyButton}
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardContent className="p-3 sm:p-3.5">
              <h2 className="text-xs font-semibold">{copy.credentialCommandsTitle}</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">{copy.credentialCommandsDescription}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {view.canRegenerate && (
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={() => setDialog("regenerate")}
                    disabled={!view.ownsSelectedServerState || view.binding.status !== "READY" || view.binding.hasStagedCandidate || Boolean(view.activeAction)}
                    loading={view.activeAction === "regenerate"}
                  >
                    {view.activeAction !== "regenerate" && <RotateCcw className="size-3.5" aria-hidden="true" />}
                    {copy.rotatePasswordButton}
                  </Button>
                )}
                {view.canReconcile && (
                  <Button type="button" variant="outline" size="sm" onClick={() => setDialog("reconcile")} disabled={!view.ownsSelectedServerState || Boolean(view.activeAction)} loading={view.activeAction === "reconcile"}>
                    {view.activeAction !== "reconcile" && <RefreshCw className="size-3.5" aria-hidden="true" />}
                    {copy.reconcileCredentialButton}
                  </Button>
                )}
              </div>
              {view.canRegenerate && (view.binding.status !== "READY" || view.binding.hasStagedCandidate) && (
                <p className="mt-2 text-xs text-warning-subtle-foreground">
                  {lang === "ar"
                    ? view.binding.hasStagedCandidate ? "يجب مطابقة المرشح المرحلي قبل بدء تدوير جديد." : "يتطلب التدوير حالة READY مؤكدة من Core."
                    : view.binding.hasStagedCandidate ? "Reconcile the staged candidate before starting another rotation." : "Rotation requires the exact READY state from Core."}
                </p>
              )}
            </CardContent>
          </Card>
        </>
      )}

      <BackupDialog
        open={dialog === "policy"}
        title={copy.editPolicyDialogTitle}
        description={copy.editPolicyDialogDescription}
        confirmLabel={t.backup.policiesScreen.savePolicyButton}
        onClose={closeDialog}
        onConfirm={() =>
          void view
            .updatePolicy({ rotationEnabled, rotationIntervalHours: intervalHours, maintenanceWindowStartUtc: windowStart, maintenanceWindowHours: windowHours, reason })
            .then(closeDialog)
            .catch(() => undefined)
        }
        isSubmitting={view.activeAction === "policy"}
        confirmDisabled={!view.ownsSelectedServerState || reason.trim().length < 8 || intervalHours < 24 || intervalHours > 8760 || windowStart < 0 || windowStart > 23 || windowHours < 1 || windowHours > 24}
        error={view.error}
      >
        <label htmlFor="backup-rotation-enabled" className="flex min-h-8 items-center gap-2 rounded-md border border-border px-2.5 text-xs font-semibold">
          <Checkbox id="backup-rotation-enabled" checked={rotationEnabled} onCheckedChange={(c) => setRotationEnabled(c === true)} />
          {copy.enableAutoRotationLabel}
        </label>
        <div className="grid gap-2.5 sm:grid-cols-3">
          <Field label={copy.intervalHoursLabel} hideLabel error={intervalError} required>
            {(fp) => <Input {...fp} size="sm" className="text-xs" dir="ltr" type="number" placeholder={`${copy.intervalHoursLabel} *`} value={intervalHours} min={24} max={8760} onChange={(e) => setIntervalHours(Number(e.target.value))} />}
          </Field>
          <Field label={copy.utcStartLabel} hideLabel error={windowStartError} required>
            {(fp) => <Input {...fp} size="sm" className="text-xs" dir="ltr" type="number" placeholder={`${copy.utcStartLabel} *`} value={windowStart} min={0} max={23} onChange={(e) => setWindowStart(Number(e.target.value))} />}
          </Field>
          <Field label={copy.windowHoursLabel} hideLabel error={windowHoursError} required>
            {(fp) => <Input {...fp} size="sm" className="text-xs" dir="ltr" type="number" placeholder={`${copy.windowHoursLabel} *`} value={windowHours} min={1} max={24} onChange={(e) => setWindowHours(Number(e.target.value))} />}
          </Field>
        </div>
        <Field label={copy.auditReasonMin8Label} hideLabel error={reasonError} required>
          {(fp) => <Textarea {...fp} className="text-xs" placeholder={`${copy.auditReasonMin8Label} *`} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} rows={2} />}
        </Field>
      </BackupDialog>

      <BackupDialog
        open={dialog === "regenerate"}
        title={copy.rotateDialogTitle}
        description={copy.rotateDialogDescription}
        confirmLabel={copy.startRotationButton}
        onClose={closeDialog}
        onConfirm={() => void view.regenerate(reason).then(closeDialog).catch(() => undefined)}
        isSubmitting={view.activeAction === "regenerate"}
        confirmDisabled={!view.ownsSelectedServerState || reason.trim().length < 8 || confirmation !== "ROTATE"}
        destructive
        error={view.error}
      >
        <Field label={copy.auditReasonMin8Label} hideLabel error={reasonError} required>
          {(fp) => <Textarea {...fp} className="text-xs" placeholder={`${copy.auditReasonMin8Label} *`} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} rows={2} />}
        </Field>
        <Field label={copy.confirmationTextLabel} hideLabel error={confirmation !== "ROTATE" ? (lang === "ar" ? "اكتب ROTATE تماماً للتأكيد." : "Type ROTATE exactly to confirm.") : undefined} required>
          {(fp) => <Input {...fp} size="sm" className="text-xs" dir="ltr" value={confirmation} onChange={(e) => setConfirmation(e.target.value)} placeholder={`${copy.confirmationTextLabel} * (ROTATE)`} />}
        </Field>
      </BackupDialog>

      <BackupDialog
        open={dialog === "reconcile"}
        title={copy.reconcileDialogTitle}
        description={copy.reconcileDialogDescription}
        confirmLabel={copy.startReconciliationButton}
        onClose={closeDialog}
        onConfirm={() => void view.reconcile(reason).then(closeDialog).catch(() => undefined)}
        isSubmitting={view.activeAction === "reconcile"}
        confirmDisabled={!view.ownsSelectedServerState || reason.trim().length < 8}
        error={view.error}
      >
        <Field label={copy.auditReasonMin8Label} hideLabel error={reasonError} required>
          {(fp) => <Textarea {...fp} className="text-xs" placeholder={`${copy.auditReasonMin8Label} *`} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} rows={2} />}
        </Field>
      </BackupDialog>
    </div>
  );
}
