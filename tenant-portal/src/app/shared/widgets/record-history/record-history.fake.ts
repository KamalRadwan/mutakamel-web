/**
 * @deprecated Record history uses the real AuditLogApi through `record-history.api`.
 * Kept only because
 * `features/crm/leads/lead-page/lead-history-tab/lead-history.fake.ts` still imports these names
 * (that file has no importers and can be deleted by its owner).
 */
export const FAKE_NO_AUDIT = false;

/** @deprecated Compatibility name only; no fixtures or simulated permission failures. */
export { listRecordHistory as fakeListRecordHistory } from './record-history.api';
