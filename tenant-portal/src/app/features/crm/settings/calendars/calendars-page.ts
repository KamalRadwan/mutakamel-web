import {
  Component,
  Injector,
  computed,
  inject,
  runInInjectionContext,
  signal,
  viewChild,
} from '@angular/core';
import { translationEvents } from '../../../../core/i18n/translation-events';
import { Router } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerClock, tablerPlus, tablerRefresh } from '@ng-icons/tabler-icons';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { LanguageState } from '../../../../core/i18n/language';
import { Notify } from '../../../../core/notify/notify';
import {
  ActionItem,
  ActionSelection,
  ActionsMenu,
} from '../../../../shared/ui/actions-menu/actions-menu';
import { Badge } from '../../../../shared/ui/badge/badge';
import { Button } from '../../../../shared/ui/button/button';
import { Checkbox } from '../../../../shared/ui/checkbox/checkbox';
import { formatDate, formatNumber } from '../../../../shared/ui/chart/chart-format';
import { ConfirmDialog } from '../../../../shared/ui/confirm-dialog/confirm-dialog';
import { DataCell, DataColumn, DataTable } from '../../../../shared/ui/data-table/data-table';
import { DateField } from '../../../../shared/ui/date-time/date-field';
import { TimeField } from '../../../../shared/ui/date-time/time-field';
import { Dropdown, DropdownOption } from '../../../../shared/ui/dropdown/dropdown';
import { Field } from '../../../../shared/ui/field/field';
import { FullState } from '../../../../shared/ui/full-state/full-state';
import { Modal } from '../../../../shared/ui/modal/modal';
import {
  ApiError,
  errorCodeOf,
  fieldErrorsOf,
  isValidationError,
  writeErrorMessage,
} from '../../../../core/api/api-errors';
import { TenantScopeState } from '../../../../core/scope/tenant-scope';
import { ConflictDialog } from '../../../../shared/ui/conflict-dialog/conflict-dialog';
import { WorkspaceLookups } from '../../../../shared/widgets/workspace-lookups/workspace-lookups.api';
import { WorkspaceBranch } from '../../../../shared/widgets/workspace-lookups/workspace-lookups.model';
import { anyGrant, branchGrants } from '../shared/settings-access';
import { crmSettingsError } from '../shared/settings-api';
import { settingsTimeZone } from '../shared/settings-time-zone';
import { can } from '../../../../shared/widgets/dashboard/analytics-permissions';
import { getCalendar, publishCalendar } from './calendars.api';
import {
  CalendarWindowInput,
  DEFAULT_WEEKDAY_MASK,
  DEFAULT_WORKDAY_END_MINUTE,
  DEFAULT_WORKDAY_START_MINUTE,
  MAX_CALENDAR_WINDOWS,
  MAX_WINDOW_LABEL_LENGTH,
  MAX_WINDOW_LAYER,
  WEEKDAY_INDICES,
  WorkingCalendar,
  buildWorkingDaysForYear,
  countWorkingDays,
  dayOfYearIndex,
  daysInMonth,
  inferWeekdayMask,
  isMaskDayActive,
  minutesToTime,
  timeToMinutes,
  toggleMaskDay,
  weekdayOf,
  windowsOverlapInLayer,
} from './calendars.model';
import { WeekEditor } from './week-editor/week-editor';

interface MonthDayCell {
  index: number;
  day: number;
  working: boolean;
  ariaLabel: string;
}

interface MonthGrid {
  monthIndex: number;
  leadingSlots: readonly number[];
  cells: readonly MonthDayCell[];
}

interface WindowRow extends CalendarWindowInput {
  index: number;
  hoursLabel: string;
  weekdayIndices: number[];
}

interface CalendarSnapshot {
  workingDays: string;
  workdayStartMinute: number;
  workdayEndMinute: number;
  timeZone: string;
  windows: CalendarWindowInput[];
}

function normalizeWindows(windows: readonly CalendarWindowInput[]): CalendarWindowInput[] {
  return windows.map((win) => ({
    layer: win.layer,
    validFrom: win.validFrom,
    validTo: win.validTo,
    weekdayMask: win.weekdayMask,
    startMinute: win.startMinute,
    endMinute: win.endMinute,
    ...(win.label?.trim() ? { label: win.label.trim() } : {}),
  }));
}

