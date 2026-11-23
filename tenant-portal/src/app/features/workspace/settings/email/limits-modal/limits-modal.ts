import { ApiError } from '../../../../../core/api/api-errors';
import { Component, computed, inject, input, output, signal, viewChild } from '@angular/core';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { provideIcons } from '@ng-icons/core';
import { tablerGauge } from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../../core/i18n/language';
import { Notify } from '../../../../../core/notify/notify';
import { ConfirmDialog } from '../../../../../shared/ui/confirm-dialog/confirm-dialog';
import { Button } from '../../../../../shared/ui/button/button';
import { Field } from '../../../../../shared/ui/field/field';
import { Modal } from '../../../../../shared/ui/modal/modal';
import { Switch } from '../../../../../shared/ui/switch/switch';
import { newIdempotencyKey } from '../../../../../core/api/idempotency';
import { SettingsNotice } from '../../../../../shared/ui/settings-notice/settings-notice';
import { EmailApi } from '../email.api';
import {
  EMAIL_QUOTA_MAX,
  EmailConflictPayload,
  EmailResult,
  PatchEmailConfigRequest,
  TenantEmailConfig,
  extractApiErrorField,
  formatEmailNumber,
  isConflictError,
  resolveEmailError,
} from '../email.model';

type LimitField = 'dailyQuota' | 'rateLimitPerMin';

@Component({
  selector: 'app-limits-modal',
  imports: [ConfirmDialog, TranslocoPipe, Button, Field, Modal, SettingsNotice, Switch],
  providers: [provideIcons({ tablerGauge })],
  templateUrl: './limits-modal.html',
})
export class LimitsModal {
  private static nextId = 0;
  protected readonly uid = `ws-email-limits-modal-${++LimitsModal.nextId}`;

  private readonly notify = inject(Notify);
  private readonly api = inject(EmailApi);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  protected readonly language = inject(LanguageState).current;
  private readonly discardConfirm = viewChild.required<ConfirmDialog>('discardConfirm');
  private readonly modal = viewChild.required<Modal>('modal');

  readonly config = input<TenantEmailConfig | null>(null);
  readonly etag = input<string | null>(null);
  readonly canManage = input(false);

  readonly saved = output<EmailResult>();
  readonly conflict = output<EmailConflictPayload>();

  protected readonly dailyUsePlan = signal(true);
  protected readonly dailyText = signal('');
  protected readonly dailyBadInput = signal(false);

  protected readonly perMinuteUsePlan = signal(true);
  protected readonly perMinuteText = signal('');
  protected readonly perMinuteBadInput = signal(false);

  protected readonly saving = signal(false);
  protected readonly submitted = signal(false);
  protected readonly touched = signal<Partial<Record<LimitField, boolean>>>({});
  protected readonly serverFieldErrors = signal<Partial<Record<LimitField, string>>>({});
  protected readonly topError = signal<string | null>(null);

  private readonly opened = signal(false);
  readonly hasUnsavedDraft = computed(() => this.opened() && this.dirty());

  private allowClose = false;
  private saveOp: { bodyJson: string; key: string } | null = null;

  protected readonly isReadonly = computed(() => !this.canManage() || !this.api.gates().manage);

  protected readonly dailyCap = computed(() => {
    const cfg = this.config();
    return cfg ? Math.min(cfg.planDailyQuota, EMAIL_QUOTA_MAX.daily) : EMAIL_QUOTA_MAX.daily;
  });

  protected readonly perMinuteCap = computed(() => {
    const cfg = this.config();
    return cfg
      ? Math.min(cfg.planRateLimitPerMin, EMAIL_QUOTA_MAX.perMinute)
      : EMAIL_QUOTA_MAX.perMinute;
  });

  protected readonly dailyCapPlaceholder = computed(() => String(this.dailyCap()));
  protected readonly perMinuteCapPlaceholder = computed(() => String(this.perMinuteCap()));

  protected readonly planSummaryParams = computed(() => {
    const cfg = this.config();
    const lang = this.language();
    return {
      daily: formatEmailNumber(cfg?.planDailyQuota ?? 0, lang),
      perMinute: formatEmailNumber(cfg?.planRateLimitPerMin ?? 0, lang),
    };
  });

  private readonly parsedDaily = computed<number | null>(() => {
    if (this.dailyUsePlan()) return null;
    if (this.dailyBadInput()) return Number.NaN;
    const raw = this.dailyText().trim();
    if (!raw || !/^\d+$/.test(raw)) return Number.NaN;
    return Number(raw);
  });

  private readonly parsedPerMinute = computed<number | null>(() => {
    if (this.perMinuteUsePlan()) return null;
    if (this.perMinuteBadInput()) return Number.NaN;
    const raw = this.perMinuteText().trim();
    if (!raw || !/^\d+$/.test(raw)) return Number.NaN;
    return Number(raw);
  });

  private readonly rawDailyError = computed(() => {
    this.i18n();
    const server = this.serverFieldErrors().dailyQuota;
    if (server) return server;
    if (this.dailyUsePlan()) return null;
    const cap = this.dailyCap();
    const parsed = this.parsedDaily();
    if (parsed === null || !Number.isInteger(parsed) || parsed < 1 || parsed > cap) {
      return this.transloco.translate('wsEmail.errors.limitRange', {
        max: formatEmailNumber(cap, this.language()),
      });
    }
    return null;
  });

