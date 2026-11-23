import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { AuthSession } from '../../../core/auth/auth-session';
import { FAKE_TENANT_ME } from '../../../core/auth/auth-session.fake';
import { bindCrmHttpForTest } from '../shared/crm-http';
import { CrmHttpStub } from '../shared/testing/crm-http-testing';
import en from '../../../../../public/i18n/opportunities/en.json';
import ar from '../../../../../public/i18n/opportunities/ar.json';
import enForm from '../../../../../public/i18n/opportunity-form/en.json';
import arForm from '../../../../../public/i18n/opportunity-form/ar.json';
import enPage from '../../../../../public/i18n/opportunity-page/en.json';
import arPage from '../../../../../public/i18n/opportunity-page/ar.json';
import { ACME_CUSTOMER_ID, CUSTOMERS_FAKE_DB, DEFAULT_CUSTOMER_BRANCH_ID } from '../customers/customers.fake';
import { ApiError } from '../settings/shared/settings-api';
import {
  getOpportunityCapabilities,
  listOwners,
  listReasons,
  OPPORTUNITY_ERROR_KEYS,
  opportunitySharedErrorKey,
} from './opportunities.api';
import {
  ACME_OPPORTUNITY_ID,
  PROJECTS_PIPELINE_ID,
  RENEWALS_PIPELINE_ID,
  SALES_PIPELINE_ID,
  fakeCreateOpportunity,
  fakeGetOpportunity,
  fakeGetPipeline,
  fakeAttachOpportunityTags,
  fakeDeleteOpportunity,
  fakeDetachOpportunityTag,
  fakeGetOpportunityCapabilities,
  fakeGetOpportunityReasons,
  fakeListOpportunityTags,
  fakeSelectOpportunities,
  fakeListStageHistory,
  fakeLoadBoard,
  fakeLoadStagePage,
  fakeMoveOpportunityStage,
  fakePatchOpportunity,
  fakeSearchOpportunities,
  fakeTransferOpportunityPipeline,
} from './opportunities.fake';
import {
  BOARD_OMITTED_FIELDS,
  addDecimalStrings,
  type CreateOpportunityBody,
  type OpportunityRow,
  type OpportunitySearchBody,
  type StageHistoryItem,
  type WireNode,
} from './opportunities.model';

/** Runs the fake 250–500 ms timers to completion and returns (or rethrows) the settled result. */
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

async function expectApiError(promise: Promise<unknown>, status: number, code: string): Promise<ApiError> {
  let caught: unknown;
  try {
    await settle(promise);
  } catch (error) {
    caught = error;
  }
  expect(caught).toBeInstanceOf(ApiError);
  expect((caught as ApiError).status).toBe(status);
  expect((caught as ApiError).code).toBe(code);
  return caught as ApiError;
}

const BRANCH = DEFAULT_CUSTOMER_BRANCH_ID;
const ALL: OpportunitySearchBody = { branchId: BRANCH };
const SCALE = 100_000_000n;

/** Independent exact decimal parser (8 dp) for the sum checks. */
function scaled(raw: string): bigint {
  const [int, frac = ''] = raw.split('.');
  return BigInt(int) * SCALE + BigInt(frac.slice(0, 8).padEnd(8, '0'));
}
function unscaled(value: bigint): string {
  return `${value / SCALE}.${(value % SCALE).toString().padStart(8, '0')}`;
}

let keyCounter = 0;
function newKey(): string {
  keyCounter += 1;
  return `0190a1b2-c3d4-7e5f-8a9b-${keyCounter.toString(16).padStart(12, '0')}`;
}

function baseCreate(overrides: Partial<CreateOpportunityBody> = {}): CreateOpportunityBody {
  return {
    branchId: BRANCH,
    customerProfileId: ACME_CUSTOMER_ID,
    pipelineId: SALES_PIPELINE_ID,
    stageId: 'ps-sales-1',
    title: 'Spec opportunity',
    ...overrides,
  };
}

