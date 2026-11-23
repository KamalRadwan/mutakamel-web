import { computed, inject, Service } from '@angular/core';
import { QueryClient } from '@tanstack/angular-query';
import { CoreHttp } from '../../../../core/api/core-http';
import { newIdempotencyKey } from '../../../../core/api/idempotency';
import { TenantScopeState } from '../../../../core/scope/tenant-scope';
import type { ScopeCompany } from '../../../../core/scope/scope';
import { WorkspaceLookups } from '../../../../shared/widgets/workspace-lookups/workspace-lookups.api';
import { TemplatesHttp } from '../templates-http';
import type {
  CreateTemplateAssignmentDto, PatchTemplateAssignmentDto,
  ResolveTemplateAssignmentRequestDto, ResolveTemplateAssignmentResponseDto,
  TemplateAssignmentDto, TemplateAssignmentWriteResponse,
  TemplateAssignmentsListQuery, TemplateCursorPage,
} from '../templates.model';

const PATH = '/api/tenant/core/v1/templates/assignments';
const QUERY_KEY = 'workspace-template-assignments';

@Service()
export class AssignmentsApi {
  private readonly http = inject(CoreHttp);
  private readonly templatesHttp = inject(TemplatesHttp);
  private readonly scope = inject(TenantScopeState);
  private readonly lookups = inject(WorkspaceLookups);
  private readonly queries = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0, networkMode: 'always' } },
  });
  // TenantScopeState exposes no revision; grants and selection identify its current scope.
  private readonly scopeRevision = computed(() => {
    const me = this.scope.me();
    return JSON.stringify([me?.id, me?.isTenantOwner, me?.permissions, me?.permissionScopes, this.scope.selection()]);
  });

  listScopeCompanies(): Promise<ScopeCompany[]> {
    return this.read(['scope-directory'], async () => {
      const [companies, branches] = await Promise.all([this.lookups.allCompanies(), this.lookups.allBranches()]);
      const companyIds = new Set([...companies.map((company) => company.id), ...branches.map((branch) => branch.companyId)]);
      return Array.from(companyIds, (id) => {
        const name = companies.find((company) => company.id === id)?.name ?? id;
        return { id, nameEn: name, nameAr: name,
          branches: branches.filter((branch) => branch.companyId === id).map((branch) => ({ id: branch.id, nameEn: branch.name, nameAr: branch.name })) };
      });
    });
  }

  listAssignments(query: TemplateAssignmentsListQuery): Promise<TemplateCursorPage<TemplateAssignmentDto>> {
    return this.read(['list', query], () => this.templatesHttp.cursorPage(PATH, { ...query }));
  }

  getAssignment(id: string): Promise<TemplateAssignmentDto> {
    return this.read(['record', id], async () => {
      const { data, etag } = await this.http.readWithEtag<TemplateAssignmentDto>(`${PATH}/${id}`);
      return { ...data, etag: etag ?? data.etag };
    });
  }

  async createAssignment(body: CreateTemplateAssignmentDto, key = newIdempotencyKey()): Promise<TemplateAssignmentWriteResponse> {
    const result = await this.http.write<TemplateAssignmentWriteResponse>('POST', PATH, body, { key });
    await this.invalidate();
    return result.data;
  }

  async patchAssignment(id: string, body: PatchTemplateAssignmentDto, ifMatch: string, key = newIdempotencyKey()): Promise<TemplateAssignmentWriteResponse> {
    const result = await this.http.write<TemplateAssignmentWriteResponse>('PATCH', `${PATH}/${id}`, body, { key, ifMatch });
    await this.invalidate();
    return result.data;
  }

  async deactivateAssignment(id: string, ifMatch: string, key = newIdempotencyKey()): Promise<void> {
    await this.http.write<void>('DELETE', `${PATH}/${id}`, undefined, { key, ifMatch, noBody: true });
    await this.invalidate();
  }

  resolveAssignment(body: ResolveTemplateAssignmentRequestDto): Promise<ResolveTemplateAssignmentResponseDto> {
    return this.read(['resolve', body], async () =>
      (await this.http.write<ResolveTemplateAssignmentResponseDto>('POST', `${PATH}/resolve`, body)).data);
  }

  private read<T>(key: readonly unknown[], queryFn: () => Promise<T>): Promise<T> {
    return this.queries.fetchQuery({ queryKey: [QUERY_KEY, this.scopeRevision(), ...key], queryFn });
  }

  private async invalidate(): Promise<void> {
    await this.queries.cancelQueries({ queryKey: [QUERY_KEY] });
    await this.queries.invalidateQueries({ queryKey: [QUERY_KEY] });
  }
}

// Compatibility exports stay until TPL-9 removes the templates.api re-export.
export const listAssignments = (query: TemplateAssignmentsListQuery) => inject(AssignmentsApi).listAssignments(query);
export const getAssignment = (id: string) => inject(AssignmentsApi).getAssignment(id);
export const createAssignment = (body: CreateTemplateAssignmentDto, key?: string) => inject(AssignmentsApi).createAssignment(body, key);
export const patchAssignment = (id: string, body: PatchTemplateAssignmentDto, etag: string, key?: string) => inject(AssignmentsApi).patchAssignment(id, body, etag, key);
export const deactivateAssignment = (id: string, etag: string, key?: string) => inject(AssignmentsApi).deactivateAssignment(id, etag, key);
export const resolveAssignment = (body: ResolveTemplateAssignmentRequestDto) => inject(AssignmentsApi).resolveAssignment(body);
