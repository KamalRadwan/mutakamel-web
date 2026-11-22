import { Component, DestroyRef, computed, effect, inject, signal, untracked, viewChild } from '@angular/core';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerAdjustmentsHorizontal,
  tablerBuilding,
  tablerChevronLeft,
  tablerChevronRight,
  tablerFilter,
  tablerLock,
  tablerMathFunction,
  tablerPlus,
  tablerRefresh,
  tablerSearch,
  tablerWorld,
  tablerX,
} from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../../core/i18n/language';
import { Notify } from '../../../../../core/notify/notify';
import { ScopeState } from '../../../../../core/scope/scope';
import { ActionItem, ActionSelection, ActionsMenu } from '../../../../../shared/ui/actions-menu/actions-menu';
import { Button } from '../../../../../shared/ui/button/button';
import { Dropdown, DropdownOption } from '../../../../../shared/ui/dropdown/dropdown';
import { Field } from '../../../../../shared/ui/field/field';
import { Modal } from '../../../../../shared/ui/modal/modal';
import { FunctionModal } from '../function-modal/function-modal';
import { FunctionReasonModal } from '../function-reason-modal/function-reason-modal';
import {
  FunctionCompanyOption,
  FunctionDetailDto,
  FunctionPageInfo,
  FunctionScopeType,
  FunctionStatus,
  FunctionSummaryDto,
  FunctionsListQuery,
  TemplateApiError,
  archiveFunction,
  buildFunctionCompanyOptions,
  describeFunctionScope,
  formatFunctionDate,
  listFunctions,
  newTemplateIdempotencyKey,
  restoreFunction,
  translateFunctionError,
} from '../functions.api';

const CAN_READ = true; // later from the session permissions (templates.functions.read)
const CAN_MANAGE = true; // later from the session permissions (templates.functions.manage)
const CAN_PUBLISH = true; // later from the session permissions (templates.functions.publish)
const CAN_UPDATE_TEMPLATES = true; // later from the session permissions (templates.update)

interface FunctionFilters {
  status: '' | FunctionStatus;
  scopeType: '' | FunctionScopeType;
  companyId: string;
}

const EMPTY_FILTERS: FunctionFilters = {
  status: '',
  scopeType: '',
  companyId: '',
};

interface FilterChip {
  key: 'status' | 'scope';
  label: string;
}

@Component({
  selector: 'app-functions-page',
  imports: [
    RouterLink,
    NgIcon,
    TranslocoPipe,
    ActionsMenu,
    Button,
    Dropdown,
    Field,
    Modal,
    FunctionModal,
    FunctionReasonModal,
  ],
  providers: [
    provideTranslocoScope('templates', { scope: 'templates-functions', alias: 'tplFunctions' }),
    provideIcons({
      tablerAdjustmentsHorizontal,
      tablerBuilding,
      tablerChevronLeft,
      tablerChevronRight,
      tablerFilter,
      tablerLock,
      tablerMathFunction,
      tablerPlus,
      tablerRefresh,
      tablerSearch,
      tablerWorld,
      tablerX,
    }),
  ],
  templateUrl: './functions-page.html',
  host: { class: 'flex min-h-0 flex-1 flex-col gap-8 p-12' },
})
export class FunctionsPage {
  private static nextId = 0;
  protected readonly uid = `functions-page-${++FunctionsPage.nextId}`;

  private readonly destroyRef = inject(DestroyRef);
  private readonly scopeState = inject(ScopeState);
  private readonly notify = inject(Notify);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  protected readonly language = inject(LanguageState).current;

  private readonly functionModal = viewChild.required(FunctionModal);
  private readonly rowReasonModal = viewChild.required<FunctionReasonModal>('rowReasonModal');
  private readonly filtersModal = viewChild.required<Modal>('filtersModal');

  protected readonly canRead = CAN_READ;
  protected readonly canManage = CAN_MANAGE;
  protected readonly canPublish = CAN_PUBLISH;
  protected readonly canUpdateTemplates = CAN_UPDATE_TEMPLATES;
  protected readonly skeletonRows = [1, 2, 3, 4, 5];

