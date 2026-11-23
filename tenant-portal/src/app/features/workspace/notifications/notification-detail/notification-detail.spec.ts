import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Injectable, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import {
  TranslocoLoader,
  TranslocoService,
  provideTransloco,
  type Translation,
} from '@jsverse/transloco';
import { BehaviorSubject, of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import en from '../../../../../../public/i18n/en.json';
import ar from '../../../../../../public/i18n/ar.json';
import wsEn from '../../../../../../public/i18n/ws-notifications/en.json';
import wsAr from '../../../../../../public/i18n/ws-notifications/ar.json';
import { Notify } from '../../../../core/notify/notify';
import { NotificationsFeed } from '../../../../core/realtime/notifications-feed';
import { NotificationInbox } from '../../../../shared/widgets/notifications/notification-inbox';
import {
  fakeListNotifications,
  resetFakeNotifications,
} from '../../../../shared/widgets/notifications/notifications.fake';
import { NotificationDetail } from './notification-detail';

const settle = async () => {
  for (let i = 0; i < 25; i++) await Promise.resolve();
};
const BASE = '/api/tenant/core/v1/notifications';
const ID = '019a7c10-0004-7000-8000-000000000004';

@Injectable()
class Loader implements TranslocoLoader {
  getTranslation(path: string) {
    return of(
      (
        { en, ar, 'ws-notifications/en': wsEn, 'ws-notifications/ar': wsAr } as Record<
          string,
          Translation
        >
      )[path] ?? {},
    );
  }
}

const originalShow = HTMLDialogElement.prototype.showModal;
const originalClose = HTMLDialogElement.prototype.close;

describe('NotificationDetail on CoreHttp', () => {
  let http: HttpTestingController;
  let params: BehaviorSubject<ReturnType<typeof convertToParamMap>>;
  const notify = { error: vi.fn(), connectionLost: vi.fn(), connectionRestored: vi.fn() };

  beforeEach(() => {
    resetFakeNotifications();
    params = new BehaviorSubject(convertToParamMap({ id: ID }));
    vi.clearAllMocks();
    document.cookie = 'mutakamel-http-tenant-csrf=csrf; path=/';
    HTMLDialogElement.prototype.showModal = function () {
      this.setAttribute('open', '');
    };
    HTMLDialogElement.prototype.close = function () {
      this.removeAttribute('open');
      this.dispatchEvent(new Event('close'));
    };
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        NotificationInbox,
        provideTransloco({
          config: { availableLangs: ['en', 'ar'], defaultLang: 'en', reRenderOnLangChange: true },
          loader: Loader,
        }),
        { provide: ActivatedRoute, useValue: { paramMap: params } },
        { provide: Notify, useValue: notify },
        {
          provide: NotificationsFeed,
          useValue: { unread: signal(null), onEvent: () => () => undefined },
        },
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => {
    http.verify();
    document.cookie = 'mutakamel-http-tenant-csrf=; Max-Age=0; path=/';
    HTMLDialogElement.prototype.showModal = originalShow;
    HTMLDialogElement.prototype.close = originalClose;
  });

  async function setup() {
    const snapshot = await fakeListNotifications();
    const fixture = TestBed.createComponent(NotificationDetail);
    fixture.detectChanges();
    http
      .expectOne((r) => r.url === BASE)
      .flush({ success: true, data: { ...snapshot, items: [] } });
    return {
      fixture,
      el: fixture.nativeElement as HTMLElement,
      item: snapshot.items.find((row) => row.id === ID)!,
    };
  }

  it.each([200, 404, 500, 0])('notification detail states (%s)', async (status) => {
    const { fixture, el, item } = await setup();
    const request = http.expectOne(BASE + '/' + ID);
    if (status === 200) {
      request.flush({ success: true, data: item });
      await settle();
      await fixture.whenStable();
      fixture.detectChanges();
      http
        .expectOne(BASE + '/' + ID + '/read')
        .flush(null, { status: 204, statusText: 'No content' });
      await settle();
      await fixture.whenStable();
      http.expectOne(BASE + '/unread-count').flush({ success: true, data: { unreadCount: 3 } });
      await settle();
      await fixture.whenStable();
      fixture.detectChanges();
      expect(el.querySelector('dialog[open]')?.textContent).toContain(item.title);
      expect(el.querySelector('dialog[open]')?.textContent).toContain(item.body);
      TestBed.inject(TranslocoService).setActiveLang('ar');
      await settle();
      await fixture.whenStable();
      fixture.detectChanges();
      http.expectNone(BASE + '/' + ID);
      expect(el.textContent).toContain(item.title);
    } else {
      if (status)
        request.flush(
          {
            errorCode: status === 404 ? 'NOTIFICATION_NOT_FOUND' : 'COMMON.GENERIC.INTERNAL_ERROR',
          },
          { status, statusText: 'Failure' },
        );
      else request.error(new ProgressEvent('error'));
      await settle();
      await fixture.whenStable();
      fixture.detectChanges();
      expect(el.querySelector('ui-full-state')).not.toBeNull();
      expect(el.textContent).toContain(
        status === 404 ? en.errors.notFound.title : wsEn.loadFailed.title,
      );
      expect(el.querySelector('dialog[open]')).toBeNull();
      if (status === 404) {
        const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
        el.querySelector<HTMLButtonElement>('ui-full-state button')!.click();
        expect(navigate).toHaveBeenCalledWith('/workspace/home');
      } else {
        if (!status) expect(notify.connectionLost).toHaveBeenCalledOnce();
        el.querySelector<HTMLButtonElement>('ui-full-state button')!.click();
        http
          .expectOne(BASE + '/' + ID)
          .flush({ success: true, data: { ...item, readAt: item.createdAt } });
        await settle();
        await fixture.whenStable();
        fixture.detectChanges();
        expect(el.querySelector('dialog[open]')?.textContent).toContain(item.title);
      }
    }
  });

  it('keeps user-missing as unavailable rather than a record 404', async () => {
    const { fixture, el } = await setup();
    http
      .expectOne(BASE + '/' + ID)
      .flush(
        { errorCode: 'NOTIFICATION_USER_NOT_FOUND' },
        { status: 404, statusText: 'Not found' },
      );
    await settle();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(el.textContent).toContain(wsEn.unavailable.title);
  });

  it('rejects a non-v7 id without a detail request', async () => {
    params.next(convertToParamMap({ id: ID.replace('-7000-', '-4000-') }));
    const { fixture, el } = await setup();
    await settle();
    await fixture.whenStable();
    fixture.detectChanges();
    http.expectNone(BASE + '/' + ID.replace('-7000-', '-4000-'));
    expect(el.textContent).toContain(en.errors.notFound.title);
  });
  it.each([
    ['en', 'light'],
    ['en', 'dark'],
    ['ar', 'light'],
    ['ar', 'dark'],
  ])('renders the approved failure state in %s %s', async (lang, theme) => {
    const previousTheme = document.documentElement.dataset['theme'];
    const previousDirection = document.documentElement.dir;
    document.documentElement.dataset['theme'] = theme;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    TestBed.inject(TranslocoService).setTranslation({ ...en, wsNotif: wsEn }, 'en');
    TestBed.inject(TranslocoService).setTranslation({ ...ar, wsNotif: wsAr }, 'ar');
    TestBed.inject(TranslocoService).setActiveLang(lang);
    try {
      const { fixture, el } = await setup();
      TestBed.inject(TranslocoService).setActiveLang(lang);
      http.expectOne(BASE + '/' + ID).flush({}, { status: 500, statusText: 'Server error' });
      await settle();
      await fixture.whenStable();
      fixture.detectChanges();
      const dict = lang === 'ar' ? wsAr : wsEn;
      expect(el.textContent).toContain(dict.loadFailed.title);
      expect(el.querySelector<HTMLButtonElement>('ui-full-state button')?.textContent).toContain(
        dict.retry,
      );
    } finally {
      if (previousTheme === undefined) delete document.documentElement.dataset['theme'];
      else document.documentElement.dataset['theme'] = previousTheme;
      document.documentElement.dir = previousDirection;
    }
  });
});
