import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, FAKE_FAIL, FAKE_NOW } from '../../../../shared/widgets/dashboard/analytics-api';
import { FAKE_PERMISSIONS } from '../../../../shared/widgets/dashboard/analytics-permissions';
import { FAKE_BRANCHES } from '../../../../shared/widgets/dashboard/fake/fake-org';
import { getCalendar, publishCalendar } from './calendars.api';
import {
  DEFAULT_TIME_ZONE,
  DEFAULT_WEEKDAY_MASK,
  PublishWorkingCalendarRequest,
  CALENDAR_TIME_ZONES,
  MAX_WINDOW_LABEL_LENGTH,
  buildWorkingDaysForYear,
  daysInYear,
  isValidIanaTimeZone,
  windowsOverlap,
} from './calendars.model';

/** Runs the fake timers to completion and returns (or rethrows) the settled result. */
async function settle<T>(promise: Promise<T>): Promise<T> {
  const guarded = promise.then(
    (value) => ({ ok: true as const, value }),
    (error: unknown) => ({ ok: false as const, error }),
  );
  await vi.runAllTimersAsync();
  const result = await guarded;
  if (!result.ok) throw result.error;
  return result.value;
}

async function errorOf(promise: Promise<unknown>): Promise<ApiError | undefined> {
  try {
    await settle(promise);
    return undefined;
  } catch (error) {
    return error instanceof ApiError ? error : undefined;
  }
}

/** Runs `work` with the given permission keys removed, then restores them. */
async function withoutPermissions<T>(keys: readonly string[], work: () => Promise<T>): Promise<T> {
  const removed = keys.filter((key) => FAKE_PERMISSIONS.delete(key));
  try {
    return await work();
  } finally {
    for (const key of removed) FAKE_PERMISSIONS.add(key);
  }
}

const CAIRO = FAKE_BRANCHES[0].id;
const ALEX = FAKE_BRANCHES[1].id;
const GIZA = FAKE_BRANCHES[2].id;

function body(year: number, patch: Partial<PublishWorkingCalendarRequest> = {}): PublishWorkingCalendarRequest {
  return {
    expectedRevision: 0,
    workingDays: buildWorkingDaysForYear(year, DEFAULT_WEEKDAY_MASK),
    workdayStartMinute: 540,
    workdayEndMinute: 1020,
    timeZone: DEFAULT_TIME_ZONE,
    windows: [],
    ...patch,
  };
}

