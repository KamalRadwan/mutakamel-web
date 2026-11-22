import { Component, computed, effect, inject, input, linkedSignal, signal, untracked } from '@angular/core';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerShieldCheck } from '@ng-icons/tabler-icons';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { Notify } from '../../../../../core/notify/notify';
import { Button } from '../../../../../shared/ui/button/button';
import { Dropdown, type DropdownOption } from '../../../../../shared/ui/dropdown/dropdown';
import { Field } from '../../../../../shared/ui/field/field';
import { errorCodeOf, errorKey, newIdempotencyKey, type TradeContext } from '../../../shared/trade-api';
import { formatMoney } from '../../../shared/trade-format';
import { BADGE_CLASS } from '../../../shared/trade-labels';
import { evaluateCredit, getCreditSummary } from '../commercial-accounts.api';
import {
  type AccountDetail,
  CREDIT_LIMIT_PATTERN,
  type CreditDecision,
  type CreditSummary,
} from '../commercial-accounts.model';

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

  protected readonly summary = signal<CreditSummary | null>(null);
  protected readonly summaryLoading = signal(false);

  protected readonly amount = signal('');
  protected readonly attempted = signal(false);
  protected readonly checking = signal(false);
  protected readonly decision = signal<CreditDecision | null>(null);

  private summarySeq = 0;
  private checkSeq = 0;
  private readonly idempotencyKeys = new Map<string, string>();

  protected readonly currencyOptions = computed<DropdownOption<string>[]>(() => {
    const acc = this.account();
    if (acc.creditCurrencyCode) {
      return [{ value: acc.creditCurrencyCode, label: acc.creditCurrencyCode }];
    }
    const allowed = acc.terms.allowedCurrencies;
    if (allowed && allowed.length > 0) {
      return allowed.map((code) => ({ value: code, label: code }));
    }
    const fallback = this.ctx().companyId === 'c2' ? 'SAR' : 'EGP';
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
        if (acc.accountRole === 'SUPPLIER' || !ctx.companyId || !ctx.branchId) {
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
    this.amount.set((event.target as HTMLInputElement).value);
  }

  protected onCurrencyChange(value: string): void {
    this.selectedCurrency.set(value);
  }

  protected async runCheck(): Promise<void> {
    if (this.dirty() || this.checking()) return;
    this.attempted.set(true);

    const proposedAmount = this.amount().trim();
    if (!proposedAmount || !CREDIT_LIMIT_PATTERN.test(proposedAmount)) {
      return;
    }

    const currencyCode = this.effectiveCurrency();
    const acc = this.account();
    const ctx = this.ctx();
    const keySlot = `${acc.id}:${acc.version}:${ctx.companyId ?? ''}:${ctx.branchId ?? ''}:${proposedAmount}:${currencyCode}`;
    let key = this.idempotencyKeys.get(keySlot);
    if (!key) {
      key = newIdempotencyKey();
      this.idempotencyKeys.set(keySlot, key);
    }

    const seq = ++this.checkSeq;
    this.checking.set(true);
    try {
      const res = await evaluateCredit(ctx, acc.id, { proposedAmount, currencyCode }, key);
      if (seq !== this.checkSeq) return;
      this.decision.set(res);
    } catch (error) {
      if (seq !== this.checkSeq) return;
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
      this.notify.error(this.transloco.translate(errorKey(error)));
    } finally {
      if (seq === this.summarySeq) {
        this.summaryLoading.set(false);
      }
    }
  }
}
