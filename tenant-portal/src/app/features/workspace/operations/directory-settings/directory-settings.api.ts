import { inject, Service } from '@angular/core';
import { QueryClient } from '@tanstack/angular-query';
import { ApiError } from '../../../../core/api/api-errors';
import { CoreHttp } from '../../../../core/api/core-http';
import { TenantScopeState } from '../../../../core/scope/tenant-scope';
import { DirectorySettings, DirectorySettingsPatch, DirectorySettingsResult } from './directory-settings.model';

export * from './directory-settings.model';

const SETTINGS_QUERY_KEY = 'workspace-directory-settings';
const SETTINGS_PATH = '/api/tenant/core/v1/directory/settings';

@Service()
export class DirectorySettingsApi {
  private readonly http = inject(CoreHttp);
  private readonly scope = inject(TenantScopeState);
  private readonly queries = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0, networkMode: 'always' } },
  });

  getDirectorySettings(): Promise<DirectorySettingsResult> {
    return this.queries.fetchQuery({
      queryKey: [SETTINGS_QUERY_KEY, this.scope.me()?.id],
      queryFn: async () => {
        const result = await this.http.readWithEtag<DirectorySettings>(SETTINGS_PATH);
        return settingsResult(result.data, result.etag);
      },
    });
  }

  async updateDirectorySettings(patch: DirectorySettingsPatch, ifMatch: string): Promise<DirectorySettingsResult> {
    const response = await this.http.write<DirectorySettings>('PATCH', SETTINGS_PATH, patch, { ifMatch });
    const result = settingsResult(response.data, response.etag);
    await this.queries.cancelQueries({ queryKey: [SETTINGS_QUERY_KEY] });
    await this.queries.invalidateQueries({ queryKey: [SETTINGS_QUERY_KEY] });
    return result;
  }
}

function settingsResult(settings: DirectorySettings, etag: string | null): DirectorySettingsResult {
  const version = settings?.version;
  if (!Number.isSafeInteger(version) || version < 1) {
    throw new ApiError(502, 'COMMON.GENERIC.INTERNAL_ERROR');
  }

  // The Directory API's If-Match token is the numeric settings version. A proxy
  // may omit its ETag or replace it with a cache validator for the response.
  const versionTag = `"${version}"`;
  if (etag && /^"[1-9]\d*"$/.test(etag) && etag !== versionTag) {
    throw new ApiError(502, 'COMMON.GENERIC.INTERNAL_ERROR');
  }
  return { settings, etag: versionTag };
}
