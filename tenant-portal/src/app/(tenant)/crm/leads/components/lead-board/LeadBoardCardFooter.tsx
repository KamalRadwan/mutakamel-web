"use client";

import { Eye } from "lucide-react";
import { Button } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import type { LeadActivityState, LeadOwner } from "../../lead-card-contract";
import type { LeadStage } from "../../lead-list-contract";
import { LeadActivityPill } from "./LeadActivityPill";
import { LeadOwnerAvatar } from "./LeadOwnerAvatar";
import { LeadRatingStars } from "./LeadRatingStars";

interface LeadBoardCardFooterProps {
  rating: number;
  canUpdate: boolean;
  activityState: LeadActivityState;
  stageFlag: LeadStage["flag"];
  showActivityEntry: boolean;
  owner: LeadOwner | null;
  onRate: (nextRating: number) => void;
  onOpenActivities: () => void;
  onOpenQuickModal: () => void;
}

export function LeadBoardCardFooter({
  rating,
  canUpdate,
  activityState,
  stageFlag,
  showActivityEntry,
  owner,
  onRate,
  onOpenActivities,
  onOpenQuickModal,
}: LeadBoardCardFooterProps) {
  const { t } = useI18n();

  return (
    <>
      <div className="h-px w-full bg-line-card" aria-hidden="true" />
      <div
        className="flex flex-wrap items-center gap-x-1.5 gap-y-1.5"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex min-w-0 max-w-full flex-wrap items-center gap-x-1.5 gap-y-1.5">
          <LeadRatingStars
            rating={rating}
            canUpdate={canUpdate}
            onRate={onRate}
          />

          <LeadActivityPill
            state={activityState}
            stageFlag={stageFlag}
            showActivityEntry={showActivityEntry}
            onOpenActivities={onOpenActivities}
          />
        </div>

        <div className="ms-auto flex shrink-0 items-center gap-1">
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

          <LeadOwnerAvatar owner={owner} />
        </div>
      </div>
    </>
  );
}
