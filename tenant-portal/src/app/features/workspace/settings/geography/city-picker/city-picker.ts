import { DestroyRef, Component, ElementRef, computed, effect, inject, input, model, signal, untracked } from '@angular/core';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { ActivatedRoute } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerCheck, tablerSearch, tablerX } from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../../core/i18n/language';
import { Notify } from '../../../../../core/notify/notify';
import { Button } from '../../../../../shared/ui/button/button';
import { Dropdown, DropdownOption } from '../../../../../shared/ui/dropdown/dropdown';
import { Field } from '../../../../../shared/ui/field/field';
import {
  CityWithPath,
  GEO_LIMITS,
  GeoCity,
  GeoCountry,
  GeoState,
  GeoZone,
  geoFlagUrl,
  geoNameIn,
  listCities,
  getCitiesByIds,
  listCountries,
  listAllZones,
  listStates,
} from '../geo-admin.api';

/** The cities list includes inactive cities; only active ones are offered for new membership. */
function activeOnly(cities: GeoCity[]): GeoCity[] {
  return cities.filter((city) => city.isActive);
}

interface SelectedCityItem {
  id: string;
  nameEn: string;
  nameAr: string;
  stateId: string;
  stateName: { en: string; ar: string };
  countryIso2: string;
  unknown?: boolean;
  pending?: boolean;
}

interface StateCityGroup {
  stateId: string;
  stateLabel: string;
  groupAriaLabel: string;
  cities: SelectedCityItem[];
}

interface CountryCityGroup {
  countryIso2: string;
  countryLabel: string;
  hideHeader?: boolean;
  states: StateCityGroup[];
}

/** Dual-pane city selector enforcing single-zone city ownership and the 500-city limit. */
@Component({
  selector: 'app-zone-city-picker',
  imports: [NgIcon, TranslocoPipe, Button, Dropdown, Field],
  providers: [provideIcons({ tablerCheck, tablerSearch, tablerX })],
  templateUrl: './city-picker.html',
  host: { class: 'block min-w-0' },
})
export class CityPicker {
  private static nextId = 0;
  protected readonly uid = `zone-city-picker-${++CityPicker.nextId}`;

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly route = inject(ActivatedRoute, { optional: true });
  private readonly notify = inject(Notify);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly language = inject(LanguageState).current;

  readonly value = model<string[]>([]);
  readonly zoneId = input<string | null>(null);
  readonly listboxId = input<string | null>(null);
  readonly labelId = input<string | null>(null);
  readonly describedBy = input<string | null>(null);
  readonly readonly = input(false);
  readonly disabled = input(false);

  protected readonly maxCities = GEO_LIMITS.zoneCities;
  protected readonly skeletonRows = [0, 1, 2, 3];

  protected readonly countries = signal<GeoCountry[]>([]);
  protected readonly states = signal<GeoState[]>([]);
  protected readonly zonesById = signal<ReadonlyMap<string, GeoZone>>(new Map());
  protected readonly selectedCountryId = signal('');
  protected readonly selectedStateId = signal('');
  protected readonly searchInput = signal('');
  protected readonly debouncedSearch = signal('');

  protected readonly availableCities = signal<GeoCity[]>([]);
  protected readonly nextCursor = signal<string | null>(null);
  protected readonly loadingCities = signal(false);
  protected readonly loadingMore = signal(false);
  protected readonly citiesFailed = signal(false);

  private readonly cityPaths = signal<ReadonlyMap<string, CityWithPath>>(new Map());
  private readonly confirmedMissing = signal<ReadonlySet<string>>(new Set());
  private readonly detectedFieldLabelId = signal<string | null>(null);
  protected readonly conflicts = signal<ReadonlyMap<string, string | null>>(new Map());
  protected readonly activeAvailableId = signal<string | null>(null);
  protected readonly activeSelectedId = signal<string | null>(null);

  private searchTimer: ReturnType<typeof setTimeout> | null = null;
  /** A signal, so the loading effects re-run once the picker starts (a plain field never re-triggered them). */
  private readonly started = signal(false);
  private readonly inFlightCityIds = new Set<string>();
  private countriesLoaded = false;
  private statesSeq = 0;
  private citiesSeq = 0;
  private zonesSeq = 0;
  private initialQueryStateApplied = false;

