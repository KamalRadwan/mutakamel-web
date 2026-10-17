import type { SwatchHue } from "@/design-system";

export const UOM_CATEGORIES = [
  "COUNT",
  "PACKAGING",
  "MASS",
  "VOLUME",
  "LENGTH",
  "AREA",
  "TIME_SERVICE",
  "ENERGY",
  "PHARMA",
] as const;

export type UomCategory = (typeof UOM_CATEGORIES)[number];

export const UOM_CATEGORY_HUES: Record<UomCategory, SwatchHue> = {
  COUNT: "blue",
  PACKAGING: "amber",
  MASS: "teal",
  VOLUME: "indigo",
  LENGTH: "purple",
  AREA: "green",
  TIME_SERVICE: "orange",
  ENERGY: "pink",
  PHARMA: "red",
};

export interface StarterUomDefinition {
  readonly code: string;
  readonly nameEn: string;
  readonly nameAr: string;
  readonly category: UomCategory;
  readonly unEceCode?: string;
}

type RawStarterRow = readonly [
  code: string,
  nameEn: string,
  nameAr: string,
  category: UomCategory,
  unEceCode?: string,
];

const RAW_STARTER_ROWS: readonly RawStarterRow[] = [
  // Count (17)
  ["PCS", "Piece", "قطعة", "COUNT", "H87"],
  ["UNIT", "Unit", "وحدة", "COUNT", "C62"],
  ["PAIR", "Pair", "زوج", "COUNT", "PR"],
  ["DOZ", "Dozen", "دستة", "COUNT", "DZN"],
  ["GROSS", "Gross (144)", "جروسة", "COUNT", "GRO"],
  ["SET", "Set", "طقم", "COUNT", "SET"],
  ["KIT", "Kit", "مجموعة / كيت", "COUNT", "KT"],
  ["BNDL", "Bundle", "ربطة", "COUNT", "BE"],
  ["ROLL", "Roll", "لفة", "COUNT", "RO"],
  ["REEL", "Reel", "بكرة", "COUNT", "RL"],
  ["SHEET", "Sheet", "فرخ", "COUNT", "ST"],
  ["REAM", "Ream", "رزمة ورق (500 فرخ)", "COUNT", "RM"],
  ["BOARD", "Board", "لوح", "COUNT", "BD"],
  ["K-PCS", "Thousand pieces", "ألف قطعة", "COUNT", "T3"],
  ["LOT", "Lot", "لوط / صفقة", "COUNT", "LO"],
  ["PERSON", "Person", "فرد", "COUNT", "IE"],
  ["STICK", "Stick", "عود", "COUNT", "STK"],

  // Packaging (28)
  ["BOX", "Box", "علبة", "PACKAGING", "BX"],
  ["CTN", "Carton", "كرتونة", "PACKAGING", "CT"],
  ["PACK", "Pack", "عبوة / باكيت", "PACKAGING", "PK"],
  ["PKT", "Packet", "باكو", "PACKAGING", "PA"],
  ["BAG", "Bag", "كيس", "PACKAGING", "BG"],
  ["SACK", "Sack", "شيكارة", "PACKAGING", "SA"],
  ["BTL", "Bottle", "زجاجة", "PACKAGING", "BO"],
  ["CAN", "Can", "علبة كانز", "PACKAGING", "CA"],
  ["TIN", "Tin", "علبة صفيح", "PACKAGING", "TN"],
  ["JAR", "Jar", "برطمان", "PACKAGING", "JR"],
  ["TUBE", "Tube", "تيوب", "PACKAGING", "TU"],
  ["PAL", "Pallet", "باليت", "PACKAGING", "PF"],
  ["DRUM", "Drum", "برميل", "PACKAGING", "DR"],
  ["CRATE", "Crate", "كريت / قفص", "PACKAGING", "CR"],
  ["TRAY", "Tray", "صينية", "PACKAGING"],
  ["BLIST", "Blister", "بليستر / شريط", "PACKAGING"],
  ["VIAL", "Vial", "فيال", "PACKAGING", "VI"],
  ["AMPL", "Ampoule", "أمبول", "PACKAGING", "AM"],
  ["SACHET", "Sachet", "ساشيه", "PACKAGING", "SH"],
  ["CASE", "Case", "صندوق", "PACKAGING", "CS"],
  ["BALE", "Bale", "بالة", "PACKAGING", "BL"],
  ["PAIL", "Pail", "جردل", "PACKAGING", "PL"],
  ["BASKET", "Basket", "سلة", "PACKAGING", "BK"],
  ["CONT", "Container", "حاوية", "PACKAGING", "CH"],
  ["TRUCK", "Truckload", "نقلة / عربية", "PACKAGING", "TC"],
  ["TANK", "Tank", "خزان", "PACKAGING", "TK"],
  ["CYL", "Gas cylinder", "أنبوبة غاز", "PACKAGING", "CY"],
  ["JERRY", "Jerrycan", "جركن", "PACKAGING"],

  // Mass (12)
  ["KG", "Kilogram", "كيلوجرام", "MASS", "KGM"],
  ["G", "Gram", "جرام", "MASS", "GRM"],
  ["MG", "Milligram", "مللي جرام", "MASS", "MGM"],
  ["MCG", "Microgram", "ميكروجرام", "MASS", "MC"],
  ["TON", "Metric tonne", "طن", "MASS", "TNE"],
  ["QNT-M", "Metric quintal (100 kg)", "قنطار متري", "MASS", "DTN"],
  ["QNT-E", "Egyptian cantar (44.93 kg)", "قنطار مصري", "MASS"],
  ["RATL", "Egyptian ratl (449 g)", "رطل مصري", "MASS"],
  ["ARDEB", "Ardeb", "أردب", "MASS"],
  ["LB", "Pound", "رطل إنجليزي (باوند)", "MASS", "LBR"],
  ["OZ", "Ounce", "أوقية", "MASS", "ONZ"],
  ["CARAT", "Metric carat", "قيراط (ذهب/ألماس)", "MASS", "CTM"],

  // Volume (9)
  ["L", "Litre", "لتر", "VOLUME", "LTR"],
  ["ML", "Millilitre", "مللي لتر", "VOLUME", "MLT"],
  ["CL", "Centilitre", "سنتيلتر", "VOLUME", "CLT"],
  ["HL", "Hectolitre", "هكتولتر", "VOLUME", "HLT"],
  ["M3", "Cubic metre", "متر مكعب", "VOLUME", "MTQ"],
  ["CM3", "Cubic centimetre", "سنتيمتر مكعب", "VOLUME", "CMQ"],
  ["GAL", "Gallon (US)", "جالون", "VOLUME", "GLL"],
  ["PINT", "Pint (US)", "باينت", "VOLUME", "PT"],
  ["BBL", "Barrel (oil)", "برميل نفط", "VOLUME", "BLL"],

  // Length (9)
  ["M", "Metre", "متر", "LENGTH", "MTR"],
  ["CM", "Centimetre", "سنتيمتر", "LENGTH", "CMT"],
  ["MM", "Millimetre", "مليمتر", "LENGTH", "MMT"],
  ["DM", "Decimetre", "ديسيمتر", "LENGTH", "DMT"],
  ["KM", "Kilometre", "كيلومتر", "LENGTH", "KMT"],
  ["IN", "Inch", "بوصة", "LENGTH", "INH"],
  ["FT", "Foot", "قدم", "LENGTH", "FOT"],
  ["YD", "Yard", "ياردة", "LENGTH", "YRD"],
  ["MILE", "Mile", "ميل", "LENGTH", "SMI"],

  // Area (10)
  ["M2", "Square metre", "متر مربع", "AREA", "MTK"],
  ["CM2", "Square centimetre", "سم مربع", "AREA", "CMK"],
  ["MM2", "Square millimetre", "مم مربع", "AREA", "MMK"],
  ["KM2", "Square kilometre", "كم مربع", "AREA", "KMK"],
  ["FT2", "Square foot", "قدم مربع", "AREA", "FTK"],
  ["YD2", "Square yard", "ياردة مربعة", "AREA", "YDK"],
  ["HA", "Hectare", "هكتار", "AREA", "HAR"],
  ["FED", "Feddan (4200.83 m²)", "فدان", "AREA"],
  ["QIR", "Qirat (1/24 feddan)", "قيراط", "AREA"],
  ["SAHM", "Sahm (1/24 qirat)", "سهم", "AREA"],

  // Time and services (16)
  ["HR", "Hour", "ساعة", "TIME_SERVICE", "HUR"],
  ["DAY", "Day", "يوم", "TIME_SERVICE", "DAY"],
  ["MIN", "Minute", "دقيقة", "TIME_SERVICE", "MIN"],
  ["SEC", "Second", "ثانية", "TIME_SERVICE", "SEC"],
  ["WEEK", "Week", "أسبوع", "TIME_SERVICE", "WEE"],
  ["MONTH", "Month", "شهر", "TIME_SERVICE", "MON"],
  ["YEAR", "Year", "سنة", "TIME_SERVICE", "ANN"],
  ["JOB", "Job", "مهمة / أمر شغل", "TIME_SERVICE"],
  ["MANDAY", "Man-day", "يومية عامل", "TIME_SERVICE"],
  ["LS", "Lump sum", "مقطوعية", "TIME_SERVICE"],
  ["VISIT", "Visit", "زيارة", "TIME_SERVICE"],
  ["SESS", "Session", "جلسة", "TIME_SERVICE"],
  ["TRIP", "Trip", "رحلة / مشوار", "TIME_SERVICE"],
  ["DELIV", "Delivery", "توصيلة", "TIME_SERVICE"],
  ["SUB", "Subscription", "اشتراك", "TIME_SERVICE"],
  ["PAGE", "Page", "صفحة", "TIME_SERVICE"],

  // Energy and electrical (10)
  ["KWH", "Kilowatt-hour", "كيلوواط/ساعة", "ENERGY", "KWH"],
  ["MWH", "Megawatt-hour", "ميجاواط/ساعة", "ENERGY", "MWH"],
  ["W", "Watt", "وات", "ENERGY", "WTT"],
  ["KW", "Kilowatt", "كيلوواط", "ENERGY", "KWT"],
  ["MW", "Megawatt", "ميجاواط", "ENERGY", "MAW"],
  ["KVA", "Kilovolt-ampere", "ك.ف.أ", "ENERGY", "KVA"],
  ["KVAR", "Kilovolt-ampere reactive", "ك.ف.أ.ر", "ENERGY", "K5"],
  ["A", "Ampere", "أمبير", "ENERGY", "AMP"],
  ["V", "Volt", "فولت", "ENERGY", "VLT"],
  ["HZ", "Hertz", "هرتز", "ENERGY", "HTZ"],

  // Pharmaceutical (8)
  ["TAB", "Tablet", "قرص", "PHARMA"],
  ["CAPS", "Capsule", "كبسولة", "PHARMA"],
  ["DOSE", "Dose", "جرعة", "PHARMA"],
  ["DROP", "Drop", "نقطة", "PHARMA"],
  ["PATCH", "Patch", "لصقة", "PHARMA"],
  ["SUPP", "Suppository", "لبوس", "PHARMA"],
  ["PUFF", "Puff", "بخّة", "PHARMA"],
  ["IU", "International unit", "وحدة دولية", "PHARMA"],
];

