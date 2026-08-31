import { Country } from "country-state-city";

/**
 * One normalized view of the country registry for every control that needs it:
 * the country combobox, the phone calling-code picker, and the timezone list.
 *
 * `country-state-city` is already a dependency and ships the flag emoji,
 * calling code, and IANA zones per country, so none of this needs a network
 * call or a second data source.
 */
export interface CountryOption {
  isoCode: string;
  name: string;
  /** Emoji flag. Decorative — never the only carrier of meaning. */
  flag: string;
  /** E.164 calling code including the leading plus, e.g. "+20". */
  callingCode: string;
  timezones: readonly string[];
}

/**
 * Reads the first calling code out of the registry's `phonecode` field.
 *
 * That field is not clean: it carries area codes ("+44-1481" for Jersey),
 * alternates as prose ("+1-809 and 1-829" for the Dominican Republic), and
 * the odd leading-zero artefact ("0055"). Stripping non-digits wholesale
 * concatenates those into nonsense like "+18091829", which is neither
 * dialable nor accepted by Core's `/^\+[1-9]\d{0,3}$/` rule. Taking only the
 * leading run keeps the country code and drops the area part.
 */
function parseCallingCode(rawPhoneCode: string | undefined): string {
  const match = /^\+?0*(\d{1,4})/u.exec((rawPhoneCode ?? "").trim());
  return match?.[1] ?? "";
}

let cachedCountries: readonly CountryOption[] | null = null;

export function getCountryOptions(): readonly CountryOption[] {
  if (cachedCountries) return cachedCountries;
  const options: CountryOption[] = [];
  for (const country of Country.getAllCountries()) {
    const name = country.name?.trim() ?? "";
    const isoCode = country.isoCode?.trim().toUpperCase() ?? "";
    const digits = parseCallingCode(country.phonecode);
    if (!name || !/^[A-Z]{2}$/u.test(isoCode) || !digits) continue;
    options.push({
      isoCode,
      name,
      flag: country.flag ?? "",
      callingCode: `+${digits}`,
      timezones: (country.timezones ?? [])
        .map((zone) => zone.zoneName?.trim() ?? "")
        .filter((zone) => zone.length > 0),
    });
  }
  options.sort((left, right) => left.name.localeCompare(right.name));
  cachedCountries = options;
  return cachedCountries;
}

export function findCountry(isoCode: string): CountryOption | null {
  const normalized = isoCode.trim().toUpperCase();
  return (
    getCountryOptions().find((country) => country.isoCode === normalized) ?? null
  );
}

/**
 * Every IANA zone the registry knows about, de-duplicated.
 *
 * The wizard used to offer only the selected country's zones, which is wrong
 * for a tenant that operates from one country and bills in another timezone.
 */
export function getAllTimezones(): readonly string[] {
  const zones = new Set<string>();
  for (const country of getCountryOptions()) {
    for (const zone of country.timezones) zones.add(zone);
  }
  return [...zones].sort((left, right) => left.localeCompare(right));
}

/**
 * Best-effort country guess from the browser's own clock settings.
 *
 * Deliberately not an IP lookup: this needs no network call and no third
 * party ever sees the administrator's address. It is a *default*, not an
 * assertion -- the admin can always pick another country.
 */
export function countryFromBrowserTimezone(
  timezone: string | undefined = resolveBrowserTimezone(),
): string | null {
  if (!timezone) return null;
  const normalized = timezone.trim().toLowerCase();
  if (!normalized) return null;
  // A zone can belong to several countries (Europe/Brussels does not, but
  // Asia/Riyadh-style shared zones do). First match in name order is stable.
  for (const country of getCountryOptions()) {
    if (country.timezones.some((zone) => zone.toLowerCase() === normalized)) {
      return country.isoCode;
    }
  }
  return null;
}

export function resolveBrowserTimezone(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || undefined;
  } catch {
    // Locked-down or exotic runtimes can throw here; a missing default is
    // not an error worth surfacing.
    return undefined;
  }
}

export interface SplitPhoneNumber {
  callingCode: string;
  nationalNumber: string;
}

let cachedCallingCodes: ReadonlySet<string> | null = null;

function knownCallingCodes(): ReadonlySet<string> {
  if (cachedCallingCodes) return cachedCallingCodes;
  cachedCallingCodes = new Set(
    getCountryOptions().map((country) => country.callingCode.slice(1)),
  );
  return cachedCallingCodes;
}

/**
 * Splits a pasted international number into its calling code and the national
 * part, e.g. "+20 105 0049 899" -> { "+20", "1050049899" }.
 *
 * Longest-prefix first, because calling codes are not prefix-free: "+1" (US)
 * and "+1242" (Bahamas) both exist, and taking the shortest match would route
 * every Caribbean number to North America.
 */
export function splitPhoneNumber(raw: string): SplitPhoneNumber | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const hadPlus = trimmed.startsWith("+") || trimmed.startsWith("00");
  const digits = trimmed.replace(/^00/u, "").replace(/[^0-9]/gu, "");
  if (!digits) return null;
  if (!hadPlus) {
    // Without an international prefix the leading digits are national, not a
    // country code -- guessing one would silently rewrite the number.
    return { callingCode: "", nationalNumber: digits };
  }
  const codes = knownCallingCodes();
  for (let length = Math.min(4, digits.length); length >= 1; length -= 1) {
    const candidate = digits.slice(0, length);
    if (codes.has(candidate)) {
      return {
        callingCode: `+${candidate}`,
        nationalNumber: digits.slice(length),
      };
    }
  }
  return { callingCode: "", nationalNumber: digits };
}

/**
 * Turns a company name into a DNS-safe tenant code.
 *
 * The code becomes the label in `<code>.mutakamel.ai`, so it is bound by the
 * hostname rules Core enforces: lowercase letters, digits and hyphens only,
 * no leading or trailing hyphen, 63 characters at most. Spaces become hyphens
 * rather than underscores because an underscore is not valid in a hostname.
 */
export function deriveTenantCode(companyName: string): string {
  return companyName
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "")
    .slice(0, 63)
    .replace(/-+$/u, "");
}
