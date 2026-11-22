import { fakeListRecordHistory } from '../../../../../shared/widgets/record-history/record-history.fake';
import { HistoryPage, ListRecordHistoryOptions } from '../../../../../shared/widgets/record-history/record-history.model';

export { FAKE_NO_AUDIT } from '../../../../../shared/widgets/record-history/record-history.fake';

export function fakeListLeadHistory(
  leadId: string,
  partyIds: readonly string[],
  options: ListRecordHistoryOptions = {},
): Promise<HistoryPage> {
  return fakeListRecordHistory('Lead', leadId, partyIds, options);
}