export const STARTER_UOM_LIBRARY: readonly StarterUomDefinition[] = Object.freeze(
  RAW_STARTER_ROWS.map(([code, nameEn, nameAr, category, unEceCode]) =>
    Object.freeze({
      code,
      nameEn,
      nameAr,
      category,
      ...(unEceCode ? { unEceCode } : {}),
    }),
  ),
);

const STARTER_BY_CODE = new Map<string, StarterUomDefinition>(
  STARTER_UOM_LIBRARY.map((item) => [item.code, item]),
);

export interface UomCatalogueMetadata {
  category: UomCategory;
  hue: SwatchHue;
  isStandard: boolean;
  unEceCode?: string;
}

const CATEGORY_KEYWORDS: ReadonlyArray< readonly [UomCategory, RegExp]> = [
  ["PACKAGING", /(?:^|[-_.])(BOX|CTN|CARTON|PACK|PKT|BAG|SACK|BTL|BOTTLE|CAN|TIN|JAR|TUBE|PAL|PALLET|DRUM|CRATE|TRAY|BLIST|VIAL|AMPL|SACHET|CASE|BALE|PAIL|BASKET|CONT|TRUCK|TANK|CYL|JERRY)/iu],
  ["MASS", /(?:^|[-_.])(KG|KILO|GRAM|MG|MCG|TON|TONNE|QNT|RATL|ARDEB|LB|POUND|OZ|OUNCE|CARAT)/iu],
  ["VOLUME", /(?:^|[-_.])(LITRE|LITER|ML|CL|HL|M3|CM3|GAL|GALLON|PINT|BBL|BARREL|L)(?:$|[-_.\d])/iu],
  ["AREA", /(?:^|[-_.])(M2|CM2|MM2|KM2|FT2|YD2|SQ|HA|HECTARE|FED|FEDDAN|QIR|QIRAT|SAHM)/iu],
  ["LENGTH", /(?:^|[-_.])(METRE|METER|CM|MM|DM|KM|INCH|FT|FOOT|YD|YARD|MILE)(?:$|[-_.\d])/iu],
  ["TIME_SERVICE", /(?:^|[-_.])(HR|HOUR|DAY|MIN|SEC|WEEK|MONTH|YEAR|JOB|MANDAY|VISIT|SESS|TRIP|DELIV|SUB|SHIFT)/iu],
  ["ENERGY", /(?:^|[-_.])(KWH|MWH|WATT|KW|MW|KVA|KVAR|AMP|VOLT|HZ|HERTZ)/iu],
  ["PHARMA", /(?:^|[-_.])(TAB|TABLET|CAPS|CAPSULE|DOSE|DROP|PATCH|SUPP|PUFF|IU)/iu],
];

