const en = {
  emailSampleHint: "Uses synthetic email data.", emailSamplePreheader: "Preheader",
  closePage: "Close page settings?", closePageHelp: "Unapplied fields will be discarded. Changes already applied to the draft will remain.",
  keepEditing: "Continue editing", close: "Close settings", appearanceHelp: "Discard unapplied text changes before returning to text appearance?",
  localPending: "Finish the open editor before saving or navigating. Unapplied fields can also be discarded here.", discardLocal: "Discard unapplied fields",
};
type Copy = { [K in keyof typeof en]: string };
const ar: Copy = {
  emailSampleHint: "تستخدم المعاينة بيانات بريد إلكتروني تجريبية.", emailSamplePreheader: "النص التمهيدي",
  closePage: "إغلاق إعدادات الصفحات؟", closePageHelp: "سيتم تجاهل الحقول غير المطبّقة. التغييرات التي طُبّقت على المسودة ستبقى.",
  keepEditing: "متابعة التحرير", close: "إغلاق الإعدادات", appearanceHelp: "هل تريد تجاهل تغييرات النص غير المطبّقة والعودة إلى مظهر النص؟",
  localPending: "أكمل المحرر المفتوح قبل الحفظ أو التنقل. يمكنك أيضًا تجاهل الحقول غير المطبّقة من هنا.", discardLocal: "تجاهل الحقول غير المطبّقة",
};
export const templateAuthoringHostCopy: Record<"ar" | "en", Copy> = { en, ar };
