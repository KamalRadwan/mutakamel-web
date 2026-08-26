"use client";

import { useState } from "react";
import Link from "next/link";
import { Navbar } from "@/components/layout/Navbar";
import {
  AppWindow,
  Search,
  Plus,
  History,
  RefreshCw,
  ShieldAlert,
} from "lucide-react";
import { useApplications } from "@/features/admin/applications/hooks/useApplications";
import { useApplicationRegistration } from "@/features/admin/applications/hooks/useApplicationRegistration";
import { CreateApplicationModal } from "@/features/admin/applications/components/CreateApplicationModal";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { TablePagination } from "@/components/shared/TablePagination";
import { useAuth } from "@/context/AuthContext";
import { adminCan, adminCanAll } from "@/lib/auth/rbac";
import { useI18n } from "@/i18n/I18nContext";

export default function ApplicationsPage() {
  const { user, isLoading } = useAuth();
  const { lang } = useI18n();
  if (isLoading) {
    return <ApplicationsReadBoundary lang={lang} loading />;
  }
  const canRead = adminCan(user, "admin.applications.read");
  const canCreate = adminCan(user, "admin.applications.create");
  if (!canRead && !canCreate) {
    return <ApplicationsReadBoundary lang={lang} />;
  }
  if (!canRead) return <ApplicationRegistrationOnlyContent />;
  return <ApplicationsCatalogueContent />;
}

function ApplicationRegistrationOnlyContent() {
  const { user } = useAuth();
  const { lang, dir } = useI18n();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const { createApplication, onboardApplication } =
    useApplicationRegistration();
  const canOnboard = adminCanAll(user, [
    "admin.applications.create",
    "admin.applications.update",
    "admin.applications.critical",
  ]);
  const copy =
    lang === "ar"
      ? {
          title: "تسجيل تطبيق",
          description:
            "يمكنك تنفيذ عملية التسجيل المصرح بها دون تحميل كتالوج التطبيقات. لا تُرسل الواجهة طلب القائمة لأن حسابك لا يملك صلاحية القراءة.",
          action: canOnboard ? "تهيئة تطبيق" : "إنشاء مسودة تطبيق",
          dashboard: "العودة إلى لوحة التحكم",
        }
      : {
          title: "Register an Application",
          description:
            "You can perform the authorized registration command without loading the Application Catalogue. This screen sends no list request because this account lacks read permission.",
          action: canOnboard ? "Onboard Application" : "Create Application Draft",
          dashboard: "Back to dashboard",
        };

  return (
    <div
      dir={dir}
      className="flex min-h-screen flex-col bg-slate-50 text-slate-900 dark:bg-canvas dark:text-slate-100"
    >
      <Navbar />
      <main className="grid flex-1 place-items-center p-6">
        <section className="w-full max-w-xl rounded-xl border border-violet-200 bg-white p-8 text-center shadow-lg dark:border-violet-900 dark:bg-slate-950">
          <AppWindow className="mx-auto size-10 text-violet-600" aria-hidden="true" />
          <h1 className="mt-4 text-xl font-semibold">{copy.title}</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
            {copy.description}
          </p>
          <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => setIsCreateModalOpen(true)}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-violet-600 px-5 text-sm font-semibold text-white hover:bg-violet-500"
            >
              <Plus className="size-4" aria-hidden="true" />
              {copy.action}
            </button>
            <Link
              href="/dashboard"
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-200 px-5 text-sm font-semibold hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
            >
              {copy.dashboard}
            </Link>
          </div>
        </section>
      </main>
      <CreateApplicationModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCreate={createApplication}
        onOnboard={onboardApplication}
        canOnboard={canOnboard}
      />
    </div>
  );
}

