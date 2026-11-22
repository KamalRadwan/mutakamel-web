import { Component, computed, effect, inject, input, model, output, signal, untracked } from '@angular/core';
import { translationEvents } from '../../../../../../core/i18n/translation-events';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerAlertCircle, tablerX } from '@ng-icons/tabler-icons';
import { GeoCountry } from '../../../../../../core/geo/geo.model';
import { LanguageState } from '../../../../../../core/i18n/language';
import { ScopeBranch, ScopeCompany, ScopeState } from '../../../../../../core/scope/scope';
import { DateField } from '../../../../../../shared/ui/date-time/date-field';
import { Dropdown, DropdownOption } from '../../../../../../shared/ui/dropdown/dropdown';
import { Field } from '../../../../../../shared/ui/field/field';
import { toAsciiDigits } from '../../../../../../shared/ui/phone-input/phone';
import { RECORD_PAGE_GRID, RecordLayout } from '../../../../../../shared/ui/record-layout/record-layout';
import { TagOption, TagPicker } from '../../../../../../shared/ui/tag-picker/tag-picker';
import { RecordCustomFields } from '../../../../shared/record/custom-fields/record-custom-fields';
import { MoneyField } from '../../../../shared/record/fields/money-field/money-field';
import { OwnerField } from '../../../../shared/record/fields/owner-field/owner-field';
import { RatingColourField } from '../../../../shared/record/fields/rating-colour-field/rating-colour-field';
import {
  CurrencyOption as SharedCurrencyOption,
  Option,
  OwnerOption as SharedOwnerOption,
} from '../../../../shared/record/fields/record-fields.model';
import { ScopeFields } from '../../../../shared/record/fields/scope-fields/scope-fields';
import { StageField } from '../../../../shared/record/fields/stage-field/stage-field';
import { createTag } from '../../../../settings/tags/tags.api';
import {
  OPPORTUNITY_LIMITS,
  nameIn,
  type BranchOption,
  type CardColor,
  type OpportunityRow,
  type PipelineStageView,
  type PipelineView,
} from '../../../opportunities.model';
import {
  DraftErrors,
  OpportunityDraft,
  firstOpenStageId,
  isValidIsoDate,
  resolveOpportunityError,
} from '../../opportunity-draft';
import { LookupRetry } from '../../lookup-retry/lookup-retry';
import { OpportunityLookups } from '../../opportunity-lookups';

export interface OpportunityUpdatingState {
  stage?: boolean;
  rating?: boolean;
  color?: boolean;
}

function directBranchesForCompany(company: ScopeCompany, allBranches: readonly BranchOption[]): BranchOption[] {
  const scopeBranchIds = new Set(company.branches.map((b) => b.id));
  const enLower = company.nameEn.trim().toLowerCase();
  const ar = company.nameAr.trim();
  return allBranches.filter(
    (b) =>
      scopeBranchIds.has(b.id) ||
      (b.companyName && (b.companyName.trim().toLowerCase() === enLower || b.companyName.trim() === ar)),
  );
}

function hasAnyDirectMatch(companies: readonly ScopeCompany[], allBranches: readonly BranchOption[]): boolean {
  return companies.some((c) => directBranchesForCompany(c, allBranches).length > 0);
}

function distinctCompanyGroups(allBranches: readonly BranchOption[]): string[] {
  const groups: string[] = [];
  for (const b of allBranches) {
    if (!groups.includes(b.companyName)) groups.push(b.companyName);
  }
  return groups;
}

export function branchesForCompany(
  company: ScopeCompany,
  companies: readonly ScopeCompany[],
  allBranches: readonly BranchOption[],
): BranchOption[] {
  if (allBranches.length === 0) return [];
  const direct = directBranchesForCompany(company, allBranches);
  if (direct.length > 0 || hasAnyDirectMatch(companies, allBranches)) return direct;

  const groups = distinctCompanyGroups(allBranches);
  const idx = companies.findIndex((c) => c.id === company.id);
  if (idx >= 0 && idx < groups.length) {
    const groupName = groups[idx];
    return allBranches.filter((b) => b.companyName === groupName);
  }
  return [];
}

export function companyForBranch(
  branchId: string,
  companies: readonly ScopeCompany[],
  allBranches: readonly BranchOption[],
): ScopeCompany | null {
  const branch = allBranches.find((b) => b.id === branchId);
  if (!branch) return null;

  const direct = companies.find((c) => directBranchesForCompany(c, [branch]).length > 0);
  if (direct) return direct;

  if (!hasAnyDirectMatch(companies, allBranches)) {
    const groups = distinctCompanyGroups(allBranches);
    const groupIdx = groups.indexOf(branch.companyName);
    if (groupIdx >= 0 && groupIdx < companies.length) {
      return companies[groupIdx];
    }
  }
  return null;
}

