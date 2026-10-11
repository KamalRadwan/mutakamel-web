"use client";

import type { ReactNode } from "react";
import { CircleX, RefreshCw, TriangleAlert, Undo2 } from "lucide-react";
import { Button, CodeRef, cn } from "@/design-system";
import { formatLocaleNumber, localeForLanguage } from "@/i18n/locale";
import type { NormalizedApiError } from "@/shared/api/normalized-api-error";
import {
  isTenantDestroyAdvancing,
  tenantDestroyHaltedPhase,
} from "../model/destroy";
import type { TenantDestroyPhase, TenantDestroyView } from "../types";
import {
  tenantDestroyReasonLabel,
  tenantWorkspaceCopy,
  type TenantWorkspaceLocale,
} from "./copy";

export interface TenantDestroyStatusProps {
  /** Root id; `${id}-hint` explains why restore and destroy are unavailable. */
  id: string;
  locale: TenantWorkspaceLocale;
  operation: TenantDestroyView | null;
  loadError: NormalizedApiError | null;
  polling: boolean;
  /** Core refused an abandon because the drop was already authorized (409 `TENANT_DESTROY_NOT_ABANDONABLE`). */
  notAbandonable: boolean;
  /** What the operator's last resume of this request answered, while it still applies. */
  resumeNotice?: string | null;
  onRefresh: () => void;
}

const PHASE_TONE: Record<TenantDestroyPhase, string> = {
  STOPPING_PROVISIONING:
    "border-info/30 bg-info-subtle text-info-subtle-foreground",
  DROPPING_DATABASE: "border-info/30 bg-info-subtle text-info-subtle-foreground",
  FINALIZING: "border-info/30 bg-info-subtle text-info-subtle-foreground",
  SUCCEEDED: "border-border bg-muted text-foreground",
  BLOCKED:
    "border-warning/30 bg-warning-subtle text-warning-subtle-foreground",
  ABANDONED: "border-border bg-muted text-foreground",
};

/**
 * Destruction progress for a soft-deleted tenant. The phase and its
 * explanation form one polite live region; the evidence below it is not
 * live, so a background refresh of attempts or times is not re-announced.
 */