  protected readonly availableLabelledBy = computed(() => {
    const fieldLabel = this.labelId() || this.detectedFieldLabelId();
    return fieldLabel ? `${fieldLabel} ${this.uid}-available-label` : `${this.uid}-available-label`;
  });

  protected readonly selectedLabelledBy = computed(() => {
    const fieldLabel = this.labelId() || this.detectedFieldLabelId();
    return fieldLabel ? `${fieldLabel} ${this.uid}-selected-label` : `${this.uid}-selected-label`;
  });

  protected readonly effectiveAvailableTabId = computed(() => {
    const list = this.availableCities();
    if (list.length === 0) return null;
    const current = this.activeAvailableId();
    if (current && list.some((c) => c.id === current)) return current;
    return list[0].id;
  });

  protected readonly selectedSet = computed(() => new Set(this.value()));
  protected readonly atLimit = computed(() => this.value().length >= this.maxCities);
  protected readonly interactionLocked = computed(() => this.readonly() || this.disabled());

  protected readonly activeCountry = computed(
    () => this.countries().find((c) => c.id === this.selectedCountryId()) ?? null,
  );
  protected readonly activeState = computed(
    () => this.states().find((s) => s.id === this.selectedStateId()) ?? null,
  );

  protected readonly countryOptions = computed<DropdownOption<string>[]>(() => {
    const lang = this.language();
    return this.countries()
      .slice()
      .sort((a, b) => geoNameIn(a, lang).localeCompare(geoNameIn(b, lang), lang))
      .map((country) => ({ value: country.id, label: geoNameIn(country, lang) }));
  });

  protected readonly stateOptions = computed<DropdownOption<string>[]>(() => {
    const lang = this.language();
    return this.states()
      .slice()
      .sort((a, b) => geoNameIn(a, lang).localeCompare(geoNameIn(b, lang), lang))
      .map((state) => ({ value: state.id, label: geoNameIn(state, lang) }));
  });

  protected readonly selectableOnPage = computed(() => {
    const currentZone = this.zoneId();
    const selected = this.selectedSet();
    return this.availableCities().filter(
      (city) => !selected.has(city.id) && (!city.zoneId || city.zoneId === currentZone),
    );
  });

  protected readonly groupedSelected = computed<CountryCityGroup[]>(() => {
    this.i18n();
    const ids = this.value();
    if (ids.length === 0) return [];
    const lang = this.language();
    const paths = this.cityPaths();
    const confirmed = this.confirmedMissing();
    const countryByIso = new Map(this.countries().map((country) => [country.iso2, country]));

    const countryMap = new Map<string, { label: string; states: Map<string, { label: string; cities: SelectedCityItem[] }> }>();
    const pendingIds: string[] = [];
    const unknownIds: string[] = [];

    for (const id of ids) {
      const path = paths.get(id);
      if (!path) {
        if (confirmed.has(id)) {
          unknownIds.push(id);
        } else {
          pendingIds.push(id);
        }
        continue;
      }
      const iso2 = path.countryIso2;
      const country = countryByIso.get(iso2);
      const countryLabel = country ? geoNameIn(country, lang) : iso2;

      let countryEntry = countryMap.get(iso2);
      if (!countryEntry) {
        countryEntry = { label: countryLabel, states: new Map() };
        countryMap.set(iso2, countryEntry);
      }

      const stateLabel = geoNameIn({ nameEn: path.stateName.en, nameAr: path.stateName.ar }, lang);
      let stateEntry = countryEntry.states.get(path.stateId);
      if (!stateEntry) {
        stateEntry = { label: stateLabel, cities: [] };
        countryEntry.states.set(path.stateId, stateEntry);
      }
      stateEntry.cities.push(path);
    }

    const groups: CountryCityGroup[] = [];
    for (const [countryIso2, countryEntry] of countryMap) {
      const stateGroups: StateCityGroup[] = [];
      for (const [stateId, stateEntry] of countryEntry.states) {
        stateGroups.push({
          stateId,
          stateLabel: stateEntry.label,
          groupAriaLabel: `${countryEntry.label} · ${stateEntry.label}`,
          cities: stateEntry.cities
            .slice()
            .sort((a, b) => geoNameIn(a, lang).localeCompare(geoNameIn(b, lang), lang)),
        });
      }
      stateGroups.sort((a, b) => a.stateLabel.localeCompare(b.stateLabel, lang));
      groups.push({ countryIso2, countryLabel: countryEntry.label, states: stateGroups });
    }
    groups.sort((a, b) => a.countryLabel.localeCompare(b.countryLabel, lang));

    if (pendingIds.length > 0) {
      const pendingGroupLabel = this.transloco.translate('geoZones.modal.cities');
      groups.push({
        countryIso2: '__pending__',
        countryLabel: '',
        hideHeader: true,
        states: [
          {
            stateId: '__pending__',
            stateLabel: '',
            groupAriaLabel: pendingGroupLabel,
            cities: pendingIds.map((id, index) => ({
              id,
              nameEn: `#${index + 1}`,
              nameAr: `#${index + 1}`,
              stateId: '__pending__',
              stateName: { en: '', ar: '' },
              countryIso2: '',
              pending: true,
            })),
          },
        ],
      });
    }

    if (unknownIds.length > 0) {
      const unknownLabel = this.transloco.translate('geoZones.picker.unknownCity');
      groups.push({
        countryIso2: '',
        countryLabel: unknownLabel,
        hideHeader: true,
        states: [
          {
            stateId: '__unknown__',
            stateLabel: unknownLabel,
            groupAriaLabel: unknownLabel,
            cities: unknownIds.map((id, index) => {
              const itemLabel = `${unknownLabel} ${index + 1}`;
              return {
                id,
                nameEn: itemLabel,
                nameAr: itemLabel,
                stateId: '__unknown__',
                stateName: { en: '', ar: '' },
                countryIso2: '',
                unknown: true,
              };
            }),
          },
        ],
      });
    }

    return groups;
  });

