import { NgOptimizedImage } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormField, email, form, maxLength, required, submit } from '@angular/forms/signals';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerArrowRight, tablerEye, tablerEyeOff } from '@ng-icons/tabler-icons';
import { map } from 'rxjs';
import { ApiError, fieldErrorsOf, isValidationError } from '../../../../core/api/api-errors';
import { AuthSession, DEFAULT_SIGNED_IN_URL, safeReturnUrl } from '../../../../core/auth/auth-session';
import { isMfaStep } from '../../../../core/auth/auth-session.model';
import { AuthTransport, TenantProvisioningError } from '../../../../core/auth/auth-transport';
import { LanguageState } from '../../../../core/i18n/language';
import { Notify } from '../../../../core/notify/notify';
import { ThemeState } from '../../../../core/theme/theme';
import { TenantProvisioningPage } from '../../../../layout/tenant-provisioning/tenant-provisioning-page';
import { Button } from '../../../../shared/ui/button/button';
import { Checkbox } from '../../../../shared/ui/checkbox/checkbox';
import { Field } from '../../../../shared/ui/field/field';
import { Preferences } from '../../../../shared/ui/preferences/preferences';
import { SettingsNotice } from '../../../../shared/ui/settings-notice/settings-notice';
import { retryAfterSeconds } from '../../shared/auth-throttle';
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
  imports: [
    NgOptimizedImage, FormField, RouterLink, TranslocoPipe, NgIcon, Button, Checkbox, Field,
    Preferences, SettingsNotice, TenantProvisioningPage,
  ],
  providers: [provideIcons({ tablerArrowRight, tablerEye, tablerEyeOff })],
  templateUrl: './login-page.html',
  styleUrl: './login-page.css',
})
export class LoginPage {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly notify = inject(Notify);
  private readonly transloco = inject(TranslocoService);
  private readonly authSession = inject(AuthSession);
  private readonly authTransport = inject(AuthTransport);
  private readonly mfaPending = inject(MfaPending);
  private readonly language = inject(LanguageState);
  protected readonly theme = inject(ThemeState);
  protected readonly tenantProvisioning = signal(false);
  protected readonly checkingTenant = signal(false);

  protected readonly ribbon = computed(() => `assets/auth/login-ribbon-${this.theme.current()}.webp`);
  protected readonly copyrightYear = computed(() =>
    new Intl.NumberFormat(this.language.current() === 'ar' ? 'ar-EG' : 'en', { useGrouping: false })
      .format(new Date().getFullYear()),
  );

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

  constructor() {
    void this.checkTenantReadiness();
  }

  protected async checkTenantReadiness(): Promise<void> {
    if (this.checkingTenant()) return;
    const retrying = this.tenantProvisioning();
    this.checkingTenant.set(true);
    try {
      await this.authTransport.checkTenantReadiness();
      this.tenantProvisioning.set(false);
    } catch (error) {
      if (error instanceof TenantProvisioningError) {
        this.showTenantProvisioning();
      } else {
        this.tenantProvisioning.set(false);
        if (retrying) this.showError(error);
      }
    } finally {
      this.checkingTenant.set(false);
    }
  }

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
    if (this.checkingTenant() || this.tenantProvisioning()) return;
    submit(this.form, async () => {
      const { remember, ...body } = this.credentials();
      this.serverErrors.set(null);
      try {
        const result = await login(body, remember, this.authTransport);
        const returnUrl = safeReturnUrl(this.route.snapshot.queryParams['returnUrl']) ?? DEFAULT_SIGNED_IN_URL;
        if (isMfaStep(result)) {
          this.mfaPending.set(result, { returnUrl, origin: 'login' });
          await this.router.navigateByUrl('/verify');
        } else {
          const outcome = await this.authSession.signedIn(result);
          if (outcome === 'signed-out') {
            this.notify.error(
              this.transloco.translate('session.ended.title'),
              this.transloco.translate('session.ended.text'),
            );
            return undefined;
          }
          await this.router.navigateByUrl(returnUrl);
        }
      } catch (error) {
        if (error instanceof TenantProvisioningError) {
          this.showTenantProvisioning();
        } else if (!this.showFieldErrors(error, body)) {
          this.showError(error);
        }
      }
      return undefined;
    });
  }

  private showTenantProvisioning(): void {
    this.tenantProvisioning.set(true);
    this.credentials.update((value) => ({ ...value, password: '' }));
    this.showPassword.set(false);
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
    const title = this.transloco.translate(`auth.errors.${key}.title`);
    const seconds = retryAfterSeconds(error, 0);
    if (key === 'RATE_LIMITED' && seconds > 0) {
      this.notify.error(title, this.transloco.translate('auth.shared.throttle', { s: seconds }));
      return;
    }
    this.notify.error(
      title,
      this.transloco.translate(loginErrorTextKey(key, error), { minutes: retryAfterMinutes(error) }),
    );
  }
}

function loginErrorTextKey(key: ReturnType<typeof loginErrorKey>, error: unknown): string {
  if (key === 'UNKNOWN' && error instanceof ApiError) {
    if (error.status === 0) return 'auth.shared.errors.network';
    if (error.status === 403) return 'apiErrors.permission';
    if (error.status >= 500) return 'auth.shared.errors.unavailable';
  }
  return `auth.errors.${key}.text`;
}
