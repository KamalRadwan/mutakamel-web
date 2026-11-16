"use client";

import { RotateCcw, Search } from "lucide-react";
import {
  Button,
  Card,
  CardContent,
  Field,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/design-system";
import type { Dictionary } from "@/i18n/dictionaries/ar";
import type {
  ComponentReleaseRisk,
  ProvisioningUpdatesFilters,
} from "../provisioning-updates-contract";
import { formatRiskLabel } from "../updates-labels";

const ALL_SENTINEL = "ALL";

interface UpdatesFilterCardProps {
  t: Dictionary;
  filters: ProvisioningUpdatesFilters;
  hasActiveFilters: boolean;
  isComponentFilterValid: boolean;
  onUpdateFilters: (patch: Partial<ProvisioningUpdatesFilters>) => void;
  onClearFilters: () => void;
}

export function UpdatesFilterCard({
  t,
  filters,
  hasActiveFilters,
  isComponentFilterValid,
  onUpdateFilters,
  onClearFilters,
}: UpdatesFilterCardProps) {
  const updatesUi = t.coreSettings.updatesUi;

  return (
    <Card>
      <CardContent className="flex flex-col gap-2.5 p-3">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field
            label={updatesUi.colComponent}
            error={!isComponentFilterValid ? updatesUi.filterComponentInvalid : undefined}
          >
            <div className="relative">
              <Search
                className="pointer-events-none absolute start-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                size="sm"
                value={filters.componentKey}
                onChange={(event) => onUpdateFilters({ componentKey: event.target.value })}
                placeholder={updatesUi.filterComponentPlaceholder}
                className="ps-8"
              />
            </div>
          </Field>

          <Field label={updatesUi.colRisk}>
            <Select
              value={filters.riskLevel || ALL_SENTINEL}
              onValueChange={(value) =>
                onUpdateFilters({
                  riskLevel: value === ALL_SENTINEL ? "" : (value as ComponentReleaseRisk),
                })
              }
            >
              <SelectTrigger size="sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_SENTINEL}>{updatesUi.filterRiskAll}</SelectItem>
                <SelectItem value="LOW">{formatRiskLabel("LOW", t)}</SelectItem>
                <SelectItem value="MEDIUM">{formatRiskLabel("MEDIUM", t)}</SelectItem>
                <SelectItem value="HIGH">{formatRiskLabel("HIGH", t)}</SelectItem>
              </SelectContent>
            </Select>
          </Field>

          <Field label={updatesUi.filterBackupLabel}>
            <Select
              value={filters.requiresBackup || ALL_SENTINEL}
              onValueChange={(value) =>
                onUpdateFilters({
                  requiresBackup: value === ALL_SENTINEL ? "" : (value as "true" | "false"),
                })
              }
            >
              <SelectTrigger size="sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_SENTINEL}>{updatesUi.filterBackupAny}</SelectItem>
                <SelectItem value="true">{updatesUi.filterBackupRequired}</SelectItem>
                <SelectItem value="false">{updatesUi.filterBackupNotRequired}</SelectItem>
              </SelectContent>
            </Select>
          </Field>

          <Field label={updatesUi.filterMaintenanceLabel}>
            <Select
              value={filters.requiresMaintenance || ALL_SENTINEL}
              onValueChange={(value) =>
                onUpdateFilters({
                  requiresMaintenance: value === ALL_SENTINEL ? "" : (value as "true" | "false"),
                })
              }
            >
              <SelectTrigger size="sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_SENTINEL}>{updatesUi.filterMaintenanceAny}</SelectItem>
                <SelectItem value="true">{updatesUi.filterMaintenanceRequired}</SelectItem>
                <SelectItem value="false">{updatesUi.filterMaintenanceNotRequired}</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </div>

        {hasActiveFilters ? (
          <div className="flex items-center justify-end">
            <Button variant="ghost" size="xs" onClick={onClearFilters}>
              <RotateCcw className="size-3" aria-hidden="true" />
              {t.coreSettings.clearFilters}
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
