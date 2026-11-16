"use client";

import { FormModal } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import type { CompanyOption } from "../../company-options";
import { useTaxFormModal } from "../hooks/useTaxFormModal";
import { EMPTY_TAX_FORM, type TaxFormValues } from "../tax-contract";
import { TaxFormFields } from "./TaxFormFields";

export interface CreateTaxModalProps {
  isOpen: boolean;
  companies: CompanyOption[];
  tenantWideAllowed: boolean;
  onClose: () => void;
  onSubmit: (values: TaxFormValues) => Promise<boolean>;
  isSubmitting: boolean;
  error: string | null;
}

export function CreateTaxModal({
  isOpen,
  companies,
  tenantWideAllowed,
  onClose,
  onSubmit,
  isSubmitting,
  error,
}: CreateTaxModalProps) {
  const { t } = useI18n();
  const initialValues: TaxFormValues = {
    ...EMPTY_TAX_FORM,
    companyId: tenantWideAllowed ? null : (companies[0]?.id ?? null),
  };
  const modal = useTaxFormModal({
    mode: "create",
    open: isOpen,
    initialValues,
    companies,
    tenantWideAllowed,
    isSubmitting,
    error,
    t,
    onClose,
    onSubmit,
  });

  return (
    <FormModal
      open={isOpen}
      onOpenChange={modal.handleOpenChange}
      size="card"
      density="compact"
      bodyClassName="gap-3 px-4 py-3.5"
      title={t.coreSettings.taxCreateTitle}
      isDirty={modal.modalIsDirty}
      isSubmitting={modal.isBusy}
      onSubmit={modal.handleSubmit}
      error={modal.unmappedError}
      labels={{
        submit: t.coreSettings.taxCreateSubmit,
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
        tenantWideAllowed={tenantWideAllowed}
        isSubmitting={modal.isBusy}
        scopeReadOnly={false}
      />
    </FormModal>
  );
}
