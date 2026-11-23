import { Component, inject, output, signal, viewChild } from '@angular/core';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { provideIcons } from '@ng-icons/core';
import { tablerStar } from '@ng-icons/tabler-icons';
import { Notify } from '../../../../../core/notify/notify';
import { AuthSession } from '../../../../../core/auth/auth-session';
import { Button } from '../../../../../shared/ui/button/button';
import { Modal } from '../../../../../shared/ui/modal/modal';
import { ApiError } from '../../../../../core/api/api-errors';
import { newIdempotencyKey } from '../../../../../core/api/idempotency';
import { SettingsNotice } from '../../../../../shared/ui/settings-notice/settings-notice';
import { ActionKeys } from '../../core-response.model';
import { CurrenciesApi } from '../currencies.api';
import { Currency, currencyErrorMessage, currencyPermissions } from '../currencies.model';

@Component({
  selector: 'app-set-default-dialog',
  imports: [TranslocoPipe, Button, Modal, SettingsNotice],
  providers: [provideIcons({ tablerStar })],
  templateUrl: './set-default-dialog.html',
})
export class SetDefaultDialog {
  private readonly notify = inject(Notify);
  private readonly api = inject(CurrenciesApi);
  private readonly me = inject(AuthSession).me;
  private readonly actionKeys = new ActionKeys(newIdempotencyKey);
  private readonly transloco = inject(TranslocoService);
  private readonly modal = viewChild.required(Modal);

  readonly confirmed = output<Currency>();
  readonly blocked = output<{ currency: Currency; error: ApiError }>();

  protected readonly target = signal<Currency | null>(null);
  protected readonly current = signal<Currency | null>(null);
  protected readonly saving = signal(false);

  private allowClose = false;

  open(target: Currency, current: Currency | null): void {
    if (!currencyPermissions(this.me()).manage) return;
    this.allowClose = false;
    this.target.set(target);
    this.current.set(current);
    this.saving.set(false);
    this.modal().open();
  }

  protected async confirm(): Promise<void> {
    const row = this.target();
    if (!row || this.saving() || !currencyPermissions(this.me()).manage) return;

    const signature = `set-default:${row.id}`;
    const key = this.actionKeys.keyFor(signature);
    this.saving.set(true);
    try {
      const updated = await this.api.setDefaultCurrency(row.id, key);
      this.actionKeys.done(signature);
      this.notify.success(this.transloco.translate('wsCurrencies.toast.defaultSet', { code: updated.code }));
      this.closeImmediate();
      this.confirmed.emit(updated);
    } catch (error) {
      this.notify.error(currencyErrorMessage(error, this.transloco, 'write'));
      if (error instanceof ApiError && error.code === 'CURRENCY_NOT_FOUND') {
        this.closeImmediate();
        this.blocked.emit({ currency: row, error });
      }
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
  }

  private closeImmediate(): void {
    this.allowClose = true;
    this.modal().close();
  }
}
