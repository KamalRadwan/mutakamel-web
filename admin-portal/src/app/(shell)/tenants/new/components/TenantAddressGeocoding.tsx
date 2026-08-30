"use client";

import { Loader2, MapPinned } from "lucide-react";
import { Button, Input } from "@/design-system";
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
    <section className="rounded-lg border border-info/30 bg-info-subtle p-4">
      <div className="flex items-start gap-2">
        <MapPinned
          aria-hidden="true"
          className="mt-0.5 h-4 w-4 shrink-0 text-info-subtle-foreground"
        />
        <div>
          <h4 className="text-xs font-semibold text-foreground">
            {copy.title}
          </h4>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
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
          errorId="tenant-map-coordinate-error"
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
          errorId="tenant-map-coordinate-error"
        />
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            void state.lookup().catch(() => undefined);
          }}
          disabled={disabled || state.isLoading}
        >
          {state.isLoading ? (
            <Loader2
              aria-hidden="true"
              className="h-4 w-4 animate-spin motion-reduce:animate-none"
            />
          ) : null}
          {state.isLoading ? copy.lookingUp : copy.lookup}
        </Button>
      </div>

      {state.validationCode ? (
        <p
          id="tenant-map-coordinate-error"
          role="alert"
          className="mt-2 text-xs font-semibold text-destructive-subtle-foreground"
        >
          {coordinateMessage(copy, state.validationCode)}
        </p>
      ) : null}

      {state.error ? <TenantReverseGeocodeError error={state.error} /> : null}

      {state.suggestion ? (
        <div
          role="status"
          className="mt-3 rounded-lg border border-info/30 bg-card p-3 text-xs text-foreground"
        >
          <p className="font-semibold">{copy.suggestion}</p>
          <p className="mt-1 leading-5">
            {state.suggestion.formattedAddress ??
              formatSuggestion(state.suggestion)}
          </p>
          <p className="mt-1 font-mono text-xs">
            {state.suggestion.countryIsoCode}
            {state.suggestion.stateCode
              ? ` · ${state.suggestion.stateCode}`
              : ""}
            {state.suggestion.cityId
              ? ` · city:${state.suggestion.cityId}`
              : ""}
          </p>
          <Button
            type="button"
            variant="secondary"
            onClick={() => onApply(state.suggestion!)}
            disabled={disabled}
            className="mt-3"
          >
            {copy.apply}
          </Button>
          <p className="mt-2 text-xs leading-4 opacity-80">
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
      className="mt-3 rounded-lg border border-destructive/30 bg-destructive-subtle p-3 text-xs text-destructive-subtle-foreground"
    >
      <p>{error.message}</p>
      {error.correlationId ? (
        <p className="mt-1 font-mono text-xs">
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
  errorId,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
  invalid: boolean;
  errorId: string;
}) {
  return (
    <label
      htmlFor={id}
      className="space-y-1 text-xs font-semibold text-foreground"
    >
      <span>{label}</span>
      <Input
        id={id}
        name={id.endsWith("latitude") ? "latitude" : "longitude"}
        type="text"
        inputMode="decimal"
        dir="ltr"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        aria-invalid={invalid}
        aria-describedby={invalid ? errorId : undefined}
        placeholder="30.0444000"
        className="font-mono"
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
