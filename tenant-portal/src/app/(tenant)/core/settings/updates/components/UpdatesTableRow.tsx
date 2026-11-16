"use client";

import { Badge, Checkbox, IdentifierText, TableCell, TableRow } from "@/design-system";
import type { Dictionary } from "@/i18n/dictionaries/ar";
import { formatTemplate } from "@/lib/format/template";
import {
  MAX_PROVISIONING_UPDATE_SELECTIONS,
  classifyUpdateEligibility,
  type TenantAvailableUpdate,
} from "../provisioning-updates-contract";
import {
  formatOwnerAppLabel,
  formatRiskLabel,
  formatUpdateEligibility,
  riskTone,
} from "../updates-labels";

interface UpdatesTableRowProps {
  t: Dictionary;
  item: TenantAvailableUpdate;
  canManageEffective: boolean;
  isSelected: boolean;
  selectedCount: number;
  isSelectionLocked: boolean;
  onToggleSelection: (componentKey: string, checked: boolean) => void;
}

export function UpdatesTableRow({
  t,
  item,
  canManageEffective,
  isSelected,
  selectedCount,
  isSelectionLocked,
  onToggleSelection,
}: UpdatesTableRowProps) {
  const updatesUi = t.coreSettings.updatesUi;
  const eligibility = classifyUpdateEligibility(item);
  const selectable = eligibility === "ELIGIBLE";
  const eligibilityInfo = formatUpdateEligibility(eligibility, t);
  const atSelectionCap = !isSelected && selectedCount >= MAX_PROVISIONING_UPDATE_SELECTIONS;

  return (
    <TableRow className="h-11 font-normal" data-state={isSelected ? "selected" : undefined}>
      {canManageEffective ? (
        <TableCell>
          <Checkbox
            checked={isSelected}
            onCheckedChange={(checked) => onToggleSelection(item.componentKey, checked === true)}
            disabled={!selectable || isSelectionLocked || atSelectionCap}
            aria-label={item.componentKey}
          />
        </TableCell>
      ) : null}
      <TableCell>
        <div className="flex flex-col gap-0.5">
          <IdentifierText className="text-xs font-normal text-foreground">
            {item.componentKey}
          </IdentifierText>
          <span className="text-badge text-muted-foreground">
            {formatTemplate(updatesUi.ownerPrefix, {
              app: formatOwnerAppLabel(item.ownerApp, t),
            })}
          </span>
        </div>
      </TableCell>
      <TableCell>
        {item.current.releaseVersion ? (
          <IdentifierText className="text-xs font-normal text-foreground-secondary">
            {item.current.releaseVersion}
          </IdentifierText>
        ) : (
          <span className="text-xs text-muted-foreground">{t.detail.notRecorded}</span>
        )}
      </TableCell>
      <TableCell>
        <IdentifierText className="text-xs font-normal text-primary">
          {item.availableRelease.releaseVersion}
        </IdentifierText>
      </TableCell>
      <TableCell>
        <Badge tone={riskTone(item.availableRelease.riskLevel)} size="sm">
          {formatRiskLabel(item.availableRelease.riskLevel, t)}
        </Badge>
      </TableCell>
      <TableCell>
        {!item.availableRelease.requiresBackup && !item.availableRelease.requiresMaintenance ? (
          <span className="text-xs text-muted-foreground">{updatesUi.requirementsNone}</span>
        ) : (
          <div className="flex flex-wrap gap-1">
            {item.availableRelease.requiresBackup ? (
              <Badge tone="caution" size="sm">
                {updatesUi.filterBackupRequired}
              </Badge>
            ) : null}
            {item.availableRelease.requiresMaintenance ? (
              <Badge tone="caution" size="sm">
                {updatesUi.filterMaintenanceRequired}
              </Badge>
            ) : null}
          </div>
        )}
      </TableCell>
      <TableCell>
        {isSelected ? (
          <Badge tone="brand" size="sm">
            {updatesUi.statusSelected}
          </Badge>
        ) : (
          <div className="flex flex-col items-start gap-0.5">
            <Badge tone={eligibilityInfo.tone} size="sm">
              {eligibilityInfo.label}
            </Badge>
            {eligibilityInfo.reason ? (
              <span className="text-badge text-muted-foreground">{eligibilityInfo.reason}</span>
            ) : null}
          </div>
        )}
      </TableCell>
    </TableRow>
  );
}
