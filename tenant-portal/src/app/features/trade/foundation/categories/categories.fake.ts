import { ApiError, assertIdempotencyKey, fakeDelay, fakeId, ifMatch } from '../../shared/trade-api';
import type { CategoryNode, CategoryStatus, LocalizedNames, ReasonKind, StatusCounts } from '../../shared/trade-foundation.model';
import {
  TRADE_FAKE_DB,
  assertReasonNoteShape,
  assertUsableReason,
  bumpVersion,
  clone,
  fakeLang,
  nowIso,
} from '../../shared/trade-foundation.fake';
import {
  CATEGORY_CODE_PATTERN,
  CATEGORY_CONTROL_BIDI_PATTERN,
  CATEGORY_LOCALE_KEY_PATTERN,
  CATEGORY_MAX_DEPTH,
  type CategoryDeleteReceipt,
  type CategoryDetail,
  type CategoryPage,
  type CategoryPathStep,
  type CategoryReceipt,
  type CategorySearch,
  type CategorySummary,
  type CategoryTreePage,
  type CreateCategoryBody,
  type DeleteBlocker,
  type DeleteCategoryBody,
  type MoveCategoryBody,
  type RenameCategoryBody,
  type ReorderCategoryBody,
  type SetCategoryStatusBody,
} from './categories.model';

const MAX_PAGE = 10_000;
const MAX_LIMIT = 100;
const MAX_OFFSET = 9_999;
const MAX_SIBLINGS = 1_000;
const MAX_NODES = 10_000;
const RANK_STEP = 1_024;

interface StoredReplay {
  bodyJson: string;
  receipt: CategoryReceipt | CategoryDeleteReceipt;
}

