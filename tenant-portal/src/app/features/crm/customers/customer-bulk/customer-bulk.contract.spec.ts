import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetBulkJobsFake } from '../../../../shared/bulk-jobs/bulk-jobs.fake';
import type { TranslocoService } from '@jsverse/transloco';
import ar from '../../../../../../public/i18n/customer-bulk/ar.json';
import en from '../../../../../../public/i18n/customer-bulk/en.json';
import { submitBulkJob } from '../../../../shared/bulk-jobs/bulk-jobs.api';
import { BulkJobSubmit } from '../../../../shared/bulk-jobs/bulk-jobs.model';
import { ApiError } from '../../settings/shared/settings-api';
import { ACME_CUSTOMER_ID, DEFAULT_CUSTOMER_BRANCH_ID } from '../customers.fake';
import { MANUAL_STATUSES } from '../customer-statuses';
import { fakeSelectCustomers } from './customers-bulk.fake-module';
import {
  CUSTOMERS_BULK_APP,
  CUSTOMERS_BULK_MODULE_ID,
  CUSTOMER_SELECTION_LIMIT,
  extractBulkErrorParams,
  translateCustomerBulkError,
} from './customer-bulk.model';
import { CRM_CUSTOMERS_BULK_MODULE } from './customers-bulk.descriptor';
import './customers-bulk.fake-module';

/*
 * Contract checks against the crm-app customers bulk handler
 * (crm-customers-bulk.handler.ts / .schemas.ts, leadBulkActivitySchema):
 * module crm.customer_profiles, four actions, strict params, QUERY {search, sort} + excludedIds, cap 10,000.
 */

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

let keyCounter = 0;
const nextKey = () => `0190c5d1-b2c3-7d4e-8f50-${String(++keyCounter).padStart(12, '0')}`;
const FUTURE = () => new Date(Date.now() + 86_400_000).toISOString();

function req(action: string, params: unknown, extra: Partial<BulkJobSubmit> = {}): BulkJobSubmit {
  return {
    module: CUSTOMERS_BULK_MODULE_ID,
    action,
    scope: { branchId: DEFAULT_CUSTOMER_BRANCH_ID },
    selection: { kind: 'IDS', ids: [ACME_CUSTOMER_ID] },
    params,
    ...extra,
  };
}

function activity(extra: Record<string, unknown> = {}): Record<string, unknown> {
  return { type: 'CALL', subject: 'Follow up', durationMinutes: null, ...extra };
}

function schedule(extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    startAt: FUTURE(),
    gapMinutes: 15,
    order: 'TABLE',
    assignee: { mode: 'LEAD_OWNER' },
    spacePerAssignee: true,
    ...extra,
  };
}

async function rejectError(body: BulkJobSubmit): Promise<ApiError | undefined> {
  try {
    await settle(submitBulkJob(CUSTOMERS_BULK_APP, body, nextKey()));
    return undefined;
  } catch (error) {
    if (error instanceof ApiError) return error;
    throw error;
  }
}

async function rejectCode(body: BulkJobSubmit): Promise<string | undefined> {
  return (await rejectError(body))?.code;
}

