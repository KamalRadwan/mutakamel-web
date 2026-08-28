"use client";

import Link from "next/link";
import { type ReactNode } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Fingerprint,
  KeyRound,
  Loader2,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  ConfirmActionModal,
  DataTable,
  Field,
  Input,
  PageHeader,
  type ColumnDef,
} from "@/design-system";
import { COPY, type PublisherKeyCopy } from "./copy";
import type {
  FieldErrorCode,
  MutationKind,
  PublisherKey,
  ResourceView,
} from "./types";
import {
  usePublisherKeys,
  type PublisherKeysView,
} from "./usePublisherKeys";

export function PublisherKeysScreen() {
  const { lang } = useI18n();
  const copy = COPY[lang];
  const view = usePublisherKeys();
  const rows = view.directory.data ?? [];
  const active = rows.filter((row) => row.status === "ACTIVE").length;
  const revoked = rows.length - active;

  return (
    <div dir={lang === "ar" ? "rtl" : "ltr"} className="mx-auto w-full max-w-[1500px] space-y-4">
      <PageHeader
        breadcrumb={
          <Button asChild variant="ghost" size="sm" className="w-fit">
            <Link href="/provisioning">
              <ArrowLeft className="size-3.5 rtl:rotate-180" aria-hidden="true" />
              {copy.back}
            </Link>
          </Button>
        }
        title={copy.title}
        description={copy.subtitle}
        status={
          view.permissions.canRead && view.directory.data ? (
            <div className="flex items-center gap-1.5">
              <Badge tone="brand">{copy.activeCount}: {active}</Badge>
              <Badge tone="neutral">{copy.revokedCount}: {revoked}</Badge>
            </div>
          ) : undefined
        }
      />

      <Card className="border-warn-300 bg-warn-50 p-4 text-warn-950 dark:border-warn-900 dark:bg-warn-950/25 dark:text-warn-100">
        <div className="flex items-start gap-3">
          <ShieldAlert className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
          <div>
            <h2 className="font-semibold">{copy.securityTitle}</h2>
            <p className="mt-1 text-sm leading-6">{copy.securityBody}</p>
            <p className="mt-2 text-xs font-semibold uppercase tracking-wide">
              {copy.noPrivateKey}
            </p>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,0.65fr)]">
        <DirectoryPanel view={view} copy={copy} lang={lang} />
        <DetailPanel view={view} copy={copy} lang={lang} />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <ChallengePanel view={view} copy={copy} />
        <RegistrationPanel view={view} copy={copy} />
      </div>
      <RevokePanel view={view} copy={copy} />

      <MutationFeedback view={view} copy={copy} />
      <ConfirmationDialog view={view} />
    </div>
  );
}

