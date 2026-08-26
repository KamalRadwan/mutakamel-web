"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import {
  Card,
  Button,
  Input,
  DataTable,
  Skeleton,
  useToast,
  type ColumnDef,
} from "@/design-system";
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

const selectClass =
  "h-9 min-w-0 rounded-lg border border-border bg-card px-3 text-sm text-foreground outline-none focus-visible:border-brand-500 focus-visible:ring-2 focus-visible:ring-brand-500/20";

export function TenantAccessPanel({
  tenantId,
  tenantStatus,
  enabled = true,
  locale = "en",
}: TenantAccessPanelProps) {
  const copy = tenantAccessCopy(locale);
  const controller = useTenantAccess({ tenantId, tenantStatus, enabled, locale });
  const toast = useToast();
  const [dialog, setDialog] = useState<DialogState>(null);
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

  const success = (message: string) => toast.success(message);

  const directory = controller.directory;
  const page = directory.data;
  const users = page?.items ?? [];

  const columns: ColumnDef<TenantUserView>[] = [
    {
      key: "name",
      headerEn: copy.name,
      headerAr: copy.name,
      cell: (tenantUser) => (
        <div>
          <p className="font-semibold text-foreground">
            {tenantUser.firstName} {tenantUser.lastName}
            {tenantUser.isTenantOwner ? (
              <span className="ms-2 rounded-full bg-brand-500/10 px-2 py-0.5 text-xs text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">
                {copy.owner}
              </span>
            ) : null}
          </p>
          <p className="text-xs text-muted-foreground">{tenantUser.email}</p>
        </div>
      ),
    },
    {
      key: "organization",
      headerEn: copy.organization,
      headerAr: copy.organization,
      cell: (tenantUser) => (
        <div className="text-xs text-muted-foreground">
          <p>
            {tenantUser.organization.company.name ?? "—"} · {tenantUser.organization.branch.name ?? "—"}
          </p>
          <p>
            {tenantUser.organization.department.name ?? "—"}
            {tenantUser.organization.team ? ` · ${tenantUser.organization.team.name ?? "—"}` : ""}
          </p>
        </div>
      ),
    },
    {
      key: "roles",
      headerEn: copy.roles,
      headerAr: copy.roles,
      cell: (tenantUser) => (
        <div className="flex max-w-56 flex-wrap gap-1">
          {tenantUser.roleAssignments.length ? (
            tenantUser.roleAssignments.slice(0, 3).map((assignment) => (
              <span key={assignment.assignmentId} className="rounded-full bg-muted px-2 py-0.5 text-xs text-foreground">
                {assignment.roleName}
              </span>
            ))
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          )}
        </div>
      ),
    },
    {
      key: "status",
      headerEn: copy.status,
      headerAr: copy.status,
      cell: (tenantUser) => <StatusBadge user={tenantUser} locale={locale} />,
    },
    {
      key: "actions",
      headerEn: copy.actions,
      headerAr: copy.actions,
      align: "end",
      cell: (tenantUser) => (
        <Button type="button" variant="outline" size="sm" onClick={() => void controller.loadUser(tenantUser.id)}>
          {copy.details}
        </Button>
      ),
    },
  ];

  return (
    <section dir={locale === "ar" ? "rtl" : "ltr"} className="space-y-4" aria-labelledby="tenant-access-title">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="tenant-access-title" className="text-lg font-semibold text-foreground">{copy.title}</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">{copy.subtitle}</p>
        </div>
        {controller.permissions.canInvite && controller.ready ? (
          <Button type="button" variant="primary" onClick={() => setDialog({ kind: "invite" })}>{copy.invite}</Button>
        ) : null}
      </header>

      {directory.status === "unavailable" ? (
        <>
          <SummaryCards controller={controller} locale={locale} />
          <GateCard tone="warning" message={copy.notReady} />
        </>
      ) : directory.status === "forbidden" ? (
        <GateCard tone="danger" message={copy.forbidden} />
      ) : directory.status === "error" ? (
        <>
          <SummaryCards controller={controller} locale={locale} />
          <GateCard
            tone="danger"
            message={`${copy.loadError}${directory.error?.correlationId ? ` · ${directory.error.correlationId}` : ""}`}
            action={<Button type="button" variant="outline" onClick={() => void controller.refresh()}>{copy.retry}</Button>}
          />
        </>
      ) : (
        <>
          <SummaryCards controller={controller} locale={locale} />
          <Card>
            <form onSubmit={applyFilters} className="grid gap-2 p-3 lg:grid-cols-4 xl:grid-cols-8">
              <Input
                className="lg:col-span-2"
                type="search"
                maxLength={200}
                placeholder={copy.search}
                value={q}
                onChange={(event) => setQ(event.target.value)}
              />
              <select aria-label={copy.status} className={selectClass} value={status} onChange={(event) => setStatus(event.target.value as TenantUserStatus | "")}>
                <option value="">{copy.allStatuses}</option>
                <option value="INVITED">{copy.invited}</option><option value="ACTIVE">{copy.active}</option><option value="SUSPENDED">{copy.suspended}</option><option value="DEACTIVATED">{copy.deactivated}</option>
              </select>
              <select aria-label={copy.allRows} className={selectClass} value={visibility} onChange={(event) => setVisibility(event.target.value as TenantUserVisibility)}>
                <option value="ACTIVE">{copy.activeRows}</option><option value="DELETED">{copy.deletedRows}</option><option value="ALL">{copy.allRows}</option>
              </select>
              {controller.permissions.canReadRoles ? (
                <select aria-label={copy.roles} className={selectClass} value={role} onChange={(event) => setRole(event.target.value)}><option value="">{copy.allRoles}</option>{controller.roles.data?.items.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}</select>
              ) : <span />}
              <select
                className={selectClass}
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
                className={selectClass}
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
              <select aria-label={copy.team} className={selectClass} disabled={!departmentId} value={teamId} onChange={(event) => setTeamId(event.target.value)}><option value="">{copy.allTeams}</option>{controller.teams.data?.items.map((team) => <option key={team.id} value={team.id}>{team.code} · {team.name}</option>)}</select>
              <div className="flex gap-2 lg:col-span-4 xl:col-span-8">
                <Button type="submit" variant="secondary">{copy.apply}</Button>
                <Button type="button" variant="outline" onClick={clearFilters}>{copy.clear}</Button>
              </div>
            </form>
          </Card>

          <DataTable
            columns={columns}
            data={users}
            isLoading={directory.status === "loading" && !page}
            getRowId={(tenantUser) => tenantUser.id}
            pagination={
              page
                ? {
                    page: page.page,
                    limit: page.limit,
                    totalItems: page.total,
                    totalPages: Math.max(1, page.totalPages),
                    onPageChange: (target) =>
                      controller.setQuery((current) => ({ ...current, page: target })),
                  }
                : { page: 1, limit: 1, totalItems: 0, totalPages: 1, onPageChange: () => {} }
            }
            emptyState={{ titleEn: copy.noUsers, titleAr: copy.noUsers }}
          />
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
  if (!summary) return controller.summary.status === "loading" ? <Skeleton className="h-20 rounded-xl" /> : null;
  const cards = [[copy.total, summary.total], [copy.active, summary.active], [copy.invited, summary.invited], [copy.suspended, summary.suspended], [copy.deleted, summary.deleted], [copy.webphone, summary.webphoneEnabled], [copy.locked, summary.locked]] as const;
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-7">
      {cards.map(([label, value]) => (
        <div key={label} className="rounded-xl border border-border bg-card px-3 py-2">
          <p className="text-2xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="mt-0.5 text-xl font-semibold text-foreground">{value}</p>
        </div>
      ))}
    </div>
  );
}

function UserDetailCard({ controller, locale, openDialog }: { controller: ReturnType<typeof useTenantAccess>; locale: TenantAccessLocale; openDialog: (dialog: DialogState) => void }) {
  const copy = tenantAccessCopy(locale);
  const resource = controller.selectedUser;
  if (resource.status === "idle") return null;
  if (resource.status === "loading") return <Card className="p-5 text-sm text-muted-foreground">{copy.loading}</Card>;
  if (!resource.data) return <GateCard tone="danger" message={resource.error?.message ?? copy.loadError} />;
  const user = resource.data;
  const deleted = user.deletedAt !== null;
  const protectedOwner = user.isTenantOwner;
  return (
    <Card className="p-4" aria-label={copy.details}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-foreground">{user.firstName} {user.lastName}</h3>
          <p className="text-sm text-muted-foreground">{user.email}</p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge user={user} locale={locale} />
          <Button type="button" variant="outline" size="sm" onClick={controller.closeUser}>{copy.close}</Button>
        </div>
      </div>
      <dl className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-3">
        <div>
          <dt className="font-semibold text-foreground">{copy.organization}</dt>
          <dd>{user.organization.company.name} · {user.organization.branch.name} · {user.organization.department.name}{user.organization.team ? ` · ${user.organization.team.name}` : ""}</dd>
        </div>
        <div>
          <dt className="font-semibold text-foreground">{copy.manager}</dt>
          <dd>{user.manager ? `${user.manager.firstName} ${user.manager.lastName}` : "—"}</dd>
        </div>
        <div>
          <dt className="font-semibold text-foreground">{copy.lastLogin}</dt>
          <dd>{user.lastLoginAt ? new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(user.lastLoginAt)) : copy.never}</dd>
        </div>
      </dl>
      {protectedOwner ? <p className="mt-3 rounded-lg bg-warn-500/10 px-3 py-2 text-xs text-warn-800 dark:bg-warn-500/15 dark:text-warn-300">{copy.protectedOwner}</p> : null}
      <div className="mt-4 flex flex-wrap gap-2">
        {controller.permissions.canUpdate && !protectedOwner && !deleted ? <Button type="button" variant="outline" size="sm" onClick={() => openDialog({ kind: "edit", user })}>{copy.edit}</Button> : null}
        {controller.permissions.canResetPassword && user.status === "ACTIVE" && !deleted ? <Button type="button" variant="outline" size="sm" onClick={() => openDialog({ kind: "confirm", action: "reset-password", user })}>{copy.resetPassword}</Button> : null}
        {controller.permissions.canInvite && user.status === "INVITED" && !deleted ? <Button type="button" variant="outline" size="sm" onClick={() => openDialog({ kind: "confirm", action: "resend-invite", user })}>{copy.resendInvite}</Button> : null}
        {controller.permissions.canResetPassword && !protectedOwner && (user.status === "ACTIVE" || user.status === "SUSPENDED") && !deleted ? <Button type="button" variant="outline" size="sm" onClick={() => openDialog({ kind: "password", user })}>{copy.changePassword}</Button> : null}
        {controller.permissions.canManageWebphone && !deleted ? <Button type="button" variant="outline" size="sm" onClick={() => openDialog({ kind: "webphone", user })}>{copy.configureWebphone}</Button> : null}
        {controller.permissions.canAssignRoles && !protectedOwner && !deleted ? <Button type="button" variant="outline" size="sm" onClick={() => openDialog({ kind: "roles", user })}>{copy.manageRoles}</Button> : null}
        {controller.permissions.canSuspend && !protectedOwner && user.status === "ACTIVE" && !deleted ? <Button type="button" variant="outline" size="sm" onClick={() => openDialog({ kind: "confirm", action: "suspend", user })}>{copy.suspend}</Button> : null}
        {controller.permissions.canSuspend && !protectedOwner && user.status === "SUSPENDED" && !deleted ? <Button type="button" variant="outline" size="sm" onClick={() => openDialog({ kind: "confirm", action: "activate", user })}>{copy.activate}</Button> : null}
        {controller.permissions.canDelete && !protectedOwner && !deleted ? <Button type="button" variant="destructive" size="sm" onClick={() => openDialog({ kind: "confirm", action: "delete", user })}>{copy.delete}</Button> : null}
        {controller.permissions.canRestore && deleted ? <Button type="button" variant="outline" size="sm" onClick={() => openDialog({ kind: "confirm", action: "restore", user })}>{copy.restore}</Button> : null}
      </div>
    </Card>
  );
}

function StatusBadge({ user, locale }: { user: TenantUserView; locale: TenantAccessLocale }) {
  const copy = tenantAccessCopy(locale);
  const label = user.deletedAt ? copy.deleted : ({ INVITED: copy.invited, ACTIVE: copy.active, SUSPENDED: copy.suspended, DEACTIVATED: copy.deactivated } as const)[user.status];
  const tone = user.deletedAt
    ? "bg-danger-500/10 text-danger-700 dark:bg-danger-500/15 dark:text-danger-300"
    : user.status === "ACTIVE"
      ? "bg-brand-500/10 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300"
      : user.status === "SUSPENDED"
        ? "bg-warn-500/10 text-warn-800 dark:bg-warn-500/15 dark:text-warn-300"
        : "bg-ink-100 text-ink-600 dark:bg-ink-800 dark:text-ink-400";
  return <span className={`inline-flex rounded-full px-2 py-1 text-2xs font-semibold ${tone}`}>{label}</span>;
}

function GateCard({ tone, message, action }: { tone: "warning" | "danger"; message: string; action?: ReactNode }) {
  const toneClass =
    tone === "warning"
      ? "border-warn-200 bg-warn-50 text-warn-900 dark:border-warn-800/60 dark:bg-warn-950/30 dark:text-warn-100"
      : "border-danger-200 bg-danger-50 text-danger-900 dark:border-danger-800/60 dark:bg-danger-950/40 dark:text-danger-100";
  return (
    <div className={`flex min-h-28 flex-col items-center justify-center gap-3 rounded-xl border p-5 text-center text-sm ${toneClass}`}>
      <p>{message}</p>
      {action}
    </div>
  );
}
