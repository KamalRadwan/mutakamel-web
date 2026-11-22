import { Component, signal, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Field } from '../field/field';
import { Modal, ModalSize } from './modal';

@Component({
  imports: [Modal],
  template: `
    <ui-modal
      #modal
      [title]="title()"
      [ariaLabel]="ariaLabel()"
      [subtitle]="subtitle()"
      [size]="size()"
      [closeLabel]="'Close'"
      [dismissable]="dismissable()"
      [preventDismiss]="preventDismiss()"
      [hasFooter]="hasFooter()"
      (closed)="closedCount = closedCount + 1"
      (dismiss)="dismissCount = dismissCount + 1"
    >
      <input id="first" />
      <button modal-footer id="foot">OK</button>
      <span modal-header-end id="hdr">H</span>
    </ui-modal>
  `,
})
class Host {
  readonly modal = viewChild.required(Modal);
  readonly title = signal('Edit lead');
  readonly ariaLabel = signal('');
  readonly subtitle = signal('');
  readonly size = signal<ModalSize>('form');
  readonly dismissable = signal(true);
  readonly preventDismiss = signal(false);
  readonly hasFooter = signal(true);
  closedCount = 0;
  dismissCount = 0;
}

type FocusKind = 'hint' | 'dropdown' | 'radio' | 'autofocus' | 'hintOnly' | 'loading' | 'header' | 'disabled';

@Component({
  imports: [Modal, Field],
  template: `
    <ui-modal #modal title="Batch activity" closeLabel="Close">
      @switch (kind()) {
        @case ('hint') {
          <ui-field label="Type" hint="Pick the activity type" [required]="true">
            <input id="ctl" />
          </ui-field>
        }
        @case ('dropdown') {
          <button id="plain" type="button">Help</button>
          <ui-field label="Owner" hint="Who owns it">
            <button id="ctl" type="button" aria-haspopup="listbox">Owner</button>
          </ui-field>
        }
        @case ('radio') {
          <ui-field label="Type" hint="Pick one">
            <div role="radiogroup">
              <button id="ctl" type="button" role="radio" tabindex="0" aria-checked="true">Call</button>
              <button type="button" role="radio" tabindex="-1" aria-checked="false">Task</button>
            </div>
          </ui-field>
        }
        @case ('autofocus') {
          <input id="first" />
          <textarea id="ctl" data-autofocus></textarea>
        }
        @case ('hintOnly') {
          <ui-field label="Reason" hint="Why">
            <div>loading</div>
          </ui-field>
        }
        @case ('loading') {
          <p>Loading</p>
        }
        @case ('header') {
          <button id="close-in-body" type="button" aria-label="Close">x</button>
          @if (ready()) {
            <ui-field label="Name" hint="Full name">
              <input id="ctl" />
            </ui-field>
          }
        }
        @case ('disabled') {
          <ui-field label="Owner" hint="Who owns it">
            <button id="ctl" type="button" aria-haspopup="listbox" [disabled]="!ready()">Owner</button>
          </ui-field>
        }
      }
      <button modal-footer id="foot">OK</button>
    </ui-modal>
  `,
})
class FocusHost {
  readonly modal = viewChild.required(Modal);
  readonly kind = signal<FocusKind>('hint');
  readonly ready = signal(false);
}

const proto = HTMLDialogElement.prototype as unknown as Record<string, unknown>;
const original = { showModal: proto['showModal'], close: proto['close'] };

beforeEach(() => {
  // jsdom does not implement the modal dialog API; emulate open/close and the native close event.
  proto['showModal'] = function (this: HTMLDialogElement) {
    this.setAttribute('open', '');
  };
  proto['close'] = function (this: HTMLDialogElement) {
    if (!this.hasAttribute('open')) return;
    this.removeAttribute('open');
    this.dispatchEvent(new Event('close'));
  };
});

afterEach(() => {
  proto['showModal'] = original.showModal;
  proto['close'] = original.close;
});

function setup() {
  const fixture = TestBed.createComponent(Host);
  document.body.appendChild(fixture.nativeElement);
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  const dialog = () => el.querySelector('dialog') as HTMLDialogElement;
  return { fixture, host: fixture.componentInstance, el, dialog };
}

