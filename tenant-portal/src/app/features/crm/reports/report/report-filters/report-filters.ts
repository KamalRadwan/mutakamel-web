import {
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerCheck, tablerChevronDown, tablerX } from '@ng-icons/tabler-icons';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { differenceInCalendarDays } from 'date-fns';
import { LanguageState } from '../../../../../core/i18n/language';
import type { FilterDescriptor } from '../../../../../shared/widgets/dashboard/analytics.model';
import { OrgApi } from '../../../../../shared/widgets/dashboard/org.api';
import { DateField } from '../../../../../shared/ui/date-time/date-field';
import { Dropdown, type DropdownOption } from '../../../../../shared/ui/dropdown/dropdown';
import { Field } from '../../../../../shared/ui/field/field';
import { rectInPage, viewport } from '../../../../../shared/ui/overlay/zoom';
import { loadReportFilterLookups } from '../report.api';
import type { ReportFilterLookups } from '../report.model';
import { ReportState } from '../report-state';
import { selectScopeTranslation } from '../../../../../shared/widgets/dashboard/scope-translation';

interface MultiPlace {
  top: number;
  start: number;
  width: number;
  maxHeight: number | null;
}

/**
 * Period presets the picker offers and sends (backend `CRM_DATE_PRESETS` plus YESTERDAY, lead decision). The old
 * picker's TODAY_YESTERDAY and Q1-Q4 have no backend preset: LAST_7_DAYS, CURRENT_QUARTER and LAST_QUARTER take
 * their place. MAXIMUM is gone: a longer window is a CUSTOM range of at most 732 days.
 */
export const REPORT_PERIOD_PRESETS = [
  'TODAY',
  'YESTERDAY',
  'LAST_7_DAYS',
  'CURRENT_MONTH',
  'LAST_MONTH',
  'CURRENT_QUARTER',
  'LAST_QUARTER',
  'CURRENT_YEAR',
  'LAST_YEAR',
  'CUSTOM',
] as const;

const EMPTY_LOOKUPS: ReportFilterLookups = { pipelines: [], sources: [], currencies: [] };

/** A CUSTOM range may span at most 732 days, both ends included (backend period-resolver). */
const MAX_RANGE_DAYS = 732;

let nextFilterSeq = 0;

@Component({
  selector: 'app-report-filters',
  imports: [NgIcon, TranslocoPipe, Field, Dropdown, DateField],
  providers: [provideIcons({ tablerCheck, tablerChevronDown, tablerX })],
  templateUrl: './report-filters.html',
  host: {
    class: 'block min-w-0',
    '(document:click)': 'onDocumentClick($event)',
    '(window:resize)': 'closeMulti()',
    '(keydown.escape)': 'onEscape($event)',
  },
})
export class ReportFilters {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  private readonly state = inject(ReportState);
  private readonly org = inject(OrgApi);
  private readonly language = inject(LanguageState).current;
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly reportScope = toSignal(selectScopeTranslation(this.transloco, 'crm-rep-report', 'repReport'));
  private readonly analyticsScope = toSignal(this.transloco.selectTranslation('analytics'));

  private readonly multiListRef = viewChild<ElementRef<HTMLElement>>('multiList');
  private readonly uid = `rep-flt-${++nextFilterSeq}`;
  private listSeq = 0;
  private activeMultiTrigger: HTMLElement | null = null;

  protected readonly lookups = signal<ReportFilterLookups>(EMPTY_LOOKUPS);
  protected readonly periodParts = ['from', 'to'] as const;
  protected readonly openMultiKey = signal<string | null>(null);
  protected readonly multiPlaced = signal(false);
  protected readonly multiPlace = signal<MultiPlace>({ top: 0, start: 0, width: 200, maxHeight: null });
  protected readonly periodError = signal<string | null>(null);
  protected readonly numberErrors = signal<Record<string, string | null>>({});

  protected readonly schema = computed<FilterDescriptor[]>(
    () => this.state.manifest()?.filters.schema ?? [],
  );

  /** The current window: the run request's period, else the manifest's resolved period. */
  protected readonly periodWindow = computed<{ preset: string; from: string | null; to: string | null }>(() => {
    const manifest = this.state.manifest();
    const req = this.state.request();
    const from = req.period?.from ?? manifest?.period.from;
    const to = req.period?.to ?? manifest?.period.to;
    return {
      preset: req.period?.preset ?? manifest?.period.kind ?? 'CURRENT_MONTH',
      from: from ? from.slice(0, 10) : null,
      to: to ? to.slice(0, 10) : null,
    };
  });

