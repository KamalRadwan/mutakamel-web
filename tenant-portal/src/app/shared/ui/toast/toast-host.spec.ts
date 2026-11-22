import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { TRANSLOCO_LOADER, provideTransloco } from '@jsverse/transloco';
import { NgIcon } from '@ng-icons/core';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Notify } from '../../../core/notify/notify';
import { ToastHost } from './toast-host';

type ElProto = Record<string, unknown>;
const htmlProto = HTMLElement.prototype as unknown as ElProto;
const elProto = Element.prototype as unknown as ElProto;
const original = {
  showPopover: htmlProto['showPopover'],
  hidePopover: htmlProto['hidePopover'],
  matches: elProto['matches'] as (this: Element, selector: string) => boolean,
};

let popoverOpen = new WeakSet<Element>();
let showPopover: ReturnType<typeof vi.fn>;
let hidePopover: ReturnType<typeof vi.fn>;

beforeEach(() => {
  popoverOpen = new WeakSet();
  // jsdom has no Popover API; emulate it so the stacking behaviour can be asserted.
  showPopover = vi.fn(function (this: Element) {
    popoverOpen.add(this);
  });
  hidePopover = vi.fn(function (this: Element) {
    popoverOpen.delete(this);
  });
  htmlProto['showPopover'] = showPopover;
  htmlProto['hidePopover'] = hidePopover;
  elProto['matches'] = function (this: Element, selector: string) {
    if (selector === ':popover-open') return popoverOpen.has(this);
    return original.matches.call(this, selector);
  };
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  htmlProto['showPopover'] = original.showPopover;
  htmlProto['hidePopover'] = original.hidePopover;
  elProto['matches'] = original.matches;
});

function setup() {
  TestBed.configureTestingModule({
    providers: [
      provideTransloco({ config: { availableLangs: ['en'], defaultLang: 'en', prodMode: true } }),
      { provide: TRANSLOCO_LOADER, useValue: { getTranslation: () => of({}) } },
    ],
  });
  const fixture = TestBed.createComponent(ToastHost);
  const notify = TestBed.inject(Notify);
  const el = fixture.nativeElement as HTMLElement;
  const region = () => el.querySelector('section') as HTMLElement;
  const toasts = () => Array.from(el.querySelectorAll('.toast')) as HTMLElement[];
  const flush = () => {
    fixture.detectChanges();
    TestBed.tick();
    fixture.detectChanges();
  };
  fixture.detectChanges();
  return { fixture, notify, el, region, toasts, flush };
}

