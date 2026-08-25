"use client";

import { useState, type FormEvent } from "react";
import type { TenantStatus } from "../../core/types";
import { tenantAccessCopy, type TenantAccessLocale } from "../copy";
import {
  ConfirmationDialog,
  PasswordDialog,
  RolesDialog,
  TenantUserEditorDialog,
  WebphoneDialog,
  type ConfirmationAction,
} from "./tenant-access-dialogs";
import { useTenantAccess } from "../use-tenant-access";
import type { TenantUserStatus, TenantUserView, TenantUserVisibility } from "../types";

export interface TenantAccessPanelProps {
  tenantId: string;
  tenantStatus: TenantStatus;
  enabled?: boolean;
  locale?: TenantAccessLocale;
}

type DialogState =
  | { kind: "invite" }
  | { kind: "edit"; user: TenantUserView }
  | { kind: "password"; user: TenantUserView }
  | { kind: "webphone"; user: TenantUserView }
  | { kind: "roles"; user: TenantUserView }
  | { kind: "confirm"; action: ConfirmationAction; user: TenantUserView }
  | null;

const controlClass =
  "h-9 min-w-0 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100";
const buttonClass =
  "inline-flex h-9 items-center justify-center rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50";

export function TenantAccessPanel({
  tenantId,
  tenantStatus,
  enabled = true,
  locale = "en",
}: TenantAccessPanelProps) {
  const copy = tenantAccessCopy(locale);
  const controller = useTenantAccess({ tenantId, tenantStatus, enabled, locale });
  const [dialog, setDialog] = useState<DialogState>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<TenantUserStatus | "">("");
  const [visibility, setVisibility] = useState<TenantUserVisibility>("ACTIVE");
  const [role, setRole] = useState("");
  const [branchId, setBranchId] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [teamId, setTeamId] = useState("");

  if (!enabled) return null;

  const applyFilters = (event: FormEvent) => {
    event.preventDefault();
    const branch = controller.branches.data?.items.find((row) => row.id === branchId);
    controller.setQuery((current) => ({
      ...current,
      page: 1,
      q: q.trim() || undefined,
      status: status || undefined,
      visibility,
      role: role || undefined,
      companyId: branch?.company.id,
      branchId: branchId || undefined,
      departmentId: departmentId || undefined,
      teamId: teamId || undefined,
    }));
  };

  const clearFilters = () => {
    setQ("");
    setStatus("");
    setVisibility("ACTIVE");
    setRole("");
    setBranchId("");
    setDepartmentId("");
    setTeamId("");
    controller.setQuery({
      page: 1,
      limit: controller.query.limit,
      visibility: "ACTIVE",
      sortBy: "createdAt",
      sortDir: "DESC",
    });
  };

  const success = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(null), 4_000);
  };

  const directory = controller.directory;
  const page = directory.data;
  const users = page?.items ?? [];

  return (
    <section dir={locale === "ar" ? "rtl" : "ltr"} className="space-y-4" aria-labelledby="tenant-access-title">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="tenant-access-title" className="text-lg font-bold text-slate-950">{copy.title}</h2>
          <p className="mt-0.5 text-sm text-slate-500">{copy.subtitle}</p>
        </div>
        {controller.permissions.canInvite && controller.ready ? (
          <button type="button" className="inline-flex h-9 items-center rounded-lg bg-indigo-600 px-4 text-sm font-semibold text-white hover:bg-indigo-700" onClick={() => setDialog({ kind: "invite" })}>{copy.invite}</button>
        ) : null}
      </header>

      {notice ? <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{notice}</p> : null}

      {directory.status === "unavailable" ? (
        <><SummaryCards controller={controller} locale={locale} /><GateCard tone="amber" message={copy.notReady} /></>
      ) : directory.status === "forbidden" ? (
        <GateCard tone="rose" message={copy.forbidden} />
      ) : directory.status === "error" ? (
        <><SummaryCards controller={controller} locale={locale} /><GateCard tone="rose" message={`${copy.loadError}${directory.error?.correlationId ? ` · ${directory.error.correlationId}` : ""}`} action={<button type="button" className={buttonClass} onClick={() => void controller.refresh()}>{copy.retry}</button>} /></>
      ) : (
        <>
          <SummaryCards controller={controller} locale={locale} />
          <form onSubmit={applyFilters} className="grid gap-2 rounded-xl border border-slate-200 bg-slate-50/70 p-3 lg:grid-cols-4 xl:grid-cols-8">
            <input className={`${controlClass} lg:col-span-2`} type="search" maxLength={200} placeholder={copy.search} value={q} onChange={(event) => setQ(event.target.value)} />
            <select aria-label={copy.status} className={controlClass} value={status} onChange={(event) => setStatus(event.target.value as TenantUserStatus | "")}>
              <option value="">{copy.allStatuses}</option>
              <option value="INVITED">{copy.invited}</option><option value="ACTIVE">{copy.active}</option><option value="SUSPENDED">{copy.suspended}</option><option value="DEACTIVATED">{copy.deactivated}</option>
            </select>
            <select aria-label={copy.allRows} className={controlClass} value={visibility} onChange={(event) => setVisibility(event.target.value as TenantUserVisibility)}>
              <option value="ACTIVE">{copy.activeRows}</option><option value="DELETED">{copy.deletedRows}</option><option value="ALL">{copy.allRows}</option>
            </select>
            {controller.permissions.canReadRoles ? (
              <select aria-label={copy.roles} className={controlClass} value={role} onChange={(event) => setRole(event.target.value)}><option value="">{copy.allRoles}</option>{controller.roles.data?.items.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}</select>
            ) : <span />}
            <select
              className={controlClass}
              aria-label={copy.branch}
              value={branchId}
              onChange={(event) => {
                const next = event.target.value;
                setBranchId(next);
                setDepartmentId("");
                setTeamId("");
                if (next) void controller.loadDepartments({ branchId: next, page: 1, limit: 100 });
              }}
            >
              <option value="">{copy.allBranches}</option>{controller.branches.data?.items.map((branch) => <option key={branch.id} value={branch.id}>{branch.company.name} · {branch.name}</option>)}
            </select>
            <select
              className={controlClass}
              aria-label={copy.department}
              disabled={!branchId}
              value={departmentId}
              onChange={(event) => {
                const next = event.target.value;
                setDepartmentId(next);
                setTeamId("");
                if (next) void controller.loadTeams({ departmentId: next, page: 1, limit: 100 });
              }}
            >
              <option value="">{copy.allDepartments}</option>{controller.departments.data?.items.map((department) => <option key={department.id} value={department.id}>{department.code} · {department.name}</option>)}
            </select>
            <select aria-label={copy.team} className={controlClass} disabled={!departmentId} value={teamId} onChange={(event) => setTeamId(event.target.value)}><option value="">{copy.allTeams}</option>{controller.teams.data?.items.map((team) => <option key={team.id} value={team.id}>{team.code} · {team.name}</option>)}</select>
            <div className="flex gap-2 lg:col-span-4 xl:col-span-8">
              <button type="submit" className="inline-flex h-9 items-center rounded-lg bg-slate-900 px-4 text-xs font-semibold text-white hover:bg-slate-800">{copy.apply}</button>
              <button type="button" className={buttonClass} onClick={clearFilters}>{copy.clear}</button>
            </div>
          </form>

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            {directory.status === "loading" && !page ? <p className="p-8 text-center text-sm text-slate-500">{copy.loading}</p> : null}
            {page ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[850px] text-sm">
                  <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500"><tr><th className="px-3 py-2 text-start">{copy.name}</th><th className="px-3 py-2 text-start">{copy.organization}</th><th className="px-3 py-2 text-start">{copy.roles}</th><th className="px-3 py-2 text-start">{copy.status}</th><th className="px-3 py-2 text-end">{copy.actions}</th></tr></thead>
                  <tbody className="divide-y divide-slate-100">
                    {users.map((tenantUser) => (
                      <tr key={tenantUser.id} className="hover:bg-slate-50/70">
                        <td className="px-3 py-3"><p className="font-semibold text-slate-900">{tenantUser.firstName} {tenantUser.lastName}{tenantUser.isTenantOwner ? <span className="ms-2 rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] text-indigo-700">{copy.owner}</span> : null}</p><p className="text-xs text-slate-500">{tenantUser.email}</p></td>
                        <td className="px-3 py-3 text-xs text-slate-600"><p>{tenantUser.organization.company.name ?? "—"} · {tenantUser.organization.branch.name ?? "—"}</p><p>{tenantUser.organization.department.name ?? "—"}{tenantUser.organization.team ? ` · ${tenantUser.organization.team.name ?? "—"}` : ""}</p></td>
                        <td className="px-3 py-3"><div className="flex max-w-56 flex-wrap gap-1">{tenantUser.roleAssignments.length ? tenantUser.roleAssignments.slice(0, 3).map((assignment) => <span key={assignment.assignmentId} className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-700">{assignment.roleName}</span>) : <span className="text-xs text-slate-400">—</span>}</div></td>
                        <td className="px-3 py-3"><StatusBadge user={tenantUser} locale={locale} /></td>
                        <td className="px-3 py-3 text-end"><button type="button" className={buttonClass} onClick={() => void controller.loadUser(tenantUser.id)}>{copy.details}</button></td>
                      </tr>
                    ))}
                    {!users.length ? <tr><td colSpan={5} className="px-3 py-10 text-center text-sm text-slate-500">{copy.noUsers}</td></tr> : null}
                  </tbody>
                </table>
              </div>
            ) : null}
            {page ? (
              <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 px-3 py-2 text-xs text-slate-600">
                <span>{copy.total}: {page.total} · {copy.page} {page.page} {copy.of} {Math.max(1, page.totalPages)}</span>
                <div className="flex gap-2"><button type="button" className={buttonClass} disabled={!page.hasPrev || directory.status === "loading"} onClick={() => controller.setQuery((current) => ({ ...current, page: current.page - 1 }))}>{copy.previous}</button><button type="button" className={buttonClass} disabled={!page.hasNext || directory.status === "loading"} onClick={() => controller.setQuery((current) => ({ ...current, page: current.page + 1 }))}>{copy.next}</button></div>
              </footer>
            ) : null}
          </div>
        </>
      )}

      <UserDetailCard controller={controller} locale={locale} openDialog={setDialog} />

      {dialog?.kind === "invite" ? <TenantUserEditorDialog controller={controller} copy={copy} locale={locale} mode="invite" onClose={() => setDialog(null)} onSuccess={success} /> : null}
      {dialog?.kind === "edit" ? <TenantUserEditorDialog controller={controller} copy={copy} locale={locale} mode="edit" user={dialog.user} onClose={() => setDialog(null)} onSuccess={success} /> : null}
      {dialog?.kind === "password" ? <PasswordDialog controller={controller} copy={copy} locale={locale} user={dialog.user} onClose={() => setDialog(null)} onSuccess={success} /> : null}
      {dialog?.kind === "webphone" ? <WebphoneDialog controller={controller} copy={copy} locale={locale} user={dialog.user} onClose={() => setDialog(null)} onSuccess={success} /> : null}
      {dialog?.kind === "roles" ? <RolesDialog controller={controller} copy={copy} locale={locale} user={dialog.user} onClose={() => setDialog(null)} onSuccess={success} /> : null}
      {dialog?.kind === "confirm" ? <ConfirmationDialog controller={controller} copy={copy} locale={locale} user={dialog.user} action={dialog.action} onClose={() => setDialog(null)} onSuccess={success} /> : null}
    </section>
  );
}

