"use client";

import {
  Button,
  DegradedBanner,
  Field,
  FormModal,
  FormSection,
  Input,
  RadioGroup,
  RadioGroupItem,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { useCrmErrorText } from "../../../shared/hooks/useCrmErrorText";
import { CrmCustomFieldsFormSection } from "../../../shared/components/CrmCustomFieldsFormSection";
import type { useLeadConvert } from "../hooks/useLeadConvert";
import { ConversionContactFields } from "./ConversionContactFields";
import { ConversionOpportunityFields } from "./ConversionOpportunityFields";
import { ConversionOutcome } from "./ConversionOutcome";

export type LeadConvertState = ReturnType<typeof useLeadConvert>;

/** Centered Small form; review freezes the visible fields before the irreversible write. */
export function LeadConvertModal({ convert }: { convert: LeadConvertState }) {
  const { t } = useI18n();
  const describeError = useCrmErrorText();
  const { form, lead, result, errors } = convert;
  const disabled = convert.locked || convert.reviewing;
  const primary = convert.primaryContact;
  const serverError = convert.error?.code
    ? t.crmLeadConvert.serverErrors[convert.error.code as keyof typeof t.crmLeadConvert.serverErrors]
    : undefined;
  return (
    <FormModal open={convert.open} onOpenChange={(open) => { if (!open) convert.closeModal(); }}
      size="card" density="compact" title={t.crmLeadConvert.title}
      description={t.crmLeadConvert.description}
      isDirty={convert.isDirty} isSubmitting={convert.isSubmitting}
      hideSubmit={convert.hasReceipt}
      submitDisabled={convert.locked || !convert.canConvert}
      onSubmit={() => void convert.submit()}
      error={serverError ?? describeError(convert.error) ?? undefined}
      footerLeading={convert.reviewing && !convert.locked
        ? <Button size="sm" onClick={convert.back}>{t.crmLeadConvert.backToForm}</Button> : undefined}
      labels={{ submit: convert.reviewing ? t.crmLeadConvert.confirm : t.crmLeadConvert.reviewTitle,
        cancel: convert.hasReceipt ? t.common.close : t.common.cancel, close: t.common.close,
        discardTitle: t.common.discardTitle, discardDescription: t.common.discardDescription,
        discardConfirm: t.common.discardConfirm, discardCancel: t.common.cancel,
        sections: t.crmShared.formSectionsNav, sectionInvalid: t.crmShared.formSectionInvalid }}>
      <ConversionOutcome convert={convert} />
      {!result && form && lead && (
        <>
          {convert.reviewing && <p role="status" className="text-xs text-muted-foreground">{t.crmLeadConvert.reviewDescription}</p>}
          <FormSection id="profile" title={t.crmLeadConvert.steps.profile}>
            <Field label={t.crmLeadConvert.profileType} showLabel required hint={t.crmLeadConvert.targetTypeHint} error={errors.profileType}>
              <Select value={form.profileType} disabled={disabled}
                onValueChange={(value) => { if (value === "INDIVIDUAL" || value === "CORPORATE") convert.setField("profileType", value); }}>
                <SelectTrigger size="sm"><SelectValue /></SelectTrigger>
                <SelectContent>{(["INDIVIDUAL", "CORPORATE"] as const).map((type) => (
                  <SelectItem key={type} value={type}>{t.crmCustomerProfiles.profileTypes[type]}</SelectItem>
                ))}</SelectContent>
              </Select>
            </Field>
            <Field label={t.crmLeads.name} showLabel required={convert.createsOrganization && !form.companyName.trim()}
              hint={convert.createsOrganization ? t.crmLeadConvert.newCompanyNameHint
                : convert.usesContactPerson ? t.crmLeadConvert.contactNameFallback : t.crmLeadConvert.nameFallback} error={errors.displayName}>
              <Input size="sm" placeholder={t.crmLeads.name} value={form.displayName} maxLength={180} disabled={disabled}
                onBlur={() => { convert.validate(); }}
                onChange={(event) => convert.setField("displayName", event.target.value)} />
            </Field>
            {form.profileType === "CORPORATE" && <Field label={t.crmLeads.companyName} showLabel
              required={convert.createsOrganization && !form.displayName.trim()}
              hint={convert.createsOrganization ? t.crmLeadConvert.newCompanyNameHint : t.crmLeadConvert.nameFallback} error={errors.companyName}>
              <Input size="sm" placeholder={t.crmLeads.companyName} value={form.companyName} maxLength={180} disabled={disabled}
                onBlur={() => { convert.validate(); }}
                onChange={(event) => convert.setField("companyName", event.target.value)} />
            </Field>}
          </FormSection>
          <FormSection id="contact" title={t.crmLeadConvert.steps.contact}>
            <p className="text-xs text-muted-foreground md:col-span-2">
              {convert.usesContactPerson ? (primary ? t.crmLeadConvert.individualFromContact + ": " + primary.displayName
                  : t.crmLeadConvert.serverErrors.LEAD_CONVERSION_CONTACT_REQUIRED)
                : lead.leadProfileType === "INDIVIDUAL" ? t.crmLeadConvert.individualContact
                : primary ? t.crmLeadConvert.existingContact + ": " + primary.displayName : t.crmLeadConvert.noPrimaryContact}
            </p>
            {form.profileType === "CORPORATE" && <>
              <Field label={t.crmLeadConvert.newContact} hint={t.crmLeadConvert.newContactHint} className="md:col-span-2">
                <div className="flex items-center gap-2">
                  <Switch checked={form.newContact} disabled={disabled} onCheckedChange={(value) => convert.setField("newContact", value)} />
                  <span aria-hidden="true" className="text-xs">{t.crmLeadConvert.newContact}</span>
                </div>
              </Field>
              {form.newContact && <ConversionContactFields convert={convert} disabled={disabled} />}
            </>}
          </FormSection>
          <FormSection id="opportunity" title={t.crmLeadConvert.steps.opportunity}>
            <Field label={t.crmLeadConvert.createOpportunity} error={errors.createOpportunity}
              hint={!convert.canCreateOpportunity ? t.crmLeadConvert.opportunityNotPermitted : undefined} className="md:col-span-2">
              <div className="flex items-center gap-2">
                <Switch checked={form.createOpportunity} disabled={disabled || !convert.canCreateOpportunity}
                  onCheckedChange={(value) => convert.setField("createOpportunity", value)} />
                <span aria-hidden="true" className="text-xs">{t.crmLeadConvert.createOpportunity}</span>
              </div>
            </Field>
            {form.createOpportunity && <ConversionOpportunityFields convert={convert} disabled={disabled} />}
          </FormSection>
          {form.createOpportunity && convert.customFields.degraded && <DegradedBanner message={t.crmShared.customFieldsUnavailable} />}
          {form.createOpportunity && convert.customFields.definitions.length > 0 && (
            <CrmCustomFieldsFormSection definitions={convert.customFields.definitions}
              requiredFieldKeys={convert.customFields.requiredFieldKeys} values={form.customFields}
              errors={errors} disabled={disabled}
              onChange={(key, value) => convert.setField("customFields", { ...form.customFields, [key]: value })}
              onBlur={() => { convert.validate(); }} />
          )}
          <FormSection id="lead-record" title={t.crmLeadConvert.leadRecordSection}>
            <fieldset className="flex flex-col gap-1.5 md:col-span-2">
              <legend className="text-sm font-medium text-foreground">
                {t.crmLeadConvert.leadAfterConversion}
              </legend>
              <p className="text-xs text-muted-foreground">
                {t.crmLeadConvert.leadAfterConversionHint}
              </p>
              <RadioGroup
                aria-label={t.crmLeadConvert.leadAfterConversion}
                value={form.keepLead ? "keep" : "delete"}
                disabled={disabled}
                onValueChange={(value) => convert.setField("keepLead", value === "keep")}
              >
                <label
                  htmlFor="lead-conversion-keep"
                  className="flex cursor-pointer items-start gap-2 rounded-sm border border-border p-2.5"
                >
                  <RadioGroupItem
                    id="lead-conversion-keep"
                    value="keep"
                    aria-label={t.crmLeadConvert.keepLead}
                  />
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="text-sm font-medium text-foreground">
                      {t.crmLeadConvert.keepLead}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {t.crmLeadConvert.keepLeadHint}
                    </span>
                  </span>
                </label>
                <label
                  htmlFor="lead-conversion-delete"
                  className="flex cursor-pointer items-start gap-2 rounded-sm border border-border p-2.5"
                >
                  <RadioGroupItem
                    id="lead-conversion-delete"
                    value="delete"
                    aria-label={t.crmLeadConvert.deleteLead}
                  />
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="text-sm font-medium text-foreground">
                      {t.crmLeadConvert.deleteLead}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {t.crmLeadConvert.deleteLeadHint}
                    </span>
                  </span>
                </label>
              </RadioGroup>
            </fieldset>
          </FormSection>
        </>
      )}
    </FormModal>
  );
}
