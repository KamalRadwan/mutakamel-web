import {
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  effect,
  inject,
  signal,
  untracked,
  viewChild,
  viewChildren,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerAlertTriangle,
  tablerCheck,
  tablerChevronDown,
  tablerEye,
  tablerHome,
  tablerPencil,
  tablerSearch,
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
import { rectInPage, viewport } from '../../../../../shared/ui/overlay/zoom';
import { Segmented, SegmentedOption } from '../../../../../shared/ui/segmented/segmented';
import { Switch } from '../../../../../shared/ui/switch/switch';
import { SettingsFrame } from '../../../../../shared/ui/settings-frame/settings-frame';
import { ApiError, errorCodeOf, errorMessage } from '../../../../../core/api/api-errors';
import {
  GEO_LIMITS,
  GeoCity,
  GeoCountry,
  GeoDistrict,
  GeoDistrictKind,
  GeoState,
  deleteDistrict,
  geoNameIn,
  getCitiesByIds,
  listCities,
  listCountries,
  listDistricts,
  listStates,
  updateDistrict,
} from '../geo-admin.api';
import { PlaceFormModal } from '../place-form-modal/place-form-modal';
import { newIdempotencyKey } from '../../../../../core/api/idempotency';
import { ActionKeys } from '../../core-response.model';

const CAN_MANAGE = true; // later from permission core.geo.manage
const SEARCH_DEBOUNCE_MS = 300;
const CITY_SEARCH_DEBOUNCE_MS = 250;
const SKELETON_ROWS = [0, 1, 2, 3, 4] as const;

/** The list search: a literal, case-insensitive substring of either name, as GeoService filters. */
function containsSearch(item: { nameEn: string; nameAr: string }, search: string): boolean {
  const term = search.trim().toLowerCase();
  return !term || item.nameEn.toLowerCase().includes(term) || item.nameAr.toLowerCase().includes(term);
}

type KindFilter = 'ALL' | GeoDistrictKind;

interface CityPopoverPlace {
  top: number;
  start: number;
  width: number;
  maxHeight: number | null;
}

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
    NgIcon,
    TranslocoPipe,
    ActionsMenu,
    Button,
    ConfirmDialog,
    Dropdown,
    Field,
    Modal,
    PlaceFormModal,
    Segmented,
    SettingsFrame,
    Switch,
  ],
  providers: [
    provideTranslocoScope({ scope: 'ws-geo', alias: 'wsGeo' }, 'settings', { scope: 'ws-geo-places', alias: 'geoPlaces' }),
    provideIcons({
      tablerAlertTriangle,
      tablerCheck,
      tablerChevronDown,
      tablerEye,
      tablerHome,
      tablerPencil,
      tablerSearch,
      tablerToggleRight,
      tablerTrash,
    }),
  ],
  templateUrl: './districts-tab.html',
  host: {
    class: 'flex min-h-0 flex-1 flex-col',
    '(document:click)': 'closeCityPickerIfOutside($event)',
    '(window:resize)': 'closeCityPicker()',
  },
})
export class DistrictsTab {
  private static nextId = 0;
  protected readonly uid = `districts-tab-${++DistrictsTab.nextId}`;

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
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
  private readonly cityTrigger = viewChild<ElementRef<HTMLButtonElement>>('cityTrigger');
  private readonly cityPopover = viewChild<ElementRef<HTMLElement>>('cityPopover');
  private readonly citySearchInput = viewChild<ElementRef<HTMLInputElement>>('citySearchInput');
  private readonly cityOptionItems = viewChildren<ElementRef<HTMLElement>>('cityOptionItem');

  protected readonly canManage = CAN_MANAGE;
  protected readonly skeletonRows = SKELETON_ROWS;

  protected readonly countries = signal<GeoCountry[]>([]);
  protected readonly states = signal<GeoState[]>([]);
  protected readonly cityOptionsList = signal<GeoCity[]>([]);
  protected readonly cachedCity = signal<GeoCity | null>(null);
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

  protected readonly cityPickerOpen = signal(false);
  protected readonly cityPickerPlaced = signal(false);
  protected readonly cityPickerPlace = signal<CityPopoverPlace>({ top: 0, start: 0, width: 0, maxHeight: null });
  protected readonly citySearchText = signal('');
  protected readonly cityActiveIndex = signal(-1);

  protected readonly deletingDistrict = signal<GeoDistrict | null>(null);
  protected readonly inUseState = signal<{ district: GeoDistrict } | null>(null);
  protected readonly deactivating = signal(false);

