import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormField, disabled, form, readonly } from '@angular/forms/signals';
import { provideTransloco, TranslocoService } from '@jsverse/transloco';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ar from '../../../../../public/i18n/ar.json';
import en from '../../../../../public/i18n/en.json';
import { ColorPicker } from './color-picker';

class StubLoader {
  getTranslation() {
    return of({});
  }
}

@Component({
  imports: [FormField, ColorPicker],
  template: `
    <div [attr.dir]="dir()">
      <ui-color-picker
        id="strict-color"
        [formField]="strictForm.color"
        [allowAlpha]="allowAlpha()"
        [swatches]="swatches()"
      />
      <ui-color-picker
        id="nullable-color"
        [formField]="nullableForm.bg"
        [nullable]="true"
      />
    </div>
  `,
})
class SignalFormHost {
  readonly dir = signal<'ltr' | 'rtl'>('ltr');
  readonly allowAlpha = signal(true);
  readonly swatches = signal<readonly string[] | null>(['#FF0000', '#00FF00', '#1D56C9']);
  readonly isDisabled = signal(false);
  readonly isReadonly = signal(false);

  readonly strictModel = signal<{ color: string }>({ color: '#1D56C9' });
  readonly strictForm = form(this.strictModel, (p) => {
    disabled(p.color, () => this.isDisabled());
    readonly(p.color, () => this.isReadonly());
  });

  readonly nullableModel = signal<{ bg: string | null }>({ bg: '#DBEAFE' });
  readonly nullableForm = form(this.nullableModel);
}

function requireElement<E extends Element>(root: ParentNode, selector: string): E {
  const el = root.querySelector<E>(selector);
  if (!el) {
    throw new Error(`Expected element matching "${selector}"`);
  }
  return el;
}