  protected readonly orderedSelectedIds = computed(() =>
    this.groupedSelected().flatMap((cg) => cg.states.flatMap((sg) => sg.cities.map((c) => c.id))),
  );

  protected readonly effectiveSelectedTabId = computed(() => {
    const ids = this.orderedSelectedIds();
    if (ids.length === 0) return null;
    const current = this.activeSelectedId();
    if (current && ids.includes(current)) return current;
    return ids[0];
  });

  constructor() {
    this.destroyRef.onDestroy(() => {
      if (this.searchTimer !== null) clearTimeout(this.searchTimer);
    });

    effect(() => {
      const explicitLabelId = this.labelId();
      if (explicitLabelId) {
        this.detectedFieldLabelId.set(explicitLabelId);
        return;
      }
      const id = this.listboxId();
      if (!id) {
        this.detectedFieldLabelId.set(null);
        return;
      }
      const label = this.host.nativeElement.closest('ui-field')?.querySelector('label');
      if (!label) {
        this.detectedFieldLabelId.set(null);
        return;
      }
      if (!label.id) {
        label.id = `${id}-label`;
      }
      this.detectedFieldLabelId.set(label.id);
    });

    effect(() => {
      if (!this.started()) return;
      const countryId = this.selectedCountryId();
      if (!countryId) {
        this.states.set([]);
        this.selectedStateId.set('');
        return;
      }
      void this.loadStatesForCountry(countryId);
    });

    effect(() => {
      if (!this.started()) return;
      const stateId = this.selectedStateId();
      const search = this.debouncedSearch();
      if (!stateId) {
        this.availableCities.set([]);
        this.nextCursor.set(null);
        this.citiesFailed.set(false);
        this.loadingCities.set(false);
        return;
      }
      void this.loadCitiesFirstPage(stateId, search);
    });

    effect(() => {
      if (!this.started()) return;
      const ids = this.value();
      const known = untracked(() => this.cityPaths());
      const confirmed = untracked(() => this.confirmedMissing());
      const missing = ids.filter((id) => !known.has(id) && !confirmed.has(id) && !this.inFlightCityIds.has(id));
      if (missing.length > 0) {
        void this.loadMissingCityPaths(missing);
      }
    });
  }

  /** Reloads zone assignments, current state's city list, and selected city metadata. */
  async reloadContext(): Promise<void> {
    this.started.set(true);
    const tasks: Promise<unknown>[] = [this.loadZonesMap()];
    if (!this.countriesLoaded) {
      tasks.push(this.loadCountries());
    } else {
      const stateId = this.selectedStateId();
      if (stateId) {
        tasks.push(this.loadCitiesFirstPage(stateId, this.debouncedSearch()));
      }
    }
    const ids = this.value();
    if (ids.length > 0) {
      tasks.push(this.loadMissingCityPaths(ids));
    }
    await Promise.all(tasks);
  }

