"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import {
  Checkbox,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Input,
  Button,
  Field as FormField,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/design-system";
import type { TenantAccessController } from "../use-tenant-access";
import type { TenantAccessCopy, TenantAccessLocale } from "../copy";
import type {
  BranchRoleAssignmentInput,
  InviteTenantUserInput,
  TenantUserView,
  UpdateTenantUserInput,
} from "../types";

const EMPTY_SELECT_VALUE = "__none__";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type TenantUserEditorField =
  | "firstName"
  | "lastName"
  | "email"
  | "branchId"
  | "departmentId";

type TenantUserEditorErrors = Partial<Record<TenantUserEditorField, string>>;

interface SharedDialogProps {
  controller: TenantAccessController;
  copy: TenantAccessCopy;
  locale: TenantAccessLocale;
  onClose: () => void;
  onSuccess: (message: string) => void;
}

export function TenantUserEditorDialog({
  controller,
  copy,
  locale,
  mode,
  user,
  onClose,
  onSuccess,
}: SharedDialogProps & { mode: "invite" | "edit"; user?: TenantUserView }) {
  const [firstName, setFirstName] = useState(user?.firstName ?? "");
  const [lastName, setLastName] = useState(user?.lastName ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [employeeCode, setEmployeeCode] = useState(user?.employeeCode ?? "");
  const [jobTitle, setJobTitle] = useState(user?.jobTitle ?? "");
  const [branchId, setBranchId] = useState(user?.organization.branch.id ?? "");
  const [departmentId, setDepartmentId] = useState(
    user?.organization.department.id ?? "",
  );
  const [teamId, setTeamId] = useState(user?.organization.team?.id ?? "");
  const [managerId, setManagerId] = useState(user?.manager?.id ?? "");
  const [partyId, setPartyId] = useState("");
  const [roleIds, setRoleIds] = useState<string[]>([]);
  const [fieldErrors, setFieldErrors] = useState<TenantUserEditorErrors>({});
  const branches = controller.branches.data?.items ?? [];
  const departments = controller.departments.data?.items ?? [];
  const teams = controller.teams.data?.items ?? [];
  const roles = controller.roles.data?.items ?? [];
  const selectedBranch = branches.find((branch) => branch.id === branchId);

  useEffect(() => {
    if (branchId) {
      void controller.loadDepartments({ branchId, page: 1, limit: 100 });
    }
    if (departmentId) {
      void controller.loadTeams({ departmentId, page: 1, limit: 100 });
    }
    // Load once for an existing placement. Subsequent changes call explicitly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const clearFieldErrors = (...fields: TenantUserEditorField[]) => {
    setFieldErrors((current) => {
      if (!fields.some((field) => current[field])) return current;
      const next = { ...current };
      fields.forEach((field) => delete next[field]);
      return next;
    });
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const nextErrors: TenantUserEditorErrors = {};
    if (!firstName.trim()) nextErrors.firstName = copy.requiredField;
    if (!lastName.trim()) nextErrors.lastName = copy.requiredField;
    if (mode === "invite" && !EMAIL_PATTERN.test(email.trim())) {
      nextErrors.email = email.trim() ? copy.invalidEmail : copy.requiredField;
    }
    if (mode === "invite" ? !selectedBranch : !branchId) {
      nextErrors.branchId = copy.requiredField;
    }
    if (!departmentId) nextErrors.departmentId = copy.requiredField;
    if (Object.keys(nextErrors).length) {
      setFieldErrors(nextErrors);
      return;
    }
    setFieldErrors({});
    try {
      if (mode === "invite") {
        if (!selectedBranch) return;
        const input: InviteTenantUserInput = {
          email: email.trim().toLowerCase(),
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          companyId: selectedBranch.company.id,
          branchId,
          departmentId,
          ...(employeeCode.trim() ? { employeeCode: employeeCode.trim() } : {}),
          ...(jobTitle.trim() ? { jobTitle: jobTitle.trim() } : {}),
          ...(teamId ? { teamId } : {}),
          ...(managerId.trim() ? { managerId: managerId.trim() } : {}),
          ...(partyId.trim() ? { partyId: partyId.trim() } : {}),
          ...(roleIds.length
            ? {
                roleAssignments: roleIds.map((roleId) => ({ branchId, roleId })),
              }
            : {}),
        };
        await controller.inviteUser(input);
        onSuccess(copy.deliveryQueued);
      } else if (user) {
        const input: UpdateTenantUserInput = changedProfile(user, {
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          employeeCode: employeeCode.trim() || null,
          jobTitle: jobTitle.trim() || null,
          companyId: selectedBranch?.company.id ?? user.organization.company.id,
          branchId,
          departmentId,
          teamId: teamId || null,
          managerId: managerId.trim() || null,
        });
        await controller.updateUser(user, input);
        onSuccess(copy.commandSucceeded);
      }
      onClose();
    } catch {
      // The normalized command error is rendered below and keeps the dialog open.
    }
  };

  return (
    <DialogFrame
      title={mode === "invite" ? copy.invite : copy.edit}
      onClose={onClose}
      locale={locale}
    >
      <form noValidate onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
        <DialogInputField id="tenant-user-first-name" name="firstName" label={copy.firstName} value={firstName} maxLength={80} required error={fieldErrors.firstName} onChange={(value) => { setFirstName(value); clearFieldErrors("firstName"); }} />
        <DialogInputField id="tenant-user-last-name" name="lastName" label={copy.lastName} value={lastName} maxLength={80} required error={fieldErrors.lastName} onChange={(value) => { setLastName(value); clearFieldErrors("lastName"); }} />
        <DialogInputField id="tenant-user-email" name="email" label={copy.email} wide type="email" value={email} maxLength={255} required disabled={mode === "edit"} error={fieldErrors.email} onChange={(value) => { setEmail(value); clearFieldErrors("email"); }} />
        <DialogInputField id="tenant-user-employee-code" name="employeeCode" label={copy.employeeCode} value={employeeCode} maxLength={32} onChange={setEmployeeCode} />
        <DialogInputField id="tenant-user-job-title" name="jobTitle" label={copy.jobTitle} value={jobTitle} maxLength={120} onChange={setJobTitle} />
        <DialogSelectField
          id="tenant-user-branch"
          label={copy.branch}
          required
          value={branchId}
          error={fieldErrors.branchId}
          onValueChange={(next) => {
              setBranchId(next);
              setDepartmentId("");
              setTeamId("");
              setRoleIds([]);
              clearFieldErrors("branchId", "departmentId");
              if (next) void controller.loadDepartments({ branchId: next, page: 1, limit: 100 });
            }}
          options={[
            ...(user && !branches.some((row) => row.id === user.organization.branch.id) ? [[user.organization.branch.id, user.organization.branch.name ?? user.organization.branch.id] as const] : []),
            ...branches.map((branch) => [branch.id, `${branch.company.name} · ${branch.name}`] as const),
          ]}
        />
        <DialogSelectField
          id="tenant-user-department"
          label={copy.department}
          required
          disabled={!branchId}
          value={departmentId}
          error={fieldErrors.departmentId}
          onValueChange={(next) => {
              setDepartmentId(next);
              setTeamId("");
              clearFieldErrors("departmentId");
              if (next) void controller.loadTeams({ departmentId: next, page: 1, limit: 100 });
            }}
          options={[
            ...(user && !departments.some((row) => row.id === user.organization.department.id) ? [[user.organization.department.id, user.organization.department.name ?? user.organization.department.id] as const] : []),
            ...departments.map((department) => [department.id, `${department.code} · ${department.name}`] as const),
          ]}
        />
        <DialogSelectField id="tenant-user-team" label={copy.team} disabled={!departmentId} value={teamId} onValueChange={setTeamId} options={[
          ...(user?.organization.team && !teams.some((row) => row.id === user.organization.team?.id) ? [[user.organization.team.id, user.organization.team.name ?? user.organization.team.id] as const] : []),
          ...teams.map((team) => [team.id, `${team.code} · ${team.name}`] as const),
        ]} />
        <DialogInputField id="tenant-user-manager" name="managerId" label={copy.managerId} value={managerId} onChange={setManagerId} />
        {mode === "invite" ? (
          <DialogInputField id="tenant-user-party" name="partyId" label={copy.partyId} value={partyId} onChange={setPartyId} />
        ) : null}
        {mode === "invite" && controller.permissions.canAssignRoles ? (
          <fieldset className="sm:col-span-2 rounded-lg border border-border p-3">
            <legend className="px-1 text-xs font-semibold text-muted-foreground">{copy.roles}</legend>
            <div className="flex flex-wrap gap-2">
              {roles.map((role) => (
                <label key={role.id} htmlFor={`tenant-user-role-${role.id}`} className="inline-flex min-h-11 items-center gap-2 rounded-md border border-border px-3 py-1 text-xs">
                  <Checkbox
                    id={`tenant-user-role-${role.id}`}
                    name="roleIds"
                    value={role.id}
                    checked={roleIds.includes(role.id)}
                    onCheckedChange={(checked) => setRoleIds((current) => checked === true ? [...current, role.id] : current.filter((id) => id !== role.id))}
                  />
                  {role.name}
                </label>
              ))}
            </div>
          </fieldset>
        ) : null}
        <DialogError
          controller={controller}
          localError={Object.keys(fieldErrors).length ? copy.validationSummary : null}
        />
        <div className="sm:col-span-2 flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>{copy.cancel}</Button>
          <Button type="submit" variant="primary" disabled={controller.command.pending}>{copy.save}</Button>
        </div>
      </form>
    </DialogFrame>
  );
}

export function PasswordDialog({
  controller,
  copy,
  locale,
  user,
  onClose,
  onSuccess,
}: SharedDialogProps & { user: TenantUserView }) {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (password.length < 12 || password !== confirmation) {
      setLocalError(copy.passwordMismatch);
      return;
    }
    setLocalError(null);
    try {
      await controller.changePassword(user, {
        newPassword: password,
        passwordConfirmation: confirmation,
      });
      onSuccess(copy.commandSucceeded);
      onClose();
    } catch {
      // The command error remains visible.
    }
  };
  return (
    <DialogFrame title={copy.changePassword} onClose={onClose} locale={locale}>
      <form method="post" noValidate onSubmit={submit} className="grid gap-3">
        <DialogInputField id="tenant-user-password" name="newPassword" label={copy.password} type="password" minLength={12} maxLength={128} required value={password} error={localError ?? undefined} onChange={(value) => { setPassword(value); setLocalError(null); }} />
        <DialogInputField id="tenant-user-password-confirmation" name="passwordConfirmation" label={copy.passwordConfirmation} type="password" minLength={12} maxLength={128} required value={confirmation} error={localError ?? undefined} onChange={(value) => { setConfirmation(value); setLocalError(null); }} />
        <DialogError controller={controller} localError={localError} summary={copy.validationSummary} />
        <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={onClose}>{copy.cancel}</Button><Button type="submit" variant="primary" disabled={controller.command.pending}>{copy.save}</Button></div>
      </form>
    </DialogFrame>
  );
}

export function RolesDialog({
  controller,
  copy,
  locale,
  user,
  onClose,
  onSuccess,
}: SharedDialogProps & { user: TenantUserView }) {
  const [assignments, setAssignments] = useState<BranchRoleAssignmentInput[]>(() =>
    user.roleAssignments.flatMap((assignment) =>
      assignment.branchId ? [{ branchId: assignment.branchId, roleId: assignment.roleId }] : [],
    ),
  );
  const [branchId, setBranchId] = useState(user.organization.branch.id);
  const [roleId, setRoleId] = useState("");
  const branches = useMemo(
    () => controller.branches.data?.items ?? [],
    [controller.branches.data?.items],
  );
  const roles = useMemo(
    () => controller.roles.data?.items ?? [],
    [controller.roles.data?.items],
  );
  const roleNames = useMemo(() => new Map(roles.map((role) => [role.id, role.name])), [roles]);
  const branchNames = useMemo(() => new Map(branches.map((branch) => [branch.id, branch.name])), [branches]);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    try {
      await controller.replaceRoles(user, { assignments });
      onSuccess(copy.commandSucceeded);
      onClose();
    } catch {
      // The command error remains visible.
    }
  };
  const add = () => {
    if (!branchId || !roleId) return;
    setAssignments((current) =>
      current.some((entry) => entry.branchId === branchId && entry.roleId === roleId)
        ? current
        : [...current, { branchId, roleId }],
    );
  };
  return (
    <DialogFrame title={copy.manageRoles} onClose={onClose} locale={locale}>
      <form onSubmit={submit} className="grid gap-3">
        <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
          <DialogSelectField id="tenant-role-branch" label={copy.branch} value={branchId} onValueChange={setBranchId} options={[
            ...(!branches.some((row) => row.id === user.organization.branch.id) ? [[user.organization.branch.id, user.organization.branch.name ?? user.organization.branch.id] as const] : []),
            ...branches.map((branch) => [branch.id, `${branch.company.name} · ${branch.name}`] as const),
          ]} />
          <DialogSelectField id="tenant-role-role" label={copy.roles} value={roleId} onValueChange={setRoleId} options={roles.map((role) => [role.id, role.name] as const)} />
          <div className="flex items-end"><Button type="button" variant="outline" onClick={add}>{copy.addAssignment}</Button></div>
        </div>
        <div className="divide-y divide-border rounded-lg border border-border">
          {assignments.length ? assignments.map((assignment) => (
            <div key={`${assignment.branchId}:${assignment.roleId}`} className="flex items-center justify-between gap-3 p-2 text-sm">
              <span>{branchNames.get(assignment.branchId) ?? assignment.branchId} · {roleNames.get(assignment.roleId) ?? assignment.roleId}</span>
              <Button type="button" variant="ghost" size="sm" className="text-destructive" onClick={() => setAssignments((current) => current.filter((entry) => entry.branchId !== assignment.branchId || entry.roleId !== assignment.roleId))}>{copy.remove}</Button>
            </div>
          )) : <p className="p-3 text-sm text-muted-foreground">{copy.noAssignments}</p>}
        </div>
        <DialogError controller={controller} />
        <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={onClose}>{copy.cancel}</Button><Button type="submit" variant="primary" disabled={controller.command.pending}>{copy.save}</Button></div>
      </form>
    </DialogFrame>
  );
}

