import { SWATCH_SURFACE_PALETTES, type SwatchHue } from "@/design-system";
import type { Channel, ChannelFormValues, ChannelType } from "./channel-contract";

export interface ChannelTypePalette {
  type: ChannelType;
  hue: SwatchHue;
  labelEn: string;
  labelAr: string;
  shortEn: string;
  shortAr: string;
  descriptionEn: string;
  descriptionAr: string;
  badgeClass: string;
  cardBorderClass: string;
  topAccentClass: string;
  iconBgClass: string;
  dotClass: string;
}

export interface ChannelStarterTemplate {
  id: string;
  code: string;
  nameEn: string;
  nameAr: string;
  channelType: ChannelType;
  summaryEn: string;
  summaryAr: string;
}

function buildPalette(
  type: ChannelType,
  hue: SwatchHue,
  meta: Omit<
    ChannelTypePalette,
    | "type"
    | "hue"
    | "badgeClass"
    | "cardBorderClass"
    | "topAccentClass"
    | "iconBgClass"
    | "dotClass"
  >,
): ChannelTypePalette {
  const s = SWATCH_SURFACE_PALETTES[hue];
  return {
    type,
    hue,
    ...meta,
    badgeClass: s.badge,
    cardBorderClass: s.sectionCard,
    topAccentClass: s.dot,
    iconBgClass: s.iconBoxIdle,
    dotClass: s.dot,
  };
}

export const CHANNEL_TYPE_PALETTES: Record<ChannelType, ChannelTypePalette> = {
  POS: buildPalette("POS", "green", {
    labelEn: "Point of Sale (POS)",
    labelAr: "نقاط البيع المباشر (POS)",
    shortEn: "Retail POS",
    shortAr: "نقاط بيع",
    descriptionEn: "Walk-in retail stores, cash registers, barcode checkouts & shift tills",
    descriptionAr: "المعارض والفروع وصناديق الكاشير والبيع المباشر للجمهور",
  }),
  ECOMMERCE: buildPalette("ECOMMERCE", "indigo", {
    labelEn: "eCommerce Storefront",
    labelAr: "المتجر الإلكتروني وتطبيقات التسوق",
    shortEn: "eCommerce",
    shortAr: "متجر إلكتروني",
    descriptionEn: "Direct-to-consumer web storefronts and mobile shopping applications",
    descriptionAr: "البيع المباشر للمستهلك عبر الموقع الإلكتروني وتطبيقات الهاتف",
  }),
  B2B_PORTAL: buildPalette("B2B_PORTAL", "blue", {
    labelEn: "B2B Wholesale Portal",
    labelAr: "بوابة مبيعات الجملة والشركات (B2B)",
    shortEn: "B2B Portal",
    shortAr: "بوابة جملة B2B",
    descriptionEn: "Self-service wholesale ordering portal for corporate buyers & distributors",
    descriptionAr: "بوابة طلبات الجملة والتعاقدات للموزعين والشركات والصيدليات",
  }),
  FIELD_SALES: buildPalette("FIELD_SALES", "amber", {
    labelEn: "Field & Van Sales",
    labelAr: "المبيعات الميدانية وأسطول المناديب",
    shortEn: "Field Sales",
    shortAr: "مبيعات ميدانية",
    descriptionEn: "Mobile sales representatives, distribution vans, and route-based orders",
    descriptionAr: "مناديب التوزيع الميداني وسيارات التوزيع ومسارات البيع الخارجي",
  }),
  MARKETPLACE: buildPalette("MARKETPLACE", "purple", {
    labelEn: "3rd-Party Marketplace",
    labelAr: "منصات الأسواق الإلكترونية الخارجية",
    shortEn: "Marketplace",
    shortAr: "سوق خارجي",
    descriptionEn: "External marketplace syndication (Amazon, Noon, Talabat, Instashop)",
    descriptionAr: "قنوات البيع عبر الأسواق والمنصات الخارجية مثل أمازون ونون وطلبات",
  }),
  INTERNAL_SALES: buildPalette("INTERNAL_SALES", "teal", {
    labelEn: "Internal Direct Sales",
    labelAr: "مكتب المبيعات الداخلية والتعاقدات",
    shortEn: "Direct Desk",
    shortAr: "مبيعات داخلية",
    descriptionEn: "Back-office sales desk, telesales teams, and key account quotations",
    descriptionAr: "فريق المبيعات الداخلية وعروض الأسعار المباشرة لكبار العملاء",
  }),
  API: buildPalette("API", "pink", {
    labelEn: "Partner API / EDI",
    labelAr: "الربط البرمجي الآلي (API / EDI)",
    shortEn: "Partner API",
    shortAr: "ربط برمجي API",
    descriptionEn: "Automated ERP-to-ERP partner order ingestion and EDI integrations",
    descriptionAr: "استقبال أوامر التوريد والبيع آلياً عبر الربط البرمجي مع أنظمة الشركاء",
  }),
};

