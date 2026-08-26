"use client";

import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import type { TenantAccessController } from "../use-tenant-access";
import type { TenantAccessCopy, TenantAccessLocale } from "../copy";
import type {
  BranchRoleAssignmentInput,
  InviteTenantUserInput,
  TenantUserView,
  UpdateTenantUserInput,
  UpdateTenantUserWebphoneInput,
} from "../types";

const inputClass =
  "h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-100";
const primaryClass =
  "inline-flex h-9 items-center justify-center rounded-lg bg-indigo-600 px-4 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50";
const secondaryClass =
  "inline-flex h-9 items-center justify-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50";

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
  const [localError, setLocalError] = useState<string | null>(null);
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

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setLocalError(null);
    try {
      if (mode === "invite") {
        if (!selectedBranch || !departmentId) {
          setLocalError("Organization placement is required.");
          return;
        }
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
      <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
        <Field label={copy.firstName}>
          <input className={inputClass} value={firstName} maxLength={80} required onChange={(event) => setFirstName(event.target.value)} />
        </Field>
        <Field label={copy.lastName}>
          <input className={inputClass} value={lastName} maxLength={80} required onChange={(event) => setLastName(event.target.value)} />
        </Field>
        <Field label={copy.email} wide>
          <input className={inputClass} type="email" value={email} maxLength={255} required disabled={mode === "edit"} onChange={(event) => setEmail(event.target.value)} />
        </Field>
        <Field label={copy.employeeCode}>
          <input className={inputClass} value={employeeCode} maxLength={32} onChange={(event) => setEmployeeCode(event.target.value)} />
        </Field>
        <Field label={copy.jobTitle}>
          <input className={inputClass} value={jobTitle} maxLength={120} onChange={(event) => setJobTitle(event.target.value)} />
        </Field>
        <Field label={copy.branch}>
          <select
            className={inputClass}
            required
            value={branchId}
            onChange={(event) => {
              const next = event.target.value;
              setBranchId(next);
              setDepartmentId("");
              setTeamId("");
              setRoleIds([]);
              if (next) void controller.loadDepartments({ branchId: next, page: 1, limit: 100 });
            }}
          >
            <option value="">—</option>
            {user && !branches.some((row) => row.id === user.organization.branch.id) ? (
              <option value={user.organization.branch.id}>{user.organization.branch.name ?? user.organization.branch.id}</option>
            ) : null}
            {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.company.name} · {branch.name}</option>)}
          </select>
        </Field>
        <Field label={copy.department}>
          <select
            className={inputClass}
            required
            disabled={!branchId}
            value={departmentId}
            onChange={(event) => {
              const next = event.target.value;
              setDepartmentId(next);
              setTeamId("");
              if (next) void controller.loadTeams({ departmentId: next, page: 1, limit: 100 });
            }}
          >
            <option value="">—</option>
            {user && !departments.some((row) => row.id === user.organization.department.id) ? (
              <option value={user.organization.department.id}>{user.organization.department.name ?? user.organization.department.id}</option>
            ) : null}
            {departments.map((department) => <option key={department.id} value={department.id}>{department.code} · {department.name}</option>)}
          </select>
        </Field>
        <Field label={copy.team}>
          <select className={inputClass} disabled={!departmentId} value={teamId} onChange={(event) => setTeamId(event.target.value)}>
            <option value="">—</option>
            {user?.organization.team && !teams.some((row) => row.id === user.organization.team?.id) ? (
              <option value={user.organization.team.id}>{user.organization.team.name ?? user.organization.team.id}</option>
            ) : null}
            {teams.map((team) => <option key={team.id} value={team.id}>{team.code} · {team.name}</option>)}
          </select>
        </Field>
        <Field label={copy.managerId}>
          <input className={inputClass} value={managerId} onChange={(event) => setManagerId(event.target.value)} />
        </Field>
        {mode === "invite" ? (
          <Field label={copy.partyId}>
            <input className={inputClass} value={partyId} onChange={(event) => setPartyId(event.target.value)} />
          </Field>
        ) : null}
        {mode === "invite" && controller.permissions.canAssignRoles ? (
          <fieldset className="sm:col-span-2 rounded-lg border border-slate-200 p-3">
            <legend className="px-1 text-xs font-semibold text-slate-600">{copy.roles}</legend>
            <div className="flex flex-wrap gap-2">
              {roles.map((role) => (
                <label key={role.id} className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1 text-xs">
                  <input
                    type="checkbox"
                    checked={roleIds.includes(role.id)}
                    onChange={(event) => setRoleIds((current) => event.target.checked ? [...current, role.id] : current.filter((id) => id !== role.id))}
                  />
                  {role.name}
                </label>
              ))}
            </div>
          </fieldset>
        ) : null}
        <DialogError controller={controller} localError={localError} />
        <div className="sm:col-span-2 flex justify-end gap-2 pt-2">
          <button type="button" className={secondaryClass} onClick={onClose}>{copy.cancel}</button>
          <button type="submit" className={primaryClass} disabled={controller.command.pending}>{copy.save}</button>
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
      <form onSubmit={submit} className="grid gap-3">
        <Field label={copy.password}><input className={inputClass} type="password" minLength={12} maxLength={128} required value={password} onChange={(event) => setPassword(event.target.value)} /></Field>
        <Field label={copy.passwordConfirmation}><input className={inputClass} type="password" minLength={12} maxLength={128} required value={confirmation} onChange={(event) => setConfirmation(event.target.value)} /></Field>
        <DialogError controller={controller} localError={localError} />
        <div className="flex justify-end gap-2"><button type="button" className={secondaryClass} onClick={onClose}>{copy.cancel}</button><button type="submit" className={primaryClass} disabled={controller.command.pending}>{copy.save}</button></div>
      </form>
    </DialogFrame>
  );
}

