import { SWATCH_SURFACE_PALETTES, type SwatchSurfacePalette } from "@/design-system";
import type {
  ConfigurationScope,
  MergeStrategy,
  RiskClass,
} from "./configuration-contract";

export interface RiskPalette {
  risk: RiskClass;
  labelEn: string;
  labelAr: string;
  labels: Record<"en" | "ar", string>;
  swatch: SwatchSurfacePalette;
  badgeClass: string;
  cardBorderClass: string;
  topAccentClass: string;
  dotClass: string;
}

export const RISK_CLASS_PALETTES: Record<RiskClass, RiskPalette> = {
  LOW: {
    risk: "LOW",
    labelEn: "Low Risk",
    labelAr: "مخاطر منخفضة (LOW)",
    labels: {
      en: "Low Risk",
      ar: "مخاطر منخفضة (LOW)",
    },
    swatch: SWATCH_SURFACE_PALETTES.green,
    badgeClass: SWATCH_SURFACE_PALETTES.green.badge,
    cardBorderClass: SWATCH_SURFACE_PALETTES.green.sectionCard,
    topAccentClass: SWATCH_SURFACE_PALETTES.green.dot,
    dotClass: SWATCH_SURFACE_PALETTES.green.dot,
  },
  MEDIUM: {
    risk: "MEDIUM",
    labelEn: "Medium Risk",
    labelAr: "مخاطر متوسطة (MEDIUM)",
    labels: {
      en: "Medium Risk",
      ar: "مخاطر متوسطة (MEDIUM)",
    },
    swatch: SWATCH_SURFACE_PALETTES.indigo,
    badgeClass: SWATCH_SURFACE_PALETTES.indigo.badge,
    cardBorderClass: SWATCH_SURFACE_PALETTES.indigo.sectionCard,
    topAccentClass: SWATCH_SURFACE_PALETTES.indigo.dot,
    dotClass: SWATCH_SURFACE_PALETTES.indigo.dot,
  },
  HIGH: {
    risk: "HIGH",
    labelEn: "High Risk",
    labelAr: "مخاطر عالية (HIGH)",
    labels: {
      en: "High Risk",
      ar: "مخاطر عالية (HIGH)",
    },
    swatch: SWATCH_SURFACE_PALETTES.amber,
    badgeClass: SWATCH_SURFACE_PALETTES.amber.badge,
    cardBorderClass: SWATCH_SURFACE_PALETTES.amber.sectionCard,
    topAccentClass: SWATCH_SURFACE_PALETTES.amber.dot,
    dotClass: SWATCH_SURFACE_PALETTES.amber.dot,
  },
  CRITICAL: {
    risk: "CRITICAL",
    labelEn: "Critical Risk",
    labelAr: "مخاطر حرجة (CRITICAL)",
    labels: {
      en: "Critical Risk",
      ar: "مخاطر حرجة (CRITICAL)",
    },
    swatch: SWATCH_SURFACE_PALETTES.red,
    badgeClass: SWATCH_SURFACE_PALETTES.red.badge,
    cardBorderClass: SWATCH_SURFACE_PALETTES.red.sectionCard,
    topAccentClass: SWATCH_SURFACE_PALETTES.red.dot,
    dotClass: SWATCH_SURFACE_PALETTES.red.dot,
  },
};

export type VisualSchemaType =
  | "number"
  | "integer"
  | "boolean"
  | "string"
  | "array"
  | "object";

export interface MergeStrategyInfo {
  strategy: MergeStrategy;
  labelEn: string;
  labelAr: string;
  labels: Record<"en" | "ar", string>;
  summaryEn: string;
  summaryAr: string;
  summaries: Record<"en" | "ar", string>;
  requiredValueTypes: readonly VisualSchemaType[] | null;
  badgeClass: string;
}

