import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  activitySummary,
  cancelActivity,
  completeActivity,
  createActivity,
  getActivity,
  listActivities,
  listActivityTypes,
  listAssignees,
  setActivityStatus,
  updateActivity,
} from './activities.api';
import { resetActivitiesFake, setFakeActivitiesDelay } from './activities.fake';
import { ActivityError, CreateActivity } from './activities.model';

const KEY_A = '0192b7ea-7c4f-7a7d-9c9f-51c7f2b3aa10';

function future(hours: number): string {
  return new Date(Date.now() + hours * 3_600_000).toISOString();
}

function body(overrides: Partial<CreateActivity> = {}): CreateActivity {
  return {
    target: { app: 'CRM', type: 'LEAD', id: 'lead-001' },
    type: 'CALL',
    subject: 'Call back',
    dueAt: future(2),
    ...overrides,
  };
}

async function rejection(promise: Promise<unknown>): Promise<ActivityError> {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(ActivityError);
    return error as ActivityError;
  }
  throw new Error('expected a rejection');
}

describe('activities.api contract (core-app tenant/activities)', () => {
  beforeEach(() => {
    resetActivitiesFake();
    setFakeActivitiesDelay(0);
  });
  afterEach(() => resetActivitiesFake());

  it('returns the offset page shape and validates limit as a DTO error (400)', async () => {
    const page = await listActivities({ limit: 5 });
    expect(Object.keys(page).sort()).toEqual(['data', 'meta']);
    expect(Object.keys(page.meta).sort()).toEqual(['hasNext', 'hasPrev', 'limit', 'page', 'total', 'totalPages']);
    expect(page.data.length).toBeLessThanOrEqual(5);
    const error = await rejection(listActivities({ limit: 101 }));
    expect([error.status, error.code, error.field]).toEqual([400, 'CORE_VALIDATION_FAILED', 'limit']);
    expect(error.details).toEqual({ limit: [expect.any(String)] });
  });

  it('requires dayStart and dayEnd on the summary (400) and caps the span at 48h (422)', async () => {
    expect((await rejection(activitySummary({}))).status).toBe(400);
    const start = new Date();
    const end = new Date(start.getTime() + 49 * 3_600_000);
    const error = await rejection(activitySummary({}, start.toISOString(), end.toISOString()));
    expect([error.status, error.code, error.field]).toEqual([422, 'ACTIVITY_INVALID', undefined]);
  });

  it('serves the backend activity type catalogue', async () => {
    const types = await listActivityTypes();
    expect(types.find((t) => t.key === 'TODO')).toEqual({
      key: 'TODO',
      label: 'To-do',
      icon: 'check-square',
      defaultPriority: 'NORMAL',
    });
    expect(types.every((t) => t.defaultPriority === 'NORMAL')).toBe(true);
  });

  it('requires the assignee target (400)', async () => {
    const error = await rejection(listAssignees(undefined as never));
    expect([error.status, error.code]).toEqual([400, 'CORE_VALIDATION_FAILED']);
    const list = await listAssignees({ targetApp: 'CRM', targetType: 'LEAD', targetId: 'lead-001' });
    expect(list.length).toBeGreaterThan(0);
  });

  it('rejects DTO violations as 400 with field details and business rules as 422 without a field', async () => {
    const tooLong = await rejection(createActivity(body({ subject: 'x'.repeat(181) })));
    expect([tooLong.status, tooLong.code, tooLong.field]).toEqual([400, 'CORE_VALIDATION_FAILED', 'subject']);
    const blank = await rejection(createActivity(body({ subject: '   ' })));
    expect(blank.field).toBe('subject');
    const url = await rejection(createActivity(body({ meetingUrl: 'ftp://x' })));
    expect(url.details).toEqual({ meetingUrl: [expect.any(String)] });
    const past = await rejection(createActivity(body({ dueAt: new Date(Date.now() - 60_000).toISOString() })));
    expect([past.status, past.code, past.field]).toEqual([422, 'ACTIVITY_INVALID', undefined]);
    const tuple = await rejection(createActivity(body({ target: { app: 'CORE', type: 'LEAD', id: 'x' } })));
    expect([tuple.status, tuple.code]).toEqual([422, 'ACTIVITY_INVALID']);
  });

  it('enforces the UUIDv7 idempotency key, replays the same request and refuses a different one', async () => {
    const bad = await rejection(createActivity(body(), 'not-a-uuid'));
    expect([bad.status, bad.code]).toEqual([422, 'ACTIVITY_IDEMPOTENCY_KEY_INVALID']);
    const request = body();
    const first = await createActivity(request, KEY_A);
    const replay = await createActivity({ ...request }, KEY_A);
    expect(replay.id).toBe(first.id);
    const mismatch = await rejection(createActivity({ ...request, subject: 'Other' }, KEY_A));
    expect([mismatch.status, mismatch.code]).toEqual([422, 'ACTIVITY_IDEMPOTENCY_MISMATCH']);
    expect((await listActivities({ limit: 100 })).data.filter((a) => a.id === first.id)).toHaveLength(1);
  });

  it('checks If-Match (428), then 404, then version (409) before the terminal state (409)', async () => {
    const created = await createActivity(body());
    expect((await rejection(updateActivity(created.id, 0, { subject: 'x' }))).status).toBe(428);
    expect((await rejection(updateActivity('act-999', 1, { subject: 'x' }))).code).toBe('ACTIVITY_NOT_FOUND');
    const done = await completeActivity(created.id, created.version, 'ok');
    expect(done.version).toBe(created.version + 1);
    const stale = await rejection(cancelActivity(created.id, created.version));
    expect([stale.status, stale.code]).toEqual([409, 'ACTIVITY_VERSION_CONFLICT']);
    const terminal = await rejection(cancelActivity(created.id, done.version));
    expect([terminal.status, terminal.code]).toEqual([409, 'ACTIVITY_TERMINAL']);
  });

  it('does not bump the version for an unchanged update or the current status', async () => {
    const created = await createActivity(body());
    const same = await updateActivity(created.id, created.version, { subject: created.subject });
    expect(same.version).toBe(created.version);
    const status = await setActivityStatus(created.id, created.version, 'PLANNED');
    expect(status.version).toBe(created.version);
    const empty = await rejection(updateActivity(created.id, created.version, {}));
    expect([empty.status, empty.code]).toEqual([422, 'ACTIVITY_INVALID']);
    expect((await getActivity(created.id)).version).toBe(created.version);
  });

  it('stores the cancellation reason trimmed in outcome and validates its length as `reason`', async () => {
    const created = await createActivity(body());
    const tooLong = await rejection(cancelActivity(created.id, created.version, 'x'.repeat(2001)));
    expect(tooLong.field).toBe('reason');
    const cancelled = await cancelActivity(created.id, created.version, '  no answer  ');
    expect([cancelled.status, cancelled.outcome]).toEqual(['CANCELLED', 'no answer']);
  });
});
