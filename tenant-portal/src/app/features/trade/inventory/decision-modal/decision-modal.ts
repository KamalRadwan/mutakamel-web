import {
  Component,
  DestroyRef,
  computed,
  inject,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { translationEvents } from '../../../../core/i18n/translation-events';
import { Router } from '@angular/router';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerAlertTriangle,
  tablerCopy,
  tablerExternalLink,
  tablerGavel,
} from '@ng-icons/tabler-icons';
import { Notify } from '../../../../core/notify/notify';
import { Button } from '../../../../shared/ui/button/button';
import { Field } from '../../../../shared/ui/field/field';
import { Modal } from '../../../../shared/ui/modal/modal';
import { ApiError } from '../../shared/trade-api';
import { getDecision } from '../inventory.api';
import type { DecisionAggregateType, InventoryDecision } from '../inventory.model';
import { errorKey, formatDateTime } from '../inventory.service';
import { InventoryBadge } from '../inventory-shared/inventory-badge/inventory-badge';

const SKELETON_FIELDS = [0, 1, 2, 3, 4, 5] as const;

@Component({
  selector: 'app-decision-modal',
  imports: [TranslocoPipe, NgIcon, Button, Field, Modal, InventoryBadge],
  providers: [
    provideTranslocoScope('settings', { scope: 'trade-shared', alias: 'tradeShared' }, { scope: 'trade-inventory', alias: 'tradeInventory' }, { scope: 'trade-inventory-evidence', alias: 'invEvidence' }),
    provideIcons({
      tablerGavel,
      tablerCopy,
      tablerExternalLink,
      tablerAlertTriangle,
    }),
  ],
  templateUrl: './decision-modal.html',
})
export class DecisionModal {
  private static nextId = 0;
  protected readonly uid = `decision-modal-${++DecisionModal.nextId}`;

  private readonly router = inject(Router);
  private readonly notify = inject(Notify);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);

  private readonly modal = viewChild.required(Modal);

  readonly closed = output<void>();

  protected readonly skeletonFields = SKELETON_FIELDS;

  protected readonly currentId = signal<string | null>(null);
  protected readonly decision = signal<InventoryDecision | null>(null);
  protected readonly loading = signal(false);
  protected readonly loadFailed = signal(false);
  protected readonly errorMessageKey = signal('tradeInventory.errors.generic');

  private loadSeq = 0;
  private suppressClosed = false;
  private destroyed = false;

  protected readonly decisionSubtitle = computed(() => {
    this.i18n();
    const d = this.decision();
    if (!d) return '';
    return this.transloco.translate(`tradeInventory.badge.decision.${d.decisionType}`);
  });

  protected readonly outcomeText = computed(() => {
    this.i18n();
    const d = this.decision();
    if (!d) return '';
    const outcome = d.result.outcome;
    const selected = d.result.selectedValue;
    if (outcome === 'SELECT' && selected) {
      const selectLabel = this.transloco.translate('invEvidence.outcomes.SELECT');
      const selectedKey = `tradeInventory.badge.outcome.${selected}`;
      const selectedTranslated = this.transloco.translate(selectedKey);
      const selectedLabel =
        selectedTranslated && selectedTranslated !== selectedKey ? selectedTranslated : selected;
      return `${selectLabel} · ${selectedLabel}`;
    }
    const key = `tradeInventory.badge.outcome.${outcome}`;
    const translated = this.transloco.translate(key);
    return translated && translated !== key ? translated : outcome;
  });

  protected readonly translatedExplanation = computed(() => {
    this.i18n();
    const d = this.decision();
    if (!d) return '';
    const code = d.result.explanationCode?.trim();
    if (code) {
      const key = `invEvidence.explanations.${code}`;
      const translated = this.transloco.translate(key);
      if (translated && translated !== key) {
        return translated;
      }
    }
    return d.explanation;
  });

  protected readonly showOriginalExplanation = computed(() => {
    const d = this.decision();
    if (!d) return false;
    const raw = d.explanation.trim();
    const shown = this.translatedExplanation().trim();
    return Boolean(raw && raw !== shown);
  });

  protected readonly explanationCodeLtr = computed(() => {
    const code = this.decision()?.result.explanationCode?.trim();
    return code ? `\u2066${code}\u2069` : null;
  });

  protected readonly policyVersionsText = computed(() => {
    this.i18n();
    const d = this.decision();
    if (!d || d.policyVersions.length === 0) {
      return this.transloco.translate('tradeInventory.common.none');
    }
    return d.policyVersions.map((pv) => `${pv.policyKind} · v${pv.version}`).join(', ');
  });

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.destroyed = true;
      this.loadSeq += 1;
    });
  }

  open(id: string): void {
    this.currentId.set(id);
    this.decision.set(null);
    this.loadFailed.set(false);
    this.loading.set(true);
    this.modal().open();
    void this.loadDecision(id);
  }

  close(): void {
    this.modal().close();
  }

  closeSilently(): void {
    this.loadSeq += 1;
    this.suppressClosed = true;
    try {
      this.modal().close();
    } finally {
      this.suppressClosed = false;
    }
  }

  protected retry(): void {
    const id = this.currentId();
    if (!id) return;
    this.loadFailed.set(false);
    this.loading.set(true);
    void this.loadDecision(id);
  }

  protected onModalClosed(): void {
    this.loadSeq += 1;
    if (!this.suppressClosed) {
      this.closed.emit();
    }
  }

  protected outcomeBadgeValue(d: InventoryDecision): string {
    return d.result.outcome === 'SELECT' && d.result.selectedValue
      ? d.result.selectedValue
      : d.result.outcome;
  }

  protected aggregateTypeLabel(type: DecisionAggregateType): string {
    this.i18n();
    const key = `invEvidence.aggregateTypes.${type}`;
    const translated = this.transloco.translate(key);
    return translated && translated !== key ? translated : type;
  }

  protected canOpenRecord(d: InventoryDecision): boolean {
    return d.aggregateType === 'INVENTORY_RECEIPT' || d.aggregateType === 'INVENTORY_DELIVERY';
  }

  protected openRecord(d: InventoryDecision): void {
    if (!this.canOpenRecord(d)) return;
    this.closeSilently();
    void this.router.navigate(['/trade/inventory/movements'], {
      queryParams: { source: d.aggregateId },
    });
  }

  protected formatDateTime(iso: string): string {
    return formatDateTime(iso);
  }

  protected async copyText(value: string | null | undefined): Promise<void> {
    const clean = value?.trim();
    if (!clean) return;
    try {
      if (!navigator.clipboard) throw new Error('clipboard unavailable');
      await navigator.clipboard.writeText(clean);
      this.notify.success(this.transloco.translate('tradeInventory.common.copied'));
    } catch {
      this.notify.error(this.transloco.translate('tradeInventory.errors.generic'));
    }
  }

  private async loadDecision(id: string): Promise<void> {
    const seq = ++this.loadSeq;
    try {
      const detail = await getDecision(id);
      if (this.destroyed || seq !== this.loadSeq) return;
      this.decision.set(detail);
      this.loading.set(false);
    } catch (error) {
      if (this.destroyed || seq !== this.loadSeq) return;
      this.loading.set(false);
      if (error instanceof ApiError && error.status === 404) {
        this.notify.error(this.transloco.translate(errorKey(error)));
        this.modal().close();
        return;
      }
      this.errorMessageKey.set(errorKey(error));
      this.loadFailed.set(true);
    }
  }
}
