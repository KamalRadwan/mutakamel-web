import { Component, computed, inject, output, signal, viewChild } from '@angular/core';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { provideIcons } from '@ng-icons/core';
import { tablerAlertTriangle } from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../../core/i18n/language';
import { Notify } from '../../../../../core/notify/notify';
import { Button } from '../../../../../shared/ui/button/button';
import { Modal } from '../../../../../shared/ui/modal/modal';
import { newIdempotencyKey } from '../../../../../core/api/idempotency';
import { SettingsNotice } from '../../../../../shared/ui/settings-notice/settings-notice';
import { getEmailConfig, patchEmailConfig } from '../email.api';
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
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly language = inject(LanguageState).current;
  private readonly modal = viewChild.required<Modal>('modal');

  readonly adopted = output<EmailResult>();

  protected readonly status = signal<409 | 428>(409);
  protected readonly patch = signal<PatchEmailConfigRequest | null>(null);
  protected readonly phase = signal<'initial' | 'reviewed'>('initial');
  protected readonly latestResult = signal<EmailResult | null>(null);
  protected readonly busy = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  private allowClose = false;

  protected readonly titleKey = computed(() =>
    this.status() === 428 ? 'wsEmail.conflict.title428' : 'wsEmail.conflict.title409',
  );

  protected readonly isLoadOnly = computed(
    () => this.status() === 428 || this.patch() === null,
  );

  protected readonly diffRows = computed<ConflictDiffRow[]>(() => {
    this.i18n();
    const lang = this.language();
    const patchObj = this.patch();
    const latest = this.latestResult();
    if (!patchObj || !latest || this.phase() !== 'reviewed') return [];

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
    this.status.set(payload.status);
    this.patch.set(payload.patch);
    this.phase.set('initial');
    this.latestResult.set(null);
    this.errorMessage.set(null);
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
  }

  protected async loadLatest(): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    this.errorMessage.set(null);
    try {
      const fresh = await getEmailConfig();
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
      const fresh = await getEmailConfig();
      this.latestResult.set(fresh);
      this.phase.set('reviewed');
    } catch (error) {
      this.errorMessage.set(resolveEmailError(error, this.transloco));
    } finally {
      this.busy.set(false);
    }
  }

  protected useLatestSaved(): void {
    const latest = this.latestResult();
    if (!latest || this.busy()) return;
    this.adopted.emit(latest);
    this.close();
  }

  protected async keepMyChanges(): Promise<void> {
    const latest = this.latestResult();
    const patchBody = this.patch();
    if (!latest || !patchBody || this.busy()) return;

    this.busy.set(true);
    this.errorMessage.set(null);
    try {
      const saved = await patchEmailConfig(patchBody, latest.revision, newIdempotencyKey());
      this.notify.success(this.transloco.translate('wsEmail.toast.saved'));
      this.adopted.emit(saved);
      this.close();
    } catch (error) {
      if (isConflictError(error)) {
        this.status.set(error.status);
        this.phase.set('initial');
        this.latestResult.set(null);
        this.errorMessage.set(null);
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
