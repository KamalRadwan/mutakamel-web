"use client";

import { useRouter } from "next/navigation";
import {
  Button,
  DegradedBanner,
  DetailHeader,
  DetailSection,
  ErrorState,
  NotFoundState,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
  StatusBadge,
} from "@/design-system";
import { useAccessMode } from "@/hooks/useAccessMode";
import { useI18n } from "@/i18n/I18nContext";
import { localizedValue } from "@/lib/format/localized";
import { CrmScopeGate } from "../../../shared/components/CrmScopeGate";
import { CustomFieldsCard } from "../../../shared/components/CustomFieldsCard";
import { RecordAttachmentsSection } from "../../../shared/components/RecordAttachmentsSection";
import { RecordNotesSection } from "../../../shared/components/RecordNotesSection";
import { crmCapabilityAllowsOwner } from "../../../shared/crm-capabilities";
import { useCrmErrorText } from "../../../shared/hooks/useCrmErrorText";
import { useCrmRecordCapabilities } from "../../../shared/hooks/useCrmRecordCapabilities";
import { useCrmAcquisitionSources } from "../../../shared/hooks/useCrmAcquisitionSources";
import { BLACKLISTED_STATUS, CUSTOMER_STATUSES } from "../../customer-profile-contract";
import { useCustomerProfilesCapabilities } from "../../hooks/useCustomerProfilesCapabilities";
import type { CustomerProfileStatus } from "../../hooks/useCustomerProfiles";
import { useCustomerProfileActions } from "../hooks/useCustomerProfileActions";
import { useCustomerProfileDetail } from "../hooks/useCustomerProfileDetail";
import { CustomerProfileActionDialogs } from "./CustomerProfileActionDialogs";
import { CustomerProfileFacts } from "./CustomerProfileFacts";

/**
 * `/crm/customer-profiles/[id]` — MASTER-PLAN 8.7-8.9, resolving Q12.
 *
 * The action cluster follows docs/design/detail-screens.md exactly: **Add
 * contact** is the one filled primary and only on a `CORPORATE` profile, since
 * `addContact` refuses an individual with
 * `422 CUSTOMER_PROFILE_CONTACTS_CORPORATE_ONLY`. An `INDIVIDUAL` profile
 * therefore has **no** primary action — the one-primary rule is a ceiling, not
 * a quota, so Edit is not promoted to fill the slot.
 */
