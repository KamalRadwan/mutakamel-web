"use client";

import Link from "next/link";
import { useEffect, useRef, type ReactNode } from "react";
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
  X,
} from "lucide-react";
import { Navbar } from "@/components/layout/Navbar";
import { useI18n } from "@/i18n/I18nContext";
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
    <div
      dir={lang === "ar" ? "rtl" : "ltr"}
      className="min-h-screen bg-slate-50 text-slate-950 dark:bg-[#090d16] dark:text-slate-100"
    >
      <Navbar />
      <main className="mx-auto w-full max-w-[1500px] space-y-4 px-3 py-5 sm:px-6">
        <header className="relative overflow-hidden rounded-2xl border border-violet-500/25 bg-gradient-to-r from-slate-950 via-violet-950 to-slate-950 px-5 py-5 text-white shadow-lg">
          <div className="absolute end-0 top-0 size-64 -translate-y-1/2 translate-x-1/3 rounded-full bg-violet-400/15 blur-3xl rtl:-translate-x-1/3" />
          <div className="relative flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <span className="grid size-11 shrink-0 place-items-center rounded-xl border border-violet-300/30 bg-violet-400/15 text-violet-100">
                <KeyRound className="size-5" aria-hidden="true" />
              </span>
              <div>
                <Link
                  href="/provisioning"
                  className="mb-1 inline-flex items-center gap-1 text-xs font-bold text-violet-200 hover:text-white"
                >
                  <ArrowLeft className="size-3.5 rtl:rotate-180" aria-hidden="true" />
                  {copy.back}
                </Link>
                <h1 className="text-xl font-black tracking-tight sm:text-2xl">
                  {copy.title}
                </h1>
                <p className="mt-1 max-w-4xl text-sm leading-6 text-violet-100/80">
                  {copy.subtitle}
                </p>
              </div>
            </div>
            {view.permissions.canRead && view.directory.data ? (
              <div className="grid grid-cols-2 gap-2 text-center text-xs">
                <Metric label={copy.activeCount} value={active} />
                <Metric label={copy.revokedCount} value={revoked} />
              </div>
            ) : null}
          </div>
        </header>

        <section className="rounded-2xl border border-amber-400/30 bg-amber-50 p-4 text-amber-950 dark:border-amber-400/20 dark:bg-amber-950/25 dark:text-amber-100">
          <div className="flex items-start gap-3">
            <ShieldAlert className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
            <div>
              <h2 className="font-black">{copy.securityTitle}</h2>
              <p className="mt-1 text-sm leading-6">{copy.securityBody}</p>
              <p className="mt-2 text-xs font-black uppercase tracking-wide">
                {copy.noPrivateKey}
              </p>
            </div>
          </div>
        </section>

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
      </main>
      <ConfirmationDialog view={view} copy={copy} />
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="min-w-24 rounded-xl border border-white/15 bg-white/10 px-3 py-2 backdrop-blur">
      <strong className="block text-lg font-black">{value}</strong>
      <span className="text-violet-100/80">{label}</span>
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
  return (
    <Panel>
      <PanelHeader
        icon={<Fingerprint className="size-5" />}
        title={copy.directory}
        subtitle={copy.directoryHelp}
        action={
          view.permissions.canRead ? (
            <ActionButton
              onClick={view.refreshDirectory}
              disabled={resource.isRefreshing || resource.state === "LOADING"}
              icon={
                <RefreshCw
                  className={`size-4 ${resource.isRefreshing ? "animate-spin" : ""}`}
                />
              }
            >
              {resource.isRefreshing ? copy.refreshing : copy.refresh}
            </ActionButton>
          ) : null
        }
      />
      {resource.state === "FORBIDDEN" ? (
        <StateNotice
          tone="warning"
          title={copy.forbidden}
          body={copy.readPermission}
        />
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
            <ActionButton onClick={view.refreshDirectory} icon={<RotateCcw className="size-4" />}>
              {copy.retry}
            </ActionButton>
          }
          copy={copy}
        />
      ) : resource.state === "ERROR" ? (
        <StateNotice
          tone="danger"
          title={copy.failed}
          error={resource.error}
          action={
            <ActionButton onClick={view.refreshDirectory} icon={<RotateCcw className="size-4" />}>
              {copy.retry}
            </ActionButton>
          }
          copy={copy}
        />
      ) : (
        <>
          {resource.state === "STALE" ? (
            <StateNotice
              tone="warning"
              title={copy.stale}
              error={resource.error}
              copy={copy}
            />
          ) : null}
          <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
            <table className="w-full min-w-[780px] text-start text-sm">
              <caption className="sr-only">{copy.directory}</caption>
              <thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-600 dark:bg-slate-900 dark:text-slate-400">
                <tr>
                  <Th>{copy.keyId}</Th>
                  <Th>{copy.status}</Th>
                  <Th>{copy.revision}</Th>
                  <Th>{copy.fingerprint}</Th>
                  <Th>{copy.registeredAt}</Th>
                  <Th><span className="sr-only">{copy.select}</span></Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {resource.data?.map((row) => (
                  <tr
                    key={row.publisherKeyId}
                    className={
                      view.selectedId === row.publisherKeyId
                        ? "bg-violet-50 dark:bg-violet-950/20"
                        : "bg-white dark:bg-slate-950"
                    }
                  >
                    <Td><strong>{row.keyId}</strong></Td>
                    <Td><StatusBadge status={row.status} copy={copy} /></Td>
                    <Td>{row.revision}</Td>
                    <Td><CodeValue>{shortHash(row.publicKeyFingerprint)}</CodeValue></Td>
                    <Td>{formatDate(row.registeredAt, lang)}</Td>
                    <Td>
                      <button
                        type="button"
                        onClick={() => view.selectKey(row.publisherKeyId)}
                        aria-pressed={view.selectedId === row.publisherKeyId}
                        className="rounded-lg border border-violet-300 px-3 py-1.5 text-xs font-black text-violet-700 hover:bg-violet-50 dark:border-violet-700 dark:text-violet-300 dark:hover:bg-violet-950/30"
                      >
                        {copy.select}
                      </button>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <EvidenceLine resource={resource} copy={copy} />
        </>
      )}
    </Panel>
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
    <Panel>
      <PanelHeader
        icon={<ShieldCheck className="size-5" />}
        title={copy.detail}
        subtitle={copy.selectHelp}
        action={
          view.selectedId ? (
            <button
              type="button"
              onClick={() => view.selectKey(null)}
              aria-label={copy.close}
              className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <X className="size-4" />
            </button>
          ) : null
        }
      />
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
          action={<ActionButton onClick={view.refreshDetail}>{copy.retry}</ActionButton>}
        />
      ) : resource.state === "ERROR" ? (
        <StateNotice
          tone="danger"
          title={copy.failed}
          error={resource.error}
          copy={copy}
          action={<ActionButton onClick={view.refreshDetail}>{copy.retry}</ActionButton>}
        />
      ) : key ? (
        <div className="mt-3 space-y-4">
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
    </Panel>
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
    <Panel>
      <PanelHeader
        icon={<ShieldAlert className="size-5" />}
        title={copy.stepRevoke}
        subtitle={copy.revokeHelp}
      />
      <form
        onSubmit={(event) => {
          event.preventDefault();
          view.requestRevoke();
        }}
        className="mt-3 grid gap-3 lg:grid-cols-[minmax(280px,1fr)_180px_minmax(240px,1fr)_auto] lg:items-end"
      >
        <Field
          id="publisher-key-revoke-id"
          label={copy.publisherKeyId}
          value={view.revokeDraft.publisherKeyId}
          onChange={(value) =>
            view.setRevokeDraftField("publisherKeyId", value)
          }
          direction="ltr"
          error={fieldErrorOrNull(copy, view.revokeErrors.publisherKeyId)}
          disabled={!view.permissions.canRegisterOrRevoke}
        />
        <Field
          id="publisher-key-revoke-revision"
          label={copy.revision}
          value={view.revokeDraft.expectedRevision}
          onChange={(value) =>
            view.setRevokeDraftField("expectedRevision", value)
          }
          inputMode="numeric"
          error={fieldErrorOrNull(copy, view.revokeErrors.expectedRevision)}
          disabled={!view.permissions.canRegisterOrRevoke}
        />
        <Field
          id="publisher-key-revoke-reason"
          label={copy.reasonCode}
          value={view.revokeDraft.reasonCode}
          onChange={(value) => view.setRevokeDraftField("reasonCode", value)}
          placeholder="KEY_COMPROMISED"
          error={fieldErrorOrNull(copy, view.revokeErrors.reasonCode)}
          disabled={!view.permissions.canRegisterOrRevoke}
        />
        <button
          type="submit"
          disabled={
            !view.permissions.canRegisterOrRevoke ||
            view.mutation.state === "PENDING" ||
            view.mutation.exactRetryAvailable
          }
          className="rounded-lg bg-rose-700 px-4 py-2 text-sm font-black text-white hover:bg-rose-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {copy.reviewRevoke}
        </button>
      </form>
      <div className="mt-3 flex flex-wrap gap-2">
        <PermissionNote>{copy.expectedStatus}: ACTIVE</PermissionNote>
        {!view.permissions.canRegisterOrRevoke ? (
          <PermissionNote>{copy.criticalPermission}</PermissionNote>
        ) : null}
      </div>
    </Panel>
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
    <Panel>
      <PanelHeader
        icon={<KeyRound className="size-5" />}
        title={copy.stepChallenge}
        subtitle={copy.challengeHelp}
      />
      {!view.permissions.canManage ? (
        <StateNotice tone="warning" title={copy.noWriteAccess} body={copy.managePermission} />
      ) : (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            view.requestChallenge();
          }}
          className="mt-3 space-y-3"
        >
          <Field
            id="publisher-key-id"
            label={copy.keyId}
            value={view.challengeDraft.keyId}
            onChange={(value) => view.setChallengeDraftField("keyId", value)}
            placeholder="core-release-primary"
            error={fieldErrorOrNull(copy, view.challengeErrors.keyId)}
          />
          <Field
            id="publisher-public-key"
            label={copy.publicKey}
            value={view.challengeDraft.publicKeyBase64}
            onChange={(value) =>
              view.setChallengeDraftField("publicKeyBase64", value)
            }
            placeholder="AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="
            direction="ltr"
            error={fieldErrorOrNull(copy, view.challengeErrors.publicKeyBase64)}
          />
          <Field
            id="publisher-challenge-expiry"
            label={`${copy.expiresIn} (${copy.seconds})`}
            value={view.challengeDraft.expiresInSeconds}
            onChange={(value) =>
              view.setChallengeDraftField("expiresInSeconds", value)
            }
            inputMode="numeric"
            error={fieldErrorOrNull(copy, view.challengeErrors.expiresInSeconds)}
          />
          <PermissionNote>{copy.noPrivateKey}</PermissionNote>
          <button
            type="submit"
            disabled={
              view.mutation.state === "PENDING" ||
              view.mutation.exactRetryAvailable
            }
            className="rounded-lg bg-violet-700 px-4 py-2 text-sm font-black text-white hover:bg-violet-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {copy.createChallenge}
          </button>
        </form>
      )}
      {result ? (
        <div className="mt-4 space-y-3 rounded-xl border border-emerald-300 bg-emerald-50 p-4 dark:border-emerald-900 dark:bg-emerald-950/20">
          <h3 className="flex items-center gap-2 font-black text-emerald-900 dark:text-emerald-100">
            <CheckCircle2 className="size-4" aria-hidden="true" />
            {copy.challengeReady}
          </h3>
          <Detail label={copy.challengeId}><CodeValue>{result.data.challengeId}</CodeValue></Detail>
          <Detail label={copy.payload}><CodeValue>{result.data.payloadBase64}</CodeValue></Detail>
          <Detail label={copy.digest}><CodeValue>{result.data.signingDigest}</CodeValue></Detail>
          <Detail label={copy.fingerprint}><CodeValue>{result.data.publicKeyFingerprint}</CodeValue></Detail>
          <Detail label={copy.expiresAt}>{result.data.expiresAt}</Detail>
          <p className="text-xs font-semibold leading-5 text-emerald-800 dark:text-emerald-200">{copy.encoding}</p>
          <p className="text-xs text-emerald-800 dark:text-emerald-300">
            {copy.correlation}: <CodeValue>{result.correlationId}</CodeValue>
          </p>
        </div>
      ) : null}
    </Panel>
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
    <Panel>
      <PanelHeader
        icon={<ShieldCheck className="size-5" />}
        title={copy.stepRegister}
        subtitle={copy.registerHelp}
      />
      {!view.permissions.canManage ? (
        <StateNotice tone="warning" title={copy.noWriteAccess} body={copy.managePermission} />
      ) : (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            view.requestRegister();
          }}
          className="mt-3 space-y-3"
        >
          <Field
            id="publisher-register-challenge"
            label={copy.challengeId}
            value={view.registerDraft.challengeId}
            onChange={(value) =>
              view.setRegisterDraftField("challengeId", value)
            }
            direction="ltr"
            error={fieldErrorOrNull(copy, view.registerErrors.challengeId)}
          />
          <Field
            id="publisher-proof-signature"
            label={copy.signature}
            value={view.registerDraft.proofSignatureBase64}
            onChange={(value) =>
              view.setRegisterDraftField("proofSignatureBase64", value)
            }
            direction="ltr"
            placeholder="Base64 Ed25519 signature"
            error={fieldErrorOrNull(
              copy,
              view.registerErrors.proofSignatureBase64,
            )}
          />
          {!view.permissions.canCritical ? (
            <PermissionNote>{copy.noCriticalAccess} {copy.criticalPermission}</PermissionNote>
          ) : null}
          <button
            type="submit"
            disabled={
              !view.permissions.canRegisterOrRevoke ||
              view.mutation.state === "PENDING" ||
              view.mutation.exactRetryAvailable
            }
            className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-black text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {copy.reviewRegister}
          </button>
        </form>
      )}
    </Panel>
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
    <section
      aria-live="polite"
      className={`rounded-2xl border p-4 ${toneClasses(tone)}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-black">{title}</h2>
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
            <ActionButton onClick={view.retryExactMutation} icon={<RotateCcw className="size-4" />}>
              {copy.exactRetry}
            </ActionButton>
          ) : null}
          {mutation.state !== "PENDING" ? (
            <ActionButton onClick={view.clearMutation}>{copy.dismiss}</ActionButton>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function ConfirmationDialog({
  view,
  copy,
}: {
  view: PublisherKeysView;
  copy: PublisherKeyCopy;
}) {
  const intent = view.mutation.pendingIntent;
  const dialogRef = useRef<HTMLElement | null>(null);
  const closeRef = useRef(view.closeConfirmation);

  useEffect(() => {
    closeRef.current = view.closeConfirmation;
  }, [view.closeConfirmation]);

  useEffect(() => {
    if (!intent || (intent.kind !== "REGISTER" && intent.kind !== "REVOKE")) {
      return;
    }
    const returnFocus =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeRef.current();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      returnFocus?.focus();
    };
  }, [intent]);

  if (!intent || (intent.kind !== "REGISTER" && intent.kind !== "REVOKE")) {
    return null;
  }
  const register = intent.kind === "REGISTER";
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/75 p-4 backdrop-blur-sm">
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="publisher-key-confirm-title"
        className="w-full max-w-lg rounded-2xl border border-slate-300 bg-white p-5 shadow-2xl dark:border-slate-700 dark:bg-slate-950"
      >
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300">
            <AlertTriangle className="size-5" aria-hidden="true" />
          </span>
          <div>
            <h2 id="publisher-key-confirm-title" className="font-black">
              {register ? copy.confirmRegisterTitle : copy.confirmRevokeTitle}
            </h2>
            <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">
              {register ? copy.confirmRegisterBody : copy.confirmRevokeBody}
            </p>
          </div>
        </div>
        <dl className="mt-4 space-y-2 rounded-xl bg-slate-100 p-3 text-xs dark:bg-slate-900">
          {register ? (
            <Detail label={copy.challengeId}><CodeValue>{intent.command.challengeId}</CodeValue></Detail>
          ) : (
            <>
              <Detail label={copy.publisherKeyId}><CodeValue>{intent.publisherKeyId}</CodeValue></Detail>
              <Detail label={copy.revision}>{intent.command.expectedRevision}</Detail>
              <Detail label={copy.expectedStatus}>{intent.command.expectedStatus}</Detail>
              <Detail label={copy.reasonCode}><CodeValue>{intent.command.reasonCode}</CodeValue></Detail>
            </>
          )}
        </dl>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={view.closeConfirmation}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-black hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
          >
            {copy.cancel}
          </button>
          <button
            type="button"
            autoFocus
            onClick={view.confirmMutation}
            className="rounded-lg bg-rose-700 px-4 py-2 text-sm font-black text-white hover:bg-rose-800"
          >
            {copy.confirm}
          </button>
        </div>
      </section>
    </div>
  );
}

function Panel({ children }: { children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950">
      {children}
    </section>
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
        <span className="mt-0.5 text-violet-600 dark:text-violet-300" aria-hidden="true">{icon}</span>
        <div>
          <h2 className="font-black">{title}</h2>
          <p className="mt-1 text-xs leading-5 text-slate-600 dark:text-slate-400">{subtitle}</p>
        </div>
      </div>
      {action}
    </div>
  );
}

function ActionButton({
  children,
  onClick,
  disabled = false,
  icon,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  icon?: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-black text-slate-800 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
    >
      {icon}
      {children}
    </button>
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
    <div className={`mt-3 rounded-xl border p-4 text-sm ${toneClasses(tone)}`}>
      <div className="flex items-start gap-2">
        {loading ? <Loader2 className="mt-0.5 size-4 animate-spin" aria-hidden="true" /> : <AlertTriangle className="mt-0.5 size-4" aria-hidden="true" />}
        <div className="min-w-0 flex-1">
          <p className="font-black">{title}</p>
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

function Field({
  id,
  label,
  value,
  onChange,
  error,
  placeholder,
  disabled = false,
  direction,
  inputMode,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error: string | null;
  placeholder?: string;
  disabled?: boolean;
  direction?: "ltr";
  inputMode?: "numeric";
}) {
  const errorId = `${id}-error`;
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-xs font-black text-slate-700 dark:text-slate-300">{label}</label>
      <input
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        dir={direction}
        inputMode={inputMode}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
        autoComplete="off"
        spellCheck={false}
        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900"
      />
      {error ? <p id={errorId} className="mt-1 text-xs font-semibold text-rose-700 dark:text-rose-300">{error}</p> : null}
    </div>
  );
}

function PermissionNote({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900 dark:border-amber-900 dark:bg-amber-950/25 dark:text-amber-200">
      {children}
    </p>
  );
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</p>
      <div className="mt-1 break-words text-sm font-semibold">{children}</div>
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
    <p className="mt-3 text-[11px] text-slate-500 dark:text-slate-400">
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
    <span className={`inline-flex rounded-full px-2 py-1 text-[11px] font-black ${status === "ACTIVE" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" : "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300"}`}>
      {status === "ACTIVE" ? copy.active : copy.revoked}
    </span>
  );
}

function CodeValue({ children }: { children: ReactNode }) {
  return <code dir="ltr" className="break-all font-mono text-[0.9em]">{children}</code>;
}

function Th({ children }: { children: ReactNode }) {
  return <th scope="col" className="px-3 py-2.5 text-start font-black">{children}</th>;
}

function Td({ children }: { children: ReactNode }) {
  return <td className="px-3 py-3 align-top">{children}</td>;
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
    neutral: "border-slate-200 bg-slate-50 text-slate-800 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200",
    warning: "border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/25 dark:text-amber-100",
    danger: "border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/25 dark:text-rose-100",
    success: "border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/25 dark:text-emerald-100",
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
