export interface HistoryCategoryOption {
  id: string;
  labelKey: string;
}

/**
 * Backend `HistorySubjectKind` (related-history-priority.ts): lead | contact | quotation | salesOrder | invoice |
 * activity | note | attachment | record. CRM roots (Lead, CustomerProfile, Opportunity) all arrive as `lead`.
 * `customer` and `opportunity` never come from the API: they are display kinds a host maps to via `subjectKindMap`.
 */
export type HistorySubjectKind =
  | 'lead'
  | 'customer'
  | 'opportunity'
  | 'contact'
  | 'activity'
  | 'note'
  | 'attachment'
  | 'quotation'
  | 'salesOrder'
  | 'invoice'
  | 'record';

export type HistoryOutcome = 'SUCCESS' | 'FAILURE';

export interface HistoryDiffEntry {
  field: string;
  before: unknown;
  after: unknown;
  subjectId?: string;
  subjectLabel?: string;
}

export interface HistoryItem {
  id: string;
  action: string;
  subjectKind: HistorySubjectKind;
  subjectId: string | null;
  referenceLabel: string | null;
  createdAt: string;
  actorLabel: string | null;
  actorType: string;
  outcome: HistoryOutcome | null;
  reason: string | null;
  diff: HistoryDiffEntry[];
}

export interface HistoryPage {
  items: HistoryItem[];
  nextCursor: string | null;
}

export interface ListRecordHistoryOptions {
  /** Widget filter id; mapped to `historyCategory` by `planHistoryCategory` in record-history.api. */
  category?: string;
  cursor?: string | null;
  limit?: number;
}

export class RecordHistoryError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
  ) {
    super(code);
    this.name = 'RecordHistoryError';
  }
}

export const DEFAULT_HISTORY_CATEGORIES: readonly HistoryCategoryOption[] = [
  { id: 'record', labelKey: 'recordHistory.filter.details' },
  { id: 'contact', labelKey: 'recordHistory.filter.contact' },
  { id: 'activity', labelKey: 'recordHistory.filter.activity' },
];
