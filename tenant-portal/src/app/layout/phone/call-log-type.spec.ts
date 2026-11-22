import { describe, expect, it } from 'vitest';
import {
  CALL_LOG_FILTER_TYPES,
  CALL_LOG_TYPE_MAP,
  callLogDayGroup,
  callLogTimestamp,
  callLogTypeLook,
  callRecordRoute,
  callSourceOf,
  formatCallDateTime,
  formatCallDuration,
  formatCallTime,
  isCallAnswered,
} from './call-log-type';

describe('layout/phone call-log-type helpers', () => {
  it('offers the six live call types as filters (never the legacy OUT) and maps every type to a look', () => {
    expect(CALL_LOG_FILTER_TYPES).toEqual(['IN_ANS', 'IN_NOANS', 'IN_BUSY', 'OUT_ANS', 'OUT_NOANS', 'OUT_BUSY']);
    expect(CALL_LOG_FILTER_TYPES).not.toContain('OUT');
    for (const type of Object.keys(CALL_LOG_TYPE_MAP) as (keyof typeof CALL_LOG_TYPE_MAP)[]) {
      expect(callLogTypeLook(type).labelKey).toBe(`phoneCalls.types.${type}`);
    }
    expect(callLogTypeLook('IN_NOANS').missed).toBe(true);
    expect(Object.values(CALL_LOG_TYPE_MAP).filter((look) => look.missed)).toHaveLength(1);
  });

  it('uses startedAt for the timestamp and falls back to createdAt', () => {
    expect(callLogTimestamp({ startedAt: '2026-11-22T10:00:00Z', createdAt: '2026-11-22T11:00:00Z' })).toBe(
      '2026-11-22T10:00:00Z',
    );
    expect(callLogTimestamp({ startedAt: null, createdAt: '2026-11-22T11:00:00Z' })).toBe('2026-11-22T11:00:00Z');
  });

  it('groups by local day: today, yesterday, earlier; future and invalid dates', () => {
    const now = new Date(2026, 10, 22, 9, 30);
    expect(callLogDayGroup(new Date(2026, 10, 22, 0, 1).toISOString(), now)).toBe('today');
    expect(callLogDayGroup(new Date(2026, 10, 22, 23, 59).toISOString(), now)).toBe('today');
    expect(callLogDayGroup(new Date(2026, 10, 21, 23, 59).toISOString(), now)).toBe('yesterday');
    expect(callLogDayGroup(new Date(2026, 10, 20, 12, 0).toISOString(), now)).toBe('earlier');
    expect(callLogDayGroup('not-a-date', now)).toBe('earlier');
  });

  it('treats a call as answered only with a duration; answeredAt counts even for a NOANS type', () => {
    expect(isCallAnswered({ type: 'IN_ANS', answeredAt: null, durationSeconds: 10 })).toBe(true);
    expect(isCallAnswered({ type: 'IN_ANS', answeredAt: null, durationSeconds: null })).toBe(false);
    expect(isCallAnswered({ type: 'OUT_NOANS', answeredAt: '2026-11-22T10:00:00Z', durationSeconds: 3 })).toBe(true);
    expect(isCallAnswered({ type: 'IN_NOANS', answeredAt: null, durationSeconds: 0 })).toBe(false);
  });

  it('formats the duration as mm:ss or h:mm:ss, null when not answered, clamps negatives', () => {
    expect(formatCallDuration({ type: 'OUT_ANS', answeredAt: null, durationSeconds: 65 })).toBe('01:05');
    expect(formatCallDuration({ type: 'OUT_ANS', answeredAt: null, durationSeconds: 3_725 })).toBe('1:02:05');
    expect(formatCallDuration({ type: 'OUT_ANS', answeredAt: null, durationSeconds: -4 })).toBe('00:00');
    expect(formatCallDuration({ type: 'IN_NOANS', answeredAt: null, durationSeconds: 30 })).toBeNull();
  });

  it('formats time and date-time with Latin digits in both languages; invalid input is safe', () => {
    const iso = new Date(2026, 10, 22, 7, 5).toISOString();
    expect(formatCallTime(iso)).toBe('07:05');
    expect(formatCallTime('bad')).toBe('00:00');
    expect(formatCallDateTime(iso, 'en')).toBe('22 Nov 2026 · 07:05');
    expect(formatCallDateTime(iso, 'ar')).toMatch(/^22 \S+ 2026 · 07:05$/);
    expect(formatCallDateTime(iso, 'ar')).not.toMatch(/[٠-٩]/);
    expect(formatCallDateTime('bad', 'en')).toBe('');
  });

  it('builds the call source from the log row, labelled by sourceLabel, then name, then number', () => {
    const base = { sourceType: 'LEAD' as const, sourceId: 'l1', displayName: 'Ali', phoneNumber: '+20100' };
    expect(callSourceOf({ ...base, sourceLabel: 'Lead A' })).toEqual({ type: 'LEAD', id: 'l1', label: 'Lead A' });
    expect(callSourceOf({ ...base, sourceLabel: null })?.label).toBe('Ali');
    expect(callSourceOf({ ...base, sourceLabel: null, displayName: null })?.label).toBe('+20100');
    expect(callSourceOf({ ...base, sourceId: null, sourceLabel: 'x' })).toBeNull();
  });

  it('routes a linked record to its page and needs a label to link at all', () => {
    const row = (sourceType: 'LEAD' | 'CUSTOMER_PROFILE' | 'OPPORTUNITY' | 'PARTY') => ({
      sourceType,
      sourceId: 'id-1',
      sourceLabel: 'Label',
    });
    expect(callRecordRoute(row('LEAD'))).toBe('/crm/leads/id-1');
    expect(callRecordRoute(row('CUSTOMER_PROFILE'))).toBe('/crm/customers/id-1');
    expect(callRecordRoute(row('OPPORTUNITY'))).toBe('/crm/opportunities/id-1');
    expect(callRecordRoute(row('PARTY'))).toBe('/workspace/operations/party-directory');
    expect(callRecordRoute({ ...row('LEAD'), sourceLabel: null })).toBeNull();
  });
});
