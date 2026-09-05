import type { Language } from "@/i18n/useLanguage";

/**
 * The two closed lists a contact's name is dressed in: an honorific, and a job
 * title.
 *
 * They live here rather than in the dictionaries because they are VALUES, not
 * UI copy — the same call `country-data.ts` makes. What a picker stores here
 * ends up in `honorificTitle` and `jobTitle`, which CRM holds as free text with
 * nothing but a length cap, and every screen that shows a contact prints that
 * string back exactly as it was saved.
 *
 * Which is why what is stored is the LABEL in the language the person chose,
 * not a key: a record written as "Sales manager" has to keep reading as "Sales
 * manager" on a screen that knows nothing about this file. `findJobTitle` and
 * `findHonorific` read a stored value back in either language, so a row typed
 * in Arabic is still recognised — and shown in the reader's own language —
 * while the stored string is left untouched until somebody picks a new one.
 */
export interface TitleOption {
  key: string;
  label: string;
}

interface TitleEntry {
  key: string;
  en: string;
  ar: string;
}

// `honorificTitle` is capped at 40 in both contact DTOs, which no entry in
// this closed list comes near — only the free-text job title needs a cap.
/** `@MaxLength(120)` on `jobTitle` in both contact DTOs. */
export const JOB_TITLE_MAX_LENGTH = 120;

const HONORIFICS: readonly TitleEntry[] = [
  { key: "MR", en: "Mr", ar: "السيد" },
  { key: "MS", en: "Ms", ar: "الآنسة" },
  { key: "MRS", en: "Mrs", ar: "السيدة" },
  { key: "DR", en: "Dr", ar: "الدكتور" },
  { key: "ENG", en: "Eng", ar: "المهندس" },
];

/**
 * A hundred titles, then `OTHER` last — the one entry that is not a title but
 * an escape into free text, because no list of a hundred covers every business.
 */
