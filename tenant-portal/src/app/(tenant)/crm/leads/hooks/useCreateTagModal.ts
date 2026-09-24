"use client";

import { useCallback, useState } from "react";
import type { TagColor } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { axiosClient } from "@/lib/api/axiosClient";
import { formatTemplate } from "@/lib/format/template";
import {
  CRM_TAGS_PATH,
  CRM_TAG_NAME_MAX_LENGTH,
  buildCreateCrmTagBody,
  crmTagErrorMessage,
  parseCrmTagCatalogueItem,
  readCrmTagError,
  type CrmTag,
} from "../../shared/tag-contract";

export interface UseCreateTagModalOptions {
  open: boolean;
  initialName?: string;
  existingTags: CrmTag[];
  onSuccess: (newTag: CrmTag) => void;
  onClose: () => void;
}

export function useCreateTagModal({
  open,
  initialName = "",
  existingTags,
  onSuccess,
  onClose,
}: UseCreateTagModalOptions) {
  const { t } = useI18n();
  const [prevOpen, setPrevOpen] = useState(open);
  const [name, setName] = useState(initialName.trim());
  const [color, setColor] = useState<TagColor | null>(null);
  const [touched, setTouched] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Sync state during render when modal open status transitions
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setName(initialName.trim());
      setColor(null);
      setTouched(false);
      setFieldError(null);
      setServerError(null);
      setIsSubmitting(false);
    }
  }

  const trimmed = name.trim();
  const charCount = [...name].length;

  const validate = useCallback(
    (value: string): string | null => {
      const val = value.trim();
      if (val.length === 0) {
        return t.crmLeads.create.errors.required;
      }
      if ([...val].length > CRM_TAG_NAME_MAX_LENGTH) {
        return formatTemplate(t.crmLeads.create.errors.maxLength, {
          max: CRM_TAG_NAME_MAX_LENGTH,
        });
      }
      const lower = val.toLowerCase();
      if (existingTags.some((tag) => tag.name.trim().toLowerCase() === lower)) {
        return t.crmLeads.create.createTagErrorNameTaken;
      }
      return null;
    },
    [existingTags, t],
  );

  const handleNameChange = (next: string) => {
    setName(next);
    setServerError(null);
    if (touched) {
      setFieldError(validate(next));
    }
  };

  const handleColorChange = (next: TagColor | null) => {
    setColor(next);
    setServerError(null);
  };

  const handleBlur = () => {
    setTouched(true);
    setFieldError(validate(name));
  };

  const handleSubmit = async () => {
    setTouched(true);
    const err = validate(name);
    setFieldError(err);
    if (err || isSubmitting) return;

    setIsSubmitting(true);
    setServerError(null);

    try {
      const response = await axiosClient.post<unknown>(
        CRM_TAGS_PATH,
        buildCreateCrmTagBody(trimmed, color),
      );
      // The created tag carries the colour the server stored, so its chip in
      // the picker matches the catalogue from the first render.
      const created = parseCrmTagCatalogueItem(response.data);
      onSuccess({
        id: created.id,
        name: created.name,
        backgroundColor: created.backgroundColor,
        textColor: created.textColor,
      });
      onClose();
    } catch (error: unknown) {
      const failure = readCrmTagError(error);
      if (failure === null) {
        setServerError(t.crmLeads.create.createTagErrorGeneric);
      } else if (
        failure.code === "CRM_TAG_NAME_TAKEN" ||
        (failure.code === null && failure.status === 409)
      ) {
        setFieldError(t.crmLeads.create.createTagErrorNameTaken);
      } else {
        setServerError(
          crmTagErrorMessage(failure, {
            ...t.crmTags.errors,
            limitExceeded: t.crmLeads.create.createTagErrorLimitExceeded,
            saveFailed: t.crmLeads.create.createTagErrorGeneric,
          }),
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const isDirty = trimmed.length > 0 || color !== null;
  const isSubmitDisabled =
    isSubmitting || trimmed.length === 0 || [...trimmed].length > CRM_TAG_NAME_MAX_LENGTH;

  return {
    name,
    color,
    charCount,
    maxChars: CRM_TAG_NAME_MAX_LENGTH,
    fieldError,
    serverError,
    isSubmitting,
    isDirty,
    isSubmitDisabled,
    handleNameChange,
    handleColorChange,
    handleBlur,
    handleSubmit,
  };
}
