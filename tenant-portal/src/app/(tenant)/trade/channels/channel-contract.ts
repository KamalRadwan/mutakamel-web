import type { TradePath } from "@/lib/api/envelope";
import {
  isNonEmptyString,
  isNullableUuidV7,
  isRowVersion,
  isTimestamp,
  isUuidV7,
  record,
} from "../trade-validation";

// docs/api/trade-foundation.md#channels--6-routes, verified against
// trade-app/src/modules/catalog/catalog.controller.ts (CatalogChannelsController),
// catalog.service.ts and packages/database/src/entities/tenant/foundation.entities.ts.

export const CHANNELS_PATH = "/api/tenant/trade/v1/channels";

/** `CreateChannelDto` column bounds. */
export const CHANNEL_CODE_MAX_LENGTH = 80;
export const CHANNEL_NAME_MAX_LENGTH = 160;
export const CHANNEL_STATUS_MAX_LENGTH = 32;

/**
 * `CODE_PATTERN` in `trade-app/packages/common/src/helpers/validation.ts`.
 *
 * This is enforced here because the server does **not** enforce it as a
 * validation error: `CreateChannelDto.code` is only `@IsString() @MinLength(1)
 * @MaxLength(80)`, and `createChannel` then calls `normalizeTradeCode`, which
 * throws a bare `TypeError` for anything outside this pattern. A `TypeError`
 * is not a Nest exception, so a channel code containing a space answers **500**
 * rather than a 422. Recorded as Q72.
 */
const TRADE_CODE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/u;

/** `ChannelType` — trade-app/packages/common/src/enums/trade.enums.ts. Immutable after create. */
export const CHANNEL_TYPES = [
  "INTERNAL_SALES",
  "POS",
  "ECOMMERCE",
  "B2B_PORTAL",
  "MARKETPLACE",
  "FIELD_SALES",
  "API",
] as const;
export type ChannelType = (typeof CHANNEL_TYPES)[number];

/**
 * Channel status has **no enum and no check constraint**.
 *
 * `UpdateChannelDto.status` is a free `@IsString() @MaxLength(32)`. Only
 * `ACTIVE` is proven from source — `TradeScopeGuard` compares the column
 * against that literal when validating `x-mutakamel-channel-id`. The set is
 * open, so the portal renders a known member through its own label and
 * anything else through the neutral unknown chip. Q31.
 */
export const CHANNEL_KNOWN_STATUSES = ["ACTIVE", "INACTIVE"] as const;

/** `catalog.service.ts` — three distinct failures share one code, at 404, 409 and 422. */
export const CHANNEL_INVALID_CODE = "TRADE.CATALOG.CHANNEL_INVALID";
export const CHANNEL_CODE_TAKEN_CODE = "TRADE.CATALOG.CODE_TAKEN";

export interface Channel {
  id: string;
  companyId: string;
  code: string;
  name: string;
  channelType: string;
  status: string;
  configurationProfileVersionId: string | null;
  version: number;
  updatedAt: string;
}

export interface ChannelBranch {
  id: string;
  channelId: string;
  companyId: string;
  branchId: string;
  isActive: boolean;
  version: number;
  updatedAt: string;
}

export interface ChannelDetail extends Channel {
  branches: ChannelBranch[];
}

export interface ChannelFormValues {
  code: string;
  name: string;
  channelType: ChannelType;
  status: string;
}

export const EMPTY_CHANNEL_FORM: ChannelFormValues = {
  code: "",
  name: "",
  channelType: "INTERNAL_SALES",
  status: "ACTIVE",
};

export function toChannelForm(channel: Channel): ChannelFormValues {
  return {
    code: channel.code,
    name: channel.name,
    channelType: isChannelType(channel.channelType) ? channel.channelType : "INTERNAL_SALES",
    status: channel.status,
  };
}

export function isChannelType(value: unknown): value is ChannelType {
  return typeof value === "string" && (CHANNEL_TYPES as readonly string[]).includes(value);
}

export function channelPath(id: string): TradePath {
  if (!isUuidV7(id)) invalidResponse();
  return `${CHANNELS_PATH}/${encodeURIComponent(id)}` as TradePath;
}

export function channelBranchesPath(id: string): TradePath {
  return `${channelPath(id)}/branches` as TradePath;
}

export function channelBranchPath(id: string, branchId: string): TradePath {
  if (!isUuidV7(branchId)) invalidResponse();
  return `${channelBranchesPath(id)}/${encodeURIComponent(branchId)}` as TradePath;
}

