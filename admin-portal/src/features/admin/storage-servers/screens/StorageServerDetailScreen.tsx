"use client";

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
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
import type { StorageCredentialRotationReceipt } from "../lib/rotation-receipt";
import type {
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
  CodeRef,
} from "@/design-system";

type Lang = "ar" | "en";
interface SafeErrorDetails {
  message: string;
  errorCode?: string;
  correlationId?: string;
}

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
  const [actionError, setActionError] = useState<SafeErrorDetails | null>(null);
  const actionErrorRef = useRef<HTMLDivElement>(null);
  const BackIcon = dir === "rtl" ? ArrowRight : ArrowLeft;

  useEffect(() => {
    queueMicrotask(() => {
      setEditor(null);
      setConfirmation(null);
      setActionError(null);
    });
  }, [id]);

  useEffect(() => {
    if (!actionError) return;
    const frame = window.requestAnimationFrame(() => actionErrorRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [actionError]);

  if (view.isAuthLoading) return <LoadingState lang={lang} />;
  if (!view.canRead) return <AccessDenied lang={lang} />;
  if (view.isLoading && !view.server) return <LoadingState lang={lang} />;
  if (!view.server) return <NotAvailableState message={view.error} lang={lang} />;
  const server = view.server;

  const run = async (action: () => Promise<unknown>, success: string): Promise<boolean> => {
    setActionError(null);
    try {
      await action();
      toast.success(copy.actionCompletedTitle, success);
      return true;
    } catch (caught) {
      const details = readErrorDetails(caught, copy.requestFailedFallback);
      setActionError(details);
      toast.error(copy.actionFailedTitle, details.message);
      return false;
    }
  };

  const runProbe = async () => {
    setActionError(null);
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
      const details = readErrorDetails(caught, copy.requestFailedFallback);
      setActionError(details);
      toast.error(copy.connectionTestCouldNotRunTitle, details.message);
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
              <BackIcon className="size-4" aria-hidden="true" />
              {copy.backLabel}
            </Link>
          </Button>
        }
        title={server.name}
        description={`\u2066${server.code} · ${server.id}\u2069`}
        status={
          <>
            <StatusBadge status={server.status} enumType="db-server" />
            {server.isPlatformDefault && <Badge tone="info">{t.storageServersList.platformDefaultBadge}</Badge>}
          </>
        }
        action={
          view.canUpdate && (
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => void runProbe()} disabled={view.isMutating}>
                <RefreshCw className={`size-4 ${view.isMutating ? "animate-spin motion-reduce:animate-none" : ""}`} aria-hidden="true" />
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
                  <Play className="size-4" aria-hidden="true" />
                  {copy.testAndActivateButton}
                </Button>
              )}
              {server.status === "ACTIVE" && !server.isPlatformDefault && (
                <Button type="button" variant="outline" size="sm" onClick={() => setConfirmation("drain")} disabled={view.isMutating}>
                  <Ban className="size-4" aria-hidden="true" />
                  {copy.drainButton}
                </Button>
              )}
              {/*
                DRAINING belongs here as much as ACTIVE. Core's takeOffline
                puts no restriction on the source status — it rejects only the
                platform default and a server that still holds tenants, bytes
                or open operations — and OFFLINE is the only door out of
                DRAINING, since activate and delete both accept DRAFT/OFFLINE
                alone. Without it a fully evacuated server stays DRAINING for
                good. Emptiness stays Core's call, not this screen's.
              */}
              {["ACTIVE", "DRAINING"].includes(server.status) && !server.isPlatformDefault && (
                <Button type="button" variant="outline" size="sm" onClick={() => setConfirmation("offline")} disabled={view.isMutating}>
                  <StopCircle className="size-4" aria-hidden="true" />
                  {copy.takeOfflineButton}
                </Button>
              )}
            </div>
          )
        }
      />

      {view.error && (
        <DegradedBanner>
          <p>{view.error.message}</p>
          {(view.error.errorCode || view.error.correlationId) && (
            <div className="mt-1 flex flex-wrap gap-1.5">
              {view.error.errorCode && <CodeRef value={view.error.errorCode} />}
              {view.error.correlationId && <CodeRef value={view.error.correlationId} />}
            </div>
          )}
        </DegradedBanner>
      )}
      {actionError && (
        <div
          ref={actionErrorRef}
          role="alert"
          tabIndex={-1}
          className="whitespace-pre-line rounded-lg border border-destructive/30 bg-destructive-subtle p-4 text-sm text-destructive-subtle-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <p>{actionError.message}</p>
          {(actionError.errorCode || actionError.correlationId) && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {actionError.errorCode && <CodeRef value={actionError.errorCode} />}
              {actionError.correlationId && <CodeRef value={actionError.correlationId} />}
            </div>
          )}
        </div>
      )}
      {view.lastProbe && <ProbeResultBanner result={view.lastProbe} lang={lang} />}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.55fr)_minmax(320px,0.8fr)]">
        <div className="space-y-6">
          <Panel
            title={copy.serverConfigurationTitle}
            icon={<HardDrive className="size-4" aria-hidden="true" />}
            action={
              view.canUpdate && (
                <Button type="button" variant="ghost" size="sm" onClick={() => setEditor("configuration")}>
                  <Edit3 className="size-3.5" aria-hidden="true" />
                  {copy.editButton}
                </Button>
              )
            }
          >
            <dl className="grid gap-5 sm:grid-cols-2">
              <Datum label={copy.endpointLabel} value={server.endpoint} mono wide />
              <Datum label={copy.regionLabel} value={server.region} mono />
              <Datum label={copy.bucketLabel} value={server.bucketName} mono />
              <Datum label={copy.tenantCapacityLabel} value={`${formatStorageNumber(server.assignedTenants, lang)} / ${server.maxTenants === null ? "∞" : formatStorageNumber(server.maxTenants, lang)}`} mono />
              <Datum label={copy.configRevisionLabel} value={`v${formatStorageNumber(server.configRevision, lang)}`} mono />
            </dl>
            {connectionEditBlocked && (
              <p className="mt-5 rounded-md border border-warning/30 bg-warning-subtle p-3 text-xs leading-5 text-warning-subtle-foreground">
                {copy.connectionEditBlockedNote}
              </p>
            )}
          </Panel>

          <Panel
            title={copy.credentialsTitle}
            icon={<KeyRound className="size-4" aria-hidden="true" />}
            action={
              view.canUpdate &&
              (connectionEditBlocked ? (
                <Button type="button" variant="ghost" size="sm" onClick={() => setEditor("safe-rotation")}>
                  <ShieldCheck className="size-3.5" aria-hidden="true" />
                  {copy.safeRotationButton}
                </Button>
              ) : (
                <Button type="button" variant="ghost" size="sm" onClick={() => setEditor("credentials")}>
                  <KeyRound className="size-3.5" aria-hidden="true" />
                  {copy.rotateButton}
                </Button>
              ))
            }
          >
            <div className="flex items-start gap-3 rounded-md border border-info/30 bg-info-subtle p-4 text-info-subtle-foreground">
              <ShieldCheck className="mt-0.5 size-5 shrink-0 text-info" aria-hidden="true" />
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
                isDurable={view.isRotationReceiptDurable}
                onRevoke={() =>
                  void run(
                    () => view.revokeCredentialRotation(view.currentRotation!.rotationId),
                    copy.oldKeyRejectedMessage,
                  )
                }
                onDismiss={view.dismissRotationReceipt}
              />
            )}
          </Panel>
        </div>

        <div className="space-y-6">
          <FreshnessPanel server={server} lang={lang} />

          <Panel title={copy.operationalPoliciesTitle} icon={<ShieldCheck className="size-4" aria-hidden="true" />}>
            <div className="space-y-3">
              <PolicyRow label={copy.newPlacementLabel} value={server.status === "ACTIVE" && server.connectionEvidenceFresh ? copy.allowedValue : copy.blockedValue} tone={server.status === "ACTIVE" && server.connectionEvidenceFresh ? "success" : "warning"} />
              <PolicyRow label={copy.assignedRuntimeLabel} value={copy.unaffectedByProbeValue} tone="info" />
              <PolicyRow label={copy.scheduledCheckLabel} value={copy.workerEvery12hValue} tone="info" />
            </div>
            {view.canUpdate && !server.isPlatformDefault && (
              <Button
                type="button"
                variant="outline"
                className="mt-5 w-full"
                onClick={() => void run(view.makePlatformDefault, copy.platformDefaultSuccessMessage)}
                disabled={!canMakeDefault || view.isMutating}
                aria-describedby={!canMakeDefault ? "make-default-requirement" : undefined}
              >
                <ShieldCheck className="size-4" aria-hidden="true" />
                {copy.makeDefaultButton}
              </Button>
            )}
            {view.canUpdate && !server.isPlatformDefault && !canMakeDefault && (
              <p id="make-default-requirement" className="mt-2 text-xs text-warning-subtle-foreground">
                {copy.makeDefaultRequirementTitle}
              </p>
            )}
          </Panel>

          {view.canDelete && (
            <Panel title={copy.dangerZoneTitle} icon={<Trash2 className="size-4" aria-hidden="true" />}>
              <p className="text-xs leading-5 text-muted-foreground">
                {copy.deleteRestrictionNote}
              </p>
              <Button type="button" variant="destructive" className="mt-4 w-full" onClick={() => setConfirmation("delete")} disabled={deleteBlocked || view.isMutating}>
                <Trash2 className="size-4" aria-hidden="true" />
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
          void run(view.drain, copy.drainSuccessMessage).then(() => setConfirmation(null))
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
          void run(view.offline, copy.offlineSuccessMessage).then(() => setConfirmation(null))
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
            .catch((caught) => {
              const details = readErrorDetails(caught, copy.deleteFailedFallback);
              setConfirmation(null);
              setActionError(details);
              toast.error(copy.deleteFailedTitle, details.message);
            })
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
  const roundedPercent = Math.round(percent);
  const passed = server.lastConnectionTestStatus === "PASSED";
  const fresh = server.connectionEvidenceFresh && passed;
  const barTone = fresh ? "bg-success" : server.lastConnectionTestStatus === "FAILED" ? "bg-destructive" : "bg-warning";
  const badgeTone = fresh
    ? "bg-success-subtle text-success-subtle-foreground"
    : server.lastConnectionTestStatus === "FAILED"
      ? "bg-destructive-subtle text-destructive-subtle-foreground"
      : "bg-warning-subtle text-warning-subtle-foreground";
  const evidenceLabel = fresh ? copy.freshLabel : server.lastConnectionTestStatus === "FAILED" ? copy.failedLabel : copy.staleOrUntestedLabel;
  return (
    <Panel title={copy.freshnessTitle} icon={<Clock3 className="size-4" aria-hidden="true" />}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-semibold text-foreground">
            {evidenceLabel}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{copy.validityWindowNote}</p>
        </div>
        <span className={`grid size-10 place-items-center rounded-full ${badgeTone}`}>
          {fresh ? <CheckCircle2 className="size-5" aria-hidden="true" /> : <AlertCircle className="size-5" aria-hidden="true" />}
        </span>
      </div>
      <div
        className="mt-5 h-2 overflow-hidden rounded-full bg-muted"
        aria-label={copy.remainingFreshnessAriaLabel}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={roundedPercent}
        aria-valuetext={`${evidenceLabel} · ${formatStoragePercent(roundedPercent, lang)}`}
        role="progressbar"
      >
        <div className={`h-full rounded-full transition-[width] motion-reduce:transition-none ${barTone}`} style={{ width: `${percent}%` }} />
      </div>
      <dl className="mt-4 space-y-3 text-xs">
        <DatumRow label={copy.lastTestedLabel} value={formatDate(server.lastConnectionTestedAt, lang)} />
        <DatumRow label={copy.evidenceExpiresLabel} value={formatDate(server.connectionEvidenceExpiresAt, lang)} />
        <DatumRow label={copy.automaticCheckDueLabel} value={formatDate(server.nextAutomaticProbeDueAt, lang)} />
        {server.lastConnectionTestErrorCode && <DatumRow label={copy.safeFailureCodeLabel} value={<CodeRef value={server.lastConnectionTestErrorCode} />} />}
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
  const [error, setError] = useState<SafeErrorDetails | null>(null);
  const errorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);

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
      setError(readErrorDetails(caught, copy.saveFailedFallback));
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
      <form method="post" id="storage-server-editor-form" onSubmit={submit} className="space-y-4 py-1">
        {error && (
          <div ref={errorRef} role="alert" tabIndex={-1} className="rounded-md border border-destructive/30 bg-destructive-subtle p-3 text-sm text-destructive-subtle-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <p>{error.message}</p>
            {(error.errorCode || error.correlationId) && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {error.errorCode && <CodeRef value={error.errorCode} />}
                {error.correlationId && <CodeRef value={error.correlationId} />}
              </div>
            )}
          </div>
        )}
        {mode === "credentials" ? (
          <>
            <Field label={copy.accessKeyIdLabel} required>
              {(fp) => <Input {...fp} dir="ltr" required minLength={3} maxLength={128} autoComplete="off" value={accessKeyId} onChange={(e) => setAccessKeyId(e.target.value)} className="font-mono" />}
            </Field>
            <Field label={copy.secretAccessKeyLabel} required>
              {(fp) => <Input {...fp} dir="ltr" required type="password" minLength={16} maxLength={256} autoComplete="new-password" value={secretAccessKey} onChange={(e) => setSecretAccessKey(e.target.value)} className="font-mono" />}
            </Field>
          </>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={copy.nameLabel} required>
              {(fp) => <Input {...fp} required maxLength={120} value={name} onChange={(e) => setName(e.target.value)} />}
            </Field>
            <Field label={copy.maxTenantsLabel}>
              {(fp) => <Input {...fp} dir="ltr" type="number" min={Math.max(1, server.assignedTenants)} max={1_000_000} value={maxTenants} onChange={(e) => setMaxTenants(e.target.value)} />}
            </Field>
            <Field label={copy.endpointLabel} className="sm:col-span-2" required>
              {(fp) => <Input {...fp} dir="ltr" required disabled={connectionEditBlocked} type="url" value={endpoint} onChange={(e) => setEndpoint(e.target.value)} className="font-mono" />}
            </Field>
            <Field label={copy.regionLabel} required>
              {(fp) => <Input {...fp} dir="ltr" required disabled={connectionEditBlocked} value={region} onChange={(e) => setRegion(e.target.value)} className="font-mono" />}
            </Field>
            <Field label={copy.bucketLabel} required>
              {(fp) => <Input {...fp} dir="ltr" required disabled={connectionEditBlocked} value={bucketName} onChange={(e) => setBucketName(e.target.value)} className="font-mono" />}
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
  const [error, setError] = useState<SafeErrorDetails | null>(null);
  const errorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);

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
      setError(readErrorDetails(caught, copy.rotationStartFailedFallback));
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
      <form method="post" id="safe-rotation-form" onSubmit={submit} className="space-y-4 py-1">
        {error && (
          <div ref={errorRef} role="alert" tabIndex={-1} className="rounded-md border border-destructive/30 bg-destructive-subtle p-3 text-sm text-destructive-subtle-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <p>{error.message}</p>
            {(error.errorCode || error.correlationId) && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {error.errorCode && <CodeRef value={error.errorCode} />}
                {error.correlationId && <CodeRef value={error.correlationId} />}
              </div>
            )}
          </div>
        )}
        <Field label={copy.newAccessKeyIdLabel} required>
          {(fp) => <Input {...fp} dir="ltr" required minLength={3} maxLength={128} autoComplete="off" value={accessKeyId} onChange={(e) => setAccessKeyId(e.target.value)} className="font-mono" />}
        </Field>
        <Field label={copy.newSecretAccessKeyLabel} required>
          {(fp) => <Input {...fp} dir="ltr" required type="password" minLength={16} maxLength={256} autoComplete="new-password" value={secretAccessKey} onChange={(e) => setSecretAccessKey(e.target.value)} className="font-mono" />}
        </Field>
        <Field label={copy.graceWindowLabel} hint={copy.graceWindowHint} required>
          {(fp) => <Input {...fp} dir="ltr" required type="number" min={1} max={24} value={graceHours} onChange={(e) => setGraceHours(e.target.value)} />}
        </Field>
      </form>
    </FormDrawer>
  );
}

