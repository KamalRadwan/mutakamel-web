export type {
  HistoryDiffEntry,
  HistoryItem,
  HistoryOutcome,
  HistoryPage,
  HistorySubjectKind,
  ListRecordHistoryOptions as ListLeadHistoryOptions,
} from '../../../../../shared/widgets/record-history/record-history.model';

export type HistoryCategory = 'lead' | 'contact' | 'activity';
export type HistoryFilter = 'all' | HistoryCategory;
