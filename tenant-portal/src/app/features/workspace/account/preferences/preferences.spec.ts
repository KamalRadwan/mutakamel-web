import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideTransloco, TranslocoService } from '@jsverse/transloco';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthSession } from '../../../../core/auth/auth-session';
import type { TenantMe } from '../../../../core/auth/auth-session.model';
import { LanguageState } from '../../../../core/i18n/language';
import { Notify } from '../../../../core/notify/notify';
import { ThemeState } from '../../../../core/theme/theme';
import { ViewScale, type ViewSize } from '../../../../core/view/view-scale';
import { ConfirmDialog } from '../../../../shared/ui/confirm-dialog/confirm-dialog';
import { AppearanceCard } from './appearance-card/appearance-card';
import { PreferencesPage } from './preferences-page/preferences-page';
import { ProfileCard } from './profile-card/profile-card';
import { PreferencesApi } from './preferences.api';
import type { TenantProfile } from './preferences.model';
import en from '../../../../../../public/i18n/en.json';
import ar from '../../../../../../public/i18n/ar.json';
import prefsEn from '../../../../../../public/i18n/ws-account-preferences/en.json';
import prefsAr from '../../../../../../public/i18n/ws-account-preferences/ar.json';

const BASE = '/api/tenant/core/v1';
const UUID_V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const me: TenantMe = {
  id: 'user', email: 'ada@example.com', firstName: 'Ada', lastName: 'Lovelace', hasAvatar: true,
  isTenantOwner: false, mfaEnabled: false, mfaUpdatedAt: null, status: 'ACTIVE',
  accessibleBranches: [], accessibleCompanies: [], accessibleBranchCompanies: [], permissions: [], seats: [],
  permissionScopes: {}, teamMemberships: [], featureEntitlements: {},
  accessScope: { mode: 'FULL', branchesTruncated: false, companiesTruncated: false, teamMembershipsTruncated: false, teamMembershipsTotal: 0 },
};
const profile: TenantProfile = {
  id: 'profile', tenantUserId: 'user', themeKey: null, language: null,
  extensions: { startPage: 'home', unrelated: 'keep' }, createdAt: '', updatedAt: '',
};
class Loader {
  getTranslation(path: string) {
    const arabic = path.endsWith('ar');
    return of(path.includes('/') ? (arabic ? prefsAr : prefsEn)
      : { ...(arabic ? ar : en), wsAccPrefs: arabic ? prefsAr : prefsEn });
  }
}

