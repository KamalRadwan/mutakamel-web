import { Component, computed, inject, input, output, signal, viewChild } from '@angular/core';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { provideIcons } from '@ng-icons/core';
import { tablerAlertTriangle } from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../../core/i18n/language';
import { Notify } from '../../../../../core/notify/notify';
import { Button } from '../../../../../shared/ui/button/button';
import { Modal } from '../../../../../shared/ui/modal/modal';
import { newIdempotencyKey } from '../../../../../core/api/idempotency';
import { ApiError } from '../../../../../core/api/api-errors';
import { SettingsNotice } from '../../../../../shared/ui/settings-notice/settings-notice';
import { EmailApi } from '../email.api';
import {
  EmailConflictPayload,
  EmailResult,
  PatchEmailConfigRequest,
  TenantEmailConfig,
  formatEmailNumber,
  isConflictError,
  providerDriverLabel,
  resolveEmailError,
} from '../email.model';

export interface ConflictDiffRow {
  key: keyof PatchEmailConfigRequest;
  label: string;
  mineText: string;
  mineLtr: boolean;
  latestText: string;
  latestLtr: boolean;
}

const PATCH_FIELD_ORDER: readonly (keyof PatchEmailConfigRequest)[] = [
  'fromName',
  'fromAddress',
  'replyTo',
  'senderDomain',
  'providerDriver',
  'smtpHost',
  'smtpPort',
  'smtpUsername',
  'smtpProtocol',
  'smtpPassword',
  'smtpSecure',
  'dkimSelector',
  'dailyQuota',
  'rateLimitPerMin',
  'status',
];

@Component({
  selector: 'app-conflict-dialog',
  imports: [TranslocoPipe, Button, Modal, SettingsNotice],
  providers: [provideIcons({ tablerAlertTriangle })],
  templateUrl: './conflict-dialog.html',
})
export class ConflictDialog {
  private readonly notify = inject(Notify);
  private readonly api = inject(EmailApi);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly language = inject(LanguageState).current;
  private readonly modal = viewChild.required<Modal>('modal');

  readonly canManage = input(false);
  readonly verified = output<EmailResult>();
  readonly hasUnsavedDraft = computed(() => this.opened() && !!this.patch());
  private readonly opened = signal(false);
  private saveOp: { bodyJson: string; key: string } | null = null;

  readonly adopted = output<EmailResult>();

  protected readonly patch = signal<PatchEmailConfigRequest | null>(null);
  protected readonly latestResult = signal<EmailResult | null>(null);
  protected readonly busy = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  private allowClose = false;

  protected readonly titleKey = () => 'wsEmail.conflict.title409';

  protected readonly diffRows = computed<ConflictDiffRow[]>(() => {
    this.i18n();
    const lang = this.language();
    const patchObj = this.patch();
    const latest = this.latestResult();
    if (!patchObj || !latest) return [];

    const cfg = latest.config;
    const rows: ConflictDiffRow[] = [];

    for (const key of PATCH_FIELD_ORDER) {
      const mineRaw = patchObj[key];
      if (mineRaw === undefined) continue;

      if (key === 'smtpPassword') {
        rows.push({
          key,
          label: this.transloco.translate('wsEmail.fields.smtpPassword.label'),
          mineText: this.transloco.translate('wsEmail.conflict.password'),
          mineLtr: false,
          latestText: cfg.smtpPasswordConfigured
            ? this.transloco.translate('wsEmail.provider.configured')
            : this.transloco.translate('wsEmail.conflict.blank'),
          latestLtr: false,
        });
        continue;
      }

      const latestRaw = cfg[key as keyof TenantEmailConfig];
      if (mineRaw === latestRaw) continue;

      const mineFormatted = this.formatFieldValue(key, mineRaw, lang);
      const latestFormatted = this.formatFieldValue(key, latestRaw, lang);

      rows.push({
        key,
        label: this.fieldLabel(key),
        mineText: mineFormatted.text,
        mineLtr: mineFormatted.ltr,
        latestText: latestFormatted.text,
        latestLtr: latestFormatted.ltr,
      });
    }

    return rows;
  });

