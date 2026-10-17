import { SWATCH_SURFACE_PALETTES, type SwatchHue } from "@/design-system";
import type { AccountRole, CommercialAccount } from "./commercial-account-contract";

export interface RolePalette {
  role: AccountRole;
  hue: SwatchHue;
  labelEn: string;
  labelAr: string;
  descriptionEn: string;
  descriptionAr: string;
  badgeClass: string;
  cardBorderClass: string;
  topAccentClass: string;
  dotClass: string;
}

export const ACCOUNT_ROLE_PALETTES: Record<AccountRole, RolePalette> = {
  CUSTOMER: {
    role: "CUSTOMER",
    hue: "indigo",
    labelEn: "Customer Account",
    labelAr: "حساب عميل (CUSTOMER)",
    descriptionEn:
      "Sales counterparty with governed credit limit, exposure tracking & price book",
    descriptionAr: "طرف تجاري للمبيعات مع سقف ائتماني محكوم ومتابعة لحظية للمديونية",
    badgeClass: SWATCH_SURFACE_PALETTES.indigo.badge,
    cardBorderClass: SWATCH_SURFACE_PALETTES.indigo.sectionCard,
    topAccentClass: SWATCH_SURFACE_PALETTES.indigo.dot,
    dotClass: SWATCH_SURFACE_PALETTES.indigo.dot,
  },
  SUPPLIER: {
    role: "SUPPLIER",
    hue: "purple",
    labelEn: "Supplier Account",
    labelAr: "حساب مورد (SUPPLIER)",
    descriptionEn:
      "Purchasing counterparty for procurement orders & supplier price books (no credit limit)",
    descriptionAr: "طرف تجاري للمشتريات وأوامر التوريد (بدون سقف ائتمان مبيعات)",
    badgeClass: SWATCH_SURFACE_PALETTES.purple.badge,
    cardBorderClass: SWATCH_SURFACE_PALETTES.purple.sectionCard,
    topAccentClass: SWATCH_SURFACE_PALETTES.purple.dot,
    dotClass: SWATCH_SURFACE_PALETTES.purple.dot,
  },
};

export function getRolePaletteDescription(palette: RolePalette, lang: "en" | "ar"): string {
  const map = { en: palette.descriptionEn, ar: palette.descriptionAr };
  return map[lang];
}

export const ISO_CURRENCY_PRESETS = [
  { code: "EGP", labelEn: "EGP — Egyptian Pound", labelAr: "جنيه مصري (EGP)" },
  { code: "USD", labelEn: "USD — US Dollar", labelAr: "دولار أمريكي (USD)" },
  { code: "SAR", labelEn: "SAR — Saudi Riyal", labelAr: "ريال سعودي (SAR)" },
  { code: "EUR", labelEn: "EUR — Euro", labelAr: "يورو أوروبي (EUR)" },
  { code: "AED", labelEn: "AED — UAE Dirham", labelAr: "درهم إماراتي (AED)" },
  { code: "GBP", labelEn: "GBP — British Pound", labelAr: "جنيه إسترليني (GBP)" },
] as const;

export const BLOCK_REASON_PRESETS = [
  {
    code: "OVERDUE_INVOICES_90D",
    labelEn: "Overdue Invoices > 90 Days",
    labelAr: "فواتير متأخرة لأكثر من 90 يوماً",
  },
  {
    code: "CREDIT_RISK_REVIEW",
    labelEn: "Credit Committee Risk Review",
    labelAr: "مراجعة مخاطر لجنة الائتمان",
  },
  {
    code: "LEGAL_COLLECTION_DISPUTE",
    labelEn: "Legal / Collection Dispute",
    labelAr: "نزاع قانوني أو تحصيل",
  },
  {
    code: "KYC_COMPLIANCE_EXPIRED",
    labelEn: "KYC / Commercial License Expired",
    labelAr: "انتهاء صلاحية السجل أو مستندات الامتثال",
  },
] as const;

export const UNBLOCK_REASON_PRESETS = [
  {
    code: "SETTLEMENT_CLEARED_FINANCE",
    labelEn: "Overdue Balance Settled & Cleared",
    labelAr: "سداد وتسوية المديونية المالية",
  },
  {
    code: "BANK_GUARANTEE_RECEIVED",
    labelEn: "Approved Bank Guarantee Received",
    labelAr: "استلام خطاب ضمان بنكي معتمد",
  },
  {
    code: "EXECUTIVE_CREDIT_APPROVAL",
    labelEn: "Executive / CFO Credit Exception",
    labelAr: "اعتماد استثنائي من الإدارة المالية",
  },
] as const;

