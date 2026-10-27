"use client";

import { CheckCircle2, Star, Trash2 } from "lucide-react";
import {
  Badge,
  Button,
  IdentifierText,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  type ColumnDef,
} from "@/design-system";
import { useAccessMode } from "@/hooks/useAccessMode";
import { useI18n } from "@/i18n/I18nContext";
import { alternateName, localizedName } from "@/lib/format/localized";
import { formatNumber } from "@/lib/format/number";
import type { Pipeline } from "../pipeline-contract";

interface PipelineColumnOptions {
  canManage: boolean;
  pendingId: string | null;
  onSetDefault: (pipeline: Pipeline) => void;
  onDelete: (pipeline: Pipeline) => void;
}

export function usePipelineColumns({
  canManage,
  pendingId,
  onSetDefault,
  onDelete,
}: PipelineColumnOptions): ColumnDef<Pipeline>[] {
  const { t, lang } = useI18n();
  const { canMutate } = useAccessMode();

  const columns: ColumnDef<Pipeline>[] = [
    {
      id: "name",
      header: t.crmPipelines.name,
      cell: (pipeline) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-foreground">
            {localizedName(pipeline, lang)}
          </p>
          <p className="truncate text-2xs text-muted-foreground">
            {alternateName(pipeline, lang)}
          </p>
        </div>
      ),
    },
    {
      id: "code",
      header: t.crmPipelines.codeLabel,
      cell: (pipeline) => (
        <IdentifierText className="text-xs text-muted-foreground">
          {pipeline.code}
        </IdentifierText>
      ),
    },
    {
      id: "stages",
      header: t.crmPipelines.stages,
      numeric: true,
      cell: (pipeline) => formatNumber(pipeline.stages.length, lang),
    },
    {
      id: "accessMode",
      header: t.crmPipelines.accessMode,
      // ALL / RESTRICTED is a category, not an outcome, so it takes neutral
      // and never a hue — docs/design/tokens.md#non-outcome-values.
      cell: (pipeline) => (
        <Badge tone="neutral">
          {t.crmPipelines.accessModeValues[pipeline.accessMode]}
        </Badge>
      ),
    },
    {
      id: "status",
      header: t.common.status,
      cell: (pipeline) => (
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge tone={pipeline.isActive ? "positive" : "neutral"}>
            {pipeline.isActive ? t.common.active : t.common.inactive}
          </Badge>
          {pipeline.isDefault ? (
            <Badge tone="brand">
              <Star className="size-3" aria-hidden="true" />
              {t.crmPipelines.isDefault}
            </Badge>
          ) : null}
        </div>
      ),
    },
  ];

  if (!canManage || !canMutate) return columns;

  return [
    ...columns,
    {
      id: "actions",
      header: t.common.actions,
      align: "end",
      sticky: "end",
      cell: (pipeline) => (
        <div className="flex items-center justify-end gap-1">
          {pipeline.isDefault ? null : (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex rounded-sm focus-visible:outline-2 focus-visible:outline-ring" tabIndex={pendingId !== null || !pipeline.isActive || pipeline.accessMode !== "ALL" ? 0 : undefined} aria-label={`${t.crmPipelines.makeDefault}: ${localizedName(pipeline, lang)}`}>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={pendingId !== null || !pipeline.isActive || pipeline.accessMode !== "ALL"}
                  className="disabled:pointer-events-none"
                  aria-label={`${t.crmPipelines.makeDefault}: ${localizedName(pipeline, lang)}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    if (pipeline.isActive && pipeline.accessMode === "ALL") onSetDefault(pipeline);
                  }}
                >
                  <CheckCircle2 className="size-4" aria-hidden="true" />
                </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>{!pipeline.isActive ? t.crmConfigActionHints.inactivePipeline
                : pipeline.accessMode !== "ALL" ? t.crmConfigActionHints.restrictedPipeline
                : pendingId !== null ? t.crmConfigActionHints.pending : t.crmPipelines.makeDefault}</TooltipContent>
            </Tooltip>
          )}
          {!pipeline.isDefault && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex rounded-sm focus-visible:outline-2 focus-visible:outline-ring" tabIndex={pendingId !== null ? 0 : undefined} aria-label={`${t.common.delete}: ${localizedName(pipeline, lang)}`}>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={pendingId !== null}
                  className="disabled:pointer-events-none"
                  aria-label={`${t.common.delete}: ${localizedName(pipeline, lang)}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    onDelete(pipeline);
                  }}
                >
                  <Trash2 className="size-4 text-destructive" aria-hidden="true" />
                </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>{pendingId !== null ? t.crmConfigActionHints.pending : t.common.delete}</TooltipContent>
            </Tooltip>
          )}
        </div>
      ),
    },
  ];
}
