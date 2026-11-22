import { Component, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormField, email, form, maxLength, required, submit } from '@angular/forms/signals';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerEye, tablerEyeOff } from '@ng-icons/tabler-icons';
import { map } from 'rxjs';
import { fieldErrorsOf, isValidationError } from '../../../../core/api/api-errors';
import { AuthSession, safeReturnUrl } from '../../../../core/auth/auth-session';
import { isMfaStep } from '../../../../core/auth/auth-session.model';
import { Notify } from '../../../../core/notify/notify';
import { Button } from '../../../../shared/ui/button/button';
import { Checkbox } from '../../../../shared/ui/checkbox/checkbox';
import { Field } from '../../../../shared/ui/field/field';
import { SettingsNotice } from '../../../../shared/ui/settings-notice/settings-notice';
import { AuthCard } from '../../shared/auth-card/auth-card';
import { MfaPending } from '../../shared/mfa-pending';
import { login } from '../login.api';
import { LOGIN_LIMITS, LoginBody, LoginForm, loginErrorKey, retryAfterMinutes } from '../login.model';

type LoginField = keyof LoginBody;

/** Field errors from a 400 CORE_VALIDATION_FAILED, kept only while the field still holds the value that was sent. */
interface ServerFieldErrors {
  sent: LoginBody;
  fields: Partial<Record<LoginField, string[]>>;
}

@Component({
  selector: 'app-login-page',
  imports: [FormField, RouterLink, TranslocoPipe, NgIcon, Button, Checkbox, Field, SettingsNotice, AuthCard],
  providers: [provideIcons({ tablerEye, tablerEyeOff })],
  templateUrl: './login-page.html',
})
export class LoginPage {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly notify = inject(Notify);
  private readonly transloco = inject(TranslocoService);
  private readonly authSession = inject(AuthSession);
  private readonly mfaPending = inject(MfaPending);

  protected readonly credentials = signal<LoginForm>({ email: '', password: '', remember: false });
  protected readonly form = form(this.credentials, (path) => {
    required(path.email);
    email(path.email);
    maxLength(path.email, LOGIN_LIMITS.emailMax);
    required(path.password);
    maxLength(path.password, LOGIN_LIMITS.passwordMax);
  });
  protected readonly showPassword = signal(false);
  /** Set by the /verify guard when there is no pending sign-in to verify. */
  protected readonly verifyExpired = toSignal(
    this.route.queryParamMap.pipe(map((params) => params.get('verify') === 'expired')),
    { initialValue: this.route.snapshot.queryParamMap.get('verify') === 'expired' },
  );
  private readonly serverErrors = signal<ServerFieldErrors | null>(null);

  protected errorOf(field: LoginField) {
    const state = this.form[field]();
    const error = state.touched() ? state.errors()[0] : undefined;
    if (error) {
      const max = field === 'email' ? LOGIN_LIMITS.emailMax : LOGIN_LIMITS.passwordMax;
      return this.transloco.translate(`auth.validation.${error.kind}`, { max });
    }
    const server = this.serverErrors();
    const stillSent = server?.fields[field] && server.sent[field] === this.credentials()[field];
    return stillSent ? this.transloco.translate('auth.validation.server') : null;
  }

  protected signIn(event: Event) {
    event.preventDefault();
    submit(this.form, async () => {
      const { remember, ...body } = this.credentials();
      this.serverErrors.set(null);
      try {
        const result = await login(body, remember);
        const returnUrl = safeReturnUrl(this.route.snapshot.queryParams['returnUrl']) ?? '/';
        if (isMfaStep(result)) {
          this.mfaPending.set(result, { returnUrl, origin: 'login' });
          await this.router.navigateByUrl('/verify');
        } else {
          await this.authSession.signedIn(result);
          await this.router.navigateByUrl(returnUrl);
        }
      } catch (error) {
        if (!this.showFieldErrors(error, body)) this.showError(error);
      }
      return undefined;
    });
  }

  /** A 400 CORE_VALIDATION_FAILED keyed by email or password shows on the fields instead of a toast. */
  private showFieldErrors(error: unknown, sent: LoginBody): boolean {
    if (!isValidationError(error)) return false;
    const all = fieldErrorsOf(error);
    const fields: ServerFieldErrors['fields'] = {};
    if (all['email']) fields.email = all['email'];
    if (all['password']) fields.password = all['password'];
    if (!fields.email && !fields.password) return false;
    this.serverErrors.set({ sent, fields });
    return true;
  }

  private showError(error: unknown) {
    const key = loginErrorKey(error);
    this.notify.error(
      this.transloco.translate(`auth.errors.${key}.title`),
      this.transloco.translate(`auth.errors.${key}.text`, { minutes: retryAfterMinutes(error) }),
    );
  }
}