export const MERGE_STRATEGY_INFO: Record<MergeStrategy, MergeStrategyInfo> = {
  OVERRIDE: {
    strategy: "OVERRIDE",
    labelEn: "OVERRIDE — Most Specific Scope Wins",
    labelAr: "OVERRIDE — النطاق الأدق يفوز (الفرع ثم الشركة ثم المستأجر)",
    labels: {
      en: "OVERRIDE — Most Specific Scope Wins",
      ar: "OVERRIDE — النطاق الأدق يفوز (الفرع ثم الشركة ثم المستأجر)",
    },
    summaryEn: "Branch overrides Company, which overrides Tenant",
    summaryAr: "إعداد الفرع يتقدم على الشركة، والشركة تتقدم على المستأجر",
    summaries: {
      en: "Branch overrides Company, which overrides Tenant",
      ar: "إعداد الفرع يتقدم على الشركة، والشركة تتقدم على المستأجر",
    },
    requiredValueTypes: null,
    badgeClass: SWATCH_SURFACE_PALETTES.blue.badge,
  },
  MIN: {
    strategy: "MIN",
    labelEn: "MIN — Lowest Numeric Value Wins",
    labelAr: "MIN — القيمة الرقمية الأصغر تفوز (سقف أعلى صارم)",
    labels: {
      en: "MIN — Lowest Numeric Value Wins",
      ar: "MIN — القيمة الرقمية الأصغر تفوز (سقف أعلى صارم)",
    },
    summaryEn: "Requires Number or Integer value type",
    summaryAr: "يتطلب نوع قيمة رقمية (Number أو Integer)",
    summaries: {
      en: "Requires Number or Integer value type",
      ar: "يتطلب نوع قيمة رقمية (Number أو Integer)",
    },
    requiredValueTypes: ["number", "integer"],
    badgeClass: SWATCH_SURFACE_PALETTES.indigo.badge,
  },
  MAX: {
    strategy: "MAX",
    labelEn: "MAX — Highest Numeric Value Wins",
    labelAr: "MAX — القيمة الرقمية الأكبر تفوز (حد أدنى للاعتماد)",
    labels: {
      en: "MAX — Highest Numeric Value Wins",
      ar: "MAX — القيمة الرقمية الأكبر تفوز (حد أدنى للاعتماد)",
    },
    summaryEn: "Requires Number or Integer value type",
    summaryAr: "يتطلب نوع قيمة رقمية (Number أو Integer)",
    summaries: {
      en: "Requires Number or Integer value type",
      ar: "يتطلب نوع قيمة رقمية (Number أو Integer)",
    },
    requiredValueTypes: ["number", "integer"],
    badgeClass: SWATCH_SURFACE_PALETTES.purple.badge,
  },
  UNION: {
    strategy: "UNION",
    labelEn: "UNION — Combine Unique List Items",
    labelAr: "UNION — دمج عناصر القوائم بدون تكرار",
    labels: {
      en: "UNION — Combine Unique List Items",
      ar: "UNION — دمج عناصر القوائم بدون تكرار",
    },
    summaryEn: "Requires Array / List value type",
    summaryAr: "يتطلب نوع قائمة (Array)",
    summaries: {
      en: "Requires Array / List value type",
      ar: "يتطلب نوع قائمة (Array)",
    },
    requiredValueTypes: ["array"],
    badgeClass: SWATCH_SURFACE_PALETTES.teal.badge,
  },
  DENY_WINS: {
    strategy: "DENY_WINS",
    labelEn: "DENY_WINS — Any False (Deny) Locks Policy",
    labelAr: "DENY_WINS — أي قيمة إيقاف (False) تمنع التفعيل",
    labels: {
      en: "DENY_WINS — Any False (Deny) Locks Policy",
      ar: "DENY_WINS — أي قيمة إيقاف (False) تمنع التفعيل",
    },
    summaryEn: "Requires Boolean toggle value type",
    summaryAr: "يتطلب نوع مفتاح منطقي (Boolean)",
    summaries: {
      en: "Requires Boolean toggle value type",
      ar: "يتطلب نوع مفتاح منطقي (Boolean)",
    },
    requiredValueTypes: ["boolean"],
    badgeClass: SWATCH_SURFACE_PALETTES.red.badge,
  },
  FIRST_MATCH: {
    strategy: "FIRST_MATCH",
    labelEn: "FIRST_MATCH — First Evaluated Scope Wins",
    labelAr: "FIRST_MATCH — أول نطاق مطابق يفوز",
    labels: {
      en: "FIRST_MATCH — First Evaluated Scope Wins",
      ar: "FIRST_MATCH — أول نطاق مطابق يفوز",
    },
    summaryEn: "Compatible with any value type",
    summaryAr: "متوافق مع جميع أنواع البيانات",
    summaries: {
      en: "Compatible with any value type",
      ar: "متوافق مع جميع أنواع البيانات",
    },
    requiredValueTypes: null,
    badgeClass: SWATCH_SURFACE_PALETTES.amber.badge,
  },
};

