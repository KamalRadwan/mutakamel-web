"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Badge, Button, Card, Field as FormField, Input } from "@/design-system";
import type { useTenantCoreWorkspace } from "../hooks/useTenantCoreWorkspace";
import type { TenantProfileDraft } from "../types";
import {
  tenantWorkspaceCopy,
  type TenantWorkspaceLocale,
} from "./copy";

export interface TenantProfilePanelProps {
  locale: TenantWorkspaceLocale;
  workspace: ReturnType<typeof useTenantCoreWorkspace>;
}

const COUNTRY_ISO_PATTERN = /^[A-Z]{2}$/;

const profileLabels = {
  en: {
    companyName: "Company name",
    countryName: "Country",
    countryIsoCode: "Country ISO",
    industry: "Industry",
    timezone: "Timezone",
    phoneCountryCode: "Calling code",
    phone: "Phone",
    taxNumber: "Tax number",
    commercialRegistrationNumber: "Commercial registration",
    city: "City",
    state: "State",
    district: "District",
    street1: "Street 1",
    street2: "Street 2",
    buildingNo: "Building",
    postalCode: "Postal code",
    landmark: "Landmark",
    formattedAddress: "Formatted address",
    placement: "Read-only placement",
    validationTitle: "Review the required profile fields.",
    requiredField: "This field is required.",
    invalidIso: "Use a two-letter country code.",
  },
  ar: {
    companyName: "اسم الشركة",
    countryName: "الدولة",
    countryIsoCode: "رمز الدولة",
    industry: "النشاط",
    timezone: "المنطقة الزمنية",
    phoneCountryCode: "مفتاح الاتصال",
    phone: "الهاتف",
    taxNumber: "الرقم الضريبي",
    commercialRegistrationNumber: "السجل التجاري",
    city: "المدينة",
    state: "المحافظة",
    district: "الحي",
    street1: "الشارع الأول",
    street2: "الشارع الثاني",
    buildingNo: "المبنى",
    postalCode: "الرمز البريدي",
    landmark: "علامة مميزة",
    formattedAddress: "العنوان المنسق",
    placement: "التسكين للقراءة فقط",
    validationTitle: "راجع الحقول المطلوبة في الملف التعريفي.",
    requiredField: "هذا الحقل مطلوب.",
    invalidIso: "استخدم رمز دولة مكونًا من حرفين.",
  },
} as const;

