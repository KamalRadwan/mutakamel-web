"use client";

import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Loader2,
  RefreshCw,
  ShieldAlert,
} from "lucide-react";
import { type ReactNode } from "react";
import type { NormalizedApiError } from "@/shared/api/normalized-api-error";
import {
  Button,
  Card,
  CodeRef,
  PageHeader,
} from "@/design-system";
import type { ProvisioningFleetCopy } from "./copy";
import type {
  FleetCommandView,
  FleetRequestState,
  FleetResult,
} from "./types";

export function FleetPageFrame({
  dir,
  children,
}: {
  dir: "ltr" | "rtl";
  children: ReactNode;
}) {
  return (
    <div dir={dir} className="mx-auto w-full max-w-[1500px] space-y-5">
      {children}
    </div>
  );
}

export function FleetHero({
  copy,
  action,
}: {
  copy: ProvisioningFleetCopy;
  action?: ReactNode;
}) {
  return <PageHeader title={copy.title} description={copy.subtitle} action={action} />;
}

export function FleetBackLink({
  href,
  label,
  dir,
}: {
  href: string;
  label: string;
  dir: "ltr" | "rtl";
}) {
  return (
    <Button asChild variant="ghost">
      <Link href={href}>
        {dir === "rtl" ? (
          <ArrowRight className="size-4" aria-hidden="true" />
        ) : (
          <ArrowLeft className="size-4" aria-hidden="true" />
        )}
        {label}
      </Link>
    </Button>
  );
}

export function RefreshButton({
  copy,
  onClick,
  pending,
}: {
  copy: ProvisioningFleetCopy;
  onClick: () => void;
  pending?: boolean;
}) {
  return (
    <Button type="button" variant="outline" onClick={onClick} loading={pending}>
      <RefreshCw className="size-4" aria-hidden="true" />
      {copy.refresh}
    </Button>
  );
}

export function FleetStatePanel({
  state,
  error,
  copy,
  forbidden,
  invalid,
  onRetry,
}: {
  state: FleetRequestState;
  error: NormalizedApiError | null;
  copy: ProvisioningFleetCopy;
  forbidden?: string;
  invalid?: string;
  onRetry?: () => void;
}) {
  if (state === "READY" || state === "EMPTY" || state === "IDLE") return null;
  const loading = state === "LOADING";
  const label = loading
    ? copy.loading
    : state === "FORBIDDEN"
      ? (forbidden ?? copy.forbiddenRollouts)
      : state === "NOT_FOUND"
        ? copy.notFound
        : state === "INVALID"
          ? (invalid ?? copy.contractError)
          : state === "UNAVAILABLE"
            ? copy.unavailable
            : copy.genericError;
  return (
    <Card>
      <section
        role={loading ? "status" : "alert"}
        aria-busy={loading}
        className="p-6 text-center"
      >
        {loading ? (
          <Loader2 className="mx-auto size-7 animate-spin text-muted-foreground" aria-hidden="true" />
        ) : (
          <AlertTriangle className="mx-auto size-7 text-warn-600 dark:text-warn-400" aria-hidden="true" />
        )}
        <p className="mt-3 text-sm font-semibold text-foreground">{label}</p>
        {error ? <FleetProblem error={error} /> : null}
        {!loading && onRetry ? (
          <Button type="button" variant="outline" onClick={onRetry} className="mt-4">
            {copy.retry}
          </Button>
        ) : null}
      </section>
    </Card>
  );
}

function FleetProblem({
  error,
}: {
  error: NormalizedApiError;
}) {
  return (
    <div className="mt-3 space-y-1.5 text-xs text-muted-foreground">
      <p>{error.message}</p>
      <div className="flex flex-wrap items-center justify-center gap-1.5">
        {error.errorCode && <CodeRef value={error.errorCode} />}
        {error.correlationId && <CodeRef value={error.correlationId} />}
      </div>
    </div>
  );
}

