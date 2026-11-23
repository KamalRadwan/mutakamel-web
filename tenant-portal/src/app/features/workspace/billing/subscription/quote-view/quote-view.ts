import { Component, computed, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { PluralKeyPipe } from '../../../../../core/i18n/plural';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerArrowRight, tablerRefresh, tablerUpload } from '@ng-icons/tabler-icons';
import { Button } from '../../../../../shared/ui/button/button';
import { CommercialPreview, PreviewChange } from '../../billing.model';
import { formatUsd, isGreater } from '../../shared/money';

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
    return fin.walletStatus !== 'NOT_APPLICABLE' && isGreater(fin.walletShortfallUsd, '0');
  });

  protected itemLabel(change: PreviewChange): string {
    return this.itemLabels().get(change.selectionKey) ?? change.addonId ?? change.applicationId;
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
    return (
      change.fromSeats !== null && change.toSeats !== null && change.fromSeats !== change.toSeats
    );
  }
}
