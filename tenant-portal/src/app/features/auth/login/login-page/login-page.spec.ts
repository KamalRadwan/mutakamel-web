import { Injectable } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, provideRouter } from '@angular/router';
import { TranslocoLoader, TranslocoService, provideTransloco } from '@jsverse/transloco';
import ar from '../../../../../../public/i18n/auth/ar.json';
import en from '../../../../../../public/i18n/auth/en.json';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../../core/api/api-errors';
import { AuthSession } from '../../../../core/auth/auth-session';
import { AuthSessionApi } from '../../../../core/auth/auth-session.api';
import { fakeGetMe, FAKE_TENANT_ME, resetFakeSession } from '../../../../core/auth/auth-session.fake';
import { AuthTransport, TenantProvisioningError } from '../../../../core/auth/auth-transport';
import { Notify } from '../../../../core/notify/notify';
import { resetFakeChallenges } from '../../shared/mfa-challenge.fake';
import { MfaPending } from '../../shared/mfa-pending';
import { FAKE_ACCOUNTS, fakeLogin } from '../login.fake';
import type { LoginBody } from '../login.model';
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
const getMe = vi.fn(fakeGetMe);

async function signIn(email: string, password: string): Promise<void> {
  c['credentials'].set({ email, password, remember: false });
  c['signIn'](new Event('submit'));
  await vi.advanceTimersByTimeAsync(2_000);
  fixture.detectChanges();
}

beforeEach(async () => {
  vi.useFakeTimers();
  resetFakeSession();
  resetFakeChallenges();
  getMe.mockReset();
  TestBed.configureTestingModule({
    providers: [
      {
        provide: AuthTransport,
        useValue: {
          checkTenantReadiness: async () => {},
          requestData: (_route: 'login', body: LoginBody, remember: boolean) => fakeLogin(body, remember),
        },
      },
      { provide: AuthSessionApi, useValue: { getMe, hasCsrfCookie: () => true } },
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
  await vi.advanceTimersByTimeAsync(0);
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
  it('waits for the current user and permissions before navigating to the requested route', async () => {
    TestBed.inject(ActivatedRoute).snapshot.queryParams = { returnUrl: '/crm/leads' };
    let finish!: (me: typeof FAKE_TENANT_ME) => void;
    getMe.mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
    await signIn(FAKE_ACCOUNTS.valid.email, FAKE_ACCOUNTS.valid.password);
    expect(getMe).toHaveBeenCalledTimes(1);
    expect(navigate).not.toHaveBeenCalled();
    finish({ ...FAKE_TENANT_ME, permissions: ['crm.leads.read'] });
    await vi.advanceTimersByTimeAsync(1);
    expect(TestBed.inject(AuthSession).hasPermission('crm.leads.read')).toBe(true);
    expect(navigate).toHaveBeenCalledWith('/crm/leads');
  });

  it('keeps the requested feature closed if loading the signed-in identity is denied', async () => {
    TestBed.inject(ActivatedRoute).snapshot.queryParams = { returnUrl: '/crm/leads' };
    getMe.mockRejectedValueOnce(new ApiError(403, 'SESSION_IDENTITY_INACTIVE'));
    await signIn(FAKE_ACCOUNTS.valid.email, FAKE_ACCOUNTS.valid.password);
    expect(navigate).not.toHaveBeenCalledWith('/crm/leads');
    expect(TestBed.inject(AuthSession).me()).toBeNull();
  });
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

  it.each([
    [404, 'TENANT_NOT_RESOLVABLE', 'auth.errors.TENANT_NOT_RESOLVABLE.text'],
    [503, 'SERVICE_UNAVAILABLE', 'auth.shared.errors.unavailable'],
    [503, 'TENANT_INACTIVE', 'auth.shared.errors.unavailable'],
  ] as const)('keeps the login form and its own error for %s %s', async (status, code, message) => {
    vi.spyOn(TestBed.inject(AuthTransport), 'requestData').mockRejectedValueOnce(new ApiError(status, code));
    await signIn(FAKE_ACCOUNTS.valid.email, FAKE_ACCOUNTS.valid.password);
    expect(notifyError).toHaveBeenCalledWith(expect.any(String), message);
    expect(navigate).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('form')).not.toBeNull();
  });

  it('shows confirmed setup in place of the form and clears the password before retry', async () => {
    vi.spyOn(TestBed.inject(AuthTransport), 'requestData').mockRejectedValueOnce(
      new TenantProvisioningError(503, 'TENANT_INACTIVE'),
    );
    await signIn(FAKE_ACCOUNTS.valid.email, FAKE_ACCOUNTS.valid.password);
    const host: HTMLElement = fixture.nativeElement;
    expect(host.querySelector('app-tenant-provisioning-page')).not.toBeNull();
    expect(host.querySelector('form')).toBeNull();
    expect(c['credentials']().password).toBe('');
    expect(navigate).not.toHaveBeenCalled();
    host.querySelector<HTMLButtonElement>('app-tenant-provisioning-page button')!.click();
    await vi.advanceTimersByTimeAsync(0);
    fixture.detectChanges();
    expect(host.querySelector('app-tenant-provisioning-page')).toBeNull();
    expect(host.querySelector('form')).not.toBeNull();
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

  it.each([['ar', ar], ['en', en]] as const)('shows the translated invalid-credentials message in %s', async (lang, auth) => {
    const i18n = TestBed.inject(TranslocoService);
    i18n.setTranslation({ auth }, lang);
    i18n.setActiveLang(lang);
    await signIn(FAKE_ACCOUNTS.valid.email, 'wrong');
    expect(notifyError).toHaveBeenCalledWith(auth.errors.INVALID_CREDENTIALS.title, auth.errors.INVALID_CREDENTIALS.text);
    expect(navigate).not.toHaveBeenCalled();
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
