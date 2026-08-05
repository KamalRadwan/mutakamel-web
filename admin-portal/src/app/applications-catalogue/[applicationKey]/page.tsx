"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, AppWindow, ArrowLeft, FileCheck, Loader2, Pencil, Settings, Shield, Trash2 } from "lucide-react";
import { Navbar } from "@/components/layout/Navbar";
import { DestructiveActionModal } from "@/components/shared/DestructiveActionModal";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { useAuth } from "@/context/AuthContext";
import { ApplicationCatalogueWorkspace } from "@/features/admin/applications/components/ApplicationCatalogueWorkspace";
import { ApplicationConfigurationDialog } from "@/features/admin/applications/components/ApplicationConfigurationDialog";
import { ApplicationLifecycleDialog, type ApplicationLifecycleAction } from "@/features/admin/applications/components/ApplicationLifecycleDialog";
import { ApplicationPrimaryComponentDialog } from "@/features/admin/applications/components/ApplicationPrimaryComponentDialog";
import { ApplicationPublishDialog } from "@/features/admin/applications/components/ApplicationPublishDialog";
import { ApplicationReleaseAuthorityRail } from "@/features/admin/applications/components/ApplicationReleaseAuthorityRail";
import { ApplicationTechnicalProvisioningPanel } from "@/features/admin/applications/components/ApplicationTechnicalProvisioningPanel";
import { useApplication } from "@/features/admin/applications/hooks/useApplication";
import { useApplicationTechnicalProvisioning } from "@/features/admin/applications/hooks/useApplicationTechnicalProvisioning";
import { getActivationReadinessState } from "@/features/admin/applications/lib/technical-provisioning-state";
import { useI18n } from "@/i18n/I18nContext";
import { adminCanAll } from "@/lib/auth/rbac";