describe('account preferences contract', () => {
  let http: HttpTestingController;
  const session = {
    me: signal<TenantMe | null>(me),
    requestVersion: vi.fn(() => ({ generation: 1, revision: 2 })),
    reloadProfile: vi.fn(async () => {}),
  };
  const language = { current: signal<'en' | 'ar'>('en') };
  const theme = { current: signal<'light' | 'dark'>('light') };
  const view = { size: signal<ViewSize>('auto'), set: vi.fn((value: ViewSize) => view.size.set(value)) };
  const notify = { success: vi.fn(), error: vi.fn(), warning: vi.fn(), connectionLost: vi.fn(), connectionRestored: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    session.me.set({ ...me });
    session.requestVersion.mockReturnValue({ generation: 1, revision: 2 });
    session.reloadProfile.mockResolvedValue(undefined);
    language.current.set('en'); theme.current.set('light'); view.size.set('auto');
    document.cookie = 'mutakamel-http-tenant-csrf=test-csrf; path=/';
    TestBed.configureTestingModule({ providers: [
      provideHttpClient(), provideHttpClientTesting(),
      provideTransloco({ config: { availableLangs: ['en', 'ar'], defaultLang: 'en', reRenderOnLangChange: true,
        missingHandler: { logMissingKey: false } }, loader: Loader }),
      { provide: AuthSession, useValue: session }, { provide: LanguageState, useValue: language },
      { provide: ThemeState, useValue: theme }, { provide: ViewScale, useValue: view },
      { provide: Notify, useValue: notify },
    ] });
    http = TestBed.inject(HttpTestingController);
    const translations = TestBed.inject(TranslocoService);
    translations.setTranslation({ ...en, wsAccPrefs: prefsEn }, 'en');
    translations.setTranslation({ ...ar, wsAccPrefs: prefsAr }, 'ar');
  });
  afterEach(() => {
    http.verify();
    document.cookie = 'mutakamel-http-tenant-csrf=; Max-Age=0; path=/';
    vi.restoreAllMocks();
  });

  async function request(method: string, path: string) {
    return vi.waitFor(() => http.expectOne((r) => r.method === method && r.url === BASE + path));
  }
  async function page() {
    const f = TestBed.createComponent(PreferencesPage);
    (await request('GET', '/users/me/profile')).flush({ success: true, data: structuredClone(profile) });
    await f.whenStable(); f.detectChanges();
    return f;
  }
  function appearance() {
    const f = TestBed.createComponent(AppearanceCard);
    f.componentRef.setInput('profile', structuredClone(profile)); f.detectChanges();
    return f;
  }
  function card() {
    const f = TestBed.createComponent(ProfileCard);
    f.componentRef.setInput('me', session.me()); f.detectChanges();
    return f;
  }
  function rename() {
    const f = card();
    f.componentInstance['firstNameDraft'].set('Augusta');
    return { f, save: () => f.componentInstance['saveName']() };
  }
  function upload(c: ProfileCard, file = new File(['png'], 'avatar.png', { type: 'image/png' })) {
    return c['onFileSelected']({ target: { files: [file], value: 'avatar.png' } } as unknown as Event);
  }
  function failure(req: Awaited<ReturnType<typeof request>>, status: number, code: string, details?: Record<string, string[]>) {
    req.flush({ errorCode: code, details }, { status, statusText: 'Failure' });
  }

  it('preferences use the session identity', async () => {
    const f = await page();
    const c = f.debugElement.query(By.directive(ProfileCard)).componentInstance as ProfileCard;
    expect(c.me()).toEqual(me);
    expect((f.nativeElement as HTMLElement).querySelector<HTMLInputElement>('input[type=email]')?.value).toBe(me.email);
    expect((f.nativeElement as HTMLElement).textContent).toContain('Remove');
    http.expectNone(BASE + '/auth/me');
    session.me.set({ ...me, firstName: 'Updated' }); f.detectChanges();
    expect(c.me().firstName).toBe('Updated');
  });

  it('null theme and language mean not chosen', async () => {
    const f = await page();
    expect(f.componentInstance['profile']()?.themeKey).toBeNull();
    expect(f.componentInstance['profile']()?.language).toBeNull();
    expect(f.componentInstance['startPage']()).toBe('home');
    expect(language.current()).toBe('en'); expect(theme.current()).toBe('light');
  });

  it.each([503, 0])('profile load failure (%s)', async (status) => {
    const f = TestBed.createComponent(PreferencesPage);
    const req = await request('GET', '/users/me/profile');
    if (status === 0) req.error(new ProgressEvent('error'));
    else failure(req, status, 'INTERNAL_ERROR');
    await f.whenStable(); f.detectChanges();
    expect((f.nativeElement as HTMLElement).textContent).toContain(prefsEn.loadFailed);
    const retry = [...(f.nativeElement as HTMLElement).querySelectorAll('button')].find((b) => b.textContent?.includes('Retry'));
    expect(retry).toBeTruthy();
    if (!status) expect(notify.connectionLost).toHaveBeenCalledWith(en.session.connectionLost.title, en.session.connectionLost.text);
    retry!.click();
    (await request('GET', '/users/me/profile')).flush({ success: true, data: profile });
    await f.whenStable(); f.detectChanges();
    expect(f.componentInstance['loadFailed']()).toBe(false);
    expect(notify.connectionRestored).toHaveBeenCalled();
  });

  it('appearance save sends only the change', async () => {
    const f = appearance();
    const changed = vi.fn(); f.componentInstance.profileChange.subscribe(changed);
    for (const [pick, body] of [
      [() => f.componentInstance['onThemeChange']('dark'), { themeKey: 'dark' }],
      [() => f.componentInstance['onLanguageChange']('ar'), { language: 'ar' }],
      [() => f.componentInstance['onViewSizeChange']('large'), { extensions: { viewSize: 'large' } }],
    ] as const) {
      pick(); const req = await request('PUT', '/users/me/profile');
      expect(req.request.body).toEqual(body);
      req.flush({ success: true, data: { ...profile, ...body } }); await f.whenStable();
    }
    await vi.waitFor(() => expect(changed).toHaveBeenCalledTimes(3));
    expect(view.size()).toBe('large');
  });

  it('appearance save key and csrf', async () => {
    const f = appearance(); const keys: string[] = [];
    for (const value of ['dark', 'light']) {
      f.componentInstance['onThemeChange'](value);
      const req = await request('PUT', '/users/me/profile');
      const key = req.request.headers.get('x-idempotency-key')!;
      expect(key).toMatch(UUID_V7); keys.push(key);
      expect(req.request.headers.get('x-csrf-token')).toBe('test-csrf');
      expect(req.request.withCredentials).toBe(true);
      req.flush({ success: true, data: profile }); await f.whenStable();
    }
    expect(keys[0]).not.toBe(keys[1]);
    document.cookie = 'mutakamel-http-tenant-csrf=; Max-Age=0; path=/';
    f.componentInstance['onThemeChange']('dark'); await f.whenStable();
    http.expectNone(BASE + '/users/me/profile');
    expect(theme.current()).toBe('dark');
    await vi.waitFor(() => expect(notify.warning).toHaveBeenCalledWith(prefsEn.toast.deviceOnly));
  });

  it.each([401, 429, 503])('appearance failure keeps the device value (%s)', async (status) => {
    const f = appearance();
    f.componentInstance['onThemeChange']('dark');
    failure(await request('PUT', '/users/me/profile'), status, 'FAILED');
    await f.whenStable();
    expect(theme.current()).toBe('dark');
    await vi.waitFor(() => expect(notify.warning).toHaveBeenCalledWith(prefsEn.toast.deviceOnly));
    http.expectNone(BASE + '/users/me/profile');
  });

  it('invalid theme keeps the device value', async () => {
    const f = appearance(); f.componentInstance['onThemeChange']('dark');
    failure(await request('PUT', '/users/me/profile'), 400, 'TENANT_PROFILE_THEME_INVALID');
    await f.whenStable(); expect(theme.current()).toBe('dark');
    await vi.waitFor(() => expect(notify.warning).toHaveBeenCalledWith(prefsEn.toast.deviceOnly));
  });

  it('start page saves one extension key', async () => {
    const f = await page(); const task = f.componentInstance['onStartPageChange']('last');
    const req = await request('PUT', '/users/me/profile');
    expect(req.request.body).toEqual({ extensions: { startPage: 'last' } });
    expect(req.request.headers.get('x-idempotency-key')).toMatch(UUID_V7);
    req.flush({ success: true, data: { ...profile, extensions: { ...profile.extensions, startPage: 'last' } } });
    await task; expect(f.componentInstance['startPage']()).toBe('last');
    expect(notify.success).toHaveBeenCalledWith(prefsEn.toast.saved);
  });

  it('start page failure reverts only itself', async () => {
    const f = await page(); const task = f.componentInstance['onStartPageChange']('last');
    f.componentInstance['onProfileChange']({ ...profile, themeKey: 'dark', extensions: { startPage: 'last', viewSize: 'large', unrelated: 'new' } });
    failure(await request('PUT', '/users/me/profile'), 503, 'INTERNAL_ERROR');
    await task;
    expect(f.componentInstance['profile']()).toMatchObject({ themeKey: 'dark', extensions: { startPage: 'home', viewSize: 'large', unrelated: 'new' } });
    expect(notify.error).toHaveBeenCalled();
  });

  it('extensions too large toast', async () => {
    const f = await page(); const task = f.componentInstance['onStartPageChange']('last');
    failure(await request('PUT', '/users/me/profile'), 422, 'PROFILE_EXTENSIONS_TOO_LARGE');
    await task; expect(notify.error).toHaveBeenCalledWith(prefsEn.errors.PROFILE_EXTENSIONS_TOO_LARGE);
  });

  it('rename reloads the session profile', async () => {
    const { save } = rename(); const before = session.requestVersion(); const task = save();
    const req = await request('PATCH', '/users/me');
    expect(req.request.body).toEqual({ firstName: 'Augusta' });
    expect(req.request.headers.get('x-idempotency-key')).toMatch(UUID_V7);
    session.requestVersion.mockReturnValue({ generation: 1, revision: 3 });
    session.reloadProfile.mockImplementation(async () => { session.me.set({ ...me, firstName: 'Augusta' }); });
    req.flush({ success: true, data: { ...me, firstName: 'Augusta' } }); await task;
    expect(session.reloadProfile).toHaveBeenCalledWith(before);
    expect(session.me()?.firstName).toBe('Augusta');
    expect(notify.success).toHaveBeenCalledWith(prefsEn.toast.nameSaved);
  });

  it('rename validation under fields', async () => {
    const { f, save } = rename(); const task = save();
    failure(await request('PATCH', '/users/me'), 400, 'CORE_VALIDATION_FAILED', { firstName: ['First invalid'], lastName: ['Last invalid'] });
    await task; f.detectChanges();
    const messages = [...(f.nativeElement as HTMLElement).querySelectorAll('ui-field [role=alert]')].map((p) => p.textContent);
    expect(messages.join(' ')).toContain('First invalid'); expect(messages.join(' ')).toContain('Last invalid');
    expect(notify.error).not.toHaveBeenCalled();
    f.componentInstance['onFirstNameInput']({ target: { value: 'Other' } } as unknown as Event);
    expect(f.componentInstance['firstNameError']()).toBeNull();
  });

  it('rename 401 keeps form and key', async () => {
    const { f, save } = rename(); let task = save();
    let req = await request('PATCH', '/users/me'); const key = req.request.headers.get('x-idempotency-key');
    failure(req, 401, 'INVALID_CREDENTIALS'); await task;
    expect(f.componentInstance['firstNameDraft']()).toBe('Augusta');
    expect(notify.error).toHaveBeenCalledWith(prefsEn.errors.notSaved);
    expect(session.reloadProfile).not.toHaveBeenCalled();
    task = save(); req = await request('PATCH', '/users/me');
    expect(req.request.headers.get('x-idempotency-key')).toBe(key);
    failure(req, 401, 'INVALID_CREDENTIALS'); await task;
  });

  it('rename retry reuses key', async () => {
    const { f, save } = rename(); let task = save(); let req = await request('PATCH', '/users/me');
    const key = req.request.headers.get('x-idempotency-key'); const body = req.request.body;
    failure(req, 503, 'INTERNAL_ERROR'); await task;
    task = save(); req = await request('PATCH', '/users/me');
    expect(req.request.headers.get('x-idempotency-key')).toBe(key); expect(req.request.body).toEqual(body);
    failure(req, 503, 'INTERNAL_ERROR'); await task;
    f.componentInstance['firstNameDraft'].set('Grace'); task = save(); req = await request('PATCH', '/users/me');
    expect(req.request.headers.get('x-idempotency-key')).not.toBe(key);
    req.flush({ success: true, data: { ...me, firstName: 'Grace' } }); await task;
  });

  it.each([[409, 'GW.IDEM.IN_FLIGHT', en.apiErrors.idempotency], [422, 'GW.IDEM.MISMATCH', en.apiErrors.idempotencyMismatch]] as const)(
    'rename idempotency texts (%s)', async (status, code, message) => {
      const { save } = rename(); const task = save();
      const req = await request('PATCH', '/users/me');
      req.flush({ code, errors: {} }, { status, statusText: 'Failure' });
      await task; expect(notify.error).toHaveBeenCalledWith(message);
    });

  it('avatar url busts the cache', async () => {
    const f = card(); const first = f.componentInstance['avatarUrl']();
    expect(first).toBe(BASE + '/profile/avatar?v=0');
    let task = upload(f.componentInstance);
    (await request('PUT', '/profile/avatar')).flush(null, { status: 204, statusText: 'No Content' }); await task;
    expect(f.componentInstance['avatarUrl']()).toBe(BASE + '/profile/avatar?v=1');
    vi.spyOn(ConfirmDialog.prototype, 'open').mockResolvedValue(true);
    task = f.componentInstance['requestRemovePhoto']();
    (await request('DELETE', '/profile/avatar')).flush(null, { status: 204, statusText: 'No Content' }); await task;
    expect(f.componentInstance['avatarUrl']()).toBeNull();
    task = upload(f.componentInstance);
    (await request('PUT', '/profile/avatar')).flush(null, { status: 204, statusText: 'No Content' }); await task;
    expect(f.componentInstance['avatarUrl']()).toBe(BASE + '/profile/avatar?v=3');
  });

  it('missing avatar shows initials', () => {
    const f = card(); const image = (f.nativeElement as HTMLElement).querySelector('img')!;
    expect(image.src).toContain('/profile/avatar?v=0'); image.dispatchEvent(new Event('error')); f.detectChanges();
    expect((f.nativeElement as HTMLElement).querySelector('img')).toBeNull();
    expect((f.nativeElement as HTMLElement).textContent).toContain('AL');
  });

  it('avatar upload refreshes', async () => {
    const f = card(); const task = upload(f.componentInstance);
    (await request('PUT', '/profile/avatar')).flush(null, { status: 204, statusText: 'No Content' }); await task;
    expect(session.reloadProfile).toHaveBeenCalledWith(session.requestVersion());
    expect(notify.success).toHaveBeenCalledWith(prefsEn.toast.photoSaved);
  });

  it('avatar upload sends no key', async () => {
    const api = TestBed.inject(PreferencesApi); const file = new File(['png'], 'a.png', { type: 'image/png' });
    const task = api.uploadAvatar(file); const req = await request('PUT', '/profile/avatar');
    expect(req.request.body).toBeInstanceOf(FormData);
    expect((req.request.body as FormData).get('file')).toBe(file);
    expect(req.request.headers.get('x-csrf-token')).toBe('test-csrf');
    expect(req.request.headers.has('x-idempotency-key')).toBe(false);
    expect(req.request.headers.has('Content-Type')).toBe(false); expect(req.request.withCredentials).toBe(true);
    req.flush(null, { status: 204, statusText: 'No Content' }); await task;
  });

  it.each([[413, 'MULTER_GENERIC'], [413, 'PARTY_IMAGE_TOO_LARGE'], [413, 'GW.BODY.TOO_LARGE'], [415, 'PARTY_IMAGE_INVALID']] as const)(
    'avatar too large or invalid field message (%s %s)', async (status, code) => {
      const f = card(); const task = upload(f.componentInstance);
      failure(await request('PUT', '/profile/avatar'), status, code); await task; f.detectChanges();
      expect((f.nativeElement as HTMLElement).querySelector('[role=alert]')?.textContent)
        .toContain(status === 413 ? prefsEn.errors.PARTY_IMAGE_TOO_LARGE : prefsEn.errors.PARTY_IMAGE_INVALID);
      expect(notify.error).not.toHaveBeenCalled();
    });

  it('avatar without party toast', async () => {
    const f = card(); const task = upload(f.componentInstance);
    failure(await request('PUT', '/profile/avatar'), 404, 'PARTY_NOT_FOUND'); await task;
    expect(notify.error).toHaveBeenCalledWith(prefsEn.errors.PARTY_NOT_FOUND);
  });

  it('avatar upload 401 not saved', async () => {
    const f = card(); const task = upload(f.componentInstance);
    failure(await request('PUT', '/profile/avatar'), 401, 'INVALID_CREDENTIALS'); await task;
    expect(notify.error).toHaveBeenCalledWith(prefsEn.errors.notSaved);
  });

  it.each([204, 404])('avatar remove (%s)', async (status) => {
    const f = card(); vi.spyOn(ConfirmDialog.prototype, 'open').mockResolvedValue(true);
    const task = f.componentInstance['requestRemovePhoto'](); const req = await request('DELETE', '/profile/avatar');
    expect(req.request.headers.has('x-idempotency-key')).toBe(false);
    expect(req.request.headers.get('x-csrf-token')).toBe('test-csrf'); expect(req.request.body).toBeNull();
    if (status === 204) req.flush(null, { status, statusText: 'No Content' });
    else failure(req, status, 'PARTY_IMAGE_NOT_FOUND');
    await task; f.detectChanges(); expect((f.nativeElement as HTMLElement).querySelector('img')).toBeNull();
    expect(notify.error).not.toHaveBeenCalled(); expect(session.reloadProfile).toHaveBeenCalled();
  });

  it('client avatar check blocks upload', async () => {
    const f = card();
    await upload(f.componentInstance, new File(['x'], 'a.svg', { type: 'image/svg+xml' }));
    expect(f.componentInstance['avatarError']()).toBe(prefsEn.errors.PARTY_IMAGE_INVALID);
    await upload(f.componentInstance, new File([new Uint8Array(2 * 1024 * 1024 + 1)], 'big.png', { type: 'image/png' }));
    expect(f.componentInstance['avatarError']()).toBe(prefsEn.errors.PARTY_IMAGE_TOO_LARGE);
    http.expectNone(BASE + '/profile/avatar');
  });

  it.each([
    ['en', 'light'], ['en', 'dark'], ['ar', 'light'], ['ar', 'dark'],
  ] as const)('renders translated feedback in %s / %s', async (lang, mode) => {
    language.current.set(lang);
    theme.current.set(mode);
    TestBed.inject(TranslocoService).setActiveLang(lang);
    const f = await page();
    const texts = lang === 'ar' ? prefsAr : prefsEn;
    const root = f.nativeElement as HTMLElement;
    expect(root.textContent).toContain(texts.profile.title);
    expect(root.querySelector('img')?.alt).toBe(texts.profile.photoAlt);
    const c = f.debugElement.query(By.directive(ProfileCard)).componentInstance as ProfileCard;
    await upload(c, new File(['x'], 'invalid.txt', { type: 'text/plain' }));
    f.detectChanges();
    expect(root.querySelector('[role=alert]')?.textContent).toContain(texts.errors.PARTY_IMAGE_INVALID);
    expect(theme.current()).toBe(mode);
    expect(root.querySelectorAll('ui-field label').length).toBe(7);
    expect(root.querySelectorAll('ui-field [data-ui-hint]').length).toBe(7);
  });
});
