import { axiosClient } from "@/lib/api/axiosClient";
import type { SuccessResponse } from "@/types/common";
import type {
  StorageServerView,
  StorageServerList,
  CreateStorageServerDto,
  UpdateStorageServerDto,
} from "@/types/storage-server";

export interface ListStorageServersParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  sortBy?: string;
  sortDir?: string;
}

export async function listStorageServers(params: ListStorageServersParams = {}) {
  const query = new URLSearchParams();
  if (params.page) query.append("page", params.page.toString());
  if (params.limit) query.append("limit", params.limit.toString());
  if (params.search) query.append("search", params.search);
  if (params.status && params.status !== "ALL") query.append("status", params.status);
  if (params.sortBy) query.append("sortBy", params.sortBy);
  if (params.sortDir) query.append("sortDir", params.sortDir);

  const res = await axiosClient.get<SuccessResponse<StorageServerList>>(
    `/api/admin/core/v1/storage-servers?${query.toString()}`
  );
  return res.data.data;
}

export async function getStorageServer(id: string) {
  const res = await axiosClient.get<SuccessResponse<StorageServerView>>(
    `/api/admin/core/v1/storage-servers/${encodeURIComponent(id)}`
  );
  return res.data.data;
}

export async function createStorageServer(dto: CreateStorageServerDto) {
  const res = await axiosClient.post<SuccessResponse<StorageServerView>>(
    "/api/admin/core/v1/storage-servers",
    dto
  );
  return res.data.data;
}

export async function updateStorageServer(id: string, dto: UpdateStorageServerDto) {
  const res = await axiosClient.patch<SuccessResponse<StorageServerView>>(
    `/api/admin/core/v1/storage-servers/${encodeURIComponent(id)}`,
    dto
  );
  return res.data.data;
}

export async function activateStorageServer(id: string) {
  const res = await axiosClient.post<SuccessResponse<StorageServerView>>(
    `/api/admin/core/v1/storage-servers/${encodeURIComponent(id)}/activate`,
    {}
  );
  return res.data.data;
}

export async function offlineStorageServer(id: string) {
  const res = await axiosClient.post<SuccessResponse<StorageServerView>>(
    `/api/admin/core/v1/storage-servers/${encodeURIComponent(id)}/offline`,
    {}
  );
  return res.data.data;
}

export async function deleteStorageServer(id: string) {
  const res = await axiosClient.delete(
    `/api/admin/core/v1/storage-servers/${encodeURIComponent(id)}`
  );
  return res;
}
