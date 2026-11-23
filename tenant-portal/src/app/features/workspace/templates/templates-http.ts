import { inject, Service } from '@angular/core';
import { ApiError } from '../../../core/api/api-errors';
import { CoreHttp, type CoreQuery, type CoreWriteMethod, type CoreWriteResult } from '../../../core/api/core-http';
import type {
  TemplateCommandResponseMap, TemplateCursorPage, TemplateLayoutReceiptResponseDto,
  TemplateRecoverySnapshotItem, TemplateRecoverySnapshotWireItem,
} from './templates.model';

@Service()
export class TemplatesHttp {
  private readonly http = inject(CoreHttp);

  async cursorPage<T>(path: string, query?: CoreQuery): Promise<TemplateCursorPage<T>> {
    return this.checkCursorPage<T>(await this.http.read<unknown>(path, query));
  }

  checkCursorPage<T>(body: unknown): TemplateCursorPage<T> {
    const page = body as Partial<TemplateCursorPage<T>> | null;
    const info = page?.pageInfo;
    if (!Array.isArray(page?.items) || !info ||
        !Number.isInteger(info.limit) || info.limit < 1 || info.limit > 100 ||
        typeof info.hasNextPage !== 'boolean' ||
        !(info.nextCursor === null || typeof info.nextCursor === 'string')) {
      throw new ApiError(502, 'COMMON.GENERIC.INTERNAL_ERROR');
    }
    return page as TemplateCursorPage<T>;
  }

  read<T>(path: string, query?: CoreQuery): Promise<T> {
    return this.http.read<T>(path, query);
  }

  readWithEtag<T>(path: string, query?: CoreQuery) {
    return this.http.readWithEtag<T>(path, query);
  }

  readBlob(path: string, query?: CoreQuery): Promise<Blob> {
    return this.http.readBlob(path, query);
  }

  write<T>(method: CoreWriteMethod, path: string, body: unknown, options: { key: string; ifMatch?: string }) {
    return this.http.write<T>(method, path, body, options);
  }

  async command<K extends keyof TemplateCommandResponseMap>(
    command: K, method: CoreWriteMethod, path: string, body: unknown,
    options: { key: string; ifMatch?: string },
  ): Promise<CoreWriteResult<TemplateCommandResponseMap[K]>> {
    const result = await this.write<unknown>(method, path, body, options);
    if (command === 'delete') {
      if (result.status !== 204) invalidResponse();
    } else {
      const status = command === 'create' || command === 'publish' ? 201
        : command === 'previewPdf' || command === 'retryThumbnail' ? 202 : 200;
      if (result.status !== status || !commandBody(command, result.data)) invalidResponse();
    }
    const data = command === 'restoreRecovery' && record(result.data)
      ? { ...result.data, recoveredFrom: this.recoverySnapshot(result.data['recoveredFrom']) }
      : result.data;
    return { ...result, data: data as TemplateCommandResponseMap[K] };
  }

  recoverySnapshot(value: unknown): TemplateRecoverySnapshotItem {
    if (!record(value) || !text(value['snapshotId']) || !text(value['createdBy']) ||
        !(value['restoredBy'] === null || text(value['restoredBy']))) invalidResponse();
    const snapshot = value as TemplateRecoverySnapshotWireItem;
    // The ID itself is the honest fallback label: Core supplies no display name.
    const author = (actorId: string) => ({ kind: 'USER' as const, actorId, displayName: actorId });
    return { ...snapshot, createdBy: author(snapshot.createdBy),
      restoredBy: snapshot.restoredBy === null ? null : author(snapshot.restoredBy) };
  }

  async layoutReceipt(path: string): Promise<TemplateLayoutReceiptResponseDto> {
    const value = await this.read<unknown>(path);
    if (!layoutReceipt(value)) invalidResponse();
    return value as TemplateLayoutReceiptResponseDto;
  }

  async readLikePost<T>(path: string, body: unknown): Promise<T> {
    return (await this.http.write<T>('POST', path, body)).data;
  }
}

function invalidResponse(): never { throw new ApiError(502, 'COMMON.GENERIC.INTERNAL_ERROR'); }
function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function text(value: unknown): value is string { return typeof value === 'string' && value.length > 0; }
function revision(value: unknown): boolean { return Number.isSafeInteger(value) && Number(value) > 0; }
function resource(value: unknown, id: string): boolean {
  return record(value) && text(value[id]) && revision(value['revision']) && text(value['etag']);
}
function thumbnail(value: unknown): boolean {
  return record(value) && text(value['sourceChecksum']) &&
    (value['state'] === 'PENDING' || value['state'] === 'UNAVAILABLE' ||
      (value['state'] === 'READY' && text(value['downloadPath']) && text(value['contentChecksum'])));
}
function migration(value: unknown): boolean {
  return value === null || (record(value) && text(value['snapshotId']) &&
    revision(value['fromSchemaVersion']) && revision(value['toSchemaVersion']) &&
    revision(value['sourceDraftRevision']) && text(value['sourceContentChecksum']) && text(value['expiresAt']));
}
function previewSource(value: unknown): boolean {
  return record(value) && (value['kind'] === 'DRAFT'
    ? text(value['draftId']) && revision(value['draftRevision'])
    : value['kind'] === 'VERSION' && text(value['versionId']) && revision(value['versionNumber']));
}

