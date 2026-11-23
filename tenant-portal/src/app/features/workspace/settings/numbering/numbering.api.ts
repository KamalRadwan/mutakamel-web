import { Service, computed, inject } from '@angular/core';
import { QueryClient } from '@tanstack/angular-query';
import { CoreHttp } from '../../../../core/api/core-http';
import { AuthSession } from '../../../../core/auth/auth-session';
import type {
  CreateNumberingBody, NumberingListQuery, NumberingPage, NumberingPeek,
  NumberingSequence, UpdateNumberingBody,
} from './numbering.model';

const PATH = '/api/tenant/core/v1/numbering';

@Service()
export class NumberingApi {
  private readonly http = inject(CoreHttp);
  private readonly auth = inject(AuthSession);
  private readonly queries = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0, networkMode: 'always' } },
  });

  readonly scopeRevision = computed(() => {
    const me = this.auth.me();
    return JSON.stringify([me?.id, me?.isTenantOwner, me?.permissions,
      me?.permissionScopes['numbering.read'], me?.permissionScopes['numbering.manage'],
      me?.accessibleCompanies]);
  });

  listNumbering(query: NumberingListQuery): Promise<NumberingPage> {
    return this.queries.fetchQuery({
      queryKey: ['ws-numbering', this.scopeRevision(), 'list', query],
      queryFn: () => this.http.readPage<NumberingSequence>(PATH, { ...query }),
    });
  }

  async createNumbering(body: CreateNumberingBody, key: string): Promise<NumberingSequence> {
    const result = await this.http.write<NumberingSequence>('POST', PATH, body, { key });
    await this.invalidateLists();
    return result.data;
  }

  async updateNumbering(id: string, body: UpdateNumberingBody, key: string): Promise<NumberingSequence> {
    const result = await this.http.write<NumberingSequence>('PATCH', `${PATH}/${encodeURIComponent(id)}`, body, { key });
    await this.invalidateLists();
    return result.data;
  }

  peekNumbering(code: string, companyId: string | null): Promise<NumberingPeek> {
    return this.queries.fetchQuery({
      queryKey: ['ws-numbering', this.scopeRevision(), 'peek', code, companyId],
      staleTime: 0,
      queryFn: () => this.http.read<NumberingPeek>(`${PATH}/${encodeURIComponent(code)}/peek`, { companyId }),
    });
  }

  private invalidateLists(): Promise<void> {
    return this.queries.invalidateQueries({
      predicate: (query) => query.queryKey[0] === 'ws-numbering' && query.queryKey[2] === 'list',
    });
  }
}
