import { FAKE_COMPANIES } from '../../../../core/scope/scope.fake';
import { ApiError, fakeDelay, fakeId, type TradeContext } from '../../shared/trade-api';
import { TRADE_FAKE_DB, bumpVersion, clone, nowIso } from '../../shared/trade-foundation.fake';
import type { Channel, ChannelBranch, ChannelType } from '../../shared/trade-foundation.model';
import {
  CHANNEL_CODE_PATTERN,
  CHANNEL_LIMITS,
  CHANNEL_TYPES,
  type ChannelBranchInput,
  type ChannelBranchLink,
  type ChannelCountFilter,
  type ChannelCreateBody,
  type ChannelDetail,
  type ChannelListQuery,
  type ChannelListResult,
  type ChannelPatchBody,
  type ChannelRow,
  type ChannelSortDirection,
  type ChannelSortField,
  type ChannelStatusCounts,
} from './channels.model';

interface IdempotencyEntry {
  fingerprint: string;
  result: unknown;
}

const UPPER_CODE_PATTERN = /^[A-Z0-9][A-Z0-9._-]{0,79}$/;
const VALID_SORT_FIELDS: ReadonlySet<ChannelSortField> = new Set(['createdAt', 'code', 'name']);
const idempotencyStore = new Map<string, IdempotencyEntry>();
let lastCreatedMs = 0;

function monotonicNowIso(): string {
  const now = Date.parse(nowIso());
  const next = now > lastCreatedMs ? now : lastCreatedMs + 1;
  lastCreatedMs = next;
  return new Date(next).toISOString();
}

function checkIdempotency<T>(key: string, fingerprint: string): T | null {
  const existing = idempotencyStore.get(key);
  if (!existing) return null;
  if (existing.fingerprint !== fingerprint) {
    throw new ApiError(422, 'TRADE.IDEMPOTENCY.MISMATCH');
  }
  return clone(existing.result as T);
}

function storeIdempotency(key: string, fingerprint: string, result: unknown): void {
  idempotencyStore.set(key, {
    fingerprint,
    result: clone(result),
  });
}

function requireCompany(ctx: TradeContext): string {
  if (!ctx.companyId) {
    throw new ApiError(400, 'TRADE.CONTEXT.MISSING_COMPANY');
  }
  return ctx.companyId;
}

function normalizeChannelTypes(
  raw: ChannelType | readonly ChannelType[] | undefined,
): Set<ChannelType> | null {
  if (raw === undefined) return null;
  const list: readonly unknown[] = Array.isArray(raw) ? raw : [raw];
  if (list.length === 0) return null;
  const allowed = new Set<string>(CHANNEL_TYPES);
  for (const item of list) {
    if (typeof item !== 'string' || !allowed.has(item)) {
      throw new ApiError(400, 'TRADE.VALIDATION_FAILED', { channelType: ['invalid'] });
    }
  }
  return new Set(list as ChannelType[]);
}

function filterCompanyChannels(companyId: string, f: ChannelCountFilter): Channel[] {
  if (f.search !== undefined && (typeof f.search !== 'string' || f.search.length > CHANNEL_LIMITS.name)) {
    throw new ApiError(400, 'TRADE.VALIDATION_FAILED', { search: ['invalid'] });
  }
  const typeSet = normalizeChannelTypes(f.channelType);
  const needle = f.search?.trim().toLowerCase() ?? '';

  return TRADE_FAKE_DB.channels.filter((c) => {
    if (c.companyId !== companyId) return false;
    if (typeSet && !typeSet.has(c.channelType)) return false;
    if (
      needle &&
      !c.name.toLowerCase().includes(needle) &&
      !c.code.toLowerCase().includes(needle)
    ) {
      return false;
    }
    return true;
  });
}

function compareChannels(
  a: Channel,
  b: Channel,
  sort: ChannelSortField,
  direction: ChannelSortDirection,
): number {
  const cmp =
    sort === 'name'
      ? a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
      : a[sort].localeCompare(b[sort]);
  if (cmp === 0) return 0;
  return direction === 'asc' ? cmp : -cmp;
}

function buildChannelDetail(channel: Channel, companyId: string): ChannelDetail {
  const company = FAKE_COMPANIES.find((c) => c.id === companyId);
  const branchById = new Map(company?.branches.map((b) => [b.id, b]) ?? []);

  const branches: ChannelBranchLink[] = TRADE_FAKE_DB.channelBranches
    .filter((link) => link.channelId === channel.id && link.companyId === companyId)
    .map((link) => {
      const branch = branchById.get(link.branchId);
      return {
        ...link,
        branchName: branch?.nameEn ?? link.branchId,
        branchNameAr: branch?.nameAr ?? link.branchId,
      };
    });

  return {
    ...channel,
    branches,
  };
}

