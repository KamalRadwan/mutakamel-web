"use client";

import { Building2, UserRound } from "lucide-react";
import { Badge } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { localizedValue } from "@/lib/format/localized";
import type { CustomerProfileItem } from "../../hooks/useCustomerProfiles";
import { AcquisitionSourceIcon } from "../../../shared/components/AcquisitionSourceIcon";

export interface CustomerProfileCardProps {
  item: CustomerProfileItem;
}

/** The lean board/card heading. Rich contact data belongs to Card View's footer. */
export function CustomerProfileCard({ item }: CustomerProfileCardProps) {
  const { t, lang } = useI18n();
  const ProfileIcon = item.profileType === "CORPORATE" ? Building2 : UserRound;
  const sourceName = localizedValue(
    item.acquisitionSourceNameAr,
    item.acquisitionSourceNameEn,
    lang,
  );

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <div className="flex min-w-0 items-center gap-2">
        <div className="flex size-6 shrink-0 items-center justify-center rounded-xs bg-brand-500/10 text-brand-600 dark:text-brand-400">
          <ProfileIcon className="size-3.5" aria-hidden="true" />
        </div>
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

      {item.companyName &&
        item.profileType === "CORPORATE" &&
        item.companyName !== item.displayName && (
          <span className="truncate text-xs text-muted-foreground">
            {item.companyName}
          </span>
        )}

      {sourceName && (
        <div className="flex min-w-0 items-center gap-1.5 text-2xs text-muted-foreground">
          <AcquisitionSourceIcon source={{ iconUrl: item.sourceIconUrl }} />
          <span className="truncate">{sourceName}</span>
        </div>
      )}
    </div>
  );
}
