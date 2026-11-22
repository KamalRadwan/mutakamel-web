import { fakeGetAppsOverview } from './modules.fake';
import { AppModule, AppsOverviewResponse } from './modules.model';

// GET /api/tenant/core/v1/apps/overview (authenticated, no permission)
export function getAppsOverview(): Promise<AppsOverviewResponse> {
  return fakeGetAppsOverview();
}

export async function listModules(): Promise<AppModule[]> {
  const { items } = await getAppsOverview();
  return items.map((item) => ({
    id: item.moduleKey,
    group: item.group.toLowerCase() as AppModule['group'],
  }));
}
