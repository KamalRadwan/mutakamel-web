import { DOCUMENT } from '@angular/common';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CrmHttp, bindCrmHttpForTest, crmQueries } from '../../shared/crm-http';
import { getCalendar, publishCalendar } from './calendars.api';
import {
  CALENDAR_TIME_ZONES,
  DEFAULT_WEEKDAY_MASK,
  MAX_WINDOW_LABEL_LENGTH,
  buildWorkingDaysForYear,
  daysInYear,
  isValidIanaTimeZone,
  windowsOverlap,
  type PublishWorkingCalendarRequest,
} from './calendars.model';

const BRANCH = '01934b10-0000-7000-8000-000000000901';
const uuidV7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
function body(year = 2026): PublishWorkingCalendarRequest {
  return {
    expectedRevision: 0,
    workingDays: buildWorkingDaysForYear(year, DEFAULT_WEEKDAY_MASK),
    workdayStartMinute: 540,
    workdayEndMinute: 1020,
    timeZone: 'Asia/Riyadh',
    windows: [],
  };
}

// Replaces fake-store/permission/validation assertions with the real HTTP boundary.
for (const language of ['en', 'ar'])
  for (const theme of ['light', 'dark']) {
    describe(`CalendarsApi (${language}, ${theme})`, () => {
      let http: HttpTestingController;
      let dispose: () => void;
      const url = (year = 2026) => `/api/tenant/crm/v1/targets/working-calendars/${BRANCH}/${year}`;
      beforeEach(() => {
        TestBed.configureTestingModule({
          providers: [provideHttpClient(), provideHttpClientTesting()],
        });
        const doc = TestBed.inject(DOCUMENT);
        doc.documentElement.lang = language;
        doc.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
        doc.documentElement.setAttribute('data-theme', theme);
        const name =
          doc.location.protocol === 'https:'
            ? '__Host-mutakamel-tenant-csrf'
            : 'mutakamel-http-tenant-csrf';
        vi.spyOn(doc, 'cookie', 'get').mockReturnValue(`${name}=csrf-calendars`);
        dispose = bindCrmHttpForTest(TestBed.inject(CrmHttp));
        http = TestBed.inject(HttpTestingController);
      });
      afterEach(() => {
        http.verify();
        crmQueries().clear();
        dispose();
        vi.restoreAllMocks();
        document.documentElement.removeAttribute('lang');
        document.documentElement.removeAttribute('dir');
        document.documentElement.removeAttribute('data-theme');
      });

      it('sends no scope headers', async () => {
        const read = getCalendar(BRANCH, 2026);
        const get = http.expectOne(url());
        expect(get.request.headers.keys().filter((key) => key.startsWith('x-mutakamel-'))).toEqual(
          [],
        );
        get.flush({ branchId: BRANCH, revision: 0 });
        await read;
        const write = publishCalendar(BRANCH, 2026, body());
        const post = http.expectOne(url());
        expect(post.request.headers.keys().filter((key) => key.startsWith('x-mutakamel-'))).toEqual(
          [],
        );
        expect(post.request.headers.get('x-idempotency-key')).toMatch(uuidV7);
        expect(post.request.headers.get('x-csrf-token')).toBe('csrf-calendars');
        post.flush({ revision: 1 }, { status: 201, statusText: 'Created' });
        await write;
      });

      it('first publish sends revision 0', async () => {
        const pending = publishCalendar(BRANCH, 2026, body());
        const request = http.expectOne(url());
        expect(request.request.method).toBe('POST');
        expect(request.request.body.expectedRevision).toBe(0);
        expect(request.request.body).toEqual(body());
        request.flush({ revision: 1 }, { status: 201, statusText: 'Created' });
        await expect(pending).resolves.toEqual({ revision: 1 });
      });

      it('workingDays length follows the year', async () => {
        for (const year of [2026, 2028]) {
          const pending = publishCalendar(BRANCH, year, body(year));
          const request = http.expectOne(url(year));
          expect(request.request.body.workingDays).toHaveLength(daysInYear(year));
          expect(request.request.body.workingDays).toMatch(/^[01]+$/);
          request.flush({ revision: 1 }, { status: 201, statusText: 'Created' });
          await pending;
        }
      });

      it.each([0, 503, 401, 409])(
        'reuses the same body and UUID v7 after retryable status %s or session recovery',
        async (status) => {
          const payload = body();
          const first = publishCalendar(BRANCH, 2026, payload);
          const rejected = expect(first).rejects.toMatchObject({ status });
          const request = http.expectOne(url());
          const key = request.request.headers.get('x-idempotency-key');
          expect(key).toMatch(uuidV7);
          if (status === 0) request.error(new ProgressEvent('error'));
          else
            request.flush(
              { code: status === 409 ? 'GW.IDEM.IN_FLIGHT' : 'TEST_FAILURE' },
              { status, statusText: 'Failed' },
            );
          await rejected;
          http.expectNone(url());
          const retry = publishCalendar(BRANCH, 2026, payload);
          const next = http.expectOne(url());
          expect(next.request.headers.get('x-idempotency-key')).toBe(key);
          expect(next.request.body).toEqual(payload);
          next.flush({ revision: 2 }, { status: 201, statusText: 'Created' });
          await retry;
        },
      );

      it.each([503, 422])('uses a new key for a changed body after %s', async (status) => {
        const pending = publishCalendar(BRANCH, 2026, body());
        const rejected = expect(pending).rejects.toMatchObject({ status });
        const first = http.expectOne(url());
        const key = first.request.headers.get('x-idempotency-key');
        first.flush({ errorCode: 'TEST_FAILURE' }, { status, statusText: 'Failed' });
        await rejected;
        const changed = { ...body(), workdayEndMinute: 900 };
        const retry = publishCalendar(BRANCH, 2026, changed);
        const request = http.expectOne(url());
        expect(request.request.headers.get('x-idempotency-key')).not.toBe(key);
        expect(request.request.body).toEqual(changed);
        request.flush({ revision: 2 }, { status: 201, statusText: 'Created' });
        await retry;
      });

      it('does not reuse a completed or rejected action key', async () => {
        const keys: (string | null)[] = [];
        for (const status of [422, 201, 201]) {
          const pending = publishCalendar(BRANCH, 2026, body());
          const result =
            status === 422 ? expect(pending).rejects.toMatchObject({ status }) : pending;
          const request = http.expectOne(url());
          keys.push(request.request.headers.get('x-idempotency-key'));
          request.flush({ revision: 1 }, { status, statusText: 'Result' });
          await result;
        }
        expect(new Set(keys).size).toBe(3);
      });

      it('cancels and invalidates calendar queries only after a successful write', async () => {
        const cancel = vi.spyOn(crmQueries(), 'cancelQueries');
        const invalidate = vi.spyOn(crmQueries(), 'invalidateQueries');
        const pending = publishCalendar(BRANCH, 2026, body());
        http.expectOne(url()).flush({ revision: 3 }, { status: 201, statusText: 'Created' });
        await pending;
        expect(cancel).toHaveBeenCalledWith({ queryKey: ['crm-settings', 'calendars'] });
        expect(invalidate).toHaveBeenCalledWith({ queryKey: ['crm-settings', 'calendars'] });
      });

      describe('model rules shared with the backend', () => {
        it('limits labels to 80 and offers only region zones', () => {
          expect(MAX_WINDOW_LABEL_LENGTH).toBe(80);
          expect(CALENDAR_TIME_ZONES.every((zone) => isValidIanaTimeZone(zone))).toBe(true);
          expect(isValidIanaTimeZone('UTC')).toBe(false);
        });

        it('treats windows as overlapping when masks share a bit, even if that weekday misses the shared dates', () => {
          // 2027-01-03 is a Sunday; the windows share only that date, and the shared mask bit is Monday.
          const a = {
            layer: 1,
            validFrom: '2027-01-01',
            validTo: '2027-01-03',
            weekdayMask: 2,
            startMinute: 0,
            endMinute: 60,
          };
          const b = {
            layer: 1,
            validFrom: '2027-01-03',
            validTo: '2027-01-10',
            weekdayMask: 3,
            startMinute: 30,
            endMinute: 90,
          };
          expect(windowsOverlap(a, b)).toBe(true);
          expect(windowsOverlap(a, { ...b, layer: 2 })).toBe(false);
          expect(windowsOverlap(a, { ...b, startMinute: 60 })).toBe(false);
        });
      });
    });
  }
