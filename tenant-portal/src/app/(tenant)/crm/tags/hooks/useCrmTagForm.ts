"use client";

import { useCallback, useRef, useState } from "react";
import type { TagColor } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { axiosClient, type TenantApiRequestConfig } from "@/lib/api/axiosClient";
import { formatTemplate } from "@/lib/format/template";
import {
  CRM_TAGS_PATH,
  CRM_TAG_NAME_MAX_LENGTH,
  buildCreateCrmTagBody,
  buildUpdateCrmTagBody,
  crmTagColor,
  crmTagErrorMessage,
  crmTagPath,
  parseCrmTagCatalogueItem,
  readCrmTagError,
  type CrmTagCatalogueItem,
} from "../../shared/tag-contract";
import type { CrmTagFormTarget } from "./useCrmTags";
import { CRM_TAG_CATALOGUE_LIMIT } from "../tag-limits";

// Neither write is idempotent in the Gateway contract: no replay, no key.
const WRITE_CONFIG: TenantApiRequestConfig = {
  cache: "no-store",
  maxResponseBytes: 10_000,
  nonReplayable: true,
  skipAutoIdempotency: true,
};

export interface UseCrmTagFormOptions {
  target: CrmTagFormTarget;
  /** The whole catalogue, for the case-insensitive duplicate check. */
  existingTags: readonly CrmTagCatalogueItem[];
  onSaved: (tag: CrmTagCatalogueItem) => void;
  /** An outcome the list must re-read before anyone acts again. */
  onReloadNeeded: (message: string) => void;
  canWrite: boolean;
}

/**
 * The create/edit drawer. Create posts `{ name }` or `{ name, backgroundColor,
 * textColor }`; edit patches only the keys that changed, with the colours as a
 * pair — see `buildUpdateCrmTagBody`.
 */
export function useCrmTagForm({ target, existingTags, onSaved, onReloadNeeded, canWrite }: UseCrmTagFormOptions) {
  const { t } = useI18n();
  const errors = t.crmTags.errors;
  const original = target.mode === "edit" ? target.tag : null;
  const [name, setName] = useState(original?.name ?? "");
  const [color, setColor] = useState<TagColor | null>(original ? crmTagColor(original) : null);
  const [touched, setTouched] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [nameTaken, setNameTaken] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submitting = useRef(false);
  const completed = useRef(false);
  const [colorValid, setColorValid] = useState(true);
  const colorValidity = useRef(true);
  const handleColorValidityChange = useCallback((valid: boolean) => {
    colorValidity.current = valid;
    setColorValid(valid);
  }, []);

  const trimmed = name.trim();
  const updateBody = original ? buildUpdateCrmTagBody(original, name, color) : null;

  function validate(): string | null {
    if (trimmed.length === 0) return errors.required;
    if ([...trimmed].length > CRM_TAG_NAME_MAX_LENGTH) {
      return formatTemplate(errors.maxLength, { max: CRM_TAG_NAME_MAX_LENGTH });
    }
    const lower = trimmed.toLocaleLowerCase();
    const duplicate = existingTags.some(
      (tag) => tag.id !== original?.id && tag.name.trim().toLocaleLowerCase() === lower,
    );
    return duplicate || nameTaken ? errors.nameTaken : null;
  }

  const nameError = touched ? validate() : null;

  async function submit() {
    setTouched(true);
    if (!canWrite || validate() !== null || submitting.current || completed.current) return;
    if (!colorValidity.current) {
      setServerError(errors.colorIncomplete);
      return;
    }
    if (!original && existingTags.length >= CRM_TAG_CATALOGUE_LIMIT) {
      setServerError(errors.limitExceeded);
      return;
    }
    if (original && updateBody === null) {
      setServerError(errors.updateEmpty);
      return;
    }
    submitting.current = true;
    setIsSubmitting(true);
    setServerError(null);
    try {
      const response = original
        ? await axiosClient.patch<unknown>(crmTagPath(original.id), updateBody, WRITE_CONFIG)
        : await axiosClient.post<unknown>(CRM_TAGS_PATH, buildCreateCrmTagBody(trimmed, color), WRITE_CONFIG);
      const saved = parseCrmTagCatalogueItem(response.data);
      completed.current = true;
      onSaved(saved);
    } catch (error) {
      const failure = readCrmTagError(error);
      if (failure === null || failure.status >= 500) {
        completed.current = true;
        onReloadNeeded(errors.uncertain);
      } else if (failure.code === "CRM_TAG_NOT_FOUND" || failure.status === 404) {
        completed.current = true;
        onReloadNeeded(errors.notFound);
      } else if (failure.code === "CRM_TAG_NAME_TAKEN" || failure.status === 409) {
        setNameTaken(true);
      } else {
        setServerError(crmTagErrorMessage(failure, errors));
      }
    } finally {
      submitting.current = false;
      setIsSubmitting(false);
    }
  }

  return {
    isEdit: original !== null,
    name,
    color,
    nameError,
    serverError,
    isSubmitting,
    isDirty: !colorValid || (original ? updateBody !== null : trimmed.length > 0 || color !== null),
    // An edit with nothing changed would be `422 CRM_TAG_UPDATE_EMPTY`.
    submitDisabled: !canWrite || !colorValid || isSubmitting || trimmed.length === 0 || (original !== null && updateBody === null),
    maxChars: CRM_TAG_NAME_MAX_LENGTH,
    charCount: [...trimmed].length,
    isPending: () => submitting.current,
    handleNameChange: (next: string) => {
      if (submitting.current) return;
      setName(next);
      setNameTaken(false);
      setServerError(null);
    },
    handleNameBlur: () => setTouched(true),
    handleColorChange: (next: TagColor | null) => {
      if (submitting.current) return;
      setColor(next);
      setServerError(null);
    },
    handleColorValidityChange,
    submit: () => void submit(),
  };
}
