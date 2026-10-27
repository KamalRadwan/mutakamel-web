"use client";

import { Building2, ChevronUp, UserRound } from "lucide-react";
import { Button, TagChip, type CardColor } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatTemplate } from "@/lib/format/template";
import type { AcquisitionSource } from "../../../acquisition-sources/acquisition-source-contract";
import { AcquisitionSourceIcon } from "../../../shared/components/AcquisitionSourceIcon";
import { leadActivityState, type LeadCardPatch } from "../../lead-card-contract";
import type { LeadItem, LeadStage } from "../../lead-list-contract";
import { LeadCardMenu, type LeadCardMoveTarget } from "../lead-card/LeadCardMenu";
import { LeadBoardCardFooter } from "./LeadBoardCardFooter";
import { LeadBoardExpandedContacts } from "./LeadBoardExpandedContacts";
import { useLeadBoardExpandedCard } from "./useLeadBoardExpandedCard";
interface LeadBoardExpandedCardProps {
  lead: LeadItem;
  stage: LeadStage;
  sources: ReadonlyArray<AcquisitionSource>;
  canUpdate: boolean;
  canDelete: boolean;
  moveTargets: readonly LeadCardMoveTarget[];
  showActivityEntry: boolean;
  onCollapse: () => void;
  onOpenLead: () => void;
  onOpenQuickModal: () => void;
  onOpenActivities: () => void;
  onDelete: () => void;
  onMoveStage: (stageId: string) => void;
  onCardChange: (patch: LeadCardPatch) => void;
}

export function LeadBoardExpandedCard({
  lead,
  stage,
  sources,
  canUpdate,
  canDelete,
  moveTargets,
  showActivityEntry,
  onCollapse,
  onOpenLead,
  onOpenQuickModal,
  onOpenActivities,
  onDelete,
  onMoveStage,
  onCardChange,
}: LeadBoardExpandedCardProps) {
  const { t } = useI18n();
  const cardDict = t.crmLeads.card;
  const details = useLeadBoardExpandedCard(lead, sources);
  const { isCompany, title, sourceLabel, resolvedSourceIconUrl, ownerFullName } = details;
  return (
    <div
      className="flex flex-col gap-2.5 rounded-card border border-line-card bg-card p-3 shadow-card"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between gap-1.5">
        <Button
          type="button"
          variant="ghost"
          size="xs"
          onClick={onOpenLead}
          className="flex h-auto min-w-0 flex-1 items-center justify-start gap-1.5 px-0 py-0 text-start hover:bg-transparent hover:text-primary"
        >
          {isCompany ? (
            <Building2 className="size-3.5 shrink-0 text-primary" aria-hidden="true" />
          ) : (
            <UserRound className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
          )}
          <span className="truncate text-sm font-semibold text-foreground hover:text-primary">
            {title}
          </span>
        </Button>

        <div className="flex shrink-0 items-center gap-1">
          <Button
            type="button"
            variant="outline"
            size="xs"
            onClick={onCollapse}
            title={t.crmLeads.executive.collapseCard}
            aria-label={t.crmLeads.executive.collapseCard}
            className="flex size-6 items-center justify-center rounded-md border border-primary/30 bg-primary/10 text-primary transition-colors hover:bg-primary/20"
          >
            <ChevronUp className="size-3.5" aria-hidden="true" />
          </Button>

          <LeadCardMenu
            cardColor={lead.cardColor}
            onOpen={onOpenLead}
            onDelete={canDelete ? onDelete : undefined}
            onColorChange={
              canUpdate ? (next: CardColor | null) => onCardChange({ cardColor: next }) : undefined
            }
            moveTargets={canUpdate && stage.flag !== "CONVERTED" ? moveTargets : undefined}
            onMove={canUpdate && stage.flag !== "CONVERTED" ? onMoveStage : undefined}
            labels={{
              trigger: formatTemplate(cardDict.more, { name: lead.leadName }),
              open: cardDict.open,
              delete: t.common.delete,
              moveTo: t.views.moveTo,
              cardColor: cardDict.cardColor,
              colorNone: cardDict.colorNone,
              colorNames: cardDict.colors,
              selected: cardDict.colorSelected,
            }}
          />
        </div>
      </div>

      <LeadBoardExpandedContacts lead={lead} details={details} />

      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">
            {t.crmLeads.executive.salesperson}
          </span>
          <div className="flex h-7 items-center rounded-md border border-line-card bg-surface-subtle px-2 text-xs font-medium text-foreground">
            <span className="truncate">
              {ownerFullName || t.crmLeads.executive.unassigned}
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">
            {t.crmLeads.executive.acquisitionSource}
          </span>
          <div className="flex h-7 items-center gap-1.5 rounded-md border border-line-card bg-surface-subtle px-2 text-xs font-medium text-foreground">
            {sourceLabel ? (
              <>
                <AcquisitionSourceIcon source={{ iconUrl: resolvedSourceIconUrl }} />
                <span className="truncate">{sourceLabel}</span>
              </>
            ) : (
              <span className="truncate text-muted-foreground">{t.crmLeads.executive.notSet}</span>
            )}
          </div>
        </div>
      </div>

      {lead.tags.length > 0 && (
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">
            {t.crmLeads.executive.tags}
          </span>
          <div className="flex flex-wrap items-center gap-1">
            {lead.tags.map((tag) => (
              <TagChip key={tag.id} size="sm" label={tag.name}
                backgroundColor={tag.backgroundColor} textColor={tag.textColor} />
            ))}
          </div>
        </div>
      )}

      <LeadBoardCardFooter rating={lead.rating} canUpdate={canUpdate}
        stageFlag={stage.flag}
        activityState={leadActivityState(lead.nextActivity)} showActivityEntry={showActivityEntry}
        owner={lead.owner} onRate={(rating) => onCardChange({ rating })}
        onOpenActivities={onOpenActivities} onOpenQuickModal={onOpenQuickModal} />
    </div>
  );
}