describe('Modal', () => {
  it('labels the dialog by its title heading when a title is set', () => {
    const { el, dialog } = setup();
    const id = dialog().getAttribute('aria-labelledby')!;
    expect(el.querySelector(`#${id}`)?.textContent).toContain('Edit lead');
    expect(dialog().hasAttribute('aria-label')).toBe(false);
  });

  it('falls back to aria-label when there is no title', () => {
    const { fixture, host, dialog } = setup();
    host.title.set('');
    host.ariaLabel.set('Lead editor');
    fixture.detectChanges();
    expect(dialog().getAttribute('aria-label')).toBe('Lead editor');
    expect(dialog().hasAttribute('aria-labelledby')).toBe(false);
  });

  it('renders the subtitle only when provided', () => {
    const { fixture, host, el } = setup();
    expect(el.querySelector('header p')).toBeNull();
    host.subtitle.set('Sub text');
    fixture.detectChanges();
    expect(el.querySelector('header p')?.textContent).toContain('Sub text');
  });

  it('omits the header when there is no title', () => {
    const { fixture, host, el } = setup();
    host.title.set('');
    fixture.detectChanges();
    expect(el.querySelector('header')).toBeNull();
  });

  it('gives the close button an aria-label from closeLabel', () => {
    const { el } = setup();
    expect(el.querySelector('header button')?.getAttribute('aria-label')).toBe('Close');
  });

  it('applies the width class for the chosen size', () => {
    const { fixture, host, dialog } = setup();
    expect(dialog().className).toContain('w-modal-form');
    host.size.set('confirm');
    fixture.detectChanges();
    expect(dialog().className).toContain('w-modal-confirm');
  });

  it('projects header-end, body and footer content', () => {
    const { el } = setup();
    expect(el.querySelector('header #hdr')).toBeTruthy();
    expect(el.querySelector('#first')).toBeTruthy();
    expect(el.querySelector('footer #foot')).toBeTruthy();
  });

  it('removes the footer when hasFooter is false', () => {
    const { fixture, host, el } = setup();
    host.hasFooter.set(false);
    fixture.detectChanges();
    expect(el.querySelector('footer')).toBeNull();
  });

  it('opens the dialog and focuses the first focusable element in the body', () => {
    const { host, dialog, el } = setup();
    host.modal().open();
    expect(dialog().hasAttribute('open')).toBe(true);
    expect(document.activeElement).toBe(el.querySelector('#first'));
  });

  it('closes the dialog and emits closed once when close() is called', () => {
    const { host, dialog } = setup();
    host.modal().open();
    host.modal().close();
    expect(dialog().hasAttribute('open')).toBe(false);
    expect(host.closedCount).toBe(1);
  });

  it('does not emit closed when close() is called while never opened', () => {
    const { host } = setup();
    host.modal().close();
    expect(host.closedCount).toBe(0);
  });

  it('closes when the close button is clicked', () => {
    const { host, el } = setup();
    host.modal().open();
    (el.querySelector('header button') as HTMLButtonElement).click();
    expect(host.closedCount).toBe(1);
  });

  it('closes on Escape when dismissable', () => {
    const { fixture, host, dialog } = setup();
    host.modal().open();
    const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    dialog().dispatchEvent(event);
    fixture.detectChanges();
    expect(host.closedCount).toBe(1);
    expect(event.defaultPrevented).toBe(true);
  });

  it('stays open on Escape when not dismissable', () => {
    const { fixture, host, dialog } = setup();
    host.dismissable.set(false);
    fixture.detectChanges();
    host.modal().open();
    dialog().dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    expect(dialog().hasAttribute('open')).toBe(true);
    expect(host.closedCount).toBe(0);
  });

  it('prevents the native cancel event when not dismissable', () => {
    const { fixture, host, dialog } = setup();
    host.dismissable.set(false);
    fixture.detectChanges();
    const event = new Event('cancel', { cancelable: true });
    dialog().dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  });

  it('allows the native cancel event when dismissable', () => {
    const { dialog } = setup();
    const event = new Event('cancel', { cancelable: true });
    dialog().dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
  });

  it('closes when the backdrop (the dialog element itself) is clicked', () => {
    const { host, dialog } = setup();
    host.modal().open();
    dialog().click();
    expect(host.closedCount).toBe(1);
  });

  it('does not close when content inside the dialog is clicked', () => {
    const { host, el } = setup();
    host.modal().open();
    (el.querySelector('#first') as HTMLElement).click();
    expect(host.closedCount).toBe(0);
  });

  it('ignores backdrop clicks when not dismissable', () => {
    const { fixture, host, dialog } = setup();
    host.dismissable.set(false);
    fixture.detectChanges();
    host.modal().open();
    dialog().click();
    expect(host.closedCount).toBe(0);
  });

  it('emits closed when the dialog is closed natively', () => {
    const { host, dialog } = setup();
    host.modal().open();
    dialog().close();
    expect(host.closedCount).toBe(1);
  });

  it('gives each modal a unique title id', () => {
    const a = setup();
    const b = setup();
    expect(a.dialog().getAttribute('aria-labelledby')).not.toBe(b.dialog().getAttribute('aria-labelledby'));
  });

  it('applies the record width class and full height cap when size is record', () => {
    const { fixture, host, dialog, el } = setup();
    host.size.set('record');
    fixture.detectChanges();
    const dialogEl = dialog();
    const frameEl = el.querySelector('dialog > div') as HTMLElement;
    expect(dialogEl.className).toContain('w-modal-record');
    expect(dialogEl.className).toContain('overflow-hidden');
    expect(dialogEl.style.height).toContain('--modal-record-h');
    expect(dialogEl.style.maxHeight).toContain('--modal-record-h');
    expect(frameEl.className).toContain('min-h-0');
    expect(frameEl.className).toContain('overflow-hidden');
    expect(frameEl.style.maxHeight).toBe('100%');
  });

  it('emits dismiss without closing when preventDismiss is true', () => {
    const { fixture, host, dialog, el } = setup();
    host.preventDismiss.set(true);
    fixture.detectChanges();
    host.modal().open();

    const escEvent = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    dialog().dispatchEvent(escEvent);
    expect(escEvent.defaultPrevented).toBe(true);
    expect(dialog().hasAttribute('open')).toBe(true);
    expect(host.dismissCount).toBe(1);
    expect(host.closedCount).toBe(0);

    dialog().click();
    expect(dialog().hasAttribute('open')).toBe(true);
    expect(host.dismissCount).toBe(2);

    (el.querySelector('header button') as HTMLButtonElement).click();
    expect(dialog().hasAttribute('open')).toBe(true);
    expect(host.dismissCount).toBe(3);

    const cancelEvent = new Event('cancel', { cancelable: true });
    dialog().dispatchEvent(cancelEvent);
    expect(cancelEvent.defaultPrevented).toBe(true);
  });
});

