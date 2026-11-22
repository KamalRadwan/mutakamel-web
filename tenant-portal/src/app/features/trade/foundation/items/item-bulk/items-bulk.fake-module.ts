import {
  type FakeBulkModule,
  registerFakeBulkModule,
} from '../../../../../shared/bulk-jobs/bulk-jobs.fake';
import {
  BULK_JOB_LIMITS,
  type BulkJob,
  type BulkJobItem,
  type BulkJobItemStatus,
  type BulkJobSubmit,
} from '../../../../../shared/bulk-jobs/bulk-jobs.model';
import { ApiError, fakeId } from '../../../shared/trade-api';
import { itemName } from '../../../shared/trade-foundation.api';
import {
  TRADE_FAKE_DB,
  assertUsableReason,
  bumpVersion,
  fakeLang,
  nowIso,
} from '../../../shared/trade-foundation.fake';
import type {
  CategoryNode,
  ComboComponent,
  FakeItem,
  ItemCompanyProfile,
  ItemKind,
  ItemStatus,
  ItemTrackingMode,
} from '../../../shared/trade-foundation.model';
import { ALLOWED_ITEM_STATUS_MOVES } from '../../../shared/trade-labels';
import { ITEM_KINDS, ITEM_STATUSES } from '../items.model';
import { TRADE_ITEMS_BULK_APP, TRADE_ITEMS_BULK_MODULE_NAME } from './item-bulk.model';

interface ResolvedTradeItem {
  entityId: string;
  label: string;
  preStatus?: 'SKIPPED' | 'FAILED';
  code?: string;
  data?: Record<string, string | number | null>;
}

interface ChunkItemOutcome {
  ordinal: number;
  status: BulkJobItemStatus;
  code?: string;
  field?: string;
  refId?: string;
}

const VALID_TRACKING_MODES: readonly ItemTrackingMode[] = ['NONE', 'LOT', 'SERIAL'];
const COMPANY_CURRENCY: Record<string, string> = {
  c1: 'EGP',
  c2: 'SAR',
};
const TRACKING_LOCKED = new Set<string>(['item-01:c1', 'item-02:c1', 'item-17:c1']);

const COMPANY_REQUIRED = 'TRADE.CONTEXT.COMPANY_REQUIRED';
const AUTH_TARGET_DENIED = 'TRADE.AUTH.TARGET_DENIED';
/** Backend handler codes: these three are unprefixed (SKIPPED results and mapError). */
const PROFILE_EXISTS = 'COMPANY_PROFILE_ALREADY_EXISTS';
const PROFILE_MISSING = 'COMPANY_PROFILE_NOT_FOUND';
const CAPABILITY_INCOMPATIBLE = 'CAPABILITY_INCOMPATIBLE';
const REASON_NOTE_MAX = 500;
const QUERY_SEARCH_MAX = 160;
const QUERY_CATEGORY_IDS_MAX = 50;
const CAPABILITY_KEYS = ['canSell', 'canPurchase', 'canPos', 'trackInventory'] as const;

/** Backend ItemsBulkQueryDto = CatalogListQueryDto without page/limit. */
const QUERY_KEYS = new Set([
  'itemKind',
  'status',
  'purpose',
  'search',
  'categoryId',
  'categoryIds',
  'includeSubcategories',
  'ownerUserId',
  'hasImage',
  'sort',
  'direction',
  'scope',
  // Agreed contract from backend run trade-bulk-locale-channel-codex (optional, POS only; not merged yet).
  'channelId',
]);