describe('ColorPicker', () => {
  let fixture: ComponentFixture<ColorPicker>;
  let picker: ColorPicker;
  let host: HTMLElement;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideTransloco({
          config: {
            availableLangs: ['en', 'ar'],
            defaultLang: 'en',
            reRenderOnLangChange: true,
            prodMode: true,
          },
          loader: StubLoader,
        }),
      ],
    });
    const transloco = TestBed.inject(TranslocoService);
    transloco.setTranslation(en, 'en');
    transloco.setTranslation(ar, 'ar');

    fixture = TestBed.createComponent(ColorPicker);
    picker = fixture.componentInstance;
    host = fixture.nativeElement;
  });

  afterEach(() => {
    fixture.destroy();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  async function render(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  it('opens on click, Enter, and Space, and commits on outside click', async () => {
    picker.value.set('#1D56C9');
    fixture.componentRef.setInput('swatches', ['#FF0000', '#00FF00']);
    await render();

    expect(host.querySelector('[data-color-popover]')).toBeNull();

    const triggerBox = requireElement<HTMLElement>(host, '[data-color-trigger]');
    triggerBox.click();
    await render();
    expect(host.querySelector('[data-color-popover]')).not.toBeNull();

    const redSwatch = requireElement<HTMLButtonElement>(host, '[data-swatch-hex="#FF0000"]');
    redSwatch.click();
    await render();
    expect(picker.value()).toBe('#FF0000');

    document.body.click();
    await render();
    expect(host.querySelector('[data-color-popover]')).toBeNull();
    expect(picker.value()).toBe('#FF0000');

    const triggerInput = requireElement<HTMLInputElement>(host, 'input');
    triggerInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await render();
    expect(host.querySelector('[data-color-popover]')).not.toBeNull();

    document.body.click();
    await render();
    expect(host.querySelector('[data-color-popover]')).toBeNull();

    triggerInput.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
    await render();
    expect(host.querySelector('[data-color-popover]')).not.toBeNull();
  });

  it('applies changes live and reverts to the open-time value on Escape', async () => {
    picker.value.set('#1D56C9');
    fixture.componentRef.setInput('swatches', ['#FF0000', '#00FF00']);
    await render();

    requireElement<HTMLElement>(host, '[data-color-trigger]').click();
    await render();

    requireElement<HTMLButtonElement>(host, '[data-swatch-hex="#00FF00"]').click();
    await render();
    expect(picker.value()).toBe('#00FF00');

    const popover = requireElement<HTMLElement>(host, '[data-color-popover]');
    popover.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await render();

    expect(host.querySelector('[data-color-popover]')).toBeNull();
    expect(picker.value()).toBe('#1D56C9');
  });

  it('moves SV square, hue bar, and opacity slider with keyboard arrows and Shift x10 in exact tab order', async () => {
    picker.value.set('#FF0000');
    await render();

    requireElement<HTMLElement>(host, '[data-color-trigger]').click();
    await render();

    const popover = requireElement<HTMLElement>(host, '[data-color-popover]');
    const svSquare = requireElement<HTMLElement>(popover, '[data-sv-square]');
    const hueBar = requireElement<HTMLElement>(popover, '[data-hue-bar]');
    const alphaBar = requireElement<HTMLElement>(popover, '[data-alpha-bar]');
    const formatToggle = requireElement<HTMLElement>(popover, '[data-format-toggle]');
    const formatInputs = requireElement<HTMLElement>(popover, '[data-format-inputs]');
    const swatchesRow = requireElement<HTMLElement>(popover, '[data-swatches-row]');

    expect(svSquare.compareDocumentPosition(hueBar) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(hueBar.compareDocumentPosition(alphaBar) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(alphaBar.compareDocumentPosition(formatToggle) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(formatToggle.compareDocumentPosition(formatInputs) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(formatInputs.compareDocumentPosition(swatchesRow) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    expect(svSquare.getAttribute('aria-valuetext')).toContain('100%');
    svSquare.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', shiftKey: true, bubbles: true }));
    svSquare.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    await render();
    expect(svSquare.getAttribute('aria-valuetext')).toBe('Saturation 90%, brightness 99%');

    hueBar.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', shiftKey: true, bubbles: true }));
    hueBar.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', shiftKey: true, bubbles: true }));
    await render();
    expect(hueBar.getAttribute('aria-valuenow')).toBe('20');
    expect(hueBar.getAttribute('aria-valuetext')).toBe('20 degrees');

    alphaBar.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', shiftKey: true, bubbles: true }));
    alphaBar.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', shiftKey: true, bubbles: true }));
    await render();
    expect(alphaBar.getAttribute('aria-valuenow')).toBe('80');
    expect(alphaBar.getAttribute('aria-valuetext')).toBe('80%');
    expect(picker.value()?.length).toBe(9);
  });

  it('hides opacity controls when allowAlpha is false', async () => {
    fixture.componentRef.setInput('allowAlpha', false);
    picker.value.set('#1D56C9');
    await render();

    requireElement<HTMLElement>(host, '[data-color-trigger]').click();
    await render();

    expect(host.querySelector('[data-alpha-bar]')).toBeNull();
    expect(host.querySelector('[data-alpha-input]')).toBeNull();
  });

  it('switches between HEX, RGB, and HSL formats, normalises paste, and keeps last valid value on invalid input', async () => {
    picker.value.set('#FF0000');
    await render();

    requireElement<HTMLElement>(host, '[data-color-trigger]').click();
    await render();

    const radioButtons = [...host.querySelectorAll<HTMLButtonElement>('[data-format-toggle] button[role="radio"]')];
    expect(radioButtons).toHaveLength(3);

    const rgbRadio = radioButtons[1];
    if (!rgbRadio) throw new Error('Missing RGB radio');
    rgbRadio.click();
    await render();

    const rIn = requireElement<HTMLInputElement>(host, '[data-rgb-r]');
    const gIn = requireElement<HTMLInputElement>(host, '[data-rgb-g]');
    const bIn = requireElement<HTMLInputElement>(host, '[data-rgb-b]');
    expect(rIn.value).toBe('255');
    expect(gIn.value).toBe('0');
    expect(bIn.value).toBe('0');

    rIn.value = '0';
    rIn.dispatchEvent(new Event('input'));
    gIn.value = '255';
    gIn.dispatchEvent(new Event('input'));
    await render();
    expect(picker.value()).toBe('#00FF00');

    const hslRadio = radioButtons[2];
    if (!hslRadio) throw new Error('Missing HSL radio');
    hslRadio.click();
    await render();

    const hIn = requireElement<HTMLInputElement>(host, '[data-hsl-h]');
    hIn.value = '240';
    hIn.dispatchEvent(new Event('input'));
    await render();
    expect(picker.value()).toBe('#0000FF');

    const hexRadio = radioButtons[0];
    if (!hexRadio) throw new Error('Missing HEX radio');
    hexRadio.click();
    await render();

    const hexIn = requireElement<HTMLInputElement>(host, '[data-hex-input]');
    hexIn.value = 'not-valid';
    hexIn.dispatchEvent(new Event('input'));
    await render();
    expect(picker.parseError()).toBe(true);
    expect(host.querySelector('[data-popover-error]')?.textContent).toContain(en.colorPicker.invalid);
    expect(picker.value()).toBe('#0000FF');

    const pasteData = { getData: (type: string) => (type === 'text' ? 'rgba(255, 0, 128, 0.5)' : '') };
    const pasteEvent = new Event('paste', { bubbles: true, cancelable: true });
    Object.defineProperty(pasteEvent, 'clipboardData', { value: pasteData });
    hexIn.dispatchEvent(pasteEvent);
    await render();

    expect(picker.parseError()).toBe(false);
    expect(picker.value()).toBe('#FF008080');
  });

  it('keeps the original Escape snapshot when ArrowDown is pressed again while open', async () => {
    picker.value.set('#1D56C9');
    fixture.componentRef.setInput('swatches', ['#FF0000']);
    await render();
    const trigger = requireElement<HTMLInputElement>(host, 'input');
    trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    await render();
    requireElement<HTMLButtonElement>(host, '[data-swatch-hex="#FF0000"]').click();
    await render();
    trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    await render();
    requireElement<HTMLElement>(host, '[data-color-popover]').dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
    );
    await render();
    expect(picker.value()).toBe('#1D56C9');
  });

  it('resynchronises the same model value when allowAlpha changes', async () => {
    picker.value.set('#1D56C980');
    await render();
    expect(requireElement<HTMLElement>(host, '[data-trigger-swatch]').classList.contains('cp-checkerboard')).toBe(true);
    fixture.componentRef.setInput('allowAlpha', false);
    await render();
    expect(requireElement<HTMLInputElement>(host, 'input').value).toBe('#1D56C9');
    expect(requireElement<HTMLElement>(host, '[data-trigger-swatch]').classList.contains('cp-checkerboard')).toBe(false);
    fixture.componentRef.setInput('allowAlpha', true);
    await render();
    expect(requireElement<HTMLInputElement>(host, 'input').value).toBe('#1D56C980');
  });

  it('retains the last valid swatch when a wrapper echoes invalid raw text and restores it on commit', async () => {
    picker.value.set('#1D56C9');
    picker.rawValueChange.subscribe((raw) => picker.value.set(raw));
    await render();
    requireElement<HTMLElement>(host, '[data-color-trigger]').click();
    await render();
    const trigger = requireElement<HTMLInputElement>(host, 'input');
    trigger.value = '#invalid';
    trigger.dispatchEvent(new Event('input'));
    await render();
    expect(picker.parseError()).toBe(true);
    expect(requireElement<HTMLElement>(host, '[data-trigger-swatch]').querySelector('span')).not.toBeNull();
    document.body.click();
    await render();
    expect(picker.value()).toBe('#1D56C9');
    expect(trigger.value).toBe('#1D56C9');
  });

  it('emits canonical raw values even when typed or pasted text resolves to the existing colour', async () => {
    picker.value.set('#FF0000');
    const rawValues: string[] = [];
    picker.rawValueChange.subscribe((raw) => rawValues.push(raw));
    await render();
    const trigger = requireElement<HTMLInputElement>(host, 'input');
    trigger.value = 'rgb(255, 0, 0)';
    trigger.dispatchEvent(new Event('input'));
    await render();
    expect(rawValues.at(-1)).toBe('#FF0000');
    const paste = new Event('paste', { bubbles: true, cancelable: true });
    Object.defineProperty(paste, 'clipboardData', { value: { getData: () => 'hsl(0, 100%, 50%)' } });
    trigger.dispatchEvent(paste);
    await render();
    expect(rawValues.at(-1)).toBe('#FF0000');
    expect(trigger.value).toBe('#FF0000');
  });

  it('removes obsolete describedBy IDs when external field errors clear', async () => {
    fixture.componentRef.setInput('describedBy', 'field-hint field-error');
    await render();
    const trigger = requireElement<HTMLInputElement>(host, 'input');
    expect(trigger.getAttribute('aria-describedby')).toBe('field-hint field-error');
    fixture.componentRef.setInput('describedBy', 'field-hint');
    await render();
    expect(trigger.getAttribute('aria-describedby')).toBe('field-hint');
  });

  it('flips above and clamps to the viewport using the date-picker zoom primitive', async () => {
    vi.stubGlobal('innerWidth', 1024);
    vi.stubGlobal('innerHeight', 768);
    await render();
    const trigger = requireElement<HTMLElement>(host, '[data-color-trigger]');
    vi.spyOn(trigger, 'getBoundingClientRect').mockReturnValue(new DOMRect(950, 720, 60, 24));
    trigger.click();
    await render();
    const popover = requireElement<HTMLElement>(host, '[data-color-popover]');
    expect(Number.parseFloat(popover.style.top)).toBeLessThan(720);
    expect(Number.parseFloat(popover.style.insetInlineStart)).toBeLessThanOrEqual(1024 - 248 - 8);
  });

  it('resolves default swatches from current theme tokens each time it opens', async () => {
    const rootStyle = document.documentElement.style;
    const original = rootStyle.getPropertyValue('--brand');
    try {
      rootStyle.setProperty('--brand', '#123456');
      await render();
      requireElement<HTMLElement>(host, '[data-color-trigger]').click();
      await render();
      expect(host.querySelector('[data-swatch-hex="#123456"]')).not.toBeNull();
      document.body.click();
      await render();
      rootStyle.setProperty('--brand', '#ABCDEF');
      requireElement<HTMLElement>(host, '[data-color-trigger]').click();
      await render();
      expect(host.querySelector('[data-swatch-hex="#ABCDEF"]')).not.toBeNull();
    } finally {
      if (original) rootStyle.setProperty('--brand', original);
      else rootStyle.removeProperty('--brand');
    }
  });

  it('integrates with Angular Signal Forms [formField], RTL hue-bar placement, and nullable No colour swatch', async () => {
    const formFixture = TestBed.createComponent(SignalFormHost);
    const formComp = formFixture.componentInstance;
    const formEl: HTMLElement = formFixture.nativeElement;

    formFixture.detectChanges();
    await formFixture.whenStable();
    formFixture.detectChanges();

    const pickers = formEl.querySelectorAll<HTMLElement>('ui-color-picker');
    const firstPicker = pickers[0];
    const secondPicker = pickers[1];
    if (!firstPicker || !secondPicker) throw new Error('Expected two pickers');

    // LTR: hue bar sits on the right
    requireElement<HTMLElement>(firstPicker, '[data-color-trigger]').click();
    formFixture.detectChanges();
    await formFixture.whenStable();
    formFixture.detectChanges();

    expect(requireElement<HTMLElement>(firstPicker, '[data-color-popover]').getAttribute('data-hue-side')).toBe('right');
    expect(requireElement<HTMLElement>(firstPicker, '[data-hue-bar]').getAttribute('data-side')).toBe('right');

    requireElement<HTMLButtonElement>(firstPicker, '[data-swatch-hex="#00FF00"]').click();
    formFixture.detectChanges();
    expect(formComp.strictModel().color).toBe('#00FF00');

    document.body.click();
    formFixture.detectChanges();

    // Switch to RTL + Arabic: hue bar sits on the left
    formComp.dir.set('rtl');
    TestBed.inject(TranslocoService).setActiveLang('ar');
    formFixture.detectChanges();
    await formFixture.whenStable();
    formFixture.detectChanges();

    requireElement<HTMLElement>(secondPicker, '[data-color-trigger]').click();
    formFixture.detectChanges();
    await formFixture.whenStable();
    formFixture.detectChanges();

    const rtlPopover = requireElement<HTMLElement>(secondPicker, '[data-color-popover]');
    expect(rtlPopover.getAttribute('data-hue-side')).toBe('left');
    expect(requireElement<HTMLElement>(secondPicker, '[data-hue-bar]').getAttribute('data-side')).toBe('left');

    const noColorBtn = requireElement<HTMLButtonElement>(secondPicker, '[data-no-color]');
    expect(noColorBtn.getAttribute('aria-label')).toBe(ar.colorPicker.noColor);
    noColorBtn.click();
    formFixture.detectChanges();

    expect(formComp.nullableModel().bg).toBeNull();
    expect(requireElement<HTMLElement>(secondPicker, '[data-live-label]').textContent).toBe(ar.colorPicker.noColor);

    document.body.click();
    formFixture.detectChanges();

    // Disabled & readonly signal form propagation
    formComp.isReadonly.set(true);
    formFixture.detectChanges();
    await formFixture.whenStable();
    expect(requireElement<HTMLInputElement>(firstPicker, 'input').readOnly).toBe(true);
    requireElement<HTMLElement>(firstPicker, '[data-color-trigger]').click();
    formFixture.detectChanges();
    expect(firstPicker.querySelector('[data-color-popover]')).toBeNull();

    formComp.isReadonly.set(false);
    formComp.isDisabled.set(true);
    formFixture.detectChanges();
    await formFixture.whenStable();
    expect(requireElement<HTMLInputElement>(firstPicker, 'input').disabled).toBe(true);

    formFixture.destroy();
  });
});
