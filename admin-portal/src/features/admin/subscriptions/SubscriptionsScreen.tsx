"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import {
  AlertTriangle,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  Filter,
  Layers3,
  Loader2,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  UsersRound,
} from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";
import { SUBSCRIPTIONS_COPY, type SubscriptionsCopy } from "./copy";
import { useSubscriptions } from "./useSubscriptions";
import {
  SUBSCRIPTION_STATUSES,
  type SubscriptionListItem,
  type SubscriptionStatus,
  type SubscriptionsViewModel,
} from "./types";

export function SubscriptionsScreen() {
  const { lang } = useI18n();
  const copy = SUBSCRIPTIONS_COPY[lang];
  const view = useSubscriptions();
  const activeOnPage =
    view.data?.items.filter((item) => item.subscription.status === "ACTIVE")
      .length ?? 0;
  const scheduledOnPage =
    view.data?.items.filter((item) => item.subscription.cancelAt !== null)
      .length ?? 0;
  const showControls = view.canRead && view.requestState !== "FORBIDDEN";

  return (
    <div className="space-y-4">
      <header className="relative overflow-hidden rounded-xl border border-violet-500/20 bg-gradient-to-r from-slate-950 via-violet-950 to-slate-950 px-4 py-4 text-white shadow-md sm:px-5">
        <div className="pointer-events-none absolute end-0 top-0 -me-12 -mt-16 size-72 rounded-full bg-violet-500/20 blur-3xl" />
        <div className="relative flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-violet-600 shadow-sm">
              <Layers3 className="size-5" aria-hidden="true" />
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-lg font-semibold tracking-tight">
                  {copy.title}
                </h1>
                <span className="rounded-md border border-violet-400/30 bg-violet-400/15 px-2 py-0.5 text-2xs font-semibold uppercase tracking-wider text-violet-200">
                  {copy.readOnly}
                </span>
              </div>
              <p className="mt-1 max-w-3xl text-xs leading-5 text-violet-100/80">
                {copy.subtitle}
              </p>
            </div>
          </div>
          {view.isRefreshing ? (
            <span
              className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold"
              aria-live="polite"
            >
              <Loader2 className="size-3.5 animate-spin" />
              {copy.loading}
            </span>
          ) : null}
        </div>
      </header>

      {view.data ? (
        <section aria-label={copy.total} className="grid gap-3 sm:grid-cols-3">
          <SummaryCard
            label={copy.total}
            value={view.data.total}
            icon={<Layers3 className="size-4" />}
            tone="violet"
          />
          <SummaryCard
            label={copy.activeOnPage}
            value={activeOnPage}
            icon={<UsersRound className="size-4" />}
            tone="emerald"
          />
          <SummaryCard
            label={copy.scheduledOnPage}
            value={scheduledOnPage}
            icon={<CalendarClock className="size-4" />}
            tone="amber"
          />
        </section>
      ) : null}

      {showControls ? <SubscriptionFilters copy={copy} view={view} /> : null}
      <SubscriptionResults copy={copy} view={view} lang={lang} />
    </div>
  );
}

