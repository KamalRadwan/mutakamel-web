"use client";

import {
  AlertTriangle,
  CheckCircle2,
  Database,
  Loader2,
  RotateCcw,
  ServerCog,
  ShieldAlert,
} from "lucide-react";
import { DestructiveActionModal } from "@/components/shared/DestructiveActionModal";
import { useAuth } from "@/context/AuthContext";
import { useI18n } from "@/i18n/I18nContext";
import { adminCan } from "@/lib/auth/rbac";
import type { NormalizedApiError } from "@/shared/api/normalized-api-error";
import {
  AUTH_INVALIDATION_REPLAY_PERMISSION,
  AUTH_INVALIDATION_REPLAY_REASON_MAX_LENGTH,
  type AuthInvalidationReplayMode,
  type AuthInvalidationReplayValidationCode,
} from "../authInvalidationReplay";
import { useAuthInvalidationReplay } from "../hooks/useAuthInvalidationReplay";

export function AuthInvalidationReplayPanel() {
  const { user } = useAuth();
  if (!adminCan(user, AUTH_INVALIDATION_REPLAY_PERMISSION)) return null;
  return <AuthorizedAuthInvalidationReplayPanel />;
}

function AuthorizedAuthInvalidationReplayPanel() {
  const { t } = useI18n();
  const copy = t.authActions.invalidationReplay;
  const replay = useAuthInvalidationReplay();
  const isPending = replay.pendingMode !== null;
  const confirmationMode = replay.confirmationMode;
  const targetLabel = replay.draft.target === "CONTROL_PLANE"
    ? copy.controlPlaneTarget
    : copy.tenantTarget;
  const confirmationTarget = confirmationMode === "APPLY"
    ? copy.confirmation.applyToken
    : `${targetLabel} · ${replay.eventCount} ${copy.events}`;

  return (
    <>
      <section
        aria-busy={isPending}
        className="space-y-5 rounded-xl border border-warn-200 bg-white p-5 shadow-2xs dark:border-warn-900/70 dark:bg-ink-900"
      >
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <ShieldAlert className="size-4 text-warn-600 dark:text-warn-400" />
            {copy.title}
          </h2>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            {copy.description}
          </p>
        </div>

        <div className="flex gap-3 rounded-xl border border-warn-200 bg-warn-50 p-3 text-warn-900 dark:border-warn-900 dark:bg-warn-950/30 dark:text-warn-200">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <div>
            <p className="text-xs font-semibold">{copy.warningTitle}</p>
            <p className="mt-1 text-xs leading-5">{copy.warningDescription}</p>
          </div>
        </div>

        <form
          noValidate
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            replay.requestConfirmation("DRY_RUN");
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <label
              htmlFor="replay-target"
              className="space-y-1.5 text-xs font-semibold text-foreground"
            >
              <span>{copy.target}</span>
              <span className="relative block">
                {replay.draft.target === "CONTROL_PLANE" ? (
                  <ServerCog className="pointer-events-none absolute start-3 top-3 size-4 text-muted-foreground" />
                ) : (
                  <Database className="pointer-events-none absolute start-3 top-3 size-4 text-muted-foreground" />
                )}
                <select
                  id="replay-target"
                  value={replay.draft.target}
                  onChange={(event) => replay.setTarget(
                    event.target.value as "CONTROL_PLANE" | "TENANT",
                  )}
                  disabled={isPending}
                  className={`${inputClass} ps-9`}
                >
                  <option value="CONTROL_PLANE">{copy.controlPlaneTarget}</option>
                  <option value="TENANT">{copy.tenantTarget}</option>
                </select>
              </span>
            </label>

            {replay.draft.target === "TENANT" ? (
              <Field inputId="replay-tenant" label={copy.tenantId} error={validationText(
                replay.validationErrors.tenantId,
                copy.validation,
              )} errorId="replay-tenant-error">
                <input
                  id="replay-tenant"
                  value={replay.draft.tenantId}
                  onChange={(event) => replay.setTenantId(event.target.value)}
                  disabled={isPending}
                  maxLength={36}
                  autoComplete="off"
                  spellCheck={false}
                  placeholder={copy.tenantIdPlaceholder}
                  aria-invalid={Boolean(replay.validationErrors.tenantId)}
                  aria-describedby={replay.validationErrors.tenantId
                    ? "replay-tenant-error"
                    : undefined}
                  className={`${inputClass} font-mono`}
                />
              </Field>
            ) : null}
          </div>

          <Field
            inputId="replay-events"
            label={copy.eventIds}
            hint={copy.eventIdsHint}
            error={validationText(replay.validationErrors.eventIds, copy.validation)}
            errorId="replay-events-error"
          >
            <textarea
              id="replay-events"
              value={replay.draft.eventIdsText}
              onChange={(event) => replay.setEventIdsText(event.target.value)}
              disabled={isPending}
              rows={5}
              autoComplete="off"
              spellCheck={false}
              placeholder={copy.eventIdsPlaceholder}
              aria-invalid={Boolean(replay.validationErrors.eventIds)}
              aria-describedby={replay.validationErrors.eventIds
                ? "replay-events-hint replay-events-error"
                : "replay-events-hint"}
              className={`${inputClass} resize-y font-mono leading-6`}
            />
          </Field>

          <Field
            inputId="replay-reason"
            label={copy.reason}
            hint={copy.reasonHint}
            error={validationText(replay.validationErrors.reason, copy.validation)}
            errorId="replay-reason-error"
          >
            <textarea
              id="replay-reason"
              value={replay.draft.reason}
              onChange={(event) => replay.setReason(event.target.value)}
              disabled={isPending}
              rows={3}
              maxLength={AUTH_INVALIDATION_REPLAY_REASON_MAX_LENGTH}
              aria-invalid={Boolean(replay.validationErrors.reason)}
              aria-describedby={replay.validationErrors.reason
                ? "replay-reason-hint replay-reason-error"
                : "replay-reason-hint"}
              className={`${inputClass} resize-y leading-5`}
            />
            <span className="block text-end text-xs font-medium text-muted-foreground">
              {replay.draft.reason.length}/{AUTH_INVALIDATION_REPLAY_REASON_MAX_LENGTH} {copy.characters}
            </span>
          </Field>

          {replay.validationErrors.workflow ? (
            <p role="alert" className="rounded-xl border border-warn-200 bg-warn-50 p-3 text-xs font-semibold text-warn-800 dark:border-warn-900 dark:bg-warn-950/30 dark:text-warn-200">
              {copy.validation[replay.validationErrors.workflow]}
            </p>
          ) : null}

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-muted-foreground">
              {copy.dryRunRequired}
            </p>
            <div className="flex shrink-0 gap-2">
              <button
                type="submit"
                disabled={isPending}
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-brand-200 px-4 text-xs font-semibold text-brand-700 hover:bg-brand-50 disabled:opacity-50 dark:border-brand-900 dark:text-brand-300 dark:hover:bg-brand-950/30"
              >
                {replay.pendingMode === "DRY_RUN" ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="size-4" />
                )}
                {replay.pendingMode === "DRY_RUN" ? copy.dryRunning : copy.dryRun}
              </button>
              <button
                type="button"
                onClick={() => replay.requestConfirmation("APPLY")}
                disabled={isPending || !replay.canApply}
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-danger-600 px-4 text-xs font-semibold text-white shadow-sm hover:bg-danger-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {replay.pendingMode === "APPLY" ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <RotateCcw className="size-4" />
                )}
                {replay.pendingMode === "APPLY" ? copy.applying : copy.apply}
              </button>
            </div>
          </div>
        </form>

        {replay.receipt ? (
          <div
            role="status"
            aria-live="polite"
            className="rounded-xl border border-brand-200 bg-brand-50 p-4 text-brand-900 dark:border-brand-900 dark:bg-brand-950/30 dark:text-brand-200"
          >
            <p className="flex items-center gap-2 text-xs font-semibold">
              <CheckCircle2 className="size-4" />
              {replay.receipt.mode === "DRY_RUN"
                ? copy.success.dryTitle
                : copy.success.applyTitle}
            </p>
            <p className="mt-1 text-xs leading-5">
              {replay.receipt.mode === "DRY_RUN"
                ? copy.success.dryDescription
                : copy.success.applyDescription}
            </p>
            <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
              <Evidence label={copy.success.commandId} value={replay.receipt.commandId} mono />
              <Evidence label={copy.success.eligible} value={String(replay.receipt.eligibleEventCount)} />
              <Evidence label={copy.success.replayed} value={String(replay.receipt.replayedEventCount)} />
              {replay.receipt.correlationId ? (
                <Evidence label={copy.success.correlation} value={replay.receipt.correlationId} mono />
              ) : null}
            </dl>
          </div>
        ) : null}

        {replay.error ? (
          <div
            role="alert"
            className="rounded-xl border border-danger-200 bg-danger-50 p-4 text-danger-900 dark:border-danger-900 dark:bg-danger-950/30 dark:text-danger-200"
          >
            <p className="text-xs font-semibold">{copy.failure.title}</p>
            <p className="mt-1 text-xs leading-5">
              {copy.apiErrors[apiErrorCopyKey(replay.error)]}
            </p>
            <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
              <Evidence label={copy.failure.code} value={replay.error.errorCode} mono />
              {replay.error.correlationId ? (
                <Evidence label={copy.failure.correlation} value={replay.error.correlationId} mono />
              ) : null}
            </dl>
            {replay.retryMode ? (
              <div className="mt-3 border-t border-danger-200 pt-3 dark:border-danger-900">
                <p className="text-xs leading-5">{copy.failure.retryNotice}</p>
                <button
                  type="button"
                  onClick={() => replay.requestConfirmation(replay.retryMode as AuthInvalidationReplayMode)}
                  disabled={isPending}
                  className="mt-2 inline-flex min-h-9 items-center gap-2 rounded-xl border border-danger-300 px-3 text-xs font-semibold hover:bg-danger-100 disabled:opacity-50 dark:border-danger-800 dark:hover:bg-danger-950/50"
                >
                  <RotateCcw className="size-4" />
                  {copy.failure.retryExact}
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
      </section>

      <DestructiveActionModal
        isOpen={confirmationMode !== null}
        onClose={replay.closeConfirmation}
        onConfirm={() => void replay.confirm()}
        title={confirmationMode === "APPLY"
          ? copy.confirmation.applyTitle
          : copy.confirmation.dryTitle}
        description={confirmationMode === "APPLY"
          ? copy.confirmation.applyDescription
          : copy.confirmation.dryDescription}
        targetName={confirmationTarget}
        actionType={confirmationMode === "APPLY" ? "revoke-session" : "change-password"}
        requireNameTyping={confirmationMode === "APPLY"}
        isSubmitting={replay.pendingMode === confirmationMode}
        confirmLabel={confirmationMode === "APPLY"
          ? copy.confirmation.applyConfirm
          : copy.confirmation.dryConfirm}
        submittingLabel={confirmationMode === "APPLY"
          ? copy.confirmation.applySubmitting
          : copy.confirmation.drySubmitting}
      />
    </>
  );
}

function Field({
  inputId,
  label,
  hint,
  error,
  errorId,
  children,
}: {
  inputId: string;
  label: string;
  hint?: string;
  error?: string;
  errorId: string;
  children: React.ReactNode;
}) {
  const hintId = errorId.replace(/-error$/, "-hint");
  return (
    <div className="space-y-1.5 text-xs font-semibold text-foreground">
      <label htmlFor={inputId} className="block">{label}</label>
      {children}
      {hint ? <span id={hintId} className="block text-xs font-medium leading-4 text-muted-foreground">{hint}</span> : null}
      {error ? <span id={errorId} className="block text-xs font-semibold text-danger-600 dark:text-danger-400">{error}</span> : null}
    </div>
  );
}

function Evidence({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <dt className="font-semibold opacity-70">{label}</dt>
      <dd className={`mt-0.5 break-all ${mono ? "font-mono" : "font-semibold"}`}>{value}</dd>
    </div>
  );
}

function validationText(
  code: AuthInvalidationReplayValidationCode | undefined,
  messages: Record<AuthInvalidationReplayValidationCode, string>,
): string | undefined {
  return code ? messages[code] : undefined;
}

type ReplayApiErrorCopyKey =
  | "permission"
  | "commandInvalid"
  | "targetInvalid"
  | "tenantUnavailable"
  | "commandConflict"
  | "eventNotFound"
  | "eventNotEligible"
  | "eventInvalid"
  | "auditInvalid"
  | "inFlight"
  | "sessionChanged"
  | "validation"
  | "unknown";

function apiErrorCopyKey(error: NormalizedApiError): ReplayApiErrorCopyKey {
  if (error.httpStatus === 403) return "permission";
  switch (error.errorCode) {
    case "CORE.AUTH_INVALIDATION_REPLAY.COMMAND_ID_INVALID":
      return "commandInvalid";
    case "CORE.AUTH_INVALIDATION_REPLAY.TARGET_INVALID":
      return "targetInvalid";
    case "CORE.AUTH_INVALIDATION_REPLAY.TENANT_UNAVAILABLE":
      return "tenantUnavailable";
    case "CORE.AUTH_INVALIDATION_REPLAY.COMMAND_CONFLICT":
      return "commandConflict";
    case "CORE.AUTH_INVALIDATION_REPLAY.EVENT_NOT_FOUND":
      return "eventNotFound";
    case "CORE.AUTH_INVALIDATION_REPLAY.EVENT_NOT_ELIGIBLE":
      return "eventNotEligible";
    case "CORE.AUTH_INVALIDATION_REPLAY.EVENT_INVALID":
      return "eventInvalid";
    case "CORE.AUTH_INVALIDATION_REPLAY.AUDIT_EVIDENCE_INVALID":
      return "auditInvalid";
    case "GW.IDEM.IN_FLIGHT":
      return "inFlight";
    case "AUTH_SESSION_CHANGED":
      return "sessionChanged";
    case "COMMON.VALIDATION.FAILED":
      return "validation";
    default:
      return "unknown";
  }
}

const inputClass =
  "w-full rounded-lg border border-border bg-ink-100 px-3 py-2.5 text-xs font-medium text-foreground outline-none transition-colors focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-ink-800/60";