export interface PolicyStarterTemplate {
  id: string;
  key: string;
  titleEn: string;
  titleAr: string;
  titles: Record<"en" | "ar", string>;
  allowedScopes: ConfigurationScope[];
  mergeStrategy: MergeStrategy;
  riskClass: RiskClass;
  schemaType: VisualSchemaType;
  minimum?: string;
  maximum?: string;
  requireCompanyBaseline: boolean;
}

export const POLICY_STARTER_TEMPLATES: PolicyStarterTemplate[] = [
  {
    id: "tpl-max-discount",
    key: "trade.pricing.max_manual_discount_pct",
    titleEn: "Max Manual Discount Ceiling (%)",
    titleAr: "الحد الأقصى لنسبة الخصم اليدوي (%)",
    titles: {
      en: "Max Manual Discount Ceiling (%)",
      ar: "الحد الأقصى لنسبة الخصم اليدوي (%)",
    },
    allowedScopes: ["TENANT", "COMPANY", "BRANCH"],
    mergeStrategy: "MIN",
    riskClass: "HIGH",
    schemaType: "number",
    minimum: "0",
    maximum: "50",
    requireCompanyBaseline: true,
  },
  {
    id: "tpl-credit-gate",
    key: "trade.credit.strict_exposure_check",
    titleEn: "Strict Live Credit Exposure Gate",
    titleAr: "بوابة الفحص الصارم للتعرض الائتماني",
    titles: {
      en: "Strict Live Credit Exposure Gate",
      ar: "بوابة الفحص الصارم للتعرض الائتماني",
    },
    allowedScopes: ["TENANT", "COMPANY", "BRANCH"],
    mergeStrategy: "DENY_WINS",
    riskClass: "CRITICAL",
    schemaType: "boolean",
    requireCompanyBaseline: true,
  },
  {
    id: "tpl-allowed-currencies",
    key: "trade.sales.allowed_settlement_currencies",
    titleEn: "Allowed Settlement Currencies List",
    titleAr: "قائمة عملات التسوية المسموح بها",
    titles: {
      en: "Allowed Settlement Currencies List",
      ar: "قائمة عملات التسوية المسموح بها",
    },
    allowedScopes: ["TENANT", "COMPANY", "BRANCH"],
    mergeStrategy: "UNION",
    riskClass: "MEDIUM",
    schemaType: "array",
    requireCompanyBaseline: false,
  },
  {
    id: "tpl-approval-floor",
    key: "trade.approvals.min_po_director_threshold",
    titleEn: "Purchase Order Approval Floor",
    titleAr: "الحد الأدنى لاعتماد أوامر الشراء",
    titles: {
      en: "Purchase Order Approval Floor",
      ar: "الحد الأدنى لاعتماد أوامر الشراء",
    },
    allowedScopes: ["COMPANY", "BRANCH"],
    mergeStrategy: "MAX",
    riskClass: "HIGH",
    schemaType: "number",
    minimum: "0",
    maximum: "10000000",
    requireCompanyBaseline: true,
  },
  {
    id: "tpl-pos-footer",
    key: "trade.pos.receipt_footer_compliance_note",
    titleEn: "POS Receipt Footer Legal Notice",
    titleAr: "نص الإشعار القانوني لإيصال نقاط البيع",
    titles: {
      en: "POS Receipt Footer Legal Notice",
      ar: "نص الإشعار القانوني لإيصال نقاط البيع",
    },
    allowedScopes: ["TENANT", "COMPANY", "BRANCH"],
    mergeStrategy: "OVERRIDE",
    riskClass: "LOW",
    schemaType: "string",
    requireCompanyBaseline: false,
  },
];

