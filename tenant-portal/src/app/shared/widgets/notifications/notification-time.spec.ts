import { describe, expect, it } from 'vitest';
import { dayGroupOf, formatNotificationTime, isJustNow } from './notification-time';
import { entityTypeLabel } from './notifications.model';

describe('notification-time helpers', () => {
  const now = new Date(2026, 10, 22, 14, 30, 0);

  it('classifies ISO timestamps into today, yesterday and earlier by local calendar day', () => {
    const todayMorning = new Date(2026, 10, 22, 0, 5, 0).toISOString();
    const yesterdayLate = new Date(2026, 10, 21, 23, 55, 0).toISOString();
    const twoDaysAgo = new Date(2026, 10, 20, 12, 0, 0).toISOString();

    expect(dayGroupOf(todayMorning, now)).toBe('today');
    expect(dayGroupOf(yesterdayLate, now)).toBe('yesterday');
    expect(dayGroupOf(twoDaysAgo, now)).toBe('earlier');
  });

  it('formats today items as short relative times in English', () => {
    const fiveMinAgo = new Date(now.getTime() - 5 * 60_000).toISOString();
    const twoHoursAgo = new Date(now.getTime() - 125 * 60_000).toISOString();

    expect(formatNotificationTime(fiveMinAgo, 'today', 'en', now.getTime())).toMatch(/5 min/);
    expect(formatNotificationTime(twoHoursAgo, 'today', 'en', now.getTime())).toMatch(/2 hr/);
  });

  it('formats yesterday as HH:mm and earlier with or without date', () => {
    const yesterday = new Date(2026, 10, 21, 9, 5, 0).toISOString();
    const earlier = new Date(2026, 10, 18, 14, 5, 0).toISOString();

    expect(formatNotificationTime(yesterday, 'yesterday', 'en', now.getTime(), false)).toBe('09:05');
    expect(formatNotificationTime(yesterday, 'yesterday', 'en', now.getTime(), true)).toBe('09:05');
    expect(formatNotificationTime(earlier, 'earlier', 'en', now.getTime(), false)).toBe('14:05');

    const withDate = formatNotificationTime(earlier, 'earlier', 'en', now.getTime(), true);
    expect(withDate).toContain('14:05');
    expect(withDate).toContain('18');
  });

  it('always uses Latin digits in Arabic', () => {
    const fiveMinAgo = new Date(now.getTime() - 5 * 60_000).toISOString();
    const yesterday = new Date(2026, 10, 21, 16, 45, 0).toISOString();
    const earlier = new Date(2026, 10, 18, 14, 5, 0).toISOString();

    for (const label of [
      formatNotificationTime(fiveMinAgo, 'today', 'ar', now.getTime(), true),
      formatNotificationTime(yesterday, 'yesterday', 'ar', now.getTime(), true),
      formatNotificationTime(earlier, 'earlier', 'ar', now.getTime(), false),
      formatNotificationTime(earlier, 'earlier', 'ar', now.getTime(), true),
    ]) {
      expect(label).toMatch(/[0-9]/);
      expect(label).not.toMatch(/[\u0660-\u0669]/);
    }
  });

  it('reads "just now" for under a minute only', () => {
    expect(isJustNow(new Date(now.getTime() - 59_000).toISOString(), now.getTime())).toBe(true);
    expect(isJustNow(new Date(now.getTime() - 60_000).toISOString(), now.getTime())).toBe(false);
  });

  it('maps entityType spellings to a label key and falls back to record', () => {
    expect(entityTypeLabel('Lead')).toBe('lead');
    expect(entityTypeLabel('activity')).toBe('activity');
    expect(entityTypeLabel('CustomerProfile')).toBe('customer');
    expect(entityTypeLabel('customer_profile')).toBe('customer');
    expect(entityTypeLabel('acc_exception_board_items')).toBe('record');
    expect(entityTypeLabel('constructor')).toBe('record');
  });
});
