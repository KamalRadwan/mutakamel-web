import { Component, computed, inject, signal, viewChild } from '@angular/core';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerApps,
  tablerBox,
  tablerCalculator,
  tablerId,
  tablerTag,
  tablerUsers,
} from '@ng-icons/tabler-icons';
import { Button } from '../../../../../shared/ui/button/button';
import { Modal } from '../../../../../shared/ui/modal/modal';
import { Field } from '../../../../../shared/ui/field/field';
import { Segmented, SegmentedOption } from '../../../../../shared/ui/segmented/segmented';
import { BillingCycle, Money, OfferLadder, PriceBracket } from '../../billing.model';
import { formatUnitPrice } from '../../shared/money';
import { PriceLadderTarget, findLadder, isLadderConfigured } from '../catalogue.service';

@Component({
  selector: 'app-price-ladder-modal',
  imports: [NgIcon, TranslocoPipe, Button, Modal, Field, Segmented],
  providers: [
    provideIcons({
      tablerUsers,
      tablerBox,
      tablerCalculator,
      tablerId,
      tablerApps,
      tablerTag,
    }),
  ],
  templateUrl: './price-ladder-modal.html',
})
export class PriceLadderModal {
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly modal = viewChild.required(Modal);

  protected readonly target = signal<PriceLadderTarget | null>(null);
  protected readonly cycle = signal<BillingCycle>('MONTHLY');

  protected readonly modalTitle = computed(() => {
    this.i18n();
    const current = this.target();
    if (!current) return '';
    return this.transloco.translate('bcat.modal.title', {
      app: current.appName,
      item: current.itemName,
    });
  });

  protected readonly cycleOptions = computed<SegmentedOption[]>(() => {
    this.i18n();
    return [
      { value: 'MONTHLY', label: this.transloco.translate('bill.cycle.MONTHLY') },
      { value: 'ANNUAL', label: this.transloco.translate('bill.cycle.ANNUAL') },
    ];
  });

  protected readonly activeLadder = computed<OfferLadder | null>(() => {
    const current = this.target();
    if (!current) return null;
    return findLadder(current.ladders, this.cycle());
  });

  protected readonly configured = computed(() => isLadderConfigured(this.activeLadder()));

  protected readonly brackets = computed<readonly PriceBracket[]>(() => {
    const ladder = this.activeLadder();
    return isLadderConfigured(ladder) ? ladder.brackets : [];
  });

  open(target: PriceLadderTarget): void {
    this.target.set(target);
    this.cycle.set(target.defaultCycle);
    this.modal().open();
  }

  close(): void {
    this.modal().close();
  }

  protected onCycleChange(value: string | null): void {
    if (value === 'MONTHLY' || value === 'ANNUAL') {
      this.cycle.set(value);
    }
  }

  protected formatPrice(unitPrice: Money): string {
    return formatUnitPrice(unitPrice);
  }
}
