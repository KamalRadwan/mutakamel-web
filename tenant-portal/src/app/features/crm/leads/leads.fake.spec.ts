import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../settings/shared/settings-api';
import { LeadSearchBody } from './lead-search/lead-search.compile';
import {
  fakeBoard,
  fakeBulkDelete,
  fakeBulkStage,
  fakeBulkUpdate,
  fakeCheckLeadDuplicates,
  fakeListDisqualificationReasons,
  fakeCreateLead,
  fakeGetLead,
  fakeGetLeadCapabilities,
  fakeLeadKpis,
  fakeListCompanyContacts,
  fakeListCompanyOptions,
  FAKE_INACTIVE_COMPANY_ID,
  fakeMove,
  fakePatchLead,
  fakeSearch,
  fakeSelectLeads,
  fakeStagePage,
  fakeUpdateLead,
} from './leads.fake';
import { BOARD_LIMIT, LeadMoveError, stageCountsOf, validationPaths } from './leads.model';

/** Runs the fake 300ms timers to completion and returns (or rethrows) the settled result. */
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

const KEY_A = '0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b';
const KEY_B = '0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5c';
const ALL: LeadSearchBody = { branchId: 'b1' };

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('leads fake search', () => {
  it('returns the first page with paging metadata', async () => {
    const page = await settle(fakeSearch(ALL, 1, 10));

    expect(page.items).toHaveLength(10);
    expect(page.page).toBe(1);
    expect(page.limit).toBe(10);
    expect(page.hasPrev).toBe(false);
    expect(page.hasNext).toBe(page.totalPages > 1);
  });

  it('returns a disjoint second page and flags hasPrev', async () => {
    const first = await settle(fakeSearch(ALL, 1, 10));
    const second = await settle(fakeSearch(ALL, 2, 10));

    expect(second.hasPrev).toBe(true);
    const firstIds = new Set(first.items.map((item) => item.id));
    expect(second.items.some((item) => firstIds.has(item.id))).toBe(false);
  });

  it('returns an empty slice past the last page with the real page count', async () => {
    const page = await settle(fakeSearch(ALL, 9999, 10));

    expect(page.items).toEqual([]);
    expect(page.totalPages).toBe(Math.ceil(page.total / 10));
    expect(page.hasNext).toBe(false);
    expect(page.hasPrev).toBe(true);
  });

  it('reports totalPages 0 and no previous page for an empty result, like the backend', async () => {
    const page = await settle(fakeSearch({ branchId: 'br-unknown' }, 2, 10));

    expect(page).toMatchObject({ items: [], total: 0, totalPages: 0, hasNext: false, hasPrev: false });
  });

  it('keeps every row inside the requested branch', async () => {
    const page = await settle(fakeSearch(ALL, 1, 100));
    const details = await Promise.all(page.items.slice(0, 5).map((row) => settle(fakeGetLead(row.id))));

    expect(details.every((detail) => detail.branchId === 'b1')).toBe(true);
  });

  it('returns the full PartyAddressView on each row', async () => {
    const row = (await settle(fakeSearch(ALL, 1, 1))).items[0];

    expect(row.address).toMatchObject({ addressType: 'PRIMARY', countryId: expect.any(String) });
    expect(row.address?.countryName).toMatchObject({ id: row.address?.countryId });
    expect(row.address).toHaveProperty('street');
    expect(row.address).toHaveProperty('apartment');
  });

  it('narrows results by stage and every row matches', async () => {
    const page = await settle(fakeSearch({ ...ALL, filterTree: { field: 'stageId', operator: 'eq', value: 'stage-new' } }, 1, 100));

    expect(page.total).toBeGreaterThan(0);
    expect(page.items.every((item) => item.stageId === 'stage-new')).toBe(true);
  });

  it('rejects an unknown wire field with an ApiError', async () => {
    await expect(
      settle(fakeSearch({ ...ALL, filterTree: { field: 'notAField', operator: 'eq', value: 'x' } }, 1, 10)),
    ).rejects.toBeInstanceOf(ApiError);
  });
});