  protected readonly searchDraft = signal('');
  protected readonly searchQuery = signal('');
  protected readonly filters = signal<FunctionFilters>({ ...EMPTY_FILTERS });
  protected readonly draftFilters = signal<FunctionFilters>({ ...EMPTY_FILTERS });
  protected readonly filtersOpen = signal(false);

  protected readonly cursorStack = signal<string[]>([]);
  protected readonly currentCursor = computed(() => {
    const stack = this.cursorStack();
    return stack.length > 0 ? stack[stack.length - 1] : null;
  });

  protected readonly functions = signal<FunctionSummaryDto[]>([]);
  protected readonly pageInfo = signal<FunctionPageInfo>({ limit: 25, hasNextPage: false, nextCursor: null });
  protected readonly publishedVersionNumbers = signal<Record<string, number>>({});
  protected readonly loading = signal(true);
  protected readonly errorState = signal<'none' | 'forbidden' | 'featureDisabled' | 'failed'>('none');
  protected readonly correlationId = signal<string | null>(null);

  private loadSeq = 0;
  private searchTimer: ReturnType<typeof setTimeout> | null = null;

  protected readonly companyOptions = computed<FunctionCompanyOption[]>(() => {
    this.i18n();
    const lang = this.language();
    return buildFunctionCompanyOptions(this.scopeState.companies(), lang, (k) => this.transloco.translate(k));
  });

  protected readonly statusFilterOptions = computed<DropdownOption<'' | FunctionStatus>[]>(() => {
    this.i18n();
    return [
      { value: '', label: this.transloco.translate('tplFunctions.filters.allStatuses') },
      { value: 'ACTIVE', label: this.transloco.translate('tplFunctions.status.ACTIVE') },
      { value: 'ARCHIVED', label: this.transloco.translate('tplFunctions.status.ARCHIVED') },
    ];
  });

  protected readonly scopeFilterOptions = computed<DropdownOption<'' | FunctionScopeType>[]>(() => {
    this.i18n();
    return [
      { value: '', label: this.transloco.translate('tplFunctions.filters.allScopes') },
      { value: 'TENANT', label: this.transloco.translate('tplFunctions.scopes.tenant') },
      { value: 'COMPANY', label: this.transloco.translate('tplFunctions.scopes.company') },
    ];
  });

  protected readonly companyFilterOptions = computed<DropdownOption<string>[]>(() => {
    this.i18n();
    return [
      { value: '', label: this.transloco.translate('tplFunctions.filters.allCompanies') },
      ...this.companyOptions().map((c) => ({ value: c.id, label: c.label })),
    ];
  });

  protected readonly activeFiltersCount = computed(() => {
    const f = this.filters();
    let count = 0;
    if (f.status) count++;
    if (f.scopeType) count++;
    return count;
  });

  protected readonly hasActiveQueryOrFilter = computed(
    () => this.searchQuery().trim().length > 0 || this.activeFiltersCount() > 0,
  );

  protected readonly activeFilterChips = computed<FilterChip[]>(() => {
    this.i18n();
    const f = this.filters();
    const chips: FilterChip[] = [];
    if (f.status) {
      chips.push({
        key: 'status',
        label: this.transloco.translate('tplFunctions.chips.status', {
          value: this.transloco.translate(`tplFunctions.status.${f.status}`),
        }),
      });
    }
    if (f.scopeType) {
      const scopeVal =
        f.scopeType === 'TENANT'
          ? this.transloco.translate('tplFunctions.scopes.tenant')
          : f.companyId
            ? (this.companyOptions().find((c) => c.id === f.companyId)?.label ?? f.companyId)
            : this.transloco.translate('tplFunctions.scopes.company');
      chips.push({
        key: 'scope',
        label: this.transloco.translate('tplFunctions.chips.scope', { value: scopeVal }),
      });
    }
    return chips;
  });

  protected readonly hasPrevPage = computed(() => this.cursorStack().length > 0);
  protected readonly hasNextPage = computed(() => this.pageInfo().hasNextPage && !!this.pageInfo().nextCursor);
  protected readonly isFirstUseEmpty = computed(
    () => !this.loading() && this.errorState() === 'none' && this.functions().length === 0 && !this.hasActiveQueryOrFilter(),
  );
  protected readonly isFilteredEmpty = computed(
    () => !this.loading() && this.errorState() === 'none' && this.functions().length === 0 && this.hasActiveQueryOrFilter(),
  );

