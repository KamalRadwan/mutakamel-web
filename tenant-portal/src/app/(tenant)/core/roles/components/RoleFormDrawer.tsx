"use client";

import { Info, ShieldCheck } from "lucide-react";
import { Field, FormModal, Input, Textarea } from "@/design-system";
import {
  ROLE_DESCRIPTION_MAX_LENGTH,
  ROLE_NAME_MAX_LENGTH,
} from "../../contracts/role-contract";
import { useRoleFormModal, type RoleFormValues } from "../hooks/useRoleFormModal";

interface RoleFormModalProps {
  mode: "create" | "edit";
  isOpen: boolean;
  /** Seeds the form; callers pass a stable `key` so each session starts cleanly. */
  initial: RoleFormValues;
  title: string;
  description: string;
  onClose: () => void;
  onSubmit: (body: { name: string; description?: string }) => Promise<boolean>;
  isSubmitting: boolean;
  error?: string;
}

/** Centered modal markup for `POST /roles` and `PATCH /roles/:id` without section rails. */
export function RoleFormModal({
  mode,
  isOpen,
  initial,
  title,
  description,
  onClose,
  onSubmit,
  isSubmitting,
  error,
}: RoleFormModalProps) {
  const form = useRoleFormModal({
    mode,
    initial,
    isSubmitting,
    onClose,
    onSubmit,
  });
  const { t } = form;
  const copy = t.coreIdentity.roles;
  const branchCopy = t.coreIdentity.roleBranch;

  return (
    <FormModal
      open={isOpen}
      onOpenChange={form.handleOpenChange}
      size="card"
      headerIcon={
        <span className="flex size-10 items-center justify-center rounded-md border border-primary/20 bg-primary/5 text-primary">
          <ShieldCheck className="size-5" aria-hidden="true" />
        </span>
      }
      title={title}
      description={description}
      isDirty={form.isDirty}
      isSubmitting={isSubmitting}
      submitDisabled={form.submitDisabled}
      onSubmit={form.handleSubmit}
      error={error}
      labels={{
        submit: mode === "create" ? copy.create : t.common.save,
        cancel: t.common.cancel,
        discardTitle: t.common.discardTitle,
        discardDescription: t.common.discardDescription,
        discardConfirm: t.common.discardConfirm,
        discardCancel: t.common.cancel,
        sections: t.common.general,
        sectionInvalid: t.coreIdentity.errors.UNKNOWN,
        close: t.coreIdentity.actions.close,
      }}
    >
      <div className="flex flex-col gap-4">
        <Field
          label={copy.name}
          required
          showLabel
          error={form.nameError}
          hint={form.nameHint}
        >
          <Input
            size="sm"
            placeholder={copy.name}
            value={form.values.name}
            onChange={form.handleNameChange}
            onBlur={form.handleNameBlur}
            maxLength={ROLE_NAME_MAX_LENGTH}
            disabled={isSubmitting}
            required
          />
        </Field>
        <Field label={copy.description} showLabel hint={form.descriptionHint}>
          <Textarea
            placeholder={copy.description}
            value={form.values.description}
            onChange={form.handleDescriptionChange}
            maxLength={ROLE_DESCRIPTION_MAX_LENGTH}
            disabled={isSubmitting}
            rows={4}
          />
        </Field>
        <p className="flex items-center gap-2 rounded-md bg-info-subtle px-3 py-2 text-xs text-info-subtle-foreground">
          <Info className="size-3.5 shrink-0" aria-hidden="true" />
          <span>{mode === "create" ? branchCopy.createHint : branchCopy.renameHint}</span>
        </p>
      </div>
    </FormModal>
  );
}