describe('leads fake board', () => {
  it('returns one lane per stage in sort order inside { stages }', async () => {
    const lanes = (await settle(fakeBoard(ALL))).stages;

    expect(lanes.map((lane) => lane.stage.id)).toEqual([
      'stage-new',
      'stage-contacted',
      'stage-qualifying',
      'stage-qualified',
      'stage-disqualified',
      'stage-converted',
    ]);
  });

  it('puts only leads of the lane stage into each lane and caps lane size', async () => {
    const lanes = (await settle(fakeBoard(ALL))).stages;

    for (const lane of lanes) {
      expect(lane.items.length).toBeLessThanOrEqual(BOARD_LIMIT);
      expect(lane.items.every((item) => item.stageId === lane.stage.id)).toBe(true);
    }
  });

  it('derives stage counts from the board lane totals', async () => {
    const board = await settle(fakeBoard(ALL));
    const counts = stageCountsOf(board);

    expect(counts.total).toBe(board.stages.reduce((sum, lane) => sum + lane.total, 0));
    for (const lane of board.stages) {
      expect(counts.byStage[lane.stage.id]).toBe(lane.total);
    }
  });

  it('returns the six backend KPIs for the same filters', async () => {
    const board = await settle(fakeBoard(ALL));
    const kpis = await settle(fakeLeadKpis(ALL));
    const laneTotal = (flag: string) => board.stages.find((lane) => lane.stage.flag === flag)?.total ?? 0;

    expect(Object.keys(kpis).sort()).toEqual(
      ['hotLeads', 'newStageLeads', 'newTodayLeads', 'overdueActivityLeads', 'qualifiedLeads', 'totalLeads'].sort(),
    );
    expect(kpis.totalLeads).toBe(stageCountsOf(board).total);
    expect(kpis.newStageLeads).toBe(laneTotal('NEW'));
    expect(kpis.qualifiedLeads).toBe(laneTotal('QUALIFIED'));
  });

  it('throws a 404 LEAD_STAGE_NOT_FOUND ApiError for an unknown stage page', async () => {
    await expect(settle(fakeStagePage('stage-nope', ALL, 1))).rejects.toMatchObject({
      status: 404,
      code: 'LEAD_STAGE_NOT_FOUND',
    });
  });

  it('pages a single stage lane', async () => {
    const lane = await settle(fakeStagePage('stage-new', ALL, 1));

    expect(lane.stage.id).toBe('stage-new');
    expect(lane.page).toBe(1);
  });
});

describe('leads fake move', () => {
  async function firstNewLeadId(): Promise<string> {
    const board = await settle(fakeBoard(ALL));
    return board.stages.find((l) => l.stage.id === 'stage-new')!.items[0].id;
  }

  it('moves an open lead to another active stage and returns the lead detail', async () => {
    const moved = await settle(fakeMove(await firstNewLeadId(), 'stage-qualified'));

    expect(moved.stageId).toBe('stage-qualified');
    expect(moved.stageFlag).toBe('QUALIFIED');
    expect(moved.contacts).toBeDefined();
  });

  it('disqualifies with a governed reason', async () => {
    const reasonId = (await settle(fakeListDisqualificationReasons()))[0].id;
    const moved = await settle(fakeMove(await firstNewLeadId(), 'stage-disqualified', reasonId));

    expect(moved.status).toBe('DISQUALIFIED');
  });

  it('refuses an unknown reason with CRM_REASON_UNAVAILABLE', async () => {
    const error = await settle(fakeMove(await firstNewLeadId(), 'stage-disqualified', 'reason-nope')).catch((e: unknown) => e);

    expect(error).toMatchObject({ status: 422, code: 'CRM_REASON_UNAVAILABLE' });
  });

  it('refuses a reason on a move that does not disqualify', async () => {
    const error = await settle(fakeMove(await firstNewLeadId(), 'stage-contacted', 'reason-any')).catch((e: unknown) => e);

    expect(error).toMatchObject({ status: 422, code: 'CRM_REASON_KIND_MISMATCH' });
  });

  it('requires the conversion flow when the target stage is Converted', async () => {
    const error = await settle(fakeMove(await firstNewLeadId(), 'stage-converted')).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(LeadMoveError);
    expect((error as LeadMoveError).code).toBe('LEAD_CONVERSION_REQUIRED');
  });

  it('requires a reason when the target stage is Disqualified', async () => {
    const error = await settle(fakeMove(await firstNewLeadId(), 'stage-disqualified')).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 422, code: 'CRM_REASON_REQUIRED' });
  });

  it('rejects an unknown stage with LEAD_STAGE_INVALID', async () => {
    const error = await settle(fakeMove('lead-001', 'stage-nope')).catch((e: unknown) => e);

    expect((error as LeadMoveError).code).toBe('LEAD_STAGE_INVALID');
  });

  it('rejects an unknown lead with a 404 ApiError', async () => {
    await expect(settle(fakeMove('lead-nope', 'stage-new'))).rejects.toMatchObject({ status: 404, code: 'LEAD_NOT_FOUND' });
  });

  it('refuses to move a converted lead', async () => {
    const converted = (
      await settle(fakeSearch({ ...ALL, filterTree: { field: 'status', operator: 'eq', value: 'CONVERTED' } }, 1, 1))
    ).items[0];
    expect(converted).toBeDefined();

    const error = await settle(fakeMove(converted.id, 'stage-nope')).catch((e: unknown) => e);

    expect(error).toMatchObject({ status: 409, code: 'LEAD_ALREADY_CONVERTED' });
  });
});

