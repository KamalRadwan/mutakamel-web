import { inject } from '@angular/core';
import { ApiError } from '../../../../core/api/api-errors';
import { CoreHttp } from '../../../../core/api/core-http';
import { newIdempotencyKey } from '../../../../core/api/idempotency';
import { crmQueries } from '../../shared/crm-http';
import { runInCrm } from '../../shared/crm-runtime';
import { sessionBranch } from '../../shared/lookups/session-branch';
import type { OpportunityRelatedCounts } from '../opportunities.model';

interface TradeCountsResponse {
  items: (OpportunityRelatedCounts & { opportunityId: string })[];
}

/** No scope headers: the gateway row has no organizationScopeMode (as on quotations GET). */
export async function getTradeCounts(id: string): Promise<OpportunityRelatedCounts | null> {
  const scope = sessionBranch();
  if (!scope) return null;
  const http = runInCrm(() => inject(CoreHttp));
  return crmQueries().fetchQuery({
    queryKey: ['crm-opportunities', 'trade-counts', scope, id],
    queryFn: async () => {
      try {
        const { data } = await http.write<TradeCountsResponse>(
          'POST', '/api/tenant/trade/v1/documents/counts-by-crm-opportunity',
          { opportunityIds: [id] }, { bare: true, key: newIdempotencyKey() },
        );
        const item = data.items.find((item) => item.opportunityId === id);
        return item ? { quotations: item.quotations, salesOrders: item.salesOrders } : null;
      } catch (error) {
        if (error instanceof ApiError && error.status === 403) return null;
        throw error;
      }
    },
  });
}
