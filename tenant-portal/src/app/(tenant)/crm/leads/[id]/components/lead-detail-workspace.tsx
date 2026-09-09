"use client";

import { useState } from "react";
import {
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
import { useLeadCapabilities } from "../../hooks/useLeadCapabilities";
import { useLeadDetail } from "../hooks/useLeadDetail";
import { useLeadCompanyEdit } from "../hooks/useLeadCompanyEdit";
import { useLeadConvert } from "../hooks/useLeadConvert";
import { useLeadStageMove } from "../hooks/useLeadStageMove";
import { LeadCompanyCard } from "./LeadCompanyCard";
import { LeadContactsCard } from "./LeadContactsCard";
import { LeadConvertModal } from "./LeadConvertModal";
import { LeadIdentityCards } from "./LeadIdentityCards";
import { LeadRelatedNav } from "./LeadRelatedNav";
import { LEAD_STAGE_BAR_TONE } from "../../components/lead-view-config";
import { LeadDetailSidePanel } from "./LeadDetailSidePanel";
import { useCrmAcquisitionSources } from "../../../shared/hooks/useCrmAcquisitionSources";

/**
 * `/crm/leads/[id]` — MASTER-PLAN 8.1, docs/design/detail-screens.md.
 *
 * One scroll, two columns. Record fields stay visible; the end rail switches
 * between History (default), open Activities and Attachments.
 *
 * Every action is gated by the `capabilities` response, never by a permission
 * string (defect D11 / 8.5) — `crm.leads.update.own` says nothing about whether
 * *this* lead is one of the actor's own, and the capability's `ownerUserIds`
 * boundary does.
 */
export function LeadDetailWorkspace({ leadId }: { leadId: string }) {
  // Conversion attempts and card drafts belong to one record, including on client navigation.
  return <LeadDetailContent key={leadId} leadId={leadId} />;
}

function LeadDetailContent({ leadId }: { leadId: string }) {
  const { t, lang } = useI18n();
  const describeError = useCrmErrorText();
  const detail = useLeadDetail(leadId);
  const lead = detail.lead;
  const { capabilities, error: capabilitiesError } = useLeadCapabilities(
    lead?.branchId ?? null,
  );
  const sources = useCrmAcquisitionSources();
  const { canMutate } = useAccessMode();

  // Card-specific editors own their changed-field saves; there is no page-wide editor.
  const companyEdit = useLeadCompanyEdit(lead, detail.setLead, detail.reload);
  const canConvert = canMutate && lead !== null && lead.status !== "CONVERTED" &&
    !lead.convertedCustomerProfileId && crmCapabilityAllowsOwner(capabilities.convert, lead.ownerUserId);
  const convert = useLeadConvert(lead, detail.reload, canConvert, capabilities.opportunitiesCreate ?? null);
  // Above the early returns, with the other hooks: `canUpdate` is derived here
  // rather than below them because a hook cannot be called after a conditional
  // return, and the stage bar needs both.
  const canUpdate =
    canMutate && lead !== null && crmCapabilityAllowsOwner(capabilities.update, lead.ownerUserId);
  const stageMove = useLeadStageMove(lead, detail.stages, canUpdate, detail.reload);
  // The stage a press asked for, held until the confirmation answers.
  const [pendingStageId, setPendingStageId] = useState<string | null>(null);

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

  const currentStage = detail.stages.find(({ id }) => id === lead.stageId) ?? null;
  const pendingStage = detail.stages.find(({ id }) => id === pendingStageId) ?? null;

  return (
    <div className="flex flex-col gap-2">
      {/* The action bar's middle. It renders through a portal, so declaring it
          here — beside the state it reads — costs nothing and keeps the counts
          in the screen that knows the lead. */}
      <PageActions slot="related">
        <LeadRelatedNav leadId={lead.id} partyId={lead.partyId} branchId={lead.branchId} />
      </PageActions>
      {/* `sr-only`, not deleted — the same trade the leads list makes. The bar
          above already names the record and carries Convert (which
          portal out of PageHeader, which DetailHeader composes), so the block
          in the body was the record's name a second time. What is NOT surplus:
          the <h1> is this document's outline, and `backHref` still renders the
          keyboard-reachable way back — which the bar's own "Leads" link now
          duplicates for the pointer. */}
      <DetailHeader
        className="sr-only"
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
          canConvert || convert.hasReceipt
            ? { label: convert.hasReceipt ? t.crmLeadConvert.conversionResult : t.crmLeadConvert.action, onClick: convert.openModal, size: "sm" }
            : undefined
        }
      />

      {/* The pipeline, as the board draws it, with this lead's stage marked —
          and pressable: a stage IS the move here, `POST /leads/:id/stage`,
          gated by the same capability and refusing the same destinations the
          board refuses. It is also the single-pointer alternative to dragging
          that WCAG 2.2 `dragging-alternative` requires, which the board card
          stopped carrying — see docs/design/views.md#leads.
          Rendered from the same `stages` the board uses, so the two cannot
          disagree about the pipeline's order. */}
      {!detail.stagesDegraded && detail.stages.length > 0 && (
        <StageBar
          label={t.crmLeads.stage}
          steps={detail.stages.map((entry) => ({
            id: entry.id,
            label: localizedValue(entry.nameAr, entry.nameEn, lang),
            tone: LEAD_STAGE_BAR_TONE[entry.flag],
            // Conversion owns this stage; a stage move into it is a 409, so
            // the step is inert rather than absent — the pipeline still has it.
            disabled: entry.flag === "CONVERTED",
          }))}
          value={lead.stageId}
          // No handler at all when the user may not move this lead: the bar
          // falls back to the picture it was, rather than offering a control
          // that answers 403.
          //
          // A press ASKS rather than moves. One click on a bar that is always
          // on screen is a mis-click away from a stage change other people see
          // in the pipeline and in the audit log, and the move is not undone by
          // pressing the old stage again — that is a second entry, not a
          // reversal.
          onChange={canUpdate ? (next) => next && setPendingStageId(next) : undefined}
          disabled={stageMove.isMoving}
        />
      )}

      {/* Named in full, both stages, because "are you sure" on its own asks the
          user to remember which step they just pressed. */}
      <ConfirmActionModal
        open={pendingStage !== null}
        onOpenChange={(next) => {
          if (!next) setPendingStageId(null);
        }}
        title={t.crmLeadDetail.moveStageTitle}
        description={formatTemplate(t.crmLeadDetail.moveStageDescription, {
          from: currentStage ? localizedValue(currentStage.nameAr, currentStage.nameEn, lang) : "—",
          to: pendingStage ? localizedValue(pendingStage.nameAr, pendingStage.nameEn, lang) : "",
        })}
        confirmLabel={t.filters.yes}
        cancelLabel={t.common.cancel}
        loading={stageMove.isMoving}
        onConfirm={() => {
          const target = pendingStageId;
          setPendingStageId(null);
          if (target) void stageMove.move(target);
        }}
      />

      {stageMove.error && (
        <ErrorState
          title={stageMove.error}
          onRetry={stageMove.clearError}
          retryLabel={t.common.dismiss}
        />
      )}

      {detail.stagesDegraded && (
        <DegradedBanner message={t.crmLeads.stagesUnavailable} />
      )}
      {capabilitiesError && (
        <DegradedBanner message={t.crmLeads.capabilitiesUnavailable} />
      )}
      {sources.degraded && (
        <DegradedBanner message={t.crmLeadDetail.sourcesUnavailable} />
      )}

      <div className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="order-2 flex min-w-0 flex-col gap-2 lg:order-1">
          {/* Corporate only: on an individual lead the Party IS the person, so
              this would be six boxes with nothing behind them. */}
          {lead.leadProfileType === "CORPORATE" && (
            <LeadCompanyCard key={`company:${lead.id}`} lead={lead} edit={companyEdit}
              readOnly={!canUpdate || lead.status === "CONVERTED"} />
          )}
          {companyEdit.error && (
            <ErrorState
              title={describeError(companyEdit.error) ?? t.crmLeadDetail.saveFailed}
              onRetry={companyEdit.clearError}
              retryLabel={t.common.dismiss}
            />
          )}
          <LeadContactsCard key={`contacts:${lead.id}`} lead={lead} canEdit={canUpdate}
            onSaved={detail.setLead} onReconcile={detail.reload} />
          <LeadIdentityCards key={`details:${lead.id}`} lead={lead} canEdit={canUpdate}
            allowedOwnerIds={capabilities.update ? capabilities.update.ownerUserIds : []} sources={sources.items}
            onSaved={detail.setLead} onReconcile={detail.reload} />
          <CustomFieldsCard density="compact" branchId={lead.branchId} ownerType="LEAD" ownerId={lead.id} />
        </div>

        <div className="order-3 min-w-0">
          <LeadDetailSidePanel key={`rail:${lead.id}`} lead={lead}
            historyValueLabels={{ stageId: Object.fromEntries(detail.stageCatalogue.map((stage) =>
              [stage.id, localizedValue(stage.nameAr, stage.nameEn, lang)])) }}
            capabilities={capabilities} readOnly={!canMutate} />
        </div>
      </div>

      <LeadConvertModal convert={convert} />
    </div>
  );
}
