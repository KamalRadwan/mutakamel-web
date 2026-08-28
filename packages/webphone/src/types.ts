export type AsteriskIntegrationSettings = {
  enabled?: boolean;
  websocketUrl?: string | null;
  sipDomain?: string | null;
  realm?: string | null;
  outboundProxy?: string | null;
  defaultCallerId?: string | null;
  fromDomain?: string | null;
  registrarServer?: string | null;
  contactUri?: string | null;
  registerExpires?: number | null;
  sessionTimers?: boolean;
  traceSip?: boolean;
  allowInvalidTlsCertificate?: boolean;
  stunServers?: string[];
  turnServers?: Array<Record<string, unknown>>;
  iceServers?: Array<Record<string, unknown>>;
  extra?: Record<string, unknown>;
  /**
   * Backup WebSocket transport for SIP failover, from
   * `asterisk.websocket_url_secondary`. JsSIP tries the primary socket
   * first and only falls back to this one on connection loss.
   */
  secondaryWebsocketUrl?: string;
  /**
   * WebRTC ICE transport policy from `asterisk.ice_transport_policy`.
   * 'relay' forces all media through a configured TURN server instead of
   * attempting a direct/STUN path.
   */
  iceTransportPolicy?: 'all' | 'relay';
};

export type AdminWebphoneConfig = {
  enabled: boolean;
  extension?: string | null;
  sipUsername?: string | null;
  sipPassword?: string | null;
  displayName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  outboundCallerId?: string | null;
  transport?: "ws" | "wss";
  passwordConfigured?: boolean;
  /**
   * Ephemeral TURN credentials minted server-side (coturn REST
   * convention), present only on the self-service webphone config
   * response and only when `asterisk.turn_rest_enabled` is configured.
   */
  turnCredentials?: {
    enabled: boolean;
    iceServers: Array<{ urls: string[]; username: string; credential: string }>;
    expiresAt: string | null;
  };
};

export type WebphoneCallLogType = "IN_ANS" | "IN_NOANS" | "OUT";

export type WebphoneCallLog = {
  id?: string;
  type: WebphoneCallLogType;
  displayName?: string | null;
  phoneNumber: string;
  startedAt?: string | null;
  answeredAt?: string | null;
  endedAt?: string | null;
  durationSeconds?: number | null;
  cause?: string | null;
  createdAt?: string | null;
};

export type CreateWebphoneCallLogPayload = Omit<
  WebphoneCallLog,
  "id" | "createdAt"
>;

export type WebphoneConnectionState =
  | "idle"
  | "loading"
  | "ready"
  | "connecting"
  | "registered"
  | "offline"
  | "error";

export type WebphoneStatusCode =
  | "idle"
  | "loadingPhone"
  | "disabled"
  | "ready"
  | "notConfigured"
  | "unavailable"
  | "connecting"
  | "socketConnected"
  | "registering"
  | "registered"
  | "registrationFailed"
  | "disconnected"
  | "connectFailed"
  | "incomingCall"
  | "calling"
  | "ringing"
  | "startingCall"
  | "callEnded"
  | "declined"
  | "callFailed"
  | "inCall";

export type WebphoneStatus = {
  code: WebphoneStatusCode;
  /** Raw technical detail (SIP cause, error message) — not localized. */
  detail?: string;
};

export type WebphoneMediaNoticeCode =
  | "requiresHttps"
  | "unavailable"
  | "stopped"
  | "muted"
  | "clickToAllow"
  | "permissionDenied";

export type WebphoneCallState =
  | "idle"
  | "calling"
  | "incoming"
  | "ringing"
  | "active"
  | "ended"
  | "failed";

export type WebphoneTab = "phone" | "log";

export type ActiveCallContext = {
  direction: "incoming" | "outgoing";
  number: string;
  displayName?: string | null;
  startedAt: string;
  answeredAt?: string | null;
  endedAt?: string | null;
  durationSeconds?: number | null;
  cause?: string | null;
};

export type ApiSystemSetting = {
  key: string;
  value: unknown;
};
