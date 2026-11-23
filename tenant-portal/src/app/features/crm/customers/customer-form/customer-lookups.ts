import { Injectable, computed, inject, resource, signal } from '@angular/core';
import { TenantScopeState } from '../../../../core/scope/tenant-scope';
import { can } from '../../../../shared/widgets/dashboard/analytics-permissions';
import { GeoCountry } from '../../../../core/geo/geo.model';
import { ApiError } from '../../settings/shared/settings-api';
import {
  getCustomerCapabilities,
} from '../customers.api';
import {
  canManageFormStatus, listFormBranches as listBranches, listFormOwners,
  listFormCustomFields as listCustomerCustomFields, listFormStatuses as listCustomerStatusOptions,
  listFormSources as listSources, listFormTags as listTags, listFormCurrencies, listFormCountries,
} from './customer-lookups.api';
import {
  BranchOption,
  CustomerCapabilities,
  CustomerCustomField,
  CustomerStatusOption,
  OwnerOption,
  SourceOption,
  TagSummary,
} from '../customers.model';

async function loadList<T>(loader: () => Promise<T[]>): Promise<T[]> {
  try {
    return await loader();
  } catch {
    return [];
  }
}

async function loadNullable<T>(loader: () => Promise<T[]>): Promise<T[] | null> {
  try {
    return await loader();
  } catch (error) {
    return error instanceof ApiError && error.status === 403 ? null : [];
  }
}

async function loadCapabilities(branchId: string): Promise<CustomerCapabilities | null> {
  if (!can('crm.customer_profiles.read')) return null;
  try {
    return await getCustomerCapabilities(branchId);
  } catch {
    return null;
  }
}

@Injectable()
export class CustomerLookups {
  private readonly tenant = inject(TenantScopeState);
  private readonly branchId = signal<string | null>(null);
  private readonly mode = signal<'create' | 'edit' | 'view'>('create');
  private readonly addedTags = signal<TagSummary[]>([]);

  private readonly branchesResource = resource({
    params: () => this.tenant.selection(),
    loader: () => loadList(listBranches),
  });

  private readonly sourcesResource = resource({
    loader: () => loadNullable(listSources),
  });

  private readonly tagsResource = resource({
    loader: () => loadNullable(listTags),
  });

  private readonly statusOptionsResource = resource({
    loader: () => loadNullable(listCustomerStatusOptions),
  });

  private readonly customFieldsResource = resource({
    loader: () => loadNullable(listCustomerCustomFields),
  });

  private readonly countriesResource = resource({
    loader: listFormCountries,
  });
  private readonly currenciesResource = resource({ loader: listFormCurrencies });
  readonly currencies = computed(() => this.currenciesResource.hasValue() ? this.currenciesResource.value() : []);
  readonly geoFailed = computed(() => this.countriesResource.error() !== undefined);
  readonly loading = computed(() => this.branchesResource.isLoading() || this.statusOptionsResource.isLoading()
    || this.customFieldsResource.isLoading() || this.capabilitiesResource.isLoading());
  readonly customFieldsUnavailable = computed(() => this.customFieldsResource.hasValue() && this.customFieldsResource.value() === null);

  private readonly capabilitiesResource = resource({
    params: () => ({ branchId: this.branchId() }),
    loader: ({ params }) => (params.branchId ? loadCapabilities(params.branchId) : Promise.resolve(null)),
  });

  private readonly ownersResource = resource({
    params: () => ({ branchId: this.branchId(), mode: this.mode() }),
    loader: ({ params }) => (params.branchId ? loadNullable(() => listFormOwners(params.branchId!, params.mode === 'create' ? 'create' : 'update')) : Promise.resolve([])),
  });

  readonly branches = computed<BranchOption[]>(() =>
    this.branchesResource.hasValue() ? this.branchesResource.value() : [],
  );

  readonly allSources = computed<SourceOption[] | null>(() =>
    this.sourcesResource.hasValue() ? this.sourcesResource.value() : [],
  );

  readonly sources = computed<SourceOption[] | null>(() => {
    const raw = this.allSources();
    if (raw === null) return null;
    return raw.filter((source) => source.isActive);
  });

  readonly tags = computed<TagSummary[] | null>(() => {
    const base = this.tagsResource.hasValue() ? this.tagsResource.value() : [];
    if (base === null) return null;
    const extra = this.addedTags().filter((tag) => !base.some((item) => item.id === tag.id));
    return [...base, ...extra];
  });

  readonly statusOptions = computed<CustomerStatusOption[]>(() =>
    (this.statusOptionsResource.hasValue() ? this.statusOptionsResource.value() : []) ?? [],
  );
  readonly statusUnavailable = computed(() => this.statusOptionsResource.hasValue() && this.statusOptionsResource.value() === null);

  readonly customFields = computed<CustomerCustomField[] | null>(() =>
    this.customFieldsResource.hasValue() ? this.customFieldsResource.value() : [],
  );

  readonly countries = computed<GeoCountry[]>(() =>
    this.countriesResource.hasValue() ? this.countriesResource.value() : [],
  );

  readonly capabilities = computed<CustomerCapabilities | null>(() =>
    this.capabilitiesResource.hasValue() ? this.capabilitiesResource.value() : null,
  );

  readonly ownersLoading = computed(() => this.ownersResource.isLoading());

  readonly canManageStatus = computed(() => { this.tenant.me(); return canManageFormStatus(); });
  readonly canCreateTag = computed(() => { this.tenant.me(); return can('crm.tags.manage'); });
  readonly ownersUnavailable = computed(() => this.ownersResource.hasValue() && this.ownersResource.value() === null);

  readonly canCreate = computed(() => (this.capabilities()?.customerProfiles.create ?? null) !== null);
  readonly canUpdate = computed(() => (this.capabilities()?.customerProfiles.update ?? null) !== null);
  readonly canDelete = computed(() => (this.capabilities()?.customerProfiles.delete ?? null) !== null);

  readonly owners = computed<OwnerOption[]>(() => {
    const raw = (this.ownersResource.hasValue() ? this.ownersResource.value() : []) ?? [];
    const caps = this.capabilities();
    if (!caps) return [];
    const scope = this.mode() === 'create' ? caps.customerProfiles.create : caps.customerProfiles.update;
    if (!scope) return [];
    if (!scope.ownerUserIds) return raw;
    const allowed = new Set(scope.ownerUserIds);
    return raw.filter((owner) => allowed.has(owner.userId));
  });

  setBranch(branchId: string | null): void {
    this.branchId.set(branchId);
  }

  setMode(mode: 'create' | 'edit' | 'view'): void {
    this.mode.set(mode);
  }

  addTag(tag: TagSummary): void {
    this.addedTags.update((list) => [...list.filter((item) => item.id !== tag.id), tag]);
  }

  retryGeo(): void { this.countriesResource.reload(); }
}
