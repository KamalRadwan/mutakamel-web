import { Component, computed, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { PluralKeyPipe } from '../../../../../core/i18n/plural';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerArrowRight, tablerRefresh, tablerUpload } from '@ng-icons/tabler-icons';
import { Button } from '../../../../../shared/ui/button/button';
import { CommercialPreview, Money, PreviewChange } from '../../billing.model';
import { formatUsd, isGreater, isZero } from '../../shared/money';

function formatMoneyTwoDecimalsCeil(raw: Money): string {
  const trimmed = raw.trim().replace(/^[+-]/, '');
  const dotIdx = trimmed.indexOf('.');
  const intDigits = (dotIdx === -1 ? trimmed : trimmed.slice(0, dotIdx)).replace(/^0+(?=\d)/, '') || '0';
  const frac = (dotIdx === -1 ? '' : trimmed.slice(dotIdx + 1)).padEnd(4, '0').slice(0, 4);
  if (!/^\d+$/.test(intDigits) || !/^\d{4}$/.test(frac)) return '0.00';

  let totalCents = BigInt(intDigits) * 100n + BigInt(frac.slice(0, 2));
  if (frac.slice(2) !== '00') {
    totalCents += 1n;
  }
  const whole = totalCents / 100n;
  const cents = (totalCents % 100n).toString().padStart(2, '0');
  return `${whole}.${cents}`;
}

@Component({
  selector: 'app-quote-view',
  imports: [RouterLink, NgIcon, TranslocoPipe, PluralKeyPipe, Button],
  providers: [provideIcons({ tablerArrowRight, tablerRefresh, tablerUpload })],
  templateUrl: './quote-view.html',
  host: { class: 'flex flex-col gap-12' },
})
export class QuoteView {
  readonly preview = input.required<CommercialPreview>();
  readonly itemLabels = input.required<ReadonlyMap<string, string>>();
  readonly tierNames = input.required<ReadonlyMap<string, string>>();
  readonly expired = input.required<boolean>();
  readonly remainingText = input.required<string>();
  readonly refreshing = input(false);

  readonly refreshPrice = output<void>();

  protected readonly formatUsd = formatUsd;

  protected readonly cycleUnitKey = computed(() =>
    this.preview().billingCycle === 'ANNUAL' ? 'bill.common.perYear' : 'bill.common.perMonth',
  );

  protected readonly hasShortfall = computed(() => {
    const fin = this.preview().financial;
    return fin.walletStatus !== 'NOT_APPLICABLE' && !isZero(fin.walletShortfallUsd);
  });

  protected readonly shortfallTwoDecimals = computed(() => {
    const fin = this.preview().financial;
    if (fin.walletStatus === 'NOT_APPLICABLE') return '0.00';
    return formatMoneyTwoDecimalsCeil(fin.walletShortfallUsd);
  });

  /** The top-up link amount: never below the minimum top-up of 1.00. */
  protected readonly topupAmount = computed(() => {
    const amount = this.shortfallTwoDecimals();
    return isGreater('1.00', amount) ? '1.00' : amount;
  });

  protected itemLabel(change: PreviewChange): string {
    return (
      this.itemLabels().get(change.selectionKey) ??
      change.addonId ??
      change.applicationId
    );
  }

  protected tierLabel(tierId: string | null): string {
    if (!tierId) return '';
    return this.tierNames().get(tierId) ?? tierId;
  }

  protected hasTierTransition(change: PreviewChange): boolean {
    if (change.operation === 'ADD') return Boolean(change.toTierId);
    return Boolean(change.fromTierId && change.toTierId && change.fromTierId !== change.toTierId);
  }

  protected hasSeatsTransition(change: PreviewChange): boolean {
    if (change.operation === 'ADD') return change.toSeats !== null;
    return change.fromSeats !== null && change.toSeats !== null && change.fromSeats !== change.toSeats;
  }
}
