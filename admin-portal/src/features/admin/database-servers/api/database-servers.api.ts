import { axiosClient } from "@/lib/api/axiosClient";
import { SuccessResponse, extractCoreData, extractCoreMeta } from "@/shared/api/core-envelope";
import {
  DatabaseServerView,
  DatabaseServerApplicationBindingView,
  ApplicationCredentialBootstrapReceipt,
  ApplicationCredentialMutationReceipt,
  CreateDatabaseServerDto,
  CheckDatabaseServerConnectivityDto,
  DatabaseServerConnectivityResult,
  UpdateDatabaseServerDto,
  BootstrapDatabaseServerApplicationsDto,
  BootstrapDatabaseServerApplicationDto,
  ApplicationDatabaseCredentialCommandDto,
  DatabaseServerQueryDto,
  DatabaseServerHistoryQueryDto,
  DatabaseServerHistoryView,
  DatabaseServerProvisioningPrincipalBindingView,
  DatabaseServerSystemCredentialMutationReceipt,
  UpdateDatabaseServerSystemPrincipalRotationDto,
} from "../types";

const BASE_URL = "/api/admin/core/v1/database-servers";

type DatabaseServerWireSystemPrincipal = Omit<
  DatabaseServerProvisioningPrincipalBindingView,
  "purpose" | "databasePrincipal"
> & {
  purpose: "PROVISIONING" | "BACKUP";
  databasePrincipal: "mutakamel_provisioner" | "mutakamel_backup";
};

type DatabaseServerWireView = Omit<
  DatabaseServerView,
  "systemPrincipals" | "deletedAt"
> & {
  deletedAt?: string | null;
  systemPrincipals: DatabaseServerWireSystemPrincipal[];
};

function toDatabaseServerView(server: DatabaseServerWireView): DatabaseServerView {
  const systemPrincipals = (server.systemPrincipals ?? []).filter(
    (binding): binding is DatabaseServerProvisioningPrincipalBindingView =>
      binding.purpose === "PROVISIONING" &&
      binding.databasePrincipal === "mutakamel_provisioner",
  );

  return {
    ...server,
    deletedAt: server.deletedAt ?? null,
    systemPrincipals,
  };
}

function toQueryString(query?: object): string {
  if (!query) return "";
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== "") {
      params.set(key, String(value));
    }
  }
  const serialized = params.toString();
  return serialized ? `?${serialized}` : "";
}

function getWithSignal<T>(url: string, signal?: AbortSignal) {
  return signal
    ? axiosClient.get<T>(url, { signal })
    : axiosClient.get<T>(url);
}

