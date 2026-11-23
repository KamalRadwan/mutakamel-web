import type { CoreQuery } from '../../../../core/api/core-http';
import {
  assertIdempotencyKey,
  ifMatch,
  newIdempotencyKey,
  scopeFor,
  type TradeContext,
} from '../../shared/trade-api';
import { tradeHttp } from '../../shared/trade-http';
import type { StatusCounts, Uom } from '../../shared/trade-foundation.model';
import {
  compareUomsByCode,
  type CreateUomBody,
  type UomListPage,
  type UomReferences,
  type UpdateUomBody,
} from './units.model';

const LIST_PAGE_LIMIT = 100;

// GET /api/tenant/trade/v1/uoms?page=1&limit=100&search= (OPTIONAL_COMPANY_BRANCH; merged across pages)
export async function listAllUoms(search?: string, ctx: TradeContext = {}): Promise<Uom[]> {
  const trimmed = search?.trim();
  const scope = scopeFor(ctx, 'OPTIONAL');
  const all: Uom[] = [];
  let page = 1;

  while (true) {
    const query: CoreQuery = trimmed
      ? { page, limit: LIST_PAGE_LIMIT, search: trimmed }
      : { page, limit: LIST_PAGE_LIMIT };
    const res = await tradeHttp().read<UomListPage>('/uoms', query, { scope });
    all.push(...res.items);
    if (res.items.length === 0 || all.length >= res.total || page * res.limit >= res.total) {
      break;
    }
    page += 1;
  }

  return trimmed ? all : all.sort(compareUomsByCode);
}

// GET /api/tenant/trade/v1/uoms/status-counts?search= (OPTIONAL_COMPANY_BRANCH)
export function countUoms(
  ctx: TradeContext = {},
  search?: string,
): Promise<StatusCounts<'ACTIVE' | 'RETIRED'>> {
  const trimmed = search?.trim();
  return tradeHttp().read<StatusCounts<'ACTIVE' | 'RETIRED'>>(
    '/uoms/status-counts',
    trimmed ? { search: trimmed } : undefined,
    { scope: scopeFor(ctx, 'OPTIONAL') },
  );
}

// GET /api/tenant/trade/v1/uoms/:id/references (OPTIONAL_COMPANY_BRANCH)
export function uomReferences(id: string, ctx: TradeContext = {}): Promise<UomReferences> {
  return tradeHttp().read<UomReferences>(
    `/uoms/${encodeURIComponent(id)}/references`,
    undefined,
    { scope: scopeFor(ctx, 'OPTIONAL') },
  );
}

// GET /api/tenant/trade/v1/uoms/:id (OPTIONAL_COMPANY_BRANCH)
export function getUom(id: string, ctx: TradeContext = {}): Promise<Uom> {
  return tradeHttp().read<Uom>(
    `/uoms/${encodeURIComponent(id)}`,
    undefined,
    { scope: scopeFor(ctx, 'OPTIONAL') },
  );
}

// POST /api/tenant/trade/v1/uoms (x-idempotency-key; Gateway mode NONE)
export async function createUom(
  body: CreateUomBody,
  idempotencyKey: string = newIdempotencyKey(),
): Promise<Uom> {
  const payload: CreateUomBody = {
    code: body.code,
    displayName: body.displayName,
    localizedNames: { ...body.localizedNames },
  };
  const { data } = await tradeHttp().write<Uom>('POST', '/uoms', payload, {
    key: assertIdempotencyKey(idempotencyKey),
    scope: scopeFor({}, 'NONE'),
  });
  return data;
}

// PATCH /api/tenant/trade/v1/uoms/:id (x-idempotency-key + If-Match; Gateway mode NONE)
export async function updateUom(
  id: string,
  body: UpdateUomBody,
  version: number,
  idempotencyKey: string = newIdempotencyKey(),
): Promise<Uom> {
  const payload: UpdateUomBody = {
    ...(body.displayName !== undefined ? { displayName: body.displayName } : {}),
    ...(body.localizedNames !== undefined ? { localizedNames: { ...body.localizedNames } } : {}),
    ...(body.status !== undefined ? { status: body.status } : {}),
  };
  const { data } = await tradeHttp().write<Uom>(
    'PATCH',
    `/uoms/${encodeURIComponent(id)}`,
    payload,
    {
      key: assertIdempotencyKey(idempotencyKey),
      ifMatch: ifMatch(version),
      scope: scopeFor({}, 'NONE'),
    },
  );
  return data;
}