function ApplicationsCatalogueContent() {
  const { lang, dir } = useI18n();
  const copy = catalogueCopy(lang);
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

  return (
    <div dir={dir} className="min-h-screen bg-slate-50 dark:bg-canvas text-slate-900 dark:text-slate-100 flex flex-col">
      <Navbar />

      <main className="flex-1 space-y-6 w-full px-4 py-4 sm:py-6">
        <CreateApplicationModal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          onCreate={createApplication}
          onOnboard={onboardApplication}
          canOnboard={canOnboard}
        />

        {/* Header Title Section with Vibrant Amber/Purple Gradient */}
        <div className="relative overflow-hidden bg-gradient-to-r from-slate-900 via-purple-950 to-slate-900 text-white p-6 rounded-xl border border-amber-500/20 shadow-xl">
          <div className="absolute top-0 end-0 -mt-10 -me-10 w-72 h-72 bg-gradient-to-br from-amber-500/20 via-purple-500/20 to-pink-500/0 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 start-1/3 -mb-10 w-60 h-60 bg-blue-500/15 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-5">
            <div className="flex items-center gap-4">
              <div className="p-3.5 bg-gradient-to-tr from-amber-500 via-purple-600 to-indigo-600 text-white rounded-xl shadow-lg shadow-purple-500/30 flex items-center justify-center shrink-0">
                <AppWindow className="w-7 h-7" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-semibold tracking-tight text-white">
                    {copy.title}
                  </h1>
                  <span className="px-2.5 py-0.5 text-2xs font-semibold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-full">
                    {copy.registry}
                  </span>
                </div>
                <p className="text-xs text-amber-100/80 mt-1 max-w-xl leading-relaxed">
                  {copy.description}
                </p>
              </div>
            </div>

            {canCreate && (
              <button
                className="px-5 py-2.5 text-xs font-semibold bg-gradient-to-r from-amber-500 via-purple-500 to-indigo-500 hover:from-amber-400 hover:to-indigo-400 text-white rounded-xl shadow-lg shadow-purple-500/25 transition-all transform hover:-translate-y-0.5 flex items-center gap-2 cursor-pointer shrink-0 border border-white/20"
                onClick={() => setIsCreateModalOpen(true)}
              >
                <Plus className="w-4 h-4" />
                <span>{canOnboard ? copy.onboard : copy.register}</span>
              </button>
            )}
            {canReadAudit && (
              <Link
                href="/applications-catalogue/audit"
                className="flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-xs font-semibold text-white hover:bg-white/15"
              >
                <History className="h-4 w-4" />
                {copy.audit}
              </Link>
            )}
          </div>
        </div>

        {/* Summary Metrics Bar */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="relative overflow-hidden bg-white dark:bg-slate-900/90 p-5 rounded-xl border border-slate-200/80 dark:border-amber-500/20 shadow-sm hover:shadow-md transition-all">
            <div className="absolute top-0 end-0 w-24 h-24 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                {copy.totalApps}
              </span>
              <div className="p-2 bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 rounded-xl border border-amber-200 dark:border-amber-800/50">
                <AppWindow className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-semibold text-slate-900 dark:text-slate-100 mt-2 font-mono">
              {meta.total}
            </div>
            <div className="text-xs text-amber-600 dark:text-amber-400 font-semibold mt-1">
              {copy.registeredApps}
            </div>
          </div>

          <div className="relative overflow-hidden bg-white dark:bg-slate-900/90 p-5 rounded-xl border border-slate-200/80 dark:border-purple-500/20 shadow-sm hover:shadow-md transition-all">
            <div className="absolute top-0 end-0 w-24 h-24 bg-purple-500/10 rounded-full blur-2xl pointer-events-none" />
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                {copy.commercialApps}
              </span>
              <div className="p-2 bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 rounded-xl border border-purple-200 dark:border-purple-800/50">
                <AppWindow className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-semibold text-purple-600 dark:text-purple-400 mt-2 font-mono">
              {applications?.filter((a) => a.commercialMode === "SUBSCRIPTION")
                .length || 0}
            </div>
            <div className="text-xs text-purple-600 dark:text-purple-400 font-semibold mt-1">
              {copy.subscriptionOfferings}
            </div>
          </div>

          <div className="relative overflow-hidden bg-white dark:bg-slate-900/90 p-5 rounded-xl border border-slate-200/80 dark:border-indigo-500/20 shadow-sm hover:shadow-md transition-all">
            <div className="absolute top-0 end-0 w-24 h-24 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                {copy.managedDatabaseDeployment}
              </span>
              <div className="p-2 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 rounded-xl border border-indigo-200 dark:border-indigo-800/50">
                <AppWindow className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-semibold text-indigo-600 dark:text-indigo-400 mt-2 font-mono">
              {applications?.filter((a) => a.databaseDeployment !== "NONE")
                .length || 0}
            </div>
            <div className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold mt-1">
              {copy.deploymentProfiles}
            </div>
          </div>

          <div className="relative overflow-hidden bg-white dark:bg-slate-900/90 p-5 rounded-xl border border-slate-200/80 dark:border-emerald-500/20 shadow-sm hover:shadow-md transition-all">
            <div className="absolute top-0 end-0 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                {copy.publishedActive}
              </span>
              <div className="p-2 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 rounded-xl border border-emerald-200 dark:border-emerald-800/50">
                <AppWindow className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-semibold text-emerald-600 dark:text-emerald-400 mt-2 font-mono flex items-center gap-2">
              {applications?.filter(
                (a) =>
                  a.lifecycleStatus === "ACTIVE" &&
                  a.publicationStatus === "PUBLISHED",
              ).length || 0}
            </div>
            <div className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold mt-1">
              {copy.currentPageReadiness}
            </div>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="bg-white dark:bg-slate-900/90 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-3">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-amber-500 absolute top-3.5 start-3.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label={copy.search}
              placeholder={copy.searchPlaceholder}
              className="w-full ps-10 pe-4 py-2.5 text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all"
            />
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
            <Filter
              value={typeFilter}
              onChange={setTypeFilter}
              label={copy.filterType}
              options={["ALL", "SYSTEM", "TENANT"]}
              optionLabel={(value) => copy.option(value)}
            />
            <Filter
              value={commercialFilter}
              onChange={setCommercialFilter}
              label={copy.filterCommercial}
              options={["ALL", "NON_BILLABLE", "INCLUDED", "SUBSCRIPTION"]}
              optionLabel={(value) => copy.option(value)}
            />
            <Filter
              value={visibilityFilter}
              onChange={setVisibilityFilter}
              label={copy.filterVisibility}
              options={["ALL", "PUBLIC", "INTERNAL"]}
              optionLabel={(value) => copy.option(value)}
            />
            <Filter
              value={lifecycleFilter}
              onChange={setLifecycleFilter}
              label={copy.filterLifecycle}
              options={["ALL", "DRAFT", "ACTIVE", "DEPRECATED", "DISABLED"]}
              optionLabel={(value) => copy.option(value)}
            />
            <Filter
              value={publicationFilter}
              onChange={setPublicationFilter}
              label={copy.filterPublication}
              options={["ALL", "UNPUBLISHED", "PUBLISHED"]}
              optionLabel={(value) => copy.option(value)}
            />
            <Filter
              value={deploymentFilter}
              onChange={setDeploymentFilter}
              label={copy.filterDatabaseDeployment}
              options={["ALL", "NONE", "ON_DEMAND", "PREWARM", "REQUIRED"]}
              optionLabel={(value) => copy.option(value)}
            />
          </div>
        </div>

        {/* Dynamic Colorful Table View */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-start">
              <thead>
                <tr className="bg-slate-100/70 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 font-semibold uppercase tracking-wider">
                  <th className="py-4 px-5 text-start">{copy.application}</th>
                  <th className="py-4 px-5 text-start">{copy.key}</th>
                  <th className="py-4 px-5 text-start">{copy.type}</th>
                  <th className="py-4 px-5 text-start">{copy.databaseDeployment}</th>
                  <th className="py-4 px-5 text-start">{copy.publication}</th>
                  <th className="py-4 px-5 text-start">{copy.lifecycle}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {isLoading ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="py-12 text-center text-slate-500 font-medium"
                    >
                      {copy.loading}
                    </td>
                  </tr>
                ) : error ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="py-12 text-center text-rose-500 font-semibold"
                    >
                      <p>{error}</p>
                      <button
                        type="button"
                        onClick={() => void refresh()}
                        className="mt-3 inline-flex items-center gap-2 rounded-xl bg-rose-600 px-3 py-2 text-xs text-white"
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                        {copy.retry}
                      </button>
                    </td>
                  </tr>
                ) : applications.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="py-16 text-center text-slate-400 font-semibold"
                    >
                      {copy.empty}
                    </td>
                  </tr>
                ) : (
                  applications.map((app) => (
                    <tr
                      key={app.id}
                      className="group hover:bg-amber-50/40 dark:hover:bg-amber-950/20 transition-all"
                    >
                      <td className="py-4 px-5">
                        <Link
                          href={`/applications-catalogue/${app.key}`}
                          className="group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors inline-block"
                        >
                          <span className="font-semibold text-sm text-slate-900 dark:text-slate-100 group-hover:text-amber-600 dark:group-hover:text-amber-400">
                            {app.name}
                          </span>
                          <span className="text-slate-400 font-normal text-xs block mt-0.5">
                            {app.description}
                          </span>
                        </Link>
                      </td>
                      <td className="py-4 px-5 font-mono">
                        <span className="bg-slate-100 dark:bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700/60 font-semibold text-slate-700 dark:text-slate-300 text-xs">
                          {app.key}
                        </span>
                      </td>
                      <td className="py-4 px-5">
                        <span
                          className={`px-2.5 py-1 rounded-lg font-semibold text-[11px] border ${
                            app.applicationType === "TENANT"
                              ? "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-900/60"
                              : "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700"
                          }`}
                        >
                          {copy.option(app.applicationType)}
                        </span>
                      </td>
                      <td className="py-4 px-5">
                        <span
                          className={`px-2.5 py-1 rounded-lg font-semibold text-[11px] border ${
                            app.databaseDeployment !== "NONE"
                              ? "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-900/60"
                              : "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700"
                          }`}
                        >
                          {copy.option(app.databaseDeployment)}
                        </span>
                      </td>
                      <td className="py-4 px-5">
                        <span
                          className={`inline-flex rounded-lg border px-2.5 py-1 text-[11px] font-semibold ${
                            app.publicationStatus === "PUBLISHED"
                              ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300"
                              : "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200"
                          }`}
                        >
                          {copy.option(app.publicationStatus)}
                        </span>
                      </td>
                      <td className="py-4 px-5">
                        <StatusBadge status={app.lifecycleStatus} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <TablePagination meta={meta} page={page} setPage={setPage} />
        </div>
      </main>
    </div>
  );
}

function ApplicationsReadBoundary({
  lang,
  loading = false,
}: {
  lang: "ar" | "en";
  loading?: boolean;
}) {
  return (
    <div
      dir={lang === "ar" ? "rtl" : "ltr"}
      className="flex min-h-screen flex-col bg-slate-50 text-slate-900 dark:bg-canvas dark:text-slate-100"
    >
      <Navbar />
      <main className="grid flex-1 place-items-center p-6">
        <section
          role={loading ? "status" : undefined}
          className="flex max-w-xl flex-col items-center rounded-xl border border-slate-200 bg-white p-8 text-center dark:border-slate-800 dark:bg-slate-950"
        >
          {loading ? (
            <AppWindow className="size-8 animate-pulse text-amber-500" />
          ) : (
            <ShieldAlert className="size-8 text-amber-500" />
          )}
          <h1 className="mt-3 font-semibold">
            {loading
              ? lang === "ar"
                ? "جارٍ التحقق من الصلاحيات..."
                : "Checking Application Catalogue access..."
              : lang === "ar"
                ? "لا تملك صلاحية عرض كتالوج التطبيقات."
                : "You do not have permission to view the Application Catalogue."}
          </h1>
        </section>
      </main>
    </div>
  );
}

function Filter<T extends string>({
  value,
  onChange,
  label,
  options,
  optionLabel,
}: {
  value: T;
  onChange: (value: T) => void;
  label: string;
  options: readonly T[];
  optionLabel: (value: T) => string;
}) {
  return (
    <label className="text-2xs font-semibold uppercase tracking-wider text-slate-500">
      <span className="sr-only">{label}</span>
      <select
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value as T)}
        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2.5 text-xs font-semibold normal-case tracking-normal text-slate-700 outline-none focus:border-amber-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {optionLabel(option)}
          </option>
        ))}
      </select>
    </label>
  );
}