/**
 * Moving the single tenant-owner seat.
 *
 * Both ends are on screen because this is the one action whose consequence is
 * not visible from the button: the reader has to see who is losing the seat as
 * well as who is gaining it. Destinations are the tenant's own active,
 * non-owner, non-deleted users — the same set the server accepts, so a choice
 * offered here cannot be refused there.
 */
export function TransferOwnershipDialog({
  controller,
  copy,
  locale,
  user,
  onClose,
  onSuccess,
}: SharedDialogProps & { user: TenantUserView }) {
  const [newOwnerUserId, setNewOwnerUserId] = useState("");
  const candidates = useMemo(
    () =>
      (controller.directory.data?.items ?? []).filter(
        (candidate: TenantUserView) =>
          candidate.id !== user.id &&
          !candidate.isTenantOwner &&
          candidate.deletedAt === null &&
          candidate.status === "ACTIVE",
      ),
    [controller.directory.data?.items, user.id],
  );
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!newOwnerUserId) return;
    try {
      await controller.transferOwnership(user, newOwnerUserId);
      onSuccess(copy.transferOwnershipSucceeded);
      onClose();
    } catch {
      // The command error remains visible.
    }
  };
  return (
    <DialogFrame title={copy.transferOwnershipTitle} onClose={onClose} locale={locale}>
      <form onSubmit={submit} className="grid gap-3">
        <p className="text-sm leading-6 text-foreground/90">{copy.transferOwnershipHint}</p>
        <div>
          <p className="text-xs font-semibold text-muted-foreground">{copy.currentOwner}</p>
          <p className="mt-1 rounded-lg bg-muted p-2 text-sm font-semibold text-foreground">
            {user.firstName} {user.lastName} · {user.email}
          </p>
        </div>
        {candidates.length ? (
          <DialogSelectField
            id="tenant-owner-transfer-target"
            label={copy.newOwner}
            value={newOwnerUserId}
            onValueChange={setNewOwnerUserId}
            options={[
              ["", copy.newOwnerPlaceholder] as const,
              ...candidates.map(
                (candidate: TenantUserView) =>
                  [
                    candidate.id,
                    `${candidate.firstName} ${candidate.lastName} · ${candidate.email}`,
                  ] as const,
              ),
            ]}
          />
        ) : (
          <p className="rounded-lg bg-warning-subtle p-2 text-sm text-warning-subtle-foreground">
            {copy.transferOwnershipEmpty}
          </p>
        )}
        <DialogError controller={controller} />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>{copy.cancel}</Button>
          <Button
            type="submit"
            variant="primary"
            disabled={controller.command.pending || !newOwnerUserId}
          >
            {copy.transferOwnership}
          </Button>
        </div>
      </form>
    </DialogFrame>
  );
}

