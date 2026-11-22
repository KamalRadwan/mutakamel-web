import { coreValidationDetails } from '../core-response.model';
import { ApiError } from '../../../../core/api/api-errors';
import { fakeDelay, fakeId } from '../../../../core/fake/fake-utils';
import {
  CompanyOption,
  CreateTaxBody,
  CorePage,
  TAX_LIMITS,
  Tax,
  TaxListQuery,
  TaxPermissions,
  TaxSortBy,
  UpdateTaxBody,
  toCanonicalRate,
} from './taxes.model';

export const FAKE_TAXES_FAIL_NEXT = {
  code: null as string | null,
  status: 0,
};

const UUID_V7_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const VALID_SORT_FIELDS: readonly TaxSortBy[] = ['code', 'name', 'rate', 'createdAt'];

const DEFAULT_STATUS_BY_CODE: Readonly<Record<string, number>> = {
  CORE_VALIDATION_FAILED: 400,
  'GW.IDEM.MISSING': 400,
  'GW.IDEM.BAD_VALUE': 400,
  TAX_NOT_FOUND: 404,
  TAX_CODE_TAKEN: 409,
  'GW.IDEM.MISMATCH': 422,
  'GW.IDEM.IN_FLIGHT': 409,
  COMPANY_INVALID: 422,
  COMPANY_PERMISSION_DENIED: 403,
  TENANT_WIDE_PERMISSION_REQUIRED: 403,
  PERMISSION_SCOPE_UNAVAILABLE: 403,
  IDEM_UNAVAILABLE: 503,
};

const NAJD_ID = fakeId();
const RIYADH_ID = fakeId();
const EASTERN_ID = fakeId();
const GULF_ID = fakeId();

const permissionsState: TaxPermissions = {
  tenantWideAllowed: true,
};

const companiesState: CompanyOption[] = [
  { id: NAJD_ID, name: 'Najd Trading Co.', status: 'ACTIVE', canManage: true },
  { id: RIYADH_ID, name: 'Riyadh Logistics', status: 'ACTIVE', canManage: true },
  { id: EASTERN_ID, name: 'Eastern Branch Co.', status: 'INACTIVE', canManage: true },
  { id: GULF_ID, name: 'Gulf Retail', status: 'ACTIVE', canManage: false },
];

let taxesState: Tax[] = [
  {
    id: fakeId(),
    code: 'VAT15',
    name: 'Value Added Tax',
    rate: '15.0000',
    isInclusive: false,
    companyId: null,
    status: 'ACTIVE',
    createdAt: '2026-01-01T09:00:00.000Z',
    updatedAt: '2026-01-01T09:00:00.000Z',
  },
  {
    id: fakeId(),
    code: 'VAT0',
    name: 'Zero-rated supplies',
    rate: '0.0000',
    isInclusive: false,
    companyId: null,
    status: 'ACTIVE',
    createdAt: '2026-01-02T09:00:00.000Z',
    updatedAt: '2026-01-02T09:00:00.000Z',
  },
  {
    id: fakeId(),
    code: 'LEGACY5',
    name: 'Legacy VAT',
    rate: '5.0000',
    isInclusive: false,
    companyId: null,
    status: 'INACTIVE',
    createdAt: '2026-01-03T09:00:00.000Z',
    updatedAt: '2026-01-03T09:00:00.000Z',
  },
  {
    id: fakeId(),
    code: 'EXC50',
    name: 'Excise tax on tobacco',
    rate: '50.0000',
    isInclusive: false,
    companyId: NAJD_ID,
    status: 'ACTIVE',
    createdAt: '2026-01-04T09:00:00.000Z',
    updatedAt: '2026-01-04T09:00:00.000Z',
  },
  {
    id: fakeId(),
    code: 'SRV5',
    name: 'Service fee',
    rate: '5.0000',
    isInclusive: true,
    companyId: RIYADH_ID,
    status: 'ACTIVE',
    createdAt: '2026-01-05T09:00:00.000Z',
    updatedAt: '2026-01-05T09:00:00.000Z',
  },
  {
    id: fakeId(),
    code: 'EAST15',
    name: 'Eastern VAT',
    rate: '15.0000',
    isInclusive: false,
    companyId: EASTERN_ID,
    status: 'INACTIVE',
    createdAt: '2026-01-06T09:00:00.000Z',
    updatedAt: '2026-01-06T09:00:00.000Z',
  },
  {
    id: fakeId(),
    code: 'GULF15',
    name: 'Gulf VAT',
    rate: '15.0000',
    isInclusive: false,
    companyId: GULF_ID,
    status: 'ACTIVE',
    createdAt: '2026-01-07T09:00:00.000Z',
    updatedAt: '2026-01-07T09:00:00.000Z',
  },
];