  /** Marks a city chip as conflicting after GEO_ZONE_CITY_CONFLICT or GEO_ZONE_CITY_INVALID. */
  markConflict(cityId: string, conflictZoneId?: string | null): void {
    this.conflicts.update((prev) => {
      const next = new Map(prev);
      next.set(cityId, conflictZoneId ?? null);
      return next;
    });
  }

  /** Clears all conflict highlights from selected city chips. */
  clearConflicts(): void {
    if (this.conflicts().size > 0) {
      this.conflicts.set(new Map());
    }
  }

  /** Resolves localized city and zone names for conflict error toasts. */
  async resolveConflictNames(cityId: string, conflictZoneId?: string | null): Promise<{ city: string; zone: string | null }> {
    const lang = this.language();
    let cityPath = this.cityPaths().get(cityId);
    if (!cityPath) {
      const fetched = await getCitiesByIds([cityId]).catch(() => []);
      cityPath = fetched[0];
    }

    let zone = conflictZoneId ? this.zonesById().get(conflictZoneId) : undefined;
    if (conflictZoneId && !zone) {
      await this.loadZonesMap();
      zone = this.zonesById().get(conflictZoneId);
    }

    return {
      city: cityPath ? geoNameIn(cityPath, lang) : this.transloco.translate('geoZones.picker.unknownCity'),
      zone: zone ? geoNameIn(zone, lang) : null,
    };
  }

  protected onCountryChange(countryId: string): void {
    if (this.disabled() || countryId === this.selectedCountryId()) return;
    this.selectedStateId.set('');
    this.selectedCountryId.set(countryId);
  }

  protected onStateChange(stateId: string): void {
    if (this.disabled() || stateId === this.selectedStateId()) return;
    this.selectedStateId.set(stateId);
  }