  protected readonly periodOptions = computed<DropdownOption<string>[]>(() => {
    this.i18n();
    this.reportScope();
    const current = this.periodWindow().preset;
    const presets: string[] = [...REPORT_PERIOD_PRESETS];
    // A preset the manifest resolved but the picker does not offer (e.g. LAST_30_DAYS) stays visible as chosen.
    if (!presets.includes(current)) presets.splice(presets.length - 1, 0, current);
    return presets.map((preset) => ({ value: preset, label: this.presetLabel(preset) }));
  });

  protected readonly compareValue = computed<string>(
    () => this.state.request().comparison?.kind ?? 'NONE',
  );

  protected readonly compareOptions = computed<DropdownOption<string>[]>(() => {
    this.i18n();
    this.analyticsScope();
    this.language();
    const descriptor = this.schema().find((d) => d.kind === 'COMPARISON');
    const codes = descriptor?.options?.length
      ? descriptor.options
      : ['NONE', 'PREVIOUS_PERIOD', 'PREVIOUS_YEAR'];
    return codes.map((code) => ({
      value: code,
      label: this.transloco.translate(`analytics.compare.${code}`),
    }));
  });

  constructor() {
    const onScroll = (event: Event) => {
      if (!this.openMultiKey()) return;
      const target = event.target;
      if (target instanceof Node && this.host.nativeElement.contains(target)) return;
      this.closeMulti();
    };
    document.addEventListener('scroll', onScroll, { capture: true, passive: true });
    const destroyRef = inject(DestroyRef);
    destroyRef.onDestroy(() => document.removeEventListener('scroll', onScroll, { capture: true }));

    let destroyed = false;
    destroyRef.onDestroy(() => {
      destroyed = true;
    });
    void loadReportFilterLookups().then((lookups) => {
      if (!destroyed) this.lookups.set(lookups);
    });
    void Promise.allSettled([this.org.listGrantedBranches(), this.org.listTeams(), this.org.listUsers()]);
  }

  protected periodFieldId(d: FilterDescriptor, part: 'from' | 'to'): string {
    return `${this.fieldId(d)}-${part}`;
  }

  protected periodPartLabel(part: 'from' | 'to'): string {
    this.i18n();
    this.reportScope();
    return this.transloco.translate(part === 'from' ? 'repReport.periodFrom' : 'repReport.periodTo');
  }

  protected periodPartHint(part: 'from' | 'to'): string {
    this.i18n();
    this.reportScope();
    const hint = this.transloco.translate(part === 'from' ? 'repReport.periodFromHint' : 'repReport.periodToHint');
    const zone = this.transloco.translate('repReport.datesTimeZone', { timeZone: this.state.manifest()?.scope.timeZone || 'UTC' });
    return `${hint} ${zone}`;
  }

  protected periodPartDescribedBy(d: FilterDescriptor, part: 'from' | 'to'): string {
    const id = this.periodFieldId(d, part);
    return this.periodPartError(part) ? `${id}-hint ${id}-error` : `${id}-hint`;
  }

  protected dateLabel(key: 'today' | 'prevMonth' | 'nextMonth'): string {
    this.i18n();
    this.reportScope();
    return this.transloco.translate(`repReport.date.${key}`);
  }

  private presetLabel(preset: string): string {
    const key = `repReport.preset.${preset}`;
    const label = this.transloco.translate(key);
    return label === key ? preset : label;
  }

  protected fieldId(d: FilterDescriptor): string {
    return `${this.uid}-${d.key}`;
  }

  protected hintId(d: FilterDescriptor): string {
    return `${this.fieldId(d)}-hint`;
  }

  protected fieldLabel(d: FilterDescriptor): string {
    return this.language() === 'ar' ? d.label.ar : d.label.en;
  }

  protected fieldHint(d: FilterDescriptor): string {
    this.i18n();
    this.reportScope();
    return this.transloco.translate(`repReport.hint.${d.kind}`, { label: this.fieldLabel(d) });
  }

  protected fieldError(d: FilterDescriptor): string | null {
    const errors = Object.entries(this.state.fieldErrors())
      .filter(([path]) => path === d.key || path === `filters.${d.key}` || path.startsWith(`filters.${d.key}.`))
      .flatMap(([, messages]) => messages);
    if (errors.length) return errors.join(' ');
    if (d.kind === 'NUMBER') return this.numberErrors()[d.key] ?? null;
    return null;
  }

  protected periodPartError(part: 'from' | 'to'): string | null {
    return this.state.fieldErrors()[`period.${part}`]?.join(' ') || (part === 'to' ? this.periodError() : null);
  }

