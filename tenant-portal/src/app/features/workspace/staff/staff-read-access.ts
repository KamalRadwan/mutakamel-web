import { Service, computed, inject } from '@angular/core';
import { type CanActivateFn, type ParamMap, type Params, Router } from '@angular/router';
import type { TenantResourceScope } from '../../../core/scope/tenant-scope';
import { StaffSession } from './shared/staff-session';
import { STAFF_PAGES, STAFF_PATH, type StaffPage } from './staff-navigation';

@Service()
export class StaffReadAccess {
  private readonly router = inject(Router);
  private readonly staff = inject(StaffSession);

  readonly ready = computed(() => this.staff.state() === 'ready');

  availablePages(query?: ParamMap): readonly StaffPage[] {
    if (!this.ready()) return [];
    const scope = explicitStaffScope(query);
    return scope ? STAFF_PAGES.filter((page) => this.canRead(page, scope)) : [];
  }

  firstAllowedUrl(query: ParamMap) {
    const first = this.availablePages(query)[0];
    return first ? this.router.createUrlTree([STAFF_PATH, first.id], { queryParams: staffScopeQuery(query) }) : null;
  }

  allows(pageId: string, query?: ParamMap, target?: TenantResourceScope): boolean {
    if (!this.ready()) return false;
    const page = STAFF_PAGES.find(({ id }) => id === pageId);
    const explicit = explicitStaffScope(query);
    if (!page || explicit === null) return false;

    const open = query?.getAll('open') ?? [];
    if (open.length > 1 || (open.length && !isScopeId(open[0]))) return false;
    if (open.length && pageId === 'companies') {
      if (explicit.companyId && explicit.companyId !== open[0]) return false;
      if (explicit.branchId && !this.canRead(page, { companyId: open[0], branchId: explicit.branchId })) return false;
      return this.canRead(page, { companyId: open[0] });
    }
    if (open.length && pageId === 'branches') {
      if (explicit.branchId && explicit.branchId !== open[0]) return false;
      return this.canRead(page, { companyId: explicit.companyId, branchId: open[0] });
    }

    return this.canRead(page, target ?? explicit);
  }

  private canRead(page: StaffPage, scope: TenantResourceScope): boolean {
    if (scope.companyId || scope.branchId) return this.staff.can(page.permission, scope);
    return this.staff.isTenantWide(page.permission) || this.staff.can(page.permission);
  }
}

export const staffReadGuard: CanActivateFn = (route) => {
  const access = inject(StaffReadAccess);
  const router = inject(Router);
  // The parent outlet stays closed until the live identity and Staff policy are ready.
  if (!access.ready()) return true;

  const page = route.routeConfig?.path;
  const query = route.queryParamMap;
  if (page && access.allows(page, query)) return true;

  const destination = access.firstAllowedUrl(query);
  if (destination) return destination;
  if (page === '') return true;
  return router.createUrlTree([STAFF_PATH], { queryParams: staffScopeQuery(query) });
};

/** Retain scope across Staff navigation without carrying a resource or page action. */
export function staffScopeQuery(query: ParamMap): Params {
  const params: Params = {};
  for (const key of ['companyId', 'branchId']) {
    const values = query.getAll(key);
    if (values.length) params[key] = values.length === 1 ? values[0] : values;
  }
  return params;
}

function explicitStaffScope(query?: ParamMap): TenantResourceScope | null {
  const companyIds = query?.getAll('companyId') ?? [];
  const branchIds = query?.getAll('branchId') ?? [];
  if (companyIds.length > 1 || branchIds.length > 1 || [...companyIds, ...branchIds].some((value) => !isScopeId(value))) {
    return null;
  }
  return { companyId: companyIds[0], branchId: branchIds[0] };
}

function isScopeId(value: string): boolean {
  return value.length > 0 && value === value.trim();
}
