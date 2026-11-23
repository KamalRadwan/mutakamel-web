import { Component, DestroyRef, computed, effect, inject, input, linkedSignal, resource, signal, untracked, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerAdjustmentsHorizontal,
  tablerChevronLeft,
  tablerChevronRight,
  tablerFileDescription,
  tablerFileInvoice,
  tablerFileText,
  tablerLayoutGrid,
  tablerLock,
  tablerMail,
  tablerPlus,
  tablerReceipt,
  tablerRefresh,
  tablerSearch,
  tablerShoppingCart,
  tablerTable,
  tablerTemplate,
  tablerX,
} from '@ng-icons/tabler-icons';
import { ApiError, correlationIdOf, isRetryableWriteError, writeErrorMessage } from '../../../../../core/api/api-errors';
import { newIdempotencyKey } from '../../../../../core/api/idempotency';
import { LanguageState } from '../../../../../core/i18n/language';
import { Notify } from '../../../../../core/notify/notify';
import { TenantScopeState } from '../../../../../core/scope/tenant-scope';
import { ActionSelection, ActionsMenu } from '../../../../../shared/ui/actions-menu/actions-menu';
import { Button } from '../../../../../shared/ui/button/button';
import { ConfirmDialog } from '../../../../../shared/ui/confirm-dialog/confirm-dialog';
import { ViewOption, ViewSwitcher } from '../../../../../shared/ui/view-switcher/view-switcher';
import { TemplateCreateWizard, TemplateDuplicateModal } from '../../create';
import { templateFamilyMeta, templateValidationMeta } from '../../shared/template-family';
import {
  TemplatesApi,
  type TemplateCreationScope,
  type TemplateCreationScopesResponse,
  type TemplateListRequestDto,
  type TemplateListResponse,
  type TemplateListRow,
} from '../../templates.api';
import { formatDateRangeLabel } from '../date-range-field/date-range-field';
import {
  LibraryCard,
  buildTemplateRowActions,
  formatTemplateDate,
} from '../library-card/library-card';
import { LibraryFilters, LibraryFiltersModal, emptyLibraryFilters } from '../library-filters-modal/library-filters-modal';

type LibraryViewMode = 'cards' | 'table';
type FilterChipKey =
  | 'documentType'
  | 'outputChannel'
  | 'layoutMode'
  | 'lifecycleStatus'
  | 'locale'
  | 'definitionScopeType'
  | 'hasPublishedVersion'
  | 'updatedRange';

interface FilterChip {
  key: FilterChipKey;
  labelKey: string;
  valueText: string;
}

const SEARCH_DEBOUNCE_MS = 250;

type AssignmentTargetParams = Pick<
  TemplateListRequestDto,
  'assignmentScopeType' | 'assignmentCompanyId' | 'assignmentBranchId'
>;

type RowMutationKind = 'archive' | 'restore' | 'delete';

function unwrapApiError(raw: unknown): ApiError | null {
  if (raw instanceof ApiError) return raw;
  if (raw && typeof raw === 'object' && 'cause' in raw) {
    const cause = (raw as { cause: unknown }).cause;
    if (cause instanceof ApiError) return cause;
  }
  return null;
}

@Component({
  selector: 'app-library-page',
  imports: [
    RouterLink,
    NgIcon,
    TranslocoPipe,
    Button,
    ViewSwitcher,
    ActionsMenu,
    ConfirmDialog,
    LibraryFiltersModal,
    LibraryCard,
    TemplateCreateWizard,
    TemplateDuplicateModal,
  ],
  providers: [
    provideTranslocoScope('templates', { scope: 'templates-library', alias: 'templatesLibrary' }),
    provideIcons({
      tablerPlus,
      tablerSearch,
      tablerX,
      tablerAdjustmentsHorizontal,
      tablerLayoutGrid,
      tablerTable,
      tablerChevronLeft,
      tablerChevronRight,
      tablerLock,
      tablerTemplate,
      tablerRefresh,
      tablerFileText,
      tablerReceipt,
      tablerShoppingCart,
      tablerFileInvoice,
      tablerFileDescription,
      tablerMail,
    }),
  ],
  templateUrl: './library-page.html',
  host: { class: 'flex flex-1 shrink-0 flex-col gap-8 p-12' },
})
export class LibraryPage {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly templatesApi = inject(TemplatesApi);
  private readonly tenantScope = inject(TenantScopeState);
  private readonly language = inject(LanguageState).current;
  private readonly notify = inject(Notify);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly destroyRef = inject(DestroyRef);
  private readonly queryParams = toSignal(this.route.queryParamMap);

