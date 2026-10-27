"use client";

import { Building2, ExternalLink, Eye, UserRound } from "lucide-react";
import {
  Button,
  Checkbox,
  cardColorBorder,
  cardColorFill,
  cn,
  type CardColor,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatTemplate } from "@/lib/format/template";
import {
  leadActivityState,
  leadCardHeading,
  type LeadActivityState,
  type LeadCardPatch,
} from "../../lead-card-contract";
import type { LeadDocumentCounts } from "../../lead-document-counts-contract";
import type { LeadItem, LeadStage } from "../../lead-list-contract";
import { LeadActivityPill } from "../lead-board/LeadActivityPill";
import { LeadOwnerAvatar } from "../lead-board/LeadOwnerAvatar";
import { LeadRatingStars } from "../lead-board/LeadRatingStars";
import { LeadCardMenu, type LeadCardMoveTarget } from "../lead-card/LeadCardMenu";
import { LeadGridCardBody } from "./LeadGridCardBody";
import { LeadGridDocumentCounts } from "./LeadGridDocumentCounts";

const ARABIC_SCRIPT_PATTERN = /[\u0600-\u06FF]/u;

function usesArabicScript(value: string): boolean {
  return ARABIC_SCRIPT_PATTERN.test(value);
}

function formatOwnerShortName(owner: LeadItem["owner"]): string {
  if (!owner) return "";
  const first = owner.firstName.trim();
  const lastInitial = Array.from(owner.lastName.trim())[0] ?? "";
  if (first && lastInitial) return `${first} ${lastInitial}.`;
  return first || owner.lastName.trim();
}

const ACTIVITY_BAR_CLASS: Record<LeadActivityState, string> = {
  NONE: "bg-activity-none",
  FUTURE: "bg-activity-future",
  TODAY: "bg-activity-today",
  OVERDUE: "bg-activity-overdue",
};

interface LeadGridCardProps {
  lead: LeadItem;
  stage: LeadStage | undefined;
  documentCounts?: LeadDocumentCounts;
  isSelected: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  showActivityEntry: boolean;
  moveTargets: readonly LeadCardMoveTarget[];
  onToggleSelect: () => void;
  onOpenLead: () => void;
  onOpenQuickModal: () => void;
  onOpenActivities: () => void;
  onDelete: () => void;
  onMoveStage: (stageId: string) => void;
  onCardChange: (patch: LeadCardPatch) => void;
}

export function LeadGridCard({
  lead,
  stage,
  documentCounts,
  isSelected,
  canUpdate,
  canDelete,
  showActivityEntry,
  moveTargets,
  onToggleSelect,
  onOpenLead,
  onOpenQuickModal,
  onOpenActivities,
  onDelete,
  onMoveStage,
  onCardChange,
}: LeadGridCardProps) {
  const { t } = useI18n();
  const cardDict = t.crmLeads.card;

  const { title, contactName } = leadCardHeading(lead);
  const arabicTitle = usesArabicScript(title);
  const isCompany = lead.leadProfileType === "CORPORATE";
  const isTerminal = stage?.flag === "CONVERTED";
  const canEdit = canUpdate && !isTerminal;

  const activityState = leadActivityState(lead.nextActivity);
  const statusBarClass = lead.cardColor
    ? cardColorFill(lead.cardColor)
    : ACTIVITY_BAR_CLASS[activityState];
  const cardBorderClass = lead.cardColor
    ? cardColorBorder(lead.cardColor)
    : "border-line-card";

  const ownerShortName = formatOwnerShortName(lead.owner);
  const ownerFullName = lead.owner
    ? [lead.owner.firstName.trim(), lead.owner.lastName.trim()].filter(Boolean).join(" ")
    : "";
  const ownerLabel = ownerFullName
    ? formatTemplate(cardDict.owner, { name: ownerFullName })
    : "";

  return (
    <div
      data-testid="lead-grid-card"
      className={cn(
        "group relative flex h-full flex-col gap-2.5 overflow-hidden rounded-card border bg-card pt-[13px] pe-[13px] pb-[11px] ps-[15px] shadow-card transition-colors",
        cardBorderClass,
        isSelected && "border-primary ring-2 ring-primary/15",
      )}
    >
      <span
        data-testid="lead-card-activity-bar"
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute inset-y-0 start-0 w-1 rounded-s-card",
          statusBarClass,
        )}
      />

      {/* Row 1: Selection + Entity Icon Badge + Lead/Company Name + Standalone Link + Menu */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <Checkbox
            checked={isSelected}
            onCheckedChange={onToggleSelect}
            aria-label={`${t.views.selectItem}: ${title}`}
            className="shrink-0"
          />

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
        </div>

        <div
          className="flex shrink-0 items-center gap-0.5"
          onClick={(event) => event.stopPropagation()}
        >
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={onOpenLead}
            title={t.crmLeads.executive.openStandalonePage}
            aria-label={t.crmLeads.executive.openStandalonePage}
            className="size-6 shrink-0 rounded-md p-0 text-muted-foreground hover:text-foreground"
          >
            <ExternalLink className="size-3.5" aria-hidden="true" />
          </Button>

          <LeadCardMenu
            cardColor={lead.cardColor}
            onOpen={onOpenLead}
            onDelete={canDelete ? onDelete : undefined}
            onColorChange={
              canEdit ? (next: CardColor | null) => onCardChange({ cardColor: next }) : undefined
            }
            moveTargets={canEdit ? moveTargets : undefined}
            onMove={canEdit ? onMoveStage : undefined}
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

      {/* Middle Rich Content: Location/Legal, Contact + Phone/Email, Need Snippet, Stage/Source/Tags */}
      <LeadGridCardBody
        lead={lead}
        stage={stage}
        contactName={contactName}
        canEdit={canEdit}
        onOpenQuickModal={onOpenQuickModal}
      />

      {/* Bottom Strip: 4-Cell Document Counts + Divider + Non-Truncating Footer */}
      <div className="mt-auto flex flex-col gap-2.5 pt-0.5">
        <LeadGridDocumentCounts
          leadId={lead.id}
          partyId={lead.partyId}
          counts={documentCounts}
        />

        <div className="h-px w-full bg-line-divider" aria-hidden="true" />

        <div
          className="flex items-center gap-2"
          onClick={(event) => event.stopPropagation()}
        >
          <LeadRatingStars
            rating={lead.rating}
            canUpdate={canEdit}
            onRate={(nextRating) => onCardChange({ rating: nextRating })}
          />

          <LeadActivityPill
            state={activityState}
            showActivityEntry={showActivityEntry}
            onOpenActivities={onOpenActivities}
          />

          <span className="min-w-0 flex-1" aria-hidden="true" />

          <div className="flex min-w-0 items-center gap-1.5">
            <Button
              type="button"
              variant="ghost"
              size="xs"
              onClick={onOpenQuickModal}
              title={t.crmLeads.executive.quickEdit}
              aria-label={t.crmLeads.executive.quickEdit}
              className="size-6 shrink-0 rounded-md p-0 text-muted-foreground hover:text-foreground"
            >
              <Eye className="size-[13.5px]" aria-hidden="true" />
            </Button>

            {lead.owner && (
              <div className="flex min-w-0 items-center gap-1">
                <span className="shrink-0">
                  <LeadOwnerAvatar owner={lead.owner} />
                </span>
                {ownerShortName && (
                  <span
                    title={ownerLabel || undefined}
                    className="max-w-20 truncate text-caption font-medium text-muted-foreground"
                  >
                    <bdi>{ownerShortName}</bdi>
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
