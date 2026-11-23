import { DOCUMENT } from '@angular/common';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Router } from '@angular/router';
import { provideTransloco, TranslocoService } from '@jsverse/transloco';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../../core/api/api-errors';
import { CoreHttp } from '../../../../core/api/core-http';
import { AuthSession } from '../../../../core/auth/auth-session';
import type { LoginSession, TenantMe } from '../../../../core/auth/auth-session.model';
import { LanguageState } from '../../../../core/i18n/language';
import { Notify } from '../../../../core/notify/notify';
import { ConfirmDialog } from '../../../../shared/ui/confirm-dialog/confirm-dialog';
import { MfaCard } from './mfa-card/mfa-card';
import { MfaModal } from './mfa-modal/mfa-modal';
import { PasswordCard } from './password-card/password-card';
import { SecurityPage } from './security-page/security-page';
import { SecurityApi } from './security.api';
import { SessionsCard } from './sessions/sessions-card/sessions-card';
import { SessionsApi } from './sessions/sessions.api';
import type { AuthSession as SessionItem, SessionList } from './sessions/sessions.model';
import en from '../../../../../../public/i18n/en.json';
import ar from '../../../../../../public/i18n/ar.json';
import securityEn from '../../../../../../public/i18n/ws-account-security/en.json';
import securityAr from '../../../../../../public/i18n/ws-account-security/ar.json';
import sessionsEn from '../../../../../../public/i18n/ws-account-sessions/en.json';
import sessionsAr from '../../../../../../public/i18n/ws-account-sessions/ar.json';

const BASE = '/api/tenant/core/v1/auth';
const body = { currentPassword: 'TestOldPassword!1', newPassword: 'TestNewPassword!2' };
const step = {
  mfaRequired: true,
  challengeId: 'A'.repeat(43),
  expiresIn: 600,
  resendAfterSeconds: 60,
};
const user: TenantMe = {
  id: 'user',
  email: 'person@example.test',
  firstName: 'Test',
  lastName: 'User',
  hasAvatar: false,
  workspace: { timezone: 'UTC', defaultLanguage: 'en' },
  isTenantOwner: false,
  mfaEnabled: false,
  mfaUpdatedAt: null,
  status: 'ACTIVE',
  accessibleBranches: [],
  accessibleCompanies: [],
  accessibleBranchCompanies: [],
  permissions: [],
  seats: [],
  permissionScopes: {},
  teamMemberships: [],
  featureEntitlements: {},
  accessScope: {
    mode: 'FULL',
    branchesTruncated: false,
    companiesTruncated: false,
    teamMembershipsTruncated: false,
    teamMembershipsTotal: 0,
  },
};
const current: SessionItem = {
  id: '019addf0-0000-7000-8000-000000000001',
  clientId: 'browser',
  clientType: 'WEB',
  deviceLabel: 'Test browser',
  createdAt: '2026-11-20T10:00:00Z',
  lastRefreshAt: null,
  lastAccessIssuedAt: '2026-11-23T10:00:00Z',
  lastUserActivityAt: null,
  idleExpiresAt: '2026-11-24T10:00:00Z',
  absoluteExpiresAt: '2026-12-20T10:00:00Z',
  endedAt: null,
  endReason: null,
  refreshUseCount: '3',
  accessIssueCount: '4',
  credentialVersion: 1,
  sessionEpoch: 1,
  current: true,
};
const other: SessionItem = {
  ...current,
  id: '019addf0-0000-7000-8000-000000000002',
  current: false,
  deviceLabel: 'Other device',
};
const ended: SessionItem = {
  ...other,
  id: '019addf0-0000-7000-8000-000000000003',
  endedAt: '2026-11-22T10:00:00Z',
  endReason: 'PASSWORD_CHANGED',
};
const login: LoginSession = {
  tokenType: 'Bearer',
  expiresIn: 300,
  sessionExpiresIn: 3600,
  session: { ...current, authorizationVersion: 1, profileVersion: 1 },
};
function list(items = [other, ended, current], page = 1, hasMore = false): SessionList {
  return { items, endedHistory: { page, pageSize: 50, hasMore } };
}
class Loader {
  getTranslation(path: string) {
    const arabic = path.endsWith('ar');
    if (path.startsWith('ws-account-security/')) return of(arabic ? securityAr : securityEn);
    if (path.startsWith('ws-account-sessions/')) return of(arabic ? sessionsAr : sessionsEn);
    return of({
      ...(arabic ? ar : en),
      wsAccSec: arabic ? securityAr : securityEn,
      wsAccSessions: arabic ? sessionsAr : sessionsEn,
    });
  }
}

