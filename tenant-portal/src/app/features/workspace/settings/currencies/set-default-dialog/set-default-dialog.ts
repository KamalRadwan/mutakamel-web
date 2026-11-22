import { Component, inject, output, signal, viewChild } from '@angular/core';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { provideIcons } from '@ng-icons/core';
import { tablerStar } from '@ng-icons/tabler-icons';
import { Notify } from '../../../../../core/notify/notify';
import { Button } from '../../../../../shared/ui/button/button';
import { Modal } from '../../../../../shared/ui/modal/modal';
import { ApiError } from '../../../../../core/api/api-errors';
import { newIdempotencyKey } from '../../../../../core/api/idempotency';
import { SettingsNotice } from '../../../../../shared/ui/settings-notice/settings-notice';
import { setDefaultCurrency } from '../currencies.api';
import { Currency, currencyErrorMessage } from '../currencies.model';

const BLOCKER_ERROR_CODES: ReadonlySet<string> = new Set([
  'CURRENCY_INACTIVE_DEFAULT',
  'CURRENCY_REBASE_OUT_OF_RANGE',
  'CURRENCY_REBASE_PRECISION_LOSS',
  'CURRENCY_EXCHANGE_RATE_REQUIRED',
  'CURRENCY_NOT_FOUND',
]);

@Component({
  selector: 'app-set-default-dialog',
  imports: [TranslocoPipe, Button, Modal, SettingsNotice],
  providers: [provideIcons({ tablerStar })],
  templateUrl: './set-default-dialog.html',
})
export class SetDefaultDialog {
  private readonly notify = inject(Notify);
  private readonly transloco = inject(TranslocoService);
  private readonly modal = viewChild.required(Modal);

  readonly confirmed = output<Currency>();
  readonly blocked = output<{ currency: Currency; error: ApiError }>();

  protected readonly target = signal<Currency | null>(null);
  protected readonly current = signal<Currency | null>(null);
  protected readonly saving = signal(false);

  private pendingKey = '';
  private allowClose = false;

  open(target: Currency, current: Currency | null): void {
    this.allowClose = false;
    this.target.set(target);
    this.current.set(current);
    this.saving.set(false);
    this.pendingKey = newIdempotencyKey();
    this.modal().open();
  }

  protected async confirm(): Promise<void> {
    const row = this.target();
    if (!row || this.saving()) return;

    const key = this.pendingKey || (this.pendingKey = newIdempotencyKey());
    this.saving.set(true);
    try {
      const updated = await setDefaultCurrency(row.id, key);
      this.pendingKey = '';
      this.notify.success(this.transloco.translate('wsCurrencies.toast.defaultSet', { code: updated.code }));
      this.closeImmediate();
      this.confirmed.emit(updated);
    } catch (error) {
      if (error instanceof ApiError && BLOCKER_ERROR_CODES.has(error.code)) {
        this.pendingKey = '';
        this.closeImmediate();
        this.blocked.emit({ currency: row, error });
        return;
      }
      this.notify.error(currencyErrorMessage(error, this.transloco));
    } finally {
      this.saving.set(false);
    }
  }

  protected close(): void {
    if (this.saving()) return;
    this.closeImmediate();
  }

  protected onClosed(): void {
    if (!this.allowClose && this.saving()) {
      this.modal().open();
      return;
    }
    this.allowClose = false;
    this.target.set(null);
    this.current.set(null);
    this.pendingKey = '';
  }

  private closeImmediate(): void {
    this.allowClose = true;
    this.modal().close();
  }
}
