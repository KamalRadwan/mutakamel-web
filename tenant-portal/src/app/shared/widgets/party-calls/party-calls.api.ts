import { fakeGetPartyCallsSummary, fakeListPartyCalls } from './party-calls.fake';
import {
  ListPartyCallsQuery,
  ListPartyCallsResponse,
  PartyCallsSummary,
  PartyCallsSummaryQuery,
} from './party-calls.model';

export type {
  ListPartyCallsQuery,
  ListPartyCallsResponse,
  PartyCall,
  PartyCallLinkKind,
  PartyCallPartyType,
  PartyCallTransferKind,
  PartyCallsSummary,
  PartyCallsSummaryQuery,
} from './party-calls.model';
export { toCallLogTypeParam, toPartyCallLogRow } from './party-calls.model';

/**
 * GET /api/tenant/crm/v1/calls?partyType&partyId&page&limit&type=A,B&from&to&q -> `{ data, meta }`.
 * Access is the parent record's own/team/all scope + branch/module + `crm.activities.read`; unreadable record -> 404.
 * `type` is one comma list (unknown query keys are rejected). `linkKind` is `SOURCE | NUMBER_MATCH`. 400 when `from > to`.
 */
export function listPartyCalls(query: ListPartyCallsQuery): Promise<ListPartyCallsResponse> {
  return fakeListPartyCalls(query);
}

/** GET /api/tenant/crm/v1/calls/summary?partyType&partyId -> `{ total, missed, lastCallAt }`, where `missed` counts `IN_NOANS`. */
export function getPartyCallsSummary(query: PartyCallsSummaryQuery): Promise<PartyCallsSummary> {
  return fakeGetPartyCallsSummary(query);
}
