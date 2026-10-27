"use client";

import { Eye } from "lucide-react";
import { Button, cn, hitTarget } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatTemplate } from "@/lib/format/template";
import { crmActivityState } from "../../../shared/crm-activity-tone";
import { MAX_CRM_RATING } from "../../../shared/crm-rating-contract";
import { CrmActivityPill } from "../../../shared/components/board/CrmActivityPill";
import { CrmOwnerAvatar } from "../../../shared/components/board/CrmOwnerAvatar";
import { CrmRatingStars } from "../../../shared/components/board/CrmRatingStars";
import type {
  CustomerProfileCardPatch,
  CustomerProfileItem,
  CustomerProfileOwner,
} from "./customer-grid-types";

function formatOwnerInitials(owner: CustomerProfileOwner | null): string {
  if (!owner) return "";
  return [owner.firstName, owner.lastName]
    .map((part) => Array.from(part.trim())[0] ?? "")
    .join("")
    .toUpperCase();
}

function formatOwnerShortName(owner: CustomerProfileOwner | null): string {
  if (!owner) return "";
  const first = owner.firstName.trim();
  const lastInitial = Array.from(owner.lastName.trim())[0] ?? "";
  if (first && lastInitial) return `${first} ${lastInitial}.`;
  return first || owner.lastName.trim();
}

interface CustomerGridCardFooterProps {
  item: CustomerProfileItem;
  canUpdate: boolean;
  onOpenQuickModal?: () => void;
  onOpenActivities?: () => void;
  onCardChange: (patch: CustomerProfileCardPatch) => void;
}

export function CustomerGridCardFooter({
  item,
  canUpdate,
  onOpenQuickModal,
  onOpenActivities,
  onCardChange,
}: CustomerGridCardFooterProps) {
  const { t } = useI18n();
  const cardDict = t.crmLeads.card;
  const statusLabels: Record<string, string | undefined> = t.statusValues;

  const isBlacklisted = item.status === "BLACKLISTED";
  const activityState = crmActivityState(item.nextActivity);
  const activityLabel = isBlacklisted
    ? (statusLabels["CustomerStatus.BLACKLISTED"] ?? item.status)
    : cardDict.activityStates[activityState];
  const activityActionLabel = formatTemplate(cardDict.activityOpen, {
    state: activityLabel,
  });

  const ownerInitials = formatOwnerInitials(item.owner);
  const ownerShortName = formatOwnerShortName(item.owner);
  const ownerFullName = item.owner
    ? [item.owner.firstName.trim(), item.owner.lastName.trim()]
        .filter(Boolean)
        .join(" ")
    : "";
  const ownerLabel = ownerFullName
    ? formatTemplate(cardDict.owner, { name: ownerFullName })
    : "";

  return (
    <div
      className="flex flex-wrap items-center gap-x-1.5 gap-y-1.5"
      onClick={(event) => event.stopPropagation()}
    >
      <div className="flex min-w-0 max-w-full flex-wrap items-center gap-x-1.5 gap-y-1.5">
        <CrmRatingStars
          value={item.rating}
          onChange={
            canUpdate
              ? (nextRating) => onCardChange({ rating: nextRating })
              : undefined
          }
          ariaLabel={
            canUpdate
              ? cardDict.rating
              : formatTemplate(cardDict.ratingValue, {
                  count: String(item.rating),
                  max: String(MAX_CRM_RATING),
                })
          }
          starLabel={(star) =>
            formatTemplate(cardDict.rateStars, {
              count: String(star),
              max: String(MAX_CRM_RATING),
            })
          }
        />

        {onOpenActivities && !isBlacklisted ? (
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={onOpenActivities}
            title={activityActionLabel}
            aria-label={activityActionLabel}
            className={cn(
              hitTarget,
              "h-auto shrink-0 rounded-full p-0 whitespace-nowrap transition-opacity not-disabled:hover:bg-transparent not-disabled:hover:opacity-85",
            )}
          >
            <CrmActivityPill state={activityState} label={activityLabel} />
          </Button>
        ) : (
          <CrmActivityPill
            state={activityState}
            label={activityLabel}
            neutral={isBlacklisted}
          />
        )}
      </div>

      <div className="ms-auto flex shrink-0 items-center gap-1.5">
        {onOpenQuickModal && (
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={onOpenQuickModal}
            title={t.crmCustomerProfiles.ui.card.quick_360_inspect_edit}
            aria-label={t.crmCustomerProfiles.ui.card.quick_360_inspect_edit}
            className="size-6 shrink-0 rounded-md p-0 text-muted-foreground hover:text-foreground"
          >
            <Eye className="size-[13.5px]" aria-hidden="true" />
          </Button>
        )}

        {item.owner && ownerInitials && (
          <div className="flex min-w-0 items-center gap-1">
            <span className="shrink-0">
              <CrmOwnerAvatar
                initials={ownerInitials}
                name={ownerLabel || undefined}
                imageUrl={item.owner.avatarUrl}
              />
            </span>
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
  );
}
