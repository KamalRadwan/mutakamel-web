"use client";

import { AmbiguousOutcomePanel, Button } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatTemplate } from "@/lib/format/template";
import { useAmbiguousOutcomeLabels, useAppliedUnreadableLabels } from "../../../shared/hooks/useAmbiguousOutcomeLabels";
import { useCrmErrorText } from "../../../shared/hooks/useCrmErrorText";
import type { useCreateOpportunity } from "../../hooks/useCreateOpportunity";

export function OpportunityCreateRecovery({ create }: { create: ReturnType<typeof useCreateOpportunity> }) {
  const { t } = useI18n();
  const ambiguousLabels = useAmbiguousOutcomeLabels();
  const appliedLabels = useAppliedUnreadableLabels();
  const describeError = useCrmErrorText();
  return <>
    {create.ambiguity && <AmbiguousOutcomePanel operation={t.crmOpportunityDetail.createOperation}
      idempotencyKey={create.ambiguity.attempt.idempotencyKey} description={t.crmOpportunityDetail.ambiguousDescription}
      correlationId={create.ambiguity.error.correlationId} onRetry={() => void create.ambiguity?.replay()}
      onDismiss={create.closeModal} retrying={create.isSubmitting} labels={ambiguousLabels} />}
    {create.appliedUnreadable && <AmbiguousOutcomePanel operation={t.crmOpportunityDetail.createOperation}
      idempotencyKey={create.appliedUnreadable.attempt.idempotencyKey} description={t.crmShared.appliedUnreadableDescription}
      correlationId={create.appliedUnreadable.error.correlationId} onRetry={create.reconcile}
      onDismiss={create.dismissAppliedUnreadable} labels={appliedLabels} />}
    {create.tagRecovery && <section aria-live="polite" className="flex flex-col gap-2 rounded-lg border border-warning bg-warning-subtle p-3">
      <h2 className="text-sm font-medium text-foreground">{create.tagRecovery.status === "uncertain" ? t.crmOpportunityDetail.create.tagsUncertainTitle : t.crmOpportunityDetail.create.tagsFailedTitle}</h2>
      <p className="text-sm text-muted-foreground">{formatTemplate(create.tagRecovery.status === "uncertain" ? t.crmOpportunityDetail.create.tagsUncertainDescription : t.crmOpportunityDetail.create.tagsFailedDescription, { id: create.tagRecovery.opportunityId })}</p>
      {describeError(create.tagRecovery.error) && <p className="text-xs text-warning-subtle-foreground">{describeError(create.tagRecovery.error)}</p>}
      <Button type="button" variant="outline" size="sm" className="self-start" disabled={create.isRetryingTags} onClick={() => void create.retryTagAttachment()}>
        {create.isRetryingTags ? t.crmOpportunityDetail.create.retryingTags : t.crmOpportunityDetail.create.retryTags}
      </Button>
    </section>}
  </>;
}