function sameWindows(
  a: readonly CalendarWindowInput[],
  b: readonly CalendarWindowInput[],
): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const x = a[i];
    const y = b[i];
    if (
      x.layer !== y.layer ||
      x.validFrom !== y.validFrom ||
      x.validTo !== y.validTo ||
      x.weekdayMask !== y.weekdayMask ||
      x.startMinute !== y.startMinute ||
      x.endMinute !== y.endMinute ||
      (x.label ?? '') !== (y.label ?? '')
    ) {
      return false;
    }
  }
  return true;
}

@Component({
  selector: 'app-calendars-page',
  imports: [
    NgIcon,
    TranslocoPipe,
    ActionsMenu,
    Badge,
    Button,
    Checkbox,
    ConfirmDialog,
    ConflictDialog,
    DataCell,
    DataTable,
    DateField,
    Dropdown,
    Field,
    FullState,
    Modal,
    TimeField,
    WeekEditor,
  ],
  providers: [
    provideTranslocoScope(
      'settings',
      { scope: 'analytics', alias: 'analytics' },
      { scope: 'chart', alias: 'chart' },
      { scope: 'settings-calendars', alias: 'calendars' },
    ),
    provideIcons({ tablerRefresh, tablerPlus, tablerClock }),
  ],
  templateUrl: './calendars-page.html',
  host: { class: 'flex min-h-0 flex-1 flex-col' },
})
export class CalendarsPage {
  private readonly lookups = inject(WorkspaceLookups);
  private readonly scope = inject(TenantScopeState);
  private readonly injector = inject(Injector);
  private readonly readGrants = [branchGrants('crm.sla.manage'), branchGrants('crm.targets.read')];
  private readonly manageGrants = [
    branchGrants('crm.sla.manage'),
    branchGrants('crm.targets.manage'),
  ];
  private readonly deniedBranches = signal<ReadonlySet<string>>(new Set());
  private readonly planReadOnly = signal(false);
  private defaultTimeZone: string | null = null;
  private initialized = false;
  protected readonly branches = signal<WorkspaceBranch[]>([]);
  protected readonly canChooseBranch = can('org.branch.read');
  private static nextId = 0;
  protected readonly uid = `calendars-page-${++CalendarsPage.nextId}`;

  private readonly router = inject(Router);
  private readonly notify = inject(Notify);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  protected readonly language = inject(LanguageState).current;

  private readonly windowModal = viewChild<Modal>('windowModal');
  private readonly deleteWindowDialog = viewChild<ConfirmDialog>('deleteWindowDialog');
  private readonly discardDialog = viewChild<ConfirmDialog>('discardDialog');
  protected readonly conflictOpen = signal(false);

  protected readonly canRead = anyGrant('crm.targets.read') || anyGrant('crm.sla.manage');
  protected readonly canManage = computed(() => {
    const branch = this.selectedBranchId();
    return (
      !!branch &&
      !this.planReadOnly() &&
      !this.deniedBranches().has(branch) &&
      this.manageGrants.some((grant) => grant === 'ALL' || grant.has(branch))
    );
  });
  protected readonly weekdays = WEEKDAY_INDICES;
  protected readonly maxLabelLength = MAX_WINDOW_LABEL_LENGTH;
  protected readonly skeletonCards = [0, 1, 2, 3];

  protected readonly selectedBranchId = signal('');
  protected readonly currentYear = signal(new Date().getUTCFullYear());
  protected readonly selectedYear = signal(this.currentYear());

