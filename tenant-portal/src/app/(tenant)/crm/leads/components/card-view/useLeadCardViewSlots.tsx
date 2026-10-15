"use client";

import type { ReactNode } from "react";
import { cardColorBorder, type CardColor } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { localizedName } from "@/lib/format/localized";
import { formatTemplate } from "@/lib/format/template";
import type { LeadCardPatch } from "../../lead-card-contract";
import type {
  LeadDocumentCounts,
  LeadDocumentCountVisibility,
} from "../../lead-document-counts-contract";
import { useLeadCardViewClock } from "../../hooks/useLeadCardViewClock";
import type { LeadItem, LeadStage } from "../../hooks/useLeads";
import { LeadCardMenu, type LeadCardMenuProps } from "../lead-card/LeadCardMenu";
import { LeadCardViewBody } from "./LeadCardViewBody";
import { LeadCardViewFooter } from "./LeadCardViewFooter";

// A converted lead is finished: the backend rejects moving it, and it is never
// a destination either — docs/api/crm-leads.md.
const TERMINAL_STAGE_FLAG = "CONVERTED";

export interface LeadCardViewSlotsOptions {
  stages: readonly LeadStage[];
  canUpdate: (lead: LeadItem) => boolean;
  canDelete: (lead: LeadItem) => boolean;
  onOpen: (lead: LeadItem) => void;
  onDelete: (lead: LeadItem) => void;
  onMoveStage: (lead: LeadItem, stageId: string) => void;
  onCardChange: (leadId: string, patch: LeadCardPatch, lead: LeadItem) => void;
  onOpenActivities: (lead: LeadItem) => void;
  documentCountsByParty: ReadonlyMap<string, LeadDocumentCounts>;
  documentCountVisibility: LeadDocumentCountVisibility;
}

export interface LeadCardViewSlots {
  renderCard: (lead: LeadItem) => ReactNode;
  renderActions: (lead: LeadItem) => ReactNode;
  renderFooter: (lead: LeadItem) => ReactNode;
  cardClassName: (lead: LeadItem) => string | undefined;
}

/** The card grid's slots: one clock and one stage lookup for every card. */
export function useLeadCardViewSlots({
  stages,
  canUpdate,
  canDelete,
  onOpen,
  onDelete,
  onMoveStage,
  onCardChange,
  onOpenActivities,
  documentCountsByParty,
  documentCountVisibility,
}: LeadCardViewSlotsOptions): LeadCardViewSlots {
  const { t, lang } = useI18n();
  const card = t.crmLeads.card;
  const now = useLeadCardViewClock();
  const stageById = new Map(stages.map((stage) => [stage.id, stage]));
  const openStages = stages.filter((stage) => stage.flag !== TERMINAL_STAGE_FLAG);

  function moveTargets(lead: LeadItem) {
    const isMovable = canUpdate(lead) && stageById.get(lead.stageId)?.flag !== TERMINAL_STAGE_FLAG;
    if (!isMovable) return [];
    return openStages
      .filter((stage) => stage.id !== lead.stageId)
      .map((stage) => ({ id: stage.id, label: localizedName(stage, lang) }));
  }

  // An omitted handler is how the menu leaves an action out.
  function permittedMenuActions(lead: LeadItem): Pick<LeadCardMenuProps, "onDelete" | "onColorChange"> {
    const actions: Pick<LeadCardMenuProps, "onDelete" | "onColorChange"> = {};
    if (canDelete(lead)) actions.onDelete = () => onDelete(lead);
    if (canUpdate(lead)) {
      actions.onColorChange = (next: CardColor | null) => onCardChange(lead.id, { cardColor: next }, lead);
    }
    return actions;
  }

  return {
    renderCard: (lead) => (
      <LeadCardViewBody lead={lead} stage={stageById.get(lead.stageId)} now={now} />
    ),

    renderActions: (lead) => (
      <div className="flex items-center gap-0.5">
        <LeadCardMenu
          cardColor={lead.cardColor}
          onOpen={() => onOpen(lead)}
          {...permittedMenuActions(lead)}
          moveTargets={moveTargets(lead)}
          onMove={(stageId) => onMoveStage(lead, stageId)}
          labels={{
            trigger: formatTemplate(card.more, { name: lead.leadName }),
            open: card.open,
            delete: t.common.delete,
            moveTo: t.views.moveTo,
            cardColor: card.cardColor,
            colorNone: card.colorNone,
            colorNames: card.colors,
            selected: card.colorSelected,
          }}
        />
      </div>
    ),

    renderFooter: (lead) => (
      <LeadCardViewFooter
        lead={lead}
        counts={documentCountsByParty.get(lead.partyId)}
        countVisibility={documentCountVisibility}
        canRate={canUpdate(lead)}
        onRatingChange={(rating) => onCardChange(lead.id, { rating }, lead)}
        onOpenActivities={() => onOpenActivities(lead)}
      />
    ),

    // Border colour only, never a size: cards in one grid row stay level.
    cardClassName: (lead) => cardColorBorder(lead.cardColor) || undefined,
  };
}