export const VISUAL_SCHEMA_TYPES: {
  type: VisualSchemaType;
  labels: Record<"en" | "ar", string>;
}[] = [
  {
    type: "number",
    labels: { en: "Decimal Number", ar: "رقم عشري (Number)" },
  },
  {
    type: "integer",
    labels: { en: "Whole Integer", ar: "عدد صحيح (Integer)" },
  },
  {
    type: "boolean",
    labels: { en: "Boolean Toggle", ar: "مفتاح منطقي (Yes/No)" },
  },
  {
    type: "string",
    labels: { en: "Text / Code", ar: "نص قياسي (String)" },
  },
  {
    type: "array",
    labels: { en: "List / Array", ar: "قائمة عناصر (Array)" },
  },
  {
    type: "object",
    labels: { en: "Structured Object", ar: "كائن مهيكل (Object)" },
  },
];

export interface VisualValueConstraint {
  type: VisualSchemaType;
  minimum: string;
  maximum: string;
  minLength: string;
  maxLength: string;
  enumValues: string;
}

export function parseVisualSchema(schemaJson: string): VisualValueConstraint {
  const fallback: VisualValueConstraint = {
    type: "number",
    minimum: "",
    maximum: "",
    minLength: "",
    maxLength: "",
    enumValues: "",
  };
  try {
    const parsed: unknown = JSON.parse(schemaJson.trim() || "{}");
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return fallback;
    const rec = parsed as Record<string, unknown>;
    const rawType = typeof rec.type === "string" ? rec.type : "object";
    const type: VisualSchemaType =
      rawType === "number" ||
      rawType === "integer" ||
      rawType === "boolean" ||
      rawType === "string" ||
      rawType === "array" ||
      rawType === "object"
        ? rawType
        : "object";
    return {
      type,
      minimum: typeof rec.minimum === "number" ? String(rec.minimum) : "",
      maximum: typeof rec.maximum === "number" ? String(rec.maximum) : "",
      minLength: typeof rec.minLength === "number" ? String(rec.minLength) : "",
      maxLength: typeof rec.maxLength === "number" ? String(rec.maxLength) : "",
      enumValues: Array.isArray(rec.enum) ? rec.enum.map(String).join(", ") : "",
    };
  } catch {
    return fallback;
  }
}

export function buildSchemaJsonFromVisual(v: VisualValueConstraint): string {
  const schema: Record<string, unknown> = { type: v.type };
  if (v.type === "number" || v.type === "integer") {
    if (v.minimum.trim() !== "" && !Number.isNaN(Number(v.minimum))) {
      schema.minimum = Number(v.minimum);
    }
    if (v.maximum.trim() !== "" && !Number.isNaN(Number(v.maximum))) {
      schema.maximum = Number(v.maximum);
    }
  }
  if (v.type === "string") {
    if (v.minLength.trim() !== "" && !Number.isNaN(Number(v.minLength))) {
      schema.minLength = Number(v.minLength);
    }
    if (v.maxLength.trim() !== "" && !Number.isNaN(Number(v.maxLength))) {
      schema.maxLength = Number(v.maxLength);
    }
    const enums = v.enumValues
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (enums.length > 0) {
      schema.enum = enums;
    }
  }
  if (v.type === "array") {
    schema.items = { type: "string" };
  }
  return JSON.stringify(schema, null, 2);
}