export type ConfirmationAction =
  | "reset-password"
  | "resend-invite"
  | "suspend"
  | "activate"
  | "delete"
  | "restore";

export function ConfirmationDialog({
  controller,
  copy,
  locale,
  user,
  action,
  onClose,
  onSuccess,
}: SharedDialogProps & { user: TenantUserView; action: ConfirmationAction }) {
  const definition = {
    "reset-password": [copy.resetPassword, copy.confirmReset],
    "resend-invite": [copy.resendInvite, copy.confirmResend],
    suspend: [copy.suspend, copy.confirmSuspend],
    activate: [copy.activate, copy.confirmActivate],
    delete: [copy.delete, copy.confirmDelete],
    restore: [copy.restore, copy.confirmRestore],
  }[action];
  const confirm = async () => {
    try {
      if (action === "reset-password") await controller.resetPassword(user);
      if (action === "resend-invite") await controller.resendInvite(user);
      if (action === "suspend") await controller.suspendUser(user);
      if (action === "activate") await controller.activateUser(user);
      if (action === "delete") await controller.deleteUser(user);
      if (action === "restore") await controller.restoreUser(user);
      onSuccess(action === "reset-password" || action === "resend-invite" ? copy.deliveryQueued : copy.commandSucceeded);
      onClose();
    } catch {
      // The command error remains visible.
    }
  };
  return (
    <DialogFrame title={definition[0]} onClose={onClose} locale={locale}>
      <p className="text-sm leading-6 text-foreground/90">{definition[1]}</p>
      <p className="mt-2 rounded-lg bg-muted p-2 text-sm font-semibold text-foreground">{user.firstName} {user.lastName} · {user.email}</p>
      <DialogError controller={controller} />
      <div className="mt-5 flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onClose}>{copy.cancel}</Button>
        <Button type="button" variant={action === "delete" ? "destructive" : "primary"} disabled={controller.command.pending} onClick={() => void confirm()}>{copy.confirm}</Button>
      </div>
    </DialogFrame>
  );
}

