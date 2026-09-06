"use client";

import type { ReactNode } from "react";
import { cardColorBorder, type CardColor } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatTemplate } from "@/lib/format/template";
import { leadActivityState, type LeadCardPatch } from "../lead-card-contract";
import type { LeadItem } from "../hooks/useLeads";
import { LeadCard } from "./LeadCard";
import { LeadCardFooter } from "./lead-card/LeadCardFooter";
import { LeadCardMenu, type LeadCardMoveTarget } from "./lead-card/LeadCardMenu";

export interface LeadCardSlotsOptions {
  canUpdate: (lead: LeadItem) => boolean;
  canDelete: (lead: LeadItem) => boolean;
  onOpen: (lead: LeadItem) => void;
  onDelete: (lead: LeadItem) => void;
  onCardChange: (leadId: string, patch: LeadCardPatch) => void;
  /**
   * Opens the lead's activity dialog. It lives on the PAGE, not on the card:
   * one dialog for the screen, rather than one mounted behind every card in a
   * fifty-lead column.
   */
  onOpenActivities: (lead: LeadItem) => void;
  /**
   * The stages this lead may be moved to, already filtered by the same rule
   * that gates dragging. Omitted on a view with no columns to move between —
   * the card view — where the menu simply has one item fewer.
   */
  moveTargets?: (lead: LeadItem) => readonly LeadCardMoveTarget[];
  onMove?: (lead: LeadItem, stageId: string) => void;
}

export interface LeadCardSlots {
  renderCard: (lead: LeadItem) => ReactNode;
  renderActions: (lead: LeadItem) => ReactNode;
  renderFooter: (lead: LeadItem) => ReactNode;
  cardClassName: (lead: LeadItem) => string | undefined;
}

/**
 * The four callbacks that turn a `LeadItem` into the card object.
 *
 * They live here rather than in the page for two reasons: the board and the
 * card view take the identical set, so one card design serves both and cannot
 * drift; and every string on the card is composed here, which keeps the page
 * free of the dozen dictionary reads a card with a rating, an owner, an
 * activity bucket and eleven colour names needs.
 */
export function useLeadCardSlots({
  canUpdate,
  canDelete,
  onOpen,
  onDelete,
  onCardChange,
  onOpenActivities,
  moveTargets,
  onMove,
}: LeadCardSlotsOptions): LeadCardSlots {
  const { t } = useI18n();
  const card = t.crmLeads.card;

  function ownerLabel(lead: LeadItem): string {
    const fullName = lead.owner
      ? [lead.owner.firstName, lead.owner.lastName].filter(Boolean).join(" ")
      : "";
    return formatTemplate(card.owner, { name: fullName });
  }

  return {
    renderCard: (lead) => <LeadCard lead={lead} labels={{ moreTags: card.moreTags }} />,

    renderActions: (lead) => (
      <LeadCardMenu
        cardColor={lead.cardColor}
        onOpen={() => onOpen(lead)}
        onDelete={canDelete(lead) ? () => onDelete(lead) : undefined}
        onColorChange={
          canUpdate(lead)
            ? (next: CardColor | null) => onCardChange(lead.id, { cardColor: next })
            : undefined
        }
        moveTargets={moveTargets?.(lead)}
        onMove={onMove ? (stageId: string) => onMove(lead, stageId) : undefined}
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
    ),

    renderFooter: (lead) => (
      <LeadCardFooter
        nextActivity={lead.nextActivity}
        owner={lead.owner}
        rating={lead.rating}
        onRatingChange={(rating) => onCardChange(lead.id, { rating })}
        isRatingDisabled={!canUpdate(lead)}
        onOpenActivities={() => onOpenActivities(lead)}
        labels={{
          // Names the control and states the bucket in one string, because it
          // is both: the mark's colour is the only thing separating "overdue"
          // from "due today", and a button whose name is only its state does
          // not say what pressing it does.
          activity: formatTemplate(card.activityOpen, {
            state: card.activityStates[leadActivityState(lead.nextActivity)],
          }),
          owner: ownerLabel(lead),
          group: card.rating,
          setStars: card.rateStars,
          clear: card.clearRating,
        }}
      />
    ),

    // Border colour only — never a size. A card that is taller than its
    // neighbours breaks the windowed column's row estimate, and a colour is
    // not worth a scroll position.
    cardClassName: (lead) => cardColorBorder(lead.cardColor) || undefined,
  };
}
