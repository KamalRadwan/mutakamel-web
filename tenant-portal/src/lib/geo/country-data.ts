import type { Language } from "@/i18n/useLanguage";
import { INTL_LOCALE } from "@/lib/format/locale";

/**
 * ISO 3166-1 alpha-2 → E.164 calling code, without the plus.
 *
 * Generated from the same `country-state-city` registry the admin portal
 * reads, through the same parse rule: the LEADING run of digits only. That
 * field is not clean — it carries area codes ("+44-1481" for Jersey),
 * alternates written as prose ("+1-809 and 1-829" for the Dominican Republic)
 * and leading-zero artefacts ("0055") — and stripping non-digits wholesale
 * concatenates those into nonsense like "+18091829", which is neither dialable
 * nor accepted by Core's own `/^\+[1-9]\d{0,3}$/` rule.
 *
 * Materialised here rather than taken as a dependency. That package puts an
 * 8 MB city dataset behind the same barrel as its 96 KB country list and
 * declares no `sideEffects`, so importing it drags the whole thing into the
 * bundle of this portal's busiest screens. Names and flags are derived below,
 * which leaves this table as the only part that cannot be computed.
 */
const CALLING_CODES: Readonly<Record<string, string>> = {
  AD: "376", AE: "971", AF: "93", AG: "1", AI: "1", AL: "355",
  AM: "374", AO: "244", AQ: "672", AR: "54", AS: "1", AT: "43",
  AU: "61", AW: "297", AX: "358", AZ: "994", BA: "387", BB: "1",
  BD: "880", BE: "32", BF: "226", BG: "359", BH: "973", BI: "257",
  BJ: "229", BL: "590", BM: "1", BN: "673", BO: "591", BQ: "599",
  BR: "55", BS: "1", BT: "975", BV: "55", BW: "267", BY: "375",
  BZ: "501", CA: "1", CC: "61", CD: "243", CF: "236", CG: "242",
  CH: "41", CI: "225", CK: "682", CL: "56", CM: "237", CN: "86",
  CO: "57", CR: "506", CU: "53", CV: "238", CW: "599", CX: "61",
  CY: "357", CZ: "420", DE: "49", DJ: "253", DK: "45", DM: "1",
  DO: "1", DZ: "213", EC: "593", EE: "372", EG: "20", EH: "212",
  ER: "291", ES: "34", ET: "251", FI: "358", FJ: "679", FK: "500",
  FM: "691", FO: "298", FR: "33", GA: "241", GB: "44", GD: "1",
  GE: "995", GF: "594", GG: "44", GH: "233", GI: "350", GL: "299",
  GM: "220", GN: "224", GP: "590", GQ: "240", GR: "30", GS: "500",
  GT: "502", GU: "1", GW: "245", GY: "592", HK: "852", HM: "672",
  HN: "504", HR: "385", HT: "509", HU: "36", ID: "62", IE: "353",
  IL: "972", IM: "44", IN: "91", IO: "246", IQ: "964", IR: "98",
  IS: "354", IT: "39", JE: "44", JM: "1", JO: "962", JP: "81",
  KE: "254", KG: "996", KH: "855", KI: "686", KM: "269", KN: "1",
  KP: "850", KR: "82", KW: "965", KY: "1", KZ: "7", LA: "856",
  LB: "961", LC: "1", LI: "423", LK: "94", LR: "231", LS: "266",
  LT: "370", LU: "352", LV: "371", LY: "218", MA: "212", MC: "377",
  MD: "373", ME: "382", MF: "590", MG: "261", MH: "692", MK: "389",
  ML: "223", MM: "95", MN: "976", MO: "853", MP: "1", MQ: "596",
  MR: "222", MS: "1", MT: "356", MU: "230", MV: "960", MW: "265",
  MX: "52", MY: "60", MZ: "258", NA: "264", NC: "687", NE: "227",
  NF: "672", NG: "234", NI: "505", NL: "31", NO: "47", NP: "977",
  NR: "674", NU: "683", NZ: "64", OM: "968", PA: "507", PE: "51",
  PF: "689", PG: "675", PH: "63", PK: "92", PL: "48", PM: "508",
  PN: "870", PR: "1", PS: "970", PT: "351", PW: "680", PY: "595",
  QA: "974", RE: "262", RO: "40", RS: "381", RU: "7", RW: "250",
  SA: "966", SB: "677", SC: "248", SD: "249", SE: "46", SG: "65",
  SH: "290", SI: "386", SJ: "47", SK: "421", SL: "232", SM: "378",
  SN: "221", SO: "252", SR: "597", SS: "211", ST: "239", SV: "503",
  SX: "1721", SY: "963", SZ: "268", TC: "1", TD: "235", TF: "262",
  TG: "228", TH: "66", TJ: "992", TK: "690", TL: "670", TM: "993",
  TN: "216", TO: "676", TR: "90", TT: "1", TV: "688", TW: "886",
  TZ: "255", UA: "380", UG: "256", UM: "1", US: "1", UY: "598",
  UZ: "998", VA: "379", VC: "1", VE: "58", VG: "1", VI: "1",
  VN: "84", VU: "678", WF: "681", WS: "685", XK: "383", YE: "967",
  YT: "262", ZA: "27", ZM: "260", ZW: "263",
};

