import { rectInPage, viewport } from '../overlay/zoom';

export interface TitleSuggestion {
  en: string;
  ar: string;
}

export interface SuggestionMenuPlace {
  top: number;
  start: number;
  width: number;
  maxHeight: number | null;
}

const ARABIC_DIACRITICS = /[\u064B-\u065F\u0670\u06D6-\u06ED]/g;

export const TITLE_SUGGESTIONS: { en: string; ar: string }[] = [
  { en: 'Mr.', ar: 'السيد' },
  { en: 'Mrs.', ar: 'السيدة' },
  { en: 'Miss', ar: 'الآنسة' },
  { en: 'Dr.', ar: 'الدكتور' },
  { en: 'Eng.', ar: 'المهندس' },
  { en: 'Prof.', ar: 'الأستاذ الدكتور' },
  { en: 'Counselor', ar: 'المستشار' },
  { en: 'Sheikh', ar: 'الشيخ' },
  { en: 'Capt.', ar: 'الكابتن' },
  { en: 'Adv.', ar: 'المحامي' },
];

export const JOB_TITLE_SUGGESTIONS: { en: string; ar: string }[] = [
  { en: 'Owner', ar: 'المالك' },
  { en: 'Founder', ar: 'المؤسس' },
  { en: 'Chairman', ar: 'رئيس مجلس الإدارة' },
  { en: 'Board member', ar: 'عضو مجلس الإدارة' },
  { en: 'Chief executive officer (CEO)', ar: 'الرئيس التنفيذي' },
  { en: 'Managing director', ar: 'العضو المنتدب' },
  { en: 'General manager', ar: 'المدير العام' },
  { en: 'Deputy general manager', ar: 'نائب المدير العام' },
  { en: 'Chief operating officer (COO)', ar: 'مدير العمليات التنفيذي' },
  { en: 'Chief financial officer (CFO)', ar: 'المدير المالي التنفيذي' },
  { en: 'Chief technology officer (CTO)', ar: 'مدير التقنية التنفيذي' },
  { en: 'Chief marketing officer (CMO)', ar: 'مدير التسويق التنفيذي' },
  { en: 'Chief commercial officer', ar: 'المدير التجاري التنفيذي' },
  { en: 'Vice president', ar: 'نائب الرئيس' },
  { en: 'Regional manager', ar: 'المدير الإقليمي' },
  { en: 'Country manager', ar: 'مدير الدولة' },
  { en: 'Branch manager', ar: 'مدير الفرع' },
  { en: 'Operations manager', ar: 'مدير العمليات' },
  { en: 'Finance manager', ar: 'المدير المالي' },
  { en: 'Sales manager', ar: 'مدير المبيعات' },
  { en: 'Marketing manager', ar: 'مدير التسويق' },
  { en: 'Human resources manager', ar: 'مدير الموارد البشرية' },
  { en: 'IT manager', ar: 'مدير تقنية المعلومات' },
  { en: 'Procurement manager', ar: 'مدير المشتريات' },
  { en: 'Business development manager', ar: 'مدير تطوير الأعمال' },
  { en: 'Project manager', ar: 'مدير المشروع' },
  { en: 'Product manager', ar: 'مدير المنتج' },
  { en: 'Legal manager', ar: 'مدير الشؤون القانونية' },
  { en: 'Quality manager', ar: 'مدير الجودة' },
  { en: 'Office manager', ar: 'مدير المكتب' },
  { en: 'Head of department', ar: 'رئيس القسم' },
  { en: 'Account manager', ar: 'مدير الحساب' },
  { en: 'Team leader', ar: 'قائد الفريق' },
  { en: 'Supervisor', ar: 'المشرف' },
  { en: 'Senior engineer', ar: 'مهندس أول' },
  { en: 'Engineer', ar: 'مهندس' },
  { en: 'Consultant', ar: 'مستشار' },
  { en: 'Senior accountant', ar: 'محاسب أول' },
  { en: 'Accountant', ar: 'محاسب' },
  { en: 'Specialist', ar: 'أخصائي' },
  { en: 'Sales representative', ar: 'مندوب مبيعات' },
  { en: 'Marketing specialist', ar: 'أخصائي تسويق' },
  { en: 'Purchasing officer', ar: 'مسؤول مشتريات' },
  { en: 'Human resources officer', ar: 'مسؤول موارد بشرية' },
  { en: 'Customer service representative', ar: 'ممثل خدمة العملاء' },
  { en: 'Coordinator', ar: 'منسق' },
  { en: 'Executive assistant', ar: 'مساعد تنفيذي' },
  { en: 'Secretary', ar: 'سكرتير' },
  { en: 'Technician', ar: 'فني' },
  { en: 'Employee', ar: 'موظف' },
];

function normalizeForMatch(value: string): string {
  return value.replace(ARABIC_DIACRITICS, '').toLowerCase();
}

export function suggestionsForLanguage(list: readonly { en: string; ar: string }[], lang: string): string[] {
  const isArabic = lang === 'ar';
  return list.map((item) => (isArabic ? item.ar : item.en));
}

export function filterSuggestions(items: readonly string[], query: string): string[] {
  const q = normalizeForMatch(query.trim());
  if (!q) return [...items];
  return items.filter((item) => normalizeForMatch(item).includes(q));
}

export function initialSuggestionPlace(anchorEl: HTMLElement, hostEl: HTMLElement): SuggestionMenuPlace {
  const rect = rectInPage(anchorEl);
  const { width } = viewport();
  const rtl = getComputedStyle(hostEl).direction === 'rtl';
  return {
    top: rect.bottom + 4,
    start: rtl ? width - rect.right : rect.left,
    width: rect.width,
    maxHeight: null,
  };
}

export function computeSuggestionPlace(
  anchorEl: HTMLElement,
  listEl: HTMLElement,
  hostEl: HTMLElement,
): SuggestionMenuPlace {
  listEl.style.maxHeight = '';
  const rect = rectInPage(anchorEl);
  const listRect = rectInPage(listEl);
  const { width, height } = viewport();
  const rtl = getComputedStyle(hostEl).direction === 'rtl';

  const belowTop = rect.bottom + 4;
  const spaceBelow = Math.max(8, height - 8 - belowTop);
  const spaceAbove = Math.max(8, rect.top - 12);
  const flipUp = listRect.height > spaceBelow && spaceAbove > spaceBelow;
  const avail = flipUp ? spaceAbove : spaceBelow;
  const maxHeight = listRect.height > avail ? avail : null;
  const finalHeight = maxHeight ?? listRect.height;
  const top = flipUp ? Math.max(8, rect.top - 4 - finalHeight) : belowTop;

  const triggerStart = rtl ? width - rect.right : rect.left;
  const triggerEnd = rtl ? width - rect.left : rect.right;
  const alignEnd = triggerStart + listRect.width > width - 8;
  const rawStart = alignEnd ? triggerEnd - listRect.width : triggerStart;
  const start = Math.min(Math.max(8, rawStart), Math.max(8, width - 8 - listRect.width));

  listEl.style.top = `${top}px`;
  listEl.style.insetInlineStart = `${start}px`;
  listEl.style.minWidth = `${rect.width}px`;
  listEl.style.maxHeight = maxHeight !== null ? `${maxHeight}px` : '';
  listEl.classList.remove('invisible');

  return { top, start, width: rect.width, maxHeight };
}
