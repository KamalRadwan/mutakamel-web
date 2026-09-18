"use client";

import { Activity, FileText, ReceiptText, ShoppingCart } from "lucide-react";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Button,
  cn,
  iconSize,
} from "@/design-system";
import { CrmRating, type CrmRatingLabels } from "../../../shared/components/CrmRating";
import { CRM_ACTIVITY_MARK } from "../../../shared/crm-activity-tone";
import type { OpportunityActivityState } from "../../opportunity-read-model";
import type {
  OpportunityDocumentCounts,
  OpportunityDocumentCountVisibility,
} from "../../opportunity-document-counts-contract";

export interface OpportunityRichCardFooterLabels extends CrmRatingLabels {
  activity: string;
  ownerUnavailable: string;
  quotations: string;
  salesOrders: string;
  invoices: string;
}

export function OpportunityRichCardFooter({
  importance,
  ownerDisplayName,
  ownerAvatarUrl,
  openActivityCount,
  activityState,
  counts,
  countVisibility,
  canUpdate,
  onImportanceChange,
  onOpenActivities,
  labels,
}: {
  importance: number;
  ownerDisplayName: string | null;
  ownerAvatarUrl: string | null;
  openActivityCount: number;
  activityState: OpportunityActivityState;
  counts?: OpportunityDocumentCounts;
  countVisibility: OpportunityDocumentCountVisibility;
  canUpdate: boolean;
  onImportanceChange: (next: number) => void;
  onOpenActivities: () => void;
  labels: OpportunityRichCardFooterLabels;
}) {
  const ownerName = ownerDisplayName ?? labels.ownerUnavailable;
  const initials = ownerDisplayName
    ?.split(/\s+/u)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
  const displayActivityState = activityState === "NO_OPEN" ? "NONE" : activityState;
  const countRows = [
    { key: "quotations" as const, icon: FileText, abbreviation: "PQ", label: labels.quotations },
    { key: "salesOrders" as const, icon: ShoppingCart, abbreviation: "SO", label: labels.salesOrders },
    { key: "invoices" as const, icon: ReceiptText, abbreviation: "IN", label: labels.invoices },
  ];
  const hasVisibleCounts = countRows.some(({ key }) => countVisibility[key]);

  return (
    <div className="mt-auto flex flex-col gap-1.5 border-t border-border pt-1.5">
      {counts && hasVisibleCounts && (
        <div className="grid grid-cols-3 gap-1">
          {countRows.map(({ key, icon: CountIcon, abbreviation, label }) =>
            countVisibility[key] ? (
              <div
                key={key}
                className="flex min-w-0 items-center gap-1 rounded-xs bg-muted/60 px-1.5 py-1 text-xs text-muted-foreground"
                title={label}
              >
                <CountIcon className={cn(iconSize({ size: "sm" }), "shrink-0")} aria-hidden="true" />
                <span className="truncate">{abbreviation}: {counts[key] ?? "—"}</span>
              </div>
            ) : null,
          )}
        </div>
      )}
      <div className="flex min-w-0 items-center gap-1.5 text-xs text-foreground">
        <Avatar className="size-6 shrink-0">
          <AvatarImage src={ownerAvatarUrl ?? undefined} alt="" />
          <AvatarFallback className="text-2xs">{initials || "?"}</AvatarFallback>
        </Avatar>
        <span className="truncate font-medium">{ownerName}</span>
      </div>

      <div className="flex items-center justify-between gap-2">
        <CrmRating
          value={importance}
          disabled={!canUpdate}
          onChange={onImportanceChange}
          labels={labels}
        />
        <Button
          variant="ghost"
          size="xs"
          className="min-w-0 gap-1 px-1"
          aria-label={labels.activity}
          title={labels.activity}
          onClick={(event) => {
            event.stopPropagation();
            onOpenActivities();
          }}
        >
          <Activity
            strokeWidth={2.5}
            className={cn(iconSize({ size: "sm" }), CRM_ACTIVITY_MARK[displayActivityState])}
            aria-hidden="true"
          />
          <span className="text-2xs text-muted-foreground">{openActivityCount}</span>
        </Button>
      </div>
    </div>
  );
}
