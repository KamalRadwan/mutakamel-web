import type { SwatchHue } from "@/design-system";

export const CATEGORY_DOMAINS = [
  "FOOD_BEV",
  "PACKAGING",
  "ELECTRONICS",
  "PHARMA",
  "AGRICULTURE",
  "INDUSTRIAL",
  "LOGISTICS",
  "GENERAL",
] as const;

export type CategoryDomain = (typeof CATEGORY_DOMAINS)[number];

export const CATEGORY_DOMAIN_HUES: Record<CategoryDomain, SwatchHue> = {
  FOOD_BEV: "green",
  PACKAGING: "amber",
  ELECTRONICS: "indigo",
  PHARMA: "red",
  AGRICULTURE: "teal",
  INDUSTRIAL: "blue",
  LOGISTICS: "purple",
  GENERAL: "orange",
};

export const CATEGORY_DEPTH_HUES: Record<number, SwatchHue> = {
  1: "indigo",
  2: "blue",
  3: "purple",
  4: "teal",
  5: "green",
  6: "amber",
  7: "orange",
  8: "pink",
};

export interface StarterCategoryTemplate {
  readonly code: string;
  readonly displayName: string;
  readonly nameEn: string;
  readonly nameAr: string;
  readonly domain: CategoryDomain;
}

export const STARTER_CATEGORY_TEMPLATES: readonly StarterCategoryTemplate[] = [
  {
    code: "FOOD-BEV",
    displayName: "Food & Beverages",
    nameEn: "Food & Beverages",
    nameAr: "الأغذية والمشروبات",
    domain: "FOOD_BEV",
  },
  {
    code: "BEV-COLD",
    displayName: "Cold Beverages & Juices",
    nameEn: "Cold Beverages & Juices",
    nameAr: "المشروبات الباردة والعصائر",
    domain: "FOOD_BEV",
  },
  {
    code: "IND-PACK",
    displayName: "Industrial Packaging & Containers",
    nameEn: "Industrial Packaging & Containers",
    nameAr: "مواد التعبئة والتغليف الصناعي",
    domain: "PACKAGING",
  },
  {
    code: "PACK-CARTON",
    displayName: "Corrugated Shipping Cartons",
    nameEn: "Corrugated Shipping Cartons",
    nameAr: "كراتين الشحن المضلعة والقياسية",
    domain: "PACKAGING",
  },
  {
    code: "ELEC-POS",
    displayName: "POS Hardware & Barcode Scanners",
    nameEn: "POS Hardware & Barcode Scanners",
    nameAr: "أجهزة نقاط البيع وقارئات الباركود",
    domain: "ELECTRONICS",
  },
  {
    code: "PHARMA-MED",
    displayName: "Medical & Pharmaceutical Supplies",
    nameEn: "Medical & Pharmaceutical Supplies",
    nameAr: "المستلزمات الطبية والدوائية",
    domain: "PHARMA",
  },
  {
    code: "AGRI-BULK",
    displayName: "Agricultural Crops & Bulk Grains",
    nameEn: "Agricultural Crops & Bulk Grains",
    nameAr: "الحبوب والمحاصيل الزراعية السائبة",
    domain: "AGRICULTURE",
  },
  {
    code: "RAW-MAT",
    displayName: "Raw Materials & Production Inputs",
    nameEn: "Raw Materials & Production Inputs",
    nameAr: "الخامات ومستلزمات الإنتاج",
    domain: "INDUSTRIAL",
  },
  {
    code: "LOG-COLD",
    displayName: "Cold-Chain & Fleet Logistics",
    nameEn: "Cold-Chain & Fleet Logistics",
    nameAr: "خدمات النقل المبرد واللوجستيات",
    domain: "LOGISTICS",
  },
];

export const COMMON_CATEGORY_LOCALES: ReadonlyArray<{
  readonly code: string;
  readonly label: string;
}> = [
  { code: "ar", label: "العربية (ar)" },
  { code: "en", label: "English (en)" },
  { code: "fr", label: "Français (fr)" },
  { code: "tr", label: "Türkçe (tr)" },
  { code: "de", label: "Deutsch (de)" },
  { code: "zh-CN", label: "中文 (zh-CN)" },
];

export function getCategoryDepthHue(depth: number): SwatchHue {
  return CATEGORY_DEPTH_HUES[depth] ?? "indigo";
}

export function getCategoryDomainMetadata(
  code: string,
  displayName = "",
  depth = 1,
): {
  readonly domain: CategoryDomain;
  readonly hue: SwatchHue;
  readonly depthHue: SwatchHue;
} {
  const combined = `${code} ${displayName}`.toUpperCase();
  let domain: CategoryDomain = "GENERAL";

  if (/(FOOD|BEV|JUICE|WATER|DAIRY|DRINK|MEAT|BAKERY|SNACK)/u.test(combined)) {
    domain = "FOOD_BEV";
  } else if (/(PACK|CARTON|BOX|PALLET|WRAP|BOTTLE|CONTAINER)/u.test(combined)) {
    domain = "PACKAGING";
  } else if (/(ELEC|POS|PRN|SCAN|TECH|COMP|DEVICE|HARD)/u.test(combined)) {
    domain = "ELECTRONICS";
  } else if (/(PHARMA|MED|VAX|CLINIC|BIO|DRUG|HEALTH)/u.test(combined)) {
    domain = "PHARMA";
  } else if (/(AGRI|GRAIN|WHEAT|CROP|SEED|FARM|FEED)/u.test(combined)) {
    domain = "AGRICULTURE";
  } else if (/(IND|RAW|MAT|CHEM|STEEL|SPARE|TOOL|EQUIP)/u.test(combined)) {
    domain = "INDUSTRIAL";
  } else if (/(LOG|FLEET|SHIP|TRANS|FREIGHT|DELIV)/u.test(combined)) {
    domain = "LOGISTICS";
  }

  const depthHue = getCategoryDepthHue(depth);
  const hue = domain === "GENERAL" ? depthHue : CATEGORY_DOMAIN_HUES[domain];

  return { domain, hue, depthHue };
}

export function suggestValidCategoryCodes(
  rawCode: string,
  displayName = "",
): string[] {
  const suggestions = new Set<string>();
  const cleanedFromCode = rawCode
    .toUpperCase()
    .replace(/[^A-Z0-9._-]+/gu, "-")
    .replace(/^[^A-Z0-9]+/gu, "")
    .replace(/-{2,}/gu, "-")
    .replace(/[-._]+$/gu, "")
    .slice(0, 80);

  if (
    cleanedFromCode &&
    /^[A-Z0-9][A-Z0-9._-]{0,79}$/u.test(cleanedFromCode)
  ) {
    suggestions.add(cleanedFromCode);
  }

  const words = displayName
    .toUpperCase()
    .replace(/[^A-Z0-9 ]+/gu, " ")
    .trim()
    .split(/\s+/u)
    .filter(Boolean);

  if (words.length > 0) {
    const slug = words.slice(0, 3).join("-").slice(0, 40);
    if (/^[A-Z0-9][A-Z0-9._-]{0,79}$/u.test(slug)) {
      suggestions.add(slug);
    }
    const prefix = words
      .slice(0, 3)
      .map((w) => w.slice(0, 4))
      .join("-");
    if (/^[A-Z0-9][A-Z0-9._-]{0,79}$/u.test(prefix)) {
      suggestions.add(prefix);
    }
  }

  if (suggestions.size === 0) {
    suggestions.add("CAT-MAIN-01");
  }

  return [...suggestions].slice(0, 3);
}
