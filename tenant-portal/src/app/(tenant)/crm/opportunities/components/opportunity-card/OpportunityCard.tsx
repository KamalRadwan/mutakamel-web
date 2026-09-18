"use client";

import { formatCurrencyAmount } from "../../hooks/pipeline-types";

export interface OpportunityCardModel {
  id: string;
  title: string;
  stageId?: string;
  customerDisplayName?: string;
  amount?: string | null;
  currencyCode?: string | null;
  importance: number;
  probabilityPercent?: number | null;
  cardColor?: string | null;
  activityState?: string;
  openActivityCount?: number;
  ownerUserId?: string | null;
  ownerDisplayName?: string | null;
}

export function OpportunityCard({ item }: { item: OpportunityCardModel }) {
  const formattedAmount = item.amount ? formatCurrencyAmount(item.amount, item.currencyCode ?? null) : null;

  return (
    <div className="flex flex-col gap-1">
      <span className="block truncate text-sm font-medium text-foreground">{item.title}</span>
      {item.customerDisplayName && (
        <span className="block truncate text-xs text-muted-foreground">
          {item.customerDisplayName}
        </span>
      )}
      <div className="flex items-center justify-between gap-2 pt-0.5">
        {formattedAmount && (
          <span className="font-mono text-xs font-medium tabular-nums text-foreground">
            {formattedAmount}
          </span>
        )}
        {item.probabilityPercent !== null && item.probabilityPercent !== undefined && (
          <span className="text-2xs text-muted-foreground">
            {item.probabilityPercent}%
          </span>
        )}
      </div>
    </div>
  );
}