  private readonly rawPerMinuteError = computed(() => {
    this.i18n();
    const server = this.serverFieldErrors().rateLimitPerMin;
    if (server) return server;
    if (this.perMinuteUsePlan()) return null;
    const cap = this.perMinuteCap();
    const parsed = this.parsedPerMinute();
    if (parsed === null || !Number.isInteger(parsed) || parsed < 1 || parsed > cap) {
      return this.transloco.translate('wsEmail.errors.limitRange', {
        max: formatEmailNumber(cap, this.language()),
      });
    }
    return null;
  });

  protected readonly dailyError = computed(() =>
    this.serverFieldErrors().dailyQuota || this.submitted() || this.touched().dailyQuota
      ? this.rawDailyError()
      : null,
  );

  protected readonly perMinuteError = computed(() =>
    this.serverFieldErrors().rateLimitPerMin || this.submitted() || this.touched().rateLimitPerMin
      ? this.rawPerMinuteError()
      : null,
  );

  protected readonly dirty = computed(() => {
    const cfg = this.config();
    if (!cfg || this.isReadonly()) return false;
    const dailyVal = this.parsedDaily();
    const perMinVal = this.parsedPerMinute();
    const dailyChanged = Number.isNaN(dailyVal) ? true : dailyVal !== cfg.dailyQuota;
    const perMinChanged = Number.isNaN(perMinVal) ? true : perMinVal !== cfg.rateLimitPerMin;
    return dailyChanged || perMinChanged;
  });

  protected readonly isValid = computed(() => !this.rawDailyError() && !this.rawPerMinuteError());

  protected readonly canSubmit = computed(
    () => !this.isReadonly() && !this.saving() && this.dirty() && this.isValid(),
  );

  open(): void {
    const cfg = this.config();
    if (!cfg) return;
    this.allowClose = false;
    this.saveOp = null;
    this.applyFromConfig(cfg);
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
    this.applyFromConfig(cfg);
  }

  protected markTouched(field: LimitField): void {
    this.touched.update((prev) => (prev[field] ? prev : { ...prev, [field]: true }));
  }

  protected onDailyUsePlanChange(usePlan: boolean): void {
    this.dailyUsePlan.set(usePlan);
    this.dailyBadInput.set(false);
    if (!usePlan && !this.dailyText().trim()) {
      this.dailyText.set(String(this.dailyCap()));
    }
    this.topError.set(null);
    this.clearServerFieldError('dailyQuota');
  }

  protected onPerMinuteUsePlanChange(usePlan: boolean): void {
    this.perMinuteUsePlan.set(usePlan);
    this.perMinuteBadInput.set(false);
    if (!usePlan && !this.perMinuteText().trim()) {
      this.perMinuteText.set(String(this.perMinuteCap()));
    }
    this.topError.set(null);
    this.clearServerFieldError('rateLimitPerMin');
  }

  protected onDailyInput(event: Event): void {
    const inputEl = event.target as HTMLInputElement;
    this.dailyBadInput.set(Boolean(inputEl.validity.badInput));
    this.dailyText.set(inputEl.value);
    this.topError.set(null);
    this.clearServerFieldError('dailyQuota');
  }

  protected onPerMinuteInput(event: Event): void {
    const inputEl = event.target as HTMLInputElement;
    this.perMinuteBadInput.set(Boolean(inputEl.validity.badInput));
    this.perMinuteText.set(inputEl.value);
    this.topError.set(null);
    this.clearServerFieldError('rateLimitPerMin');
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
      if (field === 'dailyQuota' || field === 'rateLimitPerMin') {
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
    const nextDaily = this.parsedDaily();
    const nextPerMinute = this.parsedPerMinute();

    if (nextDaily !== null && !Number.isNaN(nextDaily) && nextDaily !== cfg.dailyQuota) {
      patch.dailyQuota = nextDaily;
    } else if (nextDaily === null && cfg.dailyQuota !== null) {
      patch.dailyQuota = null;
    }

    if (
      nextPerMinute !== null &&
      !Number.isNaN(nextPerMinute) &&
      nextPerMinute !== cfg.rateLimitPerMin
    ) {
      patch.rateLimitPerMin = nextPerMinute;
    } else if (nextPerMinute === null && cfg.rateLimitPerMin !== null) {
      patch.rateLimitPerMin = null;
    }

    return patch;
  }

  private applyFromConfig(cfg: TenantEmailConfig): void {
    this.dailyUsePlan.set(cfg.dailyQuota === null);
    this.dailyText.set(cfg.dailyQuota !== null ? String(cfg.dailyQuota) : '');
    this.dailyBadInput.set(false);

    this.perMinuteUsePlan.set(cfg.rateLimitPerMin === null);
    this.perMinuteText.set(cfg.rateLimitPerMin !== null ? String(cfg.rateLimitPerMin) : '');
    this.perMinuteBadInput.set(false);

    this.submitted.set(false);
    this.touched.set({});
    this.serverFieldErrors.set({});
    this.topError.set(null);
  }

  private clearServerFieldError(field: LimitField): void {
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
