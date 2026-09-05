"use client";

import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  OperationTimeline,
} from "@/design-system";
import {
  formatRelocationInstant,
  relocationTimelineSteps,
} from "../model/relocation-timeline";
import { PlacementDatum } from "../../components/PlacementDatum";
import type { TenantDatabaseRelocationController } from "../hooks/useTenantDatabaseRelocation";

/**
 * The live ledger. It stays mounted across polls — a background refresh never
 * replaces the region, it only updates the steps inside it.
 */
export function RelocationMonitorPanel({
  controller,
}: {
  controller: TenantDatabaseRelocationController;
}) {
  const { copy, lang, record, run } = controller;
  if (!record || !run) return null;
  const paused = controller.isRunning && controller.refreshGuard.isPaused;

  return (
    <div className="space-y-4" aria-busy={controller.isRunning || undefined}>
      <Card>
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-3">
          <CardTitle className="text-sm">{copy.monitorTitle}</CardTitle>
          {controller.isRunning ? (
            <Badge tone={paused ? "neutral" : "info"} role="status" aria-live="polite">
              {paused ? copy.refreshPaused : copy.autoRefreshing}
            </Badge>
          ) : null}
        </CardHeader>
        <CardContent>
          <dl className="grid gap-3 text-xs sm:grid-cols-2">
            <PlacementDatum label={copy.relocationId} value={record.relocationId} mono />
            <PlacementDatum label={copy.runId} value={run.runId} mono />
            <PlacementDatum
              label={copy.movingFrom}
              value={`${record.sourceDatabaseServerId} · ${record.sourceDatabaseName}`}
              mono
            />
            <PlacementDatum
              label={copy.movingTo}
              value={`${record.targetDatabaseServerId} · ${record.targetDatabaseName}`}
              mono
            />
            <PlacementDatum
              label={copy.startedAt}
              value={formatRelocationInstant(record.startedAt, lang)}
            />
            <PlacementDatum label={copy.reason} value={record.reason} />
          </dl>
        </CardContent>
      </Card>

      <OperationTimeline
        steps={relocationTimelineSteps(record, lang)}
        title={copy.monitorTitle}
        description={copy.monitorDescription}
        lang={lang}
      />
    </div>
  );
}
