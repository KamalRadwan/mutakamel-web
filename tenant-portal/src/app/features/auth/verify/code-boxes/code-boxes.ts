import { Component, type ElementRef, input, linkedSignal, model, output, viewChildren } from '@angular/core';
import { TranslocoPipe, provideTranslocoScope } from '@jsverse/transloco';
import { MFA_CODE_LENGTH } from '../verify.model';

const DIGIT_KEY_PATTERN = /^[0-9]$/;

@Component({
  selector: 'app-code-boxes',
  imports: [TranslocoPipe],
  viewProviders: [provideTranslocoScope('auth', { scope: 'auth-verify', alias: 'authVerify' })],
  templateUrl: './code-boxes.html',
  host: { class: 'block' },
})
export class CodeBoxes {
  readonly value = model<string>('');
  readonly invalid = input(false);
  readonly disabled = input(false);
  readonly describedBy = input('');
  readonly labelledBy = input('');
  readonly submitted = output<void>();

  protected readonly indexes = [0, 1, 2, 3, 4, 5] as const;
  private readonly inputs = viewChildren<ElementRef<HTMLInputElement>>('box');

  protected readonly digits = linkedSignal<string, string[]>({
    source: this.value,
    computation: (raw, previous) => {
      const clean = raw.replace(/\D/g, '').slice(0, MFA_CODE_LENGTH);
      if (previous && previous.value.join('') === clean) {
        return previous.value;
      }
      return Array.from({ length: MFA_CODE_LENGTH }, (_, index) => clean[index] ?? '');
    },
  });

  focusFirst(): void {
    this.focusAt(0);
  }

  protected onFocus(event: FocusEvent): void {
    (event.target as HTMLInputElement).select();
  }

  protected onKeydown(index: number, event: KeyboardEvent): void {
    if (this.disabled() || event.ctrlKey || event.metaKey || event.altKey) return;

    if (event.key === 'Enter') {
      event.preventDefault();
      this.submitted.emit();
      return;
    }

    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      this.focusAt(index - 1);
      return;
    }

    if (event.key === 'ArrowRight') {
      event.preventDefault();
      this.focusAt(index + 1);
      return;
    }

    if (event.key === 'Home') {
      event.preventDefault();
      this.focusAt(0);
      return;
    }

    if (event.key === 'End') {
      event.preventDefault();
      this.focusAt(MFA_CODE_LENGTH - 1);
      return;
    }

    if (event.key === 'Backspace') {
      event.preventDefault();
      if (this.digits()[index]) {
        this.setSlot(index, '');
      } else if (index > 0) {
        this.setSlot(index - 1, '');
        this.focusAt(index - 1);
      }
      return;
    }

    if (event.key === 'Delete') {
      event.preventDefault();
      this.setSlot(index, '');
      return;
    }

    if (DIGIT_KEY_PATTERN.test(event.key)) {
      event.preventDefault();
      this.setSlot(index, event.key);
      if (index < MFA_CODE_LENGTH - 1) {
        this.focusAt(index + 1);
      }
      return;
    }

    if (event.key.length === 1) {
      event.preventDefault();
    }
  }

  protected onInput(index: number, event: Event): void {
    if (this.disabled()) return;
    const inputEl = event.target as HTMLInputElement;
    const raw = inputEl.value;
    const cleaned = raw.replace(/\D/g, '').slice(0, MFA_CODE_LENGTH);

    if ((index === 0 && raw.length > 1 && cleaned.length > 0) || cleaned.length >= MFA_CODE_LENGTH) {
      this.fillFromStart(cleaned);
      return;
    }

    if (cleaned.length >= 1) {
      const digit = cleaned.slice(-1);
      this.setSlot(index, digit);
      if (index < MFA_CODE_LENGTH - 1) {
        this.focusAt(index + 1);
      }
      return;
    }

    if (raw === '') {
      this.setSlot(index, '');
      return;
    }

    inputEl.value = this.digits()[index] ?? '';
  }

  protected onPaste(event: ClipboardEvent): void {
    if (this.disabled()) return;
    event.preventDefault();
    const text = event.clipboardData?.getData('text') ?? '';
    const cleaned = text.replace(/\D/g, '').slice(0, MFA_CODE_LENGTH);
    if (cleaned.length === 0) return;
    this.fillFromStart(cleaned);
  }

  private fillFromStart(cleaned: string): void {
    const next = Array.from({ length: MFA_CODE_LENGTH }, (_, index) => cleaned[index] ?? '');
    this.digits.set(next);
    this.value.set(cleaned);
    const elements = this.inputs();
    for (let i = 0; i < MFA_CODE_LENGTH; i++) {
      const el = elements[i]?.nativeElement;
      if (el) el.value = next[i] ?? '';
    }
    this.focusAt(Math.min(cleaned.length - 1, MFA_CODE_LENGTH - 1));
  }

  private setSlot(index: number, digit: string): void {
    const next = [...this.digits()];
    next[index] = digit;
    this.digits.set(next);
    this.value.set(next.join(''));
    const el = this.inputs()[index]?.nativeElement;
    if (el) el.value = digit;
  }

  private focusAt(index: number): void {
    const clamped = Math.max(0, Math.min(MFA_CODE_LENGTH - 1, index));
    this.inputs()[clamped]?.nativeElement.focus();
  }
}
