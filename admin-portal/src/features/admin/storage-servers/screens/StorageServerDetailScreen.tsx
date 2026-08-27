"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Ban,
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
} from "lucide-react";
import { DestructiveActionModal } from "@/components/shared/DestructiveActionModal";
import { useToast } from "@/components/ui/ToastContext";
import { useI18n } from "@/i18n/I18nContext";
import { en } from "@/i18n/dictionaries/en";
import { ar } from "@/i18n/dictionaries/ar";
import { useStorageServerDetail } from "../hooks/useStorageServerDetail";
import type { NormalizedApiError } from "@/shared/api/normalized-api-error";
import { isSecureStorageEndpoint, probeFreshnessPercent } from "../lib/storage-server-contract";
import type {
  StorageCredentialRotationView,
  StorageServerView,
  UpdateStorageServerDto,
} from "../types";
import {
  PageHeader,
  Badge,
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Field,
  Input,
  StatusBadge,
  DegradedBanner,
  ErrorState as DsErrorState,
  FormDrawer,
} from "@/design-system";

type Lang = "ar" | "en";
function dict(lang: Lang) {
  return (lang === "ar" ? ar : en).storageServerDetail;
}

export function StorageServerDetailScreen({ id }: { id: string }) {
  const { lang, dir, t } = useI18n();
  const copy = dict(lang);
  const router = useRouter();
  const toast = useToast();
  const view = useStorageServerDetail(id);
  const [editor, setEditor] = useState<"configuration" | "credentials" | "safe-rotation" | null>(null);
  const [confirmation, setConfirmation] = useState<"offline" | "drain" | "delete" | null>(null);
  const BackIcon = dir === "rtl" ? ArrowRight : ArrowLeft;

  useEffect(() => {
    queueMicrotask(() => {
      setEditor(null);
      setConfirmation(null);
    });
  }, [id]);

  if (view.isAuthLoading) return <LoadingState lang={lang} />;
  if (!view.canRead) return <AccessDenied lang={lang} />;
  if (view.isLoading && !view.server) return <LoadingState lang={lang} />;
  if (!view.server) return <NotAvailableState message={view.error} lang={lang} />;
  const server = view.server;

  const run = async (action: () => Promise<unknown>, success: string): Promise<boolean> => {
    try {
      await action();
      toast.success(copy.actionCompletedTitle, success);
      return true;
    } catch (caught) {
      toast.error(copy.actionFailedTitle, readErrorMessage(caught, copy.requestFailedFallback));
      return false;
    }
  };

  const runProbe = async () => {
    try {
      const result = await view.probe();
      if (result.outcome === "PASSED") {
        toast.success(copy.connectionTestPassedTitle, copy.connectionTestPassedDescription);
      } else {
        toast.warning(
          result.outcome === "SKIPPED" ? copy.connectionTestSkippedTitle : copy.connectionTestFailedTitle,
          result.errorCode ?? copy.revisionChangedFallback,
        );
      }
    } catch (caught) {
      toast.error(copy.connectionTestCouldNotRunTitle, readErrorMessage(caught, copy.requestFailedFallback));
    }
  };

  const deleteBlocked = server.isPlatformDefault || server.assignedTenants > 0 || !["DRAFT", "OFFLINE"].includes(server.status);
  const connectionEditBlocked = server.assignedTenants > 0 && server.status !== "OFFLINE";
  const canMakeDefault = server.status === "ACTIVE" && server.connectionEvidenceFresh && !server.isPlatformDefault;

  return (
    <div className="w-full space-y-6">
      <PageHeader
        breadcrumb={
          <Button variant="link" size="sm" asChild className="w-fit px-0">
            <Link href="/storage-servers">
              <BackIcon className="size-4" />
              {copy.backLabel}
            </Link>
          </Button>
        }
        title={server.name}
        description={`${server.code} · ${server.id}`}
        status={
          <>
            <StatusBadge status={server.status} enumType="db-server" />
            {server.isPlatformDefault && <Badge tone="brand">{t.storageServersList.platformDefaultBadge}</Badge>}
          </>
        }
        action={
          view.canUpdate && (
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => void runProbe()} disabled={view.isMutating}>
                <RefreshCw className={`size-4 ${view.isMutating ? "animate-spin" : ""}`} />
                {copy.runConnectionTestButton}
              </Button>
              {["DRAFT", "OFFLINE"].includes(server.status) && (
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={() => void run(view.activate, copy.activationPassedMessage)}
                  disabled={view.isMutating}
                >
                  <Play className="size-4" />
                  {copy.testAndActivateButton}
                </Button>
              )}
              {server.status === "ACTIVE" && !server.isPlatformDefault && (
                <Button type="button" variant="outline" size="sm" onClick={() => setConfirmation("drain")} disabled={view.isMutating}>
                  <Ban className="size-4" />
                  {copy.drainButton}
                </Button>
              )}
              {server.status === "ACTIVE" && !server.isPlatformDefault && (
                <Button type="button" variant="outline" size="sm" onClick={() => setConfirmation("offline")} disabled={view.isMutating}>
                  <StopCircle className="size-4" />
                  {copy.takeOfflineButton}
                </Button>
              )}
            </div>
          )
        }
      />

      {view.error && (
        <DegradedBanner>
          <p className="whitespace-pre-line">{readErrorMessage(view.error, "")}</p>
        </DegradedBanner>
      )}
      {view.lastProbe && <ProbeResultBanner result={view.lastProbe} lang={lang} />}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.55fr)_minmax(320px,0.8fr)]">
        <div className="space-y-6">
          <Panel
            title={copy.serverConfigurationTitle}
            icon={<HardDrive className="size-4" />}
            action={
              view.canUpdate && (
                <Button type="button" variant="ghost" size="sm" onClick={() => setEditor("configuration")}>
                  <Edit3 className="size-3.5" />
                  {copy.editButton}
                </Button>
              )
            }
          >
            <dl className="grid gap-5 sm:grid-cols-2">
              <Datum label={copy.endpointLabel} value={server.endpoint} mono wide />
              <Datum label={copy.regionLabel} value={server.region} mono />
              <Datum label={copy.bucketLabel} value={server.bucketName} mono />
              <Datum label={copy.tenantCapacityLabel} value={`${server.assignedTenants} / ${server.maxTenants ?? "∞"}`} />
              <Datum label={copy.configRevisionLabel} value={`v${server.configRevision}`} mono />
            </dl>
            {connectionEditBlocked && (
              <p className="mt-5 rounded-md border border-warn-200 bg-warn-50 p-3 text-xs leading-5 text-warn-900 dark:border-warn-800/60 dark:bg-warn-950/30 dark:text-warn-200">
                {copy.connectionEditBlockedNote}
              </p>
            )}
          </Panel>

          <Panel
            title={copy.credentialsTitle}
            icon={<KeyRound className="size-4" />}
            action={
              view.canUpdate &&
              (connectionEditBlocked ? (
                <Button type="button" variant="ghost" size="sm" onClick={() => setEditor("safe-rotation")}>
                  <ShieldCheck className="size-3.5" />
                  {copy.safeRotationButton}
                </Button>
              ) : (
                <Button type="button" variant="ghost" size="sm" onClick={() => setEditor("credentials")}>
                  <KeyRound className="size-3.5" />
                  {copy.rotateButton}
                </Button>
              ))
            }
          >
            <div className="flex items-start gap-3 rounded-md border border-brand-200 bg-brand-500/5 p-4 text-brand-900 dark:border-brand-800/60 dark:text-brand-300">
              <ShieldCheck className="mt-0.5 size-5 shrink-0 text-brand-600 dark:text-brand-400" />
              <div>
                <p className="font-semibold">
                  {server.credentialsConfigured ? copy.credentialsConfiguredLabel : copy.credentialsNotConfiguredLabel}
                </p>
                <p className="mt-1 text-xs leading-5">
                  {connectionEditBlocked ? copy.safeRotationRequiredNote : copy.rotationGeneralNote}
                </p>
              </div>
            </div>
            <dl className="mt-4 grid gap-3 text-xs sm:grid-cols-2">
              <DatumRow label={copy.lastRotatedLabel} value={formatDate(server.credentialRotatedAt, lang)} />
              <DatumRow label={copy.rotationDueLabel} value={formatDate(server.credentialRotationDueAt, lang)} />
            </dl>
            {view.currentRotation && (
              <RotationStatusCard
                rotation={view.currentRotation}
                lang={lang}
                isMutating={view.isMutating}
                onRevoke={() =>
                  void run(
                    () => view.revokeCredentialRotation(view.currentRotation!.id),
                    copy.oldKeyRejectedMessage,
                  )
                }
              />
            )}
          </Panel>
        </div>

        <div className="space-y-6">
          <FreshnessPanel server={server} lang={lang} />

          <Panel title={copy.operationalPoliciesTitle} icon={<ShieldCheck className="size-4" />}>
            <div className="space-y-3">
              <PolicyRow label={copy.newPlacementLabel} value={server.status === "ACTIVE" && server.connectionEvidenceFresh ? copy.allowedValue : copy.blockedValue} good={server.status === "ACTIVE" && server.connectionEvidenceFresh} />
              <PolicyRow label={copy.assignedRuntimeLabel} value={copy.unaffectedByProbeValue} good />
              <PolicyRow label={copy.scheduledCheckLabel} value={copy.workerEvery12hValue} good />
            </div>
            {view.canUpdate && !server.isPlatformDefault && (
              <Button
                type="button"
                variant="outline"
                className="mt-5 w-full"
                onClick={() => void run(view.makePlatformDefault, copy.platformDefaultSuccessMessage)}
                disabled={!canMakeDefault || view.isMutating}
                title={!canMakeDefault ? copy.makeDefaultRequirementTitle : undefined}
              >
                <ShieldCheck className="size-4" />
                {copy.makeDefaultButton}
              </Button>
            )}
          </Panel>

          {view.canDelete && (
            <Panel title={copy.dangerZoneTitle} icon={<Trash2 className="size-4" />}>
              <p className="text-xs leading-5 text-muted-foreground">
                {copy.deleteRestrictionNote}
              </p>
              <Button type="button" variant="destructive" className="mt-4 w-full" onClick={() => setConfirmation("delete")} disabled={deleteBlocked || view.isMutating}>
                <Trash2 className="size-4" />
                {copy.deleteServerButton}
              </Button>
            </Panel>
          )}
        </div>
      </div>

      {editor && editor !== "safe-rotation" && (
        <StorageServerEditor
          key={`${editor}:${server.configRevision}:${server.updatedAt}`}
          mode={editor}
          server={server}
          lang={lang}
          connectionEditBlocked={connectionEditBlocked}
          isSubmitting={view.isMutating}
          onClose={() => setEditor(null)}
          onSubmit={async (dto) => {
            await view.update(dto);
            setEditor(null);
            toast.success(copy.savedTitle, copy.savedDescription);
          }}
        />
      )}

      {editor === "safe-rotation" && (
        <SafeRotationEditor
          key={`safe-rotation:${server.configRevision}`}
          lang={lang}
          isSubmitting={view.isMutating}
          onClose={() => setEditor(null)}
          onSubmit={async (credentials, graceHours) => {
            await view.rotateCredentials(credentials, graceHours);
            setEditor(null);
            toast.success(copy.safeRotationStartedTitle, copy.safeRotationStartedDescription);
          }}
        />
      )}

      <DestructiveActionModal
        isOpen={confirmation === "drain"}
        onClose={() => setConfirmation(null)}
        onConfirm={() =>
          void run(view.drain, copy.drainSuccessMessage).then((succeeded) => {
            if (succeeded) setConfirmation(null);
          })
        }
        title={copy.drainModalTitle}
        description={copy.drainModalDescription}
        targetName={server.name}
        actionType="drain"
        requireNameTyping={false}
        isSubmitting={view.isMutating}
      />
      <DestructiveActionModal
        isOpen={confirmation === "offline"}
        onClose={() => setConfirmation(null)}
        onConfirm={() =>
          void run(view.offline, copy.offlineSuccessMessage).then((succeeded) => {
            if (succeeded) setConfirmation(null);
          })
        }
        title={copy.offlineModalTitle}
        description={copy.offlineModalDescription}
        targetName={server.name}
        actionType="offline"
        requireNameTyping={false}
        isSubmitting={view.isMutating}
      />
      <DestructiveActionModal
        isOpen={confirmation === "delete"}
        onClose={() => setConfirmation(null)}
        onConfirm={() =>
          void view
            .remove()
            .then(() => {
              setConfirmation(null);
              router.push("/storage-servers");
            })
            .catch((caught) => toast.error(copy.deleteFailedTitle, readErrorMessage(caught, copy.deleteFailedFallback)))
        }
        title={copy.deleteModalTitle}
        description={copy.deleteModalDescription}
        targetName={server.name}
        actionType="delete"
        requireNameTyping
        isSubmitting={view.isMutating}
      />
    </div>
  );
}

