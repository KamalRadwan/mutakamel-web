"use client";

import { Field, FormSection } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { localizedValue } from "@/lib/format/localized";
import type { CustomFieldItem } from "../../custom-fields/custom-field-contract";
import { CustomFieldValueInput } from "./CustomFieldValueInput";
import type { CrmFormErrors } from "../hooks/useCrmCreateForm";

export interface CrmCustomFieldsFormSectionProps {
  definitions: CustomFieldItem[];
  requiredFieldKeys: readonly string[];
  values: Record<string, unknown>;
  errors: CrmFormErrors;
  disabled: boolean;
  onChange: (fieldKey: string, value: unknown) => void;
  onBlur: (path: string) => void;
}

/**
 * The tenant's own fields, for any CRM create form.
 *
 * Not an optional extra: every CRM create service runs `saveCustomFieldValues`
 * with `CrmFieldRequirementOperationEnum.CREATE`, so a definition marked
 * required-on-create makes the whole write fail with `422 CUSTOM_FIELD_REQUIRED`.
 * Leaving these off a form would be a create screen a tenant cannot submit.
 *
 * Values are keyed by `fieldKey` — `resolveDefinition` accepts either the key
 * or the definition id, and sending BOTH aliases for one definition is
 * `422 CUSTOM_FIELD_INVALID`, so the form commits to one and only one.
 */
export function CrmCustomFieldsFormSection({
  definitions,
  requiredFieldKeys,
  values,
  errors,
  disabled,
  onChange,
  onBlur,
}: CrmCustomFieldsFormSectionProps) {
  const { t, lang } = useI18n();

  return (
    <FormSection
      id="customFields"
      title={t.crmShared.customFieldsTitle}
      description={t.crmShared.customFieldsFormDescription}
    >
      {definitions.map((definition) => (
        <Field
          key={definition.id}
          label={localizedValue(definition.nameAr, definition.nameEn, lang)}
          required={requiredFieldKeys.includes(definition.fieldKey)}
          error={errors[`customFields.${definition.fieldKey}`]}
          className={definition.type === "TEXTAREA" ? "md:col-span-2" : undefined}
        >
          {/* Blur is wired on the wrapper: the control is chosen by the field's
              declared type, and only some of the eleven are inputs that would
              take an onBlur prop of their own. */}
          <div onBlur={() => onBlur(`customFields.${definition.fieldKey}`)}>
            <CustomFieldValueInput
              field={definition}
              value={values[definition.fieldKey]}
              disabled={disabled}
              onChange={(next) => onChange(definition.fieldKey, next)}
            />
          </div>
        </Field>
      ))}
    </FormSection>
  );
}
