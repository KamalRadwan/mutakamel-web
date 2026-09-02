"use client";

import {
  AmbiguousOutcomePanel,
  DatePicker,
  EditDrawer,
  Field,
  Input,
  Textarea,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import {
  useAmbiguousOutcomeLabels,
  useAppliedUnreadableLabels,
} from "../../../shared/hooks/useAmbiguousOutcomeLabels";
import { useCrmErrorText } from "../../../shared/hooks/useCrmErrorText";
import { fromIsoDate, toIsoDate } from "../../../shared/iso-date";
import { isValidOpportunityAmount } from "../../opportunity-write-contract";
import type { useOpportunityEdit } from "../hooks/useOpportunityEdit";

export interface OpportunityEditDrawerProps {
  edit: ReturnType<typeof useOpportunityEdit>;
}

/**
 * `PATCH /opportunities/:id` — MASTER-PLAN 8.11.
 *
 * The amount is a plain text field carrying the exact decimal string. It is
 * never formatted into the box and never `Number()`d back out for display —
 * the one conversion happens in the request builder, behind a guard that keeps
 * it exact.
 */
export function OpportunityEditDrawer({ edit }: OpportunityEditDrawerProps) {
  const { t } = useI18n();
  const describeError = useCrmErrorText();
  const ambiguousLabels = useAmbiguousOutcomeLabels();
  const appliedLabels = useAppliedUnreadableLabels();
  const form = edit.form;
  const amountInvalid = form ? !isValidOpportunityAmount(form.amount) : false;

  return (
    <EditDrawer
      open={edit.open}
      onOpenChange={(open) => {
        if (!open) edit.closeDrawer();
      }}
      title={t.crmOpportunityDetail.editTitle}
      description={t.crmOpportunityDetail.editDescription}
      isDirty={edit.isDirty}
      isSubmitting={edit.isSubmitting}
      // `EditDrawer` has no `submitDisabled` — only `FormDrawer` does — so a
      // malformed amount cannot block the button here. It is caught in
      // `useOpportunityEdit.submit`, which surfaces the builder's rejection as
      // an in-body error rather than sending a value the server would refuse.
      onSubmit={() => void edit.submit()}
      onRevert={edit.revert}
      error={describeError(edit.error) ?? undefined}
      labels={{
        submit: t.common.save,
        cancel: t.common.cancel,
        discardTitle: t.common.discardTitle,
        discardDescription: t.common.discardDescription,
        discardConfirm: t.common.discardConfirm,
        discardCancel: t.common.cancel,
        loadErrorTitle: t.editDrawer.loadErrorTitle,
        retry: t.common.retry,
        notFoundTitle: t.editDrawer.notFoundTitle,
        notFoundBack: t.editDrawer.notFoundBack,
        revert: t.editDrawer.revert,
      }}
    >
      {edit.ambiguity && (
        <AmbiguousOutcomePanel
          operation={t.crmOpportunityDetail.editOperation}
          idempotencyKey={edit.ambiguity.attempt.idempotencyKey}
          description={t.crmOpportunityDetail.ambiguousDescription}
          correlationId={edit.ambiguity.error.correlationId}
          onRetry={() => void edit.ambiguity?.replay()}
          onDismiss={edit.dismissAmbiguity}
          labels={ambiguousLabels}
        />
      )}

      {edit.appliedUnreadable && (
        <AmbiguousOutcomePanel
          operation={t.crmOpportunityDetail.editOperation}
          idempotencyKey={edit.appliedUnreadable.attempt.idempotencyKey}
          description={t.crmShared.appliedUnreadableDescription}
          correlationId={edit.appliedUnreadable.error.correlationId}
          onRetry={() => edit.reconcile()}
          onDismiss={edit.dismissAppliedUnreadable}
          labels={appliedLabels}
        />
      )}

      {form && (
        <div className="flex flex-col gap-3">
          <Field label={t.crmOpportunities.title} required>
            <Input
              value={form.title}
              onChange={(event) => edit.setField("title", event.target.value)}
              maxLength={180}
            />
          </Field>
          <Field
            label={t.crmOpportunityDetail.amount}
            hint={t.crmLeadConvert.amountHint}
            error={amountInvalid ? t.crmLeadConvert.amountInvalid : undefined}
          >
            <Input
              value={form.amount}
              onChange={(event) => edit.setField("amount", event.target.value)}
              inputMode="decimal"
              dir="ltr"
              aria-invalid={amountInvalid}
            />
          </Field>
          <Field
            label={t.crmLeadConvert.currencyCode}
            hint={t.crmLeadConvert.currencyHint}
          >
            <Input
              value={form.currencyCode}
              onChange={(event) =>
                edit.setField("currencyCode", event.target.value)
              }
              maxLength={3}
              dir="ltr"
            />
          </Field>
          <Field
            label={t.crmOpportunities.importance}
            hint={t.crmOpportunityDetail.importanceHint}
          >
            <Input
              value={form.importance}
              onChange={(event) =>
                edit.setField("importance", event.target.value)
              }
              inputMode="numeric"
              maxLength={1}
            />
          </Field>
          <Field
            label={t.crmOpportunityDetail.probability}
            hint={t.crmOpportunityDetail.probabilityHint}
          >
            <Input
              value={form.probabilityPercent}
              onChange={(event) =>
                edit.setField("probabilityPercent", event.target.value)
              }
              inputMode="numeric"
              maxLength={3}
            />
          </Field>
          <Field label={t.crmOpportunities.expectedClose}>
            <DatePicker
              value={fromIsoDate(form.expectedCloseDate)}
              onValueChange={(next) =>
                edit.setField("expectedCloseDate", toIsoDate(next))
              }
              placeholder={t.crmLeadConvert.selectDate}
              clearLabel={t.crmLeadConvert.clearDate}
            />
          </Field>
          <Field label={t.crmLeadDetail.description}>
            <Textarea
              value={form.description}
              onChange={(event) =>
                edit.setField("description", event.target.value)
              }
              maxLength={2000}
            />
          </Field>
        </div>
      )}
    </EditDrawer>
  );
}