/** Allowed params per action, as the backend schemas (whitelist + forbidNonWhitelisted). */
const PARAM_KEYS: Record<string, readonly string[]> = {
  SET_STATUS: ['status', 'reasonCodeId', 'reasonNote'],
  SET_CATEGORY: ['categoryId'],
  ENABLE_FOR_COMPANY: [...CAPABILITY_KEYS, 'trackingMode', 'salesTaxId', 'purchaseTaxId'],
  SET_CAPABILITIES: CAPABILITY_KEYS,
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function paramsInvalid(): never {
  throw new ApiError(400, 'BULK_JOB_PARAMS_INVALID');
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/** Strict params check per action, like the backend schemas: wrong key or type -> 400 BULK_JOB_PARAMS_INVALID. */
function parseParams(action: string, rawParams: unknown): Record<string, unknown> {
  const allowed = PARAM_KEYS[action];
  if (!allowed) throw new ApiError(400, 'BULK_JOB_MODULE_UNKNOWN');
  const params = asRecord(rawParams);
  if (!params) paramsInvalid();
  if (Object.keys(params).some((key) => !allowed.includes(key))) paramsInvalid();
  const bool = (key: string, required: boolean) => {
    const value = params[key];
    if (value === undefined ? required : typeof value !== 'boolean') paramsInvalid();
  };
  const idOrNull = (key: string, required: boolean) => {
    const value = params[key];
    if (value === undefined && !required) return;
    if (value !== null && !isNonEmptyString(value)) paramsInvalid();
  };

  switch (action) {
    case 'SET_STATUS': {
      if (!ITEM_STATUSES.includes(params['status'] as ItemStatus)) paramsInvalid();
      idOrNull('reasonCodeId', false);
      const note = params['reasonNote'];
      if (
        note !== undefined &&
        note !== null &&
        (typeof note !== 'string' || note.length > REASON_NOTE_MAX)
      ) {
        paramsInvalid();
      }
      break;
    }
    case 'SET_CATEGORY':
      idOrNull('categoryId', true);
      break;
    case 'ENABLE_FOR_COMPANY':
      for (const key of CAPABILITY_KEYS) bool(key, true);
      if (!VALID_TRACKING_MODES.includes(params['trackingMode'] as ItemTrackingMode))
        paramsInvalid();
      // Present on purpose: null is allowed, a missing key is not.
      idOrNull('salesTaxId', true);
      idOrNull('purchaseTaxId', true);
      break;
    default:
      for (const key of CAPABILITY_KEYS) bool(key, false);
  }
  return params;
}

/** Strict like ItemsBulkQueryDto: a flat object with list keys only, else 400 BULK_JOB_PARAMS_INVALID. */
function parseQuery(rawQuery: unknown): Record<string, unknown> {
  if (rawQuery === undefined) return {};
  const query = asRecord(rawQuery);
  if (!query) paramsInvalid();
  if (Object.keys(query).some((key) => !QUERY_KEYS.has(key))) paramsInvalid();
  const oneOf = (key: string, values: readonly string[]) => {
    if (query[key] !== undefined && !values.includes(query[key] as string)) paramsInvalid();
  };
  oneOf('itemKind', ITEM_KINDS);
  oneOf('status', ITEM_STATUSES);
  oneOf('purpose', ['SALES', 'PURCHASE', 'POS']);
  oneOf('sort', ['createdAt', 'updatedAt', 'canonicalCode', 'name']);
  oneOf('direction', ['asc', 'desc']);
  oneOf('scope', ['CATALOGUE', 'COMPANY']);
  const search = query['search'];
  if (search !== undefined && (typeof search !== 'string' || search.length > QUERY_SEARCH_MAX))
    paramsInvalid();
  for (const key of ['categoryId', 'ownerUserId', 'channelId']) {
    if (query[key] !== undefined && !isNonEmptyString(query[key])) paramsInvalid();
  }
  const categoryIds = query['categoryIds'];
  if (
    categoryIds !== undefined &&
    (!Array.isArray(categoryIds) ||
      categoryIds.length > QUERY_CATEGORY_IDS_MAX ||
      !categoryIds.every((id) => isNonEmptyString(id)))
  ) {
    paramsInvalid();
  }
  for (const key of ['includeSubcategories', 'hasImage']) {
    if (query[key] !== undefined && typeof query[key] !== 'boolean') paramsInvalid();
  }
  return query;
}

/** Backend authorizeAccess: master actions are tenant scope only (403); company actions need a company (422). */
function authorizeAccess(action: string, scope: BulkJobSubmit['scope']): void {
  if (action === 'SET_STATUS' || action === 'SET_CATEGORY') {
    if (scope.companyId || scope.branchId) throw new ApiError(403, AUTH_TARGET_DENIED);
    return;
  }
  if (!scope.companyId) throw new ApiError(422, COMPANY_REQUIRED);
}

function itemLabel(item: FakeItem): string {
  const display = itemName(item, fakeLang());
  return display ? `${display} (${item.canonicalCode})` : item.canonicalCode;
}

function findActiveItem(id: string): FakeItem | null {
  return TRADE_FAKE_DB.items.find((entry) => entry.id === id && entry.deletedAt === null) ?? null;
}

function findCompanyProfile(itemId: string, companyId: string): ItemCompanyProfile | null {
  return (
    TRADE_FAKE_DB.companyProfiles.find((p) => p.itemId === itemId && p.companyId === companyId) ??
    null
  );
}

function itemHasAssortedBranch(
  itemId: string,
  companyProfileId: string | undefined,
  branchId: string,
): boolean {
  if (companyProfileId) {
    return TRADE_FAKE_DB.branchProfiles.some(
      (b) => b.itemCompanyProfileId === companyProfileId && b.branchId === branchId && b.isAssorted,
    );
  }
  return TRADE_FAKE_DB.branchProfiles.some(
    (b) =>
      b.branchId === branchId &&
      b.isAssorted &&
      TRADE_FAKE_DB.companyProfiles.some(
        (p) => p.id === b.itemCompanyProfileId && p.itemId === itemId,
      ),
  );
}

function activeCategoryChain(categoryId: string): CategoryNode[] | null {
  const byId = new Map(TRADE_FAKE_DB.categories.map((cat) => [cat.id, cat]));
  const chain: CategoryNode[] = [];
  const visited = new Set<string>();
  let currId: string | null = categoryId;

  while (currId) {
    if (visited.has(currId)) return null;
    visited.add(currId);
    const node = byId.get(currId);
    if (!node || node.deletedAt !== null || node.status !== 'ACTIVE') return null;
    chain.unshift(node);
    currId = node.parentId;
  }

  return chain.length > 0 ? chain : null;
}

function categoryAncestorsForRow(categoryId: string | null): Set<string> | null {
  if (!categoryId) return null;
  const byId = new Map(TRADE_FAKE_DB.categories.map((cat) => [cat.id, cat]));
  const ids = new Set<string>();
  let currId: string | null = categoryId;

  while (currId && !ids.has(currId)) {
    const node = byId.get(currId);
    if (!node || node.deletedAt !== null) break;
    ids.add(node.id);
    currId = node.parentId;
  }

  return ids.size > 0 ? ids : null;
}

function matchesItemSearch(item: FakeItem, needle: string): boolean {
  if (item.canonicalCode.toLowerCase().includes(needle)) return true;
  if (item.barcode && item.barcode.toLowerCase().includes(needle)) return true;
  for (const name of Object.values(item.localizedNames)) {
    if (name.toLowerCase().includes(needle)) return true;
  }
  return false;
}

function comboActivationReady(components: readonly ComboComponent[]): boolean {
  if (components.length === 0) return false;
  for (const component of components) {
    const target = findActiveItem(component.componentItemId);
    if (!target || target.itemKind !== 'PRODUCT' || target.status !== 'ACTIVE') {
      return false;
    }
  }
  return true;
}

/** Backend reason(): SET_STATUS to DISCONTINUED only; a missing id -> 422 NOT_FOUND, then the assertUsable order. */
function assertDiscontinueReason(params: Record<string, unknown>): void {
  if (params['status'] !== 'DISCONTINUED') return;
  const reasonCodeId = asString(params['reasonCodeId']);
  if (!reasonCodeId) {
    throw new ApiError(422, 'TRADE.REASON.NOT_FOUND', { field: ['reasonCodeId'] });
  }
  const note = typeof params['reasonNote'] === 'string' ? params['reasonNote'] : null;
  assertUsableReason({ id: reasonCodeId, kind: 'ITEM_DISCONTINUE', note });
}

function isTaxValidForCompany(taxId: string | null, companyId: string): boolean {
  if (!taxId) return true;
  const tax = TRADE_FAKE_DB.taxes.find((entry) => entry.id === taxId);
  return Boolean(tax && (tax.companyId === null || tax.companyId === companyId));
}

function itemMatchesQuery(
  item: FakeItem,
  scope: BulkJobSubmit['scope'],
  filter: Record<string, unknown>,
): boolean {
  if (item.deletedAt !== null) return false;

  const status = asString(filter['status']);
  if (status && item.status !== status) return false;

  const itemKind = asString(filter['itemKind']);
  if (itemKind && item.itemKind !== itemKind) return false;

  if (filter['hasImage'] === true && !item.image) return false;
  if (filter['hasImage'] === false && item.image !== null) return false;

  const categoryId = asString(filter['categoryId']);
  if (categoryId) {
    if (filter['includeSubcategories'] === true) {
      const ancestors = categoryAncestorsForRow(item.categoryId);
      if (!ancestors || !ancestors.has(categoryId)) return false;
    } else if (item.categoryId !== categoryId) {
      return false;
    }
  }

  const categoryIds = Array.isArray(filter['categoryIds'])
    ? (filter['categoryIds'] as string[])
    : null;
  if (categoryIds && categoryIds.length > 0) {
    const ancestors = categoryAncestorsForRow(item.categoryId);
    if (!ancestors || !categoryIds.some((id) => ancestors.has(id))) return false;
  }

  const ownerUserId = asString(filter['ownerUserId']);
  if (ownerUserId && item.ownerUserId !== ownerUserId) return false;

  const search = typeof filter['search'] === 'string' ? filter['search'].trim().toLowerCase() : '';
  if (search && !matchesItemSearch(item, search)) return false;

  const companyId = scope.companyId;
  const cp = companyId ? findCompanyProfile(item.id, companyId) : null;
  if (companyId && filter['scope'] !== 'CATALOGUE' && !cp) return false;

  if (scope.branchId && !itemHasAssortedBranch(item.id, cp?.id, scope.branchId)) {
    return false;
  }

  const purpose = asString(filter['purpose']);
  if (purpose === 'SALES') {
    if (!cp || item.status !== 'ACTIVE' || cp.status !== 'ACTIVE' || !cp.canSell) return false;
  } else if (purpose === 'PURCHASE') {
    if (!cp || item.status !== 'ACTIVE' || cp.status !== 'ACTIVE' || !cp.canPurchase) return false;
  }

  return true;
}

/**
 * Same rule as the items list POS purpose: a POS-purpose query needs `channelId`, and any
 * `channelId` must be an active channel of the company (POS for the POS purpose), linked to
 * the branch in branch scope. Otherwise TRADE.CATALOG.CHANNEL_INVALID.
 */
export function validateQueryChannel(
  scope: { companyId?: string; branchId?: string },
  filter: Record<string, unknown>,
): void {
  const purpose = asString(filter['purpose']);
  const channelId = asString(filter['channelId']);
  if (!channelId) {
    if (purpose === 'POS') throw new ApiError(422, 'TRADE.CATALOG.CHANNEL_INVALID');
    return;
  }
  const channel = TRADE_FAKE_DB.channels.find(
    (c) => c.id === channelId && c.companyId === scope.companyId,
  );
  if (
    !channel ||
    channel.status !== 'ACTIVE' ||
    (purpose === 'POS' && channel.channelType !== 'POS')
  ) {
    throw new ApiError(422, 'TRADE.CATALOG.CHANNEL_INVALID');
  }
  if (
    scope.branchId &&
    !TRADE_FAKE_DB.channelBranches.some(
      (cb) =>
        cb.channelId === channelId &&
        cb.companyId === scope.companyId &&
        cb.branchId === scope.branchId &&
        cb.isActive,
    )
  ) {
    throw new ApiError(422, 'TRADE.CATALOG.CHANNEL_INVALID');
  }
}

const TRADE_ITEMS_FAKE_BULK_MODULE: FakeBulkModule = {
  module: TRADE_ITEMS_BULK_MODULE_NAME,

  chunkSize(): number {
    return BULK_JOB_LIMITS.chunkSize;
  },

  validate(body: BulkJobSubmit): void {
    // Backend submit order: params schema -> query schema (400) -> authorizeAccess (403 / 422) -> reason (422).
    // Category, capability and tax rules are per-item results at execution, as in the handler.
    const params = parseParams(body.action, body.params);
    if (body.selection.kind === 'QUERY') parseQuery(body.selection.query);
    authorizeAccess(body.action, body.scope);
    if (body.action === 'SET_STATUS') assertDiscontinueReason(params);
  },

  async resolve(body: BulkJobSubmit): Promise<ResolvedTradeItem[]> {
    if (body.selection.kind === 'IDS') {
      return body.selection.ids.map((id): ResolvedTradeItem => {
        const found = findActiveItem(id);
        if (!found) {
          return {
            entityId: id,
            label: id,
            preStatus: 'FAILED',
            code: 'TRADE.CATALOG.ITEM_NOT_FOUND',
          };
        }
        return {
          entityId: found.id,
          label: itemLabel(found),
          data: {
            canonicalCode: found.canonicalCode,
            itemKind: found.itemKind,
            status: found.status,
            categoryId: found.categoryId,
          },
        };
      });
    }

    const filter = parseQuery(body.selection.query);
    if (filter['purpose'] && !body.scope.companyId) {
      throw new ApiError(422, 'TRADE.CATALOG.COMPANY_PROFILE_INVALID');
    }
    validateQueryChannel(body.scope, filter);
    const excluded = new Set(body.selection.excludedIds ?? []);
    const matched = TRADE_FAKE_DB.items
      .filter((item) => !excluded.has(item.id) && itemMatchesQuery(item, body.scope, filter))
      .sort((a, b) => {
        const cmp = b.createdAt.localeCompare(a.createdAt);
        return cmp !== 0 ? cmp : b.id.localeCompare(a.id);
      });

    if (matched.length > BULK_JOB_LIMITS.maxItems) {
      throw new ApiError(422, 'BULK_SELECTION_TOO_LARGE', {
        max: [String(BULK_JOB_LIMITS.maxItems)],
      });
    }

    return matched.map((item): ResolvedTradeItem => ({
      entityId: item.id,
      label: itemLabel(item),
      data: {
        canonicalCode: item.canonicalCode,
        itemKind: item.itemKind,
        status: item.status,
        categoryId: item.categoryId,
      },
    }));
  },

  async executeChunk(
    job: BulkJob,
    rawParams: unknown,
    items: BulkJobItem[],
  ): Promise<ChunkItemOutcome[]> {
    const params = asRecord(rawParams);

    return items.map((item): ChunkItemOutcome => {
      const dbItem = findActiveItem(item.entityId);
      if (!dbItem) {
        return {
          ordinal: item.ordinal,
          status: 'FAILED',
          code: 'TRADE.CATALOG.ITEM_NOT_FOUND',
        };
      }

      switch (job.action) {
        case 'SET_STATUS': {
          const targetStatus = asString(params?.['status']) as ItemStatus | null;
          if (!targetStatus || !ITEM_STATUSES.includes(targetStatus)) {
            return {
              ordinal: item.ordinal,
              status: 'FAILED',
              code: 'TRADE.VALIDATION_FAILED',
              field: 'status',
            };
          }
          if (dbItem.status === targetStatus) {
            return { ordinal: item.ordinal, status: 'UNCHANGED' };
          }
          if (!ALLOWED_ITEM_STATUS_MOVES[dbItem.status].includes(targetStatus)) {
            return {
              ordinal: item.ordinal,
              status: 'FAILED',
              code: 'TRADE.CATALOG.ITEM_IDENTITY_INVALID',
              field: 'status',
            };
          }
          if (
            dbItem.itemKind === 'COMBO' &&
            targetStatus === 'ACTIVE' &&
            !comboActivationReady(dbItem.comboComponents)
          ) {
            return {
              ordinal: item.ordinal,
              status: 'FAILED',
              code: 'TRADE.CATALOG.ITEM_IDENTITY_INVALID',
              field: 'status',
            };
          }
          if (targetStatus === 'DISCONTINUED') {
            try {
              assertDiscontinueReason(params ?? {});
            } catch (error) {
              const field = error instanceof ApiError ? error.details?.['field'] : undefined;
              return {
                ordinal: item.ordinal,
                status: 'FAILED',
                code: error instanceof ApiError ? error.code : 'generic',
                ...(Array.isArray(field) && typeof field[0] === 'string'
                  ? { field: field[0] }
                  : {}),
              };
            }
          }

          dbItem.status = targetStatus;
          dbItem.updatedBy = 'usr-1';
          bumpVersion(dbItem);
          return { ordinal: item.ordinal, status: 'SUCCEEDED' };
        }

        case 'SET_CATEGORY': {
          const rawCat = params?.['categoryId'];
          const nextCategoryId = rawCat === null || rawCat === undefined ? null : asString(rawCat);
          if (rawCat !== null && rawCat !== undefined && !nextCategoryId) {
            return {
              ordinal: item.ordinal,
              status: 'FAILED',
              code: 'TRADE.CATALOG.CATEGORY_ASSIGNMENT_INVALID',
              field: 'categoryId',
            };
          }
          if (dbItem.categoryId === nextCategoryId) {
            return { ordinal: item.ordinal, status: 'UNCHANGED' };
          }
          if (nextCategoryId && !activeCategoryChain(nextCategoryId)) {
            return {
              ordinal: item.ordinal,
              status: 'FAILED',
              code: 'TRADE.CATALOG.CATEGORY_ASSIGNMENT_INVALID',
              field: 'categoryId',
            };
          }

          dbItem.categoryId = nextCategoryId;
          dbItem.updatedBy = 'usr-1';
          bumpVersion(dbItem);
          return { ordinal: item.ordinal, status: 'SUCCEEDED' };
        }

        case 'ENABLE_FOR_COMPANY': {
          const companyId = job.scope.companyId;
          if (!companyId) {
            return { ordinal: item.ordinal, status: 'FAILED', code: COMPANY_REQUIRED };
          }
          if (findCompanyProfile(dbItem.id, companyId)) {
            return {
              ordinal: item.ordinal,
              status: 'SKIPPED',
              code: PROFILE_EXISTS,
            };
          }

          const canSell = Boolean(params?.['canSell']);
          const canPurchase = Boolean(params?.['canPurchase']);
          const canPos = Boolean(params?.['canPos']);
          if (canPos && !canSell) {
            return {
              ordinal: item.ordinal,
              status: 'FAILED',
              code: CAPABILITY_INCOMPATIBLE,
              field: 'canPos',
            };
          }

          if (!params?.['trackInventory'] && params?.['trackingMode'] !== 'NONE') {
            return {
              ordinal: item.ordinal,
              status: 'FAILED',
              code: CAPABILITY_INCOMPATIBLE,
              field: 'trackingMode',
            };
          }

          const salesTaxId = asString(params?.['salesTaxId']);
          const purchaseTaxId = asString(params?.['purchaseTaxId']);
          if (
            !isTaxValidForCompany(salesTaxId, companyId) ||
            !isTaxValidForCompany(purchaseTaxId, companyId)
          ) {
            return {
              ordinal: item.ordinal,
              status: 'FAILED',
              code: 'TRADE.CATALOG.COMPANY_PROFILE_INVALID',
            };
          }

          const isProduct = dbItem.itemKind === 'PRODUCT';
          const requestedTrack = Boolean(params?.['trackInventory']);
          const requestedMode =
            (asString(params?.['trackingMode']) as ItemTrackingMode | null) ?? 'NONE';
          const trackInventory = isProduct ? requestedTrack : false;
          const trackingMode: ItemTrackingMode =
            isProduct && trackInventory ? requestedMode : 'NONE';

          const created: ItemCompanyProfile = {
            id: fakeId(),
            itemId: dbItem.id,
            companyId,
            canSell,
            canPurchase,
            canPos,
            trackInventory,
            trackingMode,
            taxClassificationKey: null,
            defaultSalesUomId: null,
            defaultPurchaseUomId: null,
            salesPrice: null,
            currencyCode: COMPANY_CURRENCY[companyId] ?? null,
            salesTaxId,
            purchaseTaxId,
            capabilitySet: [],
            capabilitySetVersion: 1,
            accountingMappingKey: null,
            status: dbItem.status === 'DRAFT' ? 'DRAFT' : 'ACTIVE',
            version: 1,
            updatedAt: nowIso(),
          };
          TRADE_FAKE_DB.companyProfiles.push(created);
          return { ordinal: item.ordinal, status: 'SUCCEEDED', refId: created.id };
        }

        case 'SET_CAPABILITIES': {
          const companyId = job.scope.companyId;
          if (!companyId) {
            return { ordinal: item.ordinal, status: 'FAILED', code: COMPANY_REQUIRED };
          }
          const profile = findCompanyProfile(dbItem.id, companyId);
          if (!profile) {
            return {
              ordinal: item.ordinal,
              status: 'SKIPPED',
              code: PROFILE_MISSING,
            };
          }

          const nextCanSell =
            typeof params?.['canSell'] === 'boolean' ? params['canSell'] : profile.canSell;
          const nextCanPurchase =
            typeof params?.['canPurchase'] === 'boolean'
              ? params['canPurchase']
              : profile.canPurchase;
          const nextCanPos =
            typeof params?.['canPos'] === 'boolean' ? params['canPos'] : profile.canPos;
          const nextTrackInventory =
            typeof params?.['trackInventory'] === 'boolean'
              ? params['trackInventory']
              : profile.trackInventory;
          const nextTrackingMode: ItemTrackingMode = nextTrackInventory
            ? profile.trackingMode
            : 'NONE';

          if (nextCanPos && !nextCanSell) {
            return {
              ordinal: item.ordinal,
              status: 'FAILED',
              code: CAPABILITY_INCOMPATIBLE,
              field: 'canPos',
            };
          }
          if (dbItem.itemKind !== 'PRODUCT' && nextTrackInventory) {
            return {
              ordinal: item.ordinal,
              status: 'FAILED',
              code: CAPABILITY_INCOMPATIBLE,
              field: 'trackInventory',
            };
          }
          if (
            TRACKING_LOCKED.has(`${dbItem.id}:${companyId}`) &&
            (nextTrackInventory !== profile.trackInventory ||
              nextTrackingMode !== profile.trackingMode)
          ) {
            return {
              ordinal: item.ordinal,
              status: 'FAILED',
              code: 'TRADE.CATALOG.TRACKING_LOCKED',
              field: 'trackInventory',
            };
          }

          if (
            nextCanSell === profile.canSell &&
            nextCanPurchase === profile.canPurchase &&
            nextCanPos === profile.canPos &&
            nextTrackInventory === profile.trackInventory &&
            nextTrackingMode === profile.trackingMode
          ) {
            return { ordinal: item.ordinal, status: 'UNCHANGED' };
          }

          profile.canSell = nextCanSell;
          profile.canPurchase = nextCanPurchase;
          profile.canPos = nextCanPos;
          profile.trackInventory = nextTrackInventory;
          profile.trackingMode = nextTrackingMode;
          bumpVersion(profile);

          const costRow = TRADE_FAKE_DB.standardCosts.find(
            (c) => c.companyProfileId === profile.id,
          );
          if (costRow) {
            costRow.version = profile.version;
          }
          return { ordinal: item.ordinal, status: 'SUCCEEDED' };
        }

        default:
          return { ordinal: item.ordinal, status: 'FAILED', code: 'BULK_JOB_PARAMS_INVALID' };
      }
    });
  },

  async current(entityIds: string[]): Promise<Map<string, Record<string, string | number | null>>> {
    const lang = fakeLang();
    const result = new Map<string, Record<string, string | number | null>>();
    for (const id of entityIds) {
      const item = findActiveItem(id);
      if (!item) continue;
      result.set(id, {
        id: item.id,
        canonicalCode: item.canonicalCode,
        name: itemName(item, lang),
        itemKind: item.itemKind as ItemKind,
        status: item.status,
        categoryId: item.categoryId,
        baseUomId: item.baseUomId,
        version: item.version,
        updatedAt: item.updatedAt,
      });
    }
    return result;
  },

  paramsSummary(body: BulkJobSubmit): Record<string, string | number | null> {
    const params = asRecord(body.params);
    const lang = fakeLang();

    switch (body.action) {
      case 'SET_STATUS':
        return {
          status: asString(params?.['status']),
          reasonCodeId: asString(params?.['reasonCodeId']),
        };

      case 'SET_CATEGORY': {
        const categoryId = asString(params?.['categoryId']);
        const cat = categoryId
          ? TRADE_FAKE_DB.categories.find((entry) => entry.id === categoryId)
          : null;
        return {
          categoryId,
          categoryName: cat ? (cat.localizedNames[lang] ?? cat.displayName) : null,
        };
      }

      case 'ENABLE_FOR_COMPANY':
        return {
          companyId: body.scope.companyId ?? null,
          canSell:
            typeof params?.['canSell'] === 'boolean'
              ? params['canSell']
                ? 'true'
                : 'false'
              : null,
          canPurchase:
            typeof params?.['canPurchase'] === 'boolean'
              ? params['canPurchase']
                ? 'true'
                : 'false'
              : null,
          canPos:
            typeof params?.['canPos'] === 'boolean' ? (params['canPos'] ? 'true' : 'false') : null,
          trackInventory:
            typeof params?.['trackInventory'] === 'boolean'
              ? params['trackInventory']
                ? 'true'
                : 'false'
              : null,
          trackingMode: asString(params?.['trackingMode']),
        };

      case 'SET_CAPABILITIES':
        return {
          companyId: body.scope.companyId ?? null,
          ...(typeof params?.['canSell'] === 'boolean'
            ? { canSell: params['canSell'] ? 'true' : 'false' }
            : {}),
          ...(typeof params?.['canPurchase'] === 'boolean'
            ? { canPurchase: params['canPurchase'] ? 'true' : 'false' }
            : {}),
          ...(typeof params?.['canPos'] === 'boolean'
            ? { canPos: params['canPos'] ? 'true' : 'false' }
            : {}),
          ...(typeof params?.['trackInventory'] === 'boolean'
            ? { trackInventory: params['trackInventory'] ? 'true' : 'false' }
            : {}),
        };

      default:
        return {};
    }
  },
};

let registered = false;

export function registerTradeItemsFakeBulkModule(): void {
  if (registered) return;
  registered = true;
  registerFakeBulkModule(TRADE_ITEMS_BULK_APP, TRADE_ITEMS_FAKE_BULK_MODULE);
}

registerTradeItemsFakeBulkModule();