function catalogueCopy(lang: "ar" | "en") {
  const arabicOptions: Record<string, string> = {
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
    TENANT_DATABASE: "قاعدة بيانات المستأجر",
    ON_DEMAND: "عند الطلب",
    PREWARM: "تجهيز مسبق",
    REQUIRED: "إلزامي",
  };
  return lang === "ar"
    ? {
        title: "كتالوج التطبيقات",
        registry: "سجل طائرة التحكم",
        description: "سجل تطبيقات المنصة وتعريفات الخدمات التجارية وحدود الوصول لقواعد البيانات ونماذج استحقاق الاشتراكات.",
        register: "تسجيل تطبيق",
        onboard: "تهيئة تطبيق",
        audit: "تدقيق الكتالوج",
        totalApps: "إجمالي التطبيقات",
        registeredApps: "تطبيقات النظام المسجلة",
        commercialApps: "التطبيقات التجارية",
        subscriptionOfferings: "عروض اشتراك المستأجرين",
        managedDatabaseDeployment: "نشر قواعد البيانات",
        deploymentProfiles: "ملفات نشر مُدارة",
        publishedActive: "المنشور والنشط",
        currentPageReadiness: "الصفحة الحالية · الجاهزية معروضة بشكل مستقل",
        search: "بحث التطبيقات",
        searchPlaceholder: "ابحث في التطبيقات…",
        filterType: "النوع",
        filterCommercial: "النموذج التجاري",
        filterVisibility: "الظهور",
        filterLifecycle: "دورة الحياة",
        filterPublication: "النشر",
        filterDatabaseDeployment: "نشر قاعدة البيانات",
        application: "التطبيق",
        key: "المفتاح",
        type: "النوع",
        databaseDeployment: "نشر قاعدة البيانات",
        publication: "النشر",
        lifecycle: "دورة الحياة",
        loading: "جارٍ تحميل التطبيقات…",
        retry: "إعادة المحاولة",
        empty: "لا توجد تطبيقات مطابقة",
        option: (value: string) => arabicOptions[value] ?? value.replaceAll("_", " "),
      }
    : {
        title: "Application Catalogue",
        registry: "Control Plane Registry",
        description: "Platform application registry, commercial service definitions, database access boundaries, and subscription entitlement models.",
        register: "Register Application",
        onboard: "Onboard Application",
        audit: "Catalogue audit",
        totalApps: "Total Apps",
        registeredApps: "Registered System Applications",
        commercialApps: "Commercial Apps",
        subscriptionOfferings: "Tenant Subscription Offerings",
        managedDatabaseDeployment: "Database Deployment",
        deploymentProfiles: "Managed deployment profiles",
        publishedActive: "Published Active",
        currentPageReadiness: "Current page · readiness remains separate",
        search: "Search applications",
        searchPlaceholder: "Search applications…",
        filterType: "Type",
        filterCommercial: "Commercial",
        filterVisibility: "Visibility",
        filterLifecycle: "Lifecycle",
        filterPublication: "Publication",
        filterDatabaseDeployment: "Database deployment",
        application: "Application",
        key: "Key",
        type: "Type",
        databaseDeployment: "Database Deployment",
        publication: "Publication",
        lifecycle: "Lifecycle",
        loading: "Loading applications…",
        retry: "Retry",
        empty: "No applications found",
        option: (value: string) => value === "ALL" ? "All" : value.replaceAll("_", " "),
      };
}
