import { Service, inject } from '@angular/core';
import { QueryClient } from '@tanstack/angular-query';
import { ApiError } from '../../../../core/api/api-errors';
import { StaffHttp, type StaffWriteMethod, type StaffWriteOptions } from '../shared/staff-http';
import { StaffSession } from '../shared/staff-session';
import type {
  AssignmentOptions, BranchRoleAssignment, ConfirmAddonCascadeOptions, MembershipRole,
  ModuleAssignment, ReportingScopes, ScopeRoleAssignment, ScopeTarget, TeamMembership,
} from '../shared/staff.model';

type BranchRoleInput = Pick<BranchRoleAssignment, 'branchId' | 'roleId'>;
type ScopeRoleInput = { scopeTarget: ScopeTarget; roleId: string; companyId?: string; branchId?: string };
type MembershipInput = { teamId: string; role: MembershipRole; isPrimary: boolean };
type ReportingPatch = { expectedRevision: number; addBranchIds?: string[]; removeBranchIds?: string[] };
type ReportingResult = { membershipId: string; revision: number; outcome: 'APPLIED' | 'NO_CHANGE'; replayed: boolean };

const USERS_PATH = '/api/tenant/core/v1/users';

@Service()
export class StaffUserAccessApi {
  private readonly http = inject(StaffHttp);
  private readonly session = inject(StaffSession);
  private readonly queries = new QueryClient({
    defaultOptions: { queries: { gcTime: 0, retry: false, networkMode: 'always' } },
  });

  listAssignmentOptions(userId: string, query: { page?: number; limit?: number; search?: string } = {}): Promise<AssignmentOptions> {
    this.guardRoles(userId);
    return this.read(userId, 'assignment-options', query);
  }

  listBranchRoles(userId: string): Promise<BranchRoleAssignment[]> {
    this.guardRoles(userId);
    return this.read(userId, 'assignments');
  }

  setBranchRoles(userId: string, assignments: BranchRoleInput[], key: string, opts?: ConfirmAddonCascadeOptions): Promise<BranchRoleAssignment[]> {
    this.guardRoles(userId);
    return this.write(userId, 'PUT', 'assignments', { assignments }, { key, ...opts });
  }

  addBranchRole(userId: string, { branchId, roleId }: BranchRoleInput, key: string, opts?: ConfirmAddonCascadeOptions): Promise<BranchRoleAssignment> {
    this.guardRoles(userId);
    return this.write(userId, 'POST', 'assignments', { branchId, roleId }, { key, ...opts });
  }

  removeBranchRole(userId: string, assignmentId: string, key: string, opts?: ConfirmAddonCascadeOptions): Promise<void> {
    this.guardRoles(userId);
    return this.write(userId, 'DELETE', `assignments/${encodeURIComponent(assignmentId)}`, undefined, { key, ...opts });
  }

  listScopeRoles(userId: string): Promise<ScopeRoleAssignment[]> {
    // Core permits the owner to read their own exact-scope grants, but not replace them.
    if (!this.session.isOwner()) throw new ApiError(403, 'COMMON.GENERIC.FORBIDDEN');
    return this.read(userId, 'scope-role-assignments');
  }

  setScopeRoles(userId: string, assignments: ScopeRoleInput[], key: string, opts?: ConfirmAddonCascadeOptions): Promise<ScopeRoleAssignment[]> {
    this.guardRoles(userId, true);
    return this.write(userId, 'PUT', 'scope-role-assignments', { assignments }, { key, ...opts });
  }

  listMemberships(userId: string): Promise<TeamMembership[]> {
    return this.read(userId, 'team-memberships');
  }

  setMemberships(userId: string, memberships: MembershipInput[], key: string): Promise<TeamMembership[]> {
    return this.write(userId, 'PUT', 'team-memberships', {
      memberships: memberships.map(({ teamId, role, isPrimary }) => ({ teamId, role, isPrimary })),
    }, { key });
  }

  addMembership(userId: string, membership: { teamId: string; role?: MembershipRole; isPrimary?: boolean }, key: string): Promise<TeamMembership[]> {
    return this.write(userId, 'POST', 'team-memberships', membership, { key });
  }

  removeMembership(userId: string, membershipId: string, key: string): Promise<void> {
    return this.write(userId, 'DELETE', `team-memberships/${encodeURIComponent(membershipId)}`, undefined, { key });
  }

  getReportingScopes(userId: string, membershipId: string): Promise<ReportingScopes> {
    return this.read(userId, `team-memberships/${encodeURIComponent(membershipId)}/reporting-scopes`);
  }

  patchReportingScopes(userId: string, membershipId: string, body: ReportingPatch, key: string): Promise<ReportingResult> {
    return this.write(userId, 'PATCH', `team-memberships/${encodeURIComponent(membershipId)}/reporting-scopes`, body, { key });
  }

  listModules(userId: string): Promise<ModuleAssignment[]> {
    return this.read(userId, 'modules');
  }

  assignModule(userId: string, moduleKey: string, key: string): Promise<ModuleAssignment> {
    return this.write(userId, 'POST', 'modules', { moduleKey }, { key });
  }

  unassignModule(userId: string, moduleKey: string, key: string): Promise<void> {
    return this.write(userId, 'DELETE', `modules/${encodeURIComponent(moduleKey)}`, undefined, { key });
  }

  private guardRoles(userId: string, ownerOnly = false): void {
    if (userId === this.session.me()?.id || (ownerOnly && !this.session.isOwner())) {
      throw new ApiError(403, 'COMMON.GENERIC.FORBIDDEN');
    }
  }

  private scope(): string {
    const scope = this.session.scopeRevision();
    if (!scope) throw new ApiError(403, 'COMMON.GENERIC.FORBIDDEN');
    return scope;
  }

  private read<T>(userId: string, resource: string, query?: object): Promise<T> {
    const scope = this.scope();
    return this.queries.fetchQuery({
      queryKey: ['staff-user-access', scope, userId, resource, ...(query ? [query] : [])],
      queryFn: async () => {
        const { data } = await this.http.read<T>(`${USERS_PATH}/${encodeURIComponent(userId)}/${resource}`, query);
        if (scope !== this.session.scopeRevision()) throw new ApiError(403, 'COMMON.GENERIC.FORBIDDEN');
        if (data == null) throw new ApiError(502, 'COMMON.GENERIC.INTERNAL_ERROR');
        return data;
      },
    });
  }

  private async write<T>(userId: string, method: StaffWriteMethod, resource: string, body: unknown, options: StaffWriteOptions): Promise<T> {
    const scope = this.scope();
    const result = await this.http.write<T>(method, `${USERS_PATH}/${encodeURIComponent(userId)}/${resource}`, body, options);
    const filters = { queryKey: ['staff-user-access', scope, userId] };
    await this.queries.cancelQueries(filters);
    await this.queries.invalidateQueries({ ...filters, refetchType: 'none' });
    if (scope !== this.session.scopeRevision()) throw new ApiError(403, 'COMMON.GENERIC.FORBIDDEN');
    return result;
  }
}