function SummaryCards({ controller, locale }: { controller: ReturnType<typeof useTenantAccess>; locale: TenantAccessLocale }) {
  const copy = tenantAccessCopy(locale);
  const summary = controller.summary.data;
  if (!summary) return controller.summary.status === "loading" ? <div className="h-20 animate-pulse rounded-xl bg-slate-100" /> : null;
  const cards = [[copy.total, summary.total], [copy.active, summary.active], [copy.invited, summary.invited], [copy.suspended, summary.suspended], [copy.deleted, summary.deleted], [copy.webphone, summary.webphoneEnabled], [copy.locked, summary.locked]] as const;
  return <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-7">{cards.map(([label, value]) => <div key={label} className="rounded-xl border border-slate-200 bg-white px-3 py-2"><p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-0.5 text-xl font-bold text-slate-950">{value}</p></div>)}</div>;
}

function UserDetailCard({ controller, locale, openDialog }: { controller: ReturnType<typeof useTenantAccess>; locale: TenantAccessLocale; openDialog: (dialog: DialogState) => void }) {
  const copy = tenantAccessCopy(locale);
  const resource = controller.selectedUser;
  if (resource.status === "idle") return null;
  if (resource.status === "loading") return <div className="rounded-xl border border-slate-200 p-5 text-sm text-slate-500">{copy.loading}</div>;
  if (!resource.data) return <GateCard tone="rose" message={resource.error?.message ?? copy.loadError} />;
  const user = resource.data;
  const deleted = user.deletedAt !== null;
  const protectedOwner = user.isTenantOwner;
  return (
    <aside className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm" aria-label={copy.details}>
      <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-bold text-slate-950">{user.firstName} {user.lastName}</h3><p className="text-sm text-slate-500">{user.email}</p></div><div className="flex items-center gap-2"><StatusBadge user={user} locale={locale} /><button type="button" className={buttonClass} onClick={controller.closeUser}>{copy.close}</button></div></div>
      <dl className="mt-3 grid gap-2 text-xs text-slate-600 sm:grid-cols-3"><div><dt className="font-semibold text-slate-500">{copy.organization}</dt><dd>{user.organization.company.name} · {user.organization.branch.name} · {user.organization.department.name}{user.organization.team ? ` · ${user.organization.team.name}` : ""}</dd></div><div><dt className="font-semibold text-slate-500">{copy.manager}</dt><dd>{user.manager ? `${user.manager.firstName} ${user.manager.lastName}` : "—"}</dd></div><div><dt className="font-semibold text-slate-500">{copy.lastLogin}</dt><dd>{user.lastLoginAt ? new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(user.lastLoginAt)) : copy.never}</dd></div></dl>
      {protectedOwner ? <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">{copy.protectedOwner}</p> : null}
      <div className="mt-4 flex flex-wrap gap-2">
        {controller.permissions.canUpdate && !protectedOwner && !deleted ? <button type="button" className={buttonClass} onClick={() => openDialog({ kind: "edit", user })}>{copy.edit}</button> : null}
        {controller.permissions.canResetPassword && user.status === "ACTIVE" && !deleted ? <button type="button" className={buttonClass} onClick={() => openDialog({ kind: "confirm", action: "reset-password", user })}>{copy.resetPassword}</button> : null}
        {controller.permissions.canInvite && user.status === "INVITED" && !deleted ? <button type="button" className={buttonClass} onClick={() => openDialog({ kind: "confirm", action: "resend-invite", user })}>{copy.resendInvite}</button> : null}
        {controller.permissions.canResetPassword && !protectedOwner && (user.status === "ACTIVE" || user.status === "SUSPENDED") && !deleted ? <button type="button" className={buttonClass} onClick={() => openDialog({ kind: "password", user })}>{copy.changePassword}</button> : null}
        {controller.permissions.canManageWebphone && !deleted ? <button type="button" className={buttonClass} onClick={() => openDialog({ kind: "webphone", user })}>{copy.configureWebphone}</button> : null}
        {controller.permissions.canAssignRoles && !protectedOwner && !deleted ? <button type="button" className={buttonClass} onClick={() => openDialog({ kind: "roles", user })}>{copy.manageRoles}</button> : null}
        {controller.permissions.canSuspend && !protectedOwner && user.status === "ACTIVE" && !deleted ? <button type="button" className={buttonClass} onClick={() => openDialog({ kind: "confirm", action: "suspend", user })}>{copy.suspend}</button> : null}
        {controller.permissions.canSuspend && !protectedOwner && user.status === "SUSPENDED" && !deleted ? <button type="button" className={buttonClass} onClick={() => openDialog({ kind: "confirm", action: "activate", user })}>{copy.activate}</button> : null}
        {controller.permissions.canDelete && !protectedOwner && !deleted ? <button type="button" className={`${buttonClass} !border-rose-200 !text-rose-700`} onClick={() => openDialog({ kind: "confirm", action: "delete", user })}>{copy.delete}</button> : null}
        {controller.permissions.canRestore && deleted ? <button type="button" className={buttonClass} onClick={() => openDialog({ kind: "confirm", action: "restore", user })}>{copy.restore}</button> : null}
      </div>
    </aside>
  );
}

function StatusBadge({ user, locale }: { user: TenantUserView; locale: TenantAccessLocale }) {
  const copy = tenantAccessCopy(locale);
  const label = user.deletedAt ? copy.deleted : ({ INVITED: copy.invited, ACTIVE: copy.active, SUSPENDED: copy.suspended, DEACTIVATED: copy.deactivated } as const)[user.status];
  const color = user.deletedAt ? "bg-rose-50 text-rose-700" : user.status === "ACTIVE" ? "bg-emerald-50 text-emerald-700" : user.status === "SUSPENDED" ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-700";
  return <span className={`inline-flex rounded-full px-2 py-1 text-[11px] font-semibold ${color}`}>{label}</span>;
}

function GateCard({ tone, message, action }: { tone: "amber" | "rose"; message: string; action?: React.ReactNode }) {
  return <div className={`flex min-h-28 flex-col items-center justify-center gap-3 rounded-xl border p-5 text-center text-sm ${tone === "amber" ? "border-amber-200 bg-amber-50 text-amber-900" : "border-rose-200 bg-rose-50 text-rose-800"}`}><p>{message}</p>{action}</div>;
}
