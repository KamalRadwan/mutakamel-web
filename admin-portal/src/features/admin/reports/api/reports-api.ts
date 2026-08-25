import { axiosClient } from "@/lib/api/axiosClient";
import {
  readBillingReport,
  readOverviewReport,
  readProvisioningReport,
  readServersReport,
  readTenantReport,
} from "../model/report-readers";
import type {
  ProvisioningReportQuery,
  ReportWindowQuery,
  TenantReportQuery,
} from "../types/reports";

const BASE_URL = "/api/admin/core/v1/reports";

export const reportsApi = {
  overview: async (query: ReportWindowQuery = {}, signal?: AbortSignal) => {
    const response = await axiosClient.get<unknown>(
      `${BASE_URL}/overview${serializeQuery(query)}`,
      requestConfig(signal),
    );
    return readOverviewReport(response.data);
  },

  tenants: async (query: TenantReportQuery = {}, signal?: AbortSignal) => {
    const response = await axiosClient.get<unknown>(
      `${BASE_URL}/tenants${serializeQuery(query)}`,
      requestConfig(signal),
    );
    return readTenantReport(response.data);
  },

  servers: async (signal?: AbortSignal) => {
    const response = await axiosClient.get<unknown>(
      `${BASE_URL}/servers`,
      requestConfig(signal),
    );
    return readServersReport(response.data);
  },

  billing: async (query: ReportWindowQuery = {}, signal?: AbortSignal) => {
    const response = await axiosClient.get<unknown>(
      `${BASE_URL}/billing${serializeQuery(query)}`,
      requestConfig(signal),
    );
    return readBillingReport(response.data);
  },

  provisioning: async (
    query: ProvisioningReportQuery = {},
    signal?: AbortSignal,
  ) => {
    const response = await axiosClient.get<unknown>(
      `${BASE_URL}/provisioning${serializeQuery(query)}`,
      requestConfig(signal),
    );
    return readProvisioningReport(response.data);
  },
};

export function serializeQuery(query: object): string {
  const parameters = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== "") {
      parameters.set(key, String(value));
    }
  }
  const serialized = parameters.toString();
  return serialized ? `?${serialized}` : "";
}

function requestConfig(signal?: AbortSignal) {
  return {
    cache: "no-store" as const,
    ...(signal ? { signal } : {}),
  };
}
