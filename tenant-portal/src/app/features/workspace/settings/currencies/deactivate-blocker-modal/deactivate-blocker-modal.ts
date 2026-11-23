import { Component, computed, inject, signal, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { PluralKeyPipe } from '../../../../../core/i18n/plural';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { provideIcons } from '@ng-icons/core';
import { tablerAlertTriangle } from '@ng-icons/tabler-icons';
import { Button } from '../../../../../shared/ui/button/button';
import { Modal } from '../../../../../shared/ui/modal/modal';
import { ApiError } from '../../../../../core/api/api-errors';
import { Currency, currencyCompanyBlocker, currencyErrorMessage } from '../currencies.model';

export type CurrencyBlockerKind = 'deactivate' | 'setDefault' | 'reactivate';

interface BlockerState {
  kind: CurrencyBlockerKind;
  currency: Currency;
  error: ApiError;
}

const DEACTIVATION_NEXT_CODES: ReadonlySet<string> = new Set([
  'CURRENCY_DEFAULT_DELETE',
  'CURRENCY_IN_USE',
  'CURRENCY_COMPANY_IN_USE',
]);

@Component({
  selector: 'app-deactivate-blocker-modal',
  imports: [TranslocoPipe, PluralKeyPipe, Button, Modal, RouterLink],
  providers: [provideIcons({ tablerAlertTriangle })],
  templateUrl: './deactivate-blocker-modal.html',
})
export class DeactivateBlockerModal {
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly modal = viewChild.required(Modal);

  protected readonly state = signal<BlockerState | null>(null);
  protected readonly companyBlocker = computed(() => {
    const error = this.state()?.error;
    return error ? currencyCompanyBlocker(error) : { companies: [], more: 0 };
  });

  protected readonly titleKey = computed(() => {
    const kind = this.state()?.kind ?? 'deactivate';
    return `wsCurrencies.blocker.title.${kind}`;
  });

  protected readonly reasonText = computed(() => {
    this.i18n();
    const info = this.state();
    if (!info) return '';
    return currencyErrorMessage(info.error, this.transloco);
  });

  protected readonly nextStepKey = computed(() => {
    const code = this.state()?.error.code;
    if (!code || !DEACTIVATION_NEXT_CODES.has(code)) return null;
    return `wsCurrencies.blocker.next.${code}`;
  });

  open(kind: CurrencyBlockerKind, currency: Currency, error: ApiError): void {
    this.state.set({ kind, currency, error });
    this.modal().open();
  }

  protected close(): void {
    this.modal().close();
  }

  protected onClosed(): void {
    this.state.set(null);
  }
}
