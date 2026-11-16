export const templateFeedbackEn = {
  region: "Template status",
  loading: "Loading the template…",
  saving: "Saving the template draft…",
  previewing: "Preparing the template preview…",
  readOnly: "This template is read-only. You can inspect it, but changes cannot be saved.",
  overflow: "Content extends beyond the page",
  errorDescription: "The template screen could not continue. Retry to reload it. Unsaved changes may need to be entered again.",
  back: "Back to templates",
} as const;

type TemplateFeedbackCopy = { readonly [K in keyof typeof templateFeedbackEn]: string };

export const templateFeedbackAr: TemplateFeedbackCopy = {
  region: "حالة القالب",
  loading: "جارٍ تحميل القالب…",
  saving: "جارٍ حفظ مسودة القالب…",
  previewing: "جارٍ إعداد معاينة القالب…",
  readOnly: "هذا القالب للقراءة فقط. يمكنك الاطلاع عليه، لكن لا يمكن حفظ التغييرات.",
  overflow: "يوجد محتوى يتجاوز حدود الصفحة",
  errorDescription: "تعذر متابعة عرض القالب. أعد المحاولة لتحميله من جديد. قد تحتاج إلى إدخال التغييرات غير المحفوظة مرة أخرى.",
  back: "العودة إلى القوالب",
};
