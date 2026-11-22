import { ApiError, checkRequiredText, crmValidationFailed, fakeDelay, fakeId } from '../shared/settings-api';
import { TAG_PRESETS } from './tag-colors';
import { CreateTagInput, MAX_DETACH_LEADS, MAX_TAG_NAME_LENGTH, MAX_TAGS, Tag, UpdateTagInput } from './tags.model';

const PRESET_BY_KEY = new Map(TAG_PRESETS.map((preset) => [preset.key, preset]));

interface SeedEntry {
  id: string;
  name: string;
  presetKey: string | null;
  leads: number;
  daysAgo: number;
}

const SEEDS: readonly SeedEntry[] = [
  { id: 'tag-001', name: 'VIP', presetKey: 'amberStrong', leads: 18, daysAgo: 2 },
  { id: 'tag-002', name: 'Hot lead', presetKey: 'redStrong', leads: 140, daysAgo: 1 },
  { id: 'tag-003', name: 'عميل مميز', presetKey: 'purple', leads: 12, daysAgo: 4 },
  { id: 'tag-004', name: 'Follow up', presetKey: 'blue', leads: 20, daysAgo: 3 },
  { id: 'tag-005', name: 'Partner', presetKey: 'teal', leads: 8, daysAgo: 7 },
  { id: 'tag-006', name: 'Wholesale', presetKey: 'slate', leads: 15, daysAgo: 10 },
  { id: 'tag-007', name: 'Government', presetKey: 'indigoStrong', leads: 6, daysAgo: 14 },
  { id: 'tag-008', name: 'Trial', presetKey: 'lime', leads: 11, daysAgo: 5 },
  { id: 'tag-009', name: 'Expo 2026', presetKey: 'orange', leads: 19, daysAgo: 6 },
  { id: 'tag-010', name: 'Lost price', presetKey: null, leads: 4, daysAgo: 18 },
];

const DAY_MS = 24 * 60 * 60 * 1000;

