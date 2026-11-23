import { Injectable, computed, inject, resource, signal } from '@angular/core';
import { hasTenantWidePermission } from '../../../../core/auth/tenant-wide-permission';
import { TenantScopeState } from '../../../../core/scope/tenant-scope';
import { can } from '../../../../shared/widgets/dashboard/analytics-permissions';
import { sessionBranch } from '../../shared/lookups/session-branch';
import type { ScopeCompany, ScopeBranch } from '../../../../core/scope/scope';
import { ApiError } from '../../settings/shared/settings-api';
import { listTags } from '../../settings/tags/tags.api';
import {
  canManageTags as checkCanManageTags,
  getOpportunityCapabilities,
  listBranches,
  listCurrencies,
  listCustomerContacts,
  listOpportunityCustomFields,
  listOwners,
  listPipelines,
} from '../opportunities.api';
import type {
  BranchOption,
  CurrencyOption,
  CustomFieldDef,
  CustomerContactOption,
  OpportunityCapabilities,
  OpportunityTag,
  OwnerOption,
  PipelineView,
} from '../opportunities.model';

/** Tags are optional for the user: 403 means "no tag access" (null). Any other failure is surfaced. */
async function loadNullableList<T>(loader: () => Promise<T[]>): Promise<T[] | null> {
  try {
    return await loader();
  } catch (error) {
    if (error instanceof ApiError && error.status === 403) return null;
    throw error;
  }
}

/** Edit and view flows ask for owners with action=update; only the create flow uses action=create. */
function ownersAction(mode: 'create' | 'edit' | 'view'): 'create' | 'update' {
  return mode === 'create' ? 'create' : 'update';
}

@Injectable()
export class OpportunityLookups {
  private readonly tenantScope = inject(TenantScopeState);
  readonly customerDenied = signal(!can('crm.customer_profiles.read'));
  readonly currencyAllowed = computed(() => hasTenantWidePermission(this.tenantScope.me(), 'currencies.currency.read'));
  readonly selectedBranch = computed(() => {
    this.tenantScope.selection();
    return sessionBranch();
  });
  private readonly activeBranchId = signal<string | null>(null);
  private readonly mode = signal<'create' | 'edit' | 'view'>('create');
  private readonly customerProfileId = signal<string | null>(null);
  private readonly addedTags = signal<OpportunityTag[]>([]);

  private readonly ownersByBranch = signal<Record<string, OwnerOption[]>>({});
  private readonly ownersLoadingByBranch = signal<Record<string, boolean>>({});
  private readonly ownersFailedByBranch = signal<Record<string, boolean>>({});
  private readonly ownersRequested = new Set<string>();
  private ownersGeneration = 0;

  private readonly capabilitiesByBranch = signal<Record<string, OpportunityCapabilities | null>>({});
  private readonly capabilitiesFailedByBranch = signal<Record<string, boolean>>({});
  private readonly capabilitiesRequested = new Set<string>();

  private readonly pipelinesResource = resource({
    params: () => this.selectedBranch() ?? undefined,
    loader: () => listPipelines(),
  });

  private readonly currenciesResource = resource({
    params: () => this.selectedBranch() ?? undefined,
    loader: () => listCurrencies(),
  });

  private readonly branchesResource = resource({
    params: () => this.selectedBranch() ?? undefined,
    loader: () => listBranches(),
  });

  private readonly customFieldsResource = resource({
    params: () => this.selectedBranch() ?? undefined,
    loader: () => listOpportunityCustomFields(),
  });

  private readonly tagsResource = resource({
    params: () => this.selectedBranch() ?? undefined,
    loader: () => loadNullableList(listTags),
  });

  private readonly contactsResource = resource({
    params: () => this.selectedBranch() ? { customerProfileId: this.customerProfileId() } : undefined,
    loader: ({ params }) =>
      params.customerProfileId ? listCustomerContacts(params.customerProfileId) : Promise.resolve([]),
  });

  readonly pipelines = computed<PipelineView[]>(() =>
    this.pipelinesResource.hasValue() ? this.pipelinesResource.value().filter((p) => p.isActive) : [],
  );

  readonly defaultPipeline = computed<PipelineView | null>(() => {
    const list = this.pipelines();
    return list.find((p) => p.isDefault) ?? list[0] ?? null;
  });

  readonly currencies = computed<CurrencyOption[]>(() =>
    this.currenciesResource.hasValue() ? this.currenciesResource.value() : [],
  );

  readonly defaultCurrency = computed<string | null>(() => {
    const list = this.currencies();
    return (list.find((c) => c.isDefault) ?? list[0])?.code ?? null;
  });

  readonly branches = computed<BranchOption[]>(() =>
    this.branchesResource.hasValue() ? this.branchesResource.value() : [],
  );