function DialogFrame({
  title,
  locale,
  onClose,
  children,
}: {
  title: string;
  locale: TenantAccessLocale;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent dir={locale === "ar" ? "rtl" : "ltr"} className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg">{title}</DialogTitle>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}

function DialogInputField({
  id,
  name,
  label,
  value,
  onChange,
  wide = false,
  error,
  ...inputProps
}: {
  id: string;
  name: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  wide?: boolean;
  error?: string;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "id" | "name" | "value" | "onChange">) {
  return (
    <FormField id={id} label={label} required={inputProps.required} error={error} className={wide ? "sm:col-span-2" : undefined}>
      {(field) => (
        <Input
          {...field}
          {...inputProps}
          name={name}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
    </FormField>
  );
}

function DialogSelectField({
  id,
  label,
  value,
  onValueChange,
  options,
  disabled,
  required,
  error,
  wide = false,
}: {
  id: string;
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  options: ReadonlyArray<readonly [string, string]>;
  disabled?: boolean;
  required?: boolean;
  error?: string;
  wide?: boolean;
}) {
  const labelId = `${id}-label`;
  const errorId = error ? `${id}-error` : undefined;
  return (
    <div className={`space-y-1.5 ${wide ? "sm:col-span-2" : ""}`}>
      <span id={labelId} className="text-sm font-medium text-foreground">
        {label}
        {required ? <span className="ms-0.5 text-destructive" aria-hidden="true">*</span> : null}
      </span>
      <Select
        name={id}
        value={value || EMPTY_SELECT_VALUE}
        onValueChange={(next) => onValueChange(next === EMPTY_SELECT_VALUE ? "" : next)}
        disabled={disabled}
      >
        <SelectTrigger
          id={id}
          aria-labelledby={labelId}
          aria-describedby={errorId}
          aria-invalid={Boolean(error)}
          aria-required={required || undefined}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={EMPTY_SELECT_VALUE}>—</SelectItem>
          {options.map(([optionValue, optionLabel]) => (
            <SelectItem key={optionValue} value={optionValue}>{optionLabel}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      {error ? <p id={errorId} role="alert" className="text-xs text-destructive-subtle-foreground">{error}</p> : null}
    </div>
  );
}

function DialogError({ controller, localError, summary }: { controller: TenantAccessController; localError?: string | null; summary?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const message = localError ?? controller.command.error?.message;
  useEffect(() => {
    if (message) ref.current?.focus();
  }, [message]);
  return message ? (
    <div
      ref={ref}
      role="alert"
      tabIndex={-1}
      className="sm:col-span-2 rounded-lg border border-destructive/30 bg-destructive-subtle p-3 text-sm text-destructive-subtle-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {summary ? <p className="font-semibold">{summary}</p> : null}
      {message !== summary ? (
        <p>{message}{controller.command.error?.correlationId ? ` · ${controller.command.error.correlationId}` : ""}</p>
      ) : null}
    </div>
  ) : null;
}

function changedProfile(
  user: TenantUserView,
  candidate: Required<Pick<UpdateTenantUserInput, "firstName" | "lastName" | "companyId" | "branchId" | "departmentId">> &
    Pick<UpdateTenantUserInput, "employeeCode" | "jobTitle" | "teamId" | "managerId">,
): UpdateTenantUserInput {
  const result: UpdateTenantUserInput = {};
  if (candidate.firstName !== user.firstName) result.firstName = candidate.firstName;
  if (candidate.lastName !== user.lastName) result.lastName = candidate.lastName;
  if (candidate.employeeCode !== user.employeeCode) result.employeeCode = candidate.employeeCode;
  if (candidate.jobTitle !== user.jobTitle) result.jobTitle = candidate.jobTitle;
  if (candidate.companyId !== user.organization.company.id) result.companyId = candidate.companyId;
  if (candidate.branchId !== user.organization.branch.id) result.branchId = candidate.branchId;
  if (candidate.departmentId !== user.organization.department.id) result.departmentId = candidate.departmentId;
  if (candidate.teamId !== (user.organization.team?.id ?? null)) result.teamId = candidate.teamId;
  if (candidate.managerId !== (user.manager?.id ?? null)) result.managerId = candidate.managerId;
  return result;
}
