"use client";

import Link from "next/link";
import { Server, ShieldAlert, Trash2 } from "lucide-react";
import { useDatabaseServers } from "@/features/admin/database-servers/hooks/useDatabaseServers";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { useAuth } from "@/context/AuthContext";
import { ADMIN_RBAC_CRITICAL, adminCan, adminCanAll } from "@/lib/auth/rbac";
import { CountrySelect } from "@/components/shared/CountrySelect";
import { DestructiveActionModal } from "@/components/shared/DestructiveActionModal";
import {
  canDestroyDatabaseServer,
  canSoftDeleteDatabaseServer,
} from "@/features/admin/database-servers/lib/database-server-deletion";
import { useI18n } from "@/i18n/I18nContext";
import {
  PageHeader,
  StatGrid,
  StatCard,
  FilterBar,
  DataTable,
  Button,
  type ColumnDef,
} from "@/design-system";
import type { DatabaseServerView } from "@/features/admin/database-servers/types";

export default function DatabaseServersPage() {
  const { user, isLoading } = useAuth();
  const { lang } = useI18n();
  const canRead = adminCan(user, "admin.database_servers.read");

  if (isLoading) {
    return (
      <DatabaseServersBoundary
        lang={lang}
        loading
        message={lang === "ar" ? "جارٍ التحقق من الصلاحيات..." : "Checking database-server access..."}
      />
    );
  }
  if (!canRead) {
    return (
      <DatabaseServersBoundary
        lang={lang}
        message={lang === "ar" ? "لا تملك صلاحية عرض خوادم قواعد البيانات." : "You do not have permission to view database servers."}
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
    servers,
    summaryMetrics,
    isLoading,
    error,
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
  const canCreate = adminCanAll(user, ["admin.database_servers.create"]);
  const canDelete = adminCanAll(user, ["admin.database_servers.delete", "admin.database_servers.critical"]);
  const canDestroy = adminCanAll(user, ADMIN_RBAC_CRITICAL.DB_SERVERS_DESTROY);

  const columns: ColumnDef<DatabaseServerView>[] = [
    {
      key: "name",
      headerEn: "Server Name",
      headerAr: "اسم الخادم",
      cell: (srv) =>
        srv.deletedAt ? (
          <span className="font-semibold text-muted-foreground">{srv.name}</span>
        ) : (
          <Link href={`/database-servers/${srv.id}`} className="font-semibold text-foreground hover:text-brand-700 hover:underline dark:hover:text-brand-400">
            {srv.name}
          </Link>
        ),
    },
    {
      key: "host",
      headerEn: "Host & Port",
      headerAr: "المضيف والمنفذ",
      cell: (srv) => (
        <span className="rounded-md bg-ink-100 px-2.5 py-1 font-mono text-xs font-semibold text-foreground dark:bg-ink-800">
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
      headerEn: "Tenant Capacity",
      headerAr: "سعة المستأجرين",
      cell: (srv) => (
        <div className="flex items-center gap-2">
          <div className="h-2 w-24 overflow-hidden rounded-full bg-ink-200 dark:bg-ink-800">
            <div
              className="h-full rounded-full bg-brand-500"
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
              {lang === "ar" ? `الحالة السابقة: ${srv.status}` : `Previous state: ${srv.status}`}
            </span>
          )}
        </div>
      ),
    },
    {
      key: "actions",
      headerEn: lang === "ar" ? "الإجراءات" : "Actions",
      headerAr: "الإجراءات",
      align: "end",
      cell: (srv) =>
        canDestroy && canDestroyDatabaseServer(srv) ? (
          <Button type="button" variant="destructive" size="sm" onClick={() => openDestroy(srv)} disabled={destroyingServerId === srv.id}>
            <ShieldAlert className="size-3.5" />
            {lang === "ar" ? "إتلاف نهائي" : "Destroy"}
          </Button>
        ) : canDelete && canSoftDeleteDatabaseServer(srv) ? (
          <Button type="button" variant="outline" size="sm" onClick={() => openSoftDelete(srv)} disabled={deletingServerId === srv.id}>
            <Trash2 className="size-3.5" />
            {lang === "ar" ? "حذف" : "Delete"}
          </Button>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        ),
    },
  ];

  return (
    <div className="w-full space-y-6">
      <PageHeader
        title={lang === "ar" ? "خوادم قواعد البيانات" : "Database Servers"}
        description={
          lang === "ar"
            ? "عُقد استضافة PostgreSQL الفعلية، وجهات توزيع التطبيقات، وتخصيصات مخطط المستأجرين."
            : "Physical PostgreSQL database host nodes, application placement targets, and tenant schema allocations."
        }
        action={
          canCreate && (
            <Button variant="primary" asChild>
              <Link href="/database-servers/new">{lang === "ar" ? "تسجيل خادم" : "Register Server"}</Link>
            </Button>
          )
        }
      />

      <StatGrid>
        <StatCard label={lang === "ar" ? "إجمالي المضيفين" : "Total Hosts"} value={summaryMetrics.totalServers} icon={Server} />
        <StatCard label={lang === "ar" ? "عُقد نشطة" : "Active Nodes"} value={summaryMetrics.activeServers} icon={Server} />
        <StatCard label={lang === "ar" ? "قيد التفريغ" : "Draining"} value={summaryMetrics.drainingServers} icon={Server} />
        <StatCard label={lang === "ar" ? "مضيفون غير متصلين" : "Offline Hosts"} value={summaryMetrics.offlineServers} icon={Server} />
      </StatGrid>

      <div className="rounded-lg border border-border bg-card">
        <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center">
          <div className="flex-1">
            <FilterBar
              fields={[
                { key: "search", type: "search", placeholderEn: "Search by name or host...", placeholderAr: "ابحث بالاسم أو المضيف..." },
                {
                  key: "deletion",
                  type: "select",
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
          <CountrySelect value={countryFilter} onChange={(isoCode) => setCountryFilter(isoCode)} allowAll allLabel={lang === "ar" ? "كل الدول" : "All Countries"} />
        </div>
        <DataTable
          columns={columns}
          data={servers}
          isLoading={isLoading}
          getRowId={(srv) => srv.id}
          pagination={{ page, limit: 20, totalItems: meta.total, totalPages: meta.totalPages, onPageChange: (p) => setPage(() => p) }}
          emptyState={{
            titleEn: error ? error : "No database servers found",
            titleAr: error ? error : "لا توجد خوادم قواعد بيانات",
          }}
        />
      </div>

      <DestructiveActionModal
        isOpen={serverPendingDelete !== null}
        onClose={closeSoftDelete}
        onConfirm={() => void confirmSoftDelete()}
        title={lang === "ar" ? "حذف خادم قاعدة البيانات" : "Delete database server"}
        description={
          lang === "ar"
            ? "حذف منطقي لخادم فارغ في حالة التفريغ أو عدم الاتصال. لن يعود متاحًا للتوزيع."
            : "Soft delete this empty drained or offline server. It will no longer be available for placement."
        }
        targetName={serverPendingDelete?.name ?? ""}
        actionType="delete"
        requireNameTyping
        isSubmitting={serverPendingDelete?.id === deletingServerId}
      />

      <DestructiveActionModal
        isOpen={serverPendingDestroy !== null}
        onClose={closeDestroy}
        onConfirm={() => void confirmDestroy()}
        title={lang === "ar" ? "إتلاف خادم قاعدة البيانات نهائيًا" : "Permanently destroy database server"}
        description={
          lang === "ar"
            ? "سيتم حذف سجل الخادم المحذوف منطقيًا والبيانات التابعة المؤهلة نهائيًا. لا يمكن التراجع عن هذا الإجراء."
            : "This permanently removes the soft-deleted server record and its eligible dependent data. This action cannot be undone."
        }
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
        className="flex max-w-xl flex-col items-center rounded-xl border border-border bg-card p-8 text-center"
      >
        {loading ? (
          <Server className="size-8 animate-pulse text-brand-500" />
        ) : (
          <ShieldAlert className="size-8 text-warn-500" />
        )}
        <h1 className="mt-3 font-semibold text-foreground">{message}</h1>
      </section>
    </div>
  );
}
