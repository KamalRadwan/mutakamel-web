import { describe, expect, it } from 'vitest';
import { ApiError, newIdempotencyKey } from '../../shared/trade-api';
import type { Channel } from '../../shared/trade-foundation.model';
import { TradeHttpStub } from '../../shared/testing/trade-http-testing';
import { bindTradeHttpForTest } from '../../shared/trade-http';
import {
  channelErrorKey,
  countChannels,
  createChannel,
  getChannel,
  listChannelRows,
  patchChannel,
  setChannelBranches,
} from './channels.api';
import type { ChannelDetail, ChannelStatusCounts } from './channels.model';

const UUID_V7_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function makeWireChannel(overrides: Record<string, unknown> = {}) {
  return {
    id: '01900000-0000-7000-8000-000000000001',
    companyId: '01900000-0000-7000-8000-0000000000c1',
    code: 'POS_MAIN',
    name: 'Main POS',
    channelType: 'POS',
    status: 'ACTIVE',
    configurationProfileVersionId: null,
    version: 1,
    createdAt: '2026-11-23T08:00:00.000Z',
    updatedAt: '2026-11-23T09:00:00.000Z',
    createdBy: '01900000-0000-7000-8000-0000000000u1',
    updatedBy: '01900000-0000-7000-8000-0000000000u1',
    deletedAt: null,
    ...overrides,
  };
}

