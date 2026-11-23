import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createCallLog, getMe, listCallLogs, toCallLogTypeParam } from './phone.api';
import { FakePhoneMeMode, resetPhoneFake, setFakePhoneDelay, setFakePhoneMeMode } from './phone.fake';
import { PhoneApiError, PhoneMeErrorAction, classifyMeError } from './phone.model';

describe('phone.api contract (Core webphone)', () => {
  beforeEach(() => {
    resetPhoneFake();
    setFakePhoneDelay(0);
  });

  afterEach(() => {
    resetPhoneFake();
  });

  it('builds the `type` query as one comma list', () => {
    expect(toCallLogTypeParam(['IN_NOANS', 'IN_BUSY'])).toBe('IN_NOANS,IN_BUSY');
    expect(toCallLogTypeParam([])).toBeUndefined();
    expect(toCallLogTypeParam(undefined)).toBeUndefined();
  });

  it('filters call logs by the comma-list `type` and returns { data, meta }', async () => {
    const result = await listCallLogs({ page: 1, limit: 100, type: 'IN_NOANS,IN_BUSY' });
    expect(result.meta.page).toBe(1);
    expect(result.data.length).toBeGreaterThan(0);
    expect(result.data.every((row) => row.type === 'IN_NOANS' || row.type === 'IN_BUSY')).toBe(true);
  });

  it('returns the raw saved row from createCallLog: no ownerName and no phoneDigits', async () => {
    const saved = await createCallLog({
      type: 'OUT_ANS',
      displayName: null,
      phoneNumber: '+20 100 555 0199',
      startedAt: '2026-11-22T10:00:00.000Z',
      answeredAt: '2026-11-22T10:00:05.000Z',
      endedAt: '2026-11-22T10:01:00.000Z',
      durationSeconds: 55,
      cause: null,
      sourceType: null,
      sourceId: null,
      sourceLabel: null,
    });
    expect(saved).not.toBeNull();
    expect(saved).not.toHaveProperty('ownerName');
    expect(saved).not.toHaveProperty('phoneDigits');
    expect(saved?.phoneNumber).toBe('+20 100 555 0199');

    const listed = await listCallLogs({ page: 1, limit: 100, q: saved?.phoneNumber });
    const listedRow = listed.data.find((row) => row.id === saved?.id);
    expect(listedRow).toBeDefined();
    expect(listedRow).toHaveProperty('ownerName');
  });
});

describe('GET /me error codes (fake test hook -> classifyMeError)', () => {
  beforeEach(() => {
    resetPhoneFake();
    setFakePhoneDelay(0);
  });

  afterEach(() => {
    resetPhoneFake();
  });

  it.each<[FakePhoneMeMode, number, string, PhoneMeErrorAction]>([
    ['403', 403, 'WEBPHONE_MODULE_NOT_PURCHASED', 'hide'],
    ['409', 409, 'WEBPHONE_PROVISIONING_PENDING', 'hide'],
    ['MODULE_INACTIVE', 403, 'WEBPHONE_MODULE_INACTIVE', 'block'],
    ['SCOPE_MISMATCH', 403, 'WEBPHONE_SCOPE_MISMATCH', 'block'],
    ['FORBIDDEN', 403, 'FORBIDDEN', 'error'],
    ['SERVER_ERROR', 500, 'WEBPHONE_INTERNAL_ERROR', 'error'],
  ])('mode %s throws %i %s, classified as %s', async (mode, status, code, action) => {
    setFakePhoneMeMode(mode);
    const error = await getMe().then(
      () => null,
      (e: unknown) => e,
    );
    expect(error).toBeInstanceOf(PhoneApiError);
    expect((error as PhoneApiError).status).toBe(status);
    expect((error as PhoneApiError).code).toBe(code);
    expect(classifyMeError(error)).toBe(action);
  });

  it('decides by code, not status: a coded 409 other than provisioning and a network error are generic', () => {
    expect(classifyMeError(new PhoneApiError(409, 'WEBPHONE_EXTENSION_TAKEN'))).toBe('error');
    expect(classifyMeError(new TypeError('Failed to fetch'))).toBe('error');
  });
});
