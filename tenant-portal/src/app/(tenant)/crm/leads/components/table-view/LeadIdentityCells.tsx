"use client";

import Link from "next/link";
import { Badge, cn, focusRing } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { leadCardHeading } from "../../lead-card-contract";
import type { LeadItem } from "../../hooks/useLeads";

const COMPACT_BADGE = "shrink-0 px-1 py-0 text-xs font-medium leading-none normal-case tracking-normal";
const LINK_CLASS = "flex min-w-48 items-center gap-1.5 whitespace-nowrap rounded-xs hover:underline";

/** The lead (or its company) and its profile type, linking to the lead page. */
export function LeadNameCell({ lead }: { lead: LeadItem }) {
  const { t } = useI18n();
  return (
    <Link href={`/crm/leads/${lead.id}`} className={cn(LINK_CLASS, "text-foreground", focusRing)}>
      <span className="min-w-0 truncate font-medium">{leadCardHeading(lead).title}</span>
      <Badge tone="neutral" className={COMPACT_BADGE}>
        {t.crmLeads.create.types[lead.leadProfileType]}
      </Badge>
    </Link>
  );
}

/**
 * A company lead's primary contact with their position; an individual lead is
 * its own contact, so it shows the lead's email.
 */
export function LeadContactCell({ lead }: { lead: LeadItem }) {
  const { t } = useI18n();
  const contact = (lead.leadProfileType === "CORPORATE" && lead.primaryContact) || null;
  const name = contact?.displayName || lead.email || t.crmLeads.unavailable;
  const detail = contact?.jobTitle || contact?.email || "";

  return (
    <Link
      href={`/crm/leads/${lead.id}`}
      className={cn(LINK_CLASS, focusRing)}
      title={[name, detail].filter(Boolean).join(" · ")}
    >
      <span className="max-w-36 truncate">{name}</span>
      {detail && <span className="max-w-28 truncate text-muted-foreground">{detail}</span>}
      {contact?.isPrimary && (
        <Badge tone="neutral" className={COMPACT_BADGE}>
          {t.crmLeads.card.primary}
        </Badge>
      )}
    </Link>
  );
}
