import { ApiError } from '../api/api-errors';

export type CallLogType = 'IN_ANS' | 'IN_NOANS' | 'IN_BUSY' | 'OUT_ANS' | 'OUT_NOANS' | 'OUT_BUSY' | 'OUT';
export type LiveCallLogType = Exclude<CallLogType, 'OUT'>;
export type CallSourceType = 'LEAD' | 'CUSTOMER_PROFILE' | 'PARTY' | 'OPPORTUNITY';
export type PhoneLookupMatchType = 'LEAD' | 'CUSTOMER_PROFILE' | 'PARTY';
export type CallTransferKind = 'BLIND' | 'ATTENDED';

export type PhoneDisabledReason = 'NO_EXTENSION' | 'DISABLED' | 'NO_SERVER' | 'OVER_CAPACITY';

export interface PhoneTurnIceServer {
  urls: string[];
  username: string;
  credential: string;
}

export interface PhoneTurnCredentials {
  enabled: boolean;
  iceServers: PhoneTurnIceServer[];
  expiresAt: string | null;
}

export interface PhoneServerIceServer {
  kind: 'STUN' | 'TURN';
  urls: string[];
  username?: string;
  credential?: string;
}

export interface PhoneServer {
  id: string;
  name: string;
  priority: number;
  sipDomain: string;
  websocketUrl: string;
  realm: string | null;
  outboundProxy: string | null;
  fromDomain: string | null;
  registrarServer: string | null;
  contactUri: string | null;
  registerExpires: number;
  defaultCallerId: string | null;
  iceTransportPolicy: 'all' | 'relay';
  traceSip: boolean;
  sessionTimers: boolean;
  allowInvalidTlsCertificate: boolean;
  timeoutSeconds: number;
  maxRetries: number;
  iceServers: PhoneServerIceServer[];
}

export interface PhoneMe {
  enabled: boolean;
  reason: PhoneDisabledReason | null;
  extension: string | null;
  sipUsername: string | null;
  sipPassword: string | null;
  displayName: string | null;
  outboundCallerId: string | null;
  passwordConfigured: boolean;
  servers: PhoneServer[];
  turnCredentials: PhoneTurnCredentials;
}

/**
 * Raw saved row returned by POST /me/call-logs (the entity as stored).
 * It carries no `ownerName`; `phoneDigits` is a generated, nullable column that the save response may omit.
 */
export interface CallLogRecord {
  id: string;
  tenantId: string | null;
  extensionId: string | null;
  ownerId: string;
  type: CallLogType;
  displayName: string | null;
  phoneNumber: string;
  phoneDigits?: string | null;
  startedAt: string | null;
  answeredAt: string | null;
  endedAt: string | null;
  durationSeconds: number | null;
  cause: string | null;
  createdAt: string;
  sourceType: CallSourceType | null;
  sourceId: string | null;
  sourceLabel: string | null;
  transferKind: CallTransferKind | null;
  conferenceId: string | null;
}

/** Row returned by GET /me/call-logs: the stored row plus the owner's display name; `phoneDigits` is a generated, nullable column. */
export interface CallLog extends CallLogRecord {
  ownerName: string | null;
  phoneDigits: string | null;
}

export interface CreateCallLogInput {
  type: LiveCallLogType;
  displayName: string | null;
  phoneNumber: string;
  startedAt: string | null;
  answeredAt: string | null;
  endedAt: string | null;
  durationSeconds: number | null;
  cause: string | null;
  sourceType: CallSourceType | null;
  sourceId: string | null;
  sourceLabel: string | null;
  transferKind?: CallTransferKind | null;
  conferenceId?: string | null;
}

export interface ListCallLogsQuery {
  page?: number;
  limit?: number;
  /** Comma-separated CallLogType values (e.g. `IN_NOANS,IN_BUSY`); build it with `toCallLogTypeParam`. */
  type?: string;
  from?: string;
  to?: string;
  q?: string;
}

/** Joins call types into the comma list the `type` query parameter accepts; `undefined` when there is nothing to filter. */
export function toCallLogTypeParam(types: readonly CallLogType[] | null | undefined): string | undefined {
  return types && types.length > 0 ? types.join(',') : undefined;
}

export interface ListCallLogsResponse {
  data: CallLog[];
  meta: {
    page: number;
    limit: number;
    total: number;
  };
}

export interface PhoneLookupMatch {
  type: PhoneLookupMatchType;
  id: string;
  name: string;
}

export interface PhoneLookupResponse {
  match: PhoneLookupMatch | null;
  count: number;
}

