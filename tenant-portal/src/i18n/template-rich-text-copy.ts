const en = {
  title: "Structured text", paragraph: "Paragraph", bulletList: "Bulleted list", orderedList: "Numbered list", text: "Text", variable: "Linked variable", hardBreak: "Line break",
  bold: "Bold", italic: "Italic", underline: "Underline", link: "HTTPS link", removeLink: "Remove link", remove: "Remove", addText: "Add text", addBreak: "Add line break", addParagraph: "Add paragraph", addItem: "Add list item", removeItem: "Remove list item",
  align: "Paragraph alignment", START: "Start", CENTER: "Center", END: "End", JUSTIFY: "Justify", apply: "Apply text", discard: "Discard changes", undo: "Undo text edit", redo: "Redo text edit", properties: "Text appearance and direction",
  headings: "Heading editing requires the template editor update.", heading1: "Heading 1", heading2: "Heading 2", heading3: "Heading 3", heading4: "Heading 4", heading5: "Heading 5", heading6: "Heading 6",
  invalid: "This change is not supported by the template schema. Your previous content is retained.", stale: "The selection or saved content changed. Reopen text editing before applying.", blocked: "Text editing is unavailable for the current selection or access.", applied: "Text changes applied to the draft.", unchanged: "No text changes to apply.",
  plainPaste: "Paste inserts plain text. Variables remain separate linked tokens.", bindingUnavailable: "No qualified inline variables are available from the document owner.",
  linkInvalid: "Enter a supported HTTPS link, or revert this link edit.", revertLink: "Revert link edit",
  normalization: "Text stays as typed while editing. Apply saves equivalent characters in their standard form.",
};
export type RichTextCopy = { [K in keyof typeof en]: string };
const ar: RichTextCopy = {
  title: "النص المنظم", paragraph: "فقرة", bulletList: "قائمة نقطية", orderedList: "قائمة مرقمة", text: "النص", variable: "متغير مرتبط", hardBreak: "فاصل سطر",
  bold: "عريض", italic: "مائل", underline: "تسطير", link: "رابط HTTPS", removeLink: "إزالة الرابط", remove: "إزالة", addText: "إضافة نص", addBreak: "إضافة فاصل سطر", addParagraph: "إضافة فقرة", addItem: "إضافة عنصر قائمة", removeItem: "إزالة عنصر القائمة",
  align: "محاذاة الفقرة", START: "البداية", CENTER: "الوسط", END: "النهاية", JUSTIFY: "ضبط", apply: "تطبيق النص", discard: "تجاهل التغييرات", undo: "تراجع عن تحرير النص", redo: "إعادة تحرير النص", properties: "مظهر النص واتجاهه",
  headings: "يتطلب تحرير العناوين تحديث محرر القوالب.", heading1: "عنوان 1", heading2: "عنوان 2", heading3: "عنوان 3", heading4: "عنوان 4", heading5: "عنوان 5", heading6: "عنوان 6",
  invalid: "هذا التغيير غير مدعوم في عقد القالب. احتفظنا بالمحتوى السابق.", stale: "تغير التحديد أو المحتوى المحفوظ. افتح تحرير النص مجددًا قبل التطبيق.", blocked: "تحرير النص غير متاح للتحديد أو الصلاحية الحالية.", applied: "تم تطبيق تغييرات النص على المسودة.", unchanged: "لا توجد تغييرات نصية لتطبيقها.",
  plainPaste: "يُدرج اللصق نصًا عاديًا. تبقى المتغيرات رموزًا مرتبطة منفصلة.", bindingUnavailable: "لا توجد متغيرات ضمنية معتمدة متاحة من مالك المستند.",
  linkInvalid: "أدخل رابط HTTPS مدعومًا أو تراجع عن تعديل هذا الرابط.", revertLink: "تراجع عن تعديل الرابط",
  normalization: "يبقى النص كما كُتب أثناء التحرير. يحفظ «تطبيق» الحروف المتكافئة بصيغتها القياسية.",
};
export const templateRichTextCopy: Record<"ar" | "en", RichTextCopy> = { en, ar };
