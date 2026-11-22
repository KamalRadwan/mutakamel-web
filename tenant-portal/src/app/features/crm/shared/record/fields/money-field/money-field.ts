import { Component, computed, inject, input, model, signal } from '@angular/core';
import { translationEvents } from '../../../../../../core/i18n/translation-events';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { LanguageState } from '../../../../../../core/i18n/language';
import { Dropdown, DropdownOption } from '../../../../../../shared/ui/dropdown/dropdown';
import { Field } from '../../../../../../shared/ui/field/field';
import { CurrencyOption } from '../record-fields.model';
import { formatMoneyDisplay } from './money-format';

const DECIMAL_SHAPE_RE = /^(\d*)(?:\.(\d*))?$/;
const LOOSE_DECIMAL_RE = /^\d*(?:\.\d*)?$/;

function normalizeAmountChars(value: string): string {
  return value
    .replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 0x0660))
    .replace(/٫/g, '.')
    .replace(/[٬,]/g, '');
}

function normalizeBlurredDecimal(value: string): string {
  const cleaned = normalizeAmountChars(value).trim();
  if (!cleaned) return '';
  if (cleaned === '.') return '';
  const withZero = cleaned.startsWith('.') ? `0${cleaned}` : cleaned;
  return withZero.endsWith('.') ? withZero.slice(0, -1) : withZero;
}

@Component({
  selector: 'app-money-field',
  imports: [TranslocoPipe, Dropdown, Field],
  providers: [provideTranslocoScope({ scope: 'record-fields', alias: 'recordFields' })],
  templateUrl: './money-field.html',
  host: { class: 'block min-w-0' },
})
export class MoneyField {
  private static nextId = 0;
  protected readonly uid = `rf-money-${++MoneyField.nextId}`;

