"use client";

import { useState } from "react";
import Link from "next/link";
import { AppWindow, History, Plus, ShieldAlert } from "lucide-react";
import { useApplications } from "@/features/admin/applications/hooks/useApplications";
import { useApplicationRegistration } from "@/features/admin/applications/hooks/useApplicationRegistration";
import { CreateApplicationModal } from "@/features/admin/applications/components/CreateApplicationModal";
import { useAuth } from "@/context/AuthContext";
import { adminCan, adminCanAll } from "@/lib/auth/rbac";
import { useI18n } from "@/i18n/I18nContext";
import {
  PageHeader,
  StatGrid,
  StatCard,
  FilterBar,
  DataTable,
  StatusBadge,
  Badge,
  Button,
  Card,
  CardContent,
  ErrorState,
  type ColumnDef,
} from "@/design-system";
import type {
  ApplicationCatalogueVisibility,
  ApplicationCommercialMode,
  ApplicationDatabaseDeployment,
  ApplicationLifecycleStatus,
  ApplicationPublicationStatus,
  ApplicationType,
  ApplicationView,
} from "@/features/admin/applications/types";

export default function ApplicationsPage() {
  const { user, isLoading } = useAuth();
  if (isLoading) {
    return <ApplicationsBoundary loading />;
  }
  const canRead = adminCan(user, "admin.applications.read");
  const canCreate = adminCan(user, "admin.applications.create");
  if (!canRead && !canCreate) {
    return <ApplicationsBoundary />;
  }
  if (!canRead) return <ApplicationRegistrationOnlyContent />;
  return <ApplicationsCatalogueContent />;
}

function ApplicationRegistrationOnlyContent() {
  const { user } = useAuth();
  const { t } = useI18n();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const { createApplication, onboardApplication } = useApplicationRegistration();
  const canOnboard = adminCanAll(user, [
    "admin.applications.create",
    "admin.applications.update",
    "admin.applications.critical",
  ]);

  return (
    <>
      <div className="grid place-items-center py-16">
        <Card className="w-full max-w-xl">
          <CardContent className="text-center">
            <AppWindow className="mx-auto size-10 text-brand-600 dark:text-brand-400" aria-hidden="true" />
            <h1 className="mt-4 text-xl font-semibold">{t.applications.registrationOnlyTitle}</h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{t.applications.registrationOnlyDescription}</p>
            <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
              <Button type="button" variant="primary" onClick={() => setIsCreateModalOpen(true)}>
                <Plus className="size-4" aria-hidden="true" />
                {canOnboard ? t.applications.onboardApplication : t.applications.registerApplication}
              </Button>
              <Button type="button" variant="outline" asChild>
                <Link href="/dashboard">{t.applications.backToDashboard}</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
      <CreateApplicationModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCreate={createApplication}
        onOnboard={onboardApplication}
        canOnboard={canOnboard}
      />
    </>
  );
}

