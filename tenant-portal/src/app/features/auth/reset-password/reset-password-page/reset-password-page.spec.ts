import { Component, Injectable } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { TranslocoLoader, provideTransloco, provideTranslocoScope } from '@jsverse/transloco';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthSession } from '../../../../core/auth/auth-session';
import { resetFakeSession } from '../../../../core/auth/auth-session.fake';
import {
  FAKE_RESET_TOKENS,
  FAKE_RESET_USER,
  fakeResetCallCounts,
  resetFakeResetPassword,
} from '../reset-password.fake';
import { ResetPasswordPage } from './reset-password-page';

@Injectable()
class ResetTestLoader implements TranslocoLoader {
  getTranslation(path: string) {
    if (path.startsWith('auth-reset/')) {
      return of({
        sent: {
          text: 'If an account exists for {{email}}, we sent it a link to reset the password.',
        },
      });
    }
    return of({});
  }
}

@Component({ template: '<p>login</p>' })
class DummyLoginPage {}

function setInputValue(input: HTMLInputElement, value: string): void {
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

async function flushMicrotasks(): Promise<void> {
  await vi.advanceTimersByTimeAsync(0);
  await Promise.resolve();
}

describe('ResetPasswordPage', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetFakeSession();
    resetFakeResetPassword();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          {
            path: 'reset-password',
            providers: [provideTranslocoScope('auth', { scope: 'auth-reset', alias: 'authReset' })],
            component: ResetPasswordPage,
          },
          {
            path: 'tenant/reset-password',
            providers: [provideTranslocoScope('auth', { scope: 'auth-reset', alias: 'authReset' })],
            component: ResetPasswordPage,
          },
          {
            path: 'login',
            component: DummyLoginPage,
          },
        ]),
        provideTransloco({
          config: { availableLangs: ['ar', 'en'], defaultLang: 'en', missingHandler: { logMissingKey: false } },
          loader: ResetTestLoader,
        }),
      ],
    });
  });

  afterEach(() => {
    resetFakeResetPassword();
    resetFakeSession();
    TestBed.resetTestingModule();
    vi.useRealTimers();
  });

  it('opens /tenant/reset-password#token=… in set mode and strips the fragment from the URL', async () => {
    const router = TestBed.inject(Router);
    const harness = await RouterTestingHarness.create(`/tenant/reset-password#token=${FAKE_RESET_TOKENS.valid}`);
    await flushMicrotasks();
    harness.detectChanges();

    expect(harness.routeNativeElement?.querySelector('app-reset-new-password-form')).not.toBeNull();
    expect(router.url).toBe('/tenant/reset-password');
    expect(fakeResetCallCounts()).toEqual({ request: 0, reset: 0 });
  });

  it('opens /tenant/reset-password with no fragment in invalid state without making an API call', async () => {
    const harness = await RouterTestingHarness.create('/tenant/reset-password');
    await flushMicrotasks();
    harness.detectChanges();

    expect(harness.routeNativeElement?.querySelector('app-reset-new-password-form')).toBeNull();
    expect(harness.routeNativeElement?.textContent).toContain('authReset.invalid.text');
    expect(fakeResetCallCounts()).toEqual({ request: 0, reset: 0 });
  });

  it('opens /tenant/reset-password with a malformed fragment in invalid state and removes the fragment', async () => {
    const router = TestBed.inject(Router);
    const harness = await RouterTestingHarness.create('/tenant/reset-password#token=too-short');
    await flushMicrotasks();
    harness.detectChanges();

    expect(harness.routeNativeElement?.querySelector('app-reset-new-password-form')).toBeNull();
    expect(harness.routeNativeElement?.textContent).toContain('authReset.invalid.text');
    expect(router.url).toBe('/tenant/reset-password');
    expect(fakeResetCallCounts()).toEqual({ request: 0, reset: 0 });
  });

  it('opens /reset-password in request mode and navigates from invalid state when requesting a new link', async () => {
    const router = TestBed.inject(Router);
    const harness = await RouterTestingHarness.create('/tenant/reset-password');
    await flushMicrotasks();
    harness.detectChanges();

    const requestBtn = harness.routeNativeElement?.querySelector('button[uiButton]') as HTMLButtonElement;
    requestBtn.click();
    await flushMicrotasks();
    harness.detectChanges();

    expect(router.url).toBe('/reset-password');
    expect(harness.routeNativeElement?.querySelector('app-reset-request-form')).not.toBeNull();
  });

  it('shows the identical "sent" text for known and unknown emails and enforces a 60s resend cooldown', async () => {
    async function submitEmail(emailValue: string): Promise<{ text: string; bdiText: string | null }> {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          provideRouter([
            {
              path: 'reset-password',
              providers: [provideTranslocoScope('auth', { scope: 'auth-reset', alias: 'authReset' })],
              component: ResetPasswordPage,
            },
            { path: 'login', component: DummyLoginPage },
          ]),
          provideTransloco({
            config: { availableLangs: ['ar', 'en'], defaultLang: 'en', missingHandler: { logMissingKey: false } },
            loader: ResetTestLoader,
          }),
        ],
      });

      const harness = await RouterTestingHarness.create('/reset-password');
      await flushMicrotasks();
      harness.detectChanges();

      const emailInput = harness.routeNativeElement?.querySelector('#reset-email') as HTMLInputElement;
      setInputValue(emailInput, emailValue);
      harness.detectChanges();

      const submitBtn = harness.routeNativeElement?.querySelector('button[type="submit"]') as HTMLButtonElement;
      submitBtn.click();
      harness.detectChanges();

      await vi.advanceTimersByTimeAsync(650);
      await flushMicrotasks();
      harness.detectChanges();

      const notice = harness.routeNativeElement?.querySelector('app-settings-notice') as HTMLElement;
      const bdi = notice.querySelector('bdi[dir="ltr"]');
      const resendBtn = harness.routeNativeElement?.querySelector('button[uiButton]') as HTMLButtonElement;
      expect(resendBtn.disabled).toBe(true);
      expect(resendBtn.textContent).toContain('authReset.sent.againIn');
      expect(harness.routeNativeElement?.querySelector('a[href="/login"]')).not.toBeNull();

      await vi.advanceTimersByTimeAsync(60_000);
      harness.detectChanges();
      expect(resendBtn.disabled).toBe(false);
      expect(resendBtn.textContent).toContain('authReset.sent.again');

      const result = {
        text: notice.textContent?.trim() ?? '',
        bdiText: bdi?.textContent ?? null,
      };
      harness.fixture.destroy();
      return result;
    }

    const known = await submitEmail(`  ${FAKE_RESET_USER.email.toUpperCase()}  `);
    const unknown = await submitEmail('stranger@example.com');

    expect(known.bdiText).toBe(FAKE_RESET_USER.email);
    expect(unknown.bdiText).toBe('stranger@example.com');
    expect(known.text.replace(FAKE_RESET_USER.email, '<EMAIL>')).toBe(
      unknown.text.replace('stranger@example.com', '<EMAIL>'),
    );
  });

  it('calls AuthSession.clearLocal() and transitions to done after changing the password', async () => {
    const authSession = TestBed.inject(AuthSession);
    const clearLocalSpy = vi.spyOn(authSession, 'clearLocal');

    const harness = await RouterTestingHarness.create(`/tenant/reset-password#token=${FAKE_RESET_TOKENS.valid}`);
    await flushMicrotasks();
    harness.detectChanges();

    const newPw = harness.routeNativeElement?.querySelector('#reset-new-password') as HTMLInputElement;
    const confirmPw = harness.routeNativeElement?.querySelector('#reset-confirm-password') as HTMLInputElement;
    setInputValue(newPw, 'Strong#Pass2026!');
    setInputValue(confirmPw, 'Strong#Pass2026!');
    harness.detectChanges();

    const submitBtn = harness.routeNativeElement?.querySelector('button[type="submit"]') as HTMLButtonElement;
    submitBtn.click();
    harness.detectChanges();

    await vi.advanceTimersByTimeAsync(500);
    await flushMicrotasks();
    harness.detectChanges();

    expect(clearLocalSpy).toHaveBeenCalledTimes(1);
    expect(harness.routeNativeElement?.textContent).toContain('authReset.done.text');
    expect(harness.routeNativeElement?.querySelector('a[uiButton][href="/login"]')).not.toBeNull();
    expect(harness.routeNativeElement?.textContent).not.toContain('auth.shared.backToSignIn');
  });
});
