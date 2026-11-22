import { Component, computed, effect, inject, resource, signal, untracked, viewChild } from '@angular/core';
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
import { getEmailConfig, patchEmailConfig, verifyEmailDomain } from '../email.api';
import {
  EmailConflictPayload,
  EmailResult,
  EmailStatus,
  TenantEmailConfig,
  formatEmailDate,
  formatEmailNumber,
  isConflictError,
  isPlaceholderConfig,
  providerDriverLabel,
  resolveEmailError,
} from '../email.model';
import { LimitsModal } from '../limits-modal/limits-modal';
import { ProviderModal } from '../provider-modal/provider-modal';
import { SenderModal } from '../sender-modal/sender-modal';
import { SmtpModal } from '../smtp-modal/smtp-modal';
import { SuppressionBlock } from '../suppression-block/suppression-block';

const CAN_READ = true; // workspace.email.read
const CAN_MANAGE = true; // workspace.email.manage, tenant-wide
const OUTBOUND_EMAIL_ENTITLED = true; // crm.outbound_email
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

  protected readonly canRead = CAN_READ;
  protected readonly canManage = CAN_MANAGE;
  protected readonly entitled = OUTBOUND_EMAIL_ENTITLED;
  protected readonly skeletonRows = SKELETON_ROWS;

  private readonly loaded = resource({
    params: () => (this.canRead && this.entitled ? true : undefined),
    loader: () => getEmailConfig(),
  });
  private readonly localResult = signal<EmailResult | null>(null);
  /** Last good result, kept so a failed reload does not wipe the page. */
  private readonly lastGood = signal<EmailResult | null>(null);

  protected readonly verifyingDomain = signal(false);
  protected readonly togglingStatus = signal(false);

  protected readonly result = computed<EmailResult | null>(
    () => this.localResult() ?? (this.loaded.hasValue() ? this.loaded.value() : this.lastGood()),
  );
  protected readonly config = computed<TenantEmailConfig | null>(() => this.result()?.config ?? null);
  protected readonly revision = computed<number | null>(() => this.result()?.revision ?? null);
  protected readonly loading = this.loaded.isLoading;

  protected readonly fullState = computed<FullState>(() => {
    if (!this.canRead) return 'forbidden';
    if (!this.entitled) return 'notEntitled';
    if (this.config() || this.loading()) return null;

    const err = this.loaded.error();
    if (!err) return null;
    const code = errorCodeOf(err);
    if (code === 'TENANT_EMAIL_CONFIG_NOT_READY') return 'notReady';
    if (code === 'ACCESS_POLICY_BLOCKED') return 'blocked';
    if (err instanceof ApiError && err.status === 403) return 'forbidden';
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
      if (err && untracked(() => this.lastGood())) {
        this.notify.error(resolveEmailError(err, this.transloco));
      }
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
    if (!this.canManage || !this.config()) return;
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
    const rev = this.revision() ?? cfg.revision;
    this.verifyingDomain.set(true);

    try {
      const updated = await verifyEmailDomain(rev, newIdempotencyKey());
      this.localResult.set(updated);
      this.notify.success(this.transloco.translate('wsEmail.toast.verified'));
    } catch (error) {
      if (isConflictError(error)) {
        this.conflictDialog().open({ status: error.status, patch: null });
        return;
      }
      this.notify.error(resolveEmailError(error, this.transloco));
    } finally {
      this.verifyingDomain.set(false);
    }
  }

  protected async toggleDeliveryStatus(cfg: TenantEmailConfig, active: boolean): Promise<void> {
    if (!this.canManage || this.togglingStatus()) return;
    const nextStatus: EmailStatus = active ? 'ACTIVE' : 'SUSPENDED';
    if (nextStatus === cfg.status) return;
    if (nextStatus === 'ACTIVE' && !cfg.dkimVerified) return;

    const prevResult = this.result() ?? { config: cfg, revision: cfg.revision };
    this.localResult.set({
      config: { ...cfg, status: nextStatus },
      revision: prevResult.revision,
    });
    this.togglingStatus.set(true);

    try {
      const updated = await patchEmailConfig(
        { status: nextStatus },
        prevResult.revision,
        newIdempotencyKey(),
      );
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
      this.notify.error(resolveEmailError(error, this.transloco));
    } finally {
      this.togglingStatus.set(false);
    }
  }
}
