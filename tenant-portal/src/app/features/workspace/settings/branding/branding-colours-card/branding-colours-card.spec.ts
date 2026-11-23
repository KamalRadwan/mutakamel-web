import { TestBed } from '@angular/core/testing';
import { provideTransloco, TranslocoService } from '@jsverse/transloco';
import { of } from 'rxjs';
import { describe, expect, it } from 'vitest';
import en from '../../../../../../../public/i18n/ws-branding/en.json';
import { BRANDING_HEX_PATTERN, normaliseHex } from '../branding.model';
import { BrandingColoursCard } from './branding-colours-card';

class Loader {
  getTranslation() {
    return of({});
  }
}
describe('BrandingColoursCard', () => {
  it('hex without # is normalised', async () => {
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
    TestBed.inject(TranslocoService).setTranslation({ wsBranding: en }, 'en');
    const fixture = TestBed.createComponent(BrandingColoursCard);
    fixture.detectChanges();
    await fixture.whenStable();
    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
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
});