  open(payload: EmailConflictPayload): void {
    this.allowClose = false;
    this.opened.set(true);
    this.saveOp = null;
    this.patch.set(payload.patch);
    this.latestResult.set(null);
    this.errorMessage.set(null);
    this.modal().open();
    void this.reviewLatest();
  }

  close(): void {
    this.opened.set(false);
    this.patch.set(null);
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
    this.patch.set(null);
    this.saveOp = null;
  }

  protected async loadLatest(): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    this.errorMessage.set(null);
    try {
      const fresh = await this.api.getEmailConfig();
      this.adopted.emit(fresh);
      this.close();
    } catch (error) {
      this.errorMessage.set(resolveEmailError(error, this.transloco));
    } finally {
      this.busy.set(false);
    }
  }

  protected async reviewLatest(): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    this.errorMessage.set(null);
    try {
      const fresh = await this.api.getEmailConfig();
      if (!this.opened()) return;
      this.latestResult.set(fresh);
    } catch (error) {
      this.errorMessage.set(resolveEmailError(error, this.transloco));
    } finally {
      this.busy.set(false);
    }
  }

  protected async keepMyChanges(): Promise<void> {
    const patchBody = this.patch();
    if (!this.canManage() || !this.api.gates().manage || this.busy()) return;

    this.busy.set(true);
    this.errorMessage.set(null);
    try {
      const latest = await this.api.getEmailConfig();
      const bodyJson = JSON.stringify([patchBody, latest.etag]);
      if (this.saveOp?.bodyJson !== bodyJson) this.saveOp = { bodyJson, key: newIdempotencyKey() };
      const saved = patchBody
        ? await this.api.patchEmailConfig(patchBody, latest.etag, this.saveOp.key)
        : await this.api.verifyEmailDomain(latest.etag, this.saveOp.key);
      this.notify.success(this.transloco.translate('wsEmail.toast.saved'));
      this.adopted.emit(saved);
      this.close();
      if (!patchBody) this.verified.emit(saved);
    } catch (error) {
      if (isConflictError(error)) {
        this.latestResult.set(null);
        this.errorMessage.set(null);
        return;
      }
      if (error instanceof ApiError && error.status === 428) {
        this.notify.error(resolveEmailError(error, this.transloco));
        return;
      }
      this.errorMessage.set(resolveEmailError(error, this.transloco));
    } finally {
      this.busy.set(false);
    }
  }

  private fieldLabel(key: keyof PatchEmailConfigRequest): string {
    if (key === 'status') {
      return this.transloco.translate('wsEmail.delivery.title');
    }
    return this.transloco.translate(`wsEmail.fields.${key}.label`);
  }

  private formatFieldValue(
    key: keyof PatchEmailConfigRequest,
    value: unknown,
    lang: string,
  ): { text: string; ltr: boolean } {
    if (value === null || value === undefined || value === '') {
      return { text: this.transloco.translate('wsEmail.conflict.blank'), ltr: false };
    }

    switch (key) {
      case 'providerDriver':
        return {
          text: providerDriverLabel(value as TenantEmailConfig['providerDriver'], (k) =>
            this.transloco.translate(k),
          ),
          ltr: false,
        };
      case 'smtpProtocol':
        return { text: String(value).toUpperCase(), ltr: true };
      case 'smtpSecure':
        return {
          text: this.transloco.translate(value ? 'settings.common.yes' : 'settings.common.no'),
          ltr: false,
        };
      case 'status':
        return {
          text: this.transloco.translate(
            value === 'ACTIVE' ? 'settings.common.active' : 'wsEmail.status.SUSPENDED',
          ),
          ltr: false,
        };
      case 'smtpPort':
      case 'dailyQuota':
      case 'rateLimitPerMin':
        return { text: formatEmailNumber(Number(value), lang), ltr: true };
      case 'fromName':
        return { text: String(value), ltr: false };
      default:
        return { text: String(value), ltr: true };
    }
  }
}
