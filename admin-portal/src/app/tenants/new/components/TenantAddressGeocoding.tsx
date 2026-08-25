"use client";

import { Loader2, MapPinned } from "lucide-react";
import type { NormalizedApiError } from "@/shared/api/normalized-api-error";
import {
  useTenantReverseGeocode,
  type CoordinateValidationCode,
} from "../hooks/useTenantReverseGeocode";
import type { TenantReverseGeocodedAddress } from "../types";

interface TenantAddressGeocodingProps {
  lang: string;
  disabled?: boolean;
  onApply: (suggestion: TenantReverseGeocodedAddress) => void;
}

export function TenantAddressGeocoding({
  lang,
  disabled = false,
  onApply,
}: TenantAddressGeocodingProps) {
  const state = useTenantReverseGeocode();
  const copy = lang === "ar" ? AR : EN;

  return (
    <section className="rounded-xl border border-blue-200 bg-blue-50/60 p-4 dark:border-blue-900 dark:bg-blue-950/20">
      <div className="flex items-start gap-2">
        <MapPinned
          aria-hidden="true"
          className="mt-0.5 h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400"
        />
        <div>
          <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">
            {copy.title}
          </h4>
          <p className="mt-1 text-[11px] leading-5 text-slate-600 dark:text-slate-400">
            {copy.description}
          </p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <CoordinateInput
          id="tenant-map-latitude"
          label={copy.latitude}
          value={state.latitude}
          onChange={state.setLatitude}
          disabled={disabled || state.isLoading}
          invalid={
            state.validationCode?.startsWith("INVALID_LATITUDE") ?? false
          }
        />
        <CoordinateInput
          id="tenant-map-longitude"
          label={copy.longitude}
          value={state.longitude}
          onChange={state.setLongitude}
          disabled={disabled || state.isLoading}
          invalid={
            state.validationCode?.startsWith("INVALID_LONGITUDE") ?? false
          }
        />
        <button
          type="button"
          onClick={() => {
            void state.lookup().catch(() => undefined);
          }}
          disabled={disabled || state.isLoading}
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-xs font-bold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {state.isLoading ? (
            <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
          ) : null}
          {state.isLoading ? copy.lookingUp : copy.lookup}
        </button>
      </div>

      {state.validationCode ? (
        <p
          role="alert"
          className="mt-2 text-xs font-semibold text-rose-700 dark:text-rose-300"
        >
          {coordinateMessage(copy, state.validationCode)}
        </p>
      ) : null}

      {state.error ? <TenantReverseGeocodeError error={state.error} /> : null}

      {state.suggestion ? (
        <div
          role="status"
          className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100"
        >
          <p className="font-bold">{copy.suggestion}</p>
          <p className="mt-1 leading-5">
            {state.suggestion.formattedAddress ??
              formatSuggestion(state.suggestion)}
          </p>
          <p className="mt-1 font-mono text-[10px]">
            {state.suggestion.countryIsoCode}
            {state.suggestion.stateCode
              ? ` · ${state.suggestion.stateCode}`
              : ""}
            {state.suggestion.cityId
              ? ` · city:${state.suggestion.cityId}`
              : ""}
          </p>
          <button
            type="button"
            onClick={() => onApply(state.suggestion!)}
            disabled={disabled}
            className="mt-3 min-h-10 rounded-xl bg-emerald-700 px-4 text-xs font-bold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {copy.apply}
          </button>
          <p className="mt-2 text-[10px] leading-4 opacity-80">
            {copy.editable}
          </p>
        </div>
      ) : null}
    </section>
  );
}

export function TenantReverseGeocodeError({
  error,
}: {
  error: NormalizedApiError;
}) {
  return (
    <div
      role="alert"
      className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-900 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200"
    >
      <p>{error.message}</p>
      {error.correlationId ? (
        <p className="mt-1 font-mono text-[10px]">
          Correlation ID: {error.correlationId}
        </p>
      ) : null}
    </div>
  );
}

function CoordinateInput({
  id,
  label,
  value,
  onChange,
  disabled,
  invalid,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
  invalid: boolean;
}) {
  return (
    <label
      htmlFor={id}
      className="space-y-1 text-xs font-bold text-slate-700 dark:text-slate-300"
    >
      <span>{label}</span>
      <input
        id={id}
        type="text"
        inputMode="decimal"
        dir="ltr"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        aria-invalid={invalid}
        placeholder="30.0444000"
        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 font-mono text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
      />
    </label>
  );
}

interface ReverseGeocodeCopy {
  title: string;
  description: string;
  latitude: string;
  longitude: string;
  lookup: string;
  lookingUp: string;
  suggestion: string;
  apply: string;
  editable: string;
  coordinateFormat: string;
  latitudeRange: string;
  longitudeRange: string;
}

function coordinateMessage(
  copy: ReverseGeocodeCopy,
  code: CoordinateValidationCode,
) {
  return code.includes("LATITUDE")
    ? code.endsWith("RANGE")
      ? copy.latitudeRange
      : copy.coordinateFormat
    : code.endsWith("RANGE")
      ? copy.longitudeRange
      : copy.coordinateFormat;
}

function formatSuggestion(value: TenantReverseGeocodedAddress) {
  return [
    value.buildingNo,
    value.street1,
    value.district,
    value.city,
    value.state,
    value.countryName,
  ]
    .filter(Boolean)
    .join(", ");
}

const EN: ReverseGeocodeCopy = {
  title: "Map coordinates",
  description:
    "Enter a confirmed latitude and longitude. Core returns an editable canonical address suggestion; no provider endpoint or credential reaches the browser.",
  latitude: "Latitude (-90 to 90)",
  longitude: "Longitude (-180 to 180)",
  lookup: "Find address",
  lookingUp: "Finding…",
  suggestion: "Address suggestion",
  apply: "Apply to editable address fields",
  editable: "Review and edit every applied value before tenant creation.",
  coordinateFormat:
    "Use a plain decimal coordinate with no more than seven decimal places.",
  latitudeRange: "Latitude must be between -90 and 90.",
  longitudeRange: "Longitude must be between -180 and 180.",
};

const AR: ReverseGeocodeCopy = {
  title: "إحداثيات الخريطة",
  description:
    "أدخل خط العرض وخط الطول المؤكدين. يعيد Core اقتراح عنوان قياسي قابلًا للتعديل، ولا تصل نقطة مزود الخدمة أو بيانات اعتماده إلى المتصفح.",
  latitude: "خط العرض (-90 إلى 90)",
  longitude: "خط الطول (-180 إلى 180)",
  lookup: "العثور على العنوان",
  lookingUp: "جارٍ البحث…",
  suggestion: "اقتراح العنوان",
  apply: "تطبيقه على حقول العنوان القابلة للتعديل",
  editable: "راجع كل قيمة مطبقة وعدّلها قبل إنشاء المستأجر.",
  coordinateFormat: "استخدم إحداثيًا عشريًا عاديًا لا يتجاوز سبع خانات عشرية.",
  latitudeRange: "يجب أن يكون خط العرض بين -90 و90.",
  longitudeRange: "يجب أن يكون خط الطول بين -180 و180.",
};