  private readonly filtersModal = viewChild.required(LibraryFiltersModal);
  private readonly duplicateModal = viewChild.required<TemplateDuplicateModal>('dup');
  private readonly deleteConfirm = viewChild.required<ConfirmDialog>('deleteConfirm');

  /** Bound from the `?view=` query parameter. */
  readonly view = input<string>();

  protected readonly createOpen = computed(() => this.queryParams()?.get('create') === '1');
  private navigatingAfterCreate = false;

  protected readonly skeletonRows = [1, 2, 3, 4, 5];
  protected readonly skeletonCards = [1, 2, 3, 4, 5, 6];

  protected readonly viewMode = computed<LibraryViewMode>(() => (this.view() === 'cards' ? 'cards' : 'table'));
  protected readonly searchDraft = signal('');
  protected readonly appliedSearch = signal('');
  protected readonly filters = signal<LibraryFilters>(emptyLibraryFilters());
  protected readonly filtersModalOpen = signal(false);
  protected readonly reloadTick = signal(0);
  protected readonly busyIds = signal<ReadonlySet<string>>(new Set());
  protected readonly deletingName = signal('');

  private readonly pendingWriteKeys = new Map<string, string>();
  private searchTimer: ReturnType<typeof setTimeout> | null = null;

  private readonly assignmentScope = computed<AssignmentTargetParams>(() => {
    const me = this.tenantScope.me();
    const selection = this.tenantScope.selection();
    const readGrant = me?.permissionScopes['templates.read'];
    const tenantWide = Boolean(me?.isTenantOwner || readGrant?.tenantWide);

    if (selection?.branchId) {
      return {
        assignmentScopeType: 'BRANCH',
        assignmentCompanyId: selection.companyId,
        assignmentBranchId: selection.branchId,
      };
    }

    if (selection) {
      if (tenantWide || !readGrant || readGrant.companyIds.includes(selection.companyId)) {
        return {
          assignmentScopeType: 'COMPANY',
          assignmentCompanyId: selection.companyId,
        };
      }
      const branchInCompany = readGrant.branchIds.find(
        (branchId) => this.tenantScope.branchCompanies().get(branchId) === selection.companyId,
      );
      if (branchInCompany) {
        return {
          assignmentScopeType: 'BRANCH',
          assignmentCompanyId: selection.companyId,
          assignmentBranchId: branchInCompany,
        };
      }
    }

    if (tenantWide || !me) {
      return { assignmentScopeType: 'TENANT' };
    }

    if (readGrant?.companyIds[0]) {
      return {
        assignmentScopeType: 'COMPANY',
        assignmentCompanyId: readGrant.companyIds[0],
      };
    }

    const branchCompanies = this.tenantScope.branchCompanies();
    for (const branchId of readGrant?.branchIds ?? []) {
      const companyId = branchCompanies.get(branchId);
      if (companyId) {
        return {
          assignmentScopeType: 'BRANCH',
          assignmentCompanyId: companyId,
          assignmentBranchId: branchId,
        };
      }
    }

    const fallbackCompany = this.tenantScope.selectorCompanyIds()[0];
    if (fallbackCompany) {
      const fallbackBranch = this.tenantScope.branchesFor(fallbackCompany)[0];
      return fallbackBranch
        ? {
            assignmentScopeType: 'BRANCH',
            assignmentCompanyId: fallbackCompany,
            assignmentBranchId: fallbackBranch,
          }
        : {
            assignmentScopeType: 'COMPANY',
            assignmentCompanyId: fallbackCompany,
          };
    }

    return { assignmentScopeType: 'TENANT' };
  });

  private readonly scopeKey = computed(() => {
    const me = this.tenantScope.me();
    return JSON.stringify([
      me?.id ?? null,
      me?.isTenantOwner ?? false,
      me?.permissions ?? [],
      me?.permissionScopes ?? {},
      this.assignmentScope(),
    ]);
  });

  private readonly paginationResetKey = computed(() =>
    JSON.stringify([this.scopeKey(), this.appliedSearch(), this.filters()]),
  );

  protected readonly currentCursor = linkedSignal<string, string | null>({
    source: this.paginationResetKey,
    computation: () => null,
  });

  protected readonly cursorStack = linkedSignal<string, (string | null)[]>({
    source: this.paginationResetKey,
    computation: () => [],
  });

