import { errorCodeOf, errorKey, type TradeContext } from '../../shared/trade-api';
import type { Channel } from '../../shared/trade-foundation.model';
import {
  fakeCountChannels,
  fakeCreateChannel,
  fakeGetChannel,
  fakeListChannelRows,
  fakePatchChannel,
  fakeSetChannelBranches,
} from './channels.fake';
import type {
  ChannelBranchInput,
  ChannelCountFilter,
  ChannelCreateBody,
  ChannelDetail,
  ChannelListQuery,
  ChannelListResult,
  ChannelPatchBody,
  ChannelStatusCounts,
} from './channels.model';

// GET /api/tenant/trade/v1/channels?search&status&channelType&sort&direction&page&limit (+ x-mutakamel-company-id)
export async function listChannelRows(
  ctx: TradeContext,
  q: ChannelListQuery = {},
): Promise<ChannelListResult> {
  return fakeListChannelRows(ctx, q);
}

// GET /api/tenant/trade/v1/channels/status-counts?search&channelType (+ x-mutakamel-company-id)
export async function countChannels(
  ctx: TradeContext,
  f: ChannelCountFilter = {},
): Promise<ChannelStatusCounts> {
  return fakeCountChannels(ctx, f);
}

// GET /api/tenant/trade/v1/channels/:id (+ x-mutakamel-company-id)
export async function getChannel(ctx: TradeContext, id: string): Promise<ChannelDetail> {
  return fakeGetChannel(ctx, id);
}

// POST /api/tenant/trade/v1/channels (201, + x-mutakamel-company-id, x-idempotency-key)
export async function createChannel(
  ctx: TradeContext,
  body: ChannelCreateBody,
  key: string,
): Promise<Channel> {
  return fakeCreateChannel(ctx, body, key);
}

// PATCH /api/tenant/trade/v1/channels/:id (+ x-mutakamel-company-id, If-Match: "<version>", x-idempotency-key)
export async function patchChannel(
  ctx: TradeContext,
  id: string,
  version: number,
  body: ChannelPatchBody,
  key: string,
): Promise<Channel> {
  return fakePatchChannel(ctx, id, version, body, key);
}

// PUT /api/tenant/trade/v1/channels/:id/branches { links: [{ branchId, isActive }] } (+ x-mutakamel-company-id, If-Match: "<version>", x-idempotency-key)
export async function setChannelBranches(
  ctx: TradeContext,
  id: string,
  version: number,
  links: readonly ChannelBranchInput[],
  key: string,
): Promise<ChannelDetail> {
  return fakeSetChannelBranches(ctx, id, version, links, key);
}

export function channelErrorKey(e: unknown): string {
  const code = errorCodeOf(e);
  if (!code) {
    return 'tradeShared.errors.generic';
  }
  return errorKey(e);
}
