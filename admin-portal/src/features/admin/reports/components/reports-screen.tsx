"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import {
  BarChart3,
  Building2,
  ChevronLeft,
  ChevronRight,
  Filter,
  Loader2,
  ReceiptText,
  RefreshCw,
  RotateCcw,
  Server,
  ShieldAlert,
  TriangleAlert,
  Users,
  Workflow,
} from "lucide-react";
import { Navbar } from "@/components/layout/Navbar";
import { useI18n } from "@/i18n/I18nContext";
import { formatDecimalString } from "../lib/report-filters";
import { useReports } from "../hooks/use-reports";
import {
  REPORT_KINDS,
  TENANT_REPORT_STATUSES,
  type BillingReport,
  type OverviewReport,
  type ProvisioningReport,
  type ReportData,
  type ReportFilterDraft,
  type ReportFilterErrors,
  type ReportKind,
  type ReportValidationCode,
  type ServersReport,
  type TenantReportPage,
} from "../types/reports";

const COPY = {
  en: {
    title: "Administrative reports",
    subtitle:
      "Read-only control-plane evidence for tenant, capacity, billing, and provisioning decisions.",
    readOnly: "Read-only analytics",
    overview: "Overview",
    tenants: "Tenants",
    servers: "Server capacity",
    billing: "Billing",
    provisioning: "Provisioning",
    filters: "Report filters",
    from: "From date (UTC)",
    to: "Through date (UTC)",
    tenantStatus: "Tenant status",
    serverId: "Database server UUID v7",
    limit: "Rows per report",
    anyStatus: "Any status",
    apply: "Apply filters",
    clear: "Reset filters",
    refresh: "Refresh report",
    noFilters: "This report has no query filters.",
    loading: "Loading report evidence…",
    forbidden: "You do not have permission to read administrative reports.",
    permission: "Required permission: admin.reports.read",
    unavailable: "The report service is currently unavailable.",
    error: "The report could not be loaded.",
    retry: "Retry",
    empty: "No rows match the applied report filters.",
    healthyEmpty: "No tenants are currently stuck in provisioning.",
    responseAsOf: "Data as of",
    responseAt: "Response received",
    correlation: "Correlation ID",
    tenantLifecycle: "Tenant lifecycle",
    subscriptions: "Subscriptions",
    subscriptionsCount: "Subscription count",
    allowedUsers: "Allowed users",
    outstandingInvoices: "Outstanding invoices",
    invoiceCount: "Invoice count",
    recordedTotal: "Recorded total",
    status: "Status",
    tenant: "Tenant",
    subscriptionStatus: "Subscription status",
    createdAt: "Created",
    server: "Server",
    location: "Location",
    engine: "Engine",
    capacity: "Tenant capacity",
    utilization: "Utilization",
    invoiceBuckets: "Invoice status buckets",
    count: "Count",
    total: "Total",
    stuck: "Stuck tenants",
    previous: "Previous page",
    next: "Next page",
    page: "Page",
    of: "of",
    unknown: "Not recorded",
    allZero: "No tenant status rows were returned.",
    refreshing: "Refreshing report",
    invalidFrom: "Enter a valid start date.",
    invalidTo: "Enter a valid end date.",
    reversedRange: "The start date must not be after the end date.",
    invalidServerId: "Enter a UUID v7 database server identifier.",
    invalidLimit: "Choose a supported page size.",
    contractDrift: "The server returned an unexpected report projection.",
  },
  ar: {
    title: "التقارير الإدارية",
    subtitle:
      "أدلة للقراءة فقط من منصة التحكم لدعم قرارات المستأجرين والسعة والفوترة والتجهيز.",
    readOnly: "تحليلات للقراءة فقط",
    overview: "نظرة عامة",
    tenants: "المستأجرون",
    servers: "سعة الخوادم",
    billing: "الفوترة",
    provisioning: "التجهيز",
    filters: "عوامل تصفية التقرير",
    from: "من تاريخ (UTC)",
    to: "حتى تاريخ (UTC)",
    tenantStatus: "حالة المستأجر",
    serverId: "معرف خادم قاعدة البيانات UUID v7",
    limit: "عدد الصفوف",
    anyStatus: "كل الحالات",
    apply: "تطبيق التصفية",
    clear: "إعادة ضبط التصفية",
    refresh: "تحديث التقرير",
    noFilters: "لا توجد عوامل تصفية لهذا التقرير.",
    loading: "جارٍ تحميل أدلة التقرير…",
    forbidden: "لا تملك صلاحية قراءة التقارير الإدارية.",
    permission: "الصلاحية المطلوبة: admin.reports.read",
    unavailable: "خدمة التقارير غير متاحة حاليًا.",
    error: "تعذر تحميل التقرير.",
    retry: "إعادة المحاولة",
    empty: "لا توجد صفوف تطابق عوامل التصفية المطبقة.",
    healthyEmpty: "لا يوجد مستأجرون عالقون في التجهيز حاليًا.",
    responseAsOf: "البيانات حتى",
    responseAt: "وقت استلام الاستجابة",
    correlation: "معرف التتبع",
    tenantLifecycle: "دورة حياة المستأجرين",
    subscriptions: "الاشتراكات",
    subscriptionsCount: "عدد الاشتراكات",
    allowedUsers: "المستخدمون المسموحون",
    outstandingInvoices: "الفواتير المستحقة",
    invoiceCount: "عدد الفواتير",
    recordedTotal: "الإجمالي المسجل",
    status: "الحالة",
    tenant: "المستأجر",
    subscriptionStatus: "حالة الاشتراك",
    createdAt: "تاريخ الإنشاء",
    server: "الخادم",
    location: "الموقع",
    engine: "المحرك",
    capacity: "سعة المستأجرين",
    utilization: "نسبة الاستخدام",
    invoiceBuckets: "مجموعات حالات الفواتير",
    count: "العدد",
    total: "الإجمالي",
    stuck: "المستأجرون العالقون",
    previous: "الصفحة السابقة",
    next: "الصفحة التالية",
    page: "صفحة",
    of: "من",
    unknown: "غير مسجل",
    allZero: "لم يُرجع الخادم صفوفًا لحالات المستأجرين.",
    refreshing: "جارٍ تحديث التقرير",
    invalidFrom: "أدخل تاريخ بداية صالحًا.",
    invalidTo: "أدخل تاريخ نهاية صالحًا.",
    reversedRange: "يجب ألا يكون تاريخ البداية بعد تاريخ النهاية.",
    invalidServerId: "أدخل معرف خادم قاعدة بيانات بصيغة UUID v7.",
    invalidLimit: "اختر حجم صفحة مدعومًا.",
    contractDrift: "أرجع الخادم بنية تقرير غير متوقعة.",
  },
};

