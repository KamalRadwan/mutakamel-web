import type { CoreQuery } from '../../../../core/api/core-http';
import {
  assertBodyBooleans,
  assertIdempotencyKey,
  errorCodeOf,
  errorKey,
  ifMatch,
  scopeFor,
  type TradeContext,
} from '../../shared/trade-api';
import type {
  Channel,
  ChannelBranch,
  ChannelType,
} from '../../shared/trade-foundation.model';
import { tradeHttp } from '../../shared/trade-http';
import type {
  ChannelBranchInput,
  ChannelBranchLink,
  ChannelCountFilter,
  ChannelCreateBody,
  ChannelDetail,
  ChannelListQuery,
  ChannelListResult,
  ChannelPatchBody,
  ChannelRow,
  ChannelSortDirection,
  ChannelSortField,
  ChannelStatusCounts,
} from './channels.model';

type WireChannel = Omit<Channel, 'configurationProfileVersionId'> & {
  configurationProfileVersionId?: string | null;
  activeBranchCount?: number | string;
};

type WireChannelBranch = ChannelBranch & {
  branchName?: string | null;
  branchNameAr?: string | null;
};

type WireChannelDetail = WireChannel & {
  branches?: readonly WireChannelBranch[];
};

interface WireChannelListResult {
  items: WireChannel[];
  total: number;
  page: number;
  limit: number;
}

function mapChannel(raw: WireChannel): Channel {
  return {
    id: raw.id,
    companyId: raw.companyId,
    code: raw.code,
    name: raw.name,
    channelType: raw.channelType,
    status: raw.status,
    configurationProfileVersionId: raw.configurationProfileVersionId ?? null,
    version: raw.version,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };
}

function mapChannelRow(raw: WireChannel): ChannelRow {
  return {
    ...mapChannel(raw),
    activeBranchCount: Number(raw.activeBranchCount ?? 0),
  };
}

function mapChannelBranchLink(raw: WireChannelBranch): ChannelBranchLink {
  return {
    id: raw.id,
    channelId: raw.channelId,
    companyId: raw.companyId,
    branchId: raw.branchId,
    isActive: raw.isActive,
    version: raw.version,
    branchName: raw.branchName ?? null,
    branchNameAr: raw.branchNameAr ?? null,
  };
}

function mapChannelDetail(raw: WireChannelDetail): ChannelDetail {
  return {
    ...mapChannel(raw),
    branches: (raw.branches ?? []).map(mapChannelBranchLink),
  };
}

function normalizeTypes(raw: ChannelType | readonly ChannelType[] | undefined): ChannelType[] {
  if (raw === undefined) return [];
  const list = Array.isArray(raw) ? raw : [raw];
  const seen = new Set<ChannelType>();
  const result: ChannelType[] = [];
  for (const item of list) {
    if (!seen.has(item)) {
      seen.add(item);
      result.push(item);
    }
  }
  return result;
}

function buildCountQuery(
  search: string | undefined,
  channelType: ChannelType | undefined,
): CoreQuery | undefined {
  const query: CoreQuery = {};
  const trimmed = search?.trim();
  if (trimmed) query['search'] = trimmed;
  if (channelType !== undefined) query['channelType'] = channelType;
  return Object.keys(query).length > 0 ? query : undefined;
}

function buildListQuery(
  q: Omit<ChannelListQuery, 'channelType'> & { channelType?: ChannelType },
): CoreQuery | undefined {
  const query: CoreQuery = {};
  const trimmed = q.search?.trim();
  if (trimmed) query['search'] = trimmed;
  if (q.status !== undefined) query['status'] = q.status;
  if (q.channelType !== undefined) query['channelType'] = q.channelType;
  if (q.sort !== undefined) query['sort'] = q.sort;
  if (q.direction !== undefined) query['direction'] = q.direction;
  if (q.page !== undefined) query['page'] = q.page;
  if (q.limit !== undefined) query['limit'] = q.limit;
  return Object.keys(query).length > 0 ? query : undefined;
}

function compareChannelRows(
  a: ChannelRow,
  b: ChannelRow,
  sort: ChannelSortField,
  direction: ChannelSortDirection,
): number {
  const cmp =
    sort === 'name'
      ? a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
      : a[sort].localeCompare(b[sort]);
  const primary = cmp !== 0 ? cmp : a.id.localeCompare(b.id);
  return direction === 'asc' ? primary : -primary;
}

