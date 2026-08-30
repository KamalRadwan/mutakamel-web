"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppWindow, ArrowLeft, Database, FileCheck, Loader2, Pencil, Settings, Shield, Trash2 } from "lucide-react";
import { DestructiveActionModal } from "@/components/shared/DestructiveActionModal";
import { StatusBadge, PageHeader, Card, Button } from "@/design-system";
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
import type { ApplicationServerSummaryView } from "@/features/admin/applications/types";
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
  const [technicalDialog, setTechnicalDialog] = useState<"ADOPT" | "BIND" | null>(null);
  const [publishOpen, setPublishOpen] = useState(false);

  useEffect(() => {
    queueMicrotask(() => {
      setConfigurationMode(null);
      setLifecycleAction(null);
      setDeleteOpen(false);
      setTechnicalDialog(null);
      setPublishOpen(false);
    });
  }, [applicationKey]);

  const canEditMetadata = adminCanAll(user, ["admin.applications.update"]);
  const canLifecycle = adminCanAll(user, ["admin.applications.update", "admin.applications.critical"]);
  const canDelete = adminCanAll(user, ["admin.applications.delete", "admin.applications.critical"]);
  const canReadCatalogue = adminCanAll(user, ["admin.catalog.read"]);
  const canCreateCatalogue = adminCanAll(user, ["admin.catalog.manage"]);
  const canMutateCatalogue = adminCanAll(user, ["admin.catalog.manage", "admin.catalog.critical"]);

  if (detail.isLoading) return <PageFrame><div role="status" className="flex min-h-96 items-center justify-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-5 animate-spin motion-reduce:animate-none" aria-hidden="true" />{t.applications.detail.loading}</div></PageFrame>;
  if (detail.error || !detail.application) return <PageFrame><div role="alert" className="mx-auto mt-16 max-w-lg rounded-lg border border-destructive/30 bg-destructive-subtle p-6 text-center text-sm text-destructive-subtle-foreground"><p>{detail.error || t.applications.detail.notFound}</p><Button type="button" variant="destructive" className="mt-4" onClick={() => void detail.fetchApplication()}>{t.applications.detail.retry}</Button></div></PageFrame>;

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
  const requiredFleetCoverageBlocked =
    application.databaseDeployment === "REQUIRED" &&
    (application.serverSummary.ready < application.serverSummary.eligible ||
      application.serverSummary.pending > 0 ||
      application.serverSummary.degraded > 0);
  const lifecycleOptions: ApplicationLifecycleAction[] = application.lifecycleStatus === "DRAFT"
    ? ["activate", "disable"]
    : application.lifecycleStatus === "ACTIVE"
      ? ["deprecate", "disable"]
      : application.lifecycleStatus === "DEPRECATED"
        ? ["disable"]
        : [];

  const runLifecycle = async (reason: string) => {
    if (lifecycleAction === "activate") {
      if (activationReadiness !== "ALLOWED" || requiredFleetCoverageBlocked) {
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
      <PageHeader
        breadcrumb={
          <Link href="/applications-catalogue" className="inline-flex w-fit items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground">
            <ArrowLeft className={`size-3.5 ${dir === "rtl" ? "rotate-180" : ""}`} aria-hidden="true" />
            {t.applications.detail.back}
          </Link>
        }
        title={application.name}
        description={application.description || t.applications.detail.noDescription}
        status={
          <div className="flex flex-wrap items-center gap-2">
            <span className="grid size-8 place-items-center rounded-lg bg-info-subtle text-info-subtle-foreground">
              <AppWindow className="size-4" aria-hidden="true" />
            </span>
            <StatusBadge
              status={application.lifecycleStatus}
              enumType="application"
            />
            <code dir="ltr" className="rounded bg-muted px-2 py-1 font-mono text-xs text-muted-foreground">{application.key}</code>
          </div>
        }
        action={
          <div className="flex flex-wrap gap-2">
            {canEditMetadata && <Button type="button" variant="outline" onClick={() => setConfigurationMode("metadata")}><Pencil className="size-3.5" aria-hidden="true" />{t.applications.detail.editMetadata}</Button>}
            {canLifecycle && <Button type="button" variant="outline" onClick={() => setConfigurationMode("policy")}><Settings className="size-3.5" aria-hidden="true" />{t.applications.detail.databasePolicy}</Button>}
            {canLifecycle && lifecycleOptions.map((action) => {
              const blocked =
                action === "activate" &&
                (activationReadiness !== "ALLOWED" ||
                  requiredFleetCoverageBlocked);
              const blockedTitle = activationReadiness === "UNAVAILABLE" ? t.applications.detail.activationUnavailable : t.applications.detail.activationBlocked;
              return <Button key={action} type="button" variant="secondary" disabled={blocked} title={blocked ? blockedTitle : undefined} onClick={() => setLifecycleAction(action)}>{t.applications.detail.lifecycle[action]}</Button>;
            })}
            {canDelete && application.lifecycleStatus === "DRAFT" && <Button type="button" variant="destructive" onClick={() => setDeleteOpen(true)}><Trash2 className="size-3.5" aria-hidden="true" />{t.applications.detail.delete}</Button>}
          </div>
        }
      />

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
        <Fact label={t.applications.detail.facts.applicationType} value={application.applicationType} />
        <Fact label={t.applications.detail.facts.commercialMode} value={application.commercialMode} />
        <Fact label={t.applications.detail.facts.databaseDeployment} value={application.databaseDeployment} />
        <Fact label={t.applications.detail.facts.databasePrincipal} value={application.databasePrincipal || t.applications.detail.facts.none} mono />
      </section>

      <ApplicationTechnicalProvisioningPanel
        applicationKey={application.key}
        databasePrincipal={application.databasePrincipal}
        readiness={technical.readiness}
        error={technical.error}
        isLoading={technical.isLoading}
        isRefreshing={technical.isRefreshing}
        canManage={canLifecycle}
        onRetry={() => void technical.refresh()}
        onOpenAdoption={() => setTechnicalDialog("ADOPT")}
        onOpenBinding={() => setTechnicalDialog("BIND")}
      />

      <section className="grid gap-5 lg:grid-cols-[1fr_1.25fr]">
        <Card className="p-5">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground"><Shield className="size-4 text-info" aria-hidden="true" />{t.applications.detail.databasePolicy}</h2>
          <dl className="mt-4 grid grid-cols-2 gap-4 text-xs"><Item label={t.applications.detail.newServers} value={application.databasePolicy.enableOnNewServers ? t.applications.detail.enabled : t.applications.detail.disabled} /><Item label={t.applications.detail.rotation} value={application.databasePolicy.rotationEnabled ? t.applications.detail.enabled : t.applications.detail.disabled} /><Item label={t.applications.detail.interval} value={`${application.databasePolicy.rotationIntervalHours} ${t.applications.detail.hours}`} /><Item label={t.applications.detail.maintenance} value={`${application.databasePolicy.maintenanceWindowStartUtc}:00 UTC · ${application.databasePolicy.maintenanceWindowHours}h`} /><Item label={t.applications.detail.policyRevision} value={application.databasePolicy.policyRevision} /><Item label={t.applications.detail.catalogueRevision} value={application.catalogueRevision} /></dl>
        </Card>
        <Card className="p-5">
          <div className="flex items-center justify-between gap-3"><h2 className="flex items-center gap-2 text-sm font-semibold text-foreground"><FileCheck className="size-4 text-info" aria-hidden="true" />{t.applications.detail.safeManifests}</h2><Button type="button" variant="ghost" size="sm" onClick={() => void detail.fetchManifests()}>{t.applications.detail.retry}</Button></div>
          {detail.isManifestLoading ? <div role="status" className="mt-4 text-xs text-muted-foreground">{t.applications.detail.loadingManifests}</div> : detail.manifestError ? <div role="alert" className="mt-4 rounded-lg border border-warning/30 bg-warning-subtle p-3 text-xs text-warning-subtle-foreground">{detail.manifestError}</div> : !detail.manifests.length ? <div className="mt-4 rounded-lg border border-dashed border-border p-5 text-center text-xs text-muted-foreground">{t.applications.detail.noManifests}</div> : <div className="mt-4 space-y-2">{detail.manifests.map((manifest) => <div key={manifest.id} className="grid gap-2 rounded-lg border border-border p-3 text-xs sm:grid-cols-[1fr_auto]"><div dir="ltr"><div className="font-mono font-semibold text-foreground">{manifest.contractPackage}@{manifest.contractVersion}</div><div className="mt-1 truncate font-mono text-xs text-muted-foreground" title={manifest.checksum}>{manifest.checksum}</div></div><div className="text-end"><span className={`rounded-full px-2 py-1 text-xs font-semibold ${manifest.active ? "bg-success-subtle text-success-subtle-foreground" : "bg-muted text-muted-foreground"}`}>{manifest.active ? t.applications.detail.active : t.applications.detail.historical} · v{manifest.version}</span><time className="mt-2 block text-xs text-muted-foreground">{new Date(manifest.publishedAt).toLocaleString(lang === "ar" ? "ar-EG" : "en-US")}</time></div></div>)}</div>}
        </Card>
      </section>

      <ApplicationServerCoverage summary={application.serverSummary} lang={lang} />

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
    <ApplicationPrimaryComponentDialog
      isOpen={technicalDialog !== null}
      mode={technicalDialog ?? "ADOPT"}
      applicationKey={application.key}
      runtimeTarget={technical.readiness?.runtimeTarget ?? application.runtimeTarget}
      databasePrincipal={application.databasePrincipal}
      technicalDefinitionRevision={technical.readiness?.technicalDefinitionRevision ?? application.technicalDefinitionRevision}
      isSubmitting={technicalDialog === "ADOPT" ? technical.isAdopting : technical.isLinking}
      commandError={technical.commandError}
      canRetryExactIntent={technical.pendingIntentKind === technicalDialog}
      onClose={() => setTechnicalDialog(null)}
      onConfirm={(reason) => technicalDialog === "ADOPT"
        ? technical.adoptTechnicalPackage(reason)
        : technical.linkPrimaryComponent(reason)}
      onRetryExactIntent={technical.retryPendingIntent}
      onClearCommandError={technical.clearCommandError}
    />
    <DestructiveActionModal isOpen={deleteOpen} onClose={() => setDeleteOpen(false)} onConfirm={() => { void detail.deleteApplication(application.catalogueRevision, t.applications.detail.deleteReason).then(() => router.push("/applications-catalogue")); }} title={t.applications.detail.deleteTitle} description={t.applications.detail.deleteDescription} targetName={application.name} actionType="delete" requireNameTyping isSubmitting={detail.isMutating} />
  </PageFrame>;
}

function PageFrame({ children }: { children: React.ReactNode }) { return <div className="w-full space-y-6">{children}</div>; }
function Fact({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) { return <Card className="p-4"><div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground rtl:normal-case rtl:tracking-normal">{label}</div><div className={`mt-2 truncate text-sm font-semibold text-foreground ${mono ? "font-mono" : ""}`} title={value}>{value}</div></Card>; }
function Item({ label, value }: { label: string; value: string }) { return <div><dt className="text-xs font-semibold uppercase tracking-wider text-muted-foreground rtl:normal-case rtl:tracking-normal">{label}</dt><dd className="mt-1 font-mono font-semibold text-foreground">{value}</dd></div>; }

function ApplicationServerCoverage({ summary, lang }: { summary: ApplicationServerSummaryView; lang: "ar" | "en" }) {
  const copy = lang === "ar"
    ? { title: "تغطية خوادم قواعد البيانات", ready: "جاهز", eligible: "مؤهل", pending: "قيد الانتظار", degraded: "متعثر", rollout: "يحتاج استكمال النشر", complete: "التغطية مكتملة", notRequired: "لا يحتاج نشرًا على الأسطول" }
    : { title: "Database Server coverage", ready: "Ready", eligible: "Eligible", pending: "Pending", degraded: "Degraded", rollout: "Rollout needs attention", complete: "Coverage complete", notRequired: "Fleet rollout not required" };
  const coverage = Math.min(100, Math.max(0, summary.coveragePercent));
  const needsAttention =
    summary.rolloutRequired &&
    (summary.ready < summary.eligible ||
      summary.pending > 0 ||
      summary.degraded > 0);
  const status = needsAttention
    ? copy.rollout
    : summary.rolloutRequired
      ? copy.complete
      : copy.notRequired;
  return <Card className="p-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground"><Database className={`size-4 ${needsAttention ? "text-warning" : "text-success"}`} aria-hidden="true" />{copy.title}</h2>
      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${needsAttention ? "bg-warning-subtle text-warning-subtle-foreground" : "bg-success-subtle text-success-subtle-foreground"}`}>{status}</span>
    </div>
    <div role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={coverage} className="mt-4 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-success" style={{ width: `${coverage}%` }} /></div>
    <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
      <CoverageMetric label={copy.eligible} value={summary.eligible} />
      <CoverageMetric label={copy.ready} value={summary.ready} />
      <CoverageMetric label={copy.pending} value={summary.pending} />
      <CoverageMetric label={copy.degraded} value={summary.degraded} />
    </div>
  </Card>;
}

function CoverageMetric({ label, value }: { label: string; value: number }) {
  return <div className="rounded-lg bg-muted p-3"><div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground rtl:normal-case rtl:tracking-normal">{label}</div><div className="mt-1 font-mono text-lg font-semibold text-foreground">{value}</div></div>;
}