function createSeedState(): { tags: Tag[]; leadUsage: Map<string, number> } {
  const now = Date.now();
  const leadUsage = new Map<string, number>();
  const tags = SEEDS.map((seed): Tag => {
    const preset = seed.presetKey ? PRESET_BY_KEY.get(seed.presetKey) : undefined;
    const timestamp = new Date(now - seed.daysAgo * DAY_MS).toISOString();
    leadUsage.set(seed.id, seed.leads);
    return {
      id: seed.id,
      name: seed.name,
      backgroundColor: preset?.bg ?? null,
      textColor: preset?.text ?? null,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
  });
  return { tags, leadUsage };
}

const state = createSeedState();
let tags: Tag[] = state.tags;
const leadUsage = state.leadUsage;

function cloneTag(tag: Tag): Tag {
  return { ...tag };
}

const TAG_COLOR_PATTERN = /^#[0-9A-F]{6}$/;

/**
 * Create/UpdateTagDto through the ValidationPipe (400 CRM_VALIDATION_FAILED, before any service check): name
 * trimmed @IsNotEmpty @MaxLength(60); colours trimmed + upper-cased then @Matches(#RRGGBB). On update a colour
 * may be null (clears) and the name is optional.
 */
function assertTagBody(body: { name?: unknown; backgroundColor?: unknown; textColor?: unknown }, partial: boolean): void {
  const details: Record<string, string[]> = {};
  if (!(body.name === undefined && partial)) {
    checkRequiredText(details, 'name', typeof body.name === 'string' ? body.name.trim() : body.name, MAX_TAG_NAME_LENGTH);
  }
  for (const field of ['backgroundColor', 'textColor'] as const) {
    const value = body[field];
    if (value === undefined || (partial && value === null)) continue;
    if (typeof value !== 'string') details[field] = ['is_string'];
    else if (!TAG_COLOR_PATTERN.test(value.trim().toUpperCase())) details[field] = ['matches'];
  }
  if (Object.keys(details).length > 0) throw crmValidationFailed(details);
}

function canonicalColor(value: string | null | undefined): string | null | undefined {
  return typeof value === 'string' ? value.trim().toUpperCase() : value;
}

/**
 * TagsService.colorPair: both omitted → undefined (leave as is); both null/omitted-as-null → cleared; anything
 * half-set → 422 CRM_TAG_COLOR_INCOMPLETE. Checked on the request only, never merged with the stored pair.
 */
function colorPair(bg: string | null | undefined, text: string | null | undefined): { backgroundColor: string | null; textColor: string | null } | undefined {
  if (bg === undefined && text === undefined) return undefined;
  if ((bg ?? null) === null && (text ?? null) === null) return { backgroundColor: null, textColor: null };
  if (typeof bg !== 'string' || typeof text !== 'string') {
    throw new ApiError(422, 'CRM_TAG_COLOR_INCOMPLETE');
  }
  return { backgroundColor: bg, textColor: text };
}

function isNameTaken(trimmedName: string, excludeId?: string): boolean {
  const lower = trimmedName.toLowerCase();
  return tags.some((tag) => tag.id !== excludeId && tag.name.trim().toLowerCase() === lower);
}

/** GET /api/tenant/crm/v1/tags */
export async function fakeListTags(): Promise<Tag[]> {
  await fakeDelay();
  return [...tags]
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
    .map(cloneTag);
}

/** POST /api/tenant/crm/v1/tags */
export async function fakeCreateTag(input: CreateTagInput): Promise<Tag> {
  await fakeDelay();
  assertTagBody(input, false);
  const trimmedName = input.name.trim();
  // TagsService.create: colour pair, then catalogue limit, then name.
  const color = colorPair(canonicalColor(input.backgroundColor), canonicalColor(input.textColor)) ?? {
    backgroundColor: null,
    textColor: null,
  };
  if (tags.length >= MAX_TAGS) {
    throw new ApiError(422, 'CRM_TAG_LIMIT_EXCEEDED');
  }
  if (isNameTaken(trimmedName)) {
    throw new ApiError(409, 'CRM_TAG_NAME_TAKEN');
  }
  const bg = color.backgroundColor;
  const text = color.textColor;

  const now = new Date().toISOString();
  const created: Tag = {
    id: fakeId(),
    name: trimmedName,
    backgroundColor: bg,
    textColor: text,
    createdAt: now,
    updatedAt: now,
  };
  tags = [...tags, created];
  leadUsage.set(created.id, 0);
  return cloneTag(created);
}

/** PATCH /api/tenant/crm/v1/tags/:id */
export async function fakeUpdateTag(id: string, patch: UpdateTagInput): Promise<Tag> {
  await fakeDelay();
  assertTagBody(patch, true);
  // TagsService.update: empty body, then colour pair (request only), then 404, then name.
  const name = patch.name?.trim();
  const color = colorPair(canonicalColor(patch.backgroundColor), canonicalColor(patch.textColor));
  if (name === undefined && color === undefined) {
    throw new ApiError(422, 'CRM_TAG_UPDATE_EMPTY');
  }

  const existing = tags.find((tag) => tag.id === id);
  if (!existing) {
    throw new ApiError(404, 'CRM_TAG_NOT_FOUND');
  }

  if (name !== undefined && isNameTaken(name, id)) {
    throw new ApiError(409, 'CRM_TAG_NAME_TAKEN');
  }
  const nextName = name ?? existing.name;
  const nextBg = color ? color.backgroundColor : existing.backgroundColor;
  const nextText = color ? color.textColor : existing.textColor;

  const updated: Tag = {
    ...existing,
    name: nextName,
    backgroundColor: nextBg,
    textColor: nextText,
    updatedAt: new Date().toISOString(),
  };
  tags = tags.map((tag) => (tag.id === id ? updated : tag));
  return cloneTag(updated);
}

/** DELETE /api/tenant/crm/v1/tags/:id */
export async function fakeDeleteTag(id: string): Promise<void> {
  await fakeDelay();
  const existing = tags.find((tag) => tag.id === id);
  if (!existing) {
    throw new ApiError(404, 'CRM_TAG_NOT_FOUND');
  }

  const count = leadUsage.get(id) ?? 0;
  if (count > MAX_DETACH_LEADS) {
    throw new ApiError(422, 'CRM_TAG_DETACH_LIMIT_EXCEEDED', { count: [String(count)] });
  }

  tags = tags.filter((tag) => tag.id !== id);
  leadUsage.delete(id);
}