function RotationStatusCard({
  rotation,
  lang,
  isMutating,
  isDurable,
  onRevoke,
  onDismiss,
}: {
  rotation: StorageCredentialRotationReceipt;
  lang: Lang;
  isMutating: boolean;
  isDurable: boolean;
  onRevoke: () => void;
  onDismiss: () => void;
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
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground rtl:normal-case rtl:tracking-normal">
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
            {isDurable ? copy.rotationReceiptKeptNote : copy.rotationReceiptVolatileWarning}
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-3 w-full"
            onClick={onRevoke}
            disabled={!canRevoke || isMutating}
            aria-describedby={!graceExpired ? `rotation-${rotation.rotationId}-wait-reason` : undefined}
          >
            <ShieldCheck className="size-4" aria-hidden="true" />
            {copy.verifyOldKeyButton}
          </Button>
          {!graceExpired && (
            <p id={`rotation-${rotation.rotationId}-wait-reason`} className="mt-2 text-xs text-warning-subtle-foreground">
              {copy.waitForGraceTitle}
            </p>
          )}
          {isDurable && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="mt-2 w-full"
              onClick={onDismiss}
              disabled={isMutating}
            >
              {copy.dismissRotationReceiptButton}
            </Button>
          )}
        </>
      )}
    </div>
  );
}