function DirectoryPanel({
  view,
  copy,
  lang,
}: {
  view: PublisherKeysView;
  copy: PublisherKeyCopy;
  lang: "en" | "ar";
}) {
  const resource = view.directory;
  const columns: ColumnDef<PublisherKey>[] = [
    { key: "keyId", headerEn: copy.keyId, headerAr: copy.keyId, cell: (row) => <strong>{row.keyId}</strong> },
    { key: "status", headerEn: copy.status, headerAr: copy.status, cell: (row) => <StatusBadge status={row.status} copy={copy} /> },
    { key: "revision", headerEn: copy.revision, headerAr: copy.revision, cell: (row) => row.revision },
    { key: "fingerprint", headerEn: copy.fingerprint, headerAr: copy.fingerprint, cell: (row) => <CodeValue>{shortHash(row.publicKeyFingerprint)}</CodeValue> },
    { key: "registeredAt", headerEn: copy.registeredAt, headerAr: copy.registeredAt, cell: (row) => formatDate(row.registeredAt, lang) },
    {
      key: "select",
      headerEn: "",
      headerAr: "",
      align: "end",
      cell: (row) => (
        <Button
          type="button"
          variant={view.selectedId === row.publisherKeyId ? "primary" : "outline"}
          size="sm"
          onClick={() => view.selectKey(row.publisherKeyId)}
          aria-pressed={view.selectedId === row.publisherKeyId}
        >
          {copy.select}
        </Button>
      ),
    },
  ];
  return (
    <Card>
      <CardHeader>
        <PanelHeader
          icon={<Fingerprint className="size-5" />}
          title={copy.directory}
          subtitle={copy.directoryHelp}
          action={
            view.permissions.canRead ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={view.refreshDirectory}
                disabled={resource.isRefreshing || resource.state === "LOADING"}
                loading={resource.isRefreshing}
              >
                <RefreshCw className="size-4" aria-hidden="true" />
                {resource.isRefreshing ? copy.refreshing : copy.refresh}
              </Button>
            ) : null
          }
        />
      </CardHeader>
      <CardContent>
        {resource.state === "FORBIDDEN" ? (
          <StateNotice tone="warning" title={copy.forbidden} body={copy.readPermission} />
        ) : resource.state === "LOADING" ? (
          <StateNotice tone="neutral" title={copy.loading} loading />
        ) : resource.state === "EMPTY" ? (
          <>
            <StateNotice tone="neutral" title={copy.empty} />
            <EvidenceLine resource={resource} copy={copy} />
          </>
        ) : resource.state === "UNAVAILABLE" ? (
          <StateNotice
            tone="danger"
            title={copy.unavailable}
            error={resource.error}
            action={
              <Button type="button" variant="outline" size="sm" onClick={view.refreshDirectory}>
                <RotateCcw className="size-4" aria-hidden="true" />
                {copy.retry}
              </Button>
            }
            copy={copy}
          />
        ) : resource.state === "ERROR" ? (
          <StateNotice
            tone="danger"
            title={copy.failed}
            error={resource.error}
            action={
              <Button type="button" variant="outline" size="sm" onClick={view.refreshDirectory}>
                <RotateCcw className="size-4" aria-hidden="true" />
                {copy.retry}
              </Button>
            }
            copy={copy}
          />
        ) : (
          <>
            {resource.state === "STALE" ? (
              <StateNotice tone="warning" title={copy.stale} error={resource.error} copy={copy} />
            ) : null}
            <Card className="mt-3">
              <DataTable
                columns={columns}
                data={resource.data ?? []}
                getRowId={(row) => row.publisherKeyId}
                pagination={{ page: 1, limit: (resource.data ?? []).length || 1, totalItems: (resource.data ?? []).length, totalPages: 1, onPageChange: () => undefined }}
              />
            </Card>
            <EvidenceLine resource={resource} copy={copy} />
          </>
        )}
      </CardContent>
    </Card>
  );
}

