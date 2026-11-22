import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import { QueryClient } from '@tanstack/angular-query';
import { firstValueFrom } from 'rxjs';
import { ApiError } from '../../../../core/api/api-errors';
import type { CorePage, CorePageMeta } from '../../../../core/api/core-page';
import type { Branch, Company, ListQuery } from './staff.model';
import { StaffSession } from './staff-session';

const ORGANIZATION_PATH = '/api/tenant/core/v1/organization';
type CompanyQuery = Pick<ListQuery, 'page' | 'limit' | 'search' | 'sortBy' | 'sortDir' | 'status'>;
type BranchQuery = CompanyQuery & Pick<ListQuery, 'companyId'>;
type ReadPermission = 'org.company.read' | 'org.branch.read';

interface ReadEnvelope<T> {
  success: true;
  data: T;
  meta?: CorePageMeta;
}

@Service()
export class OrganizationReadApi {
  private readonly http = inject(HttpClient);
  private readonly session = inject(StaffSession);
  private readonly queries = new QueryClient({
    defaultOptions: { queries: { gcTime: 0, networkMode: 'always', retry: false } },
  });

  listCompanies(query: CompanyQuery = {}): Promise<CorePage<Company>> {
    return this.readPage('companies', 'org.company.read', query);
  }

  listBranches(query: BranchQuery = {}): Promise<CorePage<Branch>> {
    return this.readPage('branches', 'org.branch.read', query);
  }

  async getCompany(id: string): Promise<Company> {
    const result = await this.read<Company>(`companies/${encodeURIComponent(id)}`, 'org.company.read');
    return result.data;
  }

  async getBranch(id: string): Promise<Branch> {
    const result = await this.read<Branch>(`branches/${encodeURIComponent(id)}`, 'org.branch.read');
    return result.data;
  }

  private async readPage<T>(path: string, permission: ReadPermission, query: BranchQuery): Promise<CorePage<T>> {
    const { data, meta } = await this.read<T[]>(path, permission, query);
    if (!Array.isArray(data) || !meta || !Number.isSafeInteger(meta.total) || meta.total < 0 ||
      !Number.isSafeInteger(meta.totalPages) || meta.totalPages < 0 ||
      typeof meta.hasNext !== 'boolean') {
      throw new ApiError(502, 'COMMON.GENERIC.INTERNAL_ERROR');
    }
    return { data, meta };
  }

  private async read<T>(path: string, permission: ReadPermission, query: BranchQuery = {}): Promise<ReadEnvelope<T>> {
    const scope = this.session.scopeRevision();
    if (!scope || !this.session.can(permission)) {
      throw new ApiError(403, 'COMMON.GENERIC.FORBIDDEN');
    }
    let params = new HttpParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== '') params = params.set(key, value);
    }
    return this.queries.fetchQuery({
      queryKey: ['staff-organization', scope, path, query],
      queryFn: async () => {
        try {
          const envelope = await firstValueFrom(this.http.get<ReadEnvelope<T>>(`${ORGANIZATION_PATH}/${path}`, { params }));
          if (envelope?.success !== true || envelope.data == null) {
            throw new ApiError(502, 'COMMON.GENERIC.INTERNAL_ERROR');
          }
          return envelope;
        } catch (error) {
          if (!(error instanceof HttpErrorResponse)) throw error;
          throw ApiError.fromResponse(error.status, error.error);
        }
      },
    });
  }
}