export interface CountryOption {
  isoCode: string;
  /** The name in the reader's language, from Intl — no name table to translate. */
  name: string;
  /**
   * Emoji flag. Decorative and never the only carrier of meaning: Windows has
   * no flag glyphs and renders the pair as the two ISO letters, which still
   * names the country.
   */
  flag: string;
  /** E.164 calling code including the leading plus, e.g. "+20". */
  callingCode: string;
}

/** Regional indicator symbols: 'A' (65) is U+1F1E6, and a flag is two of them. */
function flagOf(isoCode: string): string {
  return String.fromCodePoint(
    ...[...isoCode].map((letter) => 0x1f1e6 + letter.charCodeAt(0) - 65),
  );
}

function regionNames(lang: Language): Intl.DisplayNames | null {
  try {
    return new Intl.DisplayNames([INTL_LOCALE[lang]], { type: "region" });
  } catch {
    // A runtime without the region dataset falls back to ISO codes below,
    // which is a worse label but never a missing one.
    return null;
  }
}

const cachedOptions = new Map<Language, readonly CountryOption[]>();

/**
 * Every country, named and sorted in the reader's own language.
 *
 * Cached per language because the list is static and building it walks 250
 * entries through Intl — a picker that rebuilt it on every keystroke would pay
 * that on every keystroke.
 */
export function getCountryOptions(lang: Language): readonly CountryOption[] {
  const cached = cachedOptions.get(lang);
  if (cached) return cached;

  const display = regionNames(lang);
  const options = Object.entries(CALLING_CODES).map(([isoCode, digits]) => ({
    isoCode,
    name: display?.of(isoCode) ?? isoCode,
    flag: flagOf(isoCode),
    callingCode: `+${digits}`,
  }));
  options.sort((left, right) => left.name.localeCompare(right.name, INTL_LOCALE[lang]));

  cachedOptions.set(lang, options);
  return options;
}

let cachedIsoByName: Map<string, string> | null = null;

/**
 * The ISO code of a country stored by NAME, or null for a name no dictionary
 * knows.
 *
 * Address DTOs hold `country` as free text, so the name is all a form has —
 * and the geography routes key on the ISO code. Both language dictionaries are
 * indexed, because a record written while the workspace was in Arabic is still
 * the same country when it is opened in English.
 *
 * Null is a real answer, not a failure: an address may carry a country that no
 * longer exists, or a typo. Callers degrade rather than blank it.
 */