  private readonly canRequestCreationScopes = computed(() => {
    const me = this.tenantScope.me();
    return !me || Boolean(me.isTenantOwner || me.permissions.includes('templates.create'));
  });

  private readonly creationScopesResource = resource({
    params: () => ({
      tick: this.reloadTick(),
      scopeKey: this.scopeKey(),
      canLoad: this.canRequestCreationScopes(),
    }),
    loader: ({ params }): Promise<TemplateCreationScopesResponse> =>
      params.canLoad
        ? this.templatesApi.getCreationScopes().catch((error: unknown) => {
            this.notify.error(writeErrorMessage(error, 'templates', this.transloco));
            return { scopes: [] };
          })
        : Promise.resolve({ scopes: [] }),
  });

  protected readonly canCreate = computed(() => (this.creationScopesResource.value()?.scopes.length ?? 0) > 0);

  protected readonly activeScopeName = computed(() => {
    this.i18n();
    const target = this.assignmentScope();
    if (target.assignmentScopeType === 'COMPANY' && target.assignmentCompanyId) {
      const match = this.creationScopesResource
        .value()
        ?.scopes.find(
          (scope): scope is Extract<TemplateCreationScope, { type: 'COMPANY' }> =>
            scope.type === 'COMPANY' && scope.companyId === target.assignmentCompanyId,
        );
      if (match) return match.label;
    }
    return this.transloco.translate(`templatesLibrary.table.scopeTypes.${target.assignmentScopeType}`);
  });

  private readonly listRequest = computed<TemplateListRequestDto>(() => {
    this.reloadTick();
    this.scopeKey();
    const target = this.assignmentScope();
    const f = this.filters();
    const name = this.appliedSearch().trim();
    const definitionCompanyId =
      f.definitionScopeType === 'COMPANY'
        ? target.assignmentCompanyId ??
          this.tenantScope.selection()?.companyId ??
          this.tenantScope.selectorCompanyIds()[0] ??
          this.firstCreationCompanyId()
        : undefined;

    return {
      ...target,
      ...(name ? { name } : {}),
      ...(f.documentType ? { documentType: f.documentType } : {}),
      ...(f.outputChannel ? { outputChannel: f.outputChannel } : {}),
      ...(f.layoutMode ? { layoutMode: f.layoutMode } : {}),
      ...(f.lifecycleStatus ? { lifecycleStatus: f.lifecycleStatus } : {}),
      ...(f.locale ? { locale: f.locale } : {}),
      ...(f.definitionScopeType
        ? {
            definitionScopeType: f.definitionScopeType,
            ...(definitionCompanyId ? { definitionCompanyId } : {}),
          }
        : {}),
      ...(f.hasPublishedVersion !== null ? { hasPublishedVersion: f.hasPublishedVersion } : {}),
      ...(f.dateRange.updatedFrom && f.dateRange.updatedTo
        ? { updatedFrom: f.dateRange.updatedFrom, updatedTo: f.dateRange.updatedTo }
        : {}),
      cursor: this.currentCursor(),
      limit: 10,
    };
  });

  private readonly listResource = resource({
    params: () => this.listRequest(),
    loader: ({ params }) => this.templatesApi.listTemplates(params),
  });

  private readonly lastResponse = signal<TemplateListResponse | null>(null);
  private readonly listApiError = computed(() => unwrapApiError(this.listResource.error()));

  protected readonly loading = this.listResource.isLoading;

  protected readonly errorKind = computed<'none' | 'forbidden' | 'featureDisabled' | 'failed'>(() => {
    if (this.loading()) return 'none';
    const raw = this.listResource.error();
    if (!raw) return 'none';
    const err = this.listApiError();
    if (err) {
      if (err.code === 'CORE.TEMPLATE.FEATURE.DISABLED' || err.code === 'FEATURE.DISABLED') {
        return 'featureDisabled';
      }
      if (
        (err.status === 403 &&
          !['TENANT_MAINTENANCE_ACTIVE', 'TENANT_MAINTENANCE_RELEASE_REQUIRED'].includes(err.code)) ||
        err.code === 'CORE.TEMPLATE.PERMISSION.DENIED'
      ) {
        return 'forbidden';
      }
    }
    return 'failed';
  });

  protected readonly errorCorrelationId = computed(() => correlationIdOf(this.listApiError()));

