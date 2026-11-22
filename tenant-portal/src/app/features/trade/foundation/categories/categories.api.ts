import { ifMatch } from '../../shared/trade-api';
import type { CategoryStatus, StatusCounts } from '../../shared/trade-foundation.model';
import { fakeLang } from '../../shared/trade-foundation.fake';
import {
  fakeCountCategories,
  fakeCreateCategory,
  fakeDeleteCategory,
  fakeGetCategory,
  fakeGetTreeLevel,
  fakeListCategories,
  fakeMoveCategory,
  fakeRenameCategory,
  fakeReorderCategory,
  fakeSearchCategories,
  fakeSetCategoryStatus,
} from './categories.fake';
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

// GET /api/tenant/trade/v1/categories/tree?parentId&page&limit&locale
export async function getTreeLevel(parentId: string | null, page = 1, limit = 100): Promise<CategoryTreePage> {
  return fakeGetTreeLevel(parentId, page, limit, fakeLang());
}

// GET /api/tenant/trade/v1/categories/status-counts
// Real route belongs to the status-counts family (backend request; tenant-level, no company/branch/channel headers).
export async function countCategories(): Promise<StatusCounts<'ACTIVE' | 'INACTIVE'>> {
  return fakeCountCategories();
}

// GET /api/tenant/trade/v1/categories?status&page&limit (+ locale)
export async function listCategories(q: { status?: CategoryStatus; page?: number; limit?: number } = {}): Promise<CategoryPage> {
  return fakeListCategories(q, fakeLang());
}

// POST /api/tenant/trade/v1/categories/search (+ locale)
export async function searchCategories(body: CategorySearch): Promise<CategoryPage> {
  return fakeSearchCategories(body, fakeLang());
}

// GET /api/tenant/trade/v1/categories/:id (+ locale)
export async function getCategory(id: string): Promise<CategoryDetail> {
  return fakeGetCategory(id, fakeLang());
}

// POST /api/tenant/trade/v1/categories (x-idempotency-key)
export async function createCategory(body: CreateCategoryBody, key: string): Promise<CategoryReceipt> {
  return fakeCreateCategory(body, key);
}

// PATCH /api/tenant/trade/v1/categories/:id (If-Match, x-idempotency-key)
export async function renameCategory(
  id: string,
  body: RenameCategoryBody,
  version: number,
  key: string,
): Promise<CategoryReceipt> {
  return fakeRenameCategory(id, body, ifMatch(version), key);
}

// POST /api/tenant/trade/v1/categories/:id/move (If-Match, x-idempotency-key)
export async function moveCategory(
  id: string,
  body: MoveCategoryBody,
  version: number,
  key: string,
): Promise<CategoryReceipt> {
  return fakeMoveCategory(id, body, ifMatch(version), key);
}

// POST /api/tenant/trade/v1/categories/:id/reorder (If-Match, x-idempotency-key)
export async function reorderCategory(
  id: string,
  body: ReorderCategoryBody,
  version: number,
  key: string,
): Promise<CategoryReceipt> {
  return fakeReorderCategory(id, body, ifMatch(version), key);
}

// POST /api/tenant/trade/v1/categories/:id/status (If-Match, x-idempotency-key)
export async function setCategoryStatus(
  id: string,
  body: SetCategoryStatusBody,
  version: number,
  key: string,
): Promise<CategoryReceipt> {
  return fakeSetCategoryStatus(id, body, ifMatch(version), key);
}

// POST /api/tenant/trade/v1/categories/:id/delete (If-Match, x-idempotency-key)
export async function deleteCategory(
  id: string,
  body: DeleteCategoryBody,
  version: number,
  key: string,
): Promise<CategoryDeleteReceipt> {
  return fakeDeleteCategory(id, body, ifMatch(version), key);
}
