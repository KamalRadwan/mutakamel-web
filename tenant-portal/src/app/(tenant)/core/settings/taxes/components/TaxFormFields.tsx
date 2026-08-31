"use client";

import {
  Field,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { TENANT_WIDE_COMPANY, type CompanyOption } from "../../company-options";
import { TAX_CODE_MAX_LENGTH, TAX_NAME_MAX_LENGTH, type TaxFormValues } from "../tax-contract";

interface TaxFormFieldsProps {
  values: TaxFormValues;
  onChange: (patch: Partial<TaxFormValues>) => void;
  companies: CompanyOption[];
  isSubmitting: boolean;
  /** `UpdateTaxDto` carries neither `code` nor `companyId` — the scope key is fixed. */
  scopeReadOnly: boolean;
}

export function TaxFormFields({
  values,
  onChange,
  companies,
  isSubmitting,
  scopeReadOnly,
}: TaxFormFieldsProps) {
  const { t } = useI18n();

  return (
    <div className="flex flex-col gap-4">
      <Field
        label={t.coreSettings.taxScope}
        hint={t.coreSettings.taxScopeHint}
        readOnly={scopeReadOnly}
      >
        <Select
          value={values.companyId ?? TENANT_WIDE_COMPANY}
          onValueChange={(value) =>
            onChange({ companyId: value === TENANT_WIDE_COMPANY ? null : value })
          }
          disabled={scopeReadOnly || isSubmitting || companies.length === 0}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TENANT_WIDE_COMPANY}>{t.coreSettings.taxTenantWide}</SelectItem>
            {companies.map((company) => (
              <SelectItem key={company.id} value={company.id}>
                {`${company.code} — ${company.name}`}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <Field
        label={t.coreSettings.taxCode}
        hint={t.coreSettings.taxCodeHint}
        readOnly={scopeReadOnly}
        required
      >
        <Input
          dir="ltr"
          value={values.code}
          onChange={(event) => onChange({ code: event.target.value.toUpperCase() })}
          maxLength={TAX_CODE_MAX_LENGTH}
          disabled={isSubmitting}
          readOnly={scopeReadOnly}
          required
        />
      </Field>

      <Field label={t.coreSettings.taxName} required>
        <Input
          value={values.name}
          onChange={(event) => onChange({ name: event.target.value })}
          maxLength={TAX_NAME_MAX_LENGTH}
          disabled={isSubmitting}
          required
        />
      </Field>

      <Field label={t.coreSettings.taxRate} hint={t.coreSettings.taxRateHint} required>
        <Input
          dir="ltr"
          inputMode="decimal"
          value={values.rate}
          onChange={(event) => onChange({ rate: event.target.value })}
          disabled={isSubmitting}
          required
        />
      </Field>

      <Field label={t.coreSettings.taxInclusive} hint={t.coreSettings.taxInclusiveHint}>
        <Switch
          checked={values.isInclusive}
          onCheckedChange={(checked) => onChange({ isInclusive: checked })}
          disabled={isSubmitting}
        />
      </Field>
    </div>
  );
}