describe('ToastHost', () => {
  it('renders the pinned wifi-off danger icon without a close button or any bar', () => {
    const { fixture, notify, toasts, flush } = setup();
    notify.connectionLost('Lost', 'Retrying');
    flush();
    const toast = toasts()[0];
    const icon = toast.querySelector('ng-icon') as HTMLElement;
    const component = fixture.debugElement.query(By.directive(NgIcon)).componentInstance as NgIcon;
    expect(component.name()).toBe('tablerWifiOff');
    expect(icon.parentElement?.classList.contains('bg-danger')).toBe(true);
    expect(icon.parentElement?.classList.contains('text-on-danger')).toBe(true);
    expect(toast.querySelector('button')).toBeNull();
    expect(toast.querySelector('i')).toBeNull();
  });

  it('announces the pinned toast politely once, without announcing in-place updates or retries', () => {
    const { notify, el, toasts, flush } = setup();
    const polite = () => el.querySelector('[role="status"]')?.textContent;
    const assertive = () => el.querySelector('[role="alert"]')?.textContent;
    notify.connectionLost('Lost', 'Retrying');
    flush();
    vi.advanceTimersByTime(60);
    flush();
    expect(polite()).toBe('Lost. Retrying');
    expect(assertive()).toBe('');

    notify.connectionLost('Offline', 'Still retrying');
    flush();
    expect(polite()).toBe('Lost. Retrying');
    vi.advanceTimersByTime(60_000);
    flush();
    expect(toasts()[0].textContent).toContain('Offline');
    expect(polite()).toBe('Lost. Retrying');
    expect(assertive()).toBe('');

    notify.connectionLost('Offline', 'Still retrying');
    flush();
    vi.advanceTimersByTime(60);
    flush();
    expect(polite()).toBe('Lost. Retrying');

    notify.error('Save failed');
    flush();
    vi.advanceTimersByTime(60);
    flush();
    expect(assertive()).toBe('Save failed');
    expect(polite()).toBe('Lost. Retrying');
  });

  it('does not pause or resume the pinned toast on pointer or focus events', () => {
    const { fixture, notify, toasts, flush } = setup();
    const pause = vi.spyOn(notify, 'pause');
    const resume = vi.spyOn(notify, 'resume');
    notify.connectionLost('Lost', 'Retrying');
    flush();
    expect(fixture.debugElement.query(By.css('.toast')).listeners).toEqual([]);
    for (const type of ['mouseenter', 'mouseleave', 'focusin', 'focusout']) {
      toasts()[0].dispatchEvent(new Event(type));
    }
    expect(pause).not.toHaveBeenCalled();
    expect(resume).not.toHaveBeenCalled();
  });

  it('renders a manual popover region', () => {
    const { region } = setup();
    expect(region().getAttribute('popover')).toBe('manual');
  });

  it('labels the region with the translated name', () => {
    const { region } = setup();
    expect(region().getAttribute('aria-label')).toBe('toast.region');
  });

  it('renders no toasts and does not show the popover when empty', () => {
    const { toasts, flush } = setup();
    flush();
    expect(toasts().length).toBe(0);
    expect(showPopover).not.toHaveBeenCalled();
  });

  it('shows a toast with title and text', () => {
    const { notify, toasts, flush } = setup();
    notify.success('Saved', 'Lead updated');
    flush();
    expect(toasts().length).toBe(1);
    expect(toasts()[0].textContent).toContain('Saved');
    expect(toasts()[0].textContent).toContain('Lead updated');
  });

  it('omits the text paragraph when there is no text', () => {
    const { notify, toasts, flush } = setup();
    notify.info('Heads up');
    flush();
    expect(toasts()[0].querySelectorAll('p').length).toBe(1);
  });

  it('announces errors in the persistent assertive region and others in the polite one', () => {
    const { notify, el, flush } = setup();
    notify.error('Failed', 'Try again');
    notify.success('Done');
    flush();
    vi.advanceTimersByTime(60);
    flush();
    expect(el.querySelector('[role="alert"][aria-live="assertive"]')?.textContent).toContain('Failed. Try again');
    expect(el.querySelector('[role="status"][aria-live="polite"]')?.textContent).toContain('Done');
  });

  it('keeps the live regions outside the popover and gives individual toasts no role or aria-live', () => {
    const { notify, el, region, toasts, flush } = setup();
    notify.error('Failed');
    flush();
    expect(region().querySelector('[aria-live], [role="status"], [role="alert"]')).toBeNull();
    expect(el.querySelectorAll('.sr-only[aria-live]').length).toBe(2);
    expect(toasts()[0].hasAttribute('role')).toBe(false);
  });

  it('does not auto-dismiss while hovered and resumes with the remaining time on leave', () => {
    const { notify, toasts, flush } = setup();
    notify.success('Saved');
    flush();
    vi.advanceTimersByTime(3000);
    toasts()[0].dispatchEvent(new MouseEvent('mouseenter'));
    vi.advanceTimersByTime(10000);
    flush();
    expect(toasts().length).toBe(1);
    toasts()[0].dispatchEvent(new MouseEvent('mouseleave'));
    vi.advanceTimersByTime(1100);
    flush();
    expect(toasts().length).toBe(0);
  });

  it('pauses auto-dismiss while keyboard focus is inside the toast', () => {
    const { notify, toasts, flush } = setup();
    notify.info('Info');
    flush();
    toasts()[0].dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    vi.advanceTimersByTime(20000);
    flush();
    expect(toasts().length).toBe(1);
  });

  it('shows the popover when a toast appears', () => {
    const { notify, region, flush } = setup();
    notify.success('Saved');
    flush();
    expect(showPopover).toHaveBeenCalled();
    expect(popoverOpen.has(region())).toBe(true);
  });

  it('re-shows the popover on each new toast so it moves above any open modal', () => {
    const { notify, region, flush } = setup();
    notify.success('One');
    flush();
    notify.success('Two');
    flush();
    expect(hidePopover).toHaveBeenCalled();
    expect(showPopover).toHaveBeenCalledTimes(2);
    expect(popoverOpen.has(region())).toBe(true);
  });

  it('hides the popover when the last toast is closed', () => {
    const { notify, region, flush } = setup();
    notify.error('Failed');
    flush();
    notify.close(notify.toasts()[0].id);
    flush();
    expect(popoverOpen.has(region())).toBe(false);
  });

  it('shows a repeat count badge when the same toast fires again', () => {
    const { notify, toasts, flush } = setup();
    notify.warning('Careful');
    notify.warning('Careful');
    flush();
    expect(toasts().length).toBe(1);
    expect(toasts()[0].textContent).toContain('2');
  });

  it('closes a toast with its close button, which has an accessible name', () => {
    const { notify, toasts, flush } = setup();
    notify.error('Failed');
    flush();
    const close = toasts()[0].querySelector('button') as HTMLButtonElement;
    expect(close.getAttribute('aria-label')).toBe('toast.close');
    close.click();
    flush();
    expect(toasts().length).toBe(0);
  });

  it('keeps at most three toasts visible', () => {
    const { notify, toasts, flush } = setup();
    for (const title of ['a', 'b', 'c', 'd']) notify.info(title);
    flush();
    expect(toasts().length).toBe(3);
  });

  it('gives timed toasts a countdown bar and error toasts a static bar', () => {
    const { notify, el, flush } = setup();
    notify.success('Timed');
    notify.error('Sticky');
    flush();
    expect(el.querySelectorAll('i.countdown').length).toBe(1);
    expect(el.querySelectorAll('section i').length).toBe(2);
  });

  it('places the region with logical start inset so it follows rtl', () => {
    const { region } = setup();
    expect(region().className).toContain('start-toast-edge');
    expect(region().className).not.toMatch(/\b(left|right)-/);
  });

  it('dismisses a success toast automatically after its duration', () => {
    const { notify, toasts, flush } = setup();
    notify.success('Saved');
    flush();
    vi.advanceTimersByTime(4000);
    flush();
    expect(toasts().length).toBe(0);
  });
});
