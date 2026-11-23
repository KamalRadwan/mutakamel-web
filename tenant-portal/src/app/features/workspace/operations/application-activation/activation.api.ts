import { Service, inject } from '@angular/core';
import { QueryClient } from '@tanstack/angular-query';
import { ApiError } from '../../../../core/api/api-errors';
import { CoreHttp, type CoreQuery } from '../../../../core/api/core-http';
import { TenantScopeState } from '../../../../core/scope/tenant-scope';
import {
  ActivationListItem,
  ActivationListResponse,
  ActivationSingleton,
  ActivationWriteReceipt,
  AddonActivationResource,
  AddonCommandStatusResponse,
  ApplicationActivationResource,
  BranchOverrideResource,
  SetBranchOverrideBody,
  SetCompanyAddonBody,
  SetCompanyAddonResponse,
  SetCompanyApplicationBody,
} from './activation.model';

const CORE_PATH = '/api/tenant/core/v1';
const ACTIVATION_QUERY_KEY = 'application-activation';

@Service()
export class ActivationApi {
  private readonly http = inject(CoreHttp);
  private readonly scope = inject(TenantScopeState);
  private readonly queries = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0, networkMode: 'always' } },
  });

  listCompanyActivations(companyId: string, page = 1, limit = 100): Promise<ActivationListResponse> {
    const path = this.companyPath(companyId);
    return this.read(path, { page, limit }, async () => {
      const result = await this.http.readPage<ActivationListItem>(path, { page, limit });
      if (!result.data.every((item) => item?.target && item.scope && item.resource)) this.malformed();
      return result;
    });
  }

  async listAllCompanyActivations(companyId: string): Promise<ActivationListItem[]> {
    const items: ActivationListItem[] = [];
    for (let page = 1; page <= 1_000_000; page++) {
      const result = await this.listCompanyActivations(companyId, page, 100);
      items.push(...result.data);
      if (!result.meta.hasNext) return items;
      if (!result.data.length || page >= result.meta.totalPages) this.malformed();
    }
    return this.malformed();
  }

  getCompanyApplication(companyId: string, appKey: string): Promise<ActivationSingleton<ApplicationActivationResource>> {
    return this.singleton(`${this.companyPath(companyId)}/${encodeURIComponent(appKey)}`);
  }

  getCompanyAddon(companyId: string, appKey: string, addonKey: string): Promise<ActivationSingleton<AddonActivationResource>> {
    return this.singleton(this.addonPath('companies', companyId, appKey, addonKey));
  }

  getBranchAddon(branchId: string, appKey: string, addonKey: string): Promise<ActivationSingleton<BranchOverrideResource>> {
    return this.singleton(this.addonPath('branches', branchId, appKey, addonKey));
  }

  setCompanyApplication(companyId: string, appKey: string, body: SetCompanyApplicationBody, key: string): Promise<ActivationWriteReceipt> {
    const { expectedActivationRevision, enabled, reason } = body;
    return this.write(`${this.companyPath(companyId)}/${encodeURIComponent(appKey)}`,
      { expectedActivationRevision, enabled, reason }, key);
  }

  setCompanyAddon(companyId: string, appKey: string, addonKey: string, body: SetCompanyAddonBody, key: string): Promise<SetCompanyAddonResponse> {
    const { expectedActivationRevision, enabled, reason, definitionVersionId } = body;
    return this.write(this.addonPath('companies', companyId, appKey, addonKey),
      { expectedActivationRevision, enabled, reason, definitionVersionId }, key);
  }

  getAddonCommand(companyId: string, appKey: string, addonKey: string, commandId: string): Promise<AddonCommandStatusResponse> {
    const path = `${this.addonPath('companies', companyId, appKey, addonKey)}/activation-commands/${encodeURIComponent(commandId)}`;
    return this.read(path, {}, async () => {
      const result = await this.http.read<AddonCommandStatusResponse>(path);
      if (!result || !['PENDING', 'COMMITTED', 'REJECTED'].includes(result.state)) this.malformed();
      return result;
    });
  }

  setBranchOverride(branchId: string, appKey: string, addonKey: string, body: SetBranchOverrideBody, key: string): Promise<ActivationWriteReceipt> {
    const { expectedOverrideRevision, mode, reason } = body;
    return this.write(this.addonPath('branches', branchId, appKey, addonKey),
      { expectedOverrideRevision, mode, reason }, key);
  }

  private singleton<R extends ApplicationActivationResource | AddonActivationResource | BranchOverrideResource>(path: string): Promise<ActivationSingleton<R>> {
    return this.read(path, {}, async () => {
      const result = await this.http.read<ActivationSingleton<R>>(path);
      if (!result?.resource || !result.scope || !result.target || !result.source) this.malformed();
      return result;
    });
  }

  private read<T>(path: string, query: CoreQuery, queryFn: () => Promise<T>): Promise<T> {
    const me = this.scope.me();
    // TenantScopeState has no revision counter; use its live authorization and selection projection.
    const revision = [me?.id, me?.isTenantOwner, me?.permissions, me?.permissionScopes, this.scope.selection()];
    return this.queries.fetchQuery({ queryKey: [ACTIVATION_QUERY_KEY, revision, path, query], queryFn });
  }

  private async write<T extends SetCompanyAddonResponse>(path: string, body: unknown, key: string): Promise<T> {
    const { data } = await this.http.write<T>('PATCH', path, body, { key });
    if (!data || !['COMMITTED', 'PENDING'].includes(data.state)) this.malformed();
    await this.queries.cancelQueries({ queryKey: [ACTIVATION_QUERY_KEY] });
    await this.queries.invalidateQueries({ queryKey: [ACTIVATION_QUERY_KEY] });
    return data;
  }

  private companyPath(companyId: string): string {
    return `${CORE_PATH}/companies/${encodeURIComponent(companyId)}/application-activations`;
  }

  private addonPath(scope: 'companies' | 'branches', id: string, app: string, addon: string): string {
    return `${CORE_PATH}/${scope}/${encodeURIComponent(id)}/application-activations/${encodeURIComponent(app)}/addons/${encodeURIComponent(addon)}`;
  }

  private malformed(): never {
    throw new ApiError(502, 'COMMON.GENERIC.INTERNAL_ERROR');
  }
}
