import { Service, computed, signal } from '@angular/core';
import { FAKE_COMPANIES } from './scope.fake';

export interface ScopeBranch {
  id: string;
  nameEn: string;
  nameAr: string;
}

export interface ScopeCompany {
  id: string;
  nameEn: string;
  nameAr: string;
  /** Base currency of the company (ISO 4217). */
  currencyCode?: string;
  branches: readonly ScopeBranch[];
}

interface StoredScope {
  companyId: string;
  branchByCompany: Record<string, string>;
}

const STORAGE_KEY = 'scope';

@Service()
export class ScopeState {
  readonly companies = signal<readonly ScopeCompany[]>(FAKE_COMPANIES);

  private readonly initial = readStored(this.companies());
  private readonly companyId = signal<string>(this.initial.companyId);
  private readonly branchByCompany = signal<Record<string, string>>(this.initial.branchByCompany);

  readonly company = computed<ScopeCompany>(
    () => this.companies().find((item) => item.id === this.companyId()) ?? this.companies()[0],
  );

  readonly branches = computed<readonly ScopeBranch[]>(() => this.company().branches);

  readonly branch = computed<ScopeBranch>(() => {
    const currentCompany = this.company();
    const rememberedId = this.branchByCompany()[currentCompany.id];
    return currentCompany.branches.find((item) => item.id === rememberedId) ?? currentCompany.branches[0];
  });

  readonly hasChoice = computed(() => {
    const list = this.companies();
    return list.length > 1 || list.reduce((count, item) => count + item.branches.length, 0) > 1;
  });

  selectCompany(id: string) {
    const target = this.companies().find((item) => item.id === id);
    if (!target) return;
    const rememberedId = this.branchByCompany()[target.id];
    const branchId = target.branches.some((item) => item.id === rememberedId)
      ? rememberedId
      : target.branches[0]?.id;
    this.companyId.set(target.id);
    if (branchId) {
      this.branchByCompany.update((map) => ({ ...map, [target.id]: branchId }));
    }
    this.persist();
  }

  selectBranch(id: string) {
    const currentCompany = this.company();
    if (!currentCompany.branches.some((item) => item.id === id)) return;
    this.branchByCompany.update((map) => ({ ...map, [currentCompany.id]: id }));
    this.persist();
  }

  private persist() {
    const payload: StoredScope = {
      companyId: this.company().id,
      branchByCompany: this.branchByCompany(),
    };
    writeStored(() => sessionStorage, payload);
    writeStored(() => localStorage, payload);
  }
}

function readStored(companies: readonly ScopeCompany[]): StoredScope {
  const fromTab = readStoredFrom(() => sessionStorage, companies);
  if (fromTab) return fromTab;

  const fromGeneral = readStoredFrom(() => localStorage, companies);
  if (fromGeneral) {
    writeStored(() => sessionStorage, fromGeneral);
    return fromGeneral;
  }

  const firstCompany = companies[0];
  const firstBranch = firstCompany.branches[0];
  const fallback: StoredScope = {
    companyId: firstCompany.id,
    branchByCompany: { [firstCompany.id]: firstBranch.id },
  };
  writeStored(() => sessionStorage, fallback);
  writeStored(() => localStorage, fallback);
  return fallback;
}

function readStoredFrom(getStorage: () => Storage, companies: readonly ScopeCompany[]): StoredScope | null {
  try {
    const raw = getStorage().getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredScope>;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    if (typeof parsed.companyId !== 'string') return null;

    const matchedCompany = companies.find((item) => item.id === parsed.companyId);
    const rawMap =
      parsed.branchByCompany &&
      typeof parsed.branchByCompany === 'object' &&
      !Array.isArray(parsed.branchByCompany)
        ? (parsed.branchByCompany as Record<string, unknown>)
        : {};
    const branchByCompany: Record<string, string> = {};
    let hasValidBranch = false;
    for (const comp of companies) {
      const candidate = rawMap[comp.id];
      if (typeof candidate === 'string' && comp.branches.some((b) => b.id === candidate)) {
        branchByCompany[comp.id] = candidate;
        hasValidBranch = true;
      }
    }

    if (!matchedCompany && !hasValidBranch) return null;

    const company = matchedCompany ?? companies[0];
    if (!branchByCompany[company.id]) {
      branchByCompany[company.id] = company.branches[0].id;
    }
    return {
      companyId: company.id,
      branchByCompany,
    };
  } catch {
    return null;
  }
}

function writeStored(getStorage: () => Storage, payload: StoredScope): void {
  try {
    getStorage().setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Storage unavailable or quota exceeded
  }
}
