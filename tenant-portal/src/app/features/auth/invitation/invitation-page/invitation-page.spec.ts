import { Injectable } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, provideRouter } from '@angular/router';
import { TranslocoLoader, provideTransloco } from '@jsverse/transloco';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../../core/api/api-errors';
import { AuthSession } from '../../../../core/auth/auth-session';
import { AuthSessionApi } from '../../../../core/auth/auth-session.api';
import { fakeGetMe, resetFakeSession } from '../../../../core/auth/auth-session.fake';
import { Notify } from '../../../../core/notify/notify';
import { resetFakeChallenges } from '../../shared/mfa-challenge.fake';
import { MfaPending } from '../../shared/mfa-pending';
import {
  FAKE_INVITE_TOKENS,
  fakeInviteCallCount,
  resetFakeInvitations,
  setFakeInviteError,
  setFakeInviteNext,
} from '../invitation.fake';
import { InvitationPage } from './invitation-page';

@Injectable()
class EmptyLoader implements TranslocoLoader {
  getTranslation() {
    return of({});
  }
}

const STRONG_PASSWORD = 'Valid#Password2026';

let fixture: ComponentFixture<InvitationPage> | null = null;
let notifySuccess: ReturnType<typeof vi.spyOn>;
let notifyError: ReturnType<typeof vi.spyOn>;
let navigate: ReturnType<typeof vi.spyOn>;
let navigateByUrl: ReturnType<typeof vi.spyOn>;

