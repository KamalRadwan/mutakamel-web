"use client";

import { AmbiguousOutcomePanel, FormDrawer } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import type { AcquisitionSource } from "../../acquisition-sources/acquisition-source-contract";
import {
  useAmbiguousOutcomeLabels,
  useAppliedUnreadableLabels,
} from "../../shared/hooks/useAmbiguousOutcomeLabels";
import { useCrmErrorText } from "../../shared/hooks/useCrmErrorText";
import type { useCreateCustomerProfile } from "../hooks/useCreateCustomerProfile";
import { CustomerProfileFormFields } from "./CustomerProfileFormFields";

export interface CreateCustomerProfileDrawerProps {
  create: ReturnType<typeof useCreateCustomerProfile>;
  sources: AcquisitionSource[];
}

/** `POST /customer-profiles` — MASTER-PLAN 8.9. */
export function CreateCustomerProfileDrawer({
  create,
  sources,
}: CreateCustomerProfileDrawerProps) {
  const { t } = useI18n();
  const describeError = useCrmErrorText();
  const ambiguousLabels = useAmbiguousOutcomeLabels();
  const appliedLabels = useAppliedUnreadableLabels();
  const form = create.form;

  return (
    <FormDrawer
      open={create.open}
      onOpenChange={(open) => {
        if (!open) create.closeDrawer();
      }}
      title={t.crmCustomerProfileActions.createTitle}
      description={t.crmCustomerProfileActions.createDescription}
      isDirty={form !== null}
      isSubmitting={create.isSubmitting}
      submitDisabled={!form || form.displayName.trim().length === 0}
      onSubmit={() => void create.submit()}
      error={describeError(create.error) ?? undefined}
      labels={{
        submit: t.common.create,
        cancel: t.common.cancel,
        discardTitle: t.common.discardTitle,
        discardDescription: t.common.discardDescription,
        discardConfirm: t.common.discardConfirm,
        discardCancel: t.common.cancel,
      }}
    >
      {create.ambiguity && (
        <AmbiguousOutcomePanel
          operation={t.crmCustomerProfileActions.createOperation}
          idempotencyKey={create.ambiguity.attempt.idempotencyKey}
          description={t.crmCustomerProfileActions.ambiguousDescription}
          correlationId={create.ambiguity.error.correlationId}
          onRetry={() => void create.ambiguity?.replay()}
          onDismiss={create.dismissAmbiguity}
          labels={ambiguousLabels}
        />
      )}

      {create.appliedUnreadable && (
        <AmbiguousOutcomePanel
          operation={t.crmCustomerProfileActions.createOperation}
          idempotencyKey={create.appliedUnreadable.attempt.idempotencyKey}
          description={t.crmShared.appliedUnreadableDescription}
          correlationId={create.appliedUnreadable.error.correlationId}
          onRetry={() => create.reconcile()}
          onDismiss={create.dismissAppliedUnreadable}
          labels={appliedLabels}
        />
      )}
      {form && (
        <CustomerProfileFormFields
          form={form}
          setField={create.setField}
          sources={sources}
          allowProfileType
          disabled={create.isSubmitting}
        />
      )}
    </FormDrawer>
  );
}
