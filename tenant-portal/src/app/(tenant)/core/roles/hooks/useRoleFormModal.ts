"use client";

import { useCallback, useState, type ChangeEvent } from "react";
import { useI18n } from "@/i18n/I18nContext";
import { formatNumber } from "@/lib/format/number";
import {
  ROLE_DESCRIPTION_MAX_LENGTH,
  ROLE_NAME_MAX_LENGTH,
} from "../../contracts/role-contract";

export interface RoleFormValues {
  name: string;
  description: string;
}

interface UseRoleFormModalOptions {
  mode: "create" | "edit";
  initial: RoleFormValues;
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (body: { name: string; description?: string }) => Promise<boolean>;
}

/**
 * State, validation, and DTO payload assembly for `RoleFormModal`.
 *
 * `CreateTenantRoleDto` omits blank descriptions, while `UpdateTenantRoleDto`
 * sends an empty string when clearing a previously stored description so an
 * omitted field is not mistaken for "keep existing text".
 */
export function useRoleFormModal({
  mode,
  initial,
  isSubmitting,
  onClose,
  onSubmit,
}: UseRoleFormModalOptions) {
  const { t, lang } = useI18n();
  const [values, setValues] = useState<RoleFormValues>(initial);
  const [touchedName, setTouchedName] = useState(false);

  const trimmedName = values.name.trim();
  const trimmedDescription = values.description.trim();
  const initialTrimmedName = initial.name.trim();
  const initialTrimmedDescription = initial.description.trim();

  const isDirty = values.name !== initial.name || values.description !== initial.description;
  const hasEffectiveChange =
    mode === "create"
      ? trimmedName.length > 0
      : trimmedName !== initialTrimmedName || trimmedDescription !== initialTrimmedDescription;
  const isLengthInvalid =
    trimmedName.length > ROLE_NAME_MAX_LENGTH ||
    trimmedDescription.length > ROLE_DESCRIPTION_MAX_LENGTH;
  const nameError =
    touchedName && trimmedName.length === 0 ? t.coreIdentity.roleBranch.nameRequired : undefined;
  const submitDisabled = trimmedName.length === 0 || isLengthInvalid || !hasEffectiveChange;

  const nameHint = `${formatNumber(values.name.length, lang)} / ${formatNumber(ROLE_NAME_MAX_LENGTH, lang)}`;
  const descriptionHint = `${formatNumber(values.description.length, lang)} / ${formatNumber(ROLE_DESCRIPTION_MAX_LENGTH, lang)}`;

  const handleNameChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const nextName = event.target.value;
    setValues((current) => ({ ...current, name: nextName }));
  }, []);

  const handleDescriptionChange = useCallback((event: ChangeEvent<HTMLTextAreaElement>) => {
    const nextDescription = event.target.value;
    setValues((current) => ({ ...current, description: nextDescription }));
  }, []);

  const handleNameBlur = useCallback(() => {
    setTouchedName(true);
  }, []);

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (open) return;
      setValues(initial);
      setTouchedName(false);
      onClose();
    },
    [initial, onClose],
  );

  const handleSubmit = useCallback(() => {
    setTouchedName(true);
    if (submitDisabled || isSubmitting) return;

    const shouldSendDescription =
      mode === "create"
        ? trimmedDescription.length > 0
        : trimmedDescription.length > 0 || initialTrimmedDescription.length > 0;

    void onSubmit({
      name: trimmedName,
      ...(shouldSendDescription ? { description: trimmedDescription } : {}),
    });
  }, [
    initialTrimmedDescription.length,
    isSubmitting,
    mode,
    onSubmit,
    submitDisabled,
    trimmedDescription,
    trimmedName,
  ]);

  return {
    t,
    values,
    isDirty,
    nameError,
    nameHint,
    descriptionHint,
    submitDisabled,
    handleNameChange,
    handleDescriptionChange,
    handleNameBlur,
    handleOpenChange,
    handleSubmit,
  };
}