beforeEach(() => {
  resetBulkJobsFake();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('customers bulk fake: rejects wrong shapes', () => {
  it('ASSIGN without ownerUserId', async () => {
    expect(await rejectCode(req('ASSIGN', {}))).toBe('BULK_JOB_PARAMS_INVALID');
    expect(await rejectCode(req('ASSIGN', { ownerUserId: '   ' }))).toBe('BULK_JOB_PARAMS_INVALID');
  });

  it('SET_STATUS outside PROSPECT / INACTIVE / BLACKLISTED', async () => {
    expect(await rejectCode(req('SET_STATUS', { status: 'ACTIVE_CUSTOMER' }))).toBe(
      'CUSTOMER_PROFILE_ACTIVATION_REQUIRES_WON',
    );
  });

  // Backend: customerBulkStatusSchema z.enum → bulk kit 400 BULK_JOB_PARAMS_INVALID with details.issues.
  it('SET_STATUS with an unknown, padded or missing status → 400 BULK_JOB_PARAMS_INVALID (issue on status)', async () => {
    for (const params of [{ status: 'WON' }, { status: ' INACTIVE ' }, { status: '' }, {}]) {
      const error = await rejectError(req('SET_STATUS', params));
      expect(error).toMatchObject({ status: 400, code: 'BULK_JOB_PARAMS_INVALID' });
      expect(error?.details?.['issues']).toEqual([expect.objectContaining({ path: ['status'], code: 'invalid_value' })]);
    }
  });

  it('manual statuses offered by the UI are exactly the three the backend accepts for bulk', () => {
    expect([...MANUAL_STATUSES].sort()).toEqual(['BLACKLISTED', 'INACTIVE', 'PROSPECT']);
  });

  it('DELETE with a non-string or over-long reason', async () => {
    expect(await rejectCode(req('DELETE', { reason: 42 }))).toBe('BULK_JOB_PARAMS_INVALID');
    expect(await rejectCode(req('DELETE', { reason: 'x'.repeat(1001) }))).toBe('BULK_JOB_PARAMS_INVALID');
  });

  it('unknown action (no tags action exists)', async () => {
    expect(await rejectCode(req('ADD_TAGS', { tagIds: ['t1'] }))).toBe('BULK_JOB_PARAMS_INVALID');
  });

  it('CREATE_ACTIVITY: wrong schedule.assignee shapes', async () => {
    const bad: Record<string, unknown>[] = [
      { assignee: { mode: 'USER' } },
      { assignee: { mode: 'ME', userId: '0190c5d1-0000-7000-8000-000000000001' } },
      { assignee: { mode: 'OWNER' } },
      { assignee: undefined, assigneeMode: 'ME' },
      { assigneeUserId: 'u2' },
    ];
    for (const extra of bad) {
      const sched = schedule(extra);
      if (extra['assignee'] === undefined && 'assignee' in extra) delete sched['assignee'];
      expect(await rejectCode(req('CREATE_ACTIVITY', { activity: activity(), schedule: sched }))).toBe(
        'BULK_JOB_PARAMS_INVALID',
      );
    }
  });

  it('CREATE_ACTIVITY: wrong order, gap or spacePerAssignee', async () => {
    for (const extra of [
      { order: 'table' },
      { order: 'RANDOM' },
      { gapMinutes: 0 },
      { gapMinutes: 1441 },
      { gapMinutes: 2.5 },
      { spacePerAssignee: 'yes' },
    ]) {
      expect(
        await rejectCode(req('CREATE_ACTIVITY', { activity: activity(), schedule: schedule(extra) })),
      ).toBe('BULK_JOB_PARAMS_INVALID');
    }
  });

  it('CREATE_ACTIVITY: wrong activity fields', async () => {
    const bad: Record<string, unknown>[] = [
      { type: 'LUNCH' },
      { subject: '   ' },
      { subject: 'x'.repeat(181) },
      { type: 'TODO', direction: 'OUTBOUND' },
      { type: 'CALL', location: 'HQ' },
      { type: 'CALL', meetingUrl: 'https://meet.example.com/x' },
      { type: 'MEETING', meetingUrl: 'ftp://example.com/x' },
      { priority: 'CRITICAL' },
      { reminderOffsetMinutes: 40321 },
      { durationMinutes: 20161 },
      { durationMinutes: 0 },
      { unknownField: true },
    ];
    for (const extra of bad) {
      expect(
        await rejectCode(req('CREATE_ACTIVITY', { activity: activity(extra), schedule: schedule() })),
      ).toBe('BULK_JOB_PARAMS_INVALID');
    }
    const noDuration = activity();
    delete noDuration['durationMinutes'];
    expect(await rejectCode(req('CREATE_ACTIVITY', { activity: noDuration, schedule: schedule() }))).toBe(
      'BULK_JOB_PARAMS_INVALID',
    );
    expect(
      await rejectCode(req('CREATE_ACTIVITY', { activity: activity(), schedule: schedule(), extra: 1 })),
    ).toBe('BULK_JOB_PARAMS_INVALID');
  });

  it('CREATE_ACTIVITY: past startAt → CUSTOMER_BULK_START_IN_PAST', async () => {
    expect(
      await rejectCode(
        req('CREATE_ACTIVITY', {
          activity: activity(),
          schedule: schedule({ startAt: new Date(Date.now() - 1000).toISOString() }),
        }),
      ),
    ).toBe('CUSTOMER_BULK_START_IN_PAST');
  });

  it('accepts each valid assignee mode and both orders', async () => {
    for (const extra of [
      { assignee: { mode: 'LEAD_OWNER' }, order: 'OWNER' },
      { assignee: { mode: 'ME' }, spacePerAssignee: false },
      { assignee: { mode: 'USER', userId: 'u2' }, order: 'TABLE', spacePerAssignee: false },
    ]) {
      expect(
        await rejectCode(req('CREATE_ACTIVITY', { activity: activity(), schedule: schedule(extra) })),
      ).toBeUndefined();
    }
  });

  it('QUERY with search.branchId different from scope.branchId → CRM_SCOPED_PERMISSION_DENIED', async () => {
    expect(
      await rejectCode(
        req('DELETE', {}, {
          selection: {
            kind: 'QUERY',
            query: { search: { branchId: 'other-branch' }, sort: 'createdAt:DESC' },
            excludedIds: [],
          },
        }),
      ),
    ).toBe('CRM_SCOPED_PERMISSION_DENIED');
  });

  // Backend uses z.strictObject for ASSIGN/SET_STATUS/DELETE params → 400 with an unrecognized_keys issue.
  it('ASSIGN / SET_STATUS / DELETE with extra params keys → 400 BULK_JOB_PARAMS_INVALID (unrecognized_keys)', async () => {
    for (const [action, params] of [
      ['ASSIGN', { ownerUserId: 'u2', extra: 1 }],
      ['SET_STATUS', { status: 'INACTIVE', extra: 1 }],
      ['DELETE', { reason: 'x', extra: 1 }],
      ['DELETE', { extra: 1 }],
    ] as const) {
      const error = await rejectError(req(action, params));
      expect(error, action).toMatchObject({ status: 400, code: 'BULK_JOB_PARAMS_INVALID' });
      expect(error?.details?.['issues']).toEqual([
        { path: [], code: 'unrecognized_keys', message: 'Unrecognized key: "extra"' },
      ]);
    }
  });

  it('still accepts the exact valid params', async () => {
    expect(await rejectCode(req('ASSIGN', { ownerUserId: 'u2' }))).toBeUndefined();
    expect(await rejectCode(req('DELETE', {}))).toBeUndefined();
    expect(await rejectCode(req('DELETE', { reason: null }))).toBeUndefined();
  });
});

describe('customers bulk: selection cap', () => {
  it('cap is 10,000 and the preview rejects limits outside 1..10,000', async () => {
    expect(CUSTOMER_SELECTION_LIMIT).toBe(10_000);
    for (const limit of [0, 10_001, 1.5]) {
      await expect(
        settle(fakeSelectCustomers({ branchId: DEFAULT_CUSTOMER_BRANCH_ID }, undefined, limit)),
      ).rejects.toMatchObject({ code: 'CUSTOMER_PROFILE_SELECTION_TOO_LARGE' });
    }
  });

  it('extractBulkErrorParams formats details.max from number or string[] and defaults to the cap', () => {
    expect(extractBulkErrorParams(new ApiError(422, 'BULK_SELECTION_TOO_LARGE', { max: 10_000 }))['max']).toBe(
      (10_000).toLocaleString(),
    );
    expect(extractBulkErrorParams(new ApiError(422, 'BULK_SELECTION_TOO_LARGE', { max: ['5000'] }))['max']).toBe(
      (5000).toLocaleString(),
    );
    expect(extractBulkErrorParams(new Error('net'))['max']).toBe((10_000).toLocaleString());
  });
});

type Dict = Record<string, unknown>;

function lookup(dict: Dict, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, part) => (acc && typeof acc === 'object' ? (acc as Dict)[part] : undefined), dict);
}

