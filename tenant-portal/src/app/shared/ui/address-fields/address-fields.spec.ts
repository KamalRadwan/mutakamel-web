import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TRANSLOCO_LOADER, provideTransloco } from '@jsverse/transloco';
import { delay, of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AddressFields, AddressValue, EMPTY_ADDRESS } from './address-fields';

// The geo API is backed by an in-memory fake with a 300 ms delay, so these specs run on fake timers
// against the real fake data (Egypt, Cairo, Maadi, Degla, ...).
const EGYPT = 'geo-eg';
const CAIRO = 'geo-eg-c';
const MAADI = 'geo-city-maadi';
const DEGLA = 'geo-dist-degla';

@Component({
  imports: [AddressFields],
  template: `<app-address-fields
    [(value)]="value"
    [errors]="errors()"
    [disabled]="disabled()"
    [readonly]="readonly()"
    [canAddPlaces]="canAddPlaces()"
  />`,
})
class Host {
  readonly value = signal<AddressValue>({ ...EMPTY_ADDRESS });
  readonly errors = signal<Partial<Record<keyof AddressValue, string>>>({});
  readonly disabled = signal(false);
  readonly readonly = signal(false);
  readonly canAddPlaces = signal(false);
}

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers();
  // jsdom does not implement scrollIntoView.
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(() => {
  vi.useRealTimers();
});

async function setup(init?: (host: Host) => void) {
  TestBed.configureTestingModule({
    providers: [
      provideTransloco({ config: { availableLangs: ['ar', 'en'], defaultLang: 'en', prodMode: true } }),
      { provide: TRANSLOCO_LOADER, useValue: { getTranslation: () => of({}).pipe(delay(0)) } },
    ],
  });
  const fixture = TestBed.createComponent(Host);
  document.body.appendChild(fixture.nativeElement);
  init?.(fixture.componentInstance);
  fixture.detectChanges();
  const settle = async () => {
    // Each cascade step (countries, states, cities, districts) waits for the fake 300 ms delay.
    for (let i = 0; i < 4; i++) {
      await vi.advanceTimersByTimeAsync(350);
      fixture.detectChanges();
    }
  };
  await settle();
  const el = fixture.nativeElement as HTMLElement;
  const trigger = (name: string) =>
    el.querySelector(`button[role="combobox"][aria-label="geo.${name}"]`) as HTMLButtonElement | null;
  const popover = () => el.querySelector('[role="listbox"]') as HTMLElement | null;
  const options = () => Array.from(el.querySelectorAll('[role="option"]')) as HTMLElement[];
  const search = () => el.querySelector('input[aria-label="geo.search"]') as HTMLInputElement | null;
  const open = async (name: string) => {
    trigger(name)!.click();
    await settle();
  };
  const type = async (text: string) => {
    search()!.value = text;
    search()!.dispatchEvent(new Event('input', { bubbles: true }));
    await settle();
  };
  const keydown = async (target: Element, key: string) => {
    const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
    target.dispatchEvent(event);
    await settle();
    return event;
  };
  return { fixture, host: fixture.componentInstance, el, trigger, popover, options, search, open, type, keydown, settle };
}

