import { Injectable } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslocoLoader, provideTransloco } from '@jsverse/transloco';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CodeBoxes } from './code-boxes';

@Injectable()
class EmptyLoader implements TranslocoLoader {
  getTranslation() {
    return of({});
  }
}

let fixture: ComponentFixture<CodeBoxes>;
let component: CodeBoxes;

function boxes(): HTMLInputElement[] {
  return Array.from(fixture.nativeElement.querySelectorAll('input'));
}

function group(): HTMLElement {
  return fixture.nativeElement.querySelector('[role="group"]') as HTMLElement;
}

describe('CodeBoxes', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideTransloco({
          config: { availableLangs: ['ar', 'en'], defaultLang: 'en', missingHandler: { logMissingKey: false } },
          loader: EmptyLoader,
        }),
      ],
    });
    fixture = TestBed.createComponent(CodeBoxes);
    component = fixture.componentInstance;
    if (!fixture.nativeElement.isConnected) {
      document.body.appendChild(fixture.nativeElement);
    }
    fixture.detectChanges();
  });

  afterEach(() => {
    fixture.destroy();
    TestBed.resetTestingModule();
  });

  it('renders six LTR inputs with correct attributes and labels', () => {
    const inputs = boxes();
    expect(inputs).toHaveLength(6);
    expect(group().getAttribute('dir')).toBe('ltr');
    expect(inputs[0].id).toBe('verify-code-1');
    expect(inputs[0].getAttribute('autocomplete')).toBe('one-time-code');
    // Box 1 must accept the whole autofilled code; maxlength 1 would truncate it.
    expect(inputs[0].getAttribute('maxlength')).toBe('6');
    for (let i = 1; i < 6; i++) {
      expect(inputs[i].id).toBe('');
      expect(inputs[i].getAttribute('autocomplete')).toBe('off');
      expect(inputs[i].getAttribute('maxlength')).toBe('1');
    }
  });

  it('types digits, ignores non-digits, and moves focus right', () => {
    const inputs = boxes();
    inputs[0].focus();

    inputs[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true, cancelable: true }));
    fixture.detectChanges();
    expect(component.value()).toBe('');
    expect(inputs[0].value).toBe('');
    expect(document.activeElement).toBe(inputs[0]);

    inputs[0].dispatchEvent(new KeyboardEvent('keydown', { key: '4', bubbles: true, cancelable: true }));
    fixture.detectChanges();
    expect(component.value()).toBe('4');
    expect(inputs[0].value).toBe('4');
    expect(document.activeElement).toBe(inputs[1]);

    inputs[1].value = 'x';
    inputs[1].dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();
    expect(component.value()).toBe('4');
    expect(inputs[1].value).toBe('');

    inputs[1].dispatchEvent(new KeyboardEvent('keydown', { key: '7', bubbles: true, cancelable: true }));
    fixture.detectChanges();
    expect(component.value()).toBe('47');
    expect(document.activeElement).toBe(inputs[2]);
  });

  it('supports Backspace on filled and empty boxes, arrows, Home/End, and Enter submit', () => {
    const inputs = boxes();
    const submitted = vi.fn();
    component.submitted.subscribe(submitted);

    inputs[0].dispatchEvent(new KeyboardEvent('keydown', { key: '1', bubbles: true, cancelable: true }));
    inputs[1].dispatchEvent(new KeyboardEvent('keydown', { key: '2', bubbles: true, cancelable: true }));
    fixture.detectChanges();
    expect(document.activeElement).toBe(inputs[2]);

    inputs[2].dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true, cancelable: true }));
    fixture.detectChanges();
    expect(component.value()).toBe('1');
    expect(inputs[1].value).toBe('');
    expect(document.activeElement).toBe(inputs[1]);

    inputs[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true, cancelable: true }));
    expect(document.activeElement).toBe(inputs[0]);
    inputs[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
    expect(document.activeElement).toBe(inputs[1]);
    inputs[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true, cancelable: true }));
    expect(document.activeElement).toBe(inputs[0]);
    inputs[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true, cancelable: true }));
    fixture.detectChanges();
    expect(component.value()).toBe('');
    expect(inputs[0].value).toBe('');
    inputs[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true, cancelable: true }));
    expect(document.activeElement).toBe(inputs[5]);
    inputs[5].dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true, cancelable: true }));
    expect(document.activeElement).toBe(inputs[0]);

    inputs[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    expect(submitted).toHaveBeenCalledTimes(1);
  });

  it('fills all six boxes on paste of "12 34-56" and focuses the last filled box', () => {
    const inputs = boxes();
    const pasteEvent = new Event('paste', { bubbles: true, cancelable: true });
    Object.defineProperty(pasteEvent, 'clipboardData', {
      value: { getData: () => '12 34-56' },
    });

    inputs[2].dispatchEvent(pasteEvent);
    fixture.detectChanges();

    expect(component.value()).toBe('123456');
    expect(inputs.map((el) => el.value)).toEqual(['1', '2', '3', '4', '5', '6']);
    expect(document.activeElement).toBe(inputs[5]);
  });

  it('supports one-time-code autofill on box 1', () => {
    const inputs = boxes();
    inputs[0].value = '987654';
    inputs[0].dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();

    expect(component.value()).toBe('987654');
    expect(inputs.map((el) => el.value)).toEqual(['9', '8', '7', '6', '5', '4']);
    expect(document.activeElement).toBe(inputs[5]);
  });

  it('applies invalid, disabled, labelledBy, and describedBy attributes', () => {
    fixture.componentRef.setInput('invalid', true);
    fixture.componentRef.setInput('disabled', true);
    fixture.componentRef.setInput('labelledBy', 'code-lbl');
    fixture.componentRef.setInput('describedBy', 'code-hint code-error');
    fixture.detectChanges();

    expect(group().getAttribute('aria-labelledby')).toBe('code-lbl');
    expect(group().getAttribute('aria-describedby')).toBe('code-hint code-error');
    for (const input of boxes()) {
      expect(input.getAttribute('aria-invalid')).toBe('true');
      expect(input.disabled).toBe(true);
      expect(input.className).toContain('border-danger-border');
    }
  });
});