export function WebphoneDialog({
  controller,
  copy,
  locale,
  user,
  onClose,
  onSuccess,
}: SharedDialogProps & { user: TenantUserView }) {
  const current = user.webphone;
  const [enabled, setEnabled] = useState(current.enabled);
  const [extension, setExtension] = useState(current.extension ?? "");
  const [sipUsername, setSipUsername] = useState(current.sipUsername ?? "");
  const [sipPassword, setSipPassword] = useState("");
  const [displayName, setDisplayName] = useState(current.displayName ?? "");
  const [outboundCallerId, setOutboundCallerId] = useState(current.outboundCallerId ?? "");
  const [transport, setTransport] = useState<"ws" | "wss">(current.transport);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const input: UpdateTenantUserWebphoneInput = {
      enabled,
      extension: extension.trim() || null,
      sipUsername: sipUsername.trim() || null,
      displayName: displayName.trim() || null,
      outboundCallerId: outboundCallerId.trim() || null,
      transport,
      ...(sipPassword ? { sipPassword } : {}),
    };
    try {
      await controller.updateWebphone(user, input);
      setSipPassword("");
      onSuccess(copy.commandSucceeded);
      onClose();
    } catch {
      // The write-only password remains local only while the dialog is open.
    }
  };
  return (
    <DialogFrame title={copy.configureWebphone} onClose={onClose} locale={locale}>
      <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
        <label className="sm:col-span-2 inline-flex items-center gap-2 text-sm font-medium"><input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} />{copy.enabled}</label>
        <Field label={copy.extension}><input className={inputClass} value={extension} maxLength={32} onChange={(event) => setExtension(event.target.value)} /></Field>
        <Field label={copy.sipUsername}><input className={inputClass} value={sipUsername} maxLength={120} onChange={(event) => setSipUsername(event.target.value)} /></Field>
        <Field label={copy.sipPassword} wide><input className={inputClass} type="password" value={sipPassword} maxLength={255} autoComplete="new-password" onChange={(event) => setSipPassword(event.target.value)} /></Field>
        <Field label={copy.displayName}><input className={inputClass} value={displayName} maxLength={120} onChange={(event) => setDisplayName(event.target.value)} /></Field>
        <Field label={copy.outboundCallerId}><input className={inputClass} value={outboundCallerId} maxLength={64} onChange={(event) => setOutboundCallerId(event.target.value)} /></Field>
        <Field label={copy.transport}><select className={inputClass} value={transport} onChange={(event) => setTransport(event.target.value as "ws" | "wss")}><option value="wss">wss</option><option value="ws">ws</option></select></Field>
        <p className="self-end pb-2 text-xs text-slate-500">{copy.passwordConfigured}: {current.passwordConfigured ? "✓" : "—"}</p>
        <DialogError controller={controller} />
        <div className="sm:col-span-2 flex justify-end gap-2"><button type="button" className={secondaryClass} onClick={onClose}>{copy.cancel}</button><button type="submit" className={primaryClass} disabled={controller.command.pending}>{copy.save}</button></div>
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
          <select className={inputClass} value={branchId} onChange={(event) => setBranchId(event.target.value)}>
            {!branches.some((row) => row.id === user.organization.branch.id) ? <option value={user.organization.branch.id}>{user.organization.branch.name ?? user.organization.branch.id}</option> : null}
            {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.company.name} · {branch.name}</option>)}
          </select>
          <select className={inputClass} value={roleId} onChange={(event) => setRoleId(event.target.value)}><option value="">—</option>{roles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}</select>
          <button type="button" className={secondaryClass} onClick={add}>{copy.addAssignment}</button>
        </div>
        <div className="divide-y divide-slate-100 rounded-lg border border-slate-200">
          {assignments.length ? assignments.map((assignment) => (
            <div key={`${assignment.branchId}:${assignment.roleId}`} className="flex items-center justify-between gap-3 p-2 text-sm">
              <span>{branchNames.get(assignment.branchId) ?? assignment.branchId} · {roleNames.get(assignment.roleId) ?? assignment.roleId}</span>
              <button type="button" className="text-xs font-semibold text-rose-600" onClick={() => setAssignments((current) => current.filter((entry) => entry.branchId !== assignment.branchId || entry.roleId !== assignment.roleId))}>{copy.remove}</button>
            </div>
          )) : <p className="p-3 text-sm text-slate-500">{copy.noAssignments}</p>}
        </div>
        <DialogError controller={controller} />
        <div className="flex justify-end gap-2"><button type="button" className={secondaryClass} onClick={onClose}>{copy.cancel}</button><button type="submit" className={primaryClass} disabled={controller.command.pending}>{copy.save}</button></div>
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
      <p className="text-sm leading-6 text-slate-700">{definition[1]}</p>
      <p className="mt-2 rounded-lg bg-slate-50 p-2 text-sm font-semibold text-slate-900">{user.firstName} {user.lastName} · {user.email}</p>
      <DialogError controller={controller} />
      <div className="mt-5 flex justify-end gap-2"><button type="button" className={secondaryClass} onClick={onClose}>{copy.cancel}</button><button type="button" className={action === "delete" ? `${primaryClass} !bg-rose-600 hover:!bg-rose-700` : primaryClass} disabled={controller.command.pending} onClick={() => void confirm()}>{copy.confirm}</button></div>
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
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="tenant-access-dialog-title" dir={locale === "ar" ? "rtl" : "ltr"} className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-5 shadow-2xl">
        <header className="mb-4 flex items-center justify-between gap-3"><h3 id="tenant-access-dialog-title" className="text-lg font-semibold text-slate-950">{title}</h3><button type="button" className="grid size-8 place-items-center rounded-full text-xl text-slate-500 hover:bg-slate-100" aria-label="Close" onClick={onClose}>×</button></header>
        {children}
      </section>
    </div>
  );
}

function Field({ label, wide = false, children }: { label: string; wide?: boolean; children: ReactNode }) {
  return <label className={`grid gap-1 text-xs font-semibold text-slate-600 ${wide ? "sm:col-span-2" : ""}`}><span>{label}</span>{children}</label>;
}

function DialogError({ controller, localError }: { controller: TenantAccessController; localError?: string | null }) {
  const message = localError ?? controller.command.error?.message;
  return message ? <p role="alert" className="sm:col-span-2 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{message}{controller.command.error?.correlationId ? ` · ${controller.command.error.correlationId}` : ""}</p> : null;
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
