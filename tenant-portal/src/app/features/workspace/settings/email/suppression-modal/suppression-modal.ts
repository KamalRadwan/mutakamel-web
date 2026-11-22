import { Component, computed, effect, inject, output, signal, viewChild } from '@angular/core';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerCircleCheck,
  tablerCircleX,
  tablerLoader2,
  tablerMailOff,
} from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../../core/i18n/language';
import { Button } from '../../../../../shared/ui/button/button';
import { ConfirmDialog } from '../../../../../shared/ui/confirm-dialog/confirm-dialog';
import { Modal } from '../../../../../shared/ui/modal/modal';
import { ApiError, errorCodeOf } from '../../../../../core/api/api-errors';
import { newIdempotencyKey } from '../../../../../core/api/idempotency';
import { SettingsNotice } from '../../../../../shared/ui/settings-notice/settings-notice';
import { liftSuppression, lookupSuppression } from '../email.api';
import { SuppressionLookup, formatEmailDateTime } from '../email.model';

type SuppressionViewState =
  | 'idle'
  | 'loading'
  | 'clear'
  | 'suppressed'
  | 'liftedOk'
  | 'liftedNone'
  | 'error';

@Component({
  selector: 'app-suppression-modal',
  imports: [NgIcon, TranslocoPipe, Button, ConfirmDialog, Modal, SettingsNotice],
  providers: [provideIcons({ tablerMailOff, tablerLoader2, tablerCircleCheck, tablerCircleX })],
  templateUrl: './suppression-modal.html',
})
export class SuppressionModal {
  private readonly transloco = inject(TranslocoService);
  private readonly language = inject(LanguageState).current;
  private readonly modal = viewChild.required<Modal>('modal');
  private readonly liftConfirm = viewChild.required<ConfirmDialog>('liftConfirm');

  readonly forbidden = output<void>();
  readonly busyChange = output<boolean>();

  private readonly targetAddress = signal('');
  protected readonly state = signal<SuppressionViewState>('idle');
  protected readonly lookupData = signal<SuppressionLookup | null>(null);
  protected readonly errorText = signal<string | null>(null);
  protected readonly errorRetryable = signal(false);
  protected readonly lifting = signal(false);

  private lastAction: 'lookup' | 'lift' = 'lookup';
  private requestSeq = 0;
  private allowClose = false;
  private liftOp: { address: string; key: string } | null = null;

  protected readonly busy = computed(() => this.state() === 'loading' || this.lifting());

  protected readonly firstOccurredText = computed(() =>
    formatEmailDateTime(this.lookupData()?.firstOccurredAt, this.language()),
  );

  protected readonly lastOccurredText = computed(() =>
    formatEmailDateTime(this.lookupData()?.lastOccurredAt, this.language()),
  );

  constructor() {
    effect(() => {
      this.busyChange.emit(this.busy());
    });
  }

  open(address: string): void {
    const clean = address.trim();
    if (!clean) return;

    this.allowClose = false;
    if (this.liftOp && this.liftOp.address !== clean) {
      this.liftOp = null;
    }
    this.targetAddress.set(clean);
    this.lookupData.set(null);
    this.errorText.set(null);
    this.errorRetryable.set(false);
    this.modal().open();
    void this.runLookup();
  }

  close(): void {
    this.allowClose = true;
    this.modal().close();
  }

  clearResults(): void {
    this.requestSeq++;
    this.targetAddress.set('');
    this.state.set('idle');
    this.lookupData.set(null);
    this.errorText.set(null);
    this.errorRetryable.set(false);
    this.lifting.set(false);
    this.liftOp = null;
  }

  protected onModalClosed(): void {
    if (!this.allowClose && this.busy()) {
      this.modal().open();
      return;
    }
    this.allowClose = false;
    this.clearResults();
  }

  protected retry(): void {
    if (this.busy()) return;
    if (this.lastAction === 'lift') {
      void this.runLift();
    } else {
      void this.runLookup();
    }
  }

  protected async requestLift(): Promise<void> {
    if (this.busy() || this.state() !== 'suppressed') return;
    const confirmed = await this.liftConfirm().open();
    if (!confirmed) return;
    await this.runLift();
  }

  private async runLookup(): Promise<void> {
    const address = this.targetAddress();
    if (!address) return;

    const seq = ++this.requestSeq;
    this.lastAction = 'lookup';
    this.state.set('loading');
    this.errorText.set(null);
    this.errorRetryable.set(false);

    try {
      const result = await lookupSuppression(address);
      if (seq !== this.requestSeq) return;
      this.lookupData.set(result);
      this.state.set(result.suppressed ? 'suppressed' : 'clear');
    } catch (error) {
      if (seq !== this.requestSeq) return;
      this.handleSuppressionError(error, 'lookup');
    }
  }

  private async runLift(): Promise<void> {
    const address = this.targetAddress();
    if (!address) return;

    if (!this.liftOp || this.liftOp.address !== address) {
      this.liftOp = { address, key: newIdempotencyKey() };
    }

    const seq = ++this.requestSeq;
    this.lastAction = 'lift';
    this.lifting.set(true);
    this.errorText.set(null);
    this.errorRetryable.set(false);

    try {
      const result = await liftSuppression(address, this.liftOp.key);
      if (seq !== this.requestSeq) return;
      this.liftOp = null;
      this.lookupData.set(null);
      this.state.set(result.lifted ? 'liftedOk' : 'liftedNone');
    } catch (error) {
      if (seq !== this.requestSeq) return;
      this.handleSuppressionError(error, 'lift');
    } finally {
      this.lifting.set(false);
    }
  }

  private handleSuppressionError(error: unknown, action: 'lookup' | 'lift'): void {
    const code = errorCodeOf(error);
    const status = error instanceof ApiError ? error.status : null;

    if (status === 403 || code === 'TENANT_WIDE_PERMISSION_REQUIRED' || code === 'ACCESS_POLICY_BLOCKED') {
      this.clearResults();
      this.state.set('error');
      this.errorText.set(this.transloco.translate('wsEmail.bar.readOnlyHint'));
      this.errorRetryable.set(false);
      this.forbidden.emit();
      return;
    }

    this.lastAction = action;
    if (status === 400 || status === 422) {
      this.state.set('error');
      this.errorText.set(this.transloco.translate('wsEmail.suppression.errors.invalidAddress'));
      this.errorRetryable.set(false);
      return;
    }

    if (status === 429 || code === 'TOO_MANY_REQUESTS') {
      this.state.set('error');
      this.errorText.set(this.transloco.translate('wsEmail.suppression.errors.rateLimited'));
      this.errorRetryable.set(true);
      return;
    }

    this.state.set('error');
    this.errorText.set(this.transloco.translate('wsEmail.suppression.errors.failed'));
    this.errorRetryable.set(true);
  }
}
