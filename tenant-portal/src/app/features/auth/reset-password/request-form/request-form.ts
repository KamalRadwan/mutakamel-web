import { Component, computed, effect, output, signal, untracked } from '@angular/core';
import { FormField, email, form, maxLength, required, submit } from '@angular/forms/signals';
import { provideTranslocoScope, TranslocoPipe } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerCircleX } from '@ng-icons/tabler-icons';
import { Button } from '../../../../shared/ui/button/button';
import { Field } from '../../../../shared/ui/field/field';
import { SettingsNotice } from '../../../../shared/ui/settings-notice/settings-notice';
import { retryAfterSeconds, throttleCountdown } from '../../shared/auth-throttle';
import { requestResetLink } from '../reset-password.api';
import { type ForgotPasswordBody, RESET_LIMITS, resetErrorKey, resetErrorKind } from '../reset-password.model';

@Component({
  selector: 'app-reset-request-form',
  imports: [FormField, TranslocoPipe, NgIcon, Button, Field, SettingsNotice],
  providers: [provideIcons({ tablerCircleX })],
  viewProviders: [provideTranslocoScope('auth', { scope: 'auth-reset', alias: 'authReset' })],
  templateUrl: './request-form.html',
  host: { class: 'block' },
})
export class RequestForm {
  readonly sent = output<string>();

  protected readonly model = signal<ForgotPasswordBody>({ email: '' });
  protected readonly form = form(this.model, (path) => {
    required(path.email);
    email(path.email);
    maxLength(path.email, RESET_LIMITS.emailMax);
  });

  protected readonly throttle = throttleCountdown();
  protected readonly throttleInitial = signal(0);
  protected readonly throttleEnded = signal(false);
  protected readonly noticeKey = signal<string | null>(null);
  private readonly serverEmailError = signal<{ sent: string; key: string } | null>(null);

  protected readonly emailErrorKey = computed<string | null>(() => {
    const state = this.form.email();
    const error = state.touched() ? state.errors()[0] : undefined;
    if (error) {
      return error.kind === 'required' ? 'authReset.errors.required' : 'authReset.errors.email';
    }
    const server = this.serverEmailError();
    if (server && server.sent === this.model().email) {
      return server.key;
    }
    return null;
  });

  constructor() {
    let wasThrottled = false;
    effect(() => {
      const active = this.throttle.active();
      untracked(() => this.throttleEnded.set(!active && wasThrottled));
      wasThrottled = active;
    });
  }

  protected clearServerError(): void {
    this.serverEmailError.set(null);
  }

  protected onSubmit(event: Event): void {
    event.preventDefault();
    if (this.throttle.active() || this.form().submitting()) return;

    submit(this.form, async () => {
      const raw = this.model().email;
      const normalized = raw.trim().toLowerCase();
      this.serverEmailError.set(null);
      this.noticeKey.set(null);
      this.throttleEnded.set(false);
      try {
        await requestResetLink(normalized);
        this.sent.emit(normalized);
      } catch (error) {
        this.handleError(error, raw);
      }
      return undefined;
    });
  }

  private handleError(error: unknown, sentEmail: string): void {
    const kind = resetErrorKind(error);
    if (kind === 'field-email') {
      this.serverEmailError.set({ sent: sentEmail, key: resetErrorKey(error) });
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