const TAB_ICON: Record<ReportKind, typeof BarChart3> = {
  OVERVIEW: BarChart3,
  TENANTS: Building2,
  SERVERS: Server,
  BILLING: ReceiptText,
  PROVISIONING: Workflow,
};

export function ReportsScreen() {
  const { lang } = useI18n();
  const copy = COPY[lang];
  const report = useReports();

  return (
    <div
      dir={lang === "ar" ? "rtl" : "ltr"}
      className="min-h-screen bg-slate-50 text-slate-950 dark:bg-[#090d16] dark:text-slate-100"
    >
      <Navbar />
      <main className="mx-auto w-full max-w-[1440px] space-y-4 px-4 py-5 sm:px-6">
        <header className="relative overflow-hidden rounded-2xl border border-cyan-500/20 bg-gradient-to-r from-slate-950 via-cyan-950 to-slate-950 px-5 py-4 text-white shadow-md">
          <div className="absolute end-0 top-0 size-48 -translate-y-1/2 translate-x-1/3 rounded-full bg-cyan-400/15 blur-3xl rtl:-translate-x-1/3" />
          <div className="relative flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <span className="grid size-11 shrink-0 place-items-center rounded-xl border border-cyan-300/30 bg-cyan-400/15 text-cyan-200">
                <BarChart3 className="size-5" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-xl font-black tracking-tight sm:text-2xl">
                    {copy.title}
                  </h1>
                  <span className="rounded-md border border-cyan-300/30 bg-cyan-400/10 px-2 py-1 text-xs font-bold text-cyan-100">
                    {copy.readOnly}
                  </span>
                </div>
                <p className="mt-1 max-w-3xl text-sm leading-6 text-cyan-100/80">
                  {copy.subtitle}
                </p>
              </div>
            </div>
          </div>
        </header>

        {!report.canRead ? (
          <StatePanel
            kind={report.requestState === "LOADING" ? "loading" : "forbidden"}
            title={
              report.requestState === "LOADING" ? copy.loading : copy.forbidden
            }
            detail={
              report.requestState === "LOADING" ? undefined : copy.permission
            }
          />
        ) : (
          <>
            <nav
              role="tablist"
              aria-label={copy.title}
              className="grid grid-cols-2 gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm sm:grid-cols-5 dark:border-slate-800 dark:bg-slate-900"
            >
              {REPORT_KINDS.map((kind) => {
                const Icon = TAB_ICON[kind];
                const selected = report.activeReport === kind;
                return (
                  <button
                    key={kind}
                    id={`report-tab-${kind.toLowerCase()}`}
                    type="button"
                    role="tab"
                    aria-selected={selected}
                    aria-controls="report-panel"
                    onClick={() => report.setActiveReport(kind)}
                    className={`flex min-h-11 items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 ${
                      selected
                        ? "bg-cyan-700 text-white shadow-sm dark:bg-cyan-600"
                        : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                    }`}
                  >
                    <Icon className="size-4" aria-hidden="true" />
                    <span>{tabLabel(kind, copy)}</span>
                  </button>
                );
              })}
            </nav>

            <form
              aria-label={copy.filters}
              onSubmit={report.submitFilters}
              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="inline-flex items-center gap-2 text-base font-black">
                  <Filter className="size-4 text-cyan-600" aria-hidden="true" />
                  {copy.filters}
                </h2>
                <button
                  type="button"
                  onClick={report.refresh}
                  disabled={report.isRefreshing}
                  className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-cyan-300 bg-cyan-50 px-3 text-sm font-bold text-cyan-800 transition-colors hover:bg-cyan-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 disabled:cursor-wait disabled:opacity-60 dark:border-cyan-800 dark:bg-cyan-950/40 dark:text-cyan-200 dark:hover:bg-cyan-950/70"
                >
                  <RefreshCw
                    className={`size-4 ${report.isRefreshing ? "animate-spin" : ""}`}
                    aria-hidden="true"
                  />
                  {copy.refresh}
                </button>
              </div>

              <ReportFilters
                kind={report.activeReport}
                draft={report.draft}
                errors={report.validationErrors}
                update={report.updateFilter}
                copy={copy}
              />

              {report.activeReport !== "SERVERS" ? (
                <div className="mt-4 flex flex-wrap justify-end gap-2 border-t border-slate-200 pt-3 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={report.clearFilters}
                    className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-300 px-3 text-sm font-bold text-slate-700 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    <RotateCcw className="size-4" aria-hidden="true" />
                    {copy.clear}
                  </button>
                  <button
                    type="submit"
                    className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-cyan-700 px-4 text-sm font-black text-white hover:bg-cyan-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-2 dark:bg-cyan-600 dark:hover:bg-cyan-500 dark:focus-visible:ring-offset-slate-900"
                  >
                    <Filter className="size-4" aria-hidden="true" />
                    {copy.apply}
                  </button>
                </div>
              ) : null}
            </form>

            <section
              id="report-panel"
              role="tabpanel"
              aria-labelledby={`report-tab-${report.activeReport.toLowerCase()}`}
              aria-busy={
                report.requestState === "LOADING" || report.isRefreshing
              }
              className="relative"
            >
              {report.isRefreshing ? (
                <p
                  role="status"
                  className="absolute end-3 top-3 z-10 inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-white/95 px-3 py-1.5 text-xs font-bold text-cyan-800 shadow-sm dark:border-cyan-900 dark:bg-slate-950/95 dark:text-cyan-200"
                >
                  <Loader2
                    className="size-3.5 animate-spin"
                    aria-hidden="true"
                  />
                  {copy.refreshing}
                </p>
              ) : null}
              <ReportBody report={report} copy={copy} lang={lang} />
            </section>
          </>
        )}
      </main>
    </div>
  );
}

