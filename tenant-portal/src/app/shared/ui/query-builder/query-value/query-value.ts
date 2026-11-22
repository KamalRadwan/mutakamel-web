import { Component, computed, inject, input, linkedSignal, model, output } from '@angular/core';
import { translationEvents } from '../../../../core/i18n/translation-events';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { Operator, QueryField, RelativeDate, Value } from '../../../query-builder/query.model';
import { valueShape } from '../../../query-builder/query-operators';
import { DateField } from '../../date-time/date-field';
import { Field } from '../../field/field';
import { Dropdown, DropdownOption } from '../../dropdown/dropdown';
import { Segmented, SegmentedOption } from '../../segmented/segmented';
import { QueryMultiSelect } from './multi-select/multi-select';
import { QueryRatingInput } from './rating-input/rating-input';
import { QuerySingleSelect } from './single-select/single-select';
import { QueryTokenList } from './token-list/token-list';

type EditorMode =
  | 'none'
  | 'textSingle'
  | 'textList'
  | 'segmentedEnum'
  | 'singleSelect'
  | 'multiSelect'
  | 'ratingSingle'
  | 'ratingRange'
  | 'ratingList'
  | 'numberSingle'
  | 'numberRange'
  | 'dateSingle'
  | 'dateRange'
  | 'dateRelative'
  | 'boolean';

const RELATIVE_DATES: readonly RelativeDate[] = [
  'today',
  'yesterday',
  'last7',
  'last30',
  'thisMonth',
  'lastMonth',
  'thisYear',
];

const DEFAULT_TEXT_MAX = 200;

