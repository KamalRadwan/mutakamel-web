import { computed, inject, Service, signal } from '@angular/core';
import { AuthSession } from '../auth/auth-session';

export interface TenantResourceScope {
  companyId?: string | null;
  branchId?: string | null;
}

interface TenantSelection {
  companyId: string;
  branchId: string | null;
}

const STORAGE_PREFIX = 'tenant-staff-scope:';

/** Authenticated Staff context. The existing fixture scope is separate. */
@Service()
export class TenantScopeState {
  private readonly authSession = inject(AuthSession);
  private readonly localSelection = signal<{ account: string; scope: TenantSelection } | null>(null);

  readonly me = computed(() => {
    const me = this.authSession.status() === 'signed-in' ? this.authSession.me() : null;
    return me?.status === 'ACTIVE' && me.id ? me : null;
  });

  readonly companies = computed<ReadonlySet<string>>(() => new Set(this.me()?.accessibleCompanies ?? []));
  readonly branchCompanies = computed<ReadonlyMap<string, string>>(() => {
    const me = this.me();
    const accessible = new Set(me?.accessibleBranches ?? []);
    const parentByBranch = new Map<string, string>();
    const ambiguous = new Set<string>();

    for (const { branchId, companyId } of me?.accessibleBranchCompanies ?? []) {
      if (!branchId || !companyId || !accessible.has(branchId)) continue;
      const previous = parentByBranch.get(branchId);
      if (previous && previous !== companyId) ambiguous.add(branchId);
      parentByBranch.set(branchId, companyId);
    }
    for (const branch of ambiguous) parentByBranch.delete(branch);
    return parentByBranch;
  });

  readonly selectorCompanyIds = computed(() =>
    [...new Set([...this.companies(), ...this.branchCompanies().values()])].filter(Boolean),
  );

  readonly showScopeSwitcher = computed(() => {
    const me = this.me();
    if (!me) return false;
    if (typeof me.hasMultipleOrganizationScopes === 'boolean') return me.hasMultipleOrganizationScopes;

    const { accessScope, accessibleBranches } = me;
    if (accessScope?.companiesTruncated || accessScope?.branchesTruncated) return true;
    const companies = this.selectorCompanyIds();
    if (!companies.length && !accessibleBranches.length) return false;

    // Older Core versions can only prove a singleton through the complete FULL projection.
    return accessScope?.mode !== 'FULL' ||
      companies.length !== 1 ||
      !this.companies().has(companies[0]) ||
      accessibleBranches.length !== 1 ||
      this.branchCompanies().size !== 1;
  });

  readonly selection = computed<TenantSelection | null>(() => {
    const account = this.me()?.id;
    if (!account) return null;
    const local = this.localSelection();
    const saved = local?.account === account ? local.scope : readSelection(account);
    if (saved) return this.isSelectable(saved) ? saved : null;

    const companies = this.selectorCompanyIds();
    if (companies.length !== 1) return null;
    const companyId = companies[0];
    const branches = this.branchesFor(companyId);
    return { companyId, branchId: branches.length === 1 ? branches[0] : null };
  });

  branchesFor(companyId: string): string[] {
    return Array.from(this.branchCompanies(), ([branch, company]) => company === companyId ? branch : null)
      .filter((branch): branch is string => branch !== null);
  }

  selectCompany(companyId: string): void {
    if (!this.selectorCompanyIds().includes(companyId)) return;
    if (this.selection()?.companyId === companyId) return;
    const branches = this.branchesFor(companyId);
    this.select({ companyId, branchId: branches.length === 1 ? branches[0] : null });
  }

  selectBranch(branchId: string): void {
    const companyId = this.selection()?.companyId;
    if (companyId && this.branchCompanies().get(branchId) === companyId) {
      this.select({ companyId, branchId });
    }
  }

  private isSelectable({ companyId, branchId }: TenantSelection): boolean {
    return this.selectorCompanyIds().includes(companyId) &&
      (branchId === null || this.branchCompanies().get(branchId) === companyId);
  }

  private select(scope: TenantSelection): void {
    const account = this.me()?.id;
    if (!account || !this.isSelectable(scope)) return;
    this.localSelection.set({ account, scope });
    try {
      sessionStorage.setItem(STORAGE_PREFIX + account, JSON.stringify(scope));
    } catch {
      // Selection remains available in memory for browsers that block storage.
    }
  }
}

function readSelection(account: string): TenantSelection | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_PREFIX + account);
    if (!raw) return null;
    const selection = JSON.parse(raw) as Partial<TenantSelection> | null;
    if (!selection || typeof selection.companyId !== 'string') return null;
    if (selection.branchId !== null && typeof selection.branchId !== 'string') return null;
    return { companyId: selection.companyId, branchId: selection.branchId };
  } catch {
    return null;
  }
}