export async function fakeListChannelRows(
  ctx: TradeContext,
  q: ChannelListQuery = {},
): Promise<ChannelListResult> {
  await fakeDelay();
  const companyId = requireCompany(ctx);

  const page = q.page ?? 1;
  const limit = q.limit ?? CHANNEL_LIMITS.page;
  const sort = q.sort ?? 'createdAt';
  const direction = q.direction ?? 'desc';

  if (!Number.isInteger(page) || page < 1) {
    throw new ApiError(400, 'TRADE.VALIDATION_FAILED', { page: ['invalid'] });
  }
  if (!Number.isInteger(limit) || limit < 1 || limit > CHANNEL_LIMITS.page) {
    throw new ApiError(400, 'TRADE.VALIDATION_FAILED', { limit: ['invalid'] });
  }
  if (q.status !== undefined && q.status !== 'ACTIVE' && q.status !== 'INACTIVE') {
    throw new ApiError(400, 'TRADE.VALIDATION_FAILED', { status: ['invalid'] });
  }
  if (!VALID_SORT_FIELDS.has(sort)) {
    throw new ApiError(400, 'TRADE.VALIDATION_FAILED', { sort: ['invalid'] });
  }
  if (direction !== 'asc' && direction !== 'desc') {
    throw new ApiError(400, 'TRADE.VALIDATION_FAILED', { direction: ['invalid'] });
  }

  let matched = filterCompanyChannels(companyId, q);
  if (q.status) {
    matched = matched.filter((c) => c.status === q.status);
  }

  const total = matched.length;
  const sorted = matched.slice().sort((a, b) => compareChannels(a, b, sort, direction));
  const start = (page - 1) * limit;
  const paged = sorted.slice(start, start + limit);

  const items: ChannelRow[] = paged.map((channel) => {
    const activeBranchCount = TRADE_FAKE_DB.channelBranches.filter(
      (link) => link.channelId === channel.id && link.companyId === companyId && link.isActive,
    ).length;
    return {
      ...channel,
      activeBranchCount,
    };
  });

  return clone({ items, total, page, limit });
}

export async function fakeCountChannels(
  ctx: TradeContext,
  f: ChannelCountFilter = {},
): Promise<ChannelStatusCounts> {
  await fakeDelay();
  const companyId = requireCompany(ctx);

  const matched = filterCompanyChannels(companyId, f);
  let active = 0;
  let inactive = 0;
  for (const channel of matched) {
    if (channel.status === 'ACTIVE') {
      active += 1;
    } else {
      inactive += 1;
    }
  }

  return {
    ACTIVE: active,
    INACTIVE: inactive,
    total: active + inactive,
  };
}

export async function fakeGetChannel(ctx: TradeContext, id: string): Promise<ChannelDetail> {
  await fakeDelay();
  const companyId = requireCompany(ctx);

  const channel = TRADE_FAKE_DB.channels.find((c) => c.id === id && c.companyId === companyId);
  if (!channel) {
    throw new ApiError(404, 'TRADE.CATALOG.CHANNEL_NOT_FOUND');
  }

  return clone(buildChannelDetail(channel, companyId));
}

export async function fakeCreateChannel(
  ctx: TradeContext,
  body: ChannelCreateBody,
  key: string,
): Promise<Channel> {
  await fakeDelay();
  const companyId = requireCompany(ctx);

  const fingerprint = JSON.stringify({
    op: 'create',
    companyId,
    body,
  });
  const cached = checkIdempotency<Channel>(key, fingerprint);
  if (cached) return cached;

  if (typeof body.code !== 'string') {
    throw new ApiError(422, 'TRADE.CATALOG.ITEM_IDENTITY_INVALID', { field: ['code'] });
  }
  const normalizedCode = body.code.trim().toUpperCase();
  if (!CHANNEL_CODE_PATTERN.test(normalizedCode) || !UPPER_CODE_PATTERN.test(normalizedCode)) {
    throw new ApiError(422, 'TRADE.CATALOG.ITEM_IDENTITY_INVALID', { field: ['code'] });
  }

  if (typeof body.name !== 'string') {
    throw new ApiError(400, 'TRADE.VALIDATION_FAILED', { name: ['invalid'] });
  }
  const trimmedName = body.name.trim();
  if (trimmedName.length < 1 || trimmedName.length > CHANNEL_LIMITS.name) {
    throw new ApiError(400, 'TRADE.VALIDATION_FAILED', { name: ['invalid'] });
  }

  if (!CHANNEL_TYPES.includes(body.channelType)) {
    throw new ApiError(400, 'TRADE.VALIDATION_FAILED', { channelType: ['invalid'] });
  }

  const duplicate = TRADE_FAKE_DB.channels.some(
    (c) => c.companyId === companyId && c.code.toUpperCase() === normalizedCode,
  );
  if (duplicate) {
    throw new ApiError(409, 'TRADE.CATALOG.CODE_TAKEN');
  }

  const ts = monotonicNowIso();
  const created: Channel = {
    id: fakeId(),
    companyId,
    code: normalizedCode,
    name: trimmedName,
    channelType: body.channelType,
    status: 'ACTIVE',
    configurationProfileVersionId: null,
    version: 1,
    createdAt: ts,
    updatedAt: ts,
  };

  TRADE_FAKE_DB.channels.push(created);
  storeIdempotency(key, fingerprint, created);
  return clone(created);
}

