import { ApiError } from '../../../../../core/api/api-errors';
import { Component, computed, inject, input, output, signal, viewChild } from '@angular/core';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { provideIcons } from '@ng-icons/core';
import { tablerServer } from '@ng-icons/tabler-icons';
import { Notify } from '../../../../../core/notify/notify';
import { ConfirmDialog } from '../../../../../shared/ui/confirm-dialog/confirm-dialog';
import { Button } from '../../../../../shared/ui/button/button';
import { Dropdown, DropdownOption } from '../../../../../shared/ui/dropdown/dropdown';
import { Field } from '../../../../../shared/ui/field/field';
import { Modal } from '../../../../../shared/ui/modal/modal';
import { newIdempotencyKey } from '../../../../../core/api/idempotency';
import { SettingsNotice } from '../../../../../shared/ui/settings-notice/settings-notice';
import { EmailApi } from '../email.api';
import {
  EmailConflictPayload,
  EmailResult,
  PatchEmailConfigRequest,
  ProviderDriver,
  TenantEmailConfig,
  extractApiErrorField,
  isConflictError,
  isManagedProvider,
  providerDriverLabel,
  resolveEmailError,
} from '../email.model';

@Component({
  selector: 'app-provider-modal',
  imports: [ConfirmDialog, TranslocoPipe, Button, Dropdown, Field, Modal, SettingsNotice],
  providers: [provideIcons({ tablerServer })],
  templateUrl: './provider-modal.html',
})
export class ProviderModal {
  private static nextId = 0;
  protected readonly uid = `ws-email-provider-modal-${++ProviderModal.nextId}`;

  private readonly notify = inject(Notify);
  private readonly api = inject(EmailApi);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly suspendConfirm = viewChild.required<ConfirmDialog>('suspendConfirm');
  private readonly discardConfirm = viewChild.required<ConfirmDialog>('discardConfirm');
  private readonly modal = viewChild.required<Modal>('modal');

  readonly config = input<TenantEmailConfig | null>(null);
  readonly etag = input<string | null>(null);
  readonly canManage = input(false);

  readonly saved = output<EmailResult>();
  readonly conflict = output<EmailConflictPayload>();
  readonly switchToSmtp = output<void>();

  protected readonly driverDraft = signal<ProviderDriver>('smtp');
  protected readonly saving = signal(false);
  protected readonly fieldError = signal<string | null>(null);
  protected readonly topError = signal<string | null>(null);

  private readonly opened = signal(false);
  readonly hasUnsavedDraft = computed(() => this.opened() && this.dirty());

  private allowClose = false;
  private saveOp: { bodyJson: string; key: string } | null = null;

  protected readonly managedProvider = computed(() => {
    const config = this.config();
    return !!config && isManagedProvider(config);
  });
  protected readonly providerName = computed(() => {
    this.i18n();
    const config = this.config();
    return config
      ? providerDriverLabel(config.providerDriver, (key) => this.transloco.translate(key))
      : '';
  });
  protected readonly isReadonly = computed(
    () => !this.canManage() || !this.api.gates().manage || this.managedProvider(),
  );

  protected readonly driverOptions = computed<DropdownOption<ProviderDriver>[]>(() => {
    this.i18n();
    const options: DropdownOption<ProviderDriver>[] = [
      {
        value: 'platform-shared',
        label: this.transloco.translate('wsEmail.provider.platform-shared'),
      },
      { value: 'smtp', label: 'SMTP' },
    ];
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
    this.opened.set(true);
    this.modal().open();
  }

  protected async requestClose(): Promise<void> {
    if (this.saving()) return;
    if (this.hasUnsavedDraft() && !(await this.discardConfirm().open())) return;
    this.close();
  }

  close(): void {
    this.opened.set(false);
    this.saveOp = null;
    this.allowClose = true;
    this.modal().close();
  }

  protected onModalClosed(): void {
    if (!this.allowClose && this.saving()) {
      this.modal().open();
      return;
    }
    this.allowClose = false;
    this.opened.set(false);
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
    if (!cfg || !this.canSubmit()) return;

    if (this.isNextToSmtp()) {
      this.close();
      this.switchToSmtp.emit();
      return;
    }

    const patch: PatchEmailConfigRequest = { providerDriver: this.driverDraft() };
    if (patch.providerDriver !== undefined && !(await this.suspendConfirm().open())) return;
    if (this.isReadonly()) return;
    const etag = this.etag() ?? `"${cfg.revision}"`;
    const key = this.keyForPatch(patch, etag);
    this.saving.set(true);
    this.fieldError.set(null);
    this.topError.set(null);

    try {
      const result = await this.api.patchEmailConfig(patch, etag, key);
      this.saveOp = null;
      this.notify.success(this.transloco.translate('wsEmail.toast.saved'));
      this.saved.emit(result);
      this.close();
    } catch (error) {
      if (error instanceof ApiError && error.status === 428) {
        this.notify.error(resolveEmailError(error, this.transloco));
        return;
      }
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

  private keyForPatch(patch: PatchEmailConfigRequest, etag: string): string {
    const bodyJson = JSON.stringify([patch, etag]);
    if (this.saveOp && this.saveOp.bodyJson === bodyJson) {
      return this.saveOp.key;
    }
    const key = newIdempotencyKey();
    this.saveOp = { bodyJson, key };
    return key;
  }
}
