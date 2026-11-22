import { Component, DestroyRef, computed, effect, inject, signal, untracked, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { provideIcons } from '@ng-icons/core';
import {
  tablerAlertTriangle,
  tablerBuildingCommunity,
  tablerEye,
  tablerHome,
  tablerPencil,
  tablerToggleRight,
  tablerTrash,
} from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../../core/i18n/language';
import { Notify } from '../../../../../core/notify/notify';
import { ActionItem, ActionSelection, ActionsMenu } from '../../../../../shared/ui/actions-menu/actions-menu';
import { Button } from '../../../../../shared/ui/button/button';
import { ConfirmDialog } from '../../../../../shared/ui/confirm-dialog/confirm-dialog';
import { Dropdown, DropdownOption } from '../../../../../shared/ui/dropdown/dropdown';
import { Field } from '../../../../../shared/ui/field/field';
import { Modal } from '../../../../../shared/ui/modal/modal';
import { Switch } from '../../../../../shared/ui/switch/switch';
import { SettingsFrame } from '../../../../../shared/ui/settings-frame/settings-frame';
import { ApiError, errorCodeOf, errorMessage } from '../../../../../core/api/api-errors';
import {
  GEO_LIMITS,
  GeoCity,
  GeoCountry,
  GeoState,
  GeoUsedBy,
  GeoZone,
  deleteCity,
  geoNameIn,
  listCities,
  listCountries,
  listStates,
  listAllZones,
  updateCity,
  usedByOf,
} from '../geo-admin.api';
import { PlaceFormModal } from '../place-form-modal/place-form-modal';
import { newIdempotencyKey } from '../../../../../core/api/idempotency';
import { ActionKeys } from '../../core-response.model';

const CAN_MANAGE = true; // later from permission core.geo.manage
const SEARCH_DEBOUNCE_MS = 300;
const SKELETON_ROWS = [0, 1, 2, 3, 4] as const;

/** The list search: a literal, case-insensitive substring of either name, as GeoService filters. */
function containsSearch(item: { nameEn: string; nameAr: string }, search: string): boolean {
  const term = search.trim().toLowerCase();
  return !term || item.nameEn.toLowerCase().includes(term) || item.nameAr.toLowerCase().includes(term);
}

function compareCitiesByNameEn(a: GeoCity, b: GeoCity): number {
  const byBase = a.nameEn.localeCompare(b.nameEn, 'en', { sensitivity: 'base' });
  if (byBase !== 0) return byBase;
  const byExact = a.nameEn.localeCompare(b.nameEn, 'en');
  if (byExact !== 0) return byExact;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

@Component({
  selector: 'app-cities-tab',
  imports: [
    TranslocoPipe,
    ActionsMenu,
    Button,
    ConfirmDialog,
    Dropdown,
    Field,
    Modal,
    PlaceFormModal,
    SettingsFrame,
    Switch,
  ],
  providers: [
    provideTranslocoScope({ scope: 'ws-geo', alias: 'wsGeo' }, 'settings', { scope: 'ws-geo-places', alias: 'geoPlaces' }),
    provideIcons({
      tablerAlertTriangle,
      tablerBuildingCommunity,
      tablerEye,
      tablerHome,
      tablerPencil,
      tablerToggleRight,
      tablerTrash,
    }),
  ],
  templateUrl: './cities-tab.html',
  host: { class: 'flex min-h-0 flex-1 flex-col' },
})
export class CitiesTab {
  private static nextId = 0;
  protected readonly uid = `cities-tab-${++CitiesTab.nextId}`;

  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly notify = inject(Notify);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly queryParams = toSignal(this.route.queryParamMap);
  protected readonly language = inject(LanguageState).current;

  private readonly placeModal = viewChild.required(PlaceFormModal);
  private readonly confirmDelete = viewChild.required<ConfirmDialog>('confirmDelete');
  private readonly inUseModal = viewChild.required<Modal>('inUseModal');

  protected readonly canManage = CAN_MANAGE;
  protected readonly skeletonRows = SKELETON_ROWS;

  protected readonly countries = signal<GeoCountry[]>([]);
  protected readonly states = signal<GeoState[]>([]);
  protected readonly zones = signal<GeoZone[]>([]);
  protected readonly cities = signal<GeoCity[]>([]);
  protected readonly nextCursor = signal<string | null>(null);

  protected readonly search = signal('');
  protected readonly debouncedSearch = signal('');
  protected readonly showInactive = signal(false);

  protected readonly loading = signal(false);
  protected readonly loadingMore = signal(false);
  protected readonly loadFailed = signal(false);
  protected readonly busy = signal(false);
  protected readonly togglingIds = signal<ReadonlySet<string>>(new Set());

  protected readonly deletingCity = signal<GeoCity | null>(null);
  protected readonly inUseState = signal<{ city: GeoCity; usedBy: GeoUsedBy[] } | null>(null);
  protected readonly deactivating = signal(false);

  private statesLoadedCountryId: string | null = null;
  private statesSeq = 0;
  private resolveCountrySeq = 0;
  private citiesSeq = 0;
  private searchTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly actionKeys = new ActionKeys(newIdempotencyKey);

  protected readonly countryId = computed(() => this.queryParams()?.get('country') ?? '');
  protected readonly stateId = computed(() => this.queryParams()?.get('state') ?? '');

  protected readonly selectedCountry = computed(
    () => this.countries().find((item) => item.id === this.countryId()) ?? null,
  );
  protected readonly selectedState = computed(
    () => this.states().find((item) => item.id === this.stateId()) ?? null,
  );
  protected readonly selectedStateId = computed(() => this.selectedState()?.id ?? '');

  protected readonly locationPath = computed(() => {
    const lang = this.language();
    const state = this.selectedState();
    const country = this.selectedCountry();
    return [state ? geoNameIn(state, lang) : '', country ? geoNameIn(country, lang) : ''].filter(Boolean).join(' · ');
  });

  protected readonly countryOptions = computed<DropdownOption<string>[]>(() => {
    const lang = this.language();
    return this.countries()
      .slice()
      .sort((a, b) => geoNameIn(a, lang).localeCompare(geoNameIn(b, lang), lang, { sensitivity: 'base' }))
      .map((item) => ({ value: item.id, label: geoNameIn(item, lang) }));
  });

  protected readonly stateOptions = computed<DropdownOption<string>[]>(() => {
    const lang = this.language();
    return this.states()
      .slice()
      .sort((a, b) => geoNameIn(a, lang).localeCompare(geoNameIn(b, lang), lang, { sensitivity: 'base' }))
      .map((item) => ({ value: item.id, label: geoNameIn(item, lang) }));
  });

  protected readonly zoneById = computed(() => {
    const map = new Map<string, GeoZone>();
    for (const zone of this.zones()) {
      map.set(zone.id, zone);
    }
    return map;
  });

  protected readonly gridColumns = computed(() =>
    this.canManage
      ? 'grid-cols-geo-city-row-actions'
      : 'grid-cols-geo-city-row',
  );

  /** The API lists inactive cities too; the switch only hides them on screen. */
  protected readonly visibleCities = computed(() =>
    this.showInactive() ? this.cities() : this.cities().filter((city) => city.isActive),
  );

  protected readonly deletingName = computed(() => {
    const target = this.deletingCity();
    return target ? geoNameIn(target, this.language()) : '';
  });

  constructor() {
    void this.loadLookups();

    effect(() => {
      const country = this.countryId();
      if (country === this.statesLoadedCountryId) return;
      this.statesLoadedCountryId = country;
      untracked(() => {
        void this.loadStatesForCountry(country);
      });
    });

    effect(() => {
      const stateId = this.stateId();
      const countryId = this.countryId();
      const countries = this.countries();
      untracked(() => {
        if (!stateId || countryId || countries.length === 0) return;
        void this.resolveCountryFromState(stateId, countries);
      });
    });

    effect(() => {
      const term = this.search().trim();
      if (this.searchTimer !== null) {
        clearTimeout(this.searchTimer);
        this.searchTimer = null;
      }
      if (term === untracked(() => this.debouncedSearch())) return;
      this.searchTimer = setTimeout(() => {
        this.searchTimer = null;
        this.debouncedSearch.set(term);
      }, SEARCH_DEBOUNCE_MS);
    });

    effect(() => {
      const stateId = this.selectedStateId();
      const term = this.debouncedSearch();
      untracked(() => {
        if (!stateId) {
          this.citiesSeq++;
          this.cities.set([]);
          this.nextCursor.set(null);
          this.loading.set(false);
          this.loadFailed.set(false);
          return;
        }
        void this.loadCities(stateId, term, true);
      });
    });

    inject(DestroyRef).onDestroy(() => {
      if (this.searchTimer !== null) {
        clearTimeout(this.searchTimer);
        this.searchTimer = null;
      }
    });
  }

  protected onCountryChange(nextCountry: string): void {
    if (nextCountry === this.countryId()) return;
    this.resolveCountrySeq++;
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        country: nextCountry || null,
        state: null,
        city: null,
      },
      queryParamsHandling: 'merge',
    });
  }

  protected onStateChange(nextState: string): void {
    if (nextState === this.stateId()) return;
    this.resolveCountrySeq++;
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        state: nextState || null,
        city: null,
      },
      queryParamsHandling: 'merge',
    });
  }

  protected onShowInactiveChange(checked: boolean): void {
    this.showInactive.set(checked);
  }

  protected clearSearch(): void {
    if (this.searchTimer !== null) {
      clearTimeout(this.searchTimer);
      this.searchTimer = null;
    }
    this.search.set('');
    this.debouncedSearch.set('');
  }

  protected reload(): void {
    void this.loadZonesLookup();
    const state = this.selectedState();
    if (!state) {
      void this.loadLookups();
      if (this.countryId()) {
        void this.loadStatesForCountry(this.countryId());
      }
      return;
    }
    if (this.searchTimer !== null) {
      clearTimeout(this.searchTimer);
      this.searchTimer = null;
    }
    const term = this.search().trim();
    if (term !== this.debouncedSearch()) {
      this.debouncedSearch.set(term);
      return;
    }
    void this.loadCities(state.id, term, true);
  }

  protected loadMore(): void {
    const state = this.selectedState();
    const cursor = this.nextCursor();
    if (!state || !cursor || this.loading() || this.loadingMore()) return;
    void this.loadCities(state.id, this.debouncedSearch(), false);
  }

  protected openCreate(): void {
    const state = this.selectedState();
    if (!this.canManage || !state) return;
    this.placeModal().openCreateCity({
      stateId: state.id,
      locationPath: this.locationPath(),
    });
  }

  protected openEdit(city: GeoCity): void {
    this.placeModal().openEditCity(city, { locationPath: this.locationPath() });
  }

  protected onRowClick(city: GeoCity, event: Event): void {
    const target = event.target as HTMLElement | null;
    if (target?.closest('button, a, [data-row-action]')) return;
    this.openEdit(city);
  }

  protected openDistricts(city: GeoCity): void {
    void this.router.navigate(['../districts'], {
      relativeTo: this.route,
      queryParams: {
        country: this.countryId() || null,
        state: this.stateId() || null,
        city: city.id,
      },
      queryParamsHandling: 'merge',
    });
  }

  protected usedByText(usedBy: readonly GeoUsedBy[]): string {
    this.i18n();
    const separator = this.transloco.translate('geoPlaces.usedBy.separator');
    return usedBy.map((kind) => this.transloco.translate('geoPlaces.usedBy.' + kind)).join(separator);
  }

  protected formatDate(iso: string): string {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return iso;
    return new Intl.DateTimeFormat(this.language() + '-u-nu-latn', { day: 'numeric', month: 'short', year: 'numeric' }).format(date);
  }

  protected zoneName(zoneId: string | null): string | null {
    if (!zoneId) return null;
    const zone = this.zoneById().get(zoneId);
    return zone ? geoNameIn(zone, this.language()) : null;
  }

  protected rowActions(city: GeoCity): ActionItem[] {
    this.i18n();
    const t = (key: string) => this.transloco.translate(key);
    const toggleDisabled = this.togglingIds().has(city.id) || this.busy();

    return [
      {
        id: 'open',
        title: t('geoPlaces.actions.open'),
        icon: 'tablerEye',
        tile: 'bg-icon-blue',
      },
      {
        id: 'edit',
        title: t('geoPlaces.actions.edit'),
        icon: 'tablerPencil',
        tile: 'bg-icon-navy',
      },
      {
        id: 'viewDistricts',
        title: t('geoPlaces.actions.viewDistricts'),
        icon: 'tablerHome',
        tile: 'bg-icon-teal',
      },
      {
        id: 'toggleActive',
        title: t(city.isActive ? 'geoPlaces.actions.deactivate' : 'geoPlaces.actions.activate'),
        icon: 'tablerToggleRight',
        tile: toggleDisabled ? 'bg-icon-gray' : 'bg-icon-orange',
        disabled: toggleDisabled,
      },
      {
        id: 'delete',
        title: t('geoPlaces.actions.delete'),
        icon: 'tablerTrash',
        tile: 'bg-icon-red',
        danger: true,
      },
    ];
  }

  protected onRowAction(city: GeoCity, selection: ActionSelection): void {
    switch (selection.id) {
      case 'open':
      case 'edit':
        this.openEdit(city);
        break;
      case 'viewDistricts':
        this.openDistricts(city);
        break;
      case 'toggleActive':
        void this.toggleActive(city);
        break;
      case 'delete':
        void this.requestDelete(city);
        break;
    }
  }

  protected onCitySaved(event: { city: GeoCity; isNew: boolean }): void {
    const saved = event.city;
    if (saved.stateId !== this.stateId()) return;

    if (event.isNew) {
      if (!containsSearch(saved, this.debouncedSearch())) return;
      this.cities.update((list) => {
        if (list.some((item) => item.id === saved.id)) {
          return list.map((item) => (item.id === saved.id ? saved : item)).sort(compareCitiesByNameEn);
        }
        const last = list.at(-1);
        if (!this.nextCursor() || !last || compareCitiesByNameEn(saved, last) <= 0) {
          return [...list, saved].sort(compareCitiesByNameEn);
        }
        return list;
      });
      return;
    }

    this.applyCityUpdate(saved);
  }

  protected onCityNotFound(id: string): void {
    if (id === this.stateId()) {
      this.handleMissingState(id);
      return;
    }
    this.removeCityFromList(id);
  }

  protected async requestDelete(city: GeoCity): Promise<void> {
    if (!this.canManage || this.busy()) return;
    this.deletingCity.set(city);
    const confirmed = await this.confirmDelete().open();
    if (!confirmed) {
      this.deletingCity.set(null);
      return;
    }

    this.busy.set(true);
    try {
      const signature = `delete:${city.id}`;
      await deleteCity(city.id, this.actionKeys.keyFor(signature));
      this.actionKeys.done(signature);
      this.placeModal().close();
      this.removeCityFromList(city.id);
      this.notify.success(this.transloco.translate('geoPlaces.delete.done'));
    } catch (error) {
      const code = errorCodeOf(error);
      if (code === 'GEO_CITY_IN_USE') {
        this.placeModal().close();
        const details = error instanceof ApiError ? error.details : undefined;
        this.inUseState.set({ city, usedBy: usedByOf(details) });
        this.inUseModal().open();
        return;
      }
      this.showErrorToast(error);
      if (code === 'GEO_CITY_NOT_FOUND') {
        this.placeModal().close();
        this.onCityNotFound(city.id);
      }
    } finally {
      this.busy.set(false);
      this.deletingCity.set(null);
    }
  }

  protected closeInUseModal(): void {
    this.inUseModal().close();
    this.inUseState.set(null);
  }

  protected async deactivateInUseCity(): Promise<void> {
    const state = this.inUseState();
    if (!state || this.deactivating()) return;

    this.deactivating.set(true);
    try {
      const signature = `active:${state.city.id}:false`;
      const updated = await updateCity(state.city.id, { isActive: false }, this.actionKeys.keyFor(signature));
      this.actionKeys.done(signature);
      this.applyCityUpdate(updated);
      this.notify.success(this.transloco.translate('geoPlaces.saved'));
      this.closeInUseModal();
    } catch (error) {
      this.showErrorToast(error);
      if (errorCodeOf(error) === 'GEO_CITY_NOT_FOUND') {
        this.onCityNotFound(state.city.id);
        this.closeInUseModal();
      }
    } finally {
      this.deactivating.set(false);
    }
  }

  private async toggleActive(city: GeoCity): Promise<void> {
    if (!this.canManage || this.busy() || this.togglingIds().has(city.id)) return;
    this.togglingIds.update((set) => new Set(set).add(city.id));
    try {
      const signature = `active:${city.id}:${!city.isActive}`;
      const updated = await updateCity(city.id, { isActive: !city.isActive }, this.actionKeys.keyFor(signature));
      this.actionKeys.done(signature);
      this.applyCityUpdate(updated);
      this.notify.success(this.transloco.translate('geoPlaces.saved'));
    } catch (error) {
      this.showErrorToast(error);
      if (errorCodeOf(error) === 'GEO_CITY_NOT_FOUND') {
        this.onCityNotFound(city.id);
      }
    } finally {
      this.togglingIds.update((set) => {
        const next = new Set(set);
        next.delete(city.id);
        return next;
      });
    }
  }

  private applyCityUpdate(updated: GeoCity): void {
    this.cities.update((list) =>
      list.map((item) => (item.id === updated.id ? updated : item)).sort(compareCitiesByNameEn),
    );
  }

  private removeCityFromList(cityId: string): void {
    this.cities.update((list) => list.filter((item) => item.id !== cityId));
  }

  private handleMissingState(stateId: string): void {
    this.states.update((list) => list.filter((item) => item.id !== stateId));
    this.loadFailed.set(false);
    this.cities.set([]);
    this.nextCursor.set(null);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { state: null, city: null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  private async loadLookups(): Promise<void> {
    const [countriesResult, zonesResult] = await Promise.allSettled([listCountries(), listAllZones()]);
    if (countriesResult.status === 'fulfilled') {
      this.countries.set(countriesResult.value.items);
    }
    if (zonesResult.status === 'fulfilled') {
      this.zones.set(zonesResult.value);
    }
    if (countriesResult.status === 'rejected') {
      this.showErrorToast(countriesResult.reason);
    } else if (zonesResult.status === 'rejected') {
      this.showErrorToast(zonesResult.reason);
    }
  }

  private async resolveCountryFromState(stateId: string, countries: GeoCountry[]): Promise<void> {
    const seq = ++this.resolveCountrySeq;
    const results = await Promise.allSettled(
      countries.map(async (country) => ({ country, states: (await listStates(country.id)).items })),
    );
    if (seq !== this.resolveCountrySeq || this.stateId() !== stateId || this.countryId()) return;

    for (const result of results) {
      if (result.status !== 'fulfilled') continue;
      if (result.value.states.some((item) => item.id === stateId)) {
        this.statesLoadedCountryId = result.value.country.id;
        this.statesSeq++;
        this.states.set(result.value.states);
        void this.router.navigate([], {
          relativeTo: this.route,
          queryParams: { country: result.value.country.id },
          queryParamsHandling: 'merge',
          replaceUrl: true,
        });
        return;
      }
    }

    const firstRejected = results.find((result) => result.status === 'rejected');
    if (firstRejected) {
      this.showErrorToast(firstRejected.reason);
      return;
    }

    this.handleMissingState(stateId);
  }

  private async loadZonesLookup(): Promise<void> {
    try {
      this.zones.set(await listAllZones());
    } catch {
      // Keep existing zone names if background refresh fails.
    }
  }

  private async loadStatesForCountry(countryId: string): Promise<void> {
    const seq = ++this.statesSeq;
    if (!countryId) {
      this.states.set([]);
      return;
    }
    try {
      const { items: loaded } = await listStates(countryId);
      if (seq !== this.statesSeq) return;
      this.states.set(loaded);
      const currentState = this.stateId();
      if (currentState && !loaded.some((item) => item.id === currentState)) {
        void this.router.navigate([], {
          relativeTo: this.route,
          queryParams: { state: null, city: null },
          queryParamsHandling: 'merge',
          replaceUrl: true,
        });
      }
    } catch (error) {
      if (seq !== this.statesSeq) return;
      this.states.set([]);
      this.showErrorToast(error);
    }
  }

  private async loadCities(stateId: string, search: string, reset: boolean): Promise<void> {
    const seq = ++this.citiesSeq;
    const cursor = reset ? null : this.nextCursor();

    if (reset) {
      this.loading.set(true);
      this.loadFailed.set(false);
    } else {
      this.loadingMore.set(true);
    }

    try {
      const page = await listCities(stateId, {
        search: search || undefined,
        cursor,
        limit: GEO_LIMITS.pageSize,
      });
      if (seq !== this.citiesSeq) return;
      this.cities.update((current) => {
        if (reset) return page.items;
        const seen = new Set(current.map((item) => item.id));
        return [...current, ...page.items.filter((item) => !seen.has(item.id))];
      });
      this.nextCursor.set(page.nextCursor);
    } catch (error) {
      if (seq !== this.citiesSeq) return;
      if (errorCodeOf(error) === 'GEO_STATE_NOT_FOUND') {
        this.showErrorToast(error);
        this.handleMissingState(stateId);
        return;
      }
      if (reset) {
        this.loadFailed.set(true);
        this.cities.set([]);
        this.nextCursor.set(null);
      } else {
        this.showErrorToast(error);
      }
    } finally {
      if (seq === this.citiesSeq) {
        this.loading.set(false);
        this.loadingMore.set(false);
      }
    }
  }

  private showErrorToast(error: unknown): void {
    const code = errorCodeOf(error);
    if (code) {
      const scopedKey = `geoPlaces.errors.${code}`;
      const scoped = this.transloco.translate(scopedKey);
      if (scoped && scoped !== scopedKey) {
        this.notify.error(scoped);
        return;
      }
      this.notify.error(errorMessage(error, 'geoPlaces', this.transloco));
      return;
    }
    this.notify.error(this.transloco.translate('geoPlaces.errors.generic'));
  }
}
