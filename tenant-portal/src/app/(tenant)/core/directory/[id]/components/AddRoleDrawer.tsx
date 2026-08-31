"use client";

import { useState } from "react";
import {
  Field,
  FormDrawer,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { PARTY_ROLE_TYPES } from "../../directory-children-contract";
import { EMPTY_ROLE_FORM, type RoleFormValues } from "../../party-child-forms";

interface AddRoleDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (values: RoleFormValues) => Promise<boolean>;
  isSubmitting: boolean;
  error: string | null;
  /** Roles already held; re-assigning one is refused as `PARTY_ROLE_ALREADY_EXISTS`. */
  assignedRoleTypes: string[];
}

export function AddRoleDrawer({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting,
  error,
  assignedRoleTypes,
}: AddRoleDrawerProps) {
  const { t } = useI18n();
  const copy = t.coreOperations.directory;
  const [values, setValues] = useState<RoleFormValues>(EMPTY_ROLE_FORM);

  return (
    <FormDrawer
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={copy.roleCreateTitle}
      description={copy.roleDescription}
      isDirty={values.roleType !== EMPTY_ROLE_FORM.roleType}
      isSubmitting={isSubmitting}
      onSubmit={() => void onSubmit(values)}
      error={error ?? undefined}
      submitDisabled={assignedRoleTypes.includes(values.roleType)}
      labels={{
        submit: t.common.save,
        cancel: t.common.cancel,
        discardTitle: t.common.discardTitle,
        discardDescription: t.common.discardDescription,
        discardConfirm: t.common.discardConfirm,
        discardCancel: t.common.cancel,
      }}
    >
      <Field
        label={copy.roleType}
        hint={copy.roleTenantWideHint}
        error={assignedRoleTypes.includes(values.roleType) ? copy.roleAlreadyAssigned : undefined}
        required
      >
        <Select
          value={values.roleType}
          onValueChange={(value) =>
            setValues({ roleType: value as RoleFormValues["roleType"] })
          }
          disabled={isSubmitting}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PARTY_ROLE_TYPES.map((role) => (
              <SelectItem key={role} value={role} disabled={assignedRoleTypes.includes(role)}>
                {copy.roleTypes[role]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
    </FormDrawer>
  );
}
