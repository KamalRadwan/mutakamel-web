import { Component, type OnInit, computed, inject, signal } from '@angular/core';
import { FormField, form, maxLength, required, submit } from '@angular/forms/signals';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerCircleX, tablerEye, tablerEyeOff } from '@ng-icons/tabler-icons';
import { AuthSession } from '../../../../core/auth/auth-session';
import { DEFAULT_SIGNED_IN_URL } from '../../../../core/auth/return-url';
import { isMfaStep } from '../../../../core/auth/auth-session.model';
import { Notify } from '../../../../core/notify/notify';
import { Button } from '../../../../shared/ui/button/button';
import { Field } from '../../../../shared/ui/field/field';
import { SettingsNotice } from '../../../../shared/ui/settings-notice/settings-notice';
import { readActionToken } from '../../shared/action-token';
import { AuthCard } from '../../shared/auth-card/auth-card';
import { retryAfterSeconds, throttleCountdown } from '../../shared/auth-throttle';
import { MfaPending } from '../../shared/mfa-pending';
import { PASSWORD_MAX, allChecksPass, passwordChecks } from '../../shared/password-policy';
import { PasswordRules } from '../../shared/password-rules/password-rules';
import { acceptInvitation } from '../invitation.api';
import { type InviteNoticeTone, inviteErrorKey, inviteErrorKind, inviteNoticeTone } from '../invitation.model';

interface InvitationForm {
  newPassword: string;
  confirmPassword: string;
}

interface InvitationNotice {
  tone: InviteNoticeTone;
  key: string;
}

@Component({
  selector: 'app-invitation-page',
  imports: [
    FormField,
    RouterLink,
    TranslocoPipe,
    NgIcon,
    Button,
    Field,
    SettingsNotice,
    AuthCard,
    PasswordRules,
  ],
  providers: [provideIcons({ tablerEye, tablerEyeOff, tablerCircleX })],
  templateUrl: './invitation-page.html',
})
export class InvitationPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly notify = inject(Notify);
  private readonly transloco = inject(TranslocoService);
  private readonly authSession = inject(AuthSession);
  private readonly mfaPending = inject(MfaPending);

  private readonly token = signal<string | null>(null);
  protected readonly state = signal<'form' | 'invalid'>('invalid');

  protected readonly values = signal<InvitationForm>({ newPassword: '', confirmPassword: '' });
  protected readonly form = form(this.values, (path) => {
    required(path.newPassword);
    maxLength(path.newPassword, PASSWORD_MAX);
    required(path.confirmPassword);
    maxLength(path.confirmPassword, PASSWORD_MAX);
  });

  protected readonly showNewPassword = signal(false);
  protected readonly showConfirmPassword = signal(false);
  protected readonly notice = signal<InvitationNotice | null>(null);
  private readonly passwordServerError = signal<{ sent: string; key: string } | null>(null);

  protected readonly throttle = throttleCountdown();
  protected readonly throttleInitial = signal(0);
  protected readonly throttleDone = computed(
    () => this.throttleInitial() > 0 && !this.throttle.active(),
  );

  protected readonly newPasswordErrorKey = computed(() => {
    const err = this.passwordServerError();
    return err && err.sent === this.values().newPassword ? err.key : null;
  });

  protected readonly canSubmit = computed(() => {
    const { newPassword, confirmPassword } = this.values();
    return (
      this.token() !== null &&
      allChecksPass(passwordChecks(newPassword)) &&
      newPassword.length > 0 &&
      newPassword === confirmPassword &&
      !this.throttle.active() &&
      !this.form().submitting()
    );
  });

  ngOnInit(): void {
    const rawFragment = this.route.snapshot.fragment;
    const parsed = readActionToken(rawFragment);

    if (rawFragment !== null) {
      // Remove the raw action token from the address bar immediately after reading it into memory.
      void this.router.navigate([], {
        relativeTo: this.route,
        replaceUrl: true,
        fragment: undefined,
        queryParamsHandling: 'preserve',
      });
    }

    if (parsed) {
      this.token.set(parsed);
      this.state.set('form');
    } else {
      this.token.set(null);
      this.state.set('invalid');
    }
  }

  protected onPasswordInput(): void {
    this.passwordServerError.set(null);
  }

  protected activate(event: Event): void {
    event.preventDefault();
    if (!this.canSubmit()) return;

    const currentToken = this.token();
    if (!currentToken) return;

    const newPassword = this.values().newPassword;
    this.notice.set(null);
    this.passwordServerError.set(null);
    this.throttleInitial.set(0);

    void submit(this.form, async () => {
      try {
        const result = await acceptInvitation(currentToken, newPassword);
        if (isMfaStep(result)) {
          this.values.set({ newPassword: '', confirmPassword: '' });
          this.token.set(null);
          this.mfaPending.set(result, { returnUrl: DEFAULT_SIGNED_IN_URL, origin: 'invitation' });
          await this.router.navigateByUrl('/verify', { replaceUrl: true });
        } else {
          await this.authSession.signedIn(result);
          this.values.set({ newPassword: '', confirmPassword: '' });
          this.token.set(null);
          this.notify.success(this.transloco.translate('authInvite.toast.welcome'));
          await this.router.navigateByUrl(DEFAULT_SIGNED_IN_URL, { replaceUrl: true });
        }
      } catch (error) {
        this.handleError(error, newPassword);
      }
      return undefined;
    });
  }

  private handleError(error: unknown, sentPassword: string): void {
    const kind = inviteErrorKind(error);
    if (kind === 'invalid') {
      this.token.set(null);
      this.notice.set(null);
      this.passwordServerError.set(null);
      this.state.set('invalid');
      return;
    }

    if (kind === 'field-password') {
      this.notice.set(null);
      this.passwordServerError.set({ sent: sentPassword, key: inviteErrorKey(error) });
      return;
    }

    if (kind === 'throttle') {
      const seconds = retryAfterSeconds(error);
      this.notice.set(null);
      this.throttleInitial.set(seconds);
      this.throttle.start(seconds);
      return;
    }

    this.notice.set({ tone: inviteNoticeTone(error), key: inviteErrorKey(error) });
  }
}