export function validateMergeStrategyCompatibility(
  strategy: MergeStrategy,
  schemaType: VisualSchemaType,
): {
  compatible: boolean;
  messageEn?: string;
  messageAr?: string;
  messages?: Record<"en" | "ar", string>;
} {
  const info = MERGE_STRATEGY_INFO[strategy];
  if (!info.requiredValueTypes) {
    return { compatible: true };
  }
  if (info.requiredValueTypes.includes(schemaType)) {
    return { compatible: true };
  }
  const messageEn = `Merge strategy "${strategy}" requires value type: ${info.requiredValueTypes.join(" or ")}.`;
  const messageAr = `استراتيجية الدمج "${strategy}" تتطلب نوع القيمة: ${info.requiredValueTypes.join(" أو ")}.`;
  return {
    compatible: false,
    messageEn,
    messageAr,
    messages: { en: messageEn, ar: messageAr },
  };
}

export function describeValueSchemaHumanReadable(
  schema: Record<string, unknown>,
  lang: "en" | "ar" = "en",
): string {
  const type = typeof schema.type === "string" ? schema.type : "object";
  if (type === "number" || type === "integer") {
    const min = typeof schema.minimum === "number" ? schema.minimum : null;
    const max = typeof schema.maximum === "number" ? schema.maximum : null;
    if (min !== null && max !== null) {
      const rangeText: Record<"en" | "ar", string> = {
        en: `Number (${min} – ${max})`,
        ar: `رقم (${min} إلى ${max})`,
      };
      return rangeText[lang];
    }
    const numericText: Record<"en" | "ar", string> = {
      en: "Numeric Value",
      ar: "قيمة رقمية",
    };
    return numericText[lang];
  }
  if (type === "boolean") {
    const boolText: Record<"en" | "ar", string> = {
      en: "Boolean Toggle (True / False)",
      ar: "مفتاح منطقي (نعم / لا)",
    };
    return boolText[lang];
  }
  if (type === "array") {
    const arrayText: Record<"en" | "ar", string> = {
      en: "Selection List (Array)",
      ar: "قائمة عناصر (Array)",
    };
    return arrayText[lang];
  }
  if (type === "string") {
    const strText: Record<"en" | "ar", string> = {
      en: "Text String",
      ar: "نص قياسي",
    };
    return strText[lang];
  }
  const objText: Record<"en" | "ar", string> = {
    en: "Structured Policy Value",
    ar: "كائن مهيكل",
  };
  return objText[lang];
}

export function formatPolicyValueHumanReadable(
  value: unknown,
  lang: "en" | "ar" = "en",
): string {
  if (typeof value === "boolean") {
    const boolMap: Record<"en" | "ar", string> = value
      ? { en: "Enabled (True)", ar: "مفعّل (True)" }
      : { en: "Disabled (False)", ar: "مغلق (False)" };
    return boolMap[lang];
  }
  if (typeof value === "number") {
    return String(value);
  }
  if (typeof value === "string") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(String).join(" · ");
  }
  if (value && typeof value === "object") {
    return Object.entries(value as Record<string, unknown>)
      .map(([k, v]) => `${k}: ${String(v)}`)
      .join(", ");
  }
  return String(value ?? "—");
}

export function parseVisualArrayValue(rawJson: string): string[] {
  try {
    const parsed: unknown = JSON.parse(rawJson.trim());
    if (Array.isArray(parsed)) {
      return parsed.map(String);
    }
    return [];
  } catch {
    return [];
  }
}

export function parseVisualScalarValue(rawJson: string): string {
  const trimmed = rawJson.trim();
  if (!trimmed) return "";
  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (typeof parsed === "string" || typeof parsed === "number" || typeof parsed === "boolean") {
      return String(parsed);
    }
    return trimmed;
  } catch {
    return trimmed;
  }
}