  protected readonly loading = signal(false);
  private readonly loadFailure = signal<unknown>(null);
  protected readonly loadError = computed(() => {
    this.i18n();
    const error = this.loadFailure();
    if (!error) return null;
    const state = crmSettingsError(this.translateError, error, 'calendars');
    return {
      ...state,
      kind: state.kind === 'forbidden' ? ('forbidden' as const) : ('load-failure' as const),
    };
  });
  protected readonly submitted = signal(false);
  protected readonly sectionErrors = signal<Record<string, string>>({});
  protected readonly validationFields = signal<Record<string, string[]>>({});
  protected readonly daysError = computed(() => this.sectionMessage('workingDays'));
  protected readonly windowsError = computed(() => this.sectionMessage('windows'));
  protected readonly zoneError = computed(
    () =>
      this.sectionMessage('timeZone') ||
      (this.submitted() && !this.timeZone().trim()
        ? this.transloco.translate('calendars.validation.timeZoneRequired')
        : null),
  );
  protected readonly saving = signal(false);
  protected readonly revision = signal(0);

  protected readonly weekdayMask = signal(DEFAULT_WEEKDAY_MASK);
  protected readonly workingDays = signal(
    buildWorkingDaysForYear(this.selectedYear(), DEFAULT_WEEKDAY_MASK),
  );
  protected readonly startMinute = signal(DEFAULT_WORKDAY_START_MINUTE);
  protected readonly endMinute = signal(DEFAULT_WORKDAY_END_MINUTE);
  protected readonly timeZone = signal('');
  protected readonly windows = signal<CalendarWindowInput[]>([]);

  private readonly baseline = signal<CalendarSnapshot | null>(null);

  // Window modal state
  protected readonly editingWindowIndex = signal<number | null>(null);
  protected readonly winLayerInput = signal('1');
  protected readonly winValidFrom = signal(`${this.selectedYear()}-01-01`);
  protected readonly winValidTo = signal(`${this.selectedYear()}-01-31`);
  protected readonly winStartMinute = signal(DEFAULT_WORKDAY_START_MINUTE);
  protected readonly winEndMinute = signal(DEFAULT_WORKDAY_END_MINUTE);
  protected readonly winWeekdayMask = signal(DEFAULT_WEEKDAY_MASK);
  protected readonly winLabel = signal('');
  protected readonly winTouched = signal<Record<string, boolean>>({});
  protected readonly winSubmitted = signal(false);
  protected readonly winOverlapError = signal<string | null>(null);

  private loadSeq = 0;

  protected readonly branchOptions = computed<DropdownOption<string>[]>(() => {
    this.i18n();
    return this.branches().map((branch) => ({ value: branch.id, label: branch.name }));
  });

  protected readonly singleBranch = computed(
    () => this.branchOptions().length === 1 || (!this.canChooseBranch && !!this.selectedBranchId()),
  );

  protected readonly yearOptions = computed<DropdownOption<number>[]>(() =>
    [-1, 0, 1, 2].map((offset) => {
      const year = this.currentYear() + offset;
      return { value: year, label: String(year) };
    }),
  );

  protected readonly workingDaysCount = computed(() => countWorkingDays(this.workingDays()));
  protected readonly holidaysCount = computed(
    () => this.workingDays().length - this.workingDaysCount(),
  );

  protected readonly workingDaysDisplay = computed(() =>
    formatNumber(this.workingDaysCount(), this.language(), 0),
  );

  protected readonly holidaysDisplay = computed(() =>
    formatNumber(this.holidaysCount(), this.language(), 0),
  );

  protected readonly hoursError = computed(() => {
    this.i18n();
    const server = this.sectionMessage('hours');
    if (server) return server;
    if (this.startMinute() >= this.endMinute()) {
      return this.transloco.translate('calendars.validation.hoursOrder');
    }
    return null;
  });

  protected readonly dirty = computed(() => {
    const base = this.baseline();
    if (!base) return false;
    return (
      this.workingDays() !== base.workingDays ||
      this.startMinute() !== base.workdayStartMinute ||
      this.endMinute() !== base.workdayEndMinute ||
      this.timeZone() !== base.timeZone ||
      !sameWindows(this.windows(), base.windows)
    );
  });