interface IdempotencyEntry {
  fingerprint: string;
  result: Tax | null;
}

const inFlightKeys = new Set<string>();
const idempotencyStore = new Map<string, IdempotencyEntry>();

function clone<T>(value: T): T {
  return structuredClone(value);
}

function consumeFailNext(): void {
  const code = FAKE_TAXES_FAIL_NEXT.code;
  if (!code) return;
  const status = FAKE_TAXES_FAIL_NEXT.status || DEFAULT_STATUS_BY_CODE[code] || 500;
  FAKE_TAXES_FAIL_NEXT.code = null;
  FAKE_TAXES_FAIL_NEXT.status = 0;
  throw new ApiError(status, code);
}

function isValidRateNumber(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= TAX_LIMITS.rateMin &&
    value <= TAX_LIMITS.rateMax &&
    Number(value.toFixed(TAX_LIMITS.rateDecimals)) === value
  );
}

function assertScopePermission(companyId: string | null): void {
  if (companyId === null) {
    if (!permissionsState.tenantWideAllowed) {
      throw new ApiError(403, 'TENANT_WIDE_PERMISSION_REQUIRED');
    }
    return;
  }
  const company = companiesState.find((item) => item.id === companyId);
  if (!company?.canManage) {
    throw new ApiError(403, 'COMPANY_PERMISSION_DENIED');
  }
}

async function runIdempotentWrite<T extends Tax | null>(
  op: string,
  key: string,
  payload: unknown,
  run: () => T,
): Promise<T> {
  const trimmedKey = typeof key === 'string' ? key.trim() : '';
  if (trimmedKey && inFlightKeys.has(trimmedKey)) {
    throw new ApiError(409, 'GW.IDEM.IN_FLIGHT');
  }

  if (trimmedKey) inFlightKeys.add(trimmedKey);
  try {
    await fakeDelay();
    consumeFailNext();

    if (!trimmedKey) {
      throw new ApiError(400, 'GW.IDEM.MISSING');
    }
    if (!UUID_V7_PATTERN.test(trimmedKey)) {
      throw new ApiError(400, 'GW.IDEM.BAD_VALUE');
    }

    const fingerprint = JSON.stringify({ op, payload });
    const existing = idempotencyStore.get(trimmedKey);
    if (existing) {
      if (existing.fingerprint !== fingerprint) {
        throw new ApiError(422, 'GW.IDEM.MISMATCH');
      }
      return (existing.result === null ? null : clone(existing.result)) as T;
    }

    const result = run();
    idempotencyStore.set(trimmedKey, {
      fingerprint,
      result: result === null ? null : clone(result),
    });
    return (result === null ? null : clone(result)) as T;
  } finally {
    if (trimmedKey) inFlightKeys.delete(trimmedKey);
  }
}

export async function fakeListCompanyOptions(): Promise<CompanyOption[]> {
  await fakeDelay();
  return clone(companiesState);
}

export async function fakeGetTaxPermissions(): Promise<TaxPermissions> {
  await fakeDelay();
  return { tenantWideAllowed: permissionsState.tenantWideAllowed };
}

