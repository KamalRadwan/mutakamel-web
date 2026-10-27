"use client";

import { Building2, GripVertical, UserRound } from "lucide-react";
import {
  Badge,
  Button,
  TagChip,
  cardColorBorder,
  cardColorFill,
  cn,
  toTagColor,
  type CardColor,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { localizedValue } from "@/lib/format/localized";
import { formatTemplate } from "@/lib/format/template";
import {
  leadActivityState,
  leadCardHeading,
  type LeadActivityState,
  type LeadCardPatch,
} from "../../lead-card-contract";
import type { LeadItem, LeadStage } from "../../lead-list-contract";
import { LeadCardMenu, type LeadCardMoveTarget } from "../lead-card/LeadCardMenu";
import { LeadBoardCardFooter } from "./LeadBoardCardFooter";

const ARABIC_SCRIPT_PATTERN = /[\u0600-\u06FF]/u;

function usesArabicScript(value: string): boolean {
  return ARABIC_SCRIPT_PATTERN.test(value);
}

const ACTIVITY_BAR_CLASS: Record<LeadActivityState, string> = {
  NONE: "bg-activity-none",
  FUTURE: "bg-activity-future",
  TODAY: "bg-activity-today",
  OVERDUE: "bg-activity-overdue",
};

export interface LeadBoardCardProps {
  lead: LeadItem;
  stage: LeadStage;
  isDragging: boolean;
  draggingFromLabel: string;
  draggingToLabel: string;
  canUpdate: boolean;
  canDelete: boolean;
  moveTargets: readonly LeadCardMoveTarget[];
  showActivityEntry: boolean;
  onOpenLead: () => void;
  onExpandView?: () => void;
  onOpenQuickModal: () => void;
  onOpenActivities: () => void;
  onDelete: () => void;
  onMoveStage: (stageId: string) => void;
  onCardChange: (patch: LeadCardPatch) => void;
}

export function LeadBoardCard({
  lead,
  stage,
  isDragging,
  draggingFromLabel,
  draggingToLabel,
  canUpdate,
  canDelete,
  moveTargets,
  showActivityEntry,
  onOpenLead,
  onExpandView,
  onOpenQuickModal,
  onOpenActivities,
  onDelete,
  onMoveStage,
  onCardChange,
}: LeadBoardCardProps) {
  const { t, lang } = useI18n();
  const cardDict = t.crmLeads.card;

  const { title, contactName } = leadCardHeading(lead);
  const arabicTitle = usesArabicScript(title);
  const isCompany = lead.leadProfileType === "CORPORATE";
  const contactRole = lead.primaryContact?.jobTitle.trim() ?? "";

  const activityState = leadActivityState(lead.nextActivity);
  const statusBarClass = stage.flag === "CONVERTED" || stage.flag === "DISQUALIFIED"
    ? ACTIVITY_BAR_CLASS.NONE
    : lead.cardColor
      ? cardColorFill(lead.cardColor)
      : ACTIVITY_BAR_CLASS[activityState];
  const cardBorderClass = lead.cardColor
    ? cardColorBorder(lead.cardColor)
    : "border-line-card";

  const sourceLabel = localizedValue(lead.sourceNameAr, lead.sourceNameEn, lang).trim();
  const visibleTags = lead.tags.slice(0, 2);
  const overflowCount = Math.max(0, lead.tags.length - visibleTags.length);
  const showSourceBadge =
    sourceLabel.length > 0 &&
    !visibleTags.some((tag) => tag.name.trim().toLowerCase() === sourceLabel.toLowerCase());
  const hasMetaRow = showSourceBadge || visibleTags.length > 0;

  return (
    <div
      className={cn(
        "group relative flex flex-col gap-2.5 overflow-hidden rounded-card border bg-card pt-[13px] pe-[13px] pb-[11px] ps-[15px] shadow-card transition-colors",
        cardBorderClass,
        isDragging && "rotate-1 scale-[1.02] border-2 border-primary ring-4 ring-primary/15",
      )}
    >
      <span
        data-testid="lead-card-activity-bar"
        aria-hidden="true"
        className={cn("pointer-events-none absolute inset-y-0 start-0 w-1 rounded-s-card", statusBarClass)}
      />

      {isDragging && (
        <div className="-ms-[15px] -me-[13px] -mt-[13px] mb-0.5 flex items-center justify-between bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground">
          <span className="flex items-center gap-1 truncate">
            <GripVertical className="size-3.5 shrink-0" aria-hidden="true" />
            <span>
              {t.crmLeads.executive.draggingLead} · {draggingFromLabel} →{" "}
              {draggingToLabel || draggingFromLabel}
            </span>
          </span>
          <span className="rounded-xs bg-primary-foreground/20 px-1.5 py-0.5 text-xs">
            Space / Drop
          </span>
        </div>
      )}

      {/* Row 1: Entity Icon Badge + Lead/Company Name + Overflow Menu */}
      <div className="flex items-center justify-between gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onOpenLead}
          className="flex h-auto min-w-0 flex-1 items-center justify-start gap-2.5 p-0 text-start not-disabled:hover:bg-transparent"
        >
          <span
            className={cn(
              "flex size-[31px] shrink-0 items-center justify-center rounded-lg",
              isCompany
                ? "bg-entity-company-surface text-entity-company-fg"
                : "bg-entity-person-surface text-entity-person-fg",
            )}
            aria-hidden="true"
          >
            {isCompany ? (
              <Building2 className="size-4" aria-hidden="true" />
            ) : (
              <UserRound className="size-4" aria-hidden="true" />
            )}
          </span>
          <span
            className={
              arabicTitle
                ? "min-w-0 truncate font-arabic text-base font-extrabold text-foreground group-hover:text-primary"
                : "min-w-0 truncate text-card-title font-bold text-foreground group-hover:text-primary"
            }
          >
            <bdi>{title}</bdi>
          </span>
        </Button>

        <div className="shrink-0" onClick={(event) => event.stopPropagation()}>
          <LeadCardMenu
            cardColor={lead.cardColor}
            onOpen={onOpenLead}
            onExpand={onExpandView}
            onDelete={canDelete ? onDelete : undefined}
            onColorChange={
              canUpdate ? (next: CardColor | null) => onCardChange({ cardColor: next }) : undefined
            }
            moveTargets={canUpdate && stage.flag !== "CONVERTED" ? moveTargets : undefined}
            onMove={canUpdate && stage.flag !== "CONVERTED" ? onMoveStage : undefined}
            labels={{
              trigger: formatTemplate(cardDict.more, { name: lead.leadName }),
              open: cardDict.open,
              expand: t.crmLeads.executive.expandCard,
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

      {/* Row 2: Optional Contact Subtitle Pill */}
      {(isCompany || contactName) && (
        <div className="flex min-w-0 items-center gap-1.5 rounded-[7px] border border-line-divider bg-surface-subtle px-2 py-1 text-caption text-foreground-secondary">
          <UserRound className="size-3 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span className="truncate">
            <bdi>{contactName || title}</bdi>
            {contactRole ? (
              <span className="text-muted-foreground">{` • ${contactRole}`}</span>
            ) : null}
          </span>
        </div>
      )}

      {/* Row 3: Optional Source / Tags Row (No time-in-stage) */}
      {hasMetaRow && (
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          {showSourceBadge && (
            <Badge size="sm" tone="positive" className="max-w-36">
              <bdi className="truncate">{sourceLabel}</bdi>
            </Badge>
          )}

          {visibleTags.map((tag, index) => {
            const customTagColor = toTagColor(tag.backgroundColor, tag.textColor);
            if (customTagColor) {
              return (
                <TagChip
                  key={tag.id}
                  size="sm"
                  label={tag.name}
                  backgroundColor={tag.backgroundColor}
                  textColor={tag.textColor}
                  className="h-6 max-w-28 rounded-md font-semibold"
                />
              );
            }
            const defaultTone = !showSourceBadge && index === 0 ? "positive" : "neutral";
            return (
              <Badge key={tag.id} size="sm" tone={defaultTone} className="max-w-28">
                <bdi className="truncate">{tag.name}</bdi>
              </Badge>
            );
          })}

          {overflowCount > 0 && (
            <Badge size="sm" tone="neutral" className="shrink-0">
              {formatTemplate(cardDict.moreTags, { count: String(overflowCount) })}
            </Badge>
          )}
        </div>
      )}

      {/* Row 4: Divider & Footer */}
      <LeadBoardCardFooter
        rating={lead.rating}
        canUpdate={canUpdate}
        activityState={activityState}
        stageFlag={stage.flag}
        showActivityEntry={showActivityEntry}
        owner={lead.owner}
        onRate={(nextRating) => onCardChange({ rating: nextRating })}
        onOpenActivities={onOpenActivities}
        onOpenQuickModal={onOpenQuickModal}
      />
    </div>
  );
}
