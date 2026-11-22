import { ApiError, fakeDelay, fakeId } from '../shared/trade-api';
import { clone, nowIso } from '../shared/trade-foundation.fake';
import type { Page } from '../shared/trade-foundation.model';
import {
  FAKE_COLLEAGUE,
  FAKE_ME,
  type ScopeTarget,
  type WriteOptions,
  checkIfMatch,
  fakeIdem,
  getFakeActor,
  requireIdempotencyKey,
  requireIfMatch,
} from './automation-fake-actors';
import type {
  CreateExtensionProfileInput,
  ExtFieldEntity,
  ExtValidateDiagnostic,
  ExtValidateResult,
  ExtVersion,
  ExtVersionEntity,
  ExtensionDraftDiscardResult,
  ExtensionField,
  ExtensionFieldInput,
  ExtensionObjectProperty,
  ExtensionProfile,
  ExtensionProfileCounts,
  ExtensionProfileDraftResult,
  ExtensionProfileEntity,
  ExtensionProfileFilters,
  ExtensionProfilePublishResult,
  ExtensionProfileStatus,
  ExtensionScopeTarget,
  ListExtVersionsQuery,
  ListExtensionProfilesQuery,
} from './extensions.model';
import {
  EXTENSION_COLLECTION_SCHEMA,
  EXTENSION_OBJECT_SCHEMA,
  EXTENSION_REGISTRY_VERSION,
  EXTENSION_VALUE_SCHEMA_VERSION,
  type ExtensionScalarType,
  type ExtensionTargetCode,
  type ExtensionTargetsResponse,
  FIELD_KEY,
  OBJECT_PROPERTY_KEY,
  PROFILE_CODE_PATTERN,
  SCALAR_TYPES,
  TARGETS,
  TARGET_CODES,
  VALUE_KINDS,
  VISIBILITY,
  getExtensionTarget,
  isReservedKey,
} from './extensions.registry';

const idem = fakeIdem();

// ---------------------------------------------------------------------------
// Request context (the backend reads it from the scope headers)
// ---------------------------------------------------------------------------

interface FakeContext {
  target: ScopeTarget;
  companyId: string | null;
}

let context: FakeContext = { target: 'COMPANY', companyId: 'c1' };

