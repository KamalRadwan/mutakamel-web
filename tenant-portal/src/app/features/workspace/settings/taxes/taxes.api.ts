import { computed, inject, Service } from '@angular/core';
import { QueryClient } from '@tanstack/angular-query';
import { ApiError } from '../../../../core/api/api-errors';
import { CoreHttp } from '../../../../core/api/core-http';
import { AuthSession } from '../../../../core/auth/auth-session';
import { CreateTaxBody, CorePage, Tax, TaxListQuery, UpdateTaxBody, taxScopeRevision } from './taxes.model';

const TAXES_PATH = '/api/tenant/core/v1/taxes';

@Service()
export class TaxesApi {
  private readonly http = inject(CoreHttp);
  private readonly auth = inject(AuthSession);
  private readonly queries = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0, networkMode: 'always' } },
  });

  readonly scopeRevision = computed(() => taxScopeRevision(this.auth.me()));

  listTaxes(query: TaxListQuery = {}): Promise<CorePage<Tax>> {
    return this.queries.fetchQuery({
      queryKey: ['ws-taxes', this.scopeRevision(), query],
      queryFn: async () => {
        const result = await this.http.readPage<Tax>(TAXES_PATH, { ...query });
        if (!result.data.every(isTax)) throw new ApiError(502, 'COMMON.GENERIC.INTERNAL_ERROR');
        return result;
      },
    });
  }

  async createTax(body: CreateTaxBody, key: string): Promise<Tax> {
    const { companyId, ...fields } = body;
    const payload = companyId ? { ...fields, companyId } : fields;
    const result = await this.http.write<Tax>('POST', TAXES_PATH, payload, { key });
    await this.invalidate();
    return result.data;
  }

  async updateTax(id: string, body: UpdateTaxBody, key: string): Promise<Tax> {
    const result = await this.http.write<Tax>('PATCH', `${TAXES_PATH}/${encodeURIComponent(id)}`, body, { key });
    await this.invalidate();
    return result.data;
  }

  async deactivateTax(id: string, key: string): Promise<void> {
    await this.http.write<void>('DELETE', `${TAXES_PATH}/${encodeURIComponent(id)}`, undefined, { key });
    await this.invalidate();
  }

  private invalidate(): Promise<void> {
    return this.queries.invalidateQueries({ queryKey: ['ws-taxes'] });
  }
}

function isTax(value: unknown): value is Tax {
  if (!value || typeof value !== 'object') return false;
  const tax = value as Partial<Tax>;
  return ['id', 'code', 'name', 'rate', 'createdAt', 'updatedAt'].every((key) =>
    typeof tax[key as keyof Tax] === 'string') &&
    typeof tax.isInclusive === 'boolean' && (tax.companyId === null || typeof tax.companyId === 'string') &&
    (tax.status === 'ACTIVE' || tax.status === 'INACTIVE');
}
