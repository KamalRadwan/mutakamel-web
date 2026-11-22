import { NgOptimizedImage } from '@angular/common';
import {
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  model,
  signal,
  untracked,
  viewChild,
  viewChildren,
} from '@angular/core';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerCheck, tablerChevronDown, tablerPlus, tablerSearch } from '@ng-icons/tabler-icons';
import {
  getCity,
  getCountry,
  getDistrict,
  getState,
  listCities,
  listCountries,
  listDistricts,
  listStates,
} from '../../../core/geo/geo.api';
import {
  GeoCity,
  GeoCountry,
  GeoDistrict,
  GeoState,
  geoFlagUrl,
  geoNameIn,
  matchesGeoSearch,
} from '../../../core/geo/geo.model';
import { LanguageState } from '../../../core/i18n/language';
import type { AddressDraft } from '../../../features/crm/leads/lead-form/lead-draft';
import { Field } from '../field/field';
import { rectInPage, viewport } from '../overlay/zoom';
import { PlaceModal, PlaceSavedEvent } from './place-modal/place-modal';

export type AddressValue = AddressDraft;
export type { AddressDraft };

export const EMPTY_ADDRESS: AddressDraft = {
  countryId: null,
  stateId: null,
  cityId: null,
  districtId: null,
  street1: '',
  street2: '',
  buildingNo: '',
  floor: '',
  landmark: '',
  postalCode: '',
};

type PickerKey = 'country' | 'state' | 'city' | 'district';
type TextFieldKey = 'street1' | 'street2' | 'buildingNo' | 'floor' | 'landmark' | 'postalCode';

interface PickerOption {
  id: string;
  label: string;
  iso2?: string;
  kindLabel?: string;
}

interface ListPlace {
  top: number;
  start: number;
  width: number;
  maxHeight: number | null;
}

const REMOTE_THRESHOLD = 300;
const SEARCH_DEBOUNCE_MS = 250;

