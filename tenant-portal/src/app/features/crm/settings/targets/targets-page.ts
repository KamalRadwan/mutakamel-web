import {
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  effect,
  inject,
  linkedSignal,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { translationEvents } from '../../../../core/i18n/translation-events';
import { ActivatedRoute, Router } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerArrowsSort,
  tablerCheck,
  tablerChevronDown,
  tablerEdit,
  tablerFilter,
  tablerHistory,
  tablerMapPin,
  tablerSend,
  tablerTarget,
  tablerTrash,
  tablerUser,
  tablerUsers,
  tablerUsersGroup,
  tablerX,
} from '@ng-icons/tabler-icons';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { LanguageState } from '../../../../core/i18n/language';
import { Notify } from '../../../../core/notify/notify';
import { ActionItem, ActionSelection, ActionsMenu } from '../../../../shared/ui/actions-menu/actions-menu';
import { Badge, BadgeTone } from '../../../../shared/ui/badge/badge';
import { Button } from '../../../../shared/ui/button/button';
import { DASH, formatNumber } from '../../../../shared/ui/chart/chart-format';
import { ConfirmDialog } from '../../../../shared/ui/confirm-dialog/confirm-dialog';
import { DataCell, DataColumn, DataSort, DataTable } from '../../../../shared/ui/data-table/data-table';
import { Field } from '../../../../shared/ui/field/field';
import { FullState } from '../../../../shared/ui/full-state/full-state';
import { Modal } from '../../../../shared/ui/modal/modal';
import { rectInPage, viewport } from '../../../../shared/ui/overlay/zoom';
import { Pagination } from '../../../../shared/ui/pagination/pagination';
import { SettingsFrame } from '../../../../shared/ui/settings-frame/settings-frame';
import { errorCodeOf, newIdempotencyKey } from '../../../../shared/widgets/dashboard/analytics-api';
import { can } from '../../../../shared/widgets/dashboard/analytics-permissions';
import { ReleasesModal } from './releases-modal/releases-modal';
import { TargetModal } from './target-modal/target-modal';
import {
  approveTarget,
  correctTarget,
  deleteTarget,
  getTarget,
  listTargets,
  rejectTarget,
  submitTarget,
  targetErrorMessage,
  isTargetGone,
  targetableMetrics,
} from './targets.api';
import {
  SalesTarget,
  TARGETABLE_METRICS,
  TARGET_MAX_VALUE,
  TargetApprovalState,
  TargetPeriodGrain,
  TargetSortBy,
  TargetSortDir,
  TargetWireSortDir,
  TargetSubjectType,
  TargetableMetric,
  formatTargetPeriod,
  formatTargetValue,
  isPeriodClosed,
  resolveMetricLabel,
  resolveTargetSubjectName,
  validateTargetValue,
} from './targets.model';
import { OrgApi } from '../../../../shared/widgets/dashboard/org.api';

type FilterMenuKey = 'grain' | 'state' | 'subjectType' | 'branch' | 'sort';
type SortOptionKey =
  | 'periodStart:desc'
  | 'periodStart:asc'
  | 'metricKey:asc'
  | 'metricKey:desc'
  | 'createdAt:desc'
  | 'createdAt:asc';

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 12;
const PAGE_SIZES: readonly number[] = [12, 24, 48, 96];

const SORT_OPTIONS: readonly SortOptionKey[] = [
  'periodStart:desc',
  'periodStart:asc',
  'metricKey:asc',
  'metricKey:desc',
  'createdAt:desc',
  'createdAt:asc',
];

interface FilterMenuPlace {
  top: number;
  start: number;
  minWidth: number;
  maxHeight: number | null;
}

interface FilterOptionItem {
  value: string | null;
  label: string;
}

const SUBJECT_VISUALS: Record<TargetSubjectType, { icon: string; tile: string }> = {
  USER: { icon: 'tablerUser', tile: 'bg-icon-blue' },
  TEAM: { icon: 'tablerUsers', tile: 'bg-icon-green' },
  BRANCH: { icon: 'tablerMapPin', tile: 'bg-icon-red' },
  TEAM_SET: { icon: 'tablerUsersGroup', tile: 'bg-icon-navy' },
};

function parsePositiveInt(raw: string | null | undefined, fallback: number): number {
  if (!raw || !/^\d+$/.test(raw)) return fallback;
  const parsed = Number(raw);
  return Number.isSafeInteger(parsed) && parsed >= 1 ? parsed : fallback;
}

