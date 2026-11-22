import { Component, computed, effect, input, output, signal, untracked } from '@angular/core';
import { FormField, form, maxLength, submit } from '@angular/forms/signals';
import { provideTranslocoScope, TranslocoPipe } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerCircleX, tablerEye, tablerEyeOff } from '@ng-icons/tabler-icons';
import { Button } from '../../../../shared/ui/button/button';
import { Field } from '../../../../shared/ui/field/field';
import { SettingsNotice } from '../../../../shared/ui/settings-notice/settings-notice';
import { retryAfterSeconds, throttleCountdown } from '../../shared/auth-throttle';
import { PASSWORD_MAX, allChecksPass, passwordChecks } from '../../shared/password-policy';
import { PasswordRules } from '../../shared/password-rules/password-rules';
import { resetPassword } from '../reset-password.api';
import { resetErrorKey, resetErrorKind } from '../reset-password.model';

@Component({
  selector: 'app-reset-new-password-form',
  imports: [FormField, TranslocoPipe, NgIcon, Button, Field, SettingsNotice, PasswordRules],
  providers: [provideIcons({ tablerEye, tablerEyeOff, tablerCircleX })],
  viewProviders: [provideTranslocoScope('auth', { scope: 'auth-reset', alias: 'authReset' })],
  templateUrl: './new-password-form.html',
  host: { class: 'block' },
})
export class NewPasswordForm {
  readonly token = input.required<string>();
  readonly done = output<void>();
  readonly invalidLink = output<void>();

  protected readonly model = signal({ newPassword: '', confirmPassword: '' });
  protected readonly form = form(this.model, (path) => {
    maxLength(path.newPassword, PASSWORD_MAX);
    maxLength(path.confirmPassword, PASSWORD_MAX);
  });

  protected readonly showNewPassword = signal(false);
  protected readonly showConfirmPassword = signal(false);
  protected readonly throttle = throttleCountdown();
  protected readonly throttleInitial = signal(0);
  protected readonly throttleEnded = signal(false);
  protected readonly noticeKey = signal<string | null>(null);
  private readonly serverPasswordError = signal<{ sent: string; key: string } | null>(null);

  protected readonly passwordErrorKey = computed<string | null>(() => {
    const server = this.serverPasswordError();
    if (server && server.sent === this.model().newPassword) {
      return server.key;
    }
    return null;
  });

  protected readonly canSubmit = computed(() => {
    const { newPassword, confirmPassword } = this.model();
    return (
      allChecksPass(passwordChecks(newPassword)) &&
      newPassword.length > 0 &&
      newPassword === confirmPassword &&
      !this.throttle.active() &&
      !this.form().submitting()
    );
  });

  constructor() {
    let wasThrottled = false;
    effect(() => {
      const active = this.throttle.active();
      untracked(() => this.throttleEnded.set(!active && wasThrottled));
      wasThrottled = active;
    });
  }

  protected clearPasswordError(): void {
    this.serverPasswordError.set(null);
  }

  protected onSubmit(event: Event): void {
    event.preventDefault();
    if (!this.canSubmit()) return;

    submit(this.form, async () => {
      const password = this.model().newPassword;
      this.serverPasswordError.set(null);
      this.noticeKey.set(null);
      this.throttleEnded.set(false);
      try {
        await resetPassword(this.token(), password);
        this.model.set({ newPassword: '', confirmPassword: '' });
        this.showNewPassword.set(false);
        this.showConfirmPassword.set(false);
        this.done.emit();
      } catch (error) {
        this.handleError(error, password);
      }
      return undefined;
    });
  }

  private handleError(error: unknown, sentPassword: string): void {
    const kind = resetErrorKind(error);
    if (kind === 'invalid-link') {
      this.invalidLink.emit();
      return;
    }
    if (kind === 'field-password') {
      this.serverPasswordError.set({ sent: sentPassword, key: resetErrorKey(error) });
      return;
    }
    if (kind === 'throttle') {
      const seconds = retryAfterSeconds(error);
      this.noticeKey.set(null);
      this.throttleInitial.set(seconds);
      this.throttle.start(seconds);
      return;
    }
    this.noticeKey.set(resetErrorKey(error));
  }
}
