import { coreValidationDetails } from '../core-response.model';
import { ApiError } from '../../../../core/api/api-errors';
import { fakeDelay, fakeId } from '../../../../core/fake/fake-utils';
import {
  CompanyOption,
  CreateNumberingBody,
  NUMBERING_CODE_MAX,
  NUMBERING_CODE_PATTERN,
  NUMBERING_COUNTER_MAX,
  NUMBERING_PADDING_MAX,
  NUMBERING_PADDING_MIN,
  NUMBERING_PREFIX_MAX,
  NUMBERING_PREFIX_PATTERN,
  NumberingAccess,
  NumberingListQuery,
  NumberingPage,
  NumberingPeek,
  NumberingSequence,
  UpdateNumberingBody,
  compareCounters,
  formatNumber,
} from './numbering.model';

const COMPANY_DELTA_ID = '0193a100-0000-7000-8000-000000000001';
const COMPANY_NILE_ID = '0193a100-0000-7000-8000-000000000002';
const COMPANY_OLD_ID = '0193a100-0000-7000-8000-000000000003';

const SEED_COMPANIES: readonly CompanyOption[] = [
  { id: COMPANY_DELTA_ID, nameEn: 'Delta Trading', nameAr: 'دلتا للتجارة', active: true },
  { id: COMPANY_NILE_ID, nameEn: 'Nile Logistics', nameAr: 'النيل للخدمات اللوجستية', active: true },
  { id: COMPANY_OLD_ID, nameEn: 'Old Branch Co', nameAr: 'شركة الفرع القديم', active: false },
];

