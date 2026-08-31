"use client";

import { useState } from "react";
import { Field, FormDrawer, Input, Textarea } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import {
  ROLE_DESCRIPTION_MAX_LENGTH,
  ROLE_NAME_MAX_LENGTH,
} from "../../contracts/role-contract";

export interface RoleFormValues {
  name: string;
  description: string;
}

interface RoleFormDrawerProps {
  isOpen: boolean;
  /** Seeds the form; identity-stable so the caller remounts with a `key`. */
  initial: RoleFormValues;
  title: string;
  description: string;
  onClose: () => void;
  onSubmit: (body: { name: string; description?: string }) => Promise<boolean>;
  isSubmitting: boolean;
  error?: string;
}

/**
 * One drawer for `POST /roles` and `PATCH /roles/:id` — both DTOs carry exactly
 * `name` and `description`, and `CreateTenantRoleDto.permissionIds` is left to
 * the permission editor rather than duplicated as a 200-checkbox list here.
 */
export function RoleFormDrawer({
  isOpen,
  initial,
  title,
  description,
  onClose,
  onSubmit,
  isSubmitting,
  error,
}: RoleFormDrawerProps) {
  const { t } = useI18n();
  const copy = t.coreIdentity.roles;
  const [values, setValues] = useState<RoleFormValues>(initial);

  async function handleSubmit() {
    const trimmedDescription = values.description.trim();
    await onSubmit({
      name: values.name.trim(),
      description: trimmedDescription.length > 0 ? trimmedDescription : undefined,
    });
  }

  return (
    <FormDrawer
      open={isOpen}
      onOpenChange={(open) => {
        if (open) return;
        setValues(initial);
        onClose();
      }}
      title={title}
      description={description}
      isDirty={values.name !== initial.name || values.description !== initial.description}
      isSubmitting={isSubmitting}
      submitDisabled={values.name.trim().length === 0}
      onSubmit={() => void handleSubmit()}
      error={error}
      labels={{
        submit: t.common.save,
        cancel: t.common.cancel,
        discardTitle: t.common.discardTitle,
        discardDescription: t.common.discardDescription,
        discardConfirm: t.common.discardConfirm,
        discardCancel: t.common.cancel,
      }}
    >
      <div className="flex flex-col gap-4">
        <Field label={copy.name} required>
          <Input
            value={values.name}
            onChange={(event) => setValues((current) => ({ ...current, name: event.target.value }))}
            maxLength={ROLE_NAME_MAX_LENGTH}
            disabled={isSubmitting}
            required
          />
        </Field>
        <Field label={copy.description}>
          <Textarea
            value={values.description}
            onChange={(event) =>
              setValues((current) => ({ ...current, description: event.target.value }))
            }
            maxLength={ROLE_DESCRIPTION_MAX_LENGTH}
            disabled={isSubmitting}
            rows={3}
          />
        </Field>
      </div>
    </FormDrawer>
  );
}
