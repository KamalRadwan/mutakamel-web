"use client";

import { AlertTriangle, Archive, CheckCircle2, Trash2 } from "lucide-react";
import { Button, Card, CardContent, CardHeader, CardTitle } from "@/design-system";
import { StorageMigrationMonitorPanel } from "./StorageMigrationMonitorPanel";
import type { TenantStorageMigrationController } from "../hooks/useTenantStorageMigrationWizard";

export function StorageMigrationFinishPanel({
  controller,
}: {
  controller: TenantStorageMigrationController;
}) {
  const { copy, migration } = controller;
  if (!migration) return null;
  const completed = migration.status === "COMPLETED";
  const awaitingRelease = controller.awaitingSourceRelease;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex-row items-center justify-between gap-3">
          <CardTitle className="text-sm">{copy.finishTitle}</CardTitle>
          {awaitingRelease ? null : (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={controller.startAnotherMigration}
            >
              {copy.startAnother}
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {awaitingRelease ? (
            <div className="flex items-start gap-2 rounded-md border border-info/30 bg-info-subtle p-3 text-sm text-info-subtle-foreground">
              <Archive className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <div className="min-w-0">
                <p className="font-medium">{copy.awaitingReleaseTitle}</p>
                <p className="mt-1 text-xs leading-5">{copy.awaitingReleaseBody}</p>
              </div>
            </div>
          ) : (
            <p
              className={
                completed
                  ? "flex items-start gap-2 rounded-md border border-success/30 bg-success-subtle p-3 text-sm text-success-subtle-foreground"
                  : "flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive-subtle p-3 text-sm text-destructive-subtle-foreground"
              }
            >
              {completed ? (
                <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              ) : (
                <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              )}
              <span>{completed ? copy.outcomeCompleted : copy.outcomeRolledBack}</span>
            </p>
          )}
        </CardContent>
      </Card>

      {migration.retainSource && migration.status !== "ROLLED_BACK" ? (
        <ReleaseSourceCard controller={controller} />
      ) : null}

      <StorageMigrationMonitorPanel controller={controller} />
    </div>
  );
}

/**
 * Deleting the old copy, kept visibly apart from the migration itself.
 *
 * It is the one step with no rollback behind it, so it is a separate command
 * with its own typed confirmation. Unlike the database relocation there is no
 * elapsed-time gate: Core deliberately does not time-box this one, and the
 * operator decides when the destination has earned their trust.
 */
function ReleaseSourceCard({
  controller,
}: {
  controller: TenantStorageMigrationController;
}) {
  const { copy } = controller;

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
          <div className="flex justify-end">
            <Button
              type="button"
              variant="destructive"
              disabled={!controller.canReleaseSource}
              loading={controller.isReleasing}
              onClick={controller.openReleaseConfirm}
            >
              <Trash2 className="size-4" aria-hidden="true" />
              {copy.releaseButton}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
