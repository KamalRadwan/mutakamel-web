import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TRANSLOCO_LOADER, provideTransloco } from '@jsverse/transloco';
import { delay, of } from 'rxjs';
import { describe, expect, it } from 'vitest';
import { Pagination } from './pagination';

@Component({
  imports: [Pagination],
  template: `<ui-pagination [total]="total()" [(page)]="page" [(pageSize)]="pageSize" [label]="label()" />`,
})
class Host {
  readonly total = signal(100);
  readonly page = signal(1);
  readonly pageSize = signal(10);
  readonly label = signal('');
}

async function setup() {
  TestBed.configureTestingModule({
    providers: [
      provideTransloco({
        config: { availableLangs: ['en'], defaultLang: 'en', prodMode: true },
      }),
      { provide: TRANSLOCO_LOADER, useValue: { getTranslation: () => of({}).pipe(delay(0)) } },
    ],
  });
  const fixture = TestBed.createComponent(Host);
  fixture.detectChanges();
  await new Promise((resolve) => setTimeout(resolve, 20));
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  const nav = () => el.querySelector('nav') as HTMLElement;
  const byLabel = (key: string) => el.querySelector(`button[aria-label="${key}"]`) as HTMLButtonElement;
  const pageButtons = () =>
    Array.from(el.querySelectorAll('button[aria-label="pagination.page"]')) as HTMLButtonElement[];
  const pageTexts = () => pageButtons().map((b) => b.textContent?.trim());
  return { fixture, host: fixture.componentInstance, el, nav, byLabel, pageButtons, pageTexts };
}

describe('Pagination', () => {
  it('renders a nav landmark with the translated default label', async () => {
    const { nav } = await setup();
    expect(nav().getAttribute('aria-label')).toBe('pagination.label');
  });

  it('prefers an explicit label over the translated one', async () => {
    const { fixture, host, nav } = await setup();
    host.label.set('Leads pages');
    fixture.detectChanges();
    expect(nav().getAttribute('aria-label')).toBe('Leads pages');
  });

  it('shows first, previous, next and last buttons', async () => {
    const { byLabel } = await setup();
    for (const key of ['pagination.first', 'pagination.prev', 'pagination.next', 'pagination.last']) {
      expect(byLabel(key)).toBeTruthy();
    }
  });

  it('disables first and previous on the first page', async () => {
    const { byLabel } = await setup();
    expect(byLabel('pagination.first').disabled).toBe(true);
    expect(byLabel('pagination.prev').disabled).toBe(true);
    expect(byLabel('pagination.next').disabled).toBe(false);
  });

  it('disables next and last on the last page', async () => {
    const { fixture, host, byLabel } = await setup();
    host.page.set(10);
    fixture.detectChanges();
    expect(byLabel('pagination.next').disabled).toBe(true);
    expect(byLabel('pagination.last').disabled).toBe(true);
    expect(byLabel('pagination.first').disabled).toBe(false);
  });

  it('shows first page, a neighbour window and the last page with ellipses between', async () => {
    const { fixture, host, pageTexts, el } = await setup();
    host.page.set(5);
    fixture.detectChanges();
    expect(pageTexts()).toEqual(['1', '4', '5', '6', '10']);
    const ellipses = Array.from(el.querySelectorAll('span[aria-hidden="true"]')).filter((s) =>
      s.textContent?.includes('…'),
    );
    expect(ellipses.length).toBe(2);
  });

  it('omits the ellipsis when pages are adjacent', async () => {
    const { pageTexts, fixture, host, el } = await setup();
    host.total.set(30);
    fixture.detectChanges();
    expect(pageTexts()).toEqual(['1', '2', '3']);
    expect(el.textContent).not.toContain('…');
  });

  it('marks the current page with aria-current', async () => {
    const { fixture, host, pageButtons } = await setup();
    host.page.set(3);
    fixture.detectChanges();
    const current = pageButtons().filter((b) => b.getAttribute('aria-current') === 'page');
    expect(current.map((b) => b.textContent?.trim())).toEqual(['3']);
  });

  it('navigates to a page when its number is clicked', async () => {
    const { fixture, host, pageButtons } = await setup();
    pageButtons()[1].click();
    fixture.detectChanges();
    expect(host.page()).toBe(2);
  });

  it('goes to next, previous, last and first', async () => {
    const { fixture, host, byLabel } = await setup();
    host.page.set(5);
    fixture.detectChanges();
    byLabel('pagination.next').click();
    fixture.detectChanges();
    expect(host.page()).toBe(6);
    byLabel('pagination.prev').click();
    fixture.detectChanges();
    expect(host.page()).toBe(5);
    byLabel('pagination.last').click();
    fixture.detectChanges();
    expect(host.page()).toBe(10);
    byLabel('pagination.first').click();
    fixture.detectChanges();
    expect(host.page()).toBe(1);
  });

  it('clamps an out-of-range page when computing the highlighted page', async () => {
    const { fixture, host, pageButtons } = await setup();
    host.page.set(99);
    fixture.detectChanges();
    const current = pageButtons().find((b) => b.getAttribute('aria-current') === 'page');
    expect(current?.textContent?.trim()).toBe('10');
  });

  it('shows a single page when total is zero', async () => {
    const { fixture, host, pageTexts } = await setup();
    host.total.set(0);
    fixture.detectChanges();
    expect(pageTexts()).toEqual(['1']);
  });

  it('mirrors the chevron icons in rtl via the rtl:-scale-x-100 class', async () => {
    const { el } = await setup();
    const icons = (Array.from(el.querySelectorAll('ng-icon')) as HTMLElement[]).filter((i) => !i.closest('ui-dropdown'));
    expect(icons.length).toBe(4);
    expect(icons.every((i) => i.className.includes('rtl:-scale-x-100'))).toBe(true);
  });

  it('renders a page-size dropdown', async () => {
    const { el } = await setup();
    expect(el.querySelector('ui-dropdown')).toBeTruthy();
  });
});
