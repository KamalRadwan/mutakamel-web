import {
  Component,
  DestroyRef,
  ElementRef,
  computed,
  effect,
  inject,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { AuthSession } from '../../../../../core/auth/auth-session';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerAlertTriangle,
  tablerEye,
  tablerEyeOff,
  tablerShieldCheck,
} from '@ng-icons/tabler-icons';
import { Notify } from '../../../../../core/notify/notify';
import { Button } from '../../../../../shared/ui/button/button';
import { Field } from '../../../../../shared/ui/field/field';
import { Modal } from '../../../../../shared/ui/modal/modal';
import { ApiError, errorCodeOf } from '../../../../../core/api/api-errors';
import { SettingsNotice } from '../../../../../shared/ui/settings-notice/settings-notice';
import { SecurityApi } from '../security.api';
import { MFA_CODE_PATTERN, isUnknownOutcome, retryAfterSecondsOf } from '../security.model';

type MfaStepName = 'password' | 'code';

const EMAIL_SENTINEL = '\u0000';

@Component({
  selector: 'app-mfa-modal',
  imports: [NgIcon, TranslocoPipe, Button, Field, Modal, SettingsNotice],
  providers: [provideIcons({ tablerShieldCheck, tablerEye, tablerEyeOff, tablerAlertTriangle })],
  templateUrl: './mfa-modal.html',
})
export class MfaModal {
  private static nextId = 0;

  private readonly session = inject(AuthSession);
  private readonly api = inject(SecurityApi);
  private readonly notify = inject(Notify);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly destroyRef = inject(DestroyRef);

  private readonly modal = viewChild.required<Modal>('modal');
  private readonly passwordInput = viewChild<ElementRef<HTMLInputElement>>('passwordInput');
  private readonly codeInput = viewChild<ElementRef<HTMLInputElement>>('codeInput');

  protected readonly uid = `security-mfa-modal-${++MfaModal.nextId}`;

  protected readonly targetEnabled = signal(true);
  protected readonly email = signal('');
  protected readonly step = signal<MfaStepName>('password');

  protected readonly currentPassword = signal('');
  protected readonly showPassword = signal(false);
  protected readonly passwordErrorKey = signal<string | null>(null);

  protected readonly challengeId = signal('');
  protected readonly deadline = signal<number | null>(null);
  protected readonly resendAt = signal<number | null>(null);
  protected readonly code = signal('');
  protected readonly codeErrorKey = signal<string | null>(null);

  protected readonly unavailable = signal(false);
  protected readonly noticeErrorKey = signal<string | null>(null);
  protected readonly unknownOutcome = signal(false);
  protected readonly throttleUntil = signal<number | null>(null);
  protected readonly now = signal(Date.now());

  protected readonly submitting = signal(false);
  protected readonly resending = signal(false);

  private openSeq = 0;
  private tickTimer: ReturnType<typeof setInterval> | null = null;

  protected readonly throttleRemainingSeconds = computed(() => {
    const until = this.throttleUntil();
    if (until === null) return 0;
    return Math.max(0, Math.ceil((until - this.now()) / 1000));
  });

  protected readonly isThrottled = computed(() => this.throttleRemainingSeconds() > 0);
  protected readonly throttleEnded = signal(false);

  protected readonly expiresRemainingSeconds = computed(() => {
    const dl = this.deadline();
    if (dl === null) return 0;
    return Math.max(0, Math.ceil((dl - this.now()) / 1000));
  });

  protected readonly isExpired = computed(
    () =>
      this.step() === 'code' && this.deadline() !== null && this.expiresRemainingSeconds() === 0,
  );

  protected readonly formattedExpiresIn = computed(() => {
    const total = this.expiresRemainingSeconds();
    const minutes = Math.floor(total / 60);
    const seconds = total % 60;
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
  });

  protected readonly resendRemainingSeconds = computed(() => {
    const at = this.resendAt();
    if (at === null) return 0;
    return Math.max(0, Math.ceil((at - this.now()) / 1000));
  });

  protected readonly effectiveCodeErrorKey = computed(() => {
    if (this.isExpired()) return 'wsAccSec.errors.AUTH_MFA_INVALID_CHALLENGE';
    return this.codeErrorKey();
  });

