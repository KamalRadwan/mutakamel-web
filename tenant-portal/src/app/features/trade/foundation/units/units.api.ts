import { ifMatch } from '../../shared/trade-api';
import type { StatusCounts, Uom } from '../../shared/trade-foundation.model';
import {
  fakeCountUoms,
  fakeCreateUom,
  fakeGetUom,
  fakeListUomsPage,
  fakeUomReferences,
  fakeUpdateUom,
} from './units.fake';
import {
  compareUomsByCode,
  type CreateUomBody,
  type UomReferences,
  type UpdateUomBody,
} from './units.model';

const LIST_PAGE_LIMIT = 100;

// GET /api/tenant/trade/v1/uoms?page=1&limit=100&search= (merged across pages, sorted by code; no company/branch headers)
// The real endpoint sends `search` (<= 80 characters) and returns code prefix matches first, then name substring matches.
export async function listAllUoms(search?: string): Promise<Uom[]> {
  const all: Uom[] = [];
  let page = 1;

  while (true) {
    const res = await fakeListUomsPage(page, LIST_PAGE_LIMIT, search);
    all.push(...res.items);
    if (page * res.limit >= res.total || res.items.length === 0) {
      break;
    }
    page += 1;
  }

  return search?.trim() ? all : all.sort(compareUomsByCode);
}

// GET /api/tenant/trade/v1/uoms/status-counts (Gateway mode NONE: no company or branch header)
export function countUoms(): Promise<StatusCounts<'ACTIVE' | 'RETIRED'>> {
  return fakeCountUoms();
}

// GET /api/tenant/trade/v1/uoms/:id/references (Gateway mode NONE: no company or branch header)
export function uomReferences(id: string): Promise<UomReferences> {
  return fakeUomReferences(id);
}

// GET /api/tenant/trade/v1/uoms/:id
export function getUom(id: string): Promise<Uom> {
  return fakeGetUom(id);
}

// POST /api/tenant/trade/v1/uoms (header x-idempotency-key; Gateway mode NONE)
export function createUom(body: CreateUomBody, idempotencyKey: string): Promise<Uom> {
  return fakeCreateUom(body, idempotencyKey);
}

// PATCH /api/tenant/trade/v1/uoms/:id (headers x-idempotency-key + If-Match)
export function updateUom(id: string, body: UpdateUomBody, version: number, idempotencyKey: string): Promise<Uom> {
  return fakeUpdateUom(id, body, ifMatch(version), idempotencyKey);
}
