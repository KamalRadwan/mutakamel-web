"use client";

import Link from "next/link";
import { Server, ShieldAlert, Trash2 } from "lucide-react";
import { useDatabaseServers } from "@/features/admin/database-servers/hooks/useDatabaseServers";
import { useAuth } from "@/context/AuthContext";
import { ADMIN_RBAC_CRITICAL, adminCan, adminCanAll } from "@/lib/auth/rbac";
import { CountrySelect } from "@/components/shared/CountrySelect";
import { DestructiveActionModal } from "@/components/shared/DestructiveActionModal";
import {
  canDestroyDatabaseServer,
  canSoftDeleteDatabaseServer,
} from "@/features/admin/database-servers/lib/database-server-deletion";
import { useI18n } from "@/i18n/I18nContext";
import { en } from "@/i18n/dictionaries/en";
import { ar } from "@/i18n/dictionaries/ar";
import {
  PageHeader,
  StatGrid,
  StatCard,
  FilterBar,
  DataTable,
  Button,
  ErrorState,
  StatusBadge,
  type ColumnDef,
} from "@/design-system";
import type { DatabaseServerView } from "@/features/admin/database-servers/types";

function dict(lang: "ar" | "en") {
  return (lang === "ar" ? ar : en).databaseServersList;
}

export default function DatabaseServersPage() {
  const { user, isLoading } = useAuth();
  const { lang } = useI18n();
  const copy = dict(lang);
  const canRead = adminCan(user, "admin.database_servers.read");

  if (isLoading) {
    return (
      <DatabaseServersBoundary
        lang={lang}
        loading
        message={copy.boundaryCheckingAccess}
      />
    );
  }
  if (!canRead) {
    return (
      <DatabaseServersBoundary
        lang={lang}
        message={copy.boundaryNoPermission}
      />
    );
  }
  return <DatabaseServersContent />;
}

