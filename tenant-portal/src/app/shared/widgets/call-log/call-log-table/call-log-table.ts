import { Component, DestroyRef, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { translationEvents } from '../../../../core/i18n/translation-events';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerFilter, tablerHistory, tablerSearch, tablerX } from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../core/i18n/language';
import { correlationIdOf, errorMessage } from '../../../../core/api/api-errors';
import { resolveDate } from '../../../query-builder/query-dates';
import { FullState } from '../../../ui/full-state/full-state';
import { Button } from '../../../ui/button/button';
import { DateField } from '../../../ui/date-time/date-field';
import { Dropdown, DropdownOption } from '../../../ui/dropdown/dropdown';
import { Field } from '../../../ui/field/field';
import { Pagination } from '../../../ui/pagination/pagination';
import { CallLogColumn, CallLogLoader, CallLogRow as CallLogRowModel, CallLogType } from '../call-log.model';
import { CallLogRow } from '../call-log-row/call-log-row';
import { CALL_LOG_FILTER_TYPES, callLogGridClass, callLogTypeLook } from '../call-log-type';

export type {
  CallLogColumn,
  CallLogLoader,
  CallLogQuery,
  CallLogRow,
  CallLogType,
  CallRecordType,
} from '../call-log.model';

type TypeFilterValue = 'ALL' | CallLogType;
type FilterChipId = 'type' | 'from' | 'to' | 'search';

interface FilterChip {
  readonly id: FilterChipId;
  readonly label: string;
}

const DEBOUNCE_MS = 400;
const SKELETON_ROWS = [1, 2, 3, 4, 5, 6] as const;

let nextTableId = 0;

@Component({
  selector: 'app-call-log-table',
  imports: [TranslocoPipe, NgIcon, Field, Dropdown, DateField, Button, Pagination, CallLogRow, FullState],
  viewProviders: [
    provideTranslocoScope({ scope: 'call-log', alias: 'callLog' }),
  ],
  providers: [
    provideIcons({ tablerHistory, tablerFilter, tablerSearch, tablerX }),
  ],
  templateUrl: './call-log-table.html',
  host: { class: 'flex h-full min-h-0 flex-1 flex-col gap-8 overflow-hidden' },
})
export class CallLogTable {
  private readonly transloco = inject(TranslocoService);
  private readonly language = inject(LanguageState);
  private readonly i18n = translationEvents(this.transloco);

  readonly load = input.required<CallLogLoader>();
  readonly columns = input<CallLogColumn[]>(['type', 'party', 'date', 'duration', 'actions']);
  readonly canCallBack = input(false);
  readonly callBackDisabled = input(false);
  readonly pageSizes = input<number[]>([20, 50, 100]);
  readonly reloadToken = input(0);
  readonly errorText = input<(status: number) => string | null>(() => null);
  readonly resolveTimeZone = input<(() => Promise<string | null>) | null>(null);

  readonly callBack = output<CallLogRowModel>();
  readonly openRecord = output<NonNullable<CallLogRowModel['record']>>();

  protected readonly uid = `call-log-table-${++nextTableId}`;
  protected readonly skeletonRows = SKELETON_ROWS;
  protected readonly tableColumnsClass = computed(() => callLogGridClass(this.columns()));

  protected readonly selectedType = signal<TypeFilterValue>('ALL');
  protected readonly fromDate = signal<string | null>(null);
  protected readonly toDate = signal<string | null>(null);
  protected readonly searchInput = signal('');
  protected readonly debouncedQuery = signal('');
  protected readonly page = signal(1);
  protected readonly pageSize = signal(20);

