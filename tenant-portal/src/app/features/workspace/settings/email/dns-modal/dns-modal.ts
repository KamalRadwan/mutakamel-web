import { ApiError } from '../../../../../core/api/api-errors';
import { DOCUMENT } from '@angular/common';
import { Component, computed, inject, input, output, signal, viewChild } from '@angular/core';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerCopy, tablerShieldCheck } from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../../core/i18n/language';
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
  formatEmailDate,
  isConflictError,
  isValidDkimSelector,
  resolveEmailError,
} from '../email.model';

@Component({
  selector: 'app-dns-modal',
  imports: [ConfirmDialog, NgIcon, TranslocoPipe, Button, Field, Modal, SettingsNotice],
  providers: [provideIcons({ tablerShieldCheck, tablerCopy })],
  templateUrl: './dns-modal.html',
})
export class DnsModal {
  private static nextId = 0;
  protected readonly uid = `ws-email-dns-modal-${++DnsModal.nextId}`;

  private readonly document = inject(DOCUMENT);
  private readonly notify = inject(Notify);
  private readonly api = inject(EmailApi);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  protected readonly language = inject(LanguageState).current;
  private readonly turnOnConfirm = viewChild.required<ConfirmDialog>('turnOnConfirm');
  private readonly suspendConfirm = viewChild.required<ConfirmDialog>('suspendConfirm');
  private readonly discardConfirm = viewChild.required<ConfirmDialog>('discardConfirm');
  private readonly modal = viewChild.required<Modal>('modal');

  readonly config = input<TenantEmailConfig | null>(null);
  readonly etag = input<string | null>(null);
  readonly canManage = input(false);

  readonly saved = output<EmailResult>();
  readonly conflict = output<EmailConflictPayload>();

  private readonly localResult = signal<EmailResult | null>(null);

  protected readonly selectorDraft = signal('');
  protected readonly saving = signal(false);
  protected readonly verifying = signal(false);
  protected readonly submitted = signal(false);
  protected readonly selectorTouched = signal(false);
  protected readonly serverSelectorError = signal<string | null>(null);
  protected readonly topError = signal<string | null>(null);

  private readonly opened = signal(false);
  readonly hasUnsavedDraft = computed(() => this.opened() && this.dirty());

  private allowClose = false;
  private saveOp: { bodyJson: string; key: string } | null = null;
  private verifyOp: { etag: string; key: string } | null = null;

  protected readonly isReadonly = computed(() => !this.canManage() || !this.api.gates().manage);
  protected readonly busy = computed(() => this.saving() || this.verifying());

  protected readonly effectiveConfig = computed(() => this.localResult()?.config ?? this.config());

  protected readonly effectiveEtag = computed(
    () => this.localResult()?.etag ?? this.etag() ?? `"${this.effectiveConfig()?.revision ?? 1}"`,
  );

  protected readonly dirty = computed(() => {
    const cfg = this.effectiveConfig();
    if (!cfg || this.isReadonly()) return false;
    const next = this.selectorDraft().trim().toLowerCase();
    const current = cfg.dkimSelector ?? '';
    return next !== current;
  });

  protected readonly showResetNotice = computed(() => {
    const cfg = this.effectiveConfig();
    return Boolean(cfg && cfg.dkimVerified && this.dirty());
  });

  protected readonly dkimRecordName = computed(() => {
    const cfg = this.effectiveConfig();
    const selector = this.selectorDraft().trim().toLowerCase();
    if (!cfg || !selector) return null;
    return `${selector}._domainkey.${cfg.senderDomain}`;
  });

  protected readonly verifiedDateText = computed(() => {
    const cfg = this.effectiveConfig();
    if (!cfg?.verifiedAt) return '';
    return formatEmailDate(cfg.verifiedAt, this.language());
  });

  private readonly rawSelectorError = computed(() => {
    this.i18n();
    const server = this.serverSelectorError();
    if (server) return server;
    const value = this.selectorDraft().trim().toLowerCase();
    if (value && !isValidDkimSelector(value)) {
      return this.transloco.translate('wsEmail.errors.selector');
    }
    return null;
  });

  protected readonly selectorError = computed(() =>
    this.serverSelectorError() || this.submitted() || this.selectorTouched()
      ? this.rawSelectorError()
      : null,
  );

  protected readonly canSaveSelector = computed(
    () => !this.isReadonly() && !this.busy() && this.dirty() && !this.rawSelectorError(),
  );

  open(): void {
    this.allowClose = false;
    this.localResult.set(null);
    this.saveOp = null;
    this.verifyOp = null;
    const cfg = this.config();
    if (!cfg) return;
    this.applyConfig(cfg);
    this.opened.set(true);
    this.modal().open();
  }

