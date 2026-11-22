import {
  fakeArchiveTemplate,
  fakeCreateAssignment,
  fakeCreateTemplate,
  fakeDeactivateAssignment,
  fakeDeleteTemplate,
  fakeDuplicateTemplate,
  fakeGetAsset,
  fakeGetAssetContent,
  fakeGetAssignment,
  fakeGetCreationScopes,
  fakeGetDataSourceSchema,
  fakeGetDraft,
  fakeGetPreviewJob,
  fakeGetPreviewJobArtifact,
  fakeGetPreviewJobLayoutReceipt,
  fakeGetStarterThumbnail,
  fakeGetTemplate,
  fakeGetTemplateThumbnail,
  fakeGetTemplateThumbnailByPath,
  fakeGetValidationRun,
  fakeGetVersion,
  fakeListAssets,
  fakeListAssignments,
  fakeListDataSources,
  fakeListRecoverySnapshots,
  fakeListStarters,
  fakeListTemplates,
  fakeListVersions,
  fakePatchAssignment,
  fakePatchDraft,
  fakePatchTemplate,
  fakePreviewEmail,
  fakePreviewHtml,
  fakePreviewPdf,
  fakePublishTemplate,
  fakeResolveAssignment,
  fakeRestoreRecoverySnapshot,
  fakeRestoreTemplate,
  fakeRestoreVersion,
  fakeRetireAsset,
  fakeRetireVersion,
  fakeRetryTemplateThumbnail,
  fakeUploadAsset,
  fakeValidateDraft,
  newTemplateIdempotencyKey,
} from './templates.fake';
import type {
  CreateTemplateAssignmentDto,
  CreateTemplateDto,
  CreateTemplateResponse,
  DuplicateTemplateDto,
  PatchTemplateAssignmentDto,
  PatchTemplateDefinitionDto,
  PatchTemplateDefinitionResponse,
  PatchTemplateDraftDto,
  PatchTemplateDraftResponse,
  PublishTemplateRequestDto,
  PublishTemplateResponseDto,
  ResolveTemplateAssignmentRequestDto,
  ResolveTemplateAssignmentResponseDto,
  RestoreRecoverySnapshotDto,
  RestoreRecoverySnapshotResponse,
  RestoreTemplateVersionDto,
  RestoreTemplateVersionResponse,
  RetireTemplateVersionResponse,
  TemplateAssetDetailResponse,
  TemplateAssetDto,
  TemplateAssetsListQuery,
  TemplateAssignmentDto,
  TemplateAssignmentsListQuery,
  TemplateAssignmentWriteResponse,
  TemplateCreationScopesResponse,
  TemplateCursorPage,
  TemplateDataSourceKey,
  TemplateDataSourceSchemaDto,
  TemplateDataSourceSchemaQuery,
  TemplateDataSourcesQuery,
  TemplateDataSourcesResponse,
  TemplateDefinitionDetail,
  TemplateDraftDto,
  TemplateEmailPreviewResponseDto,
  TemplateHtmlOrEmailPreviewRequestDto,
  TemplateHtmlPreviewResponseDto,
  TemplateLayoutReceiptV1,
  TemplateListRequestDto,
  TemplateListResponse,
  TemplatePdfJobDto,
  TemplatePdfPreviewAcceptedDto,
  TemplatePdfPreviewRequestDto,
  TemplateRecoverySnapshotItem,
  TemplateRecoverySnapshotsQuery,
  TemplateStartersQuery,
  TemplateStartersResponse,
  TemplateThumbnailQuery,
  TemplateThumbnailRetryRequest,
  TemplateThumbnailRetryResponse,
  TemplateValidationRunDto,
  TemplateVersionDetail,
  TemplateVersionItem,
  TemplateVersionsListQuery,
  UploadTemplateAssetRequest,
  UploadTemplateAssetResponse,
  ValidateTemplateDraftDto,
} from './templates.model';

export { FAKE_TEMPLATE_IDS, TemplateApiError, newTemplateIdempotencyKey } from './templates.fake';
export { TEMPLATE_PAGE_TABS } from './templates.model';
export type * from './templates.model';

/** GET /api/tenant/core/v1/templates */
export function listTemplates(query: TemplateListRequestDto): Promise<TemplateListResponse> {
  return fakeListTemplates(query);
}

/** POST /api/tenant/core/v1/templates/search */
export function searchTemplates(body: TemplateListRequestDto): Promise<TemplateListResponse> {
  return fakeListTemplates(body);
}