export const ACCOUNT_UI_COPY = {
  en: {
    creditControlsTitle: "Credit Limit & Settlement Currency",
    lockedForSupplierBadge: "Locked for SUPPLIER",
    supplierCreditLockNotice:
      "Supplier accounts cannot carry a sales credit limit per backend contract (prevents 422 CREDIT_LIMIT_INVALID).",
    availablePaymentTerms: "Available payment terms:",
    publishedCreditPolicies: "Published credit policies:",
    hideAdvancedTerms: "Hide Advanced Contract View",
    showAdvancedTerms: "Advanced Contract View",
    orderingHoldDesc: "Hold new sales orders during credit evaluation (orderingHold)",
    allowedCurrenciesTitle: "Allowed Settlement Currencies",
    allowedCurrenciesDesc:
      "Select company-approved currencies (branch rules may only narrow this set).",
    fullAccountDossier: "Full Account Dossier",
    quickTestAmounts: "Quick test amounts:",
    creditUtilization: "Credit Limit Utilization",
    noBlockReason: "No active block reason",
    allStandardCurrencies: "All standard currencies",
    visualBuilderBtn: "Visual Builder",
    contractViewBtn: "Contract View",
    branchCreditLimitLabel: "Branch Narrowed Credit Limit",
    companyCeilingPrefix: "Company ceiling:",
    lockedForSupplierHint: "Locked for SUPPLIER accounts",
    branchOrderingHoldDesc: "Enforce ordering hold for this operating branch",
    branchCurrenciesTitle: "Branch Allowed Currencies",
    branchCurrenciesDesc: "Must be a subset of company allowed currencies",
    branchExceedsCreditError: "Branch credit limit cannot exceed company credit limit.",
    branchDisallowedCurrenciesPrefix: "Currencies not permitted by company policy:",
    totalAccounts: "Total Commercial Accounts",
    totalAccountsSub: "Governed party relationships",
    customersSub: "Customer accounts in current view",
    suppliersSub: "Procurement counterparties",
    blockedSub: "Blocked pending credit review",
    tableView: "Table",
    cardsView: "Cards",
    inspectorTitle: "360° Account Inspector",
    creditAndBranchBtn: "Credit & Branch Rules",
  },
  ar: {
    creditControlsTitle: "الضوابط الائتمانية والعملة",
    lockedForSupplierBadge: "مقفل للموردين (SUPPLIER)",
    supplierCreditLockNotice:
      "حسابات الموردين (SUPPLIER) لا تقبل سقف ائتمان مبيعات وفق عقد الخدمة (422 CREDIT_LIMIT_INVALID).",
    availablePaymentTerms: "شروط الدفع المتاحة:",
    publishedCreditPolicies: "سياسات الائتمان المنشورة:",
    hideAdvancedTerms: "إخفاء محرر العقد المتقدم",
    showAdvancedTerms: "عرض محرر العقد المتقدم",
    orderingHoldDesc: "إيقاف تمرير الطلبات الجديدة مؤقتاً عند تقييم الائتمان",
    allowedCurrenciesTitle: "العملات المسموحة للتعامل (Allowed Currencies)",
    allowedCurrenciesDesc:
      "حدد العملات المسموح بها على مستوى الشركة (الفروع يمكنها التضييق فقط).",
    fullAccountDossier: "ملف الحساب والائتمان",
    quickTestAmounts: "مبالغ اختبار سريعة:",
    creditUtilization: "نسبة استهلاك السقف الائتماني",
    noBlockReason: "لا يوجد سبب إيقاف",
    allStandardCurrencies: "جميع العملات المعتمدة",
    visualBuilderBtn: "الوضع المرئي",
    contractViewBtn: "عرض العقد النصي",
    branchCreditLimitLabel: "تضييق السقف الائتماني للفرع",
    companyCeilingPrefix: "سقف الشركة الأعلى:",
    lockedForSupplierHint: "غير متاح لحسابات الموردين",
    branchOrderingHoldDesc: "تفعيل إيقاف الطلبات على مستوى هذا الفرع تحديداً",
    branchCurrenciesTitle: "العملات المسموحة بالفرع",
    branchCurrenciesDesc: "يجب أن تكون مجموعة جزئية من عملات الشركة",
    branchExceedsCreditError: "سقف ائتمان الفرع لا يمكن أن يتجاوز سقف الشركة.",
    branchDisallowedCurrenciesPrefix: "العملات غير المسموحة في سياسة الشركة:",
    totalAccounts: "إجمالي الحسابات التجارية",
    totalAccountsSub: "حسابات الأطراف التجارية",
    customersSub: "في الصفحة الحالية",
    suppliersSub: "بدون سقف ائتمان مبيعات",
    blockedSub: "موقوفة لحوكمة المخاطر",
    tableView: "جدول",
    cardsView: "بطاقات",
    inspectorTitle: "بطاقة الفحص السريع 360°",
    creditAndBranchBtn: "ملف الحساب والائتمان",
  },
} as const;

export interface VisualCommercialTerms {
  orderingHold: boolean;
  allowedCurrencies: string[];
  extraKeys: Record<string, unknown>;
}

