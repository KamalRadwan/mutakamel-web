"use client";

import type { RefObject } from "react";
import { HardDrive, ShieldAlert } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  Field,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
} from "@/design-system";
import { PlacementBlockersNotice } from "../../components/PlacementBlockersNotice";
import { PlacementDatum } from "../../components/PlacementDatum";
import {
  formatStorageBytes,
  formatStorageInstant,
  remainingStorageBytes,
} from "../model/migration-timeline";
import { missingStorageMigrationExecutePermissions } from "../model/permissions";
import type { TenantStorageMigrationController } from "../hooks/useTenantStorageMigrationWizard";

export function StorageMigrationSelectPanel({
  controller,
  regionRef,
}: {
  controller: TenantStorageMigrationController;
  /** Owned by the screen and handed to the refresh guard, so a poll never
   *  interrupts the operator mid-edit. */
  regionRef: RefObject<HTMLDivElement | null>;
}) {
  const { copy, lang, preflight } = controller;
  if (!preflight) return null;
  const missing = missingStorageMigrationExecutePermissions(controller.permissions);
  const writesDisabled =
    controller.hasBlockers || !controller.permissions.canExecute;

  return (
    <div ref={regionRef} className="space-y-4">
      <Card>
        <CardHeader className="flex-row items-center justify-between gap-3">
          <CardTitle className="text-sm">{copy.currentPlacement}</CardTitle>
          <Badge tone="neutral" className="font-mono">
            {preflight.tenant.status}
          </Badge>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-3 text-xs sm:grid-cols-2">
            <PlacementDatum
              label={copy.currentServer}
              value={preflight.current.storageServerName ?? copy.unnamedServer}
            />
            <PlacementDatum
              label={copy.placementRevision}
              value={preflight.current.storagePlacementRevision}
              mono
            />
            <PlacementDatum label={copy.tenantStatus} value={preflight.tenant.status} mono />
          </dl>
        </CardContent>
      </Card>

      <PlacementBlockersNotice
        blockers={controller.blockers}
        title={copy.blockersTitle}
        description={copy.blockersDescription}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">{copy.destination}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!controller.hasTargets ? (
            <EmptyState
              icon={HardDrive}
              title={copy.noTargetsTitle}
              description={copy.noTargetsDescription}
            />
          ) : (
            <>
              <Field
                id="storage-migration-destination"
                label={copy.destination}
                hint={copy.destinationHint}
                error={controller.fieldErrors.target}
                required
              >
                {(fieldProps) => (
                  <Select
                    value={controller.targetStorageServerId || undefined}
                    onValueChange={controller.setTargetStorageServerId}
                    disabled={writesDisabled}
                  >
                    <SelectTrigger
                      id={fieldProps.id}
                      aria-describedby={fieldProps["aria-describedby"]}
                      aria-invalid={fieldProps["aria-invalid"]}
                      aria-label={copy.destination}
                    >
                      <SelectValue placeholder={copy.destinationPlaceholder} />
                    </SelectTrigger>
                    <SelectContent>
                      {preflight.targets.map((target) => (
                        <SelectItem key={target.id} value={target.id}>
                          {`${target.name} · ${target.code} · ${target.region}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </Field>

              {controller.selectedTarget ? (
                <div className="rounded-md border border-border bg-muted/40 p-3">
                  <h3 className="text-xs font-semibold text-foreground">
                    {copy.targetSummary}
                  </h3>
                  <dl className="mt-2 grid gap-3 text-xs sm:grid-cols-2">
                    <PlacementDatum
                      label={copy.region}
                      value={controller.selectedTarget.region}
                    />
                    <PlacementDatum
                      label={copy.assignedTenants}
                      value={
                        controller.selectedTarget.maxTenants === null
                          ? `${controller.selectedTarget.assignedTenants} · ${copy.unlimitedTenants}`
                          : `${controller.selectedTarget.assignedTenants}/${controller.selectedTarget.maxTenants}`
                      }
                    />
                    <PlacementDatum
                      label={copy.byteCeiling}
                      value={
                        controller.selectedTarget.maxBytes === null
                          ? copy.noCeiling
                          : formatStorageBytes(controller.selectedTarget.maxBytes, lang)
                      }
                    />
                    <PlacementDatum
                      label={copy.reservedBytes}
                      value={formatStorageBytes(
                        controller.selectedTarget.reservedBytes,
                        lang,
                      )}
                    />
                    <PlacementDatum
                      label={copy.committedBytes}
                      value={formatStorageBytes(
                        controller.selectedTarget.committedBytes,
                        lang,
                      )}
                    />
                    <PlacementDatum
                      label={copy.remainingBytes}
                      value={
                        remainingStorageBytes(controller.selectedTarget) === null
                          ? copy.noCeiling
                          : formatStorageBytes(
                              remainingStorageBytes(controller.selectedTarget),
                              lang,
                            )
                      }
                    />
                    <PlacementDatum
                      label={copy.lastConnectionTest}
                      value={`${controller.selectedTarget.lastConnectionTestStatus} · ${formatStorageInstant(
                        controller.selectedTarget.lastConnectionTestedAt,
                        lang,
                      )}`}
                    />
                  </dl>
                </div>
              ) : null}
            </>
          )}
        </CardContent>
      </Card>

      <BackupEvidenceCard controller={controller} />

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">{copy.retentionTitle}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field
            id="storage-migration-max-bytes"
            label={copy.maxBytes}
            hint={copy.maxBytesHint}
            error={controller.fieldErrors.maxBytes}
            required
          >
            {(fieldProps) => (
              <Input
                {...fieldProps}
                name="maxBytes"
                inputMode="numeric"
                dir="ltr"
                value={controller.maxBytes}
                disabled={writesDisabled}
                onChange={(event) => controller.setMaxBytes(event.target.value)}
                placeholder="1000000000"
                className="max-w-64 font-mono"
              />
            )}
          </Field>

          <div className="rounded-md border border-border bg-muted/40 p-3">
            <div className="flex items-start gap-3">
              <Switch
                id="storage-migration-retain-source"
                checked={controller.retainSource}
                disabled={writesDisabled}
                onCheckedChange={(checked) =>
                  controller.setRetainSource(checked === true)
                }
              />
              <div className="min-w-0">
                <label
                  htmlFor="storage-migration-retain-source"
                  className="cursor-pointer text-sm font-medium text-foreground"
                >
                  {copy.retentionLabel}
                </label>
                <p
                  id="storage-migration-retain-source-hint"
                  className="mt-1 text-xs leading-5 text-muted-foreground"
                >
                  {controller.retainSource
                    ? copy.retentionOnHint
                    : copy.retentionOffHint}
                </p>
              </div>
            </div>
          </div>

          {missing.length > 0 ? (
            <p
              role="status"
              className="flex flex-wrap items-center gap-1.5 rounded-md border border-border bg-muted p-3 text-xs text-muted-foreground"
            >
              <ShieldAlert className="size-4 shrink-0" aria-hidden="true" />
              <span>{copy.missingPermissions}</span>
              {missing.map((permission) => (
                <bdi key={permission} dir="ltr" className="font-mono">
                  {permission}
                </bdi>
              ))}
            </p>
          ) : null}

          <div className="flex justify-end">
            <Button
              type="button"
              variant="primary"
              disabled={!controller.canSubmit}
              loading={controller.isStarting}
              onClick={controller.openConfirm}
            >
              {controller.isStarting ? copy.submitting : copy.submit}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Core refuses a migration that is not bound to current Worker backup and
 * restore evidence, so the operator picks both here. It is an independent
 * resource under `admin.backups.read`: a `403` renders as forbidden, not as an
 * empty select.
 */
function BackupEvidenceCard({
  controller,
}: {
  controller: TenantStorageMigrationController;
}) {
  const { copy, lang } = controller;
  const writesDisabled =
    controller.hasBlockers || !controller.permissions.canExecute;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">{copy.evidenceTitle}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs leading-5 text-muted-foreground">
          {copy.evidenceDescription}
        </p>

        {controller.evidenceState === "loading" ? (
          <p role="status" className="text-xs text-muted-foreground">
            {copy.evidenceLoading}
          </p>
        ) : null}

        {controller.evidenceState === "forbidden" ? (
          <p
            role="alert"
            className="rounded-md border border-border bg-muted p-3 text-xs text-muted-foreground"
          >
            {copy.evidenceForbidden}
          </p>
        ) : null}

        {controller.evidenceState === "error" ? (
          <div
            role="alert"
            className="flex flex-wrap items-center gap-2 rounded-md border border-destructive/30 bg-destructive-subtle p-3 text-xs text-destructive-subtle-foreground"
          >
            <span>{copy.evidenceUnavailable}</span>
            <Button
              type="button"
              variant="outline"
              size="xs"
              onClick={() => void controller.reloadBackupEvidence()}
            >
              {copy.refresh}
            </Button>
          </div>
        ) : null}

        {controller.evidenceState === "ready" ? (
          <>
            <Field
              id="storage-migration-artifact"
              label={copy.backupArtifact}
              hint={controller.artifacts.length === 0 ? copy.noArtifacts : undefined}
              error={controller.fieldErrors.backupArtifactId}
              required
            >
              {(fieldProps) => (
                <Select
                  value={controller.backupArtifactId || undefined}
                  onValueChange={controller.setBackupArtifactId}
                  disabled={writesDisabled || controller.artifacts.length === 0}
                >
                  <SelectTrigger
                    id={fieldProps.id}
                    aria-describedby={fieldProps["aria-describedby"]}
                    aria-invalid={fieldProps["aria-invalid"]}
                    aria-label={copy.backupArtifact}
                  >
                    <SelectValue placeholder={copy.backupArtifactPlaceholder} />
                  </SelectTrigger>
                  <SelectContent>
                    {controller.artifacts.map((artifact) => (
                      <SelectItem key={artifact.id} value={artifact.id}>
                        {`${artifact.databaseName} · ${artifact.status} · ${copy.started} ${formatStorageInstant(artifact.startedAt, lang)}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </Field>

            <Field
              id="storage-migration-restore"
              label={copy.restoreRun}
              hint={controller.restores.length === 0 ? copy.noRestores : undefined}
              error={controller.fieldErrors.restoreRunId}
              required
            >
              {(fieldProps) => (
                <Select
                  value={controller.restoreRunId || undefined}
                  onValueChange={controller.setRestoreRunId}
                  disabled={writesDisabled || controller.restores.length === 0}
                >
                  <SelectTrigger
                    id={fieldProps.id}
                    aria-describedby={fieldProps["aria-describedby"]}
                    aria-invalid={fieldProps["aria-invalid"]}
                    aria-label={copy.restoreRun}
                  >
                    <SelectValue placeholder={copy.restoreRunPlaceholder} />
                  </SelectTrigger>
                  <SelectContent>
                    {controller.restores.map((restore) => (
                      <SelectItem key={restore.id} value={restore.id}>
                        {`${restore.targetDatabaseName} · ${restore.status} · ${
                          restore.hasVerification ? copy.verified : copy.notVerified
                        } · ${copy.finished} ${formatStorageInstant(restore.finishedAt, lang)}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </Field>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
