import { NgOptimizedImage } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerBuildingCommunity,
  tablerCloudOff,
  tablerLock,
  tablerMap,
} from '@ng-icons/tabler-icons';
import { ApiError } from '../../../../../core/api/api-errors';
import { LanguageState } from '../../../../../core/i18n/language';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { Notify } from '../../../../../core/notify/notify';
import {
  ActionItem,
  ActionSelection,
  ActionsMenu,
} from '../../../../../shared/ui/actions-menu/actions-menu';
import { Button } from '../../../../../shared/ui/button/button';
import { SettingsFrame } from '../../../../../shared/ui/settings-frame/settings-frame';
import { GeoAdminApi } from '../geo-admin.api';
import {
  GeoCountry,
  geoErrorMessage,
  geoFlagUrl,
  geoNameIn,
  normalizeGeoSearch,
} from '../geo-admin.model';

const SKELETON_ROWS = [1, 2, 3, 4, 5] as const;
@Component({
  selector: 'app-countries-tab',
  imports: [NgOptimizedImage, NgIcon, TranslocoPipe, SettingsFrame, Button, ActionsMenu],
  providers: [
    provideTranslocoScope('settings', { scope: 'ws-geo', alias: 'wsGeo' }),
    provideIcons({ tablerLock, tablerMap, tablerBuildingCommunity, tablerCloudOff }),
  ],
  templateUrl: './countries-tab.html',
  host: { class: 'flex flex-1 shrink-0 flex-col' },
})
export class CountriesTab {
  private readonly notify = inject(Notify);
  private readonly api = inject(GeoAdminApi);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly language = inject(LanguageState).current;

  protected readonly skeletonRows = SKELETON_ROWS;
  protected readonly countries = signal<GeoCountry[]>([]);
  protected readonly loading = signal(false);
  protected readonly failed = signal(false);
  protected readonly search = signal('');

  private loadSeq = 0;

  protected readonly sortedCountries = computed(() => {
    const lang = this.language();
    return this.countries()
      .slice()
      .sort((a, b) =>
        geoNameIn(a, lang).localeCompare(geoNameIn(b, lang), lang, { sensitivity: 'base' }),
      );
  });

  protected readonly filteredCountries = computed(() => {
    const rawTerm = this.search().trim();
    const list = this.sortedCountries();
    if (!rawTerm) return list;

    const normTerm = normalizeGeoSearch(rawTerm);
    const lowerTerm = rawTerm.toLowerCase();
    const dialDigits = lowerTerm.replace(/^\+/, '');

    return list.filter((country) => {
      if (normalizeGeoSearch(country.nameAr).includes(normTerm)) return true;
      if (normalizeGeoSearch(country.nameEn).includes(normTerm)) return true;
      if (country.iso2.toLowerCase().includes(lowerTerm)) return true;
      if (country.iso3.toLowerCase().includes(lowerTerm)) return true;
      if (country.dialCode.toLowerCase().includes(lowerTerm)) return true;
      if (dialDigits && country.dialCode.replace(/^\+/, '').includes(dialDigits)) return true;
      return false;
    });
  });

  protected readonly rowActions = computed<ActionItem[]>(() => {
    this.i18n();
    return [
      {
        id: 'viewStates',
        title: this.transloco.translate('wsGeo.actions.viewStates'),
        icon: 'tablerMap',
        tile: 'bg-icon-teal',
      },
      {
        id: 'viewCities',
        title: this.transloco.translate('wsGeo.actions.viewCities'),
        icon: 'tablerBuildingCommunity',
        tile: 'bg-icon-blue',
      },
    ];
  });

  constructor() {
    void this.load();
  }

  protected async load(): Promise<void> {
    const seq = ++this.loadSeq;
    this.loading.set(true);
    this.failed.set(false);
    try {
      const { items } = await this.api.listCountries();
      if (seq !== this.loadSeq) return;
      this.countries.set(items);
      this.notify.connectionRestored();
    } catch (error) {
      const message = geoErrorMessage(error, 'wsGeo', this.transloco);
      if (error instanceof ApiError && error.status === 0) this.notify.connectionLost(message, '');
      else this.notify.error(message);
      if (seq !== this.loadSeq) return;
      this.failed.set(true);
    } finally {
      if (seq === this.loadSeq) {
        this.loading.set(false);
      }
    }
  }

  protected flagUrl(iso2: string): string {
    return geoFlagUrl(iso2);
  }

  protected viewStates(country: GeoCountry): void {
    void this.router.navigate(['../states'], {
      relativeTo: this.route,
      queryParams: { country: country.id, state: null, city: null },
      queryParamsHandling: 'merge',
    });
  }

  protected viewCities(country: GeoCountry): void {
    void this.router.navigate(['../cities'], {
      relativeTo: this.route,
      queryParams: { country: country.id, state: null, city: null },
      queryParamsHandling: 'merge',
    });
  }

  protected onRowAction(country: GeoCountry, selection: ActionSelection): void {
    if (selection.id === 'viewStates') {
      this.viewStates(country);
    } else if (selection.id === 'viewCities') {
      this.viewCities(country);
    }
  }
}