const ARABIC = /[؀-ۿ]/;

const SKIP_CODES = ['UNCHANGED', 'BLACKLISTED'];
const ITEM_FAILURE_CODES = [
  'CUSTOMER_PROFILE_NOT_FOUND',
  'CUSTOMER_PROFILE_BLACKLISTED',
  'CUSTOMER_PROFILE_HAS_ACTIVE_OPPORTUNITIES',
  'CUSTOMER_PROFILE_LINKED_LEAD_LIMIT',
  'CUSTOMER_PROFILE_LINKED_LEADS_CHANGED',
  'CUSTOMER_PROFILE_DISQUALIFY_STAGE_UNAVAILABLE',
  'CUSTOMER_PROFILE_REOPEN_STAGE_UNAVAILABLE',
  'CUSTOMER_PROFILE_SOURCE_LEAD_CONFLICT',
  'CUSTOMER_PROFILE_REFERENCE_CONFLICT',
  'CUSTOMER_PROFILE_STATUS_MANAGE_REQUIRED',
  'CRM_SCOPED_PERMISSION_DENIED',
  'CRM.CUSTOMER_PROFILE.CONCURRENT_UPDATE',
  'ACTIVITY_INVALID',
  'ACTIVITY_ACCESS_DENIED',
  'ACTIVITY_TARGET_NOT_FOUND',
  'ACTIVITY_ASSIGNEE_INELIGIBLE',
];
const REQUEST_CODES = [
  'CUSTOMER_BULK_START_IN_PAST',
  'CUSTOMER_PROFILE_ACTIVATION_REQUIRES_WON',
  'CUSTOMER_PROFILE_STATUS_MANAGE_REQUIRED',
  'CRM_SCOPED_PERMISSION_DENIED',
  'BULK_SELECTION_TOO_LARGE',
  'CUSTOMER_PROFILE_SELECTION_TOO_LARGE',
  'BULK_JOB_PARAMS_INVALID',
];