export async function fakePatchChannel(
  ctx: TradeContext,
  id: string,
  version: number,
  body: ChannelPatchBody,
  key: string,
): Promise<Channel> {
  await fakeDelay();
  const companyId = requireCompany(ctx);

  const fingerprint = JSON.stringify({
    op: 'patch',
    companyId,
    id,
    body,
  });
  const cached = checkIdempotency<Channel>(key, fingerprint);
  if (cached) return cached;

  const rawBody = body as Record<string, unknown>;
  const keys = Object.keys(rawBody);
  if (keys.some((k) => k !== 'name' && k !== 'status')) {
    throw new ApiError(400, 'TRADE.VALIDATION_FAILED');
  }

  const hasName = body.name !== undefined;
  const hasStatus = body.status !== undefined;
  if (!hasName && !hasStatus) {
    throw new ApiError(400, 'TRADE.VALIDATION_FAILED');
  }

  let nextName: string | undefined;
  if (hasName) {
    if (typeof body.name !== 'string') {
      throw new ApiError(400, 'TRADE.VALIDATION_FAILED', { name: ['invalid'] });
    }
    const trimmedName = body.name.trim();
    if (trimmedName.length < 1 || trimmedName.length > CHANNEL_LIMITS.name) {
      throw new ApiError(400, 'TRADE.VALIDATION_FAILED', { name: ['invalid'] });
    }
    nextName = trimmedName;
  }

  if (hasStatus && body.status !== 'ACTIVE' && body.status !== 'INACTIVE') {
    throw new ApiError(400, 'TRADE.VALIDATION_FAILED', { status: ['invalid'] });
  }

  const channel = TRADE_FAKE_DB.channels.find((c) => c.id === id && c.companyId === companyId);
  if (!channel) {
    throw new ApiError(404, 'TRADE.CATALOG.CHANNEL_NOT_FOUND');
  }

  if (channel.version !== version) {
    throw new ApiError(409, 'TRADE.CONCURRENCY.STALE_VERSION');
  }

  if (nextName !== undefined) {
    channel.name = nextName;
  }
  if (body.status !== undefined) {
    channel.status = body.status;
  }
  bumpVersion(channel);

  storeIdempotency(key, fingerprint, channel);
  return clone(channel);
}

export async function fakeSetChannelBranches(
  ctx: TradeContext,
  id: string,
  version: number,
  links: readonly ChannelBranchInput[],
  key: string,
): Promise<ChannelDetail> {
  await fakeDelay();
  const companyId = requireCompany(ctx);

  const fingerprint = JSON.stringify({
    op: 'setChannelBranches',
    companyId,
    id,
    links,
  });
  const cached = checkIdempotency<ChannelDetail>(key, fingerprint);
  if (cached) return cached;

  if (!Array.isArray(links)) {
    throw new ApiError(400, 'TRADE.VALIDATION_FAILED', { links: ['invalid'] });
  }
  const seenBranchIds = new Set<string>();
  for (const entry of links) {
    if (
      !entry ||
      typeof entry.branchId !== 'string' ||
      entry.branchId.trim().length === 0 ||
      typeof entry.isActive !== 'boolean' ||
      seenBranchIds.has(entry.branchId)
    ) {
      throw new ApiError(400, 'TRADE.VALIDATION_FAILED', { links: ['invalid'] });
    }
    seenBranchIds.add(entry.branchId);
  }

  const company = FAKE_COMPANIES.find((c) => c.id === companyId);
  const validBranchIds = new Set(company?.branches.map((b) => b.id) ?? []);
  for (const entry of links) {
    if (!validBranchIds.has(entry.branchId)) {
      throw new ApiError(422, 'TRADE.CONTEXT.BRANCH_COMPANY_MISMATCH');
    }
  }

  const channel = TRADE_FAKE_DB.channels.find((c) => c.id === id && c.companyId === companyId);
  if (!channel) {
    throw new ApiError(404, 'TRADE.CATALOG.CHANNEL_NOT_FOUND');
  }

  if (channel.version !== version) {
    throw new ApiError(409, 'TRADE.CONCURRENCY.STALE_VERSION');
  }

  for (const entry of links) {
    const existing = TRADE_FAKE_DB.channelBranches.find(
      (item) =>
        item.channelId === id && item.companyId === companyId && item.branchId === entry.branchId,
    );
    if (existing) {
      if (existing.isActive !== entry.isActive) {
        existing.isActive = entry.isActive;
        bumpVersion(existing);
      }
    } else {
      const created: ChannelBranch = {
        id: fakeId(),
        channelId: id,
        companyId,
        branchId: entry.branchId,
        isActive: entry.isActive,
        version: 1,
      };
      TRADE_FAKE_DB.channelBranches.push(created);
    }
  }

  bumpVersion(channel);
  const detail = buildChannelDetail(channel, companyId);
  storeIdempotency(key, fingerprint, detail);
  return clone(detail);
}
