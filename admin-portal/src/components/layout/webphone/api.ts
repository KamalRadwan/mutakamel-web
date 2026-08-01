import { axiosClient } from "@/lib/api/axiosClient";
import type { SuccessResponse } from "@/types/common";
import { asteriskSettingsFromSystemSettings } from "./config";
import type {
  AdminWebphoneConfig,
  ApiSystemSetting,
  AsteriskIntegrationSettings,
  CreateWebphoneCallLogPayload,
  WebphoneCallLog,
} from "./types";

const WEBPHONE_BASE = "/api/admin/core/v1/users/me/webphone";

export async function loadMyWebphoneConfig() {
  const response = await axiosClient.get<
    SuccessResponse<AdminWebphoneConfig>
  >(WEBPHONE_BASE);

  return response.data.data;
}

export async function loadAsteriskSettings(): Promise<AsteriskIntegrationSettings> {
  const response = await axiosClient.get<
    SuccessResponse<ApiSystemSetting[]>
  >(
    "/api/admin/core/v1/system-settings?prefix=asterisk.",
  );

  return asteriskSettingsFromSystemSettings(response.data.data);
}

export async function loadMyWebphoneCallLogs() {
  const response = await axiosClient.get<
    SuccessResponse<WebphoneCallLog[]>
  >(`${WEBPHONE_BASE}/call-logs`);

  return Array.isArray(response.data.data) ? response.data.data : [];
}

export async function createMyWebphoneCallLog(
  payload: CreateWebphoneCallLogPayload,
) {
  const response = await axiosClient.post<
    SuccessResponse<WebphoneCallLog>
  >(`${WEBPHONE_BASE}/call-logs`, payload);

  return response.data.data;
}
