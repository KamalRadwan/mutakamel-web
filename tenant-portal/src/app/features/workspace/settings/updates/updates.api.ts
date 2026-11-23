import { ApiError } from '../../../../core/api/api-errors';
import { inject, Service } from '@angular/core';
import { CoreHttp } from '../../../../core/api/core-http';
import {
  ApplyUpdatesBody,
  ApplyUpdatesResponse,
  TenantAvailableUpdate,
  TenantOperationDetail,
  UpdatesPageResult,
  UpdatesQuery,
  OperationDetailResponse,
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
@Service()
export class UpdatesApi {
  private readonly http = inject(CoreHttp);

  async listUpdates(query: UpdatesQuery): Promise<UpdatesPageResult> {
    const res = await this.http.readPage<TenantAvailableUpdate>(UPDATES_PATH, { ...query });
    return assertValidUpdatesPage(res);
  }

  async applyUpdates(body: ApplyUpdatesBody, idempotencyKey: string): Promise<ApplyUpdatesResponse> {
    const res = await this.http.write<{ replayed: boolean; operation: OperationDetailResponse }>(
      'POST', `${UPDATES_PATH}/apply`, body, { key: idempotencyKey },
    );
    const result = assertValidApplyResponse(res.data);
    return { replayed: result.replayed, operation: adaptOperation(res.data.operation) };
  }

  async getOperation(operationId: string): Promise<TenantOperationDetail> {
    const res = await this.http.read<OperationDetailResponse>(
      `${PROVISIONING_PATH}/operations/${encodeURIComponent(operationId)}`,
    );
    return adaptOperation(res);
  }
}

const PROVISIONING_PATH = '/api/v1/core/tenant/provisioning';
const UPDATES_PATH = `${PROVISIONING_PATH}/updates`;

/** Project nullable backend evidence into the existing display model. */
function adaptOperation(response: OperationDetailResponse): TenantOperationDetail {
  assertValidOperationDetail(response);
  return {
    ...response,
    safeError: response.safeError ? {
      code: response.safeError.code ?? '', message: response.safeError.message ?? '',
    } : null,
    steps: response.steps.map((step) => ({
      ...step,
      componentKey: step.componentKey ?? '',
      safeError: step.safeError ? {
        code: step.safeError.code ?? '', message: step.safeError.message ?? '',
      } : null,
    })),
  };
}

// Compatibility exports for existing consumers; screens inject UpdatesApi.
export function listUpdates(query: UpdatesQuery): Promise<UpdatesPageResult> {
  return inject(UpdatesApi).listUpdates(query);
}

// POST /api/v1/core/tenant/provisioning/updates/apply [workspace.manage tenant-wide] (x-idempotency-key) -> 202
export function applyUpdates(
  body: ApplyUpdatesBody,
  idempotencyKey: string,
): Promise<ApplyUpdatesResponse> {
  return inject(UpdatesApi).applyUpdates(body, idempotencyKey);
}

// GET  /api/v1/core/tenant/provisioning/operations/:operationId [workspace.read tenant-wide]
export function getOperation(operationId: string): Promise<TenantOperationDetail> {
  return inject(UpdatesApi).getOperation(operationId);
}
