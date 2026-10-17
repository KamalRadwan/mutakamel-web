import { splitPhoneNumber } from "@/lib/geo/country-data";

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
 * Normalizes a raw phone number to pure digits (without `+`) for `https://wa.me/<digits>`
 * and `https://t.me/+<digits>` links.
 */
export function normalizeWhatsAppDigits(phone: string, _country?: string | null): string {
  const trimmed = phone.trim();
  if (!trimmed) return "";
  const parsed = splitPhoneNumber(trimmed);
  if (parsed && (parsed.callingCode || parsed.nationalNumber)) {
    const calling = parsed.callingCode.replace(/\D/g, "");
    const national = calling
      ? parsed.nationalNumber.replace(/^0+/u, "").replace(/\D/g, "")
      : parsed.nationalNumber.replace(/\D/g, "");
    return `${calling}${national}`;
  }
  return trimmed.replace(/\D/g, "");
}
