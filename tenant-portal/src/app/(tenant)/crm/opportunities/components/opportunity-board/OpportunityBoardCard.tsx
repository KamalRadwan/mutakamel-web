"use client";

import { Building2, UserRound } from "lucide-react";
import { Button, TagChip, cardColorBorder, cardColorFill, cn } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatNumber } from "@/lib/format/number";
import { CrmCardExpandButton } from "../../../shared/components/board/CrmCardIconButton";
import { CrmCardStartBar } from "../../../shared/components/board/CrmCardStartBar";
import { crmBoardCardClass } from "../../../shared/components/board/board-classes";
import { CrmPhoneActionsRow } from "../../../shared/components/CrmPhoneActionsRow";
import { OpportunityCardMenu } from "../opportunity-card/OpportunityCardMenu";
import { OpportunityBoardCardFooter } from "./OpportunityBoardCardFooter";
import { OpportunityBoardExpandedDrawer } from "./OpportunityBoardExpandedDrawer";
import { OpportunityBoardValueStrip } from "./OpportunityBoardValueStrip";
import { useOpportunityBoardCard } from "./hooks/useOpportunityBoardCard";
import { opportunityBoardActivityState } from "./opportunity-board-presentation";
import type { OpportunityBoardCardProps } from "./opportunity-board-types";

export function OpportunityBoardCard(props: OpportunityBoardCardProps) {
  const { t, lang } = useI18n();
  const card = useOpportunityBoardCard(props);
  const { item } = props;
  const terminal = props.stage.flag === "WON" || props.stage.flag === "LOST";
  const ProfileIcon = card.corporate ? Building2 : UserRound;

  return (
    <article draggable={props.canDrag} onDragStart={card.startDrag} onDragEnd={props.onDragEnd}
      className={cn(crmBoardCardClass, item.cardColor && cardColorBorder(item.cardColor),
        props.isDragging && "opacity-50 ring-2 ring-primary")}>
      <CrmCardStartBar state={opportunityBoardActivityState(card.effective)} neutral={terminal}
        colorClass={!terminal && item.cardColor ? cardColorFill(item.cardColor) : undefined} />
      <div className="flex items-center justify-between gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={props.onOpen}
          className="h-auto min-w-0 flex-1 justify-start gap-2.5 p-0 text-start hover:bg-transparent">
          <span className={cn("flex size-[31px] shrink-0 items-center justify-center rounded-lg",
            card.corporate ? "bg-entity-company-surface text-entity-company-fg" : "bg-entity-person-surface text-entity-person-fg")}>
            <ProfileIcon className="size-4" aria-hidden="true" />
          </span>
          <span className="truncate text-card-title font-semibold text-foreground">{card.customerName}</span>
        </Button>
        <div className="flex shrink-0 items-center gap-1">
          <CrmCardExpandButton expanded={props.isExpanded} onClick={props.onToggleExpand}
            label={props.isExpanded ? t.crmOpportunities.collapseCard : t.crmOpportunities.expandCard} />
          <div className="[&>button]:size-[26px] [&>button]:rounded-md [&>button]:border [&>button]:border-line-card [&>button]:bg-surface-subtle [&>button]:p-0 [&>button]:text-muted-foreground">
            <OpportunityCardMenu cardColor={item.cardColor} onOpen={props.onOpen}
              onDelete={props.canDelete ? props.onDelete : undefined}
              onColorChange={props.canUpdate ? (cardColor) => props.onCardChange({ cardColor }) : undefined}
              moveTargets={props.canUpdate && props.moveTargets.length > 0 ? props.moveTargets : undefined}
              onMove={props.canUpdate ? props.onMove : undefined}
              labels={{ trigger: t.crmLeads.card.more, open: t.crmLeads.card.open, moveTo: t.views.moveTo,
                delete: t.common.delete, cardColor: t.crmLeads.card.cardColor, colorNone: t.crmLeads.card.colorNone,
                colorNames: t.crmLeads.card.colors, selected: t.crmLeads.card.colorSelected }} />
          </div>
        </div>
      </div>
      <div className="flex items-start justify-between gap-2">
        <Button type="button" variant="ghost" size="xs" onClick={props.onOpen}
          className="h-auto min-w-0 flex-1 justify-start p-0 text-start text-card-title font-medium leading-snug hover:bg-transparent">
          <span className="line-clamp-2">{item.title}</span>
        </Button>
      </div>
      <OpportunityBoardValueStrip item={card.effective} />
      {card.primaryPhone && (
        <div className="min-w-0 text-caption">
          <CrmPhoneActionsRow phone={card.primaryPhone} country={card.effective.customerCountry} compact />
        </div>
      )}
      {card.effective.tags.length > 0 && (
        <div className="flex flex-wrap items-center gap-1">
          {card.effective.tags.slice(0, 3).map((tag) => <TagChip key={tag.id} size="compact" label={tag.name}
            backgroundColor={tag.backgroundColor} textColor={tag.textColor} />)}
          {card.effective.tags.length > 3 && <span className="text-caption text-muted-foreground">+{formatNumber(card.effective.tags.length - 3, lang)}</span>}
        </div>
      )}
      {props.isExpanded && <OpportunityBoardExpandedDrawer props={props} card={card} />}
      <OpportunityBoardCardFooter props={props} effective={card.effective} canOpenActivities={card.canOpenActivities} />
    </article>
  );
}