describe('channels.api', () => {
  it('listChannelRows calls GET /channels with OPTIONAL scope, query names, envelope unwrap, activeBranchCount mapping, and validation error propagation', async () => {
    const wireRow = makeWireChannel({ activeBranchCount: 3 });
    const stub = new TradeHttpStub({
      'GET /channels': { items: [wireRow], total: 1, page: 1, limit: 25 },
    });
    const dispose = bindTradeHttpForTest(stub);

    try {
      const result = await listChannelRows(
        { companyId: 'comp-1', branchId: 'br-1' },
        {
          search: '  POS  ',
          status: 'ACTIVE',
          channelType: 'POS',
          sort: 'name',
          direction: 'asc',
          page: 2,
          limit: 25,
        },
      );

      expect(result).toEqual({
        items: [
          {
            id: wireRow.id,
            companyId: wireRow.companyId,
            code: wireRow.code,
            name: wireRow.name,
            channelType: 'POS',
            status: 'ACTIVE',
            configurationProfileVersionId: null,
            activeBranchCount: 3,
            version: 1,
            createdAt: wireRow.createdAt,
            updatedAt: wireRow.updatedAt,
          },
        ],
        total: 1,
        page: 1,
        limit: 25,
      });
      expect(stub.recordedReads()).toEqual([
        {
          path: '/channels',
          query: {
            search: 'POS',
            status: 'ACTIVE',
            channelType: 'POS',
            sort: 'name',
            direction: 'asc',
            page: 2,
            limit: 25,
          },
          scope: { companyId: 'comp-1', branchId: 'br-1' },
        },
      ]);

      stub.reset();
      await listChannelRows({}, { channelType: ['POS'] });
      expect(stub.recordedReads()).toEqual([
        {
          path: '/channels',
          query: { channelType: 'POS' },
          scope: {},
        },
      ]);

      stub.reset();
      const posRow = makeWireChannel({ id: 'ch-pos', code: 'POS_1', name: 'Beta POS', channelType: 'POS', activeBranchCount: 1 });
      const webRow = makeWireChannel({ id: 'ch-web', code: 'WEB_1', name: 'Alpha Web', channelType: 'ECOMMERCE', activeBranchCount: 2 });
      const originalRead = stub.read.bind(stub);
      stub.read = (async <T>(path: string, query?: Record<string, unknown>, options?: { scope?: unknown }) => {
        const type = query?.['channelType'];
        stub.register('GET', '/channels', {
          items: type === 'POS' ? [posRow] : [webRow],
          total: 1,
          page: 1,
          limit: 50,
        });
        return originalRead<T>(path, query as never, options as never);
      }) as typeof stub.read;

      const multi = await listChannelRows(
        { companyId: 'comp-1' },
        { channelType: ['POS', 'ECOMMERCE'], sort: 'name', direction: 'asc', page: 1, limit: 50 },
      );
      expect(multi.total).toBe(2);
      expect(multi.items.map((row) => row.id)).toEqual(['ch-web', 'ch-pos']);
      expect(stub.recordedReads()).toEqual([
        {
          path: '/channels',
          query: { channelType: 'POS', sort: 'name', direction: 'asc', page: 1, limit: 50 },
          scope: { companyId: 'comp-1' },
        },
        {
          path: '/channels',
          query: { channelType: 'ECOMMERCE', sort: 'name', direction: 'asc', page: 1, limit: 50 },
          scope: { companyId: 'comp-1' },
        },
      ]);

      const validationErr = new ApiError(400, 'TRADE.VALIDATION_FAILED', {
        search: ['search must be shorter than or equal to 80 characters'],
      });
      stub.read = originalRead;
      stub.register('GET', '/channels', validationErr);
      await expect(listChannelRows({ companyId: 'comp-1' }, { search: 'x'.repeat(81) })).rejects.toMatchObject({
        status: 400,
        code: 'TRADE.VALIDATION_FAILED',
        details: { search: ['search must be shorter than or equal to 80 characters'] },
      });
    } finally {
      dispose();
    }
  });

  it('countChannels calls GET /channels/status-counts with OPTIONAL scope, query names, and envelope unwrap', async () => {
    const counts: ChannelStatusCounts = { ACTIVE: 4, INACTIVE: 1, total: 5 };
    const stub = new TradeHttpStub({ 'GET /channels/status-counts': counts });
    const dispose = bindTradeHttpForTest(stub);

    try {
      const result = await countChannels({ companyId: 'comp-1' }, { search: '  main  ', channelType: 'POS' });
      expect(result).toEqual(counts);
      expect(stub.recordedReads()).toEqual([
        {
          path: '/channels/status-counts',
          query: { search: 'main', channelType: 'POS' },
          scope: { companyId: 'comp-1' },
        },
      ]);

      stub.reset();
      await countChannels({}, {});
      expect(stub.recordedReads()).toEqual([
        {
          path: '/channels/status-counts',
          query: undefined,
          scope: {},
        },
      ]);

      const fieldErr = new ApiError(400, 'TRADE.VALIDATION_FAILED', { channelType: ['invalid'] });
      stub.register('GET', '/channels/status-counts', fieldErr);
      await expect(countChannels({ companyId: 'comp-1' })).rejects.toBe(fieldErr);
    } finally {
      dispose();
    }
  });

  it('getChannel calls GET /channels/:id with OPTIONAL scope and maps nullable branch names', async () => {
    const wireDetail = {
      ...makeWireChannel({ version: 3 }),
      branches: [
        {
          id: '01900000-0000-7000-8000-0000000000b1',
          channelId: '01900000-0000-7000-8000-000000000001',
          companyId: '01900000-0000-7000-8000-0000000000c1',
          branchId: 'b1',
          isActive: true,
          version: 2,
          branchName: 'Cairo HQ',
          branchNameAr: null,
          createdAt: '2026-11-23T08:00:00.000Z',
          updatedAt: '2026-11-23T08:00:00.000Z',
          createdBy: 'u1',
          updatedBy: 'u1',
          deletedAt: null,
        },
      ],
    };
    const stub = new TradeHttpStub({ 'GET /channels/:id': wireDetail });
    const dispose = bindTradeHttpForTest(stub);

    try {
      const detail: ChannelDetail = await getChannel({ companyId: 'comp-1', branchId: 'b1' }, 'ch-1');
      expect(detail).toEqual({
        id: wireDetail.id,
        companyId: wireDetail.companyId,
        code: wireDetail.code,
        name: wireDetail.name,
        channelType: 'POS',
        status: 'ACTIVE',
        configurationProfileVersionId: null,
        version: 3,
        createdAt: wireDetail.createdAt,
        updatedAt: wireDetail.updatedAt,
        branches: [
          {
            id: '01900000-0000-7000-8000-0000000000b1',
            channelId: wireDetail.id,
            companyId: wireDetail.companyId,
            branchId: 'b1',
            isActive: true,
            version: 2,
            branchName: 'Cairo HQ',
            branchNameAr: null,
          },
        ],
      });
      expect(stub.recordedReads()).toEqual([
        {
          path: '/channels/ch-1',
          query: undefined,
          scope: { companyId: 'comp-1', branchId: 'b1' },
        },
      ]);

      const notFound = new ApiError(404, 'TRADE.CATALOG.CHANNEL_NOT_FOUND');
      stub.register('GET', '/channels/:id', notFound);
      await expect(getChannel({ companyId: 'comp-1' }, 'missing')).rejects.toBe(notFound);
    } finally {
      dispose();
    }
  });

  it('createChannel posts whitelisted body to POST /channels with UUIDv7 key, COMPANY scope, and maps field details', async () => {
    const wireCreated = makeWireChannel({ code: 'WEB_STORE', name: 'Web Store', channelType: 'ECOMMERCE' });
    const stub = new TradeHttpStub({ 'POST /channels': wireCreated });
    const dispose = bindTradeHttpForTest(stub);

    try {
      const key = newIdempotencyKey();
      const created: Channel = await createChannel(
        { companyId: 'comp-1', branchId: 'br-ignored' },
        { code: 'WEB_STORE', name: 'Web Store', channelType: 'ECOMMERCE', uiOnly: 'strip' } as never,
        key,
      );

      expect(created).toEqual({
        id: wireCreated.id,
        companyId: wireCreated.companyId,
        code: 'WEB_STORE',
        name: 'Web Store',
        channelType: 'ECOMMERCE',
        status: 'ACTIVE',
        configurationProfileVersionId: null,
        version: 1,
        createdAt: wireCreated.createdAt,
        updatedAt: wireCreated.updatedAt,
      });
      expect(stub.recordedWrites()).toEqual([
        {
          method: 'POST',
          path: '/channels',
          body: { code: 'WEB_STORE', name: 'Web Store', channelType: 'ECOMMERCE' },
          key,
          ifMatch: undefined,
          scope: { companyId: 'comp-1' },
          query: undefined,
        },
      ]);
      expect(stub.recordedWrites()[0].key).toMatch(UUID_V7_REGEX);

      await expect(
        createChannel({}, { code: 'WEB', name: 'Web', channelType: 'ECOMMERCE' }, newIdempotencyKey()),
      ).rejects.toMatchObject({ status: 400, code: 'TRADE.SCOPE.REQUIRED' });

      await expect(
        createChannel({ companyId: 'comp-1' }, { code: 'WEB', name: 'Web', channelType: 'ECOMMERCE' }, ''),
      ).rejects.toMatchObject({ status: 400, code: 'TRADE.IDEMPOTENCY.KEY_MISSING' });

      await expect(
        createChannel({ companyId: 'comp-1' }, { code: 'WEB', name: 'Web', channelType: 'ECOMMERCE' }, 'bad-key'),
      ).rejects.toMatchObject({ status: 422, code: 'TRADE.IDEMPOTENCY.KEY_REQUIRED' });

      const validationErr = new ApiError(400, 'TRADE.VALIDATION_FAILED', {
        code: ['code must match pattern'],
      });
      stub.register('POST', '/channels', validationErr);
      await expect(
        createChannel({ companyId: 'comp-1' }, { code: 'bad code', name: 'Web', channelType: 'ECOMMERCE' }, newIdempotencyKey()),
      ).rejects.toMatchObject({
        status: 400,
        code: 'TRADE.VALIDATION_FAILED',
        details: { code: ['code must match pattern'] },
      });
    } finally {
      dispose();
    }
  });

  it('patchChannel sends PATCH /channels/:id with key, If-Match, COMPANY scope, whitelisted body, and error mapping', async () => {
    const wirePatched = makeWireChannel({ name: 'Renamed POS', status: 'INACTIVE', version: 4 });
    const stub = new TradeHttpStub({ 'PATCH /channels/:id': wirePatched });
    const dispose = bindTradeHttpForTest(stub);

    try {
      const key = newIdempotencyKey();
      const updated = await patchChannel(
        { companyId: 'comp-1', branchId: 'br-ignored' },
        'ch-1',
        3,
        { name: 'Renamed POS', status: 'INACTIVE', code: 'DO_NOT_SEND' } as never,
        key,
      );

      expect(updated.version).toBe(4);
      expect(updated.status).toBe('INACTIVE');
      expect(stub.recordedWrites()).toEqual([
        {
          method: 'PATCH',
          path: '/channels/ch-1',
          body: { name: 'Renamed POS', status: 'INACTIVE' },
          key,
          ifMatch: '"3"',
          scope: { companyId: 'comp-1' },
          query: undefined,
        },
      ]);

      await expect(patchChannel({}, 'ch-1', 3, { name: 'X' }, newIdempotencyKey())).rejects.toMatchObject({
        status: 400,
        code: 'TRADE.SCOPE.REQUIRED',
      });

      const validationErr = new ApiError(400, 'TRADE.VALIDATION_FAILED', {
        name: ['name must not be empty'],
      });
      stub.register('PATCH', '/channels/:id', validationErr);
      await expect(
        patchChannel({ companyId: 'comp-1' }, 'ch-1', 3, { name: '' }, newIdempotencyKey()),
      ).rejects.toMatchObject({
        status: 400,
        code: 'TRADE.VALIDATION_FAILED',
        details: { name: ['name must not be empty'] },
      });

      const conflictErr = new ApiError(409, 'TRADE.CONCURRENCY.STALE_VERSION');
      stub.register('PATCH', '/channels/:id', conflictErr);
      await expect(
        patchChannel({ companyId: 'comp-1' }, 'ch-1', 3, { status: 'ACTIVE' }, newIdempotencyKey()),
      ).rejects.toBe(conflictErr);
    } finally {
      dispose();
    }
  });

  it('setChannelBranches sends PUT /channels/:id/branches with key, If-Match, COMPANY scope, whitelisted links, and error propagation', async () => {
    const wireDetail = {
      ...makeWireChannel({ version: 5 }),
      branches: [
        {
          id: 'link-1',
          channelId: '01900000-0000-7000-8000-000000000001',
          companyId: '01900000-0000-7000-8000-0000000000c1',
          branchId: 'b1',
          isActive: true,
          version: 1,
          branchName: 'Cairo HQ',
          branchNameAr: null,
        },
      ],
    };
    const stub = new TradeHttpStub({ 'PUT /channels/:id/branches': wireDetail });
    const dispose = bindTradeHttpForTest(stub);

    try {
      const key = newIdempotencyKey();
      const result = await setChannelBranches(
        { companyId: 'comp-1', branchId: 'br-ignored' },
        'ch-1',
        4,
        [{ branchId: 'b1', isActive: true, extra: 'strip' } as never],
        key,
      );

      expect(result.version).toBe(5);
      expect(result.branches).toHaveLength(1);
      expect(stub.recordedWrites()).toEqual([
        {
          method: 'PUT',
          path: '/channels/ch-1/branches',
          body: { links: [{ branchId: 'b1', isActive: true }] },
          key,
          ifMatch: '"4"',
          scope: { companyId: 'comp-1' },
          query: undefined,
        },
      ]);

      await expect(
        setChannelBranches(
          { companyId: 'comp-1' },
          'ch-1',
          4,
          [{ branchId: 'b1', isActive: 'true' as never }],
          newIdempotencyKey(),
        ),
      ).rejects.toMatchObject({
        status: 400,
        code: 'TRADE.VALIDATION_FAILED',
        details: { isActive: ['invalid'] },
      });

      const mismatchErr = new ApiError(422, 'TRADE.CONTEXT.BRANCH_COMPANY_MISMATCH');
      stub.register('PUT', '/channels/:id/branches', mismatchErr);
      await expect(
        setChannelBranches({ companyId: 'comp-1' }, 'ch-1', 4, [{ branchId: 'other', isActive: true }], newIdempotencyKey()),
      ).rejects.toBe(mismatchErr);
    } finally {
      dispose();
    }
  });

  it('channelErrorKey maps Trade ApiError codes and falls back cleanly', () => {
    expect(channelErrorKey(new ApiError(409, 'TRADE.CATALOG.CODE_TAKEN'))).toBe(
      'tradeShared.errors.TRADE_CATALOG_CODE_TAKEN',
    );
    expect(channelErrorKey(new ApiError(403, 'TRADE.AUTH.TARGET_DENIED'))).toBe(
      'tradeShared.errors.TRADE_AUTH_TARGET_DENIED',
    );
    expect(channelErrorKey(new Error('network'))).toBe('tradeShared.errors.generic');
  });
});
