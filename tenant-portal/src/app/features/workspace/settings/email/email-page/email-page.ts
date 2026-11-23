import {
  Component,
  computed,
  effect,
  inject,
  resource,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerBan,
  tablerClock,
  tablerCloudOff,
  tablerGauge,
  tablerLock,
  tablerMail,
  tablerRefresh,
  tablerSend,
  tablerServer,
  tablerShieldCheck,
} from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../../core/i18n/language';
import { Notify } from '../../../../../core/notify/notify';
import { Button } from '../../../../../shared/ui/button/button';
import { Field } from '../../../../../shared/ui/field/field';
import { Switch } from '../../../../../shared/ui/switch/switch';
import { ApiError, errorCodeOf } from '../../../../../core/api/api-errors';
import { newIdempotencyKey } from '../../../../../core/api/idempotency';
import { ConflictDialog } from '../conflict-dialog/conflict-dialog';
import { DnsModal } from '../dns-modal/dns-modal';
import { EmailApi } from '../email.api';
import { ConfirmDialog } from '../../../../../shared/ui/confirm-dialog/confirm-dialog';
import {
  EmailConflictPayload,
  EmailResult,
  EmailStatus,
  TenantEmailConfig,
  formatEmailDate,
  formatEmailNumber,
  isConflictError,
  isPlaceholderConfig,
  isManagedProvider,
  providerDriverLabel,
  resolveEmailError,
} from '../email.model';
import { LimitsModal } from '../limits-modal/limits-modal';
import { ProviderModal } from '../provider-modal/provider-modal';
import { SenderModal } from '../sender-modal/sender-modal';
import { SmtpModal } from '../smtp-modal/smtp-modal';
import { SuppressionBlock } from '../suppression-block/suppression-block';

const SKELETON_ROWS = [0, 1, 2, 3, 4] as const;

type FullState = 'forbidden' | 'notEntitled' | 'notReady' | 'blocked' | 'failed' | null;

@Component({
  selector: 'app-email-page',
  imports: [
    NgIcon,
    TranslocoPipe,
    Button,
    Field,
    Switch,
    SenderModal,
    ProviderModal,
    SmtpModal,
    LimitsModal,
    DnsModal,
    ConflictDialog,
    SuppressionBlock,
    ConfirmDialog,
  ],
  providers: [
    provideTranslocoScope('settings', { scope: 'ws-email', alias: 'wsEmail' }),
    provideIcons({
      tablerMail,
      tablerServer,
      tablerShieldCheck,
      tablerSend,
      tablerGauge,
      tablerLock,
      tablerRefresh,
      tablerCloudOff,
      tablerClock,
      tablerBan,
    }),
  ],
  templateUrl: './email-page.html',
  host: { class: 'flex min-h-0 flex-1 flex-col gap-8 p-12' },
})
export class EmailPage {
  private readonly api = inject(EmailApi);
  private readonly notify = inject(Notify);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly language = inject(LanguageState).current;

  private readonly senderModal = viewChild.required(SenderModal);
  private readonly providerModal = viewChild.required(ProviderModal);
  private readonly smtpModal = viewChild.required(SmtpModal);
  private readonly limitsModal = viewChild.required(LimitsModal);
  private readonly dnsModal = viewChild.required(DnsModal);
  private readonly conflictDialog = viewChild.required(ConflictDialog);

  protected get canRead() {
    return this.api.gates().readable;
  }
  protected get canManage() {
    return this.api.gates().manage;
  }
  protected get entitled() {
    return this.api.gates().entitled;
  }
  protected get canLookup() {
    return this.api.gates().lookup;
  }
  protected readonly managedProvider = isManagedProvider;
  private readonly turnOnConfirm = viewChild.required<ConfirmDialog>('turnOnConfirm');
  protected readonly testing = signal(false);
  private verifyOp: { etag: string; key: string } | null = null;
  private statusOp: { bodyJson: string; key: string } | null = null;
  private testKey: string | null = null;
  protected readonly hasDrafts = computed(
    () =>
      this.senderModal().hasUnsavedDraft() ||
      this.providerModal().hasUnsavedDraft() ||
      this.smtpModal().hasUnsavedDraft() ||
      this.limitsModal().hasUnsavedDraft() ||
      this.dnsModal().hasUnsavedDraft() ||
      this.conflictDialog().hasUnsavedDraft(),
  );
  protected readonly skeletonRows = SKELETON_ROWS;

