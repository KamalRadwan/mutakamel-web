"use client";

import { Eye } from "lucide-react";
import { Button } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatTemplate } from "@/lib/format/template";
import { crmActivityState } from "../../../shared/crm-activity-tone";
import { CrmActivityPill } from "../../../shared/components/board/CrmActivityPill";
import { CrmOwnerAvatar } from "../../../shared/components/board/CrmOwnerAvatar";
import { CrmRatingStars } from "../../../shared/components/board/CrmRatingStars";
import type { CustomerBoardCardProps } from "./customer-board-types";

export function CustomerBoardCardFooter({ item, canUpdate, onCardChange, onOpenActivities,
  onOpenQuickModal }: Pick<CustomerBoardCardProps, "item" | "canUpdate" | "onCardChange" | "onOpenActivities" | "onOpenQuickModal">) {
  const { t } = useI18n();
  const state = crmActivityState(item.nextActivity);
  const neutral = item.status === "BLACKLISTED";
  const activityLabel = neutral ? t.crmCustomerProfiles.ui.board.closed : t.crmLeads.card.activityStates[state];
  const ownerName = item.owner ? [item.owner.firstName, item.owner.lastName].filter(Boolean).join(" ") : "";
  const initials = item.owner ? [item.owner.firstName, item.owner.lastName]
    .map((part) => Array.from(part.trim())[0] ?? "").join("") : "";
  const pill = <CrmActivityPill state={state} neutral={neutral} label={activityLabel} />;
  return (
    <>
      <div className="h-px w-full bg-line-card" aria-hidden="true" />
      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1.5">
        <div className="flex min-w-0 max-w-full flex-wrap items-center gap-x-1.5 gap-y-1.5">
          <CrmRatingStars value={item.rating} disabled={!canUpdate}
            onChange={canUpdate ? (rating) => onCardChange({ rating }) : undefined}
            ariaLabel={t.crmLeads.card.rating}
            starLabel={(count) => formatTemplate(t.crmLeads.card.rateStars, { count: String(count), max: "3" })} />
          {onOpenActivities && !neutral ? (
            <Button type="button" variant="ghost" size="xs" onClick={onOpenActivities}
              className="h-auto max-w-full rounded-md p-0 not-disabled:hover:bg-transparent">{pill}</Button>
          ) : pill}
        </div>
        <div className="ms-auto flex shrink-0 items-center gap-1">
          {onOpenQuickModal && (
            <Button type="button" variant="ghost" size="xs" onClick={onOpenQuickModal}
              title={t.crmCustomerProfiles.ui.board.open_360_quick_edit_modal}
              aria-label={t.crmCustomerProfiles.ui.board.open_360_quick_edit_modal}
              className="size-6 shrink-0 rounded-md p-0 text-muted-foreground hover:text-foreground">
              <Eye className="size-3.5" aria-hidden="true" />
            </Button>
          )}
          {item.owner && <CrmOwnerAvatar initials={initials} name={ownerName} imageUrl={item.owner?.avatarUrl} />}
        </div>
      </div>
    </>
  );
}