export const CHANNEL_STARTER_TEMPLATES: ChannelStarterTemplate[] = [
  {
    id: "tpl-pos-flagship",
    code: "POS-CAIRO-MAIN",
    nameEn: "Cairo Flagship Retail POS Network",
    nameAr: "شبكة نقاط البيع المباشر — القاهرة",
    channelType: "POS",
    summaryEn: "Walk-in retail counters & branch cashiers",
    summaryAr: "نقاط البيع المباشر وصناديق الكاشير بالفروع",
  },
  {
    id: "tpl-ecom-web",
    code: "ECOM-EG-WEB",
    nameEn: "Direct Web & Mobile eCommerce Storefront",
    nameAr: "المتجر الإلكتروني المباشر وتطبيق الجوال",
    channelType: "ECOMMERCE",
    summaryEn: "24/7 consumer online checkout & delivery",
    summaryAr: "البيع المباشر للمستهلك عبر الويب والتطبيق",
  },
  {
    id: "tpl-b2b-wholesale",
    code: "B2B-RETAIL-CHAIN",
    nameEn: "Wholesale Key Accounts & Retailers B2B Portal",
    nameAr: "بوابة مبيعات الجملة لكبار العملاء والتجار",
    channelType: "B2B_PORTAL",
    summaryEn: "Contract pricing & bulk order portal",
    summaryAr: "بوابة طلبات الجملة والتسعير التعاقدي",
  },
  {
    id: "tpl-field-van",
    code: "FIELD-VAN-FLEET",
    nameEn: "Regional Field & Route Van Sales Fleet",
    nameAr: "أسطول المناديب والتوزيع الميداني",
    channelType: "FIELD_SALES",
    summaryEn: "Mobile reps & route distribution",
    summaryAr: "مناديب المبيعات ومسارات التوزيع المباشر",
  },
  {
    id: "tpl-marketplace",
    code: "MKT-EXTERNAL-FEED",
    nameEn: "External Digital Marketplace Feed",
    nameAr: "قناة الأسواق والمنصات الإلكترونية الخارجية",
    channelType: "MARKETPLACE",
    summaryEn: "3rd-party marketplace catalog sync",
    summaryAr: "الربط مع الأسواق الإلكترونية الخارجية",
  },
  {
    id: "tpl-internal-desk",
    code: "INT-DESK-HQ",
    nameEn: "Corporate Telesales & Direct Sales Desk",
    nameAr: "مكتب المبيعات الداخلية والتعاقدات المباشرة",
    channelType: "INTERNAL_SALES",
    summaryEn: "Back-office quotations & phone orders",
    summaryAr: "عروض الأسعار الهاتفية والمبيعات المكتبية",
  },
  {
    id: "tpl-api-edi",
    code: "API-EDI-PARTNER",
    nameEn: "Automated B2B Partner EDI / API Channel",
    nameAr: "قناة الربط البرمجي الآلي مع الشركاء (API)",
    channelType: "API",
    summaryEn: "System-to-system order integration",
    summaryAr: "الربط الآلي لاستقبال الطلبات من أنظمة الشركاء",
  },
];

