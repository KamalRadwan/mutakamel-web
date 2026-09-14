"use client";

import { useCallback, useState } from "react";
import { useI18n } from "@/i18n/I18nContext";
import { TenantApiClientError, axiosClient } from "@/lib/api/axiosClient";
import { formatTemplate } from "@/lib/format/template";
import { isUUIDv7 } from "@/lib/uuid";
import type { LeadTag } from "../lead-card-contract";

export const TAGS_API_PATH = "/api/tenant/crm/v1/tags";
export const TAG_NAME_MAX_LENGTH = 60;

export interface TagResponse {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface UseCreateTagModalOptions {
  open: boolean;
  initialName?: string;
  existingTags: LeadTag[];
  onSuccess: (newTag: LeadTag) => void;
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
  const [touched, setTouched] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Sync state during render when modal open status transitions
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setName(initialName.trim());
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
      if ([...val].length > TAG_NAME_MAX_LENGTH) {
        return formatTemplate(t.crmLeads.create.errors.maxLength, {
          max: TAG_NAME_MAX_LENGTH,
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
      const response = await axiosClient.post<unknown>(TAGS_API_PATH, {
        name: trimmed,
      });

      const data = response.data as Partial<TagResponse> | undefined;
      const id = data?.id;
      const tagName = data?.name;
      if (!data || typeof data !== "object" || !id || !isUUIDv7(id) || typeof tagName !== "string") {
        throw new Error("Invalid tag response payload.");
      }

      const createdTag: LeadTag = {
        id,
        name: tagName,
        color: null,
      };

      onSuccess(createdTag);
      onClose();
    } catch (error: unknown) {
      if (error instanceof TenantApiClientError || (typeof error === "object" && error !== null && "response" in error)) {
        const res = (error as { response?: { status?: number; data?: { errorCode?: string; message?: string } } }).response;
        const status = res?.status;
        const code = res?.data?.errorCode;
        const msg = res?.data?.message;

        if (status === 409 || code === "CRM_TAG_NAME_TAKEN") {
          setFieldError(t.crmLeads.create.createTagErrorNameTaken);
        } else if (status === 422 || code === "CRM_TAG_LIMIT_EXCEEDED") {
          setServerError(t.crmLeads.create.createTagErrorLimitExceeded);
        } else {
          setServerError(msg || t.crmLeads.create.createTagErrorGeneric);
        }
      } else {
        setServerError(t.crmLeads.create.createTagErrorGeneric);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const isDirty = trimmed.length > 0;
  const isSubmitDisabled = isSubmitting || trimmed.length === 0 || [...trimmed].length > TAG_NAME_MAX_LENGTH;

  return {
    name,
    charCount,
    maxChars: TAG_NAME_MAX_LENGTH,
    fieldError,
    serverError,
    isSubmitting,
    isDirty,
    isSubmitDisabled,
    handleNameChange,
    handleBlur,
    handleSubmit,
  };
}
