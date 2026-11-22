import type {
  CommercialAccount,
  CommercialAccountRole,
  CommercialAccountStatus,
  PartyRef,
  StatusCounts,
} from '../../shared/trade-foundation.model';

export interface AccountParty extends PartyRef {
  displayNameAr: string | null;
}

export type AccountWithParty = CommercialAccount & { party: AccountParty | null };

export interface BranchRuleNarrowing {
  creditLimit?: string;
  orderingHold?: true;
  allowedCurrencies?: string[];
}

export interface BranchRule {
  id: string;
  commercialAccountId: string;
  companyId: string;
  branchId: string;
  narrowingRules: BranchRuleNarrowing;
  status: 'ACTIVE' | 'RETIRED';
  version: number;
}

export type AccountDetail = AccountWithParty & { branchRule: BranchRule | null };

/** GET /commercial-accounts/:id/branch-rules: `{ items }`, each rule with the branch name (branchNameAr is null today). */
export interface BranchRuleList {
  items: (BranchRule & { branchName: string; branchNameAr: string | null })[];
}

export interface AccountWarning {
  branchRuleId: string;
  branchId: string;
  fields: ('creditLimit' | 'allowedCurrencies')[];
}

export interface CreditPolicy {
  id: string;
  versionNumber: number;
  code: string;
  scopeTarget: 'TENANT' | 'COMPANY' | 'BRANCH';
  effectiveFrom: string;
  effectiveTo: string | null;
  status: 'PUBLISHED';
  companyId: string | null;
  branchId: string | null;
}

export interface PriceBookOption {
  id: string;
  companyId: string;
  name: string;
  purpose: 'SALES' | 'PURCHASE';
  currencyCode: string;
  status: 'ACTIVE' | 'INACTIVE';
}

export type CreditReason =
  | 'ACCOUNT_BLOCKED'
  | 'ACCOUNT_NOT_ACTIVE'
  | 'BRANCH_ORDERING_HOLD'
  | 'ACCOUNT_ORDERING_HOLD'
  | 'CURRENCY_NOT_ALLOWED'
  | 'ACCOUNTING_ORDERING_HOLD'
  | 'ACCOUNT_ACTIVE_UNLIMITED'
  | 'CREDIT_LIMIT_EXCEEDED'
  | 'CREDIT_WITHIN_LIMIT';

export interface CreditDecision {
  id: string;
  explanation: string;
  evaluatedAt: string;
  matchedRules: string[];
  rejectedRules: string[];
  result: {
    outcome: 'ALLOW' | 'BLOCK';
    reasonCode: CreditReason;
    accountVersion: number;
    branchRuleId: string | null;
    effectiveLimit: string | null;
    exposureAmount: string | null;
    openCommitments: string;
    proposedAmount: string;
    remainingAmount: string | null;
    currencyCode: string;
    orderingHold: boolean;
    asOf: string | null;
  };
}

export interface CreditSummary {
  effectiveLimit: string | null;
  exposureAmount: string | null;
  openCommitments: string;
  remainingAmount: string | null;
  currencyCode: string;
  orderingHold: boolean;
  asOf: string | null;
  stale: boolean;
}

export interface AccountLookups {
  creditPolicies: CreditPolicy[];
  priceBooks: PriceBookOption[];
}

export interface AccountInput {
  creditLimit: string | null;
  creditCurrencyCode: string | null;
  priceBookId: string | null;
  creditPolicyVersionId: string | null;
  terms: CommercialAccount['terms'];
}

export type CreateAccountInput = AccountInput & {
  partyId: string;
  accountRole: CommercialAccountRole;
};

export type UpdateAccountPatch = Partial<AccountInput>;

/** PATCH /commercial-accounts/:id returns the account flat, with `warnings` beside its fields. */
export type UpdateAccountResult = AccountWithParty & { warnings: AccountWarning[] };

export type AccountSortField = 'createdAt' | 'partyName' | 'creditLimit';
/** CommercialAccountListQueryDto: upper case only; the backend default is DESC for every sort. */
export type AccountSortDirection = 'ASC' | 'DESC';
export type AccountSortOption = 'created' | 'name' | 'limit';

export interface AccountListFilter {
  accountRole?: CommercialAccountRole;
  status?: CommercialAccountStatus;
  search?: string;
}

export interface ListAccountsQuery extends AccountListFilter {
  page?: number;
  limit?: number;
  sort?: AccountSortField;
  direction?: AccountSortDirection;
}

export interface AccountCountsQuery {
  accountRole?: CommercialAccountRole;
  search?: string;
}

export type AccountStatusCounts = StatusCounts<'ACTIVE' | 'BLOCKED'> & {
  byRole: Record<CommercialAccountRole, number>;
};

export interface CreateBranchRuleInput {
  branchId: string;
  narrowingRules: BranchRuleNarrowing;
}

export interface UpdateBranchRuleInput {
  narrowingRules: BranchRuleNarrowing;
  status?: 'ACTIVE' | 'RETIRED';
}

export interface EvaluateCreditInput {
  proposedAmount: string;
  currencyCode: string;
}

export interface AccountStatusTransitionInput {
  reasonCodeId: string;
  reasonNote?: string;
  evidenceRef?: string;
}

export interface DirectoryParty extends PartyRef {
  displayNameAr: string;
  roles: CommercialAccountRole[];
  status: 'ACTIVE';
  branchId: string | null;
}

export type AccountView = 'cards' | 'table';
export type AccountRoleFilter = 'all' | CommercialAccountRole;
export type AccountStatusFilter = 'all' | CommercialAccountStatus;

export const ACCOUNT_CURRENCIES = ['EGP', 'SAR', 'USD', 'EUR', 'AED', 'GBP', 'KWD'] as const;
export const CREDIT_LIMIT_PATTERN = /^(?:0|[1-9]\d{0,15})(?:\.\d{1,8})?$/;
export const CURRENCY_CODE_PATTERN = /^[A-Z]{3}$/;

export function partyDisplayName(party: AccountParty | PartyRef | null, lang: 'en' | 'ar'): string {
  if (!party) return '';
  if (lang === 'ar' && 'displayNameAr' in party && typeof party.displayNameAr === 'string' && party.displayNameAr) {
    return party.displayNameAr;
  }
  return party.displayName;
}

const SCALE = 8;
const SCALE_FACTOR = 10n ** BigInt(SCALE);

export function decimalToMicro(value: string): bigint {
  const trimmed = value.trim();
  const match = /^(\d+)(?:\.(\d+))?$/.exec(trimmed);
  if (!match) {
    throw new Error(`Invalid decimal: ${value}`);
  }
  const intPart = BigInt(match[1]);
  const fracRaw = (match[2] ?? '').slice(0, SCALE).padEnd(SCALE, '0');
  return intPart * SCALE_FACTOR + BigInt(fracRaw);
}

export function microToDecimal(micro: bigint, decimals = 3): string {
  const negative = micro < 0n;
  const abs = negative ? -micro : micro;
  const intPart = abs / SCALE_FACTOR;
  const fracScaled = (abs % SCALE_FACTOR).toString().padStart(SCALE, '0');
  const fracShown = fracScaled.slice(0, decimals).padEnd(decimals, '0');
  return `${negative ? '-' : ''}${intPart.toString()}.${fracShown}`;
}

export function compareDecimals(a: string, b: string): number {
  const av = decimalToMicro(a);
  const bv = decimalToMicro(b);
  if (av < bv) return -1;
  if (av > bv) return 1;
  return 0;
}
