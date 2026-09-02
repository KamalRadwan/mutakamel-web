"use client";

import Link from "next/link";
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
import { localizedName } from "@/lib/format/localized";
import { CrmScopeGate } from "../../../shared/components/CrmScopeGate";
import { CustomFieldsCard } from "../../../shared/components/CustomFieldsCard";
import { RecordAttachmentsSection } from "../../../shared/components/RecordAttachmentsSection";
import { RecordNotesSection } from "../../../shared/components/RecordNotesSection";
import { useCrmErrorText } from "../../../shared/hooks/useCrmErrorText";
import { useCrmRecordCapabilities } from "../../../shared/hooks/useCrmRecordCapabilities";
import { useOpportunityCapabilities } from "../../hooks/useOpportunityCapabilities";
import { opportunityCapabilityAllowsOwner } from "../../hooks/usePipelineWorkspace";
import { useOpportunityDetail } from "../hooks/useOpportunityDetail";
import { useOpportunityEdit } from "../hooks/useOpportunityEdit";
import { usePipelineTransfer } from "../hooks/usePipelineTransfer";
import { OpportunityEditDrawer } from "./OpportunityEditDrawer";
import { OpportunityFacts } from "./OpportunityFacts";
import { OpportunityStageTimeline } from "./OpportunityStageTimeline";
import { PipelineTransferDialog } from "./PipelineTransferDialog";

/**
 * `/crm/opportunities/[id]` — MASTER-PLAN 8.10.
 *
 * Same two-column shape as the lead and customer screens. The stage history
 * lives in the main column because it is what a rep reads to answer "where is
 * this deal and who moved it", and the rail keeps ownership, money and record
 * metadata.
 */
export function OpportunityDetailWorkspace({
  opportunityId,
}: {
  opportunityId: string;
}) {
  const { t, lang } = useI18n();
  const describeError = useCrmErrorText();
  const detail = useOpportunityDetail(opportunityId);
  const item = detail.item;
  const { capabilities, error: capabilitiesError } = useOpportunityCapabilities(
    item?.branchId ?? null,
  );
  const attached = useCrmRecordCapabilities(item?.branchId ?? null);
  const { canMutate } = useAccessMode();

  // The trailing argument on each is the D2 reconciliation: when a write
  // applies and its body cannot be read, the record is re-read from the server
  // rather than patched from a response nothing could parse.
  const edit = useOpportunityEdit(item, detail.setItem, detail.reload);
  const transfer = usePipelineTransfer(
    item,
    detail.pipelines,
    detail.setItem,
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
        title={t.crmOpportunityDetail.notFoundTitle}
        description={t.crmOpportunityDetail.notFoundDescription}
        backLabel={t.crmOpportunityDetail.backToOpportunities}
        backHref="/crm/opportunities"
      />
    );
  }

  if (detail.isForbidden) return <CrmScopeGate />;

  if (detail.error || !item) {
    return (
      <ErrorState
        title={t.crmOpportunities.loadFailed}
        description={describeError(detail.error) ?? undefined}
        onRetry={detail.reload}
        retryLabel={t.common.retry}
      />
    );
  }

  const pipeline =
    detail.pipelines.find(({ id }) => id === item.pipelineId) ?? null;
  const stage =
    pipeline?.stages.find(({ id }) => id === item.stageId) ?? null;
  const canUpdate =
    canMutate &&
    opportunityCapabilityAllowsOwner(capabilities.update, item.ownerUserId);

  return (
    <div className="flex flex-col gap-4">
      <DetailHeader
        title={item.title}
        subtitle={[
          localizedName(pipeline, lang),
          localizedName(stage, lang),
        ]
          .filter((part) => part.length > 0)
          .join(" · ")}
        status={<StatusBadge value={item.status} kind="OpportunityStatus" />}
        backLabel={t.crmOpportunityDetail.backToOpportunities}
        backHref="/crm/opportunities"
        secondaryActions={
          canUpdate ? (
            <>
              <Button variant="outline" onClick={edit.openDrawer}>
                {t.crmLeadDetail.edit}
              </Button>
              <Button
                variant="outline"
                onClick={transfer.openDialog}
                disabled={detail.pipelines.length < 2}
              >
                {t.crmOpportunityDetail.transferAction}
              </Button>
            </>
          ) : undefined
        }
      />

      {detail.degraded.history && (
        <DegradedBanner message={t.crmOpportunityDetail.historyUnavailable} />
      )}
      {detail.degraded.pipelines && (
        <DegradedBanner message={t.crmOpportunityDetail.pipelinesUnavailable} />
      )}
      {capabilitiesError && (
        <DegradedBanner message={t.crmOpportunities.capabilitiesUnavailable} />
      )}
      {attached.error && (
        <DegradedBanner message={t.crmOpportunityDetail.attachedUnavailable} />
      )}

      <div className="grid gap-3 lg:grid-cols-[1fr_320px]">
        <div className="order-2 flex min-w-0 flex-col gap-3 lg:order-1">
          <OpportunityFacts item={item} />
          <OpportunityStageTimeline entries={detail.history} />
          <RecordNotesSection
            branchId={item.branchId}
            sourceType="OPPORTUNITY"
            sourceId={item.id}
            sourceOwnerUserId={item.ownerUserId}
            createCapability={attached.capabilities.notesCreate}
            deleteCapability={attached.capabilities.notesDelete}
            readOnly={!canMutate}
          />
          <RecordAttachmentsSection
            branchId={item.branchId}
            sourceType="OPPORTUNITY"
            sourceId={item.id}
            sourceOwnerUserId={item.ownerUserId}
            createCapability={attached.capabilities.attachmentsCreate}
            deleteCapability={attached.capabilities.attachmentsDelete}
            readOnly={!canMutate}
          />
        </div>

        <div className="order-1 flex flex-col gap-3 lg:order-2">
          <DetailSection
            title={t.crmOpportunityDetail.pipelineTitle}
            columns={1}
            emptyValueLabel={t.detail.notRecorded}
            fields={[
              {
                label: t.crmOpportunities.pipeline,
                value: localizedName(pipeline, lang) || null,
              },
              {
                label: t.crmOpportunities.stage,
                value: localizedName(stage, lang) || null,
              },
              {
                label: t.crmLeadDetail.stageFlag,
                value: item.stageFlag ? (
                  <StatusBadge
                    value={item.stageFlag}
                    kind="OpportunityStageFlag"
                  />
                ) : null,
              },
              {
                label: t.common.status,
                value: (
                  <StatusBadge value={item.status} kind="OpportunityStatus" />
                ),
              },
            ]}
          />
          <DetailSection
            title={t.crmLeadDetail.ownershipTitle}
            columns={1}
            emptyValueLabel={t.detail.notRecorded}
            fields={[
              { label: t.crmOpportunities.owner, value: item.ownerUserId },
              {
                label: t.crmOpportunities.customer,
                value: (
                  <Link
                    href={`/crm/customer-profiles/${item.customerProfileId}`}
                    className="text-foreground hover:underline"
                  >
                    {t.crmOpportunities.viewCustomer}
                  </Link>
                ),
              },
              { label: t.crmCustomerProfiles.branch, value: item.branchId },
            ]}
          />
          <CustomFieldsCard
            branchId={item.branchId}
            ownerType="OPPORTUNITY"
            ownerId={item.id}
          />
        </div>
      </div>

      <OpportunityEditDrawer edit={edit} />
      <PipelineTransferDialog transfer={transfer} />
    </div>
  );
}