function ProbeResultBanner({ result, lang }: { result: { outcome: string; errorCode: string | null; lifecycleStatus: string }; lang: Lang }) {
  const copy = dict(lang);
  const passed = result.outcome === "PASSED";
  const skipped = result.outcome === "SKIPPED";
  const surface = passed
    ? "border-success/30 bg-success-subtle text-success-subtle-foreground"
    : skipped
      ? "border-warning/30 bg-warning-subtle text-warning-subtle-foreground"
      : "border-destructive/30 bg-destructive-subtle text-destructive-subtle-foreground";
  return (
    <section
      role={passed ? "status" : "alert"}
      className={`rounded-lg border p-4 text-sm ${surface}`}
    >
      <p className="font-semibold">{passed ? copy.connectionTestPassedTitle : skipped ? copy.connectionTestSkippedTitle : copy.connectionTestFailedTitle}</p>
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
      <CardHeader className="flex-col items-start justify-between gap-3 space-y-0 sm:flex-row sm:items-center">
        <CardTitle className="flex items-center gap-2 text-sm">
          <span className="text-info" aria-hidden="true">{icon}</span>
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
      <dt className="text-xs font-semibold uppercase tracking-wider text-muted-foreground rtl:normal-case rtl:tracking-normal">{label}</dt>
      <dd dir={mono ? "ltr" : undefined} className={`mt-2 break-all text-sm font-semibold text-foreground ${mono ? "font-mono" : ""}`}>{value}</dd>
    </div>
  );
}
function DatumRow({ label, value, mono }: { label: string; value: ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd dir={mono ? "ltr" : undefined} className={`text-end font-semibold text-foreground ${mono ? "break-all font-mono" : ""}`}>{value}</dd>
    </div>
  );
}
function PolicyRow({ label, value, tone }: { label: string; value: string; tone: "success" | "warning" | "info" }) {
  const toneClass = tone === "success"
    ? "text-success-subtle-foreground"
    : tone === "warning"
      ? "text-warning-subtle-foreground"
      : "text-info-subtle-foreground";
  return (
    <div className="flex flex-col items-start justify-between gap-1 rounded-md bg-muted p-3 text-xs sm:flex-row sm:items-center sm:gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className={`text-end font-semibold ${toneClass}`}>{value}</span>
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
        <Loader2 className="size-5 animate-spin text-info motion-reduce:animate-none" aria-hidden="true" />
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
    : new Intl.DateTimeFormat(lang === "ar" ? "ar-EG" : "en-US", { year: "numeric", month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "UTC", timeZoneName: "short" }).format(date);
}

function readErrorDetails(value: unknown, fallback: string): SafeErrorDetails {
  if (typeof value !== "object" || value === null) return { message: fallback };
  const candidate = value as { message?: unknown; errorCode?: unknown; correlationId?: unknown };
  return {
    message: typeof candidate.message === "string" ? candidate.message : fallback,
    ...(typeof candidate.errorCode === "string" ? { errorCode: candidate.errorCode } : {}),
    ...(typeof candidate.correlationId === "string" ? { correlationId: candidate.correlationId } : {}),
  };
}

const storageNumberFormatters = {
  en: new Intl.NumberFormat("en-US"),
  ar: new Intl.NumberFormat("ar-EG"),
} as const;
const storagePercentFormatters = {
  en: new Intl.NumberFormat("en-US", { style: "percent", maximumFractionDigits: 0 }),
  ar: new Intl.NumberFormat("ar-EG", { style: "percent", maximumFractionDigits: 0 }),
} as const;

function formatStorageNumber(value: number, lang: Lang) {
  return storageNumberFormatters[lang].format(value);
}

function formatStoragePercent(value: number, lang: Lang) {
  return storagePercentFormatters[lang].format(value / 100);
}
