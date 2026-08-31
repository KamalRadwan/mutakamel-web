/**
 * Curated industry catalogue for tenant registration.
 *
 * Core stores `industry` as free text, so this list is a data-entry aid rather
 * than a constraint: it keeps the common cases spelled consistently across
 * tenants (which free text never did) while `OTHER` still allows anything the
 * list does not cover.
 *
 * Keys are stable and never localized -- the English label is what reaches the
 * API, so changing a translation cannot silently repartition existing tenants.
 */
export interface IndustryOption {
  key: string;
  en: string;
  ar: string;
}

export const OTHER_INDUSTRY_KEY = "other";

export const INDUSTRY_OPTIONS: readonly IndustryOption[] = [
  { key: "accounting", en: "Accounting & Auditing", ar: "المحاسبة والمراجعة" },
  { key: "advertising", en: "Advertising & Marketing", ar: "الإعلان والتسويق" },
  { key: "agriculture", en: "Agriculture & Farming", ar: "الزراعة" },
  { key: "airlines", en: "Airlines & Aviation", ar: "الطيران" },
  { key: "apparel", en: "Apparel & Fashion", ar: "الأزياء والملابس" },
  { key: "architecture", en: "Architecture & Planning", ar: "العمارة والتخطيط" },
  { key: "automotive", en: "Automotive", ar: "السيارات" },
  { key: "banking", en: "Banking", ar: "الخدمات المصرفية" },
  { key: "biotechnology", en: "Biotechnology", ar: "التقنية الحيوية" },
  { key: "broadcasting", en: "Broadcasting & Media", ar: "الإعلام والبث" },
  { key: "chemicals", en: "Chemicals", ar: "الكيماويات" },
  { key: "construction", en: "Construction", ar: "المقاولات والإنشاءات" },
  { key: "consulting", en: "Consulting", ar: "الاستشارات" },
  { key: "consumer-goods", en: "Consumer Goods", ar: "السلع الاستهلاكية" },
  { key: "education", en: "Education & Training", ar: "التعليم والتدريب" },
  { key: "electronics", en: "Electronics", ar: "الإلكترونيات" },
  { key: "energy", en: "Energy & Utilities", ar: "الطاقة والمرافق" },
  { key: "engineering", en: "Engineering", ar: "الهندسة" },
  { key: "entertainment", en: "Entertainment", ar: "الترفيه" },
  { key: "environmental", en: "Environmental Services", ar: "الخدمات البيئية" },
  { key: "events", en: "Events & Hospitality Services", ar: "الفعاليات والضيافة" },
  { key: "financial-services", en: "Financial Services", ar: "الخدمات المالية" },
  { key: "food-beverage", en: "Food & Beverage", ar: "الأغذية والمشروبات" },
  { key: "government", en: "Government & Public Sector", ar: "القطاع الحكومي" },
  { key: "healthcare", en: "Healthcare & Medical", ar: "الرعاية الصحية" },
  { key: "hospitality", en: "Hotels & Hospitality", ar: "الفنادق والضيافة" },
  { key: "human-resources", en: "Human Resources & Staffing", ar: "الموارد البشرية والتوظيف" },
  { key: "import-export", en: "Import & Export", ar: "الاستيراد والتصدير" },
  { key: "information-technology", en: "Information Technology", ar: "تقنية المعلومات" },
  { key: "insurance", en: "Insurance", ar: "التأمين" },
  { key: "legal", en: "Legal Services", ar: "الخدمات القانونية" },
  { key: "logistics", en: "Logistics & Supply Chain", ar: "الخدمات اللوجستية وسلاسل الإمداد" },
  { key: "machinery", en: "Machinery & Equipment", ar: "الآلات والمعدات" },
  { key: "manufacturing", en: "Manufacturing", ar: "التصنيع" },
  { key: "maritime", en: "Maritime & Shipping", ar: "النقل البحري والشحن" },
  { key: "mining", en: "Mining & Metals", ar: "التعدين والمعادن" },
  { key: "non-profit", en: "Non-Profit & NGO", ar: "المنظمات غير الربحية" },
  { key: "oil-gas", en: "Oil & Gas", ar: "النفط والغاز" },
  { key: "packaging", en: "Packaging & Containers", ar: "التغليف والتعبئة" },
  { key: "pharmaceuticals", en: "Pharmaceuticals", ar: "الأدوية" },
  { key: "printing", en: "Printing & Publishing", ar: "الطباعة والنشر" },
  { key: "real-estate", en: "Real Estate", ar: "العقارات" },
  { key: "research", en: "Research & Development", ar: "البحث والتطوير" },
  { key: "restaurants", en: "Restaurants & Catering", ar: "المطاعم والتموين" },
  { key: "retail", en: "Retail & Wholesale", ar: "التجزئة والجملة" },
  { key: "security", en: "Security Services", ar: "الخدمات الأمنية" },
  { key: "sports", en: "Sports & Recreation", ar: "الرياضة والترفيه" },
  { key: "telecommunications", en: "Telecommunications", ar: "الاتصالات" },
  { key: "textiles", en: "Textiles", ar: "المنسوجات" },
  { key: "tourism", en: "Travel & Tourism", ar: "السفر والسياحة" },
  { key: "transportation", en: "Transportation", ar: "النقل" },
  { key: "veterinary", en: "Veterinary Services", ar: "الخدمات البيطرية" },
  { key: "warehousing", en: "Warehousing", ar: "التخزين" },
  { key: "waste-management", en: "Waste Management", ar: "إدارة النفايات" },
];

export function industryLabel(option: IndustryOption, lang: string): string {
  return lang === "ar" ? option.ar : option.en;
}

/**
 * Maps a stored industry string back onto a catalogue entry.
 *
 * Existing tenants hold arbitrary free text, so an unmatched value is not an
 * error -- it resolves to `OTHER` with the stored text preserved verbatim.
 */
export function matchIndustry(value: string): IndustryOption | null {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;
  return (
    INDUSTRY_OPTIONS.find(
      (option) =>
        option.en.toLowerCase() === normalized ||
        option.ar === value.trim() ||
        option.key === normalized,
    ) ?? null
  );
}