export function countryIsoFromName(name: string): string | null {
  if (cachedIsoByName === null) {
    cachedIsoByName = new Map();
    for (const language of ["ar", "en"] as const) {
      for (const country of getCountryOptions(language)) {
        cachedIsoByName.set(country.name.toLowerCase(), country.isoCode);
      }
    }
  }
  return cachedIsoByName.get(name.trim().toLowerCase()) ?? null;
}

/**
 * IANA zone → ISO 3166-1 alpha-2, from the same registry as the codes above.
 *
 * There is no browser API that answers "which country is this reader in", and
 * asking for their location to fill in a phone prefix would be absurd. The
 * timezone the browser already reports is the closest honest proxy, and being
 * wrong costs one click on a picker that was going to be used anyway.
 *
 * A zone this table has never heard of resolves to nothing rather than to a
 * guess: the registry predates renames like Europe/Kyiv, and a stale alias
 * must not silently prefix somebody's phone number with the wrong country.
 */
const TIMEZONE_COUNTRY: Readonly<Record<string, string>> = {
  "Africa/Abidjan": "CI", "Africa/Accra": "GH", "Africa/Addis_Ababa": "ET",
  "Africa/Algiers": "DZ", "Africa/Asmara": "ER", "Africa/Bamako": "ML",
  "Africa/Bangui": "CF", "Africa/Banjul": "GM", "Africa/Bissau": "GW",
  "Africa/Blantyre": "MW", "Africa/Brazzaville": "CG", "Africa/Bujumbura": "BI",
  "Africa/Cairo": "EG", "Africa/Casablanca": "MA", "Africa/Ceuta": "ES",
  "Africa/Conakry": "GN", "Africa/Dakar": "SN", "Africa/Dar_es_Salaam": "TZ",
  "Africa/Djibouti": "DJ", "Africa/Douala": "CM", "Africa/El_Aaiun": "EH",
  "Africa/Freetown": "SL", "Africa/Gaborone": "BW", "Africa/Harare": "ZW",
  "Africa/Johannesburg": "ZA", "Africa/Juba": "SS", "Africa/Kampala": "UG",
  "Africa/Khartoum": "SD", "Africa/Kigali": "RW", "Africa/Kinshasa": "CD",
  "Africa/Lagos": "NG", "Africa/Libreville": "GA", "Africa/Lome": "TG",
  "Africa/Luanda": "AO", "Africa/Lubumbashi": "CD", "Africa/Lusaka": "ZM",
  "Africa/Malabo": "GQ", "Africa/Maputo": "MZ", "Africa/Maseru": "LS",
  "Africa/Mbabane": "SZ", "Africa/Mogadishu": "SO", "Africa/Monrovia": "LR",
  "Africa/Nairobi": "KE", "Africa/Ndjamena": "TD", "Africa/Niamey": "NE",
  "Africa/Nouakchott": "MR", "Africa/Ouagadougou": "BF", "Africa/Porto-Novo": "BJ",
  "Africa/Sao_Tome": "ST", "Africa/Tripoli": "LY", "Africa/Tunis": "TN",
  "Africa/Windhoek": "NA", "America/Adak": "US", "America/Anchorage": "US",
  "America/Anguilla": "AI", "America/Antigua": "AG", "America/Araguaina": "BR",
  "America/Argentina/Buenos_Aires": "AR", "America/Argentina/Catamarca": "AR", "America/Argentina/Cordoba": "AR",
  "America/Argentina/Jujuy": "AR", "America/Argentina/La_Rioja": "AR", "America/Argentina/Mendoza": "AR",
  "America/Argentina/Rio_Gallegos": "AR", "America/Argentina/Salta": "AR", "America/Argentina/San_Juan": "AR",
  "America/Argentina/San_Luis": "AR", "America/Argentina/Tucuman": "AR", "America/Argentina/Ushuaia": "AR",
  "America/Aruba": "AW", "America/Asuncion": "PY", "America/Atikokan": "CA",
  "America/Bahia": "BR", "America/Bahia_Banderas": "MX", "America/Barbados": "BB",
  "America/Belem": "BR", "America/Belize": "BZ", "America/Blanc-Sablon": "CA",
  "America/Boa_Vista": "BR", "America/Bogota": "CO", "America/Boise": "US",
  "America/Cambridge_Bay": "CA", "America/Campo_Grande": "BR", "America/Cancun": "MX",
  "America/Caracas": "VE", "America/Cayenne": "GF", "America/Cayman": "KY",
  "America/Chicago": "US", "America/Chihuahua": "MX", "America/Costa_Rica": "CR",
  "America/Creston": "CA", "America/Cuiaba": "BR", "America/Curacao": "CW",
  "America/Danmarkshavn": "GL", "America/Dawson": "CA", "America/Dawson_Creek": "CA",
  "America/Denver": "US", "America/Detroit": "US", "America/Dominica": "DM",
  "America/Edmonton": "CA", "America/Eirunepe": "BR", "America/El_Salvador": "SV",
  "America/Fort_Nelson": "CA", "America/Fortaleza": "BR", "America/Glace_Bay": "CA",
  "America/Goose_Bay": "CA", "America/Grand_Turk": "TC", "America/Grenada": "GD",
  "America/Guadeloupe": "GP", "America/Guatemala": "GT", "America/Guayaquil": "EC",
  "America/Guyana": "GY", "America/Halifax": "CA", "America/Havana": "CU",
  "America/Hermosillo": "MX", "America/Indiana/Indianapolis": "US", "America/Indiana/Knox": "US",
  "America/Indiana/Marengo": "US", "America/Indiana/Petersburg": "US", "America/Indiana/Tell_City": "US",
  "America/Indiana/Vevay": "US", "America/Indiana/Vincennes": "US", "America/Indiana/Winamac": "US",
  "America/Inuvik": "CA", "America/Iqaluit": "CA", "America/Jamaica": "JM",
  "America/Juneau": "US", "America/Kentucky/Louisville": "US", "America/Kentucky/Monticello": "US",
  "America/La_Paz": "BO", "America/Lima": "PE", "America/Los_Angeles": "US",
  "America/Maceio": "BR", "America/Managua": "NI", "America/Manaus": "BR",
  "America/Marigot": "MF", "America/Martinique": "MQ", "America/Matamoros": "MX",
  "America/Mazatlan": "MX", "America/Menominee": "US", "America/Merida": "MX",
  "America/Metlakatla": "US", "America/Mexico_City": "MX", "America/Miquelon": "PM",
  "America/Moncton": "CA", "America/Monterrey": "MX", "America/Montevideo": "UY",
  "America/Montserrat": "MS", "America/Nassau": "BS", "America/New_York": "US",
  "America/Nipigon": "CA", "America/Nome": "US", "America/Noronha": "BR",
  "America/North_Dakota/Beulah": "US", "America/North_Dakota/Center": "US", "America/North_Dakota/New_Salem": "US",
  "America/Nuuk": "GL", "America/Ojinaga": "MX", "America/Panama": "PA",
  "America/Pangnirtung": "CA", "America/Paramaribo": "SR", "America/Phoenix": "US",
  "America/Port_of_Spain": "TT", "America/Port-au-Prince": "HT", "America/Porto_Velho": "BR",
  "America/Puerto_Rico": "PR", "America/Punta_Arenas": "CL", "America/Rainy_River": "CA",
  "America/Rankin_Inlet": "CA", "America/Recife": "BR", "America/Regina": "CA",
  "America/Resolute": "CA", "America/Rio_Branco": "BR", "America/Santarem": "BR",
  "America/Santiago": "CL", "America/Santo_Domingo": "DO", "America/Sao_Paulo": "BR",
  "America/Scoresbysund": "GL", "America/Sitka": "US", "America/St_Barthelemy": "BL",
  "America/St_Johns": "CA", "America/St_Kitts": "KN", "America/St_Lucia": "LC",
  "America/St_Thomas": "VI", "America/St_Vincent": "VC", "America/Swift_Current": "CA",
  "America/Tegucigalpa": "HN", "America/Thule": "GL", "America/Thunder_Bay": "CA",
  "America/Tijuana": "MX", "America/Toronto": "CA", "America/Tortola": "VG",
  "America/Vancouver": "CA", "America/Whitehorse": "CA", "America/Winnipeg": "CA",
  "America/Yakutat": "US", "America/Yellowknife": "CA", "Antarctica/Casey": "AQ",
  "Antarctica/Davis": "AQ", "Antarctica/DumontDUrville": "AQ", "Antarctica/Macquarie": "AU",
  "Antarctica/Mawson": "AQ", "Antarctica/McMurdo": "AQ", "Antarctica/Palmer": "AQ",
  "Antarctica/Rothera": "AQ", "Antarctica/Syowa": "AQ", "Antarctica/Troll": "AQ",
  "Antarctica/Vostok": "AQ", "Arctic/Longyearbyen": "SJ", "Asia/Aden": "YE",
  "Asia/Almaty": "KZ", "Asia/Amman": "JO", "Asia/Anadyr": "RU",
  "Asia/Aqtau": "KZ", "Asia/Aqtobe": "KZ", "Asia/Ashgabat": "TM",
  "Asia/Atyrau": "KZ", "Asia/Baghdad": "IQ", "Asia/Bahrain": "BH",
  "Asia/Baku": "AZ", "Asia/Bangkok": "TH", "Asia/Barnaul": "RU",
  "Asia/Beirut": "LB", "Asia/Bishkek": "KG", "Asia/Brunei": "BN",
  "Asia/Chita": "RU", "Asia/Choibalsan": "MN", "Asia/Colombo": "LK",
  "Asia/Damascus": "SY", "Asia/Dhaka": "BD", "Asia/Dili": "TL",
  "Asia/Dubai": "AE", "Asia/Dushanbe": "TJ", "Asia/Famagusta": "CY",
  "Asia/Gaza": "PS", "Asia/Hebron": "PS", "Asia/Ho_Chi_Minh": "VN",
  "Asia/Hong_Kong": "HK", "Asia/Hovd": "MN", "Asia/Irkutsk": "RU",
  "Asia/Jakarta": "ID", "Asia/Jayapura": "ID", "Asia/Jerusalem": "IL",
  "Asia/Kabul": "AF", "Asia/Kamchatka": "RU", "Asia/Karachi": "PK",
  "Asia/Kathmandu": "NP", "Asia/Khandyga": "RU", "Asia/Kolkata": "IN",
  "Asia/Krasnoyarsk": "RU", "Asia/Kuala_Lumpur": "MY", "Asia/Kuching": "MY",
  "Asia/Kuwait": "KW", "Asia/Macau": "MO", "Asia/Magadan": "RU",
  "Asia/Makassar": "ID", "Asia/Manila": "PH", "Asia/Muscat": "OM",
  "Asia/Nicosia": "CY", "Asia/Novokuznetsk": "RU", "Asia/Novosibirsk": "RU",
  "Asia/Omsk": "RU", "Asia/Oral": "KZ", "Asia/Phnom_Penh": "KH",
  "Asia/Pontianak": "ID", "Asia/Pyongyang": "KP", "Asia/Qatar": "QA",
  "Asia/Qostanay": "KZ", "Asia/Qyzylorda": "KZ", "Asia/Riyadh": "SA",
  "Asia/Sakhalin": "RU", "Asia/Samarkand": "UZ", "Asia/Seoul": "KR",
  "Asia/Shanghai": "CN", "Asia/Singapore": "SG", "Asia/Srednekolymsk": "RU",
  "Asia/Taipei": "TW", "Asia/Tashkent": "UZ", "Asia/Tbilisi": "GE",
  "Asia/Tehran": "IR", "Asia/Thimphu": "BT", "Asia/Tokyo": "JP",
  "Asia/Tomsk": "RU", "Asia/Ulaanbaatar": "MN", "Asia/Urumqi": "CN",
  "Asia/Ust-Nera": "RU", "Asia/Vientiane": "LA", "Asia/Vladivostok": "RU",
  "Asia/Yakutsk": "RU", "Asia/Yangon": "MM", "Asia/Yekaterinburg": "RU",
  "Asia/Yerevan": "AM", "Atlantic/Azores": "PT", "Atlantic/Bermuda": "BM",
  "Atlantic/Canary": "ES", "Atlantic/Cape_Verde": "CV", "Atlantic/Faroe": "FO",
  "Atlantic/Madeira": "PT", "Atlantic/Reykjavik": "IS", "Atlantic/South_Georgia": "GS",
  "Atlantic/St_Helena": "SH", "Atlantic/Stanley": "FK", "Australia/Adelaide": "AU",
  "Australia/Brisbane": "AU", "Australia/Broken_Hill": "AU", "Australia/Currie": "AU",
  "Australia/Darwin": "AU", "Australia/Eucla": "AU", "Australia/Hobart": "AU",
  "Australia/Lindeman": "AU", "Australia/Lord_Howe": "AU", "Australia/Melbourne": "AU",
  "Australia/Perth": "AU", "Australia/Sydney": "AU", "Europe/Amsterdam": "NL",
  "Europe/Andorra": "AD", "Europe/Astrakhan": "RU", "Europe/Athens": "GR",
  "Europe/Belgrade": "RS", "Europe/Berlin": "DE", "Europe/Bratislava": "SK",
  "Europe/Brussels": "BE", "Europe/Bucharest": "RO", "Europe/Budapest": "HU",
  "Europe/Busingen": "DE", "Europe/Chisinau": "MD", "Europe/Copenhagen": "DK",
  "Europe/Dublin": "IE", "Europe/Gibraltar": "GI", "Europe/Guernsey": "GG",
  "Europe/Helsinki": "FI", "Europe/Isle_of_Man": "IM", "Europe/Istanbul": "TR",
  "Europe/Jersey": "JE", "Europe/Kaliningrad": "RU", "Europe/Kiev": "UA",
  "Europe/Kirov": "RU", "Europe/Lisbon": "PT", "Europe/Ljubljana": "SI",
  "Europe/London": "GB", "Europe/Luxembourg": "LU", "Europe/Madrid": "ES",
  "Europe/Malta": "MT", "Europe/Mariehamn": "AX", "Europe/Minsk": "BY",
  "Europe/Monaco": "MC", "Europe/Moscow": "RU", "Europe/Oslo": "BV",
  "Europe/Paris": "FR", "Europe/Podgorica": "ME", "Europe/Prague": "CZ",
  "Europe/Riga": "LV", "Europe/Rome": "IT", "Europe/Samara": "RU",
  "Europe/San_Marino": "SM", "Europe/Sarajevo": "BA", "Europe/Saratov": "RU",
  "Europe/Simferopol": "UA", "Europe/Skopje": "MK", "Europe/Sofia": "BG",
  "Europe/Stockholm": "SE", "Europe/Tallinn": "EE", "Europe/Tirane": "AL",
  "Europe/Ulyanovsk": "RU", "Europe/Uzhgorod": "UA", "Europe/Vaduz": "LI",
  "Europe/Vatican": "VA", "Europe/Vienna": "AT", "Europe/Vilnius": "LT",
  "Europe/Volgograd": "RU", "Europe/Warsaw": "PL", "Europe/Zagreb": "HR",
  "Europe/Zaporozhye": "UA", "Europe/Zurich": "CH", "Indian/Antananarivo": "MG",
  "Indian/Chagos": "IO", "Indian/Christmas": "CX", "Indian/Cocos": "CC",
  "Indian/Comoro": "KM", "Indian/Kerguelen": "TF", "Indian/Mahe": "SC",
  "Indian/Maldives": "MV", "Indian/Mauritius": "MU", "Indian/Mayotte": "YT",
  "Indian/Reunion": "RE", "Pacific/Apia": "WS", "Pacific/Auckland": "NZ",
  "Pacific/Bougainville": "PG", "Pacific/Chatham": "NZ", "Pacific/Chuuk": "FM",
  "Pacific/Easter": "CL", "Pacific/Efate": "VU", "Pacific/Enderbury": "KI",
  "Pacific/Fakaofo": "TK", "Pacific/Fiji": "FJ", "Pacific/Funafuti": "TV",
  "Pacific/Galapagos": "EC", "Pacific/Gambier": "PF", "Pacific/Guadalcanal": "SB",
  "Pacific/Guam": "GU", "Pacific/Honolulu": "US", "Pacific/Kiritimati": "KI",
  "Pacific/Kosrae": "FM", "Pacific/Kwajalein": "MH", "Pacific/Majuro": "MH",
  "Pacific/Marquesas": "PF", "Pacific/Midway": "UM", "Pacific/Nauru": "NR",
  "Pacific/Niue": "NU", "Pacific/Norfolk": "NF", "Pacific/Noumea": "NC",
  "Pacific/Pago_Pago": "AS", "Pacific/Palau": "PW", "Pacific/Pitcairn": "PN",
  "Pacific/Pohnpei": "FM", "Pacific/Port_Moresby": "PG", "Pacific/Rarotonga": "CK",
  "Pacific/Saipan": "MP", "Pacific/Tahiti": "PF", "Pacific/Tarawa": "KI",
  "Pacific/Tongatapu": "TO", "Pacific/Wake": "UM", "Pacific/Wallis": "WF",
};

