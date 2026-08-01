import type {
  AdminWebphoneConfig,
  AsteriskIntegrationSettings,
  CreateWebphoneCallLogPayload,
  WebphoneCallLog,
} from "./types";

export async function loadMyWebphoneConfig(): Promise<AdminWebphoneConfig> {
  return {
    enabled: true,
    extension: "101",
    sipUsername: "101",
    displayName: "Kamal Radwan",
    transport: "wss",
    passwordConfigured: true,
  };
}

export async function loadAsteriskSettings(): Promise<AsteriskIntegrationSettings> {
  return {
    enabled: true,
    websocketUrl: "wss://pbx.mutakamel.ai:8089/ws",
    sipDomain: "pbx.mutakamel.ai",
    realm: "pbx.mutakamel.ai",
    stunServers: ["stun:stun.l.google.com:19302"],
  };
}

export async function loadMyWebphoneCallLogs(): Promise<WebphoneCallLog[]> {
  return [
    {
      id: "log-1",
      type: "IN_ANS",
      displayName: "Sara Ahmed",
      phoneNumber: "+966501234567",
      startedAt: new Date(Date.now() - 3600000).toISOString(),
      durationSeconds: 145,
    },
    {
      id: "log-2",
      type: "OUT",
      displayName: "Mohamed Ali",
      phoneNumber: "+966559876543",
      startedAt: new Date(Date.now() - 7200000).toISOString(),
      durationSeconds: 62,
    },
  ];
}

export async function createMyWebphoneCallLog(
  payload: CreateWebphoneCallLogPayload,
): Promise<WebphoneCallLog> {
  return {
    id: `log-${Date.now()}`,
    ...payload,
    createdAt: new Date().toISOString(),
  };
}
