import { Component, computed, inject, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerApps,
  tablerBarbell,
  tablerBed,
  tablerBuildingEstate,
  tablerBuildingFactory,
  tablerBuildingStore,
  tablerBuildingWarehouse,
  tablerCalculator,
  tablerCar,
  tablerChartBar,
  tablerChartPie,
  tablerCrane,
  tablerCube,
  tablerDeviceDesktop,
  tablerFiles,
  tablerHeadset,
  tablerKey,
  tablerLayoutKanban,
  tablerLock,
  tablerMapPin,
  tablerPill,
  tablerRepeat,
  tablerRosetteDiscountCheck,
  tablerSchool,
  tablerShoppingCart,
  tablerSpeakerphone,
  tablerStethoscope,
  tablerTool,
  tablerToolsKitchen2,
  tablerTruckDelivery,
  tablerUserSearch,
  tablerUsers,
  tablerUsersGroup,
} from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../../core/i18n/language';
import { Button } from '../../../../../shared/ui/button/button';
import { appDescriptionKey, appIcon, appRoute, appTile } from '../../app-presentation';
import { AppsOverviewItem, appName } from '../../modules.model';

const ICONS = {
  tablerApps,
  tablerBarbell,
  tablerBed,
  tablerBuildingEstate,
  tablerBuildingFactory,
  tablerBuildingStore,
  tablerBuildingWarehouse,
  tablerCalculator,
  tablerCar,
  tablerChartBar,
  tablerChartPie,
  tablerCrane,
  tablerCube,
  tablerDeviceDesktop,
  tablerFiles,
  tablerHeadset,
  tablerKey,
  tablerLayoutKanban,
  tablerLock,
  tablerMapPin,
  tablerPill,
  tablerRepeat,
  tablerRosetteDiscountCheck,
  tablerSchool,
  tablerShoppingCart,
  tablerSpeakerphone,
  tablerStethoscope,
  tablerTool,
  tablerToolsKitchen2,
  tablerTruckDelivery,
  tablerUserSearch,
  tablerUsers,
  tablerUsersGroup,
};

@Component({
  selector: 'app-app-card',
  imports: [RouterLink, TranslocoPipe, NgIcon, Button],
  providers: [provideIcons(ICONS)],
  templateUrl: './app-card.html',
  host: { class: 'block h-full' },
})
export class AppCard {
  protected readonly language = inject(LanguageState).current;

  readonly app = input.required<AppsOverviewItem>();
  readonly request = output<AppsOverviewItem>();

  protected readonly name = computed(() => appName(this.app(), this.language()));
  protected readonly descriptionKey = computed(() => appDescriptionKey(this.app().moduleKey));
  protected readonly tile = computed(() => appTile(this.app().moduleKey));
  protected readonly route = computed(() => appRoute(this.app().moduleKey));
  protected readonly icon = computed(() => appIcon(this.app().moduleKey));
}
