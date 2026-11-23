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
  viewChild,
} from '@angular/core';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerCheck,
  tablerHelpCircle,
  tablerUser,
  tablerX,
} from '@ng-icons/tabler-icons';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import {
  endOfMonth,
  endOfQuarter,
  startOfMonth,
  startOfQuarter,
  startOfWeek,
  subDays,
  subMonths,
} from 'date-fns';
import { LanguageState } from '../../../../../core/i18n/language';
import { Button } from '../../../../../shared/ui/button/button';
import {
  DateRange,
  type DateRangeValue,
  presetRange,
} from '../../../../../shared/ui/date-range/date-range';
import {
  DEFAULT_FROM_TIME,
  DEFAULT_TO_TIME,
  type DateRangePreset,
  formatLocalDateTime,
  parseLocalDate,
} from '../../../../../shared/ui/date-range/date-range-presets';
import { Dropdown, type DropdownOption } from '../../../../../shared/ui/dropdown/dropdown';
import { Field } from '../../../../../shared/ui/field/field';
import { rectInPage, viewport } from '../../../../../shared/ui/overlay/zoom';
import type {
  DashboardFilters as DefaultDashboardFilters,
  DatePreset,
  RuntimeFilters,
} from '../../../../../shared/widgets/dashboard/analytics.model';
import { scopeLevels } from '../../../../../shared/widgets/dashboard/analytics-permissions';

export interface DashboardFilterValue {
  period: DateRangeValue | null;
  compare: 'NONE' | 'PREVIOUS_PERIOD' | 'PREVIOUS_YEAR';
  scope: 'own' | 'team' | 'all';
  teamIds: string[];
  branchIds: string[];
}

export interface FilterOptionItem {
  id: string;
  name: string;
}

interface ListPlace {
  top: number;
  start: number;
  width: number;
  maxHeight: number | null;
}

const COMPARE_VALUES: readonly ('NONE' | 'PREVIOUS_PERIOD' | 'PREVIOUS_YEAR')[] = [
  'NONE',
  'PREVIOUS_PERIOD',
  'PREVIOUS_YEAR',
];

const DS_PRESET_MAP: Partial<Record<DateRangePreset, DatePreset>> = {
  TODAY: 'TODAY',
  THIS_MONTH: 'CURRENT_MONTH',
  LAST_MONTH: 'LAST_MONTH',
  THIS_YEAR: 'CURRENT_YEAR',
  LAST_YEAR: 'LAST_YEAR',
};

const COMPACT_WIDTH_PX = 1280;
const WIDE_COLS_MIN_PX = 1024;
const TWO_COLS_MIN_PX = 640;