describe('leads fake duplicate check chain', () => {
  const BRANCH = { branchId: 'b1' };

  async function sampleDetail() {
    const lead = (await settle(fakeSearch(ALL, 1, 1))).items[0];
    return settle(fakeGetLead(lead.id));
  }

  it('rejects an empty probe', async () => {
    await expect(settle(fakeCheckLeadDuplicates({ ...BRANCH }))).rejects.toMatchObject({
      code: 'LEAD_DUPLICATE_CHECK_EMPTY',
    });
  });

  it('ignores phones with fewer than five digits', async () => {
    await expect(settle(fakeCheckLeadDuplicates({ ...BRANCH, phones: ['12-3'] }))).rejects.toMatchObject({
      code: 'LEAD_DUPLICATE_CHECK_EMPTY',
    });
  });

  it('matches an existing lead by name case-insensitively', async () => {
    const detail = await sampleDetail();

    const { matches } = await settle(
      fakeCheckLeadDuplicates({ branchId: detail.branchId, name: detail.displayName.toUpperCase() }),
    );

    const hit = matches.find((m) => m.partyId === detail.partyId);
    expect(hit?.matchTypes).toContain('NAME');
    expect(hit?.restricted).toBe(false);
  });

  it('hides display name and leads for a match in another branch', async () => {
    const detail = await sampleDetail();
    const otherBranch = detail.branchId === 'b1' ? 'b2' : 'b1';

    const { matches } = await settle(fakeCheckLeadDuplicates({ branchId: otherBranch, name: detail.displayName }));

    const hit = matches.find((m) => m.partyId === detail.partyId);
    expect(hit?.restricted).toBe(true);
    expect(hit?.displayName).toBeNull();
    expect(hit?.leads).toEqual([]);
  });

  it('skips the excluded party', async () => {
    const detail = await sampleDetail();

    const { matches } = await settle(
      fakeCheckLeadDuplicates({ branchId: detail.branchId, name: detail.displayName, excludePartyId: detail.partyId }),
    );

    expect(matches.some((m) => m.partyId === detail.partyId)).toBe(false);
  });

  it('finds a freshly created lead by email in the same branch', async () => {
    const created = await settle(
      fakeCreateLead(
        {
          leadProfileType: 'INDIVIDUAL',
          branchId: 'b1',
          firstName: 'Dupe',
          lastName: 'Probe',
          email: 'dupe.probe@example.com',
          customFields: { budget_range: 'low' },
        },
        KEY_A,
      ),
    );

    const { matches } = await settle(
      fakeCheckLeadDuplicates({ branchId: 'b1', email: 'DUPE.PROBE@example.com', ownerUserId: 'u1' }),
    );

    const hit = matches.find((m) => m.partyId === created.partyId);
    expect(hit?.matchTypes).toContain('EMAIL');
    expect(hit?.leads?.map((l) => l.id)).toContain(created.id);
    expect(hit?.contactMethods).toEqual([{ methodType: 'EMAIL', wouldBlock: true, level: 'SAME_OWNER' }]);
    expect(hit).toMatchObject({ wouldBlock: true, level: 'SAME_OWNER' });
  });

  it('reports a name-only match without a blocking level', async () => {
    const detail = await sampleDetail();

    const { matches } = await settle(fakeCheckLeadDuplicates({ branchId: detail.branchId, name: detail.displayName }));

    const hit = matches.find((m) => m.partyId === detail.partyId);
    expect(hit).toMatchObject({ contactMethods: [], wouldBlock: false, level: null });
  });
});

