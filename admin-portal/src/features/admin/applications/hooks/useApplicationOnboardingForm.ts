import { useState, type FormEvent } from "react";
import { useI18n } from "@/i18n/I18nContext";
import type {
  ApplicationCatalogueVisibility,
  ApplicationCommercialMode,
  ApplicationDatabaseDeployment,
  ApplicationType,
  CreateApplicationDto,
  OnboardApplicationDto,
} from "../types";

type FormData = Omit<OnboardApplicationDto, "description"> & {
  description: string;
};

const initialFormData: FormData = {
  key: "",
  name: "",
  description: "",
  applicationType: "TENANT",
  commercialMode: "SUBSCRIPTION",
  catalogueVisibility: "PUBLIC",
  databaseDeployment: "REQUIRED",
  reason: "",
};

export function useApplicationOnboardingForm({
  canOnboard,
  onClose,
  onCreate,
  onOnboard,
}: {
  canOnboard: boolean;
  onClose: () => void;
  onCreate: (dto: CreateApplicationDto) => Promise<unknown>;
  onOnboard: (dto: OnboardApplicationDto) => Promise<unknown>;
}) {
  const { lang } = useI18n();
  const validationCopy = onboardingValidationCopy(lang);
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submissionError, setSubmissionError] = useState<string | null>(null);

  const setApplicationType = (applicationType: ApplicationType) => {
    setFormData((current) => ({
      ...current,
      applicationType,
      commercialMode:
        applicationType === "SYSTEM" &&
        (current.catalogueVisibility === "PUBLIC" ||
          current.commercialMode === "SUBSCRIPTION")
          ? "INCLUDED"
          : current.commercialMode,
      databaseDeployment:
        applicationType === "TENANT" && current.databaseDeployment === "NONE"
          ? "REQUIRED"
          : current.databaseDeployment,
    }));
  };

  const setCommercialMode = (commercialMode: ApplicationCommercialMode) => {
    setFormData((current) => ({ ...current, commercialMode }));
  };

  const setVisibility = (catalogueVisibility: ApplicationCatalogueVisibility) => {
    setFormData((current) => ({
      ...current,
      catalogueVisibility,
      commercialMode:
        current.applicationType === "SYSTEM" && catalogueVisibility === "PUBLIC"
          ? "INCLUDED"
          : current.commercialMode,
    }));
  };

  const setDatabaseDeployment = (
    databaseDeployment: ApplicationDatabaseDeployment,
  ) => {
    setFormData((current) => ({ ...current, databaseDeployment }));
  };

  const setText = (field: "key" | "name" | "description" | "reason", value: string) => {
    setFormData((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  };

  const close = () => {
    if (isSubmitting) return;
    setFormData(initialFormData);
    setFieldErrors({});
    setSubmissionError(null);
    onClose();
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors: Record<string, string> = {};
    if (!/^[a-z][a-z0-9_]{0,31}$/.test(formData.key)) nextErrors.key = validationCopy.key;
    if (!formData.name.trim()) nextErrors.name = validationCopy.name;
    if (canOnboard && !formData.reason.trim()) nextErrors.reason = validationCopy.reason;
    setFieldErrors(nextErrors);
    setSubmissionError(null);
    if (Object.keys(nextErrors).length > 0) return;

    setIsSubmitting(true);
    try {
      const description = formData.description.trim() || undefined;
      if (canOnboard) {
        await onOnboard({
          ...formData,
          description,
          reason: formData.reason.trim(),
        });
      } else {
        await onCreate({
          key: formData.key,
          name: formData.name,
          description,
          applicationType: formData.applicationType,
          commercialMode: formData.commercialMode,
          catalogueVisibility: formData.catalogueVisibility,
        });
      }
      setFormData(initialFormData);
      onClose();
    } catch (error) {
      setSubmissionError(readSubmissionMessage(error, validationCopy.failed));
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    formData,
    fieldErrors,
    submissionError,
    isSubmitting,
    close,
    submit,
    setApplicationType,
    setCommercialMode,
    setVisibility,
    setDatabaseDeployment,
    setText,
  };
}

function readSubmissionMessage(value: unknown, fallback: string) {
  if (value instanceof Error) return value.message;
  if (value && typeof value === "object" && "message" in value && typeof value.message === "string") return value.message;
  return fallback;
}

function onboardingValidationCopy(lang: "ar" | "en") {
  return lang === "ar"
    ? {
        key: "أدخل مفتاحًا يبدأ بحرف صغير ويحتوي على أحرف صغيرة أو أرقام أو شرطة سفلية فقط.",
        name: "اسم التطبيق مطلوب.",
        reason: "سبب التهيئة مطلوب.",
        failed: "تعذر حفظ التطبيق.",
      }
    : {
        key: "Enter a key that starts with a lowercase letter and uses only lowercase letters, numbers, or underscores.",
        name: "Application name is required.",
        reason: "An onboarding reason is required.",
        failed: "The Application could not be saved.",
      };
}