@Component({
  selector: 'app-address-fields',
  imports: [NgIcon, NgOptimizedImage, TranslocoPipe, Field, PlaceModal],
  providers: [
    provideTranslocoScope({ scope: 'geo', alias: 'geo' }),
    provideIcons({ tablerChevronDown, tablerCheck, tablerSearch, tablerPlus }),
  ],
  templateUrl: './address-fields.html',
  host: {
    class: 'block min-w-0',
    '(document:click)': 'closeIfOutside($event)',
    '(window:resize)': 'closePicker()',
  },
})
export class AddressFields {
  private static nextId = 0;
  protected readonly uid = `ui-address-fields-${++AddressFields.nextId}`;

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  private readonly language = inject(LanguageState).current;
  private readonly transloco = inject(TranslocoService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly countryTrigger = viewChild<ElementRef<HTMLButtonElement>>('countryTrigger');
  private readonly stateTrigger = viewChild<ElementRef<HTMLButtonElement>>('stateTrigger');
  private readonly cityTrigger = viewChild<ElementRef<HTMLButtonElement>>('cityTrigger');
  private readonly districtTrigger = viewChild<ElementRef<HTMLButtonElement>>('districtTrigger');
  private readonly popoverRef = viewChild<ElementRef<HTMLElement>>('popover');
  private readonly searchInputRef = viewChild<ElementRef<HTMLInputElement>>('searchInput');
  private readonly optionItems = viewChildren<ElementRef<HTMLElement>>('optionItem');
  private readonly addPlaceBtn = viewChild<ElementRef<HTMLButtonElement>>('addPlaceBtn');
  private readonly placeModal = viewChild.required(PlaceModal);

  readonly canAddPlaces = input(false);
  readonly disabled = input(false);
  readonly readonly = input(false);
  readonly errors = input<Partial<Record<keyof AddressValue, string>>>({});
  readonly value = model<AddressValue>({ ...EMPTY_ADDRESS });

  protected readonly countries = signal<GeoCountry[]>([]);
  protected readonly states = signal<GeoState[]>([]);
  protected readonly cities = signal<GeoCity[]>([]);
  protected readonly districts = signal<GeoDistrict[]>([]);

  private readonly cachedCountry = signal<GeoCountry | null>(null);
  private readonly cachedState = signal<GeoState | null>(null);
  private readonly cachedCity = signal<GeoCity | null>(null);
  private readonly cachedDistrict = signal<GeoDistrict | null>(null);

  private readonly citiesRemote = signal(false);
  private readonly districtsRemote = signal(false);

  protected readonly openPicker = signal<PickerKey | null>(null);
  protected readonly searchText = signal('');
  protected readonly activeIndex = signal(-1);
  protected readonly placed = signal(false);
  protected readonly place = signal<ListPlace>({ top: 0, start: 0, width: 0, maxHeight: null });

  private listSeq = 0;
  private statesSeq = 0;
  private citiesSeq = 0;
  private districtsSeq = 0;
  private countryCacheSeq = 0;
  private stateCacheSeq = 0;
  private cityCacheSeq = 0;
  private districtCacheSeq = 0;
  private countriesLoaded = false;
  private statesLoadedForCountryId: string | null = null;
  private citiesLoadedForStateId: string | null = null;
  private districtsLoadedForCityId: string | null = null;
  private loadedStatesCountryId: string | null = null;
  private loadedCitiesStateId: string | null = null;
  private loadedDistrictsCityId: string | null = null;
  private addModalKey: 'city' | 'district' | null = null;
  private searchTimer: ReturnType<typeof setTimeout> | null = null;

  protected readonly selectedCountry = computed(() => {
    const id = this.value().countryId;
    if (!id) return null;
    const active = this.countries().find((item) => item.id === id);
    if (active) return active;
    const cached = this.cachedCountry();
    return cached?.id === id ? cached : null;
  });
  protected readonly selectedState = computed(() => {
    const id = this.value().stateId;
    if (!id) return null;
    const active = this.states().find((item) => item.id === id);
    if (active) return active;
    const cached = this.cachedState();
    return cached?.id === id ? cached : null;
  });
  protected readonly selectedCity = computed(() => {
    const id = this.value().cityId;
    if (!id) return null;
    const active = this.cities().find((item) => item.id === id);
    if (active) return active;
    const cached = this.cachedCity();
    return cached?.id === id ? cached : null;
  });
  protected readonly selectedDistrict = computed(() => {
    const id = this.value().districtId;
    if (!id) return null;
    const active = this.districts().find((item) => item.id === id);
    if (active) return active;
    const cached = this.cachedDistrict();
    return cached?.id === id ? cached : null;
  });

  protected readonly visibleOptions = computed<PickerOption[]>(() => {
    const key = this.openPicker();
    if (!key) return [];
    const lang = this.language();
    const query = this.searchText();

    switch (key) {
      case 'country':
        return this.countries()
          .filter((item) => matchesGeoSearch(item, query))
          .map((item) => ({ id: item.id, label: geoNameIn(item, lang), iso2: item.iso2 }));
      case 'state':
        return this.states()
          .filter((item) => matchesGeoSearch(item, query))
          .map((item) => ({ id: item.id, label: geoNameIn(item, lang) }));
      case 'city': {
        const list = this.citiesRemote()
          ? this.cities()
          : this.cities().filter((item) => matchesGeoSearch(item, query));
        return list.map((item) => ({ id: item.id, label: geoNameIn(item, lang) }));
      }
      case 'district': {
        const list = this.districtsRemote()
          ? this.districts()
          : this.districts().filter((item) => matchesGeoSearch(item, query));
        return list.map((item) => ({
          id: item.id,
          label: geoNameIn(item, lang),
          kindLabel: this.transloco.translate(
            item.kind === 'VILLAGE' ? 'geo.place.kindVillage' : 'geo.place.kindDistrict',
          ),
        }));
      }
    }
  });

  protected readonly showAddAction = computed(() => {
    const key = this.openPicker();
    return this.canAddPlaces() && !this.disabled() && !this.readonly() && (key === 'city' || key === 'district');
  });

  constructor() {
    void this.loadCountries();

    effect(() => {
      const countryId = this.value().countryId;
      if (countryId === this.loadedStatesCountryId) return;
      this.loadedStatesCountryId = countryId;
      void this.loadStates(countryId);
    });

    effect(() => {
      const stateId = this.value().stateId;
      if (stateId === this.loadedCitiesStateId) return;
      this.loadedCitiesStateId = stateId;
      void this.loadCities(stateId);
    });

    effect(() => {
      const cityId = this.value().cityId;
      if (cityId === this.loadedDistrictsCityId) return;
      this.loadedDistrictsCityId = cityId;
      void this.loadDistricts(cityId);
    });

    effect(() => {
      const countryId = this.value().countryId;
      untracked(() => {
        if (!countryId) {
          this.countryCacheSeq++;
          this.cachedCountry.set(null);
          return;
        }
        const active = this.countries().find((item) => item.id === countryId);
        if (active) {
          this.cachedCountry.set(active);
          return;
        }
        if (this.countriesLoaded && this.cachedCountry()?.id !== countryId) {
          void this.syncSelectedCountry(countryId);
        }
      });
    });

    effect(() => {
      const countryId = this.value().countryId;
      const stateId = this.value().stateId;
      untracked(() => {
        if (!stateId) {
          this.stateCacheSeq++;
          this.cachedState.set(null);
          return;
        }
        if (this.statesLoadedForCountryId === countryId) {
          const active = this.states().find((item) => item.id === stateId);
          if (active) {
            this.cachedState.set(active);
            return;
          }
          if (this.cachedState()?.id !== stateId) {
            void this.syncSelectedState(stateId);
          }
        }
      });
    });

    effect(() => {
      const stateId = this.value().stateId;
      const cityId = this.value().cityId;
      untracked(() => {
        if (!cityId) {
          this.cityCacheSeq++;
          this.cachedCity.set(null);
          return;
        }
        if (this.citiesLoadedForStateId === stateId) {
          const active = this.cities().find((item) => item.id === cityId);
          if (active) {
            this.cachedCity.set(active);
            return;
          }
          if (this.cachedCity()?.id !== cityId) {
            void this.syncSelectedCity(cityId);
          }
        }
      });
    });

    effect(() => {
      const cityId = this.value().cityId;
      const districtId = this.value().districtId;
      untracked(() => {
        if (!districtId) {
          this.districtCacheSeq++;
          this.cachedDistrict.set(null);
          return;
        }
        if (this.districtsLoadedForCityId === cityId) {
          const active = this.districts().find((item) => item.id === districtId);
          if (active) {
            this.cachedDistrict.set(active);
            return;
          }
          if (this.cachedDistrict()?.id !== districtId) {
            void this.syncSelectedDistrict(districtId);
          }
        }
      });
    });

    const onScroll = (event: Event) => {
      if (!this.openPicker()) return;
      const target = event.target;
      if (target instanceof Node && this.popoverRef()?.nativeElement.contains(target)) return;
      this.closePicker();
    };
    document.addEventListener('scroll', onScroll, { capture: true, passive: true });
    this.destroyRef.onDestroy(() => {
      document.removeEventListener('scroll', onScroll, { capture: true });
      this.clearSearchTimer();
    });
  }

  protected flagUrl(iso2: string): string {
    return geoFlagUrl(iso2);
  }

  protected pickerDisplayLabel(key: PickerKey): string {
    const lang = this.language();
    switch (key) {
      case 'country': {
        const item = this.selectedCountry();
        return item ? geoNameIn(item, lang) : '';
      }
      case 'state': {
        const item = this.selectedState();
        return item ? geoNameIn(item, lang) : '';
      }
      case 'city': {
        const item = this.selectedCity();
        return item ? geoNameIn(item, lang) : '';
      }
      case 'district': {
        const item = this.selectedDistrict();
        return item ? geoNameIn(item, lang) : '';
      }
    }
  }

  protected selectedIdFor(key: PickerKey): string | null {
    const current = this.value();
    switch (key) {
      case 'country':
        return current.countryId;
      case 'state':
        return current.stateId;
      case 'city':
        return current.cityId;
      case 'district':
        return current.districtId;
    }
  }

  protected isPickerDisabled(key: PickerKey): boolean {
    if (this.disabled()) return true;
    const current = this.value();
    if (key === 'state') return !current.countryId;
    if (key === 'city') return !current.stateId;
    if (key === 'district') return !current.cityId;
    return false;
  }

  protected pickerMissingParentTitle(key: PickerKey): string | null {
    if (this.readonly()) return null;
    const current = this.value();
    if (key === 'state' && !current.countryId) return this.transloco.translate('geo.chooseFirst.state');
    if (key === 'city' && !current.stateId) return this.transloco.translate('geo.chooseFirst.city');
    if (key === 'district' && !current.cityId) return this.transloco.translate('geo.chooseFirst.district');
    return null;
  }

  protected pickerError(key: PickerKey): string | null {
    const errs = this.errors();
    if (key === 'country') return errs.countryId ?? null;
    if (key === 'state') return errs.stateId ?? null;
    if (key === 'city') return errs.cityId ?? null;
    return errs.districtId ?? null;
  }

  protected pickerButtonClass(key: PickerKey): string {
    const isOpen = this.openPicker() === key;
    const hasError = !!this.pickerError(key);
    const base =
      'inline-flex h-field w-full items-center justify-between gap-6 rounded-8 border px-8 text-12 outline-none transition-colors duration-fast';

    if (this.isPickerDisabled(key)) {
      return `${base} cursor-not-allowed border-border-field bg-neutral-soft text-text-placeholder`;
    }
    if (hasError) {
      return `${base} cursor-pointer bg-surface-field text-text border-danger-border ring-2 ring-danger-halo`;
    }
    if (isOpen) {
      return `${base} cursor-pointer bg-surface-field text-text border-focus-ring ring-3 ring-focus-halo-strong`;
    }
    return `${base} cursor-pointer border-border-field bg-surface-field text-text hover:border-border-field-hover focus-visible:border-focus-ring focus-visible:ring-3 focus-visible:ring-focus-halo-strong`;
  }

  protected textBoxClass(fieldKey: keyof AddressValue): string {
    const base = 'flex h-field items-center gap-6 rounded-8 border px-8 text-12 transition-colors duration-fast';
    if (this.disabled()) {
      return `${base} cursor-not-allowed border-border-field bg-neutral-soft text-text-placeholder`;
    }
    if (this.errors()[fieldKey]) {
      return `${base} bg-surface-field text-text border-danger-border ring-2 ring-danger-halo`;
    }
    if (this.readonly()) {
      return `${base} border-border-field bg-surface-field text-text`;
    }
    return `${base} border-border-field bg-surface-field text-text hover:border-border-field-hover focus-within:border-focus-ring focus-within:ring-3 focus-within:ring-focus-halo-strong`;
  }

  protected togglePicker(key: PickerKey): void {
    if (this.readonly() || this.isPickerDisabled(key)) return;
    if (this.openPicker() === key) {
      this.closePicker();
      return;
    }

    const trigger = this.triggerFor(key);
    if (!trigger) return;

    const seq = ++this.listSeq;
    this.clearSearchTimer();
    this.searchText.set('');
    this.activeIndex.set(-1);
    this.placed.set(false);
    this.place.set(this.initialPlace(trigger));
    this.openPicker.set(key);

    if (key === 'city' && this.citiesRemote() && this.value().stateId) {
      void this.fetchRemoteCities(this.value().stateId!, '');
    } else if (key === 'district' && this.districtsRemote() && this.value().cityId) {
      void this.fetchRemoteDistricts(this.value().cityId!, '');
    }

    afterNextRender(
      () => {
        this.placePopover(seq, trigger);
        this.searchInputRef()?.nativeElement.focus();
      },
      { injector: this.injector },
    );
  }

  protected onTriggerKeydown(key: PickerKey, event: KeyboardEvent): void {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (this.openPicker() !== key) {
        this.togglePicker(key);
      }
    }
  }

