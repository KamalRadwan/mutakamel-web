import {
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { provideIcons } from '@ng-icons/core';
import {
  tablerAlertTriangle,
  tablerEye,
  tablerHome,
  tablerPencil,
  tablerToggleRight,
  tablerTrash,
} from '@ng-icons/tabler-icons';
import { ApiError, errorCodeOf } from '../../../../../core/api/api-errors';
import { newIdempotencyKey } from '../../../../../core/api/idempotency';
import { AuthSession } from '../../../../../core/auth/auth-session';
import { LanguageState } from '../../../../../core/i18n/language';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { Notify } from '../../../../../core/notify/notify';
import {
  ActionItem,
  ActionSelection,
  ActionsMenu,
} from '../../../../../shared/ui/actions-menu/actions-menu';
import { Button } from '../../../../../shared/ui/button/button';
import { ConfirmDialog } from '../../../../../shared/ui/confirm-dialog/confirm-dialog';
import { Dropdown, DropdownOption } from '../../../../../shared/ui/dropdown/dropdown';
import { Field } from '../../../../../shared/ui/field/field';
import { Modal } from '../../../../../shared/ui/modal/modal';
import { Segmented, SegmentedOption } from '../../../../../shared/ui/segmented/segmented';
import { SettingsFrame } from '../../../../../shared/ui/settings-frame/settings-frame';
import { SuggestInput } from '../../../../../shared/ui/suggest-input/suggest-input';
import { Switch } from '../../../../../shared/ui/switch/switch';
import { ActionKeys } from '../../core-response.model';
import {
  GEO_LIMITS,
  GeoAdminApi,
  GeoCity,
  GeoCountry,
  GeoDistrict,
  GeoDistrictKind,
  GeoState,
  geoNameIn,
} from '../geo-admin.api';
import { type CityWithPath, geoErrorMessage, placesEditable } from '../geo-admin.model';
import { PlaceFormModal } from '../place-form-modal/place-form-modal';

const SEARCH_DEBOUNCE_MS = 300;
const CITY_SEARCH_DEBOUNCE_MS = 250;
const SKELETON_ROWS = [0, 1, 2, 3, 4] as const;

/** The list search: a literal, case-insensitive substring of either name, as GeoService filters. */
function containsSearch(item: { nameEn: string; nameAr: string }, search: string): boolean {
  const term = search.trim().toLowerCase();
  return (
    !term || item.nameEn.toLowerCase().includes(term) || item.nameAr.toLowerCase().includes(term)
  );
}

type KindFilter = 'ALL' | GeoDistrictKind;

function compareDistrictsByNameEn(a: GeoDistrict, b: GeoDistrict): number {
  const byBase = a.nameEn.localeCompare(b.nameEn, 'en', { sensitivity: 'base' });
  if (byBase !== 0) return byBase;
  const byExact = a.nameEn.localeCompare(b.nameEn, 'en');
  if (byExact !== 0) return byExact;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

@Component({
  selector: 'app-districts-tab',
  imports: [
    TranslocoPipe,
    ActionsMenu,
    Button,
    ConfirmDialog,
    Dropdown,
    Field,
    Modal,
    PlaceFormModal,
    Segmented,
    SuggestInput,
    SettingsFrame,
    Switch,
  ],
  providers: [
    provideTranslocoScope({ scope: 'ws-geo', alias: 'wsGeo' }, 'settings', {
      scope: 'ws-geo-places',
      alias: 'geoPlaces',
    }),
    provideIcons({
      tablerAlertTriangle,
              tablerEye,
      tablerHome,
      tablerPencil,
          tablerToggleRight,
      tablerTrash,
    }),
  ],
  templateUrl: './districts-tab.html',
  host: {
    class: 'flex flex-1 shrink-0 flex-col',
  },
})
export class DistrictsTab {
  private readonly api = inject(GeoAdminApi);
  private static nextId = 0;
  protected readonly uid = `districts-tab-${++DistrictsTab.nextId}`;

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

  private readonly session = inject(AuthSession);
  protected readonly canManage = computed(
    () => placesEditable(this.session.me()) && !this.api.placesDenied(),
  );
  protected readonly citySearchMax = GEO_LIMITS.name;
  protected readonly skeletonRows = SKELETON_ROWS;

  protected readonly countries = signal<GeoCountry[]>([]);
  protected readonly states = signal<GeoState[]>([]);
  protected readonly cityOptionsList = signal<GeoCity[]>([]);
  protected readonly cachedCity = signal<GeoCity | CityWithPath | null>(null);
  protected readonly districts = signal<GeoDistrict[]>([]);
  protected readonly nextCursor = signal<string | null>(null);

  protected readonly search = signal('');
  protected readonly debouncedSearch = signal('');
  protected readonly kindFilter = signal<KindFilter>('ALL');
  protected readonly showInactive = signal(false);

  protected readonly loading = signal(false);
  protected readonly loadingMore = signal(false);
  protected readonly loadFailed = signal(false);
  protected readonly busy = signal(false);
  protected readonly togglingIds = signal<ReadonlySet<string>>(new Set());

  protected readonly citySearchText = signal('');
  protected readonly cityLookupCursor = signal<string | null>(null);
  protected readonly cityLookupLoading = signal(false);
  protected readonly cityLookupFailed = signal(false);
  protected readonly citySuggestions = computed(() =>
    this.cityOptionsList().map((city) => this.citySuggestion(city)),
  );

  protected readonly deletingDistrict = signal<GeoDistrict | null>(null);
  protected readonly inUseState = signal<{ district: GeoDistrict } | null>(null);
  protected readonly deactivating = signal(false);

  private statesLoadedCountryId: string | null = null;
  private citiesLoadedStateId: string | null = null;
  private statesSeq = 0;
  private citiesLookupSeq = 0;
  private cityLookupSearch = '';
  private cityResolveSeq = 0;
  private districtsSeq = 0;
  private cursorContext = '';
  private searchTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly actionKeys = new ActionKeys(newIdempotencyKey);
  private citySearchTimer: ReturnType<typeof setTimeout> | null = null;

  protected readonly countryId = computed(() => this.queryParams()?.get('country') ?? '');
  protected readonly stateId = computed(() => this.queryParams()?.get('state') ?? '');
  protected readonly cityId = computed(() => this.queryParams()?.get('city') ?? '');

  protected readonly selectedCountry = computed(
    () => this.countries().find((item) => item.id === this.countryId()) ?? null,
  );
  protected readonly selectedState = computed(
    () => this.states().find((item) => item.id === this.stateId()) ?? null,
  );
  protected readonly selectedCity = computed(() => {
    const id = this.cityId();
    if (!id) return null;
    const fromList = this.cityOptionsList().find((item) => item.id === id);
    if (fromList) return fromList;
    const cached = this.cachedCity();
    return cached?.id === id ? cached : null;
  });
  protected readonly selectedCityId = computed(() => this.selectedCity()?.id ?? '');

  protected readonly selectedCityLabel = computed(() => {
    const city = this.selectedCity();
    return city ? geoNameIn(city, this.language()) : '';
  });

  protected readonly locationPath = computed(() => {
    const lang = this.language();
    const city = this.selectedCity();
    const state = this.selectedState();
    const country = this.selectedCountry();
    return [
      city ? geoNameIn(city, lang) : '',
      state ? geoNameIn(state, lang) : '',
      country ? geoNameIn(country, lang) : '',
    ]
      .filter(Boolean)
      .join(' · ');
  });

  protected readonly countryOptions = computed<DropdownOption<string>[]>(() => {
    const lang = this.language();
    return this.countries()
      .slice()
      .sort((a, b) =>
        geoNameIn(a, lang).localeCompare(geoNameIn(b, lang), lang, { sensitivity: 'base' }),
      )
      .map((item) => ({ value: item.id, label: geoNameIn(item, lang) }));
  });

  protected readonly stateOptions = computed<DropdownOption<string>[]>(() => {
    const lang = this.language();
    return this.states()
      .slice()
      .sort((a, b) =>
        geoNameIn(a, lang).localeCompare(geoNameIn(b, lang), lang, { sensitivity: 'base' }),
      )
      .map((item) => ({ value: item.id, label: geoNameIn(item, lang) }));
  });

  protected readonly kindFilterOptions = computed<SegmentedOption[]>(() => {
    this.i18n();
    return [
      { value: 'ALL', label: this.transloco.translate('geoPlaces.filters.kindAll') },
      { value: 'DISTRICT', label: this.transloco.translate('geoPlaces.filters.kindDistrict') },
      { value: 'VILLAGE', label: this.transloco.translate('geoPlaces.filters.kindVillage') },
    ];
  });

  protected readonly gridColumns = computed(() =>
    this.canManage() ? 'grid-cols-geo-district-row-actions' : 'grid-cols-geo-district-row',
  );

  /** The API lists inactive places too; the switch only hides them on screen. */
  protected readonly visibleDistricts = computed(() =>
    this.showInactive()
      ? this.districts()
      : this.districts().filter((district) => district.isActive),
  );

  protected readonly deletingName = computed(() => {
    const target = this.deletingDistrict();
    return target ? geoNameIn(target, this.language()) : '';
  });

  constructor() {
    void this.loadCountriesLookup();

    effect(() => {
      const country = this.countryId();
      if (country === this.statesLoadedCountryId) return;
      this.statesLoadedCountryId = country;
      untracked(() => {
        void this.loadStatesForCountry(country);
      });
    });

    effect(() => {
      const state = this.stateId();
      if (state === this.citiesLoadedStateId) return;
      this.citiesLoadedStateId = state;
      untracked(() => {
        this.citySearchText.set('');
        void this.loadCitiesForState(state, '');
      });
    });

    effect(() => {
      const cityId = this.cityId();
      const countries = this.countries();
      untracked(() => {
        if (!cityId) {
          this.cityResolveSeq++;
          this.cachedCity.set(null);
          return;
        }
        const fromList = this.cityOptionsList().find((item) => item.id === cityId);
        if (fromList && this.countryId() && this.stateId()) {
          this.cachedCity.set(fromList);
          return;
        }
        if (this.cachedCity()?.id !== cityId || !this.countryId() || !this.stateId()) {
          void this.resolveCityContext(cityId, countries);
        }
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
      const cityId = this.selectedCityId();
      const term = this.debouncedSearch();
      const kind = this.kindFilter();
      untracked(() => {
        if (!cityId) {
          this.districtsSeq++;
          this.districts.set([]);
          this.nextCursor.set(null);
          this.loading.set(false);
          this.loadFailed.set(false);
          return;
        }
        void this.loadDistricts(cityId, term, kind, true);
      });
    });

    inject(DestroyRef).onDestroy(() => {
      if (this.searchTimer !== null) clearTimeout(this.searchTimer);
      if (this.citySearchTimer !== null) clearTimeout(this.citySearchTimer);
    });
  }

  protected onCountryChange(nextCountry: string): void {
    if (nextCountry === this.countryId()) return;
    this.nextCursor.set(null);
    this.districtsSeq++;
    this.cachedCity.set(null);
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
    this.nextCursor.set(null);
    this.districtsSeq++;
    this.cachedCity.set(null);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        state: nextState || null,
        city: null,
      },
      queryParamsHandling: 'merge',
    });
  }

  protected onKindFilterChange(next: string | null): void {
    if (next === 'ALL' || next === 'DISTRICT' || next === 'VILLAGE') {
      this.kindFilter.set(next);
    }
  }

  protected onShowInactiveChange(checked: boolean): void {
    this.showInactive.set(checked);
    const cityId = this.selectedCityId();
    if (cityId) void this.loadDistricts(cityId, this.debouncedSearch(), this.kindFilter(), true);
  }

  private citySuggestion(city: GeoCity): string {
    return `${geoNameIn(city, this.language())} · ${this.language() === 'ar' ? city.nameEn : city.nameAr}`;
  }

  protected onCitySearchChange(value: string): void {
    this.citySearchText.set(value);
    this.clearCitySearchTimer();
    const city = this.cityOptionsList().find((item) => this.citySuggestion(item) === value);
    if (city) {
      this.cachedCity.set(city);
      void this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { city: city.id },
        queryParamsHandling: 'merge',
      });
      return;
    }
    this.cityLookupCursor.set(null);
    this.citiesLookupSeq++;
    if (!value) {
      this.cachedCity.set(null);
      void this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { city: null },
        queryParamsHandling: 'merge',
      });
    }
    this.citySearchTimer = setTimeout(() => {
      this.citySearchTimer = null;
      void this.loadCitiesForState(this.stateId(), value.trim().slice(0, GEO_LIMITS.name));
    }, CITY_SEARCH_DEBOUNCE_MS);
  }

  protected loadMoreCityOptions(): void {
    if (!this.cityLookupCursor() || this.cityLookupLoading()) return;
    void this.loadCitiesForState(this.stateId(), this.cityLookupSearch, true);
  }

  protected formatDate(iso: string): string {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return iso;
    return new Intl.DateTimeFormat(this.language() + '-u-nu-latn', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(date);
  }

  protected cityOptionLabel(city: GeoCity): string {
    return geoNameIn(city, this.language());
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
    const city = this.selectedCity();
    if (!city) {
      void this.loadCountriesLookup();
      if (this.countryId()) void this.loadStatesForCountry(this.countryId());
      if (this.stateId()) void this.loadCitiesForState(this.stateId(), '');
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
    void this.loadDistricts(city.id, term, this.kindFilter(), true);
  }

  protected loadMore(): void {
    const city = this.selectedCity();
    const cursor = this.nextCursor();
    if (!city || !cursor || this.loading() || this.loadingMore()) return;
    void this.loadDistricts(city.id, this.debouncedSearch(), this.kindFilter(), false);
  }

  protected openCreate(): void {
    const city = this.selectedCity();
    if (!this.canManage() || !city) return;
    const defaultKind: GeoDistrictKind = this.kindFilter() === 'VILLAGE' ? 'VILLAGE' : 'DISTRICT';
    this.placeModal().openCreateDistrict({
      cityId: city.id,
      locationPath: this.locationPath(),
      defaultKind,
    });
  }

  protected openEdit(district: GeoDistrict): void {
    this.placeModal().openEditDistrict(district, { locationPath: this.locationPath() });
  }

  protected onRowClick(district: GeoDistrict, event: Event): void {
    const target = event.target as HTMLElement | null;
    if (target?.closest('button, a, [data-row-action]')) return;
    this.openEdit(district);
  }

  protected rowActions(district: GeoDistrict): ActionItem[] {
    this.i18n();
    const t = (key: string) => this.transloco.translate(key);
    const toggleDisabled = this.togglingIds().has(district.id) || this.busy();

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
        id: 'toggleActive',
        title: t(district.isActive ? 'geoPlaces.actions.deactivate' : 'geoPlaces.actions.activate'),
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

  protected onRowAction(district: GeoDistrict, selection: ActionSelection): void {
    switch (selection.id) {
      case 'open':
      case 'edit':
        this.openEdit(district);
        break;
      case 'toggleActive':
        void this.toggleActive(district);
        break;
      case 'delete':
        void this.requestDelete(district);
        break;
    }
  }

  protected onDistrictSaved(event: { district: GeoDistrict; isNew: boolean }): void {
    const saved = event.district;
    if (saved.cityId !== this.cityId()) return;

    const kind = this.kindFilter();
    const matchesKind = kind === 'ALL' || saved.kind === kind;

    if (event.isNew) {
      if (!matchesKind || !containsSearch(saved, this.debouncedSearch())) return;
      this.districts.update((list) => {
        if (list.some((item) => item.id === saved.id)) {
          return list
            .map((item) => (item.id === saved.id ? saved : item))
            .sort(compareDistrictsByNameEn);
        }
        const last = list.at(-1);
        if (!this.nextCursor() || !last || compareDistrictsByNameEn(saved, last) <= 0) {
          return [...list, saved].sort(compareDistrictsByNameEn);
        }
        return list;
      });
      return;
    }

    this.applyDistrictUpdate(saved);
  }

  protected onDistrictNotFound(id: string): void {
    if (id === this.cityId()) {
      this.handleMissingCity(id);
      return;
    }
    this.removeDistrictFromList(id);
  }

  protected async requestDelete(district: GeoDistrict): Promise<void> {
    if (!this.canManage() || this.busy()) return;
    this.deletingDistrict.set(district);
    const confirmed = await this.confirmDelete().open();
    if (!confirmed) {
      this.deletingDistrict.set(null);
      return;
    }

    this.busy.set(true);
    try {
      const signature = `delete:district:${district.id}`;
      await this.api.deleteDistrict(district.id, this.actionKeys.keyFor(signature));
      this.actionKeys.done(signature);
      this.placeModal().close();
      this.removeDistrictFromList(district.id);
      this.notify.success(this.transloco.translate('geoPlaces.delete.done'));
    } catch (error) {
      const code = errorCodeOf(error);
      if (code === 'GEO_DISTRICT_IN_USE') {
        this.placeModal().close();
        this.inUseState.set({ district });
        this.inUseModal().open();
        return;
      }
      this.showErrorToast(error, true);
      if (code === 'GEO_DISTRICT_NOT_FOUND') {
        this.placeModal().close();
        this.onDistrictNotFound(district.id);
      }
    } finally {
      this.busy.set(false);
      this.deletingDistrict.set(null);
    }
  }

  protected closeInUseModal(): void {
    this.inUseModal().close();
    this.inUseState.set(null);
  }

  protected async deactivateInUseDistrict(): Promise<void> {
    const state = this.inUseState();
    if (!state || !this.canManage() || this.deactivating()) return;

    this.deactivating.set(true);
    try {
      const signature = `toggle:district:${state.district.id}:false`;
      const updated = await this.api.updateDistrict(
        state.district.id,
        { isActive: false },
        this.actionKeys.keyFor(signature),
      );
      this.actionKeys.done(signature);
      this.applyDistrictUpdate(updated);
      this.notify.success(this.transloco.translate('geoPlaces.saved'));
      this.closeInUseModal();
    } catch (error) {
      this.showErrorToast(error, true);
      if (errorCodeOf(error) === 'GEO_DISTRICT_NOT_FOUND') {
        this.onDistrictNotFound(state.district.id);
        this.closeInUseModal();
      }
    } finally {
      this.deactivating.set(false);
    }
  }

  private async toggleActive(district: GeoDistrict): Promise<void> {
    if (!this.canManage() || this.busy() || this.togglingIds().has(district.id)) return;
    this.togglingIds.update((set) => new Set(set).add(district.id));
    try {
      const signature = `toggle:district:${district.id}:${!district.isActive}`;
      const updated = await this.api.updateDistrict(
        district.id,
        { isActive: !district.isActive },
        this.actionKeys.keyFor(signature),
      );
      this.actionKeys.done(signature);
      this.applyDistrictUpdate(updated);
      this.notify.success(this.transloco.translate('geoPlaces.saved'));
    } catch (error) {
      this.showErrorToast(error, true);
      if (errorCodeOf(error) === 'GEO_DISTRICT_NOT_FOUND') {
        this.onDistrictNotFound(district.id);
      }
    } finally {
      this.togglingIds.update((set) => {
        const next = new Set(set);
        next.delete(district.id);
        return next;
      });
    }
  }

  private applyDistrictUpdate(updated: GeoDistrict): void {
    const kind = this.kindFilter();
    if (kind !== 'ALL' && updated.kind !== kind) {
      this.removeDistrictFromList(updated.id);
      return;
    }
    this.districts.update((list) =>
      list.map((item) => (item.id === updated.id ? updated : item)).sort(compareDistrictsByNameEn),
    );
  }

  private removeDistrictFromList(districtId: string): void {
    this.districts.update((list) => list.filter((item) => item.id !== districtId));
  }

  private handleMissingCity(cityId: string): void {
    this.cityResolveSeq++;
    this.cachedCity.set(null);
    this.cityOptionsList.update((list) => list.filter((item) => item.id !== cityId));
    this.loadFailed.set(false);
    this.districts.set([]);
    this.nextCursor.set(null);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { city: null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  private async loadCountriesLookup(): Promise<void> {
    try {
      this.countries.set((await this.api.listCountries()).items);
    } catch (error) {
      this.showErrorToast(error);
    }
  }

  private async loadStatesForCountry(countryId: string): Promise<void> {
    const seq = ++this.statesSeq;
    this.states.set([]);
    if (!countryId) {
      this.states.set([]);
      return;
    }
    try {
      const { items: loaded } = await this.api.listStates(countryId);
      if (seq !== this.statesSeq) return;
      this.states.set(loaded);
      const currentState = this.stateId();
      if (currentState && !loaded.some((item) => item.id === currentState)) {
        this.cachedCity.set(null);
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

  private async loadCitiesForState(stateId: string, search: string, append = false): Promise<void> {
    const seq = ++this.citiesLookupSeq;
    const cursor = append ? this.cityLookupCursor() : null;
    this.cityLookupSearch = search;
    if (!append) {
      this.cityOptionsList.set([]);
      this.cityLookupCursor.set(null);
    }
    if (!stateId) return;
    this.cityLookupLoading.set(true);
    this.cityLookupFailed.set(false);
    try {
      const page = await this.api.listCities(stateId, {
        search,
        cursor,
        limit: GEO_LIMITS.pageSize,
      });
      if (seq !== this.citiesLookupSeq) return;
      this.cityOptionsList.update((items) =>
        append && !page.cursorReset
          ? [...items, ...page.items.filter((city) => !items.some((item) => item.id === city.id))]
          : page.items,
      );
      this.cityLookupCursor.set(page.nextCursor);
      const selected = this.cityOptionsList().find((city) => city.id === this.cityId());
      if (selected) this.cachedCity.set(selected);
    } catch (error) {
      if (seq !== this.citiesLookupSeq) return;
      this.cityLookupFailed.set(true);
      this.showErrorToast(error);
    } finally {
      if (seq === this.citiesLookupSeq) this.cityLookupLoading.set(false);
    }
  }

  private async resolveCityContext(cityId: string, knownCountries: GeoCountry[]): Promise<void> {
    const seq = ++this.cityResolveSeq;
    try {
      const resolved = await this.api.getCitiesByIds([cityId]);
      if (seq !== this.cityResolveSeq || this.cityId() !== cityId) return;
      const item = resolved[0];
      if (!item) {
        this.cachedCity.set(null);
        void this.router.navigate([], {
          relativeTo: this.route,
          queryParams: { city: null },
          queryParamsHandling: 'merge',
          replaceUrl: true,
        });
        return;
      }

      this.cachedCity.set(item);
      const countries = knownCountries.length
        ? knownCountries
        : (await this.api.listCountries()).items;
      if (seq !== this.cityResolveSeq || this.cityId() !== cityId) return;
      if (!knownCountries.length) this.countries.set(countries);

      const ownerCountry = countries.find((c) => c.id === item.countryId);
      const needsCountry = ownerCountry && this.countryId() !== ownerCountry.id;
      const needsState = this.stateId() !== item.stateId;
      if (needsCountry || needsState) {
        void this.router.navigate([], {
          relativeTo: this.route,
          queryParams: {
            country: ownerCountry ? ownerCountry.id : this.countryId() || null,
            state: item.stateId,
          },
          queryParamsHandling: 'merge',
          replaceUrl: true,
        });
      }
    } catch {
      // Keep current state if city lookup temporarily fails.
    }
  }

  private async loadDistricts(
    cityId: string,
    search: string,
    kind: KindFilter,
    reset: boolean,
  ): Promise<void> {
    const context = JSON.stringify([cityId, search, kind]);
    reset = reset || context !== this.cursorContext;
    this.cursorContext = context;
    const seq = ++this.districtsSeq;
    const cursor = reset ? null : this.nextCursor();

    if (reset) {
      this.nextCursor.set(null);
      this.loadingMore.set(false);
      this.loading.set(true);
      this.loadFailed.set(false);
    } else {
      this.loadingMore.set(true);
    }

    try {
      const page = await this.api.listDistricts(cityId, {
        search: search || undefined,
        cursor,
        limit: GEO_LIMITS.pageSize,
        kind: kind === 'ALL' ? undefined : kind,
      });
      if (seq !== this.districtsSeq) return;
      this.districts.update((current) => {
        if (reset || page.cursorReset) return page.items;
        const seen = new Set(current.map((item) => item.id));
        return [...current, ...page.items.filter((item) => !seen.has(item.id))];
      });
      this.nextCursor.set(page.nextCursor);
      this.notify.connectionRestored();
    } catch (error) {
      if (seq !== this.districtsSeq) return;
      if (errorCodeOf(error) === 'GEO_CITY_NOT_FOUND') {
        this.showErrorToast(error);
        this.handleMissingCity(cityId);
        return;
      }
      if (reset) {
        this.showErrorToast(error);
        this.loadFailed.set(true);
        this.districts.set([]);
        this.nextCursor.set(null);
      } else {
        this.showErrorToast(error);
      }
    } finally {
      if (seq === this.districtsSeq) {
        this.loading.set(false);
        this.loadingMore.set(false);
      }
    }
  }

  private clearCitySearchTimer(): void {
    if (this.citySearchTimer !== null) {
      clearTimeout(this.citySearchTimer);
      this.citySearchTimer = null;
    }
  }

  private showErrorToast(error: unknown, write = false): void {
    if (errorCodeOf(error) === 'TENANT_WIDE_PERMISSION_REQUIRED') this.api.placesDenied.set(true);
    const message = geoErrorMessage(error, 'geoPlaces', this.transloco, write);
    if (error instanceof ApiError && error.status === 0) this.notify.connectionLost(message, '');
    else this.notify.error(message);
  }
}
