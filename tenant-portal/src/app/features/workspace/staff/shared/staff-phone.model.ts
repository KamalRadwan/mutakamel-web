import { CallLogType, CallRecordType } from '../../../../shared/widgets/call-log/call-log.model';
export { toCallLogTypeParam } from '../../../../core/phone/phone.model';

export interface StaffPhoneExtension {
  id: string;
  tenantId: string | null;
  ownerId: string;
  /** Management views declare wire enums as strings. Preserve the server value. */
  ownerType: string;
  extension: string;
  sipUsername: string;
  displayName: string | null;
  outboundCallerId: string | null;
  enabled: boolean;
  passwordConfigured: boolean;
  accessState: string;
  enabledAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface StaffPhoneServer {
  id: string;
  name: string;
  priority: number;
  sipDomain: string;
  websocketUrl: string;
  enabled: boolean;
  /** Additive management fields; older consumers only require the summary above. */
  tenantId?: string | null;
  realm?: string | null;
  outboundProxy?: string | null;
  fromDomain?: string | null;
  registrarServer?: string | null;
  contactUri?: string | null;
  registerExpires?: number;
  defaultCallerId?: string | null;
  iceTransportPolicy?: string;
  iceEnabled?: boolean;
  traceSip?: boolean;
  sessionTimers?: boolean;
  allowInvalidTlsCertificate?: boolean;
  defaultTimeoutSeconds?: number;
  defaultMaxRetries?: number;
  iceServers?: StaffPhoneIceServer[];
  createdAt?: string;
  updatedAt?: string;
}

export interface StaffPhoneIceServer {
  id: string;
  kind: string;
  urls: string[];
  username: string | null;
  credentialConfigured: boolean;
  enabled: boolean;
  sortOrder: number;
}

export interface StaffPhoneChainLink {
  id?: string;
  serverId: string;
  serverName?: string | null;
  priority: number;
  timeoutSeconds: number | null;
  maxRetries: number | null;
}

export interface PhoneSeats {
  allowed: number;
  occupied: number;
  available: number;
  overAllowance: boolean;
  graceUntil: string | null;
  overCapacity: number;
  overCapacitySince: string | null;
}

export interface CreateStaffPhoneExtensionBody {
  ownerId: string;
  extension: string;
  sipUsername: string;
  sipPassword?: string | null;
  displayName?: string | null;
  outboundCallerId?: string | null;
  enabled?: boolean;
}

export interface UpdateStaffPhoneExtensionPatch {
  extension?: string;
  sipUsername?: string;
  sipPassword?: string;
  displayName?: string | null;
  outboundCallerId?: string | null;
  enabled?: boolean;
}

/** The editor keeps an unchanged password; the HTTP contract also permits clearing it. */
export type UpdateStaffPhoneExtensionBody = Omit<UpdateStaffPhoneExtensionPatch, 'sipPassword'> & {
  sipPassword?: string | null;
};

export interface PutStaffPhoneServersBody {
  servers: {
    serverId: string;
    timeoutSeconds: number | null;
    maxRetries: number | null;
  }[];
}

export const EXTENSION_PATTERN = /^[A-Za-z0-9*#+._-]{1,32}$/;
export const CALLER_ID_PATTERN = /^\+?[0-9]+$/;

export const STAFF_PHONE_LIMITS = {
  extension: 32,
  sipUsername: 120,
  displayName: 120,
  outboundCallerId: 64,
} as const;

export interface StaffUserCallLog {
  id: string;
  tenantId: string | null;
  extensionId: string | null;
  ownerId: string;
  ownerName: string | null;
  type: CallLogType;
  displayName: string | null;
  phoneNumber: string;
  /** Generated column (digits of `phoneNumber`); nullable. */
  phoneDigits: string | null;
  startedAt: string | null;
  answeredAt: string | null;
  endedAt: string | null;
  durationSeconds: number | null;
  cause: string | null;
  createdAt: string;
  sourceType: CallRecordType | null;
  sourceId: string | null;
  sourceLabel: string | null;
  transferKind: 'BLIND' | 'ATTENDED' | null;
  conferenceId: string | null;
  /** Optional, unloaded entity relation; it is not the management extension view. */
  extension?: Readonly<Record<string, unknown>> | null;
}

export type CallLog = StaffUserCallLog;

export interface ListUserCallLogsQuery {
  page?: number;
  limit?: number;
  /** Comma-separated CallLogType values (e.g. `IN_NOANS,IN_BUSY`); build it with `toCallLogTypeParam`. */
  type?: string;
  from?: string;
  to?: string;
  q?: string;
}

/** The only paged Core webphone response: `{ data, meta }`. */
export interface ListUserCallLogsResponse {
  data: StaffUserCallLog[];
  meta: {
    page: number;
    limit: number;
    total: number;
  };
}
