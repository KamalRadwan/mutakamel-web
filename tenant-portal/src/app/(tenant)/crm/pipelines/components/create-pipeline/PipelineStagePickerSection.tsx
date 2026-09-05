"use client";

import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import {
  Badge,
  Button,
  FormSection,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { localizedName } from "@/lib/format/localized";
import { formatTemplate } from "@/lib/format/template";
import {
  PIPELINE_STAGE_IDS_MAX,
  validatePipelineStageSelection,
  type OpportunityStageDefinition,
} from "../../pipeline-contract";

/** Sentinel for the "add a stage" picker's own placeholder row. */
const ADD_PLACEHOLDER = "__add__";

export interface PipelineStagePickerSectionProps {
  /** The full catalogue, unfiltered — inactive entries are dropped here. */
  catalogue: OpportunityStageDefinition[];
  selectedIds: string[];
  disabled: boolean;
  isLoading: boolean;
  onChange: (stageIds: string[]) => void;
}

/**
 * The pipeline's stage order, chosen at create time.
 *
 * Leaving it empty is a real answer, not an unfinished one: the service seeds
 * the canonical six stages when `stageIds` is absent, which is what every
 * pipeline created before this section got. The list only has to be valid once
 * the user has started building one.
 *
 * The three rules mirrored here are the service's own, and each is a separate
 * 422 that would otherwise be discovered by a rejected submit: exactly one
 * `NEW`, one `WON` and one `LOST` stage (`PIPELINE_STAGES_REQUIRED`), and the
 * `NEW` one first (`PIPELINE_STAGE_REORDER_INVALID`).
 *
 * Reordering is up/down buttons rather than drag: a drag handle is unusable
 * from a keyboard without a parallel control anyway, and the order here is
 * short and semantic rather than spatial.
 */
export function PipelineStagePickerSection({
  catalogue,
  selectedIds,
  disabled,
  isLoading,
  onChange,
}: PipelineStagePickerSectionProps) {
  const { t, lang } = useI18n();
  // The catalogue route returns inactive definitions too, and selecting one is
  // `422 PIPELINE_STAGE_SELECTION_INVALID`.
  const available = catalogue.filter((stage) => stage.isActive);
  const byId = new Map(available.map((stage) => [stage.id, stage]));
  const selected = selectedIds
    .map((id) => byId.get(id))
    .filter((stage): stage is OpportunityStageDefinition => stage !== undefined);
  const problem = validatePipelineStageSelection(selected);
  const unselected = available.filter((stage) => !selectedIds.includes(stage.id));

  const move = (index: number, delta: number) => {
    const next = [...selectedIds];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  return (
    <FormSection
      id="stages"
      title={t.crmPipelines.create.sections.stages}
      columns={1}
    >
      {selected.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t.crmPipelines.create.stagesDefaultNote}</p>
      ) : (
        <ol className="flex flex-col gap-2">
          {selected.map((stage, index) => (
            <li
              key={stage.id}
              className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-card p-2"
            >
              <span className="w-6 shrink-0 text-center text-xs tabular-nums text-muted-foreground">
                {index + 1}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                {localizedName(stage, lang)}
              </span>
              <Badge tone="neutral">
                {t.statusValues[`OpportunityStageFlag.${stage.flag}`] ?? stage.flag}
              </Badge>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={disabled || index === 0}
                  aria-label={formatTemplate(t.crmPipelines.create.moveStageEarlier, {
                    name: localizedName(stage, lang),
                  })}
                  onClick={() => move(index, -1)}
                >
                  <ArrowUp className="size-3.5" aria-hidden="true" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={disabled || index === selected.length - 1}
                  aria-label={formatTemplate(t.crmPipelines.create.moveStageLater, {
                    name: localizedName(stage, lang),
                  })}
                  onClick={() => move(index, 1)}
                >
                  <ArrowDown className="size-3.5" aria-hidden="true" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={disabled}
                  aria-label={formatTemplate(t.crmPipelines.create.removeStage, {
                    name: localizedName(stage, lang),
                  })}
                  onClick={() => onChange(selectedIds.filter((id) => id !== stage.id))}
                >
                  <Trash2 className="size-3.5 text-destructive" aria-hidden="true" />
                </Button>
              </div>
            </li>
          ))}
        </ol>
      )}

      {problem && (
        <p role="status" className="text-xs text-destructive">
          {t.crmPipelines.create.stageProblems[problem]}
        </p>
      )}

      {selected.length < PIPELINE_STAGE_IDS_MAX && unselected.length > 0 && (
        <div className="flex items-center gap-2">
          <Plus className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
          <Select
            value={ADD_PLACEHOLDER}
            disabled={disabled || isLoading}
            onValueChange={(value) => {
              if (value === ADD_PLACEHOLDER) return;
              onChange([...selectedIds, value]);
            }}
          >
            <SelectTrigger aria-label={t.crmPipelines.create.addStage} className="max-w-xs">
              <SelectValue placeholder={t.crmPipelines.create.addStage} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ADD_PLACEHOLDER}>{t.crmPipelines.create.addStage}</SelectItem>
              {unselected.map((stage) => (
                <SelectItem key={stage.id} value={stage.id}>
                  {localizedName(stage, lang)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selected.length > 0 && (
            <Button type="button" variant="ghost" size="sm" disabled={disabled} onClick={() => onChange([])}>
              {t.crmPipelines.create.useDefaultStages}
            </Button>
          )}
        </div>
      )}
    </FormSection>
  );
}
