import { inject, Service } from '@angular/core';
import { QueryClient } from '@tanstack/angular-query';
import { TenantScopeState } from '../../../../core/scope/tenant-scope';
import { fakeGetDirectorySettings, fakeUpdateDirectorySettings } from './directory-settings.fake';
import { DirectorySettingsPatch, DirectorySettingsResult } from './directory-settings.model';

export * from './directory-settings.model';

const SETTINGS_QUERY_KEY = 'workspace-directory-settings';

@Service()
export class DirectorySettingsApi {
  private readonly scope = inject(TenantScopeState);
  private readonly queries = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0, networkMode: 'always' } },
  });

  getDirectorySettings(): Promise<DirectorySettingsResult> {
    // FAKE-ONLY until BE-DIR is merged: GET/PATCH /api/tenant/core/v1/directory/settings (version + If-Match)
    return this.queries.fetchQuery({
      queryKey: [SETTINGS_QUERY_KEY, this.scope.me()?.id],
      queryFn: async () => {
        const settings = await fakeGetDirectorySettings();
        return { settings, etag: `"${settings.version}"` };
      },
    });
  }

  async updateDirectorySettings(patch: DirectorySettingsPatch, ifMatch: string): Promise<DirectorySettingsResult> {
    // FAKE-ONLY until BE-DIR is merged: GET/PATCH /api/tenant/core/v1/directory/settings (version + If-Match)
    const settings = await fakeUpdateDirectorySettings(patch, ifMatch);
    await this.queries.cancelQueries({ queryKey: [SETTINGS_QUERY_KEY] });
    await this.queries.invalidateQueries({ queryKey: [SETTINGS_QUERY_KEY] });
    return { settings, etag: `"${settings.version}"` };
  }
}