  protected readonly codeSentParts = computed(() => {
    this.i18n();
    const raw = this.transloco.translate('wsAccSec.mfa.codeSent', { email: EMAIL_SENTINEL });
    const index = raw.indexOf(EMAIL_SENTINEL);
    if (index < 0) return { before: raw, hasEmail: false, after: '' };
    return {
      before: raw.slice(0, index),
      hasEmail: true,
      after: raw.slice(index + EMAIL_SENTINEL.length),
    };
  });

  protected readonly canContinue = computed(
    () =>
      this.currentPassword().length > 0 &&
      !this.unavailable() &&
      !this.isThrottled() &&
      !this.submitting(),
  );

  protected readonly canConfirm = computed(
    () =>
      MFA_CODE_PATTERN.test(this.code()) &&
      !this.unknownOutcome() &&
      !this.isExpired() &&
      !this.unavailable() &&
      !this.isThrottled() &&
      !this.submitting(),
  );

  protected readonly canResend = computed(
    () =>
      !this.unknownOutcome() &&
      !this.isExpired() &&
      this.resendRemainingSeconds() === 0 &&
      !this.unavailable() &&
      !this.isThrottled() &&
      !this.resending() &&
      !this.submitting(),
  );

  constructor() {
    let wasThrottled = false;
    effect(() => {
      const throttled = this.isThrottled();
      untracked(() => this.throttleEnded.set(!throttled && wasThrottled));
      wasThrottled = throttled;
    });

    effect(() => {
      if (this.step() !== 'code') return;
      const inputEl = this.codeInput()?.nativeElement;
      if (!inputEl) return;
      queueMicrotask(() => inputEl.focus());
    });

    this.destroyRef.onDestroy(() => {
      this.openSeq++;
      this.stopTimer();
    });
  }

  open(enabled: boolean, email: string): void {
    this.openSeq++;
    this.resetState();
    this.targetEnabled.set(enabled);
    this.email.set(email);
    this.modal().open();
  }

  protected close(): void {
    this.modal().close();
  }

  protected startAgain(): void {
    this.openSeq++;
    this.resetState();
    queueMicrotask(() => this.passwordInput()?.nativeElement.focus());
  }

  protected onClosed(): void {
    this.openSeq++;
    this.resetState();
  }

  protected onPasswordInput(event: Event): void {
    this.currentPassword.set((event.target as HTMLInputElement).value);
    this.passwordErrorKey.set(null);
  }

  protected onCodeInput(event: Event): void {
    const inputEl = event.target as HTMLInputElement;
    const cleaned = inputEl.value.replace(/\D/g, '').slice(0, 6);
    if (inputEl.value !== cleaned) {
      inputEl.value = cleaned;
    }
    this.code.set(cleaned);
    this.codeErrorKey.set(null);
  }

  protected async submitPassword(event: Event): Promise<void> {
    event.preventDefault();
    if (!this.canContinue()) return;

    const seq = this.openSeq;
    this.passwordErrorKey.set(null);
    this.submitting.set(true);

    try {
      const mfaStep = await this.api.startMfaChange(this.targetEnabled(), this.currentPassword());
      if (seq !== this.openSeq) return;
      const nowMs = Date.now();
      this.now.set(nowMs);
      this.challengeId.set(mfaStep.challengeId);
      this.deadline.set(nowMs + mfaStep.expiresIn * 1000);
      this.resendAt.set(nowMs + mfaStep.resendAfterSeconds * 1000);
      this.currentPassword.set('');
      this.code.set('');
      this.codeErrorKey.set(null);
      this.throttleUntil.set(null);
      this.step.set('code');
      this.startTimer();
    } catch (error) {
      if (seq !== this.openSeq) return;
      this.handleMfaError(error, 'password');
    } finally {
      if (seq === this.openSeq) {
        this.submitting.set(false);
      }
    }
  }

  protected async resend(): Promise<void> {
    if (!this.canResend()) return;

    const seq = this.openSeq;
    const id = this.challengeId();
    this.resending.set(true);

    try {
      const mfaStep = await this.api.resendMfaCode(id);
      if (seq !== this.openSeq) return;
      const nowMs = Date.now();
      this.now.set(nowMs);
      this.challengeId.set(mfaStep.challengeId);
      this.resendAt.set(nowMs + mfaStep.resendAfterSeconds * 1000);
      this.codeErrorKey.set(null);
      this.throttleUntil.set(null);
      this.startTimer();
      this.notify.success(this.transloco.translate('wsAccSec.toast.codeSent'));
    } catch (error) {
      if (seq !== this.openSeq) return;
      this.handleMfaError(error, 'code');
    } finally {
      if (seq === this.openSeq) {
        this.resending.set(false);
      }
    }
  }

