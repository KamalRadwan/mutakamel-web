import { useToast } from "@/components/ui/ToastContext";
import { useI18n } from "@/i18n/I18nContext";
import { normalizeApiError } from "@/shared/api/normalized-api-error";
import { shouldRotateWriteCommandKey } from "@/shared/api/write-command-recovery";
import { useIdempotency } from "@/shared/hooks/useIdempotency";
import { applicationsApi } from "../api/applications.api";
import type { CreateApplicationDto, OnboardApplicationDto } from "../types";

/** Application registration mutations only; this hook never loads the catalogue. */
export function useApplicationRegistration(onChanged?: () => void) {
  const toast = useToast();
  const { lang } = useI18n();
  const createIntent = useIdempotency();
  const onboardingIntent = useIdempotency();

  const createApplication = async (dto: CreateApplicationDto) => {
    try {
      const key = createIntent.getIdempotencyKey(dto);
      const receipt = await applicationsApi.create(dto, key);
      createIntent.resetKey();
      toast.success(
        lang === "ar" ? "تم" : "Success",
        lang === "ar"
          ? "تم إنشاء مسودة التطبيق."
          : "Application drafted successfully.",
      );
      onChanged?.();
      return receipt;
    } catch (error) {
      const normalized = normalizeApiError(error);
      if (shouldRotateWriteCommandKey(normalized)) createIntent.resetKey();
      toast.error(lang === "ar" ? "خطأ" : "Error", normalized.message);
      throw normalized;
    }
  };

  const onboardApplication = async (dto: OnboardApplicationDto) => {
    try {
      const key = onboardingIntent.getIdempotencyKey(dto);
      const receipt = await applicationsApi.onboard(dto, key);
      onboardingIntent.resetKey();
      toast.success(
        lang === "ar" ? "تم" : "Success",
        lang === "ar"
          ? "تمت تهيئة التطبيق بنجاح."
          : "Application onboarded successfully.",
      );
      onChanged?.();
      return receipt;
    } catch (error) {
      const normalized = normalizeApiError(error);
      if (shouldRotateWriteCommandKey(normalized)) onboardingIntent.resetKey();
      toast.error(lang === "ar" ? "خطأ" : "Error", normalized.message);
      throw normalized;
    }
  };

  return { createApplication, onboardApplication };
}
