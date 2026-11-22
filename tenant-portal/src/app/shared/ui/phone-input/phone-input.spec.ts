import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TRANSLOCO_LOADER, provideTransloco } from '@jsverse/transloco';
import { delay, of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GeoCountry } from '../../../core/geo/geo.model';
import { PhoneInput } from './phone-input';
import { joinPhone, normalizePhone, splitPhone, toAsciiDigits } from './phone';

const EG: GeoCountry = { id: 'eg', iso2: 'EG', iso3: 'EGY', nameEn: 'Egypt', nameAr: 'مصر', dialCode: '+20', flagCode: 'eg', sortOrder: 0 };
const SA: GeoCountry = { id: 'sa', iso2: 'SA', iso3: 'SAU', nameEn: 'Saudi Arabia', nameAr: 'السعودية', dialCode: '+966', flagCode: 'sa', sortOrder: 1 };
const US: GeoCountry = { id: 'us', iso2: 'US', iso3: 'USA', nameEn: 'United States', nameAr: 'الولايات المتحدة', dialCode: '+1', flagCode: 'us', sortOrder: 2 };
// Core lists active countries only (no isActive field), so every given country is offered.
const COUNTRIES = [EG, SA, US];

@Component({
  imports: [PhoneInput],
  template: `<ui-phone-input
    label="Mobile"
    inputId="phone-1"
    [countries]="countries"
    [(value)]="value"
    [disabled]="disabled()"
    [readonly]="readonly()"
    [invalid]="invalid()"
  />`,
})
class Host {
  readonly countries = COUNTRIES;
  readonly value = signal('');
  readonly disabled = signal(false);
  readonly readonly = signal(false);
  readonly invalid = signal(false);
}

beforeEach(() => {
  localStorage.clear();
  // jsdom does not implement scrollIntoView.
  Element.prototype.scrollIntoView = vi.fn();
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
  await new Promise((resolve) => setTimeout(resolve, 20));
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  const tick = async () => {
    fixture.detectChanges();
    await Promise.resolve();
    await Promise.resolve();
    fixture.detectChanges();
  };
  const dial = () => el.querySelector('button[aria-haspopup="listbox"]') as HTMLButtonElement | null;
  const number = () => el.querySelector('input[inputmode="tel"]') as HTMLInputElement | null;
  const viewInput = () => el.querySelector('input[readonly]') as HTMLInputElement | null;
  const list = () => el.querySelector('[role="listbox"]') as HTMLElement | null;
  const optionsEl = () => Array.from(el.querySelectorAll('[role="option"]')) as HTMLElement[];
  const search = () => el.querySelector('input[role="combobox"]') as HTMLInputElement | null;
  const typeNumber = async (text: string) => {
    number()!.focus();
    number()!.value = text;
    number()!.dispatchEvent(new Event('input', { bubbles: true }));
    await tick();
  };
  const keydown = async (target: Element, key: string, init: KeyboardEventInit = {}) => {
    const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init });
    target.dispatchEvent(event);
    await tick();
    return event;
  };
  const openList = async () => {
    dial()!.click();
    await tick();
  };
  return { fixture, host: fixture.componentInstance, el, tick, dial, number, viewInput, list, optionsEl, search, typeNumber, keydown, openList };
}