const SEED_SEQUENCES: readonly NumberingSequence[] = [
  {
    id: '0193a200-0000-7000-8000-000000000001',
    code: 'TRADE_QUOTATION',
    prefix: 'QT-',
    padding: 7,
    nextValue: '48',
    companyId: COMPANY_DELTA_ID,
    createdAt: '2026-09-10T08:15:00.000Z',
    updatedAt: '2026-11-12T10:20:00.000Z',
  },
  {
    id: '0193a200-0000-7000-8000-000000000002',
    code: 'TRADE_PURCHASE_QUOTATION',
    prefix: 'PQ-',
    padding: 7,
    nextValue: '15',
    companyId: COMPANY_DELTA_ID,
    createdAt: '2026-09-10T08:16:00.000Z',
    updatedAt: '2026-11-05T14:30:00.000Z',
  },
  {
    id: '0193a200-0000-7000-8000-000000000003',
    code: 'TRADE_SALES_ORDER',
    prefix: 'SO-',
    padding: 7,
    nextValue: '1203',
    companyId: COMPANY_DELTA_ID,
    createdAt: '2026-09-10T08:17:00.000Z',
    updatedAt: '2026-11-18T09:45:00.000Z',
  },
  {
    id: '0193a200-0000-7000-8000-000000000004',
    code: 'TRADE_PURCHASE_ORDER',
    prefix: 'PO-',
    padding: 7,
    nextValue: '312',
    companyId: COMPANY_DELTA_ID,
    createdAt: '2026-09-10T08:18:00.000Z',
    updatedAt: '2026-11-14T16:10:00.000Z',
  },
  {
    id: '0193a200-0000-7000-8000-000000000005',
    code: 'TRADE_INVOICE',
    prefix: 'INV-',
    padding: 7,
    nextValue: '2409',
    companyId: COMPANY_DELTA_ID,
    createdAt: '2026-09-10T08:19:00.000Z',
    updatedAt: '2026-11-20T11:05:00.000Z',
  },
  {
    id: '0193a200-0000-7000-8000-000000000006',
    code: 'TRADE_CONTRACT',
    prefix: 'CON-',
    padding: 7,
    nextValue: '1',
    companyId: COMPANY_DELTA_ID,
    createdAt: '2026-09-10T08:20:00.000Z',
    updatedAt: '2026-09-10T08:20:00.000Z',
  },
  {
    id: '0193a200-0000-7000-8000-000000000007',
    code: 'TRADE_QUOTATION',
    prefix: 'QT-',
    padding: 7,
    nextValue: '19',
    companyId: COMPANY_NILE_ID,
    createdAt: '2026-10-01T09:00:00.000Z',
    updatedAt: '2026-11-10T12:00:00.000Z',
  },
  {
    id: '0193a200-0000-7000-8000-000000000008',
    code: 'TRADE_PURCHASE_QUOTATION',
    prefix: 'PQ-',
    padding: 7,
    nextValue: '1',
    companyId: COMPANY_NILE_ID,
    createdAt: '2026-10-01T09:01:00.000Z',
    updatedAt: '2026-10-01T09:01:00.000Z',
  },
  {
    id: '0193a200-0000-7000-8000-000000000009',
    code: 'TRADE_SALES_ORDER',
    prefix: 'SO-',
    padding: 7,
    nextValue: '84',
    companyId: COMPANY_NILE_ID,
    createdAt: '2026-10-01T09:02:00.000Z',
    updatedAt: '2026-11-15T15:30:00.000Z',
  },
  {
    id: '0193a200-0000-7000-8000-000000000010',
    code: 'TRADE_PURCHASE_ORDER',
    prefix: 'PO-',
    padding: 7,
    nextValue: '67',
    companyId: COMPANY_NILE_ID,
    createdAt: '2026-10-01T09:03:00.000Z',
    updatedAt: '2026-11-08T13:22:00.000Z',
  },
  {
    id: '0193a200-0000-7000-8000-000000000011',
    code: 'TRADE_INVOICE',
    prefix: 'INV-',
    padding: 7,
    nextValue: '512',
    companyId: COMPANY_NILE_ID,
    createdAt: '2026-10-01T09:04:00.000Z',
    updatedAt: '2026-11-19T17:40:00.000Z',
  },
  {
    id: '0193a200-0000-7000-8000-000000000012',
    code: 'TRADE_CONTRACT',
    prefix: 'CON-',
    padding: 7,
    nextValue: '9',
    companyId: COMPANY_NILE_ID,
    createdAt: '2026-10-01T09:05:00.000Z',
    updatedAt: '2026-10-22T10:15:00.000Z',
  },
  {
    id: '0193a200-0000-7000-8000-000000000013',
    code: 'BUSINESS_LETTER',
    prefix: 'LTR/',
    padding: 5,
    nextValue: '12',
    companyId: null,
    createdAt: '2026-08-15T07:30:00.000Z',
    updatedAt: '2026-11-03T08:50:00.000Z',
  },
  {
    id: '0193a200-0000-7000-8000-000000000014',
    code: 'SUPPORT_TICKET',
    prefix: null,
    padding: 6,
    nextValue: '9007199254740990',
    companyId: null,
    createdAt: '2026-08-15T07:31:00.000Z',
    updatedAt: '2026-11-21T08:00:00.000Z',
  },
];

export const FAKE_NUMBERING_ACCESS: NumberingAccess = {
  tenantWideManage: true,
  manageCompanyIds: [COMPANY_DELTA_ID, COMPANY_NILE_ID],
};

export const FAKE_NUMBERING_FAIL_NEXT: { code: string | null; status: number } = {
  code: null,
  status: 500,
};

interface IdempotencyRecord {
  fingerprint: string;
  result: unknown;
}

const COUNTER_MAX_BIGINT = BigInt(NUMBERING_COUNTER_MAX);

let companies: CompanyOption[] = structuredClone(SEED_COMPANIES) as CompanyOption[];
let sequences: NumberingSequence[] = structuredClone(SEED_SEQUENCES) as NumberingSequence[];
const idempotency = new Map<string, IdempotencyRecord>();

function clone<T>(value: T): T {
  return structuredClone(value);
}

function consumeFailNext(): void {
  if (!FAKE_NUMBERING_FAIL_NEXT.code) return;
  const code = FAKE_NUMBERING_FAIL_NEXT.code;
  const status = FAKE_NUMBERING_FAIL_NEXT.status || 500;
  FAKE_NUMBERING_FAIL_NEXT.code = null;
  throw new ApiError(status, code);
}

