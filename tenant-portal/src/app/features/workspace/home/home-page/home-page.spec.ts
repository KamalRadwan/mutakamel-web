import { Injectable } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslocoLoader, provideTransloco } from '@jsverse/transloco';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CatalogueEntry, setFakeCatalogue } from '../modules.fake';
import type { AppsOverviewItem } from '../modules.model';
import { HomePage } from './home-page';

@Injectable()
class EmptyLoader implements TranslocoLoader {
  getTranslation() {
    return of({});
  }
}

function app(moduleKey: string, group: AppsOverviewItem['group'], extra: Partial<AppsOverviewItem> = {}): CatalogueEntry {
  return {
    rank: 0,
    moduleKey,
    nameI18n: { en: `${moduleKey} en`, ar: `${moduleKey} ar` },
    iconKey: null,
    group,
    isAddon: false,
    myAccessState: null,
    seats: null,
    ...extra,
  };
}

async function render(entries: CatalogueEntry[]): Promise<HTMLElement> {
  setFakeCatalogue(entries.map((entry, index) => ({ ...entry, rank: index })));
  const fixture = TestBed.createComponent(HomePage);
  await fixture.whenStable();
  fixture.detectChanges();
  await fixture.whenStable();
  return fixture.nativeElement as HTMLElement;
}

function cardNames(root: HTMLElement, sectionId: string): string[] {
  const section = root.querySelector(`section[aria-labelledby="${sectionId}"]`);
  return Array.from(section?.querySelectorAll('app-app-card h3') ?? []).map((h) => h.textContent?.trim() ?? '');
}

describe('HomePage on the apps overview', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideTransloco({
          config: { availableLangs: ['en', 'ar'], defaultLang: 'en' },
          loader: EmptyLoader,
        }),
      ],
    });
  });

  afterEach(() => setFakeCatalogue(null));

  it('groups the cards by group, in catalogue order', async () => {
    const root = await render([
      app('crm', 'SUBSCRIBED', { myAccessState: 'ACTIVE' }),
      app('pos', 'AVAILABLE'),
      app('trade', 'SUBSCRIBED', { myAccessState: 'ACTIVE' }),
      app('hr', 'FUTURE'),
    ]);
    expect(cardNames(root, 'home-section-subscribed')).toEqual(['crm en', 'trade en']);
    expect(cardNames(root, 'home-section-available')).toEqual(['pos en']);
    expect(root.querySelector('section[aria-labelledby="home-section-future"]')).not.toBeNull();
  });

  it('hides the FUTURE section when the group is empty', async () => {
    const root = await render([app('crm', 'SUBSCRIBED'), app('pos', 'AVAILABLE')]);
    expect(root.querySelector('section[aria-labelledby="home-section-future"]')).toBeNull();
  });

  it('shows seats only when not null (never on add-ons), the add-on badge and the over-capacity state', async () => {
    const root = await render([
      app('crm', 'SUBSCRIBED', { myAccessState: 'OVER_CAPACITY', seats: { used: 6, total: 5 } }),
      app('trade', 'SUBSCRIBED', { myAccessState: 'ACTIVE', isAddon: true, seats: { used: 1, total: 3 } }),
    ]);
    const [crm, trade] = Array.from(root.querySelectorAll('app-app-card'));
    expect(crm.textContent).toContain('home.card.seats');
    expect(crm.textContent).toContain('home.badges.overCapacity');
    expect(crm.textContent).not.toContain('home.badges.addon');
    expect(trade.textContent).not.toContain('home.card.seats');
    expect(trade.textContent).toContain('home.badges.active');
    expect(trade.textContent).toContain('home.badges.addon');
  });

  it('shows a subscribed app without a seat as a muted "No access" card that does not link', async () => {
    const root = await render([
      app('crm', 'SUBSCRIBED', { myAccessState: 'ACTIVE' }),
      app('trade', 'SUBSCRIBED', { myAccessState: null }),
    ]);
    const [crm, trade] = Array.from(root.querySelectorAll('app-app-card'));
    expect(crm.querySelector('a')).not.toBeNull();
    expect(trade.querySelector('a')).toBeNull();
    expect(trade.querySelector('article')).not.toBeNull();
    expect(trade.textContent).toContain('home.badges.noAccess');
    expect(trade.querySelector('[title="home.badges.noAccessHint"]')).not.toBeNull();
    expect(trade.textContent).not.toContain('home.badges.active');
    expect(trade.textContent).not.toContain('home.card.open');
  });
});
