import { ApiError } from '../../../../../core/api/api-errors';
import { Component, computed, inject, input, output, signal, viewChild } from '@angular/core';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { provideIcons } from '@ng-icons/core';
import { tablerMail } from '@ng-icons/tabler-icons';
import { Notify } from '../../../../../core/notify/notify';
import { ConfirmDialog } from '../../../../../shared/ui/confirm-dialog/confirm-dialog';
import { Button } from '../../../../../shared/ui/button/button';
import { Field } from '../../../../../shared/ui/field/field';
import { Modal } from '../../../../../shared/ui/modal/modal';
import { newIdempotencyKey } from '../../../../../core/api/idempotency';
import { SettingsNotice } from '../../../../../shared/ui/settings-notice/settings-notice';
import { EmailApi } from '../email.api';
import {
  EmailConflictPayload,
  EmailResult,
  PatchEmailConfigRequest,
  TenantEmailConfig,
  extractApiErrorField,
  extractEmailDomain,
  isConflictError,
  isPlaceholderConfig,
  isValidBareEmail,
  isValidDomain,
  resolveEmailError,
} from '../email.model';

interface SenderBaseline {
  fromName: string;
  fromAddress: string;
  replyTo: string;
  senderDomain: string;
}

type SenderField = 'fromName' | 'fromAddress' | 'replyTo' | 'senderDomain';

@Component({
  selector: 'app-sender-modal',
  imports: [ConfirmDialog, TranslocoPipe, Button, Field, Modal, SettingsNotice],
  providers: [provideIcons({ tablerMail })],
  templateUrl: './sender-modal.html',
})
export class SenderModal {
  private static nextId = 0;
  protected readonly uid = `ws-email-sender-modal-${++SenderModal.nextId}`;

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

  private readonly baseline = signal<SenderBaseline>({
    fromName: '',
    fromAddress: '',
    replyTo: '',
    senderDomain: '',
  });

  protected readonly fromNameDraft = signal('');
  protected readonly fromAddressDraft = signal('');
  protected readonly replyToDraft = signal('');
  protected readonly senderDomainDraft = signal('');

  protected readonly saving = signal(false);
  protected readonly submitted = signal(false);
  protected readonly touched = signal<Partial<Record<SenderField, boolean>>>({});
  protected readonly serverFieldErrors = signal<Partial<Record<SenderField, string>>>({});
  protected readonly topError = signal<string | null>(null);

  private readonly opened = signal(false);
  readonly hasUnsavedDraft = computed(() => this.opened() && this.dirty());

  private allowClose = false;
  private saveOp: { bodyJson: string; key: string } | null = null;

  protected readonly isReadonly = computed(() => !this.canManage() || !this.api.gates().manage);

  protected readonly dirty = computed(() => {
    if (this.isReadonly()) return false;
    const base = this.baseline();
    return (
      this.fromNameDraft().trim() !== base.fromName ||
      this.fromAddressDraft().trim() !== base.fromAddress ||
      this.replyToDraft().trim() !== base.replyTo ||
      this.senderDomainDraft().trim().toLowerCase() !== base.senderDomain
    );
  });

  protected readonly showResetNotice = computed(() => {
    const cfg = this.config();
    if (!cfg || !cfg.dkimVerified || this.isReadonly()) return false;
    return (
      this.fromAddressDraft().trim() !== cfg.fromAddress ||
      this.senderDomainDraft().trim().toLowerCase() !== cfg.senderDomain
    );
  });

  private readonly rawFromNameError = computed(() => {
    this.i18n();
    const server = this.serverFieldErrors().fromName;
    if (server) return server;
    const value = this.fromNameDraft().trim();
    if (!value) return this.transloco.translate('wsEmail.errors.required');
    if (value.length > 200)
      return this.transloco.translate('wsEmail.errors.TENANT_EMAIL_CONFIG_INVALID');
    return null;
  });

  private readonly rawSenderDomainError = computed(() => {
    this.i18n();
    const server = this.serverFieldErrors().senderDomain;
    if (server) return server;
    const value = this.senderDomainDraft().trim().toLowerCase();
    if (!value) return this.transloco.translate('wsEmail.errors.required');
    if (!isValidDomain(value)) return this.transloco.translate('wsEmail.errors.domain');
    return null;
  });

  private readonly rawFromAddressError = computed(() => {
    this.i18n();
    const server = this.serverFieldErrors().fromAddress;
    if (server) return server;
    const value = this.fromAddressDraft().trim();
    if (!value) return this.transloco.translate('wsEmail.errors.required');
    if (!isValidBareEmail(value)) return this.transloco.translate('wsEmail.errors.address');
    const domain = this.senderDomainDraft().trim().toLowerCase();
    const addrDomain = extractEmailDomain(value);
    if (domain && isValidDomain(domain) && addrDomain !== domain) {
      return this.transloco.translate('wsEmail.errors.domainMismatch');
    }
    return null;
  });

  private readonly rawReplyToError = computed(() => {
    this.i18n();
    const server = this.serverFieldErrors().replyTo;
    if (server) return server;
    const value = this.replyToDraft().trim();
    if (value && !isValidBareEmail(value))
      return this.transloco.translate('wsEmail.errors.address');
    return null;
  });

