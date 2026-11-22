import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { Segmented, SegmentedOption } from './segmented';

const OPTIONS: SegmentedOption[] = [
  { value: 'a', label: 'Alpha' },
  { value: 'b', label: 'Beta', disabled: true },
  { value: 'c', label: 'Gamma' },
  { value: 'd', label: 'Delta' },
];

@Component({
  imports: [Segmented],
  template: `<div [attr.dir]="dir()">
    <ui-segmented [options]="options()" [(value)]="value" label="Mode" [id]="'seg'" [describedBy]="'h'" />
  </div>`,
})
class Host {
  readonly options = signal<readonly SegmentedOption[]>(OPTIONS);
  readonly value = signal<string | null>('a');
  readonly dir = signal<'ltr' | 'rtl'>('ltr');
}

function setup() {
  const fixture = TestBed.createComponent(Host);
  document.body.appendChild(fixture.nativeElement);
  fixture.detectChanges();
  const buttons = () => Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLButtonElement[];
  const key = (index: number, k: string) => {
    const event = new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true });
    buttons()[index].dispatchEvent(event);
    fixture.detectChanges();
    return event;
  };
  return { fixture, host: fixture.componentInstance, buttons, key };
}

describe('Segmented', () => {
  it('renders the host as a labelled radiogroup', () => {
    const { fixture } = setup();
    const el = fixture.nativeElement.querySelector('ui-segmented') as HTMLElement;
    expect(el.getAttribute('role')).toBe('radiogroup');
    expect(el.getAttribute('aria-label')).toBe('Mode');
  });

  it('renders one radio button per option with its label', () => {
    const { buttons } = setup();
    expect(buttons().map((b) => b.textContent?.trim())).toEqual(['Alpha', 'Beta', 'Gamma', 'Delta']);
    expect(buttons().every((b) => b.getAttribute('role') === 'radio')).toBe(true);
  });

  it('marks only the selected option as aria-checked', () => {
    const { buttons } = setup();
    expect(buttons().map((b) => b.getAttribute('aria-checked'))).toEqual(['true', 'false', 'false', 'false']);
  });

  it('puts the id on the first option only and describedby on all options', () => {
    const { buttons } = setup();
    expect(buttons()[0].id).toBe('seg');
    expect(buttons()[1].hasAttribute('id')).toBe(false);
    expect(buttons().every((b) => b.getAttribute('aria-describedby') === 'h')).toBe(true);
  });

  it('selects an option on click and updates the model', () => {
    const { fixture, host, buttons } = setup();
    buttons()[2].click();
    fixture.detectChanges();
    expect(host.value()).toBe('c');
    expect(buttons()[2].getAttribute('aria-checked')).toBe('true');
  });

  it('disables disabled options and exposes aria-disabled', () => {
    const { buttons } = setup();
    expect(buttons()[1].disabled).toBe(true);
    expect(buttons()[1].getAttribute('aria-disabled')).toBe('true');
    expect(buttons()[0].hasAttribute('aria-disabled')).toBe(false);
  });

  it('uses a roving tabindex so only the selected option is tabbable', () => {
    const { buttons } = setup();
    expect(buttons().map((b) => b.tabIndex)).toEqual([0, -1, -1, -1]);
  });

  it('makes the first enabled option tabbable when the value matches nothing', () => {
    const { fixture, host, buttons } = setup();
    host.value.set(null);
    fixture.detectChanges();
    expect(buttons().map((b) => b.tabIndex)).toEqual([0, -1, -1, -1]);
  });

  it('skips disabled options with ArrowRight in ltr and prevents default', () => {
    const { host, key } = setup();
    const event = key(0, 'ArrowRight');
    expect(host.value()).toBe('c');
    expect(event.defaultPrevented).toBe(true);
  });

  it('moves focus to the newly selected option', () => {
    const { buttons, key } = setup();
    key(0, 'ArrowRight');
    expect(document.activeElement).toBe(buttons()[2]);
  });

  it('wraps from the last option to the first with ArrowRight', () => {
    const { fixture, host, key } = setup();
    host.value.set('d');
    fixture.detectChanges();
    key(3, 'ArrowRight');
    expect(host.value()).toBe('a');
  });

  it('wraps from the first option to the last with ArrowLeft in ltr', () => {
    const { host, key } = setup();
    key(0, 'ArrowLeft');
    expect(host.value()).toBe('d');
  });

  it('reverses ArrowLeft and ArrowRight inside a dir=rtl ancestor', () => {
    const { fixture, host, key } = setup();
    host.dir.set('rtl');
    fixture.detectChanges();
    key(0, 'ArrowLeft');
    expect(host.value()).toBe('c');
    key(2, 'ArrowRight');
    expect(host.value()).toBe('a');
  });

  it('jumps to the last and first enabled option with End and Home', () => {
    const { host, key } = setup();
    key(0, 'End');
    expect(host.value()).toBe('d');
    key(3, 'Home');
    expect(host.value()).toBe('a');
  });

  it('supports ArrowDown and ArrowUp as next and previous', () => {
    const { host, key } = setup();
    key(0, 'ArrowDown');
    expect(host.value()).toBe('c');
    key(2, 'ArrowUp');
    expect(host.value()).toBe('a');
  });

  it('ignores unrelated keys without preventing default', () => {
    const { host, key } = setup();
    const event = key(0, 'x');
    expect(host.value()).toBe('a');
    expect(event.defaultPrevented).toBe(false);
  });

  it('does nothing on key navigation when every option is disabled', () => {
    const { fixture, host, key } = setup();
    host.options.set(OPTIONS.map((o) => ({ ...o, disabled: true })));
    fixture.detectChanges();
    key(0, 'ArrowRight');
    expect(host.value()).toBe('a');
  });
});
