import { Component, ElementRef, effect, input, model, signal, untracked, viewChild } from '@angular/core';
import { TranslocoPipe, provideTranslocoScope } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerEye, tablerEyeOff, tablerLock } from '@ng-icons/tabler-icons';
import { Button } from '../../../../../../shared/ui/button/button';

@Component({
  selector: 'app-phone-password',
  imports: [NgIcon, TranslocoPipe, Button],
  providers: [
    provideTranslocoScope('settings', 'staff', { scope: 'staff-user-phone', alias: 'userPhone' }),
    provideIcons({ tablerEye, tablerEyeOff, tablerLock }),
  ],
  templateUrl: './phone-password.html',
  host: { class: 'block min-w-0' },
})
export class PhonePassword {
  private readonly pwdInput = viewChild<ElementRef<HTMLInputElement>>('pwdInput');

  readonly configured = input(false);
  readonly readonly = input(false);
  readonly disabled = input(false);
  readonly fieldId = input<string | null>(null);
  readonly describedBy = input<string | null>(null);
  readonly hasError = input(false);

  readonly value = model<string | null>(null);

  protected readonly changing = signal(false);
  protected readonly revealed = signal(false);

  constructor() {
    effect(() => {
      if (this.configured() && this.value() === null) {
        untracked(() => {
          this.changing.set(false);
          this.revealed.set(false);
        });
      }
    });
  }

  reset(): void {
    this.value.set(null);
    this.changing.set(false);
    this.revealed.set(false);
  }

  protected startChange(): void {
    if (this.readonly() || this.disabled()) return;
    this.changing.set(true);
    this.revealed.set(false);
    this.value.set('');
    queueMicrotask(() => this.pwdInput()?.nativeElement.focus());
  }

  protected keepCurrent(): void {
    if (this.disabled()) return;
    this.value.set(null);
    this.changing.set(false);
    this.revealed.set(false);
  }

  protected toggleReveal(): void {
    this.revealed.update((current) => !current);
  }

  protected onInput(event: Event): void {
    this.value.set((event.target as HTMLInputElement).value);
  }
}