  protected readonly monthGrids = computed<MonthGrid[]>(() => {
    this.i18n();
    const year = this.selectedYear();
    const pattern = this.workingDays();
    const lang = this.language();
    const workingLabel = this.transloco.translate('calendars.yearGrid.dayWorking');
    const offLabel = this.transloco.translate('calendars.yearGrid.dayOff');

    return Array.from({ length: 12 }, (_, monthIndex) => {
      const monthName = this.transloco.translate(`chart.months.${monthIndex}`);
      const firstWeekday = weekdayOf(year, monthIndex, 1);
      const leadingSlots = Array.from({ length: firstWeekday }, (_, i) => i);
      const count = daysInMonth(year, monthIndex);

      const cells: MonthDayCell[] = Array.from({ length: count }, (_, offset) => {
        const day = offset + 1;
        const index = dayOfYearIndex(year, monthIndex, day);
        const working = pattern[index] === '1';
        const statusText = working ? workingLabel : offLabel;
        const ariaLabel =
          lang === 'ar'
            ? `${day} ${monthName} ${year} — ${statusText}`
            : `${monthName} ${day}, ${year} — ${statusText}`;
        return { index, day, working, ariaLabel };
      });

      return { monthIndex, leadingSlots, cells };
    });
  });

  protected readonly windowRows = computed<WindowRow[]>(() =>
    this.windows().map((win, index) => ({
      ...win,
      index,
      hoursLabel: `${minutesToTime(win.startMinute)} – ${minutesToTime(win.endMinute)}`,
      weekdayIndices: WEEKDAY_INDICES.filter((day) => isMaskDayActive(win.weekdayMask, day)),
    })),
  );

  protected readonly windowColumns = computed<DataColumn[]>(() => {
    this.i18n();
    const cols: DataColumn[] = [
      {
        key: 'layer',
        label: this.transloco.translate('calendars.windows.colLayer'),
        width: 0.6,
        align: 'end',
        numeric: true,
      },
      {
        key: 'validFrom',
        label: this.transloco.translate('calendars.windows.colFrom'),
        width: 1.1,
      },
      { key: 'validTo', label: this.transloco.translate('calendars.windows.colTo'), width: 1.1 },
      { key: 'weekdays', label: this.transloco.translate('calendars.windows.colDays'), width: 2.2 },
      {
        key: 'hours',
        label: this.transloco.translate('calendars.windows.colHours'),
        width: 1.1,
        align: 'end',
        numeric: true,
      },
      { key: 'label', label: this.transloco.translate('calendars.windows.colLabel'), width: 1.6 },
    ];
    if (this.canManage()) {
      cols.push({
        key: 'actions',
        label: this.transloco.translate('calendars.windows.colActions'),
        width: 0.5,
        align: 'end',
      });
    }
    return cols;
  });

  protected readonly windowRowKey = (row: WindowRow) => String(row.index);

  protected readonly windowActionItems = computed<ActionItem[]>(() => {
    this.i18n();
    return [
      {
        id: 'edit',
        title: this.transloco.translate('calendars.windows.actionEdit'),
        icon: 'tablerEdit',
        tile: 'bg-icon-orange',
      },
      {
        id: 'delete',
        title: this.transloco.translate('calendars.windows.actionDelete'),
        icon: 'tablerTrash',
        tile: 'bg-icon-red',
        danger: true,
      },
    ];
  });

  protected readonly winStartTime = computed(() => minutesToTime(this.winStartMinute()));
  protected readonly winEndTime = computed(() => minutesToTime(this.winEndMinute()));
  protected readonly winLabelCount = computed(() => [...this.winLabel()].length);

  protected readonly winLayerError = computed(() => {
    this.i18n();
    if (!this.winSubmitted() && !this.winTouched()['layer']) return null;
    const raw = this.winLayerInput().trim();
    const parsed = Number(raw);
    if (!raw || !Number.isInteger(parsed) || parsed < 1 || parsed > MAX_WINDOW_LAYER) {
      return this.transloco.translate('calendars.validation.layerInvalid', {
        max: MAX_WINDOW_LAYER,
      });
    }
    return null;
  });

  protected readonly winFromError = computed(() => {
    this.i18n();
    if (this.winOverlapError()) return this.winOverlapError();
    if (!this.winSubmitted() && !this.winTouched()['validFrom']) return null;
    const date = this.winValidFrom().trim();
    if (!date) return this.transloco.translate('calendars.validation.dateRequired');
    const year = this.selectedYear();
    if (!date.startsWith(`${year}-`)) {
      return this.transloco.translate('calendars.validation.dateYearMismatch', { year });
    }
    return null;
  });