  private readonly language = inject(LanguageState).current;
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);

  readonly amount = model<string | null>(null);
  readonly currency = model<string | null>(null);
  readonly currencies = input<readonly CurrencyOption[]>([]);
  readonly integerDigits = input(16);
  readonly decimals = input(8);
  readonly readonly = input(false);
  readonly errors = input<Partial<Record<string, string | null>>>({});
  readonly labelKey = input<string>('recordFields.money.label');
  readonly hintKey = input<string>('recordFields.money.hint');

  protected readonly focused = signal(false);

  private autoCurrency = false;
  private lastTypedValue: string | null = null;

  protected readonly label = computed(() => {
    this.i18n();
    return this.transloco.translate(this.labelKey());
  });
  protected readonly hint = computed(() => {
    this.i18n();
    return this.transloco.translate(this.hintKey());
  });

  protected readonly currencyOptions = computed<DropdownOption<string>[]>(() => [
    { value: '', label: '—' },
    ...this.currencies().map((item) => ({
      value: item.id,
      label: item.label,
      disabled: item.disabled,
    })),
  ]);

  protected readonly selectedCurrency = computed<CurrencyOption | null>(() => {
    const code = this.currency();
    if (!code) return null;
    return this.currencies().find((item) => item.id === code) ?? null;
  });

  protected readonly currencyLabel = computed(() => {
    const selected = this.selectedCurrency();
    return selected?.label ?? this.currency() ?? '';
  });

  protected readonly effectiveIntegerDigits = computed(() => Math.max(1, Math.floor(this.integerDigits())));

  protected readonly effectiveDecimals = computed(() => {
    const chosen = this.selectedCurrency()?.decimals;
    if (chosen !== undefined && Number.isFinite(chosen)) {
      return Math.max(0, Math.floor(chosen));
    }
    return Math.max(0, Math.floor(this.decimals()));
  });

  protected readonly scaleError = computed<string | null>(() => {
    this.i18n();
    const raw = this.amount()?.trim() ?? '';
    if (!raw) return null;

    const cleaned = normalizeAmountChars(raw);
    const match = DECIMAL_SHAPE_RE.exec(cleaned);
    if (!match || (!match[1] && !match[2])) {
      return this.transloco.translate('recordFields.money.errors.invalid');
    }

    const intPart = match[1].replace(/^0+(?=\d)/, '') || '0';
    const fracPart = match[2] ?? '';
    const maxInt = this.effectiveIntegerDigits();
    const maxDec = this.effectiveDecimals();

    if (intPart.length > maxInt) {
      return this.transloco.translate('recordFields.money.errors.invalid');
    }
    if (fracPart.length > maxDec) {
      return maxDec === 0
        ? this.transloco.translate('recordFields.money.errors.noDecimals')
        : this.transloco.translate('recordFields.money.errors.tooManyDecimals', { decimals: maxDec });
    }
    return null;
  });

  private readonly externalAmountError = computed(() => this.errors()['amount'] ?? null);
  private readonly externalCurrencyError = computed(() => this.errors()['currency'] ?? null);

  protected readonly fieldError = computed<string | null>(
    () => this.externalAmountError() ?? this.externalCurrencyError() ?? this.scaleError(),
  );

  protected readonly hasAmountError = computed(() => Boolean(this.externalAmountError() || this.scaleError()));
  protected readonly hasCurrencyError = computed(() => Boolean(this.externalCurrencyError()));

  protected readonly displayAmount = computed(() => {
    const raw = this.amount() ?? '';
    if (this.readonly()) {
      return raw ? formatMoneyDisplay(raw, this.language()) || raw : '';
    }
    if (this.focused()) {
      return raw;
    }
    if (this.scaleError()) {
      return raw;
    }
    if (!raw.trim()) return '';
    return formatMoneyDisplay(raw, this.language()) || raw;
  });

  protected readonly preview = computed<string | null>(() => {
    const code = this.currency();
    const raw = this.amount()?.trim() ?? '';
    if (!code || !raw || this.scaleError()) return null;
    const formatted = formatMoneyDisplay(raw, this.language());
    return formatted ? `${code} ${formatted}` : null;
  });

  protected readonly hasValue = computed(() => Boolean(this.currency() || (this.amount()?.trim() ?? '')));

  protected onCurrencyChange(code: string): void {
    if (this.readonly()) return;
    this.autoCurrency = false;
    this.currency.set(code || null);
  }

  protected onAmountFocus(): void {
    if (this.readonly()) return;
    this.focused.set(true);
  }

  protected onAmountInput(event: Event): void {
    if (this.readonly()) return;
    const inputEl = event.target as HTMLInputElement;
    const rawCaret = inputEl.selectionStart ?? inputEl.value.length;
    const beforeCaret = inputEl.value.slice(0, rawCaret);
    const normalized = normalizeAmountChars(inputEl.value);
    const prevValue = this.amount() ?? '';

    if (prevValue !== this.lastTypedValue) {
      this.autoCurrency = false;
    }

    const maxInt = this.effectiveIntegerDigits();
    const maxDec = this.effectiveDecimals();
    const livePattern =
      maxDec === 0
        ? new RegExp(`^\\d{0,${maxInt}}$`)
        : new RegExp(`^\\d{0,${maxInt}}(\\.\\d{0,${maxDec}})?$`);
    const isDeletingExisting = LOOSE_DECIMAL_RE.test(normalized) && normalized.length < prevValue.length;

    if (!livePattern.test(normalized) && !isDeletingExisting) {
      inputEl.value = prevValue;
      const delta = normalized.length - prevValue.length;
      const revertCaret = Math.max(
        0,
        Math.min(prevValue.length, normalizeAmountChars(beforeCaret).length - Math.max(0, delta)),
      );
      inputEl.setSelectionRange(revertCaret, revertCaret);
      return;
    }

    if (inputEl.value !== normalized) {
      inputEl.value = normalized;
      const nextCaret = normalizeAmountChars(beforeCaret).length;
      inputEl.setSelectionRange(nextCaret, nextCaret);
    }

    this.lastTypedValue = normalized;
    this.amount.set(normalized === '' ? null : normalized);

    if (normalized !== '' && this.currency() === null) {
      const list = this.currencies();
      const preferred = list.find((item) => item.isDefault) ?? list[0] ?? null;
      if (preferred) {
        this.autoCurrency = true;
        this.currency.set(preferred.id);
      }
    } else if (normalized === '' && this.autoCurrency) {
      this.autoCurrency = false;
      this.currency.set(null);
    }
  }

  protected onAmountBlur(): void {
    this.focused.set(false);
    const current = this.amount() ?? '';
    const cleaned = normalizeBlurredDecimal(current);
    const next = cleaned === '' ? null : cleaned;
    if (next !== this.amount()) {
      this.lastTypedValue = next ?? '';
      this.amount.set(next);
    }
  }

  protected clearValue(): void {
    if (this.readonly()) return;
    this.autoCurrency = false;
    this.lastTypedValue = '';
    this.amount.set(null);
    this.currency.set(null);
  }
}
