import { Component, computed, inject, input, model } from '@angular/core';
import { translationEvents } from '../../../../../../../core/i18n/translation-events';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { provideIcons } from '@ng-icons/core';
import { tablerCoins } from '@ng-icons/tabler-icons';
import { Field } from '../../../../../../../shared/ui/field/field';
import { RECORD_PAGE_GRID } from '../../../../../../../shared/ui/section-bar/record-layout';
import { SectionBar } from '../../../../../../../shared/ui/section-bar/section-bar';
import { formatMoney } from '../../../../../shared/trade-format';
import type { FieldError } from '../../../item-form/item-draft';

@Component({
  selector: 'app-item-standard-cost-section',
  imports: [TranslocoPipe, Field, SectionBar],
  providers: [provideIcons({ tablerCoins })],
  templateUrl: './standard-cost-section.html',
  host: { class: 'block min-w-0' },
})
export class StandardCostSection {
  private static nextId = 0;
  protected readonly uid = `item-std-cost-${++StandardCostSection.nextId}`;

  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);

  readonly currencyCode = input<string | null>(null);
  readonly hasProfile = input(false);
  readonly canManageCost = input(true);
  readonly readonly = input(false);
  readonly error = input<FieldError | null>(null);

  readonly value = model('');

  protected readonly pageGrid = RECORD_PAGE_GRID;

  protected readonly isDisabled = computed(() => !this.hasProfile() || !this.currencyCode());

  protected readonly disabledReason = computed<string | null>(() => {
    this.i18n();
    if (!this.hasProfile()) {
      return this.transloco.translate('itemForm.reasons.needProfile');
    }
    if (!this.currencyCode()) {
      return this.transloco.translate('itemForm.reasons.noCurrency');
    }
    return null;
  });

  protected readonly isReadonly = computed(() => !this.isDisabled() && (this.readonly() || !this.canManageCost()));

  protected readonly formattedValue = computed(() => formatMoney(this.currencyCode(), this.value()));

  protected readonly errorText = computed<string | null>(() => {
    this.i18n();
    const err = this.error();
    return err ? this.transloco.translate(err.key, err.params) : null;
  });

  protected onInput(event: Event): void {
    if (this.isDisabled() || this.isReadonly()) return;
    this.value.set((event.target as HTMLInputElement).value);
  }
}