const UUID_V7_KEY = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function runIdempotent<T>(op: string, idempotencyKey: string, payload: unknown, run: () => T): T {
  // POST and PATCH /api/v1/tenant/numbering are WRITE_SENSITIVE at the gateway and Core's
  // numbering-sequences controller has no @IdempotencyRequired, so the gateway's codes apply.
  const key = typeof idempotencyKey === 'string' ? idempotencyKey.trim() : '';
  if (!key) {
    throw new ApiError(400, 'GW.IDEM.MISSING');
  }
  if (!UUID_V7_KEY.test(key)) {
    throw new ApiError(400, 'GW.IDEM.BAD_VALUE');
  }
  const cacheKey = `${op}:${key}`;
  const fingerprint = JSON.stringify(payload) ?? '';
  const existing = idempotency.get(cacheKey);
  if (existing) {
    if (existing.fingerprint !== fingerprint) {
      throw new ApiError(422, 'GW.IDEM.MISMATCH');
    }
    return clone(existing.result as T);
  }
  const result = run();
  idempotency.set(cacheKey, { fingerprint, result: clone(result) });
  return clone(result);
}

function assertScopePermission(companyId: string | null): void {
  if (companyId === null) {
    if (!FAKE_NUMBERING_ACCESS.tenantWideManage) {
      throw new ApiError(403, 'TENANT_WIDE_PERMISSION_REQUIRED');
    }
    return;
  }
  if (!FAKE_NUMBERING_ACCESS.manageCompanyIds.includes(companyId)) {
    throw new ApiError(403, 'COMPANY_PERMISSION_DENIED');
  }
}

function assertActiveCompany(companyId: string): void {
  const match = companies.find((company) => company.id === companyId);
  if (!match || !match.active) {
    throw new ApiError(422, 'COMPANY_INVALID');
  }
}

function invalid(field: string): never {
  throw new ApiError(400, 'CORE_VALIDATION_FAILED', coreValidationDetails({ [field]: 'invalid' }));
}

function validatePrefix(prefix: string): string | null {
  if (prefix === '') return null;
  if (Array.from(prefix).length > NUMBERING_PREFIX_MAX || !NUMBERING_PREFIX_PATTERN.test(prefix)) {
    invalid('prefix');
  }
  return prefix;
}

function validatePadding(padding: number): number {
  if (!Number.isInteger(padding) || padding < NUMBERING_PADDING_MIN || padding > NUMBERING_PADDING_MAX) {
    invalid('padding');
  }
  return padding;
}

function validateCounterNumber(value: number, field: 'startValue' | 'nextValue'): string {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1) {
    invalid(field);
  }
  const big = BigInt(value);
  if (big < 1n || big > COUNTER_MAX_BIGINT) {
    invalid(field);
  }
  return String(value);
}

export async function fakeListNumbering(query: NumberingListQuery): Promise<NumberingPage> {
  await fakeDelay();
  const page = Math.max(1, Math.floor(query.page ?? 1));
  const limit = Math.min(100, Math.max(1, Math.floor(query.limit ?? 20)));
  const sortBy = query.sortBy ?? 'code';
  const sortDir = query.sortDir ?? 'ASC';
  const searchTerm = (query.search ?? '').trim().slice(0, 200).toLowerCase();
  const companyFilter = query.companyId?.trim() || undefined;

  let filtered = sequences.slice();
  if (companyFilter !== undefined) {
    filtered = filtered.filter((row) => row.companyId === companyFilter);
  }
  if (searchTerm) {
    filtered = filtered.filter(
      (row) =>
        row.code.toLowerCase().includes(searchTerm) ||
        (row.prefix !== null && row.prefix.toLowerCase().includes(searchTerm)),
    );
  }

  const direction = sortDir === 'DESC' ? -1 : 1;
  filtered.sort((a, b) => {
    let cmp = 0;
    if (sortBy === 'nextValue') {
      cmp = compareCounters(a.nextValue, b.nextValue);
    } else if (sortBy === 'createdAt') {
      cmp = a.createdAt.localeCompare(b.createdAt);
    } else {
      cmp = a.code.localeCompare(b.code);
    }
    if (cmp !== 0) return cmp * direction;
    const codeTie = a.code.localeCompare(b.code);
    if (codeTie !== 0) return codeTie;
    return a.id.localeCompare(b.id);
  });

  const total = filtered.length;
  const totalPages = Math.ceil(total / limit);
  const start = (page - 1) * limit;
  const items = filtered.slice(start, start + limit).map((row) => clone(row));

  // Core's envelope moves the PaginatedResult counters into meta and the rows into data.
  return {
    data: items,
    meta: {
      page,
      limit,
      total,
      totalPages,
      hasNext: totalPages > 0 && page < totalPages,
      hasPrev: page > 1 && totalPages > 0,
    },
  };
}

