"use client";

import type { ReactNode } from "react";
import { cardColorBorder, type CardColor } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { localizedName } from "@/lib/format/localized";
import { formatTemplate } from "@/lib/format/template";
import type { OpportunityStage } from "../hooks/pipeline-types";
import type { OpportunityCardItem } from "../hooks/useOpportunityCards";
import type { OpportunityCardPatch } from "../opportunity-card-contract";
import { OpportunityCardTile } from "./OpportunityCardTile";
import { OpportunityCardMenu } from "./opportunity-card/OpportunityCardMenu";
import { OpportunityRichCardFooter } from "./opportunity-card/OpportunityRichCardFooter";
import type {
  OpportunityDocumentCounts,
  OpportunityDocumentCountVisibility,
} from "../opportunity-document-counts-contract";

export function useOpportunityCardViewSlots({
  stageById,
  canUpdate,
  canDelete,
  onOpen,
  onDelete,
  onCardChange,
  onOpenActivities,
  documentCountsByParty,
  documentCountVisibility,
}: {
  stageById: Map<string, OpportunityStage>;
  canUpdate: (item: OpportunityCardItem) => boolean;
  canDelete: (item: OpportunityCardItem) => boolean;
  onOpen: (item: OpportunityCardItem) => void;
  onDelete: (item: OpportunityCardItem) => void;
  onCardChange: (item: OpportunityCardItem, patch: OpportunityCardPatch) => void;
  onOpenActivities: (item: OpportunityCardItem) => void;
  documentCountsByParty: ReadonlyMap<string, OpportunityDocumentCounts>;
  documentCountVisibility: OpportunityDocumentCountVisibility;
}): {
  renderCard: (item: OpportunityCardItem) => ReactNode;
  renderActions: (item: OpportunityCardItem) => ReactNode;
  renderFooter: (item: OpportunityCardItem) => ReactNode;
  cardClassName: (item: OpportunityCardItem) => string | undefined;
} {
  const { t, lang } = useI18n();
  const card = t.crmLeads.card;

  return {
    renderCard: (item) => (
      <OpportunityCardTile
        item={item}
        stageName={localizedName(stageById.get(item.stageId), lang) || undefined}
      />
    ),
    renderActions: (item) => (
      <OpportunityCardMenu
        cardColor={item.cardColor}
        onOpen={() => onOpen(item)}
        onDelete={canDelete(item) ? () => onDelete(item) : undefined}
        onColorChange={
          canUpdate(item)
            ? (next: CardColor | null) => onCardChange(item, { cardColor: next })
            : undefined
        }
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
    ),
    renderFooter: (item) => {
      const counts = item.customerPartyId
        ? documentCountsByParty.get(item.customerPartyId)
        : undefined;
      return (
        <OpportunityRichCardFooter
          importance={item.importance}
          ownerDisplayName={item.ownerDisplayName}
          ownerAvatarUrl={item.ownerAvatarUrl}
          openActivityCount={item.openActivityCount}
          activityState={item.activityState}
          counts={counts}
          countVisibility={documentCountVisibility}
          canUpdate={canUpdate(item)}
          onImportanceChange={(next) => onCardChange(item, { importance: next })}
          onOpenActivities={() => onOpenActivities(item)}
          labels={{
            activity: t.crmOpportunities.openActivities(item.openActivityCount),
            ownerUnavailable: t.crmOpportunities.notProvided,
            group: t.crmOpportunities.importance,
            setStars: t.crmOpportunities.setImportance,
            clear: t.crmOpportunities.clearImportance,
            quotations: formatTemplate(card.quotations, { count: counts?.quotations ?? "—" }),
            salesOrders: formatTemplate(card.salesOrders, { count: counts?.salesOrders ?? "—" }),
            invoices: formatTemplate(card.invoices, { count: counts?.invoices ?? "—" }),
          }}
        />
      );
    },
    cardClassName: (item) => cardColorBorder(item.cardColor) || undefined,
  };
}
