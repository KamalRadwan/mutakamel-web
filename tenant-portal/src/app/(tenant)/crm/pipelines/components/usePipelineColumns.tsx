"use client";

import { CheckCircle2, Eye, Pencil, Star, Trash2 } from "lucide-react";
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
import { localizedName } from "@/lib/format/localized";
import { formatNumber } from "@/lib/format/number";
import type { Pipeline } from "../pipeline-contract";

interface PipelineColumnOptions {
  canManage: boolean;
  pendingId: string | null;
  onSetDefault: (pipeline: Pipeline) => void;
  onDelete: (pipeline: Pipeline) => void;
  onView?: (pipeline: Pipeline) => void;
  onEdit?: (pipeline: Pipeline) => void;
}

export function usePipelineColumns({
  canManage,
  pendingId,
  onSetDefault,
  onDelete,
  onView,
  onEdit,
}: PipelineColumnOptions): ColumnDef<Pipeline>[] {
  const { t, lang } = useI18n();
  const { canMutate } = useAccessMode();

  const columns: ColumnDef<Pipeline>[] = [
    {
      id: "nameAr",
      header: t.crmPipelines.nameAr,
      cell: (pipeline) => (
        <bdi dir="rtl" className="block truncate text-foreground">{pipeline.nameAr}</bdi>
      ),
    },
    {
      id: "nameEn",
      header: t.crmPipelines.nameEn,
      cell: (pipeline) => (
        <bdi dir="ltr" className="block truncate text-foreground">{pipeline.nameEn}</bdi>
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

  if (!onView && (!canManage || !canMutate)) return columns;

  return [
    ...columns,
    {
      id: "actions",
      header: t.common.actions,
      align: "end",
      sticky: "end",
      cell: (pipeline) => (
        <div className="flex items-center justify-end gap-1 font-sans">
          {onView && <Button variant="outline" size="sm" className="size-8 p-0" aria-label={`${t.crmPipelines.review.openPipeline}: ${localizedName(pipeline, lang)}`}
            onClick={(event) => { event.stopPropagation(); onView(pipeline); }}><Eye className="size-4" aria-hidden="true" /></Button>}
          {canManage && canMutate && onEdit && <Button variant="outline" size="sm" disabled={pendingId !== null}
            aria-label={`${t.crmPipelines.edit}: ${localizedName(pipeline, lang)}`}
            onClick={(event) => { event.stopPropagation(); onEdit(pipeline); }}>
            <Pencil className="size-4" aria-hidden="true" />{t.crmPipelines.edit}
          </Button>}
          {canManage && canMutate && !pipeline.isDefault && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex rounded-sm focus-visible:outline-2 focus-visible:outline-ring" tabIndex={pendingId !== null || !pipeline.isActive || pipeline.accessMode !== "ALL" ? 0 : undefined} aria-label={`${t.crmPipelines.makeDefault}: ${localizedName(pipeline, lang)}`}>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pendingId !== null || !pipeline.isActive || pipeline.accessMode !== "ALL"}
                  className="size-8 p-0 disabled:pointer-events-none"
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
          {canManage && canMutate && !pipeline.isDefault && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex rounded-sm focus-visible:outline-2 focus-visible:outline-ring" tabIndex={pendingId !== null ? 0 : undefined} aria-label={`${t.common.delete}: ${localizedName(pipeline, lang)}`}>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pendingId !== null}
                  className="size-8 p-0 disabled:pointer-events-none"
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
