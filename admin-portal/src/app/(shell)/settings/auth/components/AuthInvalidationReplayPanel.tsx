"use client";

import {
  AlertTriangle,
  CheckCircle2,
  Database,
  Key,
  RotateCcw,
  ServerCog,
  ShieldAlert,
} from "lucide-react";
import {
  AmbiguousOutcomePanel,
  Button,
  CodeRef,
  ConfirmActionModal,
  Field,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from "@/design-system";
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
            <Field label={copy.target}>
              {(fieldProps) => (
                <Select
                  value={replay.draft.target}
                  onValueChange={(value) => replay.setTarget(
                    value as "CONTROL_PLANE" | "TENANT",
                  )}
                  disabled={isPending}
                >
                  <SelectTrigger {...fieldProps}>
                    <span className="flex items-center gap-2">
                      {replay.draft.target === "CONTROL_PLANE" ? (
                        <ServerCog className="size-4 shrink-0 text-muted-foreground" />
                      ) : (
                        <Database className="size-4 shrink-0 text-muted-foreground" />
                      )}
                      <SelectValue />
                    </span>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CONTROL_PLANE">{copy.controlPlaneTarget}</SelectItem>
                    <SelectItem value="TENANT">{copy.tenantTarget}</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </Field>

            {replay.draft.target === "TENANT" ? (
              <Field
                label={copy.tenantId}
                error={validationText(replay.validationErrors.tenantId, copy.validation)}
              >
                {(fieldProps) => (
                  <Input
                    {...fieldProps}
                    value={replay.draft.tenantId}
                    onChange={(event) => replay.setTenantId(event.target.value)}
                    disabled={isPending}
                    maxLength={36}
                    autoComplete="off"
                    spellCheck={false}
                    placeholder={copy.tenantIdPlaceholder}
                    className="font-mono"
                  />
                )}
              </Field>
            ) : null}
          </div>

          <Field
            label={copy.eventIds}
            hint={copy.eventIdsHint}
            error={validationText(replay.validationErrors.eventIds, copy.validation)}
          >
            {(fieldProps) => (
              <Textarea
                {...fieldProps}
                value={replay.draft.eventIdsText}
                onChange={(event) => replay.setEventIdsText(event.target.value)}
                disabled={isPending}
                rows={5}
                autoComplete="off"
                spellCheck={false}
                placeholder={copy.eventIdsPlaceholder}
                className="resize-y font-mono leading-6"
              />
            )}
          </Field>

          <Field
            label={copy.reason}
            hint={copy.reasonHint}
            error={validationText(replay.validationErrors.reason, copy.validation)}
          >
            {(fieldProps) => (
              <>
                <Textarea
                  {...fieldProps}
                  value={replay.draft.reason}
                  onChange={(event) => replay.setReason(event.target.value)}
                  disabled={isPending}
                  rows={3}
                  maxLength={AUTH_INVALIDATION_REPLAY_REASON_MAX_LENGTH}
                  className="resize-y leading-5"
                />
                <span className="block text-end text-xs font-medium text-muted-foreground">
                  {replay.draft.reason.length}/{AUTH_INVALIDATION_REPLAY_REASON_MAX_LENGTH} {copy.characters}
                </span>
              </>
            )}
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
              <Button
                type="submit"
                variant="outline"
                disabled={isPending}
                loading={replay.pendingMode === "DRY_RUN"}
              >
                {replay.pendingMode !== "DRY_RUN" && <CheckCircle2 className="size-4" />}
                {replay.pendingMode === "DRY_RUN" ? copy.dryRunning : copy.dryRun}
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={() => replay.requestConfirmation("APPLY")}
                disabled={isPending || !replay.canApply}
                loading={replay.pendingMode === "APPLY"}
              >
                {replay.pendingMode !== "APPLY" && <RotateCcw className="size-4" />}
                {replay.pendingMode === "APPLY" ? copy.applying : copy.apply}
              </Button>
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
              <Evidence label={copy.success.commandId} value={replay.receipt.commandId} code />
              <Evidence label={copy.success.eligible} value={String(replay.receipt.eligibleEventCount)} />
              <Evidence label={copy.success.replayed} value={String(replay.receipt.replayedEventCount)} />
              {replay.receipt.correlationId ? (
                <Evidence label={copy.success.correlation} value={replay.receipt.correlationId} code />
              ) : null}
            </dl>
          </div>
        ) : null}

        {replay.error ? (
          replay.retryMode ? (
            <AmbiguousOutcomePanel
              idempotencyKey={replay.retryIdempotencyKey ?? undefined}
              correlationId={replay.error.correlationId}
              message={`${copy.apiErrors[apiErrorCopyKey(replay.error)]} · ${replay.error.errorCode}`}
              onRetryExact={() => {
                replay.requestConfirmation(replay.retryMode as AuthInvalidationReplayMode);
              }}
              retrying={replay.pendingMode === replay.retryMode}
            />
          ) : (
            <div
              role="alert"
              className="rounded-xl border border-danger-200 bg-danger-50 p-4 text-danger-900 dark:border-danger-900 dark:bg-danger-950/30 dark:text-danger-200"
            >
              <p className="text-xs font-semibold">{copy.failure.title}</p>
              <p className="mt-1 text-xs leading-5">
                {copy.apiErrors[apiErrorCopyKey(replay.error)]}
              </p>
              <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
                <Evidence label={copy.failure.code} value={replay.error.errorCode} code />
                {replay.error.correlationId ? (
                  <Evidence label={copy.failure.correlation} value={replay.error.correlationId} code />
                ) : null}
              </dl>
            </div>
          )
        ) : null}
      </section>

      <ConfirmActionModal
        isOpen={confirmationMode !== null}
        onClose={replay.closeConfirmation}
        onConfirm={() => void replay.confirm()}
        titleEn={confirmationMode === "APPLY" ? copy.confirmation.applyTitle : copy.confirmation.dryTitle}
        titleAr={confirmationMode === "APPLY" ? copy.confirmation.applyTitle : copy.confirmation.dryTitle}
        descriptionEn={confirmationMode === "APPLY"
          ? copy.confirmation.applyDescription
          : copy.confirmation.dryDescription}
        descriptionAr={confirmationMode === "APPLY"
          ? copy.confirmation.applyDescription
          : copy.confirmation.dryDescription}
        variant={confirmationMode === "APPLY" ? "danger" : "info"}
        icon={confirmationMode === "APPLY" ? ShieldAlert : Key}
        requiredConfirmationText={confirmationMode === "APPLY" ? confirmationTarget : undefined}
        isLoading={replay.pendingMode === confirmationMode}
        confirmTextEn={confirmationMode === "APPLY"
          ? copy.confirmation.applyConfirm
          : copy.confirmation.dryConfirm}
        confirmTextAr={confirmationMode === "APPLY"
          ? copy.confirmation.applyConfirm
          : copy.confirmation.dryConfirm}
        loadingLabel={confirmationMode === "APPLY"
          ? copy.confirmation.applySubmitting
          : copy.confirmation.drySubmitting}
      />
    </>
  );
}

function Evidence({
  label,
  value,
  code = false,
}: {
  label: string;
  value: string;
  code?: boolean;
}) {
  return (
    <div>
      <dt className="font-semibold opacity-70">{label}</dt>
      <dd className="mt-0.5 break-all">
        {code ? <CodeRef value={value} /> : <span className="font-semibold">{value}</span>}
      </dd>
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