  protected closePicker(): void {
    this.listSeq++;
    this.clearSearchTimer();
    this.openPicker.set(null);
    this.placed.set(false);
  }

  protected closeIfOutside(event: Event): void {
    if (!this.host.nativeElement.contains(event.target as Node)) {
      this.closePicker();
    }
  }

  protected onSearchInput(event: Event): void {
    const query = (event.target as HTMLInputElement).value;
    this.searchText.set(query);
    this.activeIndex.set(query.trim() ? 0 : -1);

    const key = this.openPicker();
    if (key === 'city' && this.citiesRemote() && this.value().stateId) {
      this.scheduleRemoteSearch(() => this.fetchRemoteCities(this.value().stateId!, query));
    } else if (key === 'district' && this.districtsRemote() && this.value().cityId) {
      this.scheduleRemoteSearch(() => this.fetchRemoteDistricts(this.value().cityId!, query));
    }
  }

  protected onSearchKeydown(event: KeyboardEvent): void {
    const key = this.openPicker();
    if (!key) return;
    const options = this.visibleOptions();
    const hasAdd = this.showAddAction();
    const total = options.length + (hasAdd ? 1 : 0);

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        if (total > 0) {
          const next = this.activeIndex() < 0 ? 0 : (this.activeIndex() + 1) % total;
          this.activeIndex.set(next);
          this.scrollActiveIntoView(next, options.length);
        }
        break;
      case 'ArrowUp':
        event.preventDefault();
        if (total > 0) {
          const prev = this.activeIndex() < 0 ? total - 1 : (this.activeIndex() - 1 + total) % total;
          this.activeIndex.set(prev);
          this.scrollActiveIntoView(prev, options.length);
        }
        break;
      case 'Enter': {
        event.preventDefault();
        const active = this.activeIndex();
        if (hasAdd && active === options.length) {
          this.openAddPlaceModal();
          break;
        }
        const option = options[active];
        if (option) {
          this.selectOption(key, option.id);
        }
        break;
      }
    }
  }

  protected onPopoverKeydown(event: KeyboardEvent): void {
    const key = this.openPicker();
    if (!key) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      this.closePicker();
      this.triggerFor(key)?.focus();
    }
  }

  protected onPopoverFocusOut(event: FocusEvent): void {
    const next = event.relatedTarget as Node | null;
    const popoverEl = this.popoverRef()?.nativeElement;
    if (next && popoverEl?.contains(next)) return;
    if (next) {
      this.closePicker();
    }
  }

  protected selectOption(key: PickerKey, id: string): void {
    const current = this.value();
    switch (key) {
      case 'country':
        if (current.countryId !== id) {
          this.cachedCountry.set(this.countries().find((item) => item.id === id) ?? null);
          this.cachedState.set(null);
          this.cachedCity.set(null);
          this.cachedDistrict.set(null);
          this.value.set({
            ...current,
            countryId: id,
            stateId: null,
            cityId: null,
            districtId: null,
          });
        }
        break;
      case 'state':
        if (current.stateId !== id) {
          this.cachedState.set(this.states().find((item) => item.id === id) ?? null);
          this.cachedCity.set(null);
          this.cachedDistrict.set(null);
          this.value.set({
            ...current,
            stateId: id,
            cityId: null,
            districtId: null,
          });
        }
        break;
      case 'city':
        if (current.cityId !== id) {
          this.cachedCity.set(this.cities().find((item) => item.id === id) ?? null);
          this.cachedDistrict.set(null);
          this.value.set({
            ...current,
            cityId: id,
            districtId: null,
          });
        }
        break;
      case 'district':
        if (current.districtId !== id) {
          this.cachedDistrict.set(this.districts().find((item) => item.id === id) ?? null);
          this.value.set({
            ...current,
            districtId: id,
          });
        }
        break;
    }
    this.closePicker();
    this.triggerFor(key)?.focus();
  }

  protected openAddPlaceModal(): void {
    const key = this.openPicker();
    if (key !== 'city' && key !== 'district') return;

    const lang = this.language();
    const sep = lang === 'ar' ? '، ' : ', ';
    const initialText = this.searchText().trim();

    if (key === 'city') {
      const stateId = this.value().stateId;
      if (!stateId) return;
      const state = this.selectedState();
      const country = this.selectedCountry();
      const parentLabel = [state ? geoNameIn(state, lang) : '', country ? geoNameIn(country, lang) : '']
        .filter(Boolean)
        .join(sep);
      this.addModalKey = 'city';
      this.closePicker();
      this.placeModal().open({ kind: 'city', parentId: stateId, parentLabel, initialText });
    } else {
      const cityId = this.value().cityId;
      if (!cityId) return;
      const city = this.selectedCity();
      const state = this.selectedState();
      const parentLabel = [city ? geoNameIn(city, lang) : '', state ? geoNameIn(state, lang) : '']
        .filter(Boolean)
        .join(sep);
      this.addModalKey = 'district';
      this.closePicker();
      this.placeModal().open({ kind: 'district', parentId: cityId, parentLabel, initialText });
    }
  }

  protected onPlaceModalClosed(): void {
    const key = this.addModalKey;
    this.addModalKey = null;
    if (!key) return;
    this.triggerFor(key)?.focus();
    afterNextRender(
      () => {
        this.triggerFor(key)?.focus();
      },
      { injector: this.injector },
    );
  }

  protected onPlaceSaved(event: PlaceSavedEvent): void {
    const current = this.value();
    if (event.kind === 'city') {
      if (current.stateId === event.city.stateId) {
        this.cachedCity.set(event.city);
        this.cachedDistrict.set(null);
        this.cities.update((list) =>
          list.some((item) => item.id === event.city.id) ? list : [...list, event.city],
        );
        this.value.set({
          ...current,
          cityId: event.city.id,
          districtId: null,
        });
      }
    } else if (current.cityId === event.district.cityId) {
      this.cachedDistrict.set(event.district);
      this.districts.update((list) =>
        list.some((item) => item.id === event.district.id) ? list : [...list, event.district],
      );
      this.value.set({
        ...current,
        districtId: event.district.id,
      });
    }
  }

  protected onTextInput(field: TextFieldKey, event: Event): void {
    if (this.readonly() || this.disabled()) return;
    const text = (event.target as HTMLInputElement).value;
    this.value.set({ ...this.value(), [field]: text });
  }

  private async loadCountries(): Promise<void> {
    try {
      const items = await listCountries();
      this.countries.set(items);
      this.countriesLoaded = true;
      await this.syncSelectedCountry(this.value().countryId);
    } catch {
      this.countries.set([]);
    }
  }

  private async loadStates(countryId: string | null): Promise<void> {
    const seq = ++this.statesSeq;
    this.statesLoadedForCountryId = null;
    if (!countryId) {
      this.states.set([]);
      this.cachedState.set(null);
      return;
    }
    try {
      const items = await listStates(countryId);
      if (seq !== this.statesSeq) return;
      this.states.set(items);
      this.statesLoadedForCountryId = countryId;
      await this.syncSelectedState(this.value().stateId);
    } catch {
      if (seq !== this.statesSeq) return;
      this.states.set([]);
    }
  }

  private async loadCities(stateId: string | null): Promise<void> {
    const seq = ++this.citiesSeq;
    this.citiesLoadedForStateId = null;
    if (!stateId) {
      this.cities.set([]);
      this.citiesRemote.set(false);
      this.cachedCity.set(null);
      return;
    }
    try {
      const items = await listCities(stateId);
      if (seq !== this.citiesSeq) return;
      this.cities.set(items);
      this.citiesRemote.set(items.length >= REMOTE_THRESHOLD);
      this.citiesLoadedForStateId = stateId;
      await this.syncSelectedCity(this.value().cityId);
    } catch {
      if (seq !== this.citiesSeq) return;
      this.cities.set([]);
      this.citiesRemote.set(false);
    }
  }

  private async loadDistricts(cityId: string | null): Promise<void> {
    const seq = ++this.districtsSeq;
    this.districtsLoadedForCityId = null;
    if (!cityId) {
      this.districts.set([]);
      this.districtsRemote.set(false);
      this.cachedDistrict.set(null);
      return;
    }
    try {
      const items = await listDistricts(cityId);
      if (seq !== this.districtsSeq) return;
      this.districts.set(items);
      this.districtsRemote.set(items.length >= REMOTE_THRESHOLD);
      this.districtsLoadedForCityId = cityId;
      await this.syncSelectedDistrict(this.value().districtId);
    } catch {
      if (seq !== this.districtsSeq) return;
      this.districts.set([]);
      this.districtsRemote.set(false);
    }
  }

  private async fetchRemoteCities(stateId: string, search: string): Promise<void> {
    const seq = ++this.citiesSeq;
    try {
      const items = await listCities(stateId, search);
      if (seq !== this.citiesSeq) return;
      this.cities.set(items);
    } catch {
      // Keep existing options if remote search fails.
    }
  }

  private async fetchRemoteDistricts(cityId: string, search: string): Promise<void> {
    const seq = ++this.districtsSeq;
    try {
      const items = await listDistricts(cityId, search);
      if (seq !== this.districtsSeq) return;
      this.districts.set(items);
    } catch {
      // Keep existing options if remote search fails.
    }
  }

  private async syncSelectedCountry(id: string | null): Promise<void> {
    const seq = ++this.countryCacheSeq;
    if (!id) {
      this.cachedCountry.set(null);
      return;
    }
    const active = this.countries().find((item) => item.id === id);
    if (active) {
      this.cachedCountry.set(active);
      return;
    }
    if (this.cachedCountry()?.id === id) return;
    try {
      const found = await getCountry(id);
      if (seq !== this.countryCacheSeq || this.value().countryId !== id) return;
      this.cachedCountry.set(found);
    } catch {
      // Keep cached state if lookup fails.
    }
  }

  private async syncSelectedState(id: string | null): Promise<void> {
    const seq = ++this.stateCacheSeq;
    if (!id) {
      this.cachedState.set(null);
      return;
    }
    const active = this.states().find((item) => item.id === id);
    if (active) {
      this.cachedState.set(active);
      return;
    }
    if (this.cachedState()?.id === id) return;
    try {
      const found = await getState(id);
      if (seq !== this.stateCacheSeq || this.value().stateId !== id) return;
      this.cachedState.set(found);
    } catch {
      // Keep cached state if lookup fails.
    }
  }

  private async syncSelectedCity(id: string | null): Promise<void> {
    const seq = ++this.cityCacheSeq;
    if (!id) {
      this.cachedCity.set(null);
      return;
    }
    const active = this.cities().find((item) => item.id === id);
    if (active) {
      this.cachedCity.set(active);
      return;
    }
    if (this.cachedCity()?.id === id) return;
    try {
      const found = await getCity(id);
      if (seq !== this.cityCacheSeq || this.value().cityId !== id) return;
      this.cachedCity.set(found);
    } catch {
      // Keep cached state if lookup fails.
    }
  }

  private async syncSelectedDistrict(id: string | null): Promise<void> {
    const seq = ++this.districtCacheSeq;
    if (!id) {
      this.cachedDistrict.set(null);
      return;
    }
    const active = this.districts().find((item) => item.id === id);
    if (active) {
      this.cachedDistrict.set(active);
      return;
    }
    if (this.cachedDistrict()?.id === id) return;
    try {
      const found = await getDistrict(id);
      if (seq !== this.districtCacheSeq || this.value().districtId !== id) return;
      this.cachedDistrict.set(found);
    } catch {
      // Keep cached state if lookup fails.
    }
  }

  private scrollActiveIntoView(index: number, optionsLength: number): void {
    const target =
      index === optionsLength ? this.addPlaceBtn()?.nativeElement : this.optionItems()[index]?.nativeElement;
    target?.scrollIntoView({ block: 'nearest' });
  }

  private scheduleRemoteSearch(action: () => Promise<void>): void {
    this.clearSearchTimer();
    this.searchTimer = setTimeout(() => {
      this.searchTimer = null;
      void action();
    }, SEARCH_DEBOUNCE_MS);
  }

  private clearSearchTimer(): void {
    if (this.searchTimer !== null) {
      clearTimeout(this.searchTimer);
      this.searchTimer = null;
    }
  }

  private triggerFor(key: PickerKey): HTMLButtonElement | undefined {
    switch (key) {
      case 'country':
        return this.countryTrigger()?.nativeElement;
      case 'state':
        return this.stateTrigger()?.nativeElement;
      case 'city':
        return this.cityTrigger()?.nativeElement;
      case 'district':
        return this.districtTrigger()?.nativeElement;
    }
  }

  private initialPlace(trigger: HTMLElement): ListPlace {
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

  private placePopover(seq: number, trigger: HTMLElement): void {
    if (seq !== this.listSeq || !this.openPicker() || this.placed()) return;
    const popoverEl = this.popoverRef()?.nativeElement;
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

    this.place.set({ top, start, width: rect.width, maxHeight });
    this.placed.set(true);

    popoverEl.style.top = `${top}px`;
    popoverEl.style.insetInlineStart = `${start}px`;
    popoverEl.style.minWidth = `${rect.width}px`;
    popoverEl.style.maxHeight = maxHeight !== null ? `${maxHeight}px` : '';
    popoverEl.classList.remove('invisible');
  }
}
