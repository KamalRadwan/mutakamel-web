"use client";

import {
  DegradedBanner,
  DetailHeader,
  ErrorState,
  NotFoundState,
  PageActions,
  Skeleton,
  StatusBadge,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { CrmScopeGate } from "../../../shared/components/CrmScopeGate";
import { CustomFieldsCard } from "../../../shared/components/CustomFieldsCard";
import { useCrmErrorText } from "../../../shared/hooks/useCrmErrorText";
import { useLeadDetailWorkspace } from "../hooks/useLeadDetailWorkspace";
import { LeadCompanyCard } from "./LeadCompanyCard";
import { LeadContactsCard } from "./LeadContactsCard";
import { LeadConvertModal } from "./LeadConvertModal";
import { LeadDetailHero } from "./LeadDetailHero";
import { LeadDetailSidePanel } from "./LeadDetailSidePanel";
import { LeadIdentityCards } from "./LeadIdentityCards";
import { LeadRelatedNav } from "./LeadRelatedNav";
import { LeadStagePipeline } from "./LeadStagePipeline";

/**
 * `/crm/leads/[id]` — MASTER-PLAN 8.1, docs/design/detail-screens.md.
 *
 * One scroll, two columns: the record's cards on one side, contacts and the
 * History / Activities / Attachments panel on the other.
 */
export function LeadDetailWorkspace({ leadId }: { leadId: string }) {
  // Conversion attempts and card drafts belong to one record, including on client navigation.
  return <LeadDetailContent key={leadId} leadId={leadId} />;
}

function LeadDetailContent({ leadId }: { leadId: string }) {
  const { t } = useI18n();
  const describeError = useCrmErrorText();
  const workspace = useLeadDetailWorkspace(leadId);
  const { detail, capabilities, companyEdit, convert, cardEdit } = workspace;
  const lead = detail.lead;

  if (detail.isLoading) {
    return (
      <div className="flex flex-col gap-2">
        <Skeleton className="h-12 rounded-md" />
        <div className="grid gap-2 lg:grid-cols-2">
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

  const showConvert = workspace.canConvert || convert.hasReceipt;

  return (
    <div className="flex flex-col gap-2">
      {/* The action bar's middle. It renders through a portal, so declaring it
          here — beside the state it reads — keeps the counts in the screen
          that knows the lead. */}
      <PageActions slot="related">
        <LeadRelatedNav leadId={lead.id} partyId={lead.partyId} branchId={lead.branchId} />
      </PageActions>
      {/* `sr-only`, not deleted: the <h1> is this document's outline and
          `backHref` the keyboard-reachable way back, while Convert portals into
          the PageHeader's action bar, which DetailHeader composes. */}
      <DetailHeader
        className="sr-only"
        title={lead.displayName}
        subtitle={[t.crmCustomerProfiles.profileTypes[lead.leadProfileType], workspace.sourceLabel]
          .filter((part) => part.length > 0)
          .join(" · ")}
        status={<StatusBadge value={lead.status} kind="LeadStatus" />}
        backLabel={t.crmLeadDetail.backToLeads}
        backHref="/crm/leads"
        primaryAction={showConvert ? {
          label: convert.hasReceipt ? t.crmLeadConvert.conversionResult : t.crmLeadConvert.action,
          onClick: convert.openModal,
          size: "sm",
        } : undefined}
      />

      <LeadDetailHero lead={lead} card={detail.card} cardEdit={cardEdit} editable={workspace.canEditRecord}
        sourceLabel={workspace.sourceLabel} stageAge={workspace.stageAge} />
      {cardEdit.error && (
        <ErrorState title={describeError(cardEdit.error) ?? t.crmLeadDetail.saveFailed}
          onRetry={cardEdit.clearError} retryLabel={t.common.dismiss} />
      )}

      <LeadStagePipeline stageId={lead.stageId} stages={detail.stages} degraded={detail.stagesDegraded}
        canUpdate={workspace.canUpdate} stageMove={workspace.stageMove} />

      {detail.stagesDegraded && <DegradedBanner message={t.crmLeads.stagesUnavailable} />}
      {workspace.capabilitiesError && <DegradedBanner message={t.crmLeads.capabilitiesUnavailable} />}
      {workspace.sources.degraded && <DegradedBanner message={t.crmLeadDetail.sourcesUnavailable} />}

      <div className="grid grid-cols-1 items-start gap-2 lg:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-2">
          {/* Corporate only: on an individual lead the Party IS the person. */}
          {lead.leadProfileType === "CORPORATE" && (
            <LeadCompanyCard key={`company:${lead.id}`} lead={lead} edit={companyEdit}
              readOnly={!workspace.canEditRecord} />
          )}
          {companyEdit.error && (
            <ErrorState
              title={describeError(companyEdit.error) ?? t.crmLeadDetail.saveFailed}
              onRetry={companyEdit.clearError}
              retryLabel={t.common.dismiss}
            />
          )}
          <LeadIdentityCards key={`details:${lead.id}`} lead={lead} canEdit={workspace.canUpdate}
            allowedOwnerIds={capabilities.update ? capabilities.update.ownerUserIds : []}
            sources={workspace.sources.items} onSaved={detail.setLead} onReconcile={detail.reload} />
          <CustomFieldsCard density="compact" branchId={lead.branchId} ownerType="LEAD" ownerId={lead.id} />
        </div>

        <div className="flex min-w-0 flex-col gap-2">
          <LeadContactsCard key={`contacts:${lead.id}`} lead={lead} canEdit={workspace.canUpdate}
            onSaved={detail.setLead} onReconcile={detail.reload} />
          <LeadDetailSidePanel key={`rail:${lead.id}`} lead={lead}
            historyValueLabels={{ stageId: workspace.stageLabels }}
            capabilities={capabilities} readOnly={!workspace.canMutate} />
        </div>
      </div>

      <LeadConvertModal convert={convert} />
    </div>
  );
}