describe('PhoneInput', () => {
  it('starts in edit mode with the default country (Egypt) when empty', async () => {
    const { dial, number } = await setup();
    expect(dial()?.textContent).toContain('+20');
    expect(number()).toBeTruthy();
  });

  it('gives the number input its label, id and tel input mode', async () => {
    const { number } = await setup();
    expect(number()!.getAttribute('aria-label')).toBe('Mobile');
    expect(number()!.id).toBe('phone-1');
    expect(number()!.getAttribute('inputmode')).toBe('tel');
  });

  it('names the dial-code trigger with the dial code and country name and declares a listbox popup', async () => {
    const { dial } = await setup();
    expect(dial()!.getAttribute('aria-haspopup')).toBe('listbox');
    expect(dial()!.getAttribute('aria-label')).toBe('phone.dialCode +20 Egypt');
    expect(dial()!.getAttribute('aria-expanded')).toBe('false');
  });

  it('forces the number field to left-to-right so digits never reorder in rtl', async () => {
    const { number, el } = await setup();
    expect(number()!.getAttribute('dir')).toBe('ltr');
    expect(el.querySelector('div[dir="ltr"]')).toBeTruthy();
  });

  it('writes the joined international number to the model while typing', async () => {
    const { typeNumber, host } = await setup();
    await typeNumber('1012345678');
    expect(host.value()).toBe('+201012345678');
  });

  it('drops leading zeros from the local part when a country is selected', async () => {
    const { typeNumber, host } = await setup();
    await typeNumber('01012345678');
    expect(host.value()).toBe('+201012345678');
  });

  it('converts Arabic-Indic digits to ASCII', async () => {
    const { typeNumber, host } = await setup();
    await typeNumber('١٠١٢٣٤٥٦٧٨');
    expect(host.value()).toBe('+201012345678');
  });

  it('strips non-digit characters from typed text', async () => {
    const { typeNumber, host } = await setup();
    await typeNumber('10-12 abc 34');
    expect(host.value()).toBe('+20101234');
  });

  it('detects the country from a typed leading plus number', async () => {
    const { typeNumber, host, dial } = await setup();
    await typeNumber('+966501234567');
    expect(host.value()).toBe('+966501234567');
    expect(dial()!.textContent).toContain('+966');
  });

  it('blocks non-digit keystrokes', async () => {
    const { number, keydown } = await setup();
    const event = await keydown(number()!, 'a');
    expect(event.defaultPrevented).toBe(true);
  });

  it('allows digit, navigation and modifier-shortcut keystrokes', async () => {
    const { number, keydown } = await setup();
    expect((await keydown(number()!, '5')).defaultPrevented).toBe(false);
    expect((await keydown(number()!, 'Backspace')).defaultPrevented).toBe(false);
    expect((await keydown(number()!, 'v', { ctrlKey: true })).defaultPrevented).toBe(false);
  });

  it('accepts Arabic-Indic digit keystrokes', async () => {
    const { number, keydown } = await setup();
    expect((await keydown(number()!, '٥')).defaultPrevented).toBe(false);
  });

  it('limits the number input length via maxlength', async () => {
    const { number } = await setup();
    expect(Number(number()!.getAttribute('maxlength'))).toBe(32 - '+20'.length);
  });

  it('shows a normalized read-only view of the model value until focused', async () => {
    const { viewInput, dial } = await setup((h) => h.value.set('+966501234567'));
    expect(dial()).toBeNull();
    expect(viewInput()!.value).toBe('+966501234567');
    expect(viewInput()!.getAttribute('aria-label')).toBe('Mobile');
  });

  it('splits the model value into country and local number when the view is focused for editing', async () => {
    const { viewInput, dial, number, tick, fixture } = await setup((h) => h.value.set('+966501234567'));
    viewInput()!.focus();
    await tick();
    await tick();
    fixture.detectChanges();
    expect(dial()!.textContent).toContain('+966');
    expect(number()!.value).toBe('501234567');
  });

  it('opens the country list from the dial trigger, with a labelled search box focused', async () => {
    const { openList, list, search, dial } = await setup();
    await openList();
    expect(list()).toBeTruthy();
    expect(dial()!.getAttribute('aria-expanded')).toBe('true');
    expect(dial()!.getAttribute('aria-controls')).toBe(list()!.id);
    expect(search()!.getAttribute('aria-label')).toBe('phone.search');
    expect(document.activeElement).toBe(search());
  });

  it('lists every country it is given', async () => {
    const { openList, optionsEl } = await setup();
    await openList();
    expect(optionsEl().length).toBe(3);
  });

  it('marks the current country as selected in the list', async () => {
    const { openList, optionsEl } = await setup();
    await openList();
    expect(optionsEl().map((o) => o.getAttribute('aria-selected'))).toEqual(['true', 'false', 'false']);
  });

  it('filters countries by English name, Arabic name, ISO code and dial code', async () => {
    const { openList, search, optionsEl, tick } = await setup();
    await openList();
    const type = async (text: string) => {
      search()!.value = text;
      search()!.dispatchEvent(new Event('input', { bubbles: true }));
      await tick();
      return optionsEl().map((o) => o.textContent?.trim() ?? '');
    };
    expect((await type('saudi'))[0]).toContain('Saudi Arabia');
    expect((await type('السعودية'))[0]).toContain('Saudi Arabia');
    expect((await type('usa'))[0]).toContain('United States');
    expect((await type('966'))[0]).toContain('Saudi Arabia');
  });

  it('shows a no-matches row when the search finds nothing', async () => {
    const { openList, search, tick, el } = await setup();
    await openList();
    search()!.value = 'zzzz';
    search()!.dispatchEvent(new Event('input', { bubbles: true }));
    await tick();
    expect(el.textContent).toContain('phone.noMatches');
  });

  it('picks a country by click, updates the model and closes the list', async () => {
    const { typeNumber, openList, optionsEl, tick, host, list, dial } = await setup();
    await typeNumber('501234567');
    await openList();
    optionsEl()[1].click();
    await tick();
    expect(host.value()).toBe('+966501234567');
    expect(list()).toBeNull();
    expect(dial()!.textContent).toContain('+966');
  });

  it('moves the active country with ArrowDown/ArrowUp and picks it with Enter', async () => {
    const { openList, search, keydown, host, typeNumber } = await setup();
    await typeNumber('501234567');
    await openList();
    await keydown(search()!, 'ArrowDown');
    expect(search()!.getAttribute('aria-activedescendant')).toContain('-opt-1');
    await keydown(search()!, 'ArrowDown');
    await keydown(search()!, 'ArrowUp');
    await keydown(search()!, 'Enter');
    expect(host.value()).toBe('+966501234567');
  });

  it('closes the list with Escape and returns focus to the dial trigger', async () => {
    const { openList, search, keydown, list, dial } = await setup();
    await openList();
    const event = await keydown(search()!, 'Escape');
    expect(list()).toBeNull();
    expect(event.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(dial());
  });

  it('closes the list on Tab from the search box', async () => {
    const { openList, search, keydown, list } = await setup();
    await openList();
    await keydown(search()!, 'Tab');
    expect(list()).toBeNull();
  });

  it('closes the list when clicking outside', async () => {
    const { openList, list, tick } = await setup();
    await openList();
    document.body.click();
    await tick();
    expect(list()).toBeNull();
  });

  it('opens the list from the dial trigger with ArrowDown', async () => {
    const { dial, keydown, list } = await setup();
    const event = await keydown(dial()!, 'ArrowDown');
    expect(event.defaultPrevented).toBe(true);
    expect(list()).toBeTruthy();
  });

  it('opens the list from the number input with Alt+ArrowDown', async () => {
    const { number, keydown, list } = await setup();
    await keydown(number()!, 'ArrowDown', { altKey: true });
    expect(list()).toBeTruthy();
  });

  it('disables both controls when disabled', async () => {
    const { dial, number } = await setup((h) => h.disabled.set(true));
    expect(dial()!.disabled).toBe(true);
    expect(number()!.disabled).toBe(true);
  });

  it('does not open the list when disabled', async () => {
    const { dial, list, tick } = await setup((h) => h.disabled.set(true));
    dial()!.click();
    await tick();
    expect(list()).toBeNull();
  });

  it('flags the number input with aria-invalid when invalid', async () => {
    const { number } = await setup((h) => h.invalid.set(true));
    expect(number()!.getAttribute('aria-invalid')).toBe('true');
  });

  it('shows a plain read-only value with no editing controls when readonly and filled', async () => {
    const { dial, number, viewInput } = await setup((h) => {
      h.readonly.set(true);
      h.value.set('+201012345678');
    });
    expect(dial()).toBeNull();
    expect(number()).toBeNull();
    expect(viewInput()!.value).toBe('+201012345678');
    expect(viewInput()!.getAttribute('aria-label')).toBe('Mobile');
  });

  it('parses a pasted international number and selects its country', async () => {
    const { number, tick, host } = await setup();
    const event = new Event('paste', { bubbles: true, cancelable: true }) as Event & { clipboardData: unknown };
    event.clipboardData = { getData: () => '+966 50 123 4567' };
    number()!.dispatchEvent(event);
    await tick();
    expect(host.value()).toBe('+966501234567');
    expect(event.defaultPrevented).toBe(true);
  });
});

describe('phone helpers', () => {
  it('toAsciiDigits converts Arabic-Indic and Persian digits', () => {
    expect(toAsciiDigits('٠١٢٣٤٥٦٧٨٩۰۱۲')).toBe('0123456789012');
  });

  it('normalizePhone turns a leading 00 into a plus', () => {
    expect(normalizePhone('00201012345678')).toBe('+201012345678');
  });

  it('normalizePhone returns an empty string when there are no digits', () => {
    expect(normalizePhone('abc')).toBe('');
  });

  it('splitPhone picks the longest matching dial code', () => {
    const canada: GeoCountry = { ...US, id: 'ca', iso2: 'CA', iso3: 'CAN', dialCode: '+1204' };
    expect(splitPhone('+12041234567', [US, canada]).country?.id).toBe('ca');
  });

  it('splitPhone returns no country for a number without a plus', () => {
    expect(splitPhone('0101234', COUNTRIES)).toEqual({ country: null, number: '0101234' });
  });

  it('joinPhone returns an empty string for an empty local number', () => {
    expect(joinPhone(EG, '000')).toBe('');
  });
});
