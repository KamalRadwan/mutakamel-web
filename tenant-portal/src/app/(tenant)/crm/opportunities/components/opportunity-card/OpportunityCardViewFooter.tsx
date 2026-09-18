"use client";

import Link from "next/link";
import { Building2, Calendar, UserRound } from "lucide-react";
import { DateTime, cn, iconSize } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import type { OpportunityActivityState } from "../../hooks/pipeline-types";
import {
  OpportunityCardFooter,
  type OpportunityCardFooterLabels,
} from "./OpportunityCardFooter";

export interface OpportunityCardViewFooterLabels extends OpportunityCardFooterLabels {
  customer: string;
  expectedClose: string;
  salesperson: string;
}

export interface OpportunityCardViewFooterProps {
  customerProfileId?: string | null;
  customerDisplayName?: string | null;
  expectedCloseDate?: string | null;
  importance: number;
  onImportanceChange: (next: number) => void;
  isImportanceDisabled?: boolean;
  activityState: OpportunityActivityState;
  onOpenActivities: () => void;
  ownerUserId?: string | null;
  labels: OpportunityCardViewFooterLabels;
}

/** The richer Card View footer for Opportunities, mirroring LeadCardViewFooter. */
export function OpportunityCardViewFooter({
  customerProfileId,
  customerDisplayName,
  expectedCloseDate,
  importance,
  onImportanceChange,
  isImportanceDisabled,
  activityState,
  onOpenActivities,
  ownerUserId,
  labels,
}: OpportunityCardViewFooterProps) {
  const { lang } = useI18n();

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-1.5 border-t border-border pt-1.5">
      {customerDisplayName && customerProfileId && (
        <div className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
          <Building2 className={cn(iconSize({ size: "sm" }), "shrink-0")} aria-hidden="true" />
          <Link
            href={`/crm/customer-profiles/${encodeURIComponent(customerProfileId)}`}
            onClick={(e) => e.stopPropagation()}
            className="truncate text-foreground underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {customerDisplayName}
          </Link>
        </div>
      )}

      {expectedCloseDate && (
        <div className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
          <Calendar className={cn(iconSize({ size: "sm" }), "shrink-0")} aria-hidden="true" />
          <span className="truncate">
            {labels.expectedClose}:{" "}
            <DateTime
              value={`${expectedCloseDate.slice(0, 10)}T00:00:00.000Z`}
              precision="date"
              language={lang}
              timeZone="UTC"
            />
          </span>
        </div>
      )}

      <div className="mt-auto flex flex-col gap-1.5 border-t border-border pt-1.5">
        {ownerUserId && (
          <div className="flex min-w-0 items-center gap-1.5 text-xs text-foreground">
            <UserRound
              className={cn(iconSize({ size: "sm" }), "shrink-0 text-muted-foreground")}
              aria-hidden="true"
            />
            <span className="truncate font-medium">{labels.salesperson}</span>
          </div>
        )}

        <OpportunityCardFooter
          importance={importance}
          onImportanceChange={onImportanceChange}
          isImportanceDisabled={isImportanceDisabled}
          activityState={activityState}
          onOpenActivities={onOpenActivities}
          ownerUserId={ownerUserId}
          labels={labels}
        />
      </div>
    </div>
  );
}
