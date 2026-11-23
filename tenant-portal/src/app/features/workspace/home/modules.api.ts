import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { AppModule, AppsOverviewResponse } from './modules.model';

// GET /api/tenant/core/v1/apps/overview (authenticated, no permission)
export async function getAppsOverview(http: HttpClient): Promise<AppsOverviewResponse> {
  const response = await firstValueFrom(http.get<{ success: true; data: AppsOverviewResponse }>(
    '/api/tenant/core/v1/apps/overview',
    { withCredentials: true },
  ));
  if (response?.success !== true || !Array.isArray(response.data?.items)) {
    throw new Error('Invalid apps overview response');
  }
  return response.data;
}

export async function listModules(http: HttpClient): Promise<AppModule[]> {
  const { items } = await getAppsOverview(http);
  const groups: Record<AppsOverviewResponse['items'][number]['group'], AppModule['group']> = {
    SUBSCRIBED: 'subscribed',
    AVAILABLE: 'available',
    FUTURE: 'future',
  };
  return items.map((item) => ({
    id: item.moduleKey,
    group: groups[item.group],
  }));
}
