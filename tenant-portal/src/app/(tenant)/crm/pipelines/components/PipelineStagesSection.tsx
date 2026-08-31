"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Lock, Plus, Trash2 } from "lucide-react";
import {
  Badge,
  Button,
  DegradedBanner,
  DetailSection,
  EmptyState,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  StatusBadge,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { localizedName } from "@/lib/format/localized";
import { formatNumber } from "@/lib/format/number";
import type {
  OpportunityStageDefinition,
  PipelineStage,
} from "../pipeline-contract";

interface PipelineStagesSectionProps {
  stages: PipelineStage[];
  attachableStages: OpportunityStageDefinition[];
  catalogueUnavailable: boolean;
  canManage: boolean;
  pendingStageId: string | null;
  onAttach: (opportunityStageId: string) => void;
  onDetach: (pipelineStageId: string) => void;
  onMove: (pipelineStageId: string, direction: -1 | 1) => void;
}

/**
 * Stage membership: attach, reorder, detach.
 *
 * Reorder is **earlier / later controls, never drag-only** — the same rule the
 * column header follows (docs/design/patterns.md#column-resize-and-reorder).
 * Each press sends the complete ordered id list to
 * `PATCH /pipelines/:id/stages/reorder`; there is no per-stage rank endpoint
 * and a client-side rank write would race.
 */
export function PipelineStagesSection({
  stages,
  attachableStages,
  catalogueUnavailable,
  canManage,
  pendingStageId,
  onAttach,
  onDetach,
  onMove,
}: PipelineStagesSectionProps) {
  const { t, lang } = useI18n();
  const [selectedStageId, setSelectedStageId] = useState<string>("");

  return (
    <DetailSection
      title={t.crmPipelines.stagesTitle}
      description={t.crmPipelines.stagesDescription}
      columns={1}
    >
      <div className="flex flex-col gap-3">
        {canManage && catalogueUnavailable ? (
          <DegradedBanner message={t.crmPipelines.catalogueUnavailable} />
        ) : null}

        {stages.length === 0 ? (
          <EmptyState
            title={t.crmPipelines.noStages}
            description={t.crmPipelines.noStagesHint}
          />
        ) : (
          <ol className="flex flex-col gap-1.5">
            {stages.map((stage, index) => (
              <li
                key={stage.id}
                aria-busy={pendingStageId === stage.id || undefined}
                className="flex flex-wrap items-center gap-2 rounded-sm border border-border bg-card px-2.5 py-2"
              >
                <span className="w-6 shrink-0 text-center font-mono text-xs text-muted-foreground">
                  {formatNumber(stage.rank, lang)}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                  {localizedName(stage, lang)}
                </span>
                <StatusBadge kind="OpportunityStageFlag" value={stage.flag} />
                <Badge tone="neutral">
                  {t.statusValues[`StageCategory.${stage.category}`] ??
                    stage.category}
                </Badge>
                {stage.isSystem ? (
                  <Badge tone="neutral">
                    <Lock className="size-3" aria-hidden="true" />
                    {t.crmPipelines.systemStage}
                  </Badge>
                ) : null}
                {stage.isActive ? null : (
                  <Badge tone="neutral">{t.common.inactive}</Badge>
                )}
                {canManage ? (
                  <div className="flex items-center gap-0.5">
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={index === 0 || pendingStageId !== null}
                      aria-label={`${t.crmPipelines.moveEarlier}: ${localizedName(stage, lang)}`}
                      onClick={() => onMove(stage.id, -1)}
                    >
                      <ChevronUp className="size-4" aria-hidden="true" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={
                        index === stages.length - 1 || pendingStageId !== null
                      }
                      aria-label={`${t.crmPipelines.moveLater}: ${localizedName(stage, lang)}`}
                      onClick={() => onMove(stage.id, 1)}
                    >
                      <ChevronDown className="size-4" aria-hidden="true" />
                    </Button>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={pendingStageId !== null}
                          aria-label={`${t.crmPipelines.detachStage}: ${localizedName(stage, lang)}`}
                          onClick={() => onDetach(stage.id)}
                        >
                          <Trash2
                            className="size-4 text-destructive"
                            aria-hidden="true"
                          />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        {t.crmPipelines.detachStage}
                      </TooltipContent>
                    </Tooltip>
                  </div>
                ) : null}
              </li>
            ))}
          </ol>
        )}

        {canManage ? (
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-56 flex-1">
              <Select
                value={selectedStageId || undefined}
                onValueChange={setSelectedStageId}
                disabled={attachableStages.length === 0}
              >
                <SelectTrigger aria-label={t.crmPipelines.attachStage}>
                  <SelectValue
                    placeholder={
                      attachableStages.length === 0
                        ? t.crmPipelines.attachEmpty
                        : t.crmPipelines.attachStagePlaceholder
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {attachableStages.map((stage) => (
                    <SelectItem key={stage.id} value={stage.id}>
                      {localizedName(stage, lang)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              variant="outline"
              disabled={!selectedStageId || pendingStageId !== null}
              onClick={() => {
                if (!selectedStageId) return;
                onAttach(selectedStageId);
                setSelectedStageId("");
              }}
            >
              <Plus className="size-4" aria-hidden="true" />
              {t.crmPipelines.attachStage}
            </Button>
          </div>
        ) : null}
      </div>
    </DetailSection>
  );
}