export const CHANNEL_UI_COPY = {
  en: {
    livePreview: "Live Channel Preview",
    readyToSave: "Ready to Save",
    incomplete: "Incomplete",
    namePlaceholder: "Commercial channel name...",
    companyScope: "Company Scope",
    checklistTitle: "Contract Readiness Checklist",
    codeFormatCheck: "Valid channel code format (1–80 chars)",
    codeUniqueCheck: "Unique channel code across company",
    nameLengthCheck: "Descriptive channel name (1–160 chars)",
    editGovernanceTitle: "Edit Governance (UpdateChannelDto)",
    createGovernanceTitle: "Creation Governance (CreateChannelDto)",
    editGovernanceBody:
      "Channel code and channel type are immutable after creation to protect downstream price books and orders.",
    createGovernanceBody:
      "New channels initialize as ACTIVE at company scope and can be mapped to operating branches immediately.",
    quickStartTitle: "Quick-Start Channel Templates",
    quickStartSubtitle: "Click to pre-fill standard configuration",
    lockedIdentityNotice:
      "Identity fields (Code & Channel Type) are locked read-only per UpdateChannelDto contract.",
    availableAlternatives: "Available alternatives:",
    branchRolloutTitle: "Branch Rollout & Activation",
    branchRolloutDesc:
      "Open the full channel dossier to manage branch-scoped activation mappings.",
    fullDossier: "Full Dossier",
    totalChannels: "Total Sales Channels",
    totalChannelsSub: "Company-wide sales catalogue",
    activeChannels: "Active Channels",
    operationalReadiness: "operational readiness",
    readyFirstChannel: "Ready to onboard first channel",
    typeCoverage: "Channel Type Coverage",
    typeCoverageSub: "Across 7 supported ChannelType modes",
    digitalAutomated: "Digital & Automated Channels",
    digitalAutomatedSub: "eCommerce, B2B Portal, Marketplace & API",
    searchPlaceholder: "Search by channel code or name...",
    all: "All",
    allTypes: "All Types",
    tableView: "Table",
    cardsView: "Cards",
    inspectorTitle: "360° Channel Inspector",
    branchRolloutBtn: "Branch Rollout",
    activeMappedBranches: "Active Mapped Branches",
    branchesMappedSub: "Branches mapped to this channel",
    currentOperatingBranch: "Current Operating Branch",
    noBranchSelected: "No branch selected",
    activeInSelectedBranch: "Active in selected branch",
    inactiveInSelectedBranch: "Inactive in selected branch",
    notMappedToSelectedBranch: "Not yet mapped to selected branch",
    activeScopeBadge: "Active Scope",
    otherBranchBadge: "Other Branch",
  },
  ar: {
    livePreview: "المعاينة الحية للقناة",
    readyToSave: "جاهز للحفظ",
    incomplete: "بانتظار الإكمال",
    namePlaceholder: "اسم القناة التجارية...",
    companyScope: "نطاق الشركة",
    checklistTitle: "قائمة التحقق من الجاهزية",
    codeFormatCheck: "كود القناة صالح (1–80 حرفاً)",
    codeUniqueCheck: "كود القناة فريد وغير مكرر",
    nameLengthCheck: "اسم القناة واضح (1–160 حرفاً)",
    editGovernanceTitle: "حوكمة التعديل (UpdateChannelDto)",
    createGovernanceTitle: "حوكمة الإنشاء (CreateChannelDto)",
    editGovernanceBody:
      "كود القناة ونوع القناة ثابتان بعد الإنشاء لضمان سلامة دفاتر الأسعار والطلبات المرتبطة.",
    createGovernanceBody:
      "تُنشأ القناة بحالة نشطة (ACTIVE) افتراضياً على مستوى الشركة، ويمكن تفعيلها للفروع لاحقاً.",
    quickStartTitle: "قوالب القنوات الجاهزة (بنقرة واحدة)",
    quickStartSubtitle: "اختر قالباً لتعبئة الحقول تلقائياً",
    lockedIdentityNotice:
      "حقول الهوية الأساسية (الكود ونوع القناة) مقفلة للقراءة فقط وفق عقد التعديل.",
    availableAlternatives: "بدائل متاحة:",
    branchRolloutTitle: "ربط الفروع التشغيلية (Branch Rollout)",
    branchRolloutDesc: "افتح ملف القناة الكامل لإدارة تفعيل القناة على مستوى الفروع.",
    fullDossier: "ملف القناة والفروع",
    totalChannels: "إجمالي قنوات البيع",
    totalChannelsSub: "قنوات معرفة على مستوى الشركة",
    activeChannels: "القنوات النشطة (ACTIVE)",
    operationalReadiness: "نسبة التفعيل",
    readyFirstChannel: "جاهز لإضافة أول قناة",
    typeCoverage: "تغطية أنواع القنوات",
    typeCoverageSub: "من أصل 7 أنماط تجارية مدعومة",
    digitalAutomated: "القنوات الرقمية والربط الآلي",
    digitalAutomatedSub: "متجر، بوابة B2B، أسواق، وAPI",
    searchPlaceholder: "بحث بالكود أو اسم القناة...",
    all: "الكل",
    allTypes: "جميع الأنواع",
    tableView: "جدول",
    cardsView: "بطاقات",
    inspectorTitle: "بطاقة الفحص السريع 360°",
    branchRolloutBtn: "ملف القناة والفروع",
    activeMappedBranches: "الفروع المفعّلة",
    branchesMappedSub: "إجمالي الفروع المرتبطة بالقناة",
    currentOperatingBranch: "الفرع التشغيلي الحالي",
    noBranchSelected: "لم يتم اختيار فرع",
    activeInSelectedBranch: "مفعّل في الفرع الحالي",
    inactiveInSelectedBranch: "غير نشط في الفرع الحالي",
    notMappedToSelectedBranch: "غير مربوط بعد بالفرع الحالي",
    activeScopeBadge: "الفرع الحالي",
    otherBranchBadge: "فرع آخر",
  },
} as const;

