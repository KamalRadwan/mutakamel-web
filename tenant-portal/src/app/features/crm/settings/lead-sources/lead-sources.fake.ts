import { ApiError, checkRequiredText, crmValidationFailed, fakeDelay, fakeId } from '../shared/settings-api';
import {
  CreateLeadSourceInput,
  LEAD_SOURCE_ICON_MAX_BYTES,
  LEAD_SOURCE_LIMIT,
  LEAD_SOURCE_NAME_MAX,
  LeadSource,
  UpdateLeadSourceInput,
} from './lead-sources.model';

function svgIcon(bg: string, glyph: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><rect width="24" height="24" rx="6" fill="${bg}"/>${glyph}</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

const ICON_WEBSITE = svgIcon(
  '#1d56c9',
  '<circle cx="12" cy="12" r="5.5" fill="none" stroke="#fff" stroke-width="1.6"/><path d="M6.5 12h11M12 6.5a8 8 0 0 1 0 11M12 6.5a8 8 0 0 0 0 11" fill="none" stroke="#fff" stroke-width="1.4"/>',
);
const ICON_FACEBOOK = svgIcon(
  '#1877f2',
  '<path d="M13.5 18v-5.5h1.8l.3-2.2h-2.1V8.9c0-.6.2-1.1 1.1-1.1h1.1V5.8c-.5-.1-1.1-.1-1.7-.1-1.7 0-2.8 1-2.8 2.9v1.7H9.4v2.2h1.8V18h2.3z" fill="#fff"/>',
);
const ICON_INSTAGRAM = svgIcon(
  '#c13584',
  '<rect x="6.5" y="6.5" width="11" height="11" rx="3" fill="none" stroke="#fff" stroke-width="1.6"/><circle cx="12" cy="12" r="2.6" fill="none" stroke="#fff" stroke-width="1.6"/><circle cx="15.3" cy="8.7" r="0.8" fill="#fff"/>',
);
const ICON_LINKEDIN = svgIcon(
  '#0a66c2',
  '<circle cx="8" cy="8" r="1.1" fill="#fff"/><path d="M7.1 10.6v6.2M10.6 10.6v6.2M10.6 13.1c0-1.5 1-2.5 2.4-2.5 1.3 0 2.1.9 2.1 2.4v3.8" fill="none" stroke="#fff" stroke-width="1.7" stroke-linecap="round"/>',
);
const ICON_WHATSAPP = svgIcon(
  '#067d4d',
  '<path d="M12 6a6 6 0 0 0-5.2 9l-.8 3 3.1-.8A6 6 0 1 0 12 6z" fill="none" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/><path d="M10 9.8c.2-.3.5-.3.7 0l.7 1c.1.2.1.4 0 .6l-.4.4c.5.9 1.2 1.6 2.1 2.1l.4-.4c.2-.1.4-.1.6 0l1 .7c.3.2.3.5 0 .7-.5.5-1.3.7-2 .4a6.5 6.5 0 0 1-3.5-3.5c-.3-.7-.1-1.5.4-2z" fill="#fff"/>',
);
const ICON_TIKTOK = svgIcon(
  '#12141c',
  '<path d="M13.6 6.2v8a2.6 2.6 0 1 1-1.8-2.5" fill="none" stroke="#fff" stroke-width="1.7" stroke-linecap="round"/><path d="M13.6 6.2c.6 1.7 1.8 2.8 3.6 3" fill="none" stroke="#fff" stroke-width="1.7" stroke-linecap="round"/>',
);
const ICON_GOOGLE_ADS = svgIcon(
  '#b45309',
  '<path d="M7.2 16.5l4.8-9.2 4.8 9.2" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><circle cx="7.4" cy="16.2" r="1.5" fill="#fff"/>',
);
const ICON_EMAIL = svgIcon(
  '#0f2f78',
  '<rect x="6" y="7.5" width="12" height="9" rx="1.6" fill="none" stroke="#fff" stroke-width="1.6"/><path d="M6.5 8.5l5.5 4 5.5-4" fill="none" stroke="#fff" stroke-width="1.5" stroke-linejoin="round"/>',
);
const ICON_REFERRAL = svgIcon(
  '#0b7a85',
  '<circle cx="9" cy="9" r="2.2" fill="none" stroke="#fff" stroke-width="1.6"/><circle cx="15.5" cy="10" r="1.8" fill="none" stroke="#fff" stroke-width="1.6"/><path d="M5.5 17a3.5 3.5 0 0 1 7 0M13 17a2.8 2.8 0 0 1 5.5 0" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/>',
);
const ICON_PHONE = svgIcon(
  '#1d56c9',
  '<path d="M8.2 6.8l2.1 2.1-1.2 1.4a8.2 8.2 0 0 0 4.6 4.6l1.4-1.2 2.1 2.1-1.1 1.3c-.6.7-1.6.9-2.5.6A11 11 0 0 1 6.3 10.4c-.3-.9-.1-1.9.6-2.5l1.3-1.1z" fill="none" stroke="#fff" stroke-width="1.5" stroke-linejoin="round"/>',
);
const ICON_WALK_IN = svgIcon(
  '#6b3fc4',
  '<circle cx="12" cy="7.5" r="1.6" fill="#fff"/><path d="M11.5 10.2l-1.5 4.2M11.5 10.2l2.5 2 1.8.6M10 14.4l-1.8 3.2M12.4 13.8l1.6 3.8" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>',
);
const ICON_OFFLINE = svgIcon(
  '#3c4257',
  '<ellipse cx="12" cy="8" rx="4.8" ry="1.8" fill="none" stroke="#fff" stroke-width="1.5"/><path d="M7.2 8v4c0 1 2.1 1.8 4.8 1.8s4.8-.8 4.8-1.8V8M7.2 12v4c0 1 2.1 1.8 4.8 1.8s4.8-.8 4.8-1.8v-4" fill="none" stroke="#fff" stroke-width="1.5"/>',
);

const ALLOWED_ICON_EXTENSIONS: Readonly<Record<string, readonly string[]>> = {
  'image/png': ['.png'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/x-icon': ['.ico'],
  'image/vnd.microsoft.icon': ['.ico'],
};

const EXTENSION_TO_MIME: Readonly<Record<string, string>> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
};

const USED_SOURCE_IDS = new Set([
  '00000000-0000-7000-8000-000000000001',
  '00000000-0000-7000-8000-000000000002',
  '00000000-0000-7000-8000-000000000003',
]);

const SEED_TIME = '2026-10-01T09:00:00.000Z';

let sources: LeadSource[] = [
  { id: '00000000-0000-7000-8000-000000000001', nameAr: 'الموقع الإلكتروني', nameEn: 'Website', isActive: true, sortOrder: 1, iconUrl: ICON_WEBSITE, createdAt: SEED_TIME, updatedAt: SEED_TIME },
  { id: '00000000-0000-7000-8000-000000000002', nameAr: 'فيسبوك', nameEn: 'Facebook', isActive: true, sortOrder: 2, iconUrl: ICON_FACEBOOK, createdAt: SEED_TIME, updatedAt: SEED_TIME },
  { id: '00000000-0000-7000-8000-000000000003', nameAr: 'إنستغرام', nameEn: 'Instagram', isActive: true, sortOrder: 3, iconUrl: ICON_INSTAGRAM, createdAt: SEED_TIME, updatedAt: SEED_TIME },
  { id: '00000000-0000-7000-8000-000000000004', nameAr: 'لينكدإن', nameEn: 'LinkedIn', isActive: true, sortOrder: 4, iconUrl: ICON_LINKEDIN, createdAt: SEED_TIME, updatedAt: SEED_TIME },
  { id: '00000000-0000-7000-8000-000000000005', nameAr: 'واتساب', nameEn: 'WhatsApp', isActive: true, sortOrder: 5, iconUrl: ICON_WHATSAPP, createdAt: SEED_TIME, updatedAt: SEED_TIME },
  { id: '00000000-0000-7000-8000-000000000006', nameAr: 'تيك توك', nameEn: 'TikTok', isActive: true, sortOrder: 6, iconUrl: ICON_TIKTOK, createdAt: SEED_TIME, updatedAt: SEED_TIME },
  { id: '00000000-0000-7000-8000-000000000007', nameAr: 'إعلانات جوجل', nameEn: 'Google Ads', isActive: true, sortOrder: 7, iconUrl: ICON_GOOGLE_ADS, createdAt: SEED_TIME, updatedAt: SEED_TIME },
  { id: '00000000-0000-7000-8000-000000000008', nameAr: 'حملة بريد إلكتروني', nameEn: 'Email Campaign', isActive: true, sortOrder: 8, iconUrl: ICON_EMAIL, createdAt: SEED_TIME, updatedAt: SEED_TIME },
  { id: '00000000-0000-7000-8000-000000000009', nameAr: 'إحالة', nameEn: 'Referral', isActive: true, sortOrder: 9, iconUrl: ICON_REFERRAL, createdAt: SEED_TIME, updatedAt: SEED_TIME },
  { id: '00000000-0000-7000-8000-00000000000a', nameAr: 'مكالمة هاتفية', nameEn: 'Phone Call', isActive: true, sortOrder: 10, iconUrl: ICON_PHONE, createdAt: SEED_TIME, updatedAt: SEED_TIME },
  { id: '00000000-0000-7000-8000-00000000000b', nameAr: 'زيارة مباشرة', nameEn: 'Walk-in', isActive: true, sortOrder: 11, iconUrl: ICON_WALK_IN, createdAt: SEED_TIME, updatedAt: SEED_TIME },
  { id: '00000000-0000-7000-8000-00000000000c', nameAr: 'بيانات غير متصلة', nameEn: 'Offline Data', isActive: true, sortOrder: 12, iconUrl: ICON_OFFLINE, createdAt: SEED_TIME, updatedAt: SEED_TIME },
];

function revokeBlobUrl(url: string | null | undefined): void {
  if (url?.startsWith('blob:') && typeof URL.revokeObjectURL === 'function') {
    URL.revokeObjectURL(url);
  }
}

function clone(source: LeadSource): LeadSource {
  return { ...source };
}

function sortedCopies(): LeadSource[] {
  return sources.slice().sort((a, b) => a.sortOrder - b.sortOrder).map(clone);
}

function ensureUniqueNames(nameAr: string | undefined, nameEn: string | undefined, excludeId?: string): void {
  const arNorm = nameAr?.trim().toLowerCase();
  const enNorm = nameEn?.trim().toLowerCase();
  const conflict = sources.some((item) => {
    if (item.id === excludeId) return false;
    if (arNorm && item.nameAr.trim().toLowerCase() === arNorm) return true;
    if (enNorm && item.nameEn.trim().toLowerCase() === enNorm) return true;
    return false;
  });
  if (conflict) {
    throw new ApiError(409, 'CRM_ACQUISITION_SOURCE_NAME_TAKEN');
  }
}

function fileExtension(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot >= 0 ? name.slice(dot).toLowerCase() : '';
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve) => {
    if (typeof FileReader === 'undefined') {
      resolve(URL.createObjectURL(file));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      resolve(typeof reader.result === 'string' ? reader.result : URL.createObjectURL(file));
    };
    reader.onerror = () => resolve(URL.createObjectURL(file));
    reader.readAsDataURL(file);
  });
}