export async function fakeListTaxes(query: TaxListQuery = {}): Promise<CorePage<Tax>> {
  await fakeDelay();

  if (query.companyId !== undefined && !companiesState.some((item) => item.id === query.companyId)) {
    throw new ApiError(422, 'COMPANY_INVALID');
  }

  const search = query.search ? query.search.trim().slice(0, 200).toLowerCase() : '';
  const sortBy: TaxSortBy =
    query.sortBy && VALID_SORT_FIELDS.includes(query.sortBy) ? query.sortBy : 'code';
  const sortDir = query.sortDir === 'DESC' ? 'DESC' : 'ASC';
  const direction = sortDir === 'DESC' ? -1 : 1;

  const filtered = taxesState.filter((tax) => {
    if (query.status !== undefined && tax.status !== query.status) return false;
    if (query.isInclusive !== undefined && tax.isInclusive !== query.isInclusive) return false;
    if (query.companyId !== undefined && tax.companyId !== query.companyId) return false;
    if (search) {
      const codeMatch = tax.code.toLowerCase().includes(search);
      const nameMatch = tax.name.toLowerCase().includes(search);
      if (!codeMatch && !nameMatch) return false;
    }
    return true;
  });

  filtered.sort((a, b) => {
    let cmp = 0;
    switch (sortBy) {
      case 'code':
        cmp = a.code.localeCompare(b.code, 'en', { sensitivity: 'base' });
        break;
      case 'name':
        cmp = a.name.localeCompare(b.name, 'en', { sensitivity: 'base' });
        break;
      case 'rate':
        cmp = Number(a.rate) - Number(b.rate);
        break;
      case 'createdAt':
        cmp = a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0;
        break;
    }
    if (cmp !== 0) return cmp * direction;
    const codeTie = a.code.localeCompare(b.code, 'en', { sensitivity: 'base' });
    if (codeTie !== 0) return codeTie;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });

  const rawLimit = typeof query.limit === 'number' && Number.isInteger(query.limit) ? query.limit : 20;
  const limit = Math.min(100, Math.max(1, rawLimit));
  const rawPage = typeof query.page === 'number' && Number.isInteger(query.page) ? query.page : 1;
  const page = Math.max(1, rawPage);

  const total = filtered.length;
  const totalPages = total === 0 ? 0 : Math.ceil(total / limit);
  const start = (page - 1) * limit;
  const items = filtered.slice(start, start + limit).map((item) => clone(item));

  // Core's envelope moves the PaginatedResult counters into meta and the rows into data.
  return {
    data: items,
    meta: {
      page,
      limit,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1 && total > 0,
    },
  };
}

export async function fakeCreateTax(body: CreateTaxBody, key: string): Promise<Tax> {
  return runIdempotentWrite('createTax', key, body, () => {
    const details: Record<string, string> = {};

    const code = typeof body.code === 'string' ? body.code.trim().toUpperCase() : '';
    if (!code || code.length > TAX_LIMITS.code) {
      details['code'] = 'invalid';
    }

    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!name || name.length > TAX_LIMITS.name) {
      details['name'] = 'invalid';
    }

    if (!isValidRateNumber(body.rate)) {
      details['rate'] = 'invalid';
    }

    if (body.isInclusive !== undefined && typeof body.isInclusive !== 'boolean') {
      details['isInclusive'] = 'invalid';
    }

    if ((body as { companyId?: unknown }).companyId === null) {
      details['companyId'] = 'invalid';
    }

    if (Object.keys(details).length > 0) {
      throw new ApiError(400, 'CORE_VALIDATION_FAILED', coreValidationDetails(details));
    }

    let targetCompanyId: string | null = null;
    if (body.companyId === undefined) {
      assertScopePermission(null);
    } else {
      const company = companiesState.find((item) => item.id === body.companyId);
      if (!company || company.status !== 'ACTIVE') {
        throw new ApiError(422, 'COMPANY_INVALID');
      }
      if (!company.canManage) {
        throw new ApiError(403, 'COMPANY_PERMISSION_DENIED');
      }
      targetCompanyId = company.id;
    }

    const duplicate = taxesState.some(
      (item) => item.companyId === targetCompanyId && item.code === code,
    );
    if (duplicate) {
      throw new ApiError(409, 'TAX_CODE_TAKEN');
    }

    const now = new Date().toISOString();
    const created: Tax = {
      id: fakeId(),
      code,
      name,
      rate: toCanonicalRate(body.rate),
      isInclusive: Boolean(body.isInclusive),
      companyId: targetCompanyId,
      status: 'ACTIVE',
      createdAt: now,
      updatedAt: now,
    };

    taxesState = [...taxesState, created];
    return created;
  });
}