  protected readonly winToError = computed(() => {
    this.i18n();
    if (!this.winSubmitted() && !this.winTouched()['validTo']) return null;
    const to = this.winValidTo().trim();
    const from = this.winValidFrom().trim();
    if (!to) return this.transloco.translate('calendars.validation.dateRequired');
    const year = this.selectedYear();
    if (!to.startsWith(`${year}-`)) {
      return this.transloco.translate('calendars.validation.dateYearMismatch', { year });
    }
    if (from && to < from) {
      return this.transloco.translate('calendars.validation.dateOrder');
    }
    return null;
  });

  protected readonly winHoursError = computed(() => {
    this.i18n();
    if (!this.winSubmitted() && !this.winTouched()['hours']) return null;
    if (this.winStartMinute() >= this.winEndMinute()) {
      return this.transloco.translate('calendars.validation.hoursOrder');
    }
    return null;
  });

  protected readonly winDaysError = computed(() => {
    this.i18n();
    if (!this.winSubmitted() && !this.winTouched()['days']) return null;
    if (this.winWeekdayMask() === 0) {
      return this.transloco.translate('calendars.validation.daysRequired');
    }
    return null;
  });

  protected readonly winLabelError = computed(() => {
    this.i18n();
    if (!this.winSubmitted() && !this.winTouched()['label']) return null;
    if ([...this.winLabel().trim()].length > MAX_WINDOW_LABEL_LENGTH) {
      return this.transloco.translate('calendars.validation.labelMax', {
        max: MAX_WINDOW_LABEL_LENGTH,
      });
    }
    return null;
  });

  constructor() {
    if (this.canRead) void this.initialize();
  }

  protected async initialize(): Promise<void> {
    this.loading.set(true);
    this.loadFailure.set(null);
    try {
      const [zone, branches] = await Promise.all([
        runInInjectionContext(this.injector, settingsTimeZone),
        this.canChooseBranch ? this.lookups.allBranches({ status: 'ACTIVE' }) : Promise.resolve([]),
      ]);
      this.defaultTimeZone = zone;
      const year = Number(
        new Intl.DateTimeFormat('en', { year: 'numeric', timeZone: zone ?? 'UTC' }).format(
          new Date(),
        ),
      );
      this.currentYear.set(year);
      this.selectedYear.set(year);
      const allowed = branches.filter(
        (branch) =>
          this.scope.me()?.accessScope?.branchesTruncated ||
          this.readGrants.some((grant) => grant === 'ALL' || grant.has(branch.id)),
      );
      this.branches.set(allowed);
      const grantedIds = new Set(
        this.readGrants.flatMap((grant) => (grant === 'ALL' ? [] : [...grant])),
      );
      const scopedBranch = this.scope.selection()?.branchId;
      const fallback =
        grantedIds.size === 1
          ? [...grantedIds][0]
          : scopedBranch &&
              this.readGrants.some((grant) => grant === 'ALL' || grant.has(scopedBranch))
            ? scopedBranch
            : '';
      this.selectedBranchId.set(this.canChooseBranch ? (allowed[0]?.id ?? '') : fallback);
      this.initialized = true;
      await this.loadCalendar();
    } catch (error) {
      this.loadFailure.set(error);
    } finally {
      this.loading.set(false);
    }
  }

  protected async loadCalendar(): Promise<void> {
    if (!this.canRead || this.saving()) return;
    if (!this.initialized) return this.initialize();
    const branchId = this.selectedBranchId();
    if (!branchId) return;
    const seq = ++this.loadSeq;
    const year = this.selectedYear();
    this.loading.set(true);
    this.loadFailure.set(null);
    this.clearValidation();
    try {
      const calendar = await getCalendar(branchId, year);
      if (seq !== this.loadSeq) return;
      this.hydrateFromServer(calendar);
    } catch (error) {
      if (seq !== this.loadSeq || (error instanceof ApiError && error.status === 401)) return;
      this.loadFailure.set(error);
    } finally {
      if (seq === this.loadSeq) this.loading.set(false);
    }
  }

