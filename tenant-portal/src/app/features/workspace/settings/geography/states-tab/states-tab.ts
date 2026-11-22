import { NgOptimizedImage } from '@angular/common';
import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerBuildingCommunity, tablerCloudOff, tablerLock } from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../../core/i18n/language';
import { Notify } from '../../../../../core/notify/notify';
import { ActionItem, ActionSelection, ActionsMenu } from '../../../../../shared/ui/actions-menu/actions-menu';
import { Button } from '../../../../../shared/ui/button/button';
import { Dropdown, DropdownOption } from '../../../../../shared/ui/dropdown/dropdown';
import { Field } from '../../../../../shared/ui/field/field';
import { errorCodeOf, errorMessage } from '../../../../../core/api/api-errors';
import { SettingsFrame } from '../../../../../shared/ui/settings-frame/settings-frame';
import { listCountries, listStates } from '../geo-admin.api';
import { GeoCountry, GeoState, geoFlagUrl, geoNameIn, normalizeGeoSearch } from '../geo-admin.model';

const SKELETON_ROWS = [1, 2, 3, 4, 5] as const;
@Component({
  selector: 'app-states-tab',
  imports: [NgOptimizedImage, NgIcon, TranslocoPipe, SettingsFrame, Button, ActionsMenu, Dropdown, Field],
  providers: [
    provideTranslocoScope('settings', { scope: 'ws-geo', alias: 'wsGeo' }),
    provideIcons({ tablerLock, tablerBuildingCommunity, tablerCloudOff }),
  ],
  templateUrl: './states-tab.html',
  host: { class: 'flex min-h-0 flex-1 flex-col' },
})
export class StatesTab {
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
      .sort((a, b) => geoNameIn(a, lang).localeCompare(geoNameIn(b, lang), lang, { sensitivity: 'base' }))
      .map((country) => ({
        value: country.id,
        label: `${geoNameIn(country, lang)} · \u2068${country.iso2}\u2069`,
      }));
  });

  protected readonly sortedStates = computed(() => {
    const lang = this.language();
    return this.states()
      .slice()
      .sort((a, b) => geoNameIn(a, lang).localeCompare(geoNameIn(b, lang), lang, { sensitivity: 'base' }));
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
      const { items } = await listCountries();
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
    } catch {
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
      const { items } = await listStates(countryId);
      if (seq !== this.statesSeq) return;
      this.states.set(items);
    } catch (error) {
      if (seq !== this.statesSeq) return;
      this.states.set([]);
      if (errorCodeOf(error) === 'GEO_COUNTRY_NOT_FOUND') {
        this.notify.error(errorMessage(error, 'wsGeo', this.transloco));
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
      this.failed.set(true);
    } finally {
      if (seq === this.statesSeq) {
        this.loading.set(false);
      }
    }
  }

  private pickDefaultCountry(list: readonly GeoCountry[]): GeoCountry | null {
    if (!list.length) return null;
    return list.find((c) => c.iso2.toUpperCase() === 'EG' || c.id === 'geo-eg') ?? list[0];
  }
}
