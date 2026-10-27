"use client";

import { Building2, ExternalLink, UserRound } from "lucide-react";
import {
  Badge, Button, Checkbox, cardColorBorder, cardColorFill, cn, type CardColor, type MoveToTarget,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { localizedName } from "@/lib/format/localized";
import { formatNumber } from "@/lib/format/number";
import { formatTemplate } from "@/lib/format/template";
import { crmActivityState } from "../../../shared/crm-activity-tone";
import { crmBoardCardClass, crmBoardIconButtonClass } from "../../../shared/components/board/board-classes";
import { CrmActivityPill } from "../../../shared/components/board/CrmActivityPill";
import { CrmCardStartBar } from "../../../shared/components/board/CrmCardStartBar";
import { CrmOwnerAvatar } from "../../../shared/components/board/CrmOwnerAvatar";
import { CrmRatingStars } from "../../../shared/components/board/CrmRatingStars";
import type { OpportunityStage } from "../../hooks/pipeline-types";
import type { OpportunityListItem } from "../../hooks/useOpportunitiesList";
import type { OpportunityCardPatch } from "../../opportunity-card-contract";
import type { OpportunityDocumentCountVisibility, OpportunityDocumentCounts } from "../../opportunity-document-counts-contract";
import { OpportunityCardMenu } from "../opportunity-card/OpportunityCardMenu";
import { OpportunityGridCardBody } from "./OpportunityGridCardBody";
import { OpportunityGridDocumentCounts } from "./OpportunityGridDocumentCounts";

const ARABIC_SCRIPT_PATTERN = /[\u0600-\u06FF]/u;

function getOwnerInitials(displayName: string): string {
  const words = displayName.split(/\s+/u).filter(Boolean);
  if (words.length === 0) return "";
  if (words.length === 1) return Array.from(words[0]).slice(0, 2).join("").toUpperCase();
  return `${Array.from(words[0])[0] ?? ""}${Array.from(words[1])[0] ?? ""}`.toUpperCase();
}

function formatOwnerShortName(displayName: string): string {
  const words = displayName.split(/\s+/u).filter(Boolean);
  if (words.length <= 1) return words[0] ?? "";
  const lastInitial = Array.from(words[words.length - 1])[0] ?? "";
  return lastInitial ? `${words[0]} ${lastInitial}.` : words[0];
}

interface OpportunityGridCardProps {
  item: OpportunityListItem;
  stage: OpportunityStage | undefined;
  stages: readonly OpportunityStage[];
  documentCounts?: OpportunityDocumentCounts;
  documentCountVisibility?: OpportunityDocumentCountVisibility;
  isSelected: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  moveTargets: readonly MoveToTarget[];
  onToggleSelect: () => void;
  onOpenOpportunity: () => void;
  onDelete: () => void;
  onMoveStage: (stageId: string) => void;
  onCardChange: (patch: OpportunityCardPatch) => void;
}

export function OpportunityGridCard({
  item,
  stage,
  stages,
  documentCounts,
  documentCountVisibility,
  isSelected,
  canUpdate,
  canDelete,
  moveTargets,
  onToggleSelect,
  onOpenOpportunity,
  onDelete,
  onMoveStage,
  onCardChange,
}: OpportunityGridCardProps) {
  const { t, lang } = useI18n();
  const cardDict = t.crmLeads.card;

  const arabicTitle = ARABIC_SCRIPT_PATTERN.test(item.title);
  const isCorporate = item.customerProfileType === "CORPORATE";
  const isWon = stage?.flag === "WON" || item.status === "WON";
  const isLost = stage?.flag === "LOST" || item.status === "LOST";
  const isTerminal = isWon || isLost;

  const activityState = crmActivityState(
    !item.nextOpenActivityAt && item.activityState === "NO_OPEN"
      ? null
      : { activityAt: item.nextOpenActivityAt, bucket: item.activityState },
  );

  const activityPillLabel = isWon
    ? t.statusValues["OpportunityStatus.WON"]
    : isLost
      ? t.statusValues["OpportunityStatus.LOST"]
      : cardDict.activityStates[activityState];

  const activityPillTitle =
    !isTerminal && item.openActivityCount > 0
      ? `${cardDict.activityStates[activityState]} · ${t.crmOpportunities.openActivities(item.openActivityCount)}`
      : undefined;

  const ownerFullName = item.ownerDisplayName?.trim() ?? "";
  const ownerInitials = getOwnerInitials(ownerFullName);
  const ownerShortName = formatOwnerShortName(ownerFullName);
  const ownerLabel = ownerFullName ? formatTemplate(cardDict.owner, { name: ownerFullName }) : "";

  return (
    <div
      data-testid="opportunity-grid-card"
      className={cn(
        crmBoardCardClass,
        "h-full",
        item.cardColor && cardColorBorder(item.cardColor),
        isSelected && "border-primary ring-2 ring-primary/15",
      )}
    >
      <CrmCardStartBar
        state={activityState}
        neutral={isTerminal && !item.cardColor}
        colorClass={item.cardColor ? cardColorFill(item.cardColor) : undefined}
      />

      {/* Row 1: Selection + 31px Entity Icon Badge + Title + Stage Selector + Open + Menu */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <Checkbox
            checked={isSelected}
            onCheckedChange={onToggleSelect}
            aria-label={`${t.views.selectItem}: ${item.title}`}
            className="shrink-0"
          />

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onOpenOpportunity}
            className="flex h-auto min-w-0 flex-1 items-center justify-start gap-2.5 p-0 text-start not-disabled:hover:bg-transparent"
          >
            <span
              className={cn(
                "flex size-[31px] shrink-0 items-center justify-center rounded-lg",
                isCorporate
                  ? "bg-entity-company-surface text-entity-company-fg"
                  : "bg-entity-person-surface text-entity-person-fg",
              )}
              aria-hidden="true"
            >
              {isCorporate ? (
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
              <bdi>{item.title}</bdi>
            </span>
          </Button>
        </div>

        <div
          className="flex shrink-0 items-center gap-1"
          onClick={(event) => event.stopPropagation()}
        >
          {canUpdate ? (
            <select
              value={item.stageId}
              onChange={(event) => onMoveStage(event.target.value)}
              aria-label={`Stage for ${item.title}`}
              className={cn(
                "h-[26px] max-w-28 truncate rounded-md border px-1.5 text-badge font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                isWon
                  ? "border-success/30 bg-success-subtle text-success-subtle-foreground"
                  : isLost
                    ? "border-destructive/30 bg-destructive-subtle text-destructive-subtle-foreground"
                    : "border-line-control bg-surface-subtle text-foreground",
              )}
            >
              {stages.map((st) => (
                <option key={st.id} value={st.id}>
                  {localizedName(st, lang)}
                </option>
              ))}
            </select>
          ) : (
            <Badge
              size="sm"
              tone={isWon ? "positive" : isLost ? "negative" : "neutral"}
              className="max-w-28"
            >
              <bdi className="truncate">{stage ? localizedName(stage, lang) : "—"}</bdi>
            </Badge>
          )}

          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={onOpenOpportunity}
            title={t.crmOpportunities.openOpportunity}
            aria-label={t.crmOpportunities.openOpportunity}
            className={crmBoardIconButtonClass}
          >
            <ExternalLink className="size-3.5" aria-hidden="true" />
          </Button>

          <OpportunityCardMenu
            cardColor={item.cardColor}
            onOpen={onOpenOpportunity}
            onDelete={canDelete ? onDelete : undefined}
            onColorChange={
              canUpdate ? (next: CardColor | null) => onCardChange({ cardColor: next }) : undefined
            }
            moveTargets={canUpdate ? moveTargets : undefined}
            onMove={canUpdate ? onMoveStage : undefined}
            labels={{
              trigger: formatTemplate(cardDict.more, { name: item.title }),
              open: cardDict.open,
              moveTo: t.views.moveTo,
              delete: t.common.delete,
              cardColor: cardDict.cardColor,
              colorNone: cardDict.colorNone,
              colorNames: cardDict.colors,
              selected: cardDict.colorSelected,
            }}
          />
        </div>
      </div>

      <OpportunityGridCardBody item={item} />

      <div className="mt-auto flex flex-col gap-2.5 pt-0.5">
        <OpportunityGridDocumentCounts
          opportunityId={item.id}
          customerPartyId={item.customerPartyId}
          counts={documentCounts}
          visibility={documentCountVisibility}
        />

        <div className="h-px w-full bg-line-card" aria-hidden="true" />

        <div
          className="flex flex-wrap items-center gap-2"
          onClick={(event) => event.stopPropagation()}
        >
          <CrmRatingStars
            value={item.importance}
            onChange={canUpdate ? (next) => onCardChange({ importance: next }) : undefined}
            disabled={!canUpdate}
            ariaLabel={
              canUpdate
                ? t.crmOpportunities.importance
                : formatTemplate(t.crmOpportunities.importanceValue, {
                    level: formatNumber(item.importance, lang),
                  })
            }
            starLabel={(level) =>
              formatTemplate(t.crmOpportunities.setImportance, {
                level: formatNumber(level, lang),
              })
            }
          />

          <CrmActivityPill
            state={activityState}
            neutral={isTerminal}
            label={activityPillLabel}
            title={activityPillTitle}
          />

          {ownerFullName && ownerInitials && (
            <div className="ms-auto flex min-w-0 shrink-0 items-center gap-1.5">
              <CrmOwnerAvatar
                initials={ownerInitials}
                name={ownerLabel || undefined}
                imageUrl={item.ownerAvatarUrl}
              />
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
  );
}
