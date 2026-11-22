import { Service, computed, resource } from '@angular/core';
import { listCountries } from '../../../core/geo/geo.api';
import { PartyAddressView, nameIn } from './leads.model';

export interface LeadLocation {
  /** ISO 3166 alpha-2 code for the flag, from the address countryId. */
  flag: string | null;
  /** Country, then city (or state), in the UI language. */
  label: string;
}

/**
 * The location line on lead cards and rows. The row address is PartyAddressView: the flag comes
 * from countryId (its legacy `country` text is a name, not a code), the label from the resolved names.
 */
@Service()
export class LeadLocations {
  private readonly countries = resource({ loader: () => listCountries().catch(() => []) });
  private readonly isoById = computed(
    () => new Map((this.countries.value() ?? []).map((country) => [country.id, country.iso2])),
  );

  of(address: PartyAddressView | null, language: string): LeadLocation | null {
    if (!address) return null;
    const country = address.countryName ? nameIn(address.countryName, language) : address.country;
    const place = address.cityName ?? address.stateName;
    const city = place ? nameIn(place, language) : (address.city ?? address.area);
    const label = [country, city].filter(Boolean).join(' - ');
    if (!label) return null;
    return { flag: address.countryId ? (this.isoById().get(address.countryId) ?? null) : null, label };
  }
}