  protected readonly items = signal<CallLogRowModel[]>([]);
  protected readonly total = signal(0);
  protected readonly loading = signal(false);
  protected readonly failed = signal(false);
  protected readonly errorStatus = signal<number | null>(null);
  protected readonly loadError = signal<unknown>(null);
  protected readonly timeZone = signal<string | undefined>(undefined);
  protected readonly failureText = computed(() => {
    this.i18n();
    const error = this.loadError();
    const translations = this.transloco.getTranslation(this.transloco.getActiveLang());
    const message = errorMessage(error, 'callLog', (key, params) =>
      Object.hasOwn(translations, key) ? this.transloco.translate(key, params) : key,
    );
    const correlationId = correlationIdOf(error);
    return correlationId ? `${message} (${correlationId})` : message;
  });

  private searchTimer: ReturnType<typeof setTimeout> | null = null;
  private requestSeq = 0;

  protected readonly typeOptions = computed<DropdownOption<TypeFilterValue>[]>(() => {
    this.i18n();
    const allOption: DropdownOption<TypeFilterValue> = {
      value: 'ALL',
      label: this.transloco.translate('callLog.filters.type.all'),
    };
    const typeItems = CALL_LOG_FILTER_TYPES.map((type) => ({
      value: type as TypeFilterValue,
      label: this.transloco.translate(callLogTypeLook(type).labelKey),
    }));
    return [allOption, ...typeItems];
  });

  protected readonly hasActiveFilters = computed(
    () =>
      this.selectedType() !== 'ALL' ||
      this.fromDate() !== null ||
      this.toDate() !== null ||
      this.debouncedQuery().length > 0,
  );

  protected readonly activeChips = computed<FilterChip[]>(() => {
    this.i18n();
    const lang = this.language.current();
    const chips: FilterChip[] = [];

    const type = this.selectedType();
    if (type !== 'ALL') {
      chips.push({
        id: 'type',
        label: this.transloco.translate(callLogTypeLook(type).labelKey),
      });
    }

    const from = this.fromDate();
    if (from) {
      chips.push({
        id: 'from',
        label: `${this.transloco.translate('callLog.filters.from.label')}: ${formatChipDate(from, lang)}`,
      });
    }

    const to = this.toDate();
    if (to) {
      chips.push({
        id: 'to',
        label: `${this.transloco.translate('callLog.filters.to.label')}: ${formatChipDate(to, lang)}`,
      });
    }

    const q = this.debouncedQuery();
    if (q) {
      chips.push({
        id: 'search',
        label: q,
      });
    }

    return chips;
  });

  protected readonly customErrorMessage = computed(() => {
    this.i18n();
    const status = this.errorStatus();
    return status !== null ? this.errorText()(status) : null;
  });

  constructor() {
    effect(() => {
      const loader = this.load();
      this.reloadToken();
      untracked(() => {
        const sizes = this.pageSizes();
        if (sizes.length > 0 && !sizes.includes(this.pageSize())) {
          this.pageSize.set(sizes[0]);
        }
        this.page.set(1);
        void this.fetchPage(loader);
      });
    });

    inject(DestroyRef).onDestroy(() => {
      if (this.searchTimer !== null) {
        clearTimeout(this.searchTimer);
        this.searchTimer = null;
      }
      this.requestSeq++;
    });
  }

  protected onTypeChange(value: TypeFilterValue): void {
    if (value === this.selectedType()) return;
    this.selectedType.set(value);
    this.page.set(1);
    void this.fetchPage();
  }

  protected onFromChange(value: string | null): void {
    this.fromDate.set(value);
    const currentTo = this.toDate();
    if (value && currentTo && currentTo < value) {
      this.toDate.set(null);
    }
    this.page.set(1);
    void this.fetchPage();
  }

  protected onToChange(value: string | null): void {
    this.toDate.set(value);
    this.page.set(1);
    void this.fetchPage();
  }

  protected onSearchInput(event: Event): void {
    const raw = (event.target as HTMLInputElement).value;
    this.searchInput.set(raw);
    if (this.searchTimer !== null) {
      clearTimeout(this.searchTimer);
    }
    this.searchTimer = setTimeout(() => {
      this.searchTimer = null;
      const cleaned = normalizeSearchQuery(raw);
      if (cleaned === this.debouncedQuery()) return;
      this.debouncedQuery.set(cleaned);
      this.page.set(1);
      void this.fetchPage();
    }, DEBOUNCE_MS);
  }

