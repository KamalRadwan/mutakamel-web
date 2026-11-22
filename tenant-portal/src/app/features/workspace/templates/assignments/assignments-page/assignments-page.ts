import { Component, computed, effect, inject, linkedSignal, signal, untracked, viewChild } from '@angular/core';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerAdjustmentsHorizontal,
  tablerBuilding,
  tablerChevronLeft,
  tablerChevronRight,
  tablerCircleCheck,
  tablerFileDescription,
  tablerFileInvoice,
  tablerFileText,
  tablerFilter,
  tablerLock,
  tablerMail,
  tablerMapPin,
  tablerPlus,
  tablerReceipt,
  tablerRefresh,
  tablerRoute,
  tablerShoppingCart,
  tablerWorld,
  tablerX,
} from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../../core/i18n/language';
import { Notify } from '../../../../../core/notify/notify';
import { ScopeState } from '../../../../../core/scope/scope';
import { ActionItem, ActionSelection, ActionsMenu } from '../../../../../shared/ui/actions-menu/actions-menu';
import { Button } from '../../../../../shared/ui/button/button';
import { ConfirmDialog } from '../../../../../shared/ui/confirm-dialog/confirm-dialog';
import { DateField } from '../../../../../shared/ui/date-time/date-field';
import { Dropdown, DropdownOption } from '../../../../../shared/ui/dropdown/dropdown';
import { Field } from '../../../../../shared/ui/field/field';
import { Modal } from '../../../../../shared/ui/modal/modal';
import {
  TemplateApiError,
  TemplateAssignmentDto,
  TemplateAssignmentStatus,
  TemplateAssignmentsListQuery,
  TemplateDataSourceKey,
  TemplateListRow,
  TemplatePageInfo,
  deactivateAssignment,
  getTemplate,
  listAssignments,
  listTemplates,
} from '../../templates.api';
import { AssignmentModal } from '../assignment-modal/assignment-modal';
import type { AssignmentScopeOption } from '../assignments.model';
import {
  SUPPORTED_ASSIGNMENT_SELECTORS,
  assignmentSelectorDropdownOptions,
  buildAssignmentScopeOptions,
  dateInputToStartIso,
  describeAssignmentDocument,
  describeAssignmentScope,
  formatEffectiveRange,
  formatShortDate,
  scopeKeyFromPortalSelection,
  translateAssignmentError,
} from '../assignments.service';
import { TestSelectionModal } from '../test-selection-modal/test-selection-modal';

const CAN_MANAGE = true; // later from the session permissions

interface AssignmentFilters {
  documentAdapter: '' | TemplateDataSourceKey;
  locale: '' | 'en-US' | 'ar-EG' | 'DEFAULT';
  status: '' | TemplateAssignmentStatus;
  effectiveAt: string | null;
}

const EMPTY_FILTERS: AssignmentFilters = {
  documentAdapter: '',
  locale: '',
  status: '',
  effectiveAt: null,
};

interface FilterChip {
  key: keyof AssignmentFilters;
  label: string;
}

interface TemplateLabelInfo {
  name: string;
  code: string;
}

@Component({
  selector: 'app-assignments-page',
  imports: [
    RouterLink,
    NgIcon,
    TranslocoPipe,
    ActionsMenu,
    AssignmentModal,
    Button,
    ConfirmDialog,
    DateField,
    Dropdown,
    Field,
    Modal,
    TestSelectionModal,
  ],
  providers: [
    provideTranslocoScope('templates', { scope: 'templates-assignments', alias: 'assignments' }),
    provideIcons({
      tablerAdjustmentsHorizontal,
      tablerBuilding,
      tablerChevronLeft,
      tablerChevronRight,
      tablerCircleCheck,
      tablerFileDescription,
      tablerFileInvoice,
      tablerFileText,
      tablerFilter,
      tablerLock,
      tablerMail,
      tablerMapPin,
      tablerPlus,
      tablerReceipt,
      tablerRefresh,
      tablerRoute,
      tablerShoppingCart,
      tablerWorld,
      tablerX,
    }),
  ],
  templateUrl: './assignments-page.html',
  host: { class: 'flex min-h-0 flex-1 flex-col gap-8 p-12' },
})
export class AssignmentsPage {
  private static nextId = 0;
  protected readonly uid = `assignments-page-${++AssignmentsPage.nextId}`;

  private readonly scopeState = inject(ScopeState);
  private readonly notify = inject(Notify);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  protected readonly language = inject(LanguageState).current;

  private readonly assignmentModal = viewChild.required(AssignmentModal);
  private readonly testSelectionModal = viewChild.required(TestSelectionModal);
  private readonly filtersModal = viewChild.required<Modal>('filtersModal');
  private readonly deactivateConfirm = viewChild.required<ConfirmDialog>('deactivateConfirm');

