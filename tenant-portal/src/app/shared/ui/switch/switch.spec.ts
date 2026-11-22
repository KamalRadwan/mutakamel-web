import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { Switch } from './switch';

@Component({
  imports: [Switch],
  template: `<ui-switch
    [(checked)]="on"
    [disabled]="disabled()"
    [label]="label()"
    [describedBy]="describedBy()"
    [id]="id()"
  />`,
})
class Host {
  readonly on = signal(false);
  readonly disabled = signal(false);
  readonly label = signal('');
  readonly describedBy = signal<string | null>(null);
  readonly id = signal<string | null>(null);
}

function setup() {
  const fixture = TestBed.createComponent(Host);
  fixture.detectChanges();
  const button = () => fixture.nativeElement.querySelector('button') as HTMLButtonElement;
  return { fixture, host: fixture.componentInstance, button };
}

describe('Switch', () => {
  it('renders a button with role switch and aria-checked false by default', () => {
    const { button } = setup();
    expect(button().getAttribute('role')).toBe('switch');
    expect(button().getAttribute('aria-checked')).toBe('false');
  });

  it('toggles checked on click and writes it back to the two-way binding', () => {
    const { fixture, host, button } = setup();
    button().click();
    fixture.detectChanges();
    expect(host.on()).toBe(true);
    expect(button().getAttribute('aria-checked')).toBe('true');
  });

  it('toggles back to unchecked on a second click', () => {
    const { fixture, host, button } = setup();
    button().click();
    fixture.detectChanges();
    button().click();
    fixture.detectChanges();
    expect(host.on()).toBe(false);
  });

  it('does not toggle when disabled', () => {
    const { fixture, host, button } = setup();
    host.disabled.set(true);
    fixture.detectChanges();
    button().click();
    fixture.detectChanges();
    expect(button().disabled).toBe(true);
    expect(host.on()).toBe(false);
  });

  it('sets aria-label, aria-describedby and id when provided', () => {
    const { fixture, host, button } = setup();
    host.label.set('Notifications');
    host.describedBy.set('hint-1');
    host.id.set('sw-1');
    fixture.detectChanges();
    expect(button().getAttribute('aria-label')).toBe('Notifications');
    expect(button().getAttribute('aria-describedby')).toBe('hint-1');
    expect(button().id).toBe('sw-1');
  });

  it('omits aria-label, aria-describedby and id when empty', () => {
    const { button } = setup();
    expect(button().hasAttribute('aria-label')).toBe(false);
    expect(button().hasAttribute('aria-describedby')).toBe(false);
    expect(button().hasAttribute('id')).toBe(false);
  });

  it('moves the knob with logical rtl and ltr translate classes when checked', () => {
    const { fixture, host } = setup();
    host.on.set(true);
    fixture.detectChanges();
    const knob = fixture.nativeElement.querySelector('button > span') as HTMLElement;
    expect(knob.className).toContain('ltr:translate-x-12');
    expect(knob.className).toContain('rtl:-translate-x-12');
  });
});
