import type { CoreWriteMethod } from '../../../../core/api/core-http';
import type { CrmWriteOptions } from '../../shared/crm-http';
import { CrmHttpStub } from '../../shared/testing/crm-http-testing';
import type { BoardLane, LeadRow, LeadStage, Page } from '../leads.model';

export const CONTRACT_ROW: LeadRow = {
  id: 'lead', leadProfileType: 'INDIVIDUAL', displayName: 'Lead', companyName: null,
  companyPhone: null, companyEmail: null, email: null, primaryMobile: null, phones: [],
  stageId: 'new', stageFlag: 'NEW', status: 'OPEN', rating: 1, cardColor: null,
  owner: { userId: 'owner', firstName: 'Owner', lastName: null, avatarUrl: '/avatar.png' },
  nextActivity: null, acquisitionSource: null, address: null, primaryContact: null, interestSummary: null,
  tags: [], updatedAt: '2026-11-23T00:00:00.000Z',
};
export const CONTRACT_STAGES: LeadStage[] = [
  { id: 'new', flag: 'NEW', nameEn: 'New', nameAr: 'جديد', sortOrder: 0, isActive: true },
  { id: 'qualified', flag: 'QUALIFIED', nameEn: 'Qualified', nameAr: 'مؤهل', sortOrder: 1, isActive: true },
  { id: 'disqualified', flag: 'DISQUALIFIED', nameEn: 'Disqualified', nameAr: 'غير مؤهل', sortOrder: 2, isActive: true },
];
export function contractPage(page = 1, items: LeadRow[] = [{ ...CONTRACT_ROW }]): Page<LeadRow> {
  return { items, page, total: 51, limit: 50, totalPages: 2, hasNext: page === 1, hasPrev: page > 1 };
}
export function contractLane(index = 0): BoardLane {
  return { ...contractPage(), stage: CONTRACT_STAGES[index], items: index === 0 ? [{ ...CONTRACT_ROW }] : [] };
}

export class ListContractHttp extends CrmHttpStub {
  failures = new Map<string, unknown>();
  search = (page: number) => contractPage(page);
  nextLane = { ...contractLane(), ...contractPage(2, [{ ...CONTRACT_ROW, id: 'next' }]) };

  override async write<T>(method: CoreWriteMethod, path: string, body: unknown, options: CrmWriteOptions) {
    const result = await super.write<T>(method, path, body, options);
    if (this.failures.has(path)) throw this.failures.get(path);
    let data: unknown = result.data;
    if (path === '/leads/search') data = this.search((body as { page: number }).page);
    else if (path === '/leads/board') data = { stages: CONTRACT_STAGES.map((_, index) => contractLane(index)) };
    else if (path.startsWith('/leads/board/stages/')) data = this.nextLane;
    else if (method === 'PATCH') data = { ...CONTRACT_ROW, ...body as object };
    return { ...result, data: data as T };
  }
}
