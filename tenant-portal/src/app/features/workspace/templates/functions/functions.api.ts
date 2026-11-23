import { inject, Service } from '@angular/core';
import { ApiError } from '../../../../core/api/api-errors';
import { CoreHttp, type CoreQuery } from '../../../../core/api/core-http';
import { newIdempotencyKey } from '../../../../core/api/idempotency';
import { TemplatesHttp } from '../templates-http';
import * as model from './functions.model';

export { ApiError as TemplateApiError } from '../../../../core/api/api-errors';
export { newIdempotencyKey as newTemplateIdempotencyKey } from '../../../../core/api/idempotency';
export * from './functions.model';

const BASE = '/api/tenant/core/v1/templates/functions';
const path = (id: string) => `${BASE}/${encodeURIComponent(id)}`;

/** Source-verified Core HTTP contracts, shared by the library and its consumers. */
@Service()
export class FunctionsApi {
  private readonly http = inject(CoreHttp);
  private readonly templatesHttp = inject(TemplatesHttp);

  listFunctions(query: model.FunctionsListQuery = {}): Promise<model.FunctionCursorPage<model.FunctionSummaryDto>> {
    return this.page(BASE, { ...query }, summary);
  }

  async getFunctionEditorContext(body: model.FunctionEditorContextRequestDto): Promise<model.FunctionEditorContextResponseDto> {
    // Read-like POST: CSRF applies, but no command key or If-Match.
    return model.checkFunctionEditorContext(await this.command(`${BASE}/editor-context`, body), body);
  }

  async createFunction(body: model.CreateFunctionRequestDto, key = newIdempotencyKey()): Promise<model.FunctionDetailDto> {
    model.checkFunctionWorking(body.working);
    const result = await this.http.write<unknown>('POST', BASE, body, { key });
    if (result.status !== 201) invalid();
    return detail(result.data, result.etag);
  }

  async getFunction(id: string): Promise<model.FunctionDetailDto> {
    const result = await this.http.readWithEtag<unknown>(path(id));
    const value = detail(result.data, result.etag);
    if (value.id !== id) invalid();
    return value;
  }

  async patchFunction(id: string, body: model.PatchFunctionRequestDto, ifMatch: string, key = newIdempotencyKey()): Promise<model.FunctionDetailDto> {
    model.checkFunctionWorking(body.working);
    return this.detailCommand(id, '', body, ifMatch, key, 'PATCH');
  }

  async validateFunction(id: string, body: model.ValidateFunctionRequestDto, ifMatch: string, key = newIdempotencyKey()): Promise<model.ValidateFunctionResponseDto> {
    const result = await this.http.write<unknown>('POST', `${path(id)}/validate`, body, { key, ifMatch });
    const value = result.data;
    if (result.status !== 200 || !record(value) || value['functionId'] !== id || !revision(value['revision']) ||
        !text(value['validationId']) || !state(value['state']) || !text(value['contentChecksum']) ||
        !text(value['dependencyChecksum']) || !text(value['validatedAt']) || !Array.isArray(value['issues']) ||
        !value['issues'].every(issue => record(issue) && (issue['severity'] === 'ERROR' || issue['severity'] === 'WARNING') &&
          text(issue['code']) && typeof issue['jsonPointer'] === 'string' && (issue['nodeId'] === null || text(issue['nodeId'])) &&
          text(issue['messageKey']) && record(issue['params'])) || !Array.isArray(value['testResults']) ||
        !value['testResults'].every(test => record(test) && text(test['testId']) && state(test['state']) && strings(test['issueCodes']))) invalid();
    return { ...value, etag: etag(result.etag, value['revision']),
      issues: value['issues'].map(issue => ({ ...issue, path: issue['jsonPointer'] })) } as unknown as model.ValidateFunctionResponseDto;
  }

  async publishFunction(id: string, body: model.PublishFunctionRequestDto, ifMatch: string, key = newIdempotencyKey()): Promise<model.FunctionVersionDetailDto> {
    const value = version(await this.command(`${path(id)}/publish`, body, key, ifMatch, 201), true);
    if (value.functionId !== id) invalid();
    return value as model.FunctionVersionDetailDto;
  }

