import { computed, inject, Service } from '@angular/core';
import { QueryClient } from '@tanstack/angular-query';
import { ApiError } from '../../../core/api/api-errors';
import type { CoreQuery, CoreWriteMethod, CoreWriteResult } from '../../../core/api/core-http';
import { newIdempotencyKey as newTemplateIdempotencyKey } from '../../../core/api/idempotency';
import { TenantScopeState } from '../../../core/scope/tenant-scope';
import { TemplatesHttp } from './templates-http';
import {
  fakeArchiveTemplate,
  fakeCreateTemplate,
  fakeDeleteTemplate,
  fakeDuplicateTemplate,
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
  fakeListDataSources,
  fakeListRecoverySnapshots,
  fakeListStarters,
  fakeListTemplates,
  fakeListVersions,
  fakePatchDraft,
  fakePatchTemplate,
  fakePreviewEmail,
  fakePreviewHtml,
  fakePreviewPdf,
  fakePublishTemplate,
  fakeRestoreRecoverySnapshot,
  fakeRestoreTemplate,
  fakeRestoreVersion,
  fakeRetireVersion,
  fakeRetryTemplateThumbnail,
  fakeValidateDraft,
} from './templates.fake';
import type {
  CreateTemplateDto,
  CreateTemplateResponse,
  DuplicateTemplateDto,
  PatchTemplateDefinitionDto,
  PatchTemplateDefinitionResponse,
  PatchTemplateDraftDto,
  PatchTemplateDraftResponse,
  PublishTemplateRequestDto,
  PublishTemplateResponseDto,
  RestoreRecoverySnapshotDto,
  RestoreRecoverySnapshotResponse,
  RestoreTemplateVersionDto,
  RestoreTemplateVersionResponse,
  RetireTemplateVersionResponse,
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
  ValidateTemplateDraftDto,
} from './templates.model';

export { FAKE_TEMPLATE_IDS } from './templates.fake';
export { ApiError as TemplateApiError } from '../../../core/api/api-errors';
export { newIdempotencyKey as newTemplateIdempotencyKey } from '../../../core/api/idempotency';
export { TEMPLATE_PAGE_TABS } from './templates.model';
export type * from './templates.model';

const TEMPLATES_PATH = '/api/tenant/core/v1/templates';
const TEMPLATES_QUERY_KEY = 'workspace-templates';