describe('customers bulk i18n: skip / error codes have en and ar texts', () => {
  const keys = [
    ...SKIP_CODES.map((c) => `skip.${c}`),
    ...[...new Set([...ITEM_FAILURE_CODES, ...REQUEST_CODES])].map((c) => `codes.${c}`),
    'codes.generic',
  ];

  it.each(keys)('%s', (key) => {
    const enText = lookup(en as Dict, key);
    const arText = lookup(ar as Dict, key);
    expect(typeof enText, `en ${key}`).toBe('string');
    expect(typeof arText, `ar ${key}`).toBe('string');
    expect((enText as string).trim()).not.toBe('');
    expect(arText as string).toMatch(ARABIC);
    expect(arText).not.toBe(enText);
  });

  it('ACTIVITY_INVALID keeps the {{field}} placeholder in both languages', () => {
    expect(lookup(en as Dict, 'codes.ACTIVITY_INVALID')).toContain('{{field}}');
    expect(lookup(ar as Dict, 'codes.ACTIVITY_INVALID')).toContain('{{field}}');
  });

  it('every action has en/ar job title and status labels exist for the three manual statuses', () => {
    for (const action of Object.keys(CRM_CUSTOMERS_BULK_MODULE.actions)) {
      expect(lookup(ar as Dict, `job.${action}`)).toMatch(ARABIC);
      expect(typeof lookup(en as Dict, `job.${action}`)).toBe('string');
    }
    for (const status of MANUAL_STATUSES) {
      expect(lookup(ar as Dict, `status.${status}`)).toMatch(ARABIC);
    }
  });

  it('translateCustomerBulkError resolves module codes, then platform codes, then generic', () => {
    const table: Record<string, string> = {
      'customerBulk.codes.CUSTOMER_BULK_START_IN_PAST': 'past',
      'bulkJobs.codes.BULK_JOB_ACTIVE': 'active',
      'customerBulk.codes.generic': 'generic',
    };
    const transloco = {
      translate: (key: string) => table[key] ?? key,
    } as unknown as TranslocoService;
    expect(translateCustomerBulkError(transloco, 'CUSTOMER_BULK_START_IN_PAST')).toBe('past');
    expect(translateCustomerBulkError(transloco, 'BULK_JOB_ACTIVE')).toBe('active');
    expect(translateCustomerBulkError(transloco, 'SOMETHING_ELSE')).toBe('generic');
    expect(translateCustomerBulkError(transloco, null)).toBe('generic');
  });
});

describe('customers bulk descriptor', () => {
  it('matches the backend module, actions and code prefixes', () => {
    expect(CRM_CUSTOMERS_BULK_MODULE.app).toBe('crm');
    expect(CRM_CUSTOMERS_BULK_MODULE.module).toBe('crm.customer_profiles');
    expect(Object.keys(CRM_CUSTOMERS_BULK_MODULE.actions).sort()).toEqual(
      ['ASSIGN', 'CREATE_ACTIVITY', 'DELETE', 'SET_STATUS'],
    );
    expect(CRM_CUSTOMERS_BULK_MODULE.codeKeyPrefixes).toEqual(['customerBulk.codes.', 'customerBulk.skip.']);
  });
});