export const databaseServersApi = {
  list: async (query?: DatabaseServerQueryDto, signal?: AbortSignal) => {
    const qs = toQueryString(query);
    const response = await getWithSignal<SuccessResponse<DatabaseServerWireView[]>>(`${BASE_URL}${qs}`, signal);
    return {
      data: extractCoreData(response).map(toDatabaseServerView),
      meta: extractCoreMeta(response)
    };
  },

  get: async (id: string, signal?: AbortSignal) => {
    const response = await getWithSignal<SuccessResponse<DatabaseServerWireView>>(`${BASE_URL}/${id}`, signal);
    return toDatabaseServerView(extractCoreData(response));
  },

  getHistory: async (id: string, query?: DatabaseServerHistoryQueryDto, signal?: AbortSignal) => {
    const qs = toQueryString(query);
    const response = await getWithSignal<SuccessResponse<DatabaseServerHistoryView[]>>(`${BASE_URL}/${id}/history${qs}`, signal);
    return extractCoreData(response);
  },

  listApplications: async (id: string, signal?: AbortSignal) => {
    const response = await getWithSignal<SuccessResponse<DatabaseServerApplicationBindingView[]>>(`${BASE_URL}/${id}/applications`, signal);
    return extractCoreData(response);
  },

  create: async (data: CreateDatabaseServerDto, idempotencyKey: string) => {
    const response = await axiosClient.post<SuccessResponse<DatabaseServerWireView>>(
      BASE_URL,
      data,
      { headers: { "x-idempotency-key": idempotencyKey } }
    );
    return toDatabaseServerView(extractCoreData(response));
  },

  checkConnectivity: async (data: CheckDatabaseServerConnectivityDto, idempotencyKey: string) => {
    const response = await axiosClient.post<SuccessResponse<DatabaseServerConnectivityResult>>(
      `${BASE_URL}/check-connectivity`,
      data,
      { headers: { "x-idempotency-key": idempotencyKey } }
    );
    return extractCoreData(response);
  },

  update: async (id: string, data: UpdateDatabaseServerDto, idempotencyKey: string) => {
    const response = await axiosClient.patch<SuccessResponse<DatabaseServerWireView>>(
      `${BASE_URL}/${id}`,
      data,
      { headers: { "x-idempotency-key": idempotencyKey } }
    );
    return toDatabaseServerView(extractCoreData(response));
  },

  drain: async (id: string, idempotencyKey: string) => {
    const response = await axiosClient.post<SuccessResponse<DatabaseServerWireView>>(
      `${BASE_URL}/${id}/drain`,
      {},
      { headers: { "x-idempotency-key": idempotencyKey } }
    );
    return toDatabaseServerView(extractCoreData(response));
  },

  activate: async (id: string, idempotencyKey: string) => {
    const response = await axiosClient.post<SuccessResponse<DatabaseServerWireView>>(
      `${BASE_URL}/${id}/activate`,
      {},
      { headers: { "x-idempotency-key": idempotencyKey } }
    );
    return toDatabaseServerView(extractCoreData(response));
  },

  offline: async (id: string, idempotencyKey: string) => {
    const response = await axiosClient.post<SuccessResponse<DatabaseServerWireView>>(
      `${BASE_URL}/${id}/offline`,
      {},
      { headers: { "x-idempotency-key": idempotencyKey } }
    );
    return toDatabaseServerView(extractCoreData(response));
  },

  delete: async (id: string, idempotencyKey: string) => {
    await axiosClient.delete(`${BASE_URL}/${id}`, {
      headers: { "x-idempotency-key": idempotencyKey }
    });
  },

  destroy: async (id: string, idempotencyKey: string) => {
    await axiosClient.delete(`${BASE_URL}/${id}/destroy`, {
      headers: { "x-idempotency-key": idempotencyKey }
    });
  },

  retryBootstrap: async (id: string, data: BootstrapDatabaseServerApplicationsDto, idempotencyKey: string) => {
    const response = await axiosClient.post<SuccessResponse<DatabaseServerWireView>>(
      `${BASE_URL}/${id}/credential-bootstrap/retry`,
      data,
      { headers: { "x-idempotency-key": idempotencyKey } }
    );
    return toDatabaseServerView(extractCoreData(response));
  },

  updateProvisioningRotationPolicy: async (id: string, data: UpdateDatabaseServerSystemPrincipalRotationDto, idempotencyKey: string) => {
    const response = await axiosClient.patch<SuccessResponse<DatabaseServerProvisioningPrincipalBindingView>>(
      `${BASE_URL}/${id}/system-principals/provisioning/rotation-policy`,
      data,
      { headers: { "x-idempotency-key": idempotencyKey } },
    );
    return extractCoreData(response);
  },

  regenerateProvisioningPrincipal: async (id: string, data: ApplicationDatabaseCredentialCommandDto, idempotencyKey: string) => {
    const response = await axiosClient.post<SuccessResponse<DatabaseServerSystemCredentialMutationReceipt>>(
      `${BASE_URL}/${id}/system-principals/provisioning/credential/regenerate`,
      data,
      { headers: { "x-idempotency-key": idempotencyKey } },
    );
    return extractCoreData(response);
  },

  reconcileProvisioningPrincipal: async (id: string, data: ApplicationDatabaseCredentialCommandDto, idempotencyKey: string) => {
    const response = await axiosClient.post<SuccessResponse<DatabaseServerSystemCredentialMutationReceipt>>(
      `${BASE_URL}/${id}/system-principals/provisioning/credential/reconcile`,
      data,
      { headers: { "x-idempotency-key": idempotencyKey } },
    );
    return extractCoreData(response);
  },

  bootstrapApplication: async (id: string, applicationKey: string, data: BootstrapDatabaseServerApplicationDto, idempotencyKey: string) => {
    const response = await axiosClient.post<SuccessResponse<ApplicationCredentialBootstrapReceipt>>(
      `${BASE_URL}/${id}/applications/${encodeURIComponent(applicationKey)}/bootstrap`,
      data,
      { headers: { "x-idempotency-key": idempotencyKey } }
    );
    return extractCoreData(response);
  },

  regenerateApplication: async (id: string, applicationKey: string, data: ApplicationDatabaseCredentialCommandDto, idempotencyKey: string) => {
    const response = await axiosClient.post<SuccessResponse<ApplicationCredentialMutationReceipt>>(
      `${BASE_URL}/${id}/applications/${encodeURIComponent(applicationKey)}/credential/regenerate`,
      data,
      { headers: { "x-idempotency-key": idempotencyKey } }
    );
    return extractCoreData(response);
  },

  reconcileApplication: async (id: string, applicationKey: string, data: ApplicationDatabaseCredentialCommandDto, idempotencyKey: string) => {
    const response = await axiosClient.post<SuccessResponse<ApplicationCredentialMutationReceipt>>(
      `${BASE_URL}/${id}/applications/${encodeURIComponent(applicationKey)}/credential/reconcile`,
      data,
      { headers: { "x-idempotency-key": idempotencyKey } }
    );
    return extractCoreData(response);
  }
};