function mountWithFragment(fragment: string | null): HTMLElement {
  const route = TestBed.inject(ActivatedRoute);
  route.snapshot.fragment = fragment;
  fixture = TestBed.createComponent(InvitationPage);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

function setField(root: HTMLElement, id: string, value: string): void {
  const input = root.querySelector<HTMLInputElement>(`#${id}`);
  if (!input) throw new Error(`Missing #${id}`);
  input.value = value;
  input.dispatchEvent(new Event('input'));
  fixture?.detectChanges();
}

async function submitForm(root: HTMLElement, advanceMs?: number): Promise<void> {
  const formEl = root.querySelector('form');
  if (!formEl) throw new Error('Missing form');
  formEl.dispatchEvent(new Event('submit'));
  if (advanceMs !== undefined) {
    await vi.advanceTimersByTimeAsync(advanceMs);
  } else {
    await vi.advanceTimersByTimeAsync(2_000);
  }
  fixture?.detectChanges();
}

beforeEach(() => {
  vi.useFakeTimers();
  resetFakeSession();
  resetFakeChallenges();
  resetFakeInvitations();
  sessionStorage.clear();
  localStorage.clear();

  TestBed.configureTestingModule({
    providers: [
      { provide: AuthSessionApi, useValue: { getMe: fakeGetMe, hasCsrfCookie: () => true } },
      provideRouter([]),
      provideTransloco({
        config: { availableLangs: ['ar', 'en'], defaultLang: 'en', missingHandler: { logMissingKey: false } },
        loader: EmptyLoader,
      }),
    ],
  });

  const notify = TestBed.inject(Notify);
  notifySuccess = vi.spyOn(notify, 'success').mockImplementation(() => undefined);
  notifyError = vi.spyOn(notify, 'error').mockImplementation(() => undefined);

  const router = TestBed.inject(Router);
  navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
  navigateByUrl = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
});

afterEach(() => {
  TestBed.inject(MfaPending).clear();
  resetFakeInvitations();
  resetFakeChallenges();
  resetFakeSession();
  fixture?.destroy();
  fixture = null;
  TestBed.resetTestingModule();
  vi.useRealTimers();
});

describe('invitation page', () => {
  it('reads the fragment token into memory and strips it from the URL immediately', () => {
    const route = TestBed.inject(ActivatedRoute);
    const root = mountWithFragment(`token=${FAKE_INVITE_TOKENS.valid}`);

    expect(navigate).toHaveBeenCalledWith([], {
      relativeTo: route,
      replaceUrl: true,
      fragment: undefined,
      queryParamsHandling: 'preserve',
    });
    expect(root.querySelector('form')).not.toBeNull();
    // Other app services keep preferences in storage; the token itself must never be written there.
    for (const store of [sessionStorage, localStorage]) {
      for (let i = 0; i < store.length; i++) {
        const key = store.key(i) ?? '';
        expect(`${key}=${store.getItem(key) ?? ''}`).not.toContain(FAKE_INVITE_TOKENS.valid);
      }
    }
  });

  it('shows the invalid invitation state without calling the API when token is missing or malformed', () => {
    const missingRoot = mountWithFragment(null);
    expect(missingRoot.querySelector('form')).toBeNull();
    expect(missingRoot.textContent).toContain('authInvite.invalid.title');
    expect(missingRoot.textContent).toContain('authInvite.invalid.text');
    expect(missingRoot.textContent).toContain('authInvite.invalid.signIn');
    expect(fakeInviteCallCount()).toBe(0);
    expect(navigate).not.toHaveBeenCalled();

    fixture?.destroy();
    fixture = null;

    const shortRoot = mountWithFragment('token=too-short');
    expect(shortRoot.querySelector('form')).toBeNull();
    expect(shortRoot.textContent).toContain('authInvite.invalid.title');
    expect(fakeInviteCallCount()).toBe(0);
    expect(navigate).toHaveBeenCalledTimes(1);
  });

  it('keeps submit disabled until password meets policy and matches, and toggles password visibility', () => {
    const root = mountWithFragment(`token=${FAKE_INVITE_TOKENS.valid}`);
    const submitBtn = root.querySelector<HTMLButtonElement>('button[type="submit"]')!;
    const newInput = root.querySelector<HTMLInputElement>('#invite-password')!;
    const toggleBtn = newInput.parentElement!.querySelector<HTMLButtonElement>('button[type="button"]')!;

    expect(submitBtn.disabled).toBe(true);
    expect(newInput.type).toBe('password');
    expect(toggleBtn.getAttribute('aria-pressed')).toBe('false');

    toggleBtn.click();
    fixture?.detectChanges();
    expect(newInput.type).toBe('text');
    expect(toggleBtn.getAttribute('aria-pressed')).toBe('true');

    setField(root, 'invite-password', STRONG_PASSWORD);
    setField(root, 'invite-confirm', 'Different#Pass2026');
    expect(submitBtn.disabled).toBe(true);

    setField(root, 'invite-confirm', STRONG_PASSWORD);
    expect(submitBtn.disabled).toBe(false);
  });

  it('activates a non-MFA invitation, calls AuthSession.signedIn, shows welcome toast, clears fields, and navigates to /', async () => {
    const root = mountWithFragment(`token=${FAKE_INVITE_TOKENS.valid}`);
    setField(root, 'invite-password', STRONG_PASSWORD);
    setField(root, 'invite-confirm', STRONG_PASSWORD);

    await submitForm(root);

    expect(TestBed.inject(AuthSession).status()).toBe('signed-in');
    expect(notifySuccess).toHaveBeenCalledWith('authInvite.toast.welcome');
    expect(notifyError).not.toHaveBeenCalled();
    expect(navigateByUrl).toHaveBeenCalledWith('/', { replaceUrl: true });
    expect(root.querySelector<HTMLInputElement>('#invite-password')?.value).toBe('');
    expect(root.querySelector<HTMLInputElement>('#invite-confirm')?.value).toBe('');
  });

  it('stores MfaPending with origin invitation and navigates to /verify when MFA is required', async () => {
    const root = mountWithFragment(`token=${FAKE_INVITE_TOKENS.mfa}`);
    setField(root, 'invite-password', STRONG_PASSWORD);
    setField(root, 'invite-confirm', STRONG_PASSWORD);

    await submitForm(root);

    const pending = TestBed.inject(MfaPending).current();
    expect(pending).toMatchObject({
      origin: 'invitation',
      returnUrl: '/',
      step: { mfaRequired: true },
    });
    expect(navigateByUrl).toHaveBeenCalledWith('/verify', { replaceUrl: true });
    expect(notifySuccess).not.toHaveBeenCalled();
    expect(notifyError).not.toHaveBeenCalled();
  });

  it('switches to the invalid state when submit returns 400 INVALID_ACTION_TOKEN', async () => {
    const root = mountWithFragment(`token=${FAKE_INVITE_TOKENS.used}`);
    setField(root, 'invite-password', STRONG_PASSWORD);
    setField(root, 'invite-confirm', STRONG_PASSWORD);

    await submitForm(root);

    expect(root.querySelector('form')).toBeNull();
    expect(root.textContent).toContain('authInvite.invalid.title');
    expect(root.textContent).toContain('authInvite.invalid.text');
    expect(notifyError).not.toHaveBeenCalled();
  });

  it('shows 422 WEAK_PASSWORD on the New password field and clears it when typing', async () => {
    const root = mountWithFragment(`token=${FAKE_INVITE_TOKENS.valid}`);
    setField(root, 'invite-password', 'Password123!');
    setField(root, 'invite-confirm', 'Password123!');

    await submitForm(root);

    const fieldError = root.querySelector('#invite-password-error');
    expect(fieldError?.textContent).toContain('auth.shared.errors.WEAK_PASSWORD');
    expect(notifyError).not.toHaveBeenCalled();

    setField(root, 'invite-password', STRONG_PASSWORD);
    expect(root.querySelector('#invite-password-error')).toBeNull();
  });

  it('makes a single API call without retry on network error and displays the ambiguous connection notice', async () => {
    const root = mountWithFragment(`token=${FAKE_INVITE_TOKENS.valid}`);
    setFakeInviteError(ApiError.fromResponse(0, null));
    setField(root, 'invite-password', STRONG_PASSWORD);
    setField(root, 'invite-confirm', STRONG_PASSWORD);

    await submitForm(root);

    expect(fakeInviteCallCount()).toBe(1);
    const alert = root.querySelector('[role="alert"]');
    expect(alert?.textContent).toContain('authInvite.errors.ambiguous');
    expect(notifyError).not.toHaveBeenCalled();
  });

  it('renders a persistent role=status throttle countdown that disables submit until finished', async () => {
    const root = mountWithFragment(`token=${FAKE_INVITE_TOKENS.valid}`);
    setFakeInviteNext('THROTTLED');
    setField(root, 'invite-password', STRONG_PASSWORD);
    setField(root, 'invite-confirm', STRONG_PASSWORD);

    await submitForm(root, 600);

    const statusRegion = root.querySelector('[role="status"]')!;
    expect(statusRegion.textContent).toContain('auth.shared.throttle');
    expect(root.querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled).toBe(true);
    expect(notifyError).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(30_000);
    fixture?.detectChanges();

    expect(statusRegion.textContent).toContain('auth.shared.throttleDone');
    expect(root.querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled).toBe(false);
  });

  it('renders inline warning for 409 session limit and inline danger for 403 past due', async () => {
    const root = mountWithFragment(`token=${FAKE_INVITE_TOKENS.valid}`);
    setFakeInviteNext('SESSION_LIMIT');
    setField(root, 'invite-password', STRONG_PASSWORD);
    setField(root, 'invite-confirm', STRONG_PASSWORD);

    await submitForm(root);
    expect(root.querySelector('[role="note"]')?.textContent).toContain('authInvite.errors.sessionLimit');
    expect(notifyError).not.toHaveBeenCalled();

    fixture?.destroy();
    fixture = null;

    const pastDueRoot = mountWithFragment(`token=${FAKE_INVITE_TOKENS.pastDue}`);
    setField(pastDueRoot, 'invite-password', STRONG_PASSWORD);
    setField(pastDueRoot, 'invite-confirm', STRONG_PASSWORD);

    await submitForm(pastDueRoot);
    expect(pastDueRoot.querySelector('[role="alert"]')?.textContent).toContain('auth.shared.errors.SUBSCRIPTION_PAST_DUE');
    expect(notifyError).not.toHaveBeenCalled();
  });
});
