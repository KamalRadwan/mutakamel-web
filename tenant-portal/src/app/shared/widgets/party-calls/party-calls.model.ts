import { CallLogRow, CallLogType, CallRecordType } from '../call-log/call-log.model';
export { toCallLogTypeParam } from '../../../core/phone/phone.model';

export type PartyCallPartyType = CallRecordType;
export type PartyCallLinkKind = 'SOURCE' | 'NUMBER_MATCH';
export type PartyCallTransferKind = 'BLIND' | 'ATTENDED';

export interface PartyCall {
  id: string;
  callLogId: string;
  type: CallLogType;
  phoneNumber: string;
  displayName: string | null;
  startedAt: string | null;
  answeredAt: string | null;
  endedAt: string | null;
  durationSeconds: number | null;
  linkKind: PartyCallLinkKind;
  ownerUserId: string;
  ownerName: string | null;
  transferKind: PartyCallTransferKind | null;
  conferenceId: string | null;
}

export interface ListPartyCallsQuery {
  partyType: PartyCallPartyType;
  partyId: string;
  page?: number;
  limit?: number;
  /** Comma-separated CallLogType values (e.g. `IN_NOANS,IN_BUSY`); build it with `toCallLogTypeParam`. */
  type?: string;
  from?: string;
  to?: string;
  q?: string;
}

export interface ListPartyCallsResponse {
  data: PartyCall[];
  meta: {
    page: number;
    limit: number;
    total: number;
  };
}

export interface PartyCallsSummaryQuery {
  partyType: PartyCallPartyType;
  partyId: string;
}

export interface PartyCallsSummary {
  total: number;
  missed: number;
  lastCallAt: string | null;
}

/** Maps a party call DTO to a widget row without a record link since the user is already on the record. */
export function toPartyCallLogRow(item: PartyCall): CallLogRow {
  return {
    id: item.id,
    type: item.type,
    number: item.phoneNumber,
    name: item.displayName,
    startedAt: item.startedAt,
    durationSeconds: item.durationSeconds,
    ownerName: item.ownerName,
    record: null,
    linkKind: item.linkKind,
  };
}