describe('leads fake expected value precision', () => {
  const body = () => ({
    leadProfileType: 'INDIVIDUAL' as const, branchId: 'b1', firstName: 'Money',
    email: `${crypto.randomUUID()}@example.test`, customFields: { budget_range: 'low' }, currencyCode: 'EGP',
  });

  it.each(['9999999999999999.99999999', '0.00000001'])('preserves %s through create and patch', async (expectedValue) => {
    const created = await settle(fakeCreateLead({ ...body(), expectedValue }, crypto.randomUUID()));
    expect(created.expectedValue).toBe(expectedValue);
    const patched = await settle(fakePatchLead(created.id, {
      expectedUpdatedAt: created.updatedAt, expectedValue: '1234567890123456.12345678',
    }));
    expect(patched.expectedValue).toBe('1234567890123456.12345678');
  });

  it.each(['10000000000000000', '1.123456789', '-1'])('rejects %s with 400 CRM_VALIDATION_FAILED on create and patch', async (expectedValue) => {
    const createError = await settle(fakeCreateLead({ ...body(), expectedValue }, crypto.randomUUID())).catch((e: unknown) => e);
    expect(createError).toMatchObject({ status: 400, code: 'CRM_VALIDATION_FAILED' });
    expect(validationPaths(createError)).toEqual(['expectedValue']);
    const created = await settle(fakeCreateLead({ ...body(), expectedValue: '1.00000000' }, crypto.randomUUID()));
    await expect(settle(fakePatchLead(created.id, {
      expectedUpdatedAt: created.updatedAt, expectedValue,
    }))).rejects.toMatchObject({ status: 400, code: 'CRM_VALIDATION_FAILED' });
  });

  it('allows zero and normalizes the stored value to 8 decimals', async () => {
    const zero = await settle(fakeCreateLead({ ...body(), expectedValue: '0' }, crypto.randomUUID()));
    expect(zero.expectedValue).toBe('0.00000000');
    const padded = await settle(fakeCreateLead({ ...body(), expectedValue: '007.5' }, crypto.randomUUID()));
    expect(padded.expectedValue).toBe('7.50000000');
  });

  it('requires the value and the currency together (LEAD_EXPECTED_VALUE_CURRENCY_PAIR)', async () => {
    const { currencyCode: _currency, ...noCurrency } = body();
    await expect(settle(fakeCreateLead({ ...noCurrency, expectedValue: '10' }, crypto.randomUUID()))).rejects.toMatchObject({
      status: 422,
      code: 'LEAD_EXPECTED_VALUE_CURRENCY_PAIR',
    });
    const bare = await settle(fakeCreateLead(noCurrency, crypto.randomUUID()));
    await expect(settle(fakePatchLead(bare.id, { expectedUpdatedAt: bare.updatedAt, expectedValue: '10' }))).rejects.toMatchObject({
      code: 'LEAD_EXPECTED_VALUE_CURRENCY_PAIR',
    });
  });

  it('rejects a malformed currency code with 400 and no longer checks the workspace currency list', async () => {
    await expect(settle(fakeCreateLead({ ...body(), expectedValue: '10', currencyCode: 'EG' }, crypto.randomUUID()))).rejects.toMatchObject({
      status: 400,
      code: 'CRM_VALIDATION_FAILED',
    });
    const created = await settle(fakeCreateLead({ ...body(), expectedValue: '10', currencyCode: 'jpy' }, crypto.randomUUID()));
    expect(created.currencyCode).toBe('JPY');
  });
});

describe('leads fake create idempotency', () => {
  const body = {
    leadProfileType: 'INDIVIDUAL' as const,
    branchId: 'b1',
    firstName: 'Idem',
    phones: ['+201001230001'],
    customFields: { budget_range: 'low' },
  };

  it('requires a UUID idempotency key', async () => {
    await expect(settle(fakeCreateLead(body, 'not-a-uuid'))).rejects.toMatchObject({ code: 'GW.IDEM.MISSING' });
  });

  it('replays the same result for the same key and body', async () => {
    const first = await settle(fakeCreateLead(body, KEY_B));
    const second = await settle(fakeCreateLead(body, KEY_B));

    expect(second.id).toBe(first.id);
  });

  it('rejects the same key with a different body', async () => {
    await settle(fakeCreateLead(body, KEY_B));

    await expect(settle(fakeCreateLead({ ...body, firstName: 'Other' }, KEY_B))).rejects.toMatchObject({
      code: 'GW.IDEM.MISMATCH',
    });
  });
});