export function inferUomCategory(
  code: string,
  displayName = "",
  localizedNames?: Record<string, string>,
): UomCategory {
  const normalizedCode = code.trim().toUpperCase();
  const exact = STARTER_BY_CODE.get(normalizedCode);
  if (exact) return exact.category;

  const prefix = normalizedCode.split(/[-_.]/)[0] ?? "";
  const prefixMatch = STARTER_BY_CODE.get(prefix);
  if (prefixMatch) return prefixMatch.category;

  const combined = `${normalizedCode} ${displayName} ${localizedNames?.en ?? ""}`;
  for (const [category, pattern] of CATEGORY_KEYWORDS) {
    if (pattern.test(combined)) return category;
  }
  return "COUNT";
}

export function getUomCatalogueMetadata(
  code: string,
  displayName = "",
  localizedNames?: Record<string, string>,
): UomCatalogueMetadata {
  const normalizedCode = code.trim().toUpperCase();
  const exact = STARTER_BY_CODE.get(normalizedCode);
  if (exact) {
    return {
      category: exact.category,
      hue: UOM_CATEGORY_HUES[exact.category],
      isStandard: true,
      unEceCode: exact.unEceCode,
    };
  }
  const category = inferUomCategory(normalizedCode, displayName, localizedNames);
  return {
    category,
    hue: UOM_CATEGORY_HUES[category],
    isStandard: false,
  };
}