  // /me owns the IDs; catalogue names are optional and never widen the selected scope.
  readonly scope = {
    companies: computed<readonly ScopeCompany[]>(() => this.tenantScope.selectorCompanyIds().map((id) => {
      const branches = this.tenantScope.branchesFor(id).map((branchId) => {
        const name = this.branches().find((branch) => branch.id === branchId)?.name ?? branchId;
        return { id: branchId, nameEn: name, nameAr: name };
      });
      const name = this.branches().find((branch) => this.tenantScope.branchCompanies().get(branch.id) === id)?.companyName || id;
      return { id, nameEn: name, nameAr: name, branches };
    })),
    company: (): ScopeCompany => this.scope.companies().find((company) => company.id === this.tenantScope.selection()?.companyId)
      ?? { id: '', nameEn: '', nameAr: '', branches: [] },
    branch: (): ScopeBranch => this.scope.company().branches.find((branch) => branch.id === this.tenantScope.selection()?.branchId)
      ?? { id: '', nameEn: '', nameAr: '' },
  };

  readonly customFields = computed<CustomFieldDef[]>(() =>
    this.customFieldsResource.hasValue() ? this.customFieldsResource.value() : [],
  );

  readonly tags = computed<OpportunityTag[] | null>(() => {
    const base = this.tagsResource.hasValue() ? this.tagsResource.value() : [];
    if (base === null) return null;
    const extra = this.addedTags().filter((tag) => !base.some((item) => item.id === tag.id));
    return [...base, ...extra];
  });

  readonly canManageTags = signal(checkCanManageTags()).asReadonly();

  readonly contacts = computed<CustomerContactOption[]>(() =>
    this.contactsResource.hasValue() ? this.contactsResource.value() : [],
  );

  readonly contactsLoading = computed<boolean>(() => this.contactsResource.isLoading());

  // Load failures. Each one is shown under the affected field with a Retry action.
  readonly pipelinesDenied = computed(() => this.isDenied(this.pipelinesResource.error()));
  readonly customFieldsDenied = computed(() => this.isDenied(this.customFieldsResource.error()));
  readonly contactsDenied = computed(() => this.isDenied(this.contactsResource.error()));
  readonly pipelinesFailed = computed(() => this.pipelinesResource.status() === 'error' && !this.pipelinesDenied());
  readonly currenciesFailed = computed(() => this.currenciesResource.status() === 'error');
  readonly branchesFailed = computed(() => this.branchesResource.status() === 'error');
  readonly customFieldsFailed = computed(() => this.customFieldsResource.status() === 'error' && !this.customFieldsDenied());
  readonly customFieldsLoading = computed(() => this.customFieldsResource.isLoading());
  readonly tagsFailed = computed(() => this.tagsResource.status() === 'error');
  readonly contactsFailed = computed(() => this.contactsResource.status() === 'error' && !this.contactsDenied());

  /**
   * Non-null when the form must not be saved: without the custom-field definitions the
   * required checks cannot run, so hosts must block save and show this message key.
   */
  readonly saveBlockedReason = computed<string | null>(() => {
    if (!this.selectedBranch()) return 'oppForm.lookups.chooseBranch';
    if (this.mode() === 'create' && this.customerDenied()) return 'oppForm.lookups.denied';
    if (this.mode() === 'create' && this.pipelinesDenied()) return 'oppForm.lookups.denied';
    if (this.customFieldsDenied()) return 'oppForm.lookups.denied';
    if (this.customFieldsFailed()) return 'oppForm.lookups.customFieldsBlocked';
    if (this.customFieldsLoading()) return 'oppForm.lookups.customFieldsLoading';
    return null;
  });

  private isDenied(error: unknown): boolean {
    return error instanceof ApiError && error.status === 403;
  }

  reloadPipelines(): void {
    this.pipelinesResource.reload();
  }

  reloadCurrencies(): void {
    this.currenciesResource.reload();
  }

  reloadBranches(): void {
    this.branchesResource.reload();
  }

  reloadCustomFields(): void {
    this.customFieldsResource.reload();
  }

  reloadTags(): void {
    this.tagsResource.reload();
  }

  reloadContacts(): void {
    this.contactsResource.reload();
  }

  /** Owners or the branch capabilities (which filter the owners) failed to load. */
  ownersFailed(branchId?: string | null): boolean {
    const resolvedId = branchId !== undefined ? branchId : this.activeBranchId();
    if (!resolvedId) return false;
    return Boolean(this.ownersFailedByBranch()[resolvedId] || this.capabilitiesFailedByBranch()[resolvedId]);
  }

  retryOwners(branchId?: string | null): void {
    const resolvedId = branchId !== undefined ? branchId : this.activeBranchId();
    if (!resolvedId) return;
    if (this.ownersFailedByBranch()[resolvedId]) {
      this.ownersRequested.delete(resolvedId);
      this.ensureOwnersLoaded(resolvedId);
    }
    if (this.capabilitiesFailedByBranch()[resolvedId]) {
      this.capabilitiesRequested.delete(resolvedId);
      this.ensureCapabilitiesLoaded(resolvedId);
    }
  }

