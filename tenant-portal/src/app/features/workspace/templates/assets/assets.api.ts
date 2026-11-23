import { newIdempotencyKey as newTemplateIdempotencyKey } from '../../../../core/api/idempotency';
import {
  fakeGetAsset,
  fakeGetAssetContent,
  fakeListAssets,
  fakeRetireAsset,
  fakeUploadAsset,
} from '../templates.fake';
import type {
  TemplateAssetDetailResponse,
  TemplateAssetDto,
  TemplateAssetsListQuery,
  TemplateCursorPage,
  UploadTemplateAssetRequest,
  UploadTemplateAssetResponse,
} from '../templates.model';

const ASSETS_PATH = '/api/tenant/core/v1/templates/assets';
const ASSETS_QUERY_KEY = 'workspace-template-assets';

@Service()
export class AssetsApi {
  private readonly http = inject(CoreHttp);
  private readonly templatesHttp = inject(TemplatesHttp);
  private readonly scope = inject(TenantScopeState);
  private readonly queries = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0, networkMode: 'always' } },
  });
  // TenantScopeState has no revision counter; include its current grants and selection.
  readonly scopeRevision = computed(() => JSON.stringify([this.scope.me(), this.scope.selection()]));

  listAssets(query: TemplateAssetsListQuery = {}): Promise<TemplateCursorPage<TemplateAssetDto>> {
    const { definitionId, ...rest } = query;
    const params = { ...rest, ...(query.scope === 'DEFINITION' ? { definitionId } : {}) };
    return this.read('list', params, () => this.templatesHttp.cursorPage(ASSETS_PATH, params));
  }

  getAsset(assetId: string): Promise<TemplateAssetDetailResponse> {
    return this.read('detail', assetId, () => this.http.read(this.path(assetId)));
  }

  getAssetContent(assetId: string): Promise<Blob> {
    return this.read('content', assetId, () => this.http.readBlob(`${this.path(assetId)}/content`));
  }

  async uploadAsset(request: UploadTemplateAssetRequest, key = newTemplateIdempotencyKey()): Promise<UploadTemplateAssetResponse> {
    const form = new FormData();
    form.append('metadata', JSON.stringify(request.metadata));
    form.append('file', request.file);
    const result = await this.http.writeMultipart<UploadTemplateAssetResponse>(ASSETS_PATH, form, { key });
    await this.invalidate();
    return result.data;
  }

  async retireAsset(assetId: string, ifMatch: string, key = newTemplateIdempotencyKey()): Promise<void> {
    await this.http.write('DELETE', this.path(assetId), undefined, { key, ifMatch });
    await this.invalidate();
  }

  private path(assetId: string): string {
    return `${ASSETS_PATH}/${encodeURIComponent(assetId)}`;
  }

  private read<T>(kind: string, params: unknown, load: () => Promise<T>): Promise<T> {
    const revision = this.scopeRevision();
    return this.queries.fetchQuery({
      queryKey: [ASSETS_QUERY_KEY, revision, kind, params],
      queryFn: async () => {
        const data = await load();
        if (revision !== this.scopeRevision()) throw new ApiError(403, 'COMMON.GENERIC.FORBIDDEN');
        return data;
      },
    });
  }

  private async invalidate(): Promise<void> {
    await this.queries.cancelQueries({ queryKey: [ASSETS_QUERY_KEY] });
    await this.queries.invalidateQueries({ queryKey: [ASSETS_QUERY_KEY] });
  }
}

// FAKE-ONLY compatibility exports: templates.api.ts must retain these exports in this wave.
// DesignerState still calls getAssetContent; its migration belongs to TPL-1/TPL-9.
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

import { computed, inject, Service } from '@angular/core';
import { QueryClient } from '@tanstack/angular-query';
import { ApiError } from '../../../../core/api/api-errors';
import { CoreHttp } from '../../../../core/api/core-http';
import { TenantScopeState } from '../../../../core/scope/tenant-scope';
import { TemplatesHttp } from '../templates-http';