  protected readonly canManage = CAN_MANAGE;
  protected readonly skeletonRows = [1, 2, 3, 4, 5];

  protected readonly scopeOptions = computed<AssignmentScopeOption[]>(() => {
    this.i18n();
    this.language();
    return buildAssignmentScopeOptions(
      this.scopeState.companies(),
      this.language(),
      (k) => this.transloco.translate(k),
    );
  });

  protected readonly scopeDropdownOptions = computed<DropdownOption<string>[]>(() =>
    this.scopeOptions().map((opt) => ({ value: opt.key, label: opt.label })),
  );

  private readonly portalScopeKey = computed(() =>
    scopeKeyFromPortalSelection(this.scopeState.company().id, this.scopeState.branch().id),
  );

  protected readonly selectedScopeKey = linkedSignal<string, string>({
    source: this.portalScopeKey,
    computation: (portalKey) => {
      const options = this.scopeOptions();
      return options.some((opt) => opt.key === portalKey) ? portalKey : (options[0]?.key ?? 'TENANT');
    },
  });

  protected readonly filters = signal<AssignmentFilters>({ ...EMPTY_FILTERS });
  protected readonly draftFilters = signal<AssignmentFilters>({ ...EMPTY_FILTERS });
  protected readonly cursorStack = linkedSignal<string, string[]>({
    source: this.selectedScopeKey,
    computation: () => [],
  });
  protected readonly currentCursor = computed(() => {
    const stack = this.cursorStack();
    return stack.length > 0 ? stack[stack.length - 1] : null;
  });

  protected readonly assignments = signal<TemplateAssignmentDto[]>([]);
  protected readonly pageInfo = signal<TemplatePageInfo>({ limit: 25, hasNextPage: false, nextCursor: null });
  protected readonly definitions = signal<TemplateListRow[]>([]);
  protected readonly templateLabels = signal<Record<string, TemplateLabelInfo>>({});
  protected readonly loading = signal(true);
  protected readonly errorState = signal<'none' | 'forbidden' | 'featureDisabled' | 'failed'>('none');
  protected readonly correlationId = signal<string | null>(null);
  protected readonly deactivatingRow = signal<TemplateAssignmentDto | null>(null);

  private loadSeq = 0;
  private definitionsLoaded = false;

  protected readonly activeFiltersCount = computed(() => {
    const f = this.filters();
    let count = 0;
    if (f.documentAdapter) count++;
    if (f.locale) count++;
    if (f.status) count++;
    if (f.effectiveAt) count++;
    return count;
  });

  protected readonly activeFilterChips = computed<FilterChip[]>(() => {
    this.i18n();
    const lang = this.language();
    const f = this.filters();
    const chips: FilterChip[] = [];
    if (f.documentAdapter) {
      chips.push({
        key: 'documentAdapter',
        label: this.transloco.translate('assignments.chips.document', {
          value: this.transloco.translate(`assignments.adapters.${f.documentAdapter}`),
        }),
      });
    }
    if (f.locale) {
      const localeVal =
        f.locale === 'DEFAULT'
          ? this.transloco.translate('assignments.locales.all')
          : this.transloco.translate(`assignments.locales.${f.locale}`);
      chips.push({
        key: 'locale',
        label: this.transloco.translate('assignments.chips.language', { value: localeVal }),
      });
    }
    if (f.status) {
      chips.push({
        key: 'status',
        label: this.transloco.translate('assignments.chips.status', {
          value: this.transloco.translate(`assignments.status.${f.status}`),
        }),
      });
    }
    if (f.effectiveAt) {
      chips.push({
        key: 'effectiveAt',
        label: this.transloco.translate('assignments.chips.effectiveAt', {
          value: formatShortDate(f.effectiveAt, lang),
        }),
      });
    }
    return chips;
  });

  protected readonly filterDocumentOptions = computed<DropdownOption<'' | TemplateDataSourceKey>[]>(() => {
    this.i18n();
    return [
      { value: '', label: this.transloco.translate('assignments.filtersModal.allDocuments') },
      ...assignmentSelectorDropdownOptions((key) => this.transloco.translate(key)),
    ];
  });

  protected readonly filterLanguageOptions = computed<DropdownOption<'' | 'en-US' | 'ar-EG' | 'DEFAULT'>[]>(() => {
    this.i18n();
    return [
      { value: '', label: this.transloco.translate('assignments.locales.any') },
      { value: 'en-US', label: this.transloco.translate('assignments.locales.en-US') },
      { value: 'ar-EG', label: this.transloco.translate('assignments.locales.ar-EG') },
      { value: 'DEFAULT', label: this.transloco.translate('assignments.locales.all') },
    ];
  });