@Service()
export class TemplatesApi {
  private readonly http = inject(TemplatesHttp);
  private readonly scope = inject(TenantScopeState);
  private readonly queries = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0, networkMode: 'always' } },
  });
  // TenantScopeState has no revision; identical grants keep the same query identity.
  private readonly scopeRevision = computed(() => {
    const me = this.scope.me();
    return JSON.stringify([me?.id, me?.isTenantOwner, me?.permissions, me?.permissionScopes,
      me?.accessibleCompanies, me?.accessibleBranches, me?.accessibleBranchCompanies,
      me?.accessScope, me?.featureEntitlements, this.scope.selection()]);
  });

  listTemplates(query: TemplateListRequestDto): Promise<TemplateListResponse> {
    return this.read(TEMPLATES_PATH, query, async () => {
      const page = await this.http.read<TemplateListResponse>(TEMPLATES_PATH, { ...query });
      this.http.checkCursorPage(page);
      return page;
    });
  }

  searchTemplates(body: TemplateListRequestDto): Promise<TemplateListResponse> {
    return this.read(`${TEMPLATES_PATH}/search`, body, async () => {
      const page = await this.http.readLikePost<TemplateListResponse>(`${TEMPLATES_PATH}/search`, body);
      this.http.checkCursorPage(page);
      return page;
    });
  }

  getCreationScopes(): Promise<TemplateCreationScopesResponse> {
    return this.read(`${TEMPLATES_PATH}/creation-scopes`);
  }

  listDataSources(query: TemplateDataSourcesQuery): Promise<TemplateDataSourcesResponse> {
    return this.read(`${TEMPLATES_PATH}/data-sources`, { ...query });
  }

  getDataSourceSchema(adapterKey: TemplateDataSourceKey, query: TemplateDataSourceSchemaQuery): Promise<TemplateDataSourceSchemaDto> {
    return this.read(`${TEMPLATES_PATH}/data-sources/${encodeURIComponent(adapterKey)}/schema`, { ...query });
  }

  listStarters(query: TemplateStartersQuery): Promise<TemplateStartersResponse> {
    return this.read(`${TEMPLATES_PATH}/starters`, { ...query });
  }

  getStarterThumbnail(starterKey: string, query: TemplateStartersQuery): Promise<Blob> {
    return this.blob(`${TEMPLATES_PATH}/starters/${encodeURIComponent(starterKey)}/thumbnail`, { ...query });
  }

  createTemplate(body: CreateTemplateDto, key: string): Promise<CoreWriteResult<CreateTemplateResponse>> {
    return this.write('POST', TEMPLATES_PATH, body, key);
  }

  duplicateTemplate(templateId: string, body: DuplicateTemplateDto, key: string): Promise<CoreWriteResult<CreateTemplateResponse>> {
    return this.write('POST', `${this.path(templateId)}/duplicate`, body, key);
  }

  getTemplate(templateId: string): Promise<TemplateDefinitionDetail> {
    return this.withEtag(this.path(templateId));
  }

  patchTemplate(templateId: string, body: PatchTemplateDefinitionDto, ifMatch: string, key: string): Promise<CoreWriteResult<PatchTemplateDefinitionResponse>> {
    return this.write('PATCH', this.path(templateId), body, key, ifMatch);
  }

  archiveTemplate(templateId: string, ifMatch: string, key: string): Promise<CoreWriteResult<TemplateDefinitionDetail>> {
    return this.write('POST', `${this.path(templateId)}/archive`, undefined, key, ifMatch);
  }

  restoreTemplate(templateId: string, ifMatch: string, key: string): Promise<CoreWriteResult<TemplateDefinitionDetail>> {
    return this.write('POST', `${this.path(templateId)}/restore`, undefined, key, ifMatch);
  }

  async deleteTemplate(templateId: string, ifMatch: string, key: string): Promise<void> {
    await this.write('DELETE', this.path(templateId), undefined, key, ifMatch);
  }

  getTemplateThumbnail(downloadPath: string): Promise<Blob>;
  getTemplateThumbnail(templateId: string, query: TemplateThumbnailQuery): Promise<Blob>;
  getTemplateThumbnail(templateIdOrPath: string, query?: TemplateThumbnailQuery): Promise<Blob> {
    return query === undefined ? this.blob(templateIdOrPath)
      : this.blob(`${this.path(templateIdOrPath)}/thumbnail`, { ...query });
  }

  retryTemplateThumbnail(templateId: string, body: TemplateThumbnailRetryRequest, key: string): Promise<CoreWriteResult<TemplateThumbnailRetryResponse>> {
    return this.write('POST', `${this.path(templateId)}/thumbnail/retry`, body, key);
  }

  getDraft(templateId: string): Promise<TemplateDraftDto> {
    return this.withEtag(`${this.path(templateId)}/draft`);
  }

  patchDraft(templateId: string, body: PatchTemplateDraftDto, ifMatch: string, key: string): Promise<CoreWriteResult<PatchTemplateDraftResponse>> {
    return this.write('PATCH', `${this.path(templateId)}/draft`, body, key, ifMatch);
  }

  validateDraft(templateId: string, body: ValidateTemplateDraftDto, ifMatch: string, key: string): Promise<CoreWriteResult<TemplateValidationRunDto>> {
    return this.write('POST', `${this.path(templateId)}/validate`, body, key, ifMatch);
  }

  getValidationRun(templateId: string, runId: string): Promise<TemplateValidationRunDto> {
    return this.read(`${this.path(templateId)}/validation-runs/${encodeURIComponent(runId)}`);
  }

  publishTemplate(templateId: string, body: PublishTemplateRequestDto, ifMatch: string, key: string): Promise<CoreWriteResult<PublishTemplateResponseDto>> {
    return this.write('POST', `${this.path(templateId)}/publish`, body, key, ifMatch);
  }

  listVersions(templateId: string, query: TemplateVersionsListQuery = {}): Promise<TemplateCursorPage<TemplateVersionItem>> {
    const path = `${this.path(templateId)}/versions`;
    return this.read(path, { ...query }, () => this.http.cursorPage(path, { ...query }));
  }

  getVersion(templateId: string, versionId: string): Promise<TemplateVersionDetail> {
    return this.read(`${this.path(templateId)}/versions/${encodeURIComponent(versionId)}`);
  }

  restoreVersion(templateId: string, versionId: string, body: RestoreTemplateVersionDto, ifMatch: string, key: string): Promise<CoreWriteResult<RestoreTemplateVersionResponse>> {
    return this.write('POST', `${this.path(templateId)}/versions/${encodeURIComponent(versionId)}/restore`, body, key, ifMatch);
  }

  retireVersion(templateId: string, versionId: string, ifMatch: string, key: string): Promise<CoreWriteResult<RetireTemplateVersionResponse>> {
    return this.write('POST', `${this.path(templateId)}/versions/${encodeURIComponent(versionId)}/retire`, undefined, key, ifMatch);
  }

  listRecoverySnapshots(templateId: string, query: TemplateRecoverySnapshotsQuery = {}): Promise<TemplateCursorPage<TemplateRecoverySnapshotItem>> {
    const path = `${this.path(templateId)}/draft/recovery-snapshots`;
    return this.read(path, { ...query }, () => this.http.cursorPage(path, { ...query }));
  }

  restoreRecoverySnapshot(templateId: string, snapshotId: string, body: RestoreRecoverySnapshotDto, ifMatch: string, key: string): Promise<CoreWriteResult<RestoreRecoverySnapshotResponse>> {
    return this.write('POST', `${this.path(templateId)}/draft/recovery-snapshots/${encodeURIComponent(snapshotId)}/restore`, body, key, ifMatch);
  }

  previewHtml(templateId: string, body: TemplateHtmlOrEmailPreviewRequestDto): Promise<TemplateHtmlPreviewResponseDto> {
    const path = `${this.path(templateId)}/preview/html`;
    return this.read(path, body, () => this.http.readLikePost(path, body));
  }

  previewEmail(templateId: string, body: TemplateHtmlOrEmailPreviewRequestDto): Promise<TemplateEmailPreviewResponseDto> {
    const path = `${this.path(templateId)}/preview/email`;
    return this.read(path, body, () => this.http.readLikePost(path, body));
  }

  previewPdf(templateId: string, body: TemplatePdfPreviewRequestDto, key: string): Promise<CoreWriteResult<TemplatePdfPreviewAcceptedDto>> {
    return this.write('POST', `${this.path(templateId)}/preview/pdf`, body, key);
  }

  getPreviewJob(jobId: string): Promise<TemplatePdfJobDto> {
    return this.read(`${TEMPLATES_PATH}/preview-jobs/${encodeURIComponent(jobId)}`);
  }

  getPreviewJobArtifact(jobId: string): Promise<Blob> {
    return this.blob(`${TEMPLATES_PATH}/preview-jobs/${encodeURIComponent(jobId)}/artifact`);
  }

  getPreviewJobLayoutReceipt(jobId: string): Promise<TemplateLayoutReceiptV1> {
    return this.read(`${TEMPLATES_PATH}/preview-jobs/${encodeURIComponent(jobId)}/layout-receipt`);
  }

  private path(templateId: string): string {
    return `${TEMPLATES_PATH}/${encodeURIComponent(templateId)}`;
  }

  private read<T>(path: string, query: object = {}, load: () => Promise<T> = () => this.http.read<T>(path, query as CoreQuery)): Promise<T> {
    const revision = this.scopeRevision();
    return this.queries.fetchQuery({
      queryKey: [TEMPLATES_QUERY_KEY, revision, path, query],
      queryFn: async () => {
        const data = await load();
        if (revision !== this.scopeRevision()) throw new ApiError(403, 'COMMON.GENERIC.FORBIDDEN');
        return data;
      },
    });
  }

  private withEtag<T extends { etag: string }>(path: string): Promise<T> {
    return this.read(path, {}, async () => {
      const { data, etag } = await this.http.readWithEtag<T>(path);
      return etag === null ? data : { ...data, etag };
    });
  }

  private blob(path: string, query?: CoreQuery): Promise<Blob> {
    return this.read(path, query, () => this.http.readBlob(path, query));
  }

  private async write<T>(method: CoreWriteMethod, path: string, body: unknown, key: string, ifMatch?: string): Promise<CoreWriteResult<T>> {
    const revision = this.scopeRevision();
    const result = await this.http.write<T>(method, path, body, { key, ifMatch });
    const filters = { queryKey: [TEMPLATES_QUERY_KEY, revision] };
    await this.queries.cancelQueries(filters);
    await this.queries.invalidateQueries({ ...filters, refetchType: 'none' });
    return result;
  }
}

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

export { listAssets, getAsset, getAssetContent, uploadAsset, retireAsset } from './assets/assets.api';

export { listAssignments, getAssignment, createAssignment, patchAssignment, deactivateAssignment, resolveAssignment } from './assignments/assignments.api';
