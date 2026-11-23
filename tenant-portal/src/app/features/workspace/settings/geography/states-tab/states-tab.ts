import { NgOptimizedImage } from '@angular/common';
import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerBuildingCommunity, tablerCloudOff, tablerLock } from '@ng-icons/tabler-icons';
import { ApiError, errorCodeOf } from '../../../../../core/api/api-errors';
import { LanguageState } from '../../../../../core/i18n/language';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { Notify } from '../../../../../core/notify/notify';
import {
  ActionItem,
  ActionSelection,
  ActionsMenu,
} from '../../../../../shared/ui/actions-menu/actions-menu';
import { Button } from '../../../../../shared/ui/button/button';
import { Dropdown, DropdownOption } from '../../../../../shared/ui/dropdown/dropdown';
import { Field } from '../../../../../shared/ui/field/field';
import { SettingsFrame } from '../../../../../shared/ui/settings-frame/settings-frame';
import { GeoAdminApi } from '../geo-admin.api';
import {
  GeoCountry,
  GeoState,
  geoErrorMessage,
  geoFlagUrl,
  geoNameIn,
  normalizeGeoSearch,
} from '../geo-admin.model';

const SKELETON_ROWS = [1, 2, 3, 4, 5] as const;
@Component({
  selector: 'app-states-tab',
  imports: [
    NgOptimizedImage,
    NgIcon,
    TranslocoPipe,
    SettingsFrame,
    Button,
    ActionsMenu,
    Dropdown,
    Field,
  ],
  providers: [
    provideTranslocoScope('settings', { scope: 'ws-geo', alias: 'wsGeo' }),
    provideIcons({ tablerLock, tablerBuildingCommunity, tablerCloudOff }),
  ],
  templateUrl: './states-tab.html',
  host: { class: 'flex flex-1 shrink-0 flex-col' },
})
export class StatesTab {
  private readonly api = inject(GeoAdminApi);
  private static nextId = 0;
  protected readonly uid = `ws-geo-states-${++StatesTab.nextId}`;

  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly notify = inject(Notify);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly language = inject(LanguageState).current;
  private readonly queryParams = toSignal(this.route.queryParamMap, {
    initialValue: this.route.snapshot.queryParamMap,
  });

  protected readonly skeletonRows = SKELETON_ROWS;
  protected readonly countries = signal<GeoCountry[]>([]);
  protected readonly selectedCountryId = signal('');
  protected readonly states = signal<GeoState[]>([]);
  protected readonly loading = signal(false);
  protected readonly failed = signal(false);
  protected readonly search = signal('');

  private countriesLoaded = false;
  private loadSeq = 0;
  private statesSeq = 0;

  protected readonly urlCountryId = computed(() => this.queryParams().get('country') ?? '');

  protected readonly selectedCountry = computed(
    () => this.countries().find((country) => country.id === this.selectedCountryId()) ?? null,
  );

  protected readonly countryOptions = computed<DropdownOption<string>[]>(() => {
    const lang = this.language();
    return this.countries()
      .slice()
      .sort((a, b) =>
        geoNameIn(a, lang).localeCompare(geoNameIn(b, lang), lang, { sensitivity: 'base' }),
      )
      .map((country) => ({
        value: country.id,
        label: `${geoNameIn(country, lang)} · \u2068${country.iso2}\u2069`,
      }));
  });

  protected readonly sortedStates = computed(() => {
    const lang = this.language();
    return this.states()
      .slice()
      .sort((a, b) =>
        geoNameIn(a, lang).localeCompare(geoNameIn(b, lang), lang, { sensitivity: 'base' }),
      );
  });

  protected readonly filteredStates = computed(() => {
    const rawTerm = this.search().trim();
    const list = this.sortedStates();
    if (!rawTerm) return list;

    const normTerm = normalizeGeoSearch(rawTerm);
    const lowerTerm = rawTerm.toLowerCase();

    return list.filter(
      (state) =>
        normalizeGeoSearch(state.nameAr).includes(normTerm) ||
        normalizeGeoSearch(state.nameEn).includes(normTerm) ||
        state.code.toLowerCase().includes(lowerTerm),
    );
  });

  protected readonly rowActions = computed<ActionItem[]>(() => {
    this.i18n();
    return [
      {
        id: 'viewCities',
        title: this.transloco.translate('wsGeo.actions.viewCities'),
        icon: 'tablerBuildingCommunity',
        tile: 'bg-icon-teal',
      },
    ];
  });

