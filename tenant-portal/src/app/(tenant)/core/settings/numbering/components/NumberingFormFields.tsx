"use client";

import {
  Field,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { TENANT_WIDE_COMPANY, type CompanyOption } from "../../company-options";
import {
  NUMBERING_CODE_MAX_LENGTH,
  NUMBERING_PREFIX_MAX_LENGTH,
  type NumberingFormValues,
} from "../numbering-contract";
import { NumberingPreview } from "./NumberingPreview";

interface NumberingFormFieldsProps {
  values: NumberingFormValues;
  onChange: (patch: Partial<NumberingFormValues>) => void;
  companies: CompanyOption[];
  isSubmitting: boolean;
  /** `UpdateNumberingSequenceDto` carries neither `code` nor `companyId`. */
  scopeReadOnly: boolean;
  counterLabel: string;
  counterHint: string;
}

export function NumberingFormFields({
  values,
  onChange,
  companies,
  isSubmitting,
  scopeReadOnly,
  counterLabel,
  counterHint,
}: NumberingFormFieldsProps) {
  const { t } = useI18n();

  return (
    <div className="flex flex-col gap-4">
      <NumberingPreview values={values} />

      <Field
        label={t.coreSettings.numberingScope}
        hint={t.coreSettings.numberingScopeHint}
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
            <SelectItem value={TENANT_WIDE_COMPANY}>
              {t.coreSettings.numberingTenantWide}
            </SelectItem>
            {companies.map((company) => (
              <SelectItem key={company.id} value={company.id}>
                {`${company.code} — ${company.name}`}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <Field
        label={t.coreSettings.numberingCode}
        hint={t.coreSettings.numberingCodeHint}
        readOnly={scopeReadOnly}
        required
      >
        <Input
          dir="ltr"
          value={values.code}
          onChange={(event) => onChange({ code: event.target.value.toUpperCase() })}
          maxLength={NUMBERING_CODE_MAX_LENGTH}
          disabled={isSubmitting}
          readOnly={scopeReadOnly}
          required
        />
      </Field>

      <Field label={t.coreSettings.numberingPrefix} hint={t.coreSettings.numberingPrefixHint}>
        <Input
          dir="ltr"
          value={values.prefix}
          onChange={(event) => onChange({ prefix: event.target.value })}
          maxLength={NUMBERING_PREFIX_MAX_LENGTH}
          disabled={isSubmitting}
        />
      </Field>

      <Field label={t.coreSettings.numberingPadding} hint={t.coreSettings.numberingPaddingHint} required>
        <Input
          dir="ltr"
          inputMode="numeric"
          value={values.padding}
          onChange={(event) => onChange({ padding: event.target.value })}
          maxLength={2}
          disabled={isSubmitting}
          required
        />
      </Field>

      <Field label={counterLabel} hint={counterHint} required>
        <Input
          dir="ltr"
          inputMode="numeric"
          value={values.startValue}
          onChange={(event) => onChange({ startValue: event.target.value })}
          maxLength={16}
          disabled={isSubmitting}
          required
        />
      </Field>
    </div>
  );
}
