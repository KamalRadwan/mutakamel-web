"use client";

import Link from "next/link";
import { Button } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import type { LeadConvertState } from "./LeadConvertModal";

export function ConversionOutcome({ convert }: { convert: LeadConvertState }) {
  const { t } = useI18n();
  const { result, ambiguous, appliedUnreadable } = convert;
  if (result) return <section role="status" className="flex flex-col gap-2 rounded-sm border border-border bg-success-subtle p-2">
    <h3 className="text-sm font-semibold">{t.crmLeadConvert.successTitle}</h3>
    <p className="text-xs">{t.crmLeadConvert.successDescription}</p>
    <div className="flex flex-wrap gap-2">
      <Button size="sm" asChild><Link href={"/crm/customer-profiles/" + result.customerProfileId}>{t.crmLeadConvert.viewCustomer}</Link></Button>
      {result.opportunityId && <Button size="sm" asChild><Link href={"/crm/opportunities/" + result.opportunityId}>{t.crmLeadConvert.viewOpportunity}</Link></Button>}
      <Button size="sm" variant="ghost" asChild><Link href="/crm/leads">{t.crmLeadConvert.backToLeads}</Link></Button>
    </div>
  </section>;
  if (!ambiguous && !appliedUnreadable) return null;
  return <section role="status" className="flex min-w-0 flex-col gap-2 rounded-sm border border-border bg-warning-subtle p-2">
    <p className="text-xs">{ambiguous ? t.crmLeadConvert.ambiguousDescription : t.crmShared.appliedUnreadableDescription}</p>
    <p className="wrap-anywhere text-xs">{t.crmLeadConvert.requestKey}: <bdi>{convert.attempt?.idempotencyKey}</bdi></p>
    {(ambiguous ?? appliedUnreadable)?.correlationId && <p className="wrap-anywhere text-xs">{t.crmLeadConvert.correlationId}: <bdi>{(ambiguous ?? appliedUnreadable)?.correlationId}</bdi></p>}
    <div className="flex flex-wrap gap-2">
      {ambiguous && <Button size="sm" loading={convert.isSubmitting} disabled={!convert.canConvert}
        onClick={() => void convert.retry()}>{t.common.retry}</Button>}
      <Button size="sm" disabled={convert.isSubmitting} onClick={convert.reconcile}>{t.crmLeadConvert.reloadLead}</Button>
    </div>
  </section>;
}