/** GET /api/tenant/crm/v1/acquisition-sources */
export async function fakeListLeadSources(): Promise<LeadSource[]> {
  await fakeDelay();
  return sortedCopies();
}

/** POST /api/tenant/crm/v1/acquisition-sources (201) */
export async function fakeCreateLeadSource(input: CreateLeadSourceInput): Promise<LeadSource> {
  await fakeDelay();
  // CreateAcquisitionSourceDto: @Transform(trim) @IsNotEmpty @MaxLength(120); the pipe runs before the service.
  const nameAr = input.nameAr.trim();
  const nameEn = input.nameEn.trim();
  const details: Record<string, string[]> = {};
  checkRequiredText(details, 'nameAr', nameAr, LEAD_SOURCE_NAME_MAX);
  checkRequiredText(details, 'nameEn', nameEn, LEAD_SOURCE_NAME_MAX);
  if (Object.keys(details).length > 0) throw crmValidationFailed(details);
  if (sources.length >= LEAD_SOURCE_LIMIT) {
    throw new ApiError(422, 'CRM_ACQUISITION_SOURCE_LIMIT_EXCEEDED');
  }
  ensureUniqueNames(nameAr, nameEn);

  const now = new Date().toISOString();
  const created: LeadSource = {
    id: fakeId(),
    nameAr,
    nameEn,
    isActive: input.isActive ?? true,
    sortOrder: sources.length + 1,
    iconUrl: null,
    createdAt: now,
    updatedAt: now,
  };
  sources = [...sources, created];
  return clone(created);
}