  protected readonly fromNameError = computed(() => {
    if (this.serverFieldErrors().fromName || this.submitted() || this.touched().fromName) {
      return this.rawFromNameError();
    }
    return null;
  });

  protected readonly fromAddressError = computed(() => {
    if (this.serverFieldErrors().fromAddress || this.submitted() || this.touched().fromAddress) {
      return this.rawFromAddressError();
    }
    return null;
  });

  protected readonly replyToError = computed(() => {
    if (this.serverFieldErrors().replyTo || this.submitted() || this.touched().replyTo) {
      return this.rawReplyToError();
    }
    return null;
  });

  protected readonly senderDomainError = computed(() => {
    if (this.serverFieldErrors().senderDomain || this.submitted() || this.touched().senderDomain) {
      return this.rawSenderDomainError();
    }
    return null;
  });

  protected readonly isValid = computed(
    () =>
      !this.rawFromNameError() &&
      !this.rawFromAddressError() &&
      !this.rawReplyToError() &&
      !this.rawSenderDomainError(),
  );

  protected readonly canSubmit = computed(
    () => !this.isReadonly() && !this.saving() && this.dirty() && this.isValid(),
  );

  open(): void {
    const cfg = this.config();
    if (!cfg) return;
    this.allowClose = false;
    this.saveOp = null;

    const initial: SenderBaseline = isPlaceholderConfig(cfg)
      ? { fromName: '', fromAddress: '', replyTo: '', senderDomain: '' }
      : {
          fromName: cfg.fromName,
          fromAddress: cfg.fromAddress,
          replyTo: cfg.replyTo ?? '',
          senderDomain: cfg.senderDomain,
        };

    this.baseline.set(initial);
    this.applyBaseline(initial);
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
    this.saveOp = null;
    this.applyBaseline(this.baseline());
  }

  protected markTouched(field: SenderField): void {
    this.touched.update((prev) => (prev[field] ? prev : { ...prev, [field]: true }));
  }

  protected onDomainBlur(): void {
    const normalized = this.senderDomainDraft().trim().toLowerCase();
    this.senderDomainDraft.set(normalized);
    this.markTouched('senderDomain');
  }

  protected onInput(field: SenderField, event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    switch (field) {
      case 'fromName':
        this.fromNameDraft.set(value);
        break;
      case 'fromAddress':
        this.fromAddressDraft.set(value);
        break;
      case 'replyTo':
        this.replyToDraft.set(value);
        break;
      case 'senderDomain':
        this.senderDomainDraft.set(value);
        break;
    }
    this.topError.set(null);
    this.clearServerFieldError(field);
  }

  protected async save(event?: Event): Promise<void> {
    event?.preventDefault();
    const cfg = this.config();
    if (!cfg || this.isReadonly() || this.saving() || !this.dirty()) return;

    this.submitted.set(true);
    this.topError.set(null);
    this.serverFieldErrors.set({});

    if (!this.isValid()) return;

    const patch = this.buildPatch(cfg);
    if (Object.keys(patch).length === 0) return;

    if (
      (patch.fromAddress !== undefined || patch.senderDomain !== undefined) &&
      !(await this.suspendConfirm().open())
    )
      return;
    if (this.isReadonly()) return;
    const etag = this.etag() ?? `"${cfg.revision}"`;
    const key = this.keyForPatch(patch, etag);
    this.saving.set(true);

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
      if (
        field === 'fromName' ||
        field === 'fromAddress' ||
        field === 'replyTo' ||
        field === 'senderDomain'
      ) {
        this.serverFieldErrors.set({ [field]: message });
      } else {
        this.topError.set(message);
      }
    } finally {
      this.saving.set(false);
    }
  }

  private buildPatch(cfg: TenantEmailConfig): PatchEmailConfigRequest {
    const patch: PatchEmailConfigRequest = {};
    const fromName = this.fromNameDraft().trim();
    const fromAddress = this.fromAddressDraft().trim();
    const replyTo = this.replyToDraft().trim();
    const senderDomain = this.senderDomainDraft().trim().toLowerCase();

    if (fromName !== cfg.fromName) patch.fromName = fromName;
    if (fromAddress !== cfg.fromAddress) patch.fromAddress = fromAddress;
    if (replyTo) {
      if (replyTo !== cfg.replyTo) patch.replyTo = replyTo;
    } else if (cfg.replyTo !== null) {
      patch.replyTo = null;
    }
    if (senderDomain !== cfg.senderDomain) patch.senderDomain = senderDomain;

    return patch;
  }

  private applyBaseline(initial: SenderBaseline): void {
    this.fromNameDraft.set(initial.fromName);
    this.fromAddressDraft.set(initial.fromAddress);
    this.replyToDraft.set(initial.replyTo);
    this.senderDomainDraft.set(initial.senderDomain);
    this.submitted.set(false);
    this.touched.set({});
    this.serverFieldErrors.set({});
    this.topError.set(null);
  }

  private clearServerFieldError(field: SenderField): void {
    if (!this.serverFieldErrors()[field]) return;
    this.serverFieldErrors.update((prev) => {
      const next = { ...prev };
      delete next[field];
      return next;
    });
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
