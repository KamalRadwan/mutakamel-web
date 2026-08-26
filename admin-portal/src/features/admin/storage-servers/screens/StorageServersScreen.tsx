"use client";

import Link from "next/link";
import { CheckCircle2, Clock3, HardDrive, Plus, RefreshCw } from "lucide-react";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { useI18n } from "@/i18n/I18nContext";
import {
  PageHeader,
  StatGrid,
  StatCard,
  FilterBar,
  DataTable,
  Badge,
  Button,
  ErrorState,
  DegradedBanner,
  type ColumnDef,
} from "@/design-system";
import { useStorageServers } from "../hooks/useStorageServers";
import type { StorageServerView } from "../types";

export function StorageServersScreen() {
  const { lang } = useI18n();
  const isArabic = lang === "ar";
  const view = useStorageServers();
  const activeOnPage = view.servers.filter((server) => server.status === "ACTIVE").length;
  const freshOnPage = view.servers.filter((server) => server.connectionEvidenceFresh).length;

  if (view.isAuthLoading) {
    return (
      <div className="grid min-h-80 place-items-center text-sm font-semibold text-muted-foreground">
        <span className="flex items-center gap-2">
          <RefreshCw className="size-5 animate-spin" />
          {isArabic ? "جارٍ التحقق من الصلاحيات…" : "Checking permissions…"}
        </span>
      </div>
    );
  }
  if (!view.canRead) {
    return (
      <div className="mx-auto max-w-xl rounded-lg border border-border bg-card">
        <ErrorState
          title={isArabic ? "تم رفض الوصول" : "Access denied"}
          error={{
            isNormalized: true,
            httpStatus: 403,
            errorCode: "ADMIN_PERMISSION_DENIED",
            errorCategory: "AUTHORIZATION",
            message: isArabic ? "لا تملك صلاحية قراءة خوادم التخزين." : "You do not have permission to read Storage Servers.",
          }}
        />
      </div>
    );
  }

  const columns: ColumnDef<StorageServerView>[] = [
    {
      key: "server",
      headerEn: "Server",
      headerAr: "الخادم",
      cell: (server) => (
        <div>
          <Link href={`/storage-servers/${server.id}`} className="font-semibold text-brand-700 hover:underline dark:text-brand-400">
            {server.name}
          </Link>
          <p className="mt-1 font-mono text-xs text-muted-foreground">{server.code}</p>
          {server.isPlatformDefault && <Badge tone="brand" className="mt-1.5">{isArabic ? "الافتراضي" : "Platform default"}</Badge>}
        </div>
      ),
    },
    {
      key: "location",
      headerEn: "Location",
      headerAr: "الموقع",
      cell: (server) => (
        <div>
          <p className="max-w-xs truncate font-mono text-xs" title={server.endpoint}>{server.endpoint}</p>
          <p className="mt-1 text-xs text-muted-foreground">{server.region} · {server.bucketName}</p>
        </div>
      ),
    },
    {
      key: "tenants",
      headerEn: "Tenants",
      headerAr: "المستأجرون",
      cell: (server) => <span className="font-mono font-semibold">{server.assignedTenants} / {server.maxTenants ?? "∞"}</span>,
    },
    {
      key: "evidence",
      headerEn: "Connection evidence",
      headerAr: "دليل الاتصال",
      cell: (server) => (
        <div>
          <p className={`font-semibold ${evidenceTone(server)}`}>{evidenceLabel(server, isArabic)}</p>
          <p className="mt-1 text-xs text-muted-foreground">{formatDate(server.lastConnectionTestedAt, isArabic)}</p>
          {server.lastConnectionTestErrorCode && (
            <code className="mt-1 block max-w-xs truncate text-xs" title={server.lastConnectionTestErrorCode}>
              {server.lastConnectionTestErrorCode}
            </code>
          )}
        </div>
      ),
    },
    {
      key: "status",
      headerEn: "Status",
      headerAr: "الحالة",
      cell: (server) => <StatusBadge status={server.status} enumType="db-server" />,
    },
  ];

  return (
    <div className="w-full space-y-6">
      <PageHeader
        title={isArabic ? "خوادم التخزين" : "Storage servers"}
        description={
          isArabic
            ? "سجل خوادم S3 وحالة اختبار الاتصال الآمن. يجدول Worker الاختبار كل 12 ساعة."
            : "S3 registry and safe connection evidence. Worker schedules checks every 12 hours."
        }
        action={
          view.canCreate && (
            <Button variant="primary" asChild>
              <Link href="/storage-servers/new">
                <Plus className="size-4" />
                {isArabic ? "تسجيل خادم" : "Register server"}
              </Link>
            </Button>
          )
        }
      />

      <StatGrid className="sm:grid-cols-3">
        <StatCard label={isArabic ? "إجمالي النتائج" : "Total results"} value={view.total} icon={HardDrive} />
        <StatCard label={isArabic ? "نشط في الصفحة" : "Active on this page"} value={activeOnPage} icon={CheckCircle2} />
        <StatCard label={isArabic ? "دليل حديث في الصفحة" : "Fresh evidence on this page"} value={freshOnPage} icon={Clock3} />
      </StatGrid>

      {view.error && (
        <DegradedBanner>
          <p className="font-medium">{isArabic ? "تعذر تحميل خوادم التخزين" : "Storage servers could not be loaded"}</p>
          <p>{view.error.message}</p>
          <Button type="button" variant="ghost" size="sm" className="mt-1 -ms-2" onClick={() => void view.refresh()}>
            {isArabic ? "إعادة المحاولة" : "Retry"}
          </Button>
        </DegradedBanner>
      )}

      <div className="rounded-lg border border-border bg-card">
        <div className="flex items-center gap-3 border-b border-border p-4">
          <div className="flex-1">
            <FilterBar
              fields={[
                { key: "search", type: "search", placeholderEn: "Name, code, or endpoint", placeholderAr: "الاسم أو الرمز أو نقطة النهاية" },
                {
                  key: "status",
                  type: "select",
                  placeholderEn: "All statuses",
                  placeholderAr: "كل الحالات",
                  options: [
                    { value: "ALL", labelEn: "All statuses", labelAr: "كل الحالات" },
                    { value: "ACTIVE", labelEn: "ACTIVE", labelAr: "ACTIVE" },
                    { value: "DRAFT", labelEn: "DRAFT", labelAr: "DRAFT" },
                    { value: "OFFLINE", labelEn: "OFFLINE", labelAr: "OFFLINE" },
                  ],
                },
                {
                  key: "sort",
                  type: "select",
                  placeholderEn: "Sort",
                  placeholderAr: "الترتيب",
                  options: [
                    { value: "name:ASC", labelEn: "Name A–Z", labelAr: "الاسم تصاعدياً" },
                    { value: "name:DESC", labelEn: "Name Z–A", labelAr: "الاسم تنازلياً" },
                    { value: "lastConnectionTestedAt:DESC", labelEn: "Newest test", labelAr: "أحدث اختبار" },
                    { value: "lastConnectionTestedAt:ASC", labelEn: "Oldest test", labelAr: "أقدم اختبار" },
                    { value: "createdAt:DESC", labelEn: "Newest registration", labelAr: "الأحدث تسجيلاً" },
                  ],
                },
              ]}
              values={{ search: view.search, status: view.status === "ALL" ? "" : view.status, sort: `${view.sortBy}:${view.sortDir}` }}
              onChange={(next) => {
                view.setSearch(typeof next.search === "string" ? next.search : "");
                view.setStatus((typeof next.status === "string" && next.status ? next.status : "ALL") as typeof view.status);
                if (typeof next.sort === "string" && next.sort) {
                  const [sortBy, sortDir] = next.sort.split(":") as [typeof view.sortBy, typeof view.sortDir];
                  view.setSortBy(sortBy);
                  view.setSortDir(sortDir);
                }
              }}
            />
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => void view.refresh()} disabled={view.isLoading}>
            <RefreshCw className={`size-3.5 ${view.isLoading ? "animate-spin" : ""}`} />
            {isArabic ? "تحديث" : "Refresh"}
          </Button>
        </div>
        <DataTable
          columns={columns}
          data={view.servers}
          isLoading={view.isLoading}
          getRowId={(server) => server.id}
          pagination={{
            page: view.page,
            limit: 20,
            totalItems: view.total,
            totalPages: view.totalPages,
            onPageChange: (p) => view.setPage(p),
          }}
          emptyState={{ titleEn: "No matching storage servers.", titleAr: "لا توجد نتائج مطابقة." }}
        />
      </div>
    </div>
  );
}

function evidenceTone(server: StorageServerView): string {
  if (server.connectionEvidenceFresh && server.lastConnectionTestStatus === "PASSED") return "text-brand-700 dark:text-brand-400";
  if (server.lastConnectionTestStatus === "FAILED") return "text-danger-700 dark:text-danger-400";
  return "text-warn-700 dark:text-warn-400";
}

function evidenceLabel(server: StorageServerView, isArabic: boolean) {
  if (server.lastConnectionTestStatus === "FAILED") return isArabic ? "فشل الاختبار" : "Test failed";
  if (server.connectionEvidenceFresh) return isArabic ? "حديث وجاهز للتوزيع" : "Fresh for placement";
  if (server.lastConnectionTestStatus === "PASSED") return isArabic ? "نجح لكنه قديم" : "Passed but stale";
  return isArabic ? "لم يُختبر" : "Not tested";
}

function formatDate(value: string | null, isArabic: boolean) {
  if (!value) return isArabic ? "لا يوجد وقت مسجل" : "No timestamp recorded";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat(isArabic ? "ar-EG-u-nu-latn" : "en-US", {
        year: "numeric",
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "UTC",
        timeZoneName: "short",
      }).format(date);
}
