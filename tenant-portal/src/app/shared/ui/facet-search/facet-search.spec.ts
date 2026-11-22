import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TRANSLOCO_LOADER, provideTransloco } from '@jsverse/transloco';
import { delay, of } from 'rxjs';
import { describe, expect, it } from 'vitest';
import { FacetSearch } from './facet-search';
import { PRESET_FIELD, SearchFacet, SearchField, SearchOption, addToFacets } from './facet-search.model';

const FIELDS: SearchField[] = [
  { id: 'name', label: 'Name', hint: 'Free text' },
  {
    id: 'status',
    label: 'Status',
    options: [
      { value: 'new', label: 'New' },
      { value: 'news', label: 'Newsletter' },
      { value: 'won', label: 'Won' },
    ],
  },
];
const PRESETS: SearchOption[] = [
  { value: 'mine', label: 'My leads' },
  { value: 'today', label: 'Created today' },
];

@Component({
  imports: [FacetSearch],
  template: `<ui-facet-search
    [fields]="fields"
    [presets]="presets"
    placeholder="Search leads"
    [(facets)]="facets"
    (chipClick)="clicked.push($event)"
  />`,
})
class Host {
  readonly fields = FIELDS;
  readonly presets = PRESETS;
  readonly facets = signal<SearchFacet[]>([]);
  readonly clicked: SearchFacet[] = [];
}