// GET /api/tenant/trade/v1/channels?search&status&channelType&sort&direction&page&limit (OPTIONAL scope)
export async function listChannelRows(
  ctx: TradeContext,
  q: ChannelListQuery = {},
): Promise<ChannelListResult> {
  const scope = scopeFor(ctx, 'OPTIONAL');
  const types = normalizeTypes(q.channelType);

  if (types.length <= 1) {
    const res = await tradeHttp().read<WireChannelListResult>(
      '/channels',
      buildListQuery({ ...q, channelType: types[0] }),
      { scope },
    );
    return {
      items: res.items.map(mapChannelRow),
      total: res.total,
      page: res.page,
      limit: res.limit,
    };
  }

  const page = q.page ?? 1;
  const sort = q.sort ?? 'createdAt';
  const direction = q.direction ?? 'desc';
  const pages = await Promise.all(
    types.map((channelType) =>
      tradeHttp().read<WireChannelListResult>(
        '/channels',
        buildListQuery({ ...q, channelType, page: 1 }),
        { scope },
      ),
    ),
  );
  const limit = q.limit ?? pages[0].limit;
  const merged = pages
    .flatMap((res) => res.items.map(mapChannelRow))
    .sort((a, b) => compareChannelRows(a, b, sort, direction));
  const start = (page - 1) * limit;

  return {
    items: merged.slice(start, start + limit),
    total: pages.reduce((sum, res) => sum + res.total, 0),
    page,
    limit,
  };
}

// GET /api/tenant/trade/v1/channels/status-counts?search&channelType (OPTIONAL scope)
export async function countChannels(
  ctx: TradeContext,
  f: ChannelCountFilter = {},
): Promise<ChannelStatusCounts> {
  const scope = scopeFor(ctx, 'OPTIONAL');
  const types = normalizeTypes(f.channelType);

  if (types.length <= 1) {
    return tradeHttp().read<ChannelStatusCounts>(
      '/channels/status-counts',
      buildCountQuery(f.search, types[0]),
      { scope },
    );
  }

  const results = await Promise.all(
    types.map((channelType) =>
      tradeHttp().read<ChannelStatusCounts>(
        '/channels/status-counts',
        buildCountQuery(f.search, channelType),
        { scope },
      ),
    ),
  );

  return results.reduce<ChannelStatusCounts>(
    (acc, cur) => ({
      ACTIVE: acc.ACTIVE + cur.ACTIVE,
      INACTIVE: acc.INACTIVE + cur.INACTIVE,
      total: acc.total + cur.total,
    }),
    { ACTIVE: 0, INACTIVE: 0, total: 0 },
  );
}

// GET /api/tenant/trade/v1/channels/:id (OPTIONAL scope)
export async function getChannel(ctx: TradeContext, id: string): Promise<ChannelDetail> {
  const scope = scopeFor(ctx, 'OPTIONAL');
  const raw = await tradeHttp().read<WireChannelDetail>(
    `/channels/${encodeURIComponent(id)}`,
    undefined,
    { scope },
  );
  return mapChannelDetail(raw);
}

// POST /api/tenant/trade/v1/channels (201, COMPANY scope, x-idempotency-key)
export async function createChannel(
  ctx: TradeContext,
  body: ChannelCreateBody,
  key: string,
): Promise<Channel> {
  const payload: ChannelCreateBody = {
    code: body.code,
    name: body.name,
    channelType: body.channelType,
  };
  const { data } = await tradeHttp().write<WireChannel>('POST', '/channels', payload, {
    key: assertIdempotencyKey(key),
    scope: scopeFor(ctx, 'COMPANY'),
  });
  return mapChannel(data);
}

// PATCH /api/tenant/trade/v1/channels/:id (COMPANY scope, If-Match, x-idempotency-key)
export async function patchChannel(
  ctx: TradeContext,
  id: string,
  version: number,
  body: ChannelPatchBody,
  key: string,
): Promise<Channel> {
  const payload: ChannelPatchBody = {
    ...(body.name !== undefined ? { name: body.name } : {}),
    ...(body.status !== undefined ? { status: body.status } : {}),
  };
  const { data } = await tradeHttp().write<WireChannel>(
    'PATCH',
    `/channels/${encodeURIComponent(id)}`,
    payload,
    {
      key: assertIdempotencyKey(key),
      ifMatch: ifMatch(version),
      scope: scopeFor(ctx, 'COMPANY'),
    },
  );
  return mapChannel(data);
}

// PUT /api/tenant/trade/v1/channels/:id/branches { links: [{ branchId, isActive }] } (COMPANY scope, If-Match, x-idempotency-key)
export async function setChannelBranches(
  ctx: TradeContext,
  id: string,
  version: number,
  links: readonly ChannelBranchInput[],
  key: string,
): Promise<ChannelDetail> {
  for (const link of links) {
    assertBodyBooleans(link, ['isActive']);
  }
  const payload = {
    links: links.map((link) => ({
      branchId: link.branchId,
      isActive: link.isActive,
    })),
  };
  const { data } = await tradeHttp().write<WireChannelDetail>(
    'PUT',
    `/channels/${encodeURIComponent(id)}/branches`,
    payload,
    {
      key: assertIdempotencyKey(key),
      ifMatch: ifMatch(version),
      scope: scopeFor(ctx, 'COMPANY'),
    },
  );
  return mapChannelDetail(data);
}

export function channelErrorKey(e: unknown): string {
  const code = errorCodeOf(e);
  if (!code) {
    return 'tradeShared.errors.generic';
  }
  return errorKey(e);
}