export async function fakeCreateNumbering(
  body: CreateNumberingBody,
  idempotencyKey: string,
): Promise<NumberingSequence> {
  await fakeDelay();
  consumeFailNext();

  return runIdempotent('createNumbering', idempotencyKey, body, () => {
    const companyId = body.companyId ? body.companyId : null;
    if (companyId !== null) {
      assertActiveCompany(companyId);
    }
    assertScopePermission(companyId);

    const code = (body.code ?? '').trim().toUpperCase();
    if (!code || code.length > NUMBERING_CODE_MAX || !NUMBERING_CODE_PATTERN.test(code)) {
      invalid('code');
    }

    const prefix = body.prefix !== undefined ? validatePrefix(body.prefix) : null;
    const padding = validatePadding(body.padding ?? 5);
    const nextValue = validateCounterNumber(body.startValue ?? 1, 'startValue');

    const duplicate = sequences.some((row) => row.companyId === companyId && row.code === code);
    if (duplicate) {
      throw new ApiError(409, 'SEQUENCE_CODE_TAKEN');
    }

    const now = new Date().toISOString();
    const created: NumberingSequence = {
      id: fakeId(),
      code,
      prefix,
      padding,
      nextValue,
      companyId,
      createdAt: now,
      updatedAt: now,
    };
    sequences.push(created);
    return clone(created);
  });
}

export async function fakeUpdateNumbering(
  id: string,
  body: UpdateNumberingBody,
  idempotencyKey: string,
): Promise<NumberingSequence> {
  await fakeDelay();
  consumeFailNext();

  return runIdempotent(`updateNumbering:${id}`, idempotencyKey, body, () => {
    const existing = sequences.find((row) => row.id === id);
    if (!existing) {
      throw new ApiError(404, 'SEQUENCE_NOT_FOUND');
    }
    assertScopePermission(existing.companyId);

    const nextPrefix = body.prefix !== undefined ? validatePrefix(body.prefix) : existing.prefix;
    const nextPadding = body.padding !== undefined ? validatePadding(body.padding) : existing.padding;
    let nextValue = existing.nextValue;
    if (body.nextValue !== undefined) {
      const candidate = validateCounterNumber(body.nextValue, 'nextValue');
      if (compareCounters(candidate, existing.nextValue) < 0) {
        throw new ApiError(422, 'SEQUENCE_VALUE_INVALID');
      }
      nextValue = candidate;
    }

    existing.prefix = nextPrefix;
    existing.padding = nextPadding;
    existing.nextValue = nextValue;
    existing.updatedAt = new Date().toISOString();
    return clone(existing);
  });
}

export async function fakePeekNumbering(code: string, companyId: string | null): Promise<NumberingPeek> {
  await fakeDelay();
  const scopeCompanyId = companyId ?? null;
  if (scopeCompanyId !== null) {
    assertActiveCompany(scopeCompanyId);
  }
  const normalizedCode = code.trim().toUpperCase();
  const match = sequences.find((row) => row.code === normalizedCode && row.companyId === scopeCompanyId);
  if (!match) {
    throw new ApiError(404, 'SEQUENCE_NOT_FOUND');
  }
  return {
    code: match.code,
    companyId: match.companyId,
    nextValue: match.nextValue,
    formatted: formatNumber(match.prefix, match.padding, match.nextValue),
  };
}

export async function fakeListCompanyOptions(): Promise<CompanyOption[]> {
  await fakeDelay();
  return clone(companies);
}

export async function fakeGetNumberingAccess(): Promise<NumberingAccess> {
  await fakeDelay();
  return clone(FAKE_NUMBERING_ACCESS);
}
