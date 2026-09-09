import { axiosClient } from "@/lib/api/axiosClient";
import { contractFailure, readCommercialResponse, uuid7 } from "@/shared/api/commercial-contract";
import { readCommercialApplyReceipt, readCommercialOperationReceipt, readCommercialPreview, readOriginalCommercialReceipt, type CommercialPreview } from "./commercial-change-readers";
import { assertCommercialPreviewMatchesRequest, readCommercialPreparationRequest, readCommercialPreviewRequest, readCommercialRecoveryRequest,
  type CommercialPreparationRequest, type CommercialPreviewRequest, type CommercialRecoveryRequest } from "./commercial-change-request";

const base = (id: string) => `/api/admin/core/v1/subscriptions/${uuid7(id)}`;
const config = (key: string) => ({ headers: { "x-idempotency-key": uuid7(key) }, replayAfterRefresh: true });

/** Canonical SQL commands preserve the exact key and body through shared auth refresh. */
export const commercialChangeApi = {
  async prepare(subscriptionId: string, input: CommercialPreparationRequest, key: string) {
    const response = await axiosClient.post<unknown>(`${base(subscriptionId)}/preparations`, readCommercialPreparationRequest(input), config(key));
    return readCommercialResponse(response, value => {
      if (response.status !== 202) contractFailure();
      return readCommercialOperationReceipt(value);
    });
  },
  async preview(subscriptionId: string, input: CommercialPreviewRequest, key: string) {
    const body = readCommercialPreviewRequest(input);
    const response = await axiosClient.post<unknown>(`${base(subscriptionId)}/plan-change-previews`, body, config(key));
    return readCommercialResponse(response, value => {
      if (response.status !== 201) contractFailure();
      return assertCommercialPreviewMatchesRequest(readCommercialPreview(value), subscriptionId, body);
    }, false, 4 * 1024 * 1024);
  },
  async apply(subscriptionId: string, reviewed: CommercialPreview, key: string) {
    if (reviewed.subscriptionId !== uuid7(subscriptionId)) contractFailure();
    const response = await axiosClient.post<unknown>(`${base(subscriptionId)}/plan-change-previews/${uuid7(reviewed.previewId)}/apply`, {}, config(key));
    return readCommercialResponse(response, value => {
      if (response.status !== 200) contractFailure();
      return readCommercialApplyReceipt(value, reviewed);
    }, false, 4 * 1024 * 1024);
  },
  async recover(scope: { tenantId: string; operationId: string }, input: CommercialRecoveryRequest, key: string) {
    const response = await axiosClient.post<unknown>(`/api/admin/core/v1/tenants/${uuid7(scope.tenantId)}/subscription/operations/${uuid7(scope.operationId)}/recovery`, readCommercialRecoveryRequest(input), config(key));
    return readCommercialResponse(response, value => {
      if (response.status !== 202) contractFailure();
      const result = readCommercialOperationReceipt(value);
      if (result.operationId !== scope.operationId) contractFailure();
      return result;
    });
  },
  async getOperation(scope: { tenantId: string; operationId: string; preparationId?: string }, signal?: AbortSignal) {
    const url = `/api/admin/core/v1/tenants/${uuid7(scope.tenantId)}/subscription/operations/${uuid7(scope.operationId)}`;
    const response = await axiosClient.get<unknown>(url, { signal, cache: "no-store" });
    return readCommercialResponse(response, value => {
      if (response.status !== 200) contractFailure();
      const operation = readCommercialOperationReceipt(value);
      // A requested preview-operation alias may resolve to the original preparation.
      if (scope.preparationId !== undefined && operation.operationId !== uuid7(scope.preparationId)) contractFailure();
      return operation;
    }, false, 4 * 1024 * 1024);
  },
  async getReceipt(scope: { subscriptionId: string; previewId: string; preparationId?: string }, signal?: AbortSignal) {
    const url = `/api/admin/core/v1/subscriptions/${uuid7(scope.subscriptionId)}/plan-change-previews/${uuid7(scope.previewId)}/receipt`;
    const response = await axiosClient.get<unknown>(url, { signal, cache: "no-store" });
    // Client envelope ceiling is separate from the owner's 64 KiB data bound.
    return readCommercialResponse(response, value => {
      if (response.status !== 200) contractFailure();
      return readOriginalCommercialReceipt(value, scope);
    }, false, 4 * 1024 * 1024);
  },
};