function SubscriptionFilters({
  copy,
  view,
}: {
  copy: SubscriptionsCopy;
  view: SubscriptionsViewModel;
}) {
  return (
    <form
      className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950"
      onSubmit={(event) => {
        event.preventDefault();
        view.applyFilters();
      }}
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Filter className="size-4 text-violet-600 dark:text-violet-400" />
          {copy.filters}
        </h2>
        {view.activeFilterCount ? (
          <span className="rounded-full bg-violet-50 px-2.5 py-1 text-xs font-semibold text-violet-700 dark:bg-violet-950/60 dark:text-violet-300">
            {view.activeFilterCount} {copy.activeFilters}
          </span>
        ) : null}
      </div>
      <div className="grid gap-3 lg:grid-cols-[180px_minmax(260px,1fr)_220px_130px]">
        <SelectField
          label={copy.status}
          value={view.draft.status}
          onChange={(value) =>
            view.setDraftField("status", value as "" | SubscriptionStatus)
          }
          options={[
            { value: "", label: copy.allStatuses },
            ...SUBSCRIPTION_STATUSES.map((status) => ({
              value: status,
              label: statusLabel(status, copy),
            })),
          ]}
        />
        <label className={labelClass}>
          <span>{copy.tenantId}</span>
          <input
            dir="ltr"
            value={view.draft.tenantId}
            onChange={(event) =>
              view.setDraftField("tenantId", event.target.value)
            }
            placeholder={copy.tenantPlaceholder}
            aria-invalid={Boolean(view.tenantIdError)}
            aria-describedby={
              view.tenantIdError ? "subscription-tenant-id-error" : undefined
            }
            className={`${inputClass} font-mono ${view.tenantIdError ? "border-rose-500" : ""}`}
          />
          {view.tenantIdError ? (
            <span
              id="subscription-tenant-id-error"
              role="alert"
              className="text-xs font-medium text-rose-600 dark:text-rose-300"
            >
              {copy.invalidTenantId}
            </span>
          ) : null}
        </label>
        <SelectField
          label={copy.sort}
          value={`${view.draft.sortBy}:${view.draft.sortDir}`}
          onChange={(value) => {
            const [sortBy, sortDir] = value.split(":") as [
              typeof view.draft.sortBy,
              typeof view.draft.sortDir,
            ];
            view.setDraftField("sortBy", sortBy);
            view.setDraftField("sortDir", sortDir);
          }}
          options={[
            { value: "createdAt:DESC", label: copy.newest },
            { value: "createdAt:ASC", label: copy.oldest },
            { value: "currentPeriodEnd:ASC", label: copy.periodSoonest },
            { value: "currentPeriodEnd:DESC", label: copy.periodLatest },
            { value: "status:ASC", label: copy.statusAscending },
            { value: "status:DESC", label: copy.statusDescending },
          ]}
        />
        <SelectField
          label={copy.pageSize}
          value={String(view.limit)}
          onChange={(value) => view.setLimit(Number(value))}
          options={[20, 50, 100].map((value) => ({
            value: String(value),
            label: String(value),
          }))}
        />
      </div>
      <div className="mt-4 flex flex-wrap justify-end gap-2">
        <button
          type="button"
          onClick={view.clearFilters}
          className={secondaryButtonClass}
        >
          <RotateCcw className="size-3.5" />
          {copy.clear}
        </button>
        <button
          type="button"
          onClick={view.refresh}
          disabled={view.isRefreshing}
          className={secondaryButtonClass}
        >
          <RefreshCw
            className={`size-3.5 ${view.isRefreshing ? "animate-spin" : ""}`}
          />
          {copy.refresh}
        </button>
        <button
          type="submit"
          className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-violet-600 px-4 text-xs font-semibold text-white hover:bg-violet-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
        >
          <Filter className="size-3.5" />
          {copy.apply}
        </button>
      </div>
    </form>
  );
}

function SubscriptionResults({
  copy,
  view,
  lang,
}: {
  copy: SubscriptionsCopy;
  view: SubscriptionsViewModel;
  lang: "ar" | "en";
}) {
  if (view.requestState === "LOADING") {
    return (
      <StatePanel
        icon={<Loader2 className="size-7 animate-spin" />}
        title={copy.loading}
      />
    );
  }
  if (view.requestState === "FORBIDDEN") {
    return (
      <StatePanel
        icon={<ShieldAlert className="size-7" />}
        title={copy.forbidden}
        detail={errorDetail(view, copy) || copy.permission}
        tone="warning"
      />
    );
  }
  if (view.requestState === "UNAVAILABLE") {
    return <FailurePanel title={copy.unavailable} copy={copy} view={view} />;
  }
  if (view.requestState === "ERROR") {
    return <FailurePanel title={copy.error} copy={copy} view={view} />;
  }
  if (view.requestState === "EMPTY" || !view.data?.items.length) {
    return (
      <StatePanel icon={<Layers3 className="size-7" />} title={copy.empty} />
    );
  }

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1120px] text-sm">
          <thead className="bg-slate-50 text-2xs font-semibold uppercase tracking-wider text-slate-500 dark:bg-slate-900 dark:text-slate-400">
            <tr>
              {[
                copy.tenant,
                copy.lifecycle,
                copy.plan,
                copy.seats,
                copy.price,
                copy.period,
                copy.updated,
              ].map((label) => (
                <th key={label} scope="col" className="px-4 py-3 text-start">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {view.data.items.map((item) => (
              <SubscriptionRow
                key={item.subscription.id}
                item={item}
                copy={copy}
                lang={lang}
              />
            ))}
          </tbody>
        </table>
      </div>
      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-4 py-3 text-xs dark:border-slate-800">
        <div className="space-y-1 text-slate-500 dark:text-slate-400">
          <p>
            {copy.page} {view.data.page} {copy.of}{" "}
            {Math.max(1, view.data.totalPages)} · {view.data.total}{" "}
            {copy.results}
          </p>
          <p className="break-all font-mono text-xs">
            {copy.correlation}: {view.data.correlationId} · {copy.responseAt}:{" "}
            {formatDate(view.data.timestamp, lang, true)}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => view.setPage(view.page - 1)}
            disabled={!view.data.hasPrev || view.isRefreshing}
            className={pageButtonClass}
          >
            <ChevronLeft className="size-4 rtl:rotate-180" />
            {copy.previous}
          </button>
          <button
            type="button"
            onClick={() => view.setPage(view.page + 1)}
            disabled={!view.data.hasNext || view.isRefreshing}
            className={pageButtonClass}
          >
            {copy.next}
            <ChevronRight className="size-4 rtl:rotate-180" />
          </button>
        </div>
      </footer>
    </section>
  );
}