async function createFresh(overrides: Partial<CreateOpportunityBody> = {}): Promise<OpportunityRow> {
  return settle(fakeCreateOpportunity(baseCreate(overrides), newKey()));
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('decimal-string amounts', () => {
  it('adds decimal strings exactly at 8 dp without float drift', () => {
    expect(addDecimalStrings('0.1', '0.2')).toBe('0.30000000');
    expect(addDecimalStrings('9999999999999999.99000000', '0.01000000')).toBe('10000000000000000.00000000');
    expect(addDecimalStrings('1250.00400000', '99.00400000')).toBe('1349.00800000');
  });

  it('returns every row amount as a string or null, never a number', async () => {
    const page = await settle(fakeSearchOpportunities(ALL, 1, 200));
    expect(page.items.length).toBeGreaterThan(0);
    for (const row of page.items) {
      expect(row.amount === null || typeof row.amount === 'string').toBe(true);
      if (row.amount !== null) expect(row.amount).toMatch(/^\d{1,16}\.\d{8}$/);
    }
  });

  it('keeps 16 integer digits and 8 decimals exact on create, normalised to 8 dp', async () => {
    const big = await createFresh({ amount: '9999999999999999.99999999', currencyCode: 'EGP' });
    expect(big.amount).toBe('9999999999999999.99999999');
    const half = await createFresh({ amount: '1250.5', currencyCode: 'SAR' });
    expect(half.amount).toBe('1250.50000000');
  });

  it('rejects more than 16 integer digits or more than 8 decimals with CRM_VALIDATION_FAILED', async () => {
    await expectApiError(
      fakeCreateOpportunity(baseCreate({ amount: '12345678901234567', currencyCode: 'EGP' }), newKey()),
      400,
      'CRM_VALIDATION_FAILED',
    );
    await expectApiError(
      fakeCreateOpportunity(baseCreate({ amount: '1.123456789', currencyCode: 'EGP' }), newKey()),
      400,
      'CRM_VALIDATION_FAILED',
    );
  });
});

describe('board', () => {
  it('sums lane amounts per currency exactly, with UNSPECIFIED for no currency', async () => {
    const board = await settle(fakeLoadBoard(SALES_PIPELINE_ID, { ...ALL, limitPerStage: 0 }));
    const page = await settle(fakeSearchOpportunities({ ...ALL, filterTree: { field: 'pipelineId', operator: 'eq', value: SALES_PIPELINE_ID } }, 1, 500));

    for (const lane of board.stages) {
      const expected = new Map<string, bigint>();
      for (const row of page.items.filter((r) => r.stageId === lane.stage.id)) {
        if (row.amount === null) continue;
        const code = row.currencyCode ?? 'UNSPECIFIED';
        expected.set(code, (expected.get(code) ?? 0n) + scaled(row.amount));
      }
      const actual = new Map(lane.summary.amountsByCurrency.map((a) => [a.currencyCode, a.amount]));
      expect(actual.size).toBe(expected.size);
      for (const [code, sum] of expected) expect(actual.get(code)).toBe(unscaled(sum));
      for (const entry of lane.summary.amountsByCurrency) expect(typeof entry.amount).toBe('string');
      expect(lane.summary.amountsByCurrency.some((a) => a.currencyCode === '')).toBe(false);
    }
  });

  it('reports UNSPECIFIED for an amount without currency (seeded) and lists it last', async () => {
    const board = await settle(fakeLoadBoard(SALES_PIPELINE_ID, { ...ALL, limitPerStage: 0 }));
    const projects = await settle(fakeLoadBoard(PROJECTS_PIPELINE_ID, { ...ALL, limitPerStage: 0 }));
    const renewals = await settle(fakeLoadBoard(RENEWALS_PIPELINE_ID, { ...ALL, limitPerStage: 0 }));
    const lanes = [...board.stages, ...projects.stages, ...renewals.stages];
    const withUnspecified = lanes.filter((l) => l.summary.amountsByCurrency.some((a) => a.currencyCode === 'UNSPECIFIED'));
    expect(withUnspecified.length).toBeGreaterThan(0);
    for (const lane of withUnspecified) {
      expect(lane.summary.amountsByCurrency.at(-1)?.currencyCode).toBe('UNSPECIFIED');
    }
  });

  it('an unknown pipeline is 404 PIPELINE_NOT_FOUND with no details (board and read)', async () => {
    const board = await expectApiError(fakeLoadBoard('pipeline-missing', { ...ALL, limitPerStage: 0 }), 404, 'PIPELINE_NOT_FOUND');
    expect(board.details).toBeUndefined();
    const read = await expectApiError(fakeGetPipeline('pipeline-missing'), 404, 'PIPELINE_NOT_FOUND');
    expect(read.details).toBeUndefined();
  });

  it('a pipeline read carries createdAt/updatedAt and no assignments', async () => {
    const pipeline = await settle(fakeGetPipeline(SALES_PIPELINE_ID));
    expect(typeof pipeline.createdAt).toBe('string');
    expect(typeof pipeline.updatedAt).toBe('string');
    expect('assignments' in pipeline).toBe(false);
  });

  it('limitPerStage 0 returns empty items but full summaries', async () => {
    const board = await settle(fakeLoadBoard(SALES_PIPELINE_ID, { ...ALL, limitPerStage: 0 }));
    const total = board.stages.reduce((sum, lane) => sum + lane.summary.totalCount, 0);
    expect(total).toBeGreaterThan(0);
    for (const lane of board.stages) expect(lane.items).toEqual([]);
  });

  it('board rows omit BOARD_OMITTED_FIELDS and carry contactDisplayName', async () => {
    const board = await settle(fakeLoadBoard(SALES_PIPELINE_ID, { ...ALL, limitPerStage: 50 }));
    const items = board.stages.flatMap((lane) => lane.items);
    expect(items.length).toBeGreaterThan(0);
    for (const item of items) {
      for (const key of BOARD_OMITTED_FIELDS) expect(key in item).toBe(false);
      expect('contactDisplayName' in item).toBe(true);
    }
    const lane = board.stages.find((l) => l.pageInfo.nextCursor);
    if (lane) {
      const next = await settle(
        fakeLoadStagePage(SALES_PIPELINE_ID, lane.stage.id, { ...ALL, limit: 50, cursor: lane.pageInfo.nextCursor! }),
      );
      for (const item of next.items) for (const key of BOARD_OMITTED_FIELDS) expect(key in item).toBe(false);
    }
  });
});

describe('nullable fields (o0 review)', () => {
  it('types customerDisplayName, customerProfileType and stage-history toStageId as nullable', () => {
    expectTypeOf<null>().toMatchTypeOf<OpportunityRow['customerDisplayName']>();
    expectTypeOf<null>().toMatchTypeOf<OpportunityRow['customerProfileType']>();
    expectTypeOf<null>().toMatchTypeOf<StageHistoryItem['toStageId']>();
    expectTypeOf<null>().toMatchTypeOf<StageHistoryItem['fromStageId']>();
  });

  it('starts a created opportunity history with fromStageId null and toStageId set', async () => {
    const row = await createFresh();
    const history = await settle(fakeListStageHistory(row.id, null));
    const first = history.items.at(-1)!;
    expect(first.fromStageId).toBeNull();
    expect(first.toStageId).toBe('ps-sales-1');
  });
});

describe('filterTree', () => {
  const FIELDS = [
    'pipelineId', 'stageId', 'stageFlag', 'stageCategory', 'status', 'ownerUserId', 'ownerTeamId', 'createdByUserId',
    'customerProfileId', 'customerPartyId', 'customerProfileType', 'customerStatus', 'contactPartyId', 'leadId',
    'leadSourceId', 'title', 'description', 'amount', 'currencyCode', 'probabilityPercent', 'importance', 'cardColor',
    'tagIds', 'expectedCloseDate', 'activityState', 'nextOpenActivityAt', 'openActivityCount', 'daysInStage',
    'lostReasonId', 'winReasonId', 'lostReason', 'createdAt', 'updatedAt', 'wonAt', 'lostAt',
    'id', 'branchId', 'forecastCategory',
  ];

  // tagIds accepts only anyOf / allOf / noneOf (OPPORTUNITY_FILTER_FIELD_SPECS); every other field accepts isNotNull.
  const leafOf = (field: string): WireNode =>
    field === 'tagIds' ? { field, operator: 'anyOf', value: ['tag-001'] } : { field, operator: 'isNotNull' };

  it.each(FIELDS)('accepts the catalogue field %s', async (field) => {
    const page = await settle(fakeSearchOpportunities({ ...ALL, filterTree: leafOf(field) }, 1, 10));
    expect(Array.isArray(page.items)).toBe(true);
  });

  it('accepts the whole field list in one OR tree', async () => {
    const tree: WireNode = { op: 'OR', children: FIELDS.map(leafOf) };
    const page = await settle(fakeSearchOpportunities({ ...ALL, filterTree: tree }, 1, 10));
    expect(page.total).toBeGreaterThan(0);
  });

  it('throws INVALID_FIELD on an unknown field, also when nested and on the board', async () => {
    await expectApiError(
      fakeSearchOpportunities({ ...ALL, filterTree: { field: 'nope', operator: 'eq', value: 'x' } }, 1, 10),
      400,
      'INVALID_FIELD',
    );
    const nested: WireNode = { op: 'AND', children: [{ field: 'status', operator: 'eq', value: 'WON' }, { field: 'bogus', operator: 'isNull' }] };
    await expectApiError(fakeSearchOpportunities({ ...ALL, filterTree: nested }, 1, 10), 400, 'INVALID_FIELD');
    await expectApiError(fakeLoadBoard(SALES_PIPELINE_ID, { ...ALL, limitPerStage: 0, filterTree: nested }), 400, 'INVALID_FIELD');
  });

  it('filters amount exactly as a decimal', async () => {
    const page = await settle(
      fakeSearchOpportunities({ ...ALL, filterTree: { field: 'amount', operator: 'gte', value: '9999999999999999.99' } }, 1, 100),
    );
    expect(page.items.length).toBeGreaterThan(0);
    for (const row of page.items) expect(scaled(row.amount!) >= scaled('9999999999999999.99')).toBe(true);
  });
});

describe('create rules', () => {
  it('applies cardColor and tagIds and returns the Acme customer fields', async () => {
    const row = await createFresh({ cardColor: 'RED', tagIds: ['tag-001'] });
    expect(row.cardColor).toBe('RED');
    expect(row.tags.map((t) => t.id)).toEqual(['tag-001']);
    expect(row.status).toBe('IN_PROGRESS');
  });

  it('rejects unknown and blacklisted customers', async () => {
    await expectApiError(
      fakeCreateOpportunity(baseCreate({ customerProfileId: '00000000-0000-7000-8000-000000000000' }), newKey()),
      404,
      'CUSTOMER_PROFILE_NOT_FOUND',
    );
    const blacklisted = CUSTOMERS_FAKE_DB.find((c) => c.status === 'BLACKLISTED')!;
    await expectApiError(
      fakeCreateOpportunity(baseCreate({ customerProfileId: blacklisted.id }), newKey()),
      409,
      'CUSTOMER_PROFILE_BLACKLISTED',
    );
  });

  it('rejects terminal and inactive stages', async () => {
    await expectApiError(fakeCreateOpportunity(baseCreate({ stageId: 'ps-sales-6' }), newKey()), 422, 'OPPORTUNITY_CREATE_STAGE_TERMINAL');
    await expectApiError(fakeCreateOpportunity(baseCreate({ stageId: 'ps-sales-7' }), newKey()), 422, 'OPPORTUNITY_CREATE_STAGE_TERMINAL');
    await expectApiError(
      fakeCreateOpportunity(baseCreate({ pipelineId: PROJECTS_PIPELINE_ID, stageId: 'ps-proj-7' }), newKey()),
      404,
      'PIPELINE_STAGE_NOT_FOUND',
    );
  });

  it('requires a currency with an amount', async () => {
    await expectApiError(fakeCreateOpportunity(baseCreate({ amount: '100' }), newKey()), 422, 'OPPORTUNITY_AMOUNT_CURRENCY_REQUIRED');
  });

  it('rejects a contact of another customer', async () => {
    await expectApiError(
      fakeCreateOpportunity(baseCreate({ contactPartyId: '00000000-0000-7000-8000-00000000dead' }), newKey()),
      422,
      'OPPORTUNITY_CONTACT_CUSTOMER_MISMATCH',
    );
  });

  it('replays the same key with the same body and rejects another body', async () => {
    const key = newKey();
    const first = await settle(fakeCreateOpportunity(baseCreate({ title: 'Idem' }), key));
    const replay = await settle(fakeCreateOpportunity(baseCreate({ title: 'Idem' }), key));
    expect(replay.id).toBe(first.id);
    await expectApiError(fakeCreateOpportunity(baseCreate({ title: 'Other' }), key), 409, 'OPPORTUNITY_CREATE_IDEMPOTENCY_MISMATCH');
  });
});

describe('patch rules', () => {
  it('rejects a stale expectedUpdatedAt with CONCURRENT_UPDATE', async () => {
    const row = await createFresh();
    await expectApiError(
      fakePatchOpportunity(row.id, { expectedUpdatedAt: '2000-01-01T00:00:00.000Z', title: 'x' }),
      409,
      'CRM.OPPORTUNITY.CONCURRENT_UPDATE',
    );
  });

  it('bumps updatedAt and null clears nullable fields', async () => {
    const row = await createFresh({ amount: '10', currencyCode: 'USD', description: 'd', probabilityPercent: 40, expectedCloseDate: '2027-01-01' });
    const patched = await settle(
      fakePatchOpportunity(row.id, {
        expectedUpdatedAt: row.updatedAt,
        amount: null,
        currencyCode: null,
        description: null,
        probabilityPercent: null,
        expectedCloseDate: null,
        cardColor: null,
      }),
    );
    expect(patched.updatedAt > row.updatedAt).toBe(true);
    expect(patched.amount).toBeNull();
    expect(patched.currencyCode).toBeNull();
    expect(patched.description).toBeNull();
    expect(patched.probabilityPercent).toBeNull();
    expect(patched.expectedCloseDate).toBeNull();
    await expectApiError(fakePatchOpportunity(row.id, { expectedUpdatedAt: row.updatedAt, title: 'y' }), 409, 'CRM.OPPORTUNITY.CONCURRENT_UPDATE');
  });
});

describe('move rules', () => {
  it('rejects a stale expectedUpdatedAt with STALE_MOVE and accepts the current one', async () => {
    const row = await createFresh();
    await expectApiError(
      fakeMoveOpportunityStage(row.id, { stageId: 'ps-sales-2', expectedUpdatedAt: '2000-01-01T00:00:00.000Z' }),
      409,
      'CRM.OPPORTUNITY.STALE_MOVE',
    );
    const moved = await settle(fakeMoveOpportunityStage(row.id, { stageId: 'ps-sales-2', expectedUpdatedAt: row.updatedAt }));
    expect(moved.stageId).toBe('ps-sales-2');
    expect(moved.updatedAt > row.updatedAt).toBe(true);
    const history = await settle(fakeListStageHistory(row.id, null));
    expect(history.items[0].fromStageId).toBe('ps-sales-1');
    expect(history.items[0].toStageId).toBe('ps-sales-2');
  });

  it('rejects a stage outside the pipeline', async () => {
    const row = await createFresh();
    await expectApiError(fakeMoveOpportunityStage(row.id, { stageId: 'ps-proj-2' }), 404, 'PIPELINE_STAGE_NOT_FOUND');
  });

  it('needs a lost reason, sets lostAt, and reopen clears it', async () => {
    const row = await createFresh();
    await expectApiError(fakeMoveOpportunityStage(row.id, { stageId: 'ps-sales-7' }), 422, 'OPPORTUNITY_LOST_REASON_REQUIRED');
    await expectApiError(fakeMoveOpportunityStage(row.id, { stageId: 'ps-sales-7', lostReason: '   ' }), 422, 'OPPORTUNITY_LOST_REASON_REQUIRED');
    const lost = await settle(fakeMoveOpportunityStage(row.id, { stageId: 'ps-sales-7', lostReason: 'Too expensive' }));
    expect(lost.status).toBe('LOST');
    expect(lost.lostAt).not.toBeNull();
    expect(lost.lostReason).toBe('Too expensive');
    const reopened = await settle(fakeMoveOpportunityStage(row.id, { stageId: 'ps-sales-3' }));
    expect(reopened.status).toBe('IN_PROGRESS');
    expect(reopened.lostAt).toBeNull();
    expect(reopened.lostReason).toBeNull();
  });

  it('rejects a reason id of the wrong kind and sets wonAt on WON', async () => {
    const row = await createFresh();
    const loss = (await settle(fakeGetOpportunityReasons({ kind: 'LOSS' }))).items;
    await expectApiError(
      fakeMoveOpportunityStage(row.id, { stageId: 'ps-sales-6', winReasonId: loss[0].id }),
      422,
      'CRM_REASON_KIND_MISMATCH',
    );
    const won = await settle(fakeMoveOpportunityStage(row.id, { stageId: 'ps-sales-6' }));
    expect(won.status).toBe('WON');
    expect(won.wonAt).not.toBeNull();
  });

  it('refuses WON for a blacklisted customer', async () => {
    const page = await settle(
      fakeSearchOpportunities(
        { ...ALL, filterTree: { op: 'AND', children: [
          { field: 'customerStatus', operator: 'eq', value: 'BLACKLISTED' },
          { field: 'pipelineId', operator: 'eq', value: SALES_PIPELINE_ID },
          { field: 'status', operator: 'in', value: ['IN_PROGRESS', 'ON_HOLD'] },
        ] } },
        1,
        5,
      ),
    );
    if (page.items.length === 0) return; // no such seed in this run
    await expectApiError(fakeMoveOpportunityStage(page.items[0].id, { stageId: 'ps-sales-6' }), 409, 'CUSTOMER_PROFILE_BLACKLISTED');
  });
});

describe('transfer rules', () => {
  it('rejects the same pipeline and a stale expectedUpdatedAt', async () => {
    const row = await createFresh();
    await expectApiError(fakeTransferOpportunityPipeline(row.id, { pipelineId: SALES_PIPELINE_ID }, newKey()), 422, 'OPPORTUNITY_PIPELINE_UNCHANGED');
    await expectApiError(
      fakeTransferOpportunityPipeline(row.id, { pipelineId: PROJECTS_PIPELINE_ID, expectedUpdatedAt: '2000-01-01T00:00:00.000Z' }, newKey()),
      409,
      'CRM.OPPORTUNITY.STALE_MOVE',
    );
  });

  it('defaults to the target NEW stage', async () => {
    const row = await createFresh();
    const moved = await settle(fakeTransferOpportunityPipeline(row.id, { pipelineId: PROJECTS_PIPELINE_ID, expectedUpdatedAt: row.updatedAt }, newKey()));
    expect(moved.pipelineId).toBe(PROJECTS_PIPELINE_ID);
    expect(moved.stageId).toBe('ps-proj-1');
    expect(moved.stageFlag).toBe('NEW');
    const detail = await settle(fakeGetOpportunity(row.id));
    expect(detail.pipelineId).toBe(PROJECTS_PIPELINE_ID);
  });
});

describe('api wrappers and error keys', () => {
  it('listOwners is refused with 403 for a branch without a grant (assignable-owners: scopedAccess.resolve throws first)', async () => {
    const branchId = '00000000-0000-7000-8000-00000000beef';
    const companyId = '019f0000-0000-7000-8000-000000000010';
    TestBed.configureTestingModule({ providers: [{ provide: AuthSession, useValue: {
      status: () => 'signed-in',
      me: () => ({ ...FAKE_TENANT_ME, accessibleCompanies: [companyId], accessibleBranches: [branchId],
        accessibleBranchCompanies: [{ branchId, companyId }] }),
    } }] });
    const stub = new CrmHttpStub();
    const read = vi.spyOn(stub, 'read').mockRejectedValue(new ApiError(403, 'CRM_SCOPED_PERMISSION_DENIED'));
    const dispose = bindCrmHttpForTest(stub);
    try {
      await expectApiError(listOwners(branchId), 403, 'CRM_SCOPED_PERMISSION_DENIED');
      expect(read).toHaveBeenCalledWith('/assignable-owners', {
        branchId, resource: 'opportunities', action: 'create', cursor: undefined, limit: 100,
      }, { scope: { companyId, branchId } });
    } finally {
      read.mockRestore();
      dispose();
    }
  });

  it('maps OPPORTUNITY_FILTER_TAGS_CONFLICT and OPPORTUNITY_PIPELINE_MISMATCH with en and ar sentences', () => {
    const enErrors = (en as { errors: Record<string, string> }).errors;
    const arErrors = (ar as { errors: Record<string, string> }).errors;
    for (const code of ['OPPORTUNITY_FILTER_TAGS_CONFLICT', 'OPPORTUNITY_PIPELINE_MISMATCH', 'CRM.OPPORTUNITY.STALE_MOVE']) {
      expect(OPPORTUNITY_ERROR_KEYS[code]).toBe(`opportunities.errors.${code}`);
      expect(enErrors[code]?.length).toBeGreaterThan(0);
      expect(arErrors[code]?.length).toBeGreaterThan(0);
    }
  });

  it('falls back to the shared apiErrors message for gateway idempotency codes', () => {
    expect(opportunitySharedErrorKey('GW.IDEM.MISMATCH')).toBe('apiErrors.idempotencyMismatch');
    expect(opportunitySharedErrorKey('GW.IDEM.IN_FLIGHT')).toBe('apiErrors.idempotency');
    expect(opportunitySharedErrorKey('GW.IDEM.MISSING')).toBe('apiErrors.idempotencyKey');
    expect(opportunitySharedErrorKey('OPPORTUNITY_PIPELINE_UNCHANGED')).toBeNull();
  });

  it('has an en and ar sentence for every mapped error key', () => {
    const enErrors = (en as { errors: Record<string, string> }).errors;
    const arErrors = (ar as { errors: Record<string, string> }).errors;
    for (const code of Object.keys(OPPORTUNITY_ERROR_KEYS)) {
      if (code === 'OPPORTUNITY_AMOUNT_SCALE_INVALID') {
        expect(enForm.errors.OPPORTUNITY_AMOUNT_SCALE_INVALID).toBeTruthy();
        expect(arForm.errors.OPPORTUNITY_AMOUNT_SCALE_INVALID).toBeTruthy();
        continue;
      }
      if (code === 'OPPORTUNITY_HISTORY_INTEGRITY_INVALID') {
        expect(enPage.stages.integrityFailed).toBeTruthy();
        expect(arPage.stages.integrityFailed).toBeTruthy();
        continue;
      }
      expect(enErrors[code], `en ${code}`).toBeTruthy();
      expect(arErrors[code], `ar ${code}`).toBeTruthy();
    }
  });

  it('keeps the Acme seed exact', async () => {
    const acme = await settle(fakeGetOpportunity(ACME_OPPORTUNITY_ID));
    expect(acme.amount).toBe('250000.00000000');
    expect(acme.currencyCode).toBe('EGP');
    expect(acme.customerProfileId).toBe(ACME_CUSTOMER_ID);
  });
});

describe('backend contract alignment', () => {
  it('reasons: { items } of active reasons of the required kind, in the narrow picker view', async () => {
    const stub = new CrmHttpStub({ '/opportunities/reasons': { items: [{
      id: 'win-reason', code: 'VALUE', nameEn: 'Value', nameAr: 'Value',
      definitionEn: 'Selected for value', definitionAr: 'Selected for value',
      polarity: 'POSITIVE', reasonKind: 'WIN', sortOrder: 1,
    }] } });
    const dispose = bindCrmHttpForTest(stub);
    const res = await settle(listReasons({ kind: 'WIN' })).finally(dispose);
    expect(stub.recordedReads()).toEqual([{ path: '/opportunities/reasons', query: { kind: 'WIN' }, scope: undefined }]);
    expect(Array.isArray(res.items)).toBe(true);
    expect(res.items.length).toBeGreaterThan(0);
    for (const item of res.items) {
      expect(item.reasonKind).toBe('WIN');
      expect(Object.keys(item).sort()).toEqual(
        ['code', 'definitionAr', 'definitionEn', 'id', 'nameAr', 'nameEn', 'polarity', 'reasonKind', 'sortOrder'],
      );
    }
    const orders = res.items.map((r) => r.sortOrder);
    expect(orders).toEqual([...orders].sort((a, b) => a - b));
    await expectApiError(fakeGetOpportunityReasons({ kind: 'BAD' as 'WIN' }), 400, 'CRM_VALIDATION_FAILED');
  });

  it('capabilities: the wire is { branchId, opportunities }; the api unwraps it', async () => {
    const wire = await settle(fakeGetOpportunityCapabilities(BRANCH));
    expect(wire.branchId).toBe(BRANCH);
    expect(wire.opportunities.bulk.createActivity).not.toBeNull();
    const companyId = '019f0000-0000-7000-8000-000000000010';
    const branchId = '019f0000-0000-7000-8000-000000000011';
    TestBed.configureTestingModule({ providers: [{ provide: AuthSession, useValue: {
      status: () => 'signed-in', me: () => ({ ...FAKE_TENANT_ME, accessibleCompanies: [companyId],
        accessibleBranches: [branchId], accessibleBranchCompanies: [{ branchId, companyId }] }),
    } }] });
    const dispose = bindCrmHttpForTest(new CrmHttpStub({ '/opportunities/capabilities': { branchId, opportunities: wire.opportunities } }));
    try { expect(await getOpportunityCapabilities(branchId)).toEqual(wire.opportunities); }
    finally { dispose(); }
    await expectApiError(fakeGetOpportunityCapabilities(''), 400, 'CRM_VALIDATION_FAILED');
  });

  it('search, board, stage page and selection require branchId (400 with snake_case details)', async () => {
    const noBranch = { branchId: '' } as OpportunitySearchBody;
    let caught: unknown;
    try {
      await settle(fakeSearchOpportunities(noBranch, 1, 10));
    } catch (error) {
      caught = error;
    }
    expect((caught as ApiError).code).toBe('CRM_VALIDATION_FAILED');
    expect((caught as ApiError).details).toEqual({ branchId: ['is_uuid'] });
    await expectApiError(fakeLoadBoard(SALES_PIPELINE_ID, { ...noBranch, limitPerStage: 0 }), 400, 'CRM_VALIDATION_FAILED');
    await expectApiError(
      fakeLoadStagePage(SALES_PIPELINE_ID, 'ps-sales-1', { ...noBranch, limit: 50, cursor: '' }),
      400,
      'CRM_VALIDATION_FAILED',
    );
    await expectApiError(fakeSelectOpportunities(noBranch, 10), 400, 'CRM_VALIDATION_FAILED');
    await expectApiError(fakeSelectOpportunities(ALL, 10_001), 422, 'OPPORTUNITY_SELECTION_TOO_LARGE');
  });

  it('filter tree and sort errors use the backend codes', async () => {
    const emptyGroup = await expectApiError(
      fakeSearchOpportunities({ ...ALL, filterTree: { op: 'AND', children: [] } }, 1, 10),
      400,
      'INVALID_FILTER_TREE',
    );
    expect(emptyGroup.details).toEqual({ path: ['filterTree'], reason: ['empty_group'] });
    let caught: unknown;
    try {
      await settle(fakeSearchOpportunities({ ...ALL, filterTree: { field: 'title', operator: 'gt', value: 'a' } }, 1, 10));
    } catch (error) {
      caught = error;
    }
    expect((caught as ApiError).code).toBe('INVALID_OPERATOR_VALUE');
    expect((caught as ApiError).details).toEqual({
      path: ['filterTree'],
      field: ['title'],
      operator: ['gt'],
      reason: ['operator_not_allowed'],
    });
    await expectApiError(fakeSearchOpportunities({ ...ALL, sort: 'customerDisplayName:ASC' }, 1, 10), 400, 'INVALID_FIELD');
    await expectApiError(
      fakeSearchOpportunities(
        { ...ALL, tagIds: ['tag-001'], filterTree: { field: 'tagIds', operator: 'noneOf', value: ['tag-001'] } },
        1,
        10,
      ),
      422,
      'OPPORTUNITY_FILTER_TAGS_CONFLICT',
    );
  });

  it('create: DTO first, then the idempotency key, then the service rules', async () => {
    await expectApiError(fakeCreateOpportunity(baseCreate({ title: ' ' }), 'not-a-key'), 400, 'CRM_VALIDATION_FAILED');
    await expectApiError(fakeCreateOpportunity(baseCreate(), 'not-a-key'), 400, 'OPPORTUNITY_CREATE_IDEMPOTENCY_INVALID');
    const row = await createFresh({ description: '  kept as sent  ' });
    expect(row.description).toBe('  kept as sent  ');
    expect(row.contactPartyId).toBeNull();
    expect('lostReasonId' in row).toBe(false);
    expect('winReasonId' in row).toBe(false);
  });

  it('patch: 404 first; currency null needs amount null; owner cannot be cleared', async () => {
    await expectApiError(
      fakePatchOpportunity('missing', { expectedUpdatedAt: '2026-01-01T00:00:00.000Z' }),
      404,
      'OPPORTUNITY_NOT_FOUND',
    );
    const row = await createFresh({ amount: '5', currencyCode: 'USD' });
    await expectApiError(
      fakePatchOpportunity(row.id, { expectedUpdatedAt: row.updatedAt, currencyCode: null }),
      400,
      'CRM_VALIDATION_FAILED',
    );
    await expectApiError(
      fakePatchOpportunity(row.id, { expectedUpdatedAt: row.updatedAt, ownerUserId: null as unknown as string }),
      400,
      'CRM_VALIDATION_FAILED',
    );
    const patched = await settle(
      fakePatchOpportunity(row.id, { expectedUpdatedAt: row.updatedAt, amount: '7', currencyCode: 'usd' }),
    );
    expect(patched.amount).toBe('7.00000000');
    expect(patched.currencyCode).toBe('USD');
  });

  it('move: same stage is a no-op success; lostReason stores the note only', async () => {
    const row = await createFresh();
    const same = await settle(fakeMoveOpportunityStage(row.id, { stageId: 'ps-sales-1' }));
    expect(same.stageId).toBe('ps-sales-1');
    const history = await settle(fakeListStageHistory(row.id, null));
    expect(history.items).toHaveLength(1);
    const loss = (await settle(fakeGetOpportunityReasons({ kind: 'LOSS' }))).items;
    const lost = await settle(fakeMoveOpportunityStage(row.id, { stageId: 'ps-sales-7', lostReasonId: loss[0].id }));
    expect(lost.lostReason).toBeNull();
    expect(lost.lostReasonRef?.id).toBe(loss[0].id);
  });

  it('transfer: requires a UUIDv7 x-idempotency-key and replays the same key', async () => {
    const row = await createFresh();
    await expectApiError(
      fakeTransferOpportunityPipeline(row.id, { pipelineId: PROJECTS_PIPELINE_ID }, 'bad'),
      400,
      'GW.IDEM.BAD_VALUE',
    );
    const key = newKey();
    const moved = await settle(fakeTransferOpportunityPipeline(row.id, { pipelineId: PROJECTS_PIPELINE_ID }, key));
    const replay = await settle(fakeTransferOpportunityPipeline(row.id, { pipelineId: PROJECTS_PIPELINE_ID }, key));
    expect(replay).toEqual(moved);
  });

  it('stage history: an unknown cursor is 400 OPPORTUNITY_HISTORY_CURSOR_INVALID', async () => {
    await expectApiError(fakeListStageHistory(ACME_OPPORTUNITY_ID, 'garbage'), 400, 'OPPORTUNITY_HISTORY_CURSOR_INVALID');
  });

  it('tags: unknown 422, already attached 409, missing link 404, no updatedAt bump', async () => {
    const row = await createFresh({ tagIds: ['tag-001'] });
    await expectApiError(fakeAttachOpportunityTags(row.id, ['nope']), 422, 'CRM_TAG_UNKNOWN');
    await expectApiError(fakeAttachOpportunityTags(row.id, ['tag-001']), 409, 'CRM_RECORD_TAG_ALREADY_ATTACHED');
    await expectApiError(fakeAttachOpportunityTags(row.id, []), 400, 'CRM_VALIDATION_FAILED');
    await expectApiError(fakeDetachOpportunityTag(row.id, 'tag-999'), 404, 'CRM_RECORD_TAG_NOT_FOUND');
    await settle(fakeDetachOpportunityTag(row.id, 'tag-001'));
    expect(await settle(fakeListOpportunityTags(row.id))).toEqual([]);
    expect((await settle(fakeGetOpportunity(row.id))).updatedAt).toBe(row.updatedAt);
  });

  it('tags: list and attach answer TagView with createdAt and updatedAt; rows keep the summary', async () => {
    const row = await createFresh({ tagIds: ['tag-001'] });
    const attached = await settle(fakeAttachOpportunityTags(row.id, ['tag-002']));
    const listed = await settle(fakeListOpportunityTags(row.id));
    for (const tag of [...attached, ...listed]) {
      expect(Object.keys(tag).sort()).toEqual(['backgroundColor', 'createdAt', 'id', 'name', 'textColor', 'updatedAt']);
      expect(Number.isNaN(Date.parse(tag.createdAt))).toBe(false);
      expect(Number.isNaN(Date.parse(tag.updatedAt))).toBe(false);
    }
    const detail = await settle(fakeGetOpportunity(row.id));
    for (const tag of detail.tags) {
      expect(Object.keys(tag).sort()).toEqual(['backgroundColor', 'id', 'name', 'textColor']);
    }
  });

  it('create without a currency stores the workspace default currency', async () => {
    const row = await createFresh();
    expect(row.currencyCode).toBe('EGP');
    const sent = await createFresh({ amount: '5', currencyCode: 'USD' });
    expect(sent.currencyCode).toBe('USD');
  });

  it('delete: reason over 1000 is 400, unknown id is 404', async () => {
    await expectApiError(fakeDeleteOpportunity('missing', 'x'.repeat(1001)), 400, 'CRM_VALIDATION_FAILED');
    await expectApiError(fakeDeleteOpportunity('missing'), 404, 'OPPORTUNITY_NOT_FOUND');
  });
});
