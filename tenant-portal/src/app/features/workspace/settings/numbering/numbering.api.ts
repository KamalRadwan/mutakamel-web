import {
  fakeCreateNumbering,
  fakeGetNumberingAccess,
  fakeListCompanyOptions,
  fakeListNumbering,
  fakePeekNumbering,
  fakeUpdateNumbering,
} from './numbering.fake';
import {
  CompanyOption,
  CreateNumberingBody,
  NumberingAccess,
  NumberingListQuery,
  NumberingPage,
  NumberingPeek,
  NumberingSequence,
  UpdateNumberingBody,
} from './numbering.model';

// GET /api/v1/tenant/numbering [numbering.read, company-scoped] -> envelope { data, meta }
export function listNumbering(query: NumberingListQuery): Promise<NumberingPage> {
  return fakeListNumbering(query);
}

// POST /api/v1/tenant/numbering [numbering.manage, company-scoped] (x-idempotency-key) -> 201 full entity
export function createNumbering(
  body: CreateNumberingBody,
  idempotencyKey: string,
): Promise<NumberingSequence> {
  return fakeCreateNumbering(body, idempotencyKey);
}

// PATCH /api/v1/tenant/numbering/:id [numbering.manage] (x-idempotency-key) -> 200 full entity
export function updateNumbering(
  id: string,
  body: UpdateNumberingBody,
  idempotencyKey: string,
): Promise<NumberingSequence> {
  return fakeUpdateNumbering(id, body, idempotencyKey);
}

// GET /api/v1/tenant/numbering/:code/peek?companyId= [numbering.read] (never consumes a number)
export function peekNumbering(code: string, companyId: string | null): Promise<NumberingPeek> {
  return fakePeekNumbering(code, companyId);
}

// GET /api/v1/tenant/organization/companies [org.company.read]
export function listCompanyOptions(): Promise<CompanyOption[]> {
  return fakeListCompanyOptions();
}

// SESSION (permissions today are a fake; later derived from the user's numbering.manage grants)
export function getNumberingAccess(): Promise<NumberingAccess> {
  return fakeGetNumberingAccess();
}