/** GET /api/tenant/core/v1/templates/creation-scopes */
export function getCreationScopes(): Promise<TemplateCreationScopesResponse> {
  return fakeGetCreationScopes();
}

/** GET /api/tenant/core/v1/templates/data-sources */
export function listDataSources(query: TemplateDataSourcesQuery): Promise<TemplateDataSourcesResponse> {
  return fakeListDataSources(query);
}

/** GET /api/tenant/core/v1/templates/data-sources/:adapterKey/schema */
export function getDataSourceSchema(
  adapterKey: TemplateDataSourceKey,
  query: TemplateDataSourceSchemaQuery,
): Promise<TemplateDataSourceSchemaDto> {
  return fakeGetDataSourceSchema(adapterKey, query);
}

/** GET /api/tenant/core/v1/templates/starters */
export function listStarters(query: TemplateStartersQuery): Promise<TemplateStartersResponse> {
  return fakeListStarters(query);
}

/** GET /api/tenant/core/v1/templates/starters/:starterKey/thumbnail */
export function getStarterThumbnail(starterKey: string, _query?: TemplateStartersQuery): Promise<Blob> {
  return fakeGetStarterThumbnail(starterKey);
}

/** POST /api/tenant/core/v1/templates (x-idempotency-key); 201 Location: /api/tenant/core/v1/templates/{id} */
export function createTemplate(
  body: CreateTemplateDto,
  idempotencyKey = newTemplateIdempotencyKey(),
): Promise<CreateTemplateResponse> {
  return fakeCreateTemplate(body, idempotencyKey);
}

/** POST /api/tenant/core/v1/templates/:id/duplicate (x-idempotency-key); 201 Location: /api/tenant/core/v1/templates/{newId} */
export function duplicateTemplate(
  templateId: string,
  body: DuplicateTemplateDto,
  idempotencyKey = newTemplateIdempotencyKey(),
): Promise<CreateTemplateResponse> {
  return fakeDuplicateTemplate(templateId, body, idempotencyKey);
}

/** GET /api/tenant/core/v1/templates/:id */
export function getTemplate(templateId: string): Promise<TemplateDefinitionDetail> {
  return fakeGetTemplate(templateId);
}

/** PATCH /api/tenant/core/v1/templates/:id (If-Match, x-idempotency-key) */
export function patchTemplate(
  templateId: string,
  patch: PatchTemplateDefinitionDto,
  ifMatch: string,
  _idempotencyKey = newTemplateIdempotencyKey(),
): Promise<PatchTemplateDefinitionResponse> {
  return fakePatchTemplate(templateId, patch, ifMatch);
}

/** POST /api/tenant/core/v1/templates/:id/archive (If-Match, x-idempotency-key) */
export function archiveTemplate(
  templateId: string,
  ifMatch: string,
  _idempotencyKey = newTemplateIdempotencyKey(),
): Promise<TemplateDefinitionDetail> {
  return fakeArchiveTemplate(templateId, ifMatch);
}

/** POST /api/tenant/core/v1/templates/:id/restore (If-Match, x-idempotency-key) */
export function restoreTemplate(
  templateId: string,
  ifMatch: string,
  _idempotencyKey = newTemplateIdempotencyKey(),
): Promise<TemplateDefinitionDetail> {
  return fakeRestoreTemplate(templateId, ifMatch);
}

/** DELETE /api/tenant/core/v1/templates/:id (If-Match, x-idempotency-key) */
export function deleteTemplate(
  templateId: string,
  ifMatch: string,
  _idempotencyKey = newTemplateIdempotencyKey(),
): Promise<void> {
  return fakeDeleteTemplate(templateId, ifMatch);
}

/** GET /api/tenant/core/v1/templates/:id/thumbnail (or ready downloadPath as given) */
export function getTemplateThumbnail(downloadPath: string): Promise<Blob>;
export function getTemplateThumbnail(templateId: string, query: TemplateThumbnailQuery): Promise<Blob>;
export function getTemplateThumbnail(
  templateIdOrPath: string,
  query?: TemplateThumbnailQuery,
): Promise<Blob> {
  if (query === undefined) {
    return fakeGetTemplateThumbnailByPath(templateIdOrPath);
  }
  return fakeGetTemplateThumbnail(templateIdOrPath, query);
}

/** POST /api/tenant/core/v1/templates/:id/thumbnail/retry (x-idempotency-key) */
export function retryTemplateThumbnail(
  templateId: string,
  body: TemplateThumbnailRetryRequest,
  _idempotencyKey = newTemplateIdempotencyKey(),
): Promise<TemplateThumbnailRetryResponse> {
  return fakeRetryTemplateThumbnail(templateId, body);
}

