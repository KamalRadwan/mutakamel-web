"use client";

import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  OperationTimeline,
  StatusBadge,
} from "@/design-system";
import { PlacementDatum } from "../../components/PlacementDatum";
import {
  formatStorageBytes,
  storageMigrationTimelineSteps,
} from "../model/migration-timeline";
import type { TenantStorageMigrationController } from "../hooks/useTenantStorageMigrationWizard";

export function StorageMigrationMonitorPanel({
  controller,
}: {
  controller: TenantStorageMigrationController;
}) {
  const { copy, lang, migration } = controller;
  if (!migration) return null;
  const paused = controller.isRunning && controller.refreshGuard.isPaused;

  return (
    <div className="space-y-4" aria-busy={controller.isRunning || undefined}>
      <Card>
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-3">
          <CardTitle className="text-sm">{copy.monitorTitle}</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={migration.status} />
            {controller.isRunning ? (
              <Badge tone={paused ? "neutral" : "info"} role="status" aria-live="polite">
                {paused ? copy.refreshPaused : copy.autoRefreshing}
              </Badge>
            ) : null}
          </div>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-3 text-xs sm:grid-cols-2">
            <PlacementDatum label={copy.migrationId} value={migration.id} mono />
            <PlacementDatum
              label={copy.sourceServer}
              value={migration.sourceStorageServerId}
              mono
            />
            <PlacementDatum
              label={copy.targetServer}
              value={migration.targetStorageServerId}
              mono
            />
            <PlacementDatum
              label={copy.expectedRevision}
              value={migration.expectedStoragePlacementRevision}
              mono
            />
            {migration.resultingStoragePlacementRevision !== null ? (
              <PlacementDatum
                label={copy.resultingRevision}
                value={migration.resultingStoragePlacementRevision}
                mono
              />
            ) : null}
            {migration.copiedObjectCount !== null ? (
              <PlacementDatum
                label={copy.objectsCopied}
                value={new Intl.NumberFormat(
                  lang === "ar" ? "ar-EG" : "en-US",
                ).format(migration.copiedObjectCount)}
              />
            ) : null}
            {migration.copiedBytes !== null ? (
              <PlacementDatum
                label={copy.bytesCopied}
                value={formatStorageBytes(migration.copiedBytes, lang)}
              />
            ) : null}
            {migration.namespaceDigest ? (
              <PlacementDatum
                label={copy.namespaceDigest}
                value={migration.namespaceDigest}
                mono
              />
            ) : null}
            {migration.failureCode ? (
              <PlacementDatum
                label={copy.failureCode}
                value={migration.failureCode}
                mono
              />
            ) : null}
          </dl>
        </CardContent>
      </Card>

      <OperationTimeline
        steps={storageMigrationTimelineSteps(migration, lang)}
        title={copy.monitorTitle}
        description={copy.monitorDescription}
        lang={lang}
      />
    </div>
  );
}
