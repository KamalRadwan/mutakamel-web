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