/** PATCH /api/tenant/crm/v1/acquisition-sources/:id */
export async function fakeUpdateLeadSource(id: string, changes: UpdateLeadSourceInput): Promise<LeadSource> {
  await fakeDelay();
  // UpdateAcquisitionSourceDto: optional names, trimmed, @IsNotEmpty @MaxLength(120); checked before the 404.
  const details: Record<string, string[]> = {};
  if (changes.nameAr !== undefined) checkRequiredText(details, 'nameAr', changes.nameAr.trim(), LEAD_SOURCE_NAME_MAX);
  if (changes.nameEn !== undefined) checkRequiredText(details, 'nameEn', changes.nameEn.trim(), LEAD_SOURCE_NAME_MAX);
  if (Object.keys(details).length > 0) throw crmValidationFailed(details);
  const existing = sources.find((item) => item.id === id);
  if (!existing) {
    throw new ApiError(404, 'CRM_ACQUISITION_SOURCE_NOT_FOUND');
  }

  const nextNameAr = changes.nameAr !== undefined ? changes.nameAr.trim() : existing.nameAr;
  const nextNameEn = changes.nameEn !== undefined ? changes.nameEn.trim() : existing.nameEn;

  ensureUniqueNames(
    changes.nameAr !== undefined ? nextNameAr : undefined,
    changes.nameEn !== undefined ? nextNameEn : undefined,
    id,
  );

  const updated: LeadSource = {
    ...existing,
    nameAr: nextNameAr,
    nameEn: nextNameEn,
    isActive: changes.isActive !== undefined ? changes.isActive : existing.isActive,
    updatedAt: new Date().toISOString(),
  };
  sources = sources.map((item) => (item.id === id ? updated : item));
  return clone(updated);
}

