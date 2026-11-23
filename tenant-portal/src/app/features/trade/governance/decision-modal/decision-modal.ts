import { Component, computed, inject, input, output, signal, viewChild } from '@angular/core';
import { translationEvents } from '../../../../core/i18n/translation-events';
import { Router } from '@angular/router';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerCopy, tablerReceipt } from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../core/i18n/language';
import { Notify } from '../../../../core/notify/notify';
import { TenantScopeState } from '../../../../core/scope/tenant-scope';
import { Button } from '../../../../shared/ui/button/button';
import { Field } from '../../../../shared/ui/field/field';
import { FullState } from '../../../../shared/ui/full-state/full-state';
import { Modal } from '../../../../shared/ui/modal/modal';
import { type TradeContext, errorCodeOf } from '../../shared/trade-api';
import { getDecision } from '../policy.api';
import type { DecisionPolicyVersionRef, DecisionReceipt } from '../policy.model';
import { POLICY_KINDS, type PolicyOutcome, operatingTradeContext } from '../policy.registry';
import { formatDateTime, isForbiddenError } from '../pricing.service';

const OUTCOME_CLASSES: Readonly<Record<string, string>> = {
  ALLOW: 'bg-success-soft text-on-success-soft',
  DENY: 'bg-danger-soft text-on-danger-soft',
  REQUIRE_APPROVAL: 'bg-brand-soft text-on-brand-soft',
  SELECT: 'bg-neutral-soft text-on-neutral-soft',
};

const KNOWN_KINDS = new Set<string>(POLICY_KINDS);

@Component({
  selector: 'app-decision-modal',
  imports: [NgIcon, TranslocoPipe, Button, Field, FullState, Modal],
  providers: [
    provideIcons({ tablerCopy, tablerReceipt }),
    provideTranslocoScope({ scope: 'trade-governance', alias: 'governance' }, { scope: 'trade-shared', alias: 'tradeShared' }, { scope: 'trade-gov-policy', alias: 'policy' }),
  ],
  templateUrl: './decision-modal.html',
})
export class DecisionModal {
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly lang = inject(LanguageState).current;
  private readonly notify = inject(Notify);
  private readonly tenantScope = inject(TenantScopeState);
  private readonly router = inject(Router);
  private readonly modal = viewChild.required(Modal);

  readonly ctx = input<TradeContext | null>(null);
  readonly closed = output<void>();
  readonly navigateVersion = output<DecisionPolicyVersionRef>();

  protected readonly loading = signal(false);
  protected readonly unavailable = signal(false);
  protected readonly forbidden = signal(false);
  protected readonly receipt = signal<DecisionReceipt | null>(null);
  private lastDecisionId: string | null = null;
  private activeRequestId = 0;

  protected readonly decisionTypeLabel = computed(() => {
    this.i18n();
    const r = this.receipt();
    if (!r) return '—';
    return KNOWN_KINDS.has(r.decisionType)
      ? this.transloco.translate(`policy.kinds.${r.decisionType}.name`)
      : r.decisionType;
  });

  protected readonly outcomeLabel = computed(() => {
    this.i18n();
    const r = this.receipt();
    if (!r) return '—';
    const key = `policy.outcomes.${r.outcome}`;
    const translated = this.transloco.translate(key);
    return translated !== key ? translated : String(r.outcome);
  });

  protected readonly outcomeClass = computed(() => {
    const o = this.receipt()?.outcome ?? '';
    return OUTCOME_CLASSES[o as PolicyOutcome] ?? 'bg-neutral-soft text-on-neutral-soft';
  });

  protected readonly selectedValueText = computed(() => {
    this.i18n();
    const val = this.receipt()?.selectedValue;
    if (val === null || val === undefined || val === '') return '—';
    if (typeof val === 'boolean') {
      return this.transloco.translate(val ? 'policy.rules.yes' : 'policy.rules.no');
    }
    return String(val);
  });

  protected readonly scopeText = computed(() => {
    this.i18n();
    const scopeTarget = this.receipt()?.scopeTarget;
    if (!scopeTarget) return '—';
    const key = `governance.scope.${scopeTarget}`;
    const translated = this.transloco.translate(key);
    return translated !== key ? translated : scopeTarget;
  });

  protected readonly documentText = computed(() => {
    const r = this.receipt();
    if (!r || (!r.aggregateType && !r.aggregateId)) return '—';
    const rawId = r.aggregateId ?? '';
    const shortId = rawId.length > 10 ? rawId.slice(0, 8) : rawId;
    return [r.aggregateType, shortId].filter(Boolean).join(' · ') || '—';
  });

  protected readonly evaluatedAtText = computed(() => {
    const r = this.receipt();
    if (!r) return '—';
    return formatDateTime(r.evaluatedAt, this.lang());
  });

  async open(id: string): Promise<void> {
    const reqId = ++this.activeRequestId;
    this.lastDecisionId = id;
    this.loading.set(true);
    this.unavailable.set(false);
    this.forbidden.set(false);
    this.receipt.set(null);
    this.modal().open();

    const resolvedCtx = this.ctx() ?? operatingTradeContext(this.tenantScope);
    try {
      const data = await getDecision(id, resolvedCtx);
      if (reqId !== this.activeRequestId) return;
      this.receipt.set(data);
    } catch (err) {
      if (reqId !== this.activeRequestId) return;
      if (isForbiddenError(err)) {
        this.forbidden.set(true);
        return;
      }
      if (errorCodeOf(err) === 'TRADE.POLICY.DECISION_UNAVAILABLE') {
        this.unavailable.set(true);
        return;
      }
      this.notify.error(this.transloco.translate('policy.decision.loadErrorToast'));
      this.modal().close();
    } finally {
      if (reqId === this.activeRequestId) {
        this.loading.set(false);
      }
    }
  }

  protected retry(): void {
    if (!this.lastDecisionId) return;
    void this.open(this.lastDecisionId);
  }

  protected openVersion(ref: DecisionPolicyVersionRef): void {
    this.modal().close();
    this.navigateVersion.emit(ref);
    const segment = ref.type === 'WORKFLOW' ? 'workflows' : 'policy-studio';
    void this.router.navigate(['/trade/governance', segment, ref.definitionId, 'versions', ref.id]);
  }

  protected async copyCorrelationId(value: string): Promise<void> {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      this.notify.success(this.transloco.translate('policy.decision.copiedToast'));
    } catch {
      // ignore clipboard errors when unavailable
    }
  }

  protected closeModal(): void {
    this.modal().close();
  }

  protected onModalClosed(): void {
    this.activeRequestId++;
    this.closed.emit();
  }
}
