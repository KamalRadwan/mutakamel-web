import type { PageErrorCode } from "./page-contract";

const en = {
  textSessionActive: "Apply or discard the current text edit before using page commands or navigation.",
  title: "Page", setup: "Page settings", zones: "Header and footer", format: "Paper size", orientation: "Orientation", portrait: "Portrait", landscape: "Landscape",
  custom: "Custom", letter: "US Letter", width: "Width (mm)", height: "Height (mm)", top: "Top (mm)", end: "End (mm)", bottom: "Bottom (mm)", start: "Start (mm)",
  background: "Background", solid: "Solid color", asset: "Asset", noBackground: "No background", backgroundColor: "Background color", assetId: "Asset ID", contain: "Contain", cover: "Cover", fit: "Background fit", opacity: "Opacity (0–1)",
  bleed: "Bleed is fixed at 0 mm for this release.", printBounds: "Show print bounds", rulers: "Rulers", safeArea: "Safe content area (mm)", apply: "Apply", cancel: "Cancel",
  page: "Page", pageOf: "Page {current} of {count}", add: "Add page", duplicate: "Duplicate page", earlier: "Move page earlier", later: "Move page later", remove: "Delete page", moveSelection: "Move selected object to page",
  deleteTitle: "Delete this page?", deleteHelp: "{page}: {count} content objects will be removed. Undo restores the whole page.",
  header: "Header", footer: "Footer", enabled: "Enabled", zoneMode: "Zone", fixed: "Fixed", flow: "Flow", every: "Every page", first: "First page", last: "Last page", repeat: "Repeat", zoneHeight: "Reservation height (mm)",
  zoneHelp: "Content must fit its reserved zone. Remove its contents explicitly before disabling a populated zone.",
  flowHelp: "Pages are generated from content. Use pagination controls in the body; page add, delete and reorder apply to Fixed Canvas.",
  generatedUnavailable: "Generated page navigation awaits measured layout for this draft.", retainedHelp: "Adding, duplicating and reordering pages requires an explicit Fixed page draft prepared through recovery.", emailHelp: "Email uses a continuous flow; print pages, page breaks and reserved zones do not apply.",
  keepTogether: "Keep block together", breakBefore: "Page break before", breakAfter: "Page break after", insertBreak: "Insert page break here", invalidNumber: "Enter a finite value within the allowed range.",
  unavailable: "Page commands await the qualified authoring package.", readOnly: "This draft is read only.", busy: "Finish or cancel the current gesture first.", stale: "The draft changed. Reopen this dialog and review the latest content.", invalid: "This change is invalid or would place content outside its bounds. The draft was preserved.", locked: "Unlock the page content before changing it.", lastPage: "Keep at least one Fixed page.", recovery: "Prepare an explicit Fixed page draft through recovery first.", layout: "This change requires measured layout approval. The draft was preserved.", unsupported: "This action is unavailable for the selected mode or region.",
};
export type PageCopy = { [K in keyof typeof en]: string };
const ar: PageCopy = {
  textSessionActive: "طبّق تحرير النص الحالي أو تجاهله قبل استخدام أوامر الصفحات أو التنقل بينها.",
  title: "الصفحة", setup: "إعدادات الصفحة", zones: "الرأس والتذييل", format: "مقاس الورق", orientation: "الاتجاه", portrait: "عمودي", landscape: "أفقي",
  custom: "مخصص", letter: "ليتر الأمريكي", width: "العرض (مم)", height: "الارتفاع (مم)", top: "أعلى (مم)", end: "نهاية (مم)", bottom: "أسفل (مم)", start: "بداية (مم)",
  background: "الخلفية", solid: "لون موحد", asset: "أصل", noBackground: "بلا خلفية", backgroundColor: "لون الخلفية", assetId: "معرّف الأصل", contain: "احتواء", cover: "تغطية", fit: "ملاءمة الخلفية", opacity: "الشفافية (0–1)",
  bleed: "نزف الطباعة ثابت عند 0 مم في هذا الإصدار.", printBounds: "إظهار حدود الطباعة", rulers: "المساطر", safeArea: "منطقة المحتوى الآمنة (مم)", apply: "تطبيق", cancel: "إلغاء",
  page: "صفحة", pageOf: "الصفحة {current} من {count}", add: "إضافة صفحة", duplicate: "نسخ الصفحة", earlier: "نقل الصفحة للأسبق", later: "نقل الصفحة للتالي", remove: "حذف الصفحة", moveSelection: "نقل العنصر المحدد إلى صفحة",
  deleteTitle: "حذف هذه الصفحة؟", deleteHelp: "{page}: سيتم حذف {count} عنصر محتوى. التراجع يستعيد الصفحة كاملة.",
  header: "الرأس", footer: "التذييل", enabled: "مفعّل", zoneMode: "المنطقة", fixed: "ثابت", flow: "متدفق", every: "كل صفحة", first: "الصفحة الأولى", last: "الصفحة الأخيرة", repeat: "التكرار", zoneHeight: "ارتفاع المنطقة المحجوزة (مم)",
  zoneHelp: "يجب أن يبقى المحتوى داخل منطقته المحجوزة. احذف محتوى المنطقة صراحة قبل تعطيلها.",
  flowHelp: "تُولَّد الصفحات من المحتوى. استخدم أدوات الترقيم داخل المتن؛ إضافة الصفحات وحذفها وترتيبها تخص اللوحة الثابتة.",
  generatedUnavailable: "التنقل بين الصفحات المولّدة ينتظر قياس التخطيط لهذه المسودة.", retainedHelp: "إضافة الصفحات ونسخها وترتيبها تتطلب مسودة صفحات ثابتة صريحة معدّة عبر الاسترداد.", emailHelp: "البريد متدفق متصل؛ صفحات الطباعة والفواصل والمناطق المحجوزة لا تنطبق عليه.",
  keepTogether: "الحفاظ على الكتلة", breakBefore: "فاصل صفحة قبل", breakAfter: "فاصل صفحة بعد", insertBreak: "إدراج فاصل صفحة هنا", invalidNumber: "أدخل قيمة عددية صالحة ضمن النطاق المسموح.",
  unavailable: "أوامر الصفحة تنتظر حزمة التحرير المعتمدة.", readOnly: "هذه المسودة للقراءة فقط.", busy: "أنهِ الحركة الحالية أو ألغِها أولًا.", stale: "تغيّرت المسودة. أعد فتح النافذة وراجع أحدث محتوى.", invalid: "التغيير غير صالح أو سيخرج المحتوى عن حدوده. حُفظت المسودة دون تعديل.", locked: "ألغِ قفل محتوى الصفحة قبل تغييره.", lastPage: "يجب الإبقاء على صفحة ثابتة واحدة على الأقل.", recovery: "أعدّ مسودة صفحات ثابتة صريحة عبر الاسترداد أولًا.", layout: "يتطلب هذا التغيير اعتماد قياس التخطيط. حُفظت المسودة دون تعديل.", unsupported: "هذا الإجراء غير متاح للنمط أو المنطقة المحددة.",
};
export const pageCopies: Record<"en-US" | "ar-EG", PageCopy> = { "en-US": en, "ar-EG": ar };
export const pageNumberLocales = { "en-US": "en-US", "ar-EG": "ar-EG-u-nu-latn" } as const;
export function pageErrorText(copy: PageCopy, error: PageErrorCode): string { return copy[error]; }
export function pageText(copy: PageCopy, current: string, count: string): string { return copy.pageOf.replace("{current}", current).replace("{count}", count); }
export function copiedPageName(name: string, copy: PageCopy): string {
  const suffix = ` (${copy.duplicate})`, characters = Array.from(name);
  // Native schema caps the complete single-line page name at 100 UTF-16 units.
  while ((characters.join("") + suffix).length > 100 && characters.length) characters.pop();
  return characters.join("") + suffix;
}