  protected optionsFor(d: FilterDescriptor): DropdownOption<string>[] {
    this.i18n();
    this.reportScope();
    const lang = this.language();
    const allLabel = this.transloco.translate('repReport.filterAll');
    let list: DropdownOption<string>[] = [];

    switch (d.kind) {
      case 'BRANCH':
        list = this.org.branches.map((b) => ({
          value: b.id,
          label: lang === 'ar' ? b.name.ar : b.name.en,
        }));
        break;
      case 'TEAM':
        list = this.org.teams.map((t) => ({
          value: t.id,
          label: lang === 'ar' ? t.name.ar : t.name.en,
        }));
        break;
      case 'OWNER':
        list = this.org.users.map((p) => ({
          value: p.id,
          label: lang === 'ar' ? p.nameAr : p.name,
        }));
        break;
      case 'PIPELINE':
        list = this.lookups().pipelines.map((p) => ({
          value: p.id,
          label: lang === 'ar' ? p.label.ar : p.label.en,
        }));
        break;
      case 'SOURCE':
        list = this.lookups().sources.map((s) => ({
          value: s.id,
          label: lang === 'ar' ? s.label.ar : s.label.en,
        }));
        break;
      case 'CURRENCY':
        {
          // Core currencies; a descriptor that declares options narrows them.
          const declared = d.options?.length ? new Set(d.options) : null;
          list = this.lookups()
            .currencies.filter((code) => !declared || declared.has(code))
            .map((code) => ({ value: code, label: code }));
        }
        break;
      case 'COMPANY':
      case 'ENUM':
      default:
        list = (d.options ?? []).map((opt) => ({ value: opt, label: opt }));
        break;
    }

    if (d.multiple || d.required || d.kind === 'CURRENCY') {
      return list;
    }
    return [{ value: '', label: allLabel }, ...list];
  }

  protected singleValue(d: FilterDescriptor): string {
    const raw = this.state.request().filters?.[d.key];
    if (typeof raw === 'string' && raw.length > 0) return raw;
    if (typeof d.defaultValue === 'string' && d.defaultValue.length > 0) return d.defaultValue;
    return '';
  }

  protected multiValues(d: FilterDescriptor): string[] {
    const raw = this.state.request().filters?.[d.key];
    if (Array.isArray(raw)) {
      return raw.filter((v): v is string => typeof v === 'string' && v.length > 0);
    }
    if (d.kind === 'BRANCH') {
      const branchIds = this.state.request().scope?.branchIds;
      if (Array.isArray(branchIds)) return branchIds;
    }
    return [];
  }

  protected multiSummary(d: FilterDescriptor): string {
    this.i18n();
    this.reportScope();
    const selected = this.multiValues(d);
    if (selected.length === 0) {
      return this.transloco.translate('repReport.filterAll');
    }
    const opts = this.optionsFor(d);
    const labelMap = new Map(opts.map((o) => [o.value, o.label]));
    if (selected.length <= 2) {
      return selected.map((id) => labelMap.get(id) ?? id).join(', ');
    }
    return this.transloco.translate('repReport.selectedCount', { count: selected.length });
  }

  protected selectedChipLabels(d: FilterDescriptor): { id: string; label: string }[] {
    const opts = this.optionsFor(d);
    const labelMap = new Map(opts.map((o) => [o.value, o.label]));
    return this.multiValues(d).map((id) => ({ id, label: labelMap.get(id) ?? id }));
  }

  protected isMultiSelected(d: FilterDescriptor, id: string): boolean {
    return this.multiValues(d).includes(id);
  }

  protected toggleMultiPopover(d: FilterDescriptor, triggerEl: HTMLElement): void {
    if (this.openMultiKey() === d.key) {
      this.closeMulti();
      return;
    }
    const seq = ++this.listSeq;
    this.activeMultiTrigger = triggerEl;
    this.multiPlaced.set(false);
    this.multiPlace.set(this.initialPlace(triggerEl));
    this.openMultiKey.set(d.key);
    queueMicrotask(() => this.placeMultiPopover(triggerEl, seq));
    afterNextRender(() => this.placeMultiPopover(triggerEl, seq), { injector: this.injector });
  }

  protected toggleMultiOption(d: FilterDescriptor, optionId: string): void {
    const current = this.multiValues(d);
    const next = current.includes(optionId)
      ? current.filter((v) => v !== optionId)
      : [...current, optionId];
    this.commitMulti(d, next);
  }

  protected clearMulti(d: FilterDescriptor): void {
    this.commitMulti(d, []);
  }

  protected closeMulti(): void {
    this.listSeq++;
    this.openMultiKey.set(null);
    this.multiPlaced.set(false);
    this.activeMultiTrigger = null;
  }

