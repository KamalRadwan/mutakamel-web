"use client";

import { Building2, MapPin, Phone, UserRound } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import type { OpportunityCardItem } from "../hooks/useOpportunityCards";
import { OpportunityImportanceStars } from "./OpportunityImportanceStars";

export function OpportunityCardTile({ item }: { item: OpportunityCardItem }) {
  const { t } = useI18n();
  const ProfileIcon = item.customerProfileType === "CORPORATE" ? Building2 : UserRound;
  const location = [item.customerCity, item.customerCountry].filter(Boolean).join(", ");

  return (
    <div className="flex flex-col gap-1.5">
      <p className="truncate text-sm font-medium text-foreground">{item.title}</p>
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <ProfileIcon className="size-3.5 shrink-0" aria-hidden="true" />
        <span className="truncate">{item.customerDisplayName}</span>
      </div>
      {item.customerPhone && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground" dir="ltr">
          <Phone className="size-3.5 shrink-0" aria-hidden="true" />
          <span className="truncate">{item.customerPhone}</span>
        </div>
      )}
      {location && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <MapPin className="size-3.5 shrink-0" aria-hidden="true" />
          <span className="truncate">{location}</span>
        </div>
      )}
      <div className="flex items-center justify-between gap-2 pt-1.5">
        <div className="flex min-w-0 items-center gap-1.5">
          <Avatar className="size-5">
            {item.ownerAvatarUrl && <AvatarImage src={item.ownerAvatarUrl} alt="" />}
            <AvatarFallback className="text-2xs">{item.ownerDisplayName?.charAt(0) ?? "?"}</AvatarFallback>
          </Avatar>
          <span className="truncate text-2xs text-muted-foreground">{item.ownerDisplayName ?? t.crmOpportunities.notProvided}</span>
        </div>
        <OpportunityImportanceStars importance={item.importance} label={t.crmOpportunities.importance} />
      </div>
      {item.openActivityCount > 0 && (
        <p className="text-2xs text-muted-foreground">{t.crmOpportunities.openActivities(item.openActivityCount)}</p>
      )}
    </div>
  );
}
