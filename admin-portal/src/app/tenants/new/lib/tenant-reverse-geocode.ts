import type { TenantReverseGeocodedAddress } from "../types";

const COORDINATE_PATTERN = /^-?(?:0|[1-9]\d{0,2})(?:\.\d{1,7})?$/;
const RESPONSE_KEYS = new Set([
  "countryName",
  "countryIsoCode",
  "state",
  "stateCode",
  "city",
  "cityId",
  "district",
  "street1",
  "buildingNo",
  "postalCode",
  "landmark",
  "formattedAddress",
]);

export type CoordinateField = "latitude" | "longitude";

export function parseCoordinate(raw: string, field: CoordinateField): number {
  const value = raw.trim();
  if (!COORDINATE_PATTERN.test(value)) {
    throw new Error(`INVALID_${field.toUpperCase()}_FORMAT`);
  }
  const parsed = Number(value);
  const limit = field === "latitude" ? 90 : 180;
  if (!Number.isFinite(parsed) || parsed < -limit || parsed > limit) {
    throw new Error(`INVALID_${field.toUpperCase()}_RANGE`);
  }
  return parsed;
}

export function readTenantReverseGeocodedAddress(
  payload: unknown,
): TenantReverseGeocodedAddress {
  if (!isRecord(payload)) {
    throw new Error("INVALID_REVERSE_GEOCODE_RESPONSE");
  }
  if (Object.keys(payload).some((key) => !RESPONSE_KEYS.has(key))) {
    throw new Error("INVALID_REVERSE_GEOCODE_RESPONSE");
  }
  if (
    !isBoundedText(payload.countryName, 100) ||
    typeof payload.countryIsoCode !== "string" ||
    !/^[A-Z]{2}$/.test(payload.countryIsoCode) ||
    !isOptionalBoundedText(payload.state, 100) ||
    !isOptionalBoundedText(payload.stateCode, 100) ||
    !isOptionalBoundedText(payload.city, 100) ||
    !isOptionalPositiveInteger(payload.cityId) ||
    !isOptionalBoundedText(payload.district, 100) ||
    !isOptionalBoundedText(payload.street1, 200) ||
    !isOptionalBoundedText(payload.buildingNo, 100) ||
    !isOptionalBoundedText(payload.postalCode, 100) ||
    !isOptionalBoundedText(payload.landmark, 100) ||
    !isOptionalBoundedText(payload.formattedAddress, 500)
  ) {
    throw new Error("INVALID_REVERSE_GEOCODE_RESPONSE");
  }

  return {
    countryName: payload.countryName,
    countryIsoCode: payload.countryIsoCode,
    ...optionalText("state", payload.state),
    ...optionalText("stateCode", payload.stateCode),
    ...optionalText("city", payload.city),
    ...(typeof payload.cityId === "number" ? { cityId: payload.cityId } : {}),
    ...optionalText("district", payload.district),
    ...optionalText("street1", payload.street1),
    ...optionalText("buildingNo", payload.buildingNo),
    ...optionalText("postalCode", payload.postalCode),
    ...optionalText("landmark", payload.landmark),
    ...optionalText("formattedAddress", payload.formattedAddress),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isBoundedText(value: unknown, maxLength: number): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    value.length <= maxLength
  );
}

function isOptionalBoundedText(value: unknown, maxLength: number): boolean {
  return value === undefined || isBoundedText(value, maxLength);
}

function isOptionalPositiveInteger(value: unknown): boolean {
  return value === undefined || (Number.isInteger(value) && Number(value) > 0);
}

function optionalText<Key extends keyof TenantReverseGeocodedAddress>(
  key: Key,
  value: unknown,
): Partial<Pick<TenantReverseGeocodedAddress, Key>> {
  return typeof value === "string"
    ? ({ [key]: value } as Partial<Pick<TenantReverseGeocodedAddress, Key>>)
    : {};
}