  private readonly loaded = resource({
    params: () => (this.canRead && this.entitled ? this.api.me()?.id : undefined),
    loader: () => this.api.getEmailConfig(),
  });
  private readonly localResult = signal<EmailResult | null>(null);
  /** Last good result, kept so a failed reload does not wipe the page. */
  private readonly lastGood = signal<EmailResult | null>(null);

  protected readonly verifyingDomain = signal(false);
  protected readonly togglingStatus = signal(false);

  protected readonly result = computed<EmailResult | null>(
    () => this.localResult() ?? (this.loaded.hasValue() ? this.loaded.value() : this.lastGood()),
  );
  protected readonly config = computed<TenantEmailConfig | null>(
    () => this.result()?.config ?? null,
  );
  protected readonly etag = computed<string | null>(() => this.result()?.etag ?? null);
  protected readonly loading = this.loaded.isLoading;

  protected readonly fullState = computed<FullState>(() => {
    if (!this.canRead) return 'forbidden';
    if (!this.entitled) return 'notEntitled';
    const err = this.loaded.error();
    const code = errorCodeOf(err);
    if (code === 'ACCESS_POLICY_BLOCKED') return 'blocked';
    if (err instanceof ApiError && err.status === 403) return 'forbidden';
    if (this.config() || this.loading()) return null;
    if (!err) return null;
    if (code === 'TENANT_EMAIL_CONFIG_NOT_READY') return 'notReady';
    return 'failed';
  });

  protected readonly failedMessage = computed(() => {
    this.i18n();
    const err = this.loaded.error();
    if (!err) return '';
    return resolveEmailError(err, this.transloco);
  });

  constructor() {
    effect(() => {
      if (this.loaded.hasValue()) this.lastGood.set(this.loaded.value());
    });
    effect(() => {
      const err = this.loaded.error();
      if (err) untracked(() => this.showError(err));
      else if (this.loaded.hasValue()) this.notify.connectionRestored();
    });
    effect(() => {
      this.api.me()?.id;
      untracked(() => {
        this.localResult.set(null);
        this.lastGood.set(null);
      });
    });
  }

  protected reload(): void {
    if (!this.canRead || !this.entitled) return;
    this.lastGood.set(this.result());
    this.localResult.set(null);
    this.loaded.reload();
  }

  protected isPlaceholder(cfg: TenantEmailConfig): boolean {
    return isPlaceholderConfig(cfg);
  }

  protected providerName(cfg: TenantEmailConfig): string {
    this.i18n();
    return providerDriverLabel(cfg.providerDriver, (key) => this.transloco.translate(key));
  }

  protected verifiedDate(cfg: TenantEmailConfig): string {
    return formatEmailDate(cfg.verifiedAt, this.language());
  }

  protected formatNumber(value: number): string {
    return formatEmailNumber(value, this.language());
  }

  protected planSummaryParams(cfg: TenantEmailConfig): { daily: string; perMinute: string } {
    const lang = this.language();
    return {
      daily: formatEmailNumber(cfg.planDailyQuota, lang),
      perMinute: formatEmailNumber(cfg.planRateLimitPerMin, lang),
    };
  }

  protected isStatusSwitchDisabled(cfg: TenantEmailConfig): boolean {
    if (!this.canManage || this.togglingStatus()) return true;
    return cfg.status === 'SUSPENDED' && !cfg.dkimVerified;
  }

  protected openSender(): void {
    if (!this.canManage || !this.config()) return;
    this.senderModal().open();
  }

  protected openProvider(): void {
    if (!this.canManage || !this.config() || isManagedProvider(this.config()!)) return;
    this.providerModal().open();
  }

