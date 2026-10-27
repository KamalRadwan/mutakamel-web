"use client";

import { Button, Combobox, Field, Input, cn } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { CrmPhoneListField } from "../../../shared/components/CrmPhoneListField";
import { CUSTOMER_PROFILE_CREATE_LIMITS } from "../../customer-profile-create-contract";
import type { CustomerBoardQuickAddProps } from "./customer-board-types";
import type { useCustomerBoardQuickAdd } from "./useCustomerBoardQuickAdd";
import { CustomerBoardQuickAddNames } from "./CustomerBoardQuickAddNames";
import { CustomerBoardQuickAddSource } from "./CustomerBoardQuickAddSource";

export function CustomerBoardQuickAddCompany({ sources, form }: {
  sources: CustomerBoardQuickAddProps["sources"]; form: ReturnType<typeof useCustomerBoardQuickAdd>;
}) {
  const { t } = useI18n();
  const { companyMode, errors } = form;
  return (
    <>
      <div className="grid grid-cols-2 gap-1 rounded-lg border border-line-card bg-card p-0.5">
        <Button type="button" variant="ghost" size="xs" onClick={() => form.changeCompanyMode("new")}
          aria-pressed={companyMode === "new"}
          className={cn("rounded-md text-caption", companyMode === "new" && "bg-count-active-surface text-count-active-fg")}>
          {t.crmCustomerProfiles.ui.board.new_company}
        </Button>
        <Button type="button" variant="ghost" size="xs" onClick={() => form.changeCompanyMode("existing")}
          aria-pressed={companyMode === "existing"}
          className={cn("rounded-md text-caption", companyMode === "existing" && "bg-count-active-surface text-count-active-fg")}>
          {t.crmCustomerProfiles.ui.board.existing_company}
        </Button>
      </div>
      {companyMode === "new" ? (
        <Field label={t.crmLeads.companyName} required error={errors.companyName}>
          <Input size="sm" {...form.textField("companyName")} maxLength={CUSTOMER_PROFILE_CREATE_LIMITS.companyName}
            placeholder={t.crmLeads.companyName} />
        </Field>
      ) : (
        <Field label={t.crmCustomerProfiles.ui.board.existing_company} required error={errors.existingCompanyPartyId}>
          <Combobox size="sm" options={form.companyComboboxOptions} value={form.existingCompanyPartyId}
            selectedLabel={form.selectedCompany?.displayName || form.selectedCompanyName || undefined}
            onValueChange={(next) => form.selectCompany(next ?? null)} onSearch={form.setCompanyQuery} debounceMs={0}
            loading={form.companyLookup.isLoadingCompanies} loadingLabel={t.common.loading}
            placeholder={t.crmCustomerProfiles.ui.board.select_existing_company}
            searchPlaceholder={t.crmShared.searchCompanies} emptyLabel={t.crmShared.noMatchingCompanies} />
        </Field>
      )}
      <CustomerBoardQuickAddSource sources={sources} form={form} />
      {companyMode === "new" && <CrmPhoneListField label={t.crmLeads.create.companyPhones} {...form.phoneField("companyPhones")} />}
      <CustomerBoardQuickAddNames form={form} contact />
      <CrmPhoneListField label={t.crmCustomerProfiles.ui.board.contact_phone} {...form.phoneField("contactPhones")} />
    </>
  );
}
