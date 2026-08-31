"use client";

import { useState } from "react";
import { Combobox, Field, FormDrawer, Input } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import {
  USER_EMAIL_MAX_LENGTH,
  USER_EMPLOYEE_CODE_MAX_LENGTH,
  USER_JOB_TITLE_MAX_LENGTH,
  USER_NAME_MAX_LENGTH,
} from "../../contracts/user-contract";
import { useOrgNodeOptions, useTenantUserOptions } from "../../hooks/useCoreOptions";

interface UserFormDrawerProps {
  isOpen: boolean;
  /**
   * Invite sends `CreateTenantUserDto`; edit sends `UpdateTenantUserDto`, which
   * carries **no `email`** — the address is fixed at invite time.
   */
  mode: "invite" | "edit";
  initial?: Partial<UserFormValues>;
  onClose: () => void;
  /**
   * Receives the trimmed form values, not a DTO. Invite and edit send different
   * bodies — `UpdateTenantUserDto` has no `email` and Core rejects unknown keys
   * — so each caller maps these to the shape its own route declares.
   */
  onSubmit: (values: UserFormValues) => Promise<boolean>;
  isSubmitting: boolean;
  error?: string;
}

export interface UserFormValues {
  email: string;
  firstName: string;
  lastName: string;
  companyId: string;
  branchId: string;
  departmentId: string;
  teamId: string;
  managerId: string;
  employeeCode: string;
  jobTitle: string;
}

const EMPTY: UserFormValues = {
  email: "",
  firstName: "",
  lastName: "",
  companyId: "",
  branchId: "",
  departmentId: "",
  teamId: "",
  managerId: "",
  employeeCode: "",
  jobTitle: "",
};

