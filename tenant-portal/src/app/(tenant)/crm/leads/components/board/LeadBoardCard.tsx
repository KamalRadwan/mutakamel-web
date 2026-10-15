"use client";

import { ChevronDown, ChevronUp } from "lucide-react";
import {
  BoardCard,
  Button,
  cardColorBorder,
  iconSize,
  type CardColor,
  type MoveToTarget,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatTemplate } from "@/lib/format/template";
import type { LeadCardPatch } from "../../lead-card-contract";
import type { LeadItem } from "../../hooks/useLeads";
import { LeadCardMenu } from "../lead-card/LeadCardMenu";
import { LeadBoardCardContent } from "./LeadBoardCardContent";
import { LeadBoardCardFooter } from "./LeadBoardCardFooter";

interface LeadBoardCardProps {
  lead: LeadItem;
  index: number;
  now: number;
  isExpanded: boolean;
  isDragDisabled: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  moveTargets: MoveToTarget[];
  onToggleExpanded: () => void;
  onOpen: () => void;
  onOpenActivities: () => void;
  onDelete: () => void;
  onMove: (stageId: string) => void;
  onCardChange: (patch: LeadCardPatch) => void;
}

/** One lead on the board, as the design-system card with the lead's slots filled in. */
export function LeadBoardCard({
  lead,
  index,
  now,
  isExpanded,
  isDragDisabled,
  canUpdate,
  canDelete,
  moveTargets,
  onToggleExpanded,
  onOpen,
  onOpenActivities,
  onDelete,
  onMove,
  onCardChange,
}: LeadBoardCardProps) {
  const { t } = useI18n();
  const card = t.crmLeads.card;
  const ExpandIcon = isExpanded ? ChevronUp : ChevronDown;
  const expandLabel = formatTemplate(
    isExpanded ? t.crmLeadBoard.collapseCard : t.crmLeadBoard.expandCard,
    { name: lead.leadName },
  );

  return (
    <BoardCard
      index={index}
      card={{
        id: lead.id,
        isDragDisabled,
        onActivate: onOpen,
        moveTargets,
        onMoveTo: onMove,
        moveToLabel: t.views.moveTo,
        className: cardColorBorder(lead.cardColor) || undefined,
        content: <LeadBoardCardContent lead={lead} now={now} isExpanded={isExpanded} />,
        actions: (
          <div className="flex items-center gap-0.5">
            <Button
              type="button"
              variant="ghost"
              size="xs"
              aria-expanded={isExpanded}
              aria-label={expandLabel}
              title={expandLabel}
              onClick={onToggleExpanded}
            >
              <ExpandIcon className={iconSize({ size: "sm" })} aria-hidden="true" />
            </Button>
            <LeadCardMenu
              cardColor={lead.cardColor}
              onOpen={onOpen}
              onDelete={canDelete ? onDelete : undefined}
              onColorChange={
                canUpdate ? (cardColor: CardColor | null) => onCardChange({ cardColor }) : undefined
              }
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
        footer: (
          <LeadBoardCardFooter
            lead={lead}
            isExpanded={isExpanded}
            canUpdate={canUpdate}
            onRatingChange={(rating) => onCardChange({ rating })}
            onOpenActivities={onOpenActivities}
          />
        ),
      }}
    />
  );
}
