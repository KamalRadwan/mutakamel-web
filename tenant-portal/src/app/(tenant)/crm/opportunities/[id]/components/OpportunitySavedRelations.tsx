"use client";

import Link from "next/link";
import { Building2, ExternalLink, Mail, Phone, UserRound } from "lucide-react";
import { Field, Input } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import type { OpportunityDetail } from "../../opportunity-contract";
import type { OpportunityForm } from "../../opportunity-write-contract";
import type { useOpportunityFormLookups } from "../../hooks/useOpportunityFormLookups";
import type { CustomerProfileDetail } from "../../../customer-profiles/customer-profile-contract";

export function OpportunitySavedCustomer({ item, profileType }: { item: OpportunityDetail; profileType?: CustomerProfileDetail["profileType"] | null }) {
  const { t } = useI18n();
  const company = item.customerCompanyName?.trim().toLowerCase() !== item.customerDisplayName?.trim().toLowerCase() ? item.customerCompanyName : null;
  const description = [profileType ? t.crmCustomerProfiles.profileTypes[profileType] : null, company, item.customerCity, item.customerCountry].filter(Boolean).join(" · ");
  return <div className="flex flex-col gap-1.5"><span className="text-xs font-medium">{t.crmOpportunities.customer}</span>
    <Link href={`/crm/customer-profiles/${encodeURIComponent(item.customerProfileId)}`} className="flex min-h-12 items-center gap-2 rounded-lg border border-info/20 bg-info-subtle px-2.5 py-1.5">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-gradient-logo text-white"><Building2 className="size-4" aria-hidden="true" /></span>
      <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{item.customerDisplayName ?? t.detail.notRecorded}</p>{description && <p className="truncate text-xs text-muted-foreground">{description}</p>}</div><ExternalLink className="size-3.5 shrink-0" aria-hidden="true" />
    </Link>
  </div>;
}

export function OpportunitySavedLead({ item, lookups }: { item: OpportunityDetail; lookups: ReturnType<typeof useOpportunityFormLookups> }) {
  const { t } = useI18n();
  const lead = lookups.customer.sourceLeads.find(({ id }) => id === item.leadId);
  return <Field showLabel label={t.crmOpportunityDetail.form.sourceLead} readOnly><div className="flex items-center gap-1">
    <Input readOnly value={item.leadId ? lead?.displayName ?? t.nav.leads : t.detail.notRecorded} />
    {item.leadId && <Link href={`/crm/leads/${encodeURIComponent(item.leadId)}`} aria-label={t.nav.leads} className="rounded-md p-1 text-primary"><ExternalLink className="size-4" aria-hidden="true" /></Link>}
  </div></Field>;
}

export function OpportunitySavedPeopleContext({ item, form, lookups, branchLabel }: { item: OpportunityDetail; form: OpportunityForm; lookups: ReturnType<typeof useOpportunityFormLookups>; branchLabel: string | null }) {
  const { t } = useI18n();
  const contact = lookups.customer.contacts.find(({ partyId }) => partyId === form.contactPartyId)
    ?? (item.primaryContact?.partyId === form.contactPartyId ? item.primaryContact : null);
  return <div className="grid gap-2">
    {contact && <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-info-subtle px-2 py-1.5 text-xs">
      <span className="inline-flex items-center gap-1"><UserRound className="size-3.5" aria-hidden="true" />{contact.displayName}{contact.jobTitle ? ` · ${contact.jobTitle}` : ""}</span>
      {contact.phones[0] && <a href={`tel:${contact.phones[0]}`} className="inline-flex items-center gap-1"><Phone className="size-3.5" aria-hidden="true" /><bdi>{contact.phones[0]}</bdi></a>}
      {contact.email && <a href={`mailto:${contact.email}`} className="inline-flex items-center gap-1"><Mail className="size-3.5" aria-hidden="true" /><bdi>{contact.email}</bdi></a>}
    </div>}
    <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground"><span>{t.crmOpportunityDetail.form.branch}: {branchLabel ?? t.detail.notRecorded}</span><span>{t.crmLeads.source}: {item.leadSourceName ?? t.detail.notRecorded}</span></div>
  </div>;
}
