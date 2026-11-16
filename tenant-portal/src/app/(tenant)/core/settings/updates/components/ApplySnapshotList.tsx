"use client";

import { ArrowRight } from "lucide-react";
import { Badge, IdentifierText, cn, mirrorInRtl } from "@/design-system";
import type { Dictionary } from "@/i18n/dictionaries/ar";
import { formatTemplate } from "@/lib/format/template";
import {
  classifyUpdateEligibility,
  type TenantAvailableUpdate,
} from "../provisioning-updates-contract";
import type { ApplyModalPhase } from "../hooks/apply-updates-state";
import {
  formatOwnerAppLabel,
  formatRiskLabel,
  formatUpdateEligibility,
  riskTone,
} from "../updates-labels";

interface ApplySnapshotListProps {
  t: Dictionary;
  mode: ApplyModalPhase;
  snapshotItems: readonly TenantAvailableUpdate[];
  liveItems: readonly TenantAvailableUpdate[];
}

export function ApplySnapshotList({
  t,
  mode,
  snapshotItems,
  liveItems,
}: ApplySnapshotListProps) {
  const updatesUi = t.coreSettings.updatesUi;
  const liveByKey = new Map(liveItems.map((item) => [item.componentKey, item]));

  return (
    <div className="divide-y divide-line-divider max-h-56 overflow-y-auto rounded-md border border-border bg-surface-subtle">
      {snapshotItems.map((item) => {
        const liveItem = liveByKey.get(item.componentKey);
        const liveEligibility = liveItem ? classifyUpdateEligibility(liveItem) : null;

        return (
          <div key={item.componentKey} className="flex flex-col gap-1.5 p-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <IdentifierText className="text-xs font-medium text-foreground">
                  {item.componentKey}
                </IdentifierText>
                <span className="text-badge text-muted-foreground">
                  {formatTemplate(updatesUi.ownerPrefix, {
                    app: formatOwnerAppLabel(item.ownerApp, t),
                  })}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <Badge tone={riskTone(item.availableRelease.riskLevel)} size="sm">
                  {formatRiskLabel(item.availableRelease.riskLevel, t)}
                </Badge>
                {mode === "stale" && liveEligibility ? (
                  <Badge
                    tone={formatUpdateEligibility(liveEligibility, t).tone}
                    size="sm"
                  >
                    {formatUpdateEligibility(liveEligibility, t).label}
                  </Badge>
                ) : null}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                {item.current.releaseVersion ? (
                  <IdentifierText className="text-xs text-foreground-secondary">
                    {item.current.releaseVersion}
                  </IdentifierText>
                ) : (
                  <span>{t.detail.notRecorded}</span>
                )}
                <ArrowRight
                  className={cn("size-3 shrink-0 text-muted-foreground", mirrorInRtl)}
                  aria-hidden="true"
                />
                <IdentifierText className="text-xs font-medium text-primary">
                  {item.availableRelease.releaseVersion}
                </IdentifierText>
                {mode === "stale" &&
                liveItem &&
                liveItem.availableRelease.releaseVersion !==
                  item.availableRelease.releaseVersion ? (
                  <>
                    <span aria-hidden="true">·</span>
                    <IdentifierText className="text-xs font-semibold text-foreground">
                      {liveItem.availableRelease.releaseVersion}
                    </IdentifierText>
                  </>
                ) : null}
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                {!item.availableRelease.requiresBackup &&
                !item.availableRelease.requiresMaintenance ? (
                  <span className="text-badge text-muted-foreground">
                    {updatesUi.requirementsNone}
                  </span>
                ) : (
                  <>
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
                  </>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
