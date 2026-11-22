import { Component, DestroyRef, computed, effect, inject, signal, untracked, viewChild } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerCircleX } from '@ng-icons/tabler-icons';
import { errorCodeOf } from '../../../../core/api/api-errors';
import { AuthSession } from '../../../../core/auth/auth-session';
import { AuthTransport } from '../../../../core/auth/auth-transport';
import { translationEvents } from '../../../../core/i18n/translation-events';
import { Notify } from '../../../../core/notify/notify';
import { Button } from '../../../../shared/ui/button/button';
import { Field } from '../../../../shared/ui/field/field';
import { SettingsNotice } from '../../../../shared/ui/settings-notice/settings-notice';
import { AuthCard } from '../../shared/auth-card/auth-card';
import { retryAfterSeconds, throttleCountdown } from '../../shared/auth-throttle';
import { MfaPending } from '../../shared/mfa-pending';
import { CodeBoxes } from '../code-boxes/code-boxes';
import { resendCode, verifyCode } from '../verify.api';
import {
  MFA_CODE_PATTERN,
  MFA_MAX_LOCAL_ATTEMPTS,
  type VerifyNoticeTone,
  formatCountdown,
  verifyErrorKey,
} from '../verify.model';

const TIME_SENTINEL = '\u0000';

@Component({
  selector: 'app-verify-page',
  imports: [RouterLink, TranslocoPipe, NgIcon, Button, Field, SettingsNotice, AuthCard, CodeBoxes],
  providers: [provideIcons({ tablerCircleX })],
  templateUrl: './verify-page.html',
})
export class VerifyPage {
  private readonly router = inject(Router);
  private readonly transloco = inject(TranslocoService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly authSession = inject(AuthSession);
  private readonly authTransport = inject(AuthTransport);
  private readonly notify = inject(Notify);
  private readonly mfaPending = inject(MfaPending);
  private readonly i18n = translationEvents(this.transloco);

  private readonly codeBoxes = viewChild(CodeBoxes);

  protected readonly throttle = throttleCountdown();
  protected readonly throttleInitialSeconds = signal(0);
  protected readonly throttleEnded = signal(false);

  protected readonly pending = this.mfaPending.current;
  protected readonly now = signal(Date.now());
  protected readonly code = signal('');
  protected readonly fieldErrorKey = signal<string | null>(null);
  protected readonly notice = signal<{ key: string; tone: VerifyNoticeTone } | null>(null);
  protected readonly wrongAttempts = signal(0);
  protected readonly restartRequired = signal(false);
  protected readonly verifying = signal(false);
  protected readonly resending = signal(false);

  private readonly completed = signal(false);
  private readonly focusPending = signal(false);
  private destroyed = false;
  private tickTimer: ReturnType<typeof setInterval> | null = null;

  protected readonly deadline = computed(() => {
    const state = this.pending();
    return state ? state.receivedAt + state.step.expiresIn * 1000 : 0;
  });

  protected readonly resendAt = computed(() => {
    const state = this.pending();
    return state ? state.receivedAt + state.step.resendAfterSeconds * 1000 : 0;
  });

  protected readonly expiresRemainingSeconds = computed(() => {
    if (!this.pending()) return 0;
    return Math.max(0, Math.ceil((this.deadline() - this.now()) / 1000));
  });

  protected readonly resendRemainingSeconds = computed(() => {
    if (!this.pending()) return 0;
    return Math.max(0, Math.ceil((this.resendAt() - this.now()) / 1000));
  });

  protected readonly formattedExpiresIn = computed(() => formatCountdown(this.expiresRemainingSeconds()));

  protected readonly expiresParts = computed(() => {
    this.i18n();
    const raw = this.transloco.translate('authVerify.expiresIn', { time: TIME_SENTINEL });
    const index = raw.indexOf(TIME_SENTINEL);
    if (index < 0) return { before: raw, hasTime: false, after: '' };
    return {
      before: raw.slice(0, index),
      hasTime: true,
      after: raw.slice(index + TIME_SENTINEL.length),
    };
  });

  protected readonly mustRestart = computed(
    () =>
      !this.completed() &&
      (!this.pending() ||
        this.restartRequired() ||
        this.wrongAttempts() >= MFA_MAX_LOCAL_ATTEMPTS ||
        this.expiresRemainingSeconds() <= 0),
  );

  protected readonly fieldError = computed(() => {
    this.i18n();
    const key = this.fieldErrorKey();
    return key ? this.transloco.translate(key) : null;
  });

  protected readonly codeDescribedBy = computed(() =>
    this.fieldError() ? 'verify-code-1-hint verify-code-1-error' : 'verify-code-1-hint',
  );

  protected readonly canVerify = computed(
    () =>
      MFA_CODE_PATTERN.test(this.code()) &&
      !this.mustRestart() &&
      !this.throttle.active() &&
      !this.verifying() &&
      !this.resending(),
  );

  protected readonly canResend = computed(
    () =>
      !this.mustRestart() &&
      this.resendRemainingSeconds() === 0 &&
      !this.throttle.active() &&
      !this.resending() &&
      !this.verifying(),
  );

  constructor() {
    let wasThrottled = false;
    effect(() => {
      const active = this.throttle.active();
      untracked(() => {
        if (!active && wasThrottled) {
          this.throttleEnded.set(true);
        }
      });
      wasThrottled = active;
    });

    effect(() => {
      if (!this.focusPending() || this.verifying() || this.resending() || this.mustRestart()) return;
      untracked(() => this.focusPending.set(false));
      queueMicrotask(() => this.codeBoxes()?.focusFirst());
    });

    this.startTimer();
    this.destroyRef.onDestroy(() => {
      this.destroyed = true;
      this.stopTimer();
    });
  }

  protected onCodeChange(value: string): void {
    this.code.set(value);
    if (this.fieldErrorKey()) {
      this.fieldErrorKey.set(null);
    }
  }

  protected onSubmit(event: Event): void {
    event.preventDefault();
    void this.verify();
  }

  protected async verify(): Promise<void> {
    const state = this.pending();
    if (!state || !this.canVerify()) return;

    const submittedCode = this.code();
    this.fieldErrorKey.set(null);
    this.notice.set(null);
    this.throttleEnded.set(false);
    this.verifying.set(true);

    try {
      const session = await verifyCode(state.step.challengeId, submittedCode, this.authTransport);
      if (this.destroyed) return;
      const outcome = await this.authSession.signedIn(session);
      if (this.destroyed) return;

      this.completed.set(outcome !== 'signed-out');
      this.stopTimer();
      this.mfaPending.clear();
      if (outcome === 'signed-out') {
        this.notify.error(
          this.transloco.translate('session.ended.title'),
          this.transloco.translate('session.ended.text'),
        );
        return;
      }

      if (state.origin === 'invitation') {
        this.notify.success(this.transloco.translate('authVerify.toast.welcome'));
      }
      await this.router.navigateByUrl(state.returnUrl || '/', { replaceUrl: true });
    } catch (error) {
      if (this.destroyed) return;
      this.handleVerifyError(error);
    } finally {
      if (!this.destroyed) {
        this.verifying.set(false);
      }
    }
  }

  protected async resend(): Promise<void> {
    const state = this.pending();
    if (!state || !this.canResend()) return;

    this.fieldErrorKey.set(null);
    this.notice.set(null);
    this.throttleEnded.set(false);
    this.resending.set(true);

    try {
      const step = await resendCode(state.step.challengeId, this.authTransport);
      if (this.destroyed) return;
      this.mfaPending.update(step);
      this.now.set(Date.now());
      this.code.set('');
      this.startTimer();
      this.notify.success(this.transloco.translate('authVerify.toast.codeSent'));
      this.focusPending.set(true);
    } catch (error) {
      if (this.destroyed) return;
      if (errorCodeOf(error) === 'AUTH_MFA_INVALID_CHALLENGE') {
        this.restartRequired.set(true);
        this.stopTimer();
        return;
      }
      this.handleVerifyError(error);
    } finally {
      if (!this.destroyed) {
        this.resending.set(false);
      }
    }
  }

  protected backToSignIn(): void {
    this.completed.set(true);
    this.stopTimer();
    this.mfaPending.clear();
  }

  protected async signInAgain(): Promise<void> {
    this.completed.set(true);
    this.stopTimer();
    this.mfaPending.clear();
    await this.router.navigateByUrl('/login');
  }

  private handleVerifyError(error: unknown): void {
    const mapped = verifyErrorKey(error);

    switch (mapped.kind) {
      case 'field': {
        this.fieldErrorKey.set(mapped.key);
        if (errorCodeOf(error) === 'AUTH_MFA_INVALID_CHALLENGE') {
          const nextAttempts = this.wrongAttempts() + 1;
          this.wrongAttempts.set(nextAttempts);
          this.code.set('');
          if (nextAttempts < MFA_MAX_LOCAL_ATTEMPTS) {
            this.focusPending.set(true);
          } else {
            this.stopTimer();
          }
        } else {
          this.focusPending.set(true);
        }
        return;
      }
      case 'throttle': {
        const seconds = retryAfterSeconds(error);
        this.notice.set(null);
        this.throttleEnded.set(false);
        this.throttleInitialSeconds.set(seconds);
        this.throttle.start(seconds);
        return;
      }
      case 'restart': {
        this.restartRequired.set(true);
        this.stopTimer();
        return;
      }
      case 'notice': {
        this.throttleEnded.set(false);
        this.notice.set({ key: mapped.key, tone: mapped.tone ?? 'danger' });
        return;
      }
    }
  }

  private startTimer(): void {
    if (this.tickTimer !== null || this.mustRestart()) return;
    this.tickTimer = setInterval(() => {
      this.now.set(Date.now());
      if (this.mustRestart()) {
        this.stopTimer();
      }
    }, 1000);
  }

  private stopTimer(): void {
    if (this.tickTimer !== null) {
      clearInterval(this.tickTimer);
      this.tickTimer = null;
    }
  }
}
