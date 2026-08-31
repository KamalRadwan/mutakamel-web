/**
 * Curated job-title catalogue for the tenant owner.
 *
 * Core stores `ownerJobTitle` as free text, so this list is a data-entry aid,
 * not a constraint: `OTHER` still allows anything. Ordered most-common first
 * rather than alphabetically, because the top of the list is what an operator
 * reaches for in the overwhelming majority of registrations.
 *
 * Keys are stable and never localized -- the English label is what reaches the
 * API, so retranslating a label cannot repartition existing tenants.
 */
export interface JobTitleOption {
  key: string;
  en: string;
  ar: string;
}

export const OTHER_JOB_TITLE_KEY = "other";

export const JOB_TITLE_OPTIONS: readonly JobTitleOption[] = [
  { key: "owner", en: "Owner", ar: "المالك" },
  { key: "founder", en: "Founder", ar: "المؤسس" },
  { key: "co-founder", en: "Co-Founder", ar: "شريك مؤسس" },
  { key: "ceo", en: "Chief Executive Officer (CEO)", ar: "الرئيس التنفيذي" },
  { key: "managing-director", en: "Managing Director", ar: "العضو المنتدب" },
  { key: "general-manager", en: "General Manager", ar: "المدير العام" },
  { key: "coo", en: "Chief Operating Officer (COO)", ar: "رئيس العمليات" },
  { key: "cfo", en: "Chief Financial Officer (CFO)", ar: "المدير المالي" },
  { key: "cto", en: "Chief Technology Officer (CTO)", ar: "المدير التقني" },
  { key: "cio", en: "Chief Information Officer (CIO)", ar: "مدير نظم المعلومات" },
  { key: "cmo", en: "Chief Marketing Officer (CMO)", ar: "مدير التسويق التنفيذي" },
  { key: "chro", en: "Chief HR Officer (CHRO)", ar: "مدير الموارد البشرية التنفيذي" },
  { key: "ciso", en: "Chief Information Security Officer", ar: "مدير أمن المعلومات" },
  { key: "board-member", en: "Board Member", ar: "عضو مجلس الإدارة" },
  { key: "chairman", en: "Chairman", ar: "رئيس مجلس الإدارة" },
  { key: "vice-president", en: "Vice President", ar: "نائب الرئيس" },
  { key: "partner", en: "Partner", ar: "شريك" },
  { key: "branch-manager", en: "Branch Manager", ar: "مدير الفرع" },
  { key: "regional-manager", en: "Regional Manager", ar: "المدير الإقليمي" },
  { key: "operations-manager", en: "Operations Manager", ar: "مدير العمليات" },
  { key: "finance-manager", en: "Finance Manager", ar: "المدير المالي" },
  { key: "accounting-manager", en: "Accounting Manager", ar: "مدير الحسابات" },
  { key: "accountant", en: "Accountant", ar: "محاسب" },
  { key: "chief-accountant", en: "Chief Accountant", ar: "رئيس الحسابات" },
  { key: "auditor", en: "Auditor", ar: "مراجع حسابات" },
  { key: "controller", en: "Financial Controller", ar: "المراقب المالي" },
  { key: "treasurer", en: "Treasurer", ar: "أمين الخزينة" },
  { key: "sales-manager", en: "Sales Manager", ar: "مدير المبيعات" },
  { key: "sales-representative", en: "Sales Representative", ar: "مندوب مبيعات" },
  { key: "account-manager", en: "Account Manager", ar: "مدير حسابات العملاء" },
  { key: "business-development-manager", en: "Business Development Manager", ar: "مدير تطوير الأعمال" },
  { key: "marketing-manager", en: "Marketing Manager", ar: "مدير التسويق" },
  { key: "digital-marketing-specialist", en: "Digital Marketing Specialist", ar: "أخصائي تسويق رقمي" },
  { key: "brand-manager", en: "Brand Manager", ar: "مدير العلامة التجارية" },
  { key: "product-manager", en: "Product Manager", ar: "مدير المنتج" },
  { key: "project-manager", en: "Project Manager", ar: "مدير المشروع" },
  { key: "program-manager", en: "Program Manager", ar: "مدير البرامج" },
  { key: "it-manager", en: "IT Manager", ar: "مدير تقنية المعلومات" },
  { key: "system-administrator", en: "System Administrator", ar: "مسؤول الأنظمة" },
  { key: "network-administrator", en: "Network Administrator", ar: "مسؤول الشبكات" },
  { key: "database-administrator", en: "Database Administrator", ar: "مسؤول قواعد البيانات" },
  { key: "software-engineer", en: "Software Engineer", ar: "مهندس برمجيات" },
  { key: "senior-software-engineer", en: "Senior Software Engineer", ar: "مهندس برمجيات أول" },
  { key: "technical-lead", en: "Technical Lead", ar: "قائد تقني" },
  { key: "solution-architect", en: "Solution Architect", ar: "مهندس حلول" },
  { key: "devops-engineer", en: "DevOps Engineer", ar: "مهندس DevOps" },
  { key: "qa-engineer", en: "QA Engineer", ar: "مهندس جودة برمجيات" },
  { key: "data-analyst", en: "Data Analyst", ar: "محلل بيانات" },
  { key: "data-scientist", en: "Data Scientist", ar: "عالم بيانات" },
  { key: "business-analyst", en: "Business Analyst", ar: "محلل أعمال" },
  { key: "systems-analyst", en: "Systems Analyst", ar: "محلل نظم" },
  { key: "ui-ux-designer", en: "UI/UX Designer", ar: "مصمم واجهات وتجربة المستخدم" },
  { key: "graphic-designer", en: "Graphic Designer", ar: "مصمم جرافيك" },
  { key: "hr-manager", en: "HR Manager", ar: "مدير الموارد البشرية" },
  { key: "hr-specialist", en: "HR Specialist", ar: "أخصائي موارد بشرية" },
  { key: "recruiter", en: "Recruiter", ar: "أخصائي توظيف" },
  { key: "payroll-specialist", en: "Payroll Specialist", ar: "أخصائي رواتب" },
  { key: "training-manager", en: "Training Manager", ar: "مدير التدريب" },
  { key: "administrative-manager", en: "Administrative Manager", ar: "المدير الإداري" },
  { key: "office-manager", en: "Office Manager", ar: "مدير المكتب" },
  { key: "executive-assistant", en: "Executive Assistant", ar: "مساعد تنفيذي" },
  { key: "administrative-assistant", en: "Administrative Assistant", ar: "مساعد إداري" },
  { key: "secretary", en: "Secretary", ar: "سكرتير" },
  { key: "receptionist", en: "Receptionist", ar: "موظف استقبال" },
  { key: "customer-service-manager", en: "Customer Service Manager", ar: "مدير خدمة العملاء" },
  { key: "customer-service-representative", en: "Customer Service Representative", ar: "ممثل خدمة عملاء" },
  { key: "call-center-agent", en: "Call Center Agent", ar: "موظف مركز اتصال" },
  { key: "support-engineer", en: "Support Engineer", ar: "مهندس دعم فني" },
  { key: "procurement-manager", en: "Procurement Manager", ar: "مدير المشتريات" },
  { key: "purchasing-specialist", en: "Purchasing Specialist", ar: "أخصائي مشتريات" },
  { key: "supply-chain-manager", en: "Supply Chain Manager", ar: "مدير سلسلة الإمداد" },
  { key: "logistics-manager", en: "Logistics Manager", ar: "مدير الخدمات اللوجستية" },
  { key: "warehouse-manager", en: "Warehouse Manager", ar: "مدير المخزن" },
  { key: "inventory-controller", en: "Inventory Controller", ar: "مراقب المخزون" },
  { key: "store-manager", en: "Store Manager", ar: "مدير المتجر" },
  { key: "retail-supervisor", en: "Retail Supervisor", ar: "مشرف التجزئة" },
  { key: "cashier", en: "Cashier", ar: "أمين صندوق" },
  { key: "production-manager", en: "Production Manager", ar: "مدير الإنتاج" },
  { key: "plant-manager", en: "Plant Manager", ar: "مدير المصنع" },
  { key: "quality-manager", en: "Quality Manager", ar: "مدير الجودة" },
  { key: "maintenance-manager", en: "Maintenance Manager", ar: "مدير الصيانة" },
  { key: "safety-officer", en: "Safety Officer", ar: "مسؤول السلامة" },
  { key: "site-engineer", en: "Site Engineer", ar: "مهندس موقع" },
  { key: "civil-engineer", en: "Civil Engineer", ar: "مهندس مدني" },
  { key: "mechanical-engineer", en: "Mechanical Engineer", ar: "مهندس ميكانيكي" },
  { key: "electrical-engineer", en: "Electrical Engineer", ar: "مهندس كهرباء" },
  { key: "architect", en: "Architect", ar: "مهندس معماري" },
  { key: "legal-counsel", en: "Legal Counsel", ar: "المستشار القانوني" },
  { key: "lawyer", en: "Lawyer", ar: "محامٍ" },
  { key: "compliance-officer", en: "Compliance Officer", ar: "مسؤول الالتزام" },
  { key: "risk-manager", en: "Risk Manager", ar: "مدير المخاطر" },
  { key: "consultant", en: "Consultant", ar: "مستشار" },
  { key: "physician", en: "Physician", ar: "طبيب" },
  { key: "pharmacist", en: "Pharmacist", ar: "صيدلي" },
  { key: "nurse", en: "Nurse", ar: "ممرض" },
  { key: "lab-technician", en: "Lab Technician", ar: "فني مختبر" },
  { key: "teacher", en: "Teacher", ar: "معلم" },
  { key: "school-principal", en: "School Principal", ar: "مدير مدرسة" },
  { key: "trainer", en: "Trainer", ar: "مدرب" },
  { key: "driver", en: "Driver", ar: "سائق" },
  { key: "technician", en: "Technician", ar: "فني" },
];

export function jobTitleLabel(option: JobTitleOption, lang: string): string {
  return lang === "ar" ? option.ar : option.en;
}

/**
 * Maps a stored job title back onto a catalogue entry. An unmatched value is
 * not an error -- it resolves to `OTHER` with the stored text preserved.
 */
export function matchJobTitle(value: string): JobTitleOption | null {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;
  return (
    JOB_TITLE_OPTIONS.find(
      (option) =>
        option.en.toLowerCase() === normalized ||
        option.ar === value.trim() ||
        option.key === normalized,
    ) ?? null
  );
}