/** Test hook: the scope the fake backend runs the next requests in. */
export function setFakeExtensionContext(next: FakeContext): void {
  context = { ...next };
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

interface StoredField extends ExtensionField {
  createdBy: string;
}

interface StoredVersion extends ExtVersionEntity {
  fields: StoredField[];
}

type StoredProfile = ExtensionProfileEntity;

const NO_HASH = '0'.repeat(64);

function seedField(
  id: string,
  ordinal: number,
  createdBy: string,
  field: Omit<ExtensionField, 'id' | 'ordinal'>,
): StoredField {
  return { id, ordinal, createdBy, ...field };
}

function scalar(
  fieldKey: string,
  scalarType: ExtensionScalarType,
  extra: Partial<ExtensionField> = {},
): Omit<ExtensionField, 'id' | 'ordinal'> {
  return {
    fieldKey,
    valueKind: 'SCALAR',
    scalarType,
    schemaCode: null,
    schemaVersion: null,
    isRequired: false,
    isSearchable: false,
    visibilityCode: 'USER',
    maxLength: null,
    maxItems: null,
    decimalScale: scalarType === 'DECIMAL' ? 8 : null,
    minimumDecimal: null,
    maximumDecimal: null,
    defaultStrategy: 'NONE',
    defaultValue: null,
    constraintPayload: {},
    ...extra,
  };
}

function buildSeedExtensions(): { profiles: StoredProfile[]; versions: StoredVersion[] } {
  const shelfLife = scalar('pkg.shelf_life_days', 'DECIMAL', {
    decimalScale: 0,
    minimumDecimal: '0',
    maximumDecimal: '3650',
    defaultStrategy: 'LITERAL',
    defaultValue: '30',
  });
  const storage: Omit<ExtensionField, 'id' | 'ordinal'> = {
    ...scalar('pkg.storage', 'STRING'),
    valueKind: 'OBJECT',
    scalarType: null,
    schemaCode: EXTENSION_OBJECT_SCHEMA,
    schemaVersion: EXTENSION_VALUE_SCHEMA_VERSION,
    constraintPayload: {
      properties: [
        {
          key: 'max_temp_c',
          scalarType: 'DECIMAL',
          isRequired: false,
          maxLength: null,
          decimalScale: 1,
          minimumDecimal: '-40',
          maximumDecimal: '60',
          allowedValues: null,
        },
        {
          key: 'zone',
          scalarType: 'ENUM',
          isRequired: true,
          maxLength: 32,
          decimalScale: null,
          minimumDecimal: null,
          maximumDecimal: null,
          allowedValues: ['AMBIENT', 'CHILLED', 'FROZEN'],
        },
      ],
    },
  };
  const fragile = scalar('pkg.fragile', 'BOOLEAN', {
    visibilityCode: 'EXTERNAL_SAFE',
    defaultStrategy: 'LITERAL',
    defaultValue: false,
  });
  const certifications: Omit<ExtensionField, 'id' | 'ordinal'> = {
    ...scalar('pkg.certifications', 'ENUM', {
      isSearchable: true,
      visibilityCode: 'EXTERNAL_SAFE',
      maxLength: 40,
      constraintPayload: { allowedValues: ['CE', 'FDA', 'HALAL', 'ISO_9001'] },
    }),
    valueKind: 'COLLECTION',
    schemaCode: EXTENSION_COLLECTION_SCHEMA,
    schemaVersion: EXTENSION_VALUE_SCHEMA_VERSION,
    maxItems: 10,
  };
  const incoterm = scalar('terms.incoterm', 'ENUM', {
    visibilityCode: 'EXTERNAL_SAFE',
    maxLength: 16,
    defaultStrategy: 'LITERAL',
    defaultValue: 'EXW',
    constraintPayload: { allowedValues: ['CIF', 'DDP', 'EXW', 'FOB'] },
  });
  const warranty = scalar('terms.warranty_months', 'DECIMAL', {
    decimalScale: 0,
    minimumDecimal: '0',
    maximumDecimal: '120',
    defaultStrategy: 'LITERAL',
    defaultValue: '12',
  });

  const versionBase = {
    registryVersion: EXTENSION_REGISTRY_VERSION,
    targetSchemaVersion: 1,
    definitionHash: NO_HASH,
    compatibilitySummary: {},
  };
  const itemSchema = 'trade.catalog-item.extensions';

  const profiles: StoredProfile[] = [
    {
      id: 'extp-item-extra',
      version: 5,
      code: 'ITEM_EXTRA',
      targetCode: 'CATALOG_ITEM',
      scopeTarget: 'COMPANY',
      companyId: 'c1',
      status: 'ACTIVE',
      currentPublishedVersionId: 'extv-item-2',
      createdBy: FAKE_COLLEAGUE,
      updatedBy: FAKE_ME,
      createdAt: '2026-04-10T08:00:00.000Z',
      updatedAt: '2026-11-18T11:30:00.000Z',
    },
    {
      id: 'extp-quote-terms',
      version: 2,
      code: 'QUOTE_TERMS',
      targetCode: 'QUOTATION',
      scopeTarget: 'COMPANY',
      companyId: 'c1',
      status: 'ACTIVE',
      currentPublishedVersionId: 'extv-quote-1',
      createdBy: FAKE_COLLEAGUE,
      updatedBy: FAKE_ME,
      createdAt: '2026-06-05T09:00:00.000Z',
      updatedAt: '2026-09-12T14:00:00.000Z',
    },
  ];

  const versions: StoredVersion[] = [
    {
      ...versionBase,
      id: 'extv-item-1',
      profileId: 'extp-item-extra',
      version: 2,
      versionNumber: 1,
      targetSchemaCode: itemSchema,
      status: 'SUPERSEDED',
      publishedAt: '2026-04-15T10:00:00.000Z',
      publishedBy: FAKE_COLLEAGUE,
      createdBy: FAKE_ME,
      updatedBy: FAKE_COLLEAGUE,
      createdAt: '2026-04-10T08:00:00.000Z',
      updatedAt: '2026-07-01T09:00:00.000Z',
      fields: [
        seedField('extf-item-1-v1', 1, FAKE_ME, shelfLife),
        seedField('extf-item-2-v1', 2, FAKE_ME, storage),
      ],
    },
    {
      ...versionBase,
      id: 'extv-item-2',
      profileId: 'extp-item-extra',
      version: 3,
      versionNumber: 2,
      targetSchemaCode: itemSchema,
      status: 'PUBLISHED',
      publishedAt: '2026-07-01T09:00:00.000Z',
      publishedBy: FAKE_ME,
      createdBy: FAKE_COLLEAGUE,
      updatedBy: FAKE_ME,
      createdAt: '2026-06-28T10:00:00.000Z',
      updatedAt: '2026-07-01T09:00:00.000Z',
      fields: [
        seedField('extf-item-1-pub', 1, FAKE_COLLEAGUE, shelfLife),
        seedField('extf-item-2-pub', 2, FAKE_COLLEAGUE, storage),
        seedField('extf-item-3-pub', 3, FAKE_COLLEAGUE, fragile),
      ],
    },
    {
      ...versionBase,
      id: 'extv-item-3',
      profileId: 'extp-item-extra',
      version: 1,
      versionNumber: 3,
      targetSchemaCode: itemSchema,
      status: 'DRAFT',
      publishedAt: null,
      publishedBy: null,
      createdBy: FAKE_ME,
      updatedBy: FAKE_ME,
      createdAt: '2026-11-18T11:30:00.000Z',
      updatedAt: '2026-11-18T11:30:00.000Z',
      fields: [
        seedField('extf-item-1-d3', 1, FAKE_ME, shelfLife),
        seedField('extf-item-2-d3', 2, FAKE_ME, storage),
        seedField('extf-item-3-d3', 3, FAKE_ME, fragile),
        seedField('extf-item-4-d3', 4, FAKE_ME, certifications),
      ],
    },
    {
      ...versionBase,
      id: 'extv-quote-1',
      profileId: 'extp-quote-terms',
      version: 2,
      versionNumber: 1,
      targetSchemaCode: 'trade.quotation.extensions',
      status: 'PUBLISHED',
      publishedAt: '2026-09-12T14:00:00.000Z',
      publishedBy: FAKE_ME,
      createdBy: FAKE_COLLEAGUE,
      updatedBy: FAKE_ME,
      createdAt: '2026-09-10T09:00:00.000Z',
      updatedAt: '2026-09-12T14:00:00.000Z',
      fields: [
        seedField('extf-quote-1', 1, FAKE_COLLEAGUE, incoterm),
        seedField('extf-quote-2', 2, FAKE_COLLEAGUE, warranty),
      ],
    },
  ];

  return { profiles, versions };
}

const DB = buildSeedExtensions();

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

function validationFailed(): never {
  throw new ApiError(400, 'TRADE.VALIDATION_FAILED');
}

function definitionInvalid(): never {
  throw new ApiError(422, 'TRADE.EXTENSION.DEFINITION_INVALID');
}

function notFound(): never {
  throw new ApiError(404, 'TRADE.EXTENSION.DEFINITION_NOT_FOUND');
}

function targetDenied(): never {
  throw new ApiError(403, 'TRADE.AUTH.TARGET_DENIED');
}

// ---------------------------------------------------------------------------
// DTO validation (TradeValidationPipe: whitelist + forbidNonWhitelisted => 400)
// ---------------------------------------------------------------------------

const SCHEMA_CODE = /^[a-z][a-z0-9.-]{1,79}$/;
const DTO_DECIMAL = /^-?(?:0|[1-9]\d*)(?:\.\d{1,8})?$/;
const FIELD_DTO_KEYS = new Set([
  'fieldKey',
  'valueKind',
  'scalarType',
  'schemaCode',
  'schemaVersion',
  'isRequired',
  'isSearchable',
  'visibilityCode',
  'maxLength',
  'maxItems',
  'decimalScale',
  'minimumDecimal',
  'maximumDecimal',
  'defaultStrategy',
  'defaultValue',
  'constraintPayload',
]);

function isIntIn(value: unknown, min: number, max: number): boolean {
  return Number.isInteger(value) && (value as number) >= min && (value as number) <= max;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function assertFieldDtos(fields: unknown): asserts fields is ExtensionFieldInput[] {
  if (!Array.isArray(fields) || fields.length < 1 || fields.length > 100) validationFailed();
  for (const raw of fields) {
    if (!isPlainObject(raw)) validationFailed();
    const f = raw as Record<string, unknown>;
    if (Object.keys(f).some((key) => !FIELD_DTO_KEYS.has(key))) validationFailed();
    const optional = (key: string, ok: (v: unknown) => boolean) => {
      if (f[key] !== undefined && !ok(f[key])) validationFailed();
    };
    if (typeof f['fieldKey'] !== 'string' || !FIELD_KEY.test(f['fieldKey'])) validationFailed();
    if (!(VALUE_KINDS as readonly unknown[]).includes(f['valueKind'])) validationFailed();
    if (!(VISIBILITY as readonly unknown[]).includes(f['visibilityCode'])) validationFailed();
    optional('scalarType', (v) => (SCALAR_TYPES as readonly unknown[]).includes(v));
    optional('schemaCode', (v) => typeof v === 'string' && SCHEMA_CODE.test(v));
    optional('schemaVersion', (v) => isIntIn(v, 1, Number.MAX_SAFE_INTEGER));
    optional('isRequired', (v) => typeof v === 'boolean');
    optional('isSearchable', (v) => typeof v === 'boolean');
    optional('maxLength', (v) => isIntIn(v, 1, 4096));
    optional('maxItems', (v) => isIntIn(v, 1, 100));
    optional('decimalScale', (v) => isIntIn(v, 0, 8));
    optional('minimumDecimal', (v) => typeof v === 'string' && DTO_DECIMAL.test(v));
    optional('maximumDecimal', (v) => typeof v === 'string' && DTO_DECIMAL.test(v));
    optional('defaultStrategy', (v) => v === 'NONE' || v === 'LITERAL' || v === 'OWNER_DERIVED');
    optional('constraintPayload', isPlainObject);
  }
}

// ---------------------------------------------------------------------------
// Registry + value schema (extensions-registry.ts, extension-value-schema.ts)
// ---------------------------------------------------------------------------

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const VALUE_BYTES = 16 * 1024;

function byteSize(value: unknown): number {
  return value === undefined ? 0 : new TextEncoder().encode(JSON.stringify(value)).length;
}

function rejectExecutableContent(value: unknown): void {
  if (typeof value === 'string' && /<script|javascript:|\bselect\b.+\bfrom\b|\bfunction\s*\(|=>/is.test(value)) {
    definitionInvalid();
  }
  if (Array.isArray(value)) value.forEach(rejectExecutableContent);
  else if (isPlainObject(value)) Object.values(value).forEach(rejectExecutableContent);
}

function codePointLength(value: string): number {
  return [...value].length;
}

function normalizeDecimal(value: string, maximumScale: number): string {
  if (!/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(value)) definitionInvalid();
  const negative = value.startsWith('-');
  const unsigned = negative ? value.slice(1) : value;
  const [integer, fraction = ''] = unsigned.split('.');
  if (fraction.length > maximumScale) definitionInvalid();
  if ((`${integer}${fraction}`.replace(/^0+/, '') || '0').length > 24) definitionInvalid();
  const trimmedFraction = fraction.replace(/0+$/, '');
  const normalizedInteger = integer.replace(/^0+(?=\d)/, '');
  const zero = /^0+$/.test(`${normalizedInteger}${trimmedFraction}`);
  return `${negative && !zero ? '-' : ''}${normalizedInteger}${trimmedFraction ? `.${trimmedFraction}` : ''}`;
}

function compareDecimals(left: string, right: string): number {
  const parts = (value: string) => {
    const negative = value.startsWith('-');
    const [integer, fraction = ''] = (negative ? value.slice(1) : value).split('.');
    const magnitude = BigInt(`${integer}${fraction}`);
    return { value: negative ? -magnitude : magnitude, scale: fraction.length };
  };
  const l = parts(left);
  const r = parts(right);
  const scale = Math.max(l.scale, r.scale);
  const lv = l.value * 10n ** BigInt(scale - l.scale);
  const rv = r.value * 10n ** BigInt(scale - r.scale);
  return lv < rv ? -1 : lv > rv ? 1 : 0;
}

function asScalarType(value: unknown): ExtensionScalarType {
  if (!(SCALAR_TYPES as readonly unknown[]).includes(value)) definitionInvalid();
  return value as ExtensionScalarType;
}

function assertExactKeys(value: Record<string, unknown>, allowed: string[]): void {
  if (Object.keys(value).some((key) => !allowed.includes(key))) definitionInvalid();
}

function enumValues(raw: unknown, maxLength: number | null): string[] {
  if (!Array.isArray(raw) || raw.some((entry) => typeof entry !== 'string')) definitionInvalid();
  const values = raw as string[];
  if (
    values.length < 1 ||
    values.length > 100 ||
    new Set(values).size !== values.length ||
    values.some((entry) => codePointLength(entry) > (maxLength ?? 4096))
  ) {
    definitionInvalid();
  }
  return [...values].sort();
}

function optionalInteger(value: unknown, min: number, max: number): number | null {
  if (value === undefined || value === null) return null;
  if (!isIntIn(value, min, max)) definitionInvalid();
  return value as number;
}

function optionalString(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') definitionInvalid();
  return value;
}

function normalizeObjectProperty(value: unknown): ExtensionObjectProperty {
  if (!isPlainObject(value)) definitionInvalid();
  assertExactKeys(value, [
    'key',
    'scalarType',
    'isRequired',
    'maxLength',
    'decimalScale',
    'minimumDecimal',
    'maximumDecimal',
    'allowedValues',
  ]);
  if (typeof value['key'] !== 'string' || !OBJECT_PROPERTY_KEY.test(value['key'])) definitionInvalid();
  const scalarType = asScalarType(value['scalarType']);
  const isRequired = value['isRequired'] ?? false;
  if (typeof isRequired !== 'boolean') definitionInvalid();
  const maxLength = optionalInteger(value['maxLength'], 1, 4096);
  const decimalScale = optionalInteger(value['decimalScale'], 0, 8);
  if (scalarType !== 'STRING' && scalarType !== 'ENUM' && maxLength !== null) definitionInvalid();
  if (scalarType !== 'DECIMAL' && decimalScale !== null) definitionInvalid();
  let minimumDecimal = optionalString(value['minimumDecimal']);
  let maximumDecimal = optionalString(value['maximumDecimal']);
  if (scalarType !== 'DECIMAL' && (minimumDecimal !== null || maximumDecimal !== null)) definitionInvalid();
  if (scalarType === 'DECIMAL') {
    const scale = decimalScale ?? 8;
    minimumDecimal = minimumDecimal ? normalizeDecimal(minimumDecimal, scale) : null;
    maximumDecimal = maximumDecimal ? normalizeDecimal(maximumDecimal, scale) : null;
    if (minimumDecimal && maximumDecimal && compareDecimals(minimumDecimal, maximumDecimal) > 0) {
      definitionInvalid();
    }
  }
  let allowedValues: string[] | null = null;
  if (scalarType === 'ENUM') allowedValues = enumValues(value['allowedValues'], maxLength);
  else if (value['allowedValues'] !== undefined && value['allowedValues'] !== null) definitionInvalid();
  return {
    key: value['key'],
    scalarType,
    isRequired,
    maxLength,
    decimalScale: scalarType === 'DECIMAL' ? (decimalScale ?? 8) : null,
    minimumDecimal,
    maximumDecimal,
    allowedValues,
  };
}

interface ScalarConstraints {
  maxLength: number | null;
  decimalScale: number | null;
  minimumDecimal: string | null;
  maximumDecimal: string | null;
  allowedValues: string[] | null;
}

function normalizeScalarValue(type: ExtensionScalarType, value: unknown, c: ScalarConstraints): unknown {
  if (type === 'BOOLEAN') {
    if (typeof value !== 'boolean') definitionInvalid();
    return value;
  }
  if (typeof value !== 'string') definitionInvalid();
  if (type === 'STRING') {
    if (codePointLength(value) > (c.maxLength ?? 4096)) definitionInvalid();
    return value;
  }
  if (type === 'ENUM') {
    if (!(c.allowedValues ?? []).includes(value)) definitionInvalid();
    return value;
  }
  if (type === 'DECIMAL') {
    const normalized = normalizeDecimal(value, c.decimalScale ?? 8);
    if (c.minimumDecimal !== null && compareDecimals(normalized, c.minimumDecimal) < 0) definitionInvalid();
    if (c.maximumDecimal !== null && compareDecimals(normalized, c.maximumDecimal) > 0) definitionInvalid();
    return normalized;
  }
  if (type === 'DATE') {
    const match = DATE_PATTERN.exec(value);
    if (!match) definitionInvalid();
    const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
    const date = new Date(Date.UTC(year, month - 1, day));
    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
      definitionInvalid();
    }
    return value;
  }
  if (!UUID_PATTERN.test(value)) definitionInvalid();
  return value.toLowerCase();
}

function normalizeDefault(field: Omit<ExtensionField, 'id'>, value: unknown): unknown {
  const fieldConstraints: ScalarConstraints = {
    maxLength: field.maxLength,
    decimalScale: field.decimalScale,
    minimumDecimal: field.minimumDecimal,
    maximumDecimal: field.maximumDecimal,
    allowedValues: field.constraintPayload.allowedValues ?? null,
  };
  if (field.valueKind === 'SCALAR') return normalizeScalarValue(field.scalarType!, value, fieldConstraints);
  if (field.valueKind === 'COLLECTION') {
    if (!Array.isArray(value) || value.length > field.maxItems!) definitionInvalid();
    return value.map((entry) => normalizeScalarValue(field.scalarType!, entry, fieldConstraints));
  }
  if (!isPlainObject(value)) definitionInvalid();
  const properties = new Map((field.constraintPayload.properties ?? []).map((p) => [p.key, p]));
  if (Object.keys(value).some((key) => !properties.has(key))) definitionInvalid();
  const result: Record<string, unknown> = {};
  for (const property of [...properties.values()].sort((a, b) => a.key.localeCompare(b.key))) {
    if (Object.prototype.hasOwnProperty.call(value, property.key)) {
      result[property.key] = normalizeScalarValue(property.scalarType, value[property.key], property);
    } else if (property.isRequired) {
      definitionInvalid();
    }
  }
  return result;
}

function normalizeFieldSchema(input: ExtensionFieldInput, ordinal: number): Omit<ExtensionField, 'id'> {
  const valueKind = input.valueKind;
  const scalarType = input.scalarType ? asScalarType(input.scalarType) : null;
  const schemaCode = input.schemaCode ?? null;
  const schemaVersion = input.schemaVersion ?? null;
  const maxLength = input.maxLength ?? null;
  const maxItems = input.maxItems ?? null;
  const decimalScale = input.decimalScale ?? null;
  let minimumDecimal = input.minimumDecimal ?? null;
  let maximumDecimal = input.maximumDecimal ?? null;
  const payload = (input.constraintPayload ?? {}) as Record<string, unknown>;

  if (valueKind === 'SCALAR') {
    if (!scalarType || schemaCode !== null || schemaVersion !== null || maxItems !== null) definitionInvalid();
  } else if (valueKind === 'COLLECTION') {
    if (
      !scalarType ||
      schemaCode !== EXTENSION_COLLECTION_SCHEMA ||
      schemaVersion !== EXTENSION_VALUE_SCHEMA_VERSION ||
      maxItems === null
    ) {
      definitionInvalid();
    }
  } else if (
    scalarType !== null ||
    schemaCode !== EXTENSION_OBJECT_SCHEMA ||
    schemaVersion !== EXTENSION_VALUE_SCHEMA_VERSION ||
    maxLength !== null ||
    maxItems !== null ||
    decimalScale !== null ||
    minimumDecimal !== null ||
    maximumDecimal !== null
  ) {
    definitionInvalid();
  }

  let constraintPayload: ExtensionField['constraintPayload'];
  if (valueKind === 'OBJECT') {
    assertExactKeys(payload, ['properties']);
    const raw = payload['properties'];
    if (!Array.isArray(raw) || raw.length < 1 || raw.length > 50) definitionInvalid();
    const properties = raw.map(normalizeObjectProperty);
    if (new Set(properties.map((p) => p.key)).size !== properties.length) definitionInvalid();
    constraintPayload = { properties: properties.sort((a, b) => a.key.localeCompare(b.key)) };
  } else {
    if (scalarType === 'ENUM') {
      assertExactKeys(payload, ['allowedValues']);
      constraintPayload = { allowedValues: enumValues(payload['allowedValues'], maxLength) };
    } else {
      assertExactKeys(payload, []);
      constraintPayload = {};
    }
    if (scalarType === 'DECIMAL') {
      const scale = decimalScale ?? 8;
      minimumDecimal = minimumDecimal === null ? null : normalizeDecimal(minimumDecimal, scale);
      maximumDecimal = maximumDecimal === null ? null : normalizeDecimal(maximumDecimal, scale);
      if (minimumDecimal !== null && maximumDecimal !== null && compareDecimals(minimumDecimal, maximumDecimal) > 0) {
        definitionInvalid();
      }
    } else if (decimalScale !== null || minimumDecimal !== null || maximumDecimal !== null) {
      definitionInvalid();
    }
    if (scalarType !== 'STRING' && scalarType !== 'ENUM' && maxLength !== null) definitionInvalid();
  }

  // OWNER_DERIVED has no registered implementation in Trade MVP.
  const defaultStrategy = input.defaultStrategy ?? 'NONE';
  if (defaultStrategy !== 'NONE' && defaultStrategy !== 'LITERAL') definitionInvalid();
  if (defaultStrategy === 'NONE' && input.defaultValue !== undefined && input.defaultValue !== null) {
    definitionInvalid();
  }
  if (defaultStrategy === 'LITERAL' && input.defaultValue === undefined) definitionInvalid();

  const normalized: Omit<ExtensionField, 'id'> = {
    fieldKey: input.fieldKey,
    valueKind,
    scalarType,
    schemaCode,
    schemaVersion,
    isRequired: input.isRequired ?? false,
    isSearchable: input.isSearchable ?? false,
    visibilityCode: input.visibilityCode,
    maxLength,
    maxItems,
    decimalScale: scalarType === 'DECIMAL' ? (decimalScale ?? 8) : null,
    minimumDecimal,
    maximumDecimal,
    defaultStrategy,
    defaultValue: null,
    constraintPayload,
    ordinal,
  };
  if (defaultStrategy === 'LITERAL') normalized.defaultValue = normalizeDefault(normalized, input.defaultValue);
  if (byteSize(normalized.defaultValue) > VALUE_BYTES || byteSize(normalized.constraintPayload) > VALUE_BYTES) {
    definitionInvalid();
  }
  return normalized;
}

function compileFields(targetCode: ExtensionTargetCode, inputs: ExtensionFieldInput[]): StoredField[] {
  const target = getExtensionTarget(targetCode);
  if (!target || new Set(inputs.map((f) => f.fieldKey)).size !== inputs.length) definitionInvalid();
  const actor = getFakeActor();
  return inputs.map((input, index) => {
    if (isReservedKey(input.fieldKey)) throw new ApiError(422, 'TRADE.EXTENSION.RESERVED_FIELD');
    if (input.isSearchable && !target.searchable) definitionInvalid();
    if (byteSize(input.defaultValue) > VALUE_BYTES || byteSize(input.constraintPayload) > VALUE_BYTES) {
      definitionInvalid();
    }
    rejectExecutableContent(input.defaultValue);
    rejectExecutableContent(input.constraintPayload);
    return { id: fakeId(), createdBy: actor, ...normalizeFieldSchema(input, index + 1) };
  });
}

// ---------------------------------------------------------------------------
// Projections (extension-profile-queries.service.ts)
// ---------------------------------------------------------------------------

function fieldProjection(field: StoredField): ExtensionField {
  const { createdBy: _createdBy, ...projection } = field;
  return clone(projection);
}

function versionProjection(v: StoredVersion): ExtVersion {
  return {
    id: v.id,
    profileId: v.profileId,
    version: v.version,
    versionNumber: v.versionNumber,
    registryVersion: v.registryVersion,
    targetSchemaCode: v.targetSchemaCode,
    targetSchemaVersion: v.targetSchemaVersion,
    definitionHash: v.definitionHash,
    status: v.status,
    compatibilitySummary: clone(v.compatibilitySummary),
    publishedAt: v.publishedAt,
    publishedBy: v.publishedBy,
    createdAt: v.createdAt,
    updatedAt: v.updatedAt,
  };
}

function withFields(v: StoredVersion): ExtVersion {
  return {
    ...versionProjection(v),
    fields: [...v.fields].sort((a, b) => a.ordinal - b.ordinal).map(fieldProjection),
  };
}

function profileProjection(p: StoredProfile) {
  return {
    id: p.id,
    version: p.version,
    code: p.code,
    targetCode: p.targetCode,
    scopeTarget: p.scopeTarget,
    companyId: p.companyId,
    status: p.status,
    currentPublishedVersionId: p.currentPublishedVersionId,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}

function versionsOf(profileId: string): StoredVersion[] {
  return DB.versions.filter((v) => v.profileId === profileId).sort((a, b) => b.versionNumber - a.versionNumber);
}

function draftOf(profileId: string): StoredVersion | undefined {
  return versionsOf(profileId).find((v) => v.status === 'DRAFT' || v.status === 'TESTED');
}

function versionEntity(v: StoredVersion): ExtVersionEntity {
  const { fields: _fields, ...entity } = v;
  return clone(entity);
}

function fieldEntities(v: StoredVersion): ExtFieldEntity[] {
  return v.fields.map((f) => ({ ...clone(f), profileVersionId: v.id, updatedBy: f.createdBy }));
}

function inScope(p: StoredProfile): boolean {
  return context.target === 'TENANT'
    ? p.scopeTarget === 'TENANT' && p.companyId === null
    : p.scopeTarget === 'COMPANY' && p.companyId === context.companyId;
}

function scopedProfile(id: string): StoredProfile {
  const found = DB.profiles.find((p) => p.id === id && inScope(p));
  if (!found) notFound();
  return found;
}

/** Writes look the profile up by company only (extension-profiles.service.ts findProfile). */
function writableProfile(id: string): StoredProfile {
  const companyId = context.target === 'TENANT' ? null : context.companyId;
  const found = DB.profiles.find((p) => p.id === id && p.companyId === companyId);
  if (!found) notFound();
  return found;
}

function requireDraft(profileId: string): StoredVersion {
  const draft = draftOf(profileId);
  if (!draft) throw new ApiError(409, 'TRADE.EXTENSION.PROFILE_CONFLICT');
  return draft;
}

function assertNotBranch(): void {
  if (context.target === 'BRANCH') targetDenied();
}

function assertNotRetired(p: StoredProfile): void {
  if (p.status === 'RETIRED') {
    throw new ApiError(422, 'TRADE.EXTENSION.PROFILE_INCOMPATIBLE', { reason: ['profile_retired'] });
  }
}

function touch(p: StoredProfile, now: string): void {
  p.version += 1;
  p.updatedBy = getFakeActor();
  p.updatedAt = now;
}

function touchVersion(v: StoredVersion, now: string): void {
  v.version += 1;
  v.updatedBy = getFakeActor();
  v.updatedAt = now;
}

function assertPaging(page: number, limit: number): void {
  if (!Number.isInteger(page) || page < 1 || !Number.isInteger(limit) || limit < 1 || limit > 100) {
    validationFailed();
  }
}

function assertFilters(q: ExtensionProfileFilters): void {
  if (q.targetCode !== undefined && !TARGET_CODES.includes(q.targetCode)) validationFailed();
  if (q.status !== undefined && !['DRAFT', 'ACTIVE', 'RETIRED'].includes(q.status)) validationFailed();
}

// ---------------------------------------------------------------------------
// Public Fake API Functions
// ---------------------------------------------------------------------------

export async function fakeGetExtensionTargets(): Promise<ExtensionTargetsResponse> {
  await fakeDelay(80);
  return {
    registryVersion: EXTENSION_REGISTRY_VERSION,
    targets: clone([...TARGETS]),
    valueKinds: [...VALUE_KINDS],
    scalarTypes: [...SCALAR_TYPES],
    valueSchemas: {
      object: { code: EXTENSION_OBJECT_SCHEMA, version: EXTENSION_VALUE_SCHEMA_VERSION },
      collection: { code: EXTENSION_COLLECTION_SCHEMA, version: EXTENSION_VALUE_SCHEMA_VERSION },
    },
    defaultStrategies: ['NONE', 'LITERAL'],
    limits: { fieldsPerProfile: 100, valueBytes: VALUE_BYTES },
  };
}

export async function fakeGetProfileCounts(q: ExtensionProfileFilters = {}): Promise<ExtensionProfileCounts> {
  await fakeDelay(120);
  assertFilters(q);
  const byTarget = Object.fromEntries(TARGET_CODES.map((code) => [code, 0])) as Record<ExtensionTargetCode, number>;
  const byStatus: Record<ExtensionProfileStatus, number> = { DRAFT: 0, ACTIVE: 0, RETIRED: 0 };
  let total = 0;
  for (const p of DB.profiles) {
    if (!inScope(p)) continue;
    if (q.status && p.status !== q.status) continue;
    if (q.targetCode && p.targetCode !== q.targetCode) continue;
    byTarget[p.targetCode] += 1;
    byStatus[p.status] += 1;
    total += 1;
  }
  return { total, byTarget, byStatus };
}

export async function fakeListProfiles(q: ListExtensionProfilesQuery = {}): Promise<Page<ExtensionProfile>> {
  await fakeDelay();
  const page = q.page ?? 1;
  const limit = q.limit ?? 25;
  assertPaging(page, limit);
  assertFilters(q);

  const filtered = DB.profiles
    .filter((p) => inScope(p) && (!q.targetCode || p.targetCode === q.targetCode) && (!q.status || p.status === q.status))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const items = filtered.slice((page - 1) * limit, page * limit).map((p): ExtensionProfile => {
    const versions = versionsOf(p.id);
    const draft = versions.find((v) => v.status === 'DRAFT' || v.status === 'TESTED');
    const published = versions.find((v) => v.id === p.currentPublishedVersionId);
    return {
      ...profileProjection(p),
      fieldCount: (draft ?? published)?.fields.length ?? 0,
      currentPublishedVersion: published ? versionProjection(published) : null,
      editableDraftVersion: draft ? versionProjection(draft) : null,
    };
  });
  return { items, total: filtered.length, page, limit };
}

export async function fakeGetProfile(id: string): Promise<ExtensionProfile> {
  await fakeDelay();
  const p = scopedProfile(id);
  const versions = versionsOf(p.id);
  const published = versions.find((v) => v.id === p.currentPublishedVersionId);
  const draft = versions.find((v) => v.status === 'DRAFT' || v.status === 'TESTED');
  return {
    ...profileProjection(p),
    currentPublishedVersion: published ? withFields(published) : null,
    editableDraftVersion: draft ? withFields(draft) : null,
  };
}

export async function fakeListExtVersions(profileId: string, q: ListExtVersionsQuery = {}): Promise<Page<ExtVersion>> {
  await fakeDelay();
  scopedProfile(profileId);
  const page = q.page ?? 1;
  const limit = q.limit ?? 25;
  assertPaging(page, limit);
  if (q.status !== undefined && !['DRAFT', 'TESTED', 'PUBLISHED', 'SUPERSEDED', 'RETIRED'].includes(q.status)) {
    validationFailed();
  }
  const all = versionsOf(profileId).filter((v) => !q.status || v.status === q.status);
  return {
    items: all.slice((page - 1) * limit, page * limit).map(versionProjection),
    total: all.length,
    page,
    limit,
  };
}

export async function fakeGetExtVersion(profileId: string, versionId: string): Promise<ExtVersion> {
  await fakeDelay();
  const p = scopedProfile(profileId);
  const found = DB.versions.find((v) => v.profileId === p.id && v.id === versionId);
  if (!found) notFound();
  return withFields(found);
}

export async function fakeCreateProfile(
  input: CreateExtensionProfileInput,
  idempotencyKey?: string,
): Promise<ExtensionProfileDraftResult> {
  await fakeDelay();
  if (
    typeof input.code !== 'string' ||
    !PROFILE_CODE_PATTERN.test(input.code) ||
    !TARGET_CODES.includes(input.targetCode) ||
    !['TENANT', 'COMPANY'].includes(input.scopeTarget)
  ) {
    validationFailed();
  }
  assertFieldDtos(input.fields);
  const key = requireIdempotencyKey(idempotencyKey);

  return idem.run('extensions:create', key, input, () => {
    let companyId: string | null;
    if (input.scopeTarget === 'COMPANY') {
      if (context.target !== 'COMPANY') targetDenied();
      if (!context.companyId) definitionInvalid();
      companyId = context.companyId;
    } else {
      if (context.target !== 'TENANT') definitionInvalid();
      companyId = null;
    }
    const fields = compileFields(input.targetCode, input.fields);
    const code = input.code.trim().toUpperCase();
    if (DB.profiles.some((p) => p.code === code && p.targetCode === input.targetCode && p.companyId === companyId)) {
      throw new ApiError(409, 'TRADE.EXTENSION.DEFINITION_CONFLICT');
    }

    const now = nowIso();
    const actor = getFakeActor();
    const target = getExtensionTarget(input.targetCode)!;
    const profile: StoredProfile = {
      id: fakeId(),
      version: 1,
      code,
      targetCode: input.targetCode,
      scopeTarget: input.scopeTarget as ExtensionScopeTarget,
      companyId,
      status: 'DRAFT',
      currentPublishedVersionId: null,
      createdBy: actor,
      updatedBy: actor,
      createdAt: now,
      updatedAt: now,
    };
    const draft: StoredVersion = {
      id: fakeId(),
      profileId: profile.id,
      version: 1,
      versionNumber: 1,
      registryVersion: EXTENSION_REGISTRY_VERSION,
      targetSchemaCode: target.schemaCode,
      targetSchemaVersion: target.schemaVersion,
      definitionHash: NO_HASH,
      status: 'DRAFT',
      compatibilitySummary: {},
      publishedAt: null,
      publishedBy: null,
      createdBy: actor,
      updatedBy: actor,
      createdAt: now,
      updatedAt: now,
      fields,
    };
    DB.profiles.unshift(profile);
    DB.versions.push(draft);
    return { ...clone(profile), draftVersion: versionEntity(draft), fields: fieldEntities(draft) };
  });
}

export async function fakeUpdateProfile(
  id: string,
  fields: ExtensionFieldInput[],
  opts: WriteOptions = {},
): Promise<ExtensionProfileDraftResult> {
  await fakeDelay();
  assertFieldDtos(fields);
  const key = requireIdempotencyKey(opts.idempotencyKey);
  const expected = requireIfMatch(opts.ifMatch);
  assertNotBranch();

  return idem.run(`extensions:update:${id}`, key, { id, fields, expected }, () => {
    const profile = writableProfile(id);
    checkIfMatch(expected, profile.version);
    assertNotRetired(profile);
    const now = nowIso();
    let draft = draftOf(profile.id);
    if (!draft) {
      const latest = versionsOf(profile.id)[0];
      const target = getExtensionTarget(profile.targetCode)!;
      draft = {
        id: fakeId(),
        profileId: profile.id,
        version: 1,
        versionNumber: (latest?.versionNumber ?? 0) + 1,
        registryVersion: EXTENSION_REGISTRY_VERSION,
        targetSchemaCode: target.schemaCode,
        targetSchemaVersion: target.schemaVersion,
        definitionHash: NO_HASH,
        status: 'DRAFT',
        compatibilitySummary: {},
        publishedAt: null,
        publishedBy: null,
        createdBy: getFakeActor(),
        updatedBy: getFakeActor(),
        createdAt: now,
        updatedAt: now,
        fields: [],
      };
      DB.versions.push(draft);
    }
    draft.fields = compileFields(profile.targetCode, fields);
    draft.status = 'DRAFT';
    draft.compatibilitySummary = {};
    touchVersion(draft, now);
    touch(profile, now);
    return { ...clone(profile), draftVersion: versionEntity(draft), fields: fieldEntities(draft) };
  });
}

export async function fakeValidateProfile(
  id: string,
  opts: WriteOptions = {},
): Promise<ExtValidateResult> {
  await fakeDelay();
  const key = requireIdempotencyKey(opts.idempotencyKey);
  const expected = requireIfMatch(opts.ifMatch);
  assertNotBranch();

  return idem.run(`extensions:validate:${id}`, key, { id, expected }, () => {
    const profile = writableProfile(id);
    checkIfMatch(expected, profile.version);
    assertNotRetired(profile);
    const draft = requireDraft(profile.id);
    const diagnostics: ExtValidateDiagnostic[] = draft.fields
      .filter((field) => field.isRequired && field.defaultStrategy === 'NONE')
      .sort((a, b) => a.ordinal - b.ordinal)
      .map((field) => ({ fieldKey: field.fieldKey, code: 'REQUIRED_FIELD_NEEDS_MIGRATION_OR_DEFAULT' }));
    const passed = diagnostics.length === 0;
    const now = nowIso();
    draft.status = passed ? 'TESTED' : 'DRAFT';
    draft.compatibilitySummary = { passed, checkedAt: now, fieldCount: draft.fields.length, diagnostics };
    touchVersion(draft, now);
    touch(profile, now);
    return {
      profileId: profile.id,
      versionId: draft.id,
      passed,
      checkedAt: now,
      fieldCount: draft.fields.length,
      diagnostics: clone(diagnostics),
      version: profile.version,
    };
  });
}

export async function fakePublishProfile(
  id: string,
  opts: WriteOptions = {},
): Promise<ExtensionProfilePublishResult> {
  await fakeDelay();
  const key = requireIdempotencyKey(opts.idempotencyKey);
  const expected = requireIfMatch(opts.ifMatch);
  assertNotBranch();

  return idem.run(`extensions:publish:${id}`, key, { id, expected }, () => {
    const profile = writableProfile(id);
    checkIfMatch(expected, profile.version);
    assertNotRetired(profile);
    const draft = requireDraft(profile.id);
    const target = getExtensionTarget(profile.targetCode);
    if (
      draft.status !== 'TESTED' ||
      draft.registryVersion !== EXTENSION_REGISTRY_VERSION ||
      draft.targetSchemaVersion !== target?.schemaVersion
    ) {
      throw new ApiError(422, 'TRADE.EXTENSION.PROFILE_INCOMPATIBLE');
    }
    const actor = getFakeActor();
    if (
      draft.fields.some((f) => f.isRequired) &&
      (draft.createdBy === actor || draft.fields.some((f) => f.createdBy === actor))
    ) {
      throw new ApiError(409, 'TRADE.APPROVAL.MAKER_CHECKER_REQUIRED');
    }
    const now = nowIso();
    const previous = DB.versions.find((v) => v.id === profile.currentPublishedVersionId);
    if (previous?.status === 'PUBLISHED') {
      previous.status = 'SUPERSEDED';
      touchVersion(previous, now);
    }
    draft.status = 'PUBLISHED';
    draft.publishedAt = now;
    draft.publishedBy = actor;
    touchVersion(draft, now);
    profile.currentPublishedVersionId = draft.id;
    profile.status = 'ACTIVE';
    touch(profile, now);
    return { ...clone(profile), publishedVersion: versionEntity(draft) };
  });
}

export async function fakeDiscardDraft(
  id: string,
  opts: WriteOptions = {},
): Promise<ExtensionDraftDiscardResult> {
  await fakeDelay();
  const key = requireIdempotencyKey(opts.idempotencyKey);
  const expected = requireIfMatch(opts.ifMatch);
  assertNotBranch();

  return idem.run(`extensions:discard:${id}`, key, { id, expected }, () => {
    const profile = writableProfile(id);
    checkIfMatch(expected, profile.version);
    const draft = requireDraft(profile.id);
    DB.versions.splice(DB.versions.indexOf(draft), 1);
    touch(profile, nowIso());
    return { id, version: profile.version, discardedVersionId: draft.id };
  });
}

export async function fakeRetireProfile(
  id: string,
  opts: WriteOptions = {},
): Promise<ExtensionProfileEntity> {
  await fakeDelay();
  const key = requireIdempotencyKey(opts.idempotencyKey);
  const expected = requireIfMatch(opts.ifMatch);
  assertNotBranch();

  return idem.run(`extensions:retire:${id}`, key, { id, expected }, () => {
    const profile = writableProfile(id);
    checkIfMatch(expected, profile.version);
    profile.status = 'RETIRED';
    touch(profile, nowIso());
    return clone(profile);
  });
}