export function getChannelPaletteText(
  palette: ChannelTypePalette,
  lang: "en" | "ar",
): { label: string; short: string; description: string } {
  const map = {
    en: {
      label: palette.labelEn,
      short: palette.shortEn,
      description: palette.descriptionEn,
    },
    ar: {
      label: palette.labelAr,
      short: palette.shortAr,
      description: palette.descriptionAr,
    },
  };
  return map[lang];
}

export function getChannelTemplateName(
  tpl: ChannelStarterTemplate,
  lang: "en" | "ar",
): string {
  const map = { en: tpl.nameEn, ar: tpl.nameAr };
  return map[lang];
}

const CHANNEL_CODE_VALID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/u;

export function sanitizeChannelCodeInput(raw: string): string {
  return raw
    .trimStart()
    .replace(/\s+/gu, "-")
    .replace(/[^A-Za-z0-9._-]/gu, "")
    .toUpperCase()
    .slice(0, 80);
}

export function buildDuplicateChannelCodeSuggestions(
  code: string,
  existingChannels: readonly Channel[],
): string[] {
  const base = sanitizeChannelCodeInput(code) || "CHANNEL";
  const taken = new Set(existingChannels.map((c) => c.code.toUpperCase()));
  const candidates = [
    `${base}-02`,
    `${base}-HQ`,
    `${base}-NEW`,
    `${base}-03`,
    `${base}-B2B`,
  ].map((c) => c.slice(0, 80));
  return candidates.filter((c) => !taken.has(c)).slice(0, 3);
}

export interface ChannelReadinessResult {
  codeValid: boolean;
  codeUnique: boolean;
  nameValid: boolean;
  typeValid: boolean;
  allReady: boolean;
}

export function evaluateChannelFormReadiness(
  form: ChannelFormValues,
  existingChannels: readonly Channel[],
  editingChannelId?: string | null,
): ChannelReadinessResult {
  const trimmedCode = form.code.trim().toUpperCase();
  const codeValid = CHANNEL_CODE_VALID_PATTERN.test(trimmedCode);
  const codeUnique =
    trimmedCode.length > 0 &&
    !existingChannels.some(
      (c) => c.code.toUpperCase() === trimmedCode && c.id !== editingChannelId,
    );
  const trimmedName = form.name.trim();
  const nameValid = trimmedName.length >= 1 && trimmedName.length <= 160;
  const typeValid = Boolean(CHANNEL_TYPE_PALETTES[form.channelType]);
  return {
    codeValid,
    codeUnique,
    nameValid,
    typeValid,
    allReady: codeValid && codeUnique && nameValid && typeValid,
  };
}
