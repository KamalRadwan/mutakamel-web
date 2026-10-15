"use client";

import { Eye, Trash2 } from "lucide-react";
import { Button, cn, iconSize, type ColumnDef } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { localizedValue } from "@/lib/format/localized";
import { AcquisitionSourceIcon } from "../../../shared/components/AcquisitionSourceIcon";
import type { LeadInlinePhone } from "../../hooks/useLeadInlinePhone";
import type { LeadItem, LeadStage } from "../../hooks/useLeads";
import { LeadCountryLabel } from "./LeadCountryLabel";
import { LeadFollowUp } from "./LeadFollowUp";
import { LeadContactCell, LeadNameCell } from "./LeadIdentityCells";
import { LeadPhoneCell } from "./LeadPhoneCell";
import { LeadStageCell } from "./LeadStageCell";

// A converted lead is finished: the backend rejects moving it, and it is never
// a destination either — docs/api/crm-leads.md.
const TERMINAL_STAGE_FLAG = "CONVERTED";

export interface LeadTableColumnOptions {
  stages: readonly LeadStage[];
  canUpdate: (lead: LeadItem) => boolean;
  canDelete: (lead: LeadItem) => boolean;
  onOpenQuickModal?: (lead: LeadItem) => void;
  onDelete: (lead: LeadItem) => void;
  onMoveStage: (lead: LeadItem, stageId: string) => void;
  onRatingChange: (lead: LeadItem, rating: number) => void;
  onOpenActivities: (lead: LeadItem) => void;
  phoneEditor: LeadInlinePhone;
}

export function useLeadTableColumns({
  stages,
  canUpdate,
  canDelete,
  onOpenQuickModal,
  onDelete,
  onMoveStage,
  onRatingChange,
  onOpenActivities,
  phoneEditor,
}: LeadTableColumnOptions): ColumnDef<LeadItem>[] {
  const { t, lang } = useI18n();
  const isAr = lang === "ar";
  const stageById = new Map(stages.map((stage) => [stage.id, stage]));
  const moveTargets = stages.filter((stage) => stage.flag !== TERMINAL_STAGE_FLAG);
  const unavailable = <span className="text-muted-foreground">{t.crmLeads.unavailable}</span>;

  return [
    {
      id: "name",
      sortable: true,
      sortField: "displayName",
      header: t.crmLeads.name,
      width: "15rem",
      cell: (lead) => <LeadNameCell lead={lead} />,
    },
    {
      id: "contact",
      header: t.crmLeads.contact,
      width: "15rem",
      cell: (lead) => <LeadContactCell lead={lead} />,
    },
    {
      id: "phone",
      header: t.crmLeads.phone,
      width: "15rem",
      cell: (lead) => <LeadPhoneCell lead={lead} canEdit={canUpdate(lead)} editor={phoneEditor} />,
    },
    {
      id: "country",
      header: t.crmLeads.create.country,
      width: "9rem",
      cell: (lead) => (lead.country.trim() && <LeadCountryLabel country={lead.country} />) || unavailable,
    },
    {
      id: "stage",
      header: t.crmLeads.stage,
      width: "10rem",
      cell: (lead) => {
        const stage = stageById.get(lead.stageId);
        return (
          <LeadStageCell
            lead={lead}
            stage={stage}
            targets={moveTargets}
            canMove={canUpdate(lead) && stage?.flag !== TERMINAL_STAGE_FLAG}
            onMove={(stageId) => onMoveStage(lead, stageId)}
          />
        );
      },
    },
    {
      id: "source",
      header: t.crmLeads.source,
      width: "10rem",
      cell: (lead) => (
        <span className="flex min-w-28 items-center gap-1.5 whitespace-nowrap">
          <AcquisitionSourceIcon source={{ iconUrl: lead.sourceIconUrl }} />
          <span className="max-w-32 truncate">
            {localizedValue(lead.sourceNameAr, lead.sourceNameEn, lang) || t.crmLeads.unavailable}
          </span>
        </span>
      ),
    },
    {
      id: "salesperson",
      header: t.crmLeads.salesperson,
      width: "10rem",
      cell: (lead) => (
        <span className="block max-w-36 truncate">
          {[lead.owner?.firstName, lead.owner?.lastName].filter(Boolean).join(" ") || t.crmLeads.unavailable}
        </span>
      ),
    },
    {
      id: "followUp",
      header: t.crmLeads.followUp,
      width: "13rem",
      cell: (lead) => (
        <LeadFollowUp
          lead={lead}
          canRate={canUpdate(lead)}
          onRatingChange={(rating) => onRatingChange(lead, rating)}
          onOpenActivities={() => onOpenActivities(lead)}
        />
      ),
    },
    {
      id: "actions",
      header: t.common.actions,
      align: "end",
      sticky: "end",
      width: "5rem",
      cell: (lead) => {
        const peekLabel = isAr
          ? `معاينة سريعة 360°: ${lead.leadName}`
          : `Quick 360° Peek: ${lead.leadName}`;
        return (
          <div className="inline-flex items-center justify-end gap-0.5">
            {onOpenQuickModal && (
              <Button
                variant="ghost"
                size="xs"
                className="w-7 px-0"
                onClick={() => onOpenQuickModal(lead)}
                title={peekLabel}
                aria-label={peekLabel}
              >
                <Eye className={iconSize({ size: "sm" })} aria-hidden="true" />
              </Button>
            )}
            {canDelete(lead) && (
              <Button
                variant="ghost"
                size="xs"
                className="w-7 px-0"
                onClick={() => onDelete(lead)}
                aria-label={`${t.common.delete}: ${lead.leadName}`}
              >
                <Trash2 className={cn(iconSize({ size: "sm" }), "text-destructive")} aria-hidden="true" />
              </Button>
            )}
          </div>
        );
      },
    },
  ];
}
