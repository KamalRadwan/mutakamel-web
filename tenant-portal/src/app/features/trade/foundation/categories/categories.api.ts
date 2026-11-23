import type { CoreQuery } from '../../../../core/api/core-http';
import { assertIdempotencyKey, ifMatch, newIdempotencyKey, scopeFor } from '../../shared/trade-api';
import { tradeHttp } from '../../shared/trade-http';
import type { CategoryStatus, StatusCounts } from '../../shared/trade-foundation.model';
import type {
  CategoryDeleteReceipt,
  CategoryDetail,
  CategoryPage,
  CategoryReceipt,
  CategorySearch,
  CategoryTreePage,
  CreateCategoryBody,
  DeleteCategoryBody,
  MoveCategoryBody,
  RenameCategoryBody,
  ReorderCategoryBody,
  SetCategoryStatusBody,
} from './categories.model';

function noneScope() {
  return scopeFor({}, 'NONE');
}

function buildSearchBody(body: CategorySearch): CategorySearch {
  const payload: CategorySearch = {};
  if (body.search !== undefined) payload.search = body.search;
  if (body.parentId !== undefined) payload.parentId = body.parentId;
  if (body.ancestorId !== undefined) payload.ancestorId = body.ancestorId;
  if (body.moveSourceId !== undefined) payload.moveSourceId = body.moveSourceId;
  if (body.status !== undefined) payload.status = body.status;
  if (body.page !== undefined) payload.page = body.page;
  if (body.limit !== undefined) payload.limit = body.limit;
  return payload;
}

// GET /api/tenant/trade/v1/categories/tree?parentId&page&limit (Gateway scope NONE)
export function getTreeLevel(parentId: string | null, page = 1, limit = 100): Promise<CategoryTreePage> {
  const query: CoreQuery = {
    ...(parentId ? { parentId } : {}),
    page,
    limit,
  };
  return tradeHttp().read<CategoryTreePage>('/categories/tree', query, { scope: noneScope() });
}

// GET /api/tenant/trade/v1/categories/status-counts (Gateway scope NONE)
export function countCategories(): Promise<StatusCounts<'ACTIVE' | 'INACTIVE'>> {
  return tradeHttp().read<StatusCounts<'ACTIVE' | 'INACTIVE'>>('/categories/status-counts', undefined, {
    scope: noneScope(),
  });
}

// GET /api/tenant/trade/v1/categories?status&page&limit (Gateway scope NONE)
export function listCategories(q: { status?: CategoryStatus; page?: number; limit?: number } = {}): Promise<CategoryPage> {
  const query: CoreQuery = {};
  if (q.status !== undefined) query['status'] = q.status;
  if (q.page !== undefined) query['page'] = q.page;
  if (q.limit !== undefined) query['limit'] = q.limit;
  return tradeHttp().read<CategoryPage>('/categories', Object.keys(query).length > 0 ? query : undefined, {
    scope: noneScope(),
  });
}

// POST /api/tenant/trade/v1/categories/search (200 read, x-idempotency-key, Gateway scope NONE)
export async function searchCategories(body: CategorySearch): Promise<CategoryPage> {
  const { data } = await tradeHttp().write<CategoryPage>('POST', '/categories/search', buildSearchBody(body), {
    key: newIdempotencyKey(),
    scope: noneScope(),
  });
  return data;
}

// GET /api/tenant/trade/v1/categories/:id (Gateway scope NONE)
export function getCategory(id: string): Promise<CategoryDetail> {
  return tradeHttp().read<CategoryDetail>(`/categories/${encodeURIComponent(id)}`, undefined, {
    scope: noneScope(),
  });
}

// POST /api/tenant/trade/v1/categories (x-idempotency-key, Gateway scope NONE)
export async function createCategory(body: CreateCategoryBody, key: string): Promise<CategoryReceipt> {
  const payload: CreateCategoryBody = {
    expectedTreeVersion: body.expectedTreeVersion,
    code: body.code,
    displayName: body.displayName,
    localizedNames: { ...body.localizedNames },
    ...(body.parentId !== undefined ? { parentId: body.parentId } : {}),
    ...(body.beforeId !== undefined ? { beforeId: body.beforeId } : {}),
  };
  const { data } = await tradeHttp().write<CategoryReceipt>('POST', '/categories', payload, {
    key: assertIdempotencyKey(key),
    scope: noneScope(),
  });
  return data;
}

