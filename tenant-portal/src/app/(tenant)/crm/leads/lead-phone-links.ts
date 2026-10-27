import { countryIsoFromName, getCountryOptions, splitPhoneNumber } from "@/lib/geo/country-data";

/**
 * Normalizes a raw phone number for `tel:` links.
 */
export function normalizePhoneDigits(phone: string): string {
  const trimmed = phone.trim();
  if (!trimmed) return "";
  const parsed = splitPhoneNumber(trimmed);
  if (parsed && (parsed.callingCode || parsed.nationalNumber)) {
    return `${parsed.callingCode}${parsed.nationalNumber}`;
  }
  const hasPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/\D/g, "");
  if (!digits) return "";
  return hasPlus ? `+${digits}` : digits;
}

/**
 * Chat links need an international number. Local numbers require a known
 * country; an explicit international prefix takes precedence over that country.
 */
export function normalizeWhatsAppDigits(phone: string, country?: string | null): string {
  const trimmed = phone.trim();
  const parsed = splitPhoneNumber(trimmed);
  if (!parsed?.nationalNumber) return "";
  if (parsed.callingCode) {
    return `${parsed.callingCode.replace(/\D/g, "")}${parsed.nationalNumber}`;
  }
  // Never reinterpret an unrecognized explicit international number as local.
  if (trimmed.startsWith("+") || trimmed.startsWith("00")) return "";
  const countryName = country?.trim() ?? "";
  const iso = /^[A-Z]{2}$/iu.test(countryName)
    ? countryName.toUpperCase()
    : countryIsoFromName(countryName);
  const callingCode = getCountryOptions("en").find(({ isoCode }) => isoCode === iso)?.callingCode;
  const national = parsed.nationalNumber.replace(/^0+/u, "");
  return callingCode && national ? `${callingCode.replace(/\D/g, "")}${national}` : "";
}
