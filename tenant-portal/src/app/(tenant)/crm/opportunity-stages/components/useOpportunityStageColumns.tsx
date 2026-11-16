"use client";

import { Eye, Lock, Pencil, Trash2 } from "lucide-react";
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
import { localizedName } from "@/lib/format/localized";
import type { OpportunityStageDefinition } from "../../pipelines/pipeline-contract";

interface OpportunityStageColumnOptions {
  canManage: boolean;
  pendingId: string | null;
  onEdit: (stage: OpportunityStageDefinition) => void;
  onView: (stage: OpportunityStageDefinition) => void;
  onDelete: (stage: OpportunityStageDefinition) => void;
}

export function useOpportunityStageColumns({
  canManage,
  pendingId,
  onEdit,
  onView,
  onDelete,
}: OpportunityStageColumnOptions): ColumnDef<OpportunityStageDefinition>[] {
  const { t, lang } = useI18n();

  const columns: ColumnDef<OpportunityStageDefinition>[] = [
    {
      id: "nameAr",
      header: t.crmLeadStages.arabicName,
      cell: (stage) => (
        <bdi dir="rtl" className="block min-w-32 whitespace-normal break-words text-start font-normal text-foreground">{stage.nameAr}</bdi>
      ),
    },
    {
      id: "nameEn",
      header: t.crmLeadStages.englishName,
      cell: (stage) => (
        <bdi dir="ltr" className="block min-w-32 whitespace-normal break-words text-start font-normal text-foreground">{stage.nameEn}</bdi>
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

  return [
    ...columns,
    {
      id: "actions",
      header: t.common.actions,
      align: "end",
      sticky: "end",
      cell: (stage) => (
        <div className="flex items-center justify-end gap-1">
          <Tooltip><TooltipTrigger asChild><Button variant="outline" size="sm" className="size-8 p-0" disabled={pendingId !== null} aria-label={`${t.crmOpportunityStages.viewDetails}: ${localizedName(stage, lang)}`} onClick={(event) => { event.stopPropagation(); onView(stage); }}><Eye className="size-4" aria-hidden="true" /></Button></TooltipTrigger><TooltipContent>{t.crmOpportunityStages.summaryTitle}</TooltipContent></Tooltip>
          {canManage && <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="size-8 p-0"
                disabled={pendingId !== null}
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
          </Tooltip>}
          {/* A system stage cannot be deleted at all, so the control is
              absent rather than disabled — a dead tab stop that can never be
              enabled is an information leak, not an affordance. */}
          {canManage && !stage.isSystem ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="size-8 p-0"
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
          ) : null}
        </div>
      ),
    },
  ];
}
