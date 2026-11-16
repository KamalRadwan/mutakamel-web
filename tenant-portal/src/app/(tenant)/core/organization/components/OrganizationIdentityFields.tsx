"use client";
import { Field, Input } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { ORG_CODE_MAX_LENGTH, ORG_CURRENCY_CODE_LENGTH, ORG_NAME_MAX_LENGTH } from "../../contracts/organization-contract";
import type { OrgFormValidations } from "../hooks/useOrganizationForm";
import type { OrgLevelConfig } from "../level-config";
import type { OrgNodeFormValues } from "../organization-payloads";

export function OrganizationIdentityFields({ config, values, onChange, mode, isSubmitting, currencyRequired, validations }: {
  config: OrgLevelConfig;
  values: OrgNodeFormValues;
  onChange: (patch: Partial<OrgNodeFormValues>) => void;
  mode: "create" | "edit";
  isSubmitting: boolean;
  currencyRequired: boolean;
  validations?: OrgFormValidations;
}) {
  const { t } = useI18n();
  const copy = t.coreIdentity;
  const levelCopy = copy.levels[config.level];
  return <>
    <Field label={levelCopy.nameLabel} error={validations?.name.error} required showLabel>
      <Input size="sm" placeholder={levelCopy.nameLabel} value={values.name}
        onChange={event => onChange({ name: event.target.value })}
        onBlur={validations?.name.fieldProps.onBlur} maxLength={ORG_NAME_MAX_LENGTH}
        disabled={isSubmitting} required />
    </Field>
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Field label={copy.fields.code} hint={copy.fields.codeHint} error={validations?.code.error}
        required={mode === "create"} readOnly={mode === "edit"} showLabel>
        <Input size="sm" placeholder={copy.fields.code} dir="ltr" value={values.code}
          onChange={event => onChange({ code: event.target.value })}
          onBlur={validations?.code.fieldProps.onBlur} maxLength={ORG_CODE_MAX_LENGTH}
          readOnly={mode === "edit"} disabled={isSubmitting} required={mode === "create"} />
      </Field>
      {config.fields.includes("currencyCode") ? <Field label={copy.fields.currencyCode}
        hint={currencyRequired ? copy.fields.currencyCodeRequiredHint : copy.fields.currencyCodeHint}
        error={validations?.currencyCode.error} required={currencyRequired} showLabel>
        <Input size="sm" placeholder={copy.fields.currencyCode} dir="ltr" value={values.currencyCode}
          onChange={event => onChange({ currencyCode: event.target.value })}
          onBlur={validations?.currencyCode.fieldProps.onBlur} maxLength={ORG_CURRENCY_CODE_LENGTH}
          disabled={isSubmitting} required={currencyRequired} />
      </Field> : null}
    </div>
  </>;
}