  protected readonly items = computed<TemplateListRow[]>(() => {
    if (this.listResource.error()) return [];
    if (this.listResource.hasValue()) return this.listResource.value().items;
    return this.lastResponse()?.items ?? [];
  });

  protected readonly totalCount = computed(() => {
    if (this.listResource.hasValue()) return this.listResource.value().totalCount;
    return this.lastResponse()?.totalCount ?? 0;
  });

  protected readonly hasNextPage = computed(() =>
    this.listResource.hasValue()
      ? this.listResource.value().pageInfo.hasNextPage && Boolean(this.listResource.value().pageInfo.nextCursor)
      : false,
  );

  protected readonly hasPrevPage = computed(() => this.cursorStack().length > 0);

  protected readonly views = computed<ViewOption[]>(() => {
    this.i18n();
    return [
      { id: 'cards', icon: 'tablerLayoutGrid', label: this.transloco.translate('templatesLibrary.views.cards') },
      { id: 'table', icon: 'tablerTable', label: this.transloco.translate('templatesLibrary.views.table') },
    ];
  });

  protected readonly activeChips = computed<FilterChip[]>(() => {
    this.i18n();
    const lang = this.language();
    const f = this.filters();
    const chips: FilterChip[] = [];

    if (f.documentType) {
      chips.push({
        key: 'documentType',
        labelKey: 'templatesLibrary.chips.documentType',
        valueText: this.transloco.translate(`templates.families.${f.documentType}`),
      });
    }
    if (f.outputChannel) {
      chips.push({
        key: 'outputChannel',
        labelKey: 'templatesLibrary.chips.outputChannel',
        valueText: this.transloco.translate(`templates.channels.${f.outputChannel}`),
      });
    }
    if (f.layoutMode) {
      chips.push({
        key: 'layoutMode',
        labelKey: 'templatesLibrary.chips.layoutMode',
        valueText: this.transloco.translate(`templates.layouts.${f.layoutMode}`),
      });
    }
    if (f.lifecycleStatus) {
      chips.push({
        key: 'lifecycleStatus',
        labelKey: 'templatesLibrary.chips.lifecycleStatus',
        valueText: this.transloco.translate(`templates.lifecycle.${f.lifecycleStatus}`),
      });
    }
    if (f.locale) {
      chips.push({
        key: 'locale',
        labelKey: 'templatesLibrary.chips.locale',
        valueText: this.transloco.translate(`templates.locales.${f.locale}`),
      });
    }
    if (f.definitionScopeType) {
      chips.push({
        key: 'definitionScopeType',
        labelKey: 'templatesLibrary.chips.definitionScopeType',
        valueText: this.transloco.translate(
          f.definitionScopeType === 'TENANT'
            ? 'templatesLibrary.filtersModal.scopeTenant'
            : 'templatesLibrary.filtersModal.scopeCompany',
        ),
      });
    }
    if (f.hasPublishedVersion !== null) {
      chips.push({
        key: 'hasPublishedVersion',
        labelKey: 'templatesLibrary.chips.hasPublishedVersion',
        valueText: this.transloco.translate(
          f.hasPublishedVersion ? 'templatesLibrary.filtersModal.yes' : 'templatesLibrary.filtersModal.no',
        ),
      });
    }
    if (f.dateRange.updatedFrom && f.dateRange.updatedTo) {
      chips.push({
        key: 'updatedRange',
        labelKey: 'templatesLibrary.chips.updatedRange',
        valueText: formatDateRangeLabel(f.dateRange, lang),
      });
    }
    return chips;
  });

  protected readonly hasActiveQuery = computed(
    () => this.appliedSearch().trim().length > 0 || this.activeChips().length > 0,
  );

  protected readonly isFirstUseEmpty = computed(
    () => !this.loading() && this.errorKind() === 'none' && this.items().length === 0 && !this.hasActiveQuery(),
  );

  protected readonly isFilteredEmpty = computed(
    () => !this.loading() && this.errorKind() === 'none' && this.items().length === 0 && this.hasActiveQuery(),
  );

  protected readonly showToolbar = computed(
    () => this.errorKind() === 'none' && !this.isFirstUseEmpty(),
  );