  protected async onBranchSelect(nextBranchId: string): Promise<void> {
    const prevBranchId = this.selectedBranchId();
    if (nextBranchId === prevBranchId) return;
    if (this.loading() || this.saving() || this.conflictOpen() || !this.canChooseBranch) return;
    if (this.dirty()) {
      const dialog = this.discardDialog();
      if (dialog && !(await dialog.open())) {
        return;
      }
    }
    this.selectedBranchId.set(nextBranchId);
    await this.loadCalendar();
  }

  protected async onYearSelect(nextYear: number): Promise<void> {
    const prevYear = this.selectedYear();
    if (nextYear === prevYear) return;
    if (this.loading() || this.saving() || this.conflictOpen()) return;
    if (this.dirty()) {
      const dialog = this.discardDialog();
      if (dialog && !(await dialog.open())) {
        return;
      }
    }
    this.selectedYear.set(nextYear);
    await this.loadCalendar();
  }

  protected async reloadClick(): Promise<void> {
    if (this.loading() || this.saving() || this.conflictOpen()) return;
    if (this.dirty()) {
      const dialog = this.discardDialog();
      if (dialog && !(await dialog.open())) return;
    }
    await this.loadCalendar();
  }

  protected applyWeekPattern(): void {
    if (!this.canManage() || this.saving()) return;
    this.workingDays.set(buildWorkingDaysForYear(this.selectedYear(), this.weekdayMask()));
  }

  protected toggleDay(cell: MonthDayCell): void {
    if (!this.canManage() || this.saving()) return;
    const chars = this.workingDays().split('');
    if (cell.index < 0 || cell.index >= chars.length) return;
    chars[cell.index] = chars[cell.index] === '1' ? '0' : '1';
    this.workingDays.set(chars.join(''));
  }

  protected undo(): void {
    if (!this.canManage() || this.saving()) return;
    this.clearValidation();
    const base = this.baseline();
    if (!base) return;
    this.workingDays.set(base.workingDays);
    this.weekdayMask.set(inferWeekdayMask(this.selectedYear(), base.workingDays));
    this.startMinute.set(base.workdayStartMinute);
    this.endMinute.set(base.workdayEndMinute);
    this.timeZone.set(base.timeZone);
    this.windows.set(normalizeWindows(base.windows));
  }

  protected async publish(): Promise<void> {
    if (!this.canManage() || this.saving() || this.loading() || this.loadError()) return;
    this.clearValidation();
    this.submitted.set(true);
    if (this.hoursError() || this.zoneError()) return;
    await this.submitPublish(this.revision());
  }

  protected openAddWindow(): void {
    if (!this.canManage() || this.saving()) return;
    if (this.windows().length >= MAX_CALENDAR_WINDOWS) {
      this.notify.error(
        this.transloco.translate('calendars.validation.windowsMax', { max: MAX_CALENDAR_WINDOWS }),
      );
      return;
    }
    const year = this.selectedYear();
    this.editingWindowIndex.set(null);
    this.winLayerInput.set('1');
    this.winValidFrom.set(`${year}-01-01`);
    this.winValidTo.set(`${year}-01-31`);
    this.winStartMinute.set(this.startMinute());
    this.winEndMinute.set(this.endMinute());
    this.winWeekdayMask.set(this.weekdayMask() || DEFAULT_WEEKDAY_MASK);
    this.winLabel.set('');
    this.resetWindowValidation();
    this.windowModal()?.open();
  }

  protected openEditWindow(index: number): void {
    if (!this.canManage() || this.saving()) return;
    const win = this.windows()[index];
    if (!win) return;
    this.editingWindowIndex.set(index);
    this.winLayerInput.set(String(win.layer));
    this.winValidFrom.set(win.validFrom);
    this.winValidTo.set(win.validTo);
    this.winStartMinute.set(win.startMinute);
    this.winEndMinute.set(win.endMinute);
    this.winWeekdayMask.set(win.weekdayMask);
    this.winLabel.set(win.label ?? '');
    this.resetWindowValidation();
    this.windowModal()?.open();
  }

  protected closeWindowModal(): void {
    this.windowModal()?.close();
  }

