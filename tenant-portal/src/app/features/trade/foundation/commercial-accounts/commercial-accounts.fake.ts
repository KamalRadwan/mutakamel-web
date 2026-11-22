import { FAKE_COMPANIES } from '../../../../core/scope/scope.fake';
import { ApiError, assertIdempotencyKey, fakeDelay, fakeId } from '../../shared/trade-api';
import { TRADE_FAKE_DB, assertUsableReason, bumpVersion, clone, fakeLang, nowIso } from '../../shared/trade-foundation.fake';
import type { CommercialAccount, CommercialAccountRole, Page, ReasonCode } from '../../shared/trade-foundation.model';
import {
  type AccountCountsQuery,
  type AccountDetail,
  type AccountInput,
  type AccountLookups,
  type AccountParty,
  type AccountSortDirection,
  type AccountSortField,
  type AccountStatusCounts,
  type AccountStatusTransitionInput,
  type AccountWarning,
  type AccountWithParty,
  type BranchRule,
  type BranchRuleList,
  type BranchRuleNarrowing,
  type CreateAccountInput,
  type CreateBranchRuleInput,
  type CreditDecision,
  type CreditPolicy,
  type CreditReason,
  type CreditSummary,
  type DirectoryParty,
  type EvaluateCreditInput,
  type ListAccountsQuery,
  type PriceBookOption,
  type UpdateAccountPatch,
  type UpdateAccountResult,
  type UpdateBranchRuleInput,
  CREDIT_LIMIT_PATTERN,
  CURRENCY_CODE_PATTERN,
  compareDecimals,
  decimalToMicro,
  microToDecimal,
  partyDisplayName,
} from './commercial-accounts.model';

// TODO(pricing): replace with the Pricing part's shared fake (GET /api/tenant/trade/v1/pricing/price-books)
const PRICE_BOOKS: PriceBookOption[] = [
  { id: 'pb-c1-retail', companyId: 'c1', name: 'Retail price list', purpose: 'SALES', currencyCode: 'EGP', status: 'ACTIVE' },
  { id: 'pb-c1-wholesale', companyId: 'c1', name: 'Wholesale price list', purpose: 'SALES', currencyCode: 'EGP', status: 'ACTIVE' },
  { id: 'pb-c1-supplier', companyId: 'c1', name: 'Supplier cost list', purpose: 'PURCHASE', currencyCode: 'EGP', status: 'ACTIVE' },
  { id: 'pb-c2-retail', companyId: 'c2', name: 'Riyadh retail', purpose: 'SALES', currencyCode: 'SAR', status: 'ACTIVE' },
];

const CREDIT_POLICIES: CreditPolicy[] = [
  {
    id: 'pol-tenant-std-v2',
    versionNumber: 2,
    code: 'credit.standard',
    scopeTarget: 'TENANT',
    effectiveFrom: '2026-01-01T00:00:00.000Z',
    effectiveTo: null,
    status: 'PUBLISHED',
    companyId: null,
    branchId: null,
  },
  {
    id: 'pol-c1-strict-v1',
    versionNumber: 1,
    code: 'credit.strict',
    scopeTarget: 'COMPANY',
    effectiveFrom: '2026-01-01T00:00:00.000Z',
    effectiveTo: null,
    status: 'PUBLISHED',
    companyId: 'c1',
    branchId: null,
  },
  {
    id: 'pol-b1-cairo-v1',
    versionNumber: 1,
    code: 'credit.cairo_branch',
    scopeTarget: 'BRANCH',
    effectiveFrom: '2026-01-01T00:00:00.000Z',
    effectiveTo: null,
    status: 'PUBLISHED',
    companyId: 'c1',
    branchId: 'b1',
  },
];

const BRANCH_RULES: BranchRule[] = [
  {
    id: 'br-rule-c1-01',
    commercialAccountId: 'acc-c1-c-01',
    companyId: 'c1',
    branchId: 'b1',
    narrowingRules: { creditLimit: '30000.000' },
    status: 'ACTIVE',
    version: 1,
  },
  {
    id: 'br-rule-c1-01-b2',
    commercialAccountId: 'acc-c1-c-01',
    companyId: 'c1',
    branchId: 'b2',
    narrowingRules: { creditLimit: '25000.000', orderingHold: true },
    status: 'ACTIVE',
    version: 1,
  },
  {
    id: 'br-rule-c1-02',
    commercialAccountId: 'acc-c1-c-02',
    companyId: 'c1',
    branchId: 'b1',
    narrowingRules: { orderingHold: true },
    status: 'ACTIVE',
    version: 1,
  },
];

interface FakeExposure {
  exposureAmount: string;
  ageMs: number;
  orderingHold: boolean;
}

const ONE_MIN_MS = 60_000;
const TWO_HOURS_MS = 2 * 60 * 60_000;
const FRESH_LIMIT_MS = 5 * 60_000;

const EXPOSURES: Record<string, FakeExposure> = {
  'acc-c1-c-01:EGP': { exposureAmount: '10000.000', ageMs: ONE_MIN_MS, orderingHold: false },
  'acc-c1-c-02:EGP': { exposureAmount: '20000.000', ageMs: ONE_MIN_MS, orderingHold: false },
  'acc-c1-c-03:EGP': { exposureAmount: '15000.000', ageMs: ONE_MIN_MS, orderingHold: false },
  'acc-c1-c-04:EGP': { exposureAmount: '180000.000', ageMs: ONE_MIN_MS, orderingHold: false },
  'acc-c1-c-05:EGP': { exposureAmount: '40000.000', ageMs: TWO_HOURS_MS, orderingHold: false },
  'acc-c1-c-06:EGP': { exposureAmount: '50000.000', ageMs: ONE_MIN_MS, orderingHold: true },
  'acc-c1-c-07:EGP': { exposureAmount: '120000.000', ageMs: ONE_MIN_MS, orderingHold: false },
  'acc-c1-c-08:EGP': { exposureAmount: '25000.000', ageMs: ONE_MIN_MS, orderingHold: false },
  'acc-c1-c-17:EGP': { exposureAmount: '5000.000', ageMs: ONE_MIN_MS, orderingHold: false },
  'acc-c1-c-18:EGP': { exposureAmount: '8000.000', ageMs: ONE_MIN_MS, orderingHold: false },
  'acc-c1-c-19:EGP': { exposureAmount: '12000.000', ageMs: ONE_MIN_MS, orderingHold: false },
  'acc-c1-c-20:EGP': { exposureAmount: '15000.000', ageMs: ONE_MIN_MS, orderingHold: false },
  'acc-c2-c-13:SAR': { exposureAmount: '5000.000', ageMs: ONE_MIN_MS, orderingHold: false },
  'acc-c2-c-14:SAR': { exposureAmount: '10000.000', ageMs: ONE_MIN_MS, orderingHold: false },
  'acc-c2-c-16:SAR': { exposureAmount: '15000.000', ageMs: ONE_MIN_MS, orderingHold: false },
  'acc-c2-c-23:SAR': { exposureAmount: '2000.000', ageMs: ONE_MIN_MS, orderingHold: false },
  'acc-c2-c-24:SAR': { exposureAmount: '3000.000', ageMs: ONE_MIN_MS, orderingHold: false },
};