export function CustomerProfileDetailWorkspace({
  profileId,
}: {
  profileId: string;
}) {
  const { t, lang } = useI18n();
  const router = useRouter();
  const describeError = useCrmErrorText();
  const detail = useCustomerProfileDetail(profileId);
  const profile = detail.profile;
  const capabilities = useCustomerProfilesCapabilities(profile?.branchId ?? null);
  const attached = useCrmRecordCapabilities(profile?.branchId ?? null);
  const sources = useCrmAcquisitionSources();
  const { canMutate } = useAccessMode();

  const actions = useCustomerProfileActions(
    profile,
    detail.setProfile,
    () => router.push("/crm/customer-profiles"),
    // The D2 reconciliation: when a write applies and its body cannot be read,
    // the record is re-read from the server rather than patched from a response
    // nothing could parse.
    detail.reload,
  );

  if (detail.isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-12 rounded-md" />
        <div className="grid gap-3 lg:grid-cols-[1fr_320px]">
          <Skeleton className="h-72 rounded-md" />
          <Skeleton className="h-72 rounded-md" />
        </div>
      </div>
    );
  }

  if (detail.isNotFound) {
    return (
      <NotFoundState
        title={t.crmCustomerProfileActions.notFoundTitle}
        description={t.crmCustomerProfileActions.notFoundDescription}
        backLabel={t.crmCustomerProfiles.back}
        backHref="/crm/customer-profiles"
      />
    );
  }

  if (detail.isForbidden) return <CrmScopeGate />;

  if (detail.error || !profile) {
    return (
      <ErrorState
        title={t.crmCustomerProfiles.detailTitle}
        description={describeError(detail.error) ?? undefined}
        onRetry={detail.reload}
        retryLabel={t.common.retry}
      />
    );
  }

  const isCorporate = profile.profileType === "CORPORATE";
  const canUpdate =
    canMutate &&
    crmCapabilityAllowsOwner(capabilities.capabilities.update, profile.ownerUserId);
  const canDelete =
    canMutate &&
    crmCapabilityAllowsOwner(capabilities.capabilities.delete, profile.ownerUserId);

  function changeStatus(next: CustomerProfileStatus) {
    actions.requestStatus(next);
    // Only BLACKLISTED confirms: it is terminal in practice and blocks new
    // opportunities on this customer. Everything else applies straight away.
    if (next !== BLACKLISTED_STATUS) void actions.submitStatus(next);
  }

  return (
    <div className="flex flex-col gap-4">
      <DetailHeader
        title={profile.displayName}
        subtitle={[
          t.crmCustomerProfiles.profileTypes[profile.profileType],
          localizedValue(
            profile.acquisitionSourceNameAr,
            profile.acquisitionSourceNameEn,
            lang,
          ),
        ]
          .filter((part) => part.length > 0)
          .join(" · ")}
        status={<StatusBadge value={profile.status} kind="CustomerStatus" />}
        backLabel={t.crmCustomerProfiles.back}
        backHref="/crm/customer-profiles"
        primaryAction={
          canUpdate && isCorporate
            ? {
                label: t.crmCustomerProfileActions.addContact,
                onClick: actions.openContact,
              }
            : undefined
        }
        secondaryActions={
          <>
            {canUpdate && (
              <Button variant="outline" onClick={actions.openEdit}>
                {t.crmLeadDetail.edit}
              </Button>
            )}
            {canUpdate && (
              <Select
                value={profile.status}
                onValueChange={(value) =>
                  changeStatus(value as CustomerProfileStatus)
                }
                disabled={actions.busy === "status"}
              >
                <SelectTrigger
                  className="w-40"
                  aria-label={t.crmCustomerProfileActions.changeStatus}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CUSTOMER_STATUSES.map((status) => (
                    <SelectItem key={status} value={status}>
                      {t.statusValues[`CustomerStatus.${status}`] ?? status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {canDelete && (
              <Button
                variant="ghost"
                className="text-destructive"
                onClick={actions.requestDelete}
              >
                {t.common.delete}
              </Button>
            )}
          </>
        }
      />

      {capabilities.error && (
        <DegradedBanner
          message={t.crmCustomerProfileActions.capabilitiesUnavailable}
        />
      )}
      {attached.error && (
        <DegradedBanner message={t.crmOpportunityDetail.attachedUnavailable} />
      )}
      {sources.degraded && (
        <DegradedBanner message={t.crmLeadDetail.sourcesUnavailable} />
      )}
      {actions.error && (
        <DegradedBanner message={describeError(actions.error) ?? ""} />
      )}

      <div className="grid gap-3 lg:grid-cols-[1fr_320px]">
        <div className="order-2 flex min-w-0 flex-col gap-3 lg:order-1">
          <CustomerProfileFacts profile={profile} />
          <RecordNotesSection
            branchId={profile.branchId}
            sourceType="CUSTOMER_PROFILE"
            sourceId={profile.id}
            sourceOwnerUserId={profile.ownerUserId}
            createCapability={attached.capabilities.notesCreate}
            deleteCapability={attached.capabilities.notesDelete}
            readOnly={!canMutate}
          />
          <RecordAttachmentsSection
            branchId={profile.branchId}
            sourceType="CUSTOMER_PROFILE"
            sourceId={profile.id}
            sourceOwnerUserId={profile.ownerUserId}
            createCapability={attached.capabilities.attachmentsCreate}
            deleteCapability={attached.capabilities.attachmentsDelete}
            readOnly={!canMutate}
          />
        </div>

        <div className="order-1 flex flex-col gap-3 lg:order-2">
          <DetailSection
            title={t.crmLeadDetail.ownershipTitle}
            columns={1}
            emptyValueLabel={t.detail.notRecorded}
            fields={[
              { label: t.crmOpportunities.owner, value: profile.ownerUserId },
              { label: t.crmCustomerProfiles.branch, value: profile.branchId },
              {
                label: t.crmCustomerProfileActions.sourceLead,
                value: profile.sourceLeadId,
              },
            ]}
          />
          <CustomFieldsCard
            branchId={profile.branchId}
            ownerType="CUSTOMER_PROFILE"
            ownerId={profile.id}
          />
        </div>
      </div>

      <CustomerProfileActionDialogs
        actions={actions}
        sources={sources.items}
        displayName={profile.displayName}
      />
    </div>
  );
}
