import { Injectable, computed, resource, signal } from '@angular/core';
import { ApiError } from '../../settings/shared/settings-api';
import { listTags } from '../../settings/tags/tags.api';
import {
  canManageTags,
  getLeadCapabilities,
  listBranchOwners,
  listLeadBranches,
  listLeadCurrencies,
  listLeadCustomFields,
  listLeadSources,
  listLeadStages,
} from '../leads.api';
import {
  BranchOption,
  CurrencyOption,
  LeadsCapabilities,
  LeadCustomField,
  LeadStage,
  LeadTag,
  OwnerOption,
  SourceOption,
} from '../leads.model';

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

async function loadCapabilities(branchId: string): Promise<LeadsCapabilities | null> {
  try {
    return await getLeadCapabilities(branchId);
  } catch {
    return null;
  }
}

@Injectable()
export class LeadLookups {
  private readonly branchId = signal<string | null>(null);
  private readonly mode = signal<'create' | 'edit'>('create');
  private readonly addedTags = signal<LeadTag[]>([]);

  private readonly branchesResource = resource({
    loader: () => loadList(listLeadBranches),
  });

  private readonly stagesResource = resource({
    loader: () => loadList(listLeadStages),
  });

  private readonly sourcesResource = resource({
    loader: () => loadNullable(listLeadSources),
  });

  private readonly tagsResource = resource({
    loader: () => loadNullable(listTags),
  });

  private readonly currenciesResource = resource({
    loader: () => loadList(listLeadCurrencies),
  });

  private readonly customFieldsResource = resource({
    loader: () => loadNullable(listLeadCustomFields),
  });

  private readonly capabilitiesResource = resource({
    params: () => ({ branchId: this.branchId() }),
    loader: ({ params }) => (params.branchId ? loadCapabilities(params.branchId) : Promise.resolve(null)),
  });

  private readonly ownersResource = resource({
    params: () => ({ branchId: this.branchId(), action: this.mode() === 'edit' ? ('update' as const) : ('create' as const) }),
    loader: ({ params }) =>
      params.branchId ? loadList(() => listBranchOwners(params.branchId!, params.action)) : Promise.resolve([]),
  });

  readonly branches = computed<BranchOption[]>(() =>
    this.branchesResource.hasValue() ? this.branchesResource.value() : [],
  );

  readonly allStages = computed<LeadStage[]>(() =>
    this.stagesResource.hasValue() ? this.stagesResource.value() : [],
  );

  readonly stages = computed<LeadStage[]>(() =>
    this.allStages().filter((stage) => stage.isActive && stage.flag !== 'DISQUALIFIED' && stage.flag !== 'CONVERTED'),
  );

  readonly sources = computed<SourceOption[] | null>(() =>
    this.sourcesResource.hasValue() ? this.sourcesResource.value() : [],
  );

  readonly tags = computed<LeadTag[] | null>(() => {
    const base = this.tagsResource.hasValue() ? this.tagsResource.value() : [];
    if (base === null) return null;
    const extra = this.addedTags().filter((tag) => !base.some((item) => item.id === tag.id));
    return [...base, ...extra];
  });

  readonly canCreateTag = signal(canManageTags()).asReadonly();

  readonly currencies = computed<CurrencyOption[]>(() =>
    this.currenciesResource.hasValue() ? this.currenciesResource.value() : [],
  );

  readonly customFields = computed<LeadCustomField[] | null>(() =>
    this.customFieldsResource.hasValue() ? this.customFieldsResource.value() : [],
  );

  readonly capabilities = computed<LeadsCapabilities | null>(() =>
    this.capabilitiesResource.hasValue() ? this.capabilitiesResource.value() : null,
  );

  readonly owners = computed<OwnerOption[]>(() => {
    const raw = this.ownersResource.hasValue() ? this.ownersResource.value() : [];
    const caps = this.capabilities();
    if (!caps) return [];
    const scope = caps.leads[this.mode() === 'edit' ? 'update' : 'create'];
    if (!scope) return [];
    if (!scope.ownerUserIds) return raw;
    const allowed = new Set(scope.ownerUserIds);
    return raw.filter((owner) => allowed.has(owner.id));
  });

  setBranch(branchId: string | null): void {
    this.branchId.set(branchId);
  }

  setMode(mode: 'create' | 'edit'): void {
    this.mode.set(mode);
  }

  addTag(tag: LeadTag): void {
    this.addedTags.update((list) => [...list.filter((item) => item.id !== tag.id), tag]);
  }
}
