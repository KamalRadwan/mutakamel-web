import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TRANSLOCO_LOADER, provideTransloco } from '@jsverse/transloco';
import { delay, of } from 'rxjs';
import { describe, expect, it } from 'vitest';
import { SettingsFrame } from './settings-frame';

@Component({
  imports: [SettingsFrame],
  template: `
    <app-settings-frame
      addLabel="Add item"
      searchPlaceholder="Search items"
      [addDisabled]="addDisabled()"
      [addHint]="addHint()"
      [loading]="loading()"
      [showAdd]="showAdd()"
      [(search)]="search"
      (add)="adds = adds + 1"
      (reload)="reloads = reloads + 1"
    >
      <p notices id="notice">Notice</p>
      <p id="content">Content</p>
      <span footer id="foot">Footer</span>
    </app-settings-frame>
  `,
})
class Host {
  readonly addDisabled = signal(false);
  readonly addHint = signal<string | null>(null);
  readonly loading = signal(false);
  readonly showAdd = signal(true);
  readonly search = signal('');
  adds = 0;
  reloads = 0;
}

async function setup() {
  TestBed.configureTestingModule({
    providers: [
      provideTransloco({ config: { availableLangs: ['en'], defaultLang: 'en', prodMode: true } }),
      { provide: TRANSLOCO_LOADER, useValue: { getTranslation: () => of({}).pipe(delay(0)) } },
    ],
  });
  const fixture = TestBed.createComponent(Host);
  fixture.detectChanges();
  await new Promise((resolve) => setTimeout(resolve, 20));
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  const addBtn = () => el.querySelector('button.bg-brand, button.bg-neutral-soft') as HTMLButtonElement;
  const input = () => el.querySelector('input') as HTMLInputElement;
  const reloadBtn = () => el.querySelector('button[aria-label="settings.common.reload"]') as HTMLButtonElement;
  const clearBtn = () => el.querySelector('button[aria-label="settings.common.clearSearch"]') as HTMLButtonElement | null;
  const type = (value: string) => {
    input().value = value;
    input().dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();
  };
  return { fixture, host: fixture.componentInstance, el, addBtn, input, reloadBtn, clearBtn, type };
}

describe('SettingsFrame', () => {
  it('grows with its content while filling the available page space', async () => {
    const { el } = await setup();
    const frame = el.querySelector('app-settings-frame') as HTMLElement;
    expect(frame.classList.contains('shrink-0')).toBe(true);
    expect(frame.classList.contains('flex-1')).toBe(true);
    expect(frame.classList.contains('min-h-0')).toBe(false);
  });

  it('renders the add button with its label', async () => {
    const { addBtn } = await setup();
    expect(addBtn().textContent).toContain('Add item');
  });

  it('emits add when the add button is clicked', async () => {
    const { host, addBtn } = await setup();
    addBtn().click();
    expect(host.adds).toBe(1);
  });

  it('does not emit add when disabled and exposes aria-disabled', async () => {
    const { fixture, host, addBtn } = await setup();
    host.addDisabled.set(true);
    fixture.detectChanges();
    addBtn().click();
    expect(host.adds).toBe(0);
    expect(addBtn().getAttribute('aria-disabled')).toBe('true');
  });

  it('keeps the disabled add button focusable (aria-disabled, not the disabled attribute)', async () => {
    const { fixture, host, addBtn } = await setup();
    host.addDisabled.set(true);
    fixture.detectChanges();
    expect(addBtn().disabled).toBe(false);
  });

  it('wires the add hint to the button via aria-describedby and title', async () => {
    const { fixture, host, addBtn, el } = await setup();
    host.addDisabled.set(true);
    host.addHint.set('Plan limit reached');
    fixture.detectChanges();
    const describedBy = addBtn().getAttribute('aria-describedby');
    expect(describedBy).toBeTruthy();
    expect(el.querySelector(`#${describedBy}`)?.textContent).toContain('Plan limit reached');
    expect(addBtn().title).toBe('Plan limit reached');
  });

  it('has no aria-describedby or title without a hint', async () => {
    const { addBtn } = await setup();
    expect(addBtn().hasAttribute('aria-describedby')).toBe(false);
    expect(addBtn().hasAttribute('title')).toBe(false);
  });

  it('hides the add button when showAdd is false', async () => {
    const { fixture, host, el } = await setup();
    host.showAdd.set(false);
    fixture.detectChanges();
    expect(el.textContent).not.toContain('Add item');
  });

  it('labels the search input with its placeholder', async () => {
    const { input } = await setup();
    expect(input().placeholder).toBe('Search items');
    expect(input().getAttribute('aria-label')).toBe('Search items');
  });

  it('writes typed text to the search model', async () => {
    const { host, type } = await setup();
    type('abc');
    expect(host.search()).toBe('abc');
  });

  it('shows the clear button only when there is search text', async () => {
    const { clearBtn, type } = await setup();
    expect(clearBtn()).toBeNull();
    type('abc');
    expect(clearBtn()).toBeTruthy();
  });

  it('clears the search and refocuses the input when the clear button is clicked', async () => {
    const { fixture, host, input, clearBtn, type, el } = await setup();
    document.body.appendChild(el);
    type('abc');
    clearBtn()!.click();
    fixture.detectChanges();
    expect(host.search()).toBe('');
    expect(document.activeElement).toBe(input());
  });

  it('clears the search when Escape is pressed in the input', async () => {
    const { fixture, host, input, type } = await setup();
    type('abc');
    input().dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();
    expect(host.search()).toBe('');
  });

  it('emits reload when the reload button is clicked', async () => {
    const { host, reloadBtn } = await setup();
    reloadBtn().click();
    expect(host.reloads).toBe(1);
  });

  it('disables the reload button and spins its icon while loading', async () => {
    const { fixture, host, reloadBtn } = await setup();
    host.loading.set(true);
    fixture.detectChanges();
    expect(reloadBtn().disabled).toBe(true);
    expect(reloadBtn().querySelector('ng-icon')?.classList.contains('animate-spin')).toBe(true);
  });

  it('gives the reload button an accessible name and title', async () => {
    const { reloadBtn } = await setup();
    expect(reloadBtn().getAttribute('aria-label')).toBe('settings.common.reload');
    expect(reloadBtn().title).toBe('settings.common.reload');
  });

  it('projects notices, default content and footer', async () => {
    const { el } = await setup();
    expect(el.querySelector('#notice')?.textContent).toBe('Notice');
    expect(el.querySelector('#content')?.textContent).toBe('Content');
    expect(el.querySelector('#foot')?.textContent).toBe('Footer');
  });
});