const TEST_DIAGNOSTIC_MAP: Record<string, Record<"en" | "ar", string>> = {
  COMPANY_BASELINE_REQUIRED: {
    en: "Company Baseline Required: Publish a Company-level version before testing or publishing a Branch version.",
    ar: "يتطلب نشر إصدار مرجعي على مستوى الشركة أولاً قبل اعتماد إصدار الفرع",
  },
  BRANCH_WEAKENS_MIN: {
    en: "Branch Weakens MIN Policy: Branch value exceeds the Company's published MIN ceiling.",
    ar: "قيمة الفرع تتجاوز السقف الأعلى (MIN) المعتمد على مستوى الشركة",
  },
  BRANCH_WEAKENS_DENY: {
    en: "Branch Weakens DENY Policy: Branch cannot set true when Company has locked this setting to false.",
    ar: "لا يمكن للفرع تفعيل خيار تم قفله بـ (False) على مستوى الشركة",
  },
  VALUE_INVALID: {
    en: "Value Invalid: The version value does not satisfy the policy definition constraints.",
    ar: "القيمة المدخلة لا تطابق قواعد التحقق المحددة للسياسة",
  },
};

export function describeTestDiagnostic(code: string, lang: "en" | "ar" = "en"): string {
  const entry = TEST_DIAGNOSTIC_MAP[code];
  if (entry) {
    return entry[lang];
  }
  return code;
}

export interface ConfigUiCopy {
  quickStartTemplates: string;
  visualConstraintBuilder: string;
  hideSchemaSource: string;
  showSchemaSource: string;
  hideValueSource: string;
  showValueSource: string;
  hideResponseSource: string;
  showResponseSource: string;
  minAllowedValue: string;
  maxAllowedValue: string;
  allowedOptionsHint: string;
  autoAlignType: string;
  boolEnabledTrue: string;
  boolDisabledFalse: string;
  arrayItemsPresetLabel: string;
  valueConstraintType: string;
  makerCheckerActive: string;
  versionPassedAllChecks: string;
  versionDiagnosticFindings: string;
  quickAddPolicyKeys: string;
  contextPresets: string;
  posRetailPreset: string;
  b2bWholesalePreset: string;
  resolvedEffectiveValues: string;
  purposeSalesHint: string;
  purposePurchaseHint: string;
  kpiTotalTitle: string;
  kpiTotalSub: string;
  kpiPublishedTitle: string;
  kpiPublishedSub: string;
  kpiHighRiskTitle: string;
  kpiHighRiskSub: string;
  kpiMergeSub: string;
  searchPlaceholder: string;
  tableView: string;
  cardsView: string;
  allFilter: string;
  inspectorTitle: string;
  inspectFullModalBtn: string;
}

