import type { CoreQuery, CoreWriteMethod } from '../../../../core/api/core-http';
import type { CrmReadOptions, CrmWriteOptions } from '../../shared/crm-http';
import { CrmHttpStub } from '../../shared/testing/crm-http-testing';
import { fakeBoard, fakeDeleteLead, fakeListDisqualificationReasons, fakeMove, fakeSearch, fakeStagePage, fakeUpdateLead } from '../leads.fake';
import type { LeadSearchBody } from '../lead-search/lead-search.compile';
import type { LeadsCapabilities } from '../leads.model';

export const LIST_CAPABILITIES: LeadsCapabilities = {
  branchId: 'b1',
  leads: { create: null, update: { scope: 'all', ownerUserIds: null }, delete: { scope: 'all', ownerUserIds: null }, convert: null },
  activities: { create: null }, notes: { create: null, delete: null }, attachments: { create: null, delete: null }, opportunities: { create: null },
};

/** Retain the original fake-data interaction scenarios behind the real transport seam. */
export class LeadListTestHttp extends CrmHttpStub {
  override async read<T>(path: string, query?: CoreQuery, options?: CrmReadOptions): Promise<T> {
    if (path === '/settings/reasons') {
      await super.read(path, query, options);
      return { items: await fakeListDisqualificationReasons() } as T;
    }
    return super.read<T>(path, query, options);
  }

  override async write<T>(method: CoreWriteMethod, path: string, body: unknown, options: CrmWriteOptions) {
    const result = await super.write<T>(method, path, body, options);
    const filters = body as LeadSearchBody & { page: number; limit: number };
    const id = path.split('/')[2];
    const change = body as Parameters<typeof fakeUpdateLead>[1] & { expectedUpdatedAt?: string; stageId: string; disqualificationReasonId?: string };
    let data: unknown = result.data;
    if (path === '/leads/search') data = await fakeSearch(filters, filters.page, filters.limit);
    else if (path === '/leads/board') data = await fakeBoard(filters);
    else if (path.startsWith('/leads/board/stages/')) data = await fakeStagePage(path.split('/').at(-1)!, filters, filters.page);
    else if (path.endsWith('/stage')) data = await fakeMove(id, change.stageId, change.disqualificationReasonId);
    else if (method === 'PATCH') data = await fakeUpdateLead(id, change, change.expectedUpdatedAt);
    else if (method === 'DELETE') data = await fakeDeleteLead(id);
    return { ...result, data: data as T };
  }
}