  protected removeChip(id: FilterChipId): void {
    switch (id) {
      case 'type':
        this.selectedType.set('ALL');
        break;
      case 'from':
        this.fromDate.set(null);
        break;
      case 'to':
        this.toDate.set(null);
        break;
      case 'search':
        if (this.searchTimer !== null) {
          clearTimeout(this.searchTimer);
          this.searchTimer = null;
        }
        this.searchInput.set('');
        this.debouncedQuery.set('');
        break;
    }
    this.page.set(1);
    void this.fetchPage();
  }

  protected clearFilters(): void {
    if (this.searchTimer !== null) {
      clearTimeout(this.searchTimer);
      this.searchTimer = null;
    }
    this.selectedType.set('ALL');
    this.fromDate.set(null);
    this.toDate.set(null);
    this.searchInput.set('');
    this.debouncedQuery.set('');
    this.page.set(1);
    void this.fetchPage();
  }

  protected onPageChange(nextPage: number): void {
    if (nextPage === this.page()) return;
    this.page.set(nextPage);
    void this.fetchPage();
  }

  protected onPageSizeChange(nextSize: number): void {
    if (nextSize === this.pageSize()) return;
    this.pageSize.set(nextSize);
    this.page.set(1);
    void this.fetchPage();
  }

  protected retry(): void {
    void this.fetchPage();
  }

  private async fetchPage(loader: CallLogLoader = this.load()): Promise<void> {
    const seq = ++this.requestSeq;
    this.loading.set(true);
    this.failed.set(false);
    this.errorStatus.set(null);
    this.loadError.set(null);

    const type = this.selectedType();
    const from = this.fromDate();
    const to = this.toDate();
    const q = this.debouncedQuery();

    try {
      const resolveZone = this.resolveTimeZone();
      const zone = resolveZone ? (await resolveZone()) ?? 'UTC' : undefined;
      if (seq !== this.requestSeq) return;
      this.timeZone.set(zone);
      const result = await loader({
        page: this.page(),
        limit: this.pageSize(),
        types: type !== 'ALL' ? [type] : undefined,
        from: from ? startOfDayIso(from, zone) : undefined,
        to: to ? endOfDayIso(to, zone) : undefined,
        q: q || undefined,
      });
      if (seq !== this.requestSeq) return;
      this.items.set(result.data);
      this.total.set(result.meta.total);
    } catch (error) {
      if (seq !== this.requestSeq) return;
      this.errorStatus.set(extractErrorStatus(error));
      this.loadError.set(error);
      this.failed.set(true);
    } finally {
      if (seq === this.requestSeq) {
        this.loading.set(false);
      }
    }
  }
}

function extractErrorStatus(error: unknown): number {
  if (typeof error === 'object' && error !== null && 'status' in error) {
    const status = (error as { status: unknown }).status;
    if (typeof status === 'number') return status;
  }
  return 0;
}

function normalizeSearchQuery(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  if (!/\p{L}/u.test(trimmed)) {
    return trimmed.replace(/[^\d+]/g, '');
  }
  return trimmed;
}

function startOfDayIso(isoDate: string, timeZone?: string): string {
  if (timeZone) return new Date(resolveDate('on', isoDate, timeZone).gte!).toISOString();
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0).toISOString();
}

function endOfDayIso(isoDate: string, timeZone?: string): string {
  if (timeZone) return new Date(new Date(resolveDate('on', isoDate, timeZone).lt!).getTime() - 1).toISOString();
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Date(y, m - 1, d, 23, 59, 59, 999).toISOString();
}

function formatChipDate(isoDate: string, lang: 'ar' | 'en'): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Intl.DateTimeFormat(`${lang}-u-nu-latn`, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(y, m - 1, d));
}