export default function ApplicationDetailPage({ params }: { params: Promise<{ applicationKey: string }> }) {
  const { applicationKey } = use(params);
  const router = useRouter();
  const { user } = useAuth();
  const { t, dir, lang } = useI18n();
  const detail = useApplication(applicationKey);
  const technical = useApplicationTechnicalProvisioning(applicationKey, {
    onChanged: detail.fetchApplication,
  });
  const [configurationMode, setConfigurationMode] = useState<"metadata" | "policy" | null>(null);
  const [lifecycleAction, setLifecycleAction] = useState<ApplicationLifecycleAction | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [bindingOpen, setBindingOpen] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);

  const canEditMetadata = adminCanAll(user, ["admin.applications.update"]);
  const canLifecycle = adminCanAll(user, ["admin.applications.update", "admin.applications.critical"]);
  const canDelete = adminCanAll(user, ["admin.applications.delete", "admin.applications.critical"]);
  const canReadCatalogue = adminCanAll(user, ["admin.catalog.read"]);
  const canCreateCatalogue = adminCanAll(user, ["admin.catalog.manage"]);
  const canMutateCatalogue = adminCanAll(user, ["admin.catalog.manage", "admin.catalog.critical"]);

  if (detail.isLoading) return <PageFrame><div role="status" className="flex min-h-96 items-center justify-center gap-2 text-sm text-slate-500"><Loader2 className="h-5 w-5 animate-spin" />{t.applications.detail.loading}</div></PageFrame>;
  if (detail.error || !detail.application) return <PageFrame><div role="alert" className="mx-auto mt-16 max-w-lg rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300"><p>{detail.error || t.applications.detail.notFound}</p><button type="button" onClick={() => void detail.fetchApplication()} className="mt-4 min-h-11 rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white">{t.applications.detail.retry}</button></div></PageFrame>;

  const application = detail.application;
  const activationReadiness = getActivationReadinessState(
    technical.readiness,
    technical.isLoading,
    technical.error !== null,
    {
      publicationStatus: application.publicationStatus,
      publishedAt: application.publishedAt,
      publishedBy: application.publishedBy,
    },
  );
  const lifecycleOptions: ApplicationLifecycleAction[] = application.lifecycleStatus === "DRAFT"
    ? ["activate", "disable"]
    : application.lifecycleStatus === "ACTIVE"
      ? ["deprecate", "disable"]
      : application.lifecycleStatus === "DEPRECATED"
        ? ["disable"]
        : [];

  const runLifecycle = async (reason: string) => {
    if (lifecycleAction === "activate") {
      if (activationReadiness !== "ALLOWED") {
        throw new Error(
          activationReadiness === "UNAVAILABLE"
            ? t.applications.detail.activationUnavailable
            : t.applications.detail.activationBlocked,
        );
      }
      const result = await detail.activateApplication(application.catalogueRevision, reason);
      await technical.refresh();
      return result;
    }
    const result = lifecycleAction === "deprecate"
      ? await detail.deprecateApplication({ expectedCatalogueRevision: application.catalogueRevision, reason })
      : await detail.disableApplication({ expectedCatalogueRevision: application.catalogueRevision, reason });
    await technical.refresh();
    return result;
  };

  return <PageFrame>
    <div className="space-y-6">
      <header className="relative overflow-hidden rounded-3xl border border-violet-500/20 bg-slate-950 p-6 text-white shadow-xl">
        <div className="pointer-events-none absolute end-0 top-0 h-48 w-48 rounded-full bg-violet-500/20 blur-3xl" />
        <div className="relative flex flex-col justify-between gap-5 lg:flex-row lg:items-center">
          <div className="flex min-w-0 items-center gap-4">
            <Link href="/applications-catalogue" aria-label={t.applications.detail.back} className="grid size-11 place-items-center rounded-2xl border border-white/15 bg-white/10 hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300"><ArrowLeft className={`h-5 w-5 ${dir === "rtl" ? "rotate-180" : ""}`} /></Link>
            <div className="min-w-0"><div className="flex flex-wrap items-center gap-3"><span className="rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 p-2.5"><AppWindow className="h-6 w-6" /></span><h1 className="truncate text-2xl font-black">{application.name}</h1><StatusBadge status={application.lifecycleStatus} /></div><p className="mt-2 max-w-3xl text-xs leading-relaxed text-slate-300"><code className="me-2 rounded bg-white/10 px-2 py-1 text-violet-200" dir="ltr">{application.key}</code>{application.description || t.applications.detail.noDescription}</p></div>
          </div>
          <div className="flex flex-wrap gap-2">
            {canEditMetadata && <button type="button" onClick={() => setConfigurationMode("metadata")} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-xs font-bold hover:bg-white/15"><Pencil className="h-3.5 w-3.5" />{t.applications.detail.editMetadata}</button>}
            {canLifecycle && <button type="button" onClick={() => setConfigurationMode("policy")} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-xs font-bold hover:bg-white/15"><Settings className="h-3.5 w-3.5" />{t.applications.detail.databasePolicy}</button>}
            {canLifecycle && lifecycleOptions.map((action) => {
              const blocked = action === "activate" && activationReadiness !== "ALLOWED";
              const blockedTitle = activationReadiness === "UNAVAILABLE" ? t.applications.detail.activationUnavailable : t.applications.detail.activationBlocked;
              return <button key={action} type="button" disabled={blocked} title={blocked ? blockedTitle : undefined} onClick={() => setLifecycleAction(action)} className="min-h-11 rounded-xl bg-violet-600 px-3 py-2 text-xs font-bold hover:bg-violet-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400">{t.applications.detail.lifecycle[action]}</button>;
            })}
            {canDelete && application.lifecycleStatus === "DRAFT" && <button type="button" onClick={() => setDeleteOpen(true)} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-rose-600 px-3 py-2 text-xs font-bold hover:bg-rose-500"><Trash2 className="h-3.5 w-3.5" />{t.applications.detail.delete}</button>}
          </div>
        </div>
      </header>

      <ApplicationReleaseAuthorityRail
        application={application}
        readiness={technical.readiness}
        isReadinessLoading={technical.isLoading}
        hasReadinessError={technical.error !== null}
        canPublish={canLifecycle}
        isPublishing={detail.isMutating}
        onPublish={() => setPublishOpen(true)}
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Fact label={t.applications.detail.facts.applicationType} value={application.applicationType} tone="violet" />
        <Fact label={t.applications.detail.facts.commercialMode} value={application.commercialMode} tone="amber" />
        <Fact label={t.applications.detail.facts.databaseAccess} value={application.databaseAccessMode} tone="blue" />
        <Fact label={t.applications.detail.facts.databasePrincipal} value={application.databasePrincipal || t.applications.detail.facts.none} tone="emerald" mono />
      </section>

      <ApplicationTechnicalProvisioningPanel
        applicationKey={application.key}
        readiness={technical.readiness}
        error={technical.error}
        isLoading={technical.isLoading}
        isRefreshing={technical.isRefreshing}
        canManage={canLifecycle}
        onRetry={() => void technical.refresh()}
        onOpenBinding={() => setBindingOpen(true)}
      />

      <section className="grid gap-5 lg:grid-cols-[1fr_1.25fr]">
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="flex items-center gap-2 text-sm font-black"><Shield className="h-4 w-4 text-blue-500" />{t.applications.detail.databasePolicy}</h2>
          <dl className="mt-4 grid grid-cols-2 gap-4 text-xs"><Item label={t.applications.detail.newServers} value={application.databasePolicy.enableOnNewServers ? t.applications.detail.enabled : t.applications.detail.disabled} /><Item label={t.applications.detail.rotation} value={application.databasePolicy.rotationEnabled ? t.applications.detail.enabled : t.applications.detail.disabled} /><Item label={t.applications.detail.interval} value={`${application.databasePolicy.rotationIntervalHours} ${t.applications.detail.hours}`} /><Item label={t.applications.detail.maintenance} value={`${application.databasePolicy.maintenanceWindowStartUtc}:00 UTC · ${application.databasePolicy.maintenanceWindowHours}h`} /><Item label={t.applications.detail.policyRevision} value={application.databasePolicy.policyRevision} /><Item label={t.applications.detail.catalogueRevision} value={application.catalogueRevision} /></dl>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between gap-3"><h2 className="flex items-center gap-2 text-sm font-black"><FileCheck className="h-4 w-4 text-emerald-500" />{t.applications.detail.safeManifests}</h2><button type="button" onClick={() => void detail.fetchManifests()} className="min-h-11 text-xs font-bold text-violet-600 hover:text-violet-500">{t.applications.detail.retry}</button></div>
          {detail.isManifestLoading ? <div role="status" className="mt-4 text-xs text-slate-500">{t.applications.detail.loadingManifests}</div> : detail.manifestError ? <div role="alert" className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300">{detail.manifestError}</div> : !detail.manifests.length ? <div className="mt-4 rounded-xl border border-dashed border-slate-300 p-5 text-center text-xs text-slate-500 dark:border-slate-700">{t.applications.detail.noManifests}</div> : <div className="mt-4 space-y-2">{detail.manifests.map((manifest) => <div key={manifest.id} className="grid gap-2 rounded-xl border border-slate-200 p-3 text-xs sm:grid-cols-[1fr_auto] dark:border-slate-800"><div dir="ltr"><div className="font-mono font-bold">{manifest.contractPackage}@{manifest.contractVersion}</div><div className="mt-1 truncate font-mono text-[10px] text-slate-500" title={manifest.checksum}>{manifest.checksum}</div></div><div className="text-end"><span className={`rounded-full px-2 py-1 text-[10px] font-bold ${manifest.active ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"}`}>{manifest.active ? t.applications.detail.active : t.applications.detail.historical} · v{manifest.version}</span><time className="mt-2 block text-[10px] text-slate-500">{new Date(manifest.publishedAt).toLocaleString(lang === "ar" ? "ar-EG" : "en-US")}</time></div></div>)}</div>}
        </article>
      </section>

      {!application.serverSummary.available && <section className="flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" /><div><h2 className="text-sm font-black">{t.applications.detail.serverSummaryTitle}</h2><p className="mt-1 text-xs">{t.applications.detail.serverSummaryDescription}</p></div></section>}

      <ApplicationCatalogueWorkspace applicationId={application.id} applicationKey={application.key} canRead={canReadCatalogue} canCreate={canCreateCatalogue} canMutate={canMutateCatalogue} />
    </div>

    <ApplicationConfigurationDialog mode={configurationMode} application={application} isSubmitting={detail.isMutating} onClose={() => setConfigurationMode(null)} onUpdateMetadata={detail.updateApplication} onUpdatePolicy={detail.updateDatabasePolicy} />
    <ApplicationLifecycleDialog action={lifecycleAction} currentStatus={application.lifecycleStatus} isSubmitting={detail.isMutating} onClose={() => setLifecycleAction(null)} onConfirm={runLifecycle} />
    <ApplicationPublishDialog
      isOpen={publishOpen}
      application={application}
      isSubmitting={detail.isMutating}
      onClose={() => setPublishOpen(false)}
      onConfirm={async (dto) => {
        const result = await detail.publishApplication(dto);
        await technical.refresh();
        return result;
      }}
    />
    <ApplicationPrimaryComponentDialog isOpen={bindingOpen} applicationKey={application.key} runtimeTarget={technical.readiness?.runtimeTarget ?? application.runtimeTarget} technicalDefinitionRevision={technical.readiness?.technicalDefinitionRevision ?? application.technicalDefinitionRevision} isSubmitting={technical.isLinking} commandError={technical.commandError} canRetryExactIntent={technical.hasPendingIntent} onClose={() => setBindingOpen(false)} onConfirm={(componentKey, contractVersion, reason) => technical.linkPrimaryComponent({ componentKey, contractVersion, reason })} onRetryExactIntent={technical.retryPendingIntent} onClearCommandError={technical.clearCommandError} />
    <DestructiveActionModal isOpen={deleteOpen} onClose={() => setDeleteOpen(false)} onConfirm={() => { void detail.deleteApplication(application.catalogueRevision, t.applications.detail.deleteReason).then(() => router.push("/applications-catalogue")); }} title={t.applications.detail.deleteTitle} description={t.applications.detail.deleteDescription} targetName={application.name} actionType="delete" requireNameTyping isSubmitting={detail.isMutating} />
  </PageFrame>;
}

function PageFrame({ children }: { children: React.ReactNode }) { return <div className="flex min-h-screen flex-col bg-slate-50 text-slate-950 dark:bg-[#090d16] dark:text-slate-100"><Navbar /><main className="mx-auto w-full max-w-7xl flex-1 space-y-6 p-4 sm:p-6">{children}</main></div>; }
function Fact({ label, value, tone, mono = false }: { label: string; value: string; tone: "violet" | "amber" | "blue" | "emerald"; mono?: boolean }) { const tones = { violet: "border-violet-200 dark:border-violet-900", amber: "border-amber-200 dark:border-amber-900", blue: "border-blue-200 dark:border-blue-900", emerald: "border-emerald-200 dark:border-emerald-900" }; return <div className={`rounded-2xl border bg-white p-4 shadow-sm dark:bg-slate-900 ${tones[tone]}`}><div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</div><div className={`mt-2 truncate text-sm font-black ${mono ? "font-mono" : ""}`} title={value}>{value}</div></div>; }
function Item({ label, value }: { label: string; value: string }) { return <div><dt className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</dt><dd className="mt-1 font-mono font-bold text-slate-900 dark:text-slate-100">{value}</dd></div>; }