/** GET /api/tenant/core/v1/templates/:id/draft */
export function getDraft(templateId: string): Promise<TemplateDraftDto> {
  return fakeGetDraft(templateId);
}

/** PATCH /api/tenant/core/v1/templates/:id/draft (If-Match, x-idempotency-key) */
export function patchDraft(
  templateId: string,
  body: PatchTemplateDraftDto,
  ifMatch: string,
  idempotencyKey = newTemplateIdempotencyKey(),
): Promise<PatchTemplateDraftResponse> {
  return fakePatchDraft(templateId, body, ifMatch, idempotencyKey);
}

/** POST /api/tenant/core/v1/templates/:id/validate (If-Match, x-idempotency-key) */
export function validateDraft(
  templateId: string,
  body: ValidateTemplateDraftDto,
  ifMatch: string,
  _idempotencyKey = newTemplateIdempotencyKey(),
): Promise<TemplateValidationRunDto> {
  return fakeValidateDraft(templateId, body, ifMatch);
}

/** GET /api/tenant/core/v1/templates/:id/validation-runs/:runId */
export function getValidationRun(templateId: string, runId: string): Promise<TemplateValidationRunDto> {
  return fakeGetValidationRun(templateId, runId);
}

/** POST /api/tenant/core/v1/templates/:id/publish (If-Match, x-idempotency-key); 201 Location: /api/tenant/core/v1/templates/{id}/versions/{versionId} */
export function publishTemplate(
  templateId: string,
  body: PublishTemplateRequestDto,
  ifMatch: string,
  idempotencyKey = newTemplateIdempotencyKey(),
): Promise<PublishTemplateResponseDto> {
  return fakePublishTemplate(templateId, body, ifMatch, idempotencyKey);
}

/** GET /api/tenant/core/v1/templates/:id/versions */
export function listVersions(
  templateId: string,
  query: TemplateVersionsListQuery = {},
): Promise<TemplateCursorPage<TemplateVersionItem>> {
  return fakeListVersions(templateId, query);
}

/** GET /api/tenant/core/v1/templates/:id/versions/:versionId */
export function getVersion(templateId: string, versionId: string): Promise<TemplateVersionDetail> {
  return fakeGetVersion(templateId, versionId);
}

/** POST /api/tenant/core/v1/templates/:id/versions/:versionId/restore (If-Match, x-idempotency-key) */
export function restoreVersion(
  templateId: string,
  versionId: string,
  body: RestoreTemplateVersionDto,
  ifMatch: string,
  _idempotencyKey = newTemplateIdempotencyKey(),
): Promise<RestoreTemplateVersionResponse> {
  return fakeRestoreVersion(templateId, versionId, body, ifMatch);
}

/** POST /api/tenant/core/v1/templates/:id/versions/:versionId/retire (If-Match, x-idempotency-key) */
export function retireVersion(
  templateId: string,
  versionId: string,
  ifMatch: string,
  _idempotencyKey = newTemplateIdempotencyKey(),
): Promise<RetireTemplateVersionResponse> {
  return fakeRetireVersion(templateId, versionId, ifMatch);
}

/** GET /api/tenant/core/v1/templates/:id/draft/recovery-snapshots */
export function listRecoverySnapshots(
  templateId: string,
  query: TemplateRecoverySnapshotsQuery = {},
): Promise<TemplateCursorPage<TemplateRecoverySnapshotItem>> {
  return fakeListRecoverySnapshots(templateId, query);
}

/** POST /api/tenant/core/v1/templates/:id/draft/recovery-snapshots/:snapshotId/restore (If-Match, x-idempotency-key) */
export function restoreRecoverySnapshot(
  templateId: string,
  snapshotId: string,
  body: RestoreRecoverySnapshotDto,
  ifMatch: string,
  _idempotencyKey = newTemplateIdempotencyKey(),
): Promise<RestoreRecoverySnapshotResponse> {
  return fakeRestoreRecoverySnapshot(templateId, snapshotId, body, ifMatch);
}

/** GET /api/tenant/core/v1/templates/assets */
export function listAssets(query: TemplateAssetsListQuery = {}): Promise<TemplateCursorPage<TemplateAssetDto>> {
  return fakeListAssets(query);
}

/** GET /api/tenant/core/v1/templates/assets/:id */
export function getAsset(assetId: string): Promise<TemplateAssetDetailResponse> {
  return fakeGetAsset(assetId);
}

/** GET /api/tenant/core/v1/templates/assets/:id/content */
export function getAssetContent(assetId: string): Promise<Blob> {
  return fakeGetAssetContent(assetId);
}