export type ConnectionState = 'idle' | 'loading' | 'ready' | 'connecting' | 'registered' | 'offline' | 'error';

export type PhoneStatusCode =
  | 'idle'
  | 'loadingPhone'
  | 'disabled'
  | 'ready'
  | 'notConfigured'
  | 'unavailable'
  | 'connecting'
  | 'socketConnected'
  | 'registering'
  | 'registered'
  | 'registrationFailed'
  | 'failingOver'
  | 'disconnected'
  | 'connectFailed'
  | 'incomingCall'
  | 'calling'
  | 'ringing'
  | 'startingCall'
  | 'callEnded'
  | 'declined'
  | 'callFailed'
  | 'transferring'
  | 'transferFailed'
  | 'inCall';

export type CallState = 'idle' | 'calling' | 'ringing' | 'incoming' | 'active' | 'ended' | 'failed';
export type LegRole = 'primary' | 'consult' | 'party';
export type CallMode = 'single' | 'consult' | 'conference';
export type PhoneTab = 'phone' | 'calls' | 'settings';

export type EndReason =
  | 'ended'
  | 'declined'
  | 'busy'
  | 'noAnswer'
  | 'failed'
  | 'transferred'
  | 'dropped'
  | 'conferenceEnded'
  | 'tabClosed';

export interface CallSource {
  type: CallSourceType;
  id: string;
  label: string;
}

export interface CallLeg {
  id: string;
  role: LegRole;
  direction: 'incoming' | 'outgoing';
  number: string;
  displayName: string | null;
  source: CallSource | null;
  state: CallState;
  held: boolean;
  startedAt: string;
  answeredAt: string | null;
}

export interface Quality {
  level: 'measuring' | 'good' | 'fair' | 'poor';
  lossPct: number;
  jitterMs: number;
  rttMs: number;
  mos: number;
}

export type MediaNotice =
  | 'requiresHttps'
  | 'unavailable'
  | 'permissionDenied'
  | 'noMicrophone'
  | 'stopped'
  | 'muted'
  | 'clickToAllow'
  | 'speakerUnavailable';

export type PhoneBlock =
  | 'loading'
  | 'notConfigured'
  | 'connecting'
  | 'registrationFailed'
  | 'offline'
  | 'requiresHttps'
  | 'unsupported'
  | 'micBlocked'
  | 'noMicrophone'
  | 'paused'
  | PhoneMeBlock
  | null;

export interface EndedInfo {
  name: string | null;
  number: string;
  reason: EndReason;
  durationSeconds: number;
  source: CallSource | null;
  logged: boolean;
  transferredTo: string | null;
}

export interface PhoneStatus {
  code: PhoneStatusCode;
  detail?: string;
}

export interface PhoneServerInfo {
  index: number;
  count: number;
  name: string;
  attempt: number;
}

export interface PhoneIdentity {
  displayName: string;
  extension: string;
}

/** `simulated`: dev-only synthetic microphone stands in for a real one (shown as "Simulated" in the devices view). */
export type PhoneMicPermission = 'granted' | 'simulated' | 'denied' | 'prompt' | 'unknown';
export type PhoneNotifyPermission = 'granted' | 'denied' | 'default' | 'unsupported';

export interface PhoneDevicesInfo {
  inputs: MediaDeviceInfo[];
  outputs: MediaDeviceInfo[];
  canChooseOutput: boolean;
}

/** Structured-cloneable snapshot published by the leader tab on `phone.state`. */
export interface PhoneSyncedState {
  visible: boolean;
  paused: boolean;
  configured: boolean;
  connection: ConnectionState;
  status: PhoneStatus;
  server: PhoneServerInfo;
  block: PhoneBlock;
  identity: PhoneIdentity;
  legs: CallLeg[];
  mode: CallMode;
  focusedLegId: string | null;
  call: CallState;
  timer: number;
  muted: boolean;
  speakerMuted: boolean;
  quality: Quality | null;
  ringing: CallLeg | null;
  ringSilenced: boolean;
  ended: EndedInfo | null;
  sentTones: string;
  busy: boolean;
  canAnswerHere: boolean;
  missedCount: number;
  mediaNotice: MediaNotice | null;
  micPermission: PhoneMicPermission;
  notifyPermission: PhoneNotifyPermission;
}

/** Structured-cloneable command sent from a follower tab to the leader via `phone.command`. */
export interface PhoneCommand {
  name: string;
  args: unknown[];
}

/** Structured-cloneable payload broadcast on `phone.lost` when a busy leader closes. */
export interface PhoneLostPayload {
  lossId: string;
  name: string | null;
  number: string;
  durationSeconds: number | null;
}

