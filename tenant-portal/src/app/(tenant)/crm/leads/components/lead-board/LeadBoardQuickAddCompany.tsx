"use client";

import { Button, Combobox, Field, Input, cn } from "@/design-system";
import { CrmPhoneListField } from "../../../shared/components/CrmPhoneListField";
import { LEAD_CREATE_LIMITS } from "../../lead-create-contract";
import type { useLeadBoardQuickAdd } from "./useLeadBoardQuickAdd";
import { LeadBoardQuickAddSource } from "./LeadBoardQuickAddSource";

type Form = ReturnType<typeof useLeadBoardQuickAdd>;

export function LeadBoardQuickAddCompany({ form }: { form: Form }) {
  const {
    t,
    companyMode,
    existingCompanyPartyId,
    selectedCompanyName,
    companyName,
    contactFirstName,
    contactLastName,
    companyPhones,
    contactPhones,
    errors,
    isSubmitting,
    companyLookup,
    companyComboboxOptions,
    selectedCompany,
    changeText,
    changeCompanyMode,
    changeExistingCompany,
    changePhone,
    addPhone,
    removePhone,
    handlePhoneBlur,
    handleKeyDown,
  } = form;
  return (<>
    <div className="grid grid-cols-2 gap-1 rounded-lg border border-border bg-card p-0.5">
      <Button
        type="button"
        variant="ghost"
        size="xs"
        onClick={() => changeCompanyMode("new")}
        className={cn(
          "rounded-md py-1 text-xs font-semibold transition-all",
          companyMode === "new"
            ? "bg-count-active-surface text-chip-active-fg shadow-2xs hover:bg-count-active-surface"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        {t.crmLeads.executive.newCompany}
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="xs"
        onClick={() => changeCompanyMode("existing")}
        className={cn(
          "rounded-md py-1 text-xs font-semibold transition-all",
          companyMode === "existing"
            ? "bg-count-active-surface text-chip-active-fg shadow-2xs hover:bg-count-active-surface"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        {t.crmLeads.executive.existingCompany}
      </Button>
    </div>

    {companyMode === "new" ? (
      <Field
        label={t.crmLeads.companyName}
        required
        error={errors.companyName}
      >
        <Input
          size="sm"
          value={companyName}
          maxLength={LEAD_CREATE_LIMITS.companyName}
          onChange={(event) => changeText("companyName", event.target.value)}
          onKeyDown={handleKeyDown}
        />
      </Field>
    ) : (
      <Field
        label={t.crmLeads.executive.existingCompany}
        required
        error={errors.existingCompanyPartyId}
      >
        <Combobox
          size="sm"
          options={companyComboboxOptions}
          value={existingCompanyPartyId}
          selectedLabel={selectedCompany?.displayName || selectedCompanyName || undefined}
          onValueChange={changeExistingCompany}
          onSearch={companyLookup.searchCompanies}
          debounceMs={0}
          loading={companyLookup.isLoadingCompanies}
          loadingLabel={t.common.loading}
          placeholder={t.crmLeads.executive.selectExistingCompany}
          searchPlaceholder={t.crmShared.searchCompanies}
          emptyLabel={t.crmShared.noMatchingCompanies}
        />
      </Field>
    )}

    <LeadBoardQuickAddSource form={form} />

    {companyMode === "new" && (
      <CrmPhoneListField
        label={t.crmLeads.create.companyPhones}
        phones={companyPhones}
        path="companyPhones"
        errors={errors}
        disabled={isSubmitting}
        onChange={(index, value) => changePhone("companyPhones", index, value)}
        onAdd={() => addPhone("companyPhones")}
        onRemove={(index) => removePhone("companyPhones", index)}
        onBlur={handlePhoneBlur}
      />
    )}

    <div className="grid grid-cols-2 gap-2">
      <Field
        label={t.crmLeads.create.firstName}
        required
        error={errors.contactFirstName}
      >
        <Input
          size="sm"
          value={contactFirstName}
          maxLength={LEAD_CREATE_LIMITS.firstName}
          onChange={(event) => changeText("contactFirstName", event.target.value)}
          placeholder={t.crmLeads.executive.firstName}
        />
      </Field>
      <Field
        label={t.crmLeads.create.lastName}
        error={errors.contactLastName}
      >
        <Input
          size="sm"
          value={contactLastName}
          maxLength={LEAD_CREATE_LIMITS.lastName}
          onChange={(event) => changeText("contactLastName", event.target.value)}
          placeholder={t.crmLeads.executive.lastName}
        />
      </Field>
    </div>

    <CrmPhoneListField
      label={t.crmLeads.executive.contactPhone}
      phones={contactPhones}
      path="contactPhones"
      errors={errors}
      disabled={isSubmitting}
      onChange={(index, value) => changePhone("contactPhones", index, value)}
      onAdd={() => addPhone("contactPhones")}
      onRemove={(index) => removePhone("contactPhones", index)}
      onBlur={handlePhoneBlur}
    />
  </>
  );
}