  protected saveWindow(): void {
    if (!this.canManage() || this.saving()) return;
    this.winSubmitted.set(true);
    this.winOverlapError.set(null);

    if (
      this.winLayerError() ||
      this.winFromError() ||
      this.winToError() ||
      this.winHoursError() ||
      this.winDaysError() ||
      this.winLabelError()
    ) {
      return;
    }

    const label = this.winLabel().trim();
    const candidate: CalendarWindowInput = {
      layer: Number(this.winLayerInput().trim()),
      validFrom: this.winValidFrom(),
      validTo: this.winValidTo(),
      weekdayMask: this.winWeekdayMask(),
      startMinute: this.winStartMinute(),
      endMinute: this.winEndMinute(),
      ...(label ? { label } : {}),
    };

    const editIdx = this.editingWindowIndex();
    if (windowsOverlapInLayer(this.windows(), candidate, editIdx ?? -1)) {
      this.winOverlapError.set(this.transloco.translate('calendars.validation.windowOverlap'));
      return;
    }

    if (editIdx === null) {
      this.windows.update((list) => [...list, candidate]);
    } else {
      this.windows.update((list) => list.map((item, i) => (i === editIdx ? candidate : item)));
    }
    this.closeWindowModal();
  }

  protected onWindowAction(index: number, selection: ActionSelection): void {
    if (!this.canManage() || this.saving()) return;
    if (selection.id === 'edit') {
      this.openEditWindow(index);
      return;
    }
    if (selection.id === 'delete') {
      void this.deleteWindow(index);
    }
  }

  protected async deleteWindow(index: number): Promise<void> {
    if (!this.canManage() || this.saving()) return;
    const dialog = this.deleteWindowDialog();
    if (dialog && !(await dialog.open())) return;
    this.windows.update((list) => list.filter((_, i) => i !== index));
    if (this.editingWindowIndex() === index) {
      this.closeWindowModal();
    }
  }

  protected isWinDayChecked(day: number): boolean {
    return isMaskDayActive(this.winWeekdayMask(), day);
  }

  protected onWinDayToggle(day: number, checked: boolean): void {
    this.winWeekdayMask.set(toggleMaskDay(this.winWeekdayMask(), day, checked));
    this.winOverlapError.set(null);
  }

  protected onWinLayerInput(event: Event): void {
    this.winLayerInput.set((event.target as HTMLInputElement).value);
    this.winOverlapError.set(null);
  }

  protected onWinLabelInput(event: Event): void {
    this.winLabel.set((event.target as HTMLInputElement).value);
  }

  protected onWinStartTimeChange(next: string | null): void {
    const mins = timeToMinutes(next);
    if (!Number.isNaN(mins)) {
      this.winStartMinute.set(mins);
      this.winOverlapError.set(null);
    }
  }

  protected onWinEndTimeChange(next: string | null): void {
    const mins = timeToMinutes(next);
    if (!Number.isNaN(mins)) {
      this.winEndMinute.set(mins);
      this.winOverlapError.set(null);
    }
  }

  protected markWinTouched(field: string): void {
    this.winTouched.update((state) => (state[field] ? state : { ...state, [field]: true }));
  }

  protected formatWindowDate(iso: string): string {
    return formatDate(iso, this.language(), (key, params) =>
      this.transloco.translate(`chart.${key}`, params),
    );
  }

  protected goBack(): void {
    void this.router.navigateByUrl('/crm/dashboard');
  }

