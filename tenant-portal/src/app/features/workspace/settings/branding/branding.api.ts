import { Service, inject } from '@angular/core';
import { QueryClient } from '@tanstack/angular-query';
import { ApiError } from '../../../../core/api/api-errors';
import { CoreHttp } from '../../../../core/api/core-http';
import { AuthSession } from '../../../../core/auth/auth-session';
import {
  Branding,
  BrandingAssetKind,
  EMPTY_BRANDING,
  UpdateBrandingBody,
  normaliseHex,
} from './branding.model';

const PATH = '/api/tenant/core/v1/branding';

function normaliseBrandingResponse(data: unknown): Branding {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new ApiError(502, 'COMMON.GENERIC.INTERNAL_ERROR');
  }
  const result = { ...EMPTY_BRANDING };
  for (const key of Object.keys(result) as (keyof Branding)[]) {
    if (!(key in data)) continue;
    const value = (data as Record<string, unknown>)[key];
    if (key === 'hasLogo' || key === 'hasIcon') {
      if (typeof value !== 'boolean') throw new ApiError(502, 'COMMON.GENERIC.INTERNAL_ERROR');
      result[key] = value;
    } else {
      if (value !== null && typeof value !== 'string')
        throw new ApiError(502, 'COMMON.GENERIC.INTERNAL_ERROR');
      result[key] = value;
    }
  }
  result.primaryColor = normaliseHex(result.primaryColor ?? '') ?? result.primaryColor;
  result.secondaryColor = normaliseHex(result.secondaryColor ?? '') ?? result.secondaryColor;
  return result;
}

@Service()
export class BrandingApi {
  private readonly http = inject(CoreHttp);
  private readonly session = inject(AuthSession);
  private readonly queries = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0, networkMode: 'always' } },
  });

  getBranding(): Promise<Branding> {
    return this.queries.fetchQuery({
      queryKey: this.queryKey(),
      queryFn: async () => normaliseBrandingResponse(await this.http.read<unknown>(PATH)),
    });
  }

  async updateBranding(body: UpdateBrandingBody, key: string): Promise<Branding> {
    const queryKey = this.queryKey();
    const result = await this.http.write<unknown>('PUT', PATH, body, { key });
    const branding = normaliseBrandingResponse(result.data);
    await this.queries.invalidateQueries({ queryKey });
    return branding;
  }

  uploadBrandingLogo(file: File, key: string): Promise<Branding> {
    return this.upload('logo', file, key);
  }

  uploadBrandingIcon(file: File, key: string): Promise<Branding> {
    return this.upload('icon', file, key);
  }

  removeBrandingLogo(key: string): Promise<void> {
    return this.remove('logo', key);
  }

  removeBrandingIcon(key: string): Promise<void> {
    return this.remove('icon', key);
  }

  private queryKey(): readonly unknown[] {
    return ['ws-branding', this.session.me()?.id];
  }

  private async upload(kind: BrandingAssetKind, file: File, key: string): Promise<Branding> {
    const queryKey = this.queryKey();
    const form = new FormData();
    form.append('file', file, file.name);
    const result = await this.http.writeMultipart<unknown>(`${PATH}/${kind}`, form, { key });
    const branding = normaliseBrandingResponse(result.data);
    await this.queries.invalidateQueries({ queryKey });
    return branding;
  }

  private async remove(kind: BrandingAssetKind, key: string): Promise<void> {
    const queryKey = this.queryKey();
    await this.http.write<void>('DELETE', `${PATH}/${kind}`, undefined, { key, noBody: true });
    await this.queries.invalidateQueries({ queryKey });
  }
}