const OPEN_COMMITMENTS: Record<string, string> = {
  'acc-c1-c-01': '5000.000',
  'acc-c1-c-02': '5000.000',
  'acc-c1-c-03': '2500.000',
  'acc-c1-c-04': '15000.000',
  'acc-c1-c-05': '10000.000',
  'acc-c1-c-06': '10000.000',
  'acc-c1-c-08': '5000.000',
};

const SEEDED_ALLOWED_CURRENCY_IDS = new Set(['acc-c1-c-01', 'acc-c1-c-02', 'acc-c1-c-04']);
let seedInitialized = false;

function ensureSeedInitialized(): void {
  if (seedInitialized) return;
  seedInitialized = true;
  for (const account of TRADE_FAKE_DB.accounts) {
    if (SEEDED_ALLOWED_CURRENCY_IDS.has(account.id) && account.terms.allowedCurrencies === undefined) {
      account.terms = { ...account.terms, allowedCurrencies: ['EGP', 'USD'] };
    }
  }
}

interface IdempotencyEntry {
  fingerprint: string;
  response: unknown;
}

const idempotencyStore = new Map<string, IdempotencyEntry>();

function headerValue(headers: Record<string, string>, name: string): string | undefined {
  const target = name.toLowerCase();
  for (const [k, v] of Object.entries(headers)) {
    if (k.toLowerCase() === target) return v;
  }
  return undefined;
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(',')}}`;
}

function requireCompanyContext(headers: Record<string, string>): { companyId: string; branchId: string | undefined } {
  const companyId = headerValue(headers, 'x-mutakamel-company-id')?.trim();
  if (!companyId) {
    throw new ApiError(400, 'TRADE.CONTEXT.MISSING_COMPANY');
  }
  const company = FAKE_COMPANIES.find((c) => c.id === companyId);
  if (!company) {
    throw new ApiError(404, 'TRADE.CONTEXT.SCOPE_NOT_FOUND');
  }

  const branchId = headerValue(headers, 'x-mutakamel-branch-id')?.trim();
  if (branchId && !company.branches.some((b) => b.id === branchId)) {
    throw new ApiError(422, 'TRADE.CONTEXT.BRANCH_COMPANY_MISMATCH');
  }

  return { companyId, branchId };
}

function requireBranchContext(headers: Record<string, string>): { companyId: string; branchId: string } {
  const { companyId, branchId } = requireCompanyContext(headers);
  if (!branchId) {
    throw new ApiError(400, 'TRADE.CONTEXT.MISSING_BRANCH');
  }
  return { companyId, branchId };
}

function requireIfMatchVersion(headers: Record<string, string>): number {
  const raw = headerValue(headers, 'if-match')?.trim();
  if (!raw) {
    throw new ApiError(400, 'TRADE.CONCURRENCY.IF_MATCH_REQUIRED');
  }
  const match = /^"?(\d+)"?$/.exec(raw);
  if (!match) {
    throw new ApiError(400, 'TRADE.CONCURRENCY.IF_MATCH_REQUIRED');
  }
  const version = Number(match[1]);
  if (!Number.isSafeInteger(version) || version < 1) {
    throw new ApiError(400, 'TRADE.CONCURRENCY.IF_MATCH_REQUIRED');
  }
  return version;
}

function runIdempotent<T>(
  headers: Record<string, string>,
  op: string,
  payload: unknown,
  handler: () => T,
): T {
  // Backend DomainIdempotencyService: missing key 400, non-UUIDv7 422; the record is scoped by operation + key.
  const key = `${op}:${assertIdempotencyKey(headerValue(headers, 'x-idempotency-key')?.trim())}`;
  const companyId = headerValue(headers, 'x-mutakamel-company-id')?.trim() ?? '';
  const branchId = headerValue(headers, 'x-mutakamel-branch-id')?.trim() ?? '';
  const fingerprint = stableStringify({ companyId, branchId, payload });
  const existing = idempotencyStore.get(key);
  if (existing) {
    if (existing.fingerprint !== fingerprint) {
      throw new ApiError(422, 'TRADE.IDEMPOTENCY.MISMATCH');
    }
    return clone(existing.response as T);
  }
  const response = handler();
  idempotencyStore.set(key, { fingerprint, response: clone(response) });
  return clone(response);
}

function directoryParties(): DirectoryParty[] {
  return TRADE_FAKE_DB.parties.map((party) => ({
    ...party,
    status: 'ACTIVE' as const,
    branchId: null,
  }));
}

function findDirectoryParty(partyId: string): DirectoryParty | null {
  return directoryParties().find((party) => party.id === partyId) ?? null;
}

function buildAccountParty(partyId: string): AccountParty | null {
  const party = TRADE_FAKE_DB.parties.find((p) => p.id === partyId);
  if (!party) return null;
  // Backend accountQuery / party(): json_build_object(..., 'displayNameAr', NULL, 'code', NULL).
  return {
    id: party.id,
    displayName: party.displayName,
    displayNameAr: null,
    partyType: party.partyType,
    code: null,
  };
}

function attachParty(account: CommercialAccount): AccountWithParty {
  return {
    ...account,
    party: buildAccountParty(account.partyId),
  };
}

/** Backend: `p.display_name ILIKE %search%` (the search is not trimmed; other party fields are not searched). */
function matchesAccountSearch(account: CommercialAccount, needle: string): boolean {
  if (!needle) return true;
  const party = TRADE_FAKE_DB.parties.find((p) => p.id === account.partyId);
  return Boolean(party?.displayName.toLowerCase().includes(needle));
}

function invalid(field: string): ApiError {
  return new ApiError(400, 'TRADE.VALIDATION_FAILED', { [field]: ['invalid'] });
}

/** CommercialAccountCountsQueryDto (also the list base): accountRole enum, search max 80. */
function validateAccountFilter(q: { accountRole?: string; search?: string }): void {
  if (q.accountRole !== undefined && q.accountRole !== 'CUSTOMER' && q.accountRole !== 'SUPPLIER') {
    throw invalid('accountRole');
  }
  if (q.search !== undefined && q.search.length > 80) throw invalid('search');
}

function isAccountVisibleToBranch(partyId: string, branchId: string | undefined): boolean {
  if (!branchId) return true;
  const party = findDirectoryParty(partyId);
  if (!party) return false;
  return party.branchId === null || party.branchId === branchId;
}

function validateAccountTermsAndPricing(
  companyId: string,
  branchId: string | undefined,
  role: CommercialAccountRole,
  input: AccountInput,
): void {
  if (input.priceBookId !== null) {
    const book = PRICE_BOOKS.find((b) => b.id === input.priceBookId);
    if (!book || book.companyId !== companyId || book.status !== 'ACTIVE') {
      throw new ApiError(422, 'TRADE.ACCOUNT.TERM_INVALID');
    }
    const expectedPurpose = role === 'CUSTOMER' ? 'SALES' : 'PURCHASE';
    if (book.purpose !== expectedPurpose) {
      throw new ApiError(422, 'TRADE.ACCOUNT.PRICE_BOOK_INCOMPATIBLE');
    }
  }

  if (input.creditPolicyVersionId !== null) {
    const policy = CREDIT_POLICIES.find((p) => p.id === input.creditPolicyVersionId);
    const scopeOk =
      policy &&
      policy.status === 'PUBLISHED' &&
      (policy.scopeTarget === 'TENANT' ||
        (policy.scopeTarget === 'COMPANY' && policy.companyId === companyId) ||
        (policy.scopeTarget === 'BRANCH' &&
          policy.companyId === companyId &&
          (!branchId || policy.branchId === branchId)));
    if (!scopeOk) {
      throw new ApiError(422, 'TRADE.ACCOUNT.TERM_INVALID');
    }
  }

  if (role === 'SUPPLIER') {
    if (input.creditLimit !== null || input.creditCurrencyCode !== null) {
      throw new ApiError(422, 'TRADE.ACCOUNT.CREDIT_LIMIT_INVALID');
    }
  } else {
    const hasLimit = input.creditLimit !== null;
    const hasCurrency = input.creditCurrencyCode !== null;
    if (hasLimit !== hasCurrency) {
      throw new ApiError(422, 'TRADE.ACCOUNT.CREDIT_LIMIT_INVALID');
    }
    if (input.creditLimit !== null && !CREDIT_LIMIT_PATTERN.test(input.creditLimit)) {
      throw new ApiError(422, 'TRADE.ACCOUNT.CREDIT_LIMIT_INVALID');
    }
    if (input.creditCurrencyCode !== null && !CURRENCY_CODE_PATTERN.test(input.creditCurrencyCode)) {
      throw new ApiError(422, 'TRADE.ACCOUNT.CREDIT_LIMIT_INVALID');
    }
  }

  if (!input.terms || typeof input.terms !== 'object' || Array.isArray(input.terms)) {
    throw new ApiError(422, 'TRADE.ACCOUNT.CREDIT_LIMIT_INVALID');
  }
  if (input.terms.orderingHold !== undefined && typeof input.terms.orderingHold !== 'boolean') {
    throw new ApiError(422, 'TRADE.ACCOUNT.CREDIT_LIMIT_INVALID');
  }
  if (input.terms.allowedCurrencies !== undefined) {
    const list = input.terms.allowedCurrencies;
    if (!Array.isArray(list) || list.length < 1 || list.length > 50) {
      throw new ApiError(422, 'TRADE.ACCOUNT.CREDIT_LIMIT_INVALID');
    }
    const seen = new Set<string>();
    for (const code of list) {
      if (typeof code !== 'string' || !CURRENCY_CODE_PATTERN.test(code) || seen.has(code)) {
        throw new ApiError(422, 'TRADE.ACCOUNT.CREDIT_LIMIT_INVALID');
      }
      seen.add(code);
    }
    if (input.creditCurrencyCode !== null && !seen.has(input.creditCurrencyCode)) {
      throw new ApiError(422, 'TRADE.ACCOUNT.CREDIT_LIMIT_INVALID');
    }
  }
}

function baseAllowedCurrencies(account: CommercialAccount): string[] {
  if (account.terms.allowedCurrencies && account.terms.allowedCurrencies.length > 0) {
    return [...account.terms.allowedCurrencies];
  }
  return account.creditCurrencyCode ? [account.creditCurrencyCode] : [];
}

const ALLOWED_NARROWING_KEYS: ReadonlySet<string> = new Set(['creditLimit', 'orderingHold', 'allowedCurrencies']);

function validateNarrowingRules(
  account: CommercialAccount,
  narrowingRules: BranchRuleNarrowing,
  status: 'ACTIVE' | 'RETIRED',
  existingRule?: BranchRule,
): void {
  if (!narrowingRules || typeof narrowingRules !== 'object' || Array.isArray(narrowingRules)) {
    throw new ApiError(422, 'TRADE.ACCOUNT.BRANCH_RULE_WEAKENS_POLICY');
  }
  for (const key of Object.keys(narrowingRules)) {
    if (!ALLOWED_NARROWING_KEYS.has(key)) {
      throw new ApiError(422, 'TRADE.ACCOUNT.BRANCH_RULE_WEAKENS_POLICY');
    }
  }

  if (narrowingRules.creditLimit !== undefined) {
    if (!CREDIT_LIMIT_PATTERN.test(narrowingRules.creditLimit)) {
      throw new ApiError(422, 'TRADE.ACCOUNT.CREDIT_LIMIT_INVALID');
    }
    if (account.accountRole === 'SUPPLIER') {
      throw new ApiError(422, 'TRADE.ACCOUNT.BRANCH_RULE_WEAKENS_POLICY');
    }
    if (account.creditLimit !== null && compareDecimals(narrowingRules.creditLimit, account.creditLimit) > 0) {
      throw new ApiError(422, 'TRADE.ACCOUNT.BRANCH_RULE_WEAKENS_POLICY');
    }
  }

  if (narrowingRules.orderingHold !== undefined && narrowingRules.orderingHold !== true) {
    throw new ApiError(422, 'TRADE.ACCOUNT.BRANCH_RULE_WEAKENS_POLICY');
  }
  if (
    existingRule &&
    existingRule.narrowingRules.orderingHold === true &&
    status === 'ACTIVE' &&
    narrowingRules.orderingHold !== true
  ) {
    throw new ApiError(422, 'TRADE.ACCOUNT.BRANCH_RULE_WEAKENS_POLICY');
  }

  if (narrowingRules.allowedCurrencies !== undefined) {
    const list = narrowingRules.allowedCurrencies;
    if (!Array.isArray(list) || list.length === 0) {
      throw new ApiError(422, 'TRADE.ACCOUNT.BRANCH_RULE_WEAKENS_POLICY');
    }
    const base = new Set(baseAllowedCurrencies(account));
    const seen = new Set<string>();
    for (const code of list) {
      if (typeof code !== 'string' || !CURRENCY_CODE_PATTERN.test(code) || seen.has(code) || !base.has(code)) {
        throw new ApiError(422, 'TRADE.ACCOUNT.BRANCH_RULE_WEAKENS_POLICY');
      }
      seen.add(code);
    }
  }
}

export async function fakeListAccounts(
  headers: Record<string, string>,
  q: ListAccountsQuery = {},
): Promise<Page<AccountWithParty>> {
  await fakeDelay();
  ensureSeedInitialized();

  const { companyId, branchId } = requireCompanyContext(headers);
  const page = q.page ?? 1;
  const limit = q.limit ?? 25;
  validateAccountFilter(q);
  if (!Number.isInteger(page) || page < 1) throw invalid('page');
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw invalid('limit');
  if (q.status !== undefined && q.status !== 'ACTIVE' && q.status !== 'BLOCKED') throw invalid('status');
  if (q.sort !== undefined && !['createdAt', 'partyName', 'creditLimit'].includes(q.sort)) throw invalid('sort');
  if (q.direction !== undefined && q.direction !== 'ASC' && q.direction !== 'DESC') throw invalid('direction');

  const needle = q.search?.toLowerCase() ?? '';
  const matched = TRADE_FAKE_DB.accounts
    .filter((account) => {
      if (account.companyId !== companyId) return false;
      if (!isAccountVisibleToBranch(account.partyId, branchId)) return false;
      if (q.accountRole && account.accountRole !== q.accountRole) return false;
      if (q.status && account.status !== q.status) return false;
      if (needle && !matchesAccountSearch(account, needle)) return false;
      return true;
    })
    .map(attachParty);

  const sortField: AccountSortField = q.sort ?? 'createdAt';
  const sortDir: AccountSortDirection = q.direction ?? 'DESC';
  const lang = fakeLang();

  matched.sort((a, b) => {
    if (sortField === 'partyName') {
      const aName = partyDisplayName(a.party, lang) || a.partyId;
      const bName = partyDisplayName(b.party, lang) || b.partyId;
      const cmp = aName.localeCompare(bName, lang, { sensitivity: 'base' });
      if (cmp !== 0) return sortDir === 'ASC' ? cmp : -cmp;
      const idCmp = a.id.localeCompare(b.id);
      return sortDir === 'ASC' ? idCmp : -idCmp;
    }

    if (sortField === 'creditLimit') {
      const aLimit = a.creditLimit;
      const bLimit = b.creditLimit;
      if (aLimit !== null && bLimit !== null) {
        const cmp = compareDecimals(aLimit, bLimit);
        if (cmp !== 0) return sortDir === 'ASC' ? cmp : -cmp;
      } else if (aLimit !== null || bLimit !== null) {
        return aLimit !== null ? -1 : 1;
      } else if (a.accountRole !== b.accountRole) {
        return a.accountRole === 'CUSTOMER' ? -1 : 1;
      }
    }

    const createdCmp = a.createdAt.localeCompare(b.createdAt);
    if (createdCmp !== 0) return sortDir === 'ASC' ? createdCmp : -createdCmp;
    const idCmp = a.id.localeCompare(b.id);
    return sortDir === 'ASC' ? idCmp : -idCmp;
  });

  const total = matched.length;
  const start = (page - 1) * limit;
  const items = matched.slice(start, start + limit);
  return clone({ items, total, page, limit });
}

export async function fakeCountAccounts(
  headers: Record<string, string>,
  q: AccountCountsQuery = {},
): Promise<AccountStatusCounts> {
  await fakeDelay();
  ensureSeedInitialized();

  const { companyId, branchId } = requireCompanyContext(headers);
  validateAccountFilter(q);

  const needle = q.search?.toLowerCase() ?? '';
  const visible = TRADE_FAKE_DB.accounts.filter((account) => {
    if (account.companyId !== companyId) return false;
    if (!isAccountVisibleToBranch(account.partyId, branchId)) return false;
    // Backend statusCounts: the accountRole filter applies to byRole too.
    if (q.accountRole && account.accountRole !== q.accountRole) return false;
    if (needle && !matchesAccountSearch(account, needle)) return false;
    return true;
  });

  const byRole: Record<CommercialAccountRole, number> = { CUSTOMER: 0, SUPPLIER: 0 };
  let active = 0;
  let blocked = 0;

  for (const account of visible) {
    byRole[account.accountRole] += 1;
    if (account.status === 'ACTIVE') {
      active += 1;
    } else if (account.status === 'BLOCKED') {
      blocked += 1;
    }
  }

  return clone({
    ACTIVE: active,
    BLOCKED: blocked,
    total: active + blocked,
    byRole,
  });
}

export async function fakeGetAccount(headers: Record<string, string>, id: string): Promise<AccountDetail> {
  await fakeDelay();
  ensureSeedInitialized();

  const { companyId, branchId } = requireCompanyContext(headers);
  const account = TRADE_FAKE_DB.accounts.find((item) => item.id === id && item.companyId === companyId);
  if (!account || !isAccountVisibleToBranch(account.partyId, branchId)) {
    throw new ApiError(404, 'TRADE.ACCOUNT.NOT_FOUND');
  }

  const branchRule = branchId
    ? (BRANCH_RULES.find(
        (rule) => rule.commercialAccountId === account.id && rule.companyId === companyId && rule.branchId === branchId,
      ) ?? null)
    : null;

  return clone({ ...attachParty(account), branchRule });
}

export async function fakeCreateAccount(
  headers: Record<string, string>,
  body: CreateAccountInput,
): Promise<AccountWithParty> {
  await fakeDelay();
  ensureSeedInitialized();

  const { companyId } = requireCompanyContext(headers);
  return runIdempotent(headers, 'CREATE_ACCOUNT', body, () => {
    const party = findDirectoryParty(body.partyId);
    if (!party || party.status !== 'ACTIVE' || !party.roles.includes(body.accountRole)) {
      throw new ApiError(422, 'TRADE.ACCOUNT.PARTY_ROLE_INVALID');
    }

    validateAccountTermsAndPricing(companyId, undefined, body.accountRole, body);

    const duplicate = TRADE_FAKE_DB.accounts.some(
      (item) =>
        item.partyId === body.partyId &&
        item.companyId === companyId &&
        item.accountRole === body.accountRole,
    );
    if (duplicate) {
      throw new ApiError(409, 'TRADE.ACCOUNT.ALREADY_EXISTS');
    }

    const now = nowIso();
    const created: CommercialAccount = {
      id: `acc-${fakeId()}`,
      partyId: body.partyId,
      companyId,
      accountRole: body.accountRole,
      paymentTermsId: null,
      creditLimit: body.accountRole === 'SUPPLIER' ? null : body.creditLimit,
      creditCurrencyCode: body.accountRole === 'SUPPLIER' ? null : body.creditCurrencyCode,
      priceBookId: body.priceBookId,
      creditPolicyVersionId: body.creditPolicyVersionId,
      terms: clone(body.terms ?? {}),
      status: 'ACTIVE',
      blockReasonCode: null,
      version: 1,
      createdAt: now,
      updatedAt: now,
    };

    TRADE_FAKE_DB.accounts.unshift(created);
    return attachParty(created);
  });
}

export async function fakeUpdateAccount(
  headers: Record<string, string>,
  id: string,
  patch: UpdateAccountPatch,
): Promise<UpdateAccountResult> {
  await fakeDelay();
  ensureSeedInitialized();

  const { companyId } = requireCompanyContext(headers);
  const expectedVersion = requireIfMatchVersion(headers);

  return runIdempotent(headers, `UPDATE_ACCOUNT:${id}:${expectedVersion}`, patch, () => {
    const account = TRADE_FAKE_DB.accounts.find((item) => item.id === id && item.companyId === companyId);
    if (!account) {
      throw new ApiError(404, 'TRADE.ACCOUNT.NOT_FOUND');
    }
    if (account.version !== expectedVersion) {
      throw new ApiError(409, 'TRADE.CONCURRENCY.STALE_VERSION');
    }

    const merged: AccountInput = {
      creditLimit: patch.creditLimit !== undefined ? patch.creditLimit : account.creditLimit,
      creditCurrencyCode:
        patch.creditCurrencyCode !== undefined ? patch.creditCurrencyCode : account.creditCurrencyCode,
      priceBookId: patch.priceBookId !== undefined ? patch.priceBookId : account.priceBookId,
      creditPolicyVersionId:
        patch.creditPolicyVersionId !== undefined ? patch.creditPolicyVersionId : account.creditPolicyVersionId,
      terms: patch.terms !== undefined ? clone(patch.terms) : clone(account.terms),
    };

    validateAccountTermsAndPricing(companyId, undefined, account.accountRole, merged);

    account.creditLimit = merged.creditLimit;
    account.creditCurrencyCode = merged.creditCurrencyCode;
    account.priceBookId = merged.priceBookId;
    account.creditPolicyVersionId = merged.creditPolicyVersionId;
    account.terms = merged.terms;
    bumpVersion(account);

    const newBaseSet = new Set(baseAllowedCurrencies(account));
    const warnings: AccountWarning[] = [];
    for (const rule of BRANCH_RULES) {
      if (rule.commercialAccountId !== account.id || rule.companyId !== companyId || rule.status !== 'ACTIVE') {
        continue;
      }
      const fields: ('creditLimit' | 'allowedCurrencies')[] = [];
      if (
        rule.narrowingRules.creditLimit !== undefined &&
        account.creditLimit !== null &&
        compareDecimals(rule.narrowingRules.creditLimit, account.creditLimit) > 0
      ) {
        fields.push('creditLimit');
      }
      if (
        rule.narrowingRules.allowedCurrencies !== undefined &&
        rule.narrowingRules.allowedCurrencies.some((code) => !newBaseSet.has(code))
      ) {
        fields.push('allowedCurrencies');
      }
      if (fields.length > 0) {
        warnings.push({ branchRuleId: rule.id, branchId: rule.branchId, fields });
      }
    }

    return { ...attachParty(account), warnings };
  });
}

export async function fakeListBranchRules(headers: Record<string, string>, accountId: string): Promise<BranchRuleList> {
  await fakeDelay();
  ensureSeedInitialized();

  const { companyId, branchId } = requireCompanyContext(headers);
  const account = TRADE_FAKE_DB.accounts.find((item) => item.id === accountId && item.companyId === companyId);
  if (!account || !isAccountVisibleToBranch(account.partyId, branchId)) {
    throw new ApiError(404, 'TRADE.ACCOUNT.NOT_FOUND');
  }

  // Backend listBranchRules: { items }, ordered by branch name then id, each with branchName and branchNameAr: null.
  const branches = FAKE_COMPANIES.find((company) => company.id === companyId)?.branches ?? [];
  const items = BRANCH_RULES.filter((rule) => rule.commercialAccountId === account.id && rule.companyId === companyId)
    .flatMap((rule) => {
      const branch = branches.find((b) => b.id === rule.branchId);
      return branch ? [{ ...rule, branchName: branch.nameEn, branchNameAr: null }] : [];
    })
    .sort((a, b) => a.branchName.localeCompare(b.branchName) || a.id.localeCompare(b.id));
  return clone({ items });
}

export async function fakeCreateBranchRule(
  headers: Record<string, string>,
  accountId: string,
  body: CreateBranchRuleInput,
): Promise<BranchRule> {
  await fakeDelay();
  ensureSeedInitialized();

  const { companyId, branchId } = requireBranchContext(headers);
  return runIdempotent(headers, `CREATE_BRANCH_RULE:${accountId}`, body, () => {
    if (body.branchId !== branchId) {
      throw new ApiError(422, 'TRADE.CONTEXT.BRANCH_COMPANY_MISMATCH');
    }
    const account = TRADE_FAKE_DB.accounts.find((item) => item.id === accountId && item.companyId === companyId);
    if (!account || !isAccountVisibleToBranch(account.partyId, branchId)) {
      throw new ApiError(404, 'TRADE.ACCOUNT.NOT_FOUND');
    }

    const exists = BRANCH_RULES.some(
      (rule) => rule.commercialAccountId === account.id && rule.companyId === companyId && rule.branchId === branchId,
    );
    if (exists) {
      throw new ApiError(409, 'TRADE.ACCOUNT.BRANCH_RULE_ALREADY_EXISTS');
    }

    validateNarrowingRules(account, body.narrowingRules, 'ACTIVE');

    const created: BranchRule = {
      id: `br-rule-${fakeId()}`,
      commercialAccountId: account.id,
      companyId,
      branchId,
      narrowingRules: clone(body.narrowingRules),
      status: 'ACTIVE',
      version: 1,
    };
    BRANCH_RULES.push(created);
    return created;
  });
}

export async function fakeUpdateBranchRule(
  headers: Record<string, string>,
  accountId: string,
  ruleBranchId: string,
  body: UpdateBranchRuleInput,
): Promise<BranchRule> {
  await fakeDelay();
  ensureSeedInitialized();

  const { companyId, branchId } = requireBranchContext(headers);
  const expectedRuleVersion = requireIfMatchVersion(headers);

  return runIdempotent(headers, `UPDATE_BRANCH_RULE:${accountId}:${ruleBranchId}:${expectedRuleVersion}`, body, () => {
    if (ruleBranchId !== branchId) {
      throw new ApiError(422, 'TRADE.CONTEXT.BRANCH_COMPANY_MISMATCH');
    }
    const account = TRADE_FAKE_DB.accounts.find((item) => item.id === accountId && item.companyId === companyId);
    if (!account || !isAccountVisibleToBranch(account.partyId, branchId)) {
      throw new ApiError(404, 'TRADE.ACCOUNT.NOT_FOUND');
    }

    const rule = BRANCH_RULES.find(
      (item) => item.commercialAccountId === account.id && item.companyId === companyId && item.branchId === ruleBranchId,
    );
    if (!rule) {
      throw new ApiError(404, 'TRADE.ACCOUNT.BRANCH_RULE_NOT_FOUND');
    }
    if (rule.version !== expectedRuleVersion) {
      throw new ApiError(409, 'TRADE.CONCURRENCY.STALE_VERSION');
    }

    const nextStatus = body.status ?? rule.status;
    validateNarrowingRules(account, body.narrowingRules, nextStatus, rule);

    rule.narrowingRules = clone(body.narrowingRules);
    rule.status = nextStatus;
    rule.version += 1;
    return rule;
  });
}

interface ResolvedCreditState {
  account: CommercialAccount;
  activeRule: BranchRule | null;
  effectiveLimit: string | null;
  ruleHold: boolean;
  accountHold: boolean;
  effectiveAllowed: string[];
  exposureEntry: FakeExposure | null;
  exposureFresh: boolean;
  exposureAsOf: string | null;
  openCommitments: string;
  remainingAmount: string | null;
}

function resolveCreditState(
  companyId: string,
  branchId: string,
  accountId: string,
  currencyCode: string,
  proposedAmount?: string,
): ResolvedCreditState {
  const account = TRADE_FAKE_DB.accounts.find((item) => item.id === accountId && item.companyId === companyId);
  if (!account || !isAccountVisibleToBranch(account.partyId, branchId)) {
    throw new ApiError(404, 'TRADE.ACCOUNT.NOT_FOUND');
  }
  if (account.accountRole === 'SUPPLIER') {
    throw new ApiError(422, 'TRADE.ACCOUNT.PARTY_ROLE_INVALID');
  }
  if (
    (proposedAmount !== undefined && !CREDIT_LIMIT_PATTERN.test(proposedAmount)) ||
    !CURRENCY_CODE_PATTERN.test(currencyCode)
  ) {
    throw new ApiError(400, 'TRADE.VALIDATION_FAILED');
  }
  if (account.creditCurrencyCode !== null && currencyCode !== account.creditCurrencyCode) {
    throw new ApiError(422, 'TRADE.ACCOUNT.CREDIT_LIMIT_INVALID');
  }

  const activeRule =
    BRANCH_RULES.find(
      (rule) =>
        rule.commercialAccountId === account.id &&
        rule.companyId === companyId &&
        rule.branchId === branchId &&
        rule.status === 'ACTIVE',
    ) ?? null;

  let effectiveLimit: string | null = account.creditLimit;
  if (activeRule?.narrowingRules.creditLimit !== undefined) {
    if (effectiveLimit === null || compareDecimals(activeRule.narrowingRules.creditLimit, effectiveLimit) < 0) {
      effectiveLimit = activeRule.narrowingRules.creditLimit;
    }
  }

  const ruleHold = activeRule?.narrowingRules.orderingHold === true;
  const accountHold = account.terms.orderingHold === true;

  const baseAllowed = baseAllowedCurrencies(account);
  const ruleAllowed = activeRule?.narrowingRules.allowedCurrencies;
  let effectiveAllowed: string[] = baseAllowed;
  if (ruleAllowed && baseAllowed.length > 0) {
    const ruleSet = new Set(ruleAllowed);
    effectiveAllowed = baseAllowed.filter((c) => ruleSet.has(c));
  } else if (ruleAllowed) {
    effectiveAllowed = [...ruleAllowed];
  }

  const exposureEntry = EXPOSURES[`${account.id}:${currencyCode}`] ?? null;
  const exposureFresh = exposureEntry !== null && exposureEntry.ageMs <= FRESH_LIMIT_MS;
  const exposureAsOf = exposureEntry ? new Date(Date.now() - exposureEntry.ageMs).toISOString() : null;
  const openCommitments = OPEN_COMMITMENTS[account.id] ?? '0.000';
  const commitmentsMicro = decimalToMicro(openCommitments);

  let remainingAmount: string | null = null;
  if (effectiveLimit !== null && exposureEntry !== null) {
    const diff = decimalToMicro(effectiveLimit) - decimalToMicro(exposureEntry.exposureAmount) - commitmentsMicro;
    remainingAmount = microToDecimal(diff > 0n ? diff : 0n);
  }

  return {
    account,
    activeRule,
    effectiveLimit,
    ruleHold,
    accountHold,
    effectiveAllowed,
    exposureEntry,
    exposureFresh,
    exposureAsOf,
    openCommitments,
    remainingAmount,
  };
}

export async function fakeGetCreditSummary(
  headers: Record<string, string>,
  accountId: string,
  currencyCode: string,
): Promise<CreditSummary> {
  await fakeDelay();
  ensureSeedInitialized();

  const { companyId, branchId } = requireBranchContext(headers);
  const state = resolveCreditState(companyId, branchId, accountId, currencyCode);
  const exposureAmount = state.exposureEntry?.exposureAmount ?? null;
  const orderingHold =
    state.account.status === 'BLOCKED'
      ? state.ruleHold || state.accountHold
      : state.ruleHold || state.accountHold || Boolean(state.exposureEntry?.orderingHold);

  return clone({
    effectiveLimit: state.effectiveLimit,
    exposureAmount,
    openCommitments: state.openCommitments,
    remainingAmount: state.remainingAmount,
    currencyCode,
    orderingHold,
    asOf: state.exposureAsOf,
    stale: !state.exposureFresh,
  });
}

export async function fakeEvaluateCredit(
  headers: Record<string, string>,
  accountId: string,
  body: EvaluateCreditInput,
): Promise<CreditDecision> {
  await fakeDelay();
  ensureSeedInitialized();

  const { companyId, branchId } = requireBranchContext(headers);
  return runIdempotent(headers, `EVALUATE_CREDIT:${accountId}`, body, () => {
    const state = resolveCreditState(companyId, branchId, accountId, body.currencyCode, body.proposedAmount);
    const {
      account,
      activeRule,
      effectiveLimit,
      ruleHold,
      accountHold,
      effectiveAllowed,
      exposureEntry,
      exposureFresh,
      exposureAsOf,
      openCommitments,
      remainingAmount,
    } = state;

    const proposedMicro = decimalToMicro(body.proposedAmount);
    const commitmentsMicro = decimalToMicro(openCommitments);

    const makeDecision = (
      outcome: 'ALLOW' | 'BLOCK',
      reasonCode: CreditReason,
      exposureAmount: string | null,
      remaining: string | null,
      orderingHold: boolean,
      asOf: string | null,
    ): CreditDecision => ({
      id: `cred-${fakeId()}`,
      explanation: `Server decision: ${outcome} (${reasonCode}).`,
      evaluatedAt: nowIso(),
      matchedRules: outcome === 'ALLOW' ? [reasonCode] : [],
      rejectedRules: outcome === 'BLOCK' ? [reasonCode] : [],
      result: {
        outcome,
        reasonCode,
        accountVersion: account.version,
        branchRuleId: activeRule?.id ?? null,
        effectiveLimit,
        exposureAmount,
        openCommitments,
        proposedAmount: body.proposedAmount,
        remainingAmount: remaining,
        currencyCode: body.currencyCode,
        orderingHold,
        asOf,
      },
    });

    // 1. Account status check
    if (account.status === 'BLOCKED') {
      return makeDecision(
        'BLOCK',
        'ACCOUNT_BLOCKED',
        exposureEntry?.exposureAmount ?? null,
        remainingAmount,
        ruleHold || accountHold,
        exposureAsOf,
      );
    }

    // 2. Branch hold, then account hold
    if (ruleHold) {
      return makeDecision(
        'BLOCK',
        'BRANCH_ORDERING_HOLD',
        exposureEntry?.exposureAmount ?? null,
        remainingAmount,
        true,
        exposureAsOf,
      );
    }
    if (accountHold) {
      return makeDecision(
        'BLOCK',
        'ACCOUNT_ORDERING_HOLD',
        exposureEntry?.exposureAmount ?? null,
        remainingAmount,
        true,
        exposureAsOf,
      );
    }

    // 3. Currency allowed check
    if (effectiveAllowed.length > 0 && !effectiveAllowed.includes(body.currencyCode)) {
      return makeDecision(
        'BLOCK',
        'CURRENCY_NOT_ALLOWED',
        exposureEntry?.exposureAmount ?? null,
        remainingAmount,
        false,
        exposureAsOf,
      );
    }

    // 4. Exposure freshness check
    if (!exposureFresh || exposureEntry === null) {
      if (effectiveLimit !== null) {
        throw new ApiError(503, 'TRADE.CREDIT.EXPOSURE_UNAVAILABLE');
      }
      return makeDecision(
        'ALLOW',
        'ACCOUNT_ACTIVE_UNLIMITED',
        exposureEntry?.exposureAmount ?? null,
        null,
        false,
        exposureAsOf,
      );
    }

    // 5. Fresh exposure checks
    const exposureAmount = exposureEntry.exposureAmount;
    if (exposureEntry.orderingHold) {
      return makeDecision(
        'BLOCK',
        'ACCOUNTING_ORDERING_HOLD',
        exposureAmount,
        remainingAmount,
        true,
        exposureAsOf,
      );
    }

    if (effectiveLimit === null) {
      return makeDecision('ALLOW', 'ACCOUNT_ACTIVE_UNLIMITED', exposureAmount, null, false, exposureAsOf);
    }

    const totalNeeded = decimalToMicro(exposureAmount) + commitmentsMicro + proposedMicro;
    const limitMicro = decimalToMicro(effectiveLimit);

    if (totalNeeded > limitMicro) {
      return makeDecision('BLOCK', 'CREDIT_LIMIT_EXCEEDED', exposureAmount, remainingAmount, false, exposureAsOf);
    }

    return makeDecision('ALLOW', 'CREDIT_WITHIN_LIMIT', exposureAmount, remainingAmount, false, exposureAsOf);
  });
}

function validateTransitionBody(body: AccountStatusTransitionInput): void {
  if (!body || typeof body !== 'object') {
    throw new ApiError(400, 'TRADE.VALIDATION_FAILED');
  }
  const reasonId = typeof body.reasonCodeId === 'string' ? body.reasonCodeId.trim() : '';
  if (!reasonId) {
    throw new ApiError(400, 'TRADE.VALIDATION_FAILED');
  }
  if (body.reasonNote !== undefined && (typeof body.reasonNote !== 'string' || body.reasonNote.length > 500)) {
    throw new ApiError(400, 'TRADE.VALIDATION_FAILED');
  }
  if (body.evidenceRef !== undefined && (typeof body.evidenceRef !== 'string' || body.evidenceRef.length > 240)) {
    throw new ApiError(400, 'TRADE.VALIDATION_FAILED');
  }
}

function resolveTransitionReason(
  kind: 'ACCOUNT_BLOCK' | 'ACCOUNT_UNBLOCK',
  body: AccountStatusTransitionInput,
): ReasonCode {
  // Backend assertUsable order: NOT_FOUND -> INACTIVE -> KIND_INVALID -> NOTE_REQUIRED (422, details.field).
  return assertUsableReason({ id: body.reasonCodeId.trim(), kind, note: body.reasonNote });
}

export async function fakeBlockAccount(
  headers: Record<string, string>,
  id: string,
  body: AccountStatusTransitionInput,
): Promise<AccountWithParty> {
  await fakeDelay();
  ensureSeedInitialized();

  const { companyId } = requireCompanyContext(headers);
  const expectedVersion = requireIfMatchVersion(headers);

  return runIdempotent(headers, `BLOCK_ACCOUNT:${id}:${expectedVersion}`, body, () => {
    validateTransitionBody(body);

    const account = TRADE_FAKE_DB.accounts.find((item) => item.id === id && item.companyId === companyId);
    if (!account) {
      throw new ApiError(404, 'TRADE.ACCOUNT.NOT_FOUND');
    }
    if (account.version !== expectedVersion) {
      throw new ApiError(409, 'TRADE.CONCURRENCY.STALE_VERSION');
    }
    if (account.status === 'BLOCKED') {
      throw new ApiError(409, 'TRADE.ACCOUNT.BLOCK_TRANSITION_INVALID');
    }

    const reason = resolveTransitionReason('ACCOUNT_BLOCK', body);
    account.status = 'BLOCKED';
    account.blockReasonCode = reason.code;
    bumpVersion(account);
    return attachParty(account);
  });
}

export async function fakeUnblockAccount(
  headers: Record<string, string>,
  id: string,
  body: AccountStatusTransitionInput,
): Promise<AccountWithParty> {
  await fakeDelay();
  ensureSeedInitialized();

  const { companyId } = requireCompanyContext(headers);
  const expectedVersion = requireIfMatchVersion(headers);

  return runIdempotent(headers, `UNBLOCK_ACCOUNT:${id}:${expectedVersion}`, body, () => {
    validateTransitionBody(body);

    const account = TRADE_FAKE_DB.accounts.find((item) => item.id === id && item.companyId === companyId);
    if (!account) {
      throw new ApiError(404, 'TRADE.ACCOUNT.NOT_FOUND');
    }
    if (account.version !== expectedVersion) {
      throw new ApiError(409, 'TRADE.CONCURRENCY.STALE_VERSION');
    }
    if (account.status === 'ACTIVE') {
      throw new ApiError(409, 'TRADE.ACCOUNT.BLOCK_TRANSITION_INVALID');
    }

    resolveTransitionReason('ACCOUNT_UNBLOCK', body);
    account.status = 'ACTIVE';
    account.blockReasonCode = null;
    bumpVersion(account);
    return attachParty(account);
  });
}

export async function fakeListAccountLookups(
  headers: Record<string, string>,
  role?: CommercialAccountRole,
): Promise<AccountLookups> {
  await fakeDelay();
  const { companyId, branchId } = requireCompanyContext(headers);

  const branchMatches = branchId
    ? CREDIT_POLICIES.filter(
        (p) => p.scopeTarget === 'BRANCH' && p.companyId === companyId && p.branchId === branchId,
      )
    : [];
  const companyMatches = CREDIT_POLICIES.filter((p) => p.scopeTarget === 'COMPANY' && p.companyId === companyId);
  const tenantMatches = CREDIT_POLICIES.filter((p) => p.scopeTarget === 'TENANT');

  const expectedPurpose = role === 'CUSTOMER' ? 'SALES' : role === 'SUPPLIER' ? 'PURCHASE' : null;
  const priceBooks = PRICE_BOOKS.filter((book) => {
    if (book.companyId !== companyId) return false;
    if (expectedPurpose && (book.status !== 'ACTIVE' || book.purpose !== expectedPurpose)) return false;
    return true;
  });

  return clone({
    creditPolicies: [...branchMatches, ...companyMatches, ...tenantMatches],
    priceBooks,
  });
}

export async function fakeListCreditPolicies(headers: Record<string, string>): Promise<CreditPolicy[]> {
  const lookups = await fakeListAccountLookups(headers);
  return lookups.creditPolicies;
}

export async function fakeListPriceBooks(
  headers: Record<string, string>,
  role?: CommercialAccountRole,
): Promise<PriceBookOption[]> {
  const lookups = await fakeListAccountLookups(headers, role);
  return lookups.priceBooks;
}

export async function fakeListParties(role?: CommercialAccountRole): Promise<DirectoryParty[]> {
  await fakeDelay();
  const all = directoryParties();
  return clone(role ? all.filter((party) => party.roles.includes(role)) : all);
}
