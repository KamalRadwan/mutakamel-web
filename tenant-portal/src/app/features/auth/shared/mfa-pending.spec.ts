import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MfaStep } from '../../../core/auth/auth-session.model';
import { MfaPending } from './mfa-pending';

describe('MfaPending', () => {
  const step1: MfaStep = { mfaRequired: true, challengeId: 'a'.repeat(43), expiresIn: 600, resendAfterSeconds: 60 };
  const step2: MfaStep = { mfaRequired: true, challengeId: 'a'.repeat(43), expiresIn: 540, resendAfterSeconds: 60 };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-22T10:00:00Z'));
    TestBed.configureTestingModule({});
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    vi.useRealTimers();
  });

  it('stores, updates, defaults returnUrl, and clears the pending challenge', () => {
    const pending = TestBed.inject(MfaPending);
    expect(pending.current()).toBeNull();

    pending.set(step1, { origin: 'login', returnUrl: '/crm/leads' });
    expect(pending.current()).toEqual({
      step: step1,
      origin: 'login',
      returnUrl: '/crm/leads',
      receivedAt: Date.now(),
    });

    vi.advanceTimersByTime(60_000);
    pending.update(step2);
    expect(pending.current()).toEqual({
      step: step2,
      origin: 'login',
      returnUrl: '/crm/leads',
      receivedAt: Date.now(),
    });

    pending.clear();
    expect(pending.current()).toBeNull();

    pending.update(step1);
    expect(pending.current()).toBeNull();

    pending.set(step1, { origin: 'invitation' });
    expect(pending.current()?.returnUrl).toBe('/workspace/home');
  });
});