function parsePageSize(raw: string | null | undefined): number {
  const parsed = parsePositiveInt(raw, DEFAULT_PAGE_SIZE);
  return PAGE_SIZES.includes(parsed) ? parsed : DEFAULT_PAGE_SIZE;
}

function parseNumericInput(raw: string): number | null {
  const clean = raw.replace(/,/g, '').trim();
  if (!clean) return null;
  const num = Number(clean);
  return Number.isFinite(num) ? num : NaN;
}

@Component({
  selector: 'app-targets-page',
  imports: [
    NgIcon,
    TranslocoPipe,
    ActionsMenu,
    Badge,
    Button,
    ConfirmDialog,
    DataCell,
    DataTable,
    Field,
    FullState,
    Modal,
    Pagination,
    SettingsFrame,
    ReleasesModal,
    TargetModal,
  ],
  providers: [
    provideTranslocoScope('settings', 'analytics', { scope: 'settings-targets', alias: 'targets' }),
    provideIcons({
      tablerUser,
      tablerUsers,
      tablerMapPin,
      tablerUsersGroup,
      tablerSend,
      tablerCheck,
      tablerX,
      tablerEdit,
      tablerHistory,
      tablerTrash,
      tablerChevronDown,
      tablerFilter,
      tablerArrowsSort,
      tablerTarget,
    }),
  ],
  templateUrl: './targets-page.html',
  host: {
    class: 'flex min-h-0 flex-1 flex-col',
    '(document:click)': 'onDocumentClick($event)',
    '(window:resize)': 'closeFilterMenu()',
    '(keydown.escape)': 'onHostEscape($event)',
  },
})
export class TargetsPage {
  private readonly org = inject(OrgApi);
  private static nextId = 0;
  protected readonly uid = `targets-page-${++TargetsPage.nextId}`;

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly notify = inject(Notify);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  protected readonly language = inject(LanguageState).current;

  private readonly targetModal = viewChild(TargetModal);
  private readonly releasesModal = viewChild(ReleasesModal);
  private readonly deleteDialog = viewChild<ConfirmDialog>('deleteDialog');
  private readonly conflictDialog = viewChild<ConfirmDialog>('conflictDialog');
  private readonly approveModal = viewChild<Modal>('approveModal');
  private readonly rejectModal = viewChild<Modal>('rejectModal');
  private readonly correctModal = viewChild<Modal>('correctModal');
  private readonly filterMenuPanel = viewChild<ElementRef<HTMLElement>>('filterMenuPanel');

  private readonly queryParams = toSignal(this.route.queryParamMap);

  protected readonly canRead = can('crm.targets.read');
  protected readonly canManage = can('crm.targets.manage');
  protected readonly canApprove = can('crm.targets.approve');
  protected readonly dash = DASH;

  protected readonly metrics = signal<TargetableMetric[]>([...TARGETABLE_METRICS]);
  protected readonly targets = signal<SalesTarget[]>([]);
  protected readonly total = signal(0);
  protected readonly loading = signal(false);
  protected readonly loadError = signal(false);

  protected readonly search = signal('');
  protected readonly grainFilter = signal<TargetPeriodGrain | null>(null);
  protected readonly stateFilter = signal<TargetApprovalState | null>(null);
  protected readonly subjectTypeFilter = signal<TargetSubjectType | null>(null);
  /** The list route requires `branchId` (BranchListQueryDto), so a branch is always selected. */
  private readonly defaultBranchId = this.org.branches[0]?.id ?? null;
  protected readonly branchFilter = signal<string | null>(this.defaultBranchId);
  protected readonly sortBy = signal<TargetSortBy>('periodStart');
  protected readonly sortDir = signal<TargetSortDir>('desc');

  protected readonly openMenu = signal<FilterMenuKey | null>(null);
  protected readonly menuPlaced = signal(false);
  protected readonly menuPlace = signal<FilterMenuPlace>({ top: 0, start: 0, minWidth: 160, maxHeight: null });

  protected readonly pendingDeleteTarget = signal<SalesTarget | null>(null);
  protected readonly activeActionTarget = signal<SalesTarget | null>(null);
  protected readonly actionBusy = signal(false);

  protected readonly approveNote = signal('');
  protected readonly rejectNote = signal('');
  protected readonly rejectTouched = signal(false);
  protected readonly rejectServerError = signal<string | null>(null);

  protected readonly correctValueInput = signal('');
  protected readonly correctReason = signal('');
  protected readonly correctTouched = signal<{ value?: boolean; reason?: boolean }>({});
  protected readonly correctServerErrors = signal<{ value?: string | null; reason?: string | null }>({});

