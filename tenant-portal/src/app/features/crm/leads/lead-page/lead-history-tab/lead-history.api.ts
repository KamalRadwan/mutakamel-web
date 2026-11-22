import { listRecordHistory } from '../../../../../shared/widgets/record-history/record-history.api';
import { HistoryPage, ListRecordHistoryOptions } from '../../../../../shared/widgets/record-history/record-history.model';

/**
 * GET /api/tenant/core/v1/audit/entities/Lead/:leadId?relatedPartyIds=<csv, max 21>&historyCategory=<lead|contact|activity>&limit=25&cursor=<opaque>
 */
export function listLeadHistory(
  leadId: string,
  partyIds: readonly string[],
  options: ListRecordHistoryOptions = {},
): Promise<HistoryPage> {
  return listRecordHistory('Lead', leadId, partyIds, options);
}
