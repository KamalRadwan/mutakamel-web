import { Component, output } from '@angular/core';

interface KeypadKey {
  digit: string;
  letters: string;
}

const KEYS: readonly KeypadKey[] = [
  { digit: '1', letters: '' },
  { digit: '2', letters: 'ABC' },
  { digit: '3', letters: 'DEF' },
  { digit: '4', letters: 'GHI' },
  { digit: '5', letters: 'JKL' },
  { digit: '6', letters: 'MNO' },
  { digit: '7', letters: 'PQRS' },
  { digit: '8', letters: 'TUV' },
  { digit: '9', letters: 'WXYZ' },
  { digit: '*', letters: '' },
  { digit: '0', letters: '+' },
  { digit: '#', letters: '' },
];

@Component({
  selector: 'app-keypad',
  templateUrl: './keypad.html',
  host: { class: 'flex grow shrink-0 flex-col' },
})
export class Keypad {
  readonly pressed = output<string>();
  protected readonly keys = KEYS;

  protected onPointerDown(event: PointerEvent, digit: string): void {
    if (event.button !== 0) return;
    event.preventDefault();
    this.pressed.emit(digit);
  }

  protected onKeydown(event: KeyboardEvent, digit: string): void {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    if (event.repeat) return;
    this.pressed.emit(digit);
  }
}