  private statesLoadedCountryId: string | null = null;
  private citiesLoadedStateId: string | null = null;
  private statesSeq = 0;
  private citiesLookupSeq = 0;
  private cityResolveSeq = 0;
  private cityPopoverSeq = 0;
  private districtsSeq = 0;
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

  protected readonly kindFilterOptions = computed<SegmentedOption[]>(() => {
    this.i18n();
    return [
      { value: 'ALL', label: this.transloco.translate('geoPlaces.filters.kindAll') },
      { value: 'DISTRICT', label: this.transloco.translate('geoPlaces.filters.kindDistrict') },
      { value: 'VILLAGE', label: this.transloco.translate('geoPlaces.filters.kindVillage') },
    ];
  });

  protected readonly gridColumns = computed(() =>
    this.canManage
      ? 'grid-cols-geo-district-row-actions'
      : 'grid-cols-geo-district-row',
  );

  /** The API lists inactive places too; the switch only hides them on screen. */
  protected readonly visibleDistricts = computed(() =>
    this.showInactive() ? this.districts() : this.districts().filter((district) => district.isActive),
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
        this.closeCityPicker();
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

    const onScroll = (event: Event) => {
      if (!this.cityPickerOpen()) return;
      const target = event.target;
      if (target instanceof Node && this.cityPopover()?.nativeElement.contains(target)) return;
      this.closeCityPicker();
    };
    document.addEventListener('scroll', onScroll, { capture: true, passive: true });
    inject(DestroyRef).onDestroy(() => {
      document.removeEventListener('scroll', onScroll, { capture: true });
      if (this.searchTimer !== null) clearTimeout(this.searchTimer);
      if (this.citySearchTimer !== null) clearTimeout(this.citySearchTimer);
    });
  }

  protected onCountryChange(nextCountry: string): void {
    if (nextCountry === this.countryId()) return;
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
  }

  protected toggleCityPicker(): void {
    if (!this.selectedState()) return;
    if (this.cityPickerOpen()) {
      this.closeCityPicker();
      return;
    }
    const trigger = this.cityTrigger()?.nativeElement;
    if (!trigger) return;

    const seq = ++this.cityPopoverSeq;
    this.clearCitySearchTimer();
    this.citySearchText.set('');
    this.cityActiveIndex.set(-1);
    this.cityPickerPlaced.set(false);
    this.cityPickerPlace.set(this.initialCityPlace(trigger));
    this.cityPickerOpen.set(true);

    void this.loadCitiesForState(this.stateId(), '');

    afterNextRender(
      () => {
        this.placeCityPopover(seq, trigger);
        this.citySearchInput()?.nativeElement.focus();
      },
      { injector: this.injector },
    );
  }

  protected closeCityPicker(): void {
    this.cityPopoverSeq++;
    this.clearCitySearchTimer();
    this.cityPickerOpen.set(false);
    this.cityPickerPlaced.set(false);
  }

  protected closeCityPickerIfOutside(event: Event): void {
    if (!this.cityPickerOpen()) return;
    const target = event.target;
    if (!(target instanceof Node)) {
      this.closeCityPicker();
      return;
    }
    if (
      this.cityTrigger()?.nativeElement.contains(target) ||
      this.cityPopover()?.nativeElement.contains(target)
    ) {
      return;
    }
    this.closeCityPicker();
  }

