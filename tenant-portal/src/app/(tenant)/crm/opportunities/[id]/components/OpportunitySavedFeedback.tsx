"use client";

import { AmbiguousOutcomePanel, Button, DegradedBanner } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { useAmbiguousOutcomeLabels, useAppliedUnreadableLabels } from "../../../shared/hooks/useAmbiguousOutcomeLabels";
import { useCrmErrorText } from "../../../shared/hooks/useCrmErrorText";
import type { useOpportunitySavedWorkspace } from "../hooks/useOpportunitySavedWorkspace";

export function OpportunitySavedFeedback({ workspace }: { workspace: ReturnType<typeof useOpportunitySavedWorkspace> }) {
  const { t } = useI18n();
  const describeError = useCrmErrorText();
  const unknown = useAmbiguousOutcomeLabels();
  const applied = useAppliedUnreadableLabels();
  const { edit, commands, detail, capabilitiesError, locked } = workspace;
  return <>
    {(edit.stale || edit.error?.status === 409) && <div role="alert" className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-warning bg-warning-subtle p-3 text-sm"><span>{t.crmOpportunityDetail.form.concurrentChanges}</span><Button variant="outline" size="sm" disabled={locked} onClick={() => workspace.guard.requestDiscard(() => { void edit.reconcile(); })}>{t.crmOpportunityDetail.form.reloadLatest}</Button></div>}
    {edit.error && <p role="alert" className="text-sm text-destructive">{describeError(edit.error)}</p>}
    {commands.error && <p role="alert" className="text-sm text-destructive">{describeError(commands.error)}</p>}
    {workspace.stageMove.uncertain && <div role="alert" className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-warning bg-warning-subtle p-3 text-sm"><span>{workspace.stageMove.error}</span><Button size="sm" variant="outline" loading={workspace.stageMove.isMoving} onClick={() => { void workspace.stageMove.reconcile().then((applied) => { if (applied) workspace.setPendingStageId(null); }); }}>{t.crmOpportunityDetail.form.reloadLatest}</Button></div>}
    {edit.ambiguity && <AmbiguousOutcomePanel operation={t.crmOpportunityDetail.editOperation} idempotencyKey={edit.ambiguity.attempt.idempotencyKey} description={t.crmOpportunityDetail.form.ordinaryOutcomeUnknown} correlationId={edit.ambiguity.error.correlationId} onRetry={() => { void edit.ambiguity?.replay(); }} retrying={edit.isSubmitting} labels={{ ...unknown, retry: t.crmOpportunityDetail.form.reloadLatest }} />}
    {edit.appliedUnreadable && <AmbiguousOutcomePanel operation={t.crmOpportunityDetail.editOperation} idempotencyKey={edit.appliedUnreadable.attempt.idempotencyKey} description={t.crmShared.appliedUnreadableDescription} correlationId={edit.appliedUnreadable.error.correlationId} onRetry={edit.reconcile} retrying={edit.isSubmitting} labels={{ ...applied, retry: t.crmOpportunityDetail.form.reloadLatest }} />}
    {commands.feedback && <AmbiguousOutcomePanel operation={commands.feedback.operation} idempotencyKey={commands.feedback.attempt.idempotencyKey} description={commands.feedback.kind === "ambiguous" ? t.crmOpportunityDetail.form.ordinaryOutcomeUnknown : t.crmShared.appliedUnreadableDescription} correlationId={commands.feedback.error.correlationId} onRetry={() => { void commands.feedback?.replay(); }} retrying={commands.saving} labels={{ ...(commands.feedback.kind === "ambiguous" ? unknown : applied), retry: t.crmOpportunityDetail.form.reloadLatest }} />}
    {detail.degraded.pipelines && <DegradedBanner message={t.crmOpportunityDetail.pipelinesUnavailable} />}
    {capabilitiesError && <DegradedBanner message={describeError(capabilitiesError) ?? t.crmOpportunities.loadFailed} />}
    {edit.customFieldsError && <div role="alert" className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-warning bg-warning-subtle p-2 text-xs"><span>{t.crmOpportunityDetail.form.customFieldsUnavailable}</span><Button size="xs" variant="outline" onClick={edit.retryCustomFields}>{t.common.retry}</Button></div>}
  </>;
}