  protected readonly filterStatusOptions = computed<DropdownOption<'' | TemplateAssignmentStatus>[]>(() => {
    this.i18n();
    return [
      { value: '', label: this.transloco.translate('assignments.status.all') },
      { value: 'ACTIVE', label: this.transloco.translate('assignments.status.ACTIVE') },
      { value: 'INACTIVE', label: this.transloco.translate('assignments.status.INACTIVE') },
    ];
  });

  protected readonly hasPrevPage = computed(() => this.cursorStack().length > 0);
  protected readonly hasNextPage = computed(() => this.pageInfo().hasNextPage && !!this.pageInfo().nextCursor);

  protected readonly deactivateTargetName = computed(() => {
    this.i18n();
    const row = this.deactivatingRow();
    return row ? this.templateInfo(row).name : '';
  });

  protected readonly deactivateTargetVersion = computed(() => {
    const row = this.deactivatingRow();
    return row ? `v${row.versionNumber}` : '';
  });

  constructor() {
    effect(() => {
      const scopeKey = this.selectedScopeKey();
      const filters = this.filters();
      const cursor = this.currentCursor();
      untracked(() => {
        void this.loadAssignments(scopeKey, filters, cursor);
      });
    });
  }

  protected onScopeChanged(nextKey: string): void {
    if (nextKey === this.selectedScopeKey()) return;
    this.cursorStack.set([]);
    this.selectedScopeKey.set(nextKey);
  }

  protected openCreate(): void {
    if (!this.canManage) return;
    this.assignmentModal().openCreate(this.selectedScopeKey());
  }

  protected openEdit(row: TemplateAssignmentDto): void {
    this.assignmentModal().openEdit(row);
  }

  protected openTestSelection(): void {
    this.testSelectionModal().open(this.selectedScopeKey());
  }

  protected openFiltersModal(): void {
    this.draftFilters.set({ ...this.filters() });
    this.filtersModal().open();
  }