export function TenantDestroyStatus({
  id,
  locale,
  operation,
  loadError,
  polling,
  notAbandonable,
  resumeNotice = null,
  onRefresh,
}: TenantDestroyStatusProps) {
  const text = tenantWorkspaceCopy(locale);

  if (!operation) {
    if (!loadError) return null;
    return (
      <div
        id={id}
        role="alert"
        className="space-y-2 rounded-lg border border-destructive/30 bg-destructive-subtle p-3 text-xs text-destructive-subtle-foreground"
      >
        <p className="flex items-center gap-1.5 font-semibold">
          <CircleX className="size-3.5 shrink-0" aria-hidden="true" />
          {text.destroyLoadFailed}
        </p>
        <ErrorEvidence error={loadError} correlationLabel={text.correlation} />
        <Button type="button" size="xs" variant="outline" onClick={onRefresh}>
          {text.destroyRefresh}
        </Button>
      </div>
    );
  }

  const { phase } = operation;
  const advancing = isTenantDestroyAdvancing(phase);
  // A request BLOCKED after the drop was authorized halted in place: it can
  // only be resumed, never abandoned, so it is titled and explained apart
  // from a stop that blocked before the drop (resume or abandon).
  const halted = tenantDestroyHaltedPhase(operation);
  const title = halted ? text.destroyHaltedPhases[halted] : text.destroyPhases[phase];
  const hint = halted ? text.destroyHaltedHints[halted] : text.destroyPhaseHints[phase];
  const Icon =
    phase === "BLOCKED" ? TriangleAlert : phase === "ABANDONED" ? Undo2 : RefreshCw;

  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className={cn("space-y-2 rounded-lg border p-3 text-xs", PHASE_TONE[phase])}
    >
      <div role="status" aria-live="polite" aria-atomic="true">
        <p id={`${id}-title`} className="flex items-center gap-1.5 font-semibold">
          <Icon
            className={cn(
              "size-3.5 shrink-0",
              polling && "animate-spin motion-reduce:animate-none",
            )}
            aria-hidden="true"
          />
          {title}
        </p>
        <p id={`${id}-hint`} className="mt-1">
          {hint}
        </p>
        {resumeNotice ? <p className="mt-1 font-medium">{resumeNotice}</p> : null}
      </div>

      <dl className="grid grid-cols-[auto_minmax(0,1fr)] items-baseline gap-x-3 gap-y-1">
        {operation.blockedReason ? (
          <Detail label={phase === "BLOCKED" ? text.destroyReason : text.destroyBlockedBy}>
            <SafeCode locale={locale} code={operation.blockedReason} />
          </Detail>
        ) : null}
        {advancing && operation.lastErrorCode ? (
          <Detail label={text.destroyLatestAttempt}>
            <SafeCode locale={locale} code={operation.lastErrorCode} />
          </Detail>
        ) : null}
        {operation.blockingOperationId ? (
          <Detail label={text.destroyBlockingOperation}>
            <CodeRef value={operation.blockingOperationId} />
          </Detail>
        ) : null}
        {advancing || phase === "BLOCKED" ? (
          <Detail label={text.destroyAttempts}>
            {formatLocaleNumber(locale, operation.attempts)}
          </Detail>
        ) : null}
        {operation.nextAttemptAt ? (
          <Detail label={text.destroyNextAttempt}>
            <Instant value={operation.nextAttemptAt} locale={locale} />
          </Detail>
        ) : null}
        {operation.blockedAt ? (
          <Detail label={text.destroyBlockedAt}>
            <Instant value={operation.blockedAt} locale={locale} />
          </Detail>
        ) : null}
        {operation.abandonedAt ? (
          <Detail label={text.destroyAbandonedAt}>
            <Instant value={operation.abandonedAt} locale={locale} />
          </Detail>
        ) : null}
        <Detail label={text.destroyRequestedAt}>
          <Instant value={operation.requestedAt} locale={locale} />
        </Detail>
        <Detail label={text.destroyUpdatedAt}>
          <Instant value={operation.updatedAt} locale={locale} />
        </Detail>
        <Detail label={text.destroyRequest}>
          <CodeRef value={operation.operationId} />
        </Detail>
      </dl>

      {notAbandonable ? (
        <p className="font-medium">{text.destroyNotAbandonable}</p>
      ) : null}
      {loadError ? (
        <div className="space-y-1">
          <p>{text.destroyRefreshFailed}</p>
          <ErrorEvidence error={loadError} correlationLabel={text.correlation} />
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        {advancing ? <span>{text.destroyAutoRefresh}</span> : null}
        <Button
          type="button"
          variant="link"
          size="xs"
          className="px-0"
          onClick={onRefresh}
        >
          {text.destroyRefresh}
        </Button>
      </div>
    </section>
  );
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="font-medium">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </>
  );
}

/** A localized label for a known code; the code itself is always kept as evidence. */
function SafeCode({ locale, code }: { locale: TenantWorkspaceLocale; code: string }) {
  const label = tenantDestroyReasonLabel(locale, code);
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      {label ? <span>{label}</span> : null}
      <CodeRef value={code} />
    </span>
  );
}

function ErrorEvidence({
  error,
  correlationLabel,
}: {
  error: NormalizedApiError;
  correlationLabel: string;
}) {
  return (
    <>
      <p className="break-words">{error.message}</p>
      <p className="flex flex-wrap items-center gap-1.5">
        <CodeRef value={error.errorCode} />
        {error.correlationId ? (
          <>
            <span>{correlationLabel}</span>
            <CodeRef value={error.correlationId} />
          </>
        ) : null}
      </p>
    </>
  );
}

/** Server instants with seconds and zone: Worker schedules attempts seconds apart. */
function Instant({ value, locale }: { value: string; locale: TenantWorkspaceLocale }) {
  return (
    <time dateTime={value}>
      {new Intl.DateTimeFormat(localeForLanguage(locale), {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        timeZoneName: "short",
      }).format(new Date(value))}
    </time>
  );
}
