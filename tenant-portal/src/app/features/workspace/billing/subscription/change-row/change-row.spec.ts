import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { TranslocoService } from '@jsverse/transloco';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ChangeRow, buildAppCatalogGroups, validateCartRow, type CartRow } from './change-row';
import { SUBSCRIPTION, OFFERS, setupHttp, tick } from '../subscription.spec-helpers';

const originalDir = document.documentElement.dir;
const originalTheme = document.documentElement.getAttribute('data-theme');
afterEach(() => {
  TestBed.resetTestingModule();
  vi.restoreAllMocks();
  vi.useRealTimers();
  document.documentElement.dir = originalDir;
  if (originalTheme === null) document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', originalTheme);
});
describe('subscription row controls', () => {
  it.each([
    ['en', 'light'],
    ['en', 'dark'],
    ['ar', 'light'],
    ['ar', 'dark'],
  ])('blocks removal and add-on decrease in %s %s', async (language, theme) => {
    vi.useFakeTimers();
    const http = setupHttp([provideHttpClient(), provideHttpClientTesting()]);
    const t = TestBed.inject(TranslocoService);
    t.setActiveLang(language);
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.setAttribute('data-theme', theme);
    const sub = structuredClone(SUBSCRIPTION);
    sub.addonSelections = [
      {
        id: 'addon-selection',
        parentItemId: 'item',
        addonId: 'addon',
        addonKey: 'extra',
        definitionVersionId: 'version',
        seats: 2,
        acceptedPricing: sub.baseItems[0].acceptedPricing,
        effectiveState: {
          applicationLifecycleStatus: 'ACTIVE',
          addonLifecycleStatus: 'ACTIVE',
          definitionState: 'PUBLISHED',
          operationalUse: 'NOT_EVALUATED',
        },
      },
    ];
    const row: CartRow = {
      kind: 'change-seats',
      selectionKey: 'key',
      targetKind: 'ADDON',
      targetId: 'addon-selection',
      newSeats: '1',
      locked: true,
    };
    const fixture = TestBed.createComponent(ChangeRow);
    for (const [name, value] of Object.entries({
      row,
      subscription: sub,
      catalogueGroups: buildAppCatalogGroups(OFFERS),
      catalogueOffers: OFFERS,
      allRows: [row],
      submitted: true,
    }))
      fixture.componentRef.setInput(name, value);
    fixture.detectChanges();
    await tick(10);
    fixture.detectChanges();
    const root: HTMLElement = fixture.nativeElement;
    expect(root.querySelector<HTMLButtonElement>('header button')).toBeNull();
    const input = root.querySelector<HTMLInputElement>('input[type="number"]');
    expect(input?.min).toBe('3');
    expect(validateCartRow(row, sub, buildAppCatalogGroups(OFFERS), [row], t)).not.toBeNull();
    fixture.destroy();
    http.verify();
  });
});