  pipeline(id: string | null | undefined): PipelineView | null {
    if (!id) return null;
    return this.pipelines().find((item) => item.id === id) ?? null;
  }

  owners(branchId?: string | null): OwnerOption[] {
    const resolvedId = branchId !== undefined ? branchId : this.activeBranchId();
    if (!resolvedId) return [];
    this.ensureOwnersLoaded(resolvedId);
    return this.ownersByBranch()[resolvedId] ?? [];
  }

  assignableOwners(branchId?: string | null): OwnerOption[] {
    const resolvedId = branchId !== undefined ? branchId : this.activeBranchId();
    if (!resolvedId) return [];
    const raw = this.owners(resolvedId);
    const caps = this.capabilities(resolvedId);
    if (!caps) return [];
    const scope = caps[ownersAction(this.mode())];
    if (!scope) return [];
    if (!scope.ownerUserIds) return raw;
    const allowed = new Set(scope.ownerUserIds);
    return raw.filter((owner) => allowed.has(owner.id));
  }

  ownersLoading(branchId?: string | null): boolean {
    const resolvedId = branchId !== undefined ? branchId : this.activeBranchId();
    if (!resolvedId) return false;
    return Boolean(this.ownersLoadingByBranch()[resolvedId]);
  }

  capabilities(branchId?: string | null): OpportunityCapabilities | null {
    const resolvedId = branchId !== undefined ? branchId : this.activeBranchId();
    if (!resolvedId) return null;
    this.ensureCapabilitiesLoaded(resolvedId);
    return this.capabilitiesByBranch()[resolvedId] ?? null;
  }

  setBranch(branchId: string | null): void {
    this.activeBranchId.set(branchId);
    if (branchId) {
      this.ensureOwnersLoaded(branchId);
      this.ensureCapabilitiesLoaded(branchId);
    }
  }

  setMode(mode: 'create' | 'edit' | 'view'): void {
    const actionChanged = ownersAction(mode) !== ownersAction(this.mode());
    this.mode.set(mode);
    if (actionChanged) this.resetOwners();
  }

  /** The owners list depends on the action (create or update), so a mode switch reloads it. */
  private resetOwners(): void {
    this.ownersGeneration++;
    this.ownersRequested.clear();
    this.ownersByBranch.set({});
    this.ownersLoadingByBranch.set({});
    this.ownersFailedByBranch.set({});
    const branchId = this.activeBranchId();
    if (branchId) this.ensureOwnersLoaded(branchId);
  }

  setCustomerProfile(customerProfileId: string | null): void {
    this.customerProfileId.set(customerProfileId);
  }

  addTag(tag: OpportunityTag): void {
    this.addedTags.update((list) => [...list.filter((item) => item.id !== tag.id), tag]);
  }

  private ensureOwnersLoaded(branchId: string): void {
    if (this.ownersRequested.has(branchId)) return;
    this.ownersRequested.add(branchId);
    const generation = this.ownersGeneration;
    queueMicrotask(() => {
      if (generation !== this.ownersGeneration) return;
      this.ownersLoadingByBranch.update((map) => ({ ...map, [branchId]: true }));
      this.ownersFailedByBranch.update((map) => ({ ...map, [branchId]: false }));
      void listOwners(branchId, ownersAction(this.mode()))
        .then((items) => {
          if (generation !== this.ownersGeneration) return;
          this.ownersByBranch.update((map) => ({ ...map, [branchId]: items }));
        })
        .catch(() => {
          if (generation !== this.ownersGeneration) return;
          this.ownersFailedByBranch.update((map) => ({ ...map, [branchId]: true }));
        })
        .finally(() => {
          if (generation !== this.ownersGeneration) return;
          this.ownersLoadingByBranch.update((map) => ({ ...map, [branchId]: false }));
        });
    });
  }

  private ensureCapabilitiesLoaded(branchId: string): void {
    if (this.capabilitiesRequested.has(branchId)) return;
    this.capabilitiesRequested.add(branchId);
    queueMicrotask(() => {
      this.capabilitiesFailedByBranch.update((map) => ({ ...map, [branchId]: false }));
      void getOpportunityCapabilities(branchId)
        .then((caps) => {
          this.capabilitiesByBranch.update((map) => ({ ...map, [branchId]: caps }));
        })
        .catch((error: unknown) => {
          this.capabilitiesByBranch.update((map) => ({ ...map, [branchId]: null }));
          // 403 is a real answer (no access), not a load failure.
          const failed = !(error instanceof ApiError && error.status === 403);
          this.capabilitiesFailedByBranch.update((map) => ({ ...map, [branchId]: failed }));
        });
    });
  }
}
