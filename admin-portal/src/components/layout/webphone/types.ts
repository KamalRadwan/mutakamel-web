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
