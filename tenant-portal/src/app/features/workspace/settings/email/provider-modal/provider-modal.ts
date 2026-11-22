import { Component, computed, inject, input, output, signal, viewChild } from '@angular/core';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { provideIcons } from '@ng-icons/core';
import { tablerServer } from '@ng-icons/tabler-icons';
import { Notify } from '../../../../../core/notify/notify';
import { Button } from '../../../../../shared/ui/button/button';
import { Dropdown, DropdownOption } from '../../../../../shared/ui/dropdown/dropdown';
import { Field } from '../../../../../shared/ui/field/field';
import { Modal } from '../../../../../shared/ui/modal/modal';
import { newIdempotencyKey } from '../../../../../core/api/idempotency';
import { SettingsNotice } from '../../../../../shared/ui/settings-notice/settings-notice';
import { patchEmailConfig } from '../email.api';
import {
  EmailConflictPayload,
  EmailResult,
  PatchEmailConfigRequest,
  ProviderDriver,
  TenantEmailConfig,
  extractApiErrorField,
  isConflictError,
  providerDriverLabel,
  resolveEmailError,
} from '../email.model';

@Component({
  selector: 'app-provider-modal',
  imports: [TranslocoPipe, Button, Dropdown, Field, Modal, SettingsNotice],
  providers: [provideIcons({ tablerServer })],
  templateUrl: './provider-modal.html',
})
export class ProviderModal {
  private static nextId = 0;
  protected readonly uid = `ws-email-provider-modal-${++ProviderModal.nextId}`;

  private readonly notify = inject(Notify);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly modal = viewChild.required<Modal>('modal');

  readonly config = input<TenantEmailConfig | null>(null);
  readonly revision = input<number | null>(null);
  readonly canManage = input(true);

  readonly saved = output<EmailResult>();
  readonly conflict = output<EmailConflictPayload>();
  readonly switchToSmtp = output<void>();

  protected readonly driverDraft = signal<ProviderDriver>('smtp');
  protected readonly saving = signal(false);
  protected readonly fieldError = signal<string | null>(null);
  protected readonly topError = signal<string | null>(null);

  private allowClose = false;
  private saveOp: { fingerprint: string; key: string } | null = null;

  protected readonly isReadonly = computed(() => !this.canManage());

  protected readonly driverOptions = computed<DropdownOption<ProviderDriver>[]>(() => {
    this.i18n();
    const cfg = this.config();
    const options: DropdownOption<ProviderDriver>[] = [
      { value: 'smtp', label: 'SMTP' },
      {
        value: 'platform-shared',
        label: this.transloco.translate('wsEmail.provider.platform-shared'),
      },
    ];
    if (cfg && (cfg.providerDriver === 'ses' || cfg.providerDriver === 'sendgrid')) {
      options.push({
        value: cfg.providerDriver,
        label: providerDriverLabel(cfg.providerDriver, (key) => this.transloco.translate(key)),
        disabled: true,
      });
    }
    return options;
  });

  protected readonly dirty = computed(() => {
    const cfg = this.config();
    if (!cfg || this.isReadonly()) return false;
    return this.driverDraft() !== cfg.providerDriver;
  });

  protected readonly isNextToSmtp = computed(() => {
    const cfg = this.config();
    if (!cfg || this.isReadonly()) return false;
    return this.driverDraft() === 'smtp' && cfg.providerDriver !== 'smtp';
  });

  protected readonly showResetNotice = computed(() => {
    const cfg = this.config();
    return Boolean(cfg && cfg.dkimVerified && this.dirty());
  });

  protected readonly canSubmit = computed(() => {
    if (this.isReadonly() || this.saving() || !this.dirty()) return false;
    const selected = this.driverDraft();
    return selected === 'smtp' || selected === 'platform-shared';
  });

  open(): void {
    const cfg = this.config();
    if (!cfg) return;
    this.allowClose = false;
    this.saveOp = null;
    this.driverDraft.set(cfg.providerDriver);
    this.fieldError.set(null);
    this.topError.set(null);
    this.modal().open();
  }

  close(): void {
    this.allowClose = true;
    this.modal().close();
  }

  protected onModalClosed(): void {
    if (!this.allowClose && this.saving()) {
      this.modal().open();
      return;
    }
    this.allowClose = false;
    this.saveOp = null;
  }

  protected undo(): void {
    const cfg = this.config();
    if (!cfg) return;
    this.saveOp = null;
    this.driverDraft.set(cfg.providerDriver);
    this.fieldError.set(null);
    this.topError.set(null);
  }

  protected onDriverChange(value: ProviderDriver): void {
    this.driverDraft.set(value);
    this.fieldError.set(null);
    this.topError.set(null);
  }

  protected async save(event?: Event): Promise<void> {
    event?.preventDefault();
    const cfg = this.config();
    const rev = this.revision();
    if (!cfg || !this.canSubmit()) return;

    if (this.isNextToSmtp()) {
      this.close();
      this.switchToSmtp.emit();
      return;
    }

    const patch: PatchEmailConfigRequest = { providerDriver: this.driverDraft() };
    const key = this.keyForPatch(patch);
    this.saving.set(true);
    this.fieldError.set(null);
    this.topError.set(null);

    try {
      const result = await patchEmailConfig(patch, rev ?? cfg.revision, key);
      this.saveOp = null;
      this.notify.success(this.transloco.translate('wsEmail.toast.saved'));
      this.saved.emit(result);
      this.close();
    } catch (error) {
      if (isConflictError(error)) {
        this.saveOp = null;
        this.close();
        this.conflict.emit({ status: error.status, patch });
        return;
      }

      const field = extractApiErrorField(error);
      const message = resolveEmailError(error, this.transloco);
      if (field === 'providerDriver') {
        this.fieldError.set(message);
      } else {
        this.topError.set(message);
      }
    } finally {
      this.saving.set(false);
    }
  }

  private keyForPatch(patch: PatchEmailConfigRequest): string {
    const fp = JSON.stringify(patch);
    if (this.saveOp && this.saveOp.fingerprint === fp) {
      return this.saveOp.key;
    }
    const key = newIdempotencyKey();
    this.saveOp = { fingerprint: fp, key };
    return key;
  }
}