type Copy = (typeof COPY)["en"] | (typeof COPY)["ar"];

function ReportFilters({
  kind,
  draft,
  errors,
  update,
  copy,
}: {
  kind: ReportKind;
  draft: ReportFilterDraft;
  errors: ReportFilterErrors;
  update: <K extends keyof ReportFilterDraft>(
    field: K,
    value: ReportFilterDraft[K],
  ) => void;
  copy: Copy;
}) {
  if (kind === "SERVERS") {
    return (
      <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
        {copy.noFilters}
      </p>
    );
  }

  return (
    <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      {kind === "OVERVIEW" || kind === "BILLING" || kind === "PROVISIONING" ? (
        <>
          <ReportInput
            id={`${kind.toLowerCase()}-from`}
            type="date"
            label={copy.from}
            value={draft.from}
            error={validationMessage(errors.from, copy)}
            onChange={(value) => update("from", value)}
          />
          <ReportInput
            id={`${kind.toLowerCase()}-to`}
            type="date"
            label={copy.to}
            value={draft.to}
            error={validationMessage(errors.to ?? errors.dateRange, copy)}
            onChange={(value) => update("to", value)}
          />
        </>
      ) : null}

      {kind === "TENANTS" ? (
        <>
          <label className="grid gap-1.5 text-xs font-bold text-slate-600 dark:text-slate-300">
            <span>{copy.tenantStatus}</span>
            <select
              value={draft.status}
              onChange={(event) =>
                update(
                  "status",
                  event.target.value as ReportFilterDraft["status"],
                )
              }
              className="min-h-10 rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            >
              <option value="">{copy.anyStatus}</option>
              {TENANT_REPORT_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </label>
          <ReportInput
            id="tenant-server-id"
            label={copy.serverId}
            value={draft.serverId}
            error={validationMessage(errors.serverId, copy)}
            onChange={(value) => update("serverId", value.trim())}
            dir="ltr"
          />
        </>
      ) : null}

      {kind === "TENANTS" || kind === "PROVISIONING" ? (
        <label className="grid gap-1.5 text-xs font-bold text-slate-600 dark:text-slate-300">
          <span>{copy.limit}</span>
          <select
            value={draft.limit}
            aria-invalid={Boolean(errors.limit)}
            onChange={(event) => update("limit", event.target.value)}
            className="min-h-10 rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          >
            {[10, 20, 25, 50, 100].map((limit) => (
              <option key={limit} value={limit}>
                {limit}
              </option>
            ))}
          </select>
          {errors.limit ? (
            <span
              role="alert"
              className="text-xs font-medium text-rose-600 dark:text-rose-300"
            >
              {validationMessage(errors.limit, copy)}
            </span>
          ) : null}
        </label>
      ) : null}
    </div>
  );
}

function ReportInput({
  id,
  label,
  value,
  onChange,
  type = "text",
  error,
  dir,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: "text" | "date";
  error?: string;
  dir?: "ltr";
}) {
  const errorId = `${id}-error`;
  return (
    <label
      htmlFor={id}
      className="grid gap-1.5 text-xs font-bold text-slate-600 dark:text-slate-300"
    >
      <span>{label}</span>
      <input
        id={id}
        type={type}
        dir={dir}
        value={value}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
        onChange={(event) => onChange(event.target.value)}
        className={`min-h-10 min-w-0 rounded-xl border bg-white px-3 text-sm font-normal text-slate-950 outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 dark:bg-slate-950 dark:text-slate-100 ${error ? "border-rose-500" : "border-slate-300 dark:border-slate-700"}`}
      />
      {error ? (
        <span
          id={errorId}
          role="alert"
          className="text-xs font-medium text-rose-600 dark:text-rose-300"
        >
          {error}
        </span>
      ) : null}
    </label>
  );
}

function ReportBody({
  report,
  copy,
  lang,
}: {
  report: ReturnType<typeof useReports>;
  copy: Copy;
  lang: "ar" | "en";
}) {
  if (report.requestState === "LOADING") {
    return <StatePanel kind="loading" title={copy.loading} />;
  }
  if (report.requestState === "FORBIDDEN") {
    return (
      <StatePanel
        kind="forbidden"
        title={copy.forbidden}
        detail={copy.permission}
      />
    );
  }
  if (report.requestState === "UNAVAILABLE") {
    return (
      <StatePanel
        kind="unavailable"
        title={copy.unavailable}
        detail={safeErrorDetail(report.error, copy)}
        correlationId={report.error?.correlationId}
        correlationLabel={copy.correlation}
        action={<RetryButton onClick={report.refresh} label={copy.retry} />}
      />
    );
  }
  if (report.requestState === "ERROR") {
    return (
      <StatePanel
        kind="error"
        title={copy.error}
        detail={safeErrorDetail(report.error, copy)}
        correlationId={report.error?.correlationId}
        correlationLabel={copy.correlation}
        action={<RetryButton onClick={report.refresh} label={copy.retry} />}
      />
    );
  }
  if (!report.data) {
    return (
      <StatePanel kind="error" title={copy.error} detail={copy.contractDrift} />
    );
  }
  if (report.requestState === "EMPTY") {
    return (
      <div className="space-y-3">
        <StatePanel
          kind="empty"
          title={
            report.data.kind === "PROVISIONING" ? copy.healthyEmpty : copy.empty
          }
        />
        <SnapshotFooter data={report.data} copy={copy} lang={lang} />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <ReportView
        data={report.data}
        copy={copy}
        lang={lang}
        previousTenantPage={report.previousTenantPage}
        nextTenantPage={report.nextTenantPage}
      />
      <SnapshotFooter data={report.data} copy={copy} lang={lang} />
    </div>
  );
}

function ReportView({
  data,
  copy,
  lang,
  previousTenantPage,
  nextTenantPage,
}: {
  data: ReportData;
  copy: Copy;
  lang: "ar" | "en";
  previousTenantPage: () => void;
  nextTenantPage: () => void;
}) {
  switch (data.kind) {
    case "OVERVIEW":
      return <OverviewView data={data.snapshot.data} copy={copy} lang={lang} />;
    case "TENANTS":
      return (
        <TenantView
          data={data.snapshot.data}
          copy={copy}
          lang={lang}
          previous={previousTenantPage}
          next={nextTenantPage}
        />
      );
    case "SERVERS":
      return <ServersView data={data.snapshot.data} copy={copy} lang={lang} />;
    case "BILLING":
      return <BillingView data={data.snapshot.data} copy={copy} lang={lang} />;
    case "PROVISIONING":
      return (
        <ProvisioningView data={data.snapshot.data} copy={copy} lang={lang} />
      );
  }
}

function OverviewView({
  data,
  copy,
  lang,
}: {
  data: OverviewReport;
  copy: Copy;
  lang: "ar" | "en";
}) {
  const statuses = Object.entries(data.tenantsByStatus).sort(
    ([left], [right]) => left.localeCompare(right),
  );
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <ReportCard
        title={copy.tenantLifecycle}
        icon={<Users className="size-4" />}
      >
        {statuses.length ? (
          <dl className="divide-y divide-slate-200 dark:divide-slate-800">
            {statuses.map(([status, count]) => (
              <div
                key={status}
                className="flex min-h-11 items-center justify-between gap-3 py-2"
              >
                <dt>
                  <StatusBadge status={status} />
                </dt>
                <dd className="font-mono text-lg font-black">
                  {formatInteger(count, lang)}
                </dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="text-sm text-slate-500">{copy.allZero}</p>
        )}
      </ReportCard>
      <ReportCard
        title={copy.subscriptions}
        icon={<ReceiptText className="size-4" />}
      >
        <Metric
          label={copy.subscriptionsCount}
          value={formatInteger(data.subscriptions.count, lang)}
        />
        <Metric
          label={copy.allowedUsers}
          value={formatInteger(data.subscriptions.totalAllowedUsers, lang)}
        />
      </ReportCard>
      <ReportCard
        title={copy.outstandingInvoices}
        icon={<TriangleAlert className="size-4" />}
      >
        <Metric
          label={copy.invoiceCount}
          value={formatInteger(data.outstandingInvoices.count, lang)}
        />
        <Metric
          label={copy.recordedTotal}
          value={formatDecimalString(data.outstandingInvoices.total)}
          mono
        />
      </ReportCard>
    </div>
  );
}

function TenantView({
  data,
  copy,
  lang,
  previous,
  next,
}: {
  data: TenantReportPage;
  copy: Copy;
  lang: "ar" | "en";
  previous: () => void;
  next: () => void;
}) {
  return (
    <DataTable
      caption={copy.tenants}
      headers={[
        copy.tenant,
        copy.status,
        copy.subscriptionStatus,
        copy.allowedUsers,
        copy.createdAt,
      ]}
    >
      {data.items.map((row) => (
        <tr
          key={row.id}
          className="min-h-11 border-t border-slate-200 hover:bg-cyan-50/50 dark:border-slate-800 dark:hover:bg-cyan-950/20"
        >
          <td className="px-4 py-3">
            <Link
              href={`/tenants/${encodeURIComponent(row.id)}`}
              className="font-bold text-cyan-700 hover:underline dark:text-cyan-300"
            >
              {row.name}
            </Link>
          </td>
          <td className="px-4 py-3">
            <StatusBadge status={row.status} />
          </td>
          <td className="px-4 py-3">
            {row.subscriptionStatus ? (
              <StatusBadge status={row.subscriptionStatus} />
            ) : (
              copy.unknown
            )}
          </td>
          <td className="px-4 py-3 font-mono font-bold">
            {row.allowedUsers === null
              ? copy.unknown
              : formatInteger(row.allowedUsers, lang)}
          </td>
          <td className="px-4 py-3 whitespace-nowrap">
            {formatDateTime(row.createdAt, lang)}
          </td>
        </tr>
      ))}
      <tr>
        <td
          colSpan={5}
          className="border-t border-slate-200 px-4 py-3 dark:border-slate-800"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-sm text-slate-500 dark:text-slate-400">
              {copy.page} {formatInteger(data.page, lang)} {copy.of}{" "}
              {formatInteger(Math.max(data.totalPages, 1), lang)} ·{" "}
              {formatInteger(data.total, lang)}
            </span>
            <div className="flex gap-2">
              <PageButton
                label={copy.previous}
                disabled={!data.hasPrev}
                onClick={previous}
                icon={
                  <ChevronLeft
                    className={`size-4 ${lang === "ar" ? "rotate-180" : ""}`}
                  />
                }
              />
              <PageButton
                label={copy.next}
                disabled={!data.hasNext}
                onClick={next}
                icon={
                  <ChevronRight
                    className={`size-4 ${lang === "ar" ? "rotate-180" : ""}`}
                  />
                }
              />
            </div>
          </div>
        </td>
      </tr>
    </DataTable>
  );
}

function ServersView({
  data,
  copy,
  lang,
}: {
  data: ServersReport;
  copy: Copy;
  lang: "ar" | "en";
}) {
  return (
    <DataTable
      caption={copy.servers}
      headers={[
        copy.server,
        copy.status,
        copy.location,
        copy.engine,
        copy.capacity,
        copy.utilization,
      ]}
    >
      {data.items.map((row) => (
        <tr
          key={row.id}
          className="border-t border-slate-200 hover:bg-cyan-50/50 dark:border-slate-800 dark:hover:bg-cyan-950/20"
        >
          <td className="px-4 py-3">
            <Link
              href={`/database-servers/${encodeURIComponent(row.id)}`}
              className="font-bold text-cyan-700 hover:underline dark:text-cyan-300"
            >
              {row.name}
            </Link>
          </td>
          <td className="px-4 py-3">
            <StatusBadge status={row.status} />
          </td>
          <td className="px-4 py-3">
            {row.countryName ??
              row.countryIsoCode ??
              row.region ??
              copy.unknown}
          </td>
          <td className="px-4 py-3">{row.databaseEngine}</td>
          <td className="px-4 py-3 font-mono font-bold">
            {formatInteger(row.currentTenants, lang)} /{" "}
            {formatInteger(row.maxTenants, lang)}
          </td>
          <td className="min-w-44 px-4 py-3">
            <div className="flex items-center gap-3">
              <progress
                className="h-2 w-24 accent-cyan-600"
                max={Math.max(row.maxTenants, 1)}
                value={Math.min(
                  row.currentTenants,
                  Math.max(row.maxTenants, 1),
                )}
                aria-label={`${copy.utilization}: ${formatPercent(row.utilization, lang)}`}
              />
              <span className="font-mono font-bold">
                {formatPercent(row.utilization, lang)}
              </span>
            </div>
          </td>
        </tr>
      ))}
    </DataTable>
  );
}

function BillingView({
  data,
  copy,
  lang,
}: {
  data: BillingReport;
  copy: Copy;
  lang: "ar" | "en";
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <h2 className="text-base font-black">{copy.invoiceBuckets}</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {data.buckets.map((bucket) => (
          <article
            key={bucket.status}
            className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/60"
          >
            <StatusBadge status={bucket.status} />
            <dl className="mt-3 grid grid-cols-2 gap-3">
              <Metric
                label={copy.count}
                value={formatInteger(bucket.count, lang)}
              />
              <Metric
                label={copy.total}
                value={formatDecimalString(bucket.total)}
                mono
              />
            </dl>
          </article>
        ))}
      </div>
    </section>
  );
}

function ProvisioningView({
  data,
  copy,
  lang,
}: {
  data: ProvisioningReport;
  copy: Copy;
  lang: "ar" | "en";
}) {
  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
        <span className="text-sm font-bold">{copy.stuck}</span>
        <strong className="ms-3 font-mono text-2xl">
          {formatInteger(data.stuck, lang)}
        </strong>
      </div>
      <DataTable
        caption={copy.provisioning}
        headers={[copy.tenant, copy.status, copy.createdAt]}
      >
        {data.items.map((row) => (
          <tr
            key={row.id}
            className="border-t border-slate-200 hover:bg-amber-50/60 dark:border-slate-800 dark:hover:bg-amber-950/20"
          >
            <td className="px-4 py-3">
              <Link
                href={`/tenants/${encodeURIComponent(row.id)}`}
                className="font-bold text-cyan-700 hover:underline dark:text-cyan-300"
              >
                {row.name}
              </Link>
            </td>
            <td className="px-4 py-3">
              <StatusBadge status={row.status} />
            </td>
            <td className="px-4 py-3 whitespace-nowrap">
              {formatDateTime(row.createdAt, lang)}
            </td>
          </tr>
        ))}
      </DataTable>
    </div>
  );
}

function DataTable({
  caption,
  headers,
  children,
}: {
  caption: string;
  headers: string[];
  children: ReactNode;
}) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <table className="w-full min-w-[760px] text-start text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead className="bg-slate-100 text-xs font-black uppercase tracking-wide text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          <tr>
            {headers.map((header) => (
              <th key={header} scope="col" className="px-4 py-3 text-start">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

function ReportCard({
  title,
  icon,
  children,
}: {
  title: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <h2 className="flex items-center gap-2 text-base font-black text-slate-800 dark:text-slate-100">
        <span className="text-cyan-600">{icon}</span>
        {title}
      </h2>
      <div className="mt-3 space-y-3">{children}</div>
    </section>
  );
}

function Metric({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="rounded-xl bg-slate-100 px-3 py-2 dark:bg-slate-800/70">
      <span className="block text-xs font-bold text-slate-500 dark:text-slate-400">
        {label}
      </span>
      <strong
        dir={mono ? "ltr" : undefined}
        className={`mt-1 block text-lg font-black ${mono ? "font-mono text-start" : ""}`}
      >
        {value}
      </strong>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const tone =
    status === "ACTIVE" || status === "PAID"
      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
      : status === "PROVISIONING" ||
          status === "ISSUED" ||
          status === "PENDING_ACTIVATION"
        ? "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200"
        : status === "OVERDUE" ||
            status === "PROVISIONING_FAILED" ||
            status === "OFFLINE"
          ? "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200"
          : "bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-200";
  return (
    <span
      dir="ltr"
      className={`inline-flex rounded-full px-2.5 py-1 font-mono text-xs font-bold ${tone}`}
    >
      {status}
    </span>
  );
}

function SnapshotFooter({
  data,
  copy,
  lang,
}: {
  data: ReportData;
  copy: Copy;
  lang: "ar" | "en";
}) {
  const asOf =
    data.kind === "TENANTS"
      ? data.snapshot.responseTimestamp
      : data.snapshot.data.asOf;
  return (
    <footer className="grid gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-500 sm:grid-cols-3 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
      <p>
        <strong className="text-slate-700 dark:text-slate-200">
          {copy.responseAsOf}:
        </strong>{" "}
        {formatDateTime(asOf, lang)}
      </p>
      <p>
        <strong className="text-slate-700 dark:text-slate-200">
          {copy.responseAt}:
        </strong>{" "}
        {formatDateTime(data.snapshot.responseTimestamp, lang)}
      </p>
      <p className="min-w-0">
        <strong className="text-slate-700 dark:text-slate-200">
          {copy.correlation}:
        </strong>{" "}
        <code dir="ltr" className="ms-1 select-all break-all">
          {data.snapshot.correlationId}
        </code>
      </p>
    </footer>
  );
}

function StatePanel({
  kind,
  title,
  detail,
  correlationId,
  correlationLabel,
  action,
}: {
  kind: "loading" | "empty" | "forbidden" | "unavailable" | "error";
  title: string;
  detail?: string;
  correlationId?: string;
  correlationLabel?: string;
  action?: ReactNode;
}) {
  const Icon =
    kind === "loading"
      ? Loader2
      : kind === "forbidden"
        ? ShieldAlert
        : kind === "error"
          ? TriangleAlert
          : kind === "unavailable"
            ? Server
            : BarChart3;
  const tone =
    kind === "error"
      ? "border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-100"
      : kind === "forbidden" || kind === "unavailable"
        ? "border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100"
        : "border-slate-200 bg-white text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200";
  return (
    <section
      role={kind === "error" || kind === "forbidden" ? "alert" : "status"}
      className={`flex min-h-56 flex-col items-center justify-center rounded-2xl border p-6 text-center shadow-sm ${tone}`}
    >
      <Icon
        className={`mb-3 size-9 opacity-70 ${kind === "loading" ? "animate-spin" : ""}`}
        aria-hidden="true"
      />
      <h2 className="text-base font-black">{title}</h2>
      {detail ? (
        <p className="mt-2 max-w-2xl text-sm leading-6 opacity-80">{detail}</p>
      ) : null}
      {correlationId ? (
        <p className="mt-2 max-w-full text-xs">
          <strong>{correlationLabel}:</strong>{" "}
          <code dir="ltr" className="select-all break-all">
            {correlationId}
          </code>
        </p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </section>
  );
}

function RetryButton({
  onClick,
  label,
}: {
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-slate-900 px-4 text-sm font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 dark:bg-white dark:text-slate-950"
    >
      <RefreshCw className="size-4" aria-hidden="true" />
      {label}
    </button>
  );
}

function PageButton({
  label,
  disabled,
  onClick,
  icon,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  icon: ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-slate-300 px-3 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700"
    >
      {icon}
      {label}
    </button>
  );
}

function tabLabel(kind: ReportKind, copy: Copy): string {
  return {
    OVERVIEW: copy.overview,
    TENANTS: copy.tenants,
    SERVERS: copy.servers,
    BILLING: copy.billing,
    PROVISIONING: copy.provisioning,
  }[kind];
}

function validationMessage(
  code: ReportValidationCode | undefined,
  copy: Copy,
): string | undefined {
  if (!code) return undefined;
  return {
    INVALID_FROM: copy.invalidFrom,
    INVALID_TO: copy.invalidTo,
    RANGE_REVERSED: copy.reversedRange,
    INVALID_SERVER_UUID_V7: copy.invalidServerId,
    INVALID_LIMIT: copy.invalidLimit,
  }[code];
}

function safeErrorDetail(
  error: ReturnType<typeof useReports>["error"],
  copy: Copy,
): string | undefined {
  if (!error) return undefined;
  if (error.errorCode === "UNKNOWN_ERROR") return copy.contractDrift;
  return error.message;
}

function formatInteger(value: number, lang: "ar" | "en"): string {
  return new Intl.NumberFormat(lang === "ar" ? "ar-EG" : "en-US", {
    maximumFractionDigits: 0,
  }).format(value);
}

function formatPercent(value: number, lang: "ar" | "en"): string {
  return new Intl.NumberFormat(lang === "ar" ? "ar-EG" : "en-US", {
    style: "percent",
    maximumFractionDigits: 1,
  }).format(value);
}

function formatDateTime(value: string, lang: "ar" | "en"): string {
  return new Intl.DateTimeFormat(lang === "ar" ? "ar-EG" : "en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date(value));
}
