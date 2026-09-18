"use client";

import Link from "next/link";
import { useState } from "react";
import {
  Button,
  ConfirmActionModal,
  DegradedBanner,
  DetailHeader,
  DetailSection,
  ErrorState,
  NotFoundState,
  PageActions,
  Skeleton,
  StageBar,
  StatusBadge,
} from "@/design-system";
import { useAccessMode } from "@/hooks/useAccessMode";
import { useUserProfiles } from "@/hooks/useUserProfiles";
import { useI18n } from "@/i18n/I18nContext";
import { localizedName } from "@/lib/format/localized";
import { formatTemplate } from "@/lib/format/template";
import { CrmScopeGate } from "../../../shared/components/CrmScopeGate";
import { UserProfileLink } from "@/components/people/UserProfileLink";
import { CustomFieldsCard } from "../../../shared/components/CustomFieldsCard";
import { RecordNotesSection } from "../../../shared/components/RecordNotesSection";
import { useCrmErrorText } from "../../../shared/hooks/useCrmErrorText";
import { useCrmRecordCapabilities } from "../../../shared/hooks/useCrmRecordCapabilities";
import { useOpportunityCapabilities } from "../../hooks/useOpportunityCapabilities";
import { opportunityCapabilityAllowsOwner } from "../../hooks/usePipelineWorkspace";
import { useOpportunityDetail } from "../hooks/useOpportunityDetail";
import { useOpportunityEdit } from "../hooks/useOpportunityEdit";
import { useOpportunityStageMove } from "../hooks/useOpportunityStageMove";
import { usePipelineTransfer } from "../hooks/usePipelineTransfer";
import { OpportunityEditDrawer } from "./OpportunityEditDrawer";
import { OpportunityFacts } from "./OpportunityFacts";
import { OpportunityDetailSidePanel } from "./OpportunityDetailSidePanel";
import { OpportunityRelatedNav } from "./OpportunityRelatedNav";
import { PipelineTransferDialog } from "./PipelineTransferDialog";
import { TerminalMoveDialog } from "../../components/TerminalMoveDialog";