/** `CreateChannelDto`. */
export interface CreateChannelRequest {
  code: string;
  name: string;
  channelType: ChannelType;
}

/** `UpdateChannelDto` — no `channelType`; the type is set at create and cannot change. */
export interface UpdateChannelRequest {
  name?: string;
  status?: string;
}

export function buildCreateChannelRequest(values: ChannelFormValues): CreateChannelRequest {
  const code = values.code.trim().toUpperCase();
  const name = values.name.trim();
  if (!TRADE_CODE_PATTERN.test(code)) throw new Error("CHANNEL_FORM_CODE");
  if (name.length === 0 || name.length > CHANNEL_NAME_MAX_LENGTH) {
    throw new Error("CHANNEL_FORM_NAME");
  }
  if (!isChannelType(values.channelType)) throw new Error("CHANNEL_FORM_TYPE");
  return { code, name, channelType: values.channelType };
}

export function buildUpdateChannelRequest(
  current: Channel,
  values: ChannelFormValues,
): UpdateChannelRequest {
  const request: UpdateChannelRequest = {};
  const name = values.name.trim();
  if (name.length === 0 || name.length > CHANNEL_NAME_MAX_LENGTH) {
    throw new Error("CHANNEL_FORM_NAME");
  }
  if (name !== current.name) request.name = name;

  const status = values.status.trim();
  if (status.length === 0 || status.length > CHANNEL_STATUS_MAX_LENGTH) {
    throw new Error("CHANNEL_FORM_STATUS");
  }
  if (status !== current.status) request.status = status;
  return request;
}

export function parseChannelResponse(payload: unknown): Channel {
  const channel = record(payload);
  if (
    !channel ||
    !isUuidV7(channel.id) ||
    !isUuidV7(channel.companyId) ||
    !isNonEmptyString(channel.code, CHANNEL_CODE_MAX_LENGTH) ||
    !isNonEmptyString(channel.name, CHANNEL_NAME_MAX_LENGTH) ||
    !isNonEmptyString(channel.channelType, 32) ||
    !isNonEmptyString(channel.status, 16) ||
    !isNullableUuidV7(channel.configurationProfileVersionId) ||
    !isRowVersion(channel.version) ||
    !isTimestamp(channel.updatedAt)
  ) {
    invalidResponse();
  }
  return {
    id: channel.id,
    companyId: channel.companyId,
    code: channel.code,
    name: channel.name,
    channelType: channel.channelType,
    status: channel.status,
    configurationProfileVersionId:
      (channel.configurationProfileVersionId as string | null | undefined) ?? null,
    version: channel.version,
    updatedAt: channel.updatedAt,
  };
}

/**
 * `GET /channels` answers a **bare array**, not `{ items, total, page, limit }`.
 *
 * `CatalogService.listChannels` returns the repository `find()` result
 * directly, ordered `createdAt DESC`, with no pagination of any kind. A
 * generic list adapter reads `undefined` here, which is why this has its own
 * parser and its own screen-level "everything is on one page" pager.
 */
export function parseChannelListResponse(payload: unknown): Channel[] {
  if (!Array.isArray(payload)) invalidResponse();
  return payload.map(parseChannelResponse);
}

function parseChannelBranchResponse(payload: unknown): ChannelBranch {
  const branch = record(payload);
  if (
    !branch ||
    !isUuidV7(branch.id) ||
    !isUuidV7(branch.channelId) ||
    !isUuidV7(branch.companyId) ||
    !isUuidV7(branch.branchId) ||
    typeof branch.isActive !== "boolean" ||
    !isRowVersion(branch.version) ||
    !isTimestamp(branch.updatedAt)
  ) {
    invalidResponse();
  }
  return {
    id: branch.id,
    channelId: branch.channelId,
    companyId: branch.companyId,
    branchId: branch.branchId,
    isActive: branch.isActive,
    version: branch.version,
    updatedAt: branch.updatedAt,
  };
}

export function parseChannelDetailResponse(payload: unknown): ChannelDetail {
  const channel = parseChannelResponse(payload);
  const detail = record(payload);
  if (!detail || !Array.isArray(detail.branches)) invalidResponse();
  return { ...channel, branches: detail.branches.map(parseChannelBranchResponse) };
}

function invalidResponse(): never {
  throw new Error("Invalid Trade channels response.");
}
