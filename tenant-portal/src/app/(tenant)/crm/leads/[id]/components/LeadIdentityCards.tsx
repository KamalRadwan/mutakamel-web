"use client";

import { CopyButton, DateTime, DetailSection } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import type { LeadDetail } from "../../lead-contract";

/**
 * The main column of the lead detail screen: identity, contact, interest.
 *
 * A field with no value keeps its label and renders "not recorded" —
 * `DetailSection` does that on its own, and hiding the row would leave the
 * reader unable to tell "nobody captured this" from "this lead has no such
 * field".
 *
 * The contact card is `dir="ltr"`: phone numbers and email addresses are
 * left-to-right sequences whose punctuation reorders visibly under RTL
 * bidi resolution.
 */
export function LeadIdentityCards({ lead }: { lead: LeadDetail }) {
  const { t } = useI18n();
  const isCorporate = lead.leadProfileType === "CORPORATE";

  return (
    <>
      <DetailSection
        title={t.crmLeadDetail.identityTitle}
        emptyValueLabel={t.detail.notRecorded}
        fields={[
          { label: t.crmLeads.name, value: lead.displayName },
          { label: t.crmLeadDetail.firstName, value: lead.firstName },
          { label: t.crmLeadDetail.lastName, value: lead.lastName },
          { label: t.crmLeadDetail.honorificTitle, value: lead.honorificTitle },
          ...(isCorporate
            ? [{ label: t.crmLeads.companyName, value: lead.companyName }]
            : []),
          {
            label: t.crmCustomerProfiles.type,
            value: t.crmCustomerProfiles.profileTypes[lead.leadProfileType],
          },
        ]}
      />

      <DetailSection
        title={t.crmLeads.contact}
        emptyValueLabel={t.detail.notRecorded}
        fields={[
          {
            label: t.crmLeads.phone,
            value: lead.primaryMobile ? (
              <span dir="ltr">{lead.primaryMobile}</span>
            ) : null,
          },
          {
            label: t.crmLeads.email,
            value: lead.email ? <span dir="ltr">{lead.email}</span> : null,
          },
          ...(isCorporate
            ? [
                {
                  label: t.crmLeadDetail.companyPhone,
                  value: lead.companyPhone ? (
                    <span dir="ltr">{lead.companyPhone}</span>
                  ) : null,
                },
                {
                  label: t.crmLeadDetail.companyEmail,
                  value: lead.companyEmail ? (
                    <span dir="ltr">{lead.companyEmail}</span>
                  ) : null,
                },
                {
                  label: t.crmLeadDetail.companyWebsite,
                  value: lead.companyWebsite ? (
                    <span dir="ltr">{lead.companyWebsite}</span>
                  ) : null,
                },
              ]
            : []),
          {
            label: t.crmLeadDetail.otherPhones,
            wide: true,
            value:
              lead.phones.length > 0 ? (
                <span dir="ltr">{lead.phones.join(" · ")}</span>
              ) : null,
          },
        ]}
      />

      <DetailSection
        title={t.crmLeadDetail.interestTitle}
        columns={1}
        emptyValueLabel={t.detail.notRecorded}
        fields={[
          { label: t.crmLeadDetail.interestSummary, value: lead.interestSummary, wide: true },
          { label: t.crmLeadDetail.expectedNeed, value: lead.expectedNeed, wide: true },
          { label: t.crmLeadDetail.description, value: lead.description, wide: true },
        ]}
      />

      <DetailSection
        title={t.crmLeadDetail.recordTitle}
        emptyValueLabel={t.detail.notRecorded}
        fields={[
          {
            label: t.crmLeadDetail.leadId,
            value: (
              <span className="flex items-center gap-1">
                <span className="break-all font-mono text-xs" dir="ltr">
                  {lead.id}
                </span>
                <CopyButton
                  value={lead.id}
                  copyLabel={t.crmShared.copyId}
                  copiedLabel={t.crmShared.copied}
                  failedLabel={t.crmShared.copyFailed}
                />
              </span>
            ),
          },
          {
            label: t.crmLeadDetail.createdAt,
            value: <DateTime value={lead.createdAt} precision="datetime" />,
          },
          {
            label: t.crmLeadDetail.updatedAt,
            value: <DateTime value={lead.updatedAt} precision="datetime" />,
          },
          {
            label: t.crmLeadDetail.convertedAt,
            value: lead.convertedAt ? (
              <DateTime value={lead.convertedAt} precision="datetime" />
            ) : null,
          },
        ]}
      />
    </>
  );
}
