"use client";

import type { RefObject } from "react";
import { Database, ShieldAlert } from "lucide-react";
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
  Textarea,
} from "@/design-system";
import { PlacementBlockersNotice } from "../../components/PlacementBlockersNotice";
import { PlacementDatum } from "../../components/PlacementDatum";
import { missingRelocationExecutePermissions } from "../model/permissions";
import type { TenantDatabaseRelocationController } from "../hooks/useTenantDatabaseRelocation";

export function RelocationSelectPanel({
  controller,
  regionRef,
}: {
  controller: TenantDatabaseRelocationController;
  /** Owned by the screen and handed to the refresh guard, so a poll never
   *  interrupts the operator mid-edit. */
  regionRef: RefObject<HTMLDivElement | null>;
}) {
  const { copy, preflight } = controller;
  if (!preflight) return null;
  const retention = preflight.retention;
  const missing = missingRelocationExecutePermissions(controller.permissions);

  return (
    <div ref={regionRef} className="space-y-4">
      <CurrentPlacementCard controller={controller} />

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
              icon={Database}
              title={copy.noTargetsTitle}
              description={copy.noTargetsDescription}
            />
          ) : (
            <Field
              id="relocation-destination"
              label={copy.destination}
              hint={copy.destinationHint}
              error={controller.fieldErrors.target}
              required
            >
              {(fieldProps) => (
                <Select
                  value={controller.targetDatabaseServerId || undefined}
                  onValueChange={controller.setTargetDatabaseServerId}
                  disabled={controller.hasBlockers || !controller.permissions.canExecute}
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
                        {target.name}
                        {target.countryName ? ` · ${target.countryName}` : ""}
                        {` · ${target.currentTenants}/${target.maxTenants} ${copy.capacity}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </Field>
          )}

          <Field
            id="relocation-reason"
            label={copy.reason}
            hint={copy.reasonHint}
            error={controller.fieldErrors.reason}
            required
          >
            {(fieldProps) => (
              <Textarea
                {...fieldProps}
                name="reason"
                value={controller.reason}
                maxLength={500}
                rows={3}
                disabled={controller.hasBlockers || !controller.permissions.canExecute}
                onChange={(event) => controller.setReason(event.target.value)}
              />
            )}
          </Field>

          <Field
            id="relocation-retention"
            label={`${copy.retentionDays} (${retention.minDays}–${retention.maxDays} ${copy.retentionUnit})`}
            hint={copy.retentionHint}
            error={controller.fieldErrors.retentionDays}
            required
          >
            {(fieldProps) => (
              <Input
                {...fieldProps}
                name="sourceRetentionDays"
                type="number"
                inputMode="numeric"
                min={retention.minDays}
                max={retention.maxDays}
                step={1}
                value={controller.retentionDays}
                disabled={controller.hasBlockers || !controller.permissions.canExecute}
                onChange={(event) => controller.setRetentionDays(event.target.value)}
                className="max-w-40"
              />
            )}
          </Field>

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

export function CurrentPlacementCard({
  controller,
}: {
  controller: TenantDatabaseRelocationController;
}) {
  const { copy, preflight } = controller;
  if (!preflight) return null;

  return (
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
            value={preflight.current.databaseServerName ?? copy.unnamedServer}
          />
          <PlacementDatum label={copy.currentDatabase} value={preflight.current.databaseName} mono />
          <PlacementDatum
            label={copy.placementRevision}
            value={preflight.current.databasePlacementRevision}
            mono
          />
          <PlacementDatum label={copy.tenantStatus} value={preflight.tenant.status} mono />
        </dl>
      </CardContent>
    </Card>
  );
}
