import { DOCUMENT } from '@angular/common';
import { Component, computed, inject, input, output, signal, viewChild } from '@angular/core';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerCopy, tablerShieldCheck } from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../../core/i18n/language';
import { Notify } from '../../../../../core/notify/notify';
import { Button } from '../../../../../shared/ui/button/button';
import { Field } from '../../../../../shared/ui/field/field';
import { Modal } from '../../../../../shared/ui/modal/modal';
import { newIdempotencyKey } from '../../../../../core/api/idempotency';
import { SettingsNotice } from '../../../../../shared/ui/settings-notice/settings-notice';
import { patchEmailConfig, verifyEmailDomain } from '../email.api';
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
  imports: [NgIcon, TranslocoPipe, Button, Field, Modal, SettingsNotice],
  providers: [provideIcons({ tablerShieldCheck, tablerCopy })],
  templateUrl: './dns-modal.html',
})
export class DnsModal {
  private static nextId = 0;
  protected readonly uid = `ws-email-dns-modal-${++DnsModal.nextId}`;

  private readonly document = inject(DOCUMENT);
  private readonly notify = inject(Notify);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  protected readonly language = inject(LanguageState).current;
  private readonly modal = viewChild.required<Modal>('modal');

  readonly config = input<TenantEmailConfig | null>(null);
  readonly revision = input<number | null>(null);
  readonly canManage = input(true);

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

  private allowClose = false;
  private saveOp: { fingerprint: string; key: string } | null = null;
  private verifyKey: string | null = null;

  protected readonly isReadonly = computed(() => !this.canManage());
  protected readonly busy = computed(() => this.saving() || this.verifying());

  protected readonly effectiveConfig = computed(
    () => this.localResult()?.config ?? this.config(),
  );

  protected readonly effectiveRevision = computed(
    () => this.localResult()?.revision ?? this.revision() ?? this.effectiveConfig()?.revision ?? 1,
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
    this.verifyKey = null;
    const cfg = this.config();
    if (!cfg) return;
    this.applyConfig(cfg);
    this.modal().open();
  }

  close(): void {
    this.allowClose = true;
    this.modal().close();
  }

  protected onModalClosed(): void {
    if (!this.allowClose && this.busy()) {
      this.modal().open();
      return;
    }
    this.allowClose = false;
    this.localResult.set(null);
    this.saveOp = null;
    this.verifyKey = null;
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
    const key = this.keyForPatch(patch);
    this.saving.set(true);

    try {
      const result = await patchEmailConfig(patch, this.effectiveRevision(), key);
      this.saveOp = null;
      this.verifyKey = null;
      this.localResult.set(result);
      this.applyConfig(result.config);
      this.saved.emit(result);
      this.notify.success(this.transloco.translate('wsEmail.toast.saved'));
    } catch (error) {
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
    const key = (this.verifyKey ??= newIdempotencyKey());
    this.verifying.set(true);

    try {
      const result = await verifyEmailDomain(this.effectiveRevision(), key);
      this.verifyKey = null;
      this.localResult.set(result);
      this.applyConfig(result.config);
      this.saved.emit(result);
      this.notify.success(this.transloco.translate('wsEmail.toast.verified'));
    } catch (error) {
      if (isConflictError(error)) {
        this.verifyKey = null;
        this.close();
        this.conflict.emit({ status: error.status, patch: null });
        return;
      }
      this.topError.set(resolveEmailError(error, this.transloco));
    } finally {
      this.verifying.set(false);
    }
  }

  private applyConfig(cfg: TenantEmailConfig): void {
    this.selectorDraft.set(cfg.dkimSelector ?? '');
    this.submitted.set(false);
    this.selectorTouched.set(false);
    this.serverSelectorError.set(null);
    this.topError.set(null);
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
