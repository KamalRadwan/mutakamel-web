"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Button,
  ConfirmActionModal,
  DegradedBanner,
  DetailHeader,
  ErrorState,
  NotFoundState,
  PageActions,
  Skeleton,
  StageBar,
  StatusBadge,
} from "@/design-system";
import { useAccessMode } from "@/hooks/useAccessMode";
import { useI18n } from "@/i18n/I18nContext";
import { localizedValue } from "@/lib/format/localized";
import { formatTemplate } from "@/lib/format/template";
import { CrmScopeGate } from "../../../shared/components/CrmScopeGate";
import { CustomFieldsCard } from "../../../shared/components/CustomFieldsCard";
import { crmCapabilityAllowsOwner } from "../../../shared/crm-capabilities";
import { useCrmErrorText } from "../../../shared/hooks/useCrmErrorText";
import { useCrmRecordCapabilities } from "../../../shared/hooks/useCrmRecordCapabilities";
import { useCrmAcquisitionSources } from "../../../shared/hooks/useCrmAcquisitionSources";
import {
  BLACKLISTED_STATUS,
  CUSTOMER_STATUSES,
} from "../../customer-profile-contract";
import { useCustomerProfilesCapabilities } from "../../hooks/useCustomerProfilesCapabilities";
import type { CustomerProfileStatus } from "../../hooks/useCustomerProfiles";
import { useCustomerProfileActions } from "../hooks/useCustomerProfileActions";
import { useCustomerProfileDetail } from "../hooks/useCustomerProfileDetail";
import { CustomerProfileActionDialogs } from "./CustomerProfileActionDialogs";
import { CustomerCompanyCard } from "./CustomerCompanyCard";
import { CustomerContactsCard } from "./CustomerContactsCard";
import { CustomerProfileIdentityCard } from "./CustomerProfileIdentityCard";
import { CustomerProfileRelatedNav } from "./CustomerProfileRelatedNav";
import { CustomerProfileDetailSidePanel } from "./CustomerProfileDetailSidePanel";

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
  const capabilities = useCustomerProfilesCapabilities(
    profile?.branchId ?? null,
  );
  const attached = useCrmRecordCapabilities(profile?.branchId ?? null);
  const sources = useCrmAcquisitionSources();
  const { canMutate } = useAccessMode();

  const actions = useCustomerProfileActions(
    profile,
    detail.setProfile,
    () => router.push("/crm/customer-profiles"),
    detail.reload,
  );

  const [pendingStatus, setPendingStatus] =
    useState<CustomerProfileStatus | null>(null);

  if (detail.isLoading) {
    return (
      <div className="flex flex-col gap-2">
        <Skeleton className="h-12 rounded-md" />
        <div className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_320px]">
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
    crmCapabilityAllowsOwner(
      capabilities.capabilities.update,
      profile.ownerUserId,
    );
  const canDelete =
    canMutate &&
    crmCapabilityAllowsOwner(
      capabilities.capabilities.delete,
      profile.ownerUserId,
    );

  function handleStageChange(nextStatus: CustomerProfileStatus) {
    if (nextStatus === profile?.status) return;
    if (nextStatus === BLACKLISTED_STATUS) {
      actions.requestStatus(BLACKLISTED_STATUS);
    } else {
      setPendingStatus(nextStatus);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {/* Action bar related items: Opportunities, Quotations, Sales Orders, Invoices */}
      <PageActions slot="related">
        <CustomerProfileRelatedNav
          customerProfileId={profile.id}
          partyId={profile.partyId}
          branchId={profile.branchId}
        />
      </PageActions>

      {/* Action bar actions: Edit & Delete buttons */}
      <PageActions slot="actions">
        <div className="flex items-center gap-1.5">
          {canUpdate && (
            <Button size="sm" variant="outline" onClick={actions.openEdit}>
              {t.crmLeadDetail.edit}
            </Button>
          )}
          {canDelete && (
            <Button
              size="sm"
              variant="ghost"
              className="text-destructive hover:bg-destructive/10"
              onClick={actions.requestDelete}
            >
              {t.common.delete}
            </Button>
          )}
        </div>
      </PageActions>

      {/* Screen-reader heading outline and back link mirroring Leads */}
      <DetailHeader
        className="sr-only"
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
      />

      {/* Customer Status Pipeline StageBar */}
      <StageBar
        label={t.crmCustomerProfileActions.changeStatus}
        steps={CUSTOMER_STATUSES.map((status) => ({
          id: status,
          label: t.statusValues[`CustomerStatus.${status}`] ?? status,
          tone:
            status === "ACTIVE_CUSTOMER"
              ? "positive"
              : status === "BLACKLISTED"
                ? "negative"
                : undefined,
        }))}
        value={profile.status}
        onChange={
          canUpdate && actions.busy !== "status"
            ? (next) => next && handleStageChange(next as CustomerProfileStatus)
            : undefined
        }
        disabled={actions.busy === "status"}
      />

      {/* Status move confirmation modal */}
      <ConfirmActionModal
        open={pendingStatus !== null}
        onOpenChange={(open) => {
          if (!open) setPendingStatus(null);
        }}
        title={t.crmCustomerProfileActions.changeStatus}
        description={formatTemplate(t.crmLeadDetail.moveStageDescription, {
          from:
            t.statusValues[`CustomerStatus.${profile.status}`] ??
            profile.status,
          to: pendingStatus
            ? (t.statusValues[`CustomerStatus.${pendingStatus}`] ??
              pendingStatus)
            : "",
        })}
        confirmLabel={t.filters.yes}
        cancelLabel={t.common.cancel}
        loading={actions.busy === "status"}
        onConfirm={() => {
          const target = pendingStatus;
          setPendingStatus(null);
          if (target) void actions.submitStatus(target);
        }}
      />

      {/* Degraded Banners */}
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

      {/* 2-column responsive layout matching Leads */}
      <div className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="order-2 flex min-w-0 flex-col gap-2 lg:order-1">
          {isCorporate && (
            <CustomerCompanyCard
              profile={profile}
              onEdit={canUpdate ? actions.openEdit : undefined}
              readOnly={!canUpdate}
            />
          )}

          <CustomerContactsCard
            profile={profile}
            canEdit={canUpdate}
            onAddContact={
              isCorporate && canUpdate ? actions.openContact : undefined
            }
          />

          <CustomerProfileIdentityCard
            profile={profile}
            sources={sources.items}
          />

          <CustomFieldsCard
            density="compact"
            branchId={profile.branchId}
            ownerType="CUSTOMER_PROFILE"
            ownerId={profile.id}
          />
        </div>

        <div className="order-3 min-w-0">
          <CustomerProfileDetailSidePanel
            profile={profile}
            attached={attached}
            readOnly={!canMutate}
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