describe('leads fake contacts save (corporate patch)', () => {
  async function corporate() {
    const row = (
      await settle(fakeSearch({ ...ALL, filterTree: { field: 'leadProfileType', operator: 'eq', value: 'CORPORATE' } }, 1, 50))
    ).items.find((item) => item.status !== 'CONVERTED')!;
    return settle(fakeGetLead(row.id));
  }

  it('rejects zero contacts', async () => {
    const lead = await corporate();

    await expect(
      settle(fakePatchLead(lead.id, { expectedUpdatedAt: lead.updatedAt, contacts: [] })),
    ).rejects.toMatchObject({ code: 'LEAD_CONTACT_REQUIRED' });
  });

  it('rejects when no contact is primary', async () => {
    const lead = await corporate();

    await expect(
      settle(
        fakePatchLead(lead.id, {
          expectedUpdatedAt: lead.updatedAt,
          contacts: [{ firstName: 'Nora', isPrimary: false, phones: ['+201001230101'] }],
        }),
      ),
    ).rejects.toMatchObject({ code: 'LEAD_CONTACT_PRIMARY_INVALID' });
  });

  it('rejects two primary contacts', async () => {
    const lead = await corporate();

    await expect(
      settle(
        fakePatchLead(lead.id, {
          expectedUpdatedAt: lead.updatedAt,
          contacts: [
            { firstName: 'Nora', isPrimary: true, phones: ['+201001230102'] },
            { firstName: 'Sami', isPrimary: true, phones: ['+201001230103'] },
          ],
        }),
      ),
    ).rejects.toMatchObject({ code: 'LEAD_CONTACT_PRIMARY_INVALID' });
  });

  it('requires a first name for a new contact', async () => {
    const lead = await corporate();

    await expect(
      settle(
        fakePatchLead(lead.id, { expectedUpdatedAt: lead.updatedAt, contacts: [{ firstName: '  ', isPrimary: true }] }),
      ),
    ).rejects.toMatchObject({ code: 'LEAD_CONTACT_NAME_REQUIRED' });
  });

  it('rejects a stale expectedUpdatedAt as a concurrent update', async () => {
    const lead = await corporate();

    await expect(
      settle(
        fakePatchLead(lead.id, {
          expectedUpdatedAt: '2000-01-01T00:00:00.000Z',
          contacts: [{ firstName: 'Nora', isPrimary: true, phones: ['+201001230104'] }],
        }),
      ),
    ).rejects.toMatchObject({ status: 409, code: 'CRM.LEAD.CONCURRENT_UPDATE' });
  });

  it('saves without expectedUpdatedAt, as the backend allows', async () => {
    const lead = await corporate();

    const saved = await settle(fakeUpdateLead(lead.id, { rating: 2 }));

    expect(saved.rating).toBe(2);
  });

  it('reports a converted lead before a stale expectedUpdatedAt', async () => {
    const converted = (
      await settle(fakeSearch({ ...ALL, filterTree: { field: 'status', operator: 'eq', value: 'CONVERTED' } }, 1, 1))
    ).items[0];

    await expect(
      settle(fakePatchLead(converted.id, { expectedUpdatedAt: '2000-01-01T00:00:00.000Z', description: 'x' })),
    ).rejects.toMatchObject({ status: 409, code: 'LEAD_ALREADY_CONVERTED' });
  });

  it('names the failing contact field by its index path', async () => {
    const lead = await corporate();

    const error = await settle(
      fakePatchLead(lead.id, {
        expectedUpdatedAt: lead.updatedAt,
        contacts: [
          { firstName: 'Nora', isPrimary: true, phones: ['+201001230106'] },
          { firstName: 'Sami', isPrimary: false, jobTitle: 'x'.repeat(200) },
        ],
      }),
    ).catch((e: unknown) => e);

    expect(validationPaths(error)).toEqual(['contacts.1.jobTitle']);
  });

  it('saves a new primary contact and exposes it on the detail', async () => {
    const lead = await corporate();

    const saved = await settle(
      fakePatchLead(lead.id, {
        expectedUpdatedAt: lead.updatedAt,
        contacts: [
          {
            firstName: 'Nora',
            lastName: 'Saad',
            isPrimary: true,
            phones: ['+201001230105'],
            email: 'nora.saad@example.com',
          },
        ],
      }),
    );

    expect(saved.contacts).toHaveLength(1);
    expect(saved.contacts[0]).toMatchObject({ firstName: 'Nora', lastName: 'Saad', isPrimary: true });
    expect(saved.updatedAt).not.toBe(lead.updatedAt);
  });

  it('forbids individual-only fields on a corporate lead', async () => {
    const lead = await corporate();

    await expect(
      settle(fakePatchLead(lead.id, { expectedUpdatedAt: lead.updatedAt, email: 'x@y.co' })),
    ).rejects.toMatchObject({ code: 'LEAD_INDIVIDUAL_FIELDS_FORBIDDEN' });
  });
});