export function TenantProfilePanel({
  locale,
  workspace,
}: TenantProfilePanelProps) {
  const text = tenantWorkspaceCopy(locale);
  const labels = profileLabels[locale];
  const errorSummaryRef = useRef<HTMLDivElement>(null);
  const [errors, setErrors] = useState<Partial<Record<"companyName" | "countryName" | "countryIsoCode", string>>>({});
  const draft = workspace.profileDraft;
  const tenant = workspace.tenant;
  useEffect(() => {
    if (Object.keys(errors).length) errorSummaryRef.current?.focus();
  }, [errors]);

  if (!draft || !tenant) return null;

  const disabled =
    !workspace.permissions.canUpdate || workspace.mutation.name !== null;

  const update = <Key extends keyof TenantProfileDraft>(
    key: Key,
    value: TenantProfileDraft[Key],
  ) => {
    workspace.updateProfileDraft({ [key]: value });
    if (key === "companyName" || key === "countryName" || key === "countryIsoCode") {
      const requiredKey = key as "companyName" | "countryName" | "countryIsoCode";
      setErrors((current) => {
        if (!current[requiredKey]) return current;
        const next = { ...current };
        delete next[requiredKey];
        return next;
      });
    }
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const nextErrors: typeof errors = {};
    if (!draft.companyName.trim()) nextErrors.companyName = labels.requiredField;
    if (!draft.countryName.trim()) nextErrors.countryName = labels.requiredField;
    if (!COUNTRY_ISO_PATTERN.test(draft.countryIsoCode.trim())) nextErrors.countryIsoCode = labels.invalidIso;
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      return;
    }
    setErrors({});
    void workspace.saveProfile().catch(() => undefined);
  };

  return (
    <section aria-labelledby="tenant-profile-title">
    <Card className="space-y-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
        <h2 id="tenant-profile-title" className="text-sm font-semibold text-foreground">
          {text.profile}
        </h2>
        <Badge tone="neutral" className="normal-case tracking-normal">
          {labels.placement}: {tenant.databaseServer?.name ?? "—"} ·{" "}
          {tenant.storageServer?.name ?? "—"}
        </Badge>
      </div>

      {workspace.profileStale && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-warning/30 bg-warning-subtle p-3 text-xs text-warning-subtle-foreground"
        >
          <span>{text.stale}</span>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => void workspace.reloadStaleProfile()}
          >
            {text.reload}
          </Button>
        </div>
      )}

      <form noValidate onSubmit={submit} className="space-y-4">
        {Object.keys(errors).length ? (
          <div
            ref={errorSummaryRef}
            role="alert"
            tabIndex={-1}
            className="rounded-lg border border-destructive/30 bg-destructive-subtle p-3 text-sm text-destructive-subtle-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <p className="font-semibold">{labels.validationTitle}</p>
            <ul className="mt-2 list-disc space-y-1 ps-5">
              {Object.entries(errors).map(([key, message]) => (
                <li key={key}><a className="underline" href={`#tenant-profile-${key}`}>{profileErrorLabel(key, labels)}: {message}</a></li>
              ))}
            </ul>
          </div>
        ) : null}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <ProfileField
            id="tenant-profile-companyName"
            name="companyName"
            label={labels.companyName}
            value={draft.companyName}
            required
            error={errors.companyName}
            disabled={disabled}
            onChange={(value) => update("companyName", value)}
          />
          <ProfileField
            id="tenant-profile-countryName"
            name="countryName"
            label={labels.countryName}
            value={draft.countryName}
            required
            error={errors.countryName}
            disabled={disabled}
            onChange={(value) => update("countryName", value)}
          />
          <ProfileField
            id="tenant-profile-countryIsoCode"
            name="countryIsoCode"
            label={labels.countryIsoCode}
            value={draft.countryIsoCode}
            required
            error={errors.countryIsoCode}
            maxLength={2}
            disabled={disabled}
            onChange={(value) => update("countryIsoCode", value.toUpperCase())}
          />
          <NullableField name="industry"
            label={labels.industry}
            value={draft.industry}
            disabled={disabled}
            onChange={(value) => update("industry", value)}
          />
          <NullableField name="timezone"
            label={labels.timezone}
            value={draft.timezone}
            disabled={disabled}
            onChange={(value) => update("timezone", value)}
          />
          <NullableField name="phoneCountryCode"
            label={labels.phoneCountryCode}
            value={draft.phoneCountryCode}
            disabled={disabled}
            onChange={(value) => update("phoneCountryCode", value)}
          />
          <NullableField name="phone"
            label={labels.phone}
            value={draft.phone}
            disabled={disabled}
            onChange={(value) => update("phone", value)}
          />
          <NullableField name="taxNumber"
            label={labels.taxNumber}
            value={draft.taxNumber}
            disabled={disabled}
            onChange={(value) => update("taxNumber", value)}
          />
          <NullableField name="commercialRegistrationNumber"
            label={labels.commercialRegistrationNumber}
            value={draft.commercialRegistrationNumber}
            disabled={disabled}
            onChange={(value) =>
              update("commercialRegistrationNumber", value)
            }
          />
        </div>

        <div className="rounded-lg border border-border p-3">
          <div className="mb-3 flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-foreground">
              {text.address}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={disabled || draft.address === null}
              onClick={workspace.clearAddress}
              className="text-destructive"
            >
              {text.clearAddress}
            </Button>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {(
              [
                "city",
                "state",
                "district",
                "street1",
                "street2",
                "buildingNo",
                "postalCode",
                "landmark",
                "formattedAddress",
              ] as const
            ).map((key) => (
              <ProfileField
                key={key}
                name={`address.${key}`}
                label={labels[key]}
                value={draft.address?.[key] ?? ""}
                disabled={disabled}
                onChange={(value) => workspace.updateAddressField(key, value)}
              />
            ))}
          </div>
        </div>

        <div className="flex justify-end">
          <Button
            type="submit"
            variant="primary"
            loading={workspace.mutation.name === "profile"}
            disabled={disabled || !workspace.profileDirty}
          >
            {text.save}
          </Button>
        </div>
      </form>
    </Card>
    </section>
  );
}

interface FieldProps {
  id?: string;
  name: string;
  label: string;
  value: string;
  disabled: boolean;
  required?: boolean;
  maxLength?: number;
  error?: string;
  onChange: (value: string) => void;
}

function ProfileField({
  id,
  name,
  label,
  value,
  disabled,
  required,
  maxLength,
  error,
  onChange,
}: FieldProps) {
  return (
    <FormField id={id} label={label} required={required} error={error}>
      {(field) => (
        <Input
          {...field}
          name={name}
          value={value}
          maxLength={maxLength}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
    </FormField>
  );
}

function NullableField({
  value,
  onChange,
  ...props
}: Omit<FieldProps, "value" | "onChange"> & {
  value: string | null;
  onChange: (value: string | null) => void;
}) {
  return (
    <ProfileField
      {...props}
      value={value ?? ""}
      onChange={(next) => onChange(next || null)}
    />
  );
}

function profileErrorLabel(key: string, labels: typeof profileLabels.en | typeof profileLabels.ar): string {
  if (key === "companyName") return labels.companyName;
  if (key === "countryName") return labels.countryName;
  return labels.countryIsoCode;
}