export interface QuickUomPreset {
  readonly code: string;
  readonly displayName: string;
  readonly nameAr: string;
  readonly nameEn: string;
  readonly category: UomCategory;
}

export const QUICK_PACKAGING_PRESETS: readonly QuickUomPreset[] = Object.freeze([
  {
    code: "CTN-24",
    displayName: "Carton of 24 pieces",
    nameAr: "كرتونة 24 قطعة",
    nameEn: "Carton of 24 pieces",
    category: "PACKAGING",
  },
  {
    code: "BOX-12",
    displayName: "Box of 12 units",
    nameAr: "علبة 12 وحدة",
    nameEn: "Box of 12 units",
    category: "PACKAGING",
  },
  {
    code: "PAL-EUR",
    displayName: "Euro Pallet (80×120)",
    nameAr: "باليت أوروبي قياسي",
    nameEn: "Euro Pallet (80×120)",
    category: "PACKAGING",
  },
  {
    code: "SACK-50KG",
    displayName: "Sack (50 kg)",
    nameAr: "شيكارة 50 كجم",
    nameEn: "Sack (50 kg)",
    category: "PACKAGING",
  },
  {
    code: "DRUM-200L",
    displayName: "Steel Drum (200 L)",
    nameAr: "برميل 200 لتر",
    nameEn: "Steel Drum (200 L)",
    category: "PACKAGING",
  },
]);