describe('leads fake capabilities, companies and owners', () => {
  it('returns the backend capabilities envelope', async () => {
    const caps = await settle(fakeGetLeadCapabilities('b4'));

    expect(caps.branchId).toBe('b4');
    expect(caps.leads.delete).toBeNull();
    expect(caps.leads.update).toMatchObject({ scope: 'own' });
    expect(Object.keys(caps).sort()).toEqual(['activities', 'attachments', 'branchId', 'leads', 'notes', 'opportunities']);
  });

  it('refuses contacts of a person party with 422 LEAD_EXISTING_COMPANY_INVALID', async () => {
    const individual = (
      await settle(fakeSearch({ ...ALL, filterTree: { field: 'leadProfileType', operator: 'eq', value: 'INDIVIDUAL' } }, 1, 1))
    ).items[0];
    const detail = await settle(fakeGetLead(individual.id));

    await expect(settle(fakeListCompanyContacts('b1', detail.partyId))).rejects.toMatchObject({
      status: 422,
      code: 'LEAD_EXISTING_COMPANY_INVALID',
    });
  });

  it('answers 404 PARTY_NOT_FOUND for an unknown company', async () => {
    await expect(settle(fakeListCompanyContacts('b1', 'party-nope'))).rejects.toMatchObject({
      status: 404,
      code: 'PARTY_NOT_FOUND',
    });
  });
});

describe('leads fake bulk operations', () => {
  const firstId = async () => (await settle(fakeSelectLeads(ALL, 1))).items[0].id;

  it('selection reports truncated when the match count exceeds the limit', async () => {
    const result = await settle(fakeSelectLeads(ALL, 2));

    expect(result.items).toHaveLength(2);
    expect(result.truncated).toBe(result.total > 2);
  });

  it('rejects bulk-update without an idempotency key', async () => {
    await expect(settle(fakeBulkUpdate(['lead-001'], 'u1', ''))).rejects.toMatchObject({ code: 'GW.IDEM.MISSING' });
  });

  it('rejects bulk-update with duplicate ids', async () => {
    await expect(settle(fakeBulkUpdate(['lead-001', 'lead-001'], 'u1', KEY_A))).rejects.toMatchObject({
      code: 'CRM_VALIDATION_FAILED',
    });
  });

  it('rejects bulk-update with more than 100 ids', async () => {
    const ids = Array.from({ length: 101 }, (_, i) => `lead-x${i}`);

    await expect(settle(fakeBulkUpdate(ids, 'u1', KEY_A))).rejects.toMatchObject({ code: 'CRM_VALIDATION_FAILED' });
  });

  it('reports LEAD_NOT_FOUND per item instead of failing the whole chunk', async () => {
    const results = await settle(fakeBulkUpdate(['lead-missing'], 'u1', '0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f0001'));

    expect(results).toEqual([{ leadId: 'lead-missing', status: 'FAILED', code: 'LEAD_NOT_FOUND' }]);
  });

  it('bulk-stage demands a reason for the Disqualified stage', async () => {
    await expect(
      settle(fakeBulkStage([await firstId()], 'stage-disqualified', null, '0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f0002')),
    ).rejects.toMatchObject({ code: 'CRM_REASON_REQUIRED' });
  });

  it('bulk-stage refuses the Converted stage', async () => {
    await expect(
      settle(fakeBulkStage(['lead-001'], 'stage-converted', null, '0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f0003')),
    ).rejects.toMatchObject({ code: 'LEAD_CONVERSION_REQUIRED' });
  });

  it('bulk-delete replays the stored results for the same key and body', async () => {
    const key = '0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f0004';
    const id = await firstId();
    const first = await settle(fakeBulkDelete([id], null, key));
    const second = await settle(fakeBulkDelete([id], null, key));

    expect(first).toEqual([{ leadId: id, status: 'DELETED' }]);
    expect(second).toEqual(first);
  });

  it('bulk-delete rejects the same key with a different body', async () => {
    const key = '0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f0005';
    await settle(fakeBulkDelete(['lead-missing-a'], null, key));

    await expect(settle(fakeBulkDelete(['lead-missing-b'], null, key))).rejects.toMatchObject({
      code: 'GW.IDEM.MISMATCH',
    });
  });
});