export const CONFIG_UI_COPY: Record<"en" | "ar", ConfigUiCopy> = {
  en: {
    quickStartTemplates: "Quick-Start Policy Templates",
    visualConstraintBuilder: "Visual Value Constraint Builder",
    hideSchemaSource: "Hide Schema Source",
    showSchemaSource: "Schema Source",
    hideValueSource: "Hide Value Source",
    showValueSource: "Value Source",
    hideResponseSource: "Hide Raw Payload",
    showResponseSource: "Raw Payload",
    minAllowedValue: "Minimum Allowed Value",
    maxAllowedValue: "Maximum Allowed Value",
    allowedOptionsHint: "Allowed Options (comma-separated, optional)",
    autoAlignType: "Auto-Align Type",
    boolEnabledTrue: "Enabled (True)",
    boolDisabledFalse: "Disabled / Deny (False)",
    arrayItemsPresetLabel: "Toggle Allowed Items:",
    valueConstraintType: "Value Constraint Type",
    makerCheckerActive: "Maker-Checker Segregated Publish Governance Active",
    versionPassedAllChecks: "Version Passed All Policy & Baseline Checks (TESTED)",
    versionDiagnosticFindings: "Version Test Diagnostic Findings",
    quickAddPolicyKeys: "Quick-Add Policy Keys to Simulate:",
    contextPresets: "Context presets:",
    posRetailPreset: "POS Retail (EGP)",
    b2bWholesalePreset: "B2B Wholesale (USD)",
    resolvedEffectiveValues: "Resolved Effective Policy Values",
    purposeSalesHint: "Default company price book for customer sales",
    purposePurchaseHint: "Default company price book for supplier purchasing",
    kpiTotalTitle: "Total Policy Definitions",
    kpiTotalSub: "Governed trade policy definitions",
    kpiPublishedTitle: "Published Policy Versions",
    kpiPublishedSub: "Active across Tenant, Company & Branch",
    kpiHighRiskTitle: "High & Critical Risk Policies",
    kpiHighRiskSub: "Protected by Maker-Checker approval",
    kpiMergeSub: "Hierarchy merge modes active",
    searchPlaceholder: "Search by policy definition key...",
    tableView: "Table",
    cardsView: "Cards",
    allFilter: "All",
    inspectorTitle: "360° Policy Definition Inspector",
    inspectFullModalBtn: "360° Modal",
  },
  ar: {
    quickStartTemplates: "قوالب السياسات التجارية الجاهزة",
    visualConstraintBuilder: "باني قيود القيمة المرئي",
    hideSchemaSource: "إخفاء مخطط العقد",
    showSchemaSource: "عرض مخطط العقد",
    hideValueSource: "إخفاء مصدر القيمة",
    showValueSource: "مصدر القيمة",
    hideResponseSource: "إخفاء الاستجابة الخام",
    showResponseSource: "الاستجابة الخام",
    minAllowedValue: "الحد الأدنى المسموح",
    maxAllowedValue: "الحد الأقصى المسموح",
    allowedOptionsHint: "القيم المسموحة (مفصولة بفاصلة — اختياري)",
    autoAlignType: "تصحيح النوع تلقائياً",
    boolEnabledTrue: "مفعّل (True)",
    boolDisabledFalse: "مغلق / مرفوض (False)",
    arrayItemsPresetLabel: "تحديد العناصر المسموحة:",
    valueConstraintType: "نوع القيمة والقيود",
    makerCheckerActive: "حوكمة الفصل بين المُعِد والمُعتمِد مفعّلة (Maker-Checker)",
    versionPassedAllChecks: "اجتاز الإصدار جميع فحوصات التوافق والسياسة بنجاح (TESTED)",
    versionDiagnosticFindings: "نتائج تشخيص اختبار الإصدار",
    quickAddPolicyKeys: "إضافة سريعة لمفاتيح السياسات:",
    contextPresets: "سياقات جاهزة:",
    posRetailPreset: "نقاط بيع POS (EGP)",
    b2bWholesalePreset: "بوابة جملة B2B (USD)",
    resolvedEffectiveValues: "القيم الفعّالة الناتجة",
    purposeSalesHint: "دفتر الأسعار الافتراضي لقنوات البيع والعملاء",
    purposePurchaseHint: "دفتر الأسعار الافتراضي للمشتريات والموردين",
    kpiTotalTitle: "إجمالي تعريفات السياسات",
    kpiTotalSub: "مفاتيح سياسات التجارة والتسعير",
    kpiPublishedTitle: "الإصدارات المنشورة (PUBLISHED)",
    kpiPublishedSub: "سارية المفعول عبر النطاقات",
    kpiHighRiskTitle: "سياسات عالية وحرجة المخاطر",
    kpiHighRiskSub: "تخضع لحوكمة Maker-Checker",
    kpiMergeSub: "استراتيجيات دمج النطاقات",
    searchPlaceholder: "بحث بمفتاح السياسة...",
    tableView: "جدول",
    cardsView: "بطاقات",
    allFilter: "الكل",
    inspectorTitle: "المفتش الفوري للسياسة 360°",
    inspectFullModalBtn: "نافذة 360°",
  },
};