  private activeTriggerEl: HTMLElement | null = null;
  private menuSeq = 0;
  private loadSeq = 0;
  /** One x-idempotency-key per user action, reused on retry while the request body is unchanged. */
  private pendingIdem: { key: string; bodyJson: string } | null = null;

  protected readonly page = linkedSignal<string | null | undefined, number>({
    source: () => this.queryParams()?.get('page'),
    computation: (param, previous) => {
      if (param !== previous?.source) return parsePositiveInt(param, DEFAULT_PAGE);
      return previous?.value ?? parsePositiveInt(param, DEFAULT_PAGE);
    },
  });

  protected readonly pageSize = linkedSignal<string | null | undefined, number>({
    source: () => this.queryParams()?.get('size'),
    computation: (param, previous) => {
      if (param !== previous?.source) return parsePageSize(param);
      return previous?.value ?? parsePageSize(param);
    },
  });

  protected readonly hasActiveFilters = computed(
    () =>
      this.grainFilter() !== null ||
      this.stateFilter() !== null ||
      this.subjectTypeFilter() !== null ||
      this.branchFilter() !== this.defaultBranchId,
  );

  protected readonly tableSort = computed<DataSort | null>(() => {
    const by = this.sortBy();
    if (by !== 'periodStart' && by !== 'metricKey') return null;
    return { key: by, dir: this.sortDir() };
  });

  protected readonly columns = computed<DataColumn[]>(() => {
    this.i18n();
    const cols: DataColumn[] = [
      { key: 'subject', label: this.transloco.translate('targets.table.subject'), width: 2.3 },
      { key: 'metricKey', label: this.transloco.translate('targets.table.metric'), width: 2.2, sortable: true },
      { key: 'periodStart', label: this.transloco.translate('targets.table.period'), width: 1.4, sortable: true },
      {
        key: 'targetValue',
        label: this.transloco.translate('targets.table.target'),
        width: 1.6,
        numeric: true,
        align: 'end',
      },
      { key: 'approvalState', label: this.transloco.translate('targets.table.state'), width: 1.3 },
      {
        key: 'release',
        label: this.transloco.translate('targets.table.release'),
        width: 0.8,
        numeric: true,
        align: 'end',
      },
      { key: 'actions', label: '', width: 0.45, align: 'end' },
    ];
    return cols;
  });

  protected readonly rowKey = (row: SalesTarget) => row.id;

  protected readonly emptyText = computed(() => {
    this.i18n();
    const hasFilterOrSearch = this.search().trim().length > 0 || this.hasActiveFilters();
    return this.transloco.translate(hasFilterOrSearch ? 'settings.common.noResults' : 'targets.empty');
  });

  protected readonly filterMenuOptions = computed<FilterOptionItem[]>(() => {
    this.i18n();
    const menu = this.openMenu();
    if (!menu) return [];
    const allOption: FilterOptionItem = {
      value: null,
      label: this.transloco.translate('targets.filters.all'),
    };
    switch (menu) {
      case 'grain':
        return [
          allOption,
          ...(['MONTH', 'QUARTER', 'YEAR'] as const).map((value) => ({
            value,
            label: this.transloco.translate(`targets.grains.${value}`),
          })),
        ];
      case 'state':
        return [
          allOption,
          ...(['DRAFT', 'SUBMITTED', 'APPROVED'] as const).map((value) => ({
            value,
            label: this.transloco.translate(`targets.states.${value}`),
          })),
        ];
      case 'subjectType':
        return [
          allOption,
          ...(['USER', 'TEAM', 'BRANCH', 'TEAM_SET'] as const).map((value) => ({
            value,
            label: this.transloco.translate(`targets.subjectTypes.${value}`),
          })),
        ];
      case 'branch': {
        const lang = this.language();
        return [
          ...this.org.branches.map((branch) => ({
            value: branch.id,
            label: branch.name[lang],
          })),
        ];
      }
      case 'sort':
        return SORT_OPTIONS.map((value) => ({
          value,
          label: this.transloco.translate(`targets.filters.sortOptions.${value}`),
        }));
    }
  });

  protected readonly activeSortKey = computed<SortOptionKey>(
    () => `${this.sortBy()}:${this.sortDir()}` as SortOptionKey,
  );

