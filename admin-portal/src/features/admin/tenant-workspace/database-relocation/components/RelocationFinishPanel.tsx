"use client";

import { AlertTriangle, CheckCircle2, Trash2 } from "lucide-react";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/design-system";
import {
  formatRelocationInstant,
  relocationRollbackExplanation,
} from "../model/relocation-timeline";
import { PlacementDatum } from "../../components/PlacementDatum";
import { RelocationMonitorPanel } from "./RelocationMonitorPanel";
import type { TenantDatabaseRelocationController } from "../hooks/useTenantDatabaseRelocation";

export function RelocationFinishPanel({
  controller,
}: {
  controller: TenantDatabaseRelocationController;
}) {
  const { copy, lang, record } = controller;
  if (!record) return null;
  const relocated = record.outcome === "RELOCATED";
  const rollback = relocationRollbackExplanation(record.rollback, lang);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex-row items-center justify-between gap-3">
          <CardTitle className="text-sm">{copy.finishTitle}</CardTitle>
          <Button type="button" variant="ghost" size="sm" onClick={controller.startAnotherMove}>
            {copy.startAnother}
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <p
            className={
              relocated
                ? "flex items-start gap-2 rounded-md border border-success/30 bg-success-subtle p-3 text-sm text-success-subtle-foreground"
                : "flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive-subtle p-3 text-sm text-destructive-subtle-foreground"
            }
          >
            {relocated ? (
              <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            ) : (
              <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            )}
            <span>{relocated ? copy.outcomeRelocated : copy.outcomeAbandoned}</span>
          </p>

          <dl className="grid gap-3 text-xs sm:grid-cols-2">
            {record.failedStep ? (
              <PlacementDatum label={copy.failedStep} value={record.failedStep} mono />
            ) : null}
            {record.retainUntil ? (
              <PlacementDatum
                label={copy.retainUntil}
                value={formatRelocationInstant(record.retainUntil, lang)}
              />
            ) : null}
            {record.sourceDestroyedAt ? (
              <PlacementDatum
                label={copy.sourceDestroyedAt}
                value={formatRelocationInstant(record.sourceDestroyedAt, lang)}
              />
            ) : null}
          </dl>

          {rollback ? (
            <div className="rounded-md border border-warning/30 bg-warning-subtle p-3 text-warning-subtle-foreground">
              <p className="text-sm font-medium">{copy.rollbackTitle}</p>
              <p className="mt-1 text-xs leading-5">{rollback}</p>
              <bdi dir="ltr" className="mt-1 block font-mono text-xs opacity-80">
                {record.rollback}
              </bdi>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {relocated ? <ReleaseSourceCard controller={controller} /> : null}

      <RelocationMonitorPanel controller={controller} />
    </div>
  );
}

/**
 * Step 10, kept visibly apart from the relocation itself.
 *
 * It is the one command with no rollback behind it, and Worker gates it on the
 * retention window *and* a typed tenant id. The button therefore explains its
 * own disabled state rather than trading a click for a 422.
 */
function ReleaseSourceCard({
  controller,
}: {
  controller: TenantDatabaseRelocationController;
}) {
  const { copy, record } = controller;
  if (!record) return null;

  return (
    <Card className="border-destructive/30">
      <CardHeader>
        <CardTitle className="text-sm">{copy.releaseTitle}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs leading-5 text-muted-foreground">{copy.releaseDescription}</p>
        {controller.sourceAlreadyReleased ? (
          <p role="status" className="text-xs text-muted-foreground">
            {copy.releaseDone}
          </p>
        ) : (
          <>
            {!controller.canReleaseSource ? (
              <p id="relocation-release-locked" className="text-xs text-muted-foreground">
                {copy.releaseLocked}
              </p>
            ) : null}
            <div className="flex justify-end">
              <Button
                type="button"
                variant="destructive"
                disabled={!controller.canReleaseSource}
                loading={controller.isReleasing}
                aria-describedby={
                  controller.canReleaseSource ? undefined : "relocation-release-locked"
                }
                onClick={controller.openReleaseConfirm}
              >
                <Trash2 className="size-4" aria-hidden="true" />
                {copy.releaseButton}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