@Component({
  selector: 'ui-query-value',
  imports: [
    TranslocoPipe,
    DateField,
    Field,
    Dropdown,
    Segmented,
    QueryTokenList,
    QueryRatingInput,
    QuerySingleSelect,
    QueryMultiSelect,
  ],
  providers: [provideTranslocoScope({ scope: 'ui-query-value', alias: 'qv' })],
  templateUrl: './query-value.html',
  host: { class: 'block w-full min-w-0' },
})
export class QueryValue {
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);

  readonly field = input.required<QueryField>();
  readonly operator = input.required<Operator>();
  readonly invalid = input(false);
  readonly disabled = input(false);
  readonly describedBy = input<string | null>(null);
  readonly timeZone = input('Africa/Cairo');
  readonly value = model<Value | undefined>(undefined);
  readonly commit = output<void>();

  protected readonly shape = computed(() => valueShape(this.operator()));

  protected readonly editorMode = computed<EditorMode>(() => {
    const currentShape = this.shape();
    if (currentShape === 'none') return 'none';

    const f = this.field();
    switch (f.kind) {
      case 'textSearch':
      case 'text':
        return currentShape === 'list' ? 'textList' : 'textSingle';

      case 'enum':
      case 'lookup':
        if (currentShape === 'list') return 'multiSelect';
        if (
          f.kind === 'enum' &&
          !f.searchOptions &&
          !(f.specialOptions?.length) &&
          (f.options?.length ?? 0) <= 2
        ) {
          return 'segmentedEnum';
        }
        return 'singleSelect';

      case 'rating':
        if (currentShape === 'range') return 'ratingRange';
        if (currentShape === 'list') return 'ratingList';
        return 'ratingSingle';

      case 'number':
        return currentShape === 'range' ? 'numberRange' : 'numberSingle';

      case 'date':
        if (currentShape === 'relative') return 'dateRelative';
        if (currentShape === 'range') return 'dateRange';
        return 'dateSingle';

      case 'boolean':
        return 'boolean';

      case 'tags':
        return 'multiSelect';
    }
  });

  protected readonly fieldBoxClasses = computed(() => {
    const base =
      'flex h-field w-full items-center rounded-8 border px-8 text-12 transition-colors duration-fast';
    if (this.disabled()) {
      return `${base} cursor-not-allowed border-transparent bg-neutral-soft text-text-placeholder`;
    }
    if (this.invalid()) {
      return `${base} border-danger-border bg-surface-field text-text ring-2 ring-danger-halo`;
    }
    return `${base} border-border-field bg-surface-field text-text hover:border-border-field-hover focus-within:border-focus-ring focus-within:ring-3 focus-within:ring-focus-halo-strong`;
  });

  protected readonly textDir = computed(() => {
    const mode = this.field().inputMode;
    return mode === 'tel' || mode === 'email' ? 'ltr' : 'auto';
  });

  protected readonly textInputMode = computed(() => this.field().inputMode ?? 'text');
  protected readonly textMaxLength = computed(() => this.field().maxLength ?? DEFAULT_TEXT_MAX);

  protected readonly textSingleValue = computed(() => {
    const val = this.value();
    return typeof val === 'string' ? val : '';
  });

  protected readonly stringListValue = computed<string[]>(() => {
    const val = this.value();
    if (!Array.isArray(val)) return [];
    return val.filter((item): item is string => typeof item === 'string');
  });

  protected readonly stringSingleValue = computed<string | null>(() => {
    const val = this.value();
    return typeof val === 'string' ? val : null;
  });

  protected readonly enumSegmentedOptions = computed<SegmentedOption[]>(() => {
    const isDisabled = this.disabled();
    return (this.field().options ?? []).map((opt) => ({
      value: opt.value,
      label: opt.label,
      dot: opt.colorClass,
      disabled: isDisabled,
    }));
  });

  protected readonly booleanOptions = computed<SegmentedOption[]>(() => {
    this.i18n();
    const isDisabled = this.disabled();
    return [
      { value: 'true', label: this.transloco.translate('qv.yes'), disabled: isDisabled },
      { value: 'false', label: this.transloco.translate('qv.no'), disabled: isDisabled },
    ];
  });

  protected readonly booleanSegmentedValue = computed<string | null>(() => {
    const val = this.value();
    if (val === true) return 'true';
    if (val === false) return 'false';
    return null;
  });

  protected readonly relativeDateOptions = computed<DropdownOption<RelativeDate | null>[]>(() => {
    this.i18n();
    return RELATIVE_DATES.map((key) => ({
      value: key,
      label: this.transloco.translate(`qv.date.${key}`),
    }));
  });

  protected readonly relativeDateValue = computed<RelativeDate | null>(() => {
    const val = this.value();
    return typeof val === 'string' && (RELATIVE_DATES as readonly string[]).includes(val)
      ? (val as RelativeDate)
      : null;
  });

  protected readonly dateSingleValue = computed<string | null>(() => {
    const val = this.value();
    return typeof val === 'string' && val ? val : null;
  });

  protected readonly dateRangeFrom = computed<string | null>(() => {
    const val = this.value();
    if (!Array.isArray(val) || val.length !== 2) return null;
    const first = val[0];
    return typeof first === 'string' && first ? first : null;
  });

  protected readonly dateRangeTo = computed<string | null>(() => {
    const val = this.value();
    if (!Array.isArray(val) || val.length !== 2) return null;
    const second = val[1];
    return typeof second === 'string' && second ? second : null;
  });

  protected readonly numberSingleText = linkedSignal<Value | undefined, string>({
    source: () => this.value(),
    computation: (val, prev) => {
      if (typeof val === 'number' && Number.isFinite(val)) {
        if (prev && Number(prev.value) === val && prev.value.trim() !== '') return prev.value;
        return String(val);
      }
      if (val === undefined || val === null || val === '') return '';
      return prev?.value ?? '';
    },
  });

  protected readonly numberFromText = linkedSignal<Value | undefined, string>({
    source: () => this.value(),
    computation: (val, prev) => {
      if (Array.isArray(val) && val.length === 2 && typeof val[0] === 'number' && Number.isFinite(val[0])) {
        if (prev && Number(prev.value) === val[0] && prev.value.trim() !== '') return prev.value;
        return String(val[0]);
      }
      if (!Array.isArray(val) || typeof val[0] !== 'number' || !Number.isFinite(val[0])) return '';
      return prev?.value ?? '';
    },
  });

  protected readonly numberToText = linkedSignal<Value | undefined, string>({
    source: () => this.value(),
    computation: (val, prev) => {
      if (Array.isArray(val) && val.length === 2 && typeof val[1] === 'number' && Number.isFinite(val[1])) {
        if (prev && Number(prev.value) === val[1] && prev.value.trim() !== '') return prev.value;
        return String(val[1]);
      }
      if (!Array.isArray(val) || typeof val[1] !== 'number' || !Number.isFinite(val[1])) return '';
      return prev?.value ?? '';
    },
  });

  protected onTextSingleInput(event: Event): void {
    this.value.set((event.target as HTMLInputElement).value);
  }

  protected onNumberSingleInput(event: Event): void {
    const raw = (event.target as HTMLInputElement).value;
    this.numberSingleText.set(raw);
    const trimmed = raw.trim();
    if (!trimmed) {
      this.value.set(undefined);
      return;
    }
    const parsed = Number(trimmed);
    if (Number.isFinite(parsed)) {
      this.value.set(parsed);
    }
  }

  protected onNumberRangeInput(part: 'from' | 'to', event: Event): void {
    const raw = (event.target as HTMLInputElement).value;
    if (part === 'from') this.numberFromText.set(raw);
    else this.numberToText.set(raw);

    const fromNum = parseOptionalNumber(this.numberFromText());
    const toNum = parseOptionalNumber(this.numberToText());

    if (fromNum === null && toNum === null) {
      this.value.set(undefined);
      return;
    }
    this.value.set([fromNum ?? Number.NaN, toNum ?? Number.NaN]);
  }

  protected onEnumSegmentedChange(next: string | null): void {
    if (this.disabled()) return;
    this.value.set(next ?? undefined);
  }

  protected onBooleanChange(next: string | null): void {
    if (this.disabled()) return;
    if (next === 'true') this.value.set(true);
    else if (next === 'false') this.value.set(false);
    else this.value.set(undefined);
  }

  protected onRelativeDateChange(next: RelativeDate | null): void {
    this.value.set(next ?? undefined);
  }

  protected onDateSingleChange(next: string | null): void {
    this.value.set(next ?? undefined);
  }

  protected onDateRangeChange(part: 'from' | 'to', next: string | null): void {
    const from = part === 'from' ? next : this.dateRangeFrom();
    const to = part === 'to' ? next : this.dateRangeTo();
    if (!from && !to) {
      this.value.set(undefined);
      return;
    }
    this.value.set([from ?? '', to ?? '']);
  }

  protected onCommitKey(): void {
    this.commit.emit();
  }
}

function parseOptionalNumber(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}