// PATCH /api/tenant/trade/v1/categories/:id (If-Match, x-idempotency-key, Gateway scope NONE)
export async function renameCategory(
  id: string,
  body: RenameCategoryBody,
  version: number,
  key: string,
): Promise<CategoryReceipt> {
  const payload: RenameCategoryBody = {
    ...(body.displayName !== undefined ? { displayName: body.displayName } : {}),
    ...(body.localizedNames !== undefined ? { localizedNames: { ...body.localizedNames } } : {}),
  };
  const { data } = await tradeHttp().write<CategoryReceipt>('PATCH', `/categories/${encodeURIComponent(id)}`, payload, {
    key: assertIdempotencyKey(key),
    ifMatch: ifMatch(version),
    scope: noneScope(),
  });
  return data;
}

// POST /api/tenant/trade/v1/categories/:id/move (If-Match, x-idempotency-key, Gateway scope NONE)
export async function moveCategory(
  id: string,
  body: MoveCategoryBody,
  version: number,
  key: string,
): Promise<CategoryReceipt> {
  const payload: MoveCategoryBody = {
    expectedTreeVersion: body.expectedTreeVersion,
    parentId: body.parentId,
    ...(body.beforeId !== undefined ? { beforeId: body.beforeId } : {}),
  };
  const { data } = await tradeHttp().write<CategoryReceipt>(
    'POST',
    `/categories/${encodeURIComponent(id)}/move`,
    payload,
    {
      key: assertIdempotencyKey(key),
      ifMatch: ifMatch(version),
      scope: noneScope(),
    },
  );
  return data;
}

// POST /api/tenant/trade/v1/categories/:id/reorder (If-Match, x-idempotency-key, Gateway scope NONE)
export async function reorderCategory(
  id: string,
  body: ReorderCategoryBody,
  version: number,
  key: string,
): Promise<CategoryReceipt> {
  const payload: ReorderCategoryBody = {
    expectedTreeVersion: body.expectedTreeVersion,
    beforeId: body.beforeId,
  };
  const { data } = await tradeHttp().write<CategoryReceipt>(
    'POST',
    `/categories/${encodeURIComponent(id)}/reorder`,
    payload,
    {
      key: assertIdempotencyKey(key),
      ifMatch: ifMatch(version),
      scope: noneScope(),
    },
  );
  return data;
}

// POST /api/tenant/trade/v1/categories/:id/status (If-Match, x-idempotency-key, Gateway scope NONE)
export async function setCategoryStatus(
  id: string,
  body: SetCategoryStatusBody,
  version: number,
  key: string,
): Promise<CategoryReceipt> {
  const payload: SetCategoryStatusBody = {
    expectedTreeVersion: body.expectedTreeVersion,
    status: body.status,
    reasonCodeId: body.reasonCodeId,
    ...(body.reasonNote !== undefined ? { reasonNote: body.reasonNote } : {}),
  };
  const { data } = await tradeHttp().write<CategoryReceipt>(
    'POST',
    `/categories/${encodeURIComponent(id)}/status`,
    payload,
    {
      key: assertIdempotencyKey(key),
      ifMatch: ifMatch(version),
      scope: noneScope(),
    },
  );
  return data;
}

// POST /api/tenant/trade/v1/categories/:id/delete (If-Match, x-idempotency-key, Gateway scope NONE)
export async function deleteCategory(
  id: string,
  body: DeleteCategoryBody,
  version: number,
  key: string,
): Promise<CategoryDeleteReceipt> {
  const payload: DeleteCategoryBody = {
    expectedTreeVersion: body.expectedTreeVersion,
    reasonCodeId: body.reasonCodeId,
    ...(body.reasonNote !== undefined ? { reasonNote: body.reasonNote } : {}),
  };
  const { data } = await tradeHttp().write<CategoryDeleteReceipt>(
    'POST',
    `/categories/${encodeURIComponent(id)}/delete`,
    payload,
    {
      key: assertIdempotencyKey(key),
      ifMatch: ifMatch(version),
      scope: noneScope(),
    },
  );
  return data;
}
