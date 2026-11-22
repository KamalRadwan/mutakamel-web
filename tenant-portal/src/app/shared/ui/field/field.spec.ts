import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { Field } from './field';

@Component({
  imports: [Field],
  template: `
    <ui-field
      [label]="label()"
      [for]="forId()"
      [hint]="hint()"
      [hintText]="hintText()"
      [required]="required()"
      [error]="error()"
      [count]="count()"
      [max]="max()"
      [size]="size()"
    >
      @if (kind() === 'input') {
        <input class="ctl" />
      } @else if (kind() === 'switch') {
        <div>
          <button class="ctl" role="switch" type="button"></button>
        </div>
      } @else if (kind() === 'preid') {
        <input class="ctl" id="own-id" />
      }
    </ui-field>
  `,
})
class Host {
  readonly label = signal('Email');
  readonly forId = signal('');
  readonly hint = signal('Work email address');
  readonly hintText = signal<string | null>(null);
  readonly required = signal(false);
  readonly error = signal<string | null>(null);
  readonly count = signal<number | null>(null);
  readonly max = signal<number | null>(null);
  readonly size = signal<'default' | 'large' | 'multiline' | 'bare'>('default');
  readonly kind = signal<'input' | 'switch' | 'preid' | 'none'>('input');
}

async function setup(init?: (host: Host) => void) {
  const fixture = TestBed.createComponent(Host);
  init?.(fixture.componentInstance);
  fixture.detectChanges();
  await settle(fixture);
  const el = fixture.nativeElement as HTMLElement;
  return {
    fixture,
    host: fixture.componentInstance,
    el,
    label: () => el.querySelector('label') as HTMLLabelElement,
    control: () => el.querySelector('.ctl') as HTMLElement,
    tooltip: () => el.querySelector('[role="tooltip"]') as HTMLElement | null,
    errorEl: () => el.querySelector('p[id$="-error"]') as HTMLElement | null,
  };
}

// The field syncs ARIA from a MutationObserver (microtask) and effects; flush both.
async function settle(fixture: { detectChanges(): void; whenStable(): Promise<unknown> }) {
  fixture.detectChanges();
  await fixture.whenStable();
  await Promise.resolve();
  fixture.detectChanges();
  await fixture.whenStable();
  await Promise.resolve();
  fixture.detectChanges();
}

