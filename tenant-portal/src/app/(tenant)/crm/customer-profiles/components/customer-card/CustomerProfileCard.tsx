"use client";

import { Building2, UserRound } from "lucide-react";
import { Badge, StatusBadge, cn, iconSize } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { localizedValue } from "@/lib/format/localized";
import type { CustomerProfileItem } from "../../hooks/useCustomerProfiles";
import { AcquisitionSourceIcon } from "../../../shared/components/AcquisitionSourceIcon";
import { CustomerProfileTagList } from "./CustomerProfileTagList";

export interface CustomerProfileCardProps {
  item: CustomerProfileItem;
  variant?: "board" | "card";
}

/** The lean board/card heading. Rich contact data belongs to Card View's footer. */
export function CustomerProfileCard({
  item,
  variant = "board",
}: CustomerProfileCardProps) {
  const { t, lang } = useI18n();
  const isCardView = variant === "card";
  const sourceName = localizedValue(
    item.acquisitionSourceNameAr,
    item.acquisitionSourceNameEn,
    lang,
  );
  const companyName =
    item.profileType === "CORPORATE" &&
    item.companyName !== item.displayName
      ? item.companyName
      : null;
  const contactName =
    item.profileType === "CORPORATE"
      ? item.primaryContact?.displayName ?? item.primaryContactName
      : null;
  const TypeIcon =
    item.profileType === "CORPORATE" ? Building2 : UserRound;

  return (
    <div className="flex min-w-0 flex-col gap-1">
        <div className="flex min-w-0 items-center gap-1.5">
          <TypeIcon
            className={cn(
              iconSize({ size: "sm" }),
              "shrink-0 text-muted-foreground",
            )}
            aria-hidden="true"
          />
          <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
            {item.displayName}
          </span>
          <Badge
            tone="neutral"
            className="shrink-0 px-1 py-0 text-xs font-medium leading-none normal-case tracking-normal"
          >
            {t.crmCustomerProfiles.profileTypes[item.profileType] ??
              item.profileType}
          </Badge>
        </div>

        {contactName && (
          <span className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
            <UserRound
              className={cn(iconSize({ size: "sm" }), "shrink-0")}
              aria-hidden="true"
            />
            <span className="truncate">{contactName}</span>
          </span>
        )}

        {(companyName || isCardView) && (
          <div className="flex min-w-0 items-center gap-1.5">
            {companyName && (
              <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                {companyName}
              </span>
            )}
            {isCardView && (
              <StatusBadge
                value={item.status}
                kind="CustomerStatus"
                className="shrink-0 px-1 py-0 text-xs font-medium leading-none normal-case tracking-normal"
              />
            )}
          </div>
        )}

        {(isCardView || item.tags.length > 0) && (
          <CustomerProfileTagList
            tags={item.tags}
            moreLabel={t.crmLeads.card.moreTags}
          />
        )}

        {!isCardView && sourceName && (
          <div className="flex min-w-0 items-center gap-1.5 text-2xs text-muted-foreground">
            <AcquisitionSourceIcon source={{ iconUrl: item.sourceIconUrl }} />
            <span className="truncate">{sourceName}</span>
          </div>
        )}
    </div>
  );
}