const JOB_TITLES: readonly TitleEntry[] = [
  { key: "CHAIRMAN", en: "Chairman", ar: "رئيس مجلس الإدارة" },
  { key: "VICE_CHAIRMAN", en: "Vice chairman", ar: "نائب رئيس مجلس الإدارة" },
  { key: "BOARD_MEMBER", en: "Board member", ar: "عضو مجلس إدارة" },
  { key: "MANAGING_DIRECTOR", en: "Managing director", ar: "العضو المنتدب" },
  { key: "CEO", en: "Chief executive officer", ar: "الرئيس التنفيذي" },
  { key: "COO", en: "Chief operating officer", ar: "الرئيس التنفيذي للعمليات" },
  { key: "CFO", en: "Chief financial officer", ar: "الرئيس التنفيذي المالي" },
  { key: "CTO", en: "Chief technology officer", ar: "الرئيس التنفيذي للتقنية" },
  { key: "CIO", en: "Chief information officer", ar: "الرئيس التنفيذي للمعلومات" },
  { key: "CMO", en: "Chief marketing officer", ar: "الرئيس التنفيذي للتسويق" },
  { key: "CHRO", en: "Chief human resources officer", ar: "الرئيس التنفيذي للموارد البشرية" },
  { key: "GENERAL_MANAGER", en: "General manager", ar: "المدير العام" },
  { key: "DEPUTY_GENERAL_MANAGER", en: "Deputy general manager", ar: "نائب المدير العام" },
  { key: "EXECUTIVE_DIRECTOR", en: "Executive director", ar: "المدير التنفيذي" },
  { key: "OWNER", en: "Owner", ar: "المالك" },
  { key: "PARTNER", en: "Partner", ar: "شريك" },
  { key: "FOUNDER", en: "Founder", ar: "المؤسس" },
  { key: "SALES_DIRECTOR", en: "Sales director", ar: "مدير عام المبيعات" },
  { key: "SALES_MANAGER", en: "Sales manager", ar: "مدير المبيعات" },
  { key: "REGIONAL_SALES_MANAGER", en: "Regional sales manager", ar: "مدير مبيعات إقليمي" },
  { key: "AREA_SALES_MANAGER", en: "Area sales manager", ar: "مدير مبيعات منطقة" },
  { key: "SALES_SUPERVISOR", en: "Sales supervisor", ar: "مشرف مبيعات" },
  { key: "SALES_REPRESENTATIVE", en: "Sales representative", ar: "مندوب مبيعات" },
  { key: "SALES_EXECUTIVE", en: "Sales executive", ar: "تنفيذي مبيعات" },
  { key: "ACCOUNT_MANAGER", en: "Account manager", ar: "مدير حسابات العملاء" },
  { key: "KEY_ACCOUNT_MANAGER", en: "Key account manager", ar: "مدير الحسابات الرئيسية" },
  { key: "BUSINESS_DEVELOPMENT_MANAGER", en: "Business development manager", ar: "مدير تطوير الأعمال" },
  { key: "BUSINESS_DEVELOPMENT_EXECUTIVE", en: "Business development executive", ar: "تنفيذي تطوير الأعمال" },
  { key: "MARKETING_DIRECTOR", en: "Marketing director", ar: "مدير عام التسويق" },
  { key: "MARKETING_MANAGER", en: "Marketing manager", ar: "مدير التسويق" },
  { key: "MARKETING_SPECIALIST", en: "Marketing specialist", ar: "أخصائي تسويق" },
  { key: "DIGITAL_MARKETING_SPECIALIST", en: "Digital marketing specialist", ar: "أخصائي تسويق رقمي" },
  { key: "BRAND_MANAGER", en: "Brand manager", ar: "مدير العلامة التجارية" },
  { key: "PRODUCT_MANAGER", en: "Product manager", ar: "مدير المنتج" },
  { key: "PRODUCT_OWNER", en: "Product owner", ar: "مالك المنتج" },
  { key: "CUSTOMER_SUCCESS_MANAGER", en: "Customer success manager", ar: "مدير نجاح العملاء" },
  { key: "CUSTOMER_SERVICE_MANAGER", en: "Customer service manager", ar: "مدير خدمة العملاء" },
  { key: "CUSTOMER_SERVICE_REPRESENTATIVE", en: "Customer service representative", ar: "ممثل خدمة عملاء" },
  { key: "CALL_CENTER_AGENT", en: "Call centre agent", ar: "موظف مركز اتصال" },
  { key: "FINANCE_DIRECTOR", en: "Finance director", ar: "مدير عام مالي" },
  { key: "FINANCE_MANAGER", en: "Finance manager", ar: "المدير المالي" },
  { key: "FINANCIAL_CONTROLLER", en: "Financial controller", ar: "المراقب المالي" },
  { key: "CHIEF_ACCOUNTANT", en: "Chief accountant", ar: "رئيس الحسابات" },
  { key: "SENIOR_ACCOUNTANT", en: "Senior accountant", ar: "محاسب أول" },
  { key: "ACCOUNTANT", en: "Accountant", ar: "محاسب" },
  { key: "ACCOUNTS_PAYABLE_SPECIALIST", en: "Accounts payable specialist", ar: "أخصائي حسابات دائنة" },
  { key: "ACCOUNTS_RECEIVABLE_SPECIALIST", en: "Accounts receivable specialist", ar: "أخصائي حسابات مدينة" },
  { key: "INTERNAL_AUDITOR", en: "Internal auditor", ar: "مدقق داخلي" },
  { key: "AUDITOR", en: "Auditor", ar: "مدقق حسابات" },
  { key: "TREASURER", en: "Treasurer", ar: "أمين الخزينة" },
  { key: "TAX_SPECIALIST", en: "Tax specialist", ar: "أخصائي ضرائب" },
  { key: "HR_DIRECTOR", en: "HR director", ar: "مدير عام الموارد البشرية" },
  { key: "HR_MANAGER", en: "HR manager", ar: "مدير الموارد البشرية" },
  { key: "HR_SPECIALIST", en: "HR specialist", ar: "أخصائي موارد بشرية" },
  { key: "RECRUITMENT_SPECIALIST", en: "Recruitment specialist", ar: "أخصائي توظيف" },
  { key: "TRAINING_MANAGER", en: "Training manager", ar: "مدير التدريب" },
  { key: "PAYROLL_SPECIALIST", en: "Payroll specialist", ar: "أخصائي رواتب" },
  { key: "ADMIN_MANAGER", en: "Administration manager", ar: "مدير إداري" },
  { key: "OFFICE_MANAGER", en: "Office manager", ar: "مدير المكتب" },
  { key: "EXECUTIVE_ASSISTANT", en: "Executive assistant", ar: "مساعد تنفيذي" },
  { key: "ADMIN_ASSISTANT", en: "Administrative assistant", ar: "مساعد إداري" },
  { key: "SECRETARY", en: "Secretary", ar: "سكرتير" },
  { key: "RECEPTIONIST", en: "Receptionist", ar: "موظف استقبال" },
  { key: "IT_DIRECTOR", en: "IT director", ar: "مدير عام تقنية المعلومات" },
  { key: "IT_MANAGER", en: "IT manager", ar: "مدير تقنية المعلومات" },
  { key: "SYSTEM_ADMINISTRATOR", en: "System administrator", ar: "مسؤول أنظمة" },
  { key: "DATABASE_ADMINISTRATOR", en: "Database administrator", ar: "مسؤول قواعد بيانات" },
  { key: "NETWORK_ENGINEER", en: "Network engineer", ar: "مهندس شبكات" },
  { key: "SECURITY_ENGINEER", en: "Security engineer", ar: "مهندس أمن معلومات" },
  { key: "SOFTWARE_ENGINEER", en: "Software engineer", ar: "مهندس برمجيات" },
  { key: "SENIOR_SOFTWARE_ENGINEER", en: "Senior software engineer", ar: "مهندس برمجيات أول" },
  { key: "FRONTEND_DEVELOPER", en: "Front-end developer", ar: "مطوّر واجهات أمامية" },
  { key: "BACKEND_DEVELOPER", en: "Back-end developer", ar: "مطوّر واجهات خلفية" },
  { key: "FULLSTACK_DEVELOPER", en: "Full-stack developer", ar: "مطوّر متكامل" },
  { key: "MOBILE_DEVELOPER", en: "Mobile developer", ar: "مطوّر تطبيقات الجوال" },
  { key: "DEVOPS_ENGINEER", en: "DevOps engineer", ar: "مهندس DevOps" },
  { key: "QA_ENGINEER", en: "QA engineer", ar: "مهندس جودة البرمجيات" },
  { key: "UI_UX_DESIGNER", en: "UI/UX designer", ar: "مصمم تجربة وواجهة المستخدم" },
  { key: "DATA_ANALYST", en: "Data analyst", ar: "محلل بيانات" },
  { key: "DATA_SCIENTIST", en: "Data scientist", ar: "عالم بيانات" },
  { key: "BUSINESS_ANALYST", en: "Business analyst", ar: "محلل أعمال" },
  { key: "TECHNICAL_SUPPORT", en: "Technical support", ar: "الدعم الفني" },
  { key: "PROJECT_MANAGER", en: "Project manager", ar: "مدير المشروع" },
  { key: "OPERATIONS_DIRECTOR", en: "Operations director", ar: "مدير عام العمليات" },
  { key: "OPERATIONS_MANAGER", en: "Operations manager", ar: "مدير العمليات" },
  { key: "PROCUREMENT_MANAGER", en: "Procurement manager", ar: "مدير المشتريات" },
  { key: "PURCHASING_SPECIALIST", en: "Purchasing specialist", ar: "أخصائي مشتريات" },
  { key: "SUPPLY_CHAIN_MANAGER", en: "Supply chain manager", ar: "مدير سلسلة الإمداد" },
  { key: "LOGISTICS_MANAGER", en: "Logistics manager", ar: "مدير الخدمات اللوجستية" },
  { key: "WAREHOUSE_MANAGER", en: "Warehouse manager", ar: "مدير المستودع" },
  { key: "PRODUCTION_MANAGER", en: "Production manager", ar: "مدير الإنتاج" },
  { key: "QUALITY_MANAGER", en: "Quality manager", ar: "مدير الجودة" },
  { key: "MAINTENANCE_MANAGER", en: "Maintenance manager", ar: "مدير الصيانة" },
  { key: "SITE_ENGINEER", en: "Site engineer", ar: "مهندس موقع" },
  { key: "CIVIL_ENGINEER", en: "Civil engineer", ar: "مهندس مدني" },
  { key: "ARCHITECT", en: "Architect", ar: "مهندس معماري" },
  { key: "LEGAL_COUNSEL", en: "Legal counsel", ar: "المستشار القانوني" },
  { key: "LAWYER", en: "Lawyer", ar: "محامٍ" },
  { key: "CONSULTANT", en: "Consultant", ar: "مستشار" },
  { key: "DOCTOR", en: "Doctor", ar: "طبيب" },
  { key: "OTHER", en: "Other", ar: "أخرى" },
];

