import { Service, computed, inject, signal } from '@angular/core';
import { TenantScopeState } from './tenant-scope';

export interface ScopeBranch {
  id: string;
  nameEn: string;
  nameAr: string;
}

export interface ScopeCompany {
  id: string;
  nameEn: string;
  nameAr: string;
  /** Base currency, only when supplied by an authenticated organization projection. */
  currencyCode?: string;
  branches: readonly ScopeBranch[];
}

/** Compatibility facade: every consumer shares the authenticated selection. */
@Service()
export class ScopeState {
  private readonly tenantScope = inject(TenantScopeState);

  // NB-04 is missing: /auth/me supplies IDs, while /organization/tree requires
  // org.company.read and supplies no currency. Keep named pickers unavailable
  // until a self-service projection exists; never turn IDs into display labels.
  readonly companies = signal<readonly ScopeCompany[]>([]).asReadonly();
  readonly branches = signal<readonly ScopeBranch[]>([]).asReadonly();

  // Preserve the synchronous facade for existing callers. Empty IDs mean no
  // selection; empty names mean metadata is unavailable, not a translated name.
  readonly company = computed<ScopeCompany>(() => {
    const id = this.tenantScope.selection()?.companyId ?? '';
    return {
      id,
      nameEn: '',
      nameAr: '',
      branches: this.tenantScope.branchesFor(id).map((branchId) => ({
        id: branchId, nameEn: '', nameAr: '',
      })),
    };
  });

  readonly branch = computed<ScopeBranch>(() => ({
    id: this.tenantScope.selection()?.branchId ?? '', nameEn: '', nameAr: '',
  }));

  readonly hasChoice = this.tenantScope.showScopeSwitcher;

  selectCompany(id: string): void {
    this.tenantScope.selectCompany(id);
  }

  selectBranch(id: string): void {
    this.tenantScope.selectBranch(id);
  }
}