function SubscriptionRow({
  item,
  copy,
  lang,
}: {
  item: SubscriptionListItem;
  copy: SubscriptionsCopy;
  lang: "ar" | "en";
}) {
  const subscription = item.subscription;
  return (
    <tr className="align-top hover:bg-slate-50/60 dark:hover:bg-slate-900/50">
      <td className="px-4 py-4">
        {item.tenant ? (
          <>
            <Link
              href={`/tenants/${item.tenant.id}`}
              className="font-semibold text-violet-700 hover:underline dark:text-violet-300"
            >
              {item.tenant.companyName}
            </Link>
            <p className="mt-1 text-xs text-slate-500">{item.tenant.name}</p>
            <p className="mt-1 text-xs text-slate-400">
              {copy.tenantStatus}: {item.tenant.status}
            </p>
          </>
        ) : (
          <p className="font-semibold text-amber-700 dark:text-amber-300">
            {copy.tenantUnavailable}
          </p>
        )}
        <p
          className="mt-2 max-w-52 break-all font-mono text-xs text-slate-400"
          title={subscription.id}
        >
          {copy.subscriptionId}: {subscription.id}
        </p>
      </td>
      <td className="px-4 py-4">
        <StatusPill status={subscription.status} copy={copy} />
        <p className="mt-2 text-xs text-slate-500">
          {subscription.billingCycle ?? copy.notConfigured}
        </p>
        {subscription.cancelAt ? (
          <p className="mt-1 text-xs font-semibold text-amber-700 dark:text-amber-300">
            {copy.cancels}: {formatDate(subscription.cancelAt, lang)}
          </p>
        ) : null}
      </td>
      <td className="max-w-sm px-4 py-4">
        <div className="flex flex-wrap gap-1">
          {item.enabledModules.length ? (
            item.enabledModules.map((module) => (
              <span
                key={module}
                className="rounded-md bg-violet-50 px-2 py-1 font-mono text-xs font-semibold text-violet-700 dark:bg-violet-950/60 dark:text-violet-300"
              >
                {module.replace(/^module\./u, "")}
              </span>
            ))
          ) : (
            <span className="text-xs text-slate-400">{copy.noItems}</span>
          )}
        </div>
        <details className="mt-2">
          <summary className="cursor-pointer text-xs font-semibold text-violet-700 marker:text-violet-500 dark:text-violet-300">
            {copy.inspectItems} ({item.items.length})
          </summary>
          <div className="mt-2 space-y-2">
            {item.items.length ? (
              item.items.map((planItem) => (
                <div
                  key={planItem.id}
                  className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs dark:border-slate-800 dark:bg-slate-900"
                >
                  <p className="font-semibold">
                    {copy.module}:{" "}
                    {planItem.moduleName ??
                      planItem.moduleKey ??
                      copy.enrichmentUnavailable}
                  </p>
                  <p className="mt-1">
                    {copy.tier}:{" "}
                    {planItem.tierName ??
                      planItem.tierKey ??
                      copy.enrichmentUnavailable}
                  </p>
                  <p className="mt-1 font-mono">
                    {planItem.seats} {copy.seats} · {planItem.lineTotal}{" "}
                    {planItem.currencyCode ?? subscription.currencyCode ?? ""}
                  </p>
                  <p className="mt-1 text-slate-500">
                    {planItem.features === null
                      ? copy.enrichmentUnavailable
                      : `${planItem.features.length} ${copy.features}`}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-xs text-slate-500">{copy.noItems}</p>
            )}
          </div>
        </details>
      </td>
      <td className="px-4 py-4">
        <p className="font-mono text-base font-semibold">
          {item.effectiveAllowedUsers}
        </p>
        <p className="mt-1 text-xs text-slate-500">
          {copy.baseSeats}: {subscription.allowedUsers}
        </p>
      </td>
      <td className="px-4 py-4 font-mono font-semibold">
        {subscription.totalPrice ?? copy.notConfigured}
        {subscription.totalPrice && subscription.currencyCode
          ? ` ${subscription.currencyCode}`
          : ""}
      </td>
      <td className="px-4 py-4 text-xs">
        <p>
          <span className="font-semibold">{copy.ends}:</span>{" "}
          {formatDate(subscription.currentPeriodEnd, lang)}
        </p>
        <p className="mt-1 text-slate-500">
          <span className="font-semibold">{copy.started}:</span>{" "}
          {formatDate(
            subscription.currentPeriodStart ?? subscription.startedAt,
            lang,
          )}
        </p>
        {!subscription.cancelAt ? (
          <p className="mt-1 text-xs text-slate-400">
            {copy.noCancellation}
          </p>
        ) : null}
      </td>
      <td className="px-4 py-4 text-xs text-slate-500">
        {formatDate(subscription.updatedAt, lang, true)}
      </td>
    </tr>
  );
}

function FailurePanel({
  title,
  copy,
  view,
}: {
  title: string;
  copy: SubscriptionsCopy;
  view: SubscriptionsViewModel;
}) {
  return (
    <StatePanel
      icon={<AlertTriangle className="size-7" />}
      title={title}
      detail={errorDetail(view, copy)}
      tone="danger"
      action={
        <button
          type="button"
          onClick={view.refresh}
          className="rounded-xl bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-500"
        >
          {copy.retry}
        </button>
      }
    />
  );
}

function errorDetail(
  view: SubscriptionsViewModel,
  copy: SubscriptionsCopy,
): string {
  return [
    view.error?.message,
    view.error?.errorCode
      ? `${copy.errorCode}: ${view.error.errorCode}`
      : undefined,
    view.error?.correlationId
      ? `${copy.correlation}: ${view.error.correlationId}`
      : undefined,
  ]
    .filter(Boolean)
    .join(" · ");
}

function StatusPill({
  status,
  copy,
}: {
  status: SubscriptionStatus;
  copy: SubscriptionsCopy;
}) {
  const tones: Record<SubscriptionStatus, string> = {
    TRIAL: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
    PENDING_ACTIVATION:
      "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
    ACTIVE:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
    PAST_DUE:
      "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
    CANCELLED:
      "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  };
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold ${tones[status]}`}
    >
      {statusLabel(status, copy)}
    </span>
  );
}

function statusLabel(
  status: SubscriptionStatus,
  copy: SubscriptionsCopy,
): string {
  if (copy.title === "Subscriptions") return status.replaceAll("_", " ");
  return {
    TRIAL: "تجريبي",
    PENDING_ACTIVATION: "بانتظار التفعيل",
    ACTIVE: "نشط",
    PAST_DUE: "متأخر السداد",
    CANCELLED: "ملغي",
  }[status];
}

function formatDate(
  value: string,
  lang: "ar" | "en",
  includeTime = false,
): string {
  return new Intl.DateTimeFormat(lang === "ar" ? "ar-EG" : "en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    ...(includeTime ? { hour: "2-digit", minute: "2-digit" } : {}),
    timeZone: "UTC",
  }).format(new Date(value));
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label className={labelClass}>
      <span>{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={inputClass}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function SummaryCard({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: number;
  icon: ReactNode;
  tone: "violet" | "emerald" | "amber";
}) {
  const tones = {
    violet:
      "bg-violet-50 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300",
    emerald:
      "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300",
    amber:
      "bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300",
  };
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-slate-500">{label}</p>
        <span
          className={`grid size-8 place-items-center rounded-lg ${tones[tone]}`}
        >
          {icon}
        </span>
      </div>
      <p className="mt-2 font-mono text-2xl font-semibold">{value}</p>
    </div>
  );
}

function StatePanel({
  icon,
  title,
  detail,
  tone = "neutral",
  action,
}: {
  icon: ReactNode;
  title: string;
  detail?: string;
  tone?: "neutral" | "warning" | "danger";
  action?: ReactNode;
}) {
  const colors =
    tone === "danger"
      ? "border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100"
      : tone === "warning"
        ? "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100"
        : "border-slate-200 bg-white text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300";
  return (
    <section
      role={tone === "danger" ? "alert" : undefined}
      className={`flex min-h-56 flex-col items-center justify-center rounded-xl border p-6 text-center ${colors}`}
    >
      <span className="mb-3 opacity-75">{icon}</span>
      <h2 className="text-sm font-semibold">{title}</h2>
      {detail ? (
        <p className="mt-2 max-w-3xl break-all text-xs opacity-85">{detail}</p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </section>
  );
}

const labelClass =
  "grid gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300";
const inputClass =
  "min-h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-xs font-normal text-slate-950 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100";
const secondaryButtonClass =
  "inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-300 px-3 text-xs font-semibold hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:hover:bg-slate-900";
const pageButtonClass =
  "inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-slate-300 px-3 font-semibold hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:hover:bg-slate-900";
