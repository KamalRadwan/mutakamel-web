"use client";

import type { FormEvent } from "react";
import type { useTenantCoreWorkspace } from "../hooks/useTenantCoreWorkspace";
import type { TenantAddress, TenantProfileDraft } from "../types";
import {
  tenantWorkspaceCopy,
  type TenantWorkspaceLocale,
} from "./copy";

export interface TenantProfilePanelProps {
  locale: TenantWorkspaceLocale;
  workspace: ReturnType<typeof useTenantCoreWorkspace>;
}

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
  },
} as const;

export function TenantProfilePanel({
  locale,
  workspace,
}: TenantProfilePanelProps) {
  const text = tenantWorkspaceCopy(locale);
  const labels = profileLabels[locale];
  const draft = workspace.profileDraft;
  const tenant = workspace.tenant;
  if (!draft || !tenant) return null;

  const disabled =
    !workspace.permissions.canUpdate || workspace.mutation.name !== null;
  const update = <Key extends keyof TenantProfileDraft>(
    key: Key,
    value: TenantProfileDraft[Key],
  ) => workspace.updateProfileDraft({ [key]: value });
  const submit = (event: FormEvent) => {
    event.preventDefault();
    void workspace.saveProfile().catch(() => undefined);
  };

  return (
    <section className="space-y-4 rounded-xl border border-border bg-white p-4 shadow-xs dark:border-border dark:bg-ink-900">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3 dark:border-border">
        <h2 className="text-sm font-semibold text-foreground">
          {text.profile}
        </h2>
        <span className="rounded-full bg-ink-100 px-2 py-1 text-xs font-semibold text-muted-foreground dark:bg-ink-800 dark:text-muted-foreground">
          {labels.placement}: {tenant.databaseServer?.name ?? "—"} ·{" "}
          {tenant.storageServer?.name ?? "—"}
        </span>
      </div>

      {workspace.profileStale && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-warn-300 bg-warn-50 p-3 text-xs text-warn-900 dark:border-warn-800 dark:bg-warn-950/40 dark:text-warn-200"
        >
          <span>{text.stale}</span>
          <button
            type="button"
            onClick={() => void workspace.reloadStaleProfile()}
            className="rounded-lg bg-warn-700 px-3 py-1.5 font-semibold text-white"
          >
            {text.reload}
          </button>
        </div>
      )}

      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Field
            label={labels.companyName}
            value={draft.companyName}
            required
            disabled={disabled}
            onChange={(value) => update("companyName", value)}
          />
          <Field
            label={labels.countryName}
            value={draft.countryName}
            required
            disabled={disabled}
            onChange={(value) => update("countryName", value)}
          />
          <Field
            label={labels.countryIsoCode}
            value={draft.countryIsoCode}
            required
            maxLength={2}
            disabled={disabled}
            onChange={(value) => update("countryIsoCode", value.toUpperCase())}
          />
          <NullableField
            label={labels.industry}
            value={draft.industry}
            disabled={disabled}
            onChange={(value) => update("industry", value)}
          />
          <NullableField
            label={labels.timezone}
            value={draft.timezone}
            disabled={disabled}
            onChange={(value) => update("timezone", value)}
          />
          <NullableField
            label={labels.phoneCountryCode}
            value={draft.phoneCountryCode}
            disabled={disabled}
            onChange={(value) => update("phoneCountryCode", value)}
          />
          <NullableField
            label={labels.phone}
            value={draft.phone}
            disabled={disabled}
            onChange={(value) => update("phone", value)}
          />
          <NullableField
            label={labels.taxNumber}
            value={draft.taxNumber}
            disabled={disabled}
            onChange={(value) => update("taxNumber", value)}
          />
          <NullableField
            label={labels.commercialRegistrationNumber}
            value={draft.commercialRegistrationNumber}
            disabled={disabled}
            onChange={(value) =>
              update("commercialRegistrationNumber", value)
            }
          />
        </div>

        <div className="rounded-xl border border-border p-3 dark:border-border">
          <div className="mb-3 flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-foreground">
              {text.address}
            </span>
            <button
              type="button"
              disabled={disabled || draft.address === null}
              onClick={workspace.clearAddress}
              className="rounded-lg px-2 py-1 text-xs font-semibold text-danger-600 disabled:opacity-40"
            >
              {text.clearAddress}
            </button>
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
              <Field
                key={key}
                label={labels[key]}
                value={draft.address?.[key] ?? ""}
                disabled={disabled}
                onChange={(value) => workspace.updateAddressField(key, value)}
              />
            ))}
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={disabled || !workspace.profileDirty}
            className="rounded-lg bg-brand-500 px-4 py-2 text-xs font-semibold text-ink-950 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-brand-400"
          >
            {workspace.mutation.name === "profile" ? "…" : text.save}
          </button>
        </div>
      </form>
    </section>
  );
}

interface FieldProps {
  label: string;
  value: string;
  disabled: boolean;
  required?: boolean;
  maxLength?: number;
  onChange: (value: string) => void;
}

function Field({
  label,
  value,
  disabled,
  required,
  maxLength,
  onChange,
}: FieldProps) {
  return (
    <label className="space-y-1 text-xs font-semibold text-muted-foreground">
      <span>{label}</span>
      <input
        value={value}
        required={required}
        maxLength={maxLength}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-lg border border-border bg-ink-100 px-3 py-2 text-xs font-normal text-foreground outline-hidden focus:border-brand-500 disabled:opacity-60 dark:bg-ink-800"
      />
    </label>
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
    <Field
      {...props}
      value={value ?? ""}
      onChange={(next) => onChange(next || null)}
    />
  );
}

export type TenantProfileAddressField = keyof TenantAddress;