  constructor() {
    effect(() => {
      const paramCountry = this.urlCountryId();
      if (!this.countriesLoaded) return;

      untracked(() => {
        if (!paramCountry) {
          const fallback = this.pickDefaultCountry(this.countries());
          if (fallback) {
            this.selectedCountryId.set(fallback.id);
            void this.router.navigate([], {
              relativeTo: this.route,
              queryParams: { country: fallback.id },
              queryParamsHandling: 'merge',
              replaceUrl: true,
            });
            void this.loadStates(fallback.id);
          }
          return;
        }
        if (paramCountry !== this.selectedCountryId()) {
          this.selectedCountryId.set(paramCountry);
          void this.loadStates(paramCountry);
        }
      });
    });

    void this.loadAll();
  }

  protected async reload(): Promise<void> {
    if (!this.countriesLoaded || !this.countries().length) {
      await this.loadAll();
      return;
    }
    const countryId = this.selectedCountryId();
    if (!countryId) {
      await this.loadAll();
      return;
    }
    await this.loadStates(countryId);
  }

  protected onCountryChange(countryId: string): void {
    if (!countryId || countryId === this.selectedCountryId()) return;
    this.selectedCountryId.set(countryId);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { country: countryId, state: null, city: null },
      queryParamsHandling: 'merge',
    });
    void this.loadStates(countryId);
  }

  protected flagUrl(iso2: string): string {
    return geoFlagUrl(iso2);
  }

  protected viewCities(state: GeoState): void {
    void this.router.navigate(['../cities'], {
      relativeTo: this.route,
      queryParams: { country: state.countryId, state: state.id, city: null },
      queryParamsHandling: 'merge',
    });
  }

  protected onRowAction(state: GeoState, selection: ActionSelection): void {
    if (selection.id === 'viewCities') {
      this.viewCities(state);
    }
  }

  private async loadAll(): Promise<void> {
    const seq = ++this.loadSeq;
    this.loading.set(true);
    this.failed.set(false);
    try {
      const { items } = await this.api.listCountries();
      if (seq !== this.loadSeq) return;
      this.countries.set(items);
      this.countriesLoaded = true;

      const paramCountry = this.urlCountryId();
      if (paramCountry) {
        this.selectedCountryId.set(paramCountry);
        await this.loadStates(paramCountry);
        return;
      }

      const defaultCountry = this.pickDefaultCountry(items);
      if (!defaultCountry) {
        this.selectedCountryId.set('');
        this.states.set([]);
        this.loading.set(false);
        return;
      }

      this.selectedCountryId.set(defaultCountry.id);
      void this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { country: defaultCountry.id },
        queryParamsHandling: 'merge',
        replaceUrl: true,
      });
      await this.loadStates(defaultCountry.id);
    } catch (error) {
      this.showLoadError(error);
      if (seq !== this.loadSeq) return;
      this.failed.set(true);
      this.loading.set(false);
    }
  }

  private async loadStates(countryId: string, tried = new Set<string>()): Promise<void> {
    tried.add(countryId);
    const seq = ++this.statesSeq;
    this.loading.set(true);
    this.failed.set(false);
    try {
      const { items } = await this.api.listStates(countryId);
      if (seq !== this.statesSeq) return;
      this.states.set(items);
      this.notify.connectionRestored();
    } catch (error) {
      if (seq !== this.statesSeq) return;
      this.states.set([]);
      if (errorCodeOf(error) === 'GEO_COUNTRY_NOT_FOUND') {
        this.notify.error(this.transloco.translate('wsGeo.states.countryUnavailable'));
        const fallback = this.pickDefaultCountry(this.countries().filter((c) => !tried.has(c.id)));
        if (fallback) {
          this.selectedCountryId.set(fallback.id);
          void this.router.navigate([], {
            relativeTo: this.route,
            queryParams: { country: fallback.id, state: null, city: null },
            queryParamsHandling: 'merge',
            replaceUrl: true,
          });
          await this.loadStates(fallback.id, tried);
          return;
        }
      }
      this.showLoadError(error);
      this.failed.set(true);
    } finally {
      if (seq === this.statesSeq) {
        this.loading.set(false);
      }
    }
  }

  private showLoadError(error: unknown): void {
    if (errorCodeOf(error) === 'GEO_COUNTRY_NOT_FOUND') return;
    const message = geoErrorMessage(error, 'wsGeo', this.transloco);
    if (error instanceof ApiError && error.status === 0) this.notify.connectionLost(message, '');
    else this.notify.error(message);
  }

  private pickDefaultCountry(list: readonly GeoCountry[]): GeoCountry | null {
    if (!list.length) return null;
    return list.find((c) => c.iso2.toUpperCase() === 'EG' || c.id === 'geo-eg') ?? list[0];
  }
}
