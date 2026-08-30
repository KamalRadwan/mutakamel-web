import {
  DASHBOARD_GROUP_KEYS,
  type DashboardGroup,
  type DashboardGroupKey,
  type DashboardResponse,
} from "@/types/dashboard";

type DashboardLanguage = "ar" | "en";

const GROUP_COPY: Record<
  DashboardGroupKey,
  { en: string; ar: string; descriptionEn: string; descriptionAr: string }
> = {
  tenants: {
    en: "Tenants",
    ar: "المستأجرون",
    descriptionEn: "Tenant lifecycle, creation, status, and placement signals.",
    descriptionAr: "مؤشرات دورة حياة المستأجر والإنشاء والحالة والتوزيع.",
  },
  domains: {
    en: "Domains",
    ar: "النطاقات",
    descriptionEn: "Primary-domain verification and DNS attention signals.",
    descriptionAr: "التحقق من النطاقات الأساسية ومؤشرات DNS التي تحتاج متابعة.",
  },
  subscriptions: {
    en: "Subscriptions",
    ar: "الاشتراكات",
    descriptionEn: "Subscription lifecycle, capacity, and renewal exposure.",
    descriptionAr: "دورة حياة الاشتراكات والسعة والتجديدات القادمة.",
  },
  billing: {
    en: "Billing",
    ar: "الفوترة",
    descriptionEn: "Invoices, receivables, collections, and overdue exposure.",
    descriptionAr: "الفواتير والمستحقات والتحصيل والمتأخرات.",
  },
  payments: {
    en: "Payments",
    ar: "المدفوعات",
    descriptionEn: "Payment attempts, settlement outcomes, refunds, and failures.",
    descriptionAr: "محاولات الدفع ونتائج التسوية والاسترداد والإخفاقات.",
  },
  wallets: {
    en: "Wallets",
    ar: "المحافظ",
    descriptionEn: "Canonical USD balances, reservations, and ledger movement.",
    descriptionAr: "أرصدة الدولار المعتمدة والحجوزات وحركة دفتر الأستاذ.",
  },
  database: {
    en: "Database Servers",
    ar: "خوادم قواعد البيانات",
    descriptionEn: "Database Server capacity, utilization, and availability.",
    descriptionAr: "سعة خوادم قواعد البيانات واستخدامها وتوفرها.",
  },
  storage: {
    en: "Storage",
    ar: "التخزين",
    descriptionEn: "Storage Server placement, capacity, and connection evidence.",
    descriptionAr: "توزيع خوادم التخزين وسعتها وأدلة الاتصال.",
  },
  provisioning: {
    en: "Provisioning",
    ar: "التجهيز",
    descriptionEn: "Provisioning attempts, duration, recovery, and stuck work.",
    descriptionAr: "محاولات التجهيز ومدتها والاسترداد والعمليات العالقة.",
  },
  catalogue: {
    en: "Application Catalogue",
    ar: "كتالوج التطبيقات",
    descriptionEn: "Application lifecycle and technical-readiness coverage.",
    descriptionAr: "دورة حياة التطبيقات وتغطية الجاهزية التقنية.",
  },
  notifications: {
    en: "Notifications",
    ar: "الإشعارات",
    descriptionEn: "Delivery state, retry pressure, and channel outcomes.",
    descriptionAr: "حالة التسليم وضغط إعادة المحاولة ونتائج القنوات.",
  },
  usage: {
    en: "Usage",
    ar: "الاستخدام",
    descriptionEn: "Authoritative API and product usage projection.",
    descriptionAr: "عرض موثوق لاستخدام واجهات API والمنتج.",
  },
  security: {
    en: "Security",
    ar: "الأمان",
    descriptionEn: "Administrator access, locks, and failed-login signals.",
    descriptionAr: "وصول المسؤولين وحالات القفل ومؤشرات فشل تسجيل الدخول.",
  },
  audit: {
    en: "Audit",
    ar: "التدقيق",
    descriptionEn: "Control-plane audit volume, outcomes, and evidence quality.",
    descriptionAr: "حجم تدقيق مستوى التحكم ونتائجه وجودة الأدلة.",
  },
};

export function getDashboardGroupLabel(
  key: DashboardGroupKey,
  lang: DashboardLanguage,
): string {
  return GROUP_COPY[key][lang];
}

export function getDashboardGroupDescription(
  key: DashboardGroupKey,
  lang: DashboardLanguage,
): string {
  return lang === "ar"
    ? GROUP_COPY[key].descriptionAr
    : GROUP_COPY[key].descriptionEn;
}

/**
 * Every group this actor may open, in contract order.
 *
 * This drives the tab bar, so it reads `authorizedGroups` alone. A response
 * scoped with `?groups=` carries only the groups it loaded, and keying the
 * tabs off the present group objects made the rest of the tabs vanish —
 * and with them any way to reach the data.
 */
