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
        className="space-y-5 rounded-2xl border border-amber-200 bg-white p-5 shadow-2xs dark:border-amber-900/70 dark:bg-slate-900"
      >
        <div>
          <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-slate-100">
            <ShieldAlert className="size-4 text-amber-600 dark:text-amber-400" />
            {copy.title}
          </h2>
          <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
            {copy.description}
          </p>
        </div>

        <div className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <div>
            <p className="text-xs font-bold">{copy.warningTitle}</p>
            <p className="mt-1 text-[11px] leading-5">{copy.warningDescription}</p>
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
              className="space-y-1.5 text-xs font-bold text-slate-700 dark:text-slate-300"
            >
              <span>{copy.target}</span>
              <span className="relative block">
                {replay.draft.target === "CONTROL_PLANE" ? (
                  <ServerCog className="pointer-events-none absolute start-3 top-3 size-4 text-slate-400" />
                ) : (
                  <Database className="pointer-events-none absolute start-3 top-3 size-4 text-slate-400" />
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
            <span className="block text-end text-[10px] font-medium text-slate-400">
              {replay.draft.reason.length}/{AUTH_INVALIDATION_REPLAY_REASON_MAX_LENGTH} {copy.characters}
            </span>
          </Field>

          {replay.validationErrors.workflow ? (
            <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-semibold text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
              {copy.validation[replay.validationErrors.workflow]}
            </p>
          ) : null}

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {copy.dryRunRequired}
            </p>
            <div className="flex shrink-0 gap-2">
              <button
                type="submit"
                disabled={isPending}
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-blue-200 px-4 text-xs font-bold text-blue-700 hover:bg-blue-50 disabled:opacity-50 dark:border-blue-900 dark:text-blue-300 dark:hover:bg-blue-950/30"
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
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 text-xs font-bold text-white shadow-sm hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-40"
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
            className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200"
          >
            <p className="flex items-center gap-2 text-xs font-bold">
              <CheckCircle2 className="size-4" />
              {replay.receipt.mode === "DRY_RUN"
                ? copy.success.dryTitle
                : copy.success.applyTitle}
            </p>
            <p className="mt-1 text-[11px] leading-5">
              {replay.receipt.mode === "DRY_RUN"
                ? copy.success.dryDescription
                : copy.success.applyDescription}
            </p>
            <dl className="mt-3 grid gap-2 text-[11px] sm:grid-cols-2">
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
            className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-rose-900 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200"
          >
            <p className="text-xs font-bold">{copy.failure.title}</p>
            <p className="mt-1 text-[11px] leading-5">
              {copy.apiErrors[apiErrorCopyKey(replay.error)]}
            </p>
            <dl className="mt-3 grid gap-2 text-[11px] sm:grid-cols-2">
              <Evidence label={copy.failure.code} value={replay.error.errorCode} mono />
              {replay.error.correlationId ? (
                <Evidence label={copy.failure.correlation} value={replay.error.correlationId} mono />
              ) : null}
            </dl>
            {replay.retryMode ? (
              <div className="mt-3 border-t border-rose-200 pt-3 dark:border-rose-900">
                <p className="text-[11px] leading-5">{copy.failure.retryNotice}</p>
                <button
                  type="button"
                  onClick={() => replay.requestConfirmation(replay.retryMode as AuthInvalidationReplayMode)}
                  disabled={isPending}
                  className="mt-2 inline-flex min-h-9 items-center gap-2 rounded-xl border border-rose-300 px-3 text-xs font-bold hover:bg-rose-100 disabled:opacity-50 dark:border-rose-800 dark:hover:bg-rose-950/50"
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
    <div className="space-y-1.5 text-xs font-bold text-slate-700 dark:text-slate-300">
      <label htmlFor={inputId} className="block">{label}</label>
      {children}
      {hint ? <span id={hintId} className="block text-[10px] font-medium leading-4 text-slate-500 dark:text-slate-400">{hint}</span> : null}
      {error ? <span id={errorId} className="block text-[10px] font-semibold text-rose-600 dark:text-rose-400">{error}</span> : null}
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
      <dd className={`mt-0.5 break-all ${mono ? "font-mono" : "font-bold"}`}>{value}</dd>
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
  "w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-medium text-slate-900 outline-none transition-colors focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-100";