  protected async submitCode(event: Event): Promise<void> {
    event.preventDefault();
    if (!this.canConfirm()) return;

    const seq = this.openSeq;
    const enabled = this.targetEnabled();
    const id = this.challengeId();
    const value = this.code();

    this.codeErrorKey.set(null);
    this.submitting.set(true);

    try {
      await this.api.confirmMfaChange(id, value);
      // The change is already applied server-side: finish the flow even if the modal was closed meanwhile.
      if (seq === this.openSeq) this.modal().close();
      await this.session.signedOutByServer('security.mfaChanged');
    } catch (error) {
      if (isUnknownOutcome(error)) {
        await this.checkOutcome(seq, enabled);
      } else if (seq === this.openSeq) {
        this.handleMfaError(error, 'code');
      }
    } finally {
      if (seq === this.openSeq) {
        this.submitting.set(false);
      }
    }
  }

  protected async checkAgain(): Promise<void> {
    if (this.submitting()) return;
    const seq = this.openSeq;
    this.submitting.set(true);
    try {
      await this.checkOutcome(seq, this.targetEnabled());
    } finally {
      if (seq === this.openSeq) this.submitting.set(false);
    }
  }

  private async checkOutcome(seq: number, enabled: boolean): Promise<void> {
    try {
      if ((await this.session.refresh()) === 'ended') {
        await this.session.signedOutByServer('security.mfaChanged');
        return;
      }
      await this.session.reloadProfile(this.session.requestVersion());
      if (this.session.me()?.mfaEnabled === enabled) {
        await this.session.signedOutByServer('security.mfaChanged');
        return;
      }
    } catch {
      // A failed check leaves the outcome unknown; the confirmation itself must never be replayed.
    }
    if (seq === this.openSeq) this.unknownOutcome.set(true);
  }

  private handleMfaError(error: unknown, activeStep: MfaStepName): void {
    const code = errorCodeOf(error);
    this.noticeErrorKey.set(null);
    if (code === 'CURRENT_PASSWORD_INVALID') {
      this.passwordErrorKey.set('wsAccSec.errors.CURRENT_PASSWORD_INVALID');
      queueMicrotask(() => this.passwordInput()?.nativeElement.focus());
      return;
    }
    if (code === 'AUTH_MFA_UNAVAILABLE') {
      this.unavailable.set(true);
      return;
    }
    if (code === 'AUTH_MFA_THROTTLED' || (error instanceof ApiError && error.status === 429)) {
      const nowMs = Date.now();
      this.now.set(nowMs);
      this.throttleUntil.set(nowMs + retryAfterSecondsOf(error) * 1000);
      this.startTimer();
      return;
    }
    if (code === 'AUTH_MFA_INVALID_CHALLENGE' && activeStep === 'password') {
      this.noticeErrorKey.set('wsAccSec.errors.AUTH_MFA_INVALID_CHALLENGE');
      return;
    }
    if (code === 'AUTH_MFA_INVALID_CHALLENGE' && activeStep === 'code') {
      this.codeErrorKey.set('wsAccSec.errors.AUTH_MFA_INVALID_CHALLENGE');
      this.code.set('');
      queueMicrotask(() => this.codeInput()?.nativeElement.focus());
      return;
    }
    this.noticeErrorKey.set('wsAccSec.errors.generic');
  }

  private startTimer(): void {
    if (this.tickTimer !== null) return;
    this.tickTimer = setInterval(() => {
      const nowMs = Date.now();
      this.now.set(nowMs);
      const until = this.throttleUntil();
      if (until !== null && nowMs >= until) {
        this.throttleUntil.set(null);
      }
      if (this.step() !== 'code' && this.throttleUntil() === null) {
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

  private resetState(): void {
    this.stopTimer();
    this.step.set('password');
    this.currentPassword.set('');
    this.showPassword.set(false);
    this.passwordErrorKey.set(null);
    this.challengeId.set('');
    this.deadline.set(null);
    this.resendAt.set(null);
    this.code.set('');
    this.codeErrorKey.set(null);
    this.unavailable.set(false);
    this.noticeErrorKey.set(null);
    this.unknownOutcome.set(false);
    this.throttleEnded.set(false);
    this.throttleUntil.set(null);
    this.submitting.set(false);
    this.resending.set(false);
    this.now.set(Date.now());
  }
}