  constructor() {
    this.destroyRef.onDestroy(() => {
      if (this.searchTimer !== null) {
        clearTimeout(this.searchTimer);
      }
    });

    effect(() => {
      const name = this.searchQuery();
      const filters = this.filters();
      const cursor = this.currentCursor();
      untracked(() => {
        void this.loadList(name, filters, cursor);
      });
    });
  }

  protected openCreate(): void {
    if (!this.canManage) return;
    this.functionModal().openCreate();
  }

  protected openEdit(row: FunctionSummaryDto): void {
    this.functionModal().openEdit(row);
  }

  protected onSearchInput(raw: string): void {
    this.searchDraft.set(raw);
    if (this.searchTimer !== null) clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => {
      this.commitSearchNow();
    }, 250);
  }

  protected commitSearchNow(): void {
    if (this.searchTimer !== null) {
      clearTimeout(this.searchTimer);
      this.searchTimer = null;
    }
    const next = this.searchDraft().trim();
    if (next === this.searchQuery()) return;
    this.cursorStack.set([]);
    this.searchQuery.set(next);
  }

  protected clearSearch(): void {
    this.searchDraft.set('');
    this.commitSearchNow();
  }

  protected openFiltersModal(): void {
    this.draftFilters.set({ ...this.filters() });
    this.filtersOpen.set(true);
    this.filtersModal().open();
  }

  protected updateDraftStatus(status: '' | FunctionStatus): void {
    this.draftFilters.update((f) => ({ ...f, status }));
  }

  protected updateDraftScopeType(scopeType: '' | FunctionScopeType): void {
    this.draftFilters.update((f) => ({
      ...f,
      scopeType,
      companyId: scopeType === 'COMPANY' ? f.companyId : '',
    }));
  }

  protected updateDraftCompany(companyId: string): void {
    this.draftFilters.update((f) => ({ ...f, companyId }));
  }

  protected applyFilters(): void {
    this.cursorStack.set([]);
    this.filters.set({ ...this.draftFilters() });
    this.filtersModal().close();
  }

  protected clearFiltersFromModal(): void {
    this.draftFilters.set({ ...EMPTY_FILTERS });
    this.cursorStack.set([]);
    this.filters.set({ ...EMPTY_FILTERS });
    this.filtersModal().close();
  }

  protected removeChip(key: 'status' | 'scope'): void {
    this.cursorStack.set([]);
    this.filters.update((f) =>
      key === 'status' ? { ...f, status: '' } : { ...f, scopeType: '', companyId: '' },
    );
  }

  protected clearAllFilters(): void {
    if (this.searchTimer !== null) {
      clearTimeout(this.searchTimer);
      this.searchTimer = null;
    }
    this.searchDraft.set('');
    this.searchQuery.set('');
    this.cursorStack.set([]);
    this.filters.set({ ...EMPTY_FILTERS });
  }

  protected reload(): void {
    void this.loadList(this.searchQuery(), this.filters(), this.currentCursor());
  }

  protected previousPage(): void {
    if (!this.hasPrevPage() || this.loading()) return;
    this.cursorStack.update((s) => s.slice(0, -1));
  }

  protected nextPage(): void {
    const next = this.pageInfo().nextCursor;
    if (!this.hasNextPage() || !next || this.loading()) return;
    this.cursorStack.update((s) => [...s, next]);
  }

  protected scopeInfo(row: FunctionSummaryDto) {
    this.i18n();
    return describeFunctionScope(row.scope, this.companyOptions(), (k) => this.transloco.translate(k));
  }

  protected formatDate(iso: string): string {
    return formatFunctionDate(iso, this.language());
  }

  protected resolvedPublishedNumber(versionId: string | null | undefined): number | null {
    if (!versionId) return null;
    const num = this.publishedVersionNumbers()[versionId];
    return typeof num === 'number' ? num : null;
  }

  protected actionsFor(row: FunctionSummaryDto): ActionItem[] {
    this.i18n();
    const t = (key: string) => this.transloco.translate(key);
    const isActive = row.status === 'ACTIVE';
    const disabledReason = !this.canManage ? t('tplFunctions.actions.manageRequired') : undefined;

    return [
      {
        id: 'open',
        title: t('tplFunctions.actions.open'),
        icon: 'tablerEye',
        tile: 'bg-icon-blue',
      },
      isActive
        ? {
            id: 'archive',
            title: t('tplFunctions.actions.archive'),
            icon: 'tablerArchive',
            tile: this.canManage ? 'bg-icon-orange' : 'bg-icon-gray',
            disabled: !this.canManage,
            reason: disabledReason,
          }
        : {
            id: 'restore',
            title: t('tplFunctions.actions.restore'),
            icon: 'tablerArrowBackUp',
            tile: this.canManage ? 'bg-icon-teal' : 'bg-icon-gray',
            disabled: !this.canManage,
            reason: disabledReason,
          },
    ];
  }

  protected onRowAction(row: FunctionSummaryDto, selection: ActionSelection): void {
    if (selection.id === 'open') {
      this.openEdit(row);
    } else if (selection.id === 'archive') {
      void this.handleArchiveOrRestore(row, 'archive');
    } else if (selection.id === 'restore') {
      void this.handleArchiveOrRestore(row, 'restore');
    }
  }

  protected onRowKeydown(event: KeyboardEvent, row: FunctionSummaryDto): void {
    if (event.target !== event.currentTarget) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.openEdit(row);
    }
  }

  protected onModalSaved(event: { detail: FunctionDetailDto; isNew: boolean }): void {
    if (event.isNew && this.cursorStack().length > 0) {
      this.cursorStack.set([]);
      return;
    }
    this.reload();
  }

  protected onVersionResolved(event: { versionId: string; versionNumber: number }): void {
    this.publishedVersionNumbers.update((map) => ({
      ...map,
      [event.versionId]: event.versionNumber,
    }));
  }

  private async handleArchiveOrRestore(row: FunctionSummaryDto, action: 'archive' | 'restore'): Promise<void> {
    if (!this.canManage) return;
    const reason = await this.rowReasonModal().open({
      mode: action,
      functionName: row.name,
    });
    if (!reason) return;

    try {
      if (action === 'archive') {
        await archiveFunction(row.id, { reason }, row.etag, newTemplateIdempotencyKey());
        this.notify.success(this.transloco.translate('tplFunctions.toasts.archived'));
      } else {
        await restoreFunction(row.id, { reason }, row.etag, newTemplateIdempotencyKey());
        this.notify.success(this.transloco.translate('tplFunctions.toasts.restored'));
      }
      this.reload();
    } catch (error) {
      this.notify.error(translateFunctionError(error, (k, p) => this.transloco.translate(k, p)));
    }
  }

  private async loadList(
    name: string,
    filters: FunctionFilters,
    cursor: string | null,
  ): Promise<void> {
    const seq = ++this.loadSeq;
    if (!this.canRead) {
      this.loading.set(false);
      this.errorState.set('forbidden');
      return;
    }

    const query: FunctionsListQuery = {
      limit: 25,
      cursor: cursor ?? undefined,
    };
    if (name.trim()) query.name = name.trim();
    if (filters.status) query.status = filters.status;
    if (filters.scopeType) query.scopeType = filters.scopeType;
    if (filters.scopeType === 'COMPANY' && filters.companyId) {
      query.companyId = filters.companyId;
    }

    this.loading.set(true);
    this.errorState.set('none');
    this.correlationId.set(null);

    try {
      const page = await listFunctions(query);
      if (seq !== this.loadSeq) return;
      this.functions.set(page.items);
      this.pageInfo.set(page.pageInfo);
    } catch (error) {
      if (seq !== this.loadSeq) return;
      this.handleLoadError(error);
    } finally {
      if (seq === this.loadSeq) {
        this.loading.set(false);
      }
    }
  }

  private handleLoadError(error: unknown): void {
    if (error instanceof TemplateApiError) {
      this.correlationId.set(error.correlationId);
      if (error.code === 'CORE.TEMPLATE.FEATURE.DISABLED') {
        this.errorState.set('featureDisabled');
        return;
      }
      if (error.status === 403 || error.code === 'CORE.TEMPLATE.PERMISSION.DENIED') {
        this.errorState.set('forbidden');
        return;
      }
    }
    this.errorState.set('failed');
  }
}