/** Compatibility error for test fixtures; live transport errors use the shared ApiError. */
export class PhoneApiError extends ApiError {
  constructor(
    status: number,
    code: string,
    details?: Record<string, unknown>,
  ) {
    super(status, code, details);
    this.name = 'PhoneApiError';
  }
}

/**
 * What the phone does with a failed `GET /me`, decided by the service error code (never by HTTP status alone).
 * - `hide`: the tenant has no working web phone yet (`WEBPHONE_MODULE_NOT_PURCHASED` 403,
 *   `WEBPHONE_PROVISIONING_PENDING` 409).
 * - `block`: the phone exists but this request was refused and the user can retry (`WEBPHONE_MODULE_INACTIVE` 403:
 *   subscription suspended, which the backend guard sends only for writes, so a read seeing it is unexpected;
 *   `WEBPHONE_SCOPE_MISMATCH` 403: the request's workspace does not match the active tenant context).
 * - `error`: anything else (network, 5xx, unknown or uncoded 403/409) follows the generic failure path.
 */
export type PhoneMeErrorAction = 'hide' | 'block' | 'error';

const ME_ERROR_ACTIONS = new Map<string, Exclude<PhoneMeErrorAction, 'error'>>([
  ['WEBPHONE_MODULE_NOT_PURCHASED', 'hide'],
  ['WEBPHONE_PROVISIONING_PENDING', 'hide'],
  ['WEBPHONE_MODULE_INACTIVE', 'block'],
  ['WEBPHONE_SCOPE_MISMATCH', 'block'],
]);

/** Maps a `GET /me` failure to the phone's reaction by its service `errorCode`. */
export function classifyMeError(error: unknown): PhoneMeErrorAction {
  if (!(error instanceof ApiError)) return 'error';
  return ME_ERROR_ACTIONS.get(error.code) ?? 'error';
}

/**
 * The blocked state a `block` failure shows: `suspended` (`WEBPHONE_MODULE_INACTIVE`, ask an administrator to renew)
 * or `scopeMismatch` (`WEBPHONE_SCOPE_MISMATCH`, the page holds another workspace session and must reload).
 */
export type PhoneMeBlock = 'suspended' | 'scopeMismatch';

const ME_BLOCK_STATES = new Map<string, PhoneMeBlock>([
  ['WEBPHONE_MODULE_INACTIVE', 'suspended'],
  ['WEBPHONE_SCOPE_MISMATCH', 'scopeMismatch'],
]);

/** The blocked state for a `GET /me` failure that `classifyMeError` maps to `block`; null for any other failure. */
export function meErrorBlock(error: unknown): PhoneMeBlock | null {
  if (!(error instanceof ApiError)) return null;
  return ME_BLOCK_STATES.get(error.code) ?? null;
}

const MAX_CALL_DURATION_SECONDS = 86_400;
const MAX_CAUSE_LENGTH = 120;
const BUSY_CAUSE_RE = /busy|rejected|decline/i;

/** Maps call direction, answer state, and SIP cause to a live server CallLogType (never legacy `OUT`). */
export function resolveCallLogType(
  direction: 'incoming' | 'outgoing',
  answered: boolean,
  cause?: string | null,
): LiveCallLogType {
  const prefix = direction === 'incoming' ? 'IN' : 'OUT';
  if (answered) return `${prefix}_ANS`;
  if (cause && BUSY_CAUSE_RE.test(cause)) return `${prefix}_BUSY`;
  return `${prefix}_NOANS`;
}

/** Computes answered call duration in seconds, clamped to 0..86400, or null when never answered. */
export function clampCallDuration(answeredAt: string | null, endedAtMs = Date.now()): number | null {
  if (!answeredAt) return null;
  const startMs = Date.parse(answeredAt);
  if (Number.isNaN(startMs)) return 0;
  const elapsed = Math.floor((endedAtMs - startMs) / 1000);
  return Math.max(0, Math.min(MAX_CALL_DURATION_SECONDS, elapsed));
}

/** Formats a SIP cause string as `code` or `code: detail`, truncated to 120 characters. */
export function formatCallCause(code: string | number | null | undefined, detail?: string | null): string | null {
  const cleanCode = code === null || code === undefined ? '' : String(code).trim();
  const cleanDetail = detail?.trim() ?? '';
  if (!cleanCode && !cleanDetail) return null;
  const raw = cleanCode && cleanDetail ? `${cleanCode}: ${cleanDetail}` : cleanCode || cleanDetail;
  return raw.slice(0, MAX_CAUSE_LENGTH);
}
