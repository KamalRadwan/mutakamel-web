import { Component, signal, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ConfirmDialog, ConfirmTone } from './confirm-dialog';

@Component({
  imports: [ConfirmDialog],
  template: `<ui-confirm-dialog
    title="Delete lead"
    text="This cannot be undone."
    confirmLabel="Delete"
    cancelLabel="Keep"
    [tone]="tone()"
  />`,
})
class Host {
  readonly dialog = viewChild.required(ConfirmDialog);
  readonly tone = signal<ConfirmTone>('danger');
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
    setTimeout(() => this.dispatchEvent(new Event('close')));
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
  const buttons = () => Array.from(el.querySelectorAll('button')) as HTMLButtonElement[];
  return { fixture, host: fixture.componentInstance, el, dialog, buttons };
}

describe('ConfirmDialog', () => {
  it('renders title and text', () => {
    const { el } = setup();
    expect(el.querySelector('h2')?.textContent).toContain('Delete lead');
    expect(el.querySelector('p')?.textContent).toContain('This cannot be undone.');
  });

  it('labels the dialog by its title and describes it by its text', () => {
    const { el, dialog } = setup();
    const labelledBy = dialog().getAttribute('aria-labelledby')!;
    const describedBy = dialog().getAttribute('aria-describedby')!;
    expect(el.querySelector(`#${labelledBy}`)?.textContent).toContain('Delete lead');
    expect(el.querySelector(`#${describedBy}`)?.textContent).toContain('This cannot be undone.');
  });

  it('renders the confirm and cancel labels', () => {
    const { buttons } = setup();
    expect(buttons()[0].textContent?.trim()).toBe('Delete');
    expect(buttons()[1].textContent?.trim()).toBe('Keep');
  });

  it('uses the danger icon tile by default and the warning one for the warning tone', () => {
    const { fixture, host, el } = setup();
    expect(el.querySelector('header span')?.className).toContain('bg-icon-red');
    host.tone.set('warning');
    fixture.detectChanges();
    expect(el.querySelector('header span')?.className).toContain('bg-icon-orange');
  });

  it('opens the dialog and focuses the cancel button so Enter never confirms by accident', () => {
    const { host, dialog, buttons } = setup();
    void host.dialog().open();
    expect(dialog().hasAttribute('open')).toBe(true);
    expect(document.activeElement).toBe(buttons()[1]);
  });

  it('resolves true when confirm is clicked and closes the dialog', async () => {
    const { host, dialog, buttons } = setup();
    const result = host.dialog().open();
    buttons()[0].click();
    expect(await result).toBe(true);
    expect(dialog().hasAttribute('open')).toBe(false);
  });

  it('resolves false when cancel is clicked', async () => {
    const { host, buttons } = setup();
    const result = host.dialog().open();
    buttons()[1].click();
    expect(await result).toBe(false);
  });

  it('resolves false when the dialog is closed natively (Escape)', async () => {
    const { host, dialog } = setup();
    const result = host.dialog().open();
    dialog().close();
    expect(await result).toBe(false);
  });

  it('resolves a still-pending previous open with false when opened again', async () => {
    const { host, buttons } = setup();
    const first = host.dialog().open();
    const second = host.dialog().open();
    expect(await first).toBe(false);
    buttons()[0].click();
    expect(await second).toBe(true);
  });

  it('resolves a pending open with false when the component is destroyed', async () => {
    const { fixture, host } = setup();
    const result = host.dialog().open();
    fixture.destroy();
    expect(await result).toBe(false);
  });
});