async function setup(init?: (host: Host) => void) {
  TestBed.configureTestingModule({
    providers: [
      provideTransloco({ config: { availableLangs: ['en'], defaultLang: 'en', prodMode: true } }),
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
  const input = () => el.querySelector('input') as HTMLInputElement;
  const list = () => el.querySelector('[role="listbox"]') as HTMLElement | null;
  const rows = () => Array.from(el.querySelectorAll('[role="listbox"] > li[role="option"]')) as HTMLElement[];
  const chips = () => Array.from(el.querySelectorAll('span[role="button"]')) as HTMLElement[];
  const type = (text: string) => {
    input().value = text;
    input().dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();
  };
  const key = (k: string) => {
    const event = new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true });
    input().dispatchEvent(event);
    fixture.detectChanges();
    return event;
  };
  return { fixture, host: fixture.componentInstance, el, input, list, rows, chips, type, key };
}

describe('FacetSearch', () => {
  it('renders a combobox input labelled by the placeholder', async () => {
    const { input } = await setup();
    expect(input().getAttribute('role')).toBe('combobox');
    expect(input().placeholder).toBe('Search leads');
    expect(input().getAttribute('aria-label')).toBe('Search leads');
    expect(input().getAttribute('aria-expanded')).toBe('false');
  });

  it('opens the preset list when the input is focused', async () => {
    const { fixture, input, rows } = await setup();
    input().focus();
    fixture.detectChanges();
    expect(rows().map((r) => r.textContent?.trim())).toEqual(['My leads', 'Created today']);
    expect(input().getAttribute('aria-expanded')).toBe('true');
  });

  it('points aria-controls at the listbox id', async () => {
    const { input, list, type } = await setup();
    type('a');
    expect(list()?.id).toBe(input().getAttribute('aria-controls'));
  });

  it('offers a search-in row for every field when text is typed', async () => {
    const { type, rows } = await setup();
    type('new');
    // name (free text) + status (matches New and Newsletter)
    expect(rows().length).toBe(2);
  });

  it('omits fields whose options do not match the typed text', async () => {
    const { type, rows } = await setup();
    type('zzz');
    expect(rows().length).toBe(1);
    expect(rows()[0].textContent).toContain('Name');
  });

  it('adds a free-text chip with Enter on a field without options and clears the input', async () => {
    const { host, type, key, input } = await setup();
    type('  acme  ');
    key('Enter');
    expect(host.facets()).toEqual([{ field: 'name', label: 'Name', values: [{ value: 'acme', label: 'acme' }] }]);
    expect(input().value).toBe('');
  });

  it('adds all matching options of an option field in one chip', async () => {
    const { host, type, key } = await setup();
    type('new');
    key('ArrowDown');
    key('Enter');
    expect(host.facets()[0].field).toBe('status');
    expect(host.facets()[0].values.map((v) => v.value)).toEqual(['new', 'news']);
  });

  it('moves the active row with ArrowDown and ArrowUp and reflects it in aria-selected', async () => {
    const { type, key, rows } = await setup();
    type('new');
    expect(rows()[0].getAttribute('aria-selected')).toBe('true');
    key('ArrowDown');
    expect(rows()[1].getAttribute('aria-selected')).toBe('true');
    key('ArrowUp');
    expect(rows()[0].getAttribute('aria-selected')).toBe('true');
  });

  it('does not move past the last row with ArrowDown', async () => {
    const { type, key, rows } = await setup();
    type('new');
    key('ArrowDown');
    key('ArrowDown');
    key('ArrowDown');
    expect(rows()[rows().length - 1].getAttribute('aria-selected')).toBe('true');
  });

  it('expands an option field with ArrowRight at the caret end in ltr and collapses with ArrowLeft', async () => {
    const { type, key, rows } = await setup();
    type('new');
    key('ArrowDown');
    key('ArrowRight');
    expect(rows().length).toBe(4);
    key('ArrowLeft');
    expect(rows().length).toBe(2);
  });

  it('toggles the expansion via the row chevron, which exposes aria-expanded', async () => {
    const { fixture, type, el } = await setup();
    type('new');
    const chevron = el.querySelector('li button[aria-expanded]') as HTMLButtonElement;
    expect(chevron.getAttribute('aria-expanded')).toBe('false');
    chevron.click();
    fixture.detectChanges();
    expect((el.querySelector('li button[aria-expanded]') as HTMLButtonElement).getAttribute('aria-expanded')).toBe('true');
  });

  it('adds a single option as a chip when an expanded child is chosen', async () => {
    const { fixture, host, type, el, rows } = await setup();
    type('new');
    (el.querySelector('li button[aria-expanded]') as HTMLButtonElement).click();
    fixture.detectChanges();
    rows()[2].click();
    fixture.detectChanges();
    expect(host.facets()[0].values.map((v) => v.value)).toEqual(['new']);
  });

  it('adds a preset as a filter chip without a label', async () => {
    const { fixture, host, input, rows } = await setup();
    input().focus();
    fixture.detectChanges();
    rows()[0].click();
    fixture.detectChanges();
    expect(host.facets()[0].field).toBe(PRESET_FIELD);
    expect(host.facets()[0].label).toBe('');
  });

  it('hides a preset that is already applied', async () => {
    const { fixture, input, rows } = await setup((h) =>
      h.facets.set([{ field: PRESET_FIELD, label: '', values: [PRESETS[0]] }]),
    );
    input().focus();
    fixture.detectChanges();
    expect(rows().map((r) => r.textContent?.trim())).toEqual(['Created today', 'search.clearAll']);
  });

  it('drops the placeholder once a chip exists', async () => {
    const { input } = await setup((h) => h.facets.set([{ field: 'name', label: 'Name', values: [{ value: 'a', label: 'a' }] }]));
    expect(input().placeholder).toBe('');
  });

  it('renders chips as focusable buttons joining values with the or word', async () => {
    const { chips } = await setup((h) =>
      h.facets.set([
        {
          field: 'status',
          label: 'Status',
          values: [
            { value: 'new', label: 'New' },
            { value: 'won', label: 'Won' },
          ],
        },
      ]),
    );
    expect(chips()[0].tabIndex).toBe(0);
    expect(chips()[0].textContent).toContain('Status:');
    expect(chips()[0].textContent).toContain('search.or');
  });

  it('emits chipClick when a chip is clicked and when Enter or Space is pressed on it', async () => {
    const { fixture, host, chips } = await setup((h) =>
      h.facets.set([{ field: 'name', label: 'Name', values: [{ value: 'a', label: 'a' }] }]),
    );
    chips()[0].click();
    chips()[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    chips()[0].dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
    fixture.detectChanges();
    expect(host.clicked.length).toBe(3);
  });

  it('removes a chip with its labelled remove button without opening the list', async () => {
    const { fixture, host, chips, list } = await setup((h) =>
      h.facets.set([{ field: 'name', label: 'Name', values: [{ value: 'a', label: 'a' }] }]),
    );
    const remove = chips()[0].querySelector('button') as HTMLButtonElement;
    expect(remove.getAttribute('aria-label')).toBe('search.removeNamed');
    remove.click();
    fixture.detectChanges();
    expect(host.facets()).toEqual([]);
    expect(list()).toBeNull();
  });

  it('removes the last chip with Backspace on an empty input only', async () => {
    const { host, type, key } = await setup((h) =>
      h.facets.set([
        { field: 'a', label: 'A', values: [{ value: '1', label: '1' }] },
        { field: 'b', label: 'B', values: [{ value: '2', label: '2' }] },
      ]),
    );
    type('x');
    key('Backspace');
    expect(host.facets().length).toBe(2);
    type('');
    key('Backspace');
    expect(host.facets().map((f) => f.field)).toEqual(['a']);
  });

  it('closes on Escape', async () => {
    const { type, key, list } = await setup();
    type('a');
    key('Escape');
    expect(list()).toBeNull();
  });

  it('closes when clicking outside', async () => {
    const { fixture, type, list } = await setup();
    type('a');
    document.body.click();
    fixture.detectChanges();
    expect(list()).toBeNull();
  });

  it('toggles the list with the filters button, which has an accessible name', async () => {
    const { fixture, el, list } = await setup();
    const toggle = Array.from(el.querySelectorAll('button')).find(
      (b) => b.getAttribute('aria-label') === 'search.filters',
    ) as HTMLButtonElement;
    toggle.click();
    fixture.detectChanges();
    expect(list()).toBeTruthy();
    toggle.click();
    fixture.detectChanges();
    expect(list()).toBeNull();
  });

  it('shows a clear-all row when chips exist and clears everything', async () => {
    const { fixture, host, input, el } = await setup((h) =>
      h.facets.set([{ field: 'name', label: 'Name', values: [{ value: 'a', label: 'a' }] }]),
    );
    input().focus();
    fixture.detectChanges();
    const clearAll = Array.from(el.querySelectorAll('li[role="option"]')).find((li) =>
      li.textContent?.includes('search.clearAll'),
    ) as HTMLElement;
    clearAll.click();
    fixture.detectChanges();
    expect(host.facets()).toEqual([]);
  });

  it('gives each option an id and keeps aria-activedescendant pointing at the active one', async () => {
    const { type, key, input, rows } = await setup();
    type('new');
    expect(input().getAttribute('aria-activedescendant')).toBe(rows()[0].id);
    key('ArrowDown');
    expect(input().getAttribute('aria-activedescendant')).toBe(rows()[1].id);
    expect(new Set(rows().map((r) => r.id)).size).toBe(rows().length);
  });

  it('reaches Clear all with the keyboard and runs it on Enter', async () => {
    const { fixture, host, input, key, rows } = await setup((h) =>
      h.facets.set([{ field: 'name', label: 'Name', values: [{ value: 'a', label: 'a' }] }]),
    );
    input().focus();
    fixture.detectChanges();
    key('ArrowDown');
    key('ArrowDown');
    const last = rows()[rows().length - 1];
    expect(last.textContent).toContain('search.clearAll');
    expect(input().getAttribute('aria-activedescendant')).toBe(last.id);
    key('Enter');
    expect(host.facets()).toEqual([]);
  });

  it('names a label-less preset chip remove button after its values', async () => {
    const { chips } = await setup((h) => h.facets.set([{ field: PRESET_FIELD, label: '', values: [PRESETS[0]] }]));
    expect(chips()[0].querySelector('button')?.getAttribute('aria-label')).toBe('search.removeNamed');
  });

  it('mirrors the expand chevron in rtl using a logical class', async () => {
    const { type, el } = await setup();
    type('new');
    expect(el.querySelector('li button[aria-expanded]')?.className).toContain('rtl:-scale-x-100');
  });
});

describe('addToFacets', () => {
  it('adds a new facet when the field is not present', () => {
    expect(addToFacets([], 'a', 'A', [{ value: '1', label: '1' }])).toEqual([
      { field: 'a', label: 'A', values: [{ value: '1', label: '1' }] },
    ]);
  });

  it('merges new values into an existing facet without duplicating', () => {
    const result = addToFacets(
      [{ field: 'a', label: 'A', values: [{ value: '1', label: '1' }] }],
      'a',
      'A',
      [
        { value: '1', label: '1' },
        { value: '2', label: '2' },
      ],
    );
    expect(result[0].values.map((v) => v.value)).toEqual(['1', '2']);
  });
});
