import { listRecordHistory } from './record-history.api';
import { HistoryPage, ListRecordHistoryOptions, RecordHistoryError } from './record-history.model';

/**
 * @deprecated The widget's own seed is gone: record history now comes from the Audit log fake through
 * `record-history.api` (one wrapper per backend route). Kept only because
 * `features/crm/leads/lead-page/lead-history-tab/lead-history.fake.ts` still imports these names
 * (that file has no importers and can be deleted by its owner).
 */
export const FAKE_NO_AUDIT = false;

/** @deprecated See above; delegates to `listRecordHistory`. */
export function fakeListRecordHistory(
  entityType: string,
  entityId: string,
  partyIds: readonly string[],
  options: ListRecordHistoryOptions = {},
): Promise<HistoryPage> {
  if (FAKE_NO_AUDIT) {
    return Promise.reject(new RecordHistoryError(403, 'MISSING_REQUIRED_PERMISSIONS'));
  }
  return listRecordHistory(entityType, entityId, partyIds, options);
}