/** The key of the escape hatch, which no picker may store as a value. */
export const OTHER_JOB_TITLE_KEY = "OTHER";

// A lookup indexed by the language, not a conditional on it. The census counts
// language conditionals as text, so naming the shape here would trip the very
// gate this line explains — and the lookup reads better regardless.
function localize(entries: readonly TitleEntry[], lang: Language): TitleOption[] {
  return entries.map(({ key, en, ar }) => ({ key, label: { ar, en }[lang] }));
}

function find(entries: readonly TitleEntry[], value: string): TitleEntry | null {
  const needle = value.trim().toLowerCase();
  if (!needle) return null;
  return (
    entries.find(({ en, ar }) => en.toLowerCase() === needle || ar.toLowerCase() === needle) ?? null
  );
}

export function getHonorificOptions(lang: Language): TitleOption[] {
  return localize(HONORIFICS, lang);
}

/** Sorted by the reader's own language, with `OTHER` pinned last where it belongs. */
/**
 * The catalogue in its declared order: chairman and the board first, then the
 * C-suite, then general management, then each function from its director down
 * to its most junior role — and `OTHER` last.
 *
 * Deliberately NOT alphabetical, which is what this used to do. A–Z scatters a
 * ladder that is already in the right order: "Chief executive officer" landed
 * under C between "Chairman" and "Chief financial officer" while "Sales
 * representative" sat above "Sales supervisor", so finding the rank you meant
 * took reading the whole list. Someone filling a contact's title thinks in
 * seniority, and the array is written in seniority; the search box is what
 * serves a reader who already knows the word.
 */
export function getJobTitleOptions(lang: Language): TitleOption[] {
  const [other] = JOB_TITLES.filter((entry) => entry.key === OTHER_JOB_TITLE_KEY);
  const titles = localize(
    JOB_TITLES.filter((entry) => entry.key !== OTHER_JOB_TITLE_KEY),
    lang,
  );
  return [...titles, ...localize([other], lang)];
}

/** A stored honorific, recognised in either language. */
export function findHonorific(value: string, lang: Language): TitleOption | null {
  const entry = find(HONORIFICS, value);
  return entry ? localize([entry], lang)[0] : null;
}

/** A stored job title, recognised in either language. `OTHER` never matches. */
export function findJobTitle(value: string, lang: Language): TitleOption | null {
  const entry = find(
    JOB_TITLES.filter((candidate) => candidate.key !== OTHER_JOB_TITLE_KEY),
    value,
  );
  return entry ? localize([entry], lang)[0] : null;
}
