import { TestBed } from '@angular/core/testing';
import { provideTransloco, TranslocoService } from '@jsverse/transloco';
import { of } from 'rxjs';
import { describe, expect, it } from 'vitest';
import globalEn from '../../../../../../../public/i18n/en.json';
import en from '../../../../../../../public/i18n/ws-branding/en.json';
import { BRANDING_HEX_PATTERN, normaliseHex } from '../branding.model';
import { BrandingColoursCard } from './branding-colours-card';

class Loader {
  getTranslation() {
    return of({});
  }
}

describe('BrandingColoursCard', () => {
  function setup() {
    TestBed.configureTestingModule({
      providers: [
        provideTransloco({
          config: {
            availableLangs: ['en'],
            defaultLang: 'en',
            prodMode: true,
          },
          loader: Loader,
        }),
      ],
    });
    TestBed.inject(TranslocoService).setTranslation({ ...globalEn, wsBranding: en }, 'en');
    return TestBed.createComponent(BrandingColoursCard);
  }

  it('hex without # is normalised', async () => {
    const fixture = setup();
    fixture.detectChanges();
    await fixture.whenStable();
    const input = fixture.nativeElement.querySelector('input');
    if (!(input instanceof HTMLInputElement)) {
      throw new Error('Expected primary colour input');
    }
    input.value = 'FF0000';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(fixture.componentInstance['primaryHex']()).toBe('#ff0000');
    expect(BRANDING_HEX_PATTERN.test('ff0000')).toBe(true);
    for (const hex of ['abc', '#abc', 'abcd', '#abcd', 'AABBCC', 'aabbccdd']) {
      expect(normaliseHex(hex)).toBe(`#${hex.replace('#', '').toLowerCase()}`);
    }
    for (const hex of ['', 'red', '#12345', '##123456']) expect(normaliseHex(hex)).toBeNull();
    fixture.destroy();
  });

  it('picks colours and clears via nullable No colour swatch in ui-color-picker', async () => {
    const fixture = setup();
    const card = fixture.componentInstance;
    const host: HTMLElement = fixture.nativeElement;

    card.primary.set('#1D56C9');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const pickers = host.querySelectorAll<HTMLElement>('ui-color-picker');
    expect(pickers).toHaveLength(2);

    const primaryPicker = pickers[0];
    if (!primaryPicker) throw new Error('Missing primary picker');
    const trigger = primaryPicker.querySelector<HTMLElement>('[data-color-trigger]');
    if (!trigger) throw new Error('Missing trigger');
    trigger.click();
    fixture.detectChanges();
    await fixture.whenStable();

    const noColorBtn = primaryPicker.querySelector<HTMLButtonElement>('[data-no-color]');
    if (!noColorBtn) throw new Error('Missing No colour swatch');
    noColorBtn.click();
    fixture.detectChanges();
    expect(card.primary()).toBe('');

    document.body.click();
    fixture.detectChanges();
    fixture.destroy();
  });

  it('normalises equivalent CSS text and retains the last valid colour after invalid text is dismissed', async () => {
    const fixture = setup();
    const card = fixture.componentInstance;
    const host: HTMLElement = fixture.nativeElement;
    card.primary.set('#FF0000');
    fixture.detectChanges();
    await fixture.whenStable();
    const input = host.querySelector<HTMLInputElement>('input');
    const trigger = host.querySelector<HTMLElement>('[data-color-trigger]');
    if (!input || !trigger) throw new Error('Missing primary colour picker');

    input.value = 'rgb(255, 0, 0)';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    await fixture.whenStable();
    expect(card.primary()).toBe('#FF0000');

    trigger.click();
    fixture.detectChanges();
    await fixture.whenStable();
    input.value = '#invalid';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    await fixture.whenStable();
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(host.querySelector('[data-trigger-swatch] > span')).not.toBeNull();

    document.body.click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(card.primary()).toBe('#FF0000');
    expect(input.value).toBe('#FF0000');
    fixture.destroy();
  });
});
