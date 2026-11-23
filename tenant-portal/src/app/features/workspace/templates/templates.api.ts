import { computed, inject, Service } from '@angular/core';
import { QueryClient } from '@tanstack/angular-query';
import { ApiError } from '../../../core/api/api-errors';
import type { CoreQuery, CoreWriteMethod, CoreWriteResult } from '../../../core/api/core-http';
import { newIdempotencyKey as newTemplateIdempotencyKey } from '../../../core/api/idempotency';
import { TenantScopeState } from '../../../core/scope/tenant-scope';
import { TemplatesHttp } from './templates-http';
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
  TemplateCommandResponseMap,
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
  TemplateLayoutReceiptResponseDto,
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
    return this.write('create', 'POST', TEMPLATES_PATH, body, key);
  }

  duplicateTemplate(templateId: string, body: DuplicateTemplateDto, key: string): Promise<CoreWriteResult<CreateTemplateResponse>> {
    return this.write('create', 'POST', `${this.path(templateId)}/duplicate`, body, key);
  }

  getTemplate(templateId: string): Promise<TemplateDefinitionDetail> {
    return this.withEtag(this.path(templateId));
  }

  patchTemplate(templateId: string, body: PatchTemplateDefinitionDto, ifMatch: string, key: string): Promise<CoreWriteResult<PatchTemplateDefinitionResponse>> {
    return this.write('patchDefinition', 'PATCH', this.path(templateId), body, key, ifMatch);
  }

  archiveTemplate(templateId: string, ifMatch: string, key: string): Promise<CoreWriteResult<TemplateDefinitionDetail>> {
    return this.write('lifecycle', 'POST', `${this.path(templateId)}/archive`, undefined, key, ifMatch);
  }

  restoreTemplate(templateId: string, ifMatch: string, key: string): Promise<CoreWriteResult<TemplateDefinitionDetail>> {
    return this.write('lifecycle', 'POST', `${this.path(templateId)}/restore`, undefined, key, ifMatch);
  }

  async deleteTemplate(templateId: string, ifMatch: string, key: string): Promise<void> {
    await this.write('delete', 'DELETE', this.path(templateId), undefined, key, ifMatch);
  }

  getTemplateThumbnail(downloadPath: string): Promise<Blob>;
  getTemplateThumbnail(templateId: string, query: TemplateThumbnailQuery): Promise<Blob>;
  getTemplateThumbnail(templateIdOrPath: string, query?: TemplateThumbnailQuery): Promise<Blob> {
    return query === undefined ? this.blob(templateIdOrPath)
      : this.blob(`${this.path(templateIdOrPath)}/thumbnail`, { ...query });
  }

  retryTemplateThumbnail(templateId: string, body: TemplateThumbnailRetryRequest, key: string): Promise<CoreWriteResult<TemplateThumbnailRetryResponse>> {
    return this.write('retryThumbnail', 'POST', `${this.path(templateId)}/thumbnail/retry`, body, key);
  }

  getDraft(templateId: string): Promise<TemplateDraftDto> {
    return this.withEtag(`${this.path(templateId)}/draft`);
  }

  patchDraft(templateId: string, body: PatchTemplateDraftDto, ifMatch: string, key: string): Promise<CoreWriteResult<PatchTemplateDraftResponse>> {
    return this.write('patchDraft', 'PATCH', `${this.path(templateId)}/draft`, body, key, ifMatch);
  }

  validateDraft(templateId: string, body: ValidateTemplateDraftDto, ifMatch: string, key: string): Promise<CoreWriteResult<TemplateValidationRunDto>> {
    return this.write('validate', 'POST', `${this.path(templateId)}/validate`, body, key, ifMatch);
  }

  getValidationRun(templateId: string, runId: string): Promise<TemplateValidationRunDto> {
    return this.read(`${this.path(templateId)}/validation-runs/${encodeURIComponent(runId)}`);
  }

  publishTemplate(templateId: string, body: PublishTemplateRequestDto, ifMatch: string, key: string): Promise<CoreWriteResult<PublishTemplateResponseDto>> {
    return this.write('publish', 'POST', `${this.path(templateId)}/publish`, body, key, ifMatch);
  }

  listVersions(templateId: string, query: TemplateVersionsListQuery = {}): Promise<TemplateCursorPage<TemplateVersionItem>> {
    const path = `${this.path(templateId)}/versions`;
    return this.read(path, { ...query }, () => this.http.cursorPage(path, { ...query }));
  }

  getVersion(templateId: string, versionId: string): Promise<TemplateVersionDetail> {
    return this.read(`${this.path(templateId)}/versions/${encodeURIComponent(versionId)}`);
  }

  restoreVersion(templateId: string, versionId: string, body: RestoreTemplateVersionDto, ifMatch: string, key: string): Promise<CoreWriteResult<RestoreTemplateVersionResponse>> {
    return this.write('restoreVersion', 'POST', `${this.path(templateId)}/versions/${encodeURIComponent(versionId)}/restore`, body, key, ifMatch);
  }

  retireVersion(templateId: string, versionId: string, ifMatch: string, key: string): Promise<CoreWriteResult<RetireTemplateVersionResponse>> {
    return this.write('retireVersion', 'POST', `${this.path(templateId)}/versions/${encodeURIComponent(versionId)}/retire`, undefined, key, ifMatch);
  }

  listRecoverySnapshots(templateId: string, query: TemplateRecoverySnapshotsQuery = {}): Promise<TemplateCursorPage<TemplateRecoverySnapshotItem>> {
    const path = `${this.path(templateId)}/draft/recovery-snapshots`;
    return this.read(path, { ...query }, async () => {
      const page = await this.http.cursorPage<unknown>(path, { ...query });
      return { ...page, items: page.items.map(item => this.http.recoverySnapshot(item)) };
    });
  }

  restoreRecoverySnapshot(templateId: string, snapshotId: string, body: RestoreRecoverySnapshotDto, ifMatch: string, key: string): Promise<CoreWriteResult<RestoreRecoverySnapshotResponse>> {
    return this.write('restoreRecovery', 'POST', `${this.path(templateId)}/draft/recovery-snapshots/${encodeURIComponent(snapshotId)}/restore`, body, key, ifMatch);
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
    return this.write('previewPdf', 'POST', `${this.path(templateId)}/preview/pdf`, body, key);
  }

  getPreviewJob(jobId: string): Promise<TemplatePdfJobDto> {
    return this.read(`${TEMPLATES_PATH}/preview-jobs/${encodeURIComponent(jobId)}`);
  }

  getPreviewJobArtifact(jobId: string): Promise<Blob> {
    return this.blob(`${TEMPLATES_PATH}/preview-jobs/${encodeURIComponent(jobId)}/artifact`);
  }

  getPreviewJobLayoutReceipt(jobId: string): Promise<TemplateLayoutReceiptResponseDto> {
    const path = `${TEMPLATES_PATH}/preview-jobs/${encodeURIComponent(jobId)}/layout-receipt`;
    return this.read(path, {}, () => this.http.layoutReceipt(path));
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

  private async write<K extends keyof TemplateCommandResponseMap>(command: K, method: CoreWriteMethod, path: string,
    body: unknown, key: string, ifMatch?: string): Promise<CoreWriteResult<TemplateCommandResponseMap[K]>> {
    const revision = this.scopeRevision();
    const result = await this.http.command(command, method, path, body, { key, ifMatch });
    const filters = { queryKey: [TEMPLATES_QUERY_KEY, revision] };
    await this.queries.cancelQueries(filters);
    await this.queries.invalidateQueries({ ...filters, refetchType: 'none' });
    return result;
  }
}

export { listAssets, getAsset, getAssetContent, uploadAsset, retireAsset } from './assets/assets.api';

export { listAssignments, getAssignment, createAssignment, patchAssignment, deactivateAssignment, resolveAssignment } from './assignments/assignments.api';
