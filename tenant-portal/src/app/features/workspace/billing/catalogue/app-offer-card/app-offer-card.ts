import { Component, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerApps,
  tablerBox,
  tablerCalculator,
  tablerId,
  tablerPuzzle,
  tablerUsers,
} from '@ng-icons/tabler-icons';
import { Button } from '../../../../../shared/ui/button/button';
import { BillingCycle } from '../../billing.model';
import { CatalogueAppGroup, PriceLadderTarget } from '../catalogue.service';

@Component({
  selector: 'app-offer-card',
  imports: [RouterLink, TranslocoPipe, NgIcon, Button],
  providers: [
    provideIcons({
      tablerUsers,
      tablerBox,
      tablerCalculator,
      tablerId,
      tablerApps,
      tablerPuzzle,
    }),
  ],
  templateUrl: './app-offer-card.html',
  host: { class: 'block' },
})
export class AppOfferCard {
  readonly group = input.required<CatalogueAppGroup>();
  readonly cycle = input.required<BillingCycle>();
  readonly openPrices = output<PriceLadderTarget>();
}