  protected onEscape(event: Event): void {
    if (!this.openMultiKey()) return;
    event.preventDefault();
    event.stopPropagation();
    const trigger = this.activeMultiTrigger;
    this.closeMulti();
    trigger?.focus();
  }

  protected onDocumentClick(event: Event): void {
    if (!this.openMultiKey()) return;
    const target = event.target as Node | null;
    if (target && this.host.nativeElement.contains(target)) return;
    this.closeMulti();
  }

  /** A preset runs as is (the backend resolves its window); CUSTOM keeps the current window as the custom range. */
  protected onPresetChange(preset: string): void {
    const current = this.periodWindow();
    if (preset === current.preset) return;
    this.periodError.set(null);
    if (preset === 'CUSTOM') {
      if (!current.from || !current.to) return;
      void this.state.run({ period: { preset: 'CUSTOM', from: current.from, to: current.to } });
      return;
    }
    void this.state.run({ period: { preset } });
  }

  /** Editing either end makes the period a CUSTOM range of at most 732 days, both ends included. */
  protected onPeriodPartChange(part: 'from' | 'to', value: string | null): void {
    const current = this.periodWindow();
    const fromDay = part === 'from' ? value : current.from;
    const toDay = part === 'to' ? value : current.to;
    if (!fromDay || !toDay) return;
    const days = differenceInCalendarDays(new Date(`${toDay}T00:00:00`), new Date(`${fromDay}T00:00:00`));
    if (!Number.isFinite(days) || days < 0) {
      this.periodError.set(this.transloco.translate('repReport.invalidOrder'));
      return;
    }
    if (days + 1 > MAX_RANGE_DAYS) {
      this.periodError.set(this.transloco.translate('repReport.invalidRange'));
      return;
    }
    this.periodError.set(null);
    if (current.preset === 'CUSTOM' && fromDay === current.from && toDay === current.to) return;
    void this.state.run({ period: { preset: 'CUSTOM', from: fromDay, to: toDay } });
  }

  protected onCompareChange(value: string): void {
    const kind =
      value === 'PREVIOUS_PERIOD' || value === 'PREVIOUS_YEAR' ? value : 'NONE';
    void this.state.run({ comparison: { kind } });
  }

  protected onSingleChange(d: FilterDescriptor, value: string): void {
    const nextVal = value || undefined;
    if (d.kind === 'BRANCH') {
      void this.state.run({
        filters: { [d.key]: nextVal },
        scope: { branchIds: nextVal ? [nextVal] : [] },
      });
      return;
    }
    void this.state.run({ filters: { [d.key]: nextVal } });
  }

  protected numberValue(d: FilterDescriptor): string {
    const raw = this.state.request().filters?.[d.key] ?? d.defaultValue;
    if (raw === null || raw === undefined) return '';
    return String(raw);
  }

  protected onNumberChange(d: FilterDescriptor, event: Event): void {
    const raw = (event.target as HTMLInputElement).value.trim();
    if (!raw) {
      this.setNumberError(d.key, null);
      void this.state.run({ filters: { [d.key]: undefined } });
      return;
    }
    const num = Number(raw);
    if (!Number.isFinite(num)) {
      this.setNumberError(d.key, this.transloco.translate('analytics.error.CRM_DASHBOARD_FILTER_INVALID'));
      return;
    }
    if (d.min !== undefined && num < d.min) {
      this.setNumberError(d.key, this.transloco.translate('repReport.invalidMin', { min: d.min }));
      return;
    }
    if (d.max !== undefined && num > d.max) {
      this.setNumberError(d.key, this.transloco.translate('repReport.invalidMax', { max: d.max }));
      return;
    }
    this.setNumberError(d.key, null);
    void this.state.run({ filters: { [d.key]: num } });
  }

  private commitMulti(d: FilterDescriptor, values: string[]): void {
    if (d.kind === 'BRANCH') {
      void this.state.run({
        filters: { [d.key]: values },
        scope: { branchIds: values },
      });
      return;
    }
    void this.state.run({ filters: { [d.key]: values } });
  }

  private setNumberError(key: string, message: string | null): void {
    this.numberErrors.update((prev) => ({ ...prev, [key]: message }));
  }

  private initialPlace(triggerEl: HTMLElement): MultiPlace {
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

  private placeMultiPopover(triggerEl: HTMLElement, seq: number): void {
    if (seq !== this.listSeq || !this.openMultiKey() || this.multiPlaced()) return;
    const listEl = this.multiListRef()?.nativeElement;
    if (!listEl) return;

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

    this.multiPlace.set({ top, start, width: rect.width, maxHeight });
    this.multiPlaced.set(true);
  }
}