describe('account security contract', () => {
  let dialogMethods: PropertyDescriptorMap;
  let http: HttpTestingController;
  let api: SecurityApi;
  let sessions: SessionsApi;
  let cookie: string;
  const session = {
    me: signal<TenantMe | null>(user),
    signedIn: vi.fn(async () => {}),
    refresh: vi.fn(async (): Promise<'ok' | 'ended'> => 'ok'),
    requestVersion: vi.fn(() => ({ generation: 1, revision: 1 })),
    recoverRequest: vi.fn(async () => false),
    reloadProfile: vi.fn(async () => {}),
    sessionEnded: vi.fn(async () => {}),
    signedOutByServer: vi.fn(async () => {}),
  };
  const notify = { success: vi.fn(), error: vi.fn(), info: vi.fn() };
  const router = { navigate: vi.fn() };
  const language = { current: signal<'en' | 'ar'>('en') };

  beforeEach(() => {
    dialogMethods = Object.getOwnPropertyDescriptors(HTMLDialogElement.prototype);
    vi.resetAllMocks();
    session.me.set({ ...user });
    session.refresh.mockResolvedValue('ok');
    session.recoverRequest.mockResolvedValue(false);
    session.requestVersion.mockReturnValue({ generation: 1, revision: 1 });
    session.signedIn.mockResolvedValue(undefined);
    session.reloadProfile.mockResolvedValue(undefined);
    session.sessionEnded.mockResolvedValue(undefined);
    session.signedOutByServer.mockResolvedValue(undefined);
    language.current.set('en');
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideTransloco({
          config: {
            availableLangs: ['en', 'ar'],
            defaultLang: 'en',
            reRenderOnLangChange: true,
            missingHandler: { logMissingKey: false },
          },
          loader: Loader,
        }),
        { provide: AuthSession, useValue: session },
        { provide: Notify, useValue: notify },
        { provide: Router, useValue: router },
        { provide: LanguageState, useValue: language },
      ],
    });
    const doc = TestBed.inject(DOCUMENT);
    cookie = `${doc.location.protocol === 'https:' ? '__Host-mutakamel-tenant-csrf' : 'mutakamel-http-tenant-csrf'}=proof`;
    vi.spyOn(doc, 'cookie', 'get').mockImplementation(() => cookie);
    Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
      configurable: true,
      writable: true,
      value: vi.fn(function (this: HTMLDialogElement) {
        this.open = true;
      }),
    });
    Object.defineProperty(HTMLDialogElement.prototype, 'close', {
      configurable: true,
      writable: true,
      value: vi.fn(function (this: HTMLDialogElement) {
        this.open = false;
      }),
    });
    vi.spyOn(ConfirmDialog.prototype, 'open').mockResolvedValue(true);
    const translations = TestBed.inject(TranslocoService);
    translations.setTranslation({ ...en, wsAccSec: securityEn, wsAccSessions: sessionsEn }, 'en');
    translations.setTranslation({ ...ar, wsAccSec: securityAr, wsAccSessions: sessionsAr }, 'ar');
    http = TestBed.inject(HttpTestingController);
    api = TestBed.inject(SecurityApi);
    sessions = TestBed.inject(SessionsApi);
    expect(TestBed.inject(CoreHttp)).toBeTruthy();
  });
  afterEach(() => {
    try {
      http?.verify();
    } finally {
      TestBed.resetTestingModule();
      for (const name of ['showModal', 'close']) {
        const descriptor = dialogMethods[name];
        if (descriptor) Object.defineProperty(HTMLDialogElement.prototype, name, descriptor);
        else Reflect.deleteProperty(HTMLDialogElement.prototype, name);
      }
      vi.restoreAllMocks();
      vi.useRealTimers();
    }
  });

  async function tick() {
    for (let i = 0; i < 25; i++) await Promise.resolve();
  }
  function request(path: string, method: string) {
    return http.expectOne((r) => r.url === BASE + path && r.method === method);
  }
  function fail(
    path: string,
    method: string,
    status: number,
    errorCode: string,
    details?: Record<string, string[]>,
    headers?: Record<string, string>,
  ) {
    request(path, method).flush(
      { errorCode, ...(details ? { details } : {}) },
      { status, statusText: 'Test failure', headers },
    );
  }
  function password() {
    const f = TestBed.createComponent(PasswordCard);
    f.detectChanges();
    f.componentInstance['currentPassword'].set(body.currentPassword);
    f.componentInstance['newPassword'].set(body.newPassword);
    f.componentInstance['confirmPassword'].set(body.newPassword);
    return f;
  }
  function modal() {
    const f = TestBed.createComponent(MfaModal);
    f.detectChanges();
    f.componentInstance.open(true, user.email);
    f.detectChanges();
    f.componentInstance['currentPassword'].set(body.currentPassword);
    return f;
  }
  async function codeModal() {
    const f = modal();
    const pending = f.componentInstance['submitPassword'](new Event('submit'));
    request('/mfa/settings/challenge', 'POST').flush({ success: true, data: step });
    await pending;
    f.detectChanges();
    f.componentInstance['code'].set('123456');
    return f;
  }
  async function card(items = [other, ended, current], hasMore = false) {
    const f = TestBed.createComponent(SessionsCard);
    f.detectChanges();
    request('/sessions', 'GET').flush({ success: true, data: list(items, 1, hasMore) });
    await tick();
    f.detectChanges();
    return f;
  }

  it('security page reads mfa state from the session', async () => {
    session.me.set({ ...user, mfaEnabled: true });
    const f = TestBed.createComponent(SecurityPage);
    f.detectChanges();
    request('/sessions', 'GET').flush({ success: true, data: list() });
    await tick();
    f.detectChanges();
    expect(f.debugElement.query(By.directive(MfaCard)).componentInstance.me().mfaEnabled).toBe(
      true,
    );
    expect(f.nativeElement.textContent).toContain(securityEn.mfa.on);
    http.expectNone(BASE + '/me');
  });
  it('password change hands the new session to AuthSession', async () => {
    const f = password();
    const pending = f.componentInstance['submit'](new Event('submit'));
    request('/change-password', 'POST').flush({ success: true, data: login });
    await pending;
    expect(session.signedIn).toHaveBeenCalledWith(login);
    expect(notify.success).toHaveBeenCalledWith(securityEn.toast.passwordChanged);
    expect(f.componentInstance['currentPassword']()).toBe('');
  });
  it('password change reads csrf per write', async () => {
    const pending = api.changePassword(body);
    const req = request('/change-password', 'POST');
    expect(req.request.headers.get('x-csrf-token')).toBe('proof');
    expect(req.request.withCredentials).toBe(true);
    expect(req.request.body).toEqual(body);
    req.flush({ success: true, data: login });
    await pending;
    cookie = cookie.replace('proof', 'rotated');
    const next = api.startMfaChange(true, body.currentPassword);
    const write = request('/mfa/settings/challenge', 'POST');
    expect(write.request.headers.get('x-csrf-token')).toBe('rotated');
    write.flush({ success: true, data: step });
    await next;
  });
  it('password change sends no key and never retries', async () => {
    const pending = api.changePassword(body);
    const assertion = expect(pending).rejects.toMatchObject({ status: 503 });
    const req = request('/change-password', 'POST');
    expect(req.request.headers.has('x-idempotency-key')).toBe(false);
    req.flush({}, { status: 503, statusText: 'Unavailable' });
    await assertion;
    http.expectNone(BASE + '/change-password');
    expect(session.refresh).not.toHaveBeenCalled();
  });
  it('wrong current password is a field message', async () => {
    const f = password();
    const pending = f.componentInstance['submit'](new Event('submit'));
    fail('/change-password', 'POST', 422, 'CURRENT_PASSWORD_INVALID');
    await pending;
    f.detectChanges();
    expect(f.componentInstance['currentErrorKey']()).toBe(
      'wsAccSec.errors.CURRENT_PASSWORD_INVALID',
    );
    expect(f.nativeElement.textContent).toContain('Current password is wrong.');
    expect(notify.error).not.toHaveBeenCalled();
  });
  it('stale session on change-password refreshes once and resends', async () => {
    const pending = api.changePassword(body);
    fail('/change-password', 'POST', 401, 'INVALID_CREDENTIALS');
    await tick();
    const req = request('/change-password', 'POST');
    expect(req.request.body).toEqual(body);
    expect(session.recoverRequest).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'INVALID_CREDENTIALS' }),
      { generation: 1, revision: 1 },
    );
    expect(session.refresh).toHaveBeenCalledTimes(1);
    req.flush({ success: true, data: login });
    expect(await pending).toEqual(login);
  });
  it('stale password session ending adds no navigation or resend', async () => {
    session.refresh.mockResolvedValue('ended');
    const f = password();
    const pending = f.componentInstance['submit'](new Event('submit'));
    fail('/change-password', 'POST', 401, 'INVALID_CREDENTIALS');
    await pending;
    expect(session.sessionEnded).not.toHaveBeenCalled();
    expect(router.navigate).not.toHaveBeenCalled();
    expect(session.signedIn).not.toHaveBeenCalled();
    expect(notify.error).not.toHaveBeenCalled();
    http.expectNone(BASE + '/change-password');
  });
  it('stale password refresh failure keeps the form', async () => {
    session.refresh.mockRejectedValue(new ApiError(503, 'UNAVAILABLE'));
    const f = password();
    const pending = f.componentInstance['submit'](new Event('submit'));
    fail('/change-password', 'POST', 401, 'INVALID_CREDENTIALS');
    await pending;
    expect(notify.error).toHaveBeenCalledWith(securityEn.errors.generic);
    expect(f.componentInstance['currentPassword']()).toBe(body.currentPassword);
    expect(f.componentInstance['currentErrorKey']()).toBeNull();
  });
  it('a second stale password response ends the session', async () => {
    const pending = api.changePassword(body);
    fail('/change-password', 'POST', 401, 'INVALID_CREDENTIALS');
    await tick();
    fail('/change-password', 'POST', 401, 'INVALID_CREDENTIALS');
    expect(await pending).toBeNull();
    expect(session.sessionEnded).toHaveBeenCalledTimes(1);
    expect(session.refresh).toHaveBeenCalledTimes(1);
  });
  it('password policy errors under fields', async () => {
    const f = password();
    for (const code of ['CURRENT_PASSWORD_INVALID', 'WEAK_PASSWORD', 'PASSWORD_TOO_LONG']) {
      const pending = f.componentInstance['submit'](new Event('submit'));
      fail('/change-password', 'POST', 422, code);
      await pending;
      const field = code === 'CURRENT_PASSWORD_INVALID' ? 'currentErrorKey' : 'newErrorKey';
      expect(f.componentInstance[field]()).toBe('wsAccSec.errors.' + code);
    }
  });
  it('password validation errors', async () => {
    const f = password();
    const pending = f.componentInstance['submit'](new Event('submit'));
    fail('/change-password', 'POST', 400, 'CORE_VALIDATION_FAILED', {
      currentPassword: ['required'],
      newPassword: ['too_short'],
    });
    await pending;
    f.detectChanges();
    expect(f.componentInstance['currentErrorKey']()).toBe('wsAccSec.errors.CORE_VALIDATION_FAILED');
    expect(f.componentInstance['newErrorKey']()).toBe('wsAccSec.errors.CORE_VALIDATION_FAILED');
  });
  it('password throttle uses retry after header', async () => {
    const f = password();
    const pending = f.componentInstance['submit'](new Event('submit'));
    fail('/change-password', 'POST', 429, 'COMMON.GENERIC.RATE_LIMITED', undefined, {
      'Retry-After': '37',
    });
    await pending;
    expect(notify.error).toHaveBeenCalledWith(
      securityEn.errors.AUTH_MFA_THROTTLED.replace('{{s}}', '37'),
    );
  });
  it('password change unknown outcome', async () => {
    const f = password();
    let pending = f.componentInstance['submit'](new Event('submit'));
    request('/change-password', 'POST').error(new ProgressEvent('error'));
    await pending;
    expect(notify.error).toHaveBeenCalledWith(securityEn.unknown.text);
    expect(f.componentInstance['newPassword']()).toBe(body.newPassword);
    session.refresh.mockResolvedValue('ended');
    pending = f.componentInstance['submit'](new Event('submit'));
    request('/change-password', 'POST').error(new ProgressEvent('error'));
    await pending;
    expect(session.sessionEnded).toHaveBeenCalledTimes(1);
    expect(session.signedIn).not.toHaveBeenCalled();
  });

  it('mfa challenge shows code step', async () => {
    vi.useFakeTimers();
    const f = await codeModal();
    expect(f.componentInstance['step']()).toBe('code');
    expect(f.componentInstance['expiresRemainingSeconds']()).toBe(600);
    await vi.advanceTimersByTimeAsync(1000);
    expect(f.componentInstance['expiresRemainingSeconds']()).toBe(599);
  });
  it('mfa wrong password field', async () => {
    const f = modal();
    const pending = f.componentInstance['submitPassword'](new Event('submit'));
    fail('/mfa/settings/challenge', 'POST', 422, 'CURRENT_PASSWORD_INVALID');
    await pending;
    f.detectChanges();
    expect(f.nativeElement.textContent).toContain(securityEn.errors.CURRENT_PASSWORD_INVALID);
    expect(notify.error).not.toHaveBeenCalled();
  });
  it('mfa invalid challenge stays on screen', async () => {
    const f = modal();
    const pending = f.componentInstance['submitPassword'](new Event('submit'));
    fail('/mfa/settings/challenge', 'POST', 401, 'AUTH_MFA_INVALID_CHALLENGE');
    await pending;
    f.detectChanges();
    expect(f.nativeElement.textContent).toContain(securityEn.errors.AUTH_MFA_INVALID_CHALLENGE);
    expect(session.recoverRequest).not.toHaveBeenCalled();
    expect(session.signedOutByServer).not.toHaveBeenCalled();
    expect(notify.error).not.toHaveBeenCalled();
  });
  it('mfa refreshable 401 retries once', async () => {
    session.recoverRequest.mockResolvedValue(true);
    const pending = api.startMfaChange(true, body.currentPassword);
    fail('/mfa/settings/challenge', 'POST', 401, 'COMMON.AUTH.TOKEN_EXPIRED');
    await tick();
    const req = request('/mfa/settings/challenge', 'POST');
    expect(req.request.body).toEqual({ enabled: true, currentPassword: body.currentPassword });
    expect(req.request.headers.has('x-idempotency-key')).toBe(false);
    req.flush({ success: true, data: step });
    await pending;
    expect(session.recoverRequest).toHaveBeenCalledTimes(1);
  });
  it('mfa terminal 401 does not retry', async () => {
    const pending = api.startMfaChange(true, body.currentPassword);
    const assertion = expect(pending).rejects.toMatchObject({ code: 'AUTH_SESSION_ENDED' });
    fail('/mfa/settings/challenge', 'POST', 401, 'AUTH_SESSION_ENDED');
    await assertion;
    expect(session.recoverRequest).toHaveBeenCalledTimes(1);
    http.expectNone(BASE + '/mfa/settings/challenge');
  });
  it('mfa throttle uses details seconds', async () => {
    vi.useFakeTimers();
    const f = modal();
    const pending = f.componentInstance['submitPassword'](new Event('submit'));
    fail(
      '/mfa/settings/challenge',
      'POST',
      429,
      'AUTH_MFA_THROTTLED',
      { retryAfterSeconds: ['31'] },
      { 'Retry-After': '90' },
    );
    await pending;
    f.detectChanges();
    expect(f.componentInstance['throttleRemainingSeconds']()).toBe(31);
    expect(f.nativeElement.querySelectorAll('[role="status"]').length).toBe(1);
    expect(
      f.nativeElement.querySelector('[role="status"] span[aria-hidden="true"]').textContent,
    ).toContain('31');
    await vi.advanceTimersByTimeAsync(31000);
    f.detectChanges();
    expect(f.componentInstance['canContinue']()).toBe(true);
    expect(f.nativeElement.querySelector('[role="status"]').textContent).toContain(
      securityEn.mfa.throttleEnded,
    );
    expect(notify.error).not.toHaveBeenCalled();
  });
  it('mfa profile throttle uses header seconds', async () => {
    const f = modal();
    const pending = f.componentInstance['submitPassword'](new Event('submit'));
    fail('/mfa/settings/challenge', 'POST', 429, 'COMMON.GENERIC.RATE_LIMITED', undefined, {
      'Retry-After': '44',
    });
    await pending;
    expect(f.componentInstance['throttleRemainingSeconds']()).toBe(44);
    expect(notify.error).not.toHaveBeenCalled();
  });
  it('mfa unavailable inline notice', async () => {
    const f = modal();
    const pending = f.componentInstance['submitPassword'](new Event('submit'));
    fail('/mfa/settings/challenge', 'POST', 503, 'AUTH_MFA_UNAVAILABLE');
    await pending;
    f.detectChanges();
    expect(f.nativeElement.querySelector('[role="alert"]').textContent).toContain(
      securityEn.errors.AUTH_MFA_UNAVAILABLE,
    );
    expect(f.componentInstance['canContinue']()).toBe(false);
    expect(notify.error).not.toHaveBeenCalled();
  });
  it('mfa resend keeps the deadline', async () => {
    vi.useFakeTimers();
    const f = await codeModal();
    const deadline = f.componentInstance['deadline']();
    await vi.advanceTimersByTimeAsync(60000);
    let pending = f.componentInstance['resend']();
    const req = request('/mfa/settings/resend', 'POST');
    expect(req.request.body).toEqual({ challengeId: step.challengeId });
    req.flush({ success: true, data: { ...step, expiresIn: 600 } });
    await pending;
    expect(f.componentInstance['deadline']()).toBe(deadline);
    await vi.advanceTimersByTimeAsync(60000);
    pending = f.componentInstance['resend']();
    fail('/mfa/settings/resend', 'POST', 429, 'AUTH_MFA_THROTTLED', { retryAfterSeconds: ['20'] });
    await pending;
    expect(f.componentInstance['deadline']()).toBe(deadline);
    expect(f.componentInstance['throttleRemainingSeconds']()).toBe(20);
    expect(notify.error).not.toHaveBeenCalled();
  });
  it('mfa confirm signs out every tab', async () => {
    const f = await codeModal();
    const pending = f.componentInstance['submitCode'](new Event('submit'));
    const req = request('/mfa/settings/confirm', 'POST');
    expect(req.request.body).toEqual({ challengeId: step.challengeId, code: '123456' });
    req.flush(null, { status: 204, statusText: 'No Content' });
    await pending;
    expect(session.signedOutByServer).toHaveBeenCalledWith('security.mfaChanged');
    expect(router.navigate).not.toHaveBeenCalled();
  });
  it('mfa confirm wrong code stays', async () => {
    const f = await codeModal();
    const pending = f.componentInstance['submitCode'](new Event('submit'));
    fail('/mfa/settings/confirm', 'POST', 401, 'AUTH_MFA_INVALID_CHALLENGE');
    await pending;
    f.detectChanges();
    expect(f.nativeElement.textContent).toContain(securityEn.errors.AUTH_MFA_INVALID_CHALLENGE);
    expect(session.recoverRequest).not.toHaveBeenCalled();
    expect(session.signedOutByServer).not.toHaveBeenCalled();
  });
  it('mfa confirm unknown outcome', async () => {
    const f = await codeModal();
    const pending = f.componentInstance['submitCode'](new Event('submit'));
    request('/mfa/settings/confirm', 'POST').error(new ProgressEvent('error'));
    await pending;
    f.detectChanges();
    expect(session.reloadProfile).toHaveBeenCalledWith({ generation: 1, revision: 1 });
    expect(f.nativeElement.textContent).toContain(securityEn.unknown.text);
    expect(f.nativeElement.textContent).toContain(securityEn.unknown.check);
    expect(f.componentInstance['canConfirm']()).toBe(false);
    session.reloadProfile.mockImplementation(async () => {
      session.me.set({ ...user, mfaEnabled: true });
    });
    await f.componentInstance['checkAgain']();
    expect(session.signedOutByServer).toHaveBeenCalledWith('security.mfaChanged');
    http.expectNone(BASE + '/mfa/settings/confirm');
  });
  it('mfa unknown outcome with ended session uses the security notice', async () => {
    const f = await codeModal();
    session.refresh.mockResolvedValue('ended');
    const pending = f.componentInstance['submitCode'](new Event('submit'));
    request('/mfa/settings/confirm', 'POST').error(new ProgressEvent('error'));
    await pending;
    expect(session.signedOutByServer).toHaveBeenCalledWith('security.mfaChanged');
    expect(session.reloadProfile).not.toHaveBeenCalled();
  });
  it('mfa unknown outcome with transient check keeps check again', async () => {
    const f = await codeModal();
    session.refresh.mockRejectedValue(new ApiError(503, 'UNAVAILABLE'));
    const pending = f.componentInstance['submitCode'](new Event('submit'));
    request('/mfa/settings/confirm', 'POST').error(new ProgressEvent('error'));
    await pending;
    expect(f.componentInstance['unknownOutcome']()).toBe(true);
    expect(session.signedOutByServer).not.toHaveBeenCalled();
  });

  it('sessions list renders active and history', async () => {
    const f = await card([other, ended, current], true);
    expect(f.componentInstance['activeSessions']().map((s) => s.id)).toEqual([
      current.id,
      other.id,
    ]);
    f.componentInstance['toggleHistory']();
    f.detectChanges();
    expect(f.nativeElement.textContent).toContain(sessionsEn.reasons.PASSWORD_CHANGED);
    expect(f.nativeElement.textContent).toContain(sessionsEn.showMore);
  });
  it('sessions history load more dedupes', async () => {
    const f = await card([current, ended], true);
    const pending = f.componentInstance['onLoadMore']();
    const req = request('/sessions', 'GET');
    expect(req.request.params.get('historyPage')).toBe('2');
    const older = { ...ended, id: '019addf0-0000-7000-8000-000000000004' };
    req.flush({ success: true, data: list([current, ended, older], 2) });
    await pending;
    expect(f.componentInstance['endedSessions']().map((s) => s.id)).toEqual([ended.id, older.id]);
    expect(f.componentInstance['hasMoreHistory']()).toBe(false);
  });
  it('sessions empty history', async () => {
    const f = await card([current]);
    expect(f.componentInstance['endedSessions']()).toEqual([]);
    expect(f.nativeElement.querySelector('[aria-controls]').textContent).toContain('0');
    f.componentInstance['toggleHistory']();
    f.detectChanges();
    const history = f.nativeElement.querySelector('#' + f.componentInstance['historyRegionId']);
    expect(history).not.toBeNull();
    expect(history.querySelectorAll('li').length).toBe(0);
  });
  it('sessions list refreshable 401 retries once', async () => {
    session.recoverRequest.mockResolvedValue(true);
    const pending = sessions.listSessions(2);
    fail('/sessions', 'GET', 401, 'COMMON.AUTH.TOKEN_EXPIRED');
    await tick();
    const req = request('/sessions', 'GET');
    expect(req.request.params.get('historyPage')).toBe('2');
    req.flush({ success: true, data: list([], 2) });
    await pending;
    expect(session.recoverRequest).toHaveBeenCalledTimes(1);
  });
  it('sessions list load failure', async () => {
    const f = TestBed.createComponent(SessionsCard);
    f.detectChanges();
    fail('/sessions', 'GET', 503, 'INTERNAL_ERROR');
    await tick();
    f.detectChanges();
    expect(f.nativeElement.textContent).toContain(sessionsEn.loadFailed);
    expect(f.nativeElement.textContent).toContain(sessionsEn.retry);
    f.componentInstance.reload();
    request('/sessions', 'GET').error(new ProgressEvent('error'));
    await tick();
    expect(f.componentInstance['loadFailed']()).toBe(true);
    f.componentInstance.reload();
    request('/sessions', 'GET').flush({ success: true, data: list() });
    await tick();
    expect(f.componentInstance['loadFailed']()).toBe(false);
  });
  it('revoke other session reloads list', async () => {
    const f = await card();
    const pending = f.componentInstance['onEndSession'](other);
    await tick();
    request('/sessions/' + other.id, 'DELETE').flush(null, {
      status: 204,
      statusText: 'No Content',
    });
    await tick();
    const authoritative = {
      ...other,
      endedAt: '2026-11-23T10:01:00Z',
      endReason: 'DEVICE_REVOKED' as const,
    };
    request('/sessions', 'GET').flush({ success: true, data: list([current, authoritative]) });
    await pending;
    expect(f.componentInstance['endedSessions']()).toEqual([authoritative]);
  });
  it('revoke current session signs out', async () => {
    const f = await card();
    const pending = f.componentInstance['onEndSession'](current);
    await tick();
    request('/sessions/' + current.id, 'DELETE').flush(null, {
      status: 204,
      statusText: 'No Content',
    });
    await pending;
    expect(session.signedOutByServer).toHaveBeenCalledWith('security.allSessionsEnded');
    expect(router.navigate).not.toHaveBeenCalled();
  });
  it('revoke unknown session is success', async () => {
    const f = await card([current]);
    const pending = f.componentInstance['onEndSession'](ended);
    await tick();
    request('/sessions/' + ended.id, 'DELETE').flush(null, {
      status: 204,
      statusText: 'No Content',
    });
    await tick();
    request('/sessions', 'GET').flush({ success: true, data: list([current]) });
    await pending;
    expect(notify.success).toHaveBeenCalledWith(sessionsEn.toast.ended);
  });
  it('revoke invalid id toast', async () => {
    const f = await card();
    const pending = f.componentInstance['onEndSession'](other);
    await tick();
    fail('/sessions/' + other.id, 'DELETE', 400, 'COMMON.VALIDATION.UUID_V7_INVALID');
    await pending;
    expect(notify.error).toHaveBeenCalledWith('Could not end this session.');
  });
  it('revoke throttle toast', async () => {
    const f = await card();
    const pending = f.componentInstance['onEndSession'](other);
    await tick();
    fail('/sessions/' + other.id, 'DELETE', 429, 'GW.RATE.LIMIT_EXCEEDED', undefined, {
      'Retry-After': '19',
    });
    await pending;
    expect(notify.error).toHaveBeenCalledWith(
      sessionsEn.errors.TOO_MANY_REQUESTS.replace('{{seconds}}', '19'),
    );
  });
  it('end all sessions signs out every tab', async () => {
    const f = await card();
    const pending = f.componentInstance['onSignOutAll']();
    await tick();
    const req = request('/logout-all', 'POST');
    expect(req.request.body).toBeNull();
    req.flush(null, { status: 204, statusText: 'No Content' });
    await pending;
    expect(session.signedOutByServer).toHaveBeenCalledWith('security.allSessionsEnded');
    expect(router.navigate).not.toHaveBeenCalled();
  });
  it('logout all failures', async () => {
    const f = await card();
    session.recoverRequest.mockResolvedValue(true);
    const pending = f.componentInstance['onSignOutAll']();
    await tick();
    fail('/logout-all', 'POST', 401, 'COMMON.AUTH.TOKEN_EXPIRED');
    await tick();
    fail('/logout-all', 'POST', 503, 'INTERNAL_ERROR');
    await pending;
    expect(notify.error).toHaveBeenCalledWith(sessionsEn.errors.generic);
    expect(session.recoverRequest).toHaveBeenCalledTimes(1);
    expect(session.signedOutByServer).not.toHaveBeenCalled();
  });
  it('security write without csrf sends nothing', async () => {
    cookie = '';
    for (const write of [
      () => api.changePassword(body),
      () => api.startMfaChange(true, body.currentPassword),
      () => api.resendMfaCode(step.challengeId),
      () => api.confirmMfaChange(step.challengeId, '123456'),
      () => sessions.revokeSession(other.id),
      () => sessions.logoutAll(),
    ]) {
      await expect(write()).rejects.toMatchObject({ status: 403, code: 'GW.AUTH.CSRF_INVALID' });
    }
    http.expectNone(() => true);
    expect(session.recoverRequest).not.toHaveBeenCalled();
  });

  it('all security writes omit idempotency and never retry a server failure', async () => {
    for (const [send, path, method] of [
      [() => api.startMfaChange(true, body.currentPassword), '/mfa/settings/challenge', 'POST'],
      [() => api.resendMfaCode(step.challengeId), '/mfa/settings/resend', 'POST'],
      [() => api.confirmMfaChange(step.challengeId, '123456'), '/mfa/settings/confirm', 'POST'],
      [() => sessions.revokeSession(other.id), '/sessions/' + other.id, 'DELETE'],
      [() => sessions.logoutAll(), '/logout-all', 'POST'],
    ] as const) {
      const assertion = expect(send()).rejects.toMatchObject({ status: 503 });
      const req = request(path, method);
      expect(req.request.headers.has('x-idempotency-key')).toBe(false);
      expect(req.request.withCredentials).toBe(true);
      req.flush({}, { status: 503, statusText: 'Unavailable' });
      await assertion;
    }
    http.expectNone(() => true);
  });
  it('resend confirm and revoke recover at most once', async () => {
    session.recoverRequest.mockResolvedValue(true);
    for (const [send, path, method] of [
      [() => api.resendMfaCode(step.challengeId), '/mfa/settings/resend', 'POST'],
      [() => api.confirmMfaChange(step.challengeId, '123456'), '/mfa/settings/confirm', 'POST'],
      [() => sessions.revokeSession(other.id), '/sessions/' + other.id, 'DELETE'],
    ] as const) {
      const pending = send();
      const assertion = expect(pending).rejects.toMatchObject({ status: 401 });
      fail(path, method, 401, 'COMMON.AUTH.TOKEN_EXPIRED');
      await tick();
      fail(path, method, 401, 'COMMON.AUTH.TOKEN_EXPIRED');
      await assertion;
    }
    expect(session.recoverRequest).toHaveBeenCalledTimes(3);
  });
  it('Arabic security and sessions errors use scoped translations', async () => {
    const translations = TestBed.inject(TranslocoService);
    translations.setActiveLang('ar');
    language.current.set('ar');
    const f = password();
    const pending = f.componentInstance['submit'](new Event('submit'));
    fail('/change-password', 'POST', 422, 'CURRENT_PASSWORD_INVALID');
    await pending;
    f.detectChanges();
    expect(f.nativeElement.textContent).toContain(securityAr.errors.CURRENT_PASSWORD_INVALID);
    expect(translations.translate('wsAccSec.unknown.text')).toBe(securityAr.unknown.text);
    expect(translations.translate('wsAccSessions.errors.COMMON.VALIDATION.UUID_V7_INVALID')).toBe(
      sessionsAr.errors.COMMON.VALIDATION.UUID_V7_INVALID,
    );
  });
});
