"use client";

import { Field, FormModal, Input } from "@/design-system";
import { UserRound } from "lucide-react";
import {
  USER_EMAIL_MAX_LENGTH,
  USER_EMPLOYEE_CODE_MAX_LENGTH,
  USER_JOB_TITLE_MAX_LENGTH,
  USER_NAME_MAX_LENGTH,
} from "../../contracts/user-contract";
import { useUserFormModal } from "../hooks/useUserFormModal";
import type { UserFormValues } from "../user-payloads";
import { UserPlacementFields } from "./UserPlacementFields";

export type { UserFormValues } from "../user-payloads";

interface UserFormDrawerProps {
  mode: "invite" | "edit";
  isOpen: boolean;
  initial: UserFormValues;
  onClose: () => void;
  onSubmit: (values: UserFormValues) => Promise<boolean>;
  isSubmitting: boolean;
  error?: string;
}

/**
 * Centered modal (`FormModal` `size="wide"`) for `POST /users` (invite) and
 * `PATCH /users/:id` (edit), without side rails.
 */
export function UserFormDrawer({
  mode,
  isOpen,
  initial,
  onClose,
  onSubmit,
  isSubmitting,
  error,
}: UserFormDrawerProps) {
  const form = useUserFormModal({ mode, isOpen, initial, onClose, onSubmit });
  const { t, copy, values } = form;

  return (
    <FormModal
      open={isOpen}
      onOpenChange={form.handleOpenChange}
      size="wide"
      headerIcon={<span className="flex size-10 items-center justify-center rounded-md border border-primary/20 bg-primary/5 text-primary"><UserRound className="size-5" aria-hidden="true" /></span>}
      title={mode === "invite" ? copy.users.inviteTitle : copy.users.editTitle}
      description={
        mode === "invite"
          ? copy.users.inviteDescription
          : copy.users.editDescription
      }
      isDirty={form.isDirty}
      isSubmitting={isSubmitting}
      submitDisabled={!form.valid}
      onSubmit={() => void form.handleSubmit()}
      error={error}
      labels={{
        submit: mode === "invite" ? copy.users.inviteSubmit : t.common.save,
        cancel: t.common.cancel,
        close: copy.actions.close,
        discardTitle: t.common.discardTitle,
        discardDescription: t.common.discardDescription,
        discardConfirm: t.common.discardConfirm,
        discardCancel: t.common.cancel,
        sections: t.common.general,
        sectionInvalid: copy.errors.UNKNOWN,
      }}
    >
      <div className="flex flex-col gap-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field
            label={copy.users.firstName}
            error={form.firstNameValidation.error}
            showLabel
            required
          >
            <Input
              size="sm"
              placeholder={copy.users.firstName}
              value={values.firstName}
              onChange={(event) => form.patchValues({ firstName: event.target.value })}
              onBlur={form.firstNameValidation.fieldProps.onBlur}
              maxLength={USER_NAME_MAX_LENGTH}
              disabled={isSubmitting}
              required
            />
          </Field>

          <Field
            label={copy.users.lastName}
            error={form.lastNameValidation.error}
            showLabel
            required
          >
            <Input
              size="sm"
              placeholder={copy.users.lastName}
              value={values.lastName}
              onChange={(event) => form.patchValues({ lastName: event.target.value })}
              onBlur={form.lastNameValidation.fieldProps.onBlur}
              maxLength={USER_NAME_MAX_LENGTH}
              disabled={isSubmitting}
              required
            />
          </Field>

          <div className="sm:col-span-2">
            {mode === "invite" ? (
              <Field
                label={copy.users.email}
                hint={copy.users.emailHint}
                error={form.emailValidation.error}
                showLabel
                required
              >
                <Input
                  size="sm"
                  type="email"
                  dir="ltr"
                  placeholder="name@company.com"
                  value={values.email}
                  onChange={(event) => form.patchValues({ email: event.target.value })}
                  onBlur={form.emailValidation.fieldProps.onBlur}
                  maxLength={USER_EMAIL_MAX_LENGTH}
                  disabled={isSubmitting}
                  required
                />
              </Field>
            ) : (
              <Field
                label={copy.users.email}
                hint={copy.users.emailFixed}
                showLabel
                readOnly
              >
                <Input
                  size="sm"
                  type="email"
                  dir="ltr"
                  value={values.email}
                  readOnly
                />
              </Field>
            )}
          </div>

          <Field
            label={copy.users.employeeCode}
            error={form.employeeCodeValidation.error}
            showLabel
          >
            <Input
              size="sm"
              dir="ltr"
              placeholder={copy.users.employeeCode}
              value={values.employeeCode}
              onChange={(event) =>
                form.patchValues({ employeeCode: event.target.value })
              }
              onBlur={form.employeeCodeValidation.fieldProps.onBlur}
              maxLength={USER_EMPLOYEE_CODE_MAX_LENGTH}
              disabled={isSubmitting}
            />
          </Field>

          <Field label={copy.users.jobTitle} showLabel>
            <Input
              size="sm"
              placeholder={copy.users.jobTitle}
              value={values.jobTitle}
              onChange={(event) => form.patchValues({ jobTitle: event.target.value })}
              maxLength={USER_JOB_TITLE_MAX_LENGTH}
              disabled={isSubmitting}
            />
          </Field>
        </div>

        <h3 className="border-b border-border pb-2 text-sm font-medium text-foreground">{copy.detail.placement}</h3>
        <UserPlacementFields
          values={values}
          cascade={form.cascade}
          users={form.users}
          canReadUsers={form.canReadUsers}
          isSubmitting={isSubmitting}
          companyError={
            form.submitAttempted && !values.companyId
              ? copy.cascade.chooseCompanyFirst
              : undefined
          }
          branchError={
            form.submitAttempted && !values.branchId
              ? copy.cascade.chooseBranchFirst
              : undefined
          }
          departmentError={
            form.submitAttempted && !values.departmentId
              ? copy.cascade.chooseDepartmentFirst
              : undefined
          }
          onManagerChange={(managerId) => form.patchValues({ managerId })}
        />
      </div>
    </FormModal>
  );
}