describe('Modal initial focus', () => {
  function setupFocus(kind: FocusKind) {
    const fixture = TestBed.createComponent(FocusHost);
    document.body.appendChild(fixture.nativeElement);
    fixture.componentInstance.kind.set(kind);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    return { fixture, host: fixture.componentInstance, el };
  }

  it('skips the field "!" hint button and focuses the control after it', () => {
    const { host, el } = setupFocus('hint');
    host.modal().open();
    expect(document.activeElement).toBe(el.querySelector('#ctl'));
    const hint = el.querySelector<HTMLElement>('[data-ui-hint]')!;
    expect(el.querySelector('[role="tooltip"]')?.classList.contains('visible')).toBe(false);
    // The hint stays keyboard reachable and keeps its description link.
    expect(hint.tabIndex).toBe(0);
    expect(hint.getAttribute('aria-describedby')).toMatch(/-hint$/);
  });

  it('prefers a form control (dropdown trigger) over an earlier plain button', () => {
    const { host, el } = setupFocus('dropdown');
    host.modal().open();
    expect(document.activeElement).toBe(el.querySelector('#ctl'));
  });

  it('focuses the checked radio of a roving radio group', () => {
    const { host, el } = setupFocus('radio');
    host.modal().open();
    expect(document.activeElement).toBe(el.querySelector('#ctl'));
  });

  it('honours data-autofocus over the first form control', () => {
    const { host, el } = setupFocus('autofocus');
    host.modal().open();
    expect(document.activeElement).toBe(el.querySelector('#ctl'));
  });

  it('focuses the dialog itself when the body only holds a hint, never the hint', () => {
    const { host, el } = setupFocus('hintOnly');
    host.modal().open();
    expect(document.activeElement).toBe(el.querySelector('dialog'));
  });

  it('re-checks after the next render when the body content changes as it opens', async () => {
    const { fixture, host, el } = setupFocus('loading');
    host.kind.set('hint');
    host.modal().open();
    expect(document.activeElement).toBe(el.querySelector('dialog'));
    fixture.detectChanges();
    await fixture.whenStable();
    expect(document.activeElement).toBe(el.querySelector('#ctl'));
  });

  it('moves focus from a close button in the body to the first field that renders after open', async () => {
    const { fixture, host, el } = setupFocus('header');
    host.modal().open();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(document.activeElement).toBe(el.querySelector('#close-in-body'));

    host.ready.set(true);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(document.activeElement).toBe(el.querySelector('#ctl'));
  });

  it('moves focus from the dialog to a field once it is no longer disabled', async () => {
    const { fixture, host, el } = setupFocus('disabled');
    host.modal().open();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(document.activeElement).toBe(el.querySelector('dialog'));

    host.ready.set(true);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(document.activeElement).toBe(el.querySelector('#ctl'));
  });

  it('stops watching for late fields once the user presses a key', async () => {
    const { fixture, host, el } = setupFocus('header');
    host.modal().open();
    fixture.detectChanges();
    await fixture.whenStable();
    const close = el.querySelector<HTMLElement>('#close-in-body')!;
    close.dispatchEvent(new KeyboardEvent('keydown', { key: 'Shift', bubbles: true }));

    host.ready.set(true);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(document.activeElement).toBe(close);
  });

  it('leaves focus alone when the feature moved it before the next render', async () => {
    const { fixture, host, el } = setupFocus('autofocus');
    host.modal().open();
    const first = el.querySelector<HTMLElement>('#first')!;
    first.focus();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(document.activeElement).toBe(first);
  });
});