function todayInZone(timeZone: string | null): Date {
  const civilDate = new Intl.DateTimeFormat('en-CA', {
    timeZone: timeZone ?? 'UTC', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
  return parseLocalDate(civilDate)!;
}

function normalizeMatch(value: string): string {
  return value.replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, '').toLowerCase();
}

function dateRangeFromPreset(
  preset: DatePreset | undefined,
  dateFrom: string | undefined,
  dateTo: string | undefined,
  timeZone: string | null,
): DateRangeValue {
  const today = todayInZone(timeZone);

  switch (preset) {
    case 'TODAY':
      return presetRange('TODAY', today);
    case 'CURRENT_MONTH':
      return presetRange('THIS_MONTH', today);
    case 'LAST_MONTH':
      return presetRange('LAST_MONTH', today);
    case 'CURRENT_YEAR':
      return presetRange('THIS_YEAR', today);
    case 'LAST_YEAR':
      return presetRange('LAST_YEAR', today);
    case 'CURRENT_QUARTER': {
      const quarter = Math.floor(today.getMonth() / 3) + 1;
      return presetRange(`Q${quarter}` as DateRangePreset, today);
    }
    case 'LAST_QUARTER': {
      const quarter = Math.floor(today.getMonth() / 3) + 1;
      if (quarter > 1) {
        return presetRange(`Q${quarter - 1}` as DateRangePreset, today);
      }
      const prevQ4 = new Date(today.getFullYear() - 1, 9, 1);
      return {
        from: formatLocalDateTime(startOfQuarter(prevQ4), DEFAULT_FROM_TIME),
        to: formatLocalDateTime(endOfQuarter(prevQ4), DEFAULT_TO_TIME),
        preset: null,
      };
    }
    case 'CURRENT_WEEK':
      return {
        from: formatLocalDateTime(startOfWeek(today, { weekStartsOn: 0 }), DEFAULT_FROM_TIME),
        to: formatLocalDateTime(today, DEFAULT_TO_TIME),
        preset: null,
      };
    case 'LAST_7_DAYS':
      return {
        from: formatLocalDateTime(subDays(today, 6), DEFAULT_FROM_TIME),
        to: formatLocalDateTime(today, DEFAULT_TO_TIME),
        preset: null,
      };
    case 'LAST_30_DAYS':
      return {
        from: formatLocalDateTime(subDays(today, 29), DEFAULT_FROM_TIME),
        to: formatLocalDateTime(today, DEFAULT_TO_TIME),
        preset: null,
      };
    case 'LAST_90_DAYS':
      return {
        from: formatLocalDateTime(subDays(today, 89), DEFAULT_FROM_TIME),
        to: formatLocalDateTime(today, DEFAULT_TO_TIME),
        preset: null,
      };
    case 'LAST_3_COMPLETE_MONTHS':
      return {
        from: formatLocalDateTime(startOfMonth(subMonths(today, 3)), DEFAULT_FROM_TIME),
        to: formatLocalDateTime(endOfMonth(subMonths(today, 1)), DEFAULT_TO_TIME),
        preset: null,
      };
    case 'CUSTOM':
    default: {
      const parsedFrom = parseLocalDate(dateFrom);
      const parsedTo = parseLocalDate(dateTo);
      if (parsedFrom && parsedTo) {
        return {
          from: formatLocalDateTime(parsedFrom, DEFAULT_FROM_TIME),
          to: formatLocalDateTime(parsedTo, DEFAULT_TO_TIME),
          preset: null,
        };
      }
      return presetRange('THIS_MONTH', today);
    }
  }
}

export function toRuntimeFilters(
  v: DashboardFilterValue,
  userTeamIds?: readonly string[],
  userId?: string,
  defaults: DefaultDashboardFilters = {},
): RuntimeFilters {
  const filters: RuntimeFilters = {
    ...defaults,
    compare: v.compare,
  };
  delete filters.dateFrom;
  delete filters.dateTo;
  delete filters.branchId;

  if (v.period) {
    const mappedPreset = v.period.preset ? DS_PRESET_MAP[v.period.preset] : undefined;
    if (mappedPreset) {
      filters.datePreset = mappedPreset;
    } else {
      filters.datePreset = 'CUSTOM';
      filters.dateFrom = `${v.period.from.slice(0, 10)}T00:00:00`;
      filters.dateTo = `${v.period.to.slice(0, 10)}T23:59:59`;
    }
  }

  if (v.scope === 'own') {
    if (userId) filters.ownerUserIds = [userId];
  } else if (v.scope === 'team') {
    const resolvedTeams =
      v.teamIds.length > 0
        ? [...v.teamIds]
        : userTeamIds && userTeamIds.length > 0
          ? [...userTeamIds]
          : [];
    if (resolvedTeams.length > 0) {
      filters.teamIds = resolvedTeams;
    }
  }

  if (v.branchIds.length > 0) {
    filters.branchIds = [...v.branchIds];
  }

  return filters;
}

export function defaultFilterValue(defaults: DefaultDashboardFilters, timeZone: string | null = null): DashboardFilterValue {
  const levels = scopeLevels();
  const widestScope: 'own' | 'team' | 'all' = levels.includes('all')
    ? 'all'
    : levels.includes('team')
      ? 'team'
      : 'own';

  return {
    period: dateRangeFromPreset(defaults.datePreset, defaults.dateFrom, defaults.dateTo, timeZone),
    compare: defaults.compare ?? 'NONE',
    scope: widestScope,
    teamIds: [],
    branchIds: defaults.branchId ? [defaults.branchId] : [],
  };
}

@Component({
  selector: 'app-dashboard-filters',
  imports: [NgIcon, TranslocoPipe, Button, DateRange, Dropdown, Field],
  viewProviders: [
    provideTranslocoScope(
      { scope: 'crm-dash-filters', alias: 'dashFilters' },
      { scope: 'analytics', alias: 'analytics' },
    ),
  ],
  providers: [provideIcons({ tablerCheck, tablerHelpCircle, tablerUser, tablerX })],
  templateUrl: './dashboard-filters.html',
  host: {
    class: 'block min-w-0',
    '(document:click)': 'closeMenusIfOutside($event)',
    '(window:resize)': 'closeMenus()',
  },
})
export class DashboardFilters {
  private static nextId = 0;
  protected readonly uid = `dash-filters-${++DashboardFilters.nextId}`;

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly language = inject(LanguageState).current;

  private readonly barEl = viewChild.required<ElementRef<HTMLElement>>('barEl');
  private readonly teamsBox = viewChild<ElementRef<HTMLElement>>('teamsBox');
  private readonly teamsInput = viewChild<ElementRef<HTMLInputElement>>('teamsInput');
  private readonly teamsList = viewChild<ElementRef<HTMLElement>>('teamsList');
  private readonly branchesBox = viewChild<ElementRef<HTMLElement>>('branchesBox');
  private readonly branchesInput = viewChild<ElementRef<HTMLInputElement>>('branchesInput');
  private readonly branchesList = viewChild<ElementRef<HTMLElement>>('branchesList');

  readonly value = model.required<DashboardFilterValue>();
  readonly teams = input<readonly FilterOptionItem[]>([]);
  readonly branches = input<readonly FilterOptionItem[]>([]);
  readonly showTeams = input(false);
  /** The viewer reads only part of the dashboard's branches (run organizationScope.partialAccess). */
  readonly partialAccess = input(false);
  readonly error = input<string | null>(null);
  readonly fieldErrors = input<Readonly<Record<string, string>>>({});
  readonly timeZone = input<string | null>(null);
  readonly openWhy = output<void>();

  protected readonly today = computed(() => formatLocalDateTime(todayInZone(this.timeZone()), DEFAULT_FROM_TIME));
  protected readonly periodHint = computed(() => {
    this.i18n();
    return `${this.transloco.translate('dashFilters.periodHint')} ${this.timeZone()
      ? this.transloco.translate('dashFilters.datesInZone', { zone: this.timeZone() })
      : this.transloco.translate('dashFilters.datesInUtc')}`;
  });
  protected readonly containerWidth = signal(COMPACT_WIDTH_PX);
  protected readonly compact = computed(() => this.containerWidth() >= COMPACT_WIDTH_PX);
  protected readonly gridColsClass = computed(() => {
    const width = this.containerWidth();
    if (width < TWO_COLS_MIN_PX) return 'grid-cols-1';
    if (width < WIDE_COLS_MIN_PX) return 'grid-cols-2';
    if (width < COMPACT_WIDTH_PX) return 'grid-cols-3';
    return 'grid-cols-4';
  });

  protected readonly availableScopes = computed(() => scopeLevels());
  protected readonly showScope = computed(() => this.availableScopes().length > 1);
  protected readonly showTeamsField = computed(
    () => this.showTeams() && this.value().scope !== 'own',
  );
  protected readonly showBranchesField = computed(() => this.branches().length > 0);

  protected readonly compareOptions = computed<DropdownOption<'NONE' | 'PREVIOUS_PERIOD' | 'PREVIOUS_YEAR'>[]>(() => {
    this.i18n();
    this.language();
    return COMPARE_VALUES.map((val) => ({
      value: val,
      label: this.transloco.translate(`analytics.compare.${val}`),
    }));
  });

  protected readonly scopeOptions = computed<DropdownOption<'own' | 'team' | 'all'>[]>(() => {
    this.i18n();
    this.language();
    return this.availableScopes().map((val) => ({
      value: val,
      label: this.transloco.translate(`analytics.scope.${val}`),
    }));
  });

  protected readonly openMulti = signal<'teams' | 'branches' | null>(null);
  protected readonly menuPlaced = signal(false);
  protected readonly menuPlace = signal<ListPlace>({ top: 0, start: 0, width: 0, maxHeight: null });
  protected readonly teamsQuery = signal('');
  protected readonly branchesQuery = signal('');
  protected readonly activeIndex = signal(0);
  private listSeq = 0;

  protected readonly selectedTeams = computed(() => {
    const map = new Map(this.teams().map((item) => [item.id, item]));
    return this.value()
      .teamIds.map((id) => map.get(id))
      .filter((item): item is FilterOptionItem => item !== undefined);
  });

  protected readonly selectedBranches = computed(() => {
    const map = new Map(this.branches().map((item) => [item.id, item]));
    return this.value()
      .branchIds.map((id) => map.get(id))
      .filter((item): item is FilterOptionItem => item !== undefined);
  });

  protected readonly filteredTeams = computed(() => {
    const q = normalizeMatch(this.teamsQuery().trim());
    const list = this.teams();
    return q ? list.filter((item) => normalizeMatch(item.name).includes(q)) : list;
  });

  protected readonly filteredBranches = computed(() => {
    const q = normalizeMatch(this.branchesQuery().trim());
    const list = this.branches();
    return q ? list.filter((item) => normalizeMatch(item.name).includes(q)) : list;
  });

  protected readonly selectedTeamSet = computed(() => new Set(this.value().teamIds));
  protected readonly selectedBranchSet = computed(() => new Set(this.value().branchIds));

  constructor() {
    let resizeObserver: ResizeObserver | null = null;

    afterNextRender(() => {
      const el = this.barEl().nativeElement;
      const measure = () => {
        if (el.clientWidth > 0) {
          this.containerWidth.set(el.clientWidth);
        }
      };
      measure();
      if (typeof ResizeObserver !== 'undefined') {
        resizeObserver = new ResizeObserver(measure);
        resizeObserver.observe(el);
      }
    });

    effect(() => {
      if (!this.showTeamsField() && this.openMulti() === 'teams') {
        this.closeMenus();
      }
      if (!this.showBranchesField() && this.openMulti() === 'branches') {
        this.closeMenus();
      }
    });

    const onScroll = (event: Event) => {
      if (!this.openMulti()) return;
      const target = event.target;
      if (target instanceof Node && this.host.nativeElement.contains(target)) return;
      this.closeMenus();
    };
    document.addEventListener('scroll', onScroll, { capture: true, passive: true });
    this.destroyRef.onDestroy(() => {
      resizeObserver?.disconnect();
      document.removeEventListener('scroll', onScroll, { capture: true });
    });
  }

  protected onPeriodChange(period: DateRangeValue | null): void {
    this.value.update((current) => ({ ...current, period }));
  }

  protected onCompareChange(compare: 'NONE' | 'PREVIOUS_PERIOD' | 'PREVIOUS_YEAR'): void {
    if (compare === this.value().compare) return;
    this.value.update((current) => ({ ...current, compare }));
  }

  protected onScopeChange(scope: 'own' | 'team' | 'all'): void {
    if (scope === this.value().scope) return;
    this.value.update((current) => ({
      ...current,
      scope,
      teamIds: scope === 'own' ? [] : current.teamIds,
    }));
  }

  protected openPicker(kind: 'teams' | 'branches'): void {
    if (kind === 'teams') {
      this.teamsInput()?.nativeElement.focus();
    } else {
      this.branchesInput()?.nativeElement.focus();
    }
    if (this.openMulti() === kind) return;
    this.activeIndex.set(0);
    this.menuPlaced.set(false);
    this.menuPlace.set(this.initialPlace(kind));
    this.openMulti.set(kind);
    this.schedulePlace(kind);
  }

  protected onMultiInput(kind: 'teams' | 'branches', event: Event): void {
    const raw = (event.target as HTMLInputElement).value;
    if (kind === 'teams') {
      this.teamsQuery.set(raw);
    } else {
      this.branchesQuery.set(raw);
    }
    this.activeIndex.set(0);
    if (this.openMulti() !== kind) {
      this.menuPlaced.set(false);
      this.menuPlace.set(this.initialPlace(kind));
      this.openMulti.set(kind);
    }
    this.schedulePlace(kind);
  }

  protected onMultiKeydown(kind: 'teams' | 'branches', event: KeyboardEvent): void {
    const items = kind === 'teams' ? this.filteredTeams() : this.filteredBranches();
    const query = kind === 'teams' ? this.teamsQuery() : this.branchesQuery();

    switch (event.key) {
      case 'ArrowDown': {
        event.preventDefault();
        if (this.openMulti() !== kind) {
          this.openPicker(kind);
          return;
        }
        if (items.length > 0) {
          const next = (this.activeIndex() + 1) % items.length;
          this.activeIndex.set(next);
          this.scrollOptionIntoView(kind, next);
        }
        break;
      }
      case 'ArrowUp': {
        event.preventDefault();
        if (this.openMulti() !== kind) {
          this.openPicker(kind);
          return;
        }
        if (items.length > 0) {
          const prev = (this.activeIndex() - 1 + items.length) % items.length;
          this.activeIndex.set(prev);
          this.scrollOptionIntoView(kind, prev);
        }
        break;
      }
      case 'Enter': {
        if (this.openMulti() !== kind) return;
        event.preventDefault();
        event.stopPropagation();
        const opt = items[this.activeIndex()];
        if (opt) {
          this.toggleMultiOption(kind, opt.id);
        }
        break;
      }
      case 'Escape': {
        if (this.openMulti() !== kind) return;
        event.preventDefault();
        event.stopPropagation();
        this.closeMenus();
        break;
      }
      case 'Backspace': {
        if (query === '') {
          const currentIds = kind === 'teams' ? this.value().teamIds : this.value().branchIds;
          if (currentIds.length > 0) {
            this.removeMultiItem(kind, currentIds[currentIds.length - 1]);
          }
        }
        break;
      }
      case 'Tab': {
        this.closeMenus();
        break;
      }
    }
  }

  protected toggleMultiOption(kind: 'teams' | 'branches', id: string): void {
    this.value.update((current) => {
      if (kind === 'teams') {
        const exists = current.teamIds.includes(id);
        const teamIds = exists
          ? current.teamIds.filter((item) => item !== id)
          : [...current.teamIds, id];
        return { ...current, teamIds };
      }
      const exists = current.branchIds.includes(id);
      const branchIds = exists
        ? current.branchIds.filter((item) => item !== id)
        : [...current.branchIds, id];
      return { ...current, branchIds };
    });

    if (kind === 'teams') {
      this.teamsQuery.set('');
      const inputEl = this.teamsInput()?.nativeElement;
      if (inputEl) {
        inputEl.value = '';
        inputEl.focus();
      }
    } else {
      this.branchesQuery.set('');
      const inputEl = this.branchesInput()?.nativeElement;
      if (inputEl) {
        inputEl.value = '';
        inputEl.focus();
      }
    }
    this.activeIndex.set(0);
    if (this.openMulti() === kind) {
      this.schedulePlace(kind);
    }
  }

  protected removeMultiItem(kind: 'teams' | 'branches', id: string): void {
    this.value.update((current) =>
      kind === 'teams'
        ? { ...current, teamIds: current.teamIds.filter((item) => item !== id) }
        : { ...current, branchIds: current.branchIds.filter((item) => item !== id) },
    );
    if (this.openMulti() === kind) {
      this.schedulePlace(kind);
    }
  }

  protected isMultiSelected(kind: 'teams' | 'branches', id: string): boolean {
    return kind === 'teams' ? this.selectedTeamSet().has(id) : this.selectedBranchSet().has(id);
  }

  protected multiOptionId(kind: 'teams' | 'branches', index: number): string {
    return `${this.uid}-${kind}-opt-${index}`;
  }

  protected multiActiveDescendant(kind: 'teams' | 'branches'): string | null {
    if (this.openMulti() !== kind) return null;
    const list = kind === 'teams' ? this.filteredTeams() : this.filteredBranches();
    if (list.length === 0) return null;
    const idx = Math.min(Math.max(0, this.activeIndex()), list.length - 1);
    return this.multiOptionId(kind, idx);
  }

  protected multiBoxClasses(kind: 'teams' | 'branches'): string {
    const base =
      'flex min-h-field flex-wrap items-center gap-2 rounded-8 border bg-surface-field px-8 py-0 text-12 text-text transition-colors duration-fast';
    if (this.openMulti() === kind) {
      return `${base} border-focus-ring ring-3 ring-focus-halo`;
    }
    return `${base} border-border-field hover:border-border-field-hover focus-within:border-focus-ring focus-within:ring-3 focus-within:ring-focus-halo`;
  }

  protected multiRowClasses(kind: 'teams' | 'branches', id: string, index: number): string {
    const selected = this.isMultiSelected(kind, id);
    const active = this.activeIndex() === index;
    if (selected) {
      return active
        ? 'cursor-pointer bg-brand-soft text-on-brand-soft ring-2 ring-focus-halo'
        : 'cursor-pointer bg-brand-soft text-on-brand-soft';
    }
    return active ? 'cursor-pointer bg-row-hover text-text' : 'cursor-pointer text-text hover:bg-row-hover';
  }

  protected closeMenus(): void {
    this.listSeq++;
    this.openMulti.set(null);
    this.menuPlaced.set(false);
  }

  protected closeMenusIfOutside(event: Event): void {
    if (!this.openMulti()) return;
    const target = event.target;
    if (!(target instanceof Node) || !this.host.nativeElement.contains(target)) {
      this.closeMenus();
      return;
    }
    const activeKind = this.openMulti();
    const activeBox =
      activeKind === 'teams' ? this.teamsBox()?.nativeElement : this.branchesBox()?.nativeElement;
    const activeList =
      activeKind === 'teams' ? this.teamsList()?.nativeElement : this.branchesList()?.nativeElement;
    if (activeBox?.contains(target) || activeList?.contains(target)) return;
    this.closeMenus();
  }

  private scrollOptionIntoView(kind: 'teams' | 'branches', index: number): void {
    document.getElementById(this.multiOptionId(kind, index))?.scrollIntoView({ block: 'nearest' });
  }

  private schedulePlace(kind: 'teams' | 'branches'): void {
    const seq = ++this.listSeq;
    queueMicrotask(() => this.placeList(seq, kind));
    afterNextRender(() => this.placeList(seq, kind), { injector: this.injector });
  }

  private initialPlace(kind: 'teams' | 'branches'): ListPlace {
    const boxEl = kind === 'teams' ? this.teamsBox()?.nativeElement : this.branchesBox()?.nativeElement;
    if (!boxEl) return { top: 0, start: 0, width: 0, maxHeight: null };
    const rect = rectInPage(boxEl);
    const { width } = viewport();
    const rtl = getComputedStyle(this.host.nativeElement).direction === 'rtl';
    return {
      top: rect.bottom + 4,
      start: rtl ? width - rect.right : rect.left,
      width: rect.width,
      maxHeight: null,
    };
  }

  private placeList(seq: number, kind: 'teams' | 'branches'): void {
    if (seq !== this.listSeq || this.openMulti() !== kind) return;
    const boxEl = kind === 'teams' ? this.teamsBox()?.nativeElement : this.branchesBox()?.nativeElement;
    const listEl = kind === 'teams' ? this.teamsList()?.nativeElement : this.branchesList()?.nativeElement;
    if (!boxEl || !listEl) return;

    listEl.style.maxHeight = '';
    const rect = rectInPage(boxEl);
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
