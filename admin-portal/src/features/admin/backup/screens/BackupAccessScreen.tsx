"use client";

import { useState } from "react";
import { KeyRound, RefreshCw, RotateCcw, Settings2, ShieldCheck } from "lucide-react";
import { BackupDialog } from "../components/BackupDialog";
import { BackupErrorBanner } from "../components/BackupErrorBanner";
import { BackupPageHeader } from "../components/BackupPageHeader";
import { BackupServerSelect } from "../components/BackupServerSelect";
import { BackupStatePanel } from "../components/BackupStatePanel";
import { useBackupDatabaseAccess } from "../hooks/useBackupDatabaseAccess";
import { formatBackupDate } from "../lib/backup-format";
import { useI18n } from "@/i18n/I18nContext";
import { Card, CardContent, Field, Input, Textarea, Checkbox, Button, StatusBadge } from "@/design-system";

type DialogName = "policy" | "regenerate" | "reconcile" | null;

export function BackupAccessScreen() {
  const { lang, t } = useI18n();
  const copy = t.backup.accessScreen;
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
        title={copy.restrictedTitle}
        description={copy.restrictedDescription}
      />
    );
  }

  return (
    <div className="w-full space-y-6">
      <BackupPageHeader
        eyebrow={copy.eyebrow}
        title={copy.title}
        description={copy.description}
      />

      <Card>
        <CardContent className="grid gap-4 p-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
          <BackupServerSelect
            label={t.backup.policiesScreen.databaseServerLabel}
            value={view.selectedServerId}
            servers={view.servers}
            onChange={view.setSelectedServerId}
            disabled={view.isLoading || Boolean(view.activeAction)}
            placeholder={t.backup.policiesScreen.selectServerPlaceholder}
          />
          <Button type="button" variant="outline" onClick={() => void view.refreshBinding()} disabled={!view.selectedServerId || view.isLoadingBinding}>
            <RefreshCw className={`size-4 ${view.isLoadingBinding ? "animate-spin" : ""}`} />
            {copy.refreshEvidenceButton}
          </Button>
        </CardContent>
      </Card>

      {view.error && <BackupErrorBanner error={view.error} />}

      {view.isLoading || view.isLoadingBinding ? (
        <BackupStatePanel kind="loading" title={copy.loadingTitle} description={copy.loadingDescription} />
      ) : view.error ? null : !view.selectedServerId ? (
        <BackupStatePanel kind="empty" title={copy.noServerTitle} description={copy.noServerDescription} />
      ) : !view.binding ? (
        <BackupStatePanel kind="empty" title={copy.notProvisionedTitle} description={copy.notProvisionedDescription} />
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
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{copy.fixedPrincipalLabel}</p>
                      <p className="mt-1 font-mono text-base font-semibold">{view.binding.databasePrincipal}</p>
                    </div>
                  </div>
                  <StatusBadge status={view.binding.status} />
                </div>

                <dl className="mt-6 grid gap-4 sm:grid-cols-2">
                  {[
                    [copy.credentialRevisionLabel, view.binding.credentialRevision],
                    [copy.rotationDueLabel, formatBackupDate(view.binding.rotationDueAt, lang === "ar" ? "ar-EG" : "en-US")],
                    [copy.lastRotationLabel, formatBackupDate(view.binding.lastRotationSucceededAt, lang === "ar" ? "ar-EG" : "en-US")],
                    [copy.retryAtLabel, formatBackupDate(view.binding.retryAt, lang === "ar" ? "ar-EG" : "en-US")],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-md bg-ink-100 p-4 dark:bg-ink-900/40">
                      <dt className="text-xs font-semibold text-muted-foreground">{label}</dt>
                      <dd className="mt-1 break-all text-sm font-semibold text-foreground">{value}</dd>
                    </div>
                  ))}
                </dl>
                {view.binding.safeFailureCode && (
                  <div className="mt-4 rounded-md border border-warn-200 bg-warn-50 p-4 text-sm text-warn-900 dark:border-warn-800/60 dark:bg-warn-950/30 dark:text-warn-200">
                    {copy.safeFailureCodeLabel}: <code>{view.binding.safeFailureCode}</code>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-5">
                <div className="flex items-center gap-3">
                  <ShieldCheck className="size-5 text-brand-600 dark:text-brand-400" />
                  <h2 className="text-base font-semibold">{copy.rotationPolicyTitle}</h2>
                </div>
                <dl className="mt-5 space-y-3 text-sm">
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">{copy.statusLabel}</dt>
                    <dd className="font-semibold">{view.binding.rotationEnabled ? t.backup.policiesScreen.policyEnabledBadge : t.backup.policiesScreen.policyDisabledBadge}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">{copy.intervalLabel}</dt>
                    <dd className="font-semibold">{view.binding.rotationIntervalHours}h</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">{copy.maintenanceWindowLabel}</dt>
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
                    {copy.editPolicyButton}
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardContent className="p-5">
              <h2 className="text-base font-semibold">{copy.credentialCommandsTitle}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{copy.credentialCommandsDescription}</p>
              <div className="mt-5 flex flex-wrap gap-3">
                {view.canRegenerate && (
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={() => setDialog("regenerate")}
                    disabled={!view.ownsSelectedServerState || view.binding.status !== "READY" || view.binding.hasStagedCandidate || Boolean(view.activeAction)}
                  >
                    <RotateCcw className="size-4" />
                    {copy.rotatePasswordButton}
                  </Button>
                )}
                {view.canReconcile && (
                  <Button type="button" variant="outline" onClick={() => setDialog("reconcile")} disabled={!view.ownsSelectedServerState || Boolean(view.activeAction)}>
                    <RefreshCw className="size-4" />
                    {copy.reconcileCredentialButton}
                  </Button>
                )}
              </div>
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
      >
        <label className="flex items-center gap-3 text-sm font-semibold">
          <Checkbox checked={rotationEnabled} onCheckedChange={(c) => setRotationEnabled(c === true)} />
          {copy.enableAutoRotationLabel}
        </label>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label={copy.intervalHoursLabel}>
            {(fp) => <Input {...fp} type="number" value={intervalHours} min={24} max={8760} onChange={(e) => setIntervalHours(Number(e.target.value))} />}
          </Field>
          <Field label={copy.utcStartLabel}>
            {(fp) => <Input {...fp} type="number" value={windowStart} min={0} max={23} onChange={(e) => setWindowStart(Number(e.target.value))} />}
          </Field>
          <Field label={copy.windowHoursLabel}>
            {(fp) => <Input {...fp} type="number" value={windowHours} min={1} max={24} onChange={(e) => setWindowHours(Number(e.target.value))} />}
          </Field>
        </div>
        <Field label={copy.auditReasonMin8Label}>
          {(fp) => <Textarea {...fp} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} rows={3} />}
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
      >
        <Field label={copy.auditReasonMin8Label}>
          {(fp) => <Textarea {...fp} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} rows={3} />}
        </Field>
        <Field label={copy.confirmationTextLabel}>
          {(fp) => <Input {...fp} value={confirmation} onChange={(e) => setConfirmation(e.target.value)} placeholder="ROTATE" />}
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
      >
        <Field label={copy.auditReasonMin8Label}>
          {(fp) => <Textarea {...fp} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} rows={3} />}
        </Field>
      </BackupDialog>
    </div>
  );
}
