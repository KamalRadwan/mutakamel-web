import {
  type FakeBulkModule,
  registerFakeBulkModule,
} from '../../../../../shared/bulk-jobs/bulk-jobs.fake';
import {
  BULK_JOB_LIMITS,
  type BulkJob,
  type BulkJobItem,
  type BulkJobItemStatus,
  type BulkJobSubmit,
} from '../../../../../shared/bulk-jobs/bulk-jobs.model';
import { ApiError } from '../../../shared/trade-api';
import {
  TRADE_FAKE_DB,
  assertUsableReason,
  bumpVersion,
  fakeLang,
} from '../../../shared/trade-foundation.fake';
import type {
  CommercialAccount,
  CommercialAccountRole,
  CommercialAccountStatus,
  FakeParty,
  ReasonCode,
  ReasonKind,
} from '../../../shared/trade-foundation.model';
import {
  TRADE_ACCOUNTS_BULK_EVIDENCE_MAX,
  TRADE_ACCOUNTS_BULK_MODULE_ID,
  TRADE_ACCOUNTS_BULK_NOTE_MAX,
  type TradeAccountsBulkAction,
} from './accounts-bulk.descriptor';

/** Backend AccountsBulkQueryDto = PickType(CommercialAccountListQueryDto, accountRole, status, search). */
const QUERY_KEYS = new Set(['accountRole', 'status', 'search']);
const QUERY_SEARCH_MAX = 80;
const COMPANY_REQUIRED = 'TRADE.CONTEXT.COMPANY_REQUIRED';

interface ResolvedAccountItem {
  entityId: string;
  label: string;
  preStatus?: 'SKIPPED' | 'FAILED';
  code?: string;
  data?: Record<string, string | number | null>;
}