  protected updateDraftFilter<K extends keyof AssignmentFilters>(key: K, value: AssignmentFilters[K]): void {
    this.draftFilters.update((current) => ({ ...current, [key]: value }));
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

  protected clearAllFilters(): void {
    this.cursorStack.set([]);
    this.filters.set({ ...EMPTY_FILTERS });
  }

  protected removeFilterChip(key: keyof AssignmentFilters): void {
    this.cursorStack.set([]);
    this.filters.update((current) => ({
      ...current,
      [key]: key === 'effectiveAt' ? null : '',
    }));
  }

  protected reload(): void {
    void this.loadAssignments(this.selectedScopeKey(), this.filters(), this.currentCursor());
  }

  protected previousPage(): void {
    if (!this.hasPrevPage() || this.loading()) return;
    this.cursorStack.update((stack) => stack.slice(0, -1));
  }

  protected nextPage(): void {
    const next = this.pageInfo().nextCursor;
    if (!this.hasNextPage() || !next || this.loading()) return;
    this.cursorStack.update((stack) => [...stack, next]);
  }

  protected templateInfo(row: TemplateAssignmentDto): TemplateLabelInfo {
    this.i18n();
    const mapped = this.templateLabels()[row.definitionId];
    if (mapped) return mapped;
    return {
      name: this.transloco.translate('assignments.table.unknownTemplate'),
      code: '',
    };
  }

  protected documentInfo(row: TemplateAssignmentDto) {
    return describeAssignmentDocument(row.documentType, row.adapterKey);
  }

  protected scopeInfo(row: TemplateAssignmentDto) {
    this.i18n();
    return describeAssignmentScope(row.scope, this.scopeOptions(), (k) => this.transloco.translate(k));
  }

  protected localeLabel(row: TemplateAssignmentDto): string {
    this.i18n();
    return row.locale
      ? this.transloco.translate(`assignments.locales.${row.locale}`)
      : this.transloco.translate('assignments.locales.all');
  }

  protected effectiveLabel(row: TemplateAssignmentDto): string {
    return formatEffectiveRange(row.effectiveFrom, row.effectiveTo, this.language());
  }

  protected actionsFor(row: TemplateAssignmentDto): ActionItem[] {
    this.i18n();
    const t = (key: string) => this.transloco.translate(key);
    const isActive = row.status === 'ACTIVE';
    const deactivateDisabled = !this.canManage || !isActive;
    const reason = !this.canManage
      ? t('assignments.actions.deactivateNoPermission')
      : !isActive
        ? t('assignments.actions.deactivateAlreadyInactive')
        : undefined;

    return [
      {
        id: 'open',
        title: t('assignments.actions.open'),
        icon: 'tablerEye',
        tile: 'bg-icon-blue',
      },
      {
        id: 'deactivate',
        title: t('assignments.actions.deactivate'),
        icon: 'tablerCircleOff',
        tile: deactivateDisabled ? 'bg-icon-gray' : 'bg-icon-red',
        danger: true,
        disabled: deactivateDisabled,
        reason,
      },
    ];
  }

  protected onAction(row: TemplateAssignmentDto, selection: ActionSelection): void {
    if (selection.id === 'open') {
      this.openEdit(row);
    } else if (selection.id === 'deactivate') {
      void this.confirmDeactivate(row);
    }
  }

  protected onModalSaved(event: { assignment: TemplateAssignmentDto; isNew: boolean }): void {
    if (event.isNew && this.cursorStack().length > 0) {
      this.cursorStack.set([]);
      return;
    }
    void this.loadAssignments(this.selectedScopeKey(), this.filters(), this.currentCursor());
  }

  protected onModalDeactivated(): void {
    void this.loadAssignments(this.selectedScopeKey(), this.filters(), this.currentCursor());
  }

  private async confirmDeactivate(row: TemplateAssignmentDto): Promise<void> {
    if (!this.canManage || row.status !== 'ACTIVE') return;
    this.deactivatingRow.set(row);
    const confirmed = await this.deactivateConfirm().open();
    if (!confirmed) return;

    try {
      await deactivateAssignment(row.assignmentId, row.etag);
      this.notify.success(this.transloco.translate('assignments.toasts.deactivated'));
      void this.loadAssignments(this.selectedScopeKey(), this.filters(), this.currentCursor());
    } catch (error) {
      this.notify.error(translateAssignmentError(error, (k, p) => this.transloco.translate(k, p)));
    }
  }

  private async loadAssignments(
    scopeKey: string,
    filters: AssignmentFilters,
    cursor: string | null,
  ): Promise<void> {
    const seq = ++this.loadSeq;
    const scopeOpt = this.scopeOptions().find((opt) => opt.key === scopeKey) ?? {
      key: 'TENANT',
      scope: { type: 'TENANT' as const },
    };

    const query: TemplateAssignmentsListQuery = {
      scopeType: scopeOpt.scope.type,
      companyId: scopeOpt.scope.type !== 'TENANT' ? scopeOpt.scope.companyId : undefined,
      branchId: scopeOpt.scope.type === 'BRANCH' ? scopeOpt.scope.branchId : undefined,
      limit: 25,
      cursor: cursor ?? undefined,
    };

    if (filters.documentAdapter) {
      const selector = SUPPORTED_ASSIGNMENT_SELECTORS.find((s) => s.adapterKey === filters.documentAdapter);
      if (selector) {
        query.documentType = selector.documentType;
        query.outputChannel = selector.outputChannel;
        query.adapterKey = selector.adapterKey;
      }
    }
    if (filters.locale) {
      query.locale = filters.locale;
    }
    if (filters.status) {
      query.status = filters.status;
    }
    if (filters.effectiveAt) {
      query.effectiveAt = dateInputToStartIso(filters.effectiveAt);
    }

    this.loading.set(true);
    this.errorState.set('none');
    this.correlationId.set(null);

    try {
      const [page] = await Promise.all([
        listAssignments(query),
        this.ensureDefinitionsLoaded(),
      ]);
      if (seq !== this.loadSeq) return;

      await this.hydrateMissingTemplateLabels(page.items, seq);
      if (seq !== this.loadSeq) return;

      this.assignments.set(page.items);
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

  private async ensureDefinitionsLoaded(): Promise<void> {
    if (this.definitionsLoaded) return;
    try {
      const res = await listTemplates({ assignmentScopeType: 'TENANT', limit: 100 });
      this.definitions.set(res.items);
      const nextMap: Record<string, TemplateLabelInfo> = { ...this.templateLabels() };
      for (const item of res.items) {
        nextMap[item.templateId] = { name: item.name, code: item.code };
      }
      this.templateLabels.set(nextMap);
      this.definitionsLoaded = true;
    } catch {
      // Keep page usable if catalog lookup fails.
    }
  }

  private async hydrateMissingTemplateLabels(items: readonly TemplateAssignmentDto[], seq: number): Promise<void> {
    const known = this.templateLabels();
    const missingIds = Array.from(new Set(items.map((row) => row.definitionId))).filter((id) => !known[id]);
    if (missingIds.length === 0) return;

    const settled = await Promise.allSettled(missingIds.map((id) => getTemplate(id)));
    if (seq !== this.loadSeq) return;

    const additions: Record<string, TemplateLabelInfo> = {};
    settled.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        additions[missingIds[index]] = { name: result.value.name, code: result.value.code };
      }
    });
    if (Object.keys(additions).length > 0) {
      this.templateLabels.update((current) => ({ ...current, ...additions }));
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
