import { Component, computed, inject, output, signal, viewChild } from '@angular/core';
import { translationEvents } from '../../../../core/i18n/translation-events';
import { Router } from '@angular/router';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerCopy, tablerReceipt } from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../core/i18n/language';
import { Notify } from '../../../../core/notify/notify';
import { Button } from '../../../../shared/ui/button/button';
import { Field } from '../../../../shared/ui/field/field';
import { Modal } from '../../../../shared/ui/modal/modal';
import { getDecision } from '../policy.api';
import type { DecisionPolicyVersionRef, DecisionReceipt } from '../policy.model';
import { POLICY_KINDS, type PolicyOutcome } from '../policy.registry';
import { formatDateTime } from '../pricing.service';

const OUTCOME_CLASSES: Readonly<Record<string, string>> = {
  ALLOW: 'bg-success-soft text-on-success-soft',
  DENY: 'bg-danger-soft text-on-danger-soft',
  REQUIRE_APPROVAL: 'bg-brand-soft text-on-brand-soft',
  SELECT: 'bg-neutral-soft text-on-neutral-soft',
};

const KNOWN_KINDS = new Set<string>(POLICY_KINDS);

@Component({
  selector: 'app-decision-modal',
  imports: [NgIcon, TranslocoPipe, Button, Field, Modal],
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
  private readonly router = inject(Router);
  private readonly modal = viewChild.required(Modal);

  readonly closed = output<void>();
  readonly navigateVersion = output<DecisionPolicyVersionRef>();

  protected readonly loading = signal(false);
  protected readonly receipt = signal<DecisionReceipt | null>(null);
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
    return translated !== key ? translated : r.outcome;
  });

  protected readonly outcomeClass = computed(() => {
    const o = this.receipt()?.outcome ?? '';
    return OUTCOME_CLASSES[o as PolicyOutcome] ?? 'bg-neutral-soft text-on-neutral-soft';
  });

  protected readonly documentText = computed(() => {
    const r = this.receipt();
    if (!r?.document) return '—';
    const rawId = r.document.aggregateId;
    const shortId = rawId.length > 10 ? rawId.slice(0, 8) : rawId;
    return `${r.document.aggregateType} · ${shortId}`;
  });

  protected readonly evaluatedAtText = computed(() => {
    const r = this.receipt();
    if (!r) return '—';
    return formatDateTime(r.evaluatedAt, this.lang());
  });

  async open(id: string): Promise<void> {
    const reqId = ++this.activeRequestId;
    this.loading.set(true);
    this.receipt.set(null);
    this.modal().open();

    try {
      const data = await getDecision(id);
      if (reqId !== this.activeRequestId) return;
      this.receipt.set(data);
    } catch {
      if (reqId !== this.activeRequestId) return;
      this.notify.error(this.transloco.translate('policy.decision.loadErrorToast'));
      this.modal().close();
    } finally {
      if (reqId === this.activeRequestId) {
        this.loading.set(false);
      }
    }
  }

  protected openVersion(ref: DecisionPolicyVersionRef): void {
    this.modal().close();
    this.navigateVersion.emit(ref);
    void this.router.navigate(['/trade/governance/policy-studio', ref.definitionId, 'versions', ref.versionId]);
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
