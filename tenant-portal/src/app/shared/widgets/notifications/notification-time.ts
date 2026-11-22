import { NotificationDayGroup } from './notifications.model';

const MS_PER_DAY = 86_400_000;
const MS_PER_MINUTE = 60_000;

export function dayGroupOf(iso: string, now: Date): NotificationDayGroup {
  const date = new Date(iso);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfItem = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const diffDays = Math.round((startOfToday - startOfItem) / MS_PER_DAY);
  if (diffDays <= 0) return 'today';
  if (diffDays === 1) return 'yesterday';
  return 'earlier';
}

/** True while less than a minute has passed since `iso`, so a label can read "just now". */
export function isJustNow(iso: string, now: number): boolean {
  return now - new Date(iso).getTime() < MS_PER_MINUTE;
}

export function formatNotificationTime(
  iso: string,
  group: NotificationDayGroup,
  lang: string,
  now: number,
  withDate = false,
): string {
  const locale = `${lang}-u-nu-latn`;
  const date = new Date(iso);
  if (group === 'today') {
    const minutes = Math.max(1, Math.floor((now - date.getTime()) / MS_PER_MINUTE));
    const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'always', style: 'short' });
    return minutes < 60 ? rtf.format(-minutes, 'minute') : rtf.format(-Math.floor(minutes / 60), 'hour');
  }
  if (group === 'earlier' && withDate) {
    return new Intl.DateTimeFormat(locale, {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(date);
  }
  return new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit', hour12: false }).format(date);
}
