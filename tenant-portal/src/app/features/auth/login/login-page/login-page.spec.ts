import { Injectable } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, provideRouter } from '@angular/router';
import { TranslocoLoader, provideTransloco } from '@jsverse/transloco';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../../core/api/api-errors';
import { AuthSession } from '../../../../core/auth/auth-session';
import { resetFakeSession } from '../../../../core/auth/auth-session.fake';
import { Notify } from '../../../../core/notify/notify';
import { resetFakeChallenges } from '../../shared/mfa-challenge.fake';
import { MfaPending } from '../../shared/mfa-pending';
import { FAKE_ACCOUNTS } from '../login.fake';
import { LoginPage } from './login-page';

@Injectable()
class EmptyLoader implements TranslocoLoader {
  getTranslation() {
    return of({});
  }
}

// Protected members are reached through this view on purpose: the spec drives the form directly.
type Internals = Record<string, any>;

let fixture: ComponentFixture<LoginPage>;
let c: Internals;
let notifyError: ReturnType<typeof vi.spyOn>;
let navigate: ReturnType<typeof vi.spyOn>;

async function signIn(email: string, password: string): Promise<void> {
  c['credentials'].set({ email, password, remember: false });
  c['signIn'](new Event('submit'));
  await vi.runAllTimersAsync();
  fixture.detectChanges();
}

beforeEach(() => {
  vi.useFakeTimers();
  resetFakeSession();
  resetFakeChallenges();
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      provideTransloco({
        config: { availableLangs: ['ar', 'en'], defaultLang: 'en', missingHandler: { logMissingKey: false } },
        loader: EmptyLoader,
      }),
    ],
  });
  notifyError = vi.spyOn(TestBed.inject(Notify), 'error').mockImplementation(() => undefined);
  navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
  fixture = TestBed.createComponent(LoginPage);
  c = fixture.componentInstance as unknown as Internals;
  fixture.detectChanges();
});

afterEach(() => {
  TestBed.inject(MfaPending).clear();
  resetFakeChallenges();
  resetFakeSession();
  fixture.destroy();
  TestBed.resetTestingModule();
  vi.useRealTimers();
});

describe('login page', () => {
  it('signs in, loads session, and opens the workspace', async () => {
    await signIn(FAKE_ACCOUNTS.valid.email, FAKE_ACCOUNTS.valid.password);

    expect(TestBed.inject(AuthSession).status()).toBe('signed-in');
    expect(navigate).toHaveBeenCalledWith('/');
    expect(notifyError).not.toHaveBeenCalled();
  });

  it('honors a safe returnUrl query param and falls back to / for an unsafe one', async () => {
    const route = TestBed.inject(ActivatedRoute);
    route.snapshot.queryParams = { returnUrl: '/crm/leads' };
    await signIn(FAKE_ACCOUNTS.valid.email, FAKE_ACCOUNTS.valid.password);
    expect(navigate).toHaveBeenLastCalledWith('/crm/leads');

    route.snapshot.queryParams = { returnUrl: '//evil.com' };
    await signIn(FAKE_ACCOUNTS.valid.email, FAKE_ACCOUNTS.valid.password);
    expect(navigate).toHaveBeenLastCalledWith('/');
  });

  it('shows no verify notice by default and a status notice after ?verify=expired', async () => {
    const host = fixture.nativeElement as HTMLElement;
    const status = () => host.querySelector('[role="status"]') as HTMLElement;
    expect(status().classList.contains('sr-only')).toBe(true);
    expect(status().textContent?.trim()).toBe('');

    navigate.mockRestore();
    await TestBed.inject(Router).navigateByUrl('/?verify=expired');
    await vi.runAllTimersAsync();
    fixture.detectChanges();

    expect(status().classList.contains('sr-only')).toBe(false);
    expect(status().textContent).toContain('auth.login.verifyExpired');
  });

  it('stores the pending challenge and sends an enrolled user to /verify', async () => {
    await signIn(FAKE_ACCOUNTS.mfa.email, FAKE_ACCOUNTS.mfa.password);

    const pending = TestBed.inject(MfaPending).current();
    expect(pending).toMatchObject({ origin: 'login', returnUrl: '/', step: { mfaRequired: true } });
    expect(navigate).toHaveBeenCalledWith('/verify');
  });

  it('shows the lockout minutes from details.retryAfterSeconds', async () => {
    const translate = vi.spyOn(c['transloco'], 'translate');
    await signIn(FAKE_ACCOUNTS.throttled.email, 'any');

    expect(translate).toHaveBeenCalledWith('auth.errors.AUTH_LOGIN_THROTTLED.text', { minutes: 15 });
    expect(notifyError).toHaveBeenCalledWith('auth.errors.AUTH_LOGIN_THROTTLED.title', 'auth.errors.AUTH_LOGIN_THROTTLED.text');
  });

  it('maps 429 COMMON.GENERIC.RATE_LIMITED to the RATE_LIMITED message', async () => {
    await signIn(FAKE_ACCOUNTS.rateLimited.email, 'any');

    expect(notifyError).toHaveBeenCalledWith('auth.errors.RATE_LIMITED.title', 'auth.errors.RATE_LIMITED.text');
    expect(navigate).not.toHaveBeenCalled();
  });

  it('shows a wrong password as INVALID_CREDENTIALS, not as a session problem', async () => {
    await signIn(FAKE_ACCOUNTS.valid.email, 'wrong');

    expect(notifyError).toHaveBeenCalledWith('auth.errors.INVALID_CREDENTIALS.title', 'auth.errors.INVALID_CREDENTIALS.text');
  });

  it('puts 400 CORE_VALIDATION_FAILED on the field until the value changes', () => {
    const sent = { email: 'a@b.co', password: 'secret' };
    c['credentials'].set({ ...sent, remember: false });
    const validation = new ApiError(400, 'CORE_VALIDATION_FAILED', { email: ['is_email'] });

    expect(c['showFieldErrors'](new ApiError(400, 'CORE_VALIDATION_FAILED', { _: ['bad'] }), sent)).toBe(false);
    expect(c['showFieldErrors'](validation, sent)).toBe(true);
    expect(c['errorOf']('email')).toBe('auth.validation.server');
    expect(c['errorOf']('password')).toBeNull();

    c['credentials'].update((value: object) => ({ ...value, email: 'c@d.co' }));
    expect(c['errorOf']('email')).toBeNull();
  });
});