function FreshnessPanel({ server, lang }: { server: StorageServerView; lang: Lang }) {
  const copy = dict(lang);
  const percent = probeFreshnessPercent(server.lastConnectionTestedAt, server.connectionEvidenceExpiresAt);
  const passed = server.lastConnectionTestStatus === "PASSED";
  const fresh = server.connectionEvidenceFresh && passed;
  const barTone = fresh ? "bg-brand-500" : server.lastConnectionTestStatus === "FAILED" ? "bg-danger-500" : "bg-warn-500";
  const badgeTone = fresh ? "bg-brand-500 text-ink-950" : server.lastConnectionTestStatus === "FAILED" ? "bg-danger-500 text-white" : "bg-warn-500 text-ink-950";
  return (
    <Panel title={copy.freshnessTitle} icon={<Clock3 className="size-4" />}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-semibold text-foreground">
            {fresh ? copy.freshLabel : server.lastConnectionTestStatus === "FAILED" ? copy.failedLabel : copy.staleOrUntestedLabel}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{copy.validityWindowNote}</p>
        </div>
        <span className={`grid size-10 place-items-center rounded-full ${badgeTone}`}>
          {fresh ? <CheckCircle2 className="size-5" /> : <AlertCircle className="size-5" />}
        </span>
      </div>
      <div
        className="mt-5 h-2 overflow-hidden rounded-full bg-ink-200 dark:bg-ink-800"
        aria-label={copy.remainingFreshnessAriaLabel}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(percent)}
        role="progressbar"
      >
        <div className={`h-full rounded-full ${barTone}`} style={{ width: `${percent}%` }} />
      </div>
      <dl className="mt-4 space-y-3 text-xs">
        <DatumRow label={copy.lastTestedLabel} value={formatDate(server.lastConnectionTestedAt, lang)} />
        <DatumRow label={copy.evidenceExpiresLabel} value={formatDate(server.connectionEvidenceExpiresAt, lang)} />
        <DatumRow label={copy.automaticCheckDueLabel} value={formatDate(server.nextAutomaticProbeDueAt, lang)} />
        {server.lastConnectionTestErrorCode && <DatumRow label={copy.safeFailureCodeLabel} value={server.lastConnectionTestErrorCode} mono />}
      </dl>
    </Panel>
  );
}

