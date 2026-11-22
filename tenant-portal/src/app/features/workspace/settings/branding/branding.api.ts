import { fakeGetBranding, fakeUpdateBranding, fakeUploadBrandingAsset } from './branding.fake';
import { Branding, UpdateBrandingBody } from './branding.model';

function normaliseBrandingResponse(raw: Partial<Branding> | null | undefined): Branding {
  return {
    id: raw?.id ?? null,
    primaryColor: raw?.primaryColor ?? null,
    secondaryColor: raw?.secondaryColor ?? null,
    fontFamily: raw?.fontFamily ?? null,
    appName: raw?.appName ?? null,
    tabTitle: raw?.tabTitle ?? null,
    loginHtml: raw?.loginHtml ?? null,
    hasLogo: Boolean(raw?.hasLogo),
    hasIcon: Boolean(raw?.hasIcon),
    logoUrl: raw?.logoUrl ?? null,
    iconUrl: raw?.iconUrl ?? null,
    createdAt: raw?.createdAt ?? null,
    updatedAt: raw?.updatedAt ?? null,
  };
}

export async function getBranding(): Promise<Branding> {
  // GET /api/v1/tenant/branding [branding.read]
  const raw = await fakeGetBranding();
  return normaliseBrandingResponse(raw);
}

export function updateBranding(body: UpdateBrandingBody, idempotencyKey: string): Promise<Branding> {
  // PUT /api/v1/tenant/branding [branding.manage, tenant-wide] (x-idempotency-key)
  return fakeUpdateBranding(body, idempotencyKey);
}

export function uploadBrandingLogo(file: File, idempotencyKey: string): Promise<Branding> {
  // POST /api/v1/tenant/branding/logo [branding.manage, tenant-wide] multipart "file" (x-idempotency-key)
  // -> the branding object itself (BrandingService.setLogo); a replay returns the same object
  const form = new FormData();
  form.append('file', file, file.name);
  return fakeUploadBrandingAsset('logo', form, idempotencyKey);
}

export function uploadBrandingIcon(file: File, idempotencyKey: string): Promise<Branding> {
  // POST /api/v1/tenant/branding/icon [branding.manage, tenant-wide] multipart "file" (x-idempotency-key)
  // -> the branding object itself (BrandingService.setIcon); a replay returns the same object
  const form = new FormData();
  form.append('file', file, file.name);
  return fakeUploadBrandingAsset('icon', form, idempotencyKey);
}
