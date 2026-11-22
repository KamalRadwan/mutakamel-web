import {
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  model,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { translationEvents } from '../../../../../../core/i18n/translation-events';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerCheck, tablerChevronDown, tablerTrendingUp } from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../../../core/i18n/language';
import { ScopeBranch, ScopeCompany, ScopeState } from '../../../../../../core/scope/scope';
import { Field } from '../../../../../../shared/ui/field/field';
import { rectInPage, viewport } from '../../../../../../shared/ui/overlay/zoom';
import { RECORD_PAGE_GRID } from '../../../../../../shared/ui/record-layout/record-layout';
import { TagOption, TagPicker } from '../../../../../../shared/ui/tag-picker/tag-picker';
import { createTag } from '../../../../settings/tags/tags.api';
import { CustomFieldDef } from '../../../../shared/record/custom-fields/custom-field.model';
import { RecordCustomFields } from '../../../../shared/record/custom-fields/record-custom-fields';
import { OwnerField } from '../../../../shared/record/fields/owner-field/owner-field';
import { RatingColourField } from '../../../../shared/record/fields/rating-colour-field/rating-colour-field';
import { Option, OwnerOption as SharedOwnerOption } from '../../../../shared/record/fields/record-fields.model';
import { ScopeFields } from '../../../../shared/record/fields/scope-fields/scope-fields';
import { StageField } from '../../../../shared/record/fields/stage-field/stage-field';
import { CUSTOMER_STATUS_ORDER } from '../../../customer-statuses';
import { BranchOption, CardColor, CustomerStatus, SourceOption, nameIn } from '../../../customers.model';
import { CUSTOMER_TAGS_MAX, CustomerDraft, DraftErrors } from '../../customer-draft';
import { CustomerLookups } from '../../customer-lookups';

interface MenuPlace {
  top: number;
  start: number;
  width: number;
  maxHeight: number | null;
}

export interface ClassificationErrorSpec {
  key: string;
  params?: { max: number };
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

@Component({
  selector: 'app-customer-classification',
  imports: [
    NgIcon,
    TranslocoPipe,
    Field,
    TagPicker,
    ScopeFields,
    OwnerField,
    StageField,
    RatingColourField,
    RecordCustomFields,
  ],
  providers: [
    provideTranslocoScope(
      { scope: 'customer-form', alias: 'customerForm' },
      { scope: 'customers', alias: 'customers' },
    ),
    provideIcons({
      tablerCheck,
      tablerChevronDown,
      tablerTrendingUp,
    }),
  ],
  templateUrl: './customer-classification.html',
  host: {
    '[class]': "layout() === 'page' ? pageGrid + ' min-w-0' : 'grid grid-cols-1 gap-y-8 min-w-0'",
    '(document:click)': 'closeSourceIfOutside($event)',
    '(window:resize)': 'closeSourceMenu()',
    '(keydown.escape)': 'onSourceEscape($event)',
  },
})
export class CustomerClassification {
  protected readonly pageGrid = RECORD_PAGE_GRID;
  private static nextId = 0;
  protected readonly uid = `cf-classification-${++CustomerClassification.nextId}`;

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly scope = inject(ScopeState);
  private readonly sourceTrigger = viewChild<ElementRef<HTMLButtonElement>>('sourceTrigger');
  private readonly menuListRef = viewChild<ElementRef<HTMLElement>>('menuList');

  protected readonly lookups = inject(CustomerLookups);
  protected readonly language = inject(LanguageState).current;
  protected readonly tagsMax = CUSTOMER_TAGS_MAX;

  readonly layout = input<'modal' | 'page'>('modal');
  readonly draft = model.required<CustomerDraft>();
  readonly errors = input<DraftErrors>({});
  readonly readonly = input(false);
  readonly mode = input<'create' | 'edit' | 'view'>('create');
  readonly updating = input(false);
  readonly status = input<CustomerStatus | null>(null);
  readonly fallbackOwnerName = input<string | null>(null);

  readonly rate = output<number>();
  readonly recolor = output<CardColor | null>();
  readonly statusChange = output<CustomerStatus>();

  protected readonly sourceOpen = signal(false);
  protected readonly menuPlaced = signal(false);
  protected readonly menuPlace = signal<MenuPlace>({ top: 0, start: 0, width: 0, maxHeight: null });
  private readonly pickedCompany = signal<{ companyId: string; branchId: string | null } | null>(null);

