"use client";

import { AlertCircle, Lock } from "lucide-react";
import {
  Field,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
  cn,
  iconSize,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import {
  TENANT_WIDE_COMPANY,
  companyLabel,
  type CompanyOption,
} from "../../company-options";
import { TAX_CODE_MAX_LENGTH, TAX_NAME_MAX_LENGTH, type TaxFormValues } from "../tax-contract";
import {
  taxFieldAnchorId,
  type TaxErrorSummaryItem,
  type TaxFormFieldErrors,
  type TaxFormFieldKey,
} from "../tax-validation";
import { TaxFormErrorSummary } from "./TaxFormErrorSummary";

export interface TaxFormFieldsProps {
  idPrefix: string;
  values: TaxFormValues;
  errors: TaxFormFieldErrors;
  summaryItems: readonly TaxErrorSummaryItem[];
  onSummaryNavigate: (event: React.MouseEvent<HTMLAnchorElement>, anchorId: string) => void;
  onChange: (patch: Partial<TaxFormValues>) => void;
  onBlur: (field: TaxFormFieldKey) => void;
  companies: readonly CompanyOption[];
  tenantWideAllowed: boolean;
  isSubmitting: boolean;
  /** `UpdateTaxDto` carries neither `code` nor `companyId` — the scope key is fixed. */
  scopeReadOnly: boolean;
}

export function TaxFormFields({
  idPrefix,
  values,
  errors,
  summaryItems,
  onSummaryNavigate,
  onChange,
  onBlur,
  companies,
  tenantWideAllowed,
  isSubmitting,
  scopeReadOnly,
}: TaxFormFieldsProps) {
  const { t } = useI18n();
  const hasMultipleScopeChoices = (tenantWideAllowed ? 1 : 0) + companies.length > 1;
  const scopeDisplayValue = companyLabel(
    companies,
    values.companyId,
    t.coreSettings.taxTenantWide,
    t.coreSettings.unknownCompany,
  );

  return (
    <div className="flex flex-col gap-3">
      <TaxFormErrorSummary items={summaryItems} onNavigate={onSummaryNavigate} />

      {scopeReadOnly ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div id={taxFieldAnchorId(idPrefix, "companyId")}>
            <Field showLabel label={t.coreSettings.taxCompany} readOnly>
              <div className="relative">
                <Input size="sm" value={scopeDisplayValue} readOnly className="pe-8 font-sans font-normal text-caption sm:text-caption" />
                <Lock
                  aria-hidden="true"
                  className={cn(
                    iconSize({ size: "sm" }),
                    "pointer-events-none absolute end-2.5 top-1/2 -translate-y-1/2 text-muted-foreground",
                  )}
                />
              </div>
            </Field>
          </div>

          <div id={taxFieldAnchorId(idPrefix, "code")}>
            <Field showLabel label={t.coreSettings.taxCode} readOnly>
              <div dir="ltr" className="relative">
                <Input
                  size="sm"
                  dir="ltr"
                  value={values.code}
                  readOnly
                  className="pe-8 font-mono"
                />
                <Lock
                  aria-hidden="true"
                  className={cn(
                    iconSize({ size: "sm" }),
                    "pointer-events-none absolute end-2.5 top-1/2 -translate-y-1/2 text-muted-foreground",
                  )}
                />
              </div>
            </Field>
          </div>
        </div>
      ) : (
        <>
          <div id={taxFieldAnchorId(idPrefix, "companyId")}>
            <Field
              showLabel
              label={
                tenantWideAllowed
                  ? t.coreSettings.taxCompanyOptional
                  : t.coreSettings.taxCompany
              }
              hint={hasMultipleScopeChoices ? t.coreSettings.taxScopeDeterminesHint : undefined}
              required={!tenantWideAllowed}
              error={errors.companyId}
            >
              <Select
                value={values.companyId ?? TENANT_WIDE_COMPANY}
                onValueChange={(value) =>
                  onChange({ companyId: value === TENANT_WIDE_COMPANY ? null : value })
                }
                disabled={isSubmitting || !hasMultipleScopeChoices}
              >
                <SelectTrigger textSize="compact" size="sm" onBlur={() => onBlur("companyId")}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent textSize="compact">
                  {tenantWideAllowed ? (
                    <SelectItem value={TENANT_WIDE_COMPANY}>
                      {t.coreSettings.taxTenantWide}
                    </SelectItem>
                  ) : null}
                  {companies.map((company) => (
                    <SelectItem key={company.id} value={company.id}>
                      {company.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <div id={taxFieldAnchorId(idPrefix, "code")}>
            <Field showLabel label={t.coreSettings.taxCode} required error={errors.code}>
              <div dir="ltr" className="relative">
                <Input
                  size="sm"
                  placeholder={t.coreSettings.taxCode}
                  dir="ltr"
                  value={values.code}
                  onChange={(event) => onChange({ code: event.target.value.toUpperCase() })}
                  onBlur={() => onBlur("code")}
                  maxLength={TAX_CODE_MAX_LENGTH}
                  disabled={isSubmitting}
                  required
                  className={cn("font-mono", errors.code && "pe-8")}
                />
                {errors.code ? (
                  <AlertCircle
                    aria-hidden="true"
                    className={cn(
                      iconSize({ size: "sm" }),
                      "pointer-events-none absolute end-2.5 top-1/2 -translate-y-1/2 text-destructive",
                    )}
                  />
                ) : null}
              </div>
            </Field>
          </div>
        </>
      )}

      <div id={taxFieldAnchorId(idPrefix, "name")}>
        <Field showLabel label={t.coreSettings.taxName} required error={errors.name}>
          <Input
            size="sm"
            placeholder={t.coreSettings.taxName}
            value={values.name}
            onChange={(event) => onChange({ name: event.target.value })}
            onBlur={() => onBlur("name")}
            maxLength={TAX_NAME_MAX_LENGTH}
            disabled={isSubmitting}
            required
          />
        </Field>
      </div>

      <div id={taxFieldAnchorId(idPrefix, "rate")}>
        <Field showLabel label={t.coreSettings.taxRate} required error={errors.rate}>
          <div dir="ltr" className="flex items-stretch">
            <span
              aria-hidden="true"
              className={cn(
                "inline-flex shrink-0 items-center justify-center rounded-s-md border border-e-0 px-2.5 text-xs font-medium select-none",
                errors.rate
                  ? "border-destructive bg-destructive-subtle text-destructive"
                  : "border-input bg-muted/50 text-muted-foreground",
              )}
            >
              %
            </span>
            <Input
              size="sm"
              placeholder={t.coreSettings.taxRate}
              dir="ltr"
              inputMode="decimal"
              value={values.rate}
              onChange={(event) => onChange({ rate: event.target.value })}
              onBlur={() => onBlur("rate")}
              disabled={isSubmitting}
              required
              className="rounded-s-none tabular-nums"
            />
          </div>
        </Field>
      </div>

      <Field
        showLabel
        label={t.coreSettings.taxPriceIncludes}
        className="flex-row items-center gap-3 py-0.5"
      >
        <Switch
          checked={values.isInclusive}
          onCheckedChange={(checked) => onChange({ isInclusive: checked })}
          disabled={isSubmitting}
        />
      </Field>

      {scopeReadOnly ? (
        <div id={taxFieldAnchorId(idPrefix, "status")}>
          <Field showLabel label={t.common.status} required error={errors.status}>
            <Select
              value={values.status ?? "ACTIVE"}
              onValueChange={(value) => {
                if (value === "ACTIVE" || value === "INACTIVE") {
                  onChange({ status: value });
                }
              }}
              disabled={isSubmitting}
            >
              <SelectTrigger size="sm" onBlur={() => onBlur("status")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ACTIVE">
                  <span className="inline-flex items-center gap-2">
                    <span aria-hidden="true" className="size-2 rounded-full bg-success-vivid" />
                    <span>{t.common.active}</span>
                  </span>
                </SelectItem>
                <SelectItem value="INACTIVE">
                  <span className="inline-flex items-center gap-2">
                    <span aria-hidden="true" className="size-2 rounded-full bg-destructive-vivid" />
                    <span>{t.common.inactive}</span>
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </div>
      ) : null}
    </div>
  );
}
