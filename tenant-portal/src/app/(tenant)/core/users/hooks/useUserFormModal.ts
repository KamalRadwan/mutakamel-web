"use client";

import { useCallback, useState } from "react";
import { useBlurValidation } from "@/design-system";
import { useTenantAuth } from "@/context/AuthContext";
import { useI18n } from "@/i18n/I18nContext";
import { can } from "@/lib/auth/permission-scope";
import { useTenantUserOptions } from "../../hooks/useCoreOptions";
import { useOrganizationCascade } from "../../hooks/useOrganizationCascade";
import {
  EMPLOYEE_CODE_PATTERN,
  isUserFormValid,
  USER_EMAIL_PATTERN,
  type UserFormValues,
} from "../user-payloads";

interface UseUserFormModalOptions {
  mode: "invite" | "edit";
  isOpen: boolean;
  initial: UserFormValues;
  onClose: () => void;
  onSubmit: (values: UserFormValues) => Promise<boolean>;
}

/**
 * Owns draft state, workplace cascade (`companyId -> branchId -> departmentId
 * -> optional teamId`), blur validation, dirty guard, and failure-safe submit
 * handling for `UserFormDrawer`.
 */
export function useUserFormModal({
  mode,
  isOpen,
  initial,
  onClose,
  onSubmit,
}: UseUserFormModalOptions) {
  const { t } = useI18n();
  const copy = t.coreIdentity;
  const { user: actor } = useTenantAuth();
  const canReadUsers = can(actor, "users.user.read");

  const [values, setValues] = useState<UserFormValues>(initial);
  const [submitAttempted, setSubmitAttempted] = useState(false);

  const patchValues = useCallback((next: Partial<UserFormValues>) => {
    setValues((current) => ({ ...current, ...next }));
  }, []);

  const cascade = useOrganizationCascade({
    enabled: isOpen,
    companyId: values.companyId,
    branchId: values.branchId,
    departmentId: values.departmentId,
    teamId: values.teamId,
    includeBranches: true,
    includeDepartments: true,
    includeTeams: true,
    autoSelectTeams: false,
    onChange: patchValues,
  });

  const users = useTenantUserOptions(isOpen && canReadUsers);

  const emailValidation = useBlurValidation(values.email, (raw) => {
    if (mode !== "invite") return undefined;
    const trimmed = raw.trim();
    if (trimmed.length === 0 || !USER_EMAIL_PATTERN.test(trimmed)) {
      return copy.users.emailHint;
    }
    return undefined;
  });

  const firstNameValidation = useBlurValidation(values.firstName, (raw) =>
    raw.trim().length === 0 ? copy.users.firstName : undefined,
  );

  const lastNameValidation = useBlurValidation(values.lastName, (raw) =>
    raw.trim().length === 0 ? copy.users.lastName : undefined,
  );

  const employeeCodeValidation = useBlurValidation(values.employeeCode, (raw) => {
    const trimmed = raw.trim();
    if (trimmed.length === 0) return undefined;
    return EMPLOYEE_CODE_PATTERN.test(trimmed) ? undefined : copy.fields.codeHint;
  });

  const isDirty = (Object.keys(initial) as Array<keyof UserFormValues>).some(
    (key) => values[key] !== initial[key],
  );

  const valid = isUserFormValid(mode, values);

  const handleSubmit = useCallback(async () => {
    setSubmitAttempted(true);
    emailValidation.reveal();
    firstNameValidation.reveal();
    lastNameValidation.reveal();
    employeeCodeValidation.reveal();
    if (!valid) return;
    await onSubmit(values);
  }, [
    emailValidation,
    employeeCodeValidation,
    firstNameValidation,
    lastNameValidation,
    onSubmit,
    valid,
    values,
  ]);

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (open) return;
      setValues(initial);
      setSubmitAttempted(false);
      onClose();
    },
    [initial, onClose],
  );

  return {
    t,
    copy,
    values,
    patchValues,
    cascade,
    users,
    canReadUsers,
    emailValidation,
    firstNameValidation,
    lastNameValidation,
    employeeCodeValidation,
    submitAttempted,
    isDirty,
    valid,
    handleSubmit,
    handleOpenChange,
  };
}
