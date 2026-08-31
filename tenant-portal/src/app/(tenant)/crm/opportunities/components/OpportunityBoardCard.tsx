"use client";

import Link from "next/link";
import { Clock } from "lucide-react";
import { cn } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import type { OpportunityCardRecord } from "../hooks/pipeline-types";
import { formatCurrencyAmount } from "../hooks/pipeline-types";
import { OpportunityImportanceStars } from "./OpportunityImportanceStars";

const ACTIVITY_TONE: Record<string, string> = {
  OVERDUE: "text-negative-600 dark:text-negative-400",
  TODAY: "text-caution-600 dark:text-caution-400",
  FUTURE: "text-muted-foreground",
};

interface OpportunityBoardCardProps {
  item: OpportunityCardRecord;
  canUpdate: boolean;
  onImportanceChange: (next: number) => void;
}

export function OpportunityBoardCard({ item, canUpdate, onImportanceChange }: OpportunityBoardCardProps) {
  const { t } = useI18n();
  const activityLabel =
    item.activityState === "OVERDUE"
      ? t.crmOpportunities.overdue
      : item.activityState === "TODAY"
        ? t.crmOpportunities.dueToday
        : item.activityState === "FUTURE"
          ? t.crmOpportunities.upcoming
          : null;

  return (
    <div className="flex flex-col gap-1.5">
      {/* The title is the route into the detail screen, per
          docs/design/detail-screens.md#routes. A link rather than a card-wide
          click target: this card lives inside a drag surface, and making the
          whole card activatable would fire navigation on a short drag. */}
      <Link
        href={`/crm/opportunities/${encodeURIComponent(item.id)}`}
        className="truncate rounded-xs text-sm font-medium text-foreground hover:underline"
      >
        {item.title}
      </Link>
      {item.customerDisplayName && <p className="truncate text-xs text-muted-foreground">{item.customerDisplayName}</p>}
      <div className="flex items-center justify-between gap-2 pt-1">
        <OpportunityImportanceStars
          importance={item.importance}
          onChange={canUpdate ? onImportanceChange : undefined}
          label={t.crmOpportunities.importance}
        />
        {item.amount && (
          <span className="font-mono text-2xs tabular-nums text-muted-foreground">
            {formatCurrencyAmount(item.amount, item.currencyCode)}
          </span>
        )}
      </div>
      {activityLabel && (
        <div className={cn("flex items-center gap-1 text-2xs", ACTIVITY_TONE[item.activityState])}>
          <Clock className="size-3 shrink-0" aria-hidden="true" />
          <span>{activityLabel}</span>
        </div>
      )}
    </div>
  );
}