function StorageServerEditor({
  mode,
  server,
  lang,
  connectionEditBlocked,
  isSubmitting,
  onClose,
  onSubmit,
}: {
  mode: "configuration" | "credentials";
  server: StorageServerView;
  lang: Lang;
  connectionEditBlocked: boolean;
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (dto: UpdateStorageServerDto) => Promise<void>;
}) {
  const copy = dict(lang);
  const [name, setName] = useState(server.name);
  const [endpoint, setEndpoint] = useState(server.endpoint);
  const [region, setRegion] = useState(server.region);
  const [bucketName, setBucketName] = useState(server.bucketName);
  const [maxTenants, setMaxTenants] = useState(server.maxTenants?.toString() ?? "");
  const [accessKeyId, setAccessKeyId] = useState("");
  const [secretAccessKey, setSecretAccessKey] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = async (event?: FormEvent) => {
    event?.preventDefault();
    setError(null);
    try {
      if (mode === "credentials") {
        await onSubmit({ credentials: { accessKeyId: accessKeyId.trim(), secretAccessKey } });
        return;
      }
      if (!connectionEditBlocked && !isSecureStorageEndpoint(endpoint.trim())) {
        throw new Error(copy.httpsOnlyError);
      }
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
    } catch (caught) {
      setError(readErrorMessage(caught, copy.saveFailedFallback));
    }
  };

  const title = mode === "credentials" ? copy.rotateCredentialsTitle : copy.editServerTitle;
  const description =
    mode === "credentials"
      ? copy.rotateDescription
      : connectionEditBlocked
        ? copy.connectionLockedDescription
        : copy.connectionChangeDescription;

  return (
    <FormDrawer
      isOpen
      onClose={onClose}
      titleEn={title}
      titleAr={title}
      subtitleEn={description}
      subtitleAr={description}
      isSubmitting={isSubmitting}
      footerActions={
        <>
          <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
            {(lang === "ar" ? ar : en).common.cancel}
          </Button>
          <Button type="submit" form="storage-server-editor-form" variant="primary" loading={isSubmitting}>
            {copy.saveButton}
          </Button>
        </>
      }
    >
      <form id="storage-server-editor-form" onSubmit={submit} className="space-y-4 py-1">
        {error && (
          <div role="alert" className="rounded-md border border-danger-200 bg-danger-50 p-3 text-sm text-danger-900 dark:border-danger-800/60 dark:bg-danger-950/30 dark:text-danger-200">
            {error}
          </div>
        )}
        {mode === "credentials" ? (
          <>
            <Field label={copy.accessKeyIdLabel}>
              {(fp) => <Input {...fp} required minLength={3} maxLength={128} autoComplete="off" value={accessKeyId} onChange={(e) => setAccessKeyId(e.target.value)} className="font-mono" />}
            </Field>
            <Field label={copy.secretAccessKeyLabel}>
              {(fp) => <Input {...fp} required type="password" minLength={16} maxLength={256} autoComplete="new-password" value={secretAccessKey} onChange={(e) => setSecretAccessKey(e.target.value)} className="font-mono" />}
            </Field>
          </>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={copy.nameLabel}>
              {(fp) => <Input {...fp} required maxLength={120} value={name} onChange={(e) => setName(e.target.value)} />}
            </Field>
            <Field label={copy.maxTenantsLabel}>
              {(fp) => <Input {...fp} type="number" min={Math.max(1, server.assignedTenants)} max={1_000_000} value={maxTenants} onChange={(e) => setMaxTenants(e.target.value)} />}
            </Field>
            <Field label={copy.endpointLabel} className="sm:col-span-2">
              {(fp) => <Input {...fp} required disabled={connectionEditBlocked} type="url" value={endpoint} onChange={(e) => setEndpoint(e.target.value)} className="font-mono" />}
            </Field>
            <Field label={copy.regionLabel}>
              {(fp) => <Input {...fp} required disabled={connectionEditBlocked} value={region} onChange={(e) => setRegion(e.target.value)} className="font-mono" />}
            </Field>
            <Field label={copy.bucketLabel}>
              {(fp) => <Input {...fp} required disabled={connectionEditBlocked} value={bucketName} onChange={(e) => setBucketName(e.target.value)} className="font-mono" />}
            </Field>
          </div>
        )}
      </form>
    </FormDrawer>
  );
}