export function parseVisualTerms(termsJson: string): VisualCommercialTerms {
  const trimmed = termsJson.trim();
  if (!trimmed) {
    return { orderingHold: false, allowedCurrencies: [], extraKeys: {} };
  }
  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { orderingHold: false, allowedCurrencies: [], extraKeys: {} };
    }
    const record = parsed as Record<string, unknown>;
    const orderingHold = record.orderingHold === true;
    const allowedCurrencies = Array.isArray(record.allowedCurrencies)
      ? record.allowedCurrencies
          .filter((c): c is string => typeof c === "string")
          .map((c) => c.trim().toUpperCase())
          .filter((c) => /^[A-Z]{3}$/u.test(c))
      : [];
    const extraKeys: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(record)) {
      if (k !== "orderingHold" && k !== "allowedCurrencies") {
        extraKeys[k] = v;
      }
    }
    return { orderingHold, allowedCurrencies, extraKeys };
  } catch {
    return { orderingHold: false, allowedCurrencies: [], extraKeys: {} };
  }
}

export function serializeVisualTerms(visual: VisualCommercialTerms): string {
  const payload: Record<string, unknown> = { ...visual.extraKeys };
  if (visual.orderingHold) {
    payload.orderingHold = true;
  } else if ("orderingHold" in payload) {
    delete payload.orderingHold;
  }
  if (visual.allowedCurrencies.length > 0) {
    payload.allowedCurrencies = Array.from(new Set(visual.allowedCurrencies));
  }
  if (Object.keys(payload).length === 0) {
    return "";
  }
  return JSON.stringify(payload, null, 2);
}

export interface VisualBranchNarrowingRule {
  creditLimit: string;
  orderingHold: boolean;
  allowedCurrencies: string[];
}

export function parseVisualNarrowingRules(rawJson: string): VisualBranchNarrowingRule {
  const trimmed = rawJson.trim();
  if (!trimmed) {
    return { creditLimit: "", orderingHold: false, allowedCurrencies: [] };
  }
  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { creditLimit: "", orderingHold: false, allowedCurrencies: [] };
    }
    const rec = parsed as Record<string, unknown>;
    const creditLimit =
      typeof rec.creditLimit === "string" || typeof rec.creditLimit === "number"
        ? String(rec.creditLimit)
        : "";
    const orderingHold = rec.orderingHold === true;
    const allowedCurrencies = Array.isArray(rec.allowedCurrencies)
      ? rec.allowedCurrencies
          .filter((c): c is string => typeof c === "string")
          .map((c) => c.trim().toUpperCase())
          .filter((c) => /^[A-Z]{3}$/u.test(c))
      : [];
    return { creditLimit, orderingHold, allowedCurrencies };
  } catch {
    return { creditLimit: "", orderingHold: false, allowedCurrencies: [] };
  }
}

export function serializeVisualNarrowingRules(rule: VisualBranchNarrowingRule): string {
  const out: Record<string, unknown> = {};
  if (rule.creditLimit.trim()) {
    out.creditLimit = rule.creditLimit.trim();
  }
  if (rule.orderingHold) {
    out.orderingHold = true;
  }
  if (rule.allowedCurrencies.length > 0) {
    out.allowedCurrencies = Array.from(new Set(rule.allowedCurrencies));
  }
  return JSON.stringify(out, null, 2);
}

export interface BranchNarrowingValidation {
  exceedsCompanyCreditLimit: boolean;
  disallowedCurrencies: string[];
  supplierCreditLimitForbidden: boolean;
  isValid: boolean;
}

export function validateNarrowingAgainstCompany(
  rule: VisualBranchNarrowingRule,
  account: Pick<CommercialAccount, "accountRole" | "creditLimit" | "terms">,
): BranchNarrowingValidation {
  const supplierCreditLimitForbidden =
    account.accountRole === "SUPPLIER" && rule.creditLimit.trim().length > 0;

  let exceedsCompanyCreditLimit = false;
  if (rule.creditLimit.trim() && account.creditLimit) {
    const branchNum = Number(rule.creditLimit.trim());
    const companyNum = Number(account.creditLimit);
    if (!Number.isNaN(branchNum) && !Number.isNaN(companyNum) && branchNum > companyNum) {
      exceedsCompanyCreditLimit = true;
    }
  }

  const companyAllowed = Array.isArray(account.terms?.allowedCurrencies)
    ? (account.terms.allowedCurrencies as unknown[])
        .filter((c): c is string => typeof c === "string")
        .map((c) => c.toUpperCase())
    : [];

  const disallowedCurrencies =
    companyAllowed.length > 0
      ? rule.allowedCurrencies.filter((c) => !companyAllowed.includes(c.toUpperCase()))
      : [];

  return {
    exceedsCompanyCreditLimit,
    disallowedCurrencies,
    supplierCreditLimitForbidden,
    isValid:
      !exceedsCompanyCreditLimit &&
      disallowedCurrencies.length === 0 &&
      !supplierCreditLimitForbidden,
  };
}
