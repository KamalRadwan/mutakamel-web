"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import {
  BarChart3,
  Building2,
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
import { useI18n } from "@/i18n/I18nContext";
import {
  PageHeader,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
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
  type ColumnDef,
} from "@/design-system";
import { formatDecimalString } from "../lib/report-filters";
import { useReports } from "../hooks/use-reports";
import {
  REPORT_KINDS,
  TENANT_REPORT_STATUSES,
  type BillingReport,
  type BillingReportBucket,
  type OverviewReport,
  type ProvisioningReport,
  type ProvisioningReportRow,
  type ReportData,
  type ReportFilterDraft,
  type ReportFilterErrors,
  type ReportKind,
  type ReportValidationCode,
  type ServerReportRow,
  type ServersReport,
  type TenantReportPage,
  type TenantReportRow,
} from "../types/reports";

const COPY = {
  en: {
    title: "Administrative reports",
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
    <div className="w-full space-y-4">
      <PageHeader title={copy.title} />

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
        <Tabs
          value={report.activeReport}
          onValueChange={(value) => report.setActiveReport(value as ReportKind)}
        >
          <TabsList
            aria-label={copy.title}
            className="h-auto w-full flex-wrap justify-start gap-1 bg-muted p-1.5"
          >
            {REPORT_KINDS.map((kind) => {
              const Icon = TAB_ICON[kind];
              return (
                <TabsTrigger
                  key={kind}
                  value={kind}
                  className="gap-2 px-3"
                >
                  <Icon className="size-4 shrink-0" aria-hidden="true" />
                  {tabLabel(kind, copy)}
                </TabsTrigger>
              );
            })}
          </TabsList>

          <TabsContent value={report.activeReport} className="mt-4 space-y-4">
            <Card>
              <CardContent>
                <form
                  aria-label={copy.filters}
                  onSubmit={report.submitFilters}
                  className="space-y-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h2 className="inline-flex items-center gap-2 text-sm font-semibold">
                      <Filter
                        className="size-4 text-primary"
                        aria-hidden="true"
                      />
                      {copy.filters}
                    </h2>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={report.refresh}
                      disabled={report.isRefreshing}
                    >
                      <RefreshCw
                        className={`size-3.5 ${report.isRefreshing ? "animate-spin motion-reduce:animate-none" : ""}`}
                        aria-hidden="true"
                      />
                      {copy.refresh}
                    </Button>
                  </div>

                  <ReportFilters
                    kind={report.activeReport}
                    draft={report.draft}
                    errors={report.validationErrors}
                    update={report.updateFilter}
                    copy={copy}
                    lang={lang}
                  />

                  {report.activeReport !== "SERVERS" ? (
                    <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-3">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={report.clearFilters}
                      >
                        <RotateCcw className="size-4" aria-hidden="true" />
                        {copy.clear}
                      </Button>
                      <Button type="submit" variant="primary">
                        <Filter className="size-4" aria-hidden="true" />
                        {copy.apply}
                      </Button>
                    </div>
                  ) : null}
                </form>
              </CardContent>
            </Card>

            <div className="relative" aria-busy={report.isRefreshing || undefined}>
              {report.isRefreshing ? (
                <p
                  role="status"
                  className="absolute end-3 top-3 z-10 inline-flex items-center gap-2 rounded-md border border-info/30 bg-info-subtle px-3 py-1.5 text-sm font-semibold text-info-subtle-foreground"
                >
                  <Loader2 className="size-3.5 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                  {copy.refreshing}
                </p>
              ) : null}
              <ReportBody report={report} copy={copy} lang={lang} />
            </div>
          </TabsContent>
        </Tabs>
      )}
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
  lang,
}: {
  kind: ReportKind;
  draft: ReportFilterDraft;
  errors: ReportFilterErrors;
  update: <K extends keyof ReportFilterDraft>(
    field: K,
    value: ReportFilterDraft[K],
  ) => void;
  copy: Copy;
  lang: "ar" | "en";
}) {
  if (kind === "SERVERS") {
    return (
      <p className="text-sm text-muted-foreground">{copy.noFilters}</p>
    );
  }

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      {kind === "OVERVIEW" || kind === "BILLING" || kind === "PROVISIONING" ? (
        <>
          <Field
            label={copy.from}
            error={validationMessage(errors.from, copy)}
          >
            {(fp) => (
              <Input
                {...fp}
                type="date"
                value={draft.from}
                invalid={Boolean(validationMessage(errors.from, copy))}
                onChange={(event) => update("from", event.target.value)}
              />
            )}
          </Field>
          <Field
            label={copy.to}
            error={validationMessage(errors.to ?? errors.dateRange, copy)}
          >
            {(fp) => (
              <Input
                {...fp}
                type="date"
                value={draft.to}
                invalid={Boolean(
                  validationMessage(errors.to ?? errors.dateRange, copy),
                )}
                onChange={(event) => update("to", event.target.value)}
              />
            )}
          </Field>
        </>
      ) : null}

      {kind === "TENANTS" ? (
        <>
          <Field label={copy.tenantStatus}>
            {(fp) => (
              <Select
                value={draft.status || "ANY"}
                onValueChange={(value) =>
                  update(
                    "status",
                    (value === "ANY" ? "" : value) as ReportFilterDraft["status"],
                  )
                }
              >
                <SelectTrigger id={fp.id} aria-describedby={fp["aria-describedby"]} aria-invalid={fp["aria-invalid"]}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ANY">{copy.anyStatus}</SelectItem>
                  {TENANT_REPORT_STATUSES.map((status) => (
                    <SelectItem key={status} value={status}>
                      {status.replaceAll("_", " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </Field>
          <Field
            label={copy.serverId}
            error={validationMessage(errors.serverId, copy)}
          >
            {(fp) => (
              <Input
                {...fp}
                dir="ltr"
                value={draft.serverId}
                invalid={Boolean(validationMessage(errors.serverId, copy))}
                onChange={(event) => update("serverId", event.target.value.trim())}
              />
            )}
          </Field>
        </>
      ) : null}

      {kind === "TENANTS" || kind === "PROVISIONING" ? (
        <Field
          label={copy.limit}
          error={validationMessage(errors.limit, copy)}
        >
          {(fp) => (
            <Select
              value={draft.limit}
              onValueChange={(value) => update("limit", value)}
            >
              <SelectTrigger {...fp}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[10, 20, 25, 50, 100].map((limit) => (
                  <SelectItem key={limit} value={String(limit)}>
                    {formatInteger(limit, lang)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </Field>
      ) : null}
    </div>
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
        action={
          <Button type="button" variant="outline" onClick={report.refresh}>
            <RefreshCw className="size-4" aria-hidden="true" />
            {copy.retry}
          </Button>
        }
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
        action={
          <Button type="button" variant="outline" onClick={report.refresh}>
            <RefreshCw className="size-4" aria-hidden="true" />
            {copy.retry}
          </Button>
        }
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
        isRefreshing={report.isRefreshing}
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
  isRefreshing,
  previousTenantPage,
  nextTenantPage,
}: {
  data: ReportData;
  copy: Copy;
  lang: "ar" | "en";
  isRefreshing: boolean;
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
          isRefreshing={isRefreshing}
          previous={previousTenantPage}
          next={nextTenantPage}
        />
      );
    case "SERVERS":
      return <ServersView data={data.snapshot.data} copy={copy} lang={lang} isRefreshing={isRefreshing} />;
    case "BILLING":
      return <BillingView data={data.snapshot.data} copy={copy} lang={lang} isRefreshing={isRefreshing} />;
    case "PROVISIONING":
      return (
        <ProvisioningView data={data.snapshot.data} copy={copy} lang={lang} isRefreshing={isRefreshing} />
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
          <dl className="divide-y divide-border">
            {statuses.map(([status, count]) => (
              <div
                key={status}
                className="flex min-h-11 items-center justify-between gap-3 py-2"
              >
                <dt>
                  <StatusBadge status={status} />
                </dt>
                <dd className="font-mono text-lg font-semibold">
                  {formatInteger(count, lang)}
                </dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="text-sm text-muted-foreground">{copy.allZero}</p>
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
  isRefreshing,
  previous,
  next,
}: {
  data: TenantReportPage;
  copy: Copy;
  lang: "ar" | "en";
  isRefreshing: boolean;
  previous: () => void;
  next: () => void;
}) {
  const columns: ColumnDef<TenantReportRow>[] = [
    {
      key: "tenant",
      headerEn: copy.tenant,
      headerAr: copy.tenant,
      cell: (row) => (
        <Link
          href={`/tenants/${encodeURIComponent(row.id)}`}
          className="font-semibold text-action hover:underline"
        >
          {row.name}
        </Link>
      ),
    },
    {
      key: "status",
      headerEn: copy.status,
      headerAr: copy.status,
      cell: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: "subscriptionStatus",
      headerEn: copy.subscriptionStatus,
      headerAr: copy.subscriptionStatus,
      cell: (row) =>
        row.subscriptionStatus ? (
          <StatusBadge status={row.subscriptionStatus} />
        ) : (
          copy.unknown
        ),
    },
    {
      key: "allowedUsers",
      headerEn: copy.allowedUsers,
      headerAr: copy.allowedUsers,
      cell: (row) => (
        <span className="font-mono">
          {row.allowedUsers === null
            ? copy.unknown
            : formatInteger(row.allowedUsers, lang)}
        </span>
      ),
    },
    {
      key: "createdAt",
      headerEn: copy.createdAt,
      headerAr: copy.createdAt,
      cell: (row) => (
        <span className="whitespace-nowrap">
          {formatDateTime(row.createdAt, lang)}
        </span>
      ),
    },
  ];

  return (
    <DataTable
      labelEn={COPY.en.tenants}
      labelAr={COPY.ar.tenants}
      columns={columns}
      data={data.items}
      isRefreshing={isRefreshing}
      getRowId={(row) => row.id}
      pagination={{
        page: data.page,
        limit: data.limit,
        totalItems: data.total,
        totalPages: Math.max(1, data.totalPages),
        onPageChange: (target) => (target > data.page ? next() : previous()),
      }}
      emptyState={{ titleEn: copy.empty, titleAr: copy.empty }}
    />
  );
}

function ServersView({
  data,
  copy,
  lang,
  isRefreshing,
}: {
  data: ServersReport;
  copy: Copy;
  lang: "ar" | "en";
  isRefreshing: boolean;
}) {
  const columns: ColumnDef<ServerReportRow>[] = [
    {
      key: "server",
      headerEn: copy.server,
      headerAr: copy.server,
      cell: (row) => (
        <Link
          href={`/database-servers/${encodeURIComponent(row.id)}`}
          className="font-semibold text-action hover:underline"
        >
          {row.name}
        </Link>
      ),
    },
    {
      key: "status",
      headerEn: copy.status,
      headerAr: copy.status,
      cell: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: "location",
      headerEn: copy.location,
      headerAr: copy.location,
      cell: (row) => row.countryName ?? row.countryIsoCode ?? row.region ?? copy.unknown,
    },
    {
      key: "engine",
      headerEn: copy.engine,
      headerAr: copy.engine,
      cell: (row) => row.databaseEngine,
    },
    {
      key: "capacity",
      headerEn: copy.capacity,
      headerAr: copy.capacity,
      cell: (row) => (
        <span className="font-mono">
          {formatInteger(row.currentTenants, lang)} /{" "}
          {formatInteger(row.maxTenants, lang)}
        </span>
      ),
    },
    {
      key: "utilization",
      headerEn: copy.utilization,
      headerAr: copy.utilization,
      cell: (row) => (
        <div className="flex min-w-32 items-center gap-3">
          <CapacityBar value={row.utilization * 100} />
          <span className="font-mono">
            {formatPercent(row.utilization, lang)}
          </span>
        </div>
      ),
    },
  ];

  return (
    <DataTable
      labelEn={COPY.en.servers}
      labelAr={COPY.ar.servers}
      columns={columns}
      data={data.items}
      isRefreshing={isRefreshing}
      getRowId={(row) => row.id}
      pagination={{
        page: 1,
        limit: Math.max(data.items.length, 1),
        totalItems: data.items.length,
        totalPages: 1,
        onPageChange: () => {},
      }}
      emptyState={{ titleEn: copy.empty, titleAr: copy.empty }}
    />
  );
}

function BillingView({
  data,
  copy,
  lang,
  isRefreshing,
}: {
  data: BillingReport;
  copy: Copy;
  lang: "ar" | "en";
  isRefreshing: boolean;
}) {
  const columns: ColumnDef<BillingReportBucket>[] = [
    {
      key: "status",
      headerEn: copy.status,
      headerAr: copy.status,
      cell: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: "count",
      headerEn: copy.count,
      headerAr: copy.count,
      cell: (row) => (
        <span className="font-mono">
          {formatInteger(row.count, lang)}
        </span>
      ),
    },
    {
      key: "total",
      headerEn: copy.total,
      headerAr: copy.total,
      cell: (row) => (
        <span className="font-mono">
          {formatDecimalString(row.total)}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold">{copy.invoiceBuckets}</h2>
      <DataTable
        labelEn={COPY.en.billing}
        labelAr={COPY.ar.billing}
        columns={columns}
        data={data.buckets}
        isRefreshing={isRefreshing}
        getRowId={(row) => row.status}
        pagination={{
          page: 1,
          limit: Math.max(data.buckets.length, 1),
          totalItems: data.buckets.length,
          totalPages: 1,
          onPageChange: () => {},
        }}
        emptyState={{ titleEn: copy.empty, titleAr: copy.empty }}
      />
    </div>
  );
}

function ProvisioningView({
  data,
  copy,
  lang,
  isRefreshing,
}: {
  data: ProvisioningReport;
  copy: Copy;
  lang: "ar" | "en";
  isRefreshing: boolean;
}) {
  const columns: ColumnDef<ProvisioningReportRow>[] = [
    {
      key: "tenant",
      headerEn: copy.tenant,
      headerAr: copy.tenant,
      cell: (row) => (
        <Link
          href={`/tenants/${encodeURIComponent(row.id)}`}
          className="font-semibold text-action hover:underline"
        >
          {row.name}
        </Link>
      ),
    },
    {
      key: "status",
      headerEn: copy.status,
      headerAr: copy.status,
      cell: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: "createdAt",
      headerEn: copy.createdAt,
      headerAr: copy.createdAt,
      cell: (row) => (
        <span className="whitespace-nowrap">
          {formatDateTime(row.createdAt, lang)}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-3">
      <StatGrid>
        <StatCard
          label={copy.stuck}
          value={formatInteger(data.stuck, lang)}
          icon={TriangleAlert}
          tone={data.stuck > 0 ? "warn" : undefined}
        />
      </StatGrid>
      <DataTable
        labelEn={COPY.en.provisioning}
        labelAr={COPY.ar.provisioning}
        columns={columns}
        data={data.items}
        isRefreshing={isRefreshing}
        getRowId={(row) => row.id}
        pagination={{
          page: 1,
          limit: Math.max(data.items.length, 1),
          totalItems: data.items.length,
          totalPages: 1,
          onPageChange: () => {},
        }}
        emptyState={{ titleEn: copy.healthyEmpty, titleAr: copy.healthyEmpty }}
      />
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
    <Card className="p-4">
      <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
        <span className="text-primary">{icon}</span>
        {title}
      </h2>
      <div className="mt-3 space-y-3">{children}</div>
    </Card>
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
    <div className="rounded-md bg-muted px-3 py-2">
      <span className="block text-sm font-semibold text-muted-foreground">
        {label}
      </span>
      <strong
        dir={mono ? "ltr" : undefined}
        className={`mt-1 block text-lg font-semibold ${mono ? "font-mono text-start" : ""}`}
      >
        {value}
      </strong>
    </div>
  );
}

function CapacityBar({ value }: { value: number }) {
  const boundedValue = Math.max(0, Math.min(100, value));
  return (
    <div
      aria-hidden="true"
      className="h-1.5 w-24 overflow-hidden rounded-full bg-muted"
    >
      <span
        className="block h-full rounded-full bg-muted-foreground"
        style={{ inlineSize: `${boundedValue}%` }}
      />
    </div>
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
  const asOf = data.kind === "TENANTS" ? null : data.snapshot.data.asOf;
  return (
    <footer
      className={`grid gap-2 rounded-lg border border-border bg-card px-4 py-3 text-sm text-muted-foreground ${asOf ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}
    >
      {asOf ? (
        <p>
          <strong className="text-foreground">{copy.responseAsOf}:</strong>{" "}
          {formatDateTime(asOf, lang)}
        </p>
      ) : null}
      <p>
        <strong className="text-foreground">{copy.responseAt}:</strong>{" "}
        {formatDateTime(data.snapshot.responseTimestamp, lang)}
      </p>
      <p className="min-w-0">
        <strong className="text-foreground">{copy.correlation}:</strong>{" "}
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
      ? "border-destructive/30 bg-destructive-subtle text-destructive-subtle-foreground"
      : kind === "forbidden" || kind === "unavailable"
        ? "border-warning/30 bg-warning-subtle text-warning-subtle-foreground"
        : "border-border bg-card text-muted-foreground";
  return (
    <section
      role={kind === "loading" || kind === "empty" ? "status" : "alert"}
      className={`flex min-h-56 flex-col items-center justify-center rounded-lg border p-6 text-center ${tone}`}
    >
      <Icon
        className={`mb-3 size-9 opacity-70 ${kind === "loading" ? "animate-spin motion-reduce:animate-none" : ""}`}
        aria-hidden="true"
      />
      <h2 className="text-base font-semibold">{title}</h2>
      {detail ? (
        <p className="mt-2 max-w-2xl text-sm leading-6 opacity-80">{detail}</p>
      ) : null}
      {correlationId ? (
        <p className="mt-2 max-w-full text-sm">
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