const STAGE_BAR_TONE: Record<string, "positive" | "negative" | undefined> = {
  WON: "positive",
  LOST: "negative",
};

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
  const ownerPeople = useUserProfiles(
    item?.ownerUserId ? [item.ownerUserId] : [],
    Boolean(item?.ownerUserId),
    item ?? undefined,
  );

  const edit = useOpportunityEdit(item, detail.reload);
  const transfer = usePipelineTransfer(
    item,
    detail.pipelines,
    detail.reload,
  );

  const pipeline =
    detail.pipelines.find(({ id }) => id === item?.pipelineId) ?? null;
  const canUpdate =
    canMutate &&
    item !== null &&
    opportunityCapabilityAllowsOwner(capabilities.update, item.ownerUserId);

  const stageMove = useOpportunityStageMove(
    item,
    pipeline?.stages ?? [],
    canUpdate,
    detail.reload,
  );

  const [pendingStageId, setPendingStageId] = useState<string | null>(null);

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

  const currentStage =
    pipeline?.stages.find(({ id }) => id === item.stageId) ?? null;
  const pendingStage =
    pipeline?.stages.find(({ id }) => id === pendingStageId) ?? null;
  const pendingTerminalStage =
    pendingStage?.flag === "WON" || pendingStage?.flag === "LOST"
      ? pendingStage
      : null;
  const loadedOwner = item.ownerUserId
    ? ownerPeople.profiles.get(item.ownerUserId)
    : undefined;
  const ownerResult =
    loadedOwner?.status === "loading" && item.ownerUserId && item.ownerDisplayName
      ? {
          status: "ready" as const,
          profile: {
            id: item.ownerUserId,
            fullName: item.ownerDisplayName,
            email: "",
            phone: null,
            imageUrl: null,
          },
        }
      : loadedOwner;

  return (
    <div className="flex flex-col gap-2">
      <PageActions slot="related">
        <OpportunityRelatedNav item={item} />
      </PageActions>

      {canUpdate && (
        <PageActions slot="actions">
          <div className="flex items-center gap-1.5">
            <Button size="sm" variant="outline" onClick={edit.openDrawer}>
              {t.crmLeadDetail.edit}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={transfer.openDialog}
              disabled={detail.pipelines.length < 2}
            >
              {t.crmOpportunityDetail.transferAction}
            </Button>
          </div>
        </PageActions>
      )}

      <DetailHeader
        className="sr-only"
        title={item.title}
        subtitle={[
          localizedName(pipeline, lang),
          localizedName(currentStage, lang),
        ]
          .filter((part) => part.length > 0)
          .join(" · ")}
        status={<StatusBadge value={item.status} kind="OpportunityStatus" />}
        backLabel={t.crmOpportunityDetail.backToOpportunities}
        backHref="/crm/opportunities"
      />

      {pipeline && pipeline.stages.length > 0 && (
        <StageBar
          label={t.crmOpportunities.stage}
          steps={pipeline.stages.map((entry) => ({
            id: entry.id,
            label: localizedName(entry, lang),
            tone: STAGE_BAR_TONE[entry.flag],
          }))}
          value={item.stageId}
          onChange={canUpdate ? (next) => next && setPendingStageId(next) : undefined}
          disabled={stageMove.isMoving}
        />
      )}

      <ConfirmActionModal
        open={pendingStage !== null && pendingTerminalStage === null}
        onOpenChange={(next) => {
          if (!next) setPendingStageId(null);
        }}
        title={t.crmLeadDetail.moveStageTitle}
        description={formatTemplate(t.crmLeadDetail.moveStageDescription, {
          from: currentStage ? localizedName(currentStage, lang) : "—",
          to: pendingStage ? localizedName(pendingStage, lang) : "",
        })}
        confirmLabel={t.filters.yes}
        cancelLabel={t.common.cancel}
        loading={stageMove.isMoving}
        onConfirm={async () => {
          const target = pendingStageId;
          setPendingStageId(null);
          if (target) await stageMove.move(target);
        }}
      />

      <TerminalMoveDialog
        key={pendingTerminalStage ? `${item.id}:${pendingTerminalStage.id}` : "closed"}
        isOpen={pendingTerminalStage !== null}
        onClose={() => {
          setPendingStageId(null);
          stageMove.clearError();
        }}
        opportunity={pendingTerminalStage ? item : null}
        targetFlag={pendingTerminalStage?.flag ?? "WON"}
        onConfirm={async (reason) => {
          if (!pendingTerminalStage) return false;
          const moved = await stageMove.move(pendingTerminalStage.id, reason);
          if (moved) setPendingStageId(null);
          return moved;
        }}
        isSubmitting={stageMove.isMoving}
        error={pendingTerminalStage ? stageMove.error : null}
      />

      {stageMove.error && !pendingTerminalStage && (
        <ErrorState
          title={stageMove.error}
          onRetry={stageMove.clearError}
          retryLabel={t.common.dismiss}
        />
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

      <div className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="order-2 flex min-w-0 flex-col gap-2 lg:order-1">
          <OpportunityFacts item={item} />
          <DetailSection
            title={t.crmLeadDetail.ownershipTitle}
            columns={2}
            emptyValueLabel={t.detail.notRecorded}
            fields={[
              {
                label: t.crmOpportunities.owner,
                value: item.ownerUserId ? (
                  <UserProfileLink
                    result={ownerResult}
                    onRetry={ownerPeople.retry}
                  />
                ) : null,
              },
              {
                label: t.crmOpportunities.customer,
                value: (
                  <Link
                    href={`/crm/customer-profiles/${item.customerProfileId}`}
                    className="text-foreground hover:underline"
                  >
                    {item.customerDisplayName ?? t.crmOpportunities.viewCustomer}
                  </Link>
                ),
              },
              {
                label: t.crmLeads.contact,
                value: item.primaryContact
                  ? [item.primaryContact.displayName, item.primaryContact.jobTitle]
                      .filter(Boolean)
                      .join(" · ")
                  : null,
              },
              { label: t.crmLeads.source, value: item.leadSourceName },
              {
                label: t.crmLeadDetail.stageFlag,
                value: item.stageFlag ? (
                  <StatusBadge
                    value={item.stageFlag}
                    kind="OpportunityStageFlag"
                  />
                ) : null,
              },
            ]}
          />
          <RecordNotesSection
            branchId={item.branchId}
            sourceType="OPPORTUNITY"
            sourceId={item.id}
            sourceOwnerUserId={item.ownerUserId}
            createCapability={attached.capabilities.notesCreate}
            deleteCapability={attached.capabilities.notesDelete}
            readOnly={!canMutate}
          />
          <CustomFieldsCard
            density="compact"
            branchId={item.branchId}
            ownerType="OPPORTUNITY"
            ownerId={item.id}
          />
        </div>

        <div className="order-1 flex min-w-0 flex-col gap-2 lg:order-2">
          <OpportunityDetailSidePanel
            item={item}
            attached={attached}
            readOnly={!canMutate}
            stageLabels={Object.fromEntries(
              detail.pipelines.flatMap((entry) =>
                entry.stages.map((stage) => [stage.id, localizedName(stage, lang)]),
              ),
            )}
            pipelineLabels={Object.fromEntries(
              detail.pipelines.map((entry) => [entry.id, localizedName(entry, lang)]),
            )}
          />
        </div>
      </div>

      <OpportunityEditDrawer edit={edit} />
      <PipelineTransferDialog transfer={transfer} />
    </div>
  );
}
