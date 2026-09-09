"use client";

import Link from "next/link";
import { FileText, HandCoins, Receipt, Target } from "lucide-react";
import { Badge, buttonVariantClasses, cn, iconSize } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatTemplate } from "@/lib/format/template";
import {
  LEAD_RELATED_KINDS,
  LEAD_RELATED_ROUTES,
  type LeadRelatedKind,
} from "../lead-related-contract";
import { useLeadRelatedCounts } from "../hooks/useLeadRelatedCounts";

const ICONS: Record<LeadRelatedKind, typeof Target> = {
  // A target for the deal being chased, a page for the offer, coins for the
  // order that took the money, a receipt for the bill. None of them mirrors:
  // they are objects, not directions — docs/design/icons.md.
  opportunities: Target,
  quotations: FileText,
  salesOrders: HandCoins,
  invoices: Receipt,
};

export interface LeadRelatedNavProps {
  leadId: string;
  /** The lead's own party — what a trade document is filed against. */
  partyId: string;
  branchId: string;
}

/**
 * What else exists against this lead, in the middle of the action bar.
 *
 * Four links, each with the number of records behind it: opportunities filed
 * against the lead, and quotations, sales orders and invoices filed against
 * its party. They sit in the bar's `related` slot rather than beside the
 * screen's own actions, because they LEAVE this screen — see
 * docs/design/shell.md#the-middle-is-for-other-records.
 *
 * A count nobody may read is not rendered: each of the four is gated by the
 * read permission of the screen it links to, and a CRM-only user simply sees
 * the opportunities link. All four unpermitted renders nothing at all, which
 * is what keeps the bar's middle empty on every screen that has no related
 * records.
 *
 * A count that could not be READ shows a dash rather than a zero. "No
 * invoices" and "the invoice count did not come back" are different sentences,
 * and the second one printed as `0` is a number a user would act on.
 */
export function LeadRelatedNav({ leadId, partyId, branchId }: LeadRelatedNavProps) {
  const { t } = useI18n();
  const copy = t.crmLeadDetail.related;
  const { counts, permitted, isLoading } = useLeadRelatedCounts(leadId, partyId, branchId);

  const visible = LEAD_RELATED_KINDS.filter((kind) => permitted[kind]);
  if (visible.length === 0) return null;

  return (
    // A group, and named as one: four links in a row with no name between them
    // and the screen's own actions is a list a screen reader cannot summarise.
    <nav aria-label={copy.groupLabel} className="flex items-center gap-1">
      {visible.map((kind) => {
        const Icon = ICONS[kind];
        const count = counts[kind];
        return (
          <Link
            key={kind}
            href={LEAD_RELATED_ROUTES[kind]}
            className={cn(buttonVariantClasses("ghost", "sm"), "gap-1.5")}
            // The label carries the count as a word, because the badge beside
            // the icon is a number with no noun attached to it.
            aria-label={
              count === null
                ? copy.labels[kind]
                : formatTemplate(copy.labelWithCount, { name: copy.labels[kind], count: String(count) })
            }
          >
            <Icon className={iconSize({ size: "sm" })} aria-hidden="true" />
            {/* The name hides on a narrow bar; the icon and the count do not.
                Four labels plus the location text and the screen's actions do
                not fit a 1366px laptop, which is the width this is built for. */}
            <span className="hidden truncate xl:inline">{copy.labels[kind]}</span>
            <Badge tone="neutral" aria-hidden="true">
              {count === null ? (isLoading ? "…" : "—") : String(count)}
            </Badge>
          </Link>
        );
      })}
    </nav>
  );
}
