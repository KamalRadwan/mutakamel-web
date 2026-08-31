"use client";

import { CopyButton, DateTime, DetailSection } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import type { CustomerProfileDetail } from "../../customer-profile-contract";

/**
 * The customer profile's own facts.
 *
 * There is deliberately **no contacts list**: `GET /customer-profiles/:id`
 * returns `CustomerProfileReadModel`, which joins the party summary and the
 * acquisition source and nothing from `party_relationships`. Rendering a
 * contacts card here would mean either inventing the data or calling a route
 * that does not exist, so the screen adds contacts without claiming to show
 * them. Recorded as Q41 in docs/build/OPEN-QUESTIONS.md.
 */
export function CustomerProfileFacts({
  profile,
}: {
  profile: CustomerProfileDetail;
}) {
  const { t } = useI18n();
  const isCorporate = profile.profileType === "CORPORATE";

  return (
    <>
      <DetailSection
        title={t.crmLeadDetail.identityTitle}
        emptyValueLabel={t.detail.notRecorded}
        fields={[
          { label: t.crmCustomerProfiles.name, value: profile.displayName },
          ...(isCorporate
            ? [
                {
                  label: t.crmCustomerProfiles.company,
                  value: profile.companyName,
                },
                {
                  label: t.crmCustomerProfileActions.legalName,
                  value: profile.legalName,
                },
                {
                  label: t.crmCustomerProfileActions.taxNumber,
                  value: profile.taxNumber,
                },
                {
                  label: t.crmCustomerProfileActions.commercialRegistration,
                  value: profile.commercialRegistrationNumber,
                },
              ]
            : []),
          {
            label: t.crmCustomerProfiles.type,
            value: t.crmCustomerProfiles.profileTypes[profile.profileType],
          },
        ]}
      />

      <DetailSection
        title={t.crmCustomerProfiles.contact}
        emptyValueLabel={t.detail.notRecorded}
        fields={[
          {
            label: t.crmCustomerProfiles.email,
            value: profile.email ? (
              <span dir="ltr">{profile.email}</span>
            ) : null,
          },
          {
            label: t.crmCustomerProfiles.phone,
            value: profile.primaryMobile ? (
              <span dir="ltr">{profile.primaryMobile}</span>
            ) : null,
          },
          ...(isCorporate
            ? [
                {
                  label: t.crmLeadDetail.companyEmail,
                  value: profile.companyEmail ? (
                    <span dir="ltr">{profile.companyEmail}</span>
                  ) : null,
                },
                {
                  label: t.crmLeadDetail.companyPhone,
                  value: profile.companyPhone ? (
                    <span dir="ltr">{profile.companyPhone}</span>
                  ) : null,
                },
                {
                  label: t.crmLeadDetail.companyWebsite,
                  value: profile.companyWebsite ? (
                    <span dir="ltr">{profile.companyWebsite}</span>
                  ) : null,
                },
              ]
            : []),
          {
            label: t.crmLeadDetail.otherPhones,
            wide: true,
            value:
              profile.phones.length > 0 ? (
                <span dir="ltr">{profile.phones.join(" · ")}</span>
              ) : null,
          },
        ]}
      />

      <DetailSection
        title={t.crmLeadDetail.recordTitle}
        emptyValueLabel={t.detail.notRecorded}
        fields={[
          {
            label: t.crmCustomerProfiles.profileId,
            value: (
              <span className="flex items-center gap-1">
                <span className="break-all font-mono text-xs" dir="ltr">
                  {profile.id}
                </span>
                <CopyButton
                  value={profile.id}
                  copyLabel={t.crmShared.copyId}
                  copiedLabel={t.crmShared.copied}
                  failedLabel={t.crmShared.copyFailed}
                />
              </span>
            ),
          },
          {
            label: t.crmLeadDetail.createdAt,
            value: <DateTime value={profile.createdAt} precision="datetime" />,
          },
          {
            label: t.crmLeadDetail.updatedAt,
            value: <DateTime value={profile.updatedAt} precision="datetime" />,
          },
          {
            label: t.crmLeadDetail.description,
            wide: true,
            value: profile.description,
          },
        ]}
      />
    </>
  );
}
