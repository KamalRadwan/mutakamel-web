"use client";

import { useI18n } from "@/i18n/I18nContext";
import { templateFeedbackAr, templateFeedbackEn } from "@/i18n/dictionaries/template-feedback";

export function useTemplateFeedbackCopy() {
  const { lang } = useI18n();
  return { ar: templateFeedbackAr, en: templateFeedbackEn }[lang];
}
