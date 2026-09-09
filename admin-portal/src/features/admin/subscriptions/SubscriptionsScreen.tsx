"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import {
  AlertTriangle,
  CalendarClock,
  ChevronDown,
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
import {
  PageHeader,
  StatGrid,
  StatCard,
  StatusBadge,
  DataTable,
  Card,
  CardContent,
  Field,
  Input,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  Button,
  Badge,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  type ColumnDef,
} from "@/design-system";

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
      <PageHeader
        title={copy.title}
        action={
          view.isRefreshing ? (
            <span className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground" aria-live="polite">
              <Loader2 className="size-3.5 animate-spin motion-reduce:animate-none" aria-hidden="true" />
              {copy.loading}
            </span>
          ) : undefined
        }
      />

      {view.data ? (
        <StatGrid className="sm:grid-cols-3">
          <StatCard label={copy.total} value={formatInteger(view.data.total, lang)} icon={Layers3} />
          <StatCard label={copy.activeOnPage} value={formatInteger(activeOnPage, lang)} icon={UsersRound} />
          <StatCard label={copy.scheduledOnPage} value={formatInteger(scheduledOnPage, lang)} icon={CalendarClock} />
        </StatGrid>
      ) : null}

      {showControls ? <SubscriptionFilters copy={copy} view={view} lang={lang} /> : null}
      <SubscriptionResults copy={copy} view={view} lang={lang} />
    </div>
  );
}

