import { inject, Service } from '@angular/core';
import { QueryClient } from '@tanstack/angular-query';
import { CoreHttp, type CoreQuery } from '../../../../core/api/core-http';
import { TenantScopeState } from '../../../../core/scope/tenant-scope';
import type {
  AuditDeletedQuery, AuditEvent, AuditHistoryPage, AuditPage, AuditQuery,
  AuditRelatedHistoryQuery, RecordHistoryQuery, RecordHistoryTarget,
} from './audit-log.model';

export { ApiError, errorCodeOf } from '../../../../core/api/api-errors';
export * from './audit-log.model';

const AUDIT_PATH = '/api/tenant/core/v1/audit';
const AUDIT_QUERY_KEY = 'workspace-audit-log';

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

  private entityPath(entityType: string, entityId: string): string {
    return `${AUDIT_PATH}/entities/${encodeURIComponent(entityType)}/${encodeURIComponent(entityId)}`;
  }

  private read<T>(path: string, query: CoreQuery = {}): Promise<T> {
    const me = this.scope.me();
    // TenantScopeState has no revision counter; include current authorization and selection.
    const scopeRevision = [me?.id, me?.isTenantOwner, me?.permissions, me?.permissionScopes,
      me?.accessibleCompanies, me?.accessibleBranches, this.scope.selection()];
    return this.queries.fetchQuery({
      queryKey: [AUDIT_QUERY_KEY, scopeRevision, path, query],
      queryFn: () => this.http.read<T>(path, query),
    });
  }
}
