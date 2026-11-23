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
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { provideTranslocoScopeInherited } from '../../../../../../core/i18n/transloco-scope';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerCheck, tablerChevronDown, tablerTrendingUp } from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../../../core/i18n/language';
import { Notify } from '../../../../../../core/notify/notify';
import { ScopeBranch, ScopeCompany, ScopeState } from '../../../../../../core/scope/scope';
import { Field } from '../../../../../../shared/ui/field/field';
import { RECORD_PAGE_GRID } from '../../../../../../shared/ui/record-layout/record-layout';
import { rectInPage, viewport } from '../../../../../../shared/ui/overlay/zoom';
import { TagOption, TagPicker } from '../../../../../../shared/ui/tag-picker/tag-picker';
import { OwnerField } from '../../../../shared/record/fields/owner-field/owner-field';
import { RatingColourField } from '../../../../shared/record/fields/rating-colour-field/rating-colour-field';
import { Option, OwnerOption as SharedOwnerOption } from '../../../../shared/record/fields/record-fields.model';
import { ScopeFields } from '../../../../shared/record/fields/scope-fields/scope-fields';
import { StageField } from '../../../../shared/record/fields/stage-field/stage-field';
import { createTag } from '../../../../settings/tags/tags.api';
import { listCompanyOptions } from '../../../leads.api';
import { BranchOption, CardColor, LeadStage, SourceOption, nameIn } from '../../../leads.model';
import { DraftErrors, LEAD_LIMITS, LeadDraft, newContact } from '../../lead-draft';
import { LeadLookups } from '../../lead-lookups';

interface MenuPlace {
  top: number;
  start: number;
  width: number;
  maxHeight: number | null;
}

export interface ErrorSpec {
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
  selector: 'app-lf-classification',
  imports: [
    NgIcon,
    TranslocoPipe,
    Field,
    TagPicker,
    ScopeFields,
    OwnerField,
    StageField,
    RatingColourField,
  ],
  viewProviders: [
    provideTranslocoScopeInherited(
      { scope: 'lead-form-side', alias: 'leadSide' },
      { scope: 'lead-form', alias: 'leadForm' },
      { scope: 'lead-modal', alias: 'leadModal' },
    ),
  ],
  providers: [
    provideIcons({
      tablerCheck,
      tablerChevronDown,
      tablerTrendingUp,
    }),
  ],
  templateUrl: './classification-section.html',
  host: {
    '[class]':
      "layout() === 'page' ? pageGrid + ' min-w-0' : 'grid grid-cols-1 gap-y-8 min-w-0'",
    '(document:click)': 'closeSourceIfOutside($event)',
    '(window:resize)': 'closeSourceMenu()',
    '(keydown.escape)': 'onSourceEscape($event)',
  },
})
export class ClassificationSection {
  protected readonly pageGrid = RECORD_PAGE_GRID;
  private static nextId = 0;
  protected readonly uid = `lf-classification-${++ClassificationSection.nextId}`;

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly notify = inject(Notify);
  private readonly scope = inject(ScopeState);
  private readonly sourceTrigger = viewChild<ElementRef<HTMLButtonElement>>('sourceTrigger');
  private readonly menuListRef = viewChild<ElementRef<HTMLElement>>('menuList');

  protected readonly lookups = inject(LeadLookups);
  protected readonly language = inject(LanguageState).current;
  protected readonly limits = LEAD_LIMITS;

  readonly layout = input<'modal' | 'page'>('modal');
  readonly draft = model.required<LeadDraft>();
  readonly errors = input<DraftErrors>({});
  readonly readonly = input(false);
  readonly canUpdateRecord = input(false);
  readonly mode = input<'create' | 'edit'>('create');
  readonly stages = input<LeadStage[]>([]);
  readonly stageId = input<string | null>(null);
  readonly updating = input(false);

  readonly rate = output<number>();
  readonly recolor = output<CardColor | null>();
  readonly moveStage = output<string>();

  protected readonly sourceOpen = signal(false);
  protected readonly menuPlaced = signal(false);
  protected readonly menuPlace = signal<MenuPlace>({ top: 0, start: 0, width: 0, maxHeight: null });
  private readonly pickedCompany = signal<{ companyId: string; branchId: string | null } | null>(null);