  constructor() {
    const onScroll = (event: Event) => {
      if (!this.openMenu()) return;
      const target = event.target;
      if (target instanceof Node && this.filterMenuPanel()?.nativeElement.contains(target)) return;
      this.closeFilterMenu();
    };
    document.addEventListener('scroll', onScroll, { capture: true, passive: true });
    inject(DestroyRef).onDestroy(() => document.removeEventListener('scroll', onScroll, { capture: true }));

    if (this.canRead) {
      void this.loadMetrics();
      let prevSearch = this.search();
      effect(() => {
        const search = this.search();
        const grain = this.grainFilter();
        const state = this.stateFilter();
        const subjectType = this.subjectTypeFilter();
        const branch = this.branchFilter();
        const sortBy = this.sortBy();
        const sortDir = this.sortDir();
        const page = this.page();
        const limit = this.pageSize();

        if (search !== prevSearch) {
          prevSearch = search;
          if (page !== DEFAULT_PAGE) {
            untracked(() => this.setPage(DEFAULT_PAGE));
            return;
          }
        }

        untracked(() => {
          void this.fetchTargets({
            branchId: branch ?? '',
            page,
            limit,
            sortBy,
            sortDir: toWireSortDir(sortDir),
            ...(grain ? { periodGrain: grain } : {}),
            ...(state ? { approvalState: state } : {}),
            ...(subjectType ? { subjectType } : {}),
            ...(search.trim() ? { search: search.trim() } : {}),
          });
        });
      });
    }
  }

  protected goHome(): void {
    void this.router.navigate(['/crm/dashboard']);
  }

  protected load(): void {
    if (!this.canRead) return;
    void this.fetchTargets({
      branchId: this.branchFilter() ?? '',
      page: this.page(),
      limit: this.pageSize(),
      sortBy: this.sortBy(),
      sortDir: toWireSortDir(this.sortDir()),
      ...(this.grainFilter() ? { periodGrain: this.grainFilter()! } : {}),
      ...(this.stateFilter() ? { approvalState: this.stateFilter()! } : {}),
      ...(this.subjectTypeFilter() ? { subjectType: this.subjectTypeFilter()! } : {}),
      ...(this.search().trim() ? { search: this.search().trim() } : {}),
    });
  }

  protected openNew(): void {
    if (!this.canManage) return;
    this.targetModal()?.openCreate();
  }

  protected openTarget(target: SalesTarget): void {
    this.targetModal()?.openEdit(target);
  }

