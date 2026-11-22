import { GeoCountry } from '../../../core/geo/geo.model';

export type { GeoCountry };

export const MAX_PHONE_LENGTH = 32;

const ARABIC_INDIC_ZERO = 0x0660;
const EXTENDED_ARABIC_INDIC_ZERO = 0x06f0;

/** Convert Eastern Arabic and Persian digits to Western ASCII digits. */
export function toAsciiDigits(raw: string): string {
  return raw.replace(/[\u0660-\u0669\u06F0-\u06F9]/g, (char) => {
    const code = char.charCodeAt(0);
    const base = code >= EXTENDED_ARABIC_INDIC_ZERO ? EXTENDED_ARABIC_INDIC_ZERO : ARABIC_INDIC_ZERO;
    return String(code - base);
  });
}

/** Extract digits only from a country dial code (for example "+20" -> "20"). */
export function dialDigits(dialCode: string): string {
  return toAsciiDigits(dialCode ?? '').replace(/\D+/g, '');
}

/** Normalize raw phone input to digits only, keeping a leading "+" or converting leading "00" to "+". */
export function normalizePhone(raw: string): string {
  const ascii = toAsciiDigits(raw ?? '');
  const hasPlus = /^[\s()[\].-]*\+/.test(ascii);
  const digits = ascii.replace(/\D+/g, '');
  if (!digits) return '';
  if (hasPlus) {
    return `+${digits}`.slice(0, MAX_PHONE_LENGTH);
  }
  if (digits.startsWith('00') && digits.length > 2) {
    return `+${digits.slice(2)}`.slice(0, MAX_PHONE_LENGTH);
  }
  return digits.slice(0, MAX_PHONE_LENGTH);
}

/** Count numeric digits in a phone string. */
export function phoneDigits(raw: string): number {
  return toAsciiDigits(raw ?? '').replace(/\D+/g, '').length;
}

/** Split a phone number into its longest-matching country dial code and local number. */
export function splitPhone(
  value: string,
  countries: readonly GeoCountry[],
): { country: GeoCountry | null; number: string } {
  const normalized = normalizePhone(value);
  if (!normalized) {
    return { country: null, number: '' };
  }
  if (!normalized.startsWith('+')) {
    return { country: null, number: normalized };
  }

  const digits = normalized.slice(1);
  const country = findLongestDialMatch(digits, countries);
  if (!country) {
    return { country: null, number: normalized };
  }

  const code = dialDigits(country.dialCode);
  const maxLocal = Math.max(0, MAX_PHONE_LENGTH - (code.length + 1));
  const number = digits.slice(code.length).replace(/^0+/, '').slice(0, maxLocal);
  return { country, number };
}

/** Join a country dial code and local number, dropping leading zeros when a dial code is set. */
export function joinPhone(country: GeoCountry | null, number: string): string {
  if (!country) {
    return normalizePhone(number ?? '');
  }
  const local = toAsciiDigits(number ?? '').replace(/\D+/g, '').replace(/^0+/, '');
  if (!local) return '';
  const code = dialDigits(country.dialCode);
  const joined = code ? `+${code}${local}` : local;
  return joined.slice(0, MAX_PHONE_LENGTH);
}

function findLongestDialMatch(digits: string, countries: readonly GeoCountry[]): GeoCountry | null {
  let best: GeoCountry | null = null;
  let bestLength = 0;

  for (const country of countries) {
    const code = dialDigits(country.dialCode);
    if (!code || !digits.startsWith(code)) continue;
    if (code.length > bestLength) {
      best = country;
      bestLength = code.length;
    }
  }

  return best;
}
