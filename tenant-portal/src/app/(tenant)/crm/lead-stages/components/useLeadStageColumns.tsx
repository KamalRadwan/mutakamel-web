"use client";

import { Check, LockKeyhole, Pencil, Trash2 } from "lucide-react";
import { Badge, StatusBadge, type ColumnDef } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { localizedName } from "@/lib/format/localized";
import { formatNumber } from "@/lib/format/number";
import { canBeDefaultLeadStage, isProtectedLeadStage, type LeadStageItem } from "../lead-stage-contract";
import { LeadStageAction } from "./LeadStageAction";

interface LeadStageColumnsOptions {
  canManage: boolean;
  writesBlocked: boolean;
  needsReload: boolean;
  settingDefaultId: string | null;
  onEdit: (stage: LeadStageItem) => void;
  onDelete: (stage: LeadStageItem) => void;
  onDefault: (stage: LeadStageItem) => Promise<void>;
}

export function useLeadStageColumns(options: LeadStageColumnsOptions): ColumnDef<LeadStageItem>[] {
  const { t, lang } = useI18n();
  const blockedReason = options.needsReload ? t.crmLeadStages.reloadRequired : t.crmConfigActionHints.pending;
  return [
    {
      id: "order", header: t.crmLeadStages.order,
      cell: (stage) => <span className="inline-flex items-center gap-1.5 tabular-nums text-muted-foreground">
        {isProtectedLeadStage(stage) && <LockKeyhole className="size-3.5" aria-hidden="true" />}
        {formatNumber(stage.sortOrder, lang)}
      </span>,
    },
    {
      id: "nameAr", header: t.crmLeadStages.arabicName,
      cell: (stage) => <bdi dir="rtl" className="block min-w-32 whitespace-normal break-words text-start font-normal text-foreground">{stage.nameAr}</bdi>,
    },
    {
      id: "nameEn", header: t.crmLeadStages.englishName,
      cell: (stage) => <bdi dir="ltr" className="block min-w-32 whitespace-normal break-words text-start font-normal text-foreground">{stage.nameEn}</bdi>,
    },
    { id: "meaning", header: t.crmLeadStages.flag, cell: (stage) => <StatusBadge value={stage.flag} kind="LeadStageFlag" /> },
    { id: "category", header: t.crmLeadStages.category, cell: (stage) => <StatusBadge value={stage.category} kind="StageCategory" /> },
    {
      id: "availability", header: t.crmLeadStages.availability,
      cell: (stage) => isProtectedLeadStage(stage)
        ? <Badge tone="neutral"><LockKeyhole className="size-3" aria-hidden="true" />{t.crmLeadStages.system}</Badge>
        : <Badge tone={stage.isActive ? "positive" : "caution"}>{stage.isActive ? t.common.active : t.common.inactive}</Badge>,
    },
    {
      id: "default", header: t.crmLeadStages.default,
      cell: (stage) => stage.isDefault ? <Badge tone="brand">{t.crmLeadStages.default}</Badge>
        : options.canManage ? <LeadStageAction
          label={`${t.crmLeadStages.setDefault}: ${localizedName(stage, lang)}`}
          disabled={!canBeDefaultLeadStage(stage) || options.writesBlocked}
          reason={stage.flag === "DISQUALIFIED" || stage.flag === "CONVERTED" ? t.crmLeadStages.terminalDefaultHint
            : !stage.isActive ? t.crmConfigActionHints.inactiveStage : options.writesBlocked ? blockedReason : undefined}
          loading={options.settingDefaultId === stage.id}
          onClick={() => void options.onDefault(stage)} text>
          <Check className="size-3.5" aria-hidden="true" />{t.crmLeadStages.setDefault}
        </LeadStageAction> : <span className="text-muted-foreground">—</span>,
    },
    ...(options.canManage ? [{
      id: "actions", header: t.common.actions, sticky: "end" as const,
      cell: (stage: LeadStageItem) => <div className="flex items-center gap-1.5">
        <LeadStageAction label={`${t.crmLeadStages.editTitle}: ${localizedName(stage, lang)}`}
          disabled={isProtectedLeadStage(stage) || options.writesBlocked}
          reason={isProtectedLeadStage(stage) ? t.crmLeadStages.protectedHint : options.writesBlocked ? blockedReason : undefined}
          onClick={() => options.onEdit(stage)}>
          <Pencil className="size-3.5" aria-hidden="true" />
        </LeadStageAction>
        <LeadStageAction label={`${t.common.delete}: ${localizedName(stage, lang)}`}
          disabled={isProtectedLeadStage(stage) || stage.isDefault || options.writesBlocked}
          reason={isProtectedLeadStage(stage) ? t.crmLeadStages.protectedHint : stage.isDefault ? t.crmConfigActionHints.defaultStageDelete
            : options.writesBlocked ? blockedReason : undefined}
          onClick={() => options.onDelete(stage)}>
          <Trash2 className="size-3.5 text-destructive" aria-hidden="true" />
        </LeadStageAction>
      </div>,
    }] : []),
  ];
}
