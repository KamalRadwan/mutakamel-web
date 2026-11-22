import { Injectable } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { type ActivatedRouteSnapshot, Router, type RouterStateSnapshot, UrlTree, provideRouter } from '@angular/router';
import { TranslocoLoader, provideTransloco } from '@jsverse/transloco';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../../core/api/api-errors';
import { AuthSession } from '../../../../core/auth/auth-session';
import { AuthSessionApi } from '../../../../core/auth/auth-session.api';
import { fakeGetMe, resetFakeSession } from '../../../../core/auth/auth-session.fake';
import { AuthTransport } from '../../../../core/auth/auth-transport';
import { Notify } from '../../../../core/notify/notify';
import {
  FAKE_MFA_CODE,
  registerFakeChallenge,
  resetFakeChallenges,
  setFakeMfaNext,
} from '../../shared/mfa-challenge.fake';
import { MfaPending, type MfaPendingOrigin } from '../../shared/mfa-pending';
import { verifyPendingGuard } from '../verify-pending.guard';
import { fakeResendCode, fakeVerifyCallCounts, fakeVerifyCode, resetFakeVerify, setFakeVerifyError } from '../verify.fake';
import type { MfaVerifyBody, MfaResendBody } from '../verify.model';
import { verifyRoutes } from '../verify.routes';
import { VerifyPage } from './verify-page';

@Injectable()
class EmptyLoader implements TranslocoLoader {
  getTranslation() {
    return of({});
  }
}

let fixture: ComponentFixture<VerifyPage> | null = null;
let navigate: ReturnType<typeof vi.spyOn>;
let notifySuccess: ReturnType<typeof vi.spyOn>;
const getMe = vi.fn(fakeGetMe);

async function advance(ms: number): Promise<void> {
  await vi.advanceTimersByTimeAsync(ms);
  fixture?.detectChanges();
  await Promise.resolve();
}

function seedPending(opts: { returnUrl?: string; origin?: MfaPendingOrigin } = {}): void {
  const step = registerFakeChallenge({ remember: false });
  TestBed.inject(MfaPending).set(step, {
    returnUrl: opts.returnUrl,
    origin: opts.origin ?? 'login',
  });
}

function mountPage(opts: { returnUrl?: string; origin?: MfaPendingOrigin } = {}): void {
  seedPending(opts);
  fixture = TestBed.createComponent(VerifyPage);
  if (!fixture.nativeElement.isConnected) {
    document.body.appendChild(fixture.nativeElement);
  }
  fixture.detectChanges();
}

function rootEl(): HTMLElement {
  return fixture!.nativeElement as HTMLElement;
}

function codeInputs(): HTMLInputElement[] {
  return Array.from(rootEl().querySelectorAll('app-code-boxes input'));
}

function enterCode(code: string): void {
  const inputs = codeInputs();
  for (let i = 0; i < code.length; i++) {
    inputs[i].dispatchEvent(new KeyboardEvent('keydown', { key: code[i], bubbles: true, cancelable: true }));
  }
  fixture?.detectChanges();
}

function submitButton(): HTMLButtonElement | null {
  return rootEl().querySelector('form button[type="submit"]');
}

function resendButton(): HTMLButtonElement | null {
  return rootEl().querySelector('form button[uiButton][type="button"]');
}

function restartButton(): HTMLButtonElement | null {
  return rootEl().querySelector('section button[uiButton][type="button"]');
}

describe('verifyPendingGuard', () => {
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
  });

  afterEach(() => {
    TestBed.inject(MfaPending).clear();
    resetFakeChallenges();
    resetFakeSession();
    TestBed.resetTestingModule();
    vi.useRealTimers();
  });

  it('redirects to /login?verify=expired when no challenge or an expired challenge is present', async () => {
    const router = TestBed.inject(Router);
    const noPending = TestBed.runInInjectionContext(() =>
      verifyPendingGuard({} as ActivatedRouteSnapshot, { url: '/verify' } as RouterStateSnapshot),
    );
    expect(noPending).toBeInstanceOf(UrlTree);
    expect(router.serializeUrl(noPending as UrlTree)).toBe('/login?verify=expired');

    seedPending();
    await vi.advanceTimersByTimeAsync(601_000);
    const expired = TestBed.runInInjectionContext(() =>
      verifyPendingGuard({} as ActivatedRouteSnapshot, { url: '/verify' } as RouterStateSnapshot),
    );
    expect(expired).toBeInstanceOf(UrlTree);
    expect(router.serializeUrl(expired as UrlTree)).toBe('/login?verify=expired');
  });

  it('allows /verify when an unexpired challenge is active and is wired to verifyRoutes', () => {
    seedPending();
    const allowed = TestBed.runInInjectionContext(() =>
      verifyPendingGuard({} as ActivatedRouteSnapshot, { url: '/verify' } as RouterStateSnapshot),
    );
    expect(allowed).toBe(true);
    expect(verifyRoutes[0].canActivate).toContain(verifyPendingGuard);
  });
});

