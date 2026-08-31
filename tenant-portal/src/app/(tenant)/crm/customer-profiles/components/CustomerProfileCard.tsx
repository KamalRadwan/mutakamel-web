"use client";

import { Building2, UserRound } from "lucide-react";
import { StatusBadge } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { localizedValue } from "@/lib/format/localized";
import type { CustomerProfileItem } from "../hooks/useCustomerProfiles";

// The card body the board and the card view both render. It is the content
// only — the card surface, its focus ring, its selection checkbox and its
// "Move to…" menu all belong to WorkspaceCard.
export function CustomerProfileCard({ item }: { item: CustomerProfileItem }) {
  const { lang } = useI18n();
  const ProfileIcon = item.profileType === "CORPORATE" ? Building2 : UserRound;
  const sourceName = localizedValue(item.acquisitionSourceNameAr, item.acquisitionSourceNameEn, lang);

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <ProfileIcon className="size-4 shrink-0 text-brand-600 dark:text-brand-400" aria-hidden="true" />
        <span className="truncate text-sm font-medium text-foreground">{item.displayName}</span>
      </div>
      {sourceName && <p className="truncate text-xs text-muted-foreground">{sourceName}</p>}
      {item.ownerUserId && <p className="truncate font-mono text-2xs text-muted-foreground">{item.ownerUserId}</p>}
      <StatusBadge value={item.status} kind="CustomerStatus" />
    </div>
  );
}
