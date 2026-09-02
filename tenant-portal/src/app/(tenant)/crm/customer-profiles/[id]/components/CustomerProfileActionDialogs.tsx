"use client";

import {
  AmbiguousOutcomePanel,
  ConfirmActionModal,
  EditDrawer,
  Field,
  FormDrawer,
  Input,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatTemplate } from "@/lib/format/template";
import type { AcquisitionSource } from "../../../acquisition-sources/acquisition-source-contract";
import {
  useAmbiguousOutcomeLabels,
  useAppliedUnreadableLabels,
} from "../../../shared/hooks/useAmbiguousOutcomeLabels";
import { useCrmErrorText } from "../../../shared/hooks/useCrmErrorText";
import { BLACKLISTED_STATUS } from "../../customer-profile-contract";
import { CustomerProfileFormFields } from "../../components/CustomerProfileFormFields";
import type { useCustomerProfileActions } from "../hooks/useCustomerProfileActions";

export interface CustomerProfileActionDialogsProps {
  actions: ReturnType<typeof useCustomerProfileActions>;
  sources: AcquisitionSource[];
  displayName: string;
}

/**
 * The edit drawer, add-contact drawer, status confirmation and delete
 * confirmation for one customer profile — MASTER-PLAN 8.7.
 *
 * The status change gets a confirmation only for `BLACKLISTED`, which is
 * terminal in practice: it blocks new opportunities on the customer
 * (`409 CUSTOMER_PROFILE_BLACKLISTED`). Every other transition is ordinary and
 * a confirmation on it would be noise.
 */
export function CustomerProfileActionDialogs({
  actions,
  sources,
  displayName,
}: CustomerProfileActionDialogsProps) {
  const { t } = useI18n();
  const describeError = useCrmErrorText();
  const ambiguousLabels = useAmbiguousOutcomeLabels();
  const appliedLabels = useAppliedUnreadableLabels();
  const errorText = describeError(actions.error) ?? undefined;

  const ambiguousPanel = actions.ambiguity ? (
    <AmbiguousOutcomePanel
      operation={t.crmCustomerProfileActions.operations[actions.ambiguity.operation]}
      idempotencyKey={actions.ambiguity.attempt.idempotencyKey}
      description={t.crmCustomerProfileActions.ambiguousDescription}
      correlationId={actions.ambiguity.error.correlationId}
      onRetry={() => void actions.ambiguity?.replay()}
      onDismiss={actions.dismissAmbiguity}
      labels={ambiguousLabels}
    />
  ) : null;

  // D2. Rendered wherever the ambiguous panel is, and never together with an
  // `error`: the write applied, so the only action offered is a re-read.
  const appliedUnreadablePanel = actions.appliedUnreadable ? (
    <AmbiguousOutcomePanel
      operation={t.crmCustomerProfileActions.operations.edit}
      idempotencyKey={actions.appliedUnreadable.attempt.idempotencyKey}
      description={t.crmShared.appliedUnreadableDescription}
      correlationId={actions.appliedUnreadable.error.correlationId}
      onRetry={() => actions.reconcile()}
      onDismiss={actions.dismissAppliedUnreadable}
      labels={appliedLabels}
    />
  ) : null;

  return (
    <>
      <EditDrawer
        open={actions.form !== null}
        onOpenChange={(open) => {
          if (!open) actions.closeEdit();
        }}
        title={t.crmCustomerProfileActions.editTitle}
        description={t.crmCustomerProfileActions.editDescription}
        isDirty={actions.isDirty}
        isSubmitting={actions.busy === "edit"}
        onSubmit={() => void actions.submitEdit()}
        onRevert={actions.revertEdit}
        error={errorText}
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
        {ambiguousPanel}
        {appliedUnreadablePanel}
        {actions.form && (
          <CustomerProfileFormFields
            form={actions.form}
            setField={actions.setField}
            sources={sources}
            // `UpdateCustomerProfileDto` has no `profileType`: a profile does
            // not change between individual and corporate.
            allowProfileType={false}
            disabled={actions.busy === "edit"}
          />
        )}
      </EditDrawer>

      <FormDrawer
        open={actions.contactForm !== null}
        onOpenChange={(open) => {
          if (!open) actions.closeContact();
        }}
        title={t.crmCustomerProfileActions.addContactTitle}
        description={t.crmCustomerProfileActions.addContactDescription}
        isDirty={actions.contactForm !== null}
        isSubmitting={actions.busy === "contact"}
        submitDisabled={
          !actions.contactForm ||
          actions.contactForm.fullName.trim().length === 0
        }
        onSubmit={() => void actions.submitContact()}
        error={errorText}
        labels={{
          submit: t.common.create,
          cancel: t.common.cancel,
          discardTitle: t.common.discardTitle,
          discardDescription: t.common.discardDescription,
          discardConfirm: t.common.discardConfirm,
          discardCancel: t.common.cancel,
        }}
      >
        {ambiguousPanel}
        {appliedUnreadablePanel}
        {actions.contactForm && (
          <div className="flex flex-col gap-3">
            <Field label={t.crmLeadConvert.contactFullName} required>
              <Input
                value={actions.contactForm.fullName}
                onChange={(event) =>
                  actions.setContactField("fullName", event.target.value)
                }
                maxLength={180}
              />
            </Field>
            <Field label={t.crmLeadConvert.contactJobTitle}>
              <Input
                value={actions.contactForm.jobTitle}
                onChange={(event) =>
                  actions.setContactField("jobTitle", event.target.value)
                }
                maxLength={120}
              />
            </Field>
            <Field label={t.crmLeads.email}>
              <Input
                type="email"
                dir="ltr"
                value={actions.contactForm.email}
                onChange={(event) =>
                  actions.setContactField("email", event.target.value)
                }
                maxLength={180}
              />
            </Field>
            <Field label={t.crmLeads.phone}>
              <Input
                dir="ltr"
                value={actions.contactForm.phone}
                onChange={(event) =>
                  actions.setContactField("phone", event.target.value)
                }
                maxLength={32}
              />
            </Field>
          </div>
        )}
      </FormDrawer>

      <ConfirmActionModal
        open={actions.pendingStatus === BLACKLISTED_STATUS}
        onOpenChange={(open) => {
          if (!open) actions.cancelStatus();
        }}
        title={t.crmCustomerProfileActions.blacklistTitle}
        description={formatTemplate(
          t.crmCustomerProfileActions.blacklistDescription,
          { name: displayName },
        )}
        confirmLabel={t.crmCustomerProfileActions.blacklistConfirm}
        cancelLabel={t.common.cancel}
        loading={actions.busy === "status"}
        onConfirm={() => void actions.submitStatus()}
      />

      <ConfirmActionModal
        open={actions.confirmingDelete}
        onOpenChange={(open) => {
          if (!open) actions.cancelDelete();
        }}
        title={t.crmCustomerProfileActions.deleteTitle}
        description={formatTemplate(
          t.crmCustomerProfileActions.deleteDescription,
          { name: displayName },
        )}
        confirmLabel={t.common.confirmDelete}
        cancelLabel={t.common.cancel}
        loading={actions.busy === "delete"}
        onConfirm={() => void actions.submitDelete()}
      />
    </>
  );
}
