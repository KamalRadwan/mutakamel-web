import { newTemplateIdempotencyKey } from '../templates.api';
import {
  fakeApplyFunctionToDrafts,
  fakeArchiveFunction,
  fakeCheckFunctionImpact,
  fakeCreateFunction,
  fakeGetFunction,
  fakeGetFunctionEditorContext,
  fakeGetFunctionVersion,
  fakeListFunctionUsage,
  fakeListFunctionVersions,
  fakeListFunctions,
  fakePatchFunction,
  fakePublishFunction,
  fakeRestoreFunction,
  fakeValidateFunction,
} from './functions.fake';
import type {
  ApplyFunctionToDraftsRequestDto,
  ApplyFunctionToDraftsResponseDto,
  ArchiveOrRestoreFunctionRequestDto,
  CreateFunctionRequestDto,
  FunctionCursorPage,
  FunctionDetailDto,
  FunctionEditorContextRequestDto,
  FunctionEditorContextResponseDto,
  FunctionImpactRequestDto,
  FunctionImpactResponseDto,
  FunctionSummaryDto,
  FunctionUsageItemDto,
  FunctionUsageQuery,
  FunctionVersionDetailDto,
  FunctionVersionSummaryDto,
  FunctionVersionsQuery,
  FunctionsListQuery,
  PatchFunctionRequestDto,
  PublishFunctionRequestDto,
  ValidateFunctionRequestDto,
  ValidateFunctionResponseDto,
} from './functions.model';

export { TemplateApiError, newTemplateIdempotencyKey } from '../templates.api';
export * from './functions.model';

/** GET /api/tenant/core/v1/templates/functions */
export function listFunctions(query: FunctionsListQuery = {}): Promise<FunctionCursorPage<FunctionSummaryDto>> {
  return fakeListFunctions(query);
}

/**
 * POST /api/tenant/core/v1/templates/functions/editor-context (read-like, 200, no idempotency key).
 * Requires templates.read + templates.update + templates.functions.read. Returns a source-bound
 * context pinned to the persisted draft revision/checksum; it expires 30 seconds after issuedAt.
 */
export function getFunctionEditorContext(
  body: FunctionEditorContextRequestDto,
): Promise<FunctionEditorContextResponseDto> {
  return fakeGetFunctionEditorContext(body);
}

/** POST /api/tenant/core/v1/templates/functions (x-idempotency-key) */
export function createFunction(
  body: CreateFunctionRequestDto,
  idempotencyKey = newTemplateIdempotencyKey(),
): Promise<FunctionDetailDto> {
  return fakeCreateFunction(body, idempotencyKey);
}

/** GET /api/tenant/core/v1/templates/functions/:id */
export function getFunction(functionId: string): Promise<FunctionDetailDto> {
  return fakeGetFunction(functionId);
}

/** PATCH /api/tenant/core/v1/templates/functions/:id (If-Match, x-idempotency-key) */
export function patchFunction(
  functionId: string,
  body: PatchFunctionRequestDto,
  ifMatch: string,
  idempotencyKey = newTemplateIdempotencyKey(),
): Promise<FunctionDetailDto> {
  return fakePatchFunction(functionId, body, ifMatch, idempotencyKey);
}

/** POST /api/tenant/core/v1/templates/functions/:id/validate (If-Match, x-idempotency-key) */
export function validateFunction(
  functionId: string,
  body: ValidateFunctionRequestDto,
  ifMatch: string,
  _idempotencyKey = newTemplateIdempotencyKey(),
): Promise<ValidateFunctionResponseDto> {
  return fakeValidateFunction(functionId, body, ifMatch);
}

/** POST /api/tenant/core/v1/templates/functions/:id/publish (If-Match, x-idempotency-key) */
export function publishFunction(
  functionId: string,
  body: PublishFunctionRequestDto,
  ifMatch: string,
  idempotencyKey = newTemplateIdempotencyKey(),
): Promise<FunctionVersionDetailDto> {
  return fakePublishFunction(functionId, body, ifMatch, idempotencyKey);
}

/** POST /api/tenant/core/v1/templates/functions/:id/archive (If-Match, x-idempotency-key) */
export function archiveFunction(
  functionId: string,
  body: ArchiveOrRestoreFunctionRequestDto,
  ifMatch: string,
  idempotencyKey = newTemplateIdempotencyKey(),
): Promise<FunctionDetailDto> {
  return fakeArchiveFunction(functionId, body, ifMatch, idempotencyKey);
}

/** POST /api/tenant/core/v1/templates/functions/:id/restore (If-Match, x-idempotency-key) */
export function restoreFunction(
  functionId: string,
  body: ArchiveOrRestoreFunctionRequestDto,
  ifMatch: string,
  idempotencyKey = newTemplateIdempotencyKey(),
): Promise<FunctionDetailDto> {
  return fakeRestoreFunction(functionId, body, ifMatch, idempotencyKey);
}

/** GET /api/tenant/core/v1/templates/functions/:id/versions */
export function listFunctionVersions(
  functionId: string,
  query: FunctionVersionsQuery = {},
): Promise<FunctionCursorPage<FunctionVersionSummaryDto>> {
  return fakeListFunctionVersions(functionId, query);
}

/** GET /api/tenant/core/v1/templates/functions/:id/versions/:vid */
export function getFunctionVersion(functionId: string, versionId: string): Promise<FunctionVersionDetailDto> {
  return fakeGetFunctionVersion(functionId, versionId);
}

/** GET /api/tenant/core/v1/templates/functions/:id/usage */
export function listFunctionUsage(
  functionId: string,
  query: FunctionUsageQuery = {},
): Promise<FunctionCursorPage<FunctionUsageItemDto>> {
  return fakeListFunctionUsage(functionId, query);
}

/** POST /api/tenant/core/v1/templates/functions/:id/impact (x-idempotency-key) */
export function checkFunctionImpact(
  functionId: string,
  body: FunctionImpactRequestDto,
  idempotencyKey = newTemplateIdempotencyKey(),
): Promise<FunctionImpactResponseDto> {
  return fakeCheckFunctionImpact(functionId, body, idempotencyKey);
}

/** POST /api/tenant/core/v1/templates/functions/:id/apply-to-drafts (x-idempotency-key) */
export function applyFunctionToDrafts(
  functionId: string,
  body: ApplyFunctionToDraftsRequestDto,
  idempotencyKey = newTemplateIdempotencyKey(),
): Promise<ApplyFunctionToDraftsResponseDto> {
  return fakeApplyFunctionToDrafts(functionId, body, idempotencyKey);
}
