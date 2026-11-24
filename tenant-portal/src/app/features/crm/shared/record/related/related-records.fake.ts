import { fakeDelay } from '../../../../../core/fake/fake-utils';
import { FAKE_COMPANIES } from '../../../../../core/scope/scope.fake';
import { ApiError } from '../../../settings/shared/settings-api';
import { fakeCompanyOfBranch, fakeCrmModuleEnabled } from '../../crm-modules/crm-modules.fake';
import {
  RelatedCounts,
  RelatedCountsBody,
  RelatedCountsResponse,
} from './related-records.model';

export const ACME_CUSTOMER_RECORD_ID = '0192b7ea-7c4f-7a7d-9c9f-51c7f2b3aa01';
export const LEAD_ONLY_VISIBILITY_RECORD_ID = 'lead-004';
export const TRADE_NOT_INSTALLED_LEAD_ID = 'lead-005';
export const NO_ACCESS_LEAD_ID = 'lead-006';

const RELATED_RECORD_TYPES = ['LEAD', 'CUSTOMER_PROFILE'] as const;
const MAX_RECORD_IDS = 100;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Fake scope branch ids (b1..b5) stand in for UUIDs until Phase 5. */
const FAKE_BRANCH_ID_RE = /^b\d+$/;

function hashId(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/**
 * RequireBranchAccess('body') runs before the ValidationPipe: a missing branchId is
 * 403 BRANCH_CONTEXT_REQUIRED, a malformed one 400 CRM_VALIDATION_FAILED (a message string,
 * so no details), and a branch the caller has no CRM permission in 403 BRANCH_PERMISSION_DENIED.
 */
function assertBranchAccess(branchId: unknown): string {
  if (typeof branchId !== 'string' || !branchId.trim()) throw new ApiError(403, 'BRANCH_CONTEXT_REQUIRED');
  if (!UUID_RE.test(branchId) && !FAKE_BRANCH_ID_RE.test(branchId)) throw new ApiError(400, 'CRM_VALIDATION_FAILED');
  const known = FAKE_COMPANIES.some((company) => company.branches.some((branch) => branch.id === branchId));
  if (!known) throw new ApiError(403, 'BRANCH_PERMISSION_DENIED');
  return branchId;
}

/**
 * RelatedRecordCountsDto through the global ValidationPipe: 400 CRM_VALIDATION_FAILED with
 * details { property: message[] }. recordIds are lower-cased first (canonicalUuidArray), so a
 * case-only repeat is a duplicate. The fake skips the IsUUID('7') check on record ids because the
 * fake leads use ids such as lead-001 until Phase 5.
 */
function assertCountsBody(body: RelatedCountsBody): string[] {
  const details: Record<string, string[]> = {};
  if (!(RELATED_RECORD_TYPES as readonly string[]).includes(body.recordType)) {
    details['recordType'] = ['recordType must be one of the following values: LEAD, CUSTOMER_PROFILE'];
  }
  const ids = Array.isArray(body.recordIds)
    ? body.recordIds.map((id) => (typeof id === 'string' ? id.toLowerCase() : id))
    : null;
  const idErrors: string[] = [];
  if (!ids) {
    idErrors.push('recordIds must be an array');
  } else {
    if (ids.length === 0) idErrors.push('recordIds should not be empty');
    if (ids.length > MAX_RECORD_IDS) idErrors.push('recordIds must contain no more than 100 elements');
    if (new Set(ids).size !== ids.length) idErrors.push("All recordIds's elements must be unique");
    if (ids.some((id) => typeof id !== 'string' || !id.trim())) idErrors.push('each value in recordIds must be a UUID');
  }
  if (idErrors.length > 0) details['recordIds'] = idErrors;
  if (Object.keys(details).length > 0) throw new ApiError(400, 'CRM_VALIDATION_FAILED', details);
  return ids as string[];
}

/** POST /api/tenant/crm/v1/related-records/counts (RelatedRecordsService.counts). */
export async function fakeRelatedCounts(body: RelatedCountsBody): Promise<RelatedCountsResponse> {
  await fakeDelay(250 + Math.floor(Math.random() * 201));

  const branchId = assertBranchAccess(body.branchId);
  // Opportunity badges use their own loader (record-related-badges.ts).
  const recordIds = assertCountsBody(body);

  const leadsFake = await import('../../../leads/leads.fake');
  const customersFake =
    body.recordType === 'CUSTOMER_PROFILE' ? await import('../../../customers/customers.fake') : null;
  // Leads are counted only while the Leads module is on for the branch's company; else null.
  const leadsEnabled = fakeCrmModuleEnabled('leads', fakeCompanyOfBranch(branchId));

  const countsByRecordId: Record<string, RelatedCounts> = {};

  for (const id of recordIds) {
    const h = hashId(id);

    if (body.recordType === 'CUSTOMER_PROFILE') {
      // resolveParties: only live records in the request branch; others are omitted.
      const customer = customersFake?.CUSTOMERS_FAKE_DB.find((item) => item.id.toLowerCase() === id);
      if (!customer || customer.branchId !== branchId) continue;
      const partyId = customer.partyId;
      const leads = leadsEnabled ? leadsFake.fakeCountLeadsForParty(partyId) : null;

      if (customer.id === ACME_CUSTOMER_RECORD_ID) {
        countsByRecordId[customer.id] = {
          partyId,
          leads,
          opportunities: 1,
          quotations: 2,
          salesOrders: 1,
          invoices: 0,
        };
        continue;
      }

      countsByRecordId[customer.id] = {
        partyId,
        leads,
        opportunities: (h >>> 2) % 4,
        quotations: (h >>> 5) % 4,
        salesOrders: (h >>> 8) % 3,
        invoices: (h >>> 11) % 3,
      };
      continue;
    }

    if (id === NO_ACCESS_LEAD_ID) {
      continue;
    }

    // A lead the fake store does not hold is omitted, like a record outside the read scope.
    const partyId = leadsFake.fakeLeadPartyId(id);
    if (!partyId) continue;
    // Similar leads exclude the current lead.
    const leads = leadsEnabled ? leadsFake.fakeCountLeadsForParty(partyId, id) : null;

    if (id === LEAD_ONLY_VISIBILITY_RECORD_ID) {
      countsByRecordId[id] = {
        partyId,
        leads,
        opportunities: null,
        quotations: null,
        salesOrders: null,
        invoices: null,
      };
      continue;
    }

    if (id === TRADE_NOT_INSTALLED_LEAD_ID) {
      countsByRecordId[id] = {
        partyId,
        leads,
        opportunities: 2,
        quotations: null,
        salesOrders: null,
        invoices: null,
      };
      continue;
    }

    if (id === 'lead-001') {
      countsByRecordId[id] = {
        partyId,
        leads,
        opportunities: 1,
        quotations: 2,
        salesOrders: 1,
        invoices: 0,
      };
      continue;
    }

    countsByRecordId[id] = {
      partyId,
      leads,
      opportunities: h % 3,
      quotations: (h >>> 3) % 4,
      salesOrders: (h >>> 6) % 3,
      invoices: (h >>> 9) % 3,
    };
  }

  return { countsByRecordId };
}