  protected openSmtp(switching = false): void {
    if (!this.canManage || !this.config()) return;
    this.smtpModal().open(switching);
  }

  protected openLimits(): void {
    if (!this.canManage || !this.config()) return;
    this.limitsModal().open();
  }

  protected openDns(): void {
    if (!this.config()) return;
    this.dnsModal().open();
  }

  protected onResultSaved(next: EmailResult): void {
    this.localResult.set(next);
  }

  protected onConflict(payload: EmailConflictPayload): void {
    this.conflictDialog().open(payload);
  }

  protected async verifyDomain(cfg: TenantEmailConfig): Promise<void> {
    if (!this.canManage || this.verifyingDomain()) return;
    const rev = this.etag() ?? `"${cfg.revision}"`;
    this.verifyingDomain.set(true);

    try {
      if (!this.verifyOp || this.verifyOp.etag !== rev)
        this.verifyOp = { etag: rev, key: newIdempotencyKey() };
      const updated = await this.api.verifyEmailDomain(rev, this.verifyOp.key);
      this.verifyOp = null;
      this.localResult.set(updated);
      this.notify.success(this.transloco.translate('wsEmail.toast.verified'));
      await this.offerTurnOn(updated);
    } catch (error) {
      if (isConflictError(error)) {
        this.conflictDialog().open({ status: error.status, patch: null });
        return;
      }
      this.showError(error);
    } finally {
      this.verifyingDomain.set(false);
    }
  }

  protected async toggleDeliveryStatus(cfg: TenantEmailConfig, active: boolean): Promise<void> {
    if (!this.canManage || this.togglingStatus()) return;
    const nextStatus: EmailStatus = active ? 'ACTIVE' : 'SUSPENDED';
    if (nextStatus === cfg.status) return;
    if (nextStatus === 'ACTIVE' && !cfg.dkimVerified) return;

    const prevResult = this.result() ?? { config: cfg, etag: `"${cfg.revision}"` };
    this.localResult.set({
      config: { ...cfg, status: nextStatus },
      etag: prevResult.etag,
    });
    this.togglingStatus.set(true);

    try {
      const bodyJson = JSON.stringify([{ status: nextStatus }, prevResult.etag]);
      if (this.statusOp?.bodyJson !== bodyJson)
        this.statusOp = { bodyJson, key: newIdempotencyKey() };
      const updated = await this.api.patchEmailConfig(
        { status: nextStatus },
        prevResult.etag,
        this.statusOp.key,
      );
      this.statusOp = null;
      this.localResult.set(updated);
      this.notify.success(this.transloco.translate('wsEmail.toast.saved'));
    } catch (error) {
      this.localResult.set(prevResult);
      if (isConflictError(error)) {
        this.conflictDialog().open({
          status: error.status,
          patch: { status: nextStatus },
        });
        return;
      }
      this.showError(error);
    } finally {
      this.togglingStatus.set(false);
    }
  }
  protected async offerTurnOn(result: EmailResult): Promise<void> {
    if (!result.config.dkimVerified || result.config.status === 'ACTIVE' || !this.canManage) return;
    if (await this.turnOnConfirm().open()) await this.toggleDeliveryStatus(result.config, true);
  }

  protected async sendTest(): Promise<void> {
    if (!this.canManage || this.hasDrafts() || this.testing()) return;
    this.testing.set(true);
    try {
      await this.api.sendTestEmail((this.testKey ??= newIdempotencyKey()));
      this.testKey = null;
      this.notify.success(
        this.transloco.translate('wsEmail.sendTestDone', { email: this.api.me()?.email }),
      );
    } catch (error) {
      if (error instanceof ApiError && error.status === 429) {
        this.notify.error(this.transloco.translate('wsEmail.errors.EMAIL_TEST_RATE_LIMITED'));
        this.testKey = null;
      } else this.showError(error);
    } finally {
      this.testing.set(false);
    }
  }

  private showError(error: unknown): void {
    const message = resolveEmailError(error, this.transloco);
    if (error instanceof ApiError && error.status === 0) this.notify.connectionLost(message, '');
    else this.notify.error(message);
  }
}