describe('Field', () => {
  it('renders the label text and a title with the full label', async () => {
    const { label } = await setup();
    expect(label().textContent).toContain('Email');
    expect(label().title).toBe('Email');
  });

  it('associates the label with the projected input through a generated id', async () => {
    const { label, control } = await setup();
    expect(control().id).toBeTruthy();
    expect(label().getAttribute('for')).toBe(control().id);
  });

  it('respects an id the projected control already has', async () => {
    const { fixture, host, label, control } = await setup();
    host.kind.set('preid');
    fixture.detectChanges();
    await settle(fixture);
    expect(control().id).toBe('own-id');
    expect(label().getAttribute('for')).toBe('own-id');
  });

  it('uses the explicit for input as the label target and the control id', async () => {
    const { label, control } = await setup((h) => h.forId.set('email-field'));
    expect(label().getAttribute('for')).toBe('email-field');
    expect(control().id).toBe('email-field');
  });

  it('shows the required asterisk hidden from assistive tech', async () => {
    const { fixture, host, el } = await setup();
    host.required.set(true);
    fixture.detectChanges();
    const star = Array.from(el.querySelectorAll('span')).find((s) => s.textContent?.trim() === '*');
    expect(star?.getAttribute('aria-hidden')).toBe('true');
  });

  it('renders the hint as a tooltip element', async () => {
    const { tooltip } = await setup();
    expect(tooltip()?.textContent).toContain('Work email address');
  });

  it('links the control to the hint through aria-describedby', async () => {
    const { control, tooltip } = await setup();
    expect(tooltip()?.id).toBeTruthy();
    expect(control().getAttribute('aria-describedby')).toBe(tooltip()!.id);
  });

  it('does not render a tooltip or aria-describedby when the hint is blank', async () => {
    const { fixture, host, control, tooltip } = await setup();
    host.hint.set('   ');
    fixture.detectChanges();
    await settle(fixture);
    expect(tooltip()).toBeNull();
    expect(control().hasAttribute('aria-describedby')).toBe(false);
  });

  it('keeps the tooltip hidden until shown and marks it with role tooltip', async () => {
    const { tooltip } = await setup();
    expect(tooltip()?.getAttribute('role')).toBe('tooltip');
    expect(tooltip()?.className).toContain('invisible');
  });

  it('renders the trigger as a real non-submitting button, one tab stop, named by the label', async () => {
    const { el, tooltip } = await setup();
    const btn = el.querySelector('button[aria-describedby]') as HTMLButtonElement;
    expect(btn.type).toBe('button');
    expect(btn.tabIndex).toBe(0);
    expect(btn.getAttribute('aria-label')).toBe('Email');
    expect(btn.getAttribute('aria-describedby')).toBe(tooltip()!.id);
  });

  it('reveals the tooltip on mouseenter of its trigger and hides it on mouseleave', async () => {
    const { fixture, el, tooltip } = await setup();
    const trigger = el.querySelector('[role="tooltip"]')!.parentElement as HTMLElement;
    trigger.dispatchEvent(new MouseEvent('mouseenter'));
    fixture.detectChanges();
    expect(tooltip()?.className).not.toContain('invisible');
    trigger.dispatchEvent(new MouseEvent('mouseleave'));
    fixture.detectChanges();
    expect(tooltip()?.className).toContain('invisible');
  });

  it('reveals the tooltip on keyboard focus and hides it on blur', async () => {
    const { fixture, el, tooltip } = await setup();
    const btn = el.querySelector('button[aria-describedby]') as HTMLButtonElement;
    btn.dispatchEvent(new FocusEvent('focus'));
    fixture.detectChanges();
    expect(tooltip()?.className).not.toContain('invisible');
    btn.dispatchEvent(new FocusEvent('blur'));
    fixture.detectChanges();
    expect(tooltip()?.className).toContain('invisible');
  });

  it('dismisses an open tooltip with Escape and only consumes Escape while open', async () => {
    const { fixture, el, tooltip } = await setup();
    const btn = el.querySelector('button[aria-describedby]') as HTMLButtonElement;
    const closed = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    let leaked = false;
    el.addEventListener('keydown', () => (leaked = true));
    btn.dispatchEvent(closed);
    expect(leaked).toBe(true);
    leaked = false;
    btn.dispatchEvent(new FocusEvent('focus'));
    fixture.detectChanges();
    btn.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    fixture.detectChanges();
    expect(tooltip()?.className).toContain('invisible');
    expect(leaked).toBe(false);
  });

  it('keeps the tooltip open while focus remains after the pointer leaves', async () => {
    const { fixture, el, tooltip } = await setup();
    const btn = el.querySelector('button[aria-describedby]') as HTMLButtonElement;
    const trigger = btn.parentElement as HTMLElement;
    trigger.dispatchEvent(new MouseEvent('mouseenter'));
    btn.dispatchEvent(new FocusEvent('focus'));
    trigger.dispatchEvent(new MouseEvent('mouseleave'));
    fixture.detectChanges();
    expect(tooltip()?.className).not.toContain('invisible');
  });

  it('positions the tooltip with a logical inset-inline-start', async () => {
    const { fixture, el, tooltip } = await setup();
    (el.querySelector('[role="tooltip"]')!.parentElement as HTMLElement).dispatchEvent(new MouseEvent('mouseenter'));
    fixture.detectChanges();
    expect(tooltip()?.style.getPropertyValue('inset-inline-start')).not.toBe('');
  });

  it('shows an error message and appends it to aria-describedby after the hint', async () => {
    const { fixture, host, control, tooltip, errorEl } = await setup();
    host.error.set('Invalid email');
    fixture.detectChanges();
    await settle(fixture);
    expect(errorEl()?.textContent).toContain('Invalid email');
    expect(control().getAttribute('aria-describedby')).toBe(`${tooltip()!.id} ${errorEl()!.id}`);
  });

  it('removes the error id from aria-describedby when the error clears', async () => {
    const { fixture, host, control, tooltip } = await setup();
    host.error.set('Invalid email');
    fixture.detectChanges();
    await settle(fixture);
    host.error.set(null);
    fixture.detectChanges();
    await settle(fixture);
    expect(control().getAttribute('aria-describedby')).toBe(tooltip()!.id);
  });

  it('applies the danger border to the box on error', async () => {
    const { fixture, host, el } = await setup();
    host.error.set('Bad');
    fixture.detectChanges();
    expect((el.querySelector('ui-field > div:nth-of-type(2)') as HTMLElement).className).toContain('border-danger-border');
  });

  it('shows the helper hintText only when there is no error', async () => {
    const { fixture, host, el } = await setup();
    host.hintText.set('We never share it');
    fixture.detectChanges();
    expect(el.textContent).toContain('We never share it');
    host.error.set('Bad');
    fixture.detectChanges();
    expect(el.textContent).not.toContain('We never share it');
  });

  it('shows a character counter in a direction-isolated element and flags overflow', async () => {
    const { fixture, host, el } = await setup();
    host.max.set(10);
    host.count.set(12);
    fixture.detectChanges();
    const bdi = el.querySelector('bdi') as HTMLElement;
    expect(bdi.getAttribute('dir')).toBe('ltr');
    expect(bdi.textContent?.replace(/\s+/g, ' ').trim()).toBe('12 / 10');
    expect(bdi.parentElement?.className).toContain('text-danger-text');
  });

  it('does not render a counter without max', async () => {
    const { el } = await setup();
    expect(el.querySelector('bdi')).toBeNull();
  });

  it('describes a nested interactive control (switch) when no direct input is projected', async () => {
    const { fixture, host, control, tooltip } = await setup();
    host.kind.set('switch');
    fixture.detectChanges();
    await settle(fixture);
    expect(control().getAttribute('aria-describedby')).toBe(tooltip()!.id);
  });

  it('does not point the label at a control when none is projected', async () => {
    const { fixture, host, label } = await setup();
    host.kind.set('none');
    fixture.detectChanges();
    await settle(fixture);
    expect(label().hasAttribute('for')).toBe(false);
  });

  it('gives different fields different ids', async () => {
    const a = await setup();
    const b = await setup();
    expect(a.control().id).not.toBe(b.control().id);
  });
});