describe('AddressFields', () => {
  it('renders the four pickers as comboboxes with listbox popups', async () => {
    const { trigger } = await setup();
    for (const name of ['country', 'state', 'city', 'district']) {
      expect(trigger(name)).toBeTruthy();
      expect(trigger(name)!.getAttribute('aria-haspopup')).toBe('listbox');
      expect(trigger(name)!.getAttribute('aria-expanded')).toBe('false');
    }
  });

  it('enables only the country picker when nothing is selected', async () => {
    const { trigger } = await setup();
    expect(trigger('country')!.disabled).toBe(false);
    expect(trigger('state')!.disabled).toBe(true);
    expect(trigger('city')!.disabled).toBe(true);
    expect(trigger('district')!.disabled).toBe(true);
  });

  it('explains why a dependent picker is disabled through its title', async () => {
    const { trigger } = await setup();
    expect(trigger('state')!.title).toBe('geo.chooseFirst.state');
    expect(trigger('city')!.title).toBe('geo.chooseFirst.city');
    expect(trigger('district')!.title).toBe('geo.chooseFirst.district');
  });

  it('opens the country list with flag-coded options and a labelled search box', async () => {
    const { open, trigger, options, popover, search } = await setup();
    await open('country');
    expect(popover()).toBeTruthy();
    expect(trigger('country')!.getAttribute('aria-expanded')).toBe('true');
    expect(trigger('country')!.getAttribute('aria-controls')).toBe(popover()!.id);
    expect(options()[0].textContent).toContain('Egypt');
    expect(options()[0].textContent).toContain('EG');
    expect(options().length).toBe(10);
    expect(search()).toBeTruthy();
  });

  it('toggles the list closed when the same picker is clicked again', async () => {
    const { open, popover } = await setup();
    await open('country');
    await open('country');
    expect(popover()).toBeNull();
  });

  it('opens a picker with ArrowDown on its trigger and prevents default', async () => {
    const { trigger, keydown, popover } = await setup();
    const event = await keydown(trigger('country')!, 'ArrowDown');
    expect(event.defaultPrevented).toBe(true);
    expect(popover()).toBeTruthy();
  });

  it('selects a country, updates the model and clears dependent selections', async () => {
    const { open, options, host, settle } = await setup((h) =>
      h.value.set({ ...EMPTY_ADDRESS, countryId: 'geo-sa', stateId: CAIRO, cityId: MAADI, districtId: DEGLA }),
    );
    await open('country');
    options()[0].click();
    await settle();
    expect(host.value().countryId).toBe(EGYPT);
    expect(host.value().stateId).toBeNull();
    expect(host.value().cityId).toBeNull();
    expect(host.value().districtId).toBeNull();
  });

  it('closes the list and returns focus to the trigger after a selection', async () => {
    const { open, options, popover, trigger, settle } = await setup();
    await open('country');
    options()[0].click();
    await settle();
    expect(popover()).toBeNull();
    expect(document.activeElement).toBe(trigger('country'));
  });

  it('enables the state picker once a country is chosen', async () => {
    const { open, options, trigger, settle } = await setup();
    await open('country');
    options()[0].click();
    await settle();
    expect(trigger('state')!.disabled).toBe(false);
  });

  it('lists the states of the chosen country and cascades down to districts with a kind label', async () => {
    const { open, options, settle, trigger } = await setup();
    await open('country');
    options()[0].click();
    await settle();
    await open('state');
    // The geo fake orders states like the backend (sortOrder, then name), so check the set and pick Cairo by label.
    const stateLabels = options().map((o) => o.textContent?.trim() ?? '');
    expect([...stateLabels].sort()).toEqual(['Alexandria', 'Cairo', 'Giza', 'Qalyubia', 'Sharqia']);
    options()[stateLabels.indexOf('Cairo')].click();
    await settle();
    await open('city');
    const cityLabels = options().map((o) => o.textContent?.trim() ?? '');
    expect(cityLabels).toContain('Maadi');
    options()[cityLabels.indexOf('Maadi')].click();
    await settle();
    await open('district');
    const rows = options().map((o) => o.textContent ?? '');
    expect(rows.length).toBe(2);
    expect(rows[0]).toContain('Degla');
    expect(rows[0]).toContain('geo.place.kindDistrict');
    expect(rows[1]).toContain('Sarayat');
    expect(trigger('district')!.disabled).toBe(false);
  });

  it('shows the selected value text in each trigger', async () => {
    const { trigger } = await setup((h) =>
      h.value.set({ ...EMPTY_ADDRESS, countryId: EGYPT, stateId: CAIRO, cityId: MAADI, districtId: DEGLA }),
    );
    expect(trigger('country')!.textContent).toContain('Egypt');
    expect(trigger('state')!.textContent).toContain('Cairo');
    expect(trigger('city')!.textContent).toContain('Maadi');
    expect(trigger('district')!.textContent).toContain('Degla');
  });

  it('marks the current option as aria-selected', async () => {
    const { open, options } = await setup((h) => h.value.set({ ...EMPTY_ADDRESS, countryId: 'geo-sa' }));
    await open('country');
    expect(options().map((o) => o.getAttribute('aria-selected'))).toEqual([
      'false', 'true', 'false', 'false', 'false', 'false', 'false', 'false', 'false', 'false',
    ]);
  });

  it('filters options by the search text in English and Arabic', async () => {
    const { open, type, options } = await setup();
    await open('country');
    await type('saud');
    expect(options().length).toBe(1);
    await type('مصر');
    expect(options()[0].textContent).toContain('Egypt');
  });

  it('shows a disabled no-matches option when nothing matches', async () => {
    const { open, type, options } = await setup();
    await open('country');
    await type('zzzz');
    expect(options()[0].getAttribute('aria-disabled')).toBe('true');
    expect(options()[0].textContent).toContain('geo.noMatches');
  });

  it('navigates options with ArrowDown and picks with Enter, exposing aria-activedescendant', async () => {
    const { open, search, keydown, host, options } = await setup();
    await open('country');
    await keydown(search()!, 'ArrowDown');
    expect(search()!.getAttribute('aria-activedescendant')).toBe(options()[0].id);
    await keydown(search()!, 'ArrowDown');
    await keydown(search()!, 'Enter');
    expect(host.value().countryId).toBe('geo-sa');
  });

  it('wraps ArrowUp from no active option to the last option', async () => {
    const { open, search, keydown, options } = await setup();
    await open('country');
    await keydown(search()!, 'ArrowUp');
    expect(search()!.getAttribute('aria-activedescendant')).toBe(options()[options().length - 1].id);
  });

  it('closes with Escape and returns focus to the trigger', async () => {
    const { open, popover, keydown, trigger, search } = await setup();
    await open('country');
    const event = await keydown(search()!, 'Escape');
    expect(popover()).toBeNull();
    expect(event.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(trigger('country'));
  });

  it('closes the list when clicking outside', async () => {
    const { open, popover, settle } = await setup();
    await open('country');
    document.body.click();
    await settle();
    expect(popover()).toBeNull();
  });

  it('writes text fields into the model', async () => {
    const { el, host, settle } = await setup();
    const street = el.querySelector('input[id$="-street1"]') as HTMLInputElement;
    street.value = '12 Nile St';
    street.dispatchEvent(new Event('input', { bubbles: true }));
    await settle();
    expect(host.value().street1).toBe('12 Nile St');
  });

  it('limits the street length and shows a counter', async () => {
    const { el } = await setup();
    const street = el.querySelector('input[id$="-street1"]') as HTMLInputElement;
    expect(street.maxLength).toBe(160);
    expect(el.textContent).toContain('0 / 160');
  });

  it('exposes field errors with aria-invalid on pickers and text inputs', async () => {
    const { trigger, el } = await setup((h) => h.errors.set({ countryId: 'Required', street1: 'Too short' }));
    expect(trigger('country')!.getAttribute('aria-invalid')).toBe('true');
    expect((el.querySelector('input[id$="-street1"]') as HTMLInputElement).getAttribute('aria-invalid')).toBe('true');
    expect(el.textContent).toContain('Required');
    expect(el.textContent).toContain('Too short');
  });

  it('gives every labelled field a hint tooltip and links the picker to it through aria-describedby', async () => {
    const { trigger, el } = await setup();
    expect(el.querySelectorAll('[role="tooltip"]').length).toBeGreaterThanOrEqual(8);
    const describedBy = trigger('country')!.getAttribute('aria-describedby');
    expect(describedBy).toBeTruthy();
    expect(el.querySelector(`#${describedBy}`)?.textContent).toContain('geo.countryHint');
  });

  it('disables pickers and text inputs when disabled', async () => {
    const { trigger, el } = await setup((h) => h.disabled.set(true));
    expect(trigger('country')!.disabled).toBe(true);
    expect((el.querySelector('input[id$="-street1"]') as HTMLInputElement).disabled).toBe(true);
  });

  it('renders read-only inputs instead of picker buttons when readonly', async () => {
    const { trigger, el } = await setup((h) => {
      h.readonly.set(true);
      h.value.set({ ...EMPTY_ADDRESS, countryId: EGYPT });
    });
    expect(trigger('country')).toBeNull();
    const countryInput = el.querySelector('input[id$="-country"]') as HTMLInputElement;
    expect(countryInput.readOnly).toBe(true);
    expect(countryInput.value).toBe('Egypt');
  });

  it('offers an add-place action for cities only when allowed', async () => {
    const { open, el } = await setup((h) => {
      h.canAddPlaces.set(true);
      h.value.set({ ...EMPTY_ADDRESS, countryId: EGYPT, stateId: CAIRO });
    });
    await open('city');
    expect(el.textContent).toContain('geo.addCityEmpty');
  });

  it('does not offer add-place on the country list even when allowed', async () => {
    const { open, el } = await setup((h) => h.canAddPlaces.set(true));
    await open('country');
    expect(el.textContent).not.toContain('geo.addCityEmpty');
    expect(el.textContent).not.toContain('geo.addDistrictEmpty');
  });

  it('does not offer add-place when not allowed', async () => {
    const { open, el } = await setup((h) => h.value.set({ ...EMPTY_ADDRESS, countryId: EGYPT, stateId: CAIRO }));
    await open('city');
    expect(el.textContent).not.toContain('geo.addCityEmpty');
  });

  it('positions the popover with a logical inline-start inset so it follows rtl', async () => {
    const { open, popover } = await setup();
    await open('country');
    expect(popover()!.parentElement!.style.getPropertyValue('inset-inline-start')).not.toBe('');
  });
});
