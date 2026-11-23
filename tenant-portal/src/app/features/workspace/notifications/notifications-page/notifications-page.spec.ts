import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component, Injectable, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import {
  TranslocoLoader,
  provideTransloco,
  provideTranslocoScope,
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
import {
  fakeListNotifications,
  resetFakeNotifications,
} from '../../../../shared/widgets/notifications/notifications.fake';
import { NotificationsPage } from './notifications-page';

const settle = async () => {
  for (let i = 0; i < 25; i++) await Promise.resolve();
};
const BASE = '/api/tenant/core/v1/notifications';

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

@Component({ template: '' })
class Target {}

describe('Workspace notifications page', () => {
  let http: HttpTestingController;
  let params: BehaviorSubject<ReturnType<typeof convertToParamMap>>;
  const notify = { error: vi.fn(), connectionLost: vi.fn(), connectionRestored: vi.fn() };

  beforeEach(() => {
    resetFakeNotifications();
    vi.clearAllMocks();
    params = new BehaviorSubject(convertToParamMap({}));
    document.cookie = 'mutakamel-http-tenant-csrf=csrf; path=/';
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([{ path: 'crm/leads', component: Target }]),
        provideTransloco({
          config: { availableLangs: ['en', 'ar'], defaultLang: 'en', reRenderOnLangChange: true },
          loader: Loader,
        }),
        provideTranslocoScope({ scope: 'ws-notifications', alias: 'wsNotif' }),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: params.value }, queryParamMap: params },
        },
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
  });

  async function setup(empty = false) {
    const snapshot = await fakeListNotifications();
    const fixture = TestBed.createComponent(NotificationsPage);
    fixture.detectChanges();
    http
      .expectOne((r) => r.url === BASE)
      .flush({ success: true, data: { ...snapshot, items: empty ? [] : snapshot.items } });
    await settle();
    await fixture.whenStable();
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement, snapshot };
  }

  it('shows All and Unread, switches with a server filter, and renders the empty state', async () => {
    const { fixture, el, snapshot } = await setup();
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const tabs = el.querySelectorAll<HTMLButtonElement>('[role="tab"]');
    expect(tabs).toHaveLength(2);
    expect(tabs[1].textContent).toContain(String(snapshot.unreadCount));
    tabs[1].click();
    http
      .expectOne((r) => r.url === BASE && r.params.get('unreadOnly') === 'true')
      .flush({ success: true, data: { ...snapshot, items: [] } });
    await settle();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(el.textContent).toContain(en.notifications.emptyUnread);
    expect(navigate).toHaveBeenCalled();
  });

  it('renders the no-notifications state', async () => {
    const { el } = await setup(true);
    expect(el.textContent).toContain(en.notifications.empty);
  });

  it('shows load-failure with Retry and the unavailable state', async () => {
    const fixture = TestBed.createComponent(NotificationsPage);
    fixture.detectChanges();
    http.expectOne((r) => r.url === BASE).flush({}, { status: 500, statusText: 'Server error' });
    await settle();
    await fixture.whenStable();
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain(wsEn.loadFailed.title);
    const retry = Array.from(el.querySelectorAll<HTMLButtonElement>('ui-full-state button')).find(
      (b) => b.textContent?.trim() === wsEn.retry,
    )!;
    retry.click();
    http
      .expectOne((r) => r.url === BASE)
      .flush(
        { errorCode: 'NOTIFICATION_USER_NOT_FOUND' },
        { status: 404, statusText: 'Not found' },
      );
    await settle();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(el.textContent).toContain(wsEn.unavailable.title);
  });

  it('routes an unlinked item to detail and follows a registered action route', async () => {
    const { el, fixture, snapshot } = await setup();
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    const navigateByUrl = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    const noLink = snapshot.items.find((row) => row.actionUrl === null && row.readAt !== null)!;
    const index = snapshot.items.indexOf(noLink);
    el.querySelectorAll('app-notification-item')
      [index].querySelector<HTMLButtonElement>('button')!
      .click();
    await settle();
    await fixture.whenStable();
    expect(navigate).toHaveBeenCalledWith([noLink.id], expect.anything());
    const linked = snapshot.items.find((row) => row.actionUrl === '/crm/leads')!;
    const row = el.querySelectorAll('app-notification-item')[snapshot.items.indexOf(linked)];
    row.querySelector<HTMLButtonElement>('button')!.click();
    http
      .expectOne(BASE + '/' + linked.id + '/read')
      .flush(null, { status: 204, statusText: 'No content' });
    await settle();
    await fixture.whenStable();
    http.expectOne(BASE + '/unread-count').flush({ success: true, data: { unreadCount: 3 } });
    await settle();
    await fixture.whenStable();
    expect(navigateByUrl).toHaveBeenCalledWith('/crm/leads');
  });

  it('shows notSaved on a 401 write without navigation', async () => {
    const { fixture, el, snapshot } = await setup();
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    el.querySelector<HTMLButtonElement>(
      'app-notification-item button[aria-label="' + en.notifications.actions.dismiss + '"]',
    )!.click();
    http
      .expectOne(BASE + '/' + snapshot.items[0].id)
      .flush({ code: 'GW.AUTH.UNAUTHORIZED' }, { status: 401, statusText: 'Unauthorized' });
    await settle();
    await fixture.whenStable();
    expect(notify.error).toHaveBeenCalledWith(wsEn.errors.notSaved);
    expect(navigate).not.toHaveBeenCalled();
  });
});
