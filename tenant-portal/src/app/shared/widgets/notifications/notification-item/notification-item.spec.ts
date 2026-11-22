import { Component, Injectable, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TranslocoLoader, type Translation, provideTransloco } from '@jsverse/transloco';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it } from 'vitest';
import en from '../../../../../../public/i18n/en.json';
import wsEn from '../../../../../../public/i18n/ws-notifications/en.json';
import { Language, LanguageState } from '../../../../core/i18n/language';
import { NotificationView } from '../notifications.model';
import { NotificationItem } from './notification-item';

@Injectable()
class TestLoader implements TranslocoLoader {
  getTranslation(path: string) {
    if (path === 'en') return of(en as Translation);
    if (path === 'ws-notifications/en') return of(wsEn as Translation);
    return of({});
  }
}

function makeItem(overrides: Partial<NotificationView> = {}): NotificationView {
  return {
    id: '019a7c10-0001-7000-8000-000000000001',
    recipientId: '019a7c30-0001-7000-8000-000000000001',
    sourceApp: 'CORE',
    notificationType: 'core.activity.reminder',
    priority: 'P1_HIGH',
    title: 'Follow-up call due',
    body: 'Call Horizon Retail at 15:00.',
    actionUrl: null,
    entityType: 'Activity',
    entityId: '019a7c20-0001-7000-8000-000000000001',
    channels: ['IN_APP'],
    metadata: {},
    createdAt: new Date(Date.now() - 5 * 60_000).toISOString(),
    readAt: null,
    acknowledgedAt: null,
    deliveredAt: new Date(Date.now() - 5 * 60_000).toISOString(),
    recipientStateVersion: 1,
    ...overrides,
  };
}

@Component({
  imports: [NotificationItem],
  template: `
    <app-notification-item
      [item]="item()"
      [timeLabel]="'5 min ago'"
      [showAcknowledge]="showAcknowledge()"
      (opened)="openedCount = openedCount + 1"
      (acknowledged)="acknowledgedCount = acknowledgedCount + 1"
      (dismissed)="dismissedCount = dismissedCount + 1"
    />
  `,
})
class Host {
  readonly item = signal<NotificationView>(makeItem());
  readonly showAcknowledge = signal(false);
  openedCount = 0;
  acknowledgedCount = 0;
  dismissedCount = 0;
}

describe('NotificationItem', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        { provide: LanguageState, useValue: { current: signal<Language>('en') } },
        provideTransloco({ config: { availableLangs: ['en'], defaultLang: 'en' }, loader: TestLoader }),
      ],
    });
  });

  function setup(item = makeItem(), showAcknowledge = false) {
    const fixture = TestBed.createComponent(Host);
    fixture.componentInstance.item.set(item);
    fixture.componentInstance.showAcknowledge.set(showAcknowledge);
    fixture.detectChanges();
    return {
      fixture,
      host: fixture.componentInstance,
      el: fixture.nativeElement as HTMLElement,
    };
  }

  it('shows unread tint and dot only when readAt is null', () => {
    const { fixture, host, el } = setup(makeItem({ readAt: null }));
    const row = el.querySelector('app-notification-item > div')!;
    expect(row.className).toContain('bg-brand-soft');
    expect(el.querySelector('.size-unread-dot')).not.toBeNull();

    host.item.set(makeItem({ readAt: new Date().toISOString() }));
    fixture.detectChanges();
    expect(row.className).toContain('hover:bg-row-hover');
    expect(row.className).not.toContain('bg-brand-soft');
    expect(el.querySelector('.size-unread-dot')).toBeNull();
  });

  it('renders Acknowledge only when showAcknowledge is true and acknowledgedAt is null', () => {
    const { fixture, host, el } = setup(makeItem({ acknowledgedAt: null }), false);
    expect(el.textContent).not.toContain('Acknowledge');

    host.showAcknowledge.set(true);
    fixture.detectChanges();
    const ackBtn = Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.includes('Acknowledge'));
    expect(ackBtn).toBeDefined();

    host.item.set(makeItem({ acknowledgedAt: new Date().toISOString() }));
    fixture.detectChanges();
    expect(Array.from(el.querySelectorAll('button')).some((b) => b.textContent?.includes('Acknowledge'))).toBe(false);
    expect(el.textContent).toContain(wsEn.acknowledgedJustNow);
  });

  it('emits opened, acknowledged and dismissed cleanly in reading order', () => {
    const { host, el } = setup(makeItem(), true);
    const buttons = Array.from(el.querySelectorAll('button'));
    expect(buttons).toHaveLength(3);
    expect(buttons[0].textContent).toContain('Follow-up call due');
    expect(buttons[1].textContent).toContain('Acknowledge');
    expect(buttons[2].getAttribute('aria-label')).toBe('Dismiss notification');

    buttons[0].click();
    expect(host.openedCount).toBe(1);
    expect(host.acknowledgedCount).toBe(0);
    expect(host.dismissedCount).toBe(0);

    buttons[1].click();
    expect(host.acknowledgedCount).toBe(1);
    expect(host.openedCount).toBe(1);

    buttons[2].click();
    expect(host.dismissedCount).toBe(1);
    expect(host.openedCount).toBe(1);
  });
});
