import { Component, computed, inject, signal, viewChild } from '@angular/core';
import { translationEvents } from '../../../../core/i18n/translation-events';
import { Router } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerClock, tablerPlus, tablerRefresh } from '@ng-icons/tabler-icons';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { LanguageState } from '../../../../core/i18n/language';
import { Notify } from '../../../../core/notify/notify';
import { ActionItem, ActionSelection, ActionsMenu } from '../../../../shared/ui/actions-menu/actions-menu';
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
import { errorCodeOf } from '../../../../shared/widgets/dashboard/analytics-api';
import { can } from '../../../../shared/widgets/dashboard/analytics-permissions';
import { errorKey } from '../../../../shared/widgets/dashboard/panel-state';
import { getCalendar, publishCalendar } from './calendars.api';
import {
  CALENDAR_YEARS,
  CalendarWindowInput,
  DEFAULT_TIME_ZONE,
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
import { OrgApi } from '../../../../shared/widgets/dashboard/org.api';

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

function sameWindows(a: readonly CalendarWindowInput[], b: readonly CalendarWindowInput[]): boolean {
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
  private readonly org = inject(OrgApi);
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
  private readonly conflictDialog = viewChild<ConfirmDialog>('conflictDialog');

  protected readonly canRead = can('crm.targets.read') || can('crm.sla.manage');
  protected readonly canManage = can('crm.sla.manage') || can('crm.targets.manage');
  protected readonly weekdays = WEEKDAY_INDICES;
  protected readonly maxLabelLength = MAX_WINDOW_LABEL_LENGTH;
  protected readonly skeletonCards = [0, 1, 2, 3];

  protected readonly selectedBranchId = signal(this.org.branches[0]?.id ?? '');
  protected readonly selectedYear = signal<number>(2026);

  protected readonly loading = signal(false);
  protected readonly loadError = signal(false);
  protected readonly saving = signal(false);
  protected readonly revision = signal(0);

  protected readonly weekdayMask = signal(DEFAULT_WEEKDAY_MASK);
  protected readonly workingDays = signal(buildWorkingDaysForYear(2026, DEFAULT_WEEKDAY_MASK));
  protected readonly startMinute = signal(DEFAULT_WORKDAY_START_MINUTE);
  protected readonly endMinute = signal(DEFAULT_WORKDAY_END_MINUTE);
  protected readonly timeZone = signal(DEFAULT_TIME_ZONE);
  protected readonly windows = signal<CalendarWindowInput[]>([]);

  private readonly baseline = signal<CalendarSnapshot | null>(null);

  // Window modal state
  protected readonly editingWindowIndex = signal<number | null>(null);
  protected readonly winLayerInput = signal('1');
  protected readonly winValidFrom = signal('2026-01-01');
  protected readonly winValidTo = signal('2026-01-31');
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
    const lang = this.language();
    return this.org.branches.map((branch) => ({
      value: branch.id,
      label: lang === 'ar' ? branch.name.ar : branch.name.en,
    }));
  });

  protected readonly yearOptions = computed<DropdownOption<number>[]>(() =>
    CALENDAR_YEARS.map((year) => ({ value: year, label: String(year) })),
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
      { key: 'validFrom', label: this.transloco.translate('calendars.windows.colFrom'), width: 1.1 },
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
    if (this.canManage) {
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
      return this.transloco.translate('calendars.validation.layerInvalid', { max: MAX_WINDOW_LAYER });
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
    if (this.canRead) {
      void this.loadCalendar();
    }
  }

  protected async loadCalendar(): Promise<void> {
    if (!this.canRead) return;
    const seq = ++this.loadSeq;
    const branchId = this.selectedBranchId();
    const year = this.selectedYear();
    this.loading.set(true);
    this.loadError.set(false);
    try {
      const calendar = await getCalendar(branchId, year);
      if (seq !== this.loadSeq) return;
      this.hydrateFromServer(calendar);
    } catch {
      if (seq !== this.loadSeq) return;
      this.loadError.set(true);
    } finally {
      if (seq === this.loadSeq) {
        this.loading.set(false);
      }
    }
  }

  protected async onBranchSelect(nextBranchId: string): Promise<void> {
    const prevBranchId = this.selectedBranchId();
    if (nextBranchId === prevBranchId) return;
    this.selectedBranchId.set(nextBranchId);
    if (this.canManage && this.dirty()) {
      const dialog = this.discardDialog();
      if (dialog && !(await dialog.open())) {
        this.selectedBranchId.set(prevBranchId);
        return;
      }
    }
    await this.loadCalendar();
  }

  protected async onYearSelect(nextYear: number): Promise<void> {
    const prevYear = this.selectedYear();
    if (nextYear === prevYear) return;
    this.selectedYear.set(nextYear);
    if (this.canManage && this.dirty()) {
      const dialog = this.discardDialog();
      if (dialog && !(await dialog.open())) {
        this.selectedYear.set(prevYear);
        return;
      }
    }
    await this.loadCalendar();
  }

  protected async reloadClick(): Promise<void> {
    if (this.canManage && this.dirty()) {
      const dialog = this.discardDialog();
      if (dialog && !(await dialog.open())) return;
    }
    await this.loadCalendar();
  }

  protected applyWeekPattern(): void {
    if (!this.canManage) return;
    this.workingDays.set(buildWorkingDaysForYear(this.selectedYear(), this.weekdayMask()));
  }

  protected toggleDay(cell: MonthDayCell): void {
    if (!this.canManage) return;
    const chars = this.workingDays().split('');
    if (cell.index < 0 || cell.index >= chars.length) return;
    chars[cell.index] = chars[cell.index] === '1' ? '0' : '1';
    this.workingDays.set(chars.join(''));
  }

  protected undo(): void {
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
    if (!this.canManage || this.saving() || this.hoursError()) return;
    await this.submitPublish(this.revision());
  }

  protected openAddWindow(): void {
    if (!this.canManage) return;
    if (this.windows().length >= MAX_CALENDAR_WINDOWS) {
      this.notify.error(this.transloco.translate('calendars.validation.windowsMax', { max: MAX_CALENDAR_WINDOWS }));
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
    if (!this.canManage) return;
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
    if (!this.canManage) return;
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
    if (!this.canManage) return;
    if (selection.id === 'edit') {
      this.openEditWindow(index);
      return;
    }
    if (selection.id === 'delete') {
      void this.deleteWindow(index);
    }
  }

  protected async deleteWindow(index: number): Promise<void> {
    if (!this.canManage) return;
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
      this.hydrateFromServer(saved);
      this.notify.success(this.transloco.translate('calendars.page.publishedToast'));
    } catch (error) {
      const code = errorCodeOf(error);
      if (code === 'CRM_WORKING_CALENDAR_REVISION_CONFLICT') {
        this.saving.set(false);
        await this.handleConflict();
        return;
      }
      this.notify.error(this.transloco.translate(errorKey(code)));
    } finally {
      this.saving.set(false);
    }
  }

  private async handleConflict(): Promise<void> {
    const dialog = this.conflictDialog();
    const reload = dialog ? await dialog.open() : true;
    try {
      const latest = await getCalendar(this.selectedBranchId(), this.selectedYear());
      if (reload) {
        this.hydrateFromServer(latest);
      } else {
        // Esc and Cancel land here too: refresh the revision only, never republish unasked.
        this.revision.set(latest.revision);
      }
    } catch (error) {
      this.notify.error(this.transloco.translate(errorKey(errorCodeOf(error))));
    }
  }

  private hydrateFromServer(calendar: WorkingCalendar): void {
    this.revision.set(calendar.revision);
    if (calendar.revision === 0 || calendar.workingDays === null) {
      const workingDays = buildWorkingDaysForYear(calendar.calendarYear, DEFAULT_WEEKDAY_MASK);
      this.weekdayMask.set(DEFAULT_WEEKDAY_MASK);
      this.workingDays.set(workingDays);
      this.startMinute.set(DEFAULT_WORKDAY_START_MINUTE);
      this.endMinute.set(DEFAULT_WORKDAY_END_MINUTE);
      this.timeZone.set(DEFAULT_TIME_ZONE);
      this.windows.set([]);
      this.baseline.set({
        workingDays,
        workdayStartMinute: DEFAULT_WORKDAY_START_MINUTE,
        workdayEndMinute: DEFAULT_WORKDAY_END_MINUTE,
        timeZone: DEFAULT_TIME_ZONE,
        windows: [],
      });
      return;
    }

    // A day-only revision can carry null hours and zone; the form then starts from the defaults.
    const windows = normalizeWindows(calendar.windows);
    const workingDays = calendar.workingDays;
    const workdayStartMinute = calendar.workdayStartMinute ?? DEFAULT_WORKDAY_START_MINUTE;
    const workdayEndMinute = calendar.workdayEndMinute ?? DEFAULT_WORKDAY_END_MINUTE;
    const timeZone = calendar.timeZone ?? DEFAULT_TIME_ZONE;
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