function ApplicationsCatalogueContent() {
  const { t, lang } = useI18n();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const {
    applications,
    isLoading,
    error,
    search,
    setSearch,
    typeFilter,
    setTypeFilter,
    commercialFilter,
    setCommercialFilter,
    visibilityFilter,
    setVisibilityFilter,
    lifecycleFilter,
    setLifecycleFilter,
    publicationFilter,
    setPublicationFilter,
    deploymentFilter,
    setDeploymentFilter,
    meta,
    page,
    setPage,
    limit,
    setLimit,
    refresh,
    createApplication,
    onboardApplication,
  } = useApplications();

  const { user } = useAuth();
  const canCreate = adminCanAll(user, ["admin.applications.create"]);
  const canOnboard = adminCanAll(user, [
    "admin.applications.create",
    "admin.applications.update",
    "admin.applications.critical",
  ]);
  const canReadAudit = adminCanAll(user, ["admin.catalog.read"]);

  const columns: ColumnDef<ApplicationView>[] = [
    {
      key: "application",
      headerEn: t.applications.tableHeaders.application,
      headerAr: t.applications.tableHeaders.application,
      cell: (app) => (
        <Link href={`/applications-catalogue/${app.key}`} className="group inline-block">
          <span className="font-semibold text-sm text-foreground group-hover:text-brand-600 dark:group-hover:text-brand-400">
            {app.name}
          </span>
          {app.description && (
            <span className="mt-0.5 block max-w-xs truncate text-xs font-normal text-muted-foreground">{app.description}</span>
          )}
        </Link>
      ),
    },
    {
      key: "key",
      headerEn: t.applications.tableHeaders.key,
      headerAr: t.applications.tableHeaders.key,
      cell: (app) => <span className="rounded-md border border-border bg-muted px-2 py-1 font-mono text-xs font-semibold">{app.key}</span>,
    },
    {
      key: "type",
      headerEn: t.applications.tableHeaders.type,
      headerAr: t.applications.tableHeaders.type,
      cell: (app) => <Badge tone={app.applicationType === "TENANT" ? "brand" : "neutral"}>{optionLabel(app.applicationType, lang)}</Badge>,
    },
    {
      key: "databaseDeployment",
      headerEn: t.applications.tableHeaders.databaseDeployment,
      headerAr: t.applications.tableHeaders.databaseDeployment,
      cell: (app) => <Badge tone={app.databaseDeployment !== "NONE" ? "brand" : "neutral"}>{optionLabel(app.databaseDeployment, lang)}</Badge>,
    },
    {
      key: "publication",
      headerEn: t.applications.tableHeaders.publication,
      headerAr: t.applications.tableHeaders.publication,
      cell: (app) => <Badge tone={app.publicationStatus === "PUBLISHED" ? "brand" : "warn"}>{optionLabel(app.publicationStatus, lang)}</Badge>,
    },
    {
      key: "lifecycle",
      headerEn: t.applications.tableHeaders.lifecycle,
      headerAr: t.applications.tableHeaders.lifecycle,
      cell: (app) => <StatusBadge status={app.lifecycleStatus} />,
    },
  ];

  return (
    <div className="w-full space-y-6">
      <CreateApplicationModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCreate={createApplication}
        onOnboard={onboardApplication}
        canOnboard={canOnboard}
      />

      <PageHeader
        title={t.applications.pageTitle}
        action={
          <div className="flex flex-wrap gap-2">
            {canReadAudit && (
              <Button type="button" variant="outline" asChild>
                <Link href="/applications-catalogue/audit">
                  <History className="size-4" />
                  {t.applications.auditLink}
                </Link>
              </Button>
            )}
            {canCreate && (
              <Button type="button" variant="primary" onClick={() => setIsCreateModalOpen(true)}>
                <Plus className="size-4" />
                {canOnboard ? t.applications.onboardApplication : t.applications.registerApplication}
              </Button>
            )}
          </div>
        }
      />

      <StatGrid>
        <StatCard label={t.applications.totalApplications} value={meta.total} icon={AppWindow} />
        <StatCard
          label={t.applications.commercialApplications}
          value={applications.filter((a) => a.commercialMode === "SUBSCRIPTION").length}
          icon={AppWindow}
        />
        <StatCard
          label={t.applications.databaseDeployments}
          value={applications.filter((a) => a.databaseDeployment !== "NONE").length}
          icon={AppWindow}
        />
        <StatCard
          label={t.applications.publishedActive}
          value={applications.filter((a) => a.lifecycleStatus === "ACTIVE" && a.publicationStatus === "PUBLISHED").length}
          icon={AppWindow}
        />
      </StatGrid>

      <div className="space-y-0 rounded-lg border border-border bg-card">
        <FilterBar
          fields={[
            { key: "search", type: "search", placeholderEn: t.applications.searchPlaceholder, placeholderAr: t.applications.searchPlaceholder },
            { key: "type", type: "select", placeholderEn: t.applications.filterType, placeholderAr: t.applications.filterType, options: selectOptions(["ALL", "SYSTEM", "TENANT"]) },
            { key: "commercial", type: "select", placeholderEn: t.applications.filterCommercial, placeholderAr: t.applications.filterCommercial, options: selectOptions(["ALL", "NON_BILLABLE", "INCLUDED", "SUBSCRIPTION"]) },
            { key: "visibility", type: "select", placeholderEn: t.applications.filterVisibility, placeholderAr: t.applications.filterVisibility, options: selectOptions(["ALL", "PUBLIC", "INTERNAL"]) },
            { key: "lifecycle", type: "select", placeholderEn: t.applications.filterLifecycle, placeholderAr: t.applications.filterLifecycle, options: selectOptions(["ALL", "DRAFT", "ACTIVE", "DEPRECATED", "DISABLED"]) },
            { key: "publication", type: "select", placeholderEn: t.applications.filterPublication, placeholderAr: t.applications.filterPublication, options: selectOptions(["ALL", "UNPUBLISHED", "PUBLISHED"]) },
            { key: "deployment", type: "select", placeholderEn: t.applications.filterDatabaseDeployment, placeholderAr: t.applications.filterDatabaseDeployment, options: selectOptions(["ALL", "NONE", "ON_DEMAND", "PREWARM", "REQUIRED"]) },
          ]}
          values={{
            search,
            type: typeFilter === "ALL" ? "" : typeFilter,
            commercial: commercialFilter === "ALL" ? "" : commercialFilter,
            visibility: visibilityFilter === "ALL" ? "" : visibilityFilter,
            lifecycle: lifecycleFilter === "ALL" ? "" : lifecycleFilter,
            publication: publicationFilter === "ALL" ? "" : publicationFilter,
            deployment: deploymentFilter === "ALL" ? "" : deploymentFilter,
          }}
          onChange={(next) => {
            setSearch(typeof next.search === "string" ? next.search : "");
            setTypeFilter((((typeof next.type === "string" && next.type) || "ALL")) as ApplicationType | "ALL");
            setCommercialFilter(((typeof next.commercial === "string" && next.commercial) || "ALL") as ApplicationCommercialMode | "ALL");
            setVisibilityFilter(((typeof next.visibility === "string" && next.visibility) || "ALL") as ApplicationCatalogueVisibility | "ALL");
            setLifecycleFilter(((typeof next.lifecycle === "string" && next.lifecycle) || "ALL") as ApplicationLifecycleStatus | "ALL");
            setPublicationFilter(((typeof next.publication === "string" && next.publication) || "ALL") as ApplicationPublicationStatus | "ALL");
            setDeploymentFilter(((typeof next.deployment === "string" && next.deployment) || "ALL") as ApplicationDatabaseDeployment | "ALL");
          }}
        />
        {error ? (
          <ErrorState error={{ isNormalized: true, httpStatus: 0, errorCode: "APPLICATIONS_LOAD_FAILED", errorCategory: "SERVER_ERROR", message: error }} onRetry={() => void refresh()} />
        ) : (
          <DataTable
            columns={columns}
            data={applications}
            isLoading={isLoading}
            getRowId={(app) => app.id}
            pagination={{ page, limit, totalItems: meta.total, totalPages: meta.totalPages, onPageChange: setPage, onLimitChange: setLimit }}
            emptyState={{ titleEn: t.applications.emptyStateTitle, titleAr: t.applications.emptyStateTitle }}
          />
        )}
      </div>
    </div>
  );
}