function SubscriptionFilters({
  copy,
  view,
  lang,
}: {
  copy: SubscriptionsCopy;
  view: SubscriptionsViewModel;
  lang: "ar" | "en";
}) {
  return (
    <Card>
      <CardContent>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            view.applyFilters();
          }}
          className="space-y-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <Filter className="size-4 text-primary" aria-hidden="true" />
              {copy.filters}
            </h2>
            {view.activeFilterCount ? (
              <Badge tone="info">
                {formatInteger(view.activeFilterCount, lang)} {copy.activeFilters}
              </Badge>
            ) : null}
          </div>
          <div className="grid gap-3 lg:grid-cols-[180px_minmax(260px,1fr)_220px_130px]">
            <Field label={copy.status}>
              {(fp) => (
                <Select value={view.draft.status || "ALL"} onValueChange={(value) => view.setDraftField("status", (value === "ALL" ? "" : value) as "" | SubscriptionStatus)}>
                  <SelectTrigger id={fp.id} aria-describedby={fp["aria-describedby"]} aria-invalid={fp["aria-invalid"]}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">{copy.allStatuses}</SelectItem>
                    {SUBSCRIPTION_STATUSES.map((status) => (
                      <SelectItem key={status} value={status}>
                        {statusLabel(status, copy)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </Field>
            <Field label={copy.tenantId} error={view.tenantIdError ? copy.invalidTenantId : undefined}>
              {(fp) => (
                <Input
                  {...fp}
                  dir="ltr"
                  value={view.draft.tenantId}
                  onChange={(event) => view.setDraftField("tenantId", event.target.value)}
                  placeholder={copy.tenantPlaceholder}
                  invalid={Boolean(view.tenantIdError)}
                  className="font-mono"
                />
              )}
            </Field>
            <Field label={copy.sort}>
              {(fp) => (
                <Select
                  value={`${view.draft.sortBy}:${view.draft.sortDir}`}
                  onValueChange={(value) => {
                    const [sortBy, sortDir] = value.split(":") as [
                      typeof view.draft.sortBy,
                      typeof view.draft.sortDir,
                    ];
                    view.setDraftField("sortBy", sortBy);
                    view.setDraftField("sortDir", sortDir);
                  }}
                >
                  <SelectTrigger id={fp.id} aria-describedby={fp["aria-describedby"]} aria-invalid={fp["aria-invalid"]}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="createdAt:DESC">{copy.newest}</SelectItem>
                    <SelectItem value="createdAt:ASC">{copy.oldest}</SelectItem>
                    <SelectItem value="currentPeriodEnd:ASC">{copy.periodSoonest}</SelectItem>
                    <SelectItem value="currentPeriodEnd:DESC">{copy.periodLatest}</SelectItem>
                    <SelectItem value="status:ASC">{copy.statusAscending}</SelectItem>
                    <SelectItem value="status:DESC">{copy.statusDescending}</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </Field>
            <Field label={copy.pageSize}>
              {(fp) => (
                <Select value={String(view.limit)} onValueChange={(value) => view.setLimit(Number(value))}>
                  <SelectTrigger id={fp.id} aria-describedby={fp["aria-describedby"]} aria-invalid={fp["aria-invalid"]}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[20, 50, 100].map((value) => (
                      <SelectItem key={value} value={String(value)}>
                        {formatInteger(value, lang)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </Field>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="outline" onClick={view.clearFilters}>
              <RotateCcw className="size-3.5" />
              {copy.clear}
            </Button>
            <Button type="button" variant="outline" onClick={view.refresh} disabled={view.isRefreshing}>
              <RefreshCw className={`size-3.5 ${view.isRefreshing ? "animate-spin motion-reduce:animate-none" : ""}`} aria-hidden="true" />
              {copy.refresh}
            </Button>
            <Button type="submit" variant="primary">
              <Filter className="size-3.5" />
              {copy.apply}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
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
    return <StatePanel icon={<Loader2 className="size-7 animate-spin motion-reduce:animate-none" />} title={copy.loading} />;
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
  if (!view.data) {
    return <StatePanel icon={<Layers3 className="size-7" />} title={copy.empty} />;
  }

  const columns: ColumnDef<SubscriptionListItem>[] = [
    {
      key: "tenant",
      headerEn: copy.tenant,
      headerAr: copy.tenant,
      cell: (item) => (
        <div className="max-w-52">
          {item.tenant ? (
            <>
              <Link href={`/tenants/${item.tenant.id}`} className="font-semibold text-action hover:underline">
                {item.tenant.companyName}
              </Link>
              <p className="mt-1 text-sm text-muted-foreground">{item.tenant.name}</p>
              <p className="mt-1 text-sm text-muted-foreground">{copy.tenantStatus}: {item.tenant.status}</p>
            </>
          ) : (
            <p className="font-semibold text-warning-subtle-foreground">{copy.tenantUnavailable}</p>
          )}
          <p className="mt-2 break-all text-sm text-muted-foreground" title={item.subscription.id}>
            {copy.subscriptionId}:{" "}
            <code dir="ltr" className="font-mono">{item.subscription.id}</code>
          </p>
        </div>
      ),
    },
    {
      key: "lifecycle",
      sortable: true,
      sortField: "status",
      headerEn: copy.lifecycle,
      headerAr: copy.lifecycle,
      cell: (item) => (
        <div>
          <StatusBadge status={item.subscription.status} enumType="subscription" customLabelEn={statusLabel(item.subscription.status, SUBSCRIPTIONS_COPY.en)} customLabelAr={statusLabel(item.subscription.status, SUBSCRIPTIONS_COPY.ar)} />
          <p className="mt-2 text-sm text-muted-foreground">{item.subscription.billingCycle ?? copy.notConfigured}</p>
          {item.subscription.cancelAt ? (
            <p className="mt-1 text-sm font-semibold text-warning-subtle-foreground">
              {copy.cancels}: {formatDate(item.subscription.cancelAt, lang)}
            </p>
          ) : null}
        </div>
      ),
    },
    {
      key: "plan",
      headerEn: copy.plan,
      headerAr: copy.plan,
      cell: (item) => (
        <div className="max-w-sm">
          <div className="flex flex-wrap gap-1">
            {item.enabledModules.length ? (
              item.enabledModules.map((module) => (
                <Badge key={module} tone="info" className="font-mono">
                  {module.replace(/^module\./u, "")}
                </Badge>
              ))
            ) : (
              <span className="text-sm text-muted-foreground">{copy.noItems}</span>
            )}
          </div>
          <Collapsible className="mt-2">
            <CollapsibleTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="group px-2 text-action"
                aria-label={`${copy.inspectItems}: ${item.tenant?.companyName ?? item.subscription.id} (${formatInteger(item.items.length + item.commercial.addonSelections.length, lang)})`}
              >
                <ChevronDown className="size-4 transition-transform group-data-[state=open]:rotate-180 motion-reduce:transition-none" aria-hidden="true" />
                {copy.inspectItems} ({formatInteger(item.items.length + item.commercial.addonSelections.length, lang)})
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2 space-y-2 motion-reduce:transition-none">
              {item.commercial.addonSelections.map(addon => <div key={addon.id} className="rounded-md border border-border bg-muted p-2 text-sm">
                <p className="font-semibold">{copy.addon}: <bdi>{addon.addonKey}</bdi></p>
                <p className="mt-1">{copy.addonSeats}: <bdi>{formatInteger(addon.seats, lang)}</bdi> · <bdi className="font-mono">USD {addon.acceptedPricing.recurringAmountUsd}</bdi></p>
              </div>)}
              {item.items.length ? (
                item.items.map((planItem) => (
                  <div key={planItem.id} className="rounded-md border border-border bg-muted p-2 text-sm">
                    <p className="font-semibold">{copy.module}: {planItem.moduleName ?? planItem.moduleKey ?? copy.enrichmentUnavailable}</p>
                    <p className="mt-1">{copy.tier}: {planItem.tierName ?? planItem.tierKey ?? copy.enrichmentUnavailable}</p>
                    <p className="mt-1">
                      <span className="font-mono">{formatInteger(planItem.seats, lang)}</span> {copy.seats}{" · "}
                      <bdi dir="ltr" className="font-mono">{planItem.lineTotal} {planItem.currencyCode ?? item.subscription.currencyCode ?? ""}</bdi>
                    </p>
                    <p className="mt-1 text-muted-foreground">{planItem.features === null ? copy.enrichmentUnavailable : `${formatInteger(planItem.features.length, lang)} ${copy.features}`}</p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">{copy.noItems}</p>
              )}
            </CollapsibleContent>
          </Collapsible>
        </div>
      ),
    },
    {
      key: "seats",
      headerEn: copy.seats,
      headerAr: copy.seats,
      cell: (item) => (
        <div>
          <p className="font-mono text-base font-semibold">{formatInteger(item.effectiveAllowedUsers, lang)}</p>
          <p className="mt-1 text-sm text-muted-foreground">{copy.baseSeats}: {formatInteger(item.subscription.allowedUsers, lang)}</p>
        </div>
      ),
    },
    {
      key: "price",
      headerEn: copy.price,
      headerAr: copy.price,
      cell: (item) => (
        <div><p className="font-mono font-semibold"><bdi>{item.commercial.totals.combinedRecurringUsd} USD</bdi></p>
          <p className="mt-1 text-xs text-muted-foreground">{copy.baseTotal}: <bdi className="font-mono">{item.commercial.totals.baseRecurringUsd}</bdi></p>
          <p className="text-xs text-muted-foreground">{copy.addonTotal}: <bdi className="font-mono">{item.commercial.totals.addonRecurringUsd}</bdi></p></div>
      ),
    },
    {
      key: "period",
      sortable: true,
      sortField: "currentPeriodEnd",
      headerEn: copy.period,
      headerAr: copy.period,
      cell: (item) => (
        <div className="text-sm">
          <p><span className="font-semibold">{copy.ends}:</span> {formatDate(item.subscription.currentPeriodEnd, lang)}</p>
          <p className="mt-1 text-muted-foreground"><span className="font-semibold">{copy.started}:</span> {formatDate(item.subscription.currentPeriodStart ?? item.subscription.startedAt, lang)}</p>
          {!item.subscription.cancelAt ? <p className="mt-1 text-sm text-muted-foreground">{copy.noCancellation}</p> : null}
        </div>
      ),
    },
    {
      key: "updated",
      headerEn: copy.updated,
      headerAr: copy.updated,
      cell: (item) => <span className="text-sm text-muted-foreground">{formatDate(item.subscription.updatedAt, lang, true)}</span>,
    },
  ];

  return (
    <div className="space-y-3">
      <DataTable
        sort={{
          // FE-B02. The indicator read the DRAFT, so changing the filter
          // form's sort select moved the header arrow immediately - while the
          // rows below it were still in the previous order, until the operator
          // pressed Apply. The arrow has to describe the data on screen, which
          // is `applied`. Header clicks are unaffected: changeSort sets draft
          // and applied together, because there the click IS the request.
          sortBy: view.applied.sortBy,
          sortDir: view.applied.sortDir === "ASC" ? "ASC" : "DESC",
          onSortChange: view.changeSort,
        }}
        labelEn={SUBSCRIPTIONS_COPY.en.title}
        labelAr={SUBSCRIPTIONS_COPY.ar.title}
        columns={columns}
        data={view.data.items}
        isRefreshing={view.isRefreshing}
        getRowId={(item) => item.subscription.id}
        pagination={{
          page: view.page,
          limit: view.limit,
          totalItems: view.data.total,
          totalPages: Math.max(1, view.data.totalPages),
          onPageChange: view.setPage,
        }}
        emptyState={{ titleEn: copy.empty, titleAr: copy.empty }}
      />
      <p className="break-all rounded-lg border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
        <strong className="font-semibold text-foreground">{copy.correlation}:</strong>{" "}
        <code dir="ltr" className="select-all font-mono">{view.data.correlationId}</code>{" · "}
        <strong className="font-semibold text-foreground">{copy.responseAt}:</strong>{" "}
        {formatDate(view.data.timestamp, lang, true)}
      </p>
    </div>
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
        <Button type="button" variant="outline" onClick={view.refresh}>
          {copy.retry}
        </Button>
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

function formatInteger(value: number, lang: "ar" | "en"): string {
  return new Intl.NumberFormat(lang === "ar" ? "ar-EG" : "en-US", {
    maximumFractionDigits: 0,
  }).format(value);
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
      ? "border-destructive/30 bg-destructive-subtle text-destructive-subtle-foreground"
      : tone === "warning"
        ? "border-warning/30 bg-warning-subtle text-warning-subtle-foreground"
        : "border-border bg-card text-muted-foreground";
  return (
    <section
      role={tone === "neutral" ? "status" : "alert"}
      className={`flex min-h-56 flex-col items-center justify-center rounded-lg border p-6 text-center ${colors}`}
    >
      <span className="mb-3 opacity-75">{icon}</span>
      <h2 className="text-sm font-semibold">{title}</h2>
      {detail ? (
        <p className="mt-2 max-w-3xl break-all text-sm opacity-85">{detail}</p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </section>
  );
}