describe('calendars contract (crm dashboards working-calendars)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    FAKE_FAIL.nextCall = false;
    vi.useRealTimers();
  });

  describe('GET targets/working-calendars/:branchId/:year', () => {
    it('returns the bare WorkingCalendar body of a published calendar', async () => {
      const calendar = await settle(getCalendar(CAIRO, 2026));
      expect(calendar).toEqual({
        branchId: CAIRO,
        calendarYear: 2026,
        revision: 2,
        workingDays: expect.stringMatching(/^[01]{365}$/),
        publishedAt: '2026-01-05T08:00:00.000Z',
        workdayStartMinute: 540,
        workdayEndMinute: 1020,
        timeZone: 'Africa/Cairo',
        windows: [
          {
            windowNo: 1,
            layer: 1,
            validFrom: '2026-02-18',
            validTo: '2026-03-19',
            weekdayMask: DEFAULT_WEEKDAY_MASK,
            startMinute: 540,
            endMinute: 870,
            label: 'Ramadan hours',
          },
        ],
      });
      expect(calendar).not.toHaveProperty('data');
    });

    it('returns a copy, so editing the result never changes the store', async () => {
      const first = await settle(getCalendar(CAIRO, 2026));
      first.windows.length = 0;
      first.revision = 99;
      const second = await settle(getCalendar(CAIRO, 2026));
      expect(second.revision).toBe(2);
      expect(second.windows).toHaveLength(1);
    });

    it('answers a year with no calendar with revision 0 and no publish time', async () => {
      const calendar = await settle(getCalendar(GIZA, 2027));
      expect(calendar.branchId).toBe(GIZA);
      expect(calendar.calendarYear).toBe(2027);
      expect(calendar.revision).toBe(0);
      expect(calendar.publishedAt).toBeNull();
      expect(calendar.windows).toEqual([]);
    });

    // Backend WorkingCalendarService.view: workingDays, hours and timeZone are null until the first publish.
    it('an unpublished calendar has null workingDays, hours and timeZone', async () => {
      const calendar = await settle(getCalendar(GIZA, 2025));
      expect(calendar.workingDays).toBeNull();
      expect(calendar.workdayStartMinute).toBeNull();
      expect(calendar.workdayEndMinute).toBeNull();
      expect(calendar.timeZone).toBeNull();
    });

    it('accepts any year from 2000 through 2100 and rejects others in the ValidationPipe (400 year: matches)', async () => {
      const far = await settle(getCalendar(CAIRO, 2031));
      expect(far.revision).toBe(0);
      const year = await errorOf(getCalendar(CAIRO, 1999));
      expect(year?.status).toBe(400);
      expect(year?.code).toBe('CRM_VALIDATION_FAILED');
      expect(year?.details).toEqual({ year: ['matches'] });
    });

    it('answers a branch the actor cannot reach with 403 BRANCH_PERMISSION_DENIED', async () => {
      const error = await errorOf(getCalendar('01934b10-0000-7000-8000-0000000009ff', 2026));
      expect(error?.status).toBe(403);
      expect(error?.code).toBe('BRANCH_PERMISSION_DENIED');
    });

    // Backend DashboardWorkingCalendarParamsDto: branchId is @IsUUID('7'), so the ValidationPipe answers first.
    it('a malformed branch id is 400 CRM_VALIDATION_FAILED keyed by branchId', async () => {
      const error = await errorOf(getCalendar('not-a-uuid', 2026));
      expect(error?.status).toBe(400);
      expect(error?.code).toBe('CRM_VALIDATION_FAILED');
      expect(Object.keys(error?.details ?? {})).toEqual(['branchId']);
    });

    it('needs crm.targets.read or crm.sla.manage (403)', async () => {
      const error = await withoutPermissions(['crm.targets.read.all', 'crm.sla.manage'], () =>
        errorOf(getCalendar(CAIRO, 2026)),
      );
      expect(error?.status).toBe(403);
    });

    // Backend assertBranchGrant throws 403 BRANCH_PERMISSION_DENIED.
    it('a missing branch grant is 403 BRANCH_PERMISSION_DENIED', async () => {
      const error = await withoutPermissions(['crm.targets.read.all', 'crm.sla.manage'], () =>
        errorOf(getCalendar(CAIRO, 2026)),
      );
      expect(error?.code).toBe('BRANCH_PERMISSION_DENIED');
    });

    it('passes a gateway 503 through', async () => {
      FAKE_FAIL.nextCall = true;
      const error = await errorOf(getCalendar(CAIRO, 2026));
      expect(error?.status).toBe(503);
      expect(error?.code).toBe('GW.UPSTREAM.UNAVAILABLE');
    });
  });

  describe('POST targets/working-calendars/:branchId/:year', () => {
    it('publishes the first revision and returns the bare saved calendar', async () => {
      const saved = await settle(
        publishCalendar(GIZA, 2026, body(2026, {
          timeZone: 'Africa/Cairo',
          windows: [
            {
              layer: 2,
              validFrom: '2026-03-01',
              validTo: '2026-03-31',
              weekdayMask: 3,
              startMinute: 600,
              endMinute: 900,
              label: '  Spring  ',
            },
          ],
        })),
      );
      expect(saved).toEqual({
        branchId: GIZA,
        calendarYear: 2026,
        revision: 1,
        workingDays: buildWorkingDaysForYear(2026, DEFAULT_WEEKDAY_MASK),
        publishedAt: FAKE_NOW,
        workdayStartMinute: 540,
        workdayEndMinute: 1020,
        timeZone: 'Africa/Cairo',
        windows: [
          {
            windowNo: 1,
            layer: 2,
            validFrom: '2026-03-01',
            validTo: '2026-03-31',
            weekdayMask: 3,
            startMinute: 600,
            endMinute: 900,
            label: 'Spring',
          },
        ],
      });

      const reread = await settle(getCalendar(GIZA, 2026));
      expect(reread).toEqual(saved);
    });

    it('needs the hours and zone with any window (422 CRM_CALENDAR_HOURS_INVALID)', async () => {
      const error = await errorOf(
        publishCalendar(GIZA, 2025, {
          expectedRevision: 0,
          workingDays: '1'.repeat(daysInYear(2025)),
          windows: [{ layer: 1, validFrom: '2025-01-01', validTo: '2025-01-31', weekdayMask: 1, startMinute: 0, endMinute: 60 }],
        }),
      );
      expect(error?.status).toBe(422);
      expect(error?.code).toBe('CRM_CALENDAR_HOURS_INVALID');

      const partial = await errorOf(
        publishCalendar(GIZA, 2025, { expectedRevision: 0, workingDays: '1'.repeat(daysInYear(2025)), workdayStartMinute: 540 }),
      );
      expect(partial?.code).toBe('CRM_CALENDAR_HOURS_INVALID');
    });

    it('stores null hours for a first day-only publish', async () => {
      const saved = await settle(
        publishCalendar(GIZA, 2025, { expectedRevision: 0, workingDays: '1'.repeat(daysInYear(2025)) }),
      );
      expect(saved.revision).toBe(1);
      expect(saved.workdayStartMinute).toBeNull();
      expect(saved.workdayEndMinute).toBeNull();
      expect(saved.timeZone).toBeNull();
      expect(saved.windows).toEqual([]);
    });

    it('carries the head hours, zone and windows over a day-only publish', async () => {
      const head = await settle(getCalendar(CAIRO, 2026));
      const saved = await settle(
        publishCalendar(CAIRO, 2026, { expectedRevision: head.revision, workingDays: head.workingDays! }),
      );
      expect(saved.revision).toBe(head.revision + 1);
      expect(saved.workdayStartMinute).toBe(head.workdayStartMinute);
      expect(saved.timeZone).toBe(head.timeZone);
      expect(saved.windows).toEqual(head.windows);

      const cleared = await settle(
        publishCalendar(CAIRO, 2026, { expectedRevision: saved.revision, workingDays: head.workingDays!, windows: [] }),
      );
      expect(cleared.timeZone).toBe(head.timeZone);
      expect(cleared.windows).toEqual([]);
    });

    it('rejects a blank window label with 422 CRM_WORKING_CALENDAR_INVALID', async () => {
      const error = await errorOf(
        publishCalendar(GIZA, 2027, body(2027, {
          windows: [{ layer: 1, validFrom: '2027-01-01', validTo: '2027-01-31', weekdayMask: 1, startMinute: 0, endMinute: 60, label: '   ' }],
        })),
      );
      expect(error?.code).toBe('CRM_WORKING_CALENDAR_INVALID');
    });

    it('rejects a layer over 9 and a window outside the calendar year', async () => {
      const layer = await errorOf(
        publishCalendar(GIZA, 2027, body(2027, {
          windows: [{ layer: 10, validFrom: '2027-01-01', validTo: '2027-01-31', weekdayMask: 1, startMinute: 0, endMinute: 60 }],
        })),
      );
      expect(layer?.code).toBe('CRM_WORKING_CALENDAR_INVALID');
      const outside = await errorOf(
        publishCalendar(GIZA, 2027, body(2027, {
          windows: [{ layer: 1, validFrom: '2026-12-31', validTo: '2027-01-31', weekdayMask: 1, startMinute: 0, endMinute: 60 }],
        })),
      );
      expect(outside?.code).toBe('CRM_WORKING_CALENDAR_INVALID');
    });

    it('rejects UTC, Etc/ and padded zones, and a zone change for the branch', async () => {
      for (const timeZone of ['UTC', 'Etc/GMT+2', ' Africa/Cairo ']) {
        const error = await errorOf(publishCalendar(GIZA, 2027, body(2027, { timeZone })));
        expect(error?.code).toBe('CRM_CALENDAR_TIME_ZONE_INVALID');
      }
      const head = await settle(getCalendar(ALEX, 2026));
      const changed = await errorOf(
        publishCalendar(ALEX, 2027, body(2027, { expectedRevision: 0, timeZone: 'Asia/Riyadh' })),
      );
      expect(changed?.status).toBe(422);
      expect(changed?.code).toBe('CRM_CALENDAR_TIME_ZONE_INVALID');
      expect(head.timeZone).toBe('Africa/Cairo');
    });

    it('runs the ValidationPipe first, then the body checks, then the branch grant', async () => {
      const unknown = '01934b10-0000-7000-8000-0000000009ff';
      const pipe = await errorOf(publishCalendar(unknown, 2027, body(2027, { workingDays: 'abc', expectedRevision: -1 })));
      expect(pipe?.status).toBe(400);
      expect(pipe?.details).toEqual({ expectedRevision: ['min'], workingDays: ['matches'] });

      const service = await errorOf(publishCalendar(unknown, 2027, body(2027, { workdayStartMinute: 900, workdayEndMinute: 600 })));
      expect(service?.code).toBe('CRM_CALENDAR_HOURS_INVALID');

      const grant = await errorOf(publishCalendar(unknown, 2027, body(2027)));
      expect(grant?.status).toBe(403);
      expect(grant?.code).toBe('BRANCH_PERMISSION_DENIED');
    });

    it('keys nested window errors by path', async () => {
      const error = await errorOf(
        publishCalendar(GIZA, 2027, body(2027, {
          windows: [
            { layer: 1, validFrom: '2027-01-01', validTo: '2027-01-02', weekdayMask: 1, startMinute: 0, endMinute: 60 },
            { layer: 1.5, validFrom: '2027/01/01', validTo: '2027-01-02', weekdayMask: 1, startMinute: 0, endMinute: 60 },
          ],
        })),
      );
      expect(error?.details).toEqual({ 'windows.1.layer': ['is_int'], 'windows.1.validFrom': ['matches'] });
    });

    it('answers a stale expectedRevision with 409 CRM_WORKING_CALENDAR_REVISION_CONFLICT and no details', async () => {
      const error = await errorOf(publishCalendar(ALEX, 2026, body(2026, { expectedRevision: 0 })));
      expect(error?.status).toBe(409);
      expect(error?.code).toBe('CRM_WORKING_CALENDAR_REVISION_CONFLICT');
      expect(error?.details).toBeUndefined();

      const current = await settle(getCalendar(ALEX, 2026));
      const saved = await settle(publishCalendar(ALEX, 2026, body(2026, { expectedRevision: current.revision })));
      expect(saved.revision).toBe(current.revision + 1);
    });

    it('rejects a wrong day count for the year with 422 CRM_WORKING_CALENDAR_INVALID', async () => {
      const error = await errorOf(publishCalendar(GIZA, 2027, body(2027, { workingDays: '1'.repeat(366) })));
      expect(error?.status).toBe(422);
      expect(error?.code).toBe('CRM_WORKING_CALENDAR_INVALID');
    });

    it('rejects bad hours with 422 CRM_CALENDAR_HOURS_INVALID', async () => {
      const reversed = await errorOf(
        publishCalendar(GIZA, 2027, body(2027, { workdayStartMinute: 900, workdayEndMinute: 600 })),
      );
      expect(reversed?.status).toBe(422);
      expect(reversed?.code).toBe('CRM_CALENDAR_HOURS_INVALID');

      const window = await errorOf(
        publishCalendar(GIZA, 2027, body(2027, {
          windows: [{ layer: 1, validFrom: '2027-01-01', validTo: '2027-01-02', weekdayMask: 1, startMinute: 0, endMinute: 1441 }],
        })),
      );
      expect(window?.code).toBe('CRM_CALENDAR_HOURS_INVALID');
    });

    it('rejects an unknown time zone with 422 CRM_CALENDAR_TIME_ZONE_INVALID', async () => {
      const error = await errorOf(publishCalendar(GIZA, 2027, body(2027, { timeZone: 'Mars/Olympus' })));
      expect(error?.status).toBe(422);
      expect(error?.code).toBe('CRM_CALENDAR_TIME_ZONE_INVALID');
    });

    it('rejects a bad window range and overlapping windows of one layer', async () => {
      const range = await errorOf(
        publishCalendar(GIZA, 2027, body(2027, {
          windows: [{ layer: 1, validFrom: '2027-02-10', validTo: '2027-02-01', weekdayMask: 1, startMinute: 0, endMinute: 60 }],
        })),
      );
      expect(range?.code).toBe('CRM_WORKING_CALENDAR_INVALID');

      const overlap = await errorOf(
        publishCalendar(GIZA, 2027, body(2027, {
          windows: [
            { layer: 1, validFrom: '2027-02-01', validTo: '2027-02-28', weekdayMask: 1, startMinute: 0, endMinute: 120 },
            { layer: 1, validFrom: '2027-02-15', validTo: '2027-03-15', weekdayMask: 1, startMinute: 60, endMinute: 180 },
          ],
        })),
      );
      expect(overlap?.status).toBe(422);
      expect(overlap?.code).toBe('CRM_CALENDAR_WINDOW_OVERLAP');
    });

    it('needs crm.sla.manage or crm.targets.manage (403)', async () => {
      const error = await withoutPermissions(['crm.sla.manage', 'crm.targets.manage'], () =>
        errorOf(publishCalendar(GIZA, 2027, body(2027))),
      );
      expect(error?.status).toBe(403);
    });

    // Backend PublishDashboardWorkingCalendarDto: workingDays @Matches(/^[01]{365,366}$/).
    it('a malformed workingDays string is 400 CRM_VALIDATION_FAILED keyed by workingDays', async () => {
      const error = await errorOf(publishCalendar(GIZA, 2027, body(2027, { workingDays: 'abc' })));
      expect(error?.status).toBe(400);
      expect(error?.code).toBe('CRM_VALIDATION_FAILED');
      expect(error?.details).toEqual({ workingDays: ['matches'] });
    });

    // Backend WorkingCalendarWindowDto: label @MaxLength(80); the fake allows 120.
    it('a window label over 80 characters is 400 CRM_VALIDATION_FAILED keyed windows.0.label', async () => {
      const error = await errorOf(
        publishCalendar(GIZA, 2027, body(2027, {
          windows: [
            { layer: 1, validFrom: '2027-01-01', validTo: '2027-01-02', weekdayMask: 1, startMinute: 0, endMinute: 60, label: 'x'.repeat(100) },
          ],
        })),
      );
      expect(error?.status).toBe(400);
      expect(error?.code).toBe('CRM_VALIDATION_FAILED');
      expect(error?.details).toEqual({ 'windows.0.label': ['max_length'] });
    });
  });

  describe('model rules shared with the backend', () => {
    it('limits labels to 80 and offers only region zones', () => {
      expect(MAX_WINDOW_LABEL_LENGTH).toBe(80);
      expect(CALENDAR_TIME_ZONES.every((zone) => isValidIanaTimeZone(zone))).toBe(true);
      expect(isValidIanaTimeZone('UTC')).toBe(false);
    });

    it('treats windows as overlapping when masks share a bit, even if that weekday misses the shared dates', () => {
      // 2027-01-03 is a Sunday; the windows share only that date, and the shared mask bit is Monday.
      const a = { layer: 1, validFrom: '2027-01-01', validTo: '2027-01-03', weekdayMask: 2, startMinute: 0, endMinute: 60 };
      const b = { layer: 1, validFrom: '2027-01-03', validTo: '2027-01-10', weekdayMask: 3, startMinute: 30, endMinute: 90 };
      expect(windowsOverlap(a, b)).toBe(true);
      expect(windowsOverlap(a, { ...b, layer: 2 })).toBe(false);
      expect(windowsOverlap(a, { ...b, startMinute: 60 })).toBe(false);
    });
  });
});
