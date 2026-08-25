import { useState, type FormEvent } from "react";
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
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
  };

  const close = () => {
    if (isSubmitting) return;
    setFormData(initialFormData);
    onClose();
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
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
    } catch {
      // The owning API hook renders the normalized failure toast.
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    formData,
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
