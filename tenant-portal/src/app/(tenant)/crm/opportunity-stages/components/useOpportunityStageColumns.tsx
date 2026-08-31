"use client";

import { Lock, Pencil, Trash2 } from "lucide-react";
import {
  Badge,
  Button,
  StatusBadge,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  type ColumnDef,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { alternateName, localizedName } from "@/lib/format/localized";
import type { OpportunityStageDefinition } from "../../pipelines/pipeline-contract";

interface OpportunityStageColumnOptions {
  canManage: boolean;
  pendingId: string | null;
  onEdit: (stage: OpportunityStageDefinition) => void;
  onDelete: (stage: OpportunityStageDefinition) => void;
}

export function useOpportunityStageColumns({
  canManage,
  pendingId,
  onEdit,
  onDelete,
}: OpportunityStageColumnOptions): ColumnDef<OpportunityStageDefinition>[] {
  const { t, lang } = useI18n();

  const columns: ColumnDef<OpportunityStageDefinition>[] = [
    {
      id: "name",
      header: t.crmOpportunityStages.name,
      cell: (stage) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-foreground">
            {localizedName(stage, lang)}
          </p>
          <p className="truncate text-2xs text-muted-foreground">
            {alternateName(stage, lang)}
          </p>
        </div>
      ),
    },
    {
      id: "flag",
      header: t.crmOpportunityStages.flag,
      cell: (stage) => (
        <StatusBadge kind="OpportunityStageFlag" value={stage.flag} />
      ),
    },
    {
      id: "category",
      header: t.crmOpportunityStages.category,
      cell: (stage) => (
        <StatusBadge kind="StageCategory" value={stage.category} />
      ),
    },
    {
      id: "status",
      header: t.common.status,
      cell: (stage) => (
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge tone={stage.isActive ? "positive" : "neutral"}>
            {stage.isActive ? t.common.active : t.common.inactive}
          </Badge>
          {stage.isSystem ? (
            <Badge tone="neutral">
              <Lock className="size-3" aria-hidden="true" />
              {t.crmOpportunityStages.systemStage}
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
      cell: (stage) => (
        <div className="flex items-center justify-end gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                aria-label={`${t.crmOpportunityStages.edit}: ${localizedName(stage, lang)}`}
                onClick={(event) => {
                  event.stopPropagation();
                  onEdit(stage);
                }}
              >
                <Pencil className="size-4" aria-hidden="true" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t.crmOpportunityStages.edit}</TooltipContent>
          </Tooltip>
          {/* A system stage cannot be deleted at all, so the control is
              absent rather than disabled — a dead tab stop that can never be
              enabled is an information leak, not an affordance. */}
          {stage.isSystem ? null : (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={pendingId !== null}
                  aria-label={`${t.common.delete}: ${localizedName(stage, lang)}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    onDelete(stage);
                  }}
                >
                  <Trash2 className="size-4 text-destructive" aria-hidden="true" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t.common.delete}</TooltipContent>
            </Tooltip>
          )}
        </div>
      ),
    },
  ];
}