function SafeRotationEditor({
  lang,
  isSubmitting,
  onClose,
  onSubmit,
}: {
  lang: Lang;
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (credentials: { accessKeyId: string; secretAccessKey: string }, graceHours: number) => Promise<void>;
}) {
  const copy = dict(lang);
  const [accessKeyId, setAccessKeyId] = useState("");
  const [secretAccessKey, setSecretAccessKey] = useState("");
  const [graceHours, setGraceHours] = useState("4");
  const [error, setError] = useState<string | null>(null);

  const submit = async (event?: FormEvent) => {
    event?.preventDefault();
    setError(null);
    try {
      const hours = Number(graceHours);
      if (!Number.isInteger(hours) || hours < 1 || hours > 24) {
        throw new Error(copy.graceWindowRangeError);
      }
      await onSubmit({ accessKeyId: accessKeyId.trim(), secretAccessKey }, hours);
    } catch (caught) {
      setError(readErrorMessage(caught, copy.rotationStartFailedFallback));
    }
  };

  const title = copy.safeRotationEditorTitle;
  const description = copy.safeRotationEditorDescription;

  return (
    <FormDrawer
      isOpen
      onClose={onClose}
      titleEn={title}
      titleAr={title}
      subtitleEn={description}
      subtitleAr={description}
      isSubmitting={isSubmitting}
      footerActions={
        <>
          <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
            {(lang === "ar" ? ar : en).common.cancel}
          </Button>
          <Button type="submit" form="safe-rotation-form" variant="primary" loading={isSubmitting}>
            {copy.startRotationButton}
          </Button>
        </>
      }
    >
      <form id="safe-rotation-form" onSubmit={submit} className="space-y-4 py-1">
        {error && (
          <div role="alert" className="rounded-md border border-danger-200 bg-danger-50 p-3 text-sm text-danger-900 dark:border-danger-800/60 dark:bg-danger-950/30 dark:text-danger-200">
            {error}
          </div>
        )}
        <Field label={copy.newAccessKeyIdLabel}>
          {(fp) => <Input {...fp} required minLength={3} maxLength={128} autoComplete="off" value={accessKeyId} onChange={(e) => setAccessKeyId(e.target.value)} className="font-mono" />}
        </Field>
        <Field label={copy.newSecretAccessKeyLabel}>
          {(fp) => <Input {...fp} required type="password" minLength={16} maxLength={256} autoComplete="new-password" value={secretAccessKey} onChange={(e) => setSecretAccessKey(e.target.value)} className="font-mono" />}
        </Field>
        <Field label={copy.graceWindowLabel} hint={copy.graceWindowHint}>
          {(fp) => <Input {...fp} required type="number" min={1} max={24} value={graceHours} onChange={(e) => setGraceHours(e.target.value)} />}
        </Field>
      </form>
    </FormDrawer>
  );
}