function DetailPanel({
  view,
  copy,
  lang,
}: {
  view: PublisherKeysView;
  copy: PublisherKeyCopy;
  lang: "en" | "ar";
}) {
  const resource = view.detail;
  const key = resource.data;
  return (
    <Card>
      <CardHeader>
        <PanelHeader
          icon={<ShieldCheck className="size-5" />}
          title={copy.detail}
          subtitle={copy.selectHelp}
          action={
            view.selectedId ? (
              <Button type="button" variant="ghost" size="sm" onClick={() => view.selectKey(null)} aria-label={copy.close}>
                &times;
              </Button>
            ) : null
          }
        />
      </CardHeader>
      <CardContent>
        {!view.selectedId ? (
          <StateNotice tone="neutral" title={copy.selectHelp} />
        ) : resource.state === "LOADING" ? (
          <StateNotice tone="neutral" title={copy.loading} loading />
        ) : resource.state === "FORBIDDEN" ? (
          <StateNotice tone="warning" title={copy.forbidden} body={copy.readPermission} />
        ) : resource.state === "UNAVAILABLE" ? (
          <StateNotice
            tone="danger"
            title={copy.unavailable}
            error={resource.error}
            copy={copy}
            action={<Button type="button" variant="outline" size="sm" onClick={view.refreshDetail}>{copy.retry}</Button>}
          />
        ) : resource.state === "ERROR" ? (
          <StateNotice
            tone="danger"
            title={copy.failed}
            error={resource.error}
            copy={copy}
            action={<Button type="button" variant="outline" size="sm" onClick={view.refreshDetail}>{copy.retry}</Button>}
          />
        ) : key ? (
          <div className="space-y-4">
            {resource.state === "STALE" ? (
              <StateNotice tone="warning" title={copy.stale} error={resource.error} copy={copy} />
            ) : null}
            <dl className="grid gap-3 sm:grid-cols-2">
              <Detail label={copy.keyId}>{key.keyId}</Detail>
              <Detail label={copy.status}><StatusBadge status={key.status} copy={copy} /></Detail>
              <Detail label={copy.revision}>{key.revision}</Detail>
              <Detail label={copy.algorithm}>{key.algorithm}</Detail>
              <Detail label={copy.registeredAt}>{formatDate(key.registeredAt, lang)}</Detail>
              <Detail label={copy.revokedAt}>{key.revokedAt ? formatDate(key.revokedAt, lang) : "—"}</Detail>
            </dl>
            <Detail label={copy.publisherKeyId}><CodeValue>{key.publisherKeyId}</CodeValue></Detail>
            <Detail label={copy.fingerprint}><CodeValue>{key.publicKeyFingerprint}</CodeValue></Detail>
            <Detail label={copy.publicKey}><CodeValue>{key.publicKeyBase64}</CodeValue></Detail>
            {key.revocationReasonCode ? (
              <Detail label={copy.revokeReason}><CodeValue>{key.revocationReasonCode}</CodeValue></Detail>
            ) : null}
            <EvidenceLine resource={resource} copy={copy} />
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function RevokePanel({
  view,
  copy,
}: {
  view: PublisherKeysView;
  copy: PublisherKeyCopy;
}) {
  return (
    <Card>
      <CardHeader>
        <PanelHeader icon={<ShieldAlert className="size-5" />} title={copy.stepRevoke} subtitle={copy.revokeHelp} />
      </CardHeader>
      <CardContent>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            view.requestRevoke();
          }}
          className="grid gap-3 lg:grid-cols-[minmax(280px,1fr)_180px_minmax(240px,1fr)_auto] lg:items-end"
        >
          <TextField
            label={copy.publisherKeyId}
            value={view.revokeDraft.publisherKeyId}
            onChange={(value) => view.setRevokeDraftField("publisherKeyId", value)}
            direction="ltr"
            error={fieldErrorOrNull(copy, view.revokeErrors.publisherKeyId)}
            disabled={!view.permissions.canRegisterOrRevoke}
          />
          <TextField
            label={copy.revision}
            value={view.revokeDraft.expectedRevision}
            onChange={(value) => view.setRevokeDraftField("expectedRevision", value)}
            inputMode="numeric"
            error={fieldErrorOrNull(copy, view.revokeErrors.expectedRevision)}
            disabled={!view.permissions.canRegisterOrRevoke}
          />
          <TextField
            label={copy.reasonCode}
            value={view.revokeDraft.reasonCode}
            onChange={(value) => view.setRevokeDraftField("reasonCode", value)}
            placeholder="KEY_COMPROMISED"
            error={fieldErrorOrNull(copy, view.revokeErrors.reasonCode)}
            disabled={!view.permissions.canRegisterOrRevoke}
          />
          <Button
            type="submit"
            variant="destructive"
            disabled={
              !view.permissions.canRegisterOrRevoke ||
              view.mutation.state === "PENDING" ||
              view.mutation.exactRetryAvailable
            }
          >
            {copy.reviewRevoke}
          </Button>
        </form>
        <div className="mt-3 flex flex-wrap gap-2">
          <PermissionNote>{copy.expectedStatus}: ACTIVE</PermissionNote>
          {!view.permissions.canRegisterOrRevoke ? (
            <PermissionNote>{copy.criticalPermission}</PermissionNote>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

function ChallengePanel({
  view,
  copy,
}: {
  view: PublisherKeysView;
  copy: PublisherKeyCopy;
}) {
  const result = view.challengeResult;
  return (
    <Card>
      <CardHeader>
        <PanelHeader icon={<KeyRound className="size-5" />} title={copy.stepChallenge} subtitle={copy.challengeHelp} />
      </CardHeader>
      <CardContent>
        {!view.permissions.canManage ? (
          <StateNotice tone="warning" title={copy.noWriteAccess} body={copy.managePermission} />
        ) : (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              view.requestChallenge();
            }}
            className="space-y-3"
          >
            <TextField
              label={copy.keyId}
              value={view.challengeDraft.keyId}
              onChange={(value) => view.setChallengeDraftField("keyId", value)}
              placeholder="core-release-primary"
              error={fieldErrorOrNull(copy, view.challengeErrors.keyId)}
            />
            <TextField
              label={copy.publicKey}
              value={view.challengeDraft.publicKeyBase64}
              onChange={(value) => view.setChallengeDraftField("publicKeyBase64", value)}
              placeholder="AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="
              direction="ltr"
              error={fieldErrorOrNull(copy, view.challengeErrors.publicKeyBase64)}
            />
            <TextField
              label={`${copy.expiresIn} (${copy.seconds})`}
              value={view.challengeDraft.expiresInSeconds}
              onChange={(value) => view.setChallengeDraftField("expiresInSeconds", value)}
              inputMode="numeric"
              error={fieldErrorOrNull(copy, view.challengeErrors.expiresInSeconds)}
            />
            <PermissionNote>{copy.noPrivateKey}</PermissionNote>
            <Button
              type="submit"
              variant="primary"
              disabled={view.mutation.state === "PENDING" || view.mutation.exactRetryAvailable}
            >
              {copy.createChallenge}
            </Button>
          </form>
        )}
        {result ? (
          <div className="mt-4 space-y-3 rounded-lg border border-brand-300 bg-brand-50 p-4 dark:border-brand-900 dark:bg-brand-950/20">
            <h3 className="flex items-center gap-2 font-semibold text-brand-900 dark:text-brand-100">
              <CheckCircle2 className="size-4" aria-hidden="true" />
              {copy.challengeReady}
            </h3>
            <Detail label={copy.challengeId}><CodeValue>{result.data.challengeId}</CodeValue></Detail>
            <Detail label={copy.payload}><CodeValue>{result.data.payloadBase64}</CodeValue></Detail>
            <Detail label={copy.digest}><CodeValue>{result.data.signingDigest}</CodeValue></Detail>
            <Detail label={copy.fingerprint}><CodeValue>{result.data.publicKeyFingerprint}</CodeValue></Detail>
            <Detail label={copy.expiresAt}>{result.data.expiresAt}</Detail>
            <p className="text-xs font-semibold leading-5 text-brand-800 dark:text-brand-200">{copy.encoding}</p>
            <p className="text-xs text-brand-800 dark:text-brand-300">
              {copy.correlation}: <CodeValue>{result.correlationId}</CodeValue>
            </p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function RegistrationPanel({
  view,
  copy,
}: {
  view: PublisherKeysView;
  copy: PublisherKeyCopy;
}) {
  return (
    <Card>
      <CardHeader>
        <PanelHeader icon={<ShieldCheck className="size-5" />} title={copy.stepRegister} subtitle={copy.registerHelp} />
      </CardHeader>
      <CardContent>
        {!view.permissions.canManage ? (
          <StateNotice tone="warning" title={copy.noWriteAccess} body={copy.managePermission} />
        ) : (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              view.requestRegister();
            }}
            className="space-y-3"
          >
            <TextField
              label={copy.challengeId}
              value={view.registerDraft.challengeId}
              onChange={(value) => view.setRegisterDraftField("challengeId", value)}
              direction="ltr"
              error={fieldErrorOrNull(copy, view.registerErrors.challengeId)}
            />
            <TextField
              label={copy.signature}
              value={view.registerDraft.proofSignatureBase64}
              onChange={(value) => view.setRegisterDraftField("proofSignatureBase64", value)}
              direction="ltr"
              placeholder="Base64 Ed25519 signature"
              error={fieldErrorOrNull(copy, view.registerErrors.proofSignatureBase64)}
            />
            {!view.permissions.canCritical ? (
              <PermissionNote>{copy.noCriticalAccess} {copy.criticalPermission}</PermissionNote>
            ) : null}
            <Button
              type="submit"
              variant="primary"
              disabled={
                !view.permissions.canRegisterOrRevoke ||
                view.mutation.state === "PENDING" ||
                view.mutation.exactRetryAvailable
              }
            >
              {copy.reviewRegister}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}

function MutationFeedback({
  view,
  copy,
}: {
  view: PublisherKeysView;
  copy: PublisherKeyCopy;
}) {
  const mutation = view.mutation;
  if (
    mutation.state === "IDLE" ||
    mutation.state === "CONFIRMING_REGISTER" ||
    mutation.state === "CONFIRMING_REVOKE"
  ) {
    return null;
  }
  const title =
    mutation.state === "PENDING"
      ? copy.pending
      : mutation.state === "SUCCESS"
        ? successText(mutation.kind, copy)
        : mutation.state === "VALIDATION"
          ? copy.validation
          : mutation.state === "FORBIDDEN"
            ? copy.forbidden
            : mutation.state === "CONFLICT"
              ? copy.conflict
              : mutation.state === "AMBIGUOUS"
                ? copy.ambiguous
                : copy.failed;
  const tone =
    mutation.state === "SUCCESS"
      ? "success"
      : mutation.state === "PENDING"
        ? "neutral"
        : mutation.state === "AMBIGUOUS" || mutation.state === "CONFLICT"
          ? "warning"
          : "danger";
  return (
    <Card className={toneClasses(tone)}>
      <section aria-live="polite" className="p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-semibold">{title}</h2>
            {mutation.error ? (
              <div className="mt-2 space-y-1 text-xs">
                <p>{copy.errorCode}: <CodeValue>{mutation.error.errorCode}</CodeValue></p>
                <p>{mutation.error.message}</p>
              </div>
            ) : null}
            {mutation.correlationId ? (
              <p className="mt-2 text-xs">
                {copy.correlation}: <CodeValue>{mutation.correlationId}</CodeValue>
              </p>
            ) : null}
            {mutation.result ? (
              <p className="mt-2 text-xs">
                {copy.publisherKeyId}: <CodeValue>{mutation.result.publisherKeyId}</CodeValue>
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            {mutation.exactRetryAvailable ? (
              <Button type="button" variant="outline" size="sm" onClick={view.retryExactMutation}>
                <RotateCcw className="size-4" aria-hidden="true" />
                {copy.exactRetry}
              </Button>
            ) : null}
            {mutation.state !== "PENDING" ? (
              <Button type="button" variant="ghost" size="sm" onClick={view.clearMutation}>
                {copy.dismiss}
              </Button>
            ) : null}
          </div>
        </div>
      </section>
    </Card>
  );
}

function ConfirmationDialog({
  view,
}: {
  view: PublisherKeysView;
}) {
  const intent = view.mutation.pendingIntent;
  if (!intent || (intent.kind !== "REGISTER" && intent.kind !== "REVOKE")) {
    return null;
  }
  const register = intent.kind === "REGISTER";
  // The exact identifier the operator must type mirrors the value they are
  // about to act on (the registration challenge, or the key being revoked) —
  // a stronger, typed-confirmation replacement for the old read-only <dl>.
  const requiredConfirmationText = register
    ? intent.command.challengeId
    : intent.publisherKeyId;
  const descriptionEn = register
    ? `${COPY.en.confirmRegisterBody} ${COPY.en.challengeId}: ${intent.command.challengeId}`
    : `${COPY.en.confirmRevokeBody} ${COPY.en.publisherKeyId}: ${intent.publisherKeyId} — ${COPY.en.revision}: ${intent.command.expectedRevision} — ${COPY.en.expectedStatus}: ${intent.command.expectedStatus} — ${COPY.en.reasonCode}: ${intent.command.reasonCode}`;
  const descriptionAr = register
    ? `${COPY.ar.confirmRegisterBody} ${COPY.ar.challengeId}: ${intent.command.challengeId}`
    : `${COPY.ar.confirmRevokeBody} ${COPY.ar.publisherKeyId}: ${intent.publisherKeyId} — ${COPY.ar.revision}: ${intent.command.expectedRevision} — ${COPY.ar.expectedStatus}: ${intent.command.expectedStatus} — ${COPY.ar.reasonCode}: ${intent.command.reasonCode}`;

  return (
    <ConfirmActionModal
      isOpen
      onClose={() => view.closeConfirmation()}
      onConfirm={() => view.confirmMutation()}
      titleEn={register ? COPY.en.confirmRegisterTitle : COPY.en.confirmRevokeTitle}
      titleAr={register ? COPY.ar.confirmRegisterTitle : COPY.ar.confirmRevokeTitle}
      descriptionEn={descriptionEn}
      descriptionAr={descriptionAr}
      confirmTextEn={COPY.en.confirm}
      confirmTextAr={COPY.ar.confirm}
      requiredConfirmationText={requiredConfirmationText}
      isLoading={view.mutation.state === "PENDING"}
    />
  );
}

function PanelHeader({
  icon,
  title,
  subtitle,
  action,
}: {
  icon: ReactNode;
  title: string;
  subtitle: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5 text-muted-foreground" aria-hidden="true">{icon}</span>
        <div>
          <CardTitle className="text-base">{title}</CardTitle>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{subtitle}</p>
        </div>
      </div>
      {action}
    </div>
  );
}

function StateNotice({
  tone,
  title,
  body,
  loading = false,
  error,
  action,
  copy,
}: {
  tone: "neutral" | "warning" | "danger";
  title: string;
  body?: string;
  loading?: boolean;
  error?: ResourceView<unknown>["error"];
  action?: ReactNode;
  copy?: PublisherKeyCopy;
}) {
  return (
    <div className={`mt-3 rounded-lg border p-4 text-sm ${toneClasses(tone)}`}>
      <div className="flex items-start gap-2">
        {loading ? <Loader2 className="mt-0.5 size-4 animate-spin" aria-hidden="true" /> : <AlertTriangle className="mt-0.5 size-4" aria-hidden="true" />}
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{title}</p>
          {body ? <p className="mt-1 text-xs leading-5">{body}</p> : null}
          {error ? (
            <div className="mt-2 space-y-1 text-xs">
              <p>{copy?.errorCode}: <CodeValue>{error.errorCode}</CodeValue></p>
              <p>{error.message}</p>
              {error.correlationId ? (
                <p>{copy?.correlation}: <CodeValue>{error.correlationId}</CodeValue></p>
              ) : null}
            </div>
          ) : null}
          {action ? <div className="mt-3">{action}</div> : null}
        </div>
      </div>
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  error,
  placeholder,
  disabled = false,
  direction,
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error: string | null;
  placeholder?: string;
  disabled?: boolean;
  direction?: "ltr";
  inputMode?: "numeric";
}) {
  return (
    <Field label={label} error={error ?? undefined}>
      {(fieldProps) => (
        <Input
          {...fieldProps}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          dir={direction}
          inputMode={inputMode}
          autoComplete="off"
          spellCheck={false}
        />
      )}
    </Field>
  );
}

function PermissionNote({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-lg border border-warn-300 bg-warn-50 px-3 py-2 text-xs font-semibold text-warn-900 dark:border-warn-900 dark:bg-warn-950/25 dark:text-warn-200">
      {children}
    </p>
  );
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-2xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="mt-1 break-words text-sm font-semibold text-foreground">{children}</div>
    </div>
  );
}

function EvidenceLine({
  resource,
  copy,
}: {
  resource: ResourceView<unknown>;
  copy: PublisherKeyCopy;
}) {
  return resource.correlationId ? (
    <p className="mt-3 text-xs text-muted-foreground">
      {copy.correlation}: <CodeValue>{resource.correlationId}</CodeValue>
      {resource.timestamp ? ` · ${resource.timestamp}` : ""}
    </p>
  ) : null;
}

function StatusBadge({
  status,
  copy,
}: {
  status: PublisherKey["status"];
  copy: PublisherKeyCopy;
}) {
  return (
    <Badge tone={status === "ACTIVE" ? "brand" : "neutral"}>
      {status === "ACTIVE" ? copy.active : copy.revoked}
    </Badge>
  );
}

function CodeValue({ children }: { children: ReactNode }) {
  return <code dir="ltr" className="break-all font-mono text-[0.9em]">{children}</code>;
}

function fieldErrorOrNull(
  copy: PublisherKeyCopy,
  code: FieldErrorCode | undefined,
): string | null {
  return code ? fieldError(copy, code) : null;
}

function fieldError(copy: PublisherKeyCopy, code: FieldErrorCode): string {
  return {
    KEY_ID: copy.keyIdError,
    PUBLIC_KEY: copy.publicKeyError,
    EXPIRY: copy.expiryError,
    CHALLENGE_ID: copy.challengeIdError,
    SIGNATURE: copy.signatureError,
    PUBLISHER_KEY_ID: copy.publisherKeyIdError,
    REVISION: copy.revisionError,
    REASON: copy.reasonError,
  }[code];
}

function successText(kind: MutationKind | null, copy: PublisherKeyCopy): string {
  if (kind === "CHALLENGE") return copy.successChallenge;
  if (kind === "REGISTER") return copy.successRegister;
  return copy.successRevoke;
}

function toneClasses(
  tone: "neutral" | "warning" | "danger" | "success",
): string {
  return {
    neutral: "border-border bg-ink-100 text-foreground dark:bg-ink-900",
    warning: "border-warn-300 bg-warn-50 text-warn-950 dark:border-warn-900 dark:bg-warn-950/25 dark:text-warn-100",
    danger: "border-danger-300 bg-danger-50 text-danger-950 dark:border-danger-900 dark:bg-danger-950/25 dark:text-danger-100",
    success: "border-brand-300 bg-brand-50 text-brand-950 dark:border-brand-900 dark:bg-brand-950/25 dark:text-brand-100",
  }[tone];
}

function shortHash(value: string): string {
  return `${value.slice(0, 12)}…${value.slice(-8)}`;
}

function formatDate(value: string, lang: "en" | "ar"): string {
  return new Intl.DateTimeFormat(lang === "ar" ? "ar-EG" : "en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date(value));
}
