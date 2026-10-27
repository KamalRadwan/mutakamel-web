"use client";

import { UserRound } from "lucide-react";
import { cardColorFill, cn } from "@/design-system";
import type { AcquisitionSource } from "../../../acquisition-sources/acquisition-source-contract";
import { crmActivityState } from "../../../shared/crm-activity-tone";
import { CrmCardStartBar } from "../../../shared/components/board/CrmCardStartBar";
import { crmBoardCardClass } from "../../../shared/components/board/board-classes";
import type { CustomerBoardCardProps } from "./customer-board-types";
import { CustomerBoardCardHeader } from "./CustomerBoardCardHeader";
import { CustomerBoardCardFooter } from "./CustomerBoardCardFooter";
import { CustomerBoardExpandedView } from "./CustomerBoardExpandedView";
import { CustomerBoardTags } from "./CustomerBoardTags";

export function CustomerBoardCard(props: CustomerBoardCardProps & { sources: readonly AcquisitionSource[] }) {
  const { item, expanded, sources } = props;
  const contactName = item.primaryContactName?.trim() || item.primaryContact?.displayName || item.companyName || item.displayName;
  return (
    <div className={cn(crmBoardCardClass, expanded && "ring-1 ring-primary")}>
      <CrmCardStartBar state={crmActivityState(item.nextActivity)} neutral={item.status === "BLACKLISTED"}
        colorClass={item.cardColor && item.status !== "BLACKLISTED" ? cardColorFill(item.cardColor) : undefined} />
      <CustomerBoardCardHeader {...props} />
      {expanded ? <CustomerBoardExpandedView item={item} sources={sources} /> : item.profileType === "CORPORATE" && (
        <div className="flex min-w-0 items-center gap-1.5 rounded-md border border-line-divider bg-surface-subtle px-2 py-1 text-caption text-foreground-secondary">
          <UserRound className="size-3 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span className="truncate"><bdi>{contactName}</bdi>
            {item.primaryContact?.jobTitle && <span className="text-muted-foreground"> · {item.primaryContact.jobTitle}</span>}
          </span>
        </div>
      )}
      <CustomerBoardTags tags={item.tags} expanded={expanded} />
      <CustomerBoardCardFooter {...props} />
    </div>
  );
}
