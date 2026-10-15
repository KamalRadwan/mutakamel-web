"use client";

import { Building2, UserRound } from "lucide-react";
import {
  Avatar,
  AvatarFallback,
  Badge,
  Card,
  CardContent,
  RatingStars,
  StatusBadge,
  cardColorBorder,
  cn,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatTemplate } from "@/lib/format/template";
import { CrmRating, MAX_CRM_RATING } from "../../../shared/components/CrmRating";
import { leadNameInitials } from "../../lead-card-contract";
import type { LeadDetail } from "../../lead-contract";
import type { LeadCardEdit } from "../hooks/useLeadCardEdit";
import type { LeadDetailCard } from "../lead-detail-card-contract";
import { LeadCardColorPicker } from "./LeadCardColorPicker";

const PROFILE_ICON = { INDIVIDUAL: UserRound, CORPORATE: Building2 } as const;

/**
 * The record at a glance: who, what kind, where it stands, and the two
 * board-card marks (rating and colour) that are edited here as on the board.
 */
export function LeadDetailHero({ lead, card, cardEdit, editable, sourceLabel, stageAge }: {
  lead: LeadDetail;
  /** `null` when the response's card fields could not be read. */
  card: LeadDetailCard | null;
  cardEdit: LeadCardEdit;
  editable: boolean;
  sourceLabel: string;
  stageAge: string | null;
}) {
  const { t } = useI18n();
  const labels = t.crmLeads.card;
  const ProfileIcon = PROFILE_ICON[lead.leadProfileType];
  const subtitle = [sourceLabel, lead.address?.city, lead.address?.country]
    .filter((part): part is string => Boolean(part))
    .join(" · ");

  return (
    <Card className={cn("min-w-0", cardColorBorder(card?.cardColor ?? null))}>
      <CardContent className="flex flex-wrap items-center justify-between gap-2 p-2">
        <div className="flex min-w-0 items-center gap-2">
          <Avatar className="size-10">
            <AvatarFallback>{leadNameInitials(lead.displayName)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="truncate text-base font-semibold text-foreground">{lead.displayName}</span>
              <Badge>
                <ProfileIcon className="size-3" aria-hidden="true" />
                {t.crmCustomerProfiles.profileTypes[lead.leadProfileType]}
              </Badge>
              <StatusBadge value={lead.status} kind="LeadStatus" />
              {stageAge && <Badge>{formatTemplate(labels.stageAge, { age: stageAge })}</Badge>}
            </div>
            {subtitle && <p className="truncate text-xs text-muted-foreground">{subtitle}</p>}
          </div>
        </div>
        {card && (
          <div className="flex items-center gap-1">
            {editable && (
              <>
                <CrmRating value={card.rating} disabled={cardEdit.saving}
                  onChange={(rating) => void cardEdit.save({ rating })}
                  labels={{ group: labels.rating, setStars: labels.rateStars, clear: labels.clearRating }} />
                <LeadCardColorPicker value={card.cardColor} disabled={cardEdit.saving}
                  onChange={(cardColor) => void cardEdit.save({ cardColor })} />
              </>
            )}
            {!editable && (
              <RatingStars value={card.rating} max={MAX_CRM_RATING}
                label={formatTemplate(labels.ratingValue, { count: card.rating, max: MAX_CRM_RATING })} />
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