  private menuSeq = 0;
  private pendingOwnerBranchCheck = false;

  protected readonly isCreate = computed(() => this.mode() === 'create');
  protected readonly isReadonly = computed(() => this.readonly());
  protected readonly canEditBranch = computed(() => this.isCreate() && !this.isReadonly());
  protected readonly canEditStatus = computed(() => !this.isReadonly() && this.lookups.canManageStatus());

  protected readonly activeCompany = computed<ScopeCompany | null>(() => {
    const companies = this.scope.companies();
    const allBranches = this.lookups.branches();
    const branchId = this.draft().branchId;
    const picked = this.pickedCompany();

    if (picked && picked.branchId === branchId) {
      const match = companies.find((c) => c.id === picked.companyId);
      if (match) return match;
    }

    const explicitCompanyId = this.draft().companyId;
    if (explicitCompanyId) {
      const explicitMatch = companies.find((c) => c.id === explicitCompanyId);
      if (explicitMatch) return explicitMatch;
    }

    if (branchId && allBranches.length > 0) {
      const matched = companyForBranch(branchId, companies, allBranches);
      if (matched) return matched;
    }

    if (this.isCreate()) {
      return this.scope.company();
    }
    return null;
  });

  protected readonly activeCompanyId = computed(() => this.activeCompany()?.id ?? '');

  protected readonly selectedBranch = computed(
    () => this.lookups.branches().find((branch) => branch.id === this.draft().branchId) ?? null,
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
    if (!this.canEditBranch() && this.readonlyCompanyName()) {
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
    const err = this.errorFor('branchId');
    return err ? { branchId: this.transloco.translate(err.key, err.params) } : {};
  });

  protected readonly activeCapabilityScope = computed(() => {
    const caps = this.lookups.capabilities()?.customerProfiles;
    return (this.isCreate() ? caps?.create?.scope : caps?.update?.scope) ?? null;
  });

  protected readonly isOwnScope = computed(() => this.activeCapabilityScope() === 'own');

  protected readonly ownerOptions = computed<SharedOwnerOption[]>(() =>
    this.lookups.owners().map((owner) => ({
      userId: owner.userId,
      name: owner.name,
      avatarUrl: owner.avatarUrl,
    })),
  );

  protected readonly ownerError = computed<string | null>(() => {
    this.i18n();
    const err = this.errorFor('ownerUserId');
    return err ? this.transloco.translate(err.key, err.params) : null;
  });

  protected readonly activeStatus = computed<CustomerStatus>(() => this.status() ?? this.draft().status);

  protected readonly statusOptions = computed<Option[]>(() => {
    this.i18n();
    const lang = this.language();
    const apiOptions = this.lookups.statusOptions();
    const activeHint = this.transloco.translate('customers.activeHint');

    return CUSTOMER_STATUS_ORDER.map((value) => {
      const apiOpt = apiOptions.find((item) => item.value === value);
      const label = apiOpt
        ? lang === 'ar'
          ? apiOpt.label.ar
          : apiOpt.label.en
        : this.transloco.translate(`customers.statuses.${value}`);
      if (value === 'ACTIVE_CUSTOMER') {
        return {
          id: value,
          label,
          disabled: true,
          hint: activeHint,
        };
      }
      return { id: value, label };
    });
  });

  protected readonly statusError = computed<string | null>(() => {
    this.i18n();
    const err = this.errorFor('status');
    return err ? this.transloco.translate(err.key, err.params) : null;
  });

  protected readonly selectedSource = computed<SourceOption | null>(() => {
    const sourceId = this.draft().acquisitionSourceId;
    const sources = this.lookups.allSources() ?? this.lookups.sources();
    if (!sourceId || !sources) return null;
    return sources.find((source) => source.id === sourceId) ?? null;
  });

  protected readonly tagOptions = computed<TagOption[]>(() =>
    (this.lookups.tags() ?? []).map((tag) => ({
      id: tag.id,
      name: tag.name,
      backgroundColor: tag.backgroundColor ?? null,
      textColor: tag.textColor ?? null,
    })),
  );

  protected readonly customFieldsList = computed<readonly CustomFieldDef[]>(() => this.lookups.customFields() ?? []);

