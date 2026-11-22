import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { StepFilter, StepOption } from './step-filter';

const STEPS: StepOption[] = [
  { id: 'all', label: 'All', count: 10 },
  { id: 'won', label: 'Won', count: 0, tone: 'success' },
  { id: 'lost', label: 'Lost', tone: 'danger' },
  { id: 'open', label: 'Open', count: null },
];

@Component({
  imports: [StepFilter],
  template: `<div [attr.dir]="dir()"><ui-step-filter [steps]="steps()" label="Stage" [(value)]="value" /></div>`,
})
class Host {
  readonly steps = signal<readonly StepOption[]>(STEPS);
  readonly value = signal('all');
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

describe('StepFilter', () => {
  it('renders the host as a labelled radiogroup', () => {
    const { fixture } = setup();
    const el = fixture.nativeElement.querySelector('ui-step-filter') as HTMLElement;
    expect(el.getAttribute('role')).toBe('radiogroup');
    expect(el.getAttribute('aria-label')).toBe('Stage');
  });

  it('renders each step as a radio with its label', () => {
    const { buttons } = setup();
    expect(buttons().map((b) => b.getAttribute('role'))).toEqual(['radio', 'radio', 'radio', 'radio']);
    expect(buttons()[0].textContent).toContain('All');
    expect(buttons()[2].textContent).toContain('Lost');
  });

  it('shows a count badge including zero and hides it when count is absent or null', () => {
    const { buttons } = setup();
    expect(buttons()[0].textContent).toContain('10');
    expect(buttons()[1].textContent?.replace(/\s+/g, '')).toBe('Won0');
    expect(buttons()[2].textContent?.trim()).toBe('Lost');
    expect(buttons()[3].textContent?.trim()).toBe('Open');
  });

  it('marks only the selected step as aria-checked', () => {
    const { buttons } = setup();
    expect(buttons().map((b) => b.getAttribute('aria-checked'))).toEqual(['true', 'false', 'false', 'false']);
  });

  it('selects a step on click', () => {
    const { fixture, host, buttons } = setup();
    buttons()[2].click();
    fixture.detectChanges();
    expect(host.value()).toBe('lost');
  });

  it('applies the tone colour family to the selected step', () => {
    const { fixture, host, buttons } = setup();
    host.value.set('won');
    fixture.detectChanges();
    expect(buttons()[1].className).toContain('bg-success');
    expect(buttons()[0].className).toContain('bg-brand-soft');
  });

  it('uses a roving tabindex that follows the selection', () => {
    const { fixture, host, buttons } = setup();
    expect(buttons().map((b) => b.tabIndex)).toEqual([0, -1, -1, -1]);
    host.value.set('lost');
    fixture.detectChanges();
    expect(buttons().map((b) => b.tabIndex)).toEqual([-1, -1, 0, -1]);
  });

  it('keeps the first step tabbable when the value matches no step', () => {
    const { fixture, host, buttons } = setup();
    host.value.set('nope');
    fixture.detectChanges();
    expect(buttons()[0].tabIndex).toBe(0);
  });

  it('moves to the next step with ArrowRight in ltr, selects it, focuses it and prevents default', () => {
    const { host, buttons, key } = setup();
    const event = key(0, 'ArrowRight');
    expect(host.value()).toBe('won');
    expect(document.activeElement).toBe(buttons()[1]);
    expect(event.defaultPrevented).toBe(true);
  });

  it('wraps around at both ends', () => {
    const { host, key } = setup();
    key(0, 'ArrowLeft');
    expect(host.value()).toBe('open');
    key(3, 'ArrowRight');
    expect(host.value()).toBe('all');
  });

  it('reverses the arrow keys inside a dir=rtl ancestor', () => {
    const { fixture, host, key } = setup();
    host.dir.set('rtl');
    fixture.detectChanges();
    key(0, 'ArrowLeft');
    expect(host.value()).toBe('won');
    key(1, 'ArrowRight');
    expect(host.value()).toBe('all');
  });

  it('supports ArrowDown, ArrowUp, Home and End', () => {
    const { host, key } = setup();
    key(0, 'ArrowDown');
    expect(host.value()).toBe('won');
    key(1, 'ArrowUp');
    expect(host.value()).toBe('all');
    key(0, 'End');
    expect(host.value()).toBe('open');
    key(3, 'Home');
    expect(host.value()).toBe('all');
  });

  it('ignores unrelated keys', () => {
    const { host, key } = setup();
    const event = key(0, 'Tab');
    expect(host.value()).toBe('all');
    expect(event.defaultPrevented).toBe(false);
  });

  it('flips the chevron shape and re-flips the content in rtl via logical classes', () => {
    const { buttons, fixture } = setup();
    expect(buttons()[0].className).toContain('rtl:-scale-x-100');
    expect(fixture.nativeElement.querySelector('button > span')?.className).toContain('rtl:-scale-x-100');
  });
});
