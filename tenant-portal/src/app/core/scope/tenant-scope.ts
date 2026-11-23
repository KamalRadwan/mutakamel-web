import { computed, effect, inject, Service, signal, untracked } from '@angular/core';
import { AuthSession } from '../auth/auth-session';

export interface TenantResourceScope {
  companyId?: string | null;
  branchId?: string | null;
}

interface TenantSelection {
  companyId: string;
  branchId: string | null;
}

interface StoredSelection extends TenantSelection {
  branchByCompany: Record<string, string>;
}

const STORAGE_PREFIX = 'tenant-staff-scope:';

/** Shared authenticated context for Staff, CRM, Trade and Templates. */
@Service()
export class TenantScopeState {
  private readonly authSession = inject(AuthSession);
  private readonly localSelection = signal<{ account: string; scope: StoredSelection } | null>(null);

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
    const saved = this.savedSelection(account);
    if (saved) return this.isSelectable(saved)
      ? { companyId: saved.companyId, branchId: saved.branchId } : null;

    const companies = this.selectorCompanyIds();
    if (companies.length !== 1) return null;
    const companyId = companies[0];
    const branches = this.branchesFor(companyId);
    return { companyId, branchId: branches.length === 1 ? branches[0] : null };
  });

  constructor() {
    let previousAccount: string | null = null;
    effect(() => {
      const account = this.me()?.id ?? null;
      this.selectorCompanyIds();
      this.branchCompanies();
      untracked(() => {
        if (previousAccount && previousAccount !== account) {
          clearSelection(previousAccount);
          if (this.localSelection()?.account === previousAccount) this.localSelection.set(null);
        }
        previousAccount = account;
        if (!account) return;
        const saved = this.savedSelection(account);
        if (!saved) {
          const initial = this.selection();
          if (initial) this.save(account, {
            ...initial,
            branchByCompany: initial.branchId ? { [initial.companyId]: initial.branchId } : {},
          });
          return;
        }
        if (!this.isSelectable(saved)) {
          clearSelection(account);
          this.localSelection.set(null);
          return;
        }
        const branchByCompany = this.allowedBranches(saved.branchByCompany);
        if (JSON.stringify(branchByCompany) !== JSON.stringify(saved.branchByCompany)) {
          this.save(account, { ...saved, branchByCompany });
        }
      });
    });
  }

  branchesFor(companyId: string): string[] {
    return Array.from(this.branchCompanies(), ([branch, company]) => company === companyId ? branch : null)
      .filter((branch): branch is string => branch !== null);
  }

  selectCompany(companyId: string): void {
    if (!this.selectorCompanyIds().includes(companyId)) return;
    if (this.selection()?.companyId === companyId) return;
    const account = this.me()?.id;
    const remembered = account ? this.savedSelection(account)?.branchByCompany[companyId] : undefined;
    const branches = this.branchesFor(companyId);
    const branchId = remembered && branches.includes(remembered)
      ? remembered : branches.length === 1 ? branches[0] : null;
    this.select({ companyId, branchId });
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
    const branchByCompany = this.allowedBranches(this.savedSelection(account)?.branchByCompany ?? {});
    if (scope.branchId) branchByCompany[scope.companyId] = scope.branchId;
    this.save(account, { ...scope, branchByCompany });
  }

  private savedSelection(account: string): StoredSelection | null {
    const local = this.localSelection();
    return local?.account === account ? local.scope : readSelection(account);
  }

  private allowedBranches(map: Record<string, string>): Record<string, string> {
    return Object.fromEntries(Object.entries(map).filter(([company, branch]) =>
      this.branchCompanies().get(branch) === company));
  }

  private save(account: string, scope: StoredSelection): void {
    this.localSelection.set({ account, scope });
    writeSelection(() => sessionStorage, account, scope);
    writeSelection(() => localStorage, account, scope);
  }
}

function readSelection(account: string): StoredSelection | null {
  const tab = readSelectionFrom(() => sessionStorage, account);
  if (tab) return tab;
  const general = readSelectionFrom(() => localStorage, account);
  if (general) writeSelection(() => sessionStorage, account, general);
  return general;
}

function readSelectionFrom(getStorage: () => Storage, account: string): StoredSelection | null {
  try {
    const raw = getStorage().getItem(STORAGE_PREFIX + account);
    if (!raw) return null;
    const selection: unknown = JSON.parse(raw);
    if (!selection || typeof selection !== 'object' || Array.isArray(selection) ||
        !('companyId' in selection) || typeof selection.companyId !== 'string' ||
        !('branchId' in selection)) return null;
    if (selection.branchId !== null && typeof selection.branchId !== 'string') return null;
    const rawMap = 'branchByCompany' in selection ? selection.branchByCompany : null;
    const branchByCompany = rawMap && typeof rawMap === 'object' && !Array.isArray(rawMap)
      ? Object.fromEntries(Object.entries(rawMap).filter((entry): entry is [string, string] =>
        typeof entry[1] === 'string')) : {};
    if (selection.branchId) branchByCompany[selection.companyId] = selection.branchId;
    return { companyId: selection.companyId, branchId: selection.branchId, branchByCompany };
  } catch {
    return null;
  }
}

function writeSelection(getStorage: () => Storage, account: string, scope: StoredSelection): void {
  try {
    getStorage().setItem(STORAGE_PREFIX + account, JSON.stringify(scope));
  } catch {
    // Selection remains available in memory when browser storage is blocked.
  }
}

function clearSelection(account: string): void {
  for (const getStorage of [() => sessionStorage, () => localStorage]) {
    try {
      getStorage().removeItem(STORAGE_PREFIX + account);
    } catch {
      // Logout and revocation must still clear the in-memory selection.
    }
  }
}