function DatabaseServersContent() {
  const {
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    countryFilter,
    setCountryFilter,
    deletionFilter,
    setDeletionFilter,
    page,
    setPage,
    sortBy,
    sortDir,
    changeSort,
    servers,
    summaryMetrics,
    isLoading,
    error,
    fetchServers,
    meta,
    serverPendingDelete,
    deletingServerId,
    openSoftDelete,
    closeSoftDelete,
    confirmSoftDelete,
    serverPendingDestroy,
    destroyingServerId,
    openDestroy,
    closeDestroy,
    confirmDestroy,
  } = useDatabaseServers();

  const { user } = useAuth();
  const { lang } = useI18n();
  const copy = dict(lang);
  const canCreate = adminCanAll(user, ["admin.database_servers.create"]);
  const canDelete = adminCanAll(user, ["admin.database_servers.delete", "admin.database_servers.critical"]);
  const canDestroy = adminCanAll(user, ADMIN_RBAC_CRITICAL.DB_SERVERS_DESTROY);

  const columns: ColumnDef<DatabaseServerView>[] = [
    {
      key: "name",
      sortable: true,
      headerEn: "Server Name",
      headerAr: "اسم الخادم",
      cell: (srv) =>
        srv.deletedAt ? (
          <span className="font-semibold text-muted-foreground">{srv.name}</span>
        ) : (
          <Link href={`/database-servers/${srv.id}`} className="font-semibold text-primary underline-offset-4 hover:underline">
            {srv.name}
          </Link>
        ),
    },
    {
      key: "host",
      sortable: true,
      headerEn: "Host & Port",
      headerAr: "المضيف والمنفذ",
      cell: (srv) => (
        <span className="rounded-md bg-muted px-2.5 py-1 font-mono text-xs font-semibold text-foreground">
          {srv.host}:{srv.port}
        </span>
      ),
    },
    {
      key: "location",
      headerEn: "Location",
      headerAr: "الموقع",
      cell: (srv) => (
        <span className="rounded-md border border-border bg-card px-2.5 py-1 text-xs font-semibold text-foreground">
          {srv.countryName || srv.countryIsoCode}
        </span>
      ),
    },
    {
      key: "capacity",
      sortable: true,
      sortField: "currentTenants",
      headerEn: "Tenant Capacity",
      headerAr: "سعة المستأجرين",
      cell: (srv) => (
        <div className="flex items-center gap-2">
          <div
            role="progressbar"
            aria-label={lang === "ar" ? `سعة ${srv.name}` : `${srv.name} capacity`}
            aria-valuemin={0}
            aria-valuemax={srv.maxTenants}
            aria-valuenow={srv.currentTenants}
            aria-valuetext={`${srv.currentTenants} / ${srv.maxTenants}`}
            className="h-2 w-24 overflow-hidden rounded-full bg-muted"
          >
            <div
              className="h-full rounded-full bg-info transition-[width] motion-reduce:transition-none"
              style={{ width: `${Math.min(100, (srv.currentTenants / Math.max(1, srv.maxTenants)) * 100)}%` }}
            />
          </div>
          <span className="font-mono text-xs font-semibold text-foreground">
            {srv.currentTenants} / {srv.maxTenants}
          </span>
        </div>
      ),
    },
    {
      key: "status",
      headerEn: "Status",
      headerAr: "الحالة",
      cell: (srv) => (
        <div className="flex flex-col items-start gap-1">
          <StatusBadge status={srv.deletedAt ? "DELETED" : srv.status} enumType="db-server" />
          {srv.deletedAt && (
            <span className="text-xs text-muted-foreground">
              {copy.previousState(srv.status)}
            </span>
          )}
        </div>
      ),
    },
    {
      key: "actions",
      headerEn: "Actions",
      headerAr: "الإجراءات",
      align: "end",
      cell: (srv) =>
        canDestroy && canDestroyDatabaseServer(srv) ? (
          <Button type="button" variant="destructive" size="sm" onClick={() => openDestroy(srv)} disabled={destroyingServerId === srv.id}>
            <ShieldAlert className="size-3.5" aria-hidden="true" />
            {copy.destroy}
          </Button>
        ) : canDelete && canSoftDeleteDatabaseServer(srv) ? (
          <Button type="button" variant="outline" size="sm" onClick={() => openSoftDelete(srv)} disabled={deletingServerId === srv.id}>
            <Trash2 className="size-3.5" aria-hidden="true" />
            {copy.deleteButton}
          </Button>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        ),
    },
  ];

  return (
    <div className="w-full space-y-6">
      <PageHeader
        title={copy.pageTitle}
        description={copy.pageDescription}
        action={
          canCreate && (
            <Button variant="primary" asChild>
              <Link href="/database-servers/new">{copy.registerServer}</Link>
            </Button>
          )
        }
      />

      <StatGrid className="grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label={copy.statTotalHosts} value={summaryMetrics.totalServers} icon={Server} />
        <StatCard label={copy.statActiveNodes} value={summaryMetrics.activeServers} icon={Server} />
        <StatCard label={copy.statDraining} value={summaryMetrics.drainingServers} icon={Server} />
        <StatCard label={copy.statOfflineHosts} value={summaryMetrics.offlineServers} icon={Server} />
      </StatGrid>

      <div className="rounded-lg border border-border bg-card">
        <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center">
          <div className="flex-1">
            <FilterBar
              labelEn="Database server filters"
              labelAr="عوامل تصفية خوادم قواعد البيانات"
              ariaControls="database-server-results"
              fields={[
                { key: "search", type: "search", labelEn: "Search", labelAr: "بحث", placeholderEn: "Search by name or host...", placeholderAr: "ابحث بالاسم أو المضيف..." },
                {
                  key: "deletion",
                  type: "select",
                  labelEn: "Record set",
                  labelAr: "مجموعة السجلات",
                  placeholderEn: "Current servers",
                  placeholderAr: "الخوادم الحالية",
                  options: [
                    { value: "CURRENT", labelEn: "Current servers", labelAr: "الخوادم الحالية" },
                    { value: "DELETED", labelEn: "Deleted servers", labelAr: "الخوادم المحذوفة" },
                  ],
                },
                {
                  key: "status",
                  type: "select",
                  labelEn: "Status",
                  labelAr: "الحالة",
                  placeholderEn: "All Statuses",
                  placeholderAr: "كل الحالات",
                  options: [
                    { value: "ALL", labelEn: "All Statuses", labelAr: "كل الحالات" },
                    { value: "ACTIVE", labelEn: "ACTIVE", labelAr: "ACTIVE" },
                    { value: "DRAINING", labelEn: "DRAINING", labelAr: "DRAINING" },
                    { value: "OFFLINE", labelEn: "OFFLINE", labelAr: "OFFLINE" },
                    { value: "DRAFT", labelEn: "DRAFT", labelAr: "DRAFT" },
                  ],
                },
              ]}
              values={{ search, deletion: deletionFilter, status: statusFilter === "ALL" ? "" : statusFilter }}
              onChange={(next) => {
                setSearch(typeof next.search === "string" ? next.search : "");
                setDeletionFilter(next.deletion === "DELETED" ? "DELETED" : "CURRENT");
                setStatusFilter((typeof next.status === "string" && next.status ? next.status : "ALL") as typeof statusFilter);
              }}
            />
          </div>
          <div className="min-w-48 space-y-1.5">
            <label htmlFor="database-country-filter" className="text-xs font-medium text-foreground">
              {copy.countryFilterLabel}
            </label>
            <CountrySelect
              id="database-country-filter"
              label={copy.countryFilterLabel}
              value={countryFilter}
              onChange={(isoCode) => setCountryFilter(isoCode)}
              allowAll
              allLabel={copy.allCountries}
            />
          </div>
        </div>
        <div id="database-server-results">
          {error && !isLoading ? (
            <ErrorState title={error} onRetry={() => void fetchServers()} />
          ) : (
            <DataTable
              columns={columns}
              data={servers}
              isLoading={isLoading}
              getRowId={(srv) => srv.id}
              sort={{ sortBy, sortDir, onSortChange: changeSort }}
              pagination={{ page, limit: 20, totalItems: meta.total, totalPages: meta.totalPages, onPageChange: (p) => setPage(() => p) }}
              emptyState={{ titleEn: "No database servers found", titleAr: "لا توجد خوادم قواعد بيانات" }}
            />
          )}
        </div>
      </div>

      <DestructiveActionModal
        isOpen={serverPendingDelete !== null}
        onClose={closeSoftDelete}
        onConfirm={() => void confirmSoftDelete()}
        title={copy.deleteModalTitle}
        description={copy.deleteModalDescription}
        targetName={serverPendingDelete?.name ?? ""}
        actionType="delete"
        requireNameTyping
        isSubmitting={serverPendingDelete?.id === deletingServerId}
      />

      <DestructiveActionModal
        isOpen={serverPendingDestroy !== null}
        onClose={closeDestroy}
        onConfirm={() => void confirmDestroy()}
        title={copy.destroyModalTitle}
        description={copy.destroyModalDescription}
        targetName={serverPendingDestroy?.name ?? ""}
        actionType="destroy"
        requireNameTyping
        isSubmitting={serverPendingDestroy?.id === destroyingServerId}
      />
    </div>
  );
}

function DatabaseServersBoundary({
  lang,
  message,
  loading = false,
}: {
  lang: "ar" | "en";
  message: string;
  loading?: boolean;
}) {
  return (
    <div dir={lang === "ar" ? "rtl" : "ltr"} className="grid place-items-center py-16">
      <section
        role={loading ? "status" : undefined}
        className="flex max-w-xl flex-col items-center rounded-lg border border-border bg-card p-8 text-center"
      >
        {loading ? (
          <Server className="size-8 animate-pulse text-info motion-reduce:animate-none" aria-hidden="true" />
        ) : (
          <ShieldAlert className="size-8 text-warning" aria-hidden="true" />
        )}
        <h1 className="mt-3 font-semibold text-foreground">{message}</h1>
      </section>
    </div>
  );
}