/** Check the source-proven receipt fields before callers can treat a write as successful. */
function commandBody(command: keyof TemplateCommandResponseMap, value: unknown): boolean {
  if (!record(value)) return false;
  switch (command) {
    case 'create': return resource(value['definition'], 'templateId') && resource(value['draft'], 'draftId');
    case 'patchDefinition': return resource(value['definition'], 'templateId') &&
      (value['draft'] === null || resource(value['draft'], 'draftId'));
    case 'lifecycle': return resource(value, 'templateId');
    case 'patchDraft': return resource(value['draft'], 'draftId') && thumbnail(value['thumbnail']) && migration(value['migrationRecovery']);
    case 'restoreVersion': return resource(value['draft'], 'draftId') && migration(value['migrationRecovery']);
    case 'restoreRecovery': return resource(value['draft'], 'draftId') && value['migrationRecovery'] === null &&
      record(value['recoveredFrom']) && migration(value['replacedDraftRecovery']);
    case 'validate': return text(value['validationRunId']) && text(value['templateId']) && text(value['draftId']) &&
      revision(value['draftRevision']) && (value['status'] === 'PASSED' || value['status'] === 'FAILED') &&
      Array.isArray(value['issues']) && Array.isArray(value['rendererTargets']);
    case 'publish': return record(value['version']) && text(value['version']['templateVersionId']) &&
      thumbnail(value['thumbnail']) && revision(value['definitionRevision']) && text(value['definitionEtag']) &&
      revision(value['consumedDraftRevision']) && text(value['draftEtag']);
    case 'retireVersion': return record(value['version']) && text(value['version']['templateVersionId']) &&
      revision(value['definitionRevision']) && text(value['definitionEtag']);
    case 'retryThumbnail': return value['kind'] === 'THUMBNAIL_ACCEPTED' && value['state'] === 'PENDING' &&
      text(value['thumbnailJobId']) && revision(value['generation']) && text(value['sourceChecksum']) && text(value['location']);
    case 'previewPdf': return value['kind'] === 'PDF_ACCEPTED' && value['renderTarget'] === 'PDF' &&
      (value['status'] === 'PENDING' || value['status'] === 'RESOLVING_SOURCE') &&
      (value['outputProfile'] === 'DOCUMENT_PRINT' || value['outputProfile'] === 'EMAIL_PRINT_PROJECTION') &&
      text(value['templateId']) && previewSource(value['source']) && text(value['renderJobId']) && text(value['location']) &&
      text(value['createdAt']) && text(value['expiresAt']) && text(value['templateContentChecksum']) && text(value['compiledArtifactChecksum']);
    case 'delete': return false;
  }
}

function bounds(value: unknown): boolean {
  return record(value) && ['x', 'y', 'width', 'height'].every(key => typeof value[key] === 'number' && Number.isFinite(value[key])) &&
    Number(value['width']) >= 0 && Number(value['height']) >= 0;
}
function layoutReceipt(value: unknown): boolean {
  if (!record(value) || !text(value['layoutRuntimeChecksum']) ||
      (value['pagedRuntimeChecksum'] !== undefined && !text(value['pagedRuntimeChecksum'])) ||
      !Array.isArray(value['pages']) || value['pages'].length === 0) return false;
  const uniform = value['pageLayoutMode'] === 'UNIFORM';
  if (!(uniform && value['geometryUnit'] === 'MM') &&
      !(value['pageLayoutMode'] === 'EXPLICIT' && value['geometryUnit'] === 'CSS_PX')) return false;
  const ids = new Set<string>();
  for (const page of value['pages']) {
    if (!record(page) || !text(page['pageId']) || ids.has(page['pageId'])) return false;
    ids.add(page['pageId']);
    if (uniform ? !(typeof page['widthMm'] === 'number' && Number.isFinite(page['widthMm']) && page['widthMm'] > 0 &&
        typeof page['heightMm'] === 'number' && Number.isFinite(page['heightMm']) && page['heightMm'] > 0 && bounds(page['contentBox']) &&
        (page['headerBox'] === undefined || bounds(page['headerBox'])) && (page['footerBox'] === undefined || bounds(page['footerBox'])))
      : !(bounds(page['paper']) && bounds(page['content']))) return false;
  }
  for (const key of uniform ? ['fragments'] : ['objects', 'dataRows']) {
    const rows = value[key];
    if (!Array.isArray(rows) || !rows.every(row => record(row) && text(row['sourceNodeId']) &&
        typeof row['pageId'] === 'string' && ids.has(row['pageId']) && bounds(row['bounds']) &&
        (key !== 'fragments' || (Number.isSafeInteger(row['continuationIndex']) && Number(row['continuationIndex']) >= 0)) &&
        (key !== 'dataRows' || row['rowIndex'] !== undefined) &&
        (row['rowIndex'] === undefined || (Number.isSafeInteger(row['rowIndex']) && Number(row['rowIndex']) >= 0)))) return false;
  }
  return !uniform || (Array.isArray(value['fonts']) && value['fonts'].every(font =>
    record(font) && text(font['family']) && text(font['weight']) && text(font['style'])));
}
