import { InjectionToken } from '@angular/core';

/** Source of "now" for the date range when no `today` input is given. Defaults to the real clock. */
export const DATE_RANGE_NOW = new InjectionToken<() => Date>('DATE_RANGE_NOW', {
  providedIn: 'root',
  factory: () => () => new Date(),
});