  protected async requestClose(): Promise<void> {
    if (this.busy()) return;
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
    if (!this.allowClose && this.busy()) {
      this.modal().open();
      return;
    }
    this.allowClose = false;
    this.opened.set(false);
    this.localResult.set(null);
    this.saveOp = null;
    this.verifyOp = null;
  }

  protected undo(): void {
    const cfg = this.effectiveConfig();
    if (!cfg) return;
    this.saveOp = null;
    this.applyConfig(cfg);
  }

  protected onSelectorInput(event: Event): void {
    this.selectorDraft.set((event.target as HTMLInputElement).value);
    this.serverSelectorError.set(null);
    this.topError.set(null);
  }

  protected onSelectorBlur(): void {
    this.selectorDraft.update((value) => value.trim().toLowerCase());
    this.selectorTouched.set(true);
  }

  protected async copyRecordName(): Promise<void> {
    const value = this.dkimRecordName();
    if (!value) return;
    const clipboard = this.document.defaultView?.navigator?.clipboard;
    if (!clipboard?.writeText) return;
    try {
      await clipboard.writeText(value);
      this.notify.success(this.transloco.translate('wsEmail.toast.copied'));
    } catch {
      this.notify.error(this.transloco.translate('settings.errors.generic'));
    }
  }

  protected async saveSelector(event?: Event): Promise<void> {
    event?.preventDefault();
    const cfg = this.effectiveConfig();
    if (!cfg || this.isReadonly() || this.busy() || !this.dirty()) return;

    this.submitted.set(true);
    this.serverSelectorError.set(null);
    this.topError.set(null);

    const normalized = this.selectorDraft().trim().toLowerCase();
    this.selectorDraft.set(normalized);
    if (this.rawSelectorError()) return;

    const patch: PatchEmailConfigRequest = {
      dkimSelector: normalized ? normalized : null,
    };
    if (patch.dkimSelector !== undefined && !(await this.suspendConfirm().open())) return;
    if (this.isReadonly()) return;
    const etag = this.effectiveEtag();
    const key = this.keyForPatch(patch, etag);
    this.saving.set(true);

    try {
      const result = await this.api.patchEmailConfig(patch, etag, key);
      this.saveOp = null;
      this.verifyOp = null;
      this.localResult.set(result);
      this.applyConfig(result.config);
      this.saved.emit(result);
      this.notify.success(this.transloco.translate('wsEmail.toast.saved'));
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
      if (field === 'dkimSelector') {
        this.serverSelectorError.set(message);
      } else {
        this.topError.set(message);
      }
    } finally {
      this.saving.set(false);
    }
  }

  protected async verify(): Promise<void> {
    const cfg = this.effectiveConfig();
    if (!cfg || this.isReadonly() || this.busy() || this.dirty()) return;

    this.topError.set(null);
    const etag = this.effectiveEtag();
    if (this.verifyOp?.etag !== etag) this.verifyOp = { etag, key: newIdempotencyKey() };
    const key = this.verifyOp.key;
    this.verifying.set(true);

    try {
      const result = await this.api.verifyEmailDomain(etag, key);
      this.verifyOp = null;
      this.localResult.set(result);
      this.applyConfig(result.config);
      this.saved.emit(result);
      this.notify.success(this.transloco.translate('wsEmail.toast.verified'));
      if (
        result.config.dkimVerified &&
        result.config.status !== 'ACTIVE' &&
        (await this.turnOnConfirm().open())
      ) {
        if (!this.isReadonly()) {
          await this.turnOn(result);
        }
      }
    } catch (error) {
      if (error instanceof ApiError && error.status === 428) {
        this.notify.error(resolveEmailError(error, this.transloco));
        return;
      }
      if (isConflictError(error)) {
        this.verifyOp = null;
        this.close();
        this.conflict.emit({ status: error.status, patch: null });
        return;
      }
      this.topError.set(resolveEmailError(error, this.transloco));
    } finally {
      this.verifying.set(false);
    }
  }

  private async turnOn(result: EmailResult): Promise<void> {
    const patch: PatchEmailConfigRequest = { status: 'ACTIVE' };
    try {
      const updated = await this.api.patchEmailConfig(
        patch,
        result.etag,
        this.keyForPatch(patch, result.etag),
      );
      this.saveOp = null;
      this.localResult.set(updated);
      this.saved.emit(updated);
    } catch (error) {
      if (isConflictError(error)) {
        this.close();
        this.conflict.emit({ status: error.status, patch });
      } else if (error instanceof ApiError && error.status === 428) {
        this.notify.error(resolveEmailError(error, this.transloco));
      } else {
        this.topError.set(resolveEmailError(error, this.transloco));
      }
    }
  }

  private applyConfig(cfg: TenantEmailConfig): void {
    this.selectorDraft.set(cfg.dkimSelector ?? '');
    this.submitted.set(false);
    this.selectorTouched.set(false);
    this.serverSelectorError.set(null);
    this.topError.set(null);
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