describe('leads fake address geography (crm-app party-address-geo)', () => {
  const body = (address: Record<string, string>) => ({
    leadProfileType: 'INDIVIDUAL' as const, branchId: 'b1', firstName: 'Geo',
    email: `${crypto.randomUUID()}@example.test`, customFields: { budget_range: 'low' }, address,
  });

  it('refuses a level without its parent with 422 LEAD_ADDRESS_GEO_INCOMPLETE and details.field', async () => {
    const error = await settle(fakeCreateLead(body({ cityId: 'geo-city-maadi' }), crypto.randomUUID())).catch((e: unknown) => e);
    expect(error).toMatchObject({ status: 422, code: 'LEAD_ADDRESS_GEO_INCOMPLETE', details: { field: ['cityId'] } });
  });

  it('refuses a wrong lineage with 422 LEAD_ADDRESS_GEO_INVALID and details.field', async () => {
    const error = await settle(
      fakeCreateLead(body({ countryId: 'geo-sa', stateId: 'geo-eg-c' }), crypto.randomUUID()),
    ).catch((e: unknown) => e);
    expect(error).toMatchObject({ status: 422, code: 'LEAD_ADDRESS_GEO_INVALID', details: { field: ['stateId'] } });
  });

  it('refuses an unknown country with LEAD_ADDRESS_GEO_INVALID', async () => {
    const error = await settle(fakeCreateLead(body({ countryId: 'geo-nope' }), crypto.randomUUID())).catch((e: unknown) => e);
    expect(error).toMatchObject({ status: 422, code: 'LEAD_ADDRESS_GEO_INVALID', details: { field: ['countryId'] } });
  });

  it('accepts a full valid hierarchy', async () => {
    const created = await settle(
      fakeCreateLead(body({ countryId: 'geo-eg', stateId: 'geo-eg-c', cityId: 'geo-city-maadi' }), crypto.randomUUID()),
    );
    expect(created.address).toMatchObject({ countryId: 'geo-eg', stateId: 'geo-eg-c', cityId: 'geo-city-maadi' });
  });
});

describe('leads fake company party status', () => {
  it('leaves a non-ACTIVE organization out of company-options', async () => {
    const options = await settle(fakeListCompanyOptions('b1', ''));
    expect(options.some((option) => option.id === FAKE_INACTIVE_COMPANY_ID)).toBe(false);
    expect(options.length).toBeGreaterThan(0);
  });

  it('refuses its contacts with 422 LEAD_EXISTING_COMPANY_INVALID', async () => {
    await expect(settle(fakeListCompanyContacts('b1', FAKE_INACTIVE_COMPANY_ID))).rejects.toMatchObject({
      status: 422,
      code: 'LEAD_EXISTING_COMPANY_INVALID',
    });
  });

  it('refuses a create on an inactive company with 422 LEAD_EXISTING_COMPANY_INVALID', async () => {
    const error = await settle(
      fakeCreateLead(
        {
          leadProfileType: 'CORPORATE',
          branchId: 'b1',
          existingCompanyPartyId: FAKE_INACTIVE_COMPANY_ID,
          contacts: [{ contactPartyId: 'party-c-delta-1', isPrimary: true }],
          customFields: { budget_range: 'low' },
        },
        crypto.randomUUID(),
      ),
    ).catch((e: unknown) => e);
    expect(error).toMatchObject({ status: 422, code: 'LEAD_EXISTING_COMPANY_INVALID' });
  });
});

describe('leads fake contacts', () => {
  it('carries relationshipId on every lead contact', async () => {
    const page = await settle(
      fakeSearch({ ...ALL, filterTree: { field: 'leadProfileType', operator: 'eq', value: 'CORPORATE' } }, 1, 1),
    );
    const detail = await settle(fakeGetLead(page.items[0].id));
    expect(detail.contacts.length).toBeGreaterThan(0);
    for (const contact of detail.contacts) expect(contact).toHaveProperty('relationshipId');
  });
});