  private menuSeq = 0;
  private companyCheckSeq = 0;
  private pendingOwnerBranchCheck = false;

  // Record creation follows the session branch; the top bar is the only scope selector.
  protected readonly canEditBranch = computed(() => false);

  protected readonly activeCompany = computed<ScopeCompany | null>(() => {
    const companies = this.scope.companies();
    const allBranches = this.lookups.branches();
    const branchId = this.draft().branchId;
    const picked = this.pickedCompany();

    if (picked && picked.branchId === branchId) {
      const match = companies.find((c) => c.id === picked.companyId);
      if (match) return match;
    }

    if (branchId && allBranches.length > 0) {
      const matched = companyForBranch(branchId, companies, allBranches);
      if (matched) return matched;
    }

    if (this.mode() === 'create') {
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
    const caps = this.lookups.capabilities();
    return (this.mode() === 'create' ? caps?.leads.create?.scope : caps?.leads.update?.scope) ?? null;
  });

  protected readonly isOwnScope = computed(() => this.activeCapabilityScope() === 'own');

  protected readonly ownerOptions = computed<SharedOwnerOption[]>(() =>
    this.lookups.owners().map((owner) => ({
      userId: owner.id,
      name: owner.displayName,
      avatarUrl: owner.avatarUrl,
    })),
  );

  protected readonly fallbackOwnerName = computed(() => {
    const extra = this.draft() as LeadDraft & { ownerDisplayName?: string | null };
    return extra.ownerDisplayName?.trim() || null;
  });

  protected readonly ownerError = computed<string | null>(() => {
    this.i18n();
    const err = this.errorFor('ownerUserId');
    return err ? this.transloco.translate(err.key, err.params) : null;
  });

  protected readonly selectedSource = computed<SourceOption | null>(() => {
    const sourceId = this.draft().acquisitionSourceId;
    const sources = this.lookups.sources();
    if (!sourceId || !sources) return null;
    return sources.find((source) => source.id === sourceId) ?? null;
  });

  protected readonly tagOptions = computed<TagOption[]>(() =>
    (this.lookups.tags() ?? []).map((tag) => ({
      id: tag.id,
      name: tag.name,
      backgroundColor: tag.backgroundColor,
      textColor: tag.textColor,
    })),
  );

  private readonly availableStages = computed(() => {
    const provided = this.stages();
    if (provided.length > 0) return provided;
    return this.mode() === 'create' ? this.lookups.stages() : this.lookups.allStages();
  });

  protected readonly selectableStages = computed(() => {
    const all = this.availableStages()
      .filter((stage) => stage.isActive)
      .slice()
      .sort((a, b) => a.sortOrder - b.sortOrder);
    if (this.mode() === 'create') {
      return all.filter((stage) => stage.flag !== 'DISQUALIFIED' && stage.flag !== 'CONVERTED');
    }
    return all;
  });

  protected readonly activeStageId = computed(() => this.stageId() ?? this.draft().stageId);

  protected readonly stageOptions = computed<Option[]>(() => {
    const lang = this.language();
    const list = this.selectableStages();
    const options: Option[] = list.map((stage) => ({
      id: stage.id,
      label: nameIn(stage, lang),
    }));
    const activeId = this.activeStageId();
    if (activeId && !list.some((stage) => stage.id === activeId)) {
      const current = this.availableStages().find((stage) => stage.id === activeId);
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
      const ownersLoading = this.isOwnersLoading();
      if (!this.pendingOwnerBranchCheck || capabilities === null || ownersLoading) return;
      this.pendingOwnerBranchCheck = false;
      untracked(() => {
        const ownerId = this.draft().ownerUserId;
        if (ownerId && !owners.some((owner) => owner.id === ownerId)) {
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

  protected errorFor(path: string, max?: number): ErrorSpec | null {
    const raw = this.errors()[path];
    if (!raw) return null;
    const key = raw.startsWith('leadForm.') ? raw : `leadForm.errors.${raw}`;
    const params = max !== undefined && key === 'leadForm.errors.tooLong' ? { max } : undefined;
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
    if (nextBranchId) {
      this.onBranchChange(nextBranchId);
    }
  }

  protected onBranchChange(branchId: string | null): void {
    if (!this.canEditBranch() || !branchId || branchId === this.draft().branchId) return;

    const existingCompanyId = this.draft().existingCompanyPartyId;
    const existingCompanyName = this.draft().existingCompanyName ?? '';

    this.pendingOwnerBranchCheck = true;
    this.lookups.setBranch(branchId);

    this.draft.update((current) => ({
      ...current,
      branchId,
    }));

    if (existingCompanyId) {
      const seq = ++this.companyCheckSeq;
      void listCompanyOptions(branchId, existingCompanyName)
        .then((companies) => {
          if (seq !== this.companyCheckSeq) return;
          const currentDraft = this.draft();
          if (currentDraft.branchId !== branchId || currentDraft.existingCompanyPartyId !== existingCompanyId) {
            return;
          }
          const match = companies.find((company) => company.id === existingCompanyId);
          const belongsToBranch = Boolean(match && (match.branchId === null || match.branchId === branchId));
          if (!belongsToBranch) {
            this.draft.update((current) => {
              const manualContacts = current.contacts.filter((contact) => contact.contactPartyId === null);
              const contacts =
                current.leadProfileType !== 'CORPORATE'
                  ? current.contacts
                  : manualContacts.length === 0
                    ? [newContact(true)]
                    : manualContacts.some((contact) => contact.isPrimary)
                      ? manualContacts
                      : [{ ...manualContacts[0], isPrimary: true }, ...manualContacts.slice(1)];
              return {
                ...current,
                existingCompanyPartyId: null,
                existingCompanyName: null,
                contacts,
              };
            });
          }
        })
        .catch(() => {
          // Keep current company selection if lookup temporarily fails.
        });
    }
  }

  protected onOwnerChange(ownerUserId: string | null): void {
    this.pendingOwnerBranchCheck = false;
    this.draft.update((current) => ({ ...current, ownerUserId }));
  }

  protected onStageDraftChange(stageId: string | null): void {
    if (!stageId || this.readonly() || this.updating() || this.mode() !== 'create') return;
    const stage = this.selectableStages().find((item) => item.id === stageId);
    if (!stage) return;
    this.draft.update((d) => ({ ...d, stageId: stage.id }));
  }

  protected onStageCommit(stageId: string): void {
    if (!stageId || this.readonly() || this.updating()) return;
    const stage = this.selectableStages().find((item) => item.id === stageId);
    if (!stage || stage.id === this.activeStageId()) return;
    const stageLabel = nameIn(stage, this.language());
    if (stage.flag === 'DISQUALIFIED') {
      this.notify.warning(this.transloco.translate('leadModal.stage.reasonRequired', { stage: stageLabel }));
      return;
    }
    if (stage.flag === 'CONVERTED') {
      this.notify.warning(this.transloco.translate('leadModal.stage.convertRequired', { stage: stageLabel }));
      return;
    }
    this.moveStage.emit(stage.id);
  }

  protected onRatingChange(rating: number): void {
    if (this.readonly() || this.updating() || this.mode() !== 'create') return;
    this.draft.update((d) => ({ ...d, rating }));
  }

  protected onColorChange(cardColor: CardColor | null): void {
    if (this.readonly() || this.updating() || this.mode() !== 'create') return;
    this.draft.update((d) => ({ ...d, cardColor }));
  }

  protected toggleSourceMenu(): void {
    if (this.readonly()) return;
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
    this.draft.update((current) => ({ ...current, tagIds }));
  }

  protected onTagCreated(tag: TagOption): void {
    this.lookups.addTag(tag);
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
    const buttons = Array.from(listEl.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'));
    if (buttons.length === 0) return;

    const currentIndex = buttons.indexOf(document.activeElement as HTMLButtonElement);
    let nextIndex = -1;
    switch (event.key) {
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

  private isOwnersLoading(): boolean {
    const lookups = this.lookups as LeadLookups & { ownersLoading?: () => boolean };
    return lookups.ownersLoading ? lookups.ownersLoading() : false;
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

export { ClassificationSection as LfClassification };