/** PATCH /api/tenant/crm/v1/acquisition-sources/reorder */
const UUID_V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Gateway idempotency check (api-gateway-app gateway-idempotency.service.ts): missing key, or not a UUID v7. */
function checkGatewayIdempotencyKey(key: string | undefined): void {
  if (!key) throw new ApiError(400, 'GW.IDEM.MISSING');
  if (!UUID_V7.test(key)) throw new ApiError(400, 'GW.IDEM.BAD_VALUE');
}

export async function fakeReorderLeadSources(orderedIds: readonly string[], idempotencyKey?: string): Promise<LeadSource[]> {
  await fakeDelay();
  checkGatewayIdempotencyKey(idempotencyKey);
  if (orderedIds.length !== sources.length || new Set(orderedIds).size !== sources.length) {
    throw new ApiError(422, 'CRM_ACQUISITION_SOURCE_REORDER_INVALID');
  }
  const byId = new Map(sources.map((item) => [item.id, item]));
  const next: LeadSource[] = [];
  const now = new Date().toISOString();
  for (let i = 0; i < orderedIds.length; i++) {
    const found = byId.get(orderedIds[i]);
    if (!found) {
      throw new ApiError(422, 'CRM_ACQUISITION_SOURCE_REORDER_INVALID');
    }
    next.push({ ...found, sortOrder: i + 1, updatedAt: found.sortOrder === i + 1 ? found.updatedAt : now });
  }
  sources = next;
  return sortedCopies();
}

/** DELETE /api/tenant/crm/v1/acquisition-sources/:id (204) */
export async function fakeDeleteLeadSource(id: string): Promise<void> {
  await fakeDelay();
  const existing = sources.find((item) => item.id === id);
  if (!existing) {
    throw new ApiError(404, 'CRM_ACQUISITION_SOURCE_NOT_FOUND');
  }
  if (USED_SOURCE_IDS.has(id)) {
    throw new ApiError(409, 'CRM_ACQUISITION_SOURCE_IN_USE');
  }
  revokeBlobUrl(existing.iconUrl);
  sources = sources
    .filter((item) => item.id !== id)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((item, index) => ({ ...item, sortOrder: index + 1 }));
}

/** POST /api/tenant/crm/v1/acquisition-sources/:id/icon (multipart field file, 201) */
export async function fakeUploadLeadSourceIcon(id: string, file: File, idempotencyKey?: string): Promise<LeadSource> {
  await fakeDelay();
  checkGatewayIdempotencyKey(idempotencyKey);
  const existing = sources.find((item) => item.id === id);
  if (!existing) {
    throw new ApiError(404, 'CRM_ACQUISITION_SOURCE_NOT_FOUND');
  }
  if (!file || file.size === 0) {
    throw new ApiError(400, 'CRM_ACQUISITION_SOURCE_ICON_EMPTY');
  }
  if (file.size > LEAD_SOURCE_ICON_MAX_BYTES) {
    throw new ApiError(413, 'CRM_ACQUISITION_SOURCE_ICON_TOO_LARGE');
  }

  const ext = fileExtension(file.name);
  const mime = file.type.trim().toLowerCase() || EXTENSION_TO_MIME[ext] || '';
  const allowedExtensions = ALLOWED_ICON_EXTENSIONS[mime];
  if (!allowedExtensions) {
    throw new ApiError(415, 'CRM_ACQUISITION_SOURCE_ICON_TYPE_UNSUPPORTED');
  }
  if (!allowedExtensions.includes(ext)) {
    throw new ApiError(415, 'CRM_ACQUISITION_SOURCE_ICON_EXTENSION_UNSUPPORTED');
  }

  const iconUrl = await readFileAsDataUrl(file);
  if (existing.iconUrl !== iconUrl) {
    revokeBlobUrl(existing.iconUrl);
  }
  const updated: LeadSource = {
    ...existing,
    iconUrl,
    updatedAt: new Date().toISOString(),
  };
  sources = sources.map((item) => (item.id === id ? updated : item));
  return clone(updated);
}
