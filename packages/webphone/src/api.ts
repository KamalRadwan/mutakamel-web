import type { WebphoneHttpClient } from "./http";
import type {
  CreateWebphoneCallLogPayload,
  WebphoneCallLog,
  WebphoneMe,
} from "./types";

type WebphoneEnvelope<T> = { data: T };

export type WebphoneApi = {
  loadMe(): Promise<WebphoneMe>;
  loadCallLogs(): Promise<WebphoneCallLog[]>;
  createCallLog(payload: CreateWebphoneCallLogPayload): Promise<WebphoneCallLog>;
};

/**
 * Binds the WebPhone routes to one portal's base path and HTTP client, e.g.
 * `/api/admin/webphone/v1` or `/api/tenant/webphone/v1`.
 */
export function createWebphoneApi(
  basePath: string,
  http: WebphoneHttpClient,
): WebphoneApi {
  return {
    async loadMe() {
      const response = await http.get<WebphoneEnvelope<WebphoneMe>>(
        `${basePath}/me`,
      );

      return response.data.data;
    },

    async loadCallLogs() {
      const response = await http.get<WebphoneEnvelope<WebphoneCallLog[]>>(
        `${basePath}/me/call-logs`,
      );

      return Array.isArray(response.data.data) ? response.data.data : [];
    },

    async createCallLog(payload) {
      const response = await http.post<WebphoneEnvelope<WebphoneCallLog>>(
        `${basePath}/me/call-logs`,
        payload,
        {
          skipAutoIdempotency: true,
          nonReplayable: true,
          cache: "no-store",
        },
      );

      return response.data.data;
    },
  };
}
