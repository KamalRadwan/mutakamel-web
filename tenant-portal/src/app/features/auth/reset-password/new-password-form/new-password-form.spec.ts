import { Injectable } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslocoLoader, provideTransloco } from '@jsverse/transloco';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  FAKE_RESET_TOKENS,
  fakeResetCallCounts,
  resetFakeResetPassword,
  setFakeResetNext,
} from '../reset-password.fake';
import { NewPasswordForm } from './new-password-form';

@Injectable()
class EmptyLoader implements TranslocoLoader {
  getTranslation() {
    return of({});
  }
}

let fixture: ComponentFixture<NewPasswordForm>;
let component: NewPasswordForm;

function newPasswordInput(): HTMLInputElement {
  return fixture.nativeElement.querySelector('#reset-new-password') as HTMLInputElement;
}

function confirmPasswordInput(): HTMLInputElement {
  return fixture.nativeElement.querySelector('#reset-confirm-password') as HTMLInputElement;
}

function submitButton(): HTMLButtonElement {
  return fixture.nativeElement.querySelector('button[type="submit"]') as HTMLButtonElement;
}

function setFieldValue(input: HTMLInputElement, value: string): void {
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  fixture.detectChanges();
}

beforeEach(() => {
  vi.useFakeTimers();
  resetFakeResetPassword();
  TestBed.configureTestingModule({
    providers: [
      provideTransloco({
        config: { availableLangs: ['ar', 'en'], defaultLang: 'en', missingHandler: { logMissingKey: false } },
        loader: EmptyLoader,
      }),
    ],
  });
  fixture = TestBed.createComponent(NewPasswordForm);
  component = fixture.componentInstance;
  fixture.componentRef.setInput('token', FAKE_RESET_TOKENS.valid);
  fixture.detectChanges();
});

afterEach(() => {
  resetFakeResetPassword();
  fixture.destroy();
  TestBed.resetTestingModule();
  vi.useRealTimers();
});

describe('NewPasswordForm', () => {
  it('disables submit until all password checks pass and both fields match', () => {
    expect(submitButton().disabled).toBe(true);

    setFieldValue(newPasswordInput(), 'weak');
    setFieldValue(confirmPasswordInput(), 'weak');
    expect(submitButton().disabled).toBe(true);

    setFieldValue(newPasswordInput(), 'Strong#Pass2026!');
    setFieldValue(confirmPasswordInput(), 'Different#2026!');
    expect(submitButton().disabled).toBe(true);

    setFieldValue(confirmPasswordInput(), 'Strong#Pass2026!');
    expect(submitButton().disabled).toBe(false);
  });

  it('shows 422 WEAK_PASSWORD on New password, clears on typing, and makes one fake call', async () => {
    const onDone = vi.fn();
    const onInvalid = vi.fn();
    component.done.subscribe(onDone);
    component.invalidLink.subscribe(onInvalid);

    setFieldValue(newPasswordInput(), 'Password123!');
    setFieldValue(confirmPasswordInput(), 'Password123!');
    submitButton().click();
    fixture.detectChanges();

    await vi.advanceTimersByTimeAsync(500);
    await Promise.resolve();
    fixture.detectChanges();

    expect(fakeResetCallCounts().reset).toBe(1);
    expect(onDone).not.toHaveBeenCalled();
    expect(onInvalid).not.toHaveBeenCalled();

    const errorEl = fixture.nativeElement.querySelector('#reset-new-password-error') as HTMLElement | null;
    expect(errorEl?.textContent).toContain('auth.shared.errors.WEAK_PASSWORD');

    // Typing into New password clears the server error.
    setFieldValue(newPasswordInput(), 'Strong#Pass2026!');
    expect(fixture.nativeElement.querySelector('#reset-new-password-error')).toBeNull();
  });

  it('emits invalidLink on 400 INVALID_ACTION_TOKEN without retry', async () => {
    fixture.componentRef.setInput('token', FAKE_RESET_TOKENS.expired);
    fixture.detectChanges();

    const onDone = vi.fn();
    const onInvalid = vi.fn();
    component.done.subscribe(onDone);
    component.invalidLink.subscribe(onInvalid);

    setFieldValue(newPasswordInput(), 'Strong#Pass2026!');
    setFieldValue(confirmPasswordInput(), 'Strong#Pass2026!');
    submitButton().click();
    fixture.detectChanges();

    await vi.advanceTimersByTimeAsync(500);
    await Promise.resolve();
    fixture.detectChanges();

    expect(fakeResetCallCounts().reset).toBe(1);
    expect(onInvalid).toHaveBeenCalledTimes(1);
    expect(onDone).not.toHaveBeenCalled();
  });

  it('emits done, clears both inputs, and calls fake reset once on success', async () => {
    const onDone = vi.fn();
    component.done.subscribe(onDone);

    setFieldValue(newPasswordInput(), 'Strong#Pass2026!');
    setFieldValue(confirmPasswordInput(), 'Strong#Pass2026!');
    submitButton().click();
    fixture.detectChanges();

    await vi.advanceTimersByTimeAsync(500);
    await Promise.resolve();
    fixture.detectChanges();

    expect(fakeResetCallCounts().reset).toBe(1);
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(newPasswordInput().value).toBe('');
    expect(confirmPasswordInput().value).toBe('');
  });

  it('renders unavailable alert on 503 and throttle countdown on 429', async () => {
    setFakeResetNext('UNAVAILABLE');
    setFieldValue(newPasswordInput(), 'Strong#Pass2026!');
    setFieldValue(confirmPasswordInput(), 'Strong#Pass2026!');
    submitButton().click();
    fixture.detectChanges();

    await vi.advanceTimersByTimeAsync(500);
    await Promise.resolve();
    fixture.detectChanges();

    expect(fakeResetCallCounts().reset).toBe(1);
    const alertEl = fixture.nativeElement.querySelector('[role="alert"]') as HTMLElement | null;
    expect(alertEl?.textContent).toContain('auth.shared.errors.unavailable');

    setFakeResetNext('RATE_LIMITED');
    submitButton().click();
    fixture.detectChanges();

    await vi.advanceTimersByTimeAsync(500);
    await Promise.resolve();
    fixture.detectChanges();

    expect(fakeResetCallCounts().reset).toBe(2);
    expect(submitButton().disabled).toBe(true);
    const statusEl = fixture.nativeElement.querySelector('[role="status"]') as HTMLElement | null;
    expect(statusEl?.textContent).toContain('auth.shared.throttle');

    await vi.advanceTimersByTimeAsync(60_000);
    fixture.detectChanges();
    fixture.detectChanges();

    expect(submitButton().disabled).toBe(false);
    expect(statusEl?.textContent).toContain('auth.shared.throttleDone');
  });
});