const idempotencyStore = new Map<string, StoredReplay>();

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj)
    .filter((k) => obj[k] !== undefined)
    .sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(',')}}`;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function assertAllowedKeys(body: Record<string, unknown>, allowed: ReadonlySet<string>, required: readonly string[]): void {
  for (const key of Object.keys(body)) {
    if (!allowed.has(key)) {
      throw new ApiError(400, 'TRADE.VALIDATION_FAILED');
    }
  }
  for (const req of required) {
    if (!(req in body) || body[req] === undefined) {
      throw new ApiError(400, 'TRADE.VALIDATION_FAILED');
    }
  }
}

function assertVersionsMatch(opts: {
  nodeVersion?: number;
  versionHeader?: string;
  expectedTreeVersion?: number;
}): void {
  const stale: ('node' | 'tree')[] = [];
  if (
    opts.nodeVersion !== undefined &&
    opts.versionHeader !== undefined &&
    opts.versionHeader !== ifMatch(opts.nodeVersion)
  ) {
    stale.push('node');
  }
  if (
    opts.expectedTreeVersion !== undefined &&
    opts.expectedTreeVersion !== TRADE_FAKE_DB.meta.categoryTreeVersion
  ) {
    stale.push('tree');
  }
  if (stale.length > 0) {
    throw new ApiError(409, 'TRADE.CONCURRENCY.STALE_VERSION', { stale });
  }
}

/**
 * Same as the backend (category-command.service + TradeReasonsService.assertUsable):
 * NOT_FOUND -> INACTIVE -> KIND_INVALID -> NOTE_REQUIRED, every one 422 with details
 * `{ field: ['reasonCodeId'] }` (KIND_INVALID adds `reason: ['kind_mismatch']`). The note length is a
 * DTO rule checked with the body shape (400 TRADE.VALIDATION_FAILED).
 */
function validateReason(
  reasonCodeId: string,
  reasonNote: string | undefined,
  expectedKind: ReasonKind,
): void {
  assertUsableReason({ id: reasonCodeId, kind: expectedKind, note: reasonNote });
}

/** Backend: missing key 400 TRADE.IDEMPOTENCY.KEY_MISSING; a key that is not a UUIDv7 is 422 KEY_REQUIRED. */
function requireIdempotencyKey(key: string): string {
  return assertIdempotencyKey(typeof key === 'string' ? key.trim() : key);
}

function checkReplay<R extends CategoryReceipt | CategoryDeleteReceipt>(
  action: string,
  targetId: string,
  key: string,
  body: unknown,
): R | null {
  const replayKey = `${action}:${targetId}:${key}`;
  const existing = idempotencyStore.get(replayKey);
  if (!existing) return null;
  if (existing.bodyJson !== stableStringify(body)) {
    throw new ApiError(422, 'TRADE.IDEMPOTENCY.MISMATCH');
  }
  return clone(existing.receipt) as R;
}

function saveReplay(action: string, targetId: string, key: string, body: unknown, receipt: CategoryReceipt | CategoryDeleteReceipt): void {
  idempotencyStore.set(`${action}:${targetId}:${key}`, {
    bodyJson: stableStringify(body),
    receipt: clone(receipt),
  });
}

/** DTO bounds are the 400 (CategoryPageQueryDto); the offset window is the service rule, 422 CATEGORY_QUERY_INVALID. */
function validatePagination(page = 1, limit = MAX_LIMIT): { page: number; limit: number } {
  if (!Number.isInteger(page) || page < 1 || page > MAX_PAGE) {
    throw new ApiError(400, 'TRADE.VALIDATION_FAILED', { page: ['invalid'] });
  }
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
    throw new ApiError(400, 'TRADE.VALIDATION_FAILED', { limit: ['invalid'] });
  }
  if ((page - 1) * limit > MAX_OFFSET) {
    throw new ApiError(422, 'TRADE.CATALOG.CATEGORY_QUERY_INVALID');
  }
  return { page, limit };
}

function liveNodes(): CategoryNode[] {
  return TRADE_FAKE_DB.categories.filter((cat) => cat.deletedAt === null);
}

function sortSiblings(nodes: readonly CategoryNode[]): CategoryNode[] {
  return nodes
    .slice()
    .sort((a, b) => (a.sortOrder !== b.sortOrder ? a.sortOrder - b.sortOrder : a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

interface TreeIndex {
  liveById: Map<string, CategoryNode>;
  childrenByParent: Map<string, CategoryNode[]>;
}

function parentMapKey(parentId: string | null): string {
  return parentId ?? '__root__';
}

function buildTreeIndex(): TreeIndex {
  const live = liveNodes();
  const liveById = new Map<string, CategoryNode>();
  const childrenByParent = new Map<string, CategoryNode[]>();

  for (const node of live) {
    liveById.set(node.id, node);
    const key = parentMapKey(node.parentId);
    const bucket = childrenByParent.get(key);
    if (bucket) {
      bucket.push(node);
    } else {
      childrenByParent.set(key, [node]);
    }
  }

  for (const [key, bucket] of childrenByParent.entries()) {
    childrenByParent.set(key, sortSiblings(bucket));
  }

  return { liveById, childrenByParent };
}

function buildChain(id: string, liveById: ReadonlyMap<string, CategoryNode>): CategoryNode[] {
  const chain: CategoryNode[] = [];
  const visited = new Set<string>();
  let currId: string | null = id;

  while (currId) {
    if (visited.has(currId)) break;
    visited.add(currId);
    const node = liveById.get(currId);
    if (!node) break;
    chain.unshift(node);
    currId = node.parentId;
  }

  return chain;
}

function nameFor(node: CategoryNode, locale: string): string {
  return node.localizedNames[locale] ?? node.displayName;
}

function collectDescendants(id: string, childrenByParent: ReadonlyMap<string, CategoryNode[]>): string[] {
  const result: string[] = [];
  const stack = [...(childrenByParent.get(id) ?? [])];
  while (stack.length > 0) {
    const curr = stack.pop()!;
    result.push(curr.id);
    const children = childrenByParent.get(curr.id);
    if (children) {
      for (const child of children) {
        stack.push(child);
      }
    }
  }
  return result;
}

function computeSubtreeHeight(id: string, childrenByParent: ReadonlyMap<string, CategoryNode[]>): number {
  const children = childrenByParent.get(id);
  if (!children || children.length === 0) return 1;
  let maxChildHeight = 0;
  for (const child of children) {
    const h = computeSubtreeHeight(child.id, childrenByParent);
    if (h > maxChildHeight) maxChildHeight = h;
  }
  return 1 + maxChildHeight;
}

function toSummary(node: CategoryNode, index: TreeIndex, locale: string): CategorySummary {
  const chain = buildChain(node.id, index.liveById);
  const effectiveActive = chain.every((entry) => entry.status === 'ACTIVE');

  let inactiveAncestorId: string | null = null;
  for (let i = chain.length - 2; i >= 0; i -= 1) {
    if (chain[i].status === 'INACTIVE') {
      inactiveAncestorId = chain[i].id;
      break;
    }
  }

  const path: CategoryPathStep[] = chain.map((step) => {
    const siblings = index.childrenByParent.get(parentMapKey(step.parentId)) ?? [];
    const pos = siblings.findIndex((s) => s.id === step.id);
    return {
      id: step.id,
      code: step.code,
      name: nameFor(step, locale),
      siblingPosition: pos >= 0 ? pos + 1 : 1,
      siblingTotal: Math.max(1, siblings.length),
    };
  });

  const children = index.childrenByParent.get(node.id) ?? [];

  return {
    id: node.id,
    code: node.code,
    displayName: node.displayName,
    name: nameFor(node, locale),
    parentId: node.parentId,
    sortOrder: node.sortOrder,
    status: node.status,
    version: node.version,
    effectiveActive,
    inactiveAncestorId,
    depth: chain.length,
    childCount: children.length,
    hasChildren: children.length > 0,
    path,
  };
}

function computeDeleteInfo(
  node: CategoryNode,
  index: TreeIndex,
): {
  directItemCount: number;
  subtreeItemCount: number;
  descendantCount: number;
  hasRetainedItemReferences: boolean;
  deleteBlockers: DeleteBlocker[];
  canDelete: boolean;
} {
  const descendants = collectDescendants(node.id, index.childrenByParent);
  const subtreeIds = new Set<string>([node.id, ...descendants]);
  let directItemCount = 0;
  let subtreeItemCount = 0;

  for (const item of TRADE_FAKE_DB.items) {
    if (item.deletedAt !== null || !item.categoryId) continue;
    if (item.categoryId === node.id) {
      directItemCount += 1;
    }
    if (subtreeIds.has(item.categoryId)) {
      subtreeItemCount += 1;
    }
  }

  const children = index.childrenByParent.get(node.id) ?? [];
  const hasRetainedItemReferences = TRADE_FAKE_DB.retainedCategoryRefs.includes(node.id);
  const deleteBlockers: DeleteBlocker[] = [];
  if (node.status === 'ACTIVE') {
    deleteBlockers.push('ACTIVE');
  }
  if (children.length > 0) {
    deleteBlockers.push('HAS_CHILDREN');
  }
  if (directItemCount > 0 || hasRetainedItemReferences) {
    deleteBlockers.push('HAS_ITEM_REFERENCES');
  }

  return {
    directItemCount,
    subtreeItemCount,
    descendantCount: descendants.length,
    hasRetainedItemReferences,
    deleteBlockers,
    canDelete: deleteBlockers.length === 0,
  };
}

function toDetail(node: CategoryNode, index: TreeIndex, locale: string): CategoryDetail {
  const summary = toSummary(node, index, locale);
  const usageInfo = computeDeleteInfo(node, index);
  const asOf = nowIso();

  return {
    ...summary,
    localizedNames: { ...node.localizedNames },
    treeVersion: TRADE_FAKE_DB.meta.categoryTreeVersion,
    subtreeHeight: computeSubtreeHeight(node.id, index.childrenByParent),
    createdAt: node.createdAt,
    updatedAt: node.updatedAt,
    usage: {
      ...usageInfo,
      asOf,
    },
  };
}

function normalizeCode(raw: unknown): string {
  if (typeof raw !== 'string') {
    throw new ApiError(422, 'TRADE.CATALOG.CATEGORY_INVALID');
  }
  const code = raw.trim().toUpperCase();
  if (!CATEGORY_CODE_PATTERN.test(code)) {
    throw new ApiError(422, 'TRADE.CATALOG.CATEGORY_INVALID');
  }
  return code;
}

function normalizeText(raw: unknown, maxLen: number): string {
  if (typeof raw !== 'string') {
    throw new ApiError(422, 'TRADE.CATALOG.CATEGORY_INVALID');
  }
  if (CATEGORY_CONTROL_BIDI_PATTERN.test(raw)) {
    throw new ApiError(422, 'TRADE.CATALOG.CATEGORY_INVALID');
  }
  const normalized = raw.normalize('NFC').trim().replace(/\s+/g, ' ');
  if (normalized.length < 1 || normalized.length > maxLen) {
    throw new ApiError(422, 'TRADE.CATALOG.CATEGORY_INVALID');
  }
  return normalized;
}

function normalizeLocalizedNames(raw: unknown): LocalizedNames {
  if (!isPlainObject(raw)) {
    throw new ApiError(422, 'TRADE.CATALOG.CATEGORY_INVALID');
  }
  const entries = Object.entries(raw);
  if (entries.length < 1 || entries.length > 20) {
    throw new ApiError(422, 'TRADE.CATALOG.CATEGORY_INVALID');
  }
  const result: LocalizedNames = {};
  for (const [localeKey, value] of entries) {
    if (!CATEGORY_LOCALE_KEY_PATTERN.test(localeKey)) {
      throw new ApiError(422, 'TRADE.CATALOG.CATEGORY_INVALID');
    }
    result[localeKey] = normalizeText(value, 160);
  }
  return result;
}

function asciiLower(text: string): string {
  return text.replace(/[A-Z]/g, (ch) => ch.toLowerCase());
}

function assertUniqueSiblingName(
  parentId: string | null,
  displayName: string,
  excludeId: string | null,
  index: TreeIndex,
): void {
  const siblings = index.childrenByParent.get(parentMapKey(parentId)) ?? [];
  const target = asciiLower(displayName);
  for (const sibling of siblings) {
    if (excludeId && sibling.id === excludeId) continue;
    if (asciiLower(sibling.displayName) === target) {
      throw new ApiError(409, 'TRADE.CATALOG.CATEGORY_NAME_TAKEN');
    }
  }
}

function validateBeforeId(
  parentId: string | null,
  beforeId: string | null | undefined,
  movingId: string | null,
  index: TreeIndex,
): CategoryNode[] {
  const siblings = (index.childrenByParent.get(parentMapKey(parentId)) ?? []).filter((s) => s.id !== movingId);
  if (beforeId === undefined || beforeId === null) {
    return siblings;
  }
  if (typeof beforeId !== 'string' || beforeId === movingId) {
    throw new ApiError(422, 'TRADE.CATALOG.CATEGORY_ORDER_INVALID');
  }
  const found = siblings.some((s) => s.id === beforeId);
  if (!found) {
    throw new ApiError(422, 'TRADE.CATALOG.CATEGORY_ORDER_INVALID');
  }
  return siblings;
}

function applySiblingPlacement(
  node: CategoryNode,
  others: readonly CategoryNode[],
  beforeId: string | null | undefined,
): void {
  const insertAt = beforeId ? others.findIndex((s) => s.id === beforeId) : others.length;
  if (insertAt < 0) {
    throw new ApiError(422, 'TRADE.CATALOG.CATEGORY_ORDER_INVALID');
  }

  if (beforeId === undefined || beforeId === null) {
    const last = others[others.length - 1];
    node.sortOrder = last ? last.sortOrder + RANK_STEP : RANK_STEP;
    return;
  }

  const prevOrder = insertAt > 0 ? others[insertAt - 1].sortOrder : 0;
  const nextOrder = others[insertAt].sortOrder;
  if (nextOrder - prevOrder > 1) {
    node.sortOrder = Math.floor((prevOrder + nextOrder) / 2);
    return;
  }

  const ordered = others.slice();
  ordered.splice(insertAt, 0, node);
  ordered.forEach((entry, idx) => {
    const nextRank = (idx + 1) * RANK_STEP;
    if (entry.sortOrder !== nextRank) {
      entry.sortOrder = nextRank;
      if (entry.id !== node.id) {
        bumpVersion(entry);
      }
    }
  });
}

function isAlreadyInOrder(currentSiblings: readonly CategoryNode[], nodeId: string, beforeId: string | null | undefined): boolean {
  const idx = currentSiblings.findIndex((s) => s.id === nodeId);
  if (idx < 0) return false;
  if (beforeId === undefined || beforeId === null) {
    return idx === currentSiblings.length - 1;
  }
  return idx + 1 < currentSiblings.length && currentSiblings[idx + 1].id === beforeId;
}

function sameLocalizedMap(a: LocalizedNames, b: LocalizedNames): boolean {
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  return keysA.every((k) => a[k] === b[k]);
}

function paginateSlice<T>(items: readonly T[], page: number, limit: number): { items: T[]; total: number } {
  const total = items.length;
  const start = (page - 1) * limit;
  return {
    items: items.slice(start, start + limit),
    total,
  };
}

export async function fakeGetTreeLevel(
  parentId: string | null,
  page = 1,
  limit = 100,
  locale = fakeLang(),
): Promise<CategoryTreePage> {
  await fakeDelay();
  const paging = validatePagination(page, limit);
  const index = buildTreeIndex();

  if (parentId !== null && !index.liveById.has(parentId)) {
    throw new ApiError(404, 'TRADE.CATALOG.CATEGORY_NOT_FOUND');
  }

  const children = index.childrenByParent.get(parentMapKey(parentId)) ?? [];
  const paged = paginateSlice(children, paging.page, paging.limit);

  return clone({
    parentId,
    items: paged.items.map((node) => toSummary(node, index, locale)),
    total: paged.total,
    page: paging.page,
    limit: paging.limit,
    treeVersion: TRADE_FAKE_DB.meta.categoryTreeVersion,
    asOf: nowIso(),
  });
}

export async function fakeCountCategories(): Promise<StatusCounts<'ACTIVE' | 'INACTIVE'>> {
  await fakeDelay();
  let active = 0;
  let inactive = 0;
  for (const node of liveNodes()) {
    if (node.status === 'ACTIVE') {
      active += 1;
    } else if (node.status === 'INACTIVE') {
      inactive += 1;
    }
  }
  return clone({
    ACTIVE: active,
    INACTIVE: inactive,
    total: active + inactive,
  });
}

export async function fakeListCategories(
  q: { status?: CategoryStatus; page?: number; limit?: number } = {},
  locale = fakeLang(),
): Promise<CategoryPage> {
  await fakeDelay();
  const paging = validatePagination(q.page ?? 1, q.limit ?? 100);
  if (q.status !== undefined && q.status !== 'ACTIVE' && q.status !== 'INACTIVE') {
    throw new ApiError(400, 'TRADE.VALIDATION_FAILED');
  }

  const index = buildTreeIndex();
  const filtered = Array.from(index.liveById.values())
    .filter((node) => !q.status || node.status === q.status)
    .sort((a, b) => a.code.localeCompare(b.code));
  const paged = paginateSlice(filtered, paging.page, paging.limit);

  return clone({
    items: paged.items.map((node) => toSummary(node, index, locale)),
    total: paged.total,
    page: paging.page,
    limit: paging.limit,
    treeVersion: TRADE_FAKE_DB.meta.categoryTreeVersion,
    asOf: nowIso(),
  });
}

export async function fakeSearchCategories(body: CategorySearch, locale = fakeLang()): Promise<CategoryPage> {
  await fakeDelay();
  const paging = validatePagination(body.page ?? 1, body.limit ?? 100);
  if (body.status !== undefined && body.status !== 'ACTIVE' && body.status !== 'INACTIVE') {
    throw new ApiError(400, 'TRADE.VALIDATION_FAILED');
  }

  const hasSearch = body.search !== undefined;
  const hasParent = body.parentId !== undefined;
  const hasAncestor = body.ancestorId !== undefined;
  const hasMoveSource = body.moveSourceId !== undefined;

  if (!hasSearch && !hasParent && !hasAncestor && !hasMoveSource) {
    throw new ApiError(422, 'TRADE.CATALOG.CATEGORY_QUERY_INVALID');
  }
  if (hasParent && hasAncestor) {
    throw new ApiError(422, 'TRADE.CATALOG.CATEGORY_QUERY_INVALID');
  }
  if (hasMoveSource && (hasParent || hasAncestor)) {
    throw new ApiError(422, 'TRADE.CATALOG.CATEGORY_QUERY_INVALID');
  }

  let needle = '';
  if (hasSearch) {
    if (typeof body.search !== 'string') {
      throw new ApiError(422, 'TRADE.CATALOG.CATEGORY_QUERY_INVALID');
    }
    const trimmed = body.search.trim();
    if (trimmed.length === 0 || trimmed.length > 160) {
      throw new ApiError(422, 'TRADE.CATALOG.CATEGORY_QUERY_INVALID');
    }
    needle = trimmed.toLowerCase();
  }

  const index = buildTreeIndex();

  if (hasParent && body.parentId !== 'ROOT' && !index.liveById.has(body.parentId!)) {
    throw new ApiError(422, 'TRADE.CATALOG.CATEGORY_QUERY_INVALID');
  }
  if (hasAncestor && !index.liveById.has(body.ancestorId!)) {
    throw new ApiError(422, 'TRADE.CATALOG.CATEGORY_QUERY_INVALID');
  }
  if (hasMoveSource && !index.liveById.has(body.moveSourceId!)) {
    throw new ApiError(422, 'TRADE.CATALOG.CATEGORY_QUERY_INVALID');
  }

  let ancestorSet: Set<string> | null = null;
  if (hasAncestor) {
    ancestorSet = new Set([body.ancestorId!, ...collectDescendants(body.ancestorId!, index.childrenByParent)]);
  }

  let excludedForMove: Set<string> | null = null;
  if (hasMoveSource) {
    const source = index.liveById.get(body.moveSourceId!)!;
    excludedForMove = new Set([source.id, ...collectDescendants(source.id, index.childrenByParent)]);
    if (source.parentId !== null) {
      excludedForMove.add(source.parentId);
    }
  }

  const matched = Array.from(index.liveById.values())
    .filter((node) => {
      if (hasParent) {
        const expectedParent = body.parentId === 'ROOT' ? null : body.parentId!;
        if (node.parentId !== expectedParent) return false;
      }
      if (ancestorSet && !ancestorSet.has(node.id)) return false;
      if (excludedForMove && excludedForMove.has(node.id)) return false;
      if (body.status && node.status !== body.status) return false;
      if (needle) {
        const codeMatch = node.code.toLowerCase().includes(needle);
        const displayMatch = node.displayName.toLowerCase().includes(needle);
        const nameMatch = Object.values(node.localizedNames).some((v) => v.toLowerCase().includes(needle));
        if (!codeMatch && !displayMatch && !nameMatch) return false;
      }
      return true;
    })
    .sort((a, b) => a.code.localeCompare(b.code));

  const paged = paginateSlice(matched, paging.page, paging.limit);
  return clone({
    items: paged.items.map((node) => toSummary(node, index, locale)),
    total: paged.total,
    page: paging.page,
    limit: paging.limit,
    treeVersion: TRADE_FAKE_DB.meta.categoryTreeVersion,
    asOf: nowIso(),
  });
}

export async function fakeGetCategory(id: string, locale = fakeLang()): Promise<CategoryDetail> {
  await fakeDelay();
  const index = buildTreeIndex();
  const node = index.liveById.get(id);
  if (!node) {
    throw new ApiError(404, 'TRADE.CATALOG.CATEGORY_NOT_FOUND');
  }
  return clone(toDetail(node, index, locale));
}

export async function fakeCreateCategory(body: CreateCategoryBody, key: string): Promise<CategoryReceipt> {
  await fakeDelay();
  const idemKey = requireIdempotencyKey(key);
  const replayed = checkReplay<CategoryReceipt>('create', '_', idemKey, body);
  if (replayed) return replayed;

  if (!isPlainObject(body)) {
    throw new ApiError(400, 'TRADE.VALIDATION_FAILED');
  }
  assertAllowedKeys(
    body as unknown as Record<string, unknown>,
    new Set(['expectedTreeVersion', 'code', 'displayName', 'localizedNames', 'parentId', 'beforeId']),
    ['expectedTreeVersion', 'code', 'displayName', 'localizedNames'],
  );
  if (typeof body.expectedTreeVersion !== 'number' || !Number.isInteger(body.expectedTreeVersion)) {
    throw new ApiError(400, 'TRADE.VALIDATION_FAILED');
  }

  assertVersionsMatch({ expectedTreeVersion: body.expectedTreeVersion });

  const code = normalizeCode(body.code);
  const displayName = normalizeText(body.displayName, 160);
  const localizedNames = normalizeLocalizedNames(body.localizedNames);

  const index = buildTreeIndex();
  const parentId = body.parentId ?? null;
  let parentDepth = 0;

  if (parentId !== null) {
    const parent = index.liveById.get(parentId);
    if (!parent) {
      throw new ApiError(422, 'TRADE.CATALOG.CATEGORY_PARENT_INVALID');
    }
    const parentSummary = toSummary(parent, index, 'en');
    if (!parentSummary.effectiveActive) {
      throw new ApiError(422, 'TRADE.CATALOG.CATEGORY_PARENT_INACTIVE');
    }
    parentDepth = parentSummary.depth;
  }

  if (parentDepth + 1 > CATEGORY_MAX_DEPTH) {
    throw new ApiError(422, 'TRADE.CATALOG.CATEGORY_DEPTH_EXCEEDED');
  }

  const siblings = index.childrenByParent.get(parentMapKey(parentId)) ?? [];
  if (siblings.length >= MAX_SIBLINGS || index.liveById.size >= MAX_NODES) {
    throw new ApiError(422, 'TRADE.CATALOG.CATEGORY_LIMIT_EXCEEDED');
  }

  if (TRADE_FAKE_DB.categories.some((cat) => cat.code === code)) {
    throw new ApiError(409, 'TRADE.CATALOG.CATEGORY_CODE_TAKEN');
  }
  assertUniqueSiblingName(parentId, displayName, null, index);

  const others = validateBeforeId(parentId, body.beforeId, null, index);
  const now = nowIso();
  const created: CategoryNode = {
    id: fakeId(),
    code,
    displayName,
    localizedNames,
    parentId,
    sortOrder: RANK_STEP,
    status: 'ACTIVE',
    version: 1,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };
  applySiblingPlacement(created, others, body.beforeId);

  TRADE_FAKE_DB.categories.push(created);
  TRADE_FAKE_DB.meta.categoryTreeVersion += 1;

  const receipt: CategoryReceipt = {
    id: created.id,
    version: created.version,
    treeVersion: TRADE_FAKE_DB.meta.categoryTreeVersion,
    changed: true,
  };
  saveReplay('create', '_', idemKey, body, receipt);
  return clone(receipt);
}

export async function fakeRenameCategory(
  id: string,
  body: RenameCategoryBody,
  versionHeader: string,
  key: string,
): Promise<CategoryReceipt> {
  await fakeDelay();
  const idemKey = requireIdempotencyKey(key);
  const replayed = checkReplay<CategoryReceipt>('rename', id, idemKey, body);
  if (replayed) return replayed;

  if (!isPlainObject(body)) {
    throw new ApiError(400, 'TRADE.VALIDATION_FAILED');
  }
  assertAllowedKeys(
    body as unknown as Record<string, unknown>,
    new Set(['displayName', 'localizedNames']),
    [],
  );
  if (!versionHeader) {
    throw new ApiError(400, 'TRADE.CONCURRENCY.IF_MATCH_REQUIRED');
  }

  const index = buildTreeIndex();
  const node = index.liveById.get(id);
  if (!node) {
    throw new ApiError(404, 'TRADE.CATALOG.CATEGORY_NOT_FOUND');
  }
  assertVersionsMatch({ nodeVersion: node.version, versionHeader });

  if (body['displayName'] === undefined && body['localizedNames'] === undefined) {
    throw new ApiError(422, 'TRADE.CATALOG.CATEGORY_INVALID');
  }

  const nextDisplayName = body['displayName'] !== undefined ? normalizeText(body['displayName'], 160) : node.displayName;
  const nextLocalized =
    body['localizedNames'] !== undefined ? normalizeLocalizedNames(body['localizedNames']) : node.localizedNames;

  assertUniqueSiblingName(node.parentId, nextDisplayName, node.id, index);

  const changed = nextDisplayName !== node.displayName || !sameLocalizedMap(nextLocalized, node.localizedNames);
  if (!changed) {
    const receipt: CategoryReceipt = {
      id: node.id,
      version: node.version,
      treeVersion: TRADE_FAKE_DB.meta.categoryTreeVersion,
      changed: false,
    };
    saveReplay('rename', id, idemKey, body, receipt);
    return clone(receipt);
  }

  node.displayName = nextDisplayName;
  node.localizedNames = nextLocalized;
  bumpVersion(node);
  TRADE_FAKE_DB.meta.categoryTreeVersion += 1;

  const receipt: CategoryReceipt = {
    id: node.id,
    version: node.version,
    treeVersion: TRADE_FAKE_DB.meta.categoryTreeVersion,
    changed: true,
  };
  saveReplay('rename', id, idemKey, body, receipt);
  return clone(receipt);
}

export async function fakeMoveCategory(
  id: string,
  body: MoveCategoryBody,
  versionHeader: string,
  key: string,
): Promise<CategoryReceipt> {
  await fakeDelay();
  const idemKey = requireIdempotencyKey(key);
  const replayed = checkReplay<CategoryReceipt>('move', id, idemKey, body);
  if (replayed) return replayed;

  if (!isPlainObject(body)) {
    throw new ApiError(400, 'TRADE.VALIDATION_FAILED');
  }
  assertAllowedKeys(
    body as unknown as Record<string, unknown>,
    new Set(['expectedTreeVersion', 'parentId', 'beforeId']),
    ['expectedTreeVersion', 'parentId'],
  );
  if (
    typeof body.expectedTreeVersion !== 'number' ||
    !Number.isInteger(body.expectedTreeVersion) ||
    (body.parentId !== null && typeof body.parentId !== 'string')
  ) {
    throw new ApiError(400, 'TRADE.VALIDATION_FAILED');
  }
  if (!versionHeader) {
    throw new ApiError(400, 'TRADE.CONCURRENCY.IF_MATCH_REQUIRED');
  }

  const index = buildTreeIndex();
  const node = index.liveById.get(id);
  if (!node) {
    throw new ApiError(404, 'TRADE.CATALOG.CATEGORY_NOT_FOUND');
  }
  assertVersionsMatch({
    nodeVersion: node.version,
    versionHeader,
    expectedTreeVersion: body.expectedTreeVersion,
  });

  const targetParentId = body.parentId;
  const descendants = new Set(collectDescendants(node.id, index.childrenByParent));
  if (targetParentId === node.id || (targetParentId !== null && descendants.has(targetParentId))) {
    throw new ApiError(422, 'TRADE.CATALOG.CATEGORY_CYCLE');
  }

  let targetDepth = 0;
  if (targetParentId !== null) {
    const targetParent = index.liveById.get(targetParentId);
    if (!targetParent) {
      throw new ApiError(422, 'TRADE.CATALOG.CATEGORY_PARENT_INVALID');
    }
    const targetSummary = toSummary(targetParent, index, 'en');
    if (targetParentId !== node.parentId && !targetSummary.effectiveActive) {
      throw new ApiError(422, 'TRADE.CATALOG.CATEGORY_PARENT_INACTIVE');
    }
    targetDepth = targetSummary.depth;
  }

  if (targetParentId !== node.parentId) {
    const height = computeSubtreeHeight(node.id, index.childrenByParent);
    if (targetDepth + height > CATEGORY_MAX_DEPTH) {
      throw new ApiError(422, 'TRADE.CATALOG.CATEGORY_DEPTH_EXCEEDED');
    }
    const targetSiblings = index.childrenByParent.get(parentMapKey(targetParentId)) ?? [];
    if (targetSiblings.length >= MAX_SIBLINGS) {
      throw new ApiError(422, 'TRADE.CATALOG.CATEGORY_LIMIT_EXCEEDED');
    }
    assertUniqueSiblingName(targetParentId, node.displayName, node.id, index);
  }

  const others = validateBeforeId(targetParentId, body.beforeId, node.id, index);
  if (targetParentId === node.parentId) {
    const currentSiblings = index.childrenByParent.get(parentMapKey(node.parentId)) ?? [];
    if (isAlreadyInOrder(currentSiblings, node.id, body.beforeId)) {
      const receipt: CategoryReceipt = {
        id: node.id,
        version: node.version,
        treeVersion: TRADE_FAKE_DB.meta.categoryTreeVersion,
        changed: false,
      };
      saveReplay('move', id, idemKey, body, receipt);
      return clone(receipt);
    }
  }

  node.parentId = targetParentId;
  applySiblingPlacement(node, others, body.beforeId);
  bumpVersion(node);
  TRADE_FAKE_DB.meta.categoryTreeVersion += 1;

  const receipt: CategoryReceipt = {
    id: node.id,
    version: node.version,
    treeVersion: TRADE_FAKE_DB.meta.categoryTreeVersion,
    changed: true,
  };
  saveReplay('move', id, idemKey, body, receipt);
  return clone(receipt);
}

export async function fakeReorderCategory(
  id: string,
  body: ReorderCategoryBody,
  versionHeader: string,
  key: string,
): Promise<CategoryReceipt> {
  await fakeDelay();
  const idemKey = requireIdempotencyKey(key);
  const replayed = checkReplay<CategoryReceipt>('reorder', id, idemKey, body);
  if (replayed) return replayed;

  if (!isPlainObject(body)) {
    throw new ApiError(400, 'TRADE.VALIDATION_FAILED');
  }
  assertAllowedKeys(
    body as unknown as Record<string, unknown>,
    new Set(['expectedTreeVersion', 'beforeId']),
    ['expectedTreeVersion', 'beforeId'],
  );
  if (
    typeof body.expectedTreeVersion !== 'number' ||
    !Number.isInteger(body.expectedTreeVersion) ||
    (body.beforeId !== null && typeof body.beforeId !== 'string')
  ) {
    throw new ApiError(400, 'TRADE.VALIDATION_FAILED');
  }
  if (!versionHeader) {
    throw new ApiError(400, 'TRADE.CONCURRENCY.IF_MATCH_REQUIRED');
  }

  const index = buildTreeIndex();
  const node = index.liveById.get(id);
  if (!node) {
    throw new ApiError(404, 'TRADE.CATALOG.CATEGORY_NOT_FOUND');
  }
  assertVersionsMatch({
    nodeVersion: node.version,
    versionHeader,
    expectedTreeVersion: body.expectedTreeVersion,
  });

  const currentSiblings = index.childrenByParent.get(parentMapKey(node.parentId)) ?? [];
  const others = validateBeforeId(node.parentId, body.beforeId, node.id, index);

  if (isAlreadyInOrder(currentSiblings, node.id, body.beforeId)) {
    const receipt: CategoryReceipt = {
      id: node.id,
      version: node.version,
      treeVersion: TRADE_FAKE_DB.meta.categoryTreeVersion,
      changed: false,
    };
    saveReplay('reorder', id, idemKey, body, receipt);
    return clone(receipt);
  }

  applySiblingPlacement(node, others, body.beforeId);
  bumpVersion(node);
  TRADE_FAKE_DB.meta.categoryTreeVersion += 1;

  const receipt: CategoryReceipt = {
    id: node.id,
    version: node.version,
    treeVersion: TRADE_FAKE_DB.meta.categoryTreeVersion,
    changed: true,
  };
  saveReplay('reorder', id, idemKey, body, receipt);
  return clone(receipt);
}

export async function fakeSetCategoryStatus(
  id: string,
  body: SetCategoryStatusBody,
  versionHeader: string,
  key: string,
): Promise<CategoryReceipt> {
  await fakeDelay();
  const idemKey = requireIdempotencyKey(key);
  const replayed = checkReplay<CategoryReceipt>('status', id, idemKey, body);
  if (replayed) return replayed;

  if (!isPlainObject(body)) {
    throw new ApiError(400, 'TRADE.VALIDATION_FAILED');
  }
  assertAllowedKeys(
    body as unknown as Record<string, unknown>,
    new Set(['expectedTreeVersion', 'status', 'reasonCodeId', 'reasonNote']),
    ['expectedTreeVersion', 'status', 'reasonCodeId'],
  );
  if (
    typeof body.expectedTreeVersion !== 'number' ||
    !Number.isInteger(body.expectedTreeVersion) ||
    (body.status !== 'ACTIVE' && body.status !== 'INACTIVE') ||
    typeof body.reasonCodeId !== 'string' ||
    (body.reasonNote !== undefined && typeof body.reasonNote !== 'string')
  ) {
    throw new ApiError(400, 'TRADE.VALIDATION_FAILED');
  }
  assertReasonNoteShape(body.reasonNote);
  if (!versionHeader) {
    throw new ApiError(400, 'TRADE.CONCURRENCY.IF_MATCH_REQUIRED');
  }

  const index = buildTreeIndex();
  const node = index.liveById.get(id);
  if (!node) {
    throw new ApiError(404, 'TRADE.CATALOG.CATEGORY_NOT_FOUND');
  }
  assertVersionsMatch({
    nodeVersion: node.version,
    versionHeader,
    expectedTreeVersion: body.expectedTreeVersion,
  });

  validateReason(body.reasonCodeId, body.reasonNote, 'CATEGORY_STATUS');

  if (body.status === 'ACTIVE' && node.parentId !== null) {
    const parent = index.liveById.get(node.parentId);
    if (!parent || !toSummary(parent, index, 'en').effectiveActive) {
      throw new ApiError(422, 'TRADE.CATALOG.CATEGORY_PARENT_INACTIVE');
    }
  }

  if (node.status === body.status) {
    const receipt: CategoryReceipt = {
      id: node.id,
      version: node.version,
      treeVersion: TRADE_FAKE_DB.meta.categoryTreeVersion,
      changed: false,
    };
    saveReplay('status', id, idemKey, body, receipt);
    return clone(receipt);
  }

  node.status = body.status;
  bumpVersion(node);
  TRADE_FAKE_DB.meta.categoryTreeVersion += 1;

  const receipt: CategoryReceipt = {
    id: node.id,
    version: node.version,
    treeVersion: TRADE_FAKE_DB.meta.categoryTreeVersion,
    changed: true,
  };
  saveReplay('status', id, idemKey, body, receipt);
  return clone(receipt);
}

export async function fakeDeleteCategory(
  id: string,
  body: DeleteCategoryBody,
  versionHeader: string,
  key: string,
): Promise<CategoryDeleteReceipt> {
  await fakeDelay();
  const idemKey = requireIdempotencyKey(key);
  const replayed = checkReplay<CategoryDeleteReceipt>('delete', id, idemKey, body);
  if (replayed) return replayed;

  if (!isPlainObject(body)) {
    throw new ApiError(400, 'TRADE.VALIDATION_FAILED');
  }
  assertAllowedKeys(
    body as unknown as Record<string, unknown>,
    new Set(['expectedTreeVersion', 'reasonCodeId', 'reasonNote']),
    ['expectedTreeVersion', 'reasonCodeId'],
  );
  if (
    typeof body.expectedTreeVersion !== 'number' ||
    !Number.isInteger(body.expectedTreeVersion) ||
    typeof body.reasonCodeId !== 'string' ||
    (body.reasonNote !== undefined && typeof body.reasonNote !== 'string')
  ) {
    throw new ApiError(400, 'TRADE.VALIDATION_FAILED');
  }
  assertReasonNoteShape(body.reasonNote);
  if (!versionHeader) {
    throw new ApiError(400, 'TRADE.CONCURRENCY.IF_MATCH_REQUIRED');
  }

  const index = buildTreeIndex();
  const node = index.liveById.get(id);
  if (!node) {
    throw new ApiError(404, 'TRADE.CATALOG.CATEGORY_NOT_FOUND');
  }
  assertVersionsMatch({
    nodeVersion: node.version,
    versionHeader,
    expectedTreeVersion: body.expectedTreeVersion,
  });

  validateReason(body.reasonCodeId, body.reasonNote, 'CATEGORY_DELETE');

  const info = computeDeleteInfo(node, index);
  if (!info.canDelete) {
    throw new ApiError(409, 'TRADE.CATALOG.CATEGORY_DELETE_BLOCKED');
  }

  const deletedAt = nowIso();
  node.deletedAt = deletedAt;
  bumpVersion(node);
  TRADE_FAKE_DB.meta.categoryTreeVersion += 1;

  const receipt: CategoryDeleteReceipt = {
    id: node.id,
    deleted: true,
    version: node.version,
    treeVersion: TRADE_FAKE_DB.meta.categoryTreeVersion,
    deletedAt,
  };
  saveReplay('delete', id, idemKey, body, receipt);
  return clone(receipt);
}
