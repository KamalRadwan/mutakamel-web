import { EnvironmentInjector, createEnvironmentInjector, runInInjectionContext } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../core/api/api-errors';
import { retryAfterSeconds, throttleCountdown } from './auth-throttle';

describe('auth-throttle', () => {
  let injector: EnvironmentInjector;

  beforeEach(() => {
    vi.useFakeTimers();
    injector = createEnvironmentInjector([], TestBed.inject(EnvironmentInjector));
  });

  afterEach(() => {
    if (!(injector as unknown as { destroyed: boolean }).destroyed) injector.destroy();
    TestBed.resetTestingModule();
    vi.useRealTimers();
  });

  it('reads retryAfterSeconds from details or falls back', () => {
    expect(retryAfterSeconds(new ApiError(429, 'AUTH_MFA_THROTTLED', { retryAfterSeconds: ['30'] }))).toBe(30);
    expect(retryAfterSeconds(new ApiError(429, 'AUTH_LOGIN_THROTTLED', { retryAfterSeconds: ['12.2'] }))).toBe(13);
    expect(retryAfterSeconds(new ApiError(429, 'COMMON.GENERIC.RATE_LIMITED'))).toBe(60);
    expect(retryAfterSeconds(new ApiError(429, 'GW.RATE.LIMIT_EXCEEDED'), 45)).toBe(45);
    expect(retryAfterSeconds(new Error('network'), 25)).toBe(25);
  });

  it('counts down once per second, restarts, and clears its interval on destroy', () => {
    const countdown = runInInjectionContext(injector, () => throttleCountdown());
    expect(countdown.remaining()).toBe(0);
    expect(countdown.active()).toBe(false);

    countdown.start(3);
    expect(countdown.remaining()).toBe(3);
    expect(countdown.active()).toBe(true);

    vi.advanceTimersByTime(1000);
    expect(countdown.remaining()).toBe(2);

    vi.advanceTimersByTime(2000);
    expect(countdown.remaining()).toBe(0);
    expect(countdown.active()).toBe(false);

    countdown.start(5);
    expect(countdown.remaining()).toBe(5);
    const clearSpy = vi.spyOn(globalThis, 'clearInterval');
    injector.destroy();
    expect(clearSpy).toHaveBeenCalled();
    clearSpy.mockRestore();
  });
});
