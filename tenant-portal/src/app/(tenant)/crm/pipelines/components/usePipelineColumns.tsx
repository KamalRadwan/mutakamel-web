"use client";

import { CheckCircle2, Star, Trash2 } from "lucide-react";
import {
  Badge,
  Button,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  type ColumnDef,
} from "@/design-system";
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
        <span className="font-mono text-xs text-muted-foreground">
          {pipeline.code}
        </span>
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

  if (!canManage) return columns;

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
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={pendingId !== null || !pipeline.isActive}
                  aria-label={`${t.crmPipelines.makeDefault}: ${localizedName(pipeline, lang)}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    onSetDefault(pipeline);
                  }}
                >
                  <CheckCircle2 className="size-4" aria-hidden="true" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t.crmPipelines.makeDefault}</TooltipContent>
            </Tooltip>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                disabled={pendingId !== null}
                aria-label={`${t.common.delete}: ${localizedName(pipeline, lang)}`}
                onClick={(event) => {
                  event.stopPropagation();
                  onDelete(pipeline);
                }}
              >
                <Trash2 className="size-4 text-destructive" aria-hidden="true" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t.common.delete}</TooltipContent>
          </Tooltip>
        </div>
      ),
    },
  ];
}