export function getAuthorizedDashboardGroupKeys(
  data: DashboardResponse,
): DashboardGroupKey[] {
  const authorized = new Set(data.authorizedGroups);
  return DASHBOARD_GROUP_KEYS.filter((key) => authorized.has(key));
}

/** Authorized groups whose data is present in this response. */
export function getAuthorizedDashboardGroups(
  data: DashboardResponse,
): Array<[DashboardGroupKey, DashboardGroup]> {
  const authorized = new Set(data.authorizedGroups);
  return DASHBOARD_GROUP_KEYS.flatMap((key) => {
    const group = data[key];
    return authorized.has(key) && group ? [[key, group]] : [];
  });
}

export function humanizeDashboardField(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

const DASHBOARD_FIELD_LABELS_AR: Readonly<Record<string, string>> = {
  total: "الإجمالي",
  count: "العدد",
  current: "الحالي",
  maximum: "الحد الأقصى",
  available: "المتاح",
  active: "النشط",
  pending: "قيد الانتظار",
  failed: "الفاشل",
  succeeded: "الناجح",
  utilization: "معدل الاستخدام",
  ratio: "النسبة",
  amount: "المبلغ",
  amountUsd: "المبلغ بالدولار الأمريكي",
  currentTenants: "المستأجرون الحاليون",
  maxTenants: "الحد الأقصى للمستأجرين",
  availableCapacity: "السعة المتاحة",
  totalTenants: "إجمالي المستأجرين",
  totalDomains: "إجمالي النطاقات",
  verifiedDomains: "النطاقات المتحقق منها",
  invalidDomains: "النطاقات غير الصالحة",
  collectedRatio: "نسبة التحصيل",
  monthlyRecurringRevenue: "الإيراد الشهري المتكرر",
  annualRecurringRevenue: "الإيراد السنوي المتكرر",

  // Failure taxonomy. Every report used to count "failures" its own way, so
  // these read identically on every tab. Exactly one of them — أخطاء تطبيق
  // غير مُعالَجة — means the platform itself is at fault; the rest say it
  // refused correctly, or that something outside it failed.
  unhandledApplicationErrors: "أخطاء تطبيق غير مُعالَجة",
  unresolvedFailures: "أعطال لم تتعافَ",
  applicationFailures: "أعطال في كود المنصة",
  applicationFailureRatio: "نسبة أعطال المنصة",
  recentApplicationFailures: "أعطال المنصة الحديثة",
  dependencyFailures: "أعطال في خدمات خارجية",
  clientRefusals: "طلبات مرفوضة بشكل صحيح",
  capacityRefusals: "رفض لحماية السعة",
  indeterminateOutcomes: "نتائج غير مؤكدة",
  awaitingTriage: "بانتظار التصنيف",
  syntheticFailures: "أعطال من سكربتات واختبارات",
  failedRequests: "طلبات فاشلة",
  failedEvents: "أحداث فاشلة",
  failureRatio: "نسبة الفشل",
  classificationDrift: "انحراف التصنيف المُجمَّد",
  incompleteGatewayCommands: "أوامر بوابة غير مكتملة",
  currentIncompleteGatewayCommands: "أوامر بوابة غير مكتملة حالياً",
  missingCorrelation: "معرّف ارتباط مفقود",
  missingOperation: "معرّف عملية مفقود",
  events: "الأحداث",

  byFaultDomain: "حسب نطاق العطل",
  byCodeQuality: "حسب جودة كود الخطأ",
  APPLICATION: "عطل في المنصة",
  DEPENDENCY: "عطل في خدمة خارجية",
  CAPACITY: "حماية السعة",
  CLIENT: "رفض صحيح",
  INDETERMINATE: "نتيجة غير مؤكدة",
  UNCLASSIFIED: "بانتظار التصنيف",
  DESIGNED: "كود خطأ مقصود",
  GENERIC: "كود عام",
  LEAKED: "خطأ غير مُغلَّف",
};

export interface DashboardFieldLabel {
  label: string;
  /** Unknown wire keys stay verbatim and isolated instead of receiving an invented translation. */
  dir?: "ltr";
}

export function getDashboardFieldLabel(
  value: string,
  lang: DashboardLanguage,
): DashboardFieldLabel {
  if (lang === "en") return { label: humanizeDashboardField(value) };
  const localized = DASHBOARD_FIELD_LABELS_AR[value];
  return localized ? { label: localized } : { label: value, dir: "ltr" };
}

export function isUnavailableProjection(
  value: unknown,
): value is { available: false; reasonCode?: string; message?: string } {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    "available" in value &&
    value.available === false
  );
}