  constructor() {
    effect(() => {
      if (this.listResource.hasValue()) {
        const val = this.listResource.value();
        untracked(() => this.lastResponse.set(val));
      }
    });

    let prevScopeKey = this.scopeKey();
    effect(() => {
      const nextScopeKey = this.scopeKey();
      if (nextScopeKey === prevScopeKey) return;
      prevScopeKey = nextScopeKey;
      untracked(() => this.lastResponse.set(null));
    });

    effect(() => {
      const err = this.listApiError();
      if (err && err.code === 'CORE.TEMPLATE.CURSOR.INVALID' && untracked(() => this.currentCursor() !== null)) {
        untracked(() => this.resetPagination());
      }
    });

    this.destroyRef.onDestroy(() => {
      if (this.searchTimer !== null) {
        clearTimeout(this.searchTimer);
      }
    });
  }

  protected reload(): void {
    this.reloadTick.update((n) => n + 1);
  }

  protected openCreate(): void {
    if (!this.canCreate()) return;
    this.navigatingAfterCreate = false;
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { create: 1 },
      queryParamsHandling: 'merge',
    });
  }

  protected onTemplateCreated(): void {
    this.navigatingAfterCreate = true;
  }

  protected closeCreate(): void {
    if (this.navigatingAfterCreate) {
      this.navigatingAfterCreate = false;
      return;
    }
    if (this.queryParams()?.has('create')) {
      void this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { create: null },
        queryParamsHandling: 'merge',
        replaceUrl: true,
      });
    }
  }

  protected setViewMode(mode: string): void {
    const next: LibraryViewMode = mode === 'cards' ? 'cards' : 'table';
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { view: next === 'table' ? null : next },
      queryParamsHandling: 'merge',
    });
  }

  protected onSearchInput(value: string): void {
    this.searchDraft.set(value);
    if (this.searchTimer !== null) {
      clearTimeout(this.searchTimer);
    }
    this.searchTimer = setTimeout(() => {
      this.searchTimer = null;
      this.commitSearch(value);
    }, SEARCH_DEBOUNCE_MS);
  }

  protected commitSearchNow(): void {
    if (this.searchTimer !== null) {
      clearTimeout(this.searchTimer);
      this.searchTimer = null;
    }
    this.commitSearch(this.searchDraft());
  }

  protected clearSearch(): void {
    if (this.searchTimer !== null) {
      clearTimeout(this.searchTimer);
      this.searchTimer = null;
    }
    this.searchDraft.set('');
    this.commitSearch('');
  }

  protected openFiltersModal(): void {
    this.filtersModalOpen.set(true);
    this.filtersModal().open(this.filters());
  }

  protected onFiltersApplied(next: LibraryFilters): void {
    this.filtersModalOpen.set(false);
    this.filters.set(next);
    this.resetPagination();
  }

  protected removeChip(key: FilterChipKey): void {
    const current = this.filters();
    const next: LibraryFilters = { ...current };
    if (key === 'updatedRange') {
      next.dateRange = emptyLibraryFilters().dateRange;
    } else {
      next[key] = null;
    }
    this.filters.set(next);
    this.resetPagination();
  }

  protected clearAllFilters(): void {
    if (this.searchTimer !== null) {
      clearTimeout(this.searchTimer);
      this.searchTimer = null;
    }
    this.searchDraft.set('');
    this.appliedSearch.set('');
    this.filters.set(emptyLibraryFilters());
    this.resetPagination();
  }

  protected goNext(): void {
    if (this.loading() || !this.hasNextPage() || !this.listResource.hasValue()) return;
    const nextCursor = this.listResource.value().pageInfo.nextCursor;
    if (!nextCursor) return;
    this.cursorStack.update((stack) => [...stack, this.currentCursor()]);
    this.currentCursor.set(nextCursor);
  }

  protected goPrev(): void {
    if (this.loading()) return;
    const stack = this.cursorStack();
    if (stack.length === 0) return;
    const prev = stack[stack.length - 1] ?? null;
    this.cursorStack.set(stack.slice(0, -1));
    this.currentCursor.set(prev);
  }

  protected openTemplate(row: TemplateListRow): void {
    void this.router.navigate(['/workspace/operations/template-platform', row.templateId]);
  }

  protected onRowKeydown(event: KeyboardEvent, row: TemplateListRow): void {
    if (event.target !== event.currentTarget) return;
    if (event.key === 'Enter') {
      event.preventDefault();
      this.openTemplate(row);
    }
  }

  protected familyLook(row: TemplateListRow) {
    return templateFamilyMeta(row.documentType, row.outputChannel);
  }

  protected validationClass(row: TemplateListRow): string {
    return templateValidationMeta(row.draft.validationState).badgeClasses;
  }

  protected formatDate(iso: string): string {
    return formatTemplateDate(iso, this.language());
  }

  protected rowActions(row: TemplateListRow) {
    this.i18n();
    return buildTemplateRowActions(row, (key) => this.transloco.translate(key));
  }

  protected onRowAction(row: TemplateListRow, selection: ActionSelection): void {
    if (this.busyIds().has(row.templateId)) return;

    switch (selection.id) {
      case 'open':
        this.openTemplate(row);
        break;
      case 'design':
        void this.router.navigate(['/workspace/operations/template-platform', row.templateId, 'design']);
        break;
      case 'preview':
        void this.router.navigate(['/workspace/operations/template-platform', row.templateId, 'preview']);
        break;
      case 'duplicateFromDraft':
        this.duplicateModal().open({ templateId: row.templateId, sourceKind: 'CURRENT_DRAFT' });
        break;
      case 'duplicateFromVersion':
        this.duplicateModal().open({
          templateId: row.templateId,
          sourceKind: 'VERSION',
          versionId: row.currentPublishedVersion?.versionId,
        });
        break;
      case 'manageAssignments':
        void this.router.navigate(['/workspace/operations/template-assignments'], {
          queryParams: { templateId: row.templateId },
        });
        break;
      case 'archive':
        void this.performRowMutation(
          'archive',
          row,
          (key) => this.templatesApi.archiveTemplate(row.templateId, row.definitionEtag, key),
          'templatesLibrary.toasts.archived',
        );
        break;
      case 'restore':
        void this.performRowMutation(
          'restore',
          row,
          (key) => this.templatesApi.restoreTemplate(row.templateId, row.definitionEtag, key),
          'templatesLibrary.toasts.restored',
        );
        break;
      case 'delete':
        void this.confirmDelete(row);
        break;
    }
  }

  private firstCreationCompanyId(): string | undefined {
    const scope = this.creationScopesResource
      .value()
      ?.scopes.find(
        (item): item is Extract<TemplateCreationScope, { type: 'COMPANY' }> => item.type === 'COMPANY',
      );
    return scope?.companyId;
  }

  private commitSearch(value: string): void {
    const next = value.trim();
    if (next === this.appliedSearch()) return;
    this.appliedSearch.set(next);
    this.resetPagination();
  }

  private resetPagination(): void {
    this.cursorStack.set([]);
    this.currentCursor.set(null);
  }

  private async confirmDelete(row: TemplateListRow): Promise<void> {
    this.deletingName.set(row.name);
    if (!(await this.deleteConfirm().open())) return;
    await this.performRowMutation(
      'delete',
      row,
      (key) => this.templatesApi.deleteTemplate(row.templateId, row.definitionEtag, key),
      'templatesLibrary.toasts.deleted',
    );
  }

  private async performRowMutation(
    kind: RowMutationKind,
    row: TemplateListRow,
    action: (key: string) => Promise<unknown>,
    successKey: string,
  ): Promise<boolean> {
    const intentKey = `${kind}:${row.templateId}:${row.definitionEtag}`;
    const key = this.pendingWriteKeys.get(intentKey) ?? newIdempotencyKey();
    this.pendingWriteKeys.set(intentKey, key);

    this.busyIds.update((set) => {
      const next = new Set(set);
      next.add(row.templateId);
      return next;
    });
    try {
      await action(key);
      this.pendingWriteKeys.delete(intentKey);
      this.notify.success(this.transloco.translate(successKey));
      if (kind === 'delete' && this.items().length <= 1 && this.hasPrevPage()) {
        this.goPrev();
      }
      this.reload();
      return true;
    } catch (error: unknown) {
      if (!isRetryableWriteError(error) && !(error instanceof ApiError && error.status === 401)) {
        this.pendingWriteKeys.delete(intentKey);
      }
      this.notifyError(error);
      return false;
    } finally {
      this.busyIds.update((set) => {
        const next = new Set(set);
        next.delete(row.templateId);
        return next;
      });
    }
  }

  private notifyError(error: unknown): void {
    if (error instanceof ApiError && error.status === 409 && error.code === 'CORE.TEMPLATE.CONCURRENCY.STALE_REVISION') {
      this.reload();
      this.notify.warning(
        this.transloco.translate('templates.states.conflict.title'),
        this.transloco.translate('templates.states.conflict.description'),
      );
      return;
    }
    if (error instanceof ApiError && (error.status === 404 || error.status === 428)) {
      this.reload();
    }
    this.notify.error(writeErrorMessage(error, 'templates', this.transloco));
  }
}
