import { inject, Service } from '@angular/core';
import { QueryClient } from '@tanstack/angular-query';
import { ApiError } from '../../../../core/api/api-errors';
import { CoreHttp, type CoreQuery } from '../../../../core/api/core-http';
import { TenantScopeState } from '../../../../core/scope/tenant-scope';
import type {
  AuditDeletedQuery, AuditEvent, AuditExportFilters, AuditExportJob, AuditExportReceipt,
  AuditHistoryPage, AuditPage, AuditQuery, AuditRelatedHistoryQuery, RecordHistoryQuery, RecordHistoryTarget,
} from './audit-log.model';

export { ApiError, errorCodeOf } from '../../../../core/api/api-errors';
export * from './audit-log.model';

const AUDIT_PATH = '/api/tenant/core/v1/audit';
const AUDIT_QUERY_KEY = 'workspace-audit-log';

function buildExportBody(filters: AuditQuery): AuditExportFilters {
  const { cursor: _cursor, limit: _limit, ...rest } = filters;
  const body: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(rest)) {
    if (value !== undefined && value !== null && value !== '') {
      body[key] = value;
    }
  }
  return body as AuditExportFilters;
}

@Service()
export class AuditLogApi {
  private readonly http = inject(CoreHttp);
  private readonly scope = inject(TenantScopeState);
  private readonly queries = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0, networkMode: 'always' } },
  });

  listAuditEvents(query: AuditQuery = {}): Promise<AuditPage> {
    return this.read(AUDIT_PATH, { limit: 25, ...query });
  }

  listDeletedRecords(query: AuditDeletedQuery = {}): Promise<AuditPage> {
    return this.read(`${AUDIT_PATH}/deleted`, { limit: 25, ...query });
  }

  getAuditEvent(id: string): Promise<AuditEvent> {
    return this.read(`${AUDIT_PATH}/events/${encodeURIComponent(id)}`);
  }

  listEntityAuditEvents(entityType: string, entityId: string, query: AuditQuery = {}): Promise<AuditPage> {
    return this.read(this.entityPath(entityType, entityId), { limit: 25, ...query });
  }

  listRelatedEntityHistory(entityType: string, entityId: string, query: AuditRelatedHistoryQuery): Promise<AuditHistoryPage> {
    return this.read(this.entityPath(entityType, entityId), {
      limit: 25, ...query, relatedPartyIds: query.relatedPartyIds.join(','),
    });
  }

  listRecordHistory(target: RecordHistoryTarget, query: RecordHistoryQuery = {}): Promise<AuditHistoryPage> {
    return this.read(`${AUDIT_PATH}/records/CRM/LEAD/${encodeURIComponent(target.targetId)}/history`, { limit: 25, ...query });
  }

  async startAuditExport(filters: AuditQuery, key: string): Promise<AuditExportReceipt> {
    const result = await this.http.write<AuditExportReceipt>(
      'POST',
      `${AUDIT_PATH}/exports`,
      buildExportBody(filters),
      { key },
    );
    await this.queries.cancelQueries({ queryKey: [AUDIT_QUERY_KEY, 'exports'] });
    await this.queries.invalidateQueries({ queryKey: [AUDIT_QUERY_KEY, 'exports'] });
    return result.data;
  }

  getAuditExport(exportId: string): Promise<AuditExportJob> {
    const path = `${AUDIT_PATH}/exports/${encodeURIComponent(exportId)}`;
    return this.queries.fetchQuery({
      queryKey: [AUDIT_QUERY_KEY, 'exports', this.scopeRevision(), path],
      queryFn: async () => {
        const body = await this.http.read<unknown>(path, {}, { bare: true });
        if (
          typeof body !== 'object' ||
          body === null ||
          !('success' in body) ||
          body.success !== true ||
          !('data' in body) ||
          typeof body.data !== 'object' ||
          body.data === null ||
          Array.isArray(body.data)
        ) {
          throw new ApiError(502, 'COMMON.GENERIC.INTERNAL_ERROR');
        }
        const job = body.data as AuditExportJob;
        const envelopeCorrelationId =
          'correlationId' in body && typeof body.correlationId === 'string' && body.correlationId.length > 0
            ? body.correlationId
            : undefined;
        return job.correlationId || !envelopeCorrelationId
          ? job
          : { ...job, correlationId: envelopeCorrelationId };
      },
    });
  }

  downloadAuditExport(exportId: string): Promise<Blob> {
    const path = `${AUDIT_PATH}/exports/${encodeURIComponent(exportId)}/download`;
    return this.queries.fetchQuery({
      queryKey: [AUDIT_QUERY_KEY, 'exports', this.scopeRevision(), path, 'blob'],
      queryFn: () => this.http.readBlob(path),
    });
  }

  private entityPath(entityType: string, entityId: string): string {
    return `${AUDIT_PATH}/entities/${encodeURIComponent(entityType)}/${encodeURIComponent(entityId)}`;
  }

  private scopeRevision(): unknown[] {
    const me = this.scope.me();
    // TenantScopeState has no revision counter; include current authorization and selection.
    return [me?.id, me?.isTenantOwner, me?.permissions, me?.permissionScopes,
      me?.accessibleCompanies, me?.accessibleBranches, this.scope.selection()];
  }

  private read<T>(path: string, query: CoreQuery = {}): Promise<T> {
    return this.queries.fetchQuery({
      queryKey: [AUDIT_QUERY_KEY, this.scopeRevision(), path, query],
      queryFn: () => this.http.read<T>(path, query),
    });
  }
}