function RotationStatusCard({
  rotation,
  lang,
  isMutating,
  onRevoke,
}: {
  rotation: StorageCredentialRotationView;
  lang: Lang;
  isMutating: boolean;
  onRevoke: () => void;
}) {
  const copy = dict(lang);
  const [graceExpired, setGraceExpired] = useState(false);
  useEffect(() => {
    const expiresAtIso = rotation.graceExpiresAt;
    const expiresAt = expiresAtIso ? new Date(expiresAtIso).getTime() : null;
    // Deferred through setTimeout (even at 0ms) rather than called
    // synchronously in the effect body, so this never fires during the
    // commit React is currently processing — including the "already
    // expired" case, which still waits one macrotask.
    const remaining = expiresAt !== null ? Math.max(0, expiresAt - Date.now()) : 0;
    const timer = window.setTimeout(() => {
      setGraceExpired(expiresAt !== null && Date.now() >= expiresAt);
    }, remaining);
    return () => window.clearTimeout(timer);
  }, [rotation.graceExpiresAt]);
  const canRevoke = rotation.status === "ACTIVATED" && graceExpired;
  return (
    <div className="mt-4 rounded-md border border-border bg-muted/40 p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {copy.currentRotationLabel}
        </span>
        <StatusBadge status={rotation.status} />
      </div>
      <dl className="mt-3 space-y-2 text-xs">
        <DatumRow label={copy.graceExpiresLabel} value={formatDate(rotation.graceExpiresAt, lang)} />
        {rotation.revokedAt && <DatumRow label={copy.revokedAtLabel} value={formatDate(rotation.revokedAt, lang)} />}
      </dl>
      {rotation.status === "ACTIVATED" && (
        <>
          <p className="mt-3 text-xs leading-5 text-muted-foreground">
            {copy.rotationIdWarning}
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-3 w-full"
            onClick={onRevoke}
            disabled={!canRevoke || isMutating}
            title={!graceExpired ? copy.waitForGraceTitle : undefined}
          >
            <ShieldCheck className="size-4" />
            {copy.verifyOldKeyButton}
          </Button>
        </>
      )}
    </div>
  );
}