  protected readonly hasRequiredCustomFields = computed(() =>
    this.customFieldsList().some((field) => field.requiredOnCreate || field.requiredOnUpdate),
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
      const owners = this.lookups.owners();
      const capabilities = this.lookups.capabilities();
      const ownersLoading = this.lookups.ownersLoading();
      if (!this.pendingOwnerBranchCheck || capabilities === null || ownersLoading) return;
      this.pendingOwnerBranchCheck = false;
      untracked(() => {
        const ownerId = this.draft().ownerUserId;
        if (ownerId && !owners.some((owner) => owner.userId === ownerId)) {
          this.draft.update((current) => ({ ...current, ownerUserId: null }));
        }
      });
    });

    const onScroll = (event: Event) => {
      if (!this.sourceOpen()) return;
      const target = event.target;
      if (target instanceof Node && this.menuListRef()?.nativeElement.contains(target)) return;
      this.closeSourceMenu();
    };
    document.addEventListener('scroll', onScroll, { capture: true, passive: true });
    inject(DestroyRef).onDestroy(() => document.removeEventListener('scroll', onScroll, { capture: true }));
  }

  protected errorFor(path: string, max?: number): ClassificationErrorSpec | null {
    const raw = this.errors()[path];
    if (!raw) return null;
    const key = raw.startsWith('customerForm.') ? raw : `customerForm.errors.${raw}`;
    const params = max !== undefined && key === 'customerForm.errors.tooLong' ? { max } : undefined;
    return { key, params };
  }

  protected sourceLabel(source: SourceOption): string {
    return nameIn(source, this.language());
  }

  protected onCompanyChange(companyId: string | null): void {
    if (!this.canEditBranch() || !companyId || companyId === this.activeCompanyId()) return;
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
    if (!this.canEditBranch() || !branchId || branchId === this.draft().branchId) return;

    this.pendingOwnerBranchCheck = true;
    this.lookups.setBranch(branchId);

    this.draft.update((current) => ({
      ...current,
      branchId,
    }));
  }

  protected onOwnerChange(ownerUserId: string | null): void {
    this.pendingOwnerBranchCheck = false;
    this.draft.update((current) => ({ ...current, ownerUserId }));
  }

  protected onStatusDraftChange(status: string | null): void {
    if (!status || !this.canEditStatus() || this.updating() || !this.isCreate()) return;
    if (status === 'ACTIVE_CUSTOMER') return;
    this.draft.update((d) => ({ ...d, status: status as CustomerStatus }));
  }

  protected onStatusCommit(nextStatus: string): void {
    if (!nextStatus || !this.canEditStatus() || this.updating()) return;
    if (nextStatus === 'ACTIVE_CUSTOMER' || nextStatus === this.activeStatus()) return;
    this.statusChange.emit(nextStatus as CustomerStatus);
  }

  protected onRatingChange(rating: number): void {
    if (this.isReadonly() || this.updating() || !this.isCreate()) return;
    this.draft.update((d) => ({ ...d, rating }));
  }

  protected onColorChange(cardColor: CardColor | null): void {
    if (this.isReadonly() || this.updating() || !this.isCreate()) return;
    this.draft.update((d) => ({ ...d, cardColor }));
  }

  protected onCustomFieldsChange(customFields: Record<string, unknown>): void {
    if (this.isReadonly()) return;
    this.draft.update((current) => ({ ...current, customFields }));
  }

  protected toggleSourceMenu(): void {
    if (this.isReadonly()) return;
    if (this.sourceOpen()) {
      this.closeSourceMenu();
      return;
    }

    const triggerEl = this.sourceTrigger()?.nativeElement;
    if (!triggerEl) return;

    const seq = ++this.menuSeq;
    this.menuPlaced.set(false);
    this.menuPlace.set(this.initialPlace(triggerEl));
    this.sourceOpen.set(true);
    queueMicrotask(() => this.placeMenu(seq));
    afterNextRender(() => this.placeMenu(seq), { injector: this.injector });
  }

  protected selectSource(acquisitionSourceId: string | null): void {
    this.draft.update((current) => ({ ...current, acquisitionSourceId }));
    this.closeSourceMenu();
    this.sourceTrigger()?.nativeElement.focus();
  }

  protected onTagsChange(tagIds: string[]): void {
    if (this.isReadonly()) return;
    this.draft.update((current) => ({ ...current, tagIds }));
  }

  protected onTagCreated(tag: TagOption): void {
    this.lookups.addTag({
      id: tag.id,
      name: tag.name,
      backgroundColor: tag.backgroundColor,
      textColor: tag.textColor,
    });
  }

  protected closeSourceMenu(): void {
    this.menuSeq++;
    this.sourceOpen.set(false);
    this.menuPlaced.set(false);
  }

  protected closeSourceIfOutside(event: Event): void {
    if (!this.sourceOpen()) return;
    const target = event.target;
    if (!(target instanceof Node)) {
      this.closeSourceMenu();
      return;
    }
    const triggerEl = this.sourceTrigger()?.nativeElement;
    const listEl = this.menuListRef()?.nativeElement;
    if (triggerEl?.contains(target) || listEl?.contains(target)) return;
    this.closeSourceMenu();
  }

  protected onSourceEscape(event: Event): void {
    if (!this.sourceOpen()) return;
    event.preventDefault();
    event.stopPropagation();
    this.closeSourceMenu();
    this.sourceTrigger()?.nativeElement.focus();
  }

  protected onSourceMenuKeydown(event: KeyboardEvent): void {
    const listEl = this.menuListRef()?.nativeElement;
    if (!listEl) return;
    const buttons = Array.from(listEl.querySelectorAll<HTMLElement>('[role="option"]'));
    if (buttons.length === 0) return;

    const currentIndex = buttons.indexOf(document.activeElement as HTMLElement);
    let nextIndex = -1;
    switch (event.key) {
      case 'Enter':
      case ' ':
        if (currentIndex < 0) return;
        event.preventDefault();
        buttons[currentIndex].click();
        return;
      case 'ArrowDown':
        nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % buttons.length;
        break;
      case 'ArrowUp':
        nextIndex = currentIndex < 0 ? buttons.length - 1 : (currentIndex - 1 + buttons.length) % buttons.length;
        break;
      case 'Home':
        nextIndex = 0;
        break;
      case 'End':
        nextIndex = buttons.length - 1;
        break;
      default:
        return;
    }
    event.preventDefault();
    buttons[nextIndex].focus();
  }

  private initialPlace(triggerEl: HTMLElement): MenuPlace {
    const rect = rectInPage(triggerEl);
    const { width } = viewport();
    const rtl = getComputedStyle(this.host.nativeElement).direction === 'rtl';
    return {
      top: rect.bottom + 4,
      start: rtl ? width - rect.right : rect.left,
      width: rect.width,
      maxHeight: null,
    };
  }

  private placeMenu(seq: number): void {
    if (seq !== this.menuSeq || !this.sourceOpen() || this.menuPlaced()) return;
    const triggerEl = this.sourceTrigger()?.nativeElement;
    const listEl = this.menuListRef()?.nativeElement;
    if (!triggerEl || !listEl) return;

    const rect = rectInPage(triggerEl);
    const listRect = rectInPage(listEl);
    const { width, height } = viewport();
    const rtl = getComputedStyle(this.host.nativeElement).direction === 'rtl';

    const belowTop = rect.bottom + 4;
    const spaceBelow = Math.max(8, height - 8 - belowTop);
    const spaceAbove = Math.max(8, rect.top - 12);
    const flipUp = listRect.height > spaceBelow && spaceAbove > spaceBelow;
    const avail = flipUp ? spaceAbove : spaceBelow;
    const maxHeight = listRect.height > avail ? avail : null;
    const finalHeight = maxHeight ?? listRect.height;
    const top = flipUp ? Math.max(8, rect.top - 4 - finalHeight) : belowTop;

    const triggerStart = rtl ? width - rect.right : rect.left;
    const triggerEnd = rtl ? width - rect.left : rect.right;
    const alignEnd = triggerStart + listRect.width > width - 8;
    const rawStart = alignEnd ? triggerEnd - listRect.width : triggerStart;
    const start = Math.min(Math.max(8, rawStart), Math.max(8, width - 8 - listRect.width));

    this.menuPlace.set({ top, start, width: rect.width, maxHeight });
    this.menuPlaced.set(true);

    listEl.style.top = `${top}px`;
    listEl.style.insetInlineStart = `${start}px`;
    listEl.style.minWidth = `${rect.width}px`;
    listEl.style.maxHeight = maxHeight !== null ? `${maxHeight}px` : '';
    listEl.classList.remove('invisible');
  }
}