  archiveFunction(id: string, body: model.ArchiveOrRestoreFunctionRequestDto, ifMatch: string, key = newIdempotencyKey()): Promise<model.FunctionDetailDto> {
    return this.detailCommand(id, '/archive', body, ifMatch, key);
  }

  restoreFunction(id: string, body: model.ArchiveOrRestoreFunctionRequestDto, ifMatch: string, key = newIdempotencyKey()): Promise<model.FunctionDetailDto> {
    return this.detailCommand(id, '/restore', body, ifMatch, key);
  }

  listFunctionVersions(id: string, query: model.FunctionVersionsQuery = {}): Promise<model.FunctionCursorPage<model.FunctionVersionSummaryDto>> {
    return this.page(`${path(id)}/versions`, { ...query }, value => {
      const item = version(value);
      if (item.functionId !== id) invalid();
      return item;
    });
  }

  async getFunctionVersion(id: string, versionId: string): Promise<model.FunctionVersionDetailDto> {
    const value = version(await this.http.read<unknown>(`${path(id)}/versions/${encodeURIComponent(versionId)}`), true);
    if (value.functionId !== id || value.id !== versionId) invalid();
    return value as model.FunctionVersionDetailDto;
  }

  listFunctionUsage(id: string, query: model.FunctionUsageQuery = {}): Promise<model.FunctionCursorPage<model.FunctionUsageItemDto>> {
    return this.page(`${path(id)}/usage`, { ...query }, value => {
      if (!record(value) || !text(value['templateId']) || !text(value['templateName']) ||
          !['DRAFT', 'PUBLISHED'].includes(String(value['sourceKind'])) || !text(value['sourceId']) ||
          !revision(value['revisionOrVersionNumber']) || !text(value['functionVersionId'])) invalid();
      return value as unknown as model.FunctionUsageItemDto;
    });
  }

  async checkFunctionImpact(id: string, body: model.FunctionImpactRequestDto, key = newIdempotencyKey()): Promise<model.FunctionImpactResponseDto> {
    const value = await this.command(`${path(id)}/impact`, body, key);
    if (!record(value) || value['functionId'] !== id || value['versionId'] !== body.versionId ||
        !text(value['impactId']) || !text(value['checksum']) || !text(value['createdAt']) || !text(value['expiresAt']) ||
        !state(value['state']) || !Array.isArray(value['targets']) || value['targets'].length !== body.targets.length || !value['targets'].every(target =>
          record(target) && text(target['templateId']) && revision(target['draftRevision']) && text(target['contentChecksum']) &&
          body.targets.some(request => request.templateId === target['templateId'] && request.draftRevision === target['draftRevision'] && request.fixtureKey === target['fixtureKey']) &&
          text(target['fixtureKey']) && text(target['fixtureChecksum']) && strings(target['previousVersionIds']) &&
          target['proposedVersionId'] === body.versionId && state(target['state']) && strings(target['issueCodes']) &&
          Number.isSafeInteger(target['totalComparisons']) && Number(target['totalComparisons']) >= 0 &&
          typeof target['truncated'] === 'boolean' && Array.isArray(target['comparisons']) &&
          target['comparisons'].every(comparison => record(comparison) && text(comparison['nodeId']) && text(comparison['formulaId']) &&
            model.isFunctionValue(comparison['previous']) && model.isFunctionValue(comparison['proposed'])))) invalid();
    return value as unknown as model.FunctionImpactResponseDto;
  }

  async applyFunctionToDrafts(id: string, body: model.ApplyFunctionToDraftsRequestDto, key = newIdempotencyKey()): Promise<model.ApplyFunctionToDraftsResponseDto> {
    const value = await this.command(`${path(id)}/apply-to-drafts`, body, key);
    if (!record(value) || value['functionId'] !== id || value['versionId'] !== body.versionId ||
        !Array.isArray(value['updated']) || value['updated'].length !== body.targets.length || !value['updated'].every(item => record(item) && text(item['templateId']) &&
          body.targets.some(request => request.templateId === item['templateId'] && request.draftRevision + 1 === item['draftRevision']) &&
          revision(item['draftRevision']) && text(item['contentChecksum']) && item['validationState'] === 'STALE')) invalid();
    return value as unknown as model.ApplyFunctionToDraftsResponseDto;
  }