export function pickCompanyBranchId(
  company: ScopeCompany,
  sessionCompany: ScopeCompany,
  sessionBranch: ScopeBranch,
  companies: readonly ScopeCompany[],
  allBranches: readonly BranchOption[],
): string | null {
  const companyBranches = branchesForCompany(company, companies, allBranches);
  if (companyBranches.length === 0) return null;

  const byId = companyBranches.find((b) => b.id === sessionBranch.id);
  if (byId) return byId.id;

  if (company.id === sessionCompany.id) {
    const enLower = sessionBranch.nameEn.trim().toLowerCase();
    const ar = sessionBranch.nameAr.trim();
    const byName = companyBranches.find(
      (b) => b.name.trim().toLowerCase() === enLower || b.name.trim() === ar,
    );
    if (byName) return byName.id;
  }

  return companyBranches[0].id;
}

function localTodayIso(): string {
  const now = new Date();
  const y = String(now.getFullYear()).padStart(4, '0');
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

@Component({
  selector: 'app-opp-classification-section',
  imports: [
    NgIcon,
    TranslocoPipe,
    DateField,
    Dropdown,
    Field,
    TagPicker,
    RecordCustomFields,
    MoneyField,
    OwnerField,
    RatingColourField,
    ScopeFields,
    StageField,
    LookupRetry,
  ],
  providers: [
    provideTranslocoScope('opportunities', { scope: 'opportunity-form', alias: 'oppForm' }),
    provideIcons({ tablerAlertCircle, tablerX }),
  ],
  templateUrl: './classification-section.html',
  host: {
    '[class]': "layout() === 'page' ? pageGrid + ' min-w-0' : 'grid grid-cols-1 gap-y-8 min-w-0'",
  },
})
export class ClassificationSection {
  private static nextId = 0;
  protected readonly uid = `opp-classification-${++ClassificationSection.nextId}`;

  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly scope = inject(ScopeState);
  protected readonly language = inject(LanguageState).current;
  protected readonly lookups = inject(OpportunityLookups);
  protected readonly limits = OPPORTUNITY_LIMITS;
  protected readonly pageGrid = RECORD_PAGE_GRID;

  readonly draft = model.required<OpportunityDraft>();
  readonly layout = input<RecordLayout>('modal');
  readonly mode = input<'create' | 'edit' | 'view'>('create');
  readonly errors = input<DraftErrors>({});
  readonly readonly = input(false);
  readonly row = input<OpportunityRow | null>(null);
  readonly updating = input<OpportunityUpdatingState>({});
  readonly countries = input<GeoCountry[]>([]);

  readonly rate = output<number>();
  readonly recolor = output<CardColor | null>();
  readonly moveStage = output<string>();

  private readonly pickedCompany = signal<{ companyId: string; branchId: string | null } | null>(null);
  private pendingOwnerBranchCheck = false;

  protected readonly canEditScope = computed(() => this.mode() === 'create' && !this.readonly());
  protected readonly canEditPipeline = computed(() => this.mode() === 'create' && !this.readonly());

  protected readonly activeCompany = computed<ScopeCompany | null>(() => {
    const companies = this.scope.companies();
    const allBranches = this.lookups.branches();
    const branchId = this.draft().branchId;
    const picked = this.pickedCompany();

    if (picked && picked.branchId === branchId) {
      const match = companies.find((c) => c.id === picked.companyId);
      if (match) return match;
    }

    if (this.draft().companyId) {
      const byCompanyId = companies.find((c) => c.id === this.draft().companyId);
      if (byCompanyId) return byCompanyId;
    }

    if (branchId && allBranches.length > 0) {
      const matched = companyForBranch(branchId, companies, allBranches);
      if (matched) return matched;
    }

    // The record's branch may be a session branch the branch lookup does not list.
    if (branchId) {
      const owner = companies.find((c) => c.branches.some((b) => b.id === branchId));
      if (owner) return owner;
    }

    if (this.mode() === 'create') {
      return this.scope.company();
    }
    return null;
  });

  protected readonly activeCompanyId = computed(() => this.activeCompany()?.id ?? '');

  /** Session-scope branch with the draft's id, used when the branch lookup does not list it. */
  private readonly scopeBranch = computed<{ id: string; name: string } | null>(() => {
    const branchId = this.draft().branchId;
    if (!branchId) return null;
    const ar = this.language() === 'ar';
    for (const company of this.scope.companies()) {
      const branch = company.branches.find((b) => b.id === branchId);
      if (branch) return { id: branch.id, name: ar ? branch.nameAr : branch.nameEn };
    }
    return null;
  });

  protected readonly selectedBranch = computed<{ id: string; name: string; companyName?: string } | null>(
    () => this.lookups.branches().find((branch) => branch.id === this.draft().branchId) ?? this.scopeBranch(),
  );

  protected readonly readonlyCompanyName = computed(() => {
    const company = this.activeCompany();
    if (company) {
      return this.language() === 'ar' ? company.nameAr : company.nameEn;
    }
    return this.selectedBranch()?.companyName ?? '';
  });

  protected readonly scopeCompanyId = computed<string | null>(() => {
    const active = this.activeCompany();
    if (active) return active.id;
    if (!this.canEditScope() && this.readonlyCompanyName()) {
      return '__readonly-company__';
    }
    return null;
  });

  protected readonly companyOptions = computed<Option[]>(() => {
    const ar = this.language() === 'ar';
    const list: Option[] = this.scope.companies().map((company) => ({
      id: company.id,
      label: ar ? company.nameAr : company.nameEn,
    }));
    const activeId = this.scopeCompanyId();
    if (activeId && !list.some((item) => item.id === activeId)) {
      list.unshift({ id: activeId, label: this.readonlyCompanyName() || activeId });
    }
    return list;
  });

  private readonly filteredBranches = computed<BranchOption[]>(() => {
    const allBranches = this.lookups.branches();
    const company = this.activeCompany();
    if (!company) return allBranches;
    return branchesForCompany(company, this.scope.companies(), allBranches);
  });

  protected readonly branchOptions = computed<Option[]>(() => {
    const list: Option[] = this.filteredBranches().map((branch) => ({
      id: branch.id,
      label: branch.name,
    }));
    const selected = this.selectedBranch();
    if (selected && !list.some((item) => item.id === selected.id)) {
      list.unshift({ id: selected.id, label: selected.name });
    }
    return list;
  });

  protected readonly scopeErrors = computed<Partial<Record<string, string | null>>>(() => {
    this.i18n();
    const companyErr = resolveOpportunityError(this.errors()['companyId'], this.transloco);
    const branchErr = resolveOpportunityError(this.errors()['branchId'], this.transloco);
    const out: Partial<Record<string, string | null>> = {};
    if (companyErr) out['companyId'] = companyErr;
    if (branchErr) out['branchId'] = branchErr;
    return out;
  });

  protected readonly activeCapabilityScope = computed(() => {
    const caps = this.lookups.capabilities();
    return (this.mode() === 'create' ? caps?.create?.scope : caps?.update?.scope) ?? null;
  });

  protected readonly isOwnScope = computed(() => this.activeCapabilityScope() === 'own');

  protected readonly ownerOptions = computed<SharedOwnerOption[]>(() =>
    this.lookups.assignableOwners().map((owner) => ({
      userId: owner.id,
      name: owner.displayName,
      avatarUrl: owner.avatarUrl,
    })),
  );

  protected readonly fallbackOwnerName = computed(() => {
    const name = this.row()?.ownerDisplayName?.trim();
    return name || null;
  });

  protected readonly ownerError = computed<string | null>(() => {
    this.i18n();
    return resolveOpportunityError(this.errors()['ownerUserId'], this.transloco);
  });

  protected readonly activePipeline = computed<PipelineView | null>(
    () => this.lookups.pipeline(this.draft().pipelineId) ?? this.lookups.defaultPipeline(),
  );

  protected readonly pipelineOptions = computed<DropdownOption<string>[]>(() => {
    const lang = this.language();
    const list = this.lookups.pipelines().map((p) => ({
      value: p.id,
      label: nameIn(p, lang),
    }));
    if (list.length === 0) {
      return [{ value: '', label: '—' }];
    }
    return list;
  });

  protected readonly pipelineLabel = computed(() => {
    const lang = this.language();
    const id = this.draft().pipelineId;
    const match = id ? this.lookups.pipeline(id) : null;
    return match ? nameIn(match, lang) : '';
  });

  protected readonly pipelineError = computed(() => {
    this.i18n();
    return resolveOpportunityError(this.errors()['pipelineId'], this.transloco);
  });

  private readonly sortedPipelineStages = computed<PipelineStageView[]>(() => {
    const pipeline = this.activePipeline();
    if (!pipeline) return [];
    return pipeline.stages.slice().sort((a, b) => a.rank - b.rank);
  });

  protected readonly stageOptions = computed<Option[]>(() => {
    const lang = this.language();
    const all = this.sortedPipelineStages();
    const active = all.filter((stage) => stage.isActive);
    const selectable =
      this.mode() === 'create'
        ? active.filter((stage) => stage.flag !== 'WON' && stage.flag !== 'LOST')
        : active;
    const options: Option[] = selectable.map((stage) => ({
      id: stage.id,
      label: nameIn(stage, lang),
    }));
    const activeStageId = this.draft().stageId;
    if (activeStageId && !options.some((opt) => opt.id === activeStageId)) {
      const current = all.find((stage) => stage.id === activeStageId);
      if (current) {
        options.unshift({
          id: current.id,
          label: nameIn(current, lang),
          disabled: true,
        });
      }
    }
    return options;
  });

  protected readonly stageError = computed(() => {
    this.i18n();
    return resolveOpportunityError(this.errors()['stageId'], this.transloco);
  });

  /** Currencies passed WITHOUT per-currency `decimals` (owner D12). */
  protected readonly currencyOptions = computed<SharedCurrencyOption[]>(() => {
    const list: SharedCurrencyOption[] = this.lookups.currencies().map((currency) => ({
      id: currency.code,
      label: currency.code,
      isDefault: currency.isDefault,
    }));
    // Keep the record's currency selectable even when the currency list does not
    // offer it (or has not loaded yet), so the select never shows it as empty.
    const current = this.draft().currencyCode?.trim();
    if (current && !list.some((item) => item.id === current)) {
      list.unshift({ id: current, label: current, isDefault: false });
    }
    return list;
  });

  protected readonly moneyErrors = computed<Partial<Record<string, string | null>>>(() => {
    this.i18n();
    const errs = this.errors();
    const amountRaw = errs['amount'];
    const currencyRaw = errs['currencyCode'];
    return {
      amount: amountRaw ? resolveOpportunityError(amountRaw, this.transloco) : null,
      currency: currencyRaw ? resolveOpportunityError(currencyRaw, this.transloco) : null,
    };
  });

  protected readonly probabilityError = computed(() => {
    this.i18n();
    return resolveOpportunityError(this.errors()['probabilityPercent'], this.transloco);
  });

  protected readonly closeDateError = computed(() => {
    this.i18n();
    return resolveOpportunityError(this.errors()['expectedCloseDate'], this.transloco);
  });

  protected readonly formattedCloseDate = computed(() => {
    const raw = this.draft().expectedCloseDate?.trim() ?? '';
    if (!raw || !isValidIsoDate(raw)) return '';
    const [y, m, d] = raw.split('-').map(Number);
    return new Intl.DateTimeFormat(`${this.language()}-u-nu-latn`, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(new Date(y, m - 1, d));
  });

  protected readonly isOverdue = computed(() => {
    const raw = this.draft().expectedCloseDate?.trim() ?? '';
    if (!raw || !isValidIsoDate(raw)) return false;
    const status = this.row()?.status;
    if (status === 'WON' || status === 'LOST') return false;
    return raw < localTodayIso();
  });

  protected readonly tagOptions = computed<TagOption[]>(() =>
    (this.lookups.tags() ?? []).map((tag) => ({
      id: tag.id,
      name: tag.name,
      backgroundColor: tag.backgroundColor,
      textColor: tag.textColor,
    })),
  );

  protected readonly tagsError = computed(() => {
    this.i18n();
    return resolveOpportunityError(this.errors()['tagIds'], this.transloco);
  });

  protected readonly hasRequiredCustomFields = computed(() =>
    this.lookups.customFields().some((field) => field.requiredOnCreate || field.requiredOnUpdate),
  );

  protected readonly createTagFn = async (name: string): Promise<TagOption> => {
    const created = await createTag({ name, backgroundColor: null, textColor: null });
    return {
      id: created.id,
      name: created.name,
      backgroundColor: created.backgroundColor,
      textColor: created.textColor,
    };
  };

  constructor() {
    effect(() => {
      const allBranches = this.lookups.branches();
      const picked = this.pickedCompany();
      const currentBranchId = this.draft().branchId;
      if (!picked || picked.branchId !== null || allBranches.length === 0 || currentBranchId) return;
      const targetCompany = this.scope.companies().find((c) => c.id === picked.companyId);
      if (!targetCompany) return;
      untracked(() => {
        const nextBranchId = pickCompanyBranchId(
          targetCompany,
          this.scope.company(),
          this.scope.branch(),
          this.scope.companies(),
          allBranches,
        );
        this.pickedCompany.set({ companyId: targetCompany.id, branchId: nextBranchId });
        if (nextBranchId) {
          this.onBranchChange(nextBranchId);
        }
      });
    });

    effect(() => {
      const branchId = this.draft().branchId;
      const owners = this.lookups.assignableOwners(branchId);
      const capabilities = this.lookups.capabilities(branchId);
      const ownersLoading = this.lookups.ownersLoading(branchId);
      if (!this.pendingOwnerBranchCheck || capabilities === null || ownersLoading) return;
      this.pendingOwnerBranchCheck = false;
      untracked(() => {
        const ownerId = this.draft().ownerUserId;
        if (ownerId && !owners.some((owner) => owner.id === ownerId)) {
          this.draft.update((current) => ({ ...current, ownerUserId: null }));
        }
      });
    });
  }

  protected fieldDescribedBy(controlId: string, hasError: boolean): string {
    return hasError ? `${controlId}-hint ${controlId}-error` : `${controlId}-hint`;
  }

  protected onCompanyChange(companyId: string | null): void {
    if (!this.canEditScope() || !companyId || companyId === this.activeCompanyId()) return;
    const targetCompany = this.scope.companies().find((c) => c.id === companyId);
    if (!targetCompany) return;

    const nextBranchId = pickCompanyBranchId(
      targetCompany,
      this.scope.company(),
      this.scope.branch(),
      this.scope.companies(),
      this.lookups.branches(),
    );
    this.pickedCompany.set({ companyId: targetCompany.id, branchId: nextBranchId });
    this.draft.update((current) => ({ ...current, companyId: targetCompany.id }));
    if (nextBranchId) {
      this.onBranchChange(nextBranchId);
    }
  }

  protected onBranchChange(branchId: string | null): void {
    if (!this.canEditScope() || !branchId || branchId === this.draft().branchId) return;
    this.pendingOwnerBranchCheck = true;
    this.lookups.setBranch(branchId);
    this.draft.update((current) => ({ ...current, branchId }));
  }

  protected onOwnerChange(ownerUserId: string | null): void {
    this.pendingOwnerBranchCheck = false;
    this.draft.update((current) => ({ ...current, ownerUserId }));
  }

  protected onPipelineChange(pipelineId: string): void {
    if (!this.canEditPipeline() || !pipelineId || pipelineId === this.draft().pipelineId) return;
    const pipeline = this.lookups.pipeline(pipelineId);
    const nextStageId = firstOpenStageId(pipeline);
    this.draft.update((current) => ({
      ...current,
      pipelineId,
      stageId: nextStageId,
    }));
  }

  protected onStageDraftChange(stageId: string | null): void {
    if (!stageId || this.readonly() || this.updating().stage || this.mode() !== 'create') return;
    this.draft.update((current) => ({ ...current, stageId }));
  }

  protected onStageCommit(stageId: string): void {
    if (!stageId || this.readonly() || this.updating().stage || this.mode() === 'create') return;
    if (stageId === this.draft().stageId) return;
    this.moveStage.emit(stageId);
  }

  protected onAmountChange(amount: string | null): void {
    this.draft.update((current) => ({ ...current, amount: amount ?? '' }));
  }

  protected onCurrencyChange(currencyCode: string | null): void {
    this.draft.update((current) => ({ ...current, currencyCode }));
  }

  protected onProbabilityInput(event: Event): void {
    if (this.readonly()) return;
    const inputEl = event.target as HTMLInputElement;
    const digits = toAsciiDigits(inputEl.value).replace(/\D+/g, '').slice(0, 3);
    if (inputEl.value !== digits) {
      inputEl.value = digits;
    }
    this.draft.update((current) => ({ ...current, probabilityPercent: digits }));
  }

  protected onExpectedCloseDateChange(expectedCloseDate: string | null): void {
    if (this.readonly()) return;
    this.draft.update((current) => ({ ...current, expectedCloseDate }));
  }

  protected clearExpectedCloseDate(): void {
    if (this.readonly()) return;
    this.draft.update((current) => ({ ...current, expectedCloseDate: null }));
  }

  protected onTagsChange(tagIds: string[]): void {
    this.draft.update((current) => ({ ...current, tagIds }));
  }

  protected onTagCreated(tag: TagOption): void {
    this.lookups.addTag(tag);
  }

  protected onRequiredCustomFieldsChange(values: Record<string, unknown>): void {
    this.draft.update((current) => ({
      ...current,
      customFields: values,
    }));
  }

  protected onRatingChange(importance: number): void {
    if (this.readonly() || this.updating().rating || this.mode() !== 'create') return;
    this.draft.update((current) => ({ ...current, importance }));
  }

  protected onColorChange(cardColor: CardColor | null): void {
    if (this.readonly() || this.updating().color || this.mode() !== 'create') return;
    this.draft.update((current) => ({ ...current, cardColor }));
  }
}