function ApplicationsBoundary({ loading = false }: { loading?: boolean }) {
  const { t } = useI18n();
  return (
    <div className="grid place-items-center py-16">
      <Card className="w-full max-w-xl">
        <CardContent role={loading ? "status" : undefined} className="text-center">
          {loading ? (
            <>
              <AppWindow className="mx-auto size-8 animate-pulse text-brand-500" />
              <h1 className="mt-3 font-semibold">{t.applications.checkingAccess}</h1>
            </>
          ) : (
            <>
              <ShieldAlert className="mx-auto size-8 text-warn-500" />
              <h1 className="mt-3 font-semibold">{t.applications.accessDeniedTitle}</h1>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function selectOptions(values: readonly string[]) {
  return values.map((value) => ({ value, labelEn: optionLabel(value, "en"), labelAr: optionLabel(value, "ar") }));
}

const OPTION_LABELS_AR: Record<string, string> = {
  ALL: "الكل",
  SYSTEM: "نظامي",
  TENANT: "للمستأجر",
  NON_BILLABLE: "غير قابل للفوترة",
  INCLUDED: "مضمّن",
  SUBSCRIPTION: "اشتراك",
  PUBLIC: "عام",
  INTERNAL: "داخلي",
  DRAFT: "مسودة",
  ACTIVE: "نشط",
  DEPRECATED: "مهمل",
  DISABLED: "معطّل",
  UNPUBLISHED: "غير منشور",
  PUBLISHED: "منشور",
  NONE: "بلا وصول",
  ON_DEMAND: "عند الطلب",
  PREWARM: "تجهيز مسبق",
  REQUIRED: "إلزامي",
};

function optionLabel(value: string, lang: "ar" | "en"): string {
  if (lang === "ar") return OPTION_LABELS_AR[value] ?? value.replaceAll("_", " ");
  return value === "ALL" ? "All" : value.replaceAll("_", " ");
}
