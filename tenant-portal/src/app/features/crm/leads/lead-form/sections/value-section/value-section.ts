import { Component, computed, inject, input, model } from '@angular/core';
import { translationEvents } from '../../../../../../core/i18n/translation-events';
import { TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { MoneyField } from '../../../../shared/record/fields/money-field/money-field';
import { CurrencyOption } from '../../../../shared/record/fields/record-fields.model';
import { DraftErrors, LEAD_LIMITS, LeadDraft } from '../../lead-draft';
import { LeadLookups } from '../../lead-lookups';

@Component({
  selector: 'app-lf-value',
  imports: [MoneyField],
  providers: [
    provideTranslocoScope(
      { scope: 'lead-form-side', alias: 'leadSide' },
      { scope: 'lead-form', alias: 'leadForm' },
    ),
  ],
  templateUrl: './value-section.html',
  host: { class: 'block min-w-0' },
})
export class ValueSection {
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);

  protected readonly lookups = inject(LeadLookups);
  protected readonly limits = LEAD_LIMITS;

  readonly layout = input<'modal' | 'page'>('modal');
  readonly draft = model.required<LeadDraft>();
  readonly errors = input<DraftErrors>({});
  readonly readonly = input(false);
  readonly mode = input<'create' | 'edit'>('create');

  protected readonly currencyOptions = computed<CurrencyOption[]>(() =>
    this.lookups.currencies().map((currency) => ({
      id: currency.code,
      label: currency.code,
      isDefault: currency.isDefault,
    })),
  );

  protected readonly moneyErrors = computed<Partial<Record<string, string | null>>>(() => {
    this.i18n();
    const errs = this.errors();
    const amountRaw = errs['expectedValue'];
    const currencyRaw = errs['currencyCode'];
    return {
      amount: amountRaw ? this.translateError(amountRaw) : null,
      currency: currencyRaw ? this.translateError(currencyRaw) : null,
    };
  });

  protected onAmountChange(amount: string | null): void {
    this.draft.update((current) => ({ ...current, expectedValue: amount ?? '' }));
  }

  protected onCurrencyChange(currencyCode: string | null): void {
    this.draft.update((current) => ({ ...current, currencyCode }));
  }

  private translateError(raw: string): string {
    const key = raw.startsWith('leadForm.') ? raw : `leadForm.errors.${raw}`;
    return this.transloco.translate(key);
  }
}

export { ValueSection as LfValue };
