"use client";

import { Lock } from "lucide-react";
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
import {
  TENANT_WIDE_COMPANY,
  companyLabel,
  type CompanyOption,
} from "../../company-options";
import {
  NUMBERING_CODE_MAX_LENGTH,
  NUMBERING_PREFIX_MAX_LENGTH,
  type NumberingFormValues,
} from "../numbering-contract";
import type { NumberingFieldErrors, NumberingFieldKey } from "../numbering-form-validation";
import { NumberingPreview } from "./NumberingPreview";

const ROW_FIELD_CLASS =
  "sm:grid sm:grid-cols-[8.5rem_minmax(0,1fr)] sm:items-start sm:gap-x-3 sm:gap-y-1 [&>div:first-child]:sm:min-h-(--size-control-sm) [&>p]:sm:col-start-2";

interface NumberingFormFieldsProps {
  readonly values: NumberingFormValues;
  readonly onChange: (patch: Partial<NumberingFormValues>) => void;
  readonly onBlurField: (key: NumberingFieldKey) => void;
  readonly errors: NumberingFieldErrors;
  readonly fieldAnchorIds: Readonly<Record<NumberingFieldKey, string>>;
  readonly companies: CompanyOption[];
  readonly tenantWideAllowed: boolean;
  readonly isSubmitting: boolean;
  /** `UpdateNumberingSequenceDto` carries neither `code` nor `companyId`. */
  readonly scopeReadOnly: boolean;
  readonly counterLabel: string;
}

export function NumberingFormFields({
  values,
  onChange,
  onBlurField,
  errors,
  fieldAnchorIds,
  companies,
  tenantWideAllowed,
  isSubmitting,
  scopeReadOnly,
  counterLabel,
}: NumberingFormFieldsProps) {
  const { t, dir } = useI18n();
  const scopeText = companyLabel(
    companies,
    values.companyId,
    t.coreSettings.numberingTenantWide,
    t.coreSettings.unknownCompany,
  );

  return (
    <div className="flex flex-col gap-3">
      <div id={fieldAnchorIds.code}>
        <Field
          className={ROW_FIELD_CLASS}
          label={t.coreSettings.numberingCode}
          showLabel
          readOnly={scopeReadOnly}
          required={!scopeReadOnly}
          error={errors.code}
        >
          {scopeReadOnly ? (
            <div dir="ltr" className="relative">
              <Input
                data-numbering-field="code"
                size="sm"
                dir="ltr"
                value={values.code}
                readOnly
                className="pe-8 font-mono"
              />
              <Lock
                className="pointer-events-none absolute end-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
            </div>
          ) : (
            <Input
              data-numbering-field="code"
              size="sm"
              placeholder={t.coreSettings.numberingCode}
              dir="ltr"
              value={values.code}
              onChange={(event) => onChange({ code: event.target.value.toUpperCase() })}
              onBlur={() => onBlurField("code")}
              maxLength={NUMBERING_CODE_MAX_LENGTH}
              disabled={isSubmitting}
              required
              className="font-mono"
            />
          )}
        </Field>
      </div>

      <div id={fieldAnchorIds.companyId}>
        <Field
          className={ROW_FIELD_CLASS}
          label={t.coreIdentity.cascade.company}
          showLabel
          readOnly={scopeReadOnly}
          hint={!scopeReadOnly && tenantWideAllowed ? t.coreSettings.numberingScopeHint : undefined}
          hintPlacement="tooltip"
          error={errors.companyId}
        >
          {scopeReadOnly ? (
            <div className="relative">
              <Input
                data-numbering-field="companyId"
                size="sm"
                value={scopeText}
                readOnly
                className="pe-8 font-sans font-normal text-caption sm:text-caption"
              />
              <Lock
                className="pointer-events-none absolute end-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
            </div>
          ) : (
            <Select
              dir={dir}
              value={values.companyId ?? TENANT_WIDE_COMPANY}
              onValueChange={(value) =>
                onChange({ companyId: value === TENANT_WIDE_COMPANY ? null : value })
              }
              disabled={isSubmitting || companies.length === 0}
            >
              <SelectTrigger textSize="compact"
                data-numbering-field="companyId"
                size="sm"
                onBlur={() => onBlurField("companyId")}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent textSize="compact">
                {tenantWideAllowed ? (
                  <SelectItem value={TENANT_WIDE_COMPANY}>
                    {t.coreSettings.numberingTenantWide}
                  </SelectItem>
                ) : null}
                {companies.map((company) => (
                  <SelectItem key={company.id} value={company.id}>
                    {companyLabel(
                      companies,
                      company.id,
                      t.coreSettings.numberingTenantWide,
                      t.coreSettings.unknownCompany,
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </Field>
      </div>

      <div id={fieldAnchorIds.prefix}>
        <Field
          className={ROW_FIELD_CLASS}
          label={t.coreSettings.numberingPrefix}
          showLabel
          error={errors.prefix}
        >
          <Input
            data-numbering-field="prefix"
            size="sm"
            placeholder={t.coreSettings.numberingPrefix}
            dir="ltr"
            value={values.prefix}
            onChange={(event) => onChange({ prefix: event.target.value })}
            onBlur={() => onBlurField("prefix")}
            maxLength={NUMBERING_PREFIX_MAX_LENGTH * 2}
            disabled={isSubmitting}
          />
        </Field>
      </div>

      <div id={fieldAnchorIds.padding}>
        <Field
          className={ROW_FIELD_CLASS}
          label={t.coreSettings.numberingPadding}
          showLabel
          required
          error={errors.padding}
        >
          <Input
            data-numbering-field="padding"
            size="sm"
            placeholder={t.coreSettings.numberingPadding}
            dir="ltr"
            inputMode="numeric"
            value={values.padding}
            onChange={(event) => onChange({ padding: event.target.value })}
            onBlur={() => onBlurField("padding")}
            maxLength={2}
            disabled={isSubmitting}
            required
          />
        </Field>
      </div>

      <div id={fieldAnchorIds.startValue}>
        <Field
          className={ROW_FIELD_CLASS}
          label={counterLabel}
          showLabel
          required
          error={errors.startValue}
        >
          <Input
            data-numbering-field="startValue"
            size="sm"
            placeholder={counterLabel}
            dir="ltr"
            inputMode="numeric"
            value={values.startValue}
            onChange={(event) => onChange({ startValue: event.target.value })}
            onBlur={() => onBlurField("startValue")}
            maxLength={20}
            disabled={isSubmitting}
            required
          />
        </Field>
      </div>

      <NumberingPreview values={values} showServerValue={scopeReadOnly} />
    </div>
  );
}