describe('VerifyPage', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetFakeSession();
    resetFakeChallenges();
    resetFakeVerify();
    getMe.mockReset();
    TestBed.configureTestingModule({
      providers: [
        {
          provide: AuthTransport,
          useValue: {
            requestData: (route: 'mfa/verify' | 'mfa/resend', body: MfaVerifyBody | MfaResendBody) =>
              route === 'mfa/verify' && 'code' in body ? fakeVerifyCode(body.challengeId, body.code) : fakeResendCode(body.challengeId),
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
    navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    notifySuccess = vi.spyOn(TestBed.inject(Notify), 'success').mockImplementation(() => undefined);
  });

  afterEach(() => {
    if (fixture) {
      fixture.destroy();
      fixture = null;
    }
    TestBed.inject(MfaPending).clear();
    resetFakeVerify();
    resetFakeChallenges();
    resetFakeSession();
    TestBed.resetTestingModule();
    vi.useRealTimers();
  });

  it('requires explicit submit (no auto-submit), signs in, clears MfaPending, and navigates to returnUrl', async () => {
    mountPage({ returnUrl: '/crm/leads', origin: 'login' });
    const authSession = TestBed.inject(AuthSession);
    const signedInSpy = vi.spyOn(authSession, 'signedIn');

    expect(submitButton()?.disabled).toBe(true);
    enterCode(FAKE_MFA_CODE);
    expect(submitButton()?.disabled).toBe(false);
    expect(fakeVerifyCallCounts().verify).toBe(0);

    submitButton()?.click();
    fixture?.detectChanges();
    await advance(1000);

    expect(signedInSpy).toHaveBeenCalledTimes(1);
    expect(authSession.status()).toBe('signed-in');
    expect(TestBed.inject(MfaPending).current()).toBeNull();
    expect(navigate).toHaveBeenCalledWith('/crm/leads', { replaceUrl: true });
    expect(notifySuccess).not.toHaveBeenCalled();
  });

  it('shows the welcome toast when verifying from an invitation', async () => {
    mountPage({ origin: 'invitation' });
    enterCode(FAKE_MFA_CODE);

    submitButton()?.click();
    fixture?.detectChanges();
    await advance(1000);

    expect(notifySuccess).toHaveBeenCalledWith('authVerify.toast.welcome');
    expect(navigate).toHaveBeenCalledWith('/workspace/home', { replaceUrl: true });
  });

  it('opens workspace home when the pending returnUrl is empty', async () => {
    mountPage({ returnUrl: '' });
    enterCode(FAKE_MFA_CODE);
    submitButton()?.click();
    await advance(1000);

    expect(navigate).toHaveBeenCalledWith('/workspace/home', { replaceUrl: true });
  });

  it('does not enter the requested feature after an accepted code if /me denies the identity', async () => {
    getMe.mockRejectedValueOnce(new ApiError(403, 'SESSION_IDENTITY_INACTIVE'));
    mountPage({ returnUrl: '/crm/leads' });
    enterCode(FAKE_MFA_CODE);
    submitButton()?.click();
    await advance(1_000);
    expect(getMe).toHaveBeenCalledOnce();
    expect(TestBed.inject(AuthSession).status()).toBe('signed-out');
    expect(navigate.mock.calls.map((call: unknown[]) => call[0])).not.toContain('/crm/leads');
    expect(notifySuccess).not.toHaveBeenCalled();
  });

  it('stays on screen on 401 AUTH_MFA_INVALID_CHALLENGE, shows field error, clears boxes, and never calls sessionEnded', async () => {
    mountPage();
    const authSession = TestBed.inject(AuthSession);
    const sessionEndedSpy = vi.spyOn(authSession, 'sessionEnded');

    enterCode('000000');
    submitButton()?.click();
    fixture?.detectChanges();
    await advance(1000);

    expect(sessionEndedSpy).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
    expect(TestBed.inject(MfaPending).current()).not.toBeNull();

    const fieldError = rootEl().querySelector('ui-field [role="alert"]');
    expect(fieldError?.textContent).toContain('authVerify.errors.AUTH_MFA_INVALID_CHALLENGE');
    const inputs = codeInputs();
    expect(inputs.map((el) => el.value)).toEqual(['', '', '', '', '', '']);
    expect(document.activeElement).toBe(inputs[0]);
  });

  it('switches to the start-again state after 5 wrong attempts', async () => {
    mountPage();

    for (let i = 0; i < 5; i++) {
      enterCode('000000');
      submitButton()?.click();
      fixture?.detectChanges();
      await advance(1000);
    }

    expect(codeInputs()).toHaveLength(0);
    const note = rootEl().querySelector('section app-settings-notice');
    expect(note?.textContent).toContain('authVerify.restart.text');

    const restartBtn = restartButton();
    expect(restartBtn?.textContent).toContain('authVerify.restart.action');
    restartBtn?.click();
    expect(TestBed.inject(MfaPending).current()).toBeNull();
    expect(navigate).toHaveBeenCalledWith('/login');
  });

  it('shows the role="status" throttle countdown on 429 and disables Verify and Resend until 0', async () => {
    mountPage();
    setFakeMfaNext('THROTTLED');
    enterCode(FAKE_MFA_CODE);

    submitButton()?.click();
    fixture?.detectChanges();
    await advance(1000);

    const status = rootEl().querySelector('section [role="status"]');
    expect(status?.textContent).toContain('auth.shared.throttle');
    expect(status?.querySelector('[aria-hidden="true"]')).not.toBeNull();
    expect(submitButton()?.disabled).toBe(true);
    expect(resendButton()?.disabled).toBe(true);

    await advance(30_000);
    expect(status?.textContent).toContain('auth.shared.throttleDone');
    expect(submitButton()?.disabled).toBe(false);
  });

  it('shows the ambiguous notice on network error and makes only one verify call', async () => {
    mountPage();
    setFakeVerifyError(new ApiError(0, 'NETWORK_ERROR'));
    enterCode(FAKE_MFA_CODE);

    submitButton()?.click();
    fixture?.detectChanges();
    await advance(1000);

    expect(fakeVerifyCallCounts().verify).toBe(1);
    expect(navigate).not.toHaveBeenCalled();
    const alert = rootEl().querySelector('section [role="alert"]');
    expect(alert?.textContent).toContain('authVerify.errors.ambiguous');
  });

  it('enforces resend cooldown, updates MfaPending, clears boxes, and shows toast on resend', async () => {
    mountPage();
    expect(resendButton()?.disabled).toBe(true);

    await advance(60_000);
    expect(resendButton()?.disabled).toBe(false);

    enterCode('12');
    resendButton()?.click();
    fixture?.detectChanges();
    await advance(400);

    expect(notifySuccess).toHaveBeenCalledWith('authVerify.toast.codeSent');
    expect(codeInputs().map((el) => el.value)).toEqual(['', '', '', '', '', '']);
    expect(document.activeElement).toBe(codeInputs()[0]);
    expect(resendButton()?.disabled).toBe(true);
    expect(TestBed.inject(MfaPending).current()?.step.expiresIn).toBeLessThanOrEqual(540);
  });

  it('switches to start-again state when the deadline expires and clears pending on back link', async () => {
    mountPage();
    await advance(600_000);

    expect(codeInputs()).toHaveLength(0);
    expect(rootEl().textContent).toContain('authVerify.restart.text');

    fixture?.destroy();
    fixture = null;
    mountPage();
    const backLink = rootEl().querySelector('section a[href="/login"]') as HTMLAnchorElement;
    backLink.click();
    expect(TestBed.inject(MfaPending).current()).toBeNull();
  });
});
