import { crmHttp, crmQueries } from '../../../features/crm/shared/crm-http';
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
  // Scope mode NONE: record visibility is resolved by the CRM service.
  return crmQueries().fetchQuery({
    queryKey: ['crm-party-calls', 'list', query],
    queryFn: () => crmHttp().read<ListPartyCallsResponse>('/calls', { ...query }),
  });
}

/** GET /api/tenant/crm/v1/calls/summary?partyType&partyId -> `{ total, missed, lastCallAt }`, where `missed` counts `IN_NOANS`. */
export function getPartyCallsSummary(query: PartyCallsSummaryQuery): Promise<PartyCallsSummary> {
  // Scope mode NONE: record visibility is resolved by the CRM service.
  return crmQueries().fetchQuery({
    queryKey: ['crm-party-calls', 'summary', query],
    queryFn: () => crmHttp().read<PartyCallsSummary>('/calls/summary', { ...query }),
  });
}