export function UserFormDrawer({
  isOpen,
  mode,
  initial,
  onClose,
  onSubmit,
  isSubmitting,
  error,
}: UserFormDrawerProps) {
  const { t } = useI18n();
  const copy = t.coreIdentity;
  const seed: UserFormValues = { ...EMPTY, ...initial };
  const [form, setForm] = useState<UserFormValues>(seed);
  const patch = (next: Partial<UserFormValues>) => setForm((current) => ({ ...current, ...next }));
  const isInvite = mode === "invite";

  // The placement cascade mirrors the DTO: companyId, branchId and departmentId
  // are all required, and each level filters the next.
  const companies = useOrgNodeOptions("companies");
  const branches = useOrgNodeOptions("branches", { parentId: form.companyId || undefined });
  const departments = useOrgNodeOptions("departments", { parentId: form.branchId || undefined });
  const teams = useOrgNodeOptions("teams", { parentId: form.departmentId || undefined });
  const managers = useTenantUserOptions();

  const isDirty = JSON.stringify(form) !== JSON.stringify(seed);
  const canSubmit =
    (!isInvite || form.email.trim().length > 0) &&
    form.firstName.trim().length > 0 &&
    form.lastName.trim().length > 0 &&
    form.companyId.length > 0 &&
    form.branchId.length > 0 &&
    form.departmentId.length > 0;

  const pickerLabels = {
    placeholder: copy.picker.placeholder,
    searchPlaceholder: copy.picker.searchPlaceholder,
    loadingLabel: copy.picker.loading,
    emptyLabel: copy.picker.empty,
  };

  async function handleSubmit() {
    const saved = await onSubmit({
      email: form.email.trim().toLowerCase(),
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      companyId: form.companyId,
      branchId: form.branchId,
      departmentId: form.departmentId,
      teamId: form.teamId,
      managerId: form.managerId,
      employeeCode: form.employeeCode.trim(),
      jobTitle: form.jobTitle.trim(),
    });
    if (saved) setForm(seed);
  }

  return (
    <FormDrawer
      open={isOpen}
      onOpenChange={(open) => {
        if (open) return;
        setForm(seed);
        onClose();
      }}
      title={isInvite ? copy.users.inviteTitle : copy.users.editTitle}
      description={isInvite ? copy.users.inviteDescription : copy.users.editDescription}
      isDirty={isDirty}
      isSubmitting={isSubmitting}
      submitDisabled={!canSubmit}
      onSubmit={() => void handleSubmit()}
      error={error}
      labels={{
        submit: isInvite ? copy.users.inviteSubmit : t.common.save,
        cancel: t.common.cancel,
        discardTitle: t.common.discardTitle,
        discardDescription: t.common.discardDescription,
        discardConfirm: t.common.discardConfirm,
        discardCancel: t.common.cancel,
      }}
    >
      <div className="flex flex-col gap-4">
        {/* `UpdateTenantUserDto` has no `email` key and the pipe runs
            forbidNonWhitelisted, so sending one on edit is a 400 — the field is
            read-only rather than absent, so the reader still sees the address. */}
        <Field
          label={copy.users.email}
          hint={isInvite ? copy.users.emailHint : copy.users.emailFixed}
          readOnly={!isInvite}
          required={isInvite}
        >
          <Input
            type="email"
            dir="ltr"
            value={form.email}
            onChange={(event) => patch({ email: event.target.value })}
            maxLength={USER_EMAIL_MAX_LENGTH}
            disabled={isSubmitting}
            readOnly={!isInvite}
            required={isInvite}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={copy.users.firstName} required>
            <Input
              value={form.firstName}
              onChange={(event) => patch({ firstName: event.target.value })}
              maxLength={USER_NAME_MAX_LENGTH}
              disabled={isSubmitting}
              required
            />
          </Field>
          <Field label={copy.users.lastName} required>
            <Input
              value={form.lastName}
              onChange={(event) => patch({ lastName: event.target.value })}
              maxLength={USER_NAME_MAX_LENGTH}
              disabled={isSubmitting}
              required
            />
          </Field>
        </div>

        <Field label={copy.levels.companies.parentLabel} required>
          <Combobox
            {...pickerLabels}
            value={form.companyId || undefined}
            selectedLabel={companies.labelFor(form.companyId)}
            onValueChange={(next) =>
              patch({ companyId: next ?? "", branchId: "", departmentId: "", teamId: "" })
            }
            options={companies.options}
            onSearch={companies.search}
            loading={companies.isLoading}
            disabled={isSubmitting}
          />
        </Field>

        <Field label={copy.levels.branches.parentLabel} hint={copy.users.branchHint} required>
          <Combobox
            {...pickerLabels}
            value={form.branchId || undefined}
            selectedLabel={branches.labelFor(form.branchId)}
            onValueChange={(next) => patch({ branchId: next ?? "", departmentId: "", teamId: "" })}
            options={branches.options}
            onSearch={branches.search}
            loading={branches.isLoading}
            disabled={isSubmitting || form.companyId.length === 0}
          />
        </Field>

        <Field label={copy.levels.departments.parentLabel} required>
          <Combobox
            {...pickerLabels}
            value={form.departmentId || undefined}
            selectedLabel={departments.labelFor(form.departmentId)}
            onValueChange={(next) => patch({ departmentId: next ?? "", teamId: "" })}
            options={departments.options}
            onSearch={departments.search}
            loading={departments.isLoading}
            disabled={isSubmitting || form.branchId.length === 0}
          />
        </Field>

        <Field label={copy.levels.teams.parentLabel}>
          <Combobox
            {...pickerLabels}
            clearLabel={copy.picker.clear}
            value={form.teamId || undefined}
            selectedLabel={teams.labelFor(form.teamId)}
            onValueChange={(next) => patch({ teamId: next ?? "" })}
            options={teams.options}
            onSearch={teams.search}
            loading={teams.isLoading}
            disabled={isSubmitting || form.departmentId.length === 0}
          />
        </Field>

        <Field label={copy.users.manager}>
          <Combobox
            {...pickerLabels}
            clearLabel={copy.picker.clear}
            value={form.managerId || undefined}
            selectedLabel={managers.labelFor(form.managerId)}
            onValueChange={(next) => patch({ managerId: next ?? "" })}
            options={managers.options}
            onSearch={managers.search}
            loading={managers.isLoading}
            disabled={isSubmitting}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={copy.users.employeeCode}>
            <Input
              dir="ltr"
              value={form.employeeCode}
              onChange={(event) => patch({ employeeCode: event.target.value })}
              maxLength={USER_EMPLOYEE_CODE_MAX_LENGTH}
              disabled={isSubmitting}
            />
          </Field>
          <Field label={copy.users.jobTitle}>
            <Input
              value={form.jobTitle}
              onChange={(event) => patch({ jobTitle: event.target.value })}
              maxLength={USER_JOB_TITLE_MAX_LENGTH}
              disabled={isSubmitting}
            />
          </Field>
        </div>
      </div>
    </FormDrawer>
  );
}
