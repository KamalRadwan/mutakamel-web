import { Component, computed, effect, inject, input, linkedSignal, output, signal, untracked } from '@angular/core';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerShieldCheck } from '@ng-icons/tabler-icons';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { ApiError as CoreApiError } from '../../../../../core/api/api-errors';
import { Notify } from '../../../../../core/notify/notify';
import { ScopeState } from '../../../../../core/scope/scope';
import { Button } from '../../../../../shared/ui/button/button';
import { Dropdown, type DropdownOption } from '../../../../../shared/ui/dropdown/dropdown';
import { Field } from '../../../../../shared/ui/field/field';
import { ApiError, errorCodeOf, errorKey, newIdempotencyKey, type TradeContext } from '../../../shared/trade-api';
import { formatMoney } from '../../../shared/trade-format';
import { BADGE_CLASS } from '../../../shared/trade-labels';
import { evaluateCredit, getCreditSummary } from '../commercial-accounts.api';
import {
  type AccountDetail,
  CREDIT_LIMIT_PATTERN,
  type CreditDecision,
  type CreditSummary,
} from '../commercial-accounts.model';

function isForbiddenError(error: unknown): boolean {
  return (error instanceof ApiError || error instanceof CoreApiError) && error.status === 403;
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function formatAsOfDateTime(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

@Component({
  selector: 'app-account-credit-check',
  imports: [NgIcon, TranslocoPipe, Button, Dropdown, Field],
  providers: [provideIcons({ tablerShieldCheck })],
  templateUrl: './account-credit-check.html',
  host: { class: 'flex flex-col gap-8' },
})
export class AccountCreditCheck {
  private static nextId = 0;

  private readonly notify = inject(Notify);
  private readonly scope = inject(ScopeState);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);

  protected readonly uid = `account-credit-check-${++AccountCreditCheck.nextId}`;
  protected readonly allowBadgeClass = BADGE_CLASS.success;
  protected readonly blockBadgeClass = BADGE_CLASS.danger;
  protected readonly skeletonFields = [1, 2, 3, 4, 5] as const;
  protected readonly formatMoney = formatMoney;
  protected readonly formatAsOf = formatAsOfDateTime;

  readonly account = input.required<AccountDetail>();
  readonly ctx = input.required<TradeContext>();
  readonly dirty = input(false);
  readonly forbidden = output<void>();

  protected readonly summary = signal<CreditSummary | null>(null);
  protected readonly summaryLoading = signal(false);

  protected readonly amount = signal('');
  protected readonly attempted = signal(false);
  protected readonly checking = signal(false);
  protected readonly decision = signal<CreditDecision | null>(null);
  protected readonly serverAmountError = signal<string | null>(null);

  private summarySeq = 0;
  private checkSeq = 0;

  protected readonly currencyOptions = computed<DropdownOption<string>[]>(() => {
    const acc = this.account();
    if (acc.creditCurrencyCode) {
      return [{ value: acc.creditCurrencyCode, label: acc.creditCurrencyCode }];
    }
    const allowed = acc.terms.allowedCurrencies;
    if (allowed && allowed.length > 0) {
      return allowed.map((code) => ({ value: code, label: code }));
    }
    const fallback = this.scope.company()?.currencyCode ?? (this.ctx().companyId === 'c2' ? 'SAR' : 'EGP');
    return [{ value: fallback, label: fallback }];
  });

  protected readonly selectedCurrency = linkedSignal<{ key: string; options: DropdownOption<string>[] }, string>({
    source: () => ({
      key: `${this.account().id}:${this.account().creditCurrencyCode ?? ''}:${this.ctx().companyId ?? ''}`,
      options: this.currencyOptions(),
    }),
    computation: ({ key, options }, previous) => {
      if (previous && previous.source.key === key && options.some((opt) => opt.value === previous.value)) {
        return previous.value;
      }
      return options[0]?.value ?? 'EGP';
    },
  });

  protected readonly fixedCurrency = computed(() => this.account().creditCurrencyCode);
  protected readonly effectiveCurrency = computed(() => this.fixedCurrency() ?? this.selectedCurrency());

  protected readonly amountError = computed<string | null>(() => {
    this.i18n();
    const server = this.serverAmountError();
    if (server) return server;
    if (!this.attempted()) return null;
    const raw = this.amount().trim();
    if (!raw) {
      return this.transloco.translate('tradeShared.common.required');
    }
    if (!CREDIT_LIMIT_PATTERN.test(raw)) {
      return this.transloco.translate('tradeAccounts.validation.invalidDecimal');
    }
    return null;
  });

  constructor() {
    effect(() => {
      const acc = this.account();
      acc.id;
      acc.version;
      acc.branchRule?.id;
      acc.branchRule?.version;
      acc.branchRule?.status;
      this.ctx().companyId;
      this.ctx().branchId;
      untracked(() => {
        this.checkSeq++;
        this.decision.set(null);
        this.attempted.set(false);
        this.serverAmountError.set(null);
      });
    });

    effect(() => {
      const acc = this.account();
      const ctx = this.ctx();
      const currencyCode = this.effectiveCurrency();
      const _version = acc.version;
      const _ruleId = acc.branchRule?.id;
      const _ruleVersion = acc.branchRule?.version;
      const _ruleStatus = acc.branchRule?.status;
      untracked(() => {
        if (acc.accountRole === 'SUPPLIER' || !ctx.companyId) {
          this.summarySeq++;
          this.summary.set(null);
          this.summaryLoading.set(false);
          return;
        }
        void this.loadSummary(ctx, acc.id, currencyCode);
      });
    });
  }

  protected onAmountInput(event: Event): void {
    this.serverAmountError.set(null);
    this.amount.set((event.target as HTMLInputElement).value);
  }

  protected onCurrencyChange(value: string): void {
    this.selectedCurrency.set(value);
  }

  protected async runCheck(): Promise<void> {
    if (this.dirty() || this.checking()) return;
    this.attempted.set(true);
    this.serverAmountError.set(null);

    const proposedAmount = this.amount().trim();
    if (!proposedAmount || !CREDIT_LIMIT_PATTERN.test(proposedAmount)) {
      return;
    }

    const currencyCode = this.effectiveCurrency();
    const acc = this.account();
    const ctx = this.ctx();
    const key = newIdempotencyKey();

    const seq = ++this.checkSeq;
    this.checking.set(true);
    try {
      const res = await evaluateCredit(ctx, acc.id, { proposedAmount, currencyCode }, key);
      if (seq !== this.checkSeq) return;
      this.decision.set(res);
    } catch (error) {
      if (seq !== this.checkSeq) return;
      if (isForbiddenError(error)) {
        this.forbidden.emit();
        return;
      }
      if (error instanceof ApiError && error.code === 'TRADE.VALIDATION_FAILED' && error.details?.['proposedAmount']?.[0]) {
        this.serverAmountError.set(this.transloco.translate('tradeAccounts.validation.invalidDecimal'));
        return;
      }
      const code = errorCodeOf(error);
      if (code === 'TRADE.CREDIT.EXPOSURE_UNAVAILABLE') {
        this.notify.warning(this.transloco.translate('tradeAccounts.credit.exposureUnavailable'));
      } else {
        this.notify.error(this.transloco.translate(errorKey(error)));
      }
    } finally {
      if (seq === this.checkSeq) {
        this.checking.set(false);
      }
    }
  }

  private async loadSummary(ctx: TradeContext, accountId: string, currencyCode: string): Promise<void> {
    const seq = ++this.summarySeq;
    this.summaryLoading.set(true);
    try {
      const res = await getCreditSummary(ctx, accountId, currencyCode);
      if (seq !== this.summarySeq) return;
      this.summary.set(res);
    } catch (error) {
      if (seq !== this.summarySeq) return;
      this.summary.set(null);
      if (isForbiddenError(error)) {
        this.forbidden.emit();
        return;
      }
      this.notify.error(this.transloco.translate(errorKey(error)));
    } finally {
      if (seq === this.summarySeq) {
        this.summaryLoading.set(false);
      }
    }
  }
}
