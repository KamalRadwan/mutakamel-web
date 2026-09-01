"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { CheckCircle2, Clock3, HardDrive, Plus, RefreshCw } from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";
import {
  PageHeader,
  StatGrid,
  StatCard,
  FilterBar,
  DataTable,
  Badge,
  Button,
  StatusBadge,
  ErrorState,
  CodeRef,
  DegradedBanner,
  type ColumnDef,
} from "@/design-system";
import { useStorageServers } from "../hooks/useStorageServers";
import type { StorageServerView } from "../types";

export function StorageServersScreen() {
  const { lang, t } = useI18n();
  const copy = t.storageServersList;
  const view = useStorageServers();
  const errorSummaryRef = useRef<HTMLDivElement>(null);
  const activeOnPage = view.servers.filter((server) => server.status === "ACTIVE").length;
  const freshOnPage = view.servers.filter((server) => server.connectionEvidenceFresh).length;

  useEffect(() => {
    if (view.error) errorSummaryRef.current?.focus();
  }, [view.error]);

  if (view.isAuthLoading) {
    return (
      <div role="status" className="grid min-h-80 place-items-center text-sm font-semibold text-muted-foreground">
        <span className="flex items-center gap-2">
          <RefreshCw className="size-5 animate-spin text-info motion-reduce:animate-none" aria-hidden="true" />
          {copy.checkingPermissions}
        </span>
      </div>
    );
  }
  if (!view.canRead) {
    return (
      <div className="mx-auto max-w-xl rounded-lg border border-border bg-card">
        <ErrorState
          title={copy.accessDeniedTitle}
          error={{
            isNormalized: true,
            httpStatus: 403,
            errorCode: "ADMIN_PERMISSION_DENIED",
            errorCategory: "AUTHORIZATION",
            message: copy.accessDeniedMessage,
          }}
        />
      </div>
    );
  }

  const columns: ColumnDef<StorageServerView>[] = [
    {
      key: "server",
      sortable: true,
      sortField: "name",
      headerEn: "Server",
      headerAr: "الخادم",
      cell: (server) => (
        <div>
          <Link href={`/storage-servers/${server.id}`} className="inline-flex min-h-(--size-hit) items-center rounded-sm font-semibold text-info underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [@media(pointer:coarse)]:min-h-(--size-hit-coarse)">
            {server.name}
          </Link>
          <p dir="ltr" className="mt-1 font-mono text-xs text-muted-foreground">{server.code}</p>
          {server.isPlatformDefault && <Badge tone="info" className="mt-1.5">{copy.platformDefaultBadge}</Badge>}
        </div>
      ),
    },
    {
      key: "location",
      headerEn: "Location",
      headerAr: "الموقع",
      cell: (server) => (
        <div>
          <p dir="ltr" className="max-w-xs truncate font-mono text-xs" title={server.endpoint}>{server.endpoint}</p>
          <p className="mt-1 text-xs text-muted-foreground">{server.region} · {server.bucketName}</p>
        </div>
      ),
    },
    {
      key: "tenants",
      headerEn: "Tenants",
      headerAr: "المستأجرون",
      cell: (server) => <span className="font-semibold tabular-nums"><bdi>{formatStorageNumber(server.assignedTenants, lang)}</bdi> / <bdi>{server.maxTenants === null ? "∞" : formatStorageNumber(server.maxTenants, lang)}</bdi></span>,
    },
    {
      key: "evidence",
      headerEn: "Connection evidence",
      headerAr: "دليل الاتصال",
      cell: (server) => (
        <div>
          <Badge tone={evidenceBadgeTone(server)}>{evidenceLabel(server, copy)}</Badge>
          <p className="mt-1 text-xs text-muted-foreground">{formatDate(server.lastConnectionTestedAt, lang, copy)}</p>
          {server.lastConnectionTestErrorCode && (
            <CodeRef value={server.lastConnectionTestErrorCode} className="mt-1 max-w-xs" />
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
        title={copy.pageTitle}
        description={copy.pageDescription}
        action={
          view.canCreate && (
            <Button variant="primary" asChild>
              <Link href="/storage-servers/new">
                <Plus className="size-4" aria-hidden="true" />
                {copy.registerServerButton}
              </Link>
            </Button>
          )
        }
      />

      <StatGrid className="grid-cols-1 sm:grid-cols-3">
        <StatCard label={copy.statTotalResults} value={formatStorageNumber(view.total, lang)} icon={HardDrive} />
        <StatCard label={copy.statActiveOnPage} value={formatStorageNumber(activeOnPage, lang)} icon={CheckCircle2} />
        <StatCard label={copy.statFreshEvidenceOnPage} value={formatStorageNumber(freshOnPage, lang)} icon={Clock3} />
      </StatGrid>

      {view.error && (
        <div ref={errorSummaryRef} tabIndex={-1} className="rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <DegradedBanner>
            <p className="font-medium">{copy.loadErrorTitle}</p>
            <p>{view.error.message}</p>
            {(view.error.errorCode || view.error.correlationId) && (
              <div className="flex flex-wrap gap-1.5">
                {view.error.errorCode && <CodeRef value={view.error.errorCode} />}
                {view.error.correlationId && <CodeRef value={view.error.correlationId} />}
              </div>
            )}
            <Button type="button" variant="ghost" size="sm" className="mt-1 -ms-2" onClick={() => void view.refresh()}>
              {copy.retryButton}
            </Button>
          </DegradedBanner>
        </div>
      )}

      <div className="space-y-3">
        <div className="flex flex-col items-stretch gap-3 rounded-lg border border-border bg-card p-4 sm:flex-row sm:items-end">
          <div className="flex-1">
            <FilterBar
              labelEn="Storage server filters"
              labelAr="عوامل تصفية خوادم التخزين"
              ariaControls="storage-server-results"
              fields={[
                { key: "search", type: "search", labelEn: "Search", labelAr: "بحث", placeholderEn: "Name, code, or endpoint", placeholderAr: "الاسم أو الرمز أو نقطة النهاية" },
                {
                  key: "status",
                  type: "select",
                  labelEn: "Lifecycle status",
                  labelAr: "حالة دورة الحياة",
                  placeholderEn: "All statuses",
                  placeholderAr: "كل الحالات",
                  options: [
                    { value: "ALL", labelEn: "All statuses", labelAr: "كل الحالات" },
                    { value: "ACTIVE", labelEn: "ACTIVE", labelAr: "ACTIVE" },
                    { value: "DRAFT", labelEn: "DRAFT", labelAr: "DRAFT" },
                    { value: "DRAINING", labelEn: "DRAINING", labelAr: "DRAINING" },
                    { value: "OFFLINE", labelEn: "OFFLINE", labelAr: "OFFLINE" },
                  ],
                },
                {
                  key: "sort",
                  type: "select",
                  labelEn: "Sort order",
                  labelAr: "ترتيب النتائج",
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
          <Button type="button" variant="outline" size="sm" className="w-full sm:w-auto" onClick={() => void view.refresh()} loading={view.isLoading}>
            {!view.isLoading && <RefreshCw className="size-3.5" aria-hidden="true" />}
            {copy.refreshButton}
          </Button>
        </div>
        <div id="storage-server-results">
          <DataTable
            labelEn="Storage servers"
            labelAr="خوادم التخزين"
            columns={columns}
            data={view.servers}
            isLoading={view.isLoading && view.servers.length === 0}
            isRefreshing={view.isLoading && view.servers.length > 0}
            getRowId={(server) => server.id}
            getRowLabel={(server) => server.name}
            sort={{
              sortBy: view.sortBy,
              sortDir: view.sortDir,
              onSortChange: (nextSortBy, nextSortDir) => {
                if (
                  nextSortBy !== "name" &&
                  nextSortBy !== "createdAt" &&
                  nextSortBy !== "updatedAt" &&
                  nextSortBy !== "lastConnectionTestedAt"
                ) return;
                view.setSortBy(nextSortBy);
                view.setSortDir(nextSortDir);
                view.setPage(1);
              },
            }}
            responsiveMode="record-cards"
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
    </div>
  );
}

function evidenceBadgeTone(server: StorageServerView): "success" | "danger" | "warn" {
  if (server.connectionEvidenceFresh && server.lastConnectionTestStatus === "PASSED") return "success";
  if (server.lastConnectionTestStatus === "FAILED") return "danger";
  return "warn";
}

type StorageServersListCopy = typeof import("@/i18n/dictionaries/en").en.storageServersList;

function evidenceLabel(server: StorageServerView, copy: StorageServersListCopy) {
  if (server.lastConnectionTestStatus === "FAILED") return copy.evidenceTestFailed;
  if (server.connectionEvidenceFresh) return copy.evidenceFreshForPlacement;
  if (server.lastConnectionTestStatus === "PASSED") return copy.evidencePassedButStale;
  return copy.evidenceNotTested;
}

function formatDate(value: string | null, lang: "ar" | "en", copy: StorageServersListCopy) {
  if (!value) return copy.noTimestampRecorded;
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat(lang === "ar" ? "ar-EG" : "en-US", {
        year: "numeric",
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "UTC",
        timeZoneName: "short",
      }).format(date);
}

const storageNumberFormatters = {
  en: new Intl.NumberFormat("en-US"),
  ar: new Intl.NumberFormat("ar-EG"),
} as const;

function formatStorageNumber(value: number, lang: "ar" | "en") {
  return storageNumberFormatters[lang].format(value);
}
