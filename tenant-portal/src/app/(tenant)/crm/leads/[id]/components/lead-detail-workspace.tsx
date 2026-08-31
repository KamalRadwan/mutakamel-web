"use client";

import {
  Button,
  DegradedBanner,
  DetailHeader,
  DetailSection,
  ErrorState,
  NotFoundState,
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
import { useLeadCapabilities } from "../../hooks/useLeadCapabilities";
import { useLeadDetail } from "../hooks/useLeadDetail";
import { useLeadEdit } from "../hooks/useLeadEdit";
import { useLeadConvert } from "../hooks/useLeadConvert";
import { LeadConvertDrawer } from "./LeadConvertDrawer";
import { LeadEditDrawer } from "./LeadEditDrawer";
import { LeadIdentityCards } from "./LeadIdentityCards";
import { useCrmAcquisitionSources } from "../../../shared/hooks/useCrmAcquisitionSources";

const NO_SOURCE_VALUE = "__none__";

/**
 * `/crm/leads/[id]` — MASTER-PLAN 8.1, docs/design/detail-screens.md.
 *
 * One scroll, two columns, no tabs: a rep opening a lead is looking for a phone
 * number, a stage and a next step, and tabs hide two of those behind a click.
 *
 * Every action is gated by the `capabilities` response, never by a permission
 * string (defect D11 / 8.5) — `crm.leads.update.own` says nothing about whether
 * *this* lead is one of the actor's own, and the capability's `ownerUserIds`
 * boundary does.
 */
export function LeadDetailWorkspace({ leadId }: { leadId: string }) {
  const { t, lang } = useI18n();
  const describeError = useCrmErrorText();
  const detail = useLeadDetail(leadId);
  const lead = detail.lead;
  const { capabilities, error: capabilitiesError } = useLeadCapabilities(
    lead?.branchId ?? null,
  );
  const sources = useCrmAcquisitionSources();
  const { canMutate } = useAccessMode();

  const edit = useLeadEdit(lead, detail.setLead);
  const convert = useLeadConvert(lead, detail.reload);

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
        title={t.crmLeadDetail.notFoundTitle}
        description={t.crmLeadDetail.notFoundDescription}
        backLabel={t.crmLeadDetail.backToLeads}
        backHref="/crm/leads"
      />
    );
  }

  if (detail.isForbidden) return <CrmScopeGate />;

  if (detail.error || !lead) {
    return (
      <ErrorState
        title={t.crmLeadDetail.loadFailed}
        description={describeError(detail.error) ?? undefined}
        onRetry={detail.reload}
        retryLabel={t.common.retry}
      />
    );
  }

  const stage = detail.stages.find(({ id }) => id === lead.stageId) ?? null;
  const canUpdate =
    canMutate && crmCapabilityAllowsOwner(capabilities.update, lead.ownerUserId);
  // Offering an action that always fails is worse than not offering it: the
  // backend answers 409 LEAD_ALREADY_CONVERTED on a converted lead.
  const canConvert =
    canMutate &&
    lead.status !== "CONVERTED" &&
    crmCapabilityAllowsOwner(capabilities.convert, lead.ownerUserId);

  return (
    <div className="flex flex-col gap-4">
      <DetailHeader
        title={lead.displayName}
        subtitle={[
          t.crmCustomerProfiles.profileTypes[lead.leadProfileType],
          localizedValue(
            lead.acquisitionSourceNameAr,
            lead.acquisitionSourceNameEn,
            lang,
          ),
        ]
          .filter((part) => part.length > 0)
          .join(" · ")}
        status={<StatusBadge value={lead.status} kind="LeadStatus" />}
        backLabel={t.crmLeadDetail.backToLeads}
        backHref="/crm/leads"
        primaryAction={
          canConvert
            ? { label: t.crmLeadConvert.action, onClick: convert.openDrawer }
            : undefined
        }
        secondaryActions={
          canUpdate ? (
            <Button variant="outline" onClick={edit.openDrawer}>
              {t.crmLeadDetail.edit}
            </Button>
          ) : undefined
        }
      />

      {detail.stagesDegraded && (
        <DegradedBanner message={t.crmLeads.stagesUnavailable} />
      )}
      {capabilitiesError && (
        <DegradedBanner message={t.crmLeads.capabilitiesUnavailable} />
      )}
      {sources.degraded && (
        <DegradedBanner message={t.crmLeadDetail.sourcesUnavailable} />
      )}

      <div className="grid gap-3 lg:grid-cols-[1fr_320px]">
        <div className="order-2 flex min-w-0 flex-col gap-3 lg:order-1">
          <LeadIdentityCards lead={lead} />
          <RecordNotesSection
            branchId={lead.branchId}
            sourceType="LEAD"
            sourceId={lead.id}
            sourceOwnerUserId={lead.ownerUserId}
            createCapability={capabilities.notesCreate}
            deleteCapability={capabilities.notesDelete}
            readOnly={!canMutate}
          />
          <RecordAttachmentsSection
            branchId={lead.branchId}
            sourceType="LEAD"
            sourceId={lead.id}
            sourceOwnerUserId={lead.ownerUserId}
            createCapability={capabilities.attachmentsCreate}
            deleteCapability={capabilities.attachmentsDelete}
            readOnly={!canMutate}
          />
        </div>

        {/* Below lg the rail stacks ABOVE the main column: ownership and stage
            are what a phone user checks first — detail-screens.md#layout. */}
        <div className="order-1 flex flex-col gap-3 lg:order-2">
          <DetailSection
            title={t.crmLeadDetail.stageTitle}
            columns={1}
            emptyValueLabel={t.detail.notRecorded}
            fields={[
              {
                label: t.crmLeads.stage,
                value: stage
                  ? localizedValue(stage.nameAr, stage.nameEn, lang)
                  : null,
              },
              {
                label: t.crmLeadDetail.stageFlag,
                value: (
                  <StatusBadge value={lead.stageFlag} kind="LeadStageFlag" />
                ),
              },
              {
                label: t.common.status,
                value: <StatusBadge value={lead.status} kind="LeadStatus" />,
              },
            ]}
          />
          <DetailSection
            title={t.crmLeadDetail.ownershipTitle}
            columns={1}
            emptyValueLabel={t.detail.notRecorded}
            fields={[
              { label: t.crmOpportunities.owner, value: lead.ownerUserId },
              { label: t.crmLeadDetail.createdBy, value: lead.createdByUserId },
              { label: t.crmCustomerProfiles.branch, value: lead.branchId },
            ]}
          />
          <CustomFieldsCard
            branchId={lead.branchId}
            ownerType="LEAD"
            ownerId={lead.id}
          />
        </div>
      </div>

      <LeadEditDrawer
        edit={edit}
        sources={sources.items}
        noSourceValue={NO_SOURCE_VALUE}
      />
      <LeadConvertDrawer convert={convert} />
    </div>
  );
}
