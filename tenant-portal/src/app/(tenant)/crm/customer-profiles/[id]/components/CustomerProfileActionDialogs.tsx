"use client";

import {
  AmbiguousOutcomePanel,
  ConfirmActionModal,
  EditDrawer,
  Field,
  FormModal,
  Input,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatTemplate } from "@/lib/format/template";
import type { AcquisitionSource } from "../../../acquisition-sources/acquisition-source-contract";
import { CrmContactLine } from "../../../shared/components/CrmContactLine";
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
 * The edit drawer, add-contact card, status confirmation and delete
 * confirmation for one customer profile — MASTER-PLAN 8.7.
 *
 * Adding a contact is a CREATE, so it is a centred card and not a drawer; four
 * fields are far too few for the full-viewport size, hence `size="card"`.
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

      <FormModal
        size="card"
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
          // Required by `FormModalLabels` and unused at this size: a card
          // renders no section index. The shared CRM keys, so the string a
          // reader would meet elsewhere is the string here.
          sections: t.crmShared.formSectionsNav,
          sectionInvalid: t.crmShared.formSectionInvalid,
          close: t.common.close,
        }}
      >
        {ambiguousPanel}
        {appliedUnreadablePanel}
        {actions.contactForm && (
          <div className="flex flex-col gap-3">
            <CrmContactLine
              path="contact"
              contact={{
              honorificTitle: actions.contactForm?.honorificTitle ?? "",
              fullName: actions.contactForm?.fullName ?? "",
              jobTitle: actions.contactForm?.jobTitle ?? "",
              email: actions.contactForm?.email ?? "",
              phones: [actions.contactForm?.phone ?? ""],
            }}
              errors={{}}
              // `CustomerProfileContactPersonDto`: fullName and email 180,
              // jobTitle 120.
              limits={{ fullName: 180, jobTitle: 120, email: 180 }}
              nameLabel={t.crmLeadConvert.contactFullName}
              onFieldChange={(patch) => {
              for (const [key, next] of Object.entries(patch)) {
                actions.setContactField(key as "fullName", next);
              }
            }}
            // One number here, not a list: `CustomerContactForm` holds a single
            // `phone`, which the builder sends as `phones: [value]`.
              onPhoneChange={(_index, next) => actions.setContactField("phone", next)}
              onBlur={() => undefined}
            />
          </div>
        )}
      </FormModal>

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
