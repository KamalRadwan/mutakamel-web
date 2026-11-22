import { Component, ElementRef, computed, inject, input, output, signal, viewChild } from '@angular/core';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerCircle, tablerCircleCheck, tablerEye, tablerEyeOff, tablerKey } from '@ng-icons/tabler-icons';
import { Notify } from '../../../../../core/notify/notify';
import { Button } from '../../../../../shared/ui/button/button';
import { Field } from '../../../../../shared/ui/field/field';
import { ApiError, errorCodeOf } from '../../../../../core/api/api-errors';
import { AccountSection } from '../../shared/account-section/account-section';
import { changePassword } from '../security.api';
import { PASSWORD_MAX, allPasswordChecksPass, passwordChecks } from '../security.model';

interface ChecklistItem {
  key: 'length' | 'lower' | 'upper' | 'digit' | 'symbol' | 'match';
  labelKey: string;
  met: boolean;
}

@Component({
  selector: 'app-password-card',
  imports: [NgIcon, TranslocoPipe, Button, Field, AccountSection],
  providers: [provideIcons({ tablerKey, tablerEye, tablerEyeOff, tablerCircleCheck, tablerCircle })],
  templateUrl: './password-card.html',
})
export class PasswordCard {
  private static nextId = 0;

  private readonly notify = inject(Notify);
  private readonly transloco = inject(TranslocoService);
  private readonly currentInput = viewChild<ElementRef<HTMLInputElement>>('currentInput');

  readonly changed = output<void>();
  /** Primary only when no other primary action shares the page (the MFA enable button is primary when MFA is off). */
  readonly primary = input(true);

  protected readonly uid = `security-password-${++PasswordCard.nextId}`;
  protected readonly passwordMax = PASSWORD_MAX;

  protected readonly currentPassword = signal('');
  protected readonly newPassword = signal('');
  protected readonly confirmPassword = signal('');

  protected readonly showCurrent = signal(false);
  protected readonly showNew = signal(false);
  protected readonly showConfirm = signal(false);

  protected readonly currentErrorKey = signal<string | null>(null);
  protected readonly newErrorKey = signal<string | null>(null);
  protected readonly saving = signal(false);

  protected readonly metCount = computed(() => this.checklistItems().filter((item) => item.met).length);
  protected readonly checks = computed(() => passwordChecks(this.newPassword()));
  protected readonly passwordsMatch = computed(() => {
    const next = this.newPassword();
    const confirm = this.confirmPassword();
    return next.length > 0 && confirm.length > 0 && next === confirm;
  });

  protected readonly checklistItems = computed<readonly ChecklistItem[]>(() => {
    const c = this.checks();
    return [
      { key: 'length', labelKey: 'wsAccSec.password.rules.length', met: c.length },
      { key: 'lower', labelKey: 'wsAccSec.password.rules.lower', met: c.lower },
      { key: 'upper', labelKey: 'wsAccSec.password.rules.upper', met: c.upper },
      { key: 'digit', labelKey: 'wsAccSec.password.rules.digit', met: c.digit },
      { key: 'symbol', labelKey: 'wsAccSec.password.rules.symbol', met: c.symbol },
      { key: 'match', labelKey: 'wsAccSec.password.rules.match', met: this.passwordsMatch() },
    ];
  });

  protected readonly canSubmit = computed(
    () =>
      this.currentPassword().length > 0 &&
      allPasswordChecksPass(this.checks()) &&
      this.passwordsMatch() &&
      !this.saving(),
  );

  protected onCurrentInput(event: Event): void {
    this.currentPassword.set((event.target as HTMLInputElement).value);
    this.currentErrorKey.set(null);
  }

  protected onNewInput(event: Event): void {
    this.newPassword.set((event.target as HTMLInputElement).value);
    this.newErrorKey.set(null);
  }

  protected onConfirmInput(event: Event): void {
    this.confirmPassword.set((event.target as HTMLInputElement).value);
  }

  protected async submit(event: Event): Promise<void> {
    event.preventDefault();
    if (!this.canSubmit()) return;

    this.currentErrorKey.set(null);
    this.newErrorKey.set(null);
    this.saving.set(true);

    try {
      await changePassword({
        currentPassword: this.currentPassword(),
        newPassword: this.newPassword(),
      });
      this.currentPassword.set('');
      this.newPassword.set('');
      this.confirmPassword.set('');
      this.showCurrent.set(false);
      this.showNew.set(false);
      this.showConfirm.set(false);
      this.notify.success(this.transloco.translate('wsAccSec.toast.passwordChanged'));
      this.changed.emit();
    } catch (error) {
      const code = errorCodeOf(error);
      if (code === 'CURRENT_PASSWORD_INVALID') {
        this.currentErrorKey.set('wsAccSec.errors.CURRENT_PASSWORD_INVALID');
        queueMicrotask(() => this.currentInput()?.nativeElement.focus());
      } else if (code === 'WEAK_PASSWORD') {
        this.newErrorKey.set('wsAccSec.errors.WEAK_PASSWORD');
      } else if (code === 'PASSWORD_TOO_LONG') {
        this.newErrorKey.set('wsAccSec.errors.PASSWORD_TOO_LONG');
      } else if (code === 'CORE_VALIDATION_FAILED' && error instanceof ApiError && error.details?.['newPassword']) {
        this.newErrorKey.set('wsAccSec.errors.CORE_VALIDATION_FAILED');
      } else if (error instanceof ApiError && error.status === 429) {
        this.notify.error(this.transloco.translate('wsAccSec.errors.TOO_MANY_REQUESTS'));
      } else {
        this.notify.error(this.transloco.translate('wsAccSec.errors.generic'));
      }
    } finally {
      this.saving.set(false);
    }
  }
}
