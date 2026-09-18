"use client";

import {
  Banknote,
  Building2,
  Calendar,
  CirclePercent,
  Tag,
  UserRound,
} from "lucide-react";
import { Badge, DateTime, Money, cn, iconSize } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatNumber } from "@/lib/format/number";
import { formatTemplate } from "@/lib/format/template";
import type { OpportunityCardRecord } from "../../hooks/pipeline-types";

const COMPACT_BADGE =
  "shrink-0 px-1 py-0 text-xs font-medium leading-none normal-case tracking-normal";
const MAX_VISIBLE_TAGS = 3;

export function OpportunityCard({ item }: { item: OpportunityCardRecord }) {
  const { t, lang } = useI18n();
  const corporate = item.customerProfileType === "CORPORATE";
  const ProfileIcon = corporate ? Building2 : UserRound;
  const customerName =
    (corporate ? item.customerCompanyName : null) ?? item.customerDisplayName;
  const contactName = corporate
    ? item.primaryContact?.displayName ?? item.contactDisplayName
    : null;
  const visibleTags = item.tags.slice(0, MAX_VISIBLE_TAGS);
  const hiddenTagCount = item.tags.length - visibleTags.length;

  return (
    <div className="flex flex-col gap-1">
      <div className="flex min-w-0 items-center gap-1.5">
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
          {item.title}
        </span>
        {item.customerProfileType && (
          <Badge tone="neutral" className={COMPACT_BADGE}>
            {corporate ? t.crmLeads.card.company : t.crmLeads.card.individual}
          </Badge>
        )}
      </div>

      {customerName && (
        <span className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
          <ProfileIcon className={cn(iconSize({ size: "sm" }), "shrink-0")} aria-hidden="true" />
          <span className="truncate">{customerName}</span>
        </span>
      )}
      {contactName && (
        <span className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
          <UserRound className={cn(iconSize({ size: "sm" }), "shrink-0")} aria-hidden="true" />
          <span className="truncate">{contactName}</span>
        </span>
      )}

      {(item.amount || item.probabilityPercent !== null || item.expectedCloseDate) && (
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-2xs text-muted-foreground">
          {item.amount && (
            <span className="inline-flex min-w-0 items-center gap-1">
              <Banknote className="size-3 shrink-0" aria-hidden="true" />
              <Money
                value={item.amount}
                currency={item.currencyCode ?? undefined}
                language={lang}
                className="min-w-0 truncate font-medium text-foreground"
              />
            </span>
          )}
          {item.probabilityPercent !== null && (
            <span className="inline-flex items-center gap-1">
              <CirclePercent className="size-3 shrink-0" aria-hidden="true" />
              {formatNumber(item.probabilityPercent, lang)}%
            </span>
          )}
          {item.expectedCloseDate && (
            <span className="inline-flex items-center gap-1">
              <Calendar className="size-3 shrink-0" aria-hidden="true" />
              <DateTime
                value={`${item.expectedCloseDate.slice(0, 10)}T00:00:00.000Z`}
                precision="date"
                language={lang}
                timeZone="UTC"
              />
            </span>
          )}
        </div>
      )}

      {visibleTags.length > 0 && (
        <div className="flex min-w-0 flex-wrap items-center gap-1 pt-0.5">
          <Tag className={cn(iconSize({ size: "sm" }), "shrink-0 text-muted-foreground")} aria-hidden="true" />
          {visibleTags.map((tag) => (
            <Badge key={tag.id} tone="neutral" className={COMPACT_BADGE}>
              {tag.name}
            </Badge>
          ))}
          {hiddenTagCount > 0 && (
            <span className="text-2xs text-muted-foreground">
              {formatTemplate(t.crmLeads.card.moreTags, { count: hiddenTagCount })}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
