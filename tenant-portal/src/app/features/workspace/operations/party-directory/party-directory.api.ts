import { inject, Service } from '@angular/core';
import { QueryClient } from '@tanstack/angular-query';
import { CoreHttp, type CoreQuery, type CoreWriteMethod } from '../../../../core/api/core-http';
import { TenantScopeState } from '../../../../core/scope/tenant-scope';
import type {
  CreateAddressBody,
  CreateContactMethodBody,
  CreatePartyBody,
  CreateRelationshipBody,
  CreateRoleBody,
  PartyRules,
  ListOrgContactsQuery,
  ListPartiesQuery,
  OrgContact,
  Page,
  PartyAddress,
  PartyContactMethod,
  PartyDetail,
  PartyListItem,
  PartyRelationship,
  PartyRole,
  UpdateAddressBody,
  UpdateContactMethodBody,
  UpdatePartyBody,
} from './party-directory.model';

const DIRECTORY_PATH = '/api/tenant/core/v1/directory';
const DIRECTORY_QUERY_KEY = 'party-directory';

@Service()
export class PartyDirectoryApi {
  private readonly http = inject(CoreHttp);
  private readonly scope = inject(TenantScopeState);
  private readonly queries = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0, networkMode: 'always' } },
  });

  listParties(q: ListPartiesQuery = {}): Promise<Page<PartyListItem>> {
    const { page, limit, sortBy, sortDir, search, partyType, status, roleType, branchId, ownerUserId } = q;
    const query = { page, limit: pageLimit(limit), sortBy, sortDir, search, partyType, status, roleType, branchId, ownerUserId };
    return this.read('parties', query, () => this.http.readPage(`${DIRECTORY_PATH}/parties`, query));
  }

  getParty(id: string): Promise<PartyDetail> {
    return this.read('party', { id }, () => this.http.read(`${DIRECTORY_PATH}/parties/${encodeURIComponent(id)}`));
  }

  uploadPartyImage(id: string, file: File): Promise<PartyDetail> {
    const form = new FormData();
    form.append('file', file);
    return this.write('POST', `/parties/${encodeURIComponent(id)}/image`, form);
  }

  listOrgContacts(id: string, q: ListOrgContactsQuery = {}): Promise<Page<OrgContact>> {
    const query = { page: q.page, limit: pageLimit(q.limit) };
    return this.read('contacts', { id, ...query }, () =>
      this.http.readPage(`${DIRECTORY_PATH}/parties/${encodeURIComponent(id)}/contacts`, query));
  }

  getPartyRules(): Promise<PartyRules> {
    return this.read('party-rules', {}, () => this.http.read<PartyRules>(`${DIRECTORY_PATH}/party-rules`));
  }

  createParty(body: CreatePartyBody): Promise<PartyDetail> {
    return this.write('POST', `/parties`, body);
  }

  updateParty(id: string, body: UpdatePartyBody): Promise<PartyDetail> {
    return this.write('PATCH', `/parties/${encodeURIComponent(id)}`, body);
  }

  deleteParty(id: string): Promise<void> {
    return this.write('DELETE', `/parties/${encodeURIComponent(id)}`);
  }

  deletePartyImage(id: string): Promise<void> {
    return this.write('DELETE', `/parties/${encodeURIComponent(id)}/image`);
  }

  addContactMethod(id: string, body: CreateContactMethodBody): Promise<PartyContactMethod> {
    return this.write('POST', `/parties/${encodeURIComponent(id)}/contact-methods`, body);
  }

  updateContactMethod(id: string, body: UpdateContactMethodBody): Promise<PartyContactMethod> {
    return this.write('PATCH', `/contact-methods/${encodeURIComponent(id)}`, body);
  }

  deleteContactMethod(id: string): Promise<void> {
    return this.write('DELETE', `/contact-methods/${encodeURIComponent(id)}`);
  }

  addAddress(id: string, body: CreateAddressBody): Promise<PartyAddress> {
    return this.write('POST', `/parties/${encodeURIComponent(id)}/addresses`, body);
  }

  updateAddress(id: string, body: UpdateAddressBody): Promise<PartyAddress> {
    return this.write('PATCH', `/addresses/${encodeURIComponent(id)}`, body);
  }

  deleteAddress(id: string): Promise<void> {
    return this.write('DELETE', `/addresses/${encodeURIComponent(id)}`);
  }

  addRole(id: string, body: CreateRoleBody): Promise<PartyRole> {
    return this.write('POST', `/parties/${encodeURIComponent(id)}/roles`, body);
  }

  deleteRole(id: string): Promise<void> {
    return this.write('DELETE', `/party-roles/${encodeURIComponent(id)}`);
  }

  addRelationship(body: CreateRelationshipBody): Promise<PartyRelationship> {
    return this.write('POST', `/relationships`, body);
  }

  deleteRelationship(id: string): Promise<void> {
    return this.write('DELETE', `/relationships/${encodeURIComponent(id)}`);
  }

  private read<T>(method: string, query: CoreQuery, queryFn: () => Promise<T>): Promise<T> {
    const me = this.scope.me();
    // TenantScopeState has no revision counter; include the actor, grants and selection.
    const revision = [me?.id, me?.isTenantOwner, me?.permissions, me?.permissionScopes, this.scope.selection()];
    return this.queries.fetchQuery({ queryKey: [DIRECTORY_QUERY_KEY, revision, method, query], queryFn });
  }

  private async write<T>(method: CoreWriteMethod, path: string, body?: unknown): Promise<T> {
    // Directory writes require CSRF and explicitly take no idempotency key.
    const result = await this.http.write<T>(method, DIRECTORY_PATH + path, body);
    await this.queries.cancelQueries({ queryKey: [DIRECTORY_QUERY_KEY] });
    await this.queries.invalidateQueries({ queryKey: [DIRECTORY_QUERY_KEY], refetchType: 'none' });
    return result.data;
  }
}

function pageLimit(limit = 20): number {
  return Number.isFinite(limit) ? Math.min(100, Math.max(1, Math.floor(limit))) : 20;
}

export function partyImageSrc(item: { imageUrl: string | null } | null | undefined): string | null {
  const url = item?.imageUrl;
  if (!url) return null;
  const publicPrefix = `${DIRECTORY_PATH}/parties/`;
  const internalPrefix = '/api/v1/tenant/directory/parties/';
  if (url.startsWith(publicPrefix) || url.startsWith('data:') || url.startsWith('blob:')) return url;
  return url.startsWith(internalPrefix) ? publicPrefix + url.slice(internalPrefix.length) : null;
}