/** POST /api/tenant/core/v1/templates/assets (x-idempotency-key); 201 Location: /api/tenant/core/v1/templates/assets/{assetId} */
export function uploadAsset(
  request: UploadTemplateAssetRequest,
  idempotencyKey = newTemplateIdempotencyKey(),
): Promise<UploadTemplateAssetResponse> {
  return fakeUploadAsset(request, idempotencyKey);
}

/** DELETE /api/tenant/core/v1/templates/assets/:id (If-Match, x-idempotency-key) */
export function retireAsset(
  assetId: string,
  ifMatch: string,
  _idempotencyKey = newTemplateIdempotencyKey(),
): Promise<void> {
  return fakeRetireAsset(assetId, ifMatch);
}

/** GET /api/tenant/core/v1/templates/assignments */
export function listAssignments(
  query: TemplateAssignmentsListQuery,
): Promise<TemplateCursorPage<TemplateAssignmentDto>> {
  return fakeListAssignments(query);
}

/** GET /api/tenant/core/v1/templates/assignments/:id */
export function getAssignment(assignmentId: string): Promise<TemplateAssignmentDto> {
  return fakeGetAssignment(assignmentId);
}

/** POST /api/tenant/core/v1/templates/assignments (x-idempotency-key); 201 Location: /api/tenant/core/v1/templates/assignments/{assignmentId} */
export function createAssignment(
  body: CreateTemplateAssignmentDto,
  idempotencyKey = newTemplateIdempotencyKey(),
): Promise<TemplateAssignmentWriteResponse> {
  return fakeCreateAssignment(body, idempotencyKey);
}

/** PATCH /api/tenant/core/v1/templates/assignments/:id (If-Match, x-idempotency-key) */
export function patchAssignment(
  assignmentId: string,
  patch: PatchTemplateAssignmentDto,
  ifMatch: string,
  _idempotencyKey = newTemplateIdempotencyKey(),
): Promise<TemplateAssignmentWriteResponse> {
  return fakePatchAssignment(assignmentId, patch, ifMatch);
}

/** DELETE /api/tenant/core/v1/templates/assignments/:id (If-Match, x-idempotency-key) */
export function deactivateAssignment(
  assignmentId: string,
  ifMatch: string,
  _idempotencyKey = newTemplateIdempotencyKey(),
): Promise<void> {
  return fakeDeactivateAssignment(assignmentId, ifMatch);
}

/** POST /api/tenant/core/v1/templates/assignments/resolve */
export function resolveAssignment(
  body: ResolveTemplateAssignmentRequestDto,
): Promise<ResolveTemplateAssignmentResponseDto> {
  return fakeResolveAssignment(body);
}

/** POST /api/tenant/core/v1/templates/:id/preview/html */
export function previewHtml(
  templateId: string,
  body: TemplateHtmlOrEmailPreviewRequestDto,
): Promise<TemplateHtmlPreviewResponseDto> {
  return fakePreviewHtml(templateId, body);
}

/** POST /api/tenant/core/v1/templates/:id/preview/email */
export function previewEmail(
  templateId: string,
  body: TemplateHtmlOrEmailPreviewRequestDto,
): Promise<TemplateEmailPreviewResponseDto> {
  return fakePreviewEmail(templateId, body);
}

/** POST /api/tenant/core/v1/templates/:id/preview/pdf (x-idempotency-key); 202 Location: /api/tenant/core/v1/templates/preview-jobs/{jobId} */
export function previewPdf(
  templateId: string,
  body: TemplatePdfPreviewRequestDto,
  idempotencyKey = newTemplateIdempotencyKey(),
): Promise<TemplatePdfPreviewAcceptedDto> {
  return fakePreviewPdf(templateId, body, idempotencyKey);
}

/** GET /api/tenant/core/v1/templates/preview-jobs/:jobId */
export function getPreviewJob(jobId: string): Promise<TemplatePdfJobDto> {
  return fakeGetPreviewJob(jobId);
}

/** GET /api/tenant/core/v1/templates/preview-jobs/:jobId/artifact */
export function getPreviewJobArtifact(jobId: string): Promise<Blob> {
  return fakeGetPreviewJobArtifact(jobId);
}

/** GET /api/tenant/core/v1/templates/preview-jobs/:jobId/layout-receipt */
export function getPreviewJobLayoutReceipt(jobId: string): Promise<TemplateLayoutReceiptV1> {
  return fakeGetPreviewJobLayoutReceipt(jobId);
}