export function FleetCommandNotice<T>({
  view,
  copy,
  successLabel,
  onRetryExact,
  onClear,
  successAction,
}: {
  view: FleetCommandView<T>;
  copy: ProvisioningFleetCopy;
  successLabel?: string;
  onRetryExact: () => void;
  onClear: () => void;
  successAction?: ReactNode;
}) {
  if (view.state === "IDLE" || view.state === "PENDING") return null;
  const success = view.state === "SUCCESS";
  const text = success
    ? (successLabel ?? copy.commandSucceeded)
    : view.state === "AMBIGUOUS"
      ? copy.exactRetryHint
      : view.state === "STALE"
        ? copy.stale
        : view.state === "CONFLICT"
          ? copy.conflict
          : view.state === "FORBIDDEN"
            ? copy.permissionChanged
            : view.state === "VALIDATION"
              ? copy.validationFailed
              : copy.genericError;
  const correlation = readResultMeta(view.result)?.correlationId;
  return (
    <div
      role={success ? "status" : "alert"}
      className={`rounded-lg border p-4 text-sm ${
        success
          ? "border-brand-300 bg-brand-50 text-brand-950 dark:border-brand-900 dark:bg-brand-950/30 dark:text-brand-100"
          : "border-warn-300 bg-warn-50 text-warn-950 dark:border-warn-900 dark:bg-warn-950/30 dark:text-warn-100"
      }`}
    >
      <div className="flex items-start gap-2">
        {success ? (
          <CheckCircle2 className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
        ) : (
          <ShieldAlert className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
        )}
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{text}</p>
          {view.error && view.error.errorCode !== "ADMIN_PERMISSION_REQUIRED" ? (
            <FleetProblem error={view.error} />
          ) : null}
          {view.idempotencyKey ? (
            <div className="mt-2">
              <CodeRef value={view.idempotencyKey} />
            </div>
          ) : null}
          {correlation ? (
            <div className="mt-1">
              <CodeRef value={correlation} />
            </div>
          ) : null}
          {successAction}
          <div className="mt-3 flex flex-wrap gap-2">
            {view.exactRetryAvailable ? (
              <Button type="button" variant="outline" size="sm" onClick={onRetryExact}>
                {copy.retryExact}
              </Button>
            ) : null}
            <Button type="button" variant="ghost" size="sm" onClick={onClear}>
              {copy.clearSuccess}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function FleetMeta({
  result,
  copy,
}: {
  result: Pick<FleetResult<unknown>, "correlationId" | "timestamp">;
  copy: ProvisioningFleetCopy;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-1 border-t border-border pt-3 text-xs text-muted-foreground">
      <span className="inline-flex items-center gap-1.5">
        {copy.correlation}: <CodeRef value={result.correlationId} />
      </span>
      <span>
        {copy.responseAt}: {formatInstant(result.timestamp)}
      </span>
    </div>
  );
}

export function FleetFieldError({
  id,
  code,
  copy,
}: {
  id: string;
  code?: string;
  copy: ProvisioningFleetCopy;
}) {
  if (!code) return null;
  const message = copy.validation[code as keyof typeof copy.validation] ?? copy.validationFailed;
  return (
    <span id={id} role="alert" className="text-xs font-semibold text-danger-600 dark:text-danger-400">
      {message}
    </span>
  );
}

export function FleetDatum({
  label,
  value,
  mono,
}: {
  label: string;
  value: ReactNode;
  mono?: boolean;
}) {
  return (
    <Card className="min-w-0 p-3">
      <dt className="text-2xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd
        dir={mono ? "ltr" : undefined}
        className={`mt-1 break-all text-sm font-semibold text-foreground ${mono ? "text-start font-mono text-xs" : ""}`}
      >
        {value}
      </dd>
    </Card>
  );
}

export function formatInstant(value: string | null): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "medium",
  }).format(new Date(value));
}

function readResultMeta(value: unknown): FleetResult<unknown> | null {
  if (typeof value !== "object" || value === null) return null;
  if (!("correlationId" in value) || !("timestamp" in value)) return null;
  const result = value as Partial<FleetResult<unknown>>;
  return typeof result.correlationId === "string" && typeof result.timestamp === "string"
    ? (result as FleetResult<unknown>)
    : null;
}