  private async submitPublish(expectedRevision: number): Promise<void> {
    this.saving.set(true);
    try {
      const saved = await publishCalendar(this.selectedBranchId(), this.selectedYear(), {
        expectedRevision,
        workingDays: this.workingDays(),
        workdayStartMinute: this.startMinute(),
        workdayEndMinute: this.endMinute(),
        timeZone: this.timeZone(),
        windows: normalizeWindows(this.windows()),
      });
      this.hydrateFromServer(
        saved ?? (await getCalendar(this.selectedBranchId(), this.selectedYear())),
      );
      this.notify.success(this.transloco.translate('calendars.page.publishedToast'));
    } catch (error) {
      const code = errorCodeOf(error);
      if (code === 'CRM_WORKING_CALENDAR_REVISION_CONFLICT') {
        this.conflictOpen.set(true);
        return;
      }
      if (error instanceof ApiError && error.status === 422) {
        const section =
          code === 'CRM_CALENDAR_HOURS_INVALID'
            ? 'hours'
            : code === 'CRM_CALENDAR_TIME_ZONE_INVALID'
              ? 'timeZone'
              : code === 'CRM_CALENDAR_WINDOW_OVERLAP'
                ? 'windows'
                : code === 'CRM_WORKING_CALENDAR_INVALID'
                  ? 'workingDays'
                  : null;
        if (section && code) {
          this.sectionErrors.set({ [section]: code });
          return;
        }
      }
      if (isValidationError(error)) {
        this.validationFields.set(fieldErrorsOf(error));
        return;
      }
      const state = crmSettingsError(this.translateError, error, 'calendars');
      if (state.readOnly) this.planReadOnly.set(true);
      if (error instanceof ApiError && error.status === 403) {
        this.deniedBranches.update((branches) => new Set([...branches, this.selectedBranchId()]));
      }
      this.notify.error(
        error instanceof ApiError && error.status === 401
          ? writeErrorMessage(error, 'calendars', this.translateError)
          : state.message,
      );
    } finally {
      this.saving.set(false);
    }
  }

  protected async resolveConflict(reload: boolean): Promise<void> {
    this.conflictOpen.set(false);
    this.saving.set(true);
    try {
      const latest = await getCalendar(this.selectedBranchId(), this.selectedYear());
      if (reload) {
        this.clearValidation();
        this.hydrateFromServer(latest);
      } else {
        this.revision.set(latest.revision);
      }
    } catch (error) {
      this.notify.error(crmSettingsError(this.translateError, error, 'calendars').message);
    } finally {
      this.saving.set(false);
    }
  }

  private readonly translateError = (key: string, params?: Record<string, unknown>): string =>
    Object.hasOwn(this.transloco.getTranslation(this.transloco.getActiveLang()), key)
      ? this.transloco.translate(key, params)
      : key;

  private sectionMessage(section: string): string | null {
    this.i18n();
    const code = this.sectionErrors()[section];
    if (code) return this.transloco.translate(`calendars.errors.${code}`);
    const messages = Object.entries(this.validationFields()).filter(
      ([path]) =>
        (['_', 'expectedRevision'].includes(path) && section === 'workingDays') ||
        (section === 'hours'
          ? ['workdayStartMinute', 'workdayEndMinute'].includes(path)
          : path === section || path.startsWith(`${section}.`)),
    );
    return messages.length
      ? messages.flatMap(([, values]) => values).join(' ') ||
          this.transloco.translate('settings.errors.validation')
      : null;
  }

  private clearValidation(): void {
    this.submitted.set(false);
    this.sectionErrors.set({});
    this.validationFields.set({});
  }

  private hydrateFromServer(calendar: WorkingCalendar): void {
    this.clearValidation();
    this.revision.set(calendar.revision);
    const windows = normalizeWindows(calendar.windows);
    const workingDays =
      calendar.workingDays ?? buildWorkingDaysForYear(calendar.calendarYear, DEFAULT_WEEKDAY_MASK);
    const workdayStartMinute = calendar.workdayStartMinute ?? DEFAULT_WORKDAY_START_MINUTE;
    const workdayEndMinute = calendar.workdayEndMinute ?? DEFAULT_WORKDAY_END_MINUTE;
    const timeZone = calendar.timeZone ?? this.defaultTimeZone ?? '';
    this.workingDays.set(workingDays);
    this.weekdayMask.set(inferWeekdayMask(calendar.calendarYear, workingDays));
    this.startMinute.set(workdayStartMinute);
    this.endMinute.set(workdayEndMinute);
    this.timeZone.set(timeZone);
    this.windows.set(windows);
    this.baseline.set({
      workingDays,
      workdayStartMinute,
      workdayEndMinute,
      timeZone,
      windows: normalizeWindows(windows),
    });
  }

  private resetWindowValidation(): void {
    this.winTouched.set({});
    this.winSubmitted.set(false);
    this.winOverlapError.set(null);
  }
}
