"use client";

import type { ReactNode } from "react";
import {
  cardColorBorder,
  type CardColor,
  type MoveToTarget,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatTemplate } from "@/lib/format/template";
import type { OpportunityCardPatch } from "../opportunity-card-contract";
import type { OpportunityCardRecord } from "../hooks/pipeline-types";
import { OpportunityCard } from "./opportunity-card/OpportunityCard";
import { OpportunityCardFooter } from "./opportunity-card/OpportunityCardFooter";
import { OpportunityCardMenu } from "./opportunity-card/OpportunityCardMenu";
import { OpportunityCardViewFooter } from "./opportunity-card/OpportunityCardViewFooter";

export interface OpportunityCardSlotsOptions {
  canUpdate: (item: OpportunityCardRecord) => boolean;
  canDelete: (item: OpportunityCardRecord) => boolean;
  onOpen: (item: OpportunityCardRecord) => void;
  onDelete: (item: OpportunityCardRecord) => void;
  onCardChange: (
    opportunityId: string,
    patch: OpportunityCardPatch,
    item: OpportunityCardRecord,
  ) => void;
  onOpenActivities: (item: OpportunityCardRecord) => void;
  moveTargets?: (item: OpportunityCardRecord) => readonly MoveToTarget[];
  onMove?: (item: OpportunityCardRecord, stageId: string) => void;
}

export interface OpportunityCardSlots {
  renderCard: (item: OpportunityCardRecord) => ReactNode;
  renderActions: (item: OpportunityCardRecord) => ReactNode;
  renderFooter: (item: OpportunityCardRecord) => ReactNode;
  renderCardViewFooter: (item: OpportunityCardRecord) => ReactNode;
  cardClassName: (item: OpportunityCardRecord) => string | undefined;
}

export function useOpportunityCardSlots({
  canUpdate,
  canDelete,
  onOpen,
  onDelete,
  onCardChange,
  onOpenActivities,
  moveTargets,
  onMove,
}: OpportunityCardSlotsOptions): OpportunityCardSlots {
  const { t } = useI18n();
  const card = t.crmLeads.card;
  const oppCopy = t.crmOpportunities;

  return {
    renderCard: (item) => <OpportunityCard item={item} />,

    renderActions: (item) => {
      const canEdit = canUpdate(item);
      return (
        <OpportunityCardMenu
          cardColor={item.cardColor}
          onOpen={() => onOpen(item)}
          onDelete={canDelete(item) ? () => onDelete(item) : undefined}
          onColorChange={
            canEdit
              ? (next: CardColor | null) =>
                  onCardChange(item.id, { cardColor: next }, item)
              : undefined
          }
          moveTargets={canEdit ? moveTargets?.(item) : undefined}
          onMove={canEdit && onMove ? (stageId: string) => onMove(item, stageId) : undefined}
          labels={{
            trigger: formatTemplate(card.more, { name: item.title }),
            open: card.open,
            delete: t.common.delete,
            moveTo: t.views.moveTo,
            cardColor: card.cardColor,
            colorNone: card.colorNone,
            colorNames: card.colors,
            selected: card.colorSelected,
          }}
        />
      );
    },

    renderFooter: (item) => (
      <OpportunityCardFooter
        importance={item.importance}
        onImportanceChange={(next) =>
          onCardChange(item.id, { importance: next }, item)
        }
        isImportanceDisabled={!canUpdate(item)}
        activityState={item.activityState}
        openActivityCount={item.openActivityCount}
        onOpenActivities={() => onOpenActivities(item)}
        ownerDisplayName={item.ownerDisplayName}
        ownerAvatarUrl={item.ownerAvatarUrl}
        labels={{
          activity: formatTemplate(card.activityOpen, {
            state:
              item.activityState === "OVERDUE"
                ? oppCopy.overdue
                : item.activityState === "TODAY"
                  ? oppCopy.dueToday
                  : item.activityState === "FUTURE"
                    ? oppCopy.upcoming
                    : card.activityStates.NONE,
          }),
          owner: item.ownerDisplayName
            ? formatTemplate(card.owner, { name: item.ownerDisplayName })
            : "",
          group: oppCopy.importance,
          setStars: oppCopy.setImportance,
          clear: oppCopy.clearImportance,
        }}
      />
    ),

    renderCardViewFooter: (item) => (
      <OpportunityCardViewFooter
        customerProfileId={item.customerProfileId}
        customerDisplayName={item.customerDisplayName}
        expectedCloseDate={item.expectedCloseDate}
        importance={item.importance}
        onImportanceChange={(next) =>
          onCardChange(item.id, { importance: next }, item)
        }
        isImportanceDisabled={!canUpdate(item)}
        activityState={item.activityState}
        openActivityCount={item.openActivityCount}
        onOpenActivities={() => onOpenActivities(item)}
        ownerDisplayName={item.ownerDisplayName}
        ownerAvatarUrl={item.ownerAvatarUrl}
        labels={{
          activity: formatTemplate(card.activityOpen, {
            state:
              item.activityState === "OVERDUE"
                ? oppCopy.overdue
                : item.activityState === "TODAY"
                  ? oppCopy.dueToday
                  : item.activityState === "FUTURE"
                    ? oppCopy.upcoming
                    : card.activityStates.NONE,
          }),
          owner: item.ownerDisplayName
            ? formatTemplate(card.owner, { name: item.ownerDisplayName })
            : "",
          group: oppCopy.importance,
          setStars: oppCopy.setImportance,
          clear: oppCopy.clearImportance,
          customer: item.customerDisplayName ?? "",
          expectedClose: oppCopy.expectedClose,
          salesperson: item.ownerDisplayName
            ? formatTemplate(card.owner, { name: item.ownerDisplayName })
            : "",
        }}
      />
    ),

    cardClassName: (item) => cardColorBorder(item.cardColor) || undefined,
  };
}
