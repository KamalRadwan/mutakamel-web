export type CallLogType = 'IN_ANS' | 'IN_NOANS' | 'IN_BUSY' | 'OUT_ANS' | 'OUT_NOANS' | 'OUT_BUSY' | 'OUT';
export type CallRecordType = 'LEAD' | 'CUSTOMER_PROFILE' | 'PARTY' | 'OPPORTUNITY';

export interface CallLogRow {
  id: string;
  type: CallLogType;
  number: string;
  name: string | null;
  startedAt: string | null;
  durationSeconds: number | null;
  ownerName: string | null;
  record: { type: CallRecordType; id: string; label: string } | null;
  linkKind: 'SOURCE' | 'NUMBER_MATCH' | null;
}

export interface CallLogQuery {
  page: number;
  limit: number;
  types?: CallLogType[];
  from?: string;
  to?: string;
  q?: string;
}

export type CallLogLoader = (
  q: CallLogQuery,
) => Promise<{ data: CallLogRow[]; meta: { page: number; limit: number; total: number } }>;

export type CallLogColumn = 'type' | 'party' | 'owner' | 'date' | 'duration' | 'actions';