  private async page<T>(url: string, query: CoreQuery, map: (value: unknown) => T): Promise<model.FunctionCursorPage<T>> {
    const page = await this.templatesHttp.cursorPage<unknown>(url, query);
    return { ...page, items: page.items.map(map) };
  }

  private async command(url: string, body: unknown, key?: string, ifMatch?: string, status = 200): Promise<unknown> {
    const result = await this.http.write<unknown>('POST', url, body, { key, ifMatch });
    if (result.status !== status || !record(result.data)) invalid();
    return result.data;
  }

  private async detailCommand(id: string, suffix: string, body: unknown, ifMatch: string, key: string, method: 'POST' | 'PATCH' = 'POST'): Promise<model.FunctionDetailDto> {
    const result = await this.http.write<unknown>(method, `${path(id)}${suffix}`, body, { key, ifMatch });
    if (result.status !== 200) invalid();
    const value = detail(result.data, result.etag);
    if (value.id !== id) invalid();
    return value;
  }
}

function invalid(): never { throw new ApiError(502, 'COMMON.GENERIC.INTERNAL_ERROR'); }
function record(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value); }
function text(value: unknown): value is string { return typeof value === 'string' && value.length > 0; }
function strings(value: unknown): value is string[] { return Array.isArray(value) && value.every(item => typeof item === 'string'); }
function revision(value: unknown): value is number { return Number.isSafeInteger(value) && Number(value) > 0 && Number(value) <= 2_147_483_647; }
function state(value: unknown): boolean { return value === 'PASSED' || value === 'FAILED'; }
function etag(header: string | null, rev: number): string {
  if (header !== `"${rev}"`) invalid();
  return header;
}
function summary(value: unknown): model.FunctionSummaryDto {
  if (!record(value) || !text(value['id']) || !text(value['code']) || !text(value['name']) ||
      !revision(value['revision']) || !['ACTIVE', 'ARCHIVED'].includes(String(value['status'])) ||
      !text(value['createdAt']) || !text(value['updatedAt']) || !record(value['scope']) ||
      !(value['scope']['scopeType'] === 'TENANT' || (value['scope']['scopeType'] === 'COMPANY' && text(value['scope']['companyId']))) ||
      !(value['description'] === undefined || typeof value['description'] === 'string') ||
      !(value['publishedVersionId'] === undefined || text(value['publishedVersionId']))) invalid();
  // Core functionEtag is the quoted revision; list items have no individual HTTP header.
  return { ...value, etag: `"${value['revision']}"` } as unknown as model.FunctionSummaryDto;
}
function detail(value: unknown, header: string | null): model.FunctionDetailDto {
  const item = summary(value);
  if (!record(value)) invalid();
  if (value['working'] !== undefined) model.checkFunctionWorking(value['working']);
  const proof = value['validation'];
  if (proof !== undefined && (!record(proof) || !text(proof['id']) || !state(proof['state']) ||
      !text(proof['contentChecksum']) || !text(proof['dependencyChecksum']) || !text(proof['validatedAt']))) invalid();
  return { ...item, etag: etag(header, item.revision) };
}
function version(value: unknown, full = false): model.FunctionVersionSummaryDto | model.FunctionVersionDetailDto {
  if (!record(value) || !text(value['id']) || !text(value['functionId']) || !revision(value['versionNumber']) ||
      !text(value['contentChecksum']) || !text(value['publishedAt']) || !text(value['publishedBy']) ||
      typeof value['changeNote'] !== 'string') invalid();
  if (full) {
    model.checkFunctionSignature(value['parameters'], value['result']);
    model.checkFunctionExpression(value['expression']);
    model.checkFunctionVersionProof(value);
  }
  const actorId = value['publishedBy'];
  return { ...value, publishedBy: { kind: 'USER', actorId, displayName: actorId } } as unknown as model.FunctionVersionDetailDto;
}
