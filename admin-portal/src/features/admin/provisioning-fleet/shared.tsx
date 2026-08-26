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
  X,
} from "lucide-react";
import {
  useEffect,
  useId,
  useRef,
  type ReactNode,
} from "react";
import type { NormalizedApiError } from "@/shared/api/normalized-api-error";
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
  return (
    <header className="relative overflow-hidden rounded-xl border border-cyan-400/20 bg-gradient-to-r from-slate-950 via-cyan-950 to-slate-950 p-5 text-white shadow-lg">
      <div className="relative flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{copy.title}</h1>
          <p className="mt-1 max-w-4xl text-sm leading-6 text-cyan-50/80">
            {copy.subtitle}
          </p>
        </div>
        {action}
      </div>
    </header>
  );
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
    <Link
      href={href}
      className="inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-slate-600 hover:text-cyan-700 dark:text-slate-300"
    >
      {dir === "rtl" ? (
        <ArrowRight className="size-4" aria-hidden="true" />
      ) : (
        <ArrowLeft className="size-4" aria-hidden="true" />
      )}
      {label}
    </Link>
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
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/25 bg-white/10 px-4 text-sm font-semibold text-white hover:bg-white/20 disabled:opacity-50"
    >
      <RefreshCw
        className={`size-4 ${pending ? "animate-spin" : ""}`}
        aria-hidden="true"
      />
      {copy.refresh}
    </button>
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
    <section
      role={loading ? "status" : "alert"}
      aria-busy={loading}
      className="rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900"
    >
      {loading ? (
        <Loader2 className="mx-auto size-7 animate-spin text-cyan-600" aria-hidden="true" />
      ) : (
        <AlertTriangle className="mx-auto size-7 text-amber-600" aria-hidden="true" />
      )}
      <p className="mt-3 text-sm font-semibold">{label}</p>
      {error ? <FleetProblem error={error} copy={copy} /> : null}
      {!loading && onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 min-h-10 rounded-xl bg-cyan-700 px-4 text-sm font-semibold text-white"
        >
          {copy.retry}
        </button>
      ) : null}
    </section>
  );
}

export function FleetProblem({
  error,
  copy,
}: {
  error: NormalizedApiError;
  copy: ProvisioningFleetCopy;
}) {
  return (
    <div className="mt-3 space-y-1 text-xs text-slate-600 dark:text-slate-300">
      <p>{error.message}</p>
      <p dir="ltr" className="break-all font-mono">
        {copy.errorCode}: {error.errorCode}
      </p>
      {error.correlationId ? (
        <p dir="ltr" className="break-all font-mono">
          {copy.correlation}: {error.correlationId}
        </p>
      ) : null}
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
      className={`rounded-xl border p-4 text-sm ${
        success
          ? "border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100"
          : "border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100"
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
            <FleetProblem error={view.error} copy={copy} />
          ) : null}
          {view.idempotencyKey ? (
            <p dir="ltr" className="mt-2 break-all font-mono text-xs">
              {copy.idempotencyKey}: {view.idempotencyKey}
            </p>
          ) : null}
          {correlation ? (
            <p dir="ltr" className="mt-1 break-all font-mono text-xs">
              {copy.correlation}: {correlation}
            </p>
          ) : null}
          {successAction}
          <div className="mt-3 flex flex-wrap gap-2">
            {view.exactRetryAvailable ? (
              <button
                type="button"
                onClick={onRetryExact}
                className="min-h-10 rounded-xl bg-amber-800 px-4 text-xs font-semibold text-white"
              >
                {copy.retryExact}
              </button>
            ) : null}
            <button
              type="button"
              onClick={onClear}
              className="min-h-10 rounded-xl border border-current/20 px-4 text-xs font-semibold"
            >
              {copy.clearSuccess}
            </button>
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
    <div className="flex flex-wrap gap-x-5 gap-y-1 border-t border-slate-200 pt-3 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
      <span dir="ltr" className="break-all font-mono">
        {copy.correlation}: {result.correlationId}
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
    <span id={id} role="alert" className="text-xs font-semibold text-rose-700 dark:text-rose-300">
      {message}
    </span>
  );
}

export function FleetPagination({
  page,
  totalPages,
  hasPrev,
  hasNext,
  onPage,
  copy,
}: {
  page: number;
  totalPages: number;
  hasPrev: boolean;
  hasNext: boolean;
  onPage: (page: number) => void;
  copy: ProvisioningFleetCopy;
}) {
  return (
    <nav aria-label={copy.page} className="flex items-center justify-between gap-3 border-t border-slate-200 pt-4 dark:border-slate-800">
      <button
        type="button"
        disabled={!hasPrev}
        onClick={() => onPage(page - 1)}
        className="min-h-10 rounded-xl border border-slate-300 px-4 text-sm font-semibold disabled:opacity-40 dark:border-slate-700"
      >
        {copy.previous}
      </button>
      <span className="text-sm font-semibold">
        {copy.page} {page} {copy.of} {Math.max(1, totalPages)}
      </span>
      <button
        type="button"
        disabled={!hasNext}
        onClick={() => onPage(page + 1)}
        className="min-h-10 rounded-xl border border-slate-300 px-4 text-sm font-semibold disabled:opacity-40 dark:border-slate-700"
      >
        {copy.next}
      </button>
    </nav>
  );
}

export function FleetConfirmDialog({
  open,
  title,
  body,
  target,
  copy,
  pending,
  onClose,
  onConfirm,
}: {
  open: boolean;
  title: string;
  body: string;
  target: string;
  copy: ProvisioningFleetCopy;
  pending: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const bodyId = useId();
  useEffect(() => {
    if (!open) return;
    const prior = document.activeElement as HTMLElement | null;
    const frame = window.requestAnimationFrame(() =>
      dialogRef.current?.querySelector<HTMLButtonElement>("[data-cancel]")?.focus(),
    );
    return () => {
      window.cancelAnimationFrame(frame);
      prior?.focus();
    };
  }, [open]);
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !pending) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        aria-busy={pending}
        onKeyDown={(event) => {
          if (event.key === "Escape" && !pending) {
            event.preventDefault();
            onClose();
            return;
          }
          if (event.key !== "Tab" || !dialogRef.current) return;
          const focusable = Array.from(
            dialogRef.current.querySelectorAll<HTMLElement>(
              "button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [href], [tabindex]:not([tabindex='-1'])",
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
        }}
        className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-700 dark:bg-slate-900"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id={titleId} className="text-lg font-semibold">{title}</h2>
            <p id={bodyId} className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{body}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            aria-label={copy.close}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>
        <code dir="ltr" className="mt-4 block max-h-40 overflow-auto break-all rounded-xl bg-slate-100 p-3 text-start text-xs dark:bg-slate-950">{target}</code>
        <div className="mt-5 flex justify-end gap-2">
          <button
            data-cancel
            type="button"
            onClick={onClose}
            disabled={pending}
            className="min-h-11 rounded-xl border border-slate-300 px-4 text-sm font-semibold dark:border-slate-700"
          >
            {copy.close}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={pending}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-rose-700 px-5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
            {copy.confirm}
          </button>
        </div>
      </div>
    </div>
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
    <div className="min-w-0 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950/50">
      <dt className="text-2xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</dt>
      <dd
        dir={mono ? "ltr" : undefined}
        className={`mt-1 break-all text-sm font-semibold ${mono ? "text-start font-mono text-xs" : ""}`}
      >
        {value}
      </dd>
    </div>
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
