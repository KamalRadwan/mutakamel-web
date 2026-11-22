import { ApiError } from '../../../../core/api/api-errors';
import { fakeApplyUpdates, fakeGetOperation, fakeListUpdates } from './updates.fake';
import {
  ApplyUpdatesBody,
  ApplyUpdatesResponse,
  TenantAvailableUpdate,
  TenantOperationDetail,
  UpdatesPageResult,
  UpdatesQuery,
} from './updates.model';

function assertValidUpdatesPage(result: unknown): UpdatesPageResult {
  if (!result || typeof result !== 'object') {
    throw new ApiError(200, 'API_RESPONSE_INVALID');
  }
  const page = result as Partial<UpdatesPageResult>;
  if (
    !Array.isArray(page.data) ||
    !page.meta ||
    typeof page.meta !== 'object' ||
    typeof page.meta.page !== 'number' ||
    typeof page.meta.limit !== 'number' ||
    typeof page.meta.total !== 'number' ||
    typeof page.meta.totalPages !== 'number'
  ) {
    throw new ApiError(200, 'API_RESPONSE_INVALID');
  }

  const seenKeys = new Set<string>();
  for (const row of page.data as TenantAvailableUpdate[]) {
    if (
      !row ||
      typeof row !== 'object' ||
      typeof row.componentKey !== 'string' ||
      !row.componentKey ||
      !row.current ||
      !row.availableRelease ||
      seenKeys.has(row.componentKey)
    ) {
      throw new ApiError(200, 'API_RESPONSE_INVALID');
    }
    seenKeys.add(row.componentKey);
  }

  return page as UpdatesPageResult;
}

function assertValidApplyResponse(result: unknown): ApplyUpdatesResponse {
  if (!result || typeof result !== 'object') {
    throw new ApiError(200, 'API_RESPONSE_INVALID');
  }
  const res = result as Partial<ApplyUpdatesResponse>;
  if (
    typeof res.replayed !== 'boolean' ||
    !res.operation ||
    typeof res.operation !== 'object' ||
    typeof res.operation.id !== 'string' ||
    typeof res.operation.status !== 'string' ||
    !res.operation.progress ||
    !Array.isArray(res.operation.steps)
  ) {
    throw new ApiError(200, 'API_RESPONSE_INVALID');
  }
  return res as ApplyUpdatesResponse;
}

function assertValidOperationDetail(result: unknown): TenantOperationDetail {
  if (!result || typeof result !== 'object') {
    throw new ApiError(200, 'API_RESPONSE_INVALID');
  }
  const op = result as Partial<TenantOperationDetail>;
  if (
    typeof op.id !== 'string' ||
    typeof op.status !== 'string' ||
    !op.progress ||
    typeof op.progress.totalSteps !== 'number' ||
    !Array.isArray(op.steps)
  ) {
    throw new ApiError(200, 'API_RESPONSE_INVALID');
  }
  return op as TenantOperationDetail;
}

// GET  /api/v1/core/tenant/provisioning/updates [workspace.read tenant-wide]
export async function listUpdates(query: UpdatesQuery): Promise<UpdatesPageResult> {
  const res = await fakeListUpdates(query);
  return assertValidUpdatesPage(res);
}

// POST /api/v1/core/tenant/provisioning/updates/apply [workspace.manage tenant-wide] (x-idempotency-key) -> 202
export async function applyUpdates(
  body: ApplyUpdatesBody,
  idempotencyKey: string,
): Promise<ApplyUpdatesResponse> {
  const res = await fakeApplyUpdates(body, idempotencyKey);
  return assertValidApplyResponse(res);
}

// GET  /api/v1/core/tenant/provisioning/operations/:operationId [workspace.read tenant-wide]
export async function getOperation(operationId: string): Promise<TenantOperationDetail> {
  const res = await fakeGetOperation(operationId);
  return assertValidOperationDetail(res);
}