function ProbeResultBanner({ result, lang }: { result: { outcome: string; errorCode: string | null; lifecycleStatus: string }; lang: Lang }) {
  const copy = dict(lang);
  const passed = result.outcome === "PASSED";
  return (
    <section
      role="status"
      className={`rounded-lg border p-4 text-sm ${passed ? "border-brand-200 bg-brand-500/5 text-brand-900 dark:border-brand-800/60 dark:text-brand-300" : "border-danger-200 bg-danger-50 text-danger-900 dark:border-danger-800/60 dark:bg-danger-950/30 dark:text-danger-200"}`}
    >
      <p className="font-semibold">{passed ? copy.connectionTestPassedTitle : copy.connectionTestFailedTitle}</p>
      <p className="mt-1 text-xs">
        {copy.lifecycleUnchangedTemplate(result.lifecycleStatus)}
        {result.errorCode ? ` · ${result.errorCode}` : ""}
      </p>
    </section>
  );
}

function Panel({ title, icon, action, children }: { title: string; icon: ReactNode; action?: ReactNode; children: ReactNode }) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-sm">
          <span className="text-brand-600 dark:text-brand-400">{icon}</span>
          {title}
        </CardTitle>
        {action}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function Datum({ label, value, mono, wide }: { label: string; value: string; mono?: boolean; wide?: boolean }) {
  return (
    <div className={wide ? "sm:col-span-2" : ""}>
      <dt className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className={`mt-2 break-all text-sm font-semibold text-foreground ${mono ? "font-mono" : ""}`}>{value}</dd>
    </div>
  );
}
function DatumRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={`text-end font-semibold text-foreground ${mono ? "break-all font-mono" : ""}`}>{value}</dd>
    </div>
  );
}
function PolicyRow({ label, value, good }: { label: string; value: string; good: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-md bg-ink-100 p-3 text-xs dark:bg-ink-900/40">
      <span className="text-muted-foreground">{label}</span>
      <span className={`text-end font-semibold ${good ? "text-brand-700 dark:text-brand-400" : "text-warn-700 dark:text-warn-400"}`}>{value}</span>
    </div>
  );
}
function AccessDenied({ lang }: { lang: Lang }) {
  const copy = (lang === "ar" ? ar : en).storageServersList;
  return (
    <div className="mx-auto max-w-xl rounded-lg border border-border bg-card">
      <DsErrorState
        title={copy.accessDeniedTitle}
        error={{ isNormalized: true, httpStatus: 403, errorCode: "ADMIN_PERMISSION_DENIED", errorCategory: "AUTHORIZATION", message: "" }}
      />
    </div>
  );
}
function LoadingState({ lang }: { lang: Lang }) {
  const copy = dict(lang);
  return (
    <div className="grid min-h-80 place-items-center text-sm font-semibold text-muted-foreground">
      <span className="flex items-center gap-2">
        <Loader2 className="size-5 animate-spin" />
        {copy.loadingServerLabel}
      </span>
    </div>
  );
}
function NotAvailableState({ message, lang }: { message: NormalizedApiError | null; lang: Lang }) {
  const copy = dict(lang);
  return (
    <div className="mx-auto max-w-xl rounded-lg border border-border bg-card">
      <DsErrorState title={copy.unavailableTitle} error={message} />
      <div className="flex justify-center pb-6">
        <Button variant="outline" size="sm" asChild>
          <Link href="/storage-servers">{copy.backLabel}</Link>
        </Button>
      </div>
    </div>
  );
}
function formatDate(value: string | null, lang: Lang) {
  const copy = dict(lang);
  if (!value) return copy.notAvailableValue;
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat(lang === "ar" ? "ar-EG-u-nu-latn" : "en-US", { year: "numeric", month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "UTC", timeZoneName: "short" }).format(date);
}

function readErrorMessage(value: unknown, fallback: string): string {
  if (typeof value !== "object" || value === null) return fallback;
  const candidate = value as { message?: unknown; correlationId?: unknown };
  const message = typeof candidate.message === "string" ? candidate.message : fallback;
  return typeof candidate.correlationId === "string" ? `${message}\nCorrelation ID: ${candidate.correlationId}` : message;
}