/**
 * The reader's likely country, from the browser's timezone. Empty on the
 * server, where the runtime's own timezone says nothing about the reader —
 * which is why no caller may read this during render.
 */
export function browserCountryIso(): string {
  if (typeof Intl === "undefined") return "";
  try {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return TIMEZONE_COUNTRY[zone] ?? "";
  } catch {
    return "";
  }
}

export interface SplitPhoneNumber {
  callingCode: string;
  nationalNumber: string;
}

let cachedCallingCodes: ReadonlySet<string> | null = null;

function knownCallingCodes(): ReadonlySet<string> {
  cachedCallingCodes ??= new Set(Object.values(CALLING_CODES));
  return cachedCallingCodes;
}

/**
 * Splits a pasted international number into its calling code and the national
 * part, e.g. "+20 105 0049 899" -> { "+20", "1050049899" }.
 *
 * Longest-prefix first, because calling codes are not prefix-free: "+1" (US)
 * and "+1242" (Bahamas) both exist, and taking the shortest match would route
 * every Caribbean number to North America.
 *
 * Ported from the admin portal's `src/lib/geo/country-data.ts`, behaviour for
 * behaviour, so a number typed into either portal is split the same way.
 */
export function splitPhoneNumber(raw: string): SplitPhoneNumber | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const hadPlus = trimmed.startsWith("+") || trimmed.startsWith("00");
  const digits = trimmed.replace(/^00/u, "").replace(/[^0-9]/gu, "");
  if (!digits) return null;
  if (!hadPlus) {
    // Without an international prefix the leading digits are national, not a
    // country code — guessing one would silently rewrite the number.
    return { callingCode: "", nationalNumber: digits };
  }
  const codes = knownCallingCodes();
  for (let length = Math.min(4, digits.length); length >= 1; length -= 1) {
    const candidate = digits.slice(0, length);
    if (codes.has(candidate)) {
      return { callingCode: `+${candidate}`, nationalNumber: digits.slice(length) };
    }
  }
  return { callingCode: "", nationalNumber: digits };
}