  protected onCityTriggerKeydown(event: KeyboardEvent): void {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!this.cityPickerOpen()) {
        this.toggleCityPicker();
      }
    }
  }

  protected onCitySearchInput(event: Event): void {
    const query = (event.target as HTMLInputElement).value;
    this.citySearchText.set(query);
    this.cityActiveIndex.set(query.trim() ? 0 : -1);

    this.clearCitySearchTimer();
    const state = this.stateId();
    if (!state) return;
    this.citySearchTimer = setTimeout(() => {
      this.citySearchTimer = null;
      void this.loadCitiesForState(state, query.trim());
    }, CITY_SEARCH_DEBOUNCE_MS);
  }

  protected onCitySearchKeydown(event: KeyboardEvent): void {
    const options = this.cityOptionsList();
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        if (options.length > 0) {
          const next = this.cityActiveIndex() < 0 ? 0 : (this.cityActiveIndex() + 1) % options.length;
          this.cityActiveIndex.set(next);
          this.cityOptionItems()[next]?.nativeElement.scrollIntoView({ block: 'nearest' });
        }
        break;
      case 'ArrowUp':
        event.preventDefault();
        if (options.length > 0) {
          const prev =
            this.cityActiveIndex() < 0 ? options.length - 1 : (this.cityActiveIndex() - 1 + options.length) % options.length;
          this.cityActiveIndex.set(prev);
          this.cityOptionItems()[prev]?.nativeElement.scrollIntoView({ block: 'nearest' });
        }
        break;
      case 'Home':
        if (options.length > 0) {
          event.preventDefault();
          this.cityActiveIndex.set(0);
          this.cityOptionItems()[0]?.nativeElement.scrollIntoView({ block: 'nearest' });
        }
        break;
      case 'End':
        if (options.length > 0) {
          event.preventDefault();
          const last = options.length - 1;
          this.cityActiveIndex.set(last);
          this.cityOptionItems()[last]?.nativeElement.scrollIntoView({ block: 'nearest' });
        }
        break;
      case 'Enter': {
        event.preventDefault();
        const option = options[this.cityActiveIndex()];
        if (option) {
          this.selectCityOption(option);
        }
        break;
      }
    }
  }

  protected onCityPopoverKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      this.closeCityPicker();
      this.cityTrigger()?.nativeElement.focus();
    }
  }

  protected onCityPopoverFocusOut(event: FocusEvent): void {
    const next = event.relatedTarget as Node | null;
    if (next && this.cityPopover()?.nativeElement.contains(next)) return;
    if (next) {
      this.closeCityPicker();
    }
  }

  protected selectCityOption(city: GeoCity): void {
    this.cachedCity.set(city);
    this.closeCityPicker();
    this.cityTrigger()?.nativeElement.focus();
    if (city.id === this.cityId()) return;
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { city: city.id },
      queryParamsHandling: 'merge',
    });
  }

  protected formatDate(iso: string): string {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return iso;
    return new Intl.DateTimeFormat(this.language() + '-u-nu-latn', { day: 'numeric', month: 'short', year: 'numeric' }).format(date);
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
    if (!this.canManage || !city) return;
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
          return list.map((item) => (item.id === saved.id ? saved : item)).sort(compareDistrictsByNameEn);
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
    if (!this.canManage || this.busy()) return;
    this.deletingDistrict.set(district);
    const confirmed = await this.confirmDelete().open();
    if (!confirmed) {
      this.deletingDistrict.set(null);
      return;
    }

    this.busy.set(true);
    try {
      const signature = `delete:${district.id}`;
      await deleteDistrict(district.id, this.actionKeys.keyFor(signature));
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
      this.showErrorToast(error);
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
    if (!state || this.deactivating()) return;

    this.deactivating.set(true);
    try {
      const signature = `active:${state.district.id}:false`;
      const updated = await updateDistrict(state.district.id, { isActive: false }, this.actionKeys.keyFor(signature));
      this.actionKeys.done(signature);
      this.applyDistrictUpdate(updated);
      this.notify.success(this.transloco.translate('geoPlaces.saved'));
      this.closeInUseModal();
    } catch (error) {
      this.showErrorToast(error);
      if (errorCodeOf(error) === 'GEO_DISTRICT_NOT_FOUND') {
        this.onDistrictNotFound(state.district.id);
        this.closeInUseModal();
      }
    } finally {
      this.deactivating.set(false);
    }
  }

  private async toggleActive(district: GeoDistrict): Promise<void> {
    if (!this.canManage || this.busy() || this.togglingIds().has(district.id)) return;
    this.togglingIds.update((set) => new Set(set).add(district.id));
    try {
      const signature = `active:${district.id}:${!district.isActive}`;
      const updated = await updateDistrict(district.id, { isActive: !district.isActive }, this.actionKeys.keyFor(signature));
      this.actionKeys.done(signature);
      this.applyDistrictUpdate(updated);
      this.notify.success(this.transloco.translate('geoPlaces.saved'));
    } catch (error) {
      this.showErrorToast(error);
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
      this.countries.set((await listCountries()).items);
    } catch (error) {
      this.showErrorToast(error);
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

  private async loadCitiesForState(stateId: string, search: string): Promise<void> {
    const seq = ++this.citiesLookupSeq;
    if (!stateId) {
      this.cityOptionsList.set([]);
      return;
    }
    try {
      const items: GeoCity[] = [];
      const seen = new Set<string>();
      let cursor: string | null = null;
      do {
        const page = await listCities(stateId, {
          search: search || undefined,
          cursor,
          limit: GEO_LIMITS.pageMax,
        });
        if (seq !== this.citiesLookupSeq) return;
        for (const item of page.items) {
          if (!seen.has(item.id)) {
            seen.add(item.id);
            items.push(item);
          }
        }
        if (page.items.length === 0) break;
        cursor = page.nextCursor;
      } while (cursor);

      this.cityOptionsList.set(items);
      const currentCityId = this.cityId();
      const matched = currentCityId ? items.find((item) => item.id === currentCityId) : undefined;
      if (matched) {
        this.cachedCity.set(matched);
      }
    } catch {
      if (seq === this.citiesLookupSeq && !search) {
        this.cityOptionsList.set([]);
      }
    }
  }

  private async resolveCityContext(cityId: string, knownCountries: GeoCountry[]): Promise<void> {
    const seq = ++this.cityResolveSeq;
    try {
      const resolved = await getCitiesByIds([cityId]);
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
      const countries = knownCountries.length ? knownCountries : (await listCountries()).items;
      if (seq !== this.cityResolveSeq || this.cityId() !== cityId) return;
      if (!knownCountries.length) this.countries.set(countries);

      const ownerCountry = countries.find((c) => c.iso2 === item.countryIso2);
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
    const seq = ++this.districtsSeq;
    const cursor = reset ? null : this.nextCursor();

    if (reset) {
      this.loading.set(true);
      this.loadFailed.set(false);
    } else {
      this.loadingMore.set(true);
    }

    try {
      const page = await listDistricts(cityId, {
        search: search || undefined,
        cursor,
        limit: GEO_LIMITS.pageSize,
        kind: kind === 'ALL' ? undefined : kind,
      });
      if (seq !== this.districtsSeq) return;
      this.districts.update((current) => {
        if (reset) return page.items;
        const seen = new Set(current.map((item) => item.id));
        return [...current, ...page.items.filter((item) => !seen.has(item.id))];
      });
      this.nextCursor.set(page.nextCursor);
    } catch (error) {
      if (seq !== this.districtsSeq) return;
      if (errorCodeOf(error) === 'GEO_CITY_NOT_FOUND') {
        this.showErrorToast(error);
        this.handleMissingCity(cityId);
        return;
      }
      if (reset) {
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

  private initialCityPlace(trigger: HTMLElement): CityPopoverPlace {
    const rect = rectInPage(trigger);
    const { width } = viewport();
    const rtl = getComputedStyle(this.host.nativeElement).direction === 'rtl';
    return {
      top: rect.bottom + 4,
      start: rtl ? width - rect.right : rect.left,
      width: rect.width,
      maxHeight: null,
    };
  }

  private placeCityPopover(seq: number, trigger: HTMLElement): void {
    if (seq !== this.cityPopoverSeq || !this.cityPickerOpen() || this.cityPickerPlaced()) return;
    const popoverEl = this.cityPopover()?.nativeElement;
    if (!popoverEl) return;

    const rect = rectInPage(trigger);
    const listRect = rectInPage(popoverEl);
    const { width, height } = viewport();
    const rtl = getComputedStyle(this.host.nativeElement).direction === 'rtl';

    const belowTop = rect.bottom + 4;
    const spaceBelow = Math.max(8, height - 8 - belowTop);
    const spaceAbove = Math.max(8, rect.top - 12);
    const flipUp = listRect.height > spaceBelow && spaceAbove > spaceBelow;
    const avail = flipUp ? spaceAbove : spaceBelow;
    const maxHeight = listRect.height > avail ? avail : null;
    const finalHeight = maxHeight ?? listRect.height;
    const top = flipUp ? Math.max(8, rect.top - 4 - finalHeight) : belowTop;

    const triggerStart = rtl ? width - rect.right : rect.left;
    const triggerEnd = rtl ? width - rect.left : rect.right;
    const alignEnd = triggerStart + listRect.width > width - 8;
    const rawStart = alignEnd ? triggerEnd - listRect.width : triggerStart;
    const start = Math.min(Math.max(8, rawStart), Math.max(8, width - 8 - listRect.width));

    this.cityPickerPlace.set({ top, start, width: rect.width, maxHeight });
    this.cityPickerPlaced.set(true);

    popoverEl.style.top = `${top}px`;
    popoverEl.style.insetInlineStart = `${start}px`;
    popoverEl.style.minWidth = `${rect.width}px`;
    popoverEl.style.maxHeight = maxHeight !== null ? `${maxHeight}px` : '';
    popoverEl.classList.remove('invisible');
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
