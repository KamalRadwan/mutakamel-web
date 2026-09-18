"use client";

import { Activity } from "lucide-react";
import { Button, cn, iconSize } from "@/design-system";
import {
  CRM_ACTIVITY_MARK,
  crmActivityState,
} from "../../../shared/crm-activity-tone";
import type {
  CustomerProfileNextActivity,
  CustomerProfileOwner,
} from "../../hooks/useCustomerProfiles";
import { CustomerOwnerAvatar } from "./CustomerProfileAvatar";

export interface CustomerProfileCardFooterLabels {
  activity: string;
  owner: string;
}

export interface CustomerProfileCardFooterProps {
  nextActivity: CustomerProfileNextActivity | null;
  onOpenActivities: () => void;
  owner: CustomerProfileOwner | null;
  labels: CustomerProfileCardFooterLabels;
}

export function CustomerProfileCardFooter({
  nextActivity,
  onOpenActivities,
  owner,
  labels,
}: CustomerProfileCardFooterProps) {
  const activityState = crmActivityState(nextActivity);
  const ownerName = owner
    ? [owner.firstName, owner.lastName].filter(Boolean).join(" ")
    : "";

  return (
    <div className="flex min-w-0 items-center justify-between gap-2">
      <Button
        variant="ghost"
        size="xs"
        onClick={(event) => {
          event.stopPropagation();
          onOpenActivities();
        }}
        aria-label={labels.activity}
        title={labels.activity}
        className="w-6 shrink-0 px-0"
      >
        <Activity
          strokeWidth={2.5}
          className={cn(
            iconSize({ size: "sm" }),
            CRM_ACTIVITY_MARK[activityState],
          )}
          aria-hidden="true"
        />
      </Button>

      {owner && ownerName && (
        <span
          title={labels.owner}
          className="flex min-w-0 items-center gap-1 text-2xs text-muted-foreground"
        >
          <CustomerOwnerAvatar owner={owner} className="size-4" />
          <span className="truncate">{ownerName}</span>
        </span>
      )}
    </div>
  );
}