  protected onSearchInput(event: Event): void {
    const next = (event.target as HTMLInputElement).value;
    this.searchInput.set(next);
    if (this.searchTimer !== null) clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => {
      this.searchTimer = null;
      this.debouncedSearch.set(next.trim());
    }, 300);
  }

  protected clearSearch(): void {
    if (this.searchTimer !== null) {
      clearTimeout(this.searchTimer);
      this.searchTimer = null;
    }
    this.searchInput.set('');
    this.debouncedSearch.set('');
  }

  protected onSearchEscape(event: Event): void {
    if (this.searchInput()) {
      event.stopPropagation();
      this.clearSearch();
    }
  }

  protected retryCities(): void {
    const stateId = this.selectedStateId();
    if (stateId) {
      void this.loadCitiesFirstPage(stateId, this.debouncedSearch());
    }
  }

  protected async loadMore(): Promise<void> {
    const stateId = this.selectedStateId();
    const cursor = this.nextCursor();
    if (!stateId || !cursor || this.loadingMore()) return;

    const seq = this.citiesSeq;
    this.loadingMore.set(true);
    try {
      const page = await listCities(stateId, {
        search: this.debouncedSearch() || undefined,
        cursor,
        limit: GEO_LIMITS.pageSize,
      });
      if (seq !== this.citiesSeq) return;
      const items = activeOnly(page.items);
      this.cacheAvailableCities(items);
      this.availableCities.update((prev) => {
        const seen = new Set(prev.map((c) => c.id));
        return [...prev, ...items.filter((c) => !seen.has(c.id))];
      });
      this.nextCursor.set(page.nextCursor);
    } catch {
      if (seq === this.citiesSeq) {
        this.notify.error(this.transloco.translate('geoZones.errors.generic'));
      }
    } finally {
      if (seq === this.citiesSeq) {
        this.loadingMore.set(false);
      }
    }
  }

  protected cityLabel(city: { nameEn: string; nameAr: string }): string {
    return geoNameIn(city, this.language());
  }

  protected activeStateLabel(): string {
    const state = this.activeState();
    return state ? geoNameIn(state, this.language()) : '';
  }

  protected selectedCityStateLabel(city: SelectedCityItem): string {
    return geoNameIn({ nameEn: city.stateName.en, nameAr: city.stateName.ar }, this.language());
  }

  protected flagUrl(iso2: string): string {
    return geoFlagUrl(iso2);
  }

  protected otherZoneName(city: GeoCity): string | null {
    if (!city.zoneId || city.zoneId === this.zoneId()) return null;
    const zone = this.zonesById().get(city.zoneId);
    return zone ? geoNameIn(zone, this.language()) : this.transloco.translate('geoZones.picker.unknownZone');
  }

  protected isRowDisabled(city: GeoCity): boolean {
    if (this.interactionLocked()) return true;
    if (this.otherZoneName(city) !== null) return true;
    return !this.selectedSet().has(city.id) && this.atLimit();
  }

  protected rowTitle(city: GeoCity): string | null {
    const other = this.otherZoneName(city);
    if (other) {
      return this.transloco.translate('geoZones.picker.otherZoneHint', { zone: other });
    }
    if (!this.selectedSet().has(city.id) && this.atLimit()) {
      return this.transloco.translate('geoZones.picker.limitReached');
    }
    return null;
  }

  protected conflictTitle(cityId: string): string | null {
    if (!this.conflicts().has(cityId)) return null;
    const conflictZoneId = this.conflicts().get(cityId);
    if (!conflictZoneId && !this.cityPaths().has(cityId)) {
      return this.transloco.translate('geoZones.errors.GEO_ZONE_CITY_INVALID');
    }
    const zone = conflictZoneId ? this.zonesById().get(conflictZoneId) : undefined;
    const zoneName = zone ? geoNameIn(zone, this.language()) : this.transloco.translate('geoZones.picker.unknownZone');
    return this.transloco.translate('geoZones.picker.otherZoneHint', { zone: zoneName });
  }

  protected toggleCity(city: GeoCity): void {
    if (this.isRowDisabled(city)) return;
    const current = this.value();
    if (current.includes(city.id)) {
      this.removeCity(city.id);
      return;
    }
    if (current.length >= this.maxCities) return;
    this.value.set([...current, city.id]);
  }

  protected selectAllOnPage(): void {
    if (this.interactionLocked()) return;
    const candidates = this.selectableOnPage();
    if (candidates.length === 0) return;

    const current = this.value();
    const room = Math.max(0, this.maxCities - current.length);
    if (room === 0) return;

    const additions = candidates.slice(0, room).map((city) => city.id);
    if (additions.length > 0) {
      this.value.set([...current, ...additions]);
    }
  }

  protected removeCity(cityId: string): void {
    if (this.interactionLocked()) return;
    this.value.update((list) => list.filter((id) => id !== cityId));
    if (this.conflicts().has(cityId)) {
      this.conflicts.update((prev) => {
        const next = new Map(prev);
        next.delete(cityId);
        return next;
      });
    }
  }

  protected clearAll(): void {
    if (this.interactionLocked() || this.value().length === 0) return;
    this.value.set([]);
    this.clearConflicts();
  }

  protected onAvailableKeydown(event: KeyboardEvent, city: GeoCity): void {
    if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault();
      this.toggleCity(city);
      return;
    }
    this.handleListboxArrowNav(event);
  }

  protected onSelectedChipKeydown(event: KeyboardEvent, cityId: string): void {
    if (event.key === ' ' || event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault();
      if (!this.interactionLocked()) {
        const ids = this.orderedSelectedIds();
        const index = ids.indexOf(cityId);
        const nextId = index >= 0 ? (ids[index + 1] ?? ids[index - 1] ?? null) : null;
        this.activeSelectedId.set(nextId);
        this.removeCity(cityId);
      }
      return;
    }
    this.handleListboxArrowNav(event);
  }

  private handleListboxArrowNav(event: KeyboardEvent): void {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp' && event.key !== 'Home' && event.key !== 'End') {
      return;
    }
    const listbox = event.currentTarget instanceof HTMLElement ? event.currentTarget.closest('[role="listbox"]') : null;
    if (!listbox) return;
    const options = Array.from(listbox.querySelectorAll<HTMLElement>('[role="option"]'));
    if (options.length === 0) return;

    const current = event.currentTarget instanceof HTMLElement ? options.indexOf(event.currentTarget) : -1;
    let nextIndex = -1;
    if (event.key === 'ArrowDown') nextIndex = (current + 1) % options.length;
    else if (event.key === 'ArrowUp') nextIndex = (current - 1 + options.length) % options.length;
    else if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = options.length - 1;

    if (nextIndex >= 0) {
      event.preventDefault();
      options[nextIndex]?.focus();
    }
  }

  private async loadZonesMap(): Promise<void> {
    const seq = ++this.zonesSeq;
    try {
      const zones = await listAllZones();
      if (seq !== this.zonesSeq) return;
      this.zonesById.set(new Map(zones.map((zone) => [zone.id, zone])));
    } catch {
      // Zones list will be retried when reloading context.
    }
  }

  private async loadCountries(): Promise<void> {
    if (this.countriesLoaded) return;
    try {
      const list = (await listCountries()).items;
      this.countriesLoaded = true;
      this.countries.set(list);
      if (list.length === 0) return;

      const queryCountry = this.route?.snapshot.queryParamMap.get('country');
      const matchedQuery = queryCountry ? list.find((c) => c.id === queryCountry) : undefined;
      const egypt = list.find((c) => c.iso2 === 'EG');
      const initial = matchedQuery ?? egypt ?? list[0];
      this.selectedCountryId.set(initial.id);
    } catch {
      this.countries.set([]);
    }
  }

  private async loadStatesForCountry(countryId: string): Promise<void> {
    const seq = ++this.statesSeq;
    try {
      const list = (await listStates(countryId)).items;
      if (seq !== this.statesSeq) return;
      this.states.set(list);
      if (list.length === 0) {
        this.selectedStateId.set('');
        return;
      }

      if (!this.initialQueryStateApplied) {
        this.initialQueryStateApplied = true;
        const queryState = this.route?.snapshot.queryParamMap.get('state');
        const matched = queryState ? list.find((s) => s.id === queryState) : undefined;
        if (matched) {
          this.selectedStateId.set(matched.id);
          return;
        }
      }

      const lang = this.language();
      const sorted = list.slice().sort((a, b) => geoNameIn(a, lang).localeCompare(geoNameIn(b, lang), lang));
      this.selectedStateId.set(sorted[0].id);
    } catch {
      if (seq === this.statesSeq) {
        this.states.set([]);
        this.selectedStateId.set('');
      }
    }
  }

  private async loadCitiesFirstPage(stateId: string, search: string): Promise<void> {
    const seq = ++this.citiesSeq;
    this.loadingCities.set(true);
    this.citiesFailed.set(false);
    try {
      const page = await listCities(stateId, {
        search: search || undefined,
        limit: GEO_LIMITS.pageSize,
      });
      if (seq !== this.citiesSeq) return;
      const items = activeOnly(page.items);
      this.cacheAvailableCities(items);
      this.availableCities.set(items);
      this.nextCursor.set(page.nextCursor);
    } catch {
      if (seq !== this.citiesSeq) return;
      this.citiesFailed.set(true);
      this.availableCities.set([]);
      this.nextCursor.set(null);
    } finally {
      if (seq === this.citiesSeq) {
        this.loadingCities.set(false);
      }
    }
  }

  private async loadMissingCityPaths(ids: readonly string[]): Promise<void> {
    for (const id of ids) {
      this.inFlightCityIds.add(id);
    }
    try {
      const resolved = await getCitiesByIds([...ids]);
      const resolvedById = new Map(resolved.map((item) => [item.id, item]));
      this.cityPaths.update((prev) => {
        const next = new Map(prev);
        for (const id of ids) {
          const item = resolvedById.get(id);
          if (item) {
            next.set(id, item);
          } else {
            next.delete(id);
          }
        }
        return next;
      });
      this.confirmedMissing.update((prev) => {
        const next = new Set(prev);
        for (const id of ids) {
          if (resolvedById.has(id)) {
            next.delete(id);
          } else {
            next.add(id);
          }
        }
        return next;
      });
    } catch {
      // Metadata retry occurs on reloadContext or subsequent value updates.
    } finally {
      for (const id of ids) {
        this.inFlightCityIds.delete(id);
      }
    }
  }

  private cacheAvailableCities(cities: readonly GeoCity[]): void {
    const state = this.activeState();
    const country = this.activeCountry();
    if (!state || !country) return;
    const cachedIds: string[] = [];
    this.cityPaths.update((prev) => {
      const next = new Map(prev);
      for (const city of cities) {
        if (city.stateId === state.id) {
          cachedIds.push(city.id);
          next.set(city.id, {
            ...city,
            stateName: { en: state.nameEn, ar: state.nameAr },
            countryIso2: country.iso2,
          });
        }
      }
      return next;
    });
    if (cachedIds.length > 0 && cachedIds.some((id) => this.confirmedMissing().has(id))) {
      this.confirmedMissing.update((prev) => {
        const next = new Set(prev);
        for (const id of cachedIds) {
          next.delete(id);
        }
        return next;
      });
    }
  }
}