export const EXPORT_LOCALE_OPTIONS = [
  { code: "fr", labelKey: "uomLocale_fr" },
  { code: "tr", labelKey: "uomLocale_tr" },
  { code: "de", labelKey: "uomLocale_de" },
  { code: "es", labelKey: "uomLocale_es" },
  { code: "it", labelKey: "uomLocale_it" },
  { code: "pt", labelKey: "uomLocale_pt" },
  { code: "ru", labelKey: "uomLocale_ru" },
  { code: "zh-CN", labelKey: "uomLocale_zhCN" },
] as const;

const VALID_CODE_CHECK = /^[A-Za-z][A-Za-z0-9._-]{0,31}$/u;

/**
 * Generates up to 3 valid uppercase UOM codes from a malformed code input or
 * display name so the user can fix syntax errors with a single click.
 */
export function suggestValidUomCodes(rawCode: string, displayName = ""): string[] {
  const candidates = new Set<string>();
  const cleaned = rawCode
    .trim()
    .toUpperCase()
    .replace(/\s+/gu, "-")
    .replace(/[^A-Z0-9._-]/gu, "")
    .replace(/-+/gu, "-")
    .replace(/^[-_.]+|[-_.]+$/gu, "");

  if (cleaned) {
    // If it starts with digits (e.g. "24-BOX" or "24BOX"), move leading digits to the end ("BOX-24")
    const leadingDigitMatch = /^(\d+)[-_.]*([A-Z][A-Z0-9._-]*)$/u.exec(cleaned);
    if (leadingDigitMatch) {
      const flipped = `${leadingDigitMatch[2]}-${leadingDigitMatch[1]}`.slice(0, 32);
      if (VALID_CODE_CHECK.test(flipped)) candidates.add(flipped);
    }
    const prefixed = (/^[A-Z]/u.test(cleaned) ? cleaned : `UOM-${cleaned}`).slice(0, 32);
    if (VALID_CODE_CHECK.test(prefixed)) candidates.add(prefixed);
  }

  if (displayName.trim()) {
    const words = displayName
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9\s]/gu, " ")
      .split(/\s+/u)
      .filter(Boolean);
    if (words.length > 0) {
      const joined = words.slice(0, 3).join("-").slice(0, 32);
      const validJoined = /^[A-Z]/u.test(joined) ? joined : `UOM-${joined}`.slice(0, 32);
      if (VALID_CODE_CHECK.test(validJoined)) candidates.add(validJoined);
    }
  }

  if (candidates.size === 0) {
    candidates.add("CTN-24");
    candidates.add("BOX-12");
    candidates.add("UNIT-STD");
  }

  return Array.from(candidates).slice(0, 4);
}

/**
 * Generates up to 4 available alternative UOM codes when a `409 UOM_CODE_TAKEN`
 * conflict occurs.
 */
export function suggestAlternativeUomCodes(
  takenCode: string,
  existingCodes: Iterable<string> = [],
): string[] {
  const takenSet = new Set<string>(
    Array.from(existingCodes, (code) => code.trim().toUpperCase()),
  );
  const base = takenCode
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9._-]/gu, "")
    .replace(/^[0-9._-]+/gu, "") || "UOM";
  takenSet.add(base);

  const suffixes = ["-24", "-12", "-MASTER", "-EXP", "-B2B", "-2"];
  const results: string[] = [];
  for (const suffix of suffixes) {
    const candidate = `${base.slice(0, 32 - suffix.length)}${suffix}`;
    if (VALID_CODE_CHECK.test(candidate) && !takenSet.has(candidate)) {
      results.push(candidate);
      if (results.length >= 4) break;
    }
  }
  return results;
}