interface ParsedAccountQuery {
  accountRole?: CommercialAccountRole;
  status?: CommercialAccountStatus;
  search?: string;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function isAction(value: string): value is TradeAccountsBulkAction {
  return value === 'BLOCK' || value === 'UNBLOCK';
}

function expectedReasonKind(action: TradeAccountsBulkAction): ReasonKind {
  return action === 'BLOCK' ? 'ACCOUNT_BLOCK' : 'ACCOUNT_UNBLOCK';
}

function paramsInvalid(): never {
  throw new ApiError(400, 'BULK_JOB_PARAMS_INVALID');
}

interface AccountBulkParams {
  reasonCodeId: string;
  note?: string;
  evidenceRef?: string;
}

/**
 * Strict like the backend schemas (whitelist + forbidNonWhitelisted): BLOCK takes reasonCodeId, note, evidenceRef;
 * UNBLOCK takes reasonCodeId, note. Any other key (`reasonNote` included) -> 400 BULK_JOB_PARAMS_INVALID.
 */
function parseParams(action: TradeAccountsBulkAction, rawParams: unknown): AccountBulkParams {
  const params = asRecord(rawParams);
  if (!params) paramsInvalid();
  const allowed =
    action === 'BLOCK' ? ['reasonCodeId', 'note', 'evidenceRef'] : ['reasonCodeId', 'note'];
  if (Object.keys(params).some((key) => !allowed.includes(key))) paramsInvalid();
  const { reasonCodeId, note, evidenceRef } = params;
  if (typeof reasonCodeId !== 'string' || !reasonCodeId.trim()) paramsInvalid();
  if (
    note !== undefined &&
    (typeof note !== 'string' || note.length > TRADE_ACCOUNTS_BULK_NOTE_MAX)
  )
    paramsInvalid();
  if (
    evidenceRef !== undefined &&
    (typeof evidenceRef !== 'string' || evidenceRef.length > TRADE_ACCOUNTS_BULK_EVIDENCE_MAX)
  ) {
    paramsInvalid();
  }
  return {
    reasonCodeId,
    ...(note !== undefined ? { note: note as string } : {}),
    ...(evidenceRef !== undefined ? { evidenceRef: evidenceRef as string } : {}),
  };
}

function validateReason(action: TradeAccountsBulkAction, rawParams: unknown): ReasonCode {
  const params = parseParams(action, rawParams);
  // Backend assertUsable order: NOT_FOUND -> INACTIVE -> KIND_INVALID -> NOTE_REQUIRED.
  return assertUsableReason({
    id: params.reasonCodeId,
    kind: expectedReasonKind(action),
    note: params.note ?? '',
  });
}

/** Strict like AccountsBulkQueryDto: a flat object with list keys only, else 400 BULK_JOB_PARAMS_INVALID. */
function parseQuery(rawQuery: unknown): ParsedAccountQuery {
  if (rawQuery === undefined) return {};
  const rec = asRecord(rawQuery);
  if (!rec) paramsInvalid();
  if (Object.keys(rec).some((key) => !QUERY_KEYS.has(key))) paramsInvalid();
  const { accountRole, status, search } = rec;
  if (accountRole !== undefined && accountRole !== 'CUSTOMER' && accountRole !== 'SUPPLIER')
    paramsInvalid();
  if (status !== undefined && status !== 'ACTIVE' && status !== 'BLOCKED') paramsInvalid();
  if (search !== undefined && (typeof search !== 'string' || search.length > QUERY_SEARCH_MAX))
    paramsInvalid();
  const query: ParsedAccountQuery = {};
  if (accountRole) query.accountRole = accountRole as CommercialAccountRole;
  if (status) query.status = status as CommercialAccountStatus;
  const trimmed = typeof search === 'string' ? search.trim() : '';
  if (trimmed) query.search = trimmed;
  return query;
}

function accountLabel(account: CommercialAccount, partyById: Map<string, FakeParty>): string {
  const party = partyById.get(account.partyId);
  if (!party) return account.partyId;
  return fakeLang() === 'ar' ? party.displayNameAr || party.displayName : party.displayName;
}

function matchesQuery(
  account: CommercialAccount,
  party: FakeParty | undefined,
  query: ParsedAccountQuery,
): boolean {
  if (query.accountRole && account.accountRole !== query.accountRole) return false;
  if (query.status && account.status !== query.status) return false;
  if (!query.search) return true;

  const needle = query.search.toLowerCase();
  if (account.id.toLowerCase().includes(needle)) return true;
  if (!party) return false;
  if (party.displayName.toLowerCase().includes(needle)) return true;
  if (party.displayNameAr.toLowerCase().includes(needle)) return true;
  if (party.code && party.code.toLowerCase().includes(needle)) return true;
  return false;
}

const TRADE_ACCOUNTS_FAKE_BULK_MODULE: FakeBulkModule = {
  module: TRADE_ACCOUNTS_BULK_MODULE_ID,

  chunkSize(): number {
    return BULK_JOB_LIMITS.chunkSize;
  },

  validate(body: BulkJobSubmit): void {
    // Backend submit order: action -> params schema -> query schema -> scopeRule COMPANY (all 400),
    // then authorizeAccess (422 TRADE.CONTEXT.COMPANY_REQUIRED, unreachable after scopeRule) -> reason (422).
    if (!isAction(body.action)) {
      throw new ApiError(400, 'BULK_JOB_MODULE_UNKNOWN');
    }
    parseParams(body.action, body.params);
    if (body.selection.kind === 'QUERY') parseQuery(body.selection.query);
    const companyId = body.scope.companyId?.trim() ?? '';
    if (!companyId) paramsInvalid();
    validateReason(body.action, body.params);
  },

  async resolve(body: BulkJobSubmit): Promise<ResolvedAccountItem[]> {
    const companyId = body.scope.companyId?.trim() ?? '';
    const partyById = new Map(TRADE_FAKE_DB.parties.map((party) => [party.id, party]));
    const companyAccounts = TRADE_FAKE_DB.accounts.filter(
      (account) => account.companyId === companyId,
    );

    if (body.selection.kind === 'IDS') {
      const byId = new Map(companyAccounts.map((account) => [account.id, account]));
      return body.selection.ids.map((id): ResolvedAccountItem => {
        const account = byId.get(id);
        if (!account) {
          return {
            entityId: id,
            label: id,
            preStatus: 'FAILED',
            code: 'TRADE.ACCOUNT.NOT_FOUND',
          };
        }
        return {
          entityId: account.id,
          label: accountLabel(account, partyById),
          data: {
            accountRole: account.accountRole,
            status: account.status,
          },
        };
      });
    }

    const query = parseQuery(body.selection.query);
    const excluded = new Set(body.selection.excludedIds ?? []);
    const matched = companyAccounts
      .filter((account) => !excluded.has(account.id))
      .filter((account) => matchesQuery(account, partyById.get(account.partyId), query))
      .sort((a, b) => {
        const cmp = b.createdAt.localeCompare(a.createdAt);
        return cmp !== 0 ? cmp : b.id.localeCompare(a.id);
      });

    return matched.map((account): ResolvedAccountItem => ({
      entityId: account.id,
      label: accountLabel(account, partyById),
      data: {
        accountRole: account.accountRole,
        status: account.status,
      },
    }));
  },

  async executeChunk(
    job: BulkJob,
    rawParams: unknown,
    items: BulkJobItem[],
  ): Promise<
    { ordinal: number; status: BulkJobItemStatus; code?: string; field?: string; refId?: string }[]
  > {
    const companyId = job.scope.companyId?.trim() ?? '';
    if (!companyId) {
      return items.map((item) => ({
        ordinal: item.ordinal,
        status: 'FAILED' as const,
        code: COMPANY_REQUIRED,
      }));
    }
    if (!isAction(job.action)) {
      return items.map((item) => ({
        ordinal: item.ordinal,
        status: 'FAILED' as const,
        code: 'BULK_JOB_PARAMS_INVALID',
      }));
    }

    let reason: ReasonCode;
    try {
      reason = validateReason(job.action, rawParams);
    } catch (error) {
      const code = error instanceof ApiError ? error.code : 'generic';
      return items.map((item) => ({
        ordinal: item.ordinal,
        status: 'FAILED' as const,
        code,
      }));
    }

    const byId = new Map(
      TRADE_FAKE_DB.accounts
        .filter((account) => account.companyId === companyId)
        .map((account) => [account.id, account]),
    );

    return items.map((item) => {
      const account = byId.get(item.entityId);
      if (!account) {
        return {
          ordinal: item.ordinal,
          status: 'FAILED' as const,
          code: 'TRADE.ACCOUNT.NOT_FOUND',
        };
      }

      if (job.action === 'BLOCK') {
        if (account.status === 'BLOCKED') {
          return { ordinal: item.ordinal, status: 'UNCHANGED' as const };
        }
        account.status = 'BLOCKED';
        account.blockReasonCode = reason.code;
        bumpVersion(account);
        return { ordinal: item.ordinal, status: 'SUCCEEDED' as const };
      }

      if (account.status === 'ACTIVE') {
        return { ordinal: item.ordinal, status: 'UNCHANGED' as const };
      }
      account.status = 'ACTIVE';
      account.blockReasonCode = null;
      bumpVersion(account);
      return { ordinal: item.ordinal, status: 'SUCCEEDED' as const };
    });
  },

  async current(entityIds: string[]): Promise<Map<string, Record<string, string | number | null>>> {
    const wanted = new Set(entityIds);
    const map = new Map<string, Record<string, string | number | null>>();
    for (const account of TRADE_FAKE_DB.accounts) {
      if (!wanted.has(account.id)) continue;
      map.set(account.id, {
        status: account.status,
        accountRole: account.accountRole,
        blockReasonCode: account.blockReasonCode,
        version: account.version,
        updatedAt: account.updatedAt,
      });
    }
    return map;
  },

  paramsSummary(body: BulkJobSubmit): Record<string, string | number | null> {
    const params = asRecord(body.params);
    const reasonCodeId =
      typeof params?.['reasonCodeId'] === 'string' ? params['reasonCodeId'].trim() : '';
    const reason = reasonCodeId
      ? (TRADE_FAKE_DB.reasons ?? []).find((entry) => entry.id === reasonCodeId)
      : undefined;
    const lang = fakeLang();
    return {
      reasonCodeId: reasonCodeId || null,
      reasonCode: reason?.code ?? null,
      reasonName: reason
        ? (reason.localizedNames[lang] ?? reason.localizedNames['en'] ?? reason.code)
        : null,
    };
  },
};

let registered = false;

export function registerTradeAccountsFakeBulkModule(): void {
  if (registered) return;
  registered = true;
  registerFakeBulkModule('trading', TRADE_ACCOUNTS_FAKE_BULK_MODULE);
}

registerTradeAccountsFakeBulkModule();
