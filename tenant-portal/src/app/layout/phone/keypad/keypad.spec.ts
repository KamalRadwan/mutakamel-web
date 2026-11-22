import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Keypad } from './keypad';

afterEach(() => TestBed.resetTestingModule());

function mountKeypad() {
  const fixture = TestBed.createComponent(Keypad);
  const pressed = vi.fn();
  fixture.componentInstance.pressed.subscribe(pressed);
  fixture.detectChanges();
  const keys = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('button'));
  return { keys, pressed, el: fixture.nativeElement as HTMLElement };
}

function pointer(target: Element, button = 0): PointerEvent {
  const PointerCtor = (globalThis.PointerEvent ?? MouseEvent) as typeof PointerEvent;
  const event = new PointerCtor('pointerdown', { button, bubbles: true, cancelable: true });
  target.dispatchEvent(event);
  return event;
}

describe('Keypad', () => {
  it('renders the 12 phone keys left-to-right in every language, with letters', () => {
    const { keys, el } = mountKeypad();
    expect(keys.map((k) => k.querySelector('span')!.textContent!.trim())).toEqual([
      '1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#',
    ]);
    expect(keys[1].textContent).toContain('ABC');
    expect(keys[10].textContent).toContain('+');
    expect(el.querySelector('[dir="ltr"]')).not.toBeNull();
  });

  it('emits on primary-button pointerdown only and prevents focus theft', () => {
    const { keys, pressed } = mountKeypad();
    const event = pointer(keys[4]);
    expect(pressed).toHaveBeenCalledWith('5');
    expect(event.defaultPrevented).toBe(true);

    pointer(keys[4], 2);
    expect(pressed).toHaveBeenCalledTimes(1);
  });

  it('emits on Enter and Space, not on other keys or auto-repeat', () => {
    const { keys, pressed } = mountKeypad();
    keys[11].dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    keys[9].dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true }));
    keys[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true, cancelable: true }));
    keys[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', repeat: true, bubbles: true, cancelable: true }));
    expect(pressed.mock.calls).toEqual([['#'], ['*']]);
  });
});