  protected setPage(next: number): void {
    const safe = Math.max(DEFAULT_PAGE, next);
    if (safe === this.page()) return;
    this.page.set(safe);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { page: safe === DEFAULT_PAGE ? null : safe },
      queryParamsHandling: 'merge',
    });
  }

  protected setPageSize(nextSize: number): void {
    if (!PAGE_SIZES.includes(nextSize) || nextSize === this.pageSize()) return;
    this.pageSize.set(nextSize);
    this.page.set(DEFAULT_PAGE);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        size: nextSize === DEFAULT_PAGE_SIZE ? null : nextSize,
        page: null,
      },
      queryParamsHandling: 'merge',
    });
  }

  protected onTableSortChange(next: DataSort | null): void {
    if (next && (next.key === 'periodStart' || next.key === 'metricKey')) {
      this.sortBy.set(next.key);
      this.sortDir.set(next.dir);
    } else {
      this.sortBy.set('createdAt');
      this.sortDir.set('desc');
    }
    this.setPage(DEFAULT_PAGE);
  }

  protected toggleFilterMenu(key: FilterMenuKey, trigger: HTMLElement, event: MouseEvent): void {
    event.stopPropagation();
    if (this.openMenu() === key) {
      this.closeFilterMenu();
      return;
    }
    this.activeTriggerEl = trigger;
    const seq = ++this.menuSeq;
    this.menuPlaced.set(false);
    const rect = rectInPage(trigger);
    const { width } = viewport();
    const rtl = getComputedStyle(this.host.nativeElement).direction === 'rtl';
    this.menuPlace.set({
      top: rect.bottom + 4,
      start: rtl ? width - rect.right : rect.left,
      minWidth: Math.max(160, rect.width),
      maxHeight: null,
    });
    this.openMenu.set(key);
    queueMicrotask(() => this.placeFilterMenu(seq, trigger));
    afterNextRender(() => this.placeFilterMenu(seq, trigger), { injector: this.injector });
  }

  protected closeFilterMenu(): void {
    this.menuSeq++;
    this.openMenu.set(null);
    this.menuPlaced.set(false);
    this.activeTriggerEl = null;
  }

  protected isFilterOptionSelected(value: string | null): boolean {
    switch (this.openMenu()) {
      case 'grain':
        return this.grainFilter() === value;
      case 'state':
        return this.stateFilter() === value;
      case 'subjectType':
        return this.subjectTypeFilter() === value;
      case 'branch':
        return this.branchFilter() === value;
      case 'sort':
        return this.activeSortKey() === value;
      default:
        return false;
    }
  }

  protected selectFilterOption(value: string | null): void {
    const menu = this.openMenu();
    this.closeFilterMenu();
    if (!menu) return;
    switch (menu) {
      case 'grain':
        this.grainFilter.set(value as TargetPeriodGrain | null);
        break;
      case 'state':
        this.stateFilter.set(value as TargetApprovalState | null);
        break;
      case 'subjectType':
        this.subjectTypeFilter.set(value as TargetSubjectType | null);
        break;
      case 'branch':
        if (value) this.branchFilter.set(value);
        break;
      case 'sort':
        if (value) {
          const [by, dir] = value.split(':') as [TargetSortBy, TargetSortDir];
          this.sortBy.set(by);
          this.sortDir.set(dir);
        }
        break;
    }
    this.setPage(DEFAULT_PAGE);
  }

  protected clearFilters(): void {
    this.grainFilter.set(null);
    this.stateFilter.set(null);
    this.subjectTypeFilter.set(null);
    this.branchFilter.set(this.defaultBranchId);
    this.setPage(DEFAULT_PAGE);
  }

  protected branchFilterLabel(): string {
    const id = this.branchFilter();
    if (!id) return '';
    const lang = this.language();
    return this.org.branches.find((b) => b.id === id)?.name[lang] ?? id;
  }

  protected onDocumentClick(event: Event): void {
    if (!this.openMenu()) return;
    const target = event.target as Node | null;
    if (!target) return;
    if (this.filterMenuPanel()?.nativeElement.contains(target)) return;
    if (this.activeTriggerEl?.contains(target)) return;
    this.closeFilterMenu();
  }

  protected onHostEscape(event: Event): void {
    if (!this.openMenu()) return;
    event.preventDefault();
    event.stopPropagation();
    const trigger = this.activeTriggerEl;
    this.closeFilterMenu();
    trigger?.focus();
  }

  protected subjectIcon(type: TargetSubjectType): string {
    return SUBJECT_VISUALS[type].icon;
  }

  protected subjectTile(type: TargetSubjectType): string {
    return SUBJECT_VISUALS[type].tile;
  }

  protected subjectName(target: SalesTarget): string {
    return resolveTargetSubjectName(target, this.language());
  }

  protected metricLabel(metricKey: string): string {
    return resolveMetricLabel(metricKey, this.language(), this.metrics());
  }

  protected periodLabel(target: SalesTarget): string {
    this.i18n();
    return formatTargetPeriod(target.periodGrain, target.periodStart, this.language(), (n, year) =>
      this.transloco.translate('targets.quarter', { n, year }),
    );
  }

  protected valueLabel(target: SalesTarget): string {
    return formatTargetValue(
      target.targetValue,
      target.measureKind,
      target.currencyCode,
      this.language(),
    );
  }

  protected stateTone(state: TargetApprovalState): BadgeTone {
    switch (state) {
      case 'APPROVED':
        return 'success';
      case 'SUBMITTED':
        return 'warning';
      case 'DRAFT':
      default:
        return 'tag';
    }
  }

  protected actionsFor(target: SalesTarget): ActionItem[] {
    this.i18n();
    const items: ActionItem[] = [];

    if (this.canManage && target.approvalState === 'DRAFT') {
      items.push({
        id: 'submit',
        title: this.transloco.translate('targets.actions.submit'),
        icon: 'tablerSend',
        tile: 'bg-icon-blue',
      });
    }

    if (this.canApprove && target.approvalState === 'SUBMITTED') {
      items.push({
        id: 'approve',
        title: this.transloco.translate('targets.actions.approve'),
        icon: 'tablerCheck',
        tile: 'bg-icon-green',
      });
      items.push({
        id: 'reject',
        title: this.transloco.translate('targets.actions.reject'),
        icon: 'tablerX',
        tile: 'bg-icon-red',
      });
    }

    if (
      this.canApprove &&
      target.approvalState === 'APPROVED' &&
      isPeriodClosed(target.periodGrain, target.periodStart)
    ) {
      items.push({
        id: 'correct',
        title: this.transloco.translate('targets.actions.correct'),
        icon: 'tablerEdit',
        tile: 'bg-icon-orange',
      });
    }

    items.push({
      id: 'releases',
      title: this.transloco.translate('targets.actions.releases'),
      icon: 'tablerHistory',
      tile: 'bg-icon-navy',
    });

    if (this.canManage) {
      const locked = target.approvalState === 'SUBMITTED';
      items.push({
        id: 'delete',
        title: this.transloco.translate('targets.actions.delete'),
        icon: 'tablerTrash',
        tile: locked ? 'bg-icon-gray' : 'bg-icon-red',
        danger: true,
        disabled: locked,
        reason: locked ? this.transloco.translate('targets.actions.cannotDeleteSubmitted') : undefined,
      });
    }

    return items;
  }

  protected onRowAction(target: SalesTarget, selection: ActionSelection): void {
    switch (selection.id) {
      case 'submit':
        void this.runSubmit(target);
        break;
      case 'approve':
        this.openApprove(target);
        break;
      case 'reject':
        this.openReject(target);
        break;
      case 'correct':
        this.openCorrect(target);
        break;
      case 'releases':
        this.releasesModal()?.open(target);
        break;
      case 'delete':
        void this.requestDelete(target);
        break;
    }
  }

  protected onTargetSaved(): void {
    this.load();
  }

  protected async requestDelete(target: SalesTarget): Promise<void> {
    if (!this.canManage || target.approvalState === 'SUBMITTED') return;
    this.pendingDeleteTarget.set(target);
    const confirmed = await this.deleteDialog()?.open();
    if (!confirmed) {
      this.pendingDeleteTarget.set(null);
      return;
    }

    try {
      await deleteTarget(target.id, target.revision);
      this.notify.success(this.transloco.translate('targets.toasts.deleted'));
      if (this.targetModal()?.editingId() === target.id) {
        this.targetModal()?.close();
      }
      this.load();
    } catch (error) {
      const code = errorCodeOf(error);
      if (code === 'CRM_TARGET_REVISION_CONFLICT') {
        const reload = await this.conflictDialog()?.open();
        this.load();
        if (!reload) {
          this.notify.info(this.transloco.translate('analytics.common.reload'));
        }
      } else {
        this.notify.error(targetErrorMessage(this.transloco, error));
        if (isTargetGone(error)) {
          if (this.targetModal()?.editingId() === target.id) {
            this.targetModal()?.close();
          }
          this.load();
        }
      }
    } finally {
      this.pendingDeleteTarget.set(null);
    }
  }

  protected pendingDeleteLabel(): string {
    const target = this.pendingDeleteTarget();
    if (!target) return '';
    return `${this.subjectName(target)} · ${this.metricLabel(target.metricKey)}`;
  }

  protected onApproveNoteInput(event: Event): void {
    this.approveNote.set((event.target as HTMLTextAreaElement).value);
  }

  protected onRejectNoteInput(event: Event): void {
    this.rejectNote.set((event.target as HTMLTextAreaElement).value);
    this.rejectServerError.set(null);
  }

  protected onCorrectValueInput(event: Event): void {
    this.correctValueInput.set((event.target as HTMLInputElement).value);
    this.correctServerErrors.update((curr) => ({ ...curr, value: null }));
  }

  protected onCorrectValueBlur(): void {
    this.correctTouched.update((curr) => ({ ...curr, value: true }));
    const target = this.activeActionTarget();
    const parsed = parseNumericInput(this.correctValueInput());
    if (target && parsed !== null && Number.isFinite(parsed) && parsed > 0) {
      if (target.measureKind === 'MONEY') {
        this.correctValueInput.set(formatNumber(parsed, 'en', 3));
      } else if (target.measureKind === 'COUNT' && Number.isInteger(parsed)) {
        this.correctValueInput.set(formatNumber(parsed, 'en', 0));
      }
    }
  }

  protected onCorrectReasonInput(event: Event): void {
    this.correctReason.set((event.target as HTMLTextAreaElement).value);
    this.correctServerErrors.update((curr) => ({ ...curr, reason: null }));
  }

  protected rejectNoteError(): string | null {
    this.i18n();
    const serverCode = this.rejectServerError();
    if (serverCode) return this.transloco.translate(`analytics.error.${serverCode}`);
    if (!this.rejectTouched()) return null;
    if (!this.rejectNote().trim()) {
      return this.transloco.translate('targets.validation.rejectNoteRequired');
    }
    return null;
  }

  protected correctValueError(): string | null {
    this.i18n();
    const serverCode = this.correctServerErrors().value;
    if (serverCode) return this.transloco.translate(`analytics.error.${serverCode}`);
    if (!this.correctTouched().value) return null;
    const target = this.activeActionTarget();
    if (!target) return null;
    const parsed = parseNumericInput(this.correctValueInput());
    if (parsed === null) return this.transloco.translate('targets.validation.valueRequired');
    if (Number.isNaN(parsed) || parsed <= 0) return this.transloco.translate('targets.validation.valuePositive');
    if (parsed > TARGET_MAX_VALUE) return this.transloco.translate('targets.validation.valueMax');
    if (target.measureKind === 'COUNT' && !Number.isInteger(parsed)) {
      return this.transloco.translate('targets.validation.valueInteger');
    }
    if (target.measureKind === 'RATE' && parsed > 100) {
      return this.transloco.translate('targets.validation.valueRateMax');
    }
    return null;
  }

  protected correctReasonError(): string | null {
    this.i18n();
    const serverCode = this.correctServerErrors().reason;
    if (serverCode) return this.transloco.translate(`analytics.error.${serverCode}`);
    if (!this.correctTouched().reason) return null;
    if (!this.correctReason().trim()) {
      return this.transloco.translate('targets.validation.correctionReasonRequired');
    }
    return null;
  }

  protected closeActionModals(): void {
    this.approveModal()?.close();
    this.rejectModal()?.close();
    this.correctModal()?.close();
    this.activeActionTarget.set(null);
  }

  protected onActionModalClosed(): void {
    if (!this.actionBusy()) {
      this.activeActionTarget.set(null);
    }
  }

  protected async confirmApprove(): Promise<void> {
    const target = this.activeActionTarget();
    if (!target || this.actionBusy() || !this.canApprove) return;
    this.actionBusy.set(true);
    try {
      const note = this.approveNote().trim();
      const body = { revision: target.revision, ...(note ? { note } : {}) };
      await approveTarget(target.id, body, this.idemKeyFor('approve', target.id, body));
      this.notify.success(this.transloco.translate('targets.toasts.approved'));
      this.closeActionModals();
      this.load();
    } catch (error) {
      await this.handleActionError(error, 'approve', target.id);
    } finally {
      this.actionBusy.set(false);
    }
  }

  protected async confirmReject(): Promise<void> {
    const target = this.activeActionTarget();
    if (!target || this.actionBusy() || !this.canApprove) return;
    this.rejectTouched.set(true);
    this.rejectServerError.set(null);
    const note = this.rejectNote().trim();
    if (!note) return;

    this.actionBusy.set(true);
    try {
      await rejectTarget(target.id, { revision: target.revision, note });
      this.notify.success(this.transloco.translate('targets.toasts.rejected'));
      this.closeActionModals();
      this.load();
    } catch (error) {
      const code = errorCodeOf(error);
      if (code === 'CRM_TARGET_REJECT_NOTE_REQUIRED') {
        this.rejectServerError.set(code);
        return;
      }
      await this.handleActionError(error, 'reject', target.id);
    } finally {
      this.actionBusy.set(false);
    }
  }

  protected async confirmCorrect(): Promise<void> {
    const target = this.activeActionTarget();
    if (!target || this.actionBusy() || !this.canApprove) return;
    this.correctTouched.set({ value: true, reason: true });
    this.correctServerErrors.set({});
    const parsed = parseNumericInput(this.correctValueInput());
    const reason = this.correctReason().trim();
    if (parsed === null || Number.isNaN(parsed) || !validateTargetValue(parsed, target.measureKind)) {
      return;
    }
    if (!reason) return;

    this.actionBusy.set(true);
    try {
      const body = { revision: target.revision, value: parsed, reason };
      await correctTarget(target.id, body, this.idemKeyFor('correct', target.id, body));
      this.notify.success(this.transloco.translate('targets.toasts.corrected'));
      this.closeActionModals();
      this.load();
    } catch (error) {
      const code = errorCodeOf(error);
      if (code === 'CRM_TARGET_VALUE_INVALID') {
        this.correctServerErrors.update((curr) => ({ ...curr, value: code }));
        return;
      }
      if (code === 'CRM_TARGET_CORRECTION_REASON_REQUIRED') {
        this.correctServerErrors.update((curr) => ({ ...curr, reason: code }));
        return;
      }
      await this.handleActionError(error, 'correct', target.id);
    } finally {
      this.actionBusy.set(false);
    }
  }

  private async runSubmit(target: SalesTarget): Promise<void> {
    if (!this.canManage) return;
    try {
      await submitTarget(target.id, { revision: target.revision });
      this.notify.success(this.transloco.translate('targets.toasts.submitted'));
      this.load();
    } catch (error) {
      if (errorCodeOf(error) === 'CRM_TARGET_REVISION_CONFLICT') {
        await this.conflictDialog()?.open();
        this.load();
        return;
      }
      this.notify.error(targetErrorMessage(this.transloco, error));
      this.load();
    }
  }

  private openApprove(target: SalesTarget): void {
    if (!this.canApprove) return;
    this.activeActionTarget.set(target);
    this.approveNote.set('');
    this.pendingIdem = null;
    this.approveModal()?.open();
  }

  private openReject(target: SalesTarget): void {
    if (!this.canApprove) return;
    this.activeActionTarget.set(target);
    this.rejectNote.set('');
    this.rejectTouched.set(false);
    this.rejectServerError.set(null);
    this.rejectModal()?.open();
  }

  private openCorrect(target: SalesTarget): void {
    if (!this.canApprove) return;
    this.activeActionTarget.set(target);
    this.correctValueInput.set(
      target.measureKind === 'MONEY'
        ? formatNumber(Number(target.targetValue), 'en', 3)
        : target.measureKind === 'RATE'
          ? formatNumber(Number(target.targetValue), 'en', 1)
          : formatNumber(Number(target.targetValue), 'en', 0),
    );
    this.correctReason.set('');
    this.correctTouched.set({});
    this.correctServerErrors.set({});
    this.pendingIdem = null;
    this.correctModal()?.open();
  }

  /** Keeps the held key while the body is the same (a retry); a changed body is a new action with a new key. */
  private idemKeyFor(kind: 'approve' | 'correct', targetId: string, body: object): string {
    const bodyJson = JSON.stringify([kind, targetId, body]);
    if (!this.pendingIdem || this.pendingIdem.bodyJson !== bodyJson) {
      this.pendingIdem = { key: newIdempotencyKey(), bodyJson };
    }
    return this.pendingIdem.key;
  }

  private async handleActionError(
    error: unknown,
    kind: 'approve' | 'reject' | 'correct',
    targetId: string,
  ): Promise<void> {
    const code = errorCodeOf(error);
    if (code === 'CRM_TARGET_REVISION_CONFLICT') {
      const reload = await this.conflictDialog()?.open();
      this.load();
      if (reload) {
        this.closeActionModals();
        return;
      }
      try {
        const fresh = await getTarget(targetId);
        this.activeActionTarget.set(fresh);
      } catch (fetchError) {
        this.notify.error(targetErrorMessage(this.transloco, fetchError));
        this.closeActionModals();
      }
      return;
    }

    this.notify.error(targetErrorMessage(this.transloco, error));
    if (isTargetGone(error)) {
      this.closeActionModals();
      this.load();
    }
  }

  private placeFilterMenu(seq: number, trigger: HTMLElement): void {
    if (seq !== this.menuSeq || !this.openMenu() || this.menuPlaced()) return;
    const panelEl = this.filterMenuPanel()?.nativeElement;
    if (!panelEl) return;

    const rect = rectInPage(trigger);
    const listRect = rectInPage(panelEl);
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
    const minWidth = Math.max(160, rect.width);
    const actualWidth = Math.max(listRect.width, minWidth);
    const start = Math.min(Math.max(8, triggerStart), Math.max(8, width - 8 - actualWidth));

    this.menuPlace.set({ top, start, minWidth, maxHeight });
    this.menuPlaced.set(true);
    panelEl.style.top = `${top}px`;
    panelEl.style.insetInlineStart = `${start}px`;
    panelEl.style.minWidth = `${minWidth}px`;
    panelEl.style.maxHeight = maxHeight !== null ? `${maxHeight}px` : '';
    panelEl.classList.remove('invisible');
  }

  private async loadMetrics(): Promise<void> {
    try {
      const list = await targetableMetrics();
      if (list.length) {
        this.metrics.set(list);
      }
    } catch {
      // keep fallback metrics list
    }
  }

  private async fetchTargets(query: Parameters<typeof listTargets>[0]): Promise<void> {
    const seq = ++this.loadSeq;
    this.loading.set(true);
    this.loadError.set(false);
    try {
      const res = await listTargets(query);
      if (seq !== this.loadSeq) return;
      this.targets.set(res.items);
      this.total.set(res.total);
      if (res.page !== this.page()) {
        this.setPage(res.page);
      }
    } catch {
      if (seq !== this.loadSeq) return;
      this.loadError.set(true);
    } finally {
      if (seq === this.loadSeq) {
        this.loading.set(false);
      }
    }
  }
}

/** The DataTable sorts in lower case; the list DTO takes SortDirectionEnum (ASC | DESC). */
function toWireSortDir(dir: TargetSortDir): TargetWireSortDir {
  return dir === 'asc' ? 'ASC' : 'DESC';
}
