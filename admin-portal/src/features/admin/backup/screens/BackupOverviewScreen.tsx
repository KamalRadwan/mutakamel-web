"use client";

import Link from "next/link";
import { ArchiveRestore, CalendarClock, DatabaseBackup, FileCheck2, RefreshCw } from "lucide-react";
import { BackupPageHeader } from "../components/BackupPageHeader";
import { BackupErrorBanner } from "../components/BackupErrorBanner";
import { BackupServerSelect } from "../components/BackupServerSelect";
import { BackupStatePanel } from "../components/BackupStatePanel";
import { useBackupOverview } from "../hooks/useBackupOverview";
import { formatBackupDate, formatBackupNumber } from "../lib/backup-format";
import { useI18n } from "@/i18n/I18nContext";
import { StatGrid, StatCard, Card, CardHeader, CardTitle, CardContent, Button, OperationTimeline, StatusBadge, type OperationTimelineStep } from "@/design-system";

export function BackupOverviewScreen() {
  const { lang, t } = useI18n();
  const copy = t.backup.overviewScreen;
  const locale = lang === "ar" ? "ar-EG" : "en-US";
  const view = useBackupOverview();
  const accessUnavailable = Boolean(view.databaseAccessError);

  if (view.isLoading && !view.hasWorkerData) {
    return (
      <BackupStatePanel
        kind="loading"
        title={copy.loadingTitle}
        description={copy.loadingDescription}
      />
    );
  }

  if (view.error && !view.hasWorkerData) {
    return (
      <BackupStatePanel
        kind="error"
        title={copy.errorTitle}
        description={view.error.message}
        correlationId={view.error.correlationId}
        action={
          <Button type="button" variant="primary" onClick={() => void view.refresh()}>
            {copy.retryButton}
          </Button>
        }
      />
    );
  }

  const chain: OperationTimelineStep[] = [
    {
      label: copy.chain.databaseAccessLabel,
      detail: !view.canReadDatabaseAccess
        ? copy.chain.accessRestricted
        : view.isDatabaseAccessLoading
          ? copy.chain.accessLoading
          : accessUnavailable
            ? copy.chain.accessUnavailable
            : view.accessBinding?.status === "READY"
              ? copy.chain.accessReady
              : copy.chain.accessNoEvidence,
      state: !view.canReadDatabaseAccess
        ? "pending"
        : view.isDatabaseAccessLoading || accessUnavailable
          ? "pending"
          : view.accessBinding?.status === "READY"
            ? "done"
            : "warning",
    },
    {
      label: copy.chain.schedulePolicyLabel,
      detail: view.selectedData.policy?.enabled
        ? `${view.selectedData.policy.cronExpression} · ${view.selectedData.policy.timezone}`
        : copy.chain.noEnabledPolicy,
      state: view.selectedData.policy?.enabled ? "done" : "warning",
    },
    {
      label: copy.chain.latestBackupLabel,
      detail: view.selectedData.latestRun
        ? `${view.selectedData.latestRun.status.replaceAll("_", " ")} · ${formatBackupDate(view.selectedData.latestRun.startedAt, locale)}`
        : copy.chain.noRunEvidence,
      state: view.selectedData.latestRun?.status === "COMPLETED" ? "done" : view.selectedData.latestRun ? "warning" : "pending",
    },
    {
      label: copy.chain.restoreVerificationLabel,
      detail: view.selectedData.latestRestore
        ? `${view.selectedData.latestRestore.status} · ${formatBackupDate(view.selectedData.latestRestore.startedAt, locale)}`
        : copy.chain.noRestoreEvidence,
      state:
        view.selectedData.latestRestore?.status === "VERIFIED" || view.selectedData.latestRestore?.status === "PROMOTED"
          ? "done"
          : view.selectedData.latestRestore
            ? "warning"
            : "pending",
    },
  ];

  return (
    <div className="w-full space-y-6">
      <BackupPageHeader
        eyebrow={copy.eyebrow}
        title={copy.title}
        description={copy.description}
        actions={
          <Button type="button" variant="outline" onClick={() => void view.refresh()} disabled={view.isLoading} loading={view.isLoading}>
            {!view.isLoading && <RefreshCw className="size-4" aria-hidden="true" />}
            {copy.refreshButton}
          </Button>
        }
      />

      {view.error && <BackupErrorBanner error={view.error} />}
      {view.databaseAccessError && <BackupErrorBanner error={view.databaseAccessError} />}

      <StatGrid className="grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label={copy.statEnabledPolicies} value={formatBackupNumber(view.metrics.enabledPolicies, locale)} icon={CalendarClock} />
        <StatCard label={copy.statActiveRuns} value={formatBackupNumber(view.metrics.activeRuns, locale)} icon={DatabaseBackup} />
        <StatCard label={copy.statCompletedArtifacts} value={formatBackupNumber(view.metrics.completedArtifacts, locale)} icon={FileCheck2} />
        <StatCard label={copy.statVerifiedRestores} value={formatBackupNumber(view.metrics.verifiedRestores, locale)} icon={ArchiveRestore} />
      </StatGrid>
      <p className="text-xs text-muted-foreground">
        {copy.boundedSnapshotNote}
      </p>

      {view.canReadDatabaseAccess ? (
        <Card>
          <CardContent className="grid gap-4 p-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
            <BackupServerSelect
              label={copy.serverContextLabel}
              value={view.selectedServerId}
              servers={view.servers}
              onChange={view.setSelectedServerId}
              placeholder={t.backup.policiesScreen.selectServerPlaceholder}
            />
            {view.selectedServerId && (
              <Button variant="primary" asChild>
                <Link href={`/backup/access?databaseServerId=${encodeURIComponent(view.selectedServerId)}`}>
                  {copy.inspectAccessButton}
                </Link>
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <BackupStatePanel
          kind="forbidden"
          title={copy.accessDetailRestrictedTitle}
          description={copy.accessDetailRestrictedDescription}
        />
      )}

      {view.canReadDatabaseAccess && view.isDatabaseAccessLoading ? (
        <BackupStatePanel
          kind="loading"
          title={copy.loadingServerContextTitle}
          description={copy.loadingServerContextDescription}
        />
      ) : view.canReadDatabaseAccess && view.databaseAccessError ? null : view.canReadDatabaseAccess && view.servers.length === 0 ? (
        <BackupStatePanel
          kind="empty"
          title={copy.noServersTitle}
          description={copy.noServersDescription}
        />
      ) : view.canReadDatabaseAccess ? (
        <OperationTimeline
          steps={chain}
          lang={lang}
          title={copy.protectionChainTitle}
          description={copy.protectionChainDescription}
        />
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex-col items-start justify-between gap-2 space-y-0 sm:flex-row sm:items-center">
            <CardTitle className="text-base">{copy.latestRunTitle}</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/backup/runs">{copy.viewAllLink}</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {view.selectedData.latestRun ? (
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p dir="ltr" className="break-all font-mono text-sm font-semibold">{view.selectedData.latestRun.id}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{formatBackupDate(view.selectedData.latestRun.startedAt, locale)}</p>
                </div>
                <StatusBadge status={view.selectedData.latestRun.status} />
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{copy.noEvidenceText}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-col items-start justify-between gap-2 space-y-0 sm:flex-row sm:items-center">
            <CardTitle className="text-base">{copy.latestRestoreTitle}</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/backup/restores">{copy.viewAllLink}</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {view.selectedData.latestRestore ? (
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p dir="ltr" className="break-all font-mono text-sm font-semibold">{view.selectedData.latestRestore.id}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{formatBackupDate(view.selectedData.latestRestore.startedAt, locale)}</p>
                </div>
                <StatusBadge status={view.selectedData.latestRestore.status} />
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{copy.noEvidenceText}</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
