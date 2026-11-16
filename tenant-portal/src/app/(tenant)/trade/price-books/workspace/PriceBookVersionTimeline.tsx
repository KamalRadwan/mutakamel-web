"use client";

import { useVersionTimelineSelection } from "./hooks/useVersionTimelineSelection";
import { CalendarClock, GitCommitHorizontal, Plus } from "lucide-react";
import {
  Badge,
  Button,
  ConfirmActionModal,
  EmptyState,
  IdentifierText,
  cn,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { usePricingClock } from "./usePricingClock";
import { formatDateTime } from "@/lib/format/date";
import { formatNumber } from "@/lib/format/number";
import { tradeStatusLabel } from "../../trade-advanced-validation";
import type { PriceBookTimelineVersion } from "../pricing-contract";
import {
  deriveVersionTemporalState,
  type TemporalVersionInput,
} from "../version-temporal";

interface PriceBookVersionTimelineProps {
  versions: readonly (PriceBookTimelineVersion | TemporalVersionInput)[];
  selectedVersionId: string | null;
  isDirty: boolean;
  isBusy?: boolean;
  canManage: boolean;
  isOffline: boolean;
  onSelectVersion: (versionId: string) => void;
  onCreateDraft: () => void;
}

function statusBadgeTone(
  status: string,
  isEffectiveNow: boolean,
): "positive" | "brand" | "caution" | "neutral" {
  if (isEffectiveNow) return "positive";
  if (status === "SCHEDULED") return "brand";
  if (status === "TESTED") return "caution";
  return "neutral";
}

export function PriceBookVersionTimeline({
  versions,
  selectedVersionId,
  isDirty,
  isBusy = false,
  canManage,
  isOffline,
  onSelectVersion,
  onCreateDraft,
}: PriceBookVersionTimelineProps) {
  const { t, lang } = useI18n();
  const now = usePricingClock(versions.flatMap(version => [version.effectiveFrom, version.effectiveTo, version.supersededAt]));
  const selection = useVersionTimelineSelection(selectedVersionId, isDirty, onSelectVersion);

  const selectedVersion = versions.find((v) => v.id === selectedVersionId) ?? null;

  const formatTemporalLabel = (v: TemporalVersionInput): string => {
    const state = deriveVersionTemporalState(v, now);
    switch (state.kind) {
      case "EFFECTIVE_NOW":
        return t.tradePricing.temporalEffectiveNow;
      case "WILL_BE_REPLACED":
        return t.tradePricing.temporalWillBeReplaced.replace(
          "{date}",
          formatDateTime(state.willBeReplacedAt ?? v.effectiveFrom, lang),
        );
      case "UPCOMING":
        return t.tradePricing.temporalUpcoming.replace(
          "{date}",
          formatDateTime(v.effectiveFrom, lang),
        );
      case "PLANNED_START":
        return t.tradePricing.temporalPlannedStart.replace(
          "{date}",
          formatDateTime(v.effectiveFrom, lang),
        );
      case "AUTHORING":
        return t.tradePricing.temporalAuthoring;
      case "REPLACED":
        return t.tradePricing.temporalReplaced.replace(
          "{date}",
          formatDateTime(state.cutoffAt ?? v.effectiveFrom, lang),
        );
      case "ENDED":
        return t.tradePricing.temporalEnded.replace(
          "{date}",
          formatDateTime(state.cutoffAt ?? v.effectiveFrom, lang),
        );
      case "RETIRED":
        return t.tradePricing.temporalRetired;
    }
  };

  if (versions.length === 0) {
    return (
      <div className="rounded-card border border-border bg-card p-4">
        <EmptyState
          icon={GitCommitHorizontal}
          title={t.tradePricing.emptyBookVersionsTitle}
          description={t.tradePricing.emptyBookVersionsDesc}
          action={canManage && !isOffline ? { label: t.tradePricing.createFirstDraft, onClick: onCreateDraft } : undefined}
        />
      </div>
    );
  }

  return (
    <section
      aria-label={t.tradePricing.versionTimelineTitle}
      className="flex flex-col gap-2.5 rounded-card border border-border bg-card px-4 py-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <CalendarClock className="size-4 text-muted-foreground" aria-hidden="true" />
          <h2 className="text-xs font-semibold text-foreground">
            {t.tradePricing.versionTimelineTitle}
          </h2>
          {selectedVersion ? (
            <Badge tone="brand">
              {t.tradePricing.viewingVersionBadge.replace(
                "{version}",
                String(selectedVersion.versionNumber),
              )}
            </Badge>
          ) : null}
        </div>
        {canManage ? (
          <Button size="xs" variant="outline" disabled={isOffline || isBusy} onClick={onCreateDraft}>
            <Plus className="me-1 size-3" aria-hidden="true" />
            {t.tradePricing.createNewDraft}
          </Button>
        ) : null}
      </div>

      <div className="flex items-stretch gap-2 overflow-x-auto pb-1">
        {[...versions].sort((a, b) => a.versionNumber - b.versionNumber).map((ver) => {
          const isSelected = ver.id === selectedVersionId;
          const temporal = deriveVersionTemporalState(ver, now);
          const hasCounts = "entryCount" in ver;
          return (
            <Button
              key={ver.id}
              ref={isSelected ? selection.selectedButton : undefined}
              type="button"
              variant="outline"
              aria-pressed={isSelected}
              onClick={() => selection.requestSelect(ver.id)}
              className={cn(
                "h-auto min-w-52 flex-1 shrink-0 flex-col items-start justify-between gap-1.5 rounded-lg p-3 text-start font-normal",
                isSelected
                  ? "border-primary bg-selected ring-1 ring-primary/30"
                  : "border-border bg-surface-subtle hover:bg-accent/50",
              )}
            >
              <div className="flex w-full items-center justify-between gap-2">
                <IdentifierText className="text-xs font-semibold text-foreground">
                  v{ver.versionNumber}
                </IdentifierText>
                <Badge tone={statusBadgeTone(ver.status, temporal.isEffectiveNow)}>
                  {tradeStatusLabel(t.tradeStatus, ver.status, t.common.unknownCode)}
                </Badge>
              </div>
              <span
                className={cn(
                  "line-clamp-1 text-caption",
                  temporal.isEffectiveNow
                    ? "font-medium text-success-subtle-foreground"
                    : "text-muted-foreground",
                )}
              >
                {formatTemporalLabel(ver)}
              </span>
              {hasCounts ? (
                <div className="flex items-center gap-2 text-caption text-muted-foreground">
                  <span>
                    {t.tradePricing.boardItemsCount.replace(
                      "{count}",
                      formatNumber(ver.entryCount, lang),
                    )}
                  </span>
                  <span>·</span>
                  <span>
                    {t.tradePricing.boardPromosCount.replace(
                      "{count}",
                      formatNumber(ver.promotionCount, lang),
                    )}
                  </span>
                </div>
              ) : null}
            </Button>
          );
        })}
      </div>

      <ConfirmActionModal
        open={selection.pendingTargetId !== null}
        onOpenChange={selection.onConfirmationOpenChange}
        title={t.tradePricing.switchDirtyVersionTitle}
        description={t.tradePricing.switchDirtyVersionDesc}
        confirmLabel={t.tradePricing.discardDraftChanges}
        cancelLabel={t.common.cancel}
        onConfirm={selection.confirmSelection}
      />
    </section>
  );
}
