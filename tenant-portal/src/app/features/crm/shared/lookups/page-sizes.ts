import { getCrmStaticData } from '../../settings/static-data/static-data.api';
import { crmQueries } from '../crm-http';

/** No scope headers: reuse the CRM static-data catalogue and its pagination policy. */
export function listPageSizes(): Promise<{ pageSizes: number[]; defaultPageSize: number }> {
  return crmQueries().fetchQuery({
    queryKey: ['crm-lookups', 'page-sizes'],
    queryFn: async () => {
      const { pageSizes, defaultPageSize } = (await getCrmStaticData()).pagination;
      return { pageSizes, defaultPageSize };
    },
  });
}
