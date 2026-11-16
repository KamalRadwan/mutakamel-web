"use client";

import { FormModal } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import type { CompanyOption } from "../../company-options";
import { useTaxFormModal } from "../hooks/useTaxFormModal";
import { toTaxForm, type Tax, type TaxFormValues } from "../tax-contract";
import { TaxFormFields } from "./TaxFormFields";

export interface EditTaxModalProps {
  tax: Tax;
  companies: CompanyOption[];
  onClose: () => void;
  onSubmit: (values: TaxFormValues) => Promise<boolean>;
  isSubmitting: boolean;
  error: string | null;
}

/** Keyed on the row id by the screen, so it opens on the selected tax by construction. */
export function EditTaxModal({
  tax,
  companies,
  onClose,
  onSubmit,
  isSubmitting,
  error,
}: EditTaxModalProps) {
  const { t } = useI18n();
  const modal = useTaxFormModal({
    mode: "edit",
    open: true,
    initialValues: toTaxForm(tax),
    companies,
    tenantWideAllowed: tax.companyId === null,
    isSubmitting,
    error,
    t,
    onClose,
    onSubmit,
  });

  return (
    <FormModal
      open
      onOpenChange={modal.handleOpenChange}
      size="card"
      density="compact"
      bodyClassName="gap-3 px-4 py-3.5"
      title={t.coreSettings.taxEditTitle}
      isDirty={modal.modalIsDirty}
      isSubmitting={modal.isBusy}
      onSubmit={modal.handleSubmit}
      error={modal.unmappedError}
      labels={{
        submit: t.coreSettings.save,
        cancel: t.common.cancel,
        close: t.common.close,
        discardTitle: t.common.discardTitle,
        discardDescription: t.common.discardDescription,
        discardConfirm: t.common.discardConfirm,
        discardCancel: t.common.cancel,
        sections: t.crmShared.formSectionsNav,
        sectionInvalid: t.crmShared.formSectionInvalid,
      }}
    >
      <TaxFormFields
        idPrefix={modal.idPrefix}
        values={modal.values}
        errors={modal.fieldErrors}
        summaryItems={modal.summaryItems}
        onSummaryNavigate={modal.handleSummaryNavigate}
        onChange={modal.handleChange}
        onBlur={modal.handleBlur}
        companies={companies}
        tenantWideAllowed={tax.companyId === null}
        isSubmitting={modal.isBusy}
        scopeReadOnly
      />
    </FormModal>
  );
}