export async function fakeUpdateTax(id: string, body: UpdateTaxBody, key: string): Promise<Tax> {
  return runIdempotentWrite(`updateTax:${id}`, key, body, () => {
    const raw = body as Record<string, unknown>;
    if ('code' in raw || 'companyId' in raw) {
      const forbidden: Record<string, string> = {};
      if ('code' in raw) forbidden['code'] = 'forbidden';
      if ('companyId' in raw) forbidden['companyId'] = 'forbidden';
      throw new ApiError(400, 'CORE_VALIDATION_FAILED', coreValidationDetails(forbidden));
    }

    const index = taxesState.findIndex((item) => item.id === id);
    if (index < 0) {
      throw new ApiError(404, 'TAX_NOT_FOUND');
    }

    const current = taxesState[index];
    assertScopePermission(current.companyId);

    const details: Record<string, string> = {};
    const next: Tax = { ...current };

    if (body.name !== undefined) {
      const name = typeof body.name === 'string' ? body.name.trim() : '';
      if (!name || name.length > TAX_LIMITS.name) {
        details['name'] = 'invalid';
      } else {
        next.name = name;
      }
    }

    if (body.rate !== undefined) {
      if (!isValidRateNumber(body.rate)) {
        details['rate'] = 'invalid';
      } else {
        next.rate = toCanonicalRate(body.rate);
      }
    }

    if (body.isInclusive !== undefined) {
      if (typeof body.isInclusive !== 'boolean') {
        details['isInclusive'] = 'invalid';
      } else {
        next.isInclusive = body.isInclusive;
      }
    }

    if (body.status !== undefined) {
      if (body.status !== 'ACTIVE' && body.status !== 'INACTIVE') {
        details['status'] = 'invalid';
      } else {
        next.status = body.status;
      }
    }

    if (Object.keys(details).length > 0) {
      throw new ApiError(400, 'CORE_VALIDATION_FAILED', coreValidationDetails(details));
    }

    if (body.status === 'ACTIVE' && current.companyId !== null) {
      const company = companiesState.find((item) => item.id === current.companyId);
      if (!company || company.status !== 'ACTIVE') {
        throw new ApiError(422, 'COMPANY_INVALID');
      }
    }

    const changed =
      next.name !== current.name ||
      next.rate !== current.rate ||
      next.isInclusive !== current.isInclusive ||
      next.status !== current.status;

    if (!changed) {
      return current;
    }

    next.updatedAt = new Date().toISOString();
    taxesState = taxesState.map((item, idx) => (idx === index ? next : item));
    return next;
  });
}

export async function fakeDeactivateTax(id: string, key: string): Promise<void> {
  await runIdempotentWrite(`deactivateTax:${id}`, key, { id }, () => {
    const index = taxesState.findIndex((item) => item.id === id);
    if (index < 0) {
      throw new ApiError(404, 'TAX_NOT_FOUND');
    }

    const current = taxesState[index];
    assertScopePermission(current.companyId);

    if (current.status !== 'INACTIVE') {
      const next: Tax = {
        ...current,
        status: 'INACTIVE',
        updatedAt: new Date().toISOString(),
      };
      taxesState = taxesState.map((item, idx) => (idx === index ? next : item));
    }

    return null;
  });
}
