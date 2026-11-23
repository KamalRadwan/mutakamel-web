import type { ExtensionField, ExtensionFieldInput, ExtensionObjectProperty } from './extensions.model';

export type ExtensionTargetCode =
  | 'CATALOG_ITEM'
  | 'QUOTATION'
  | 'SALES_ORDER'
  | 'PURCHASE_ORDER';

export type ExtensionValueKind = 'SCALAR' | 'OBJECT' | 'COLLECTION';

export type ExtensionScalarType =
  | 'STRING'
  | 'BOOLEAN'
  | 'DECIMAL'
  | 'DATE'
  | 'UUID'
  | 'ENUM';

export type ExtensionVisibility = 'INTERNAL' | 'USER' | 'EXTERNAL_SAFE';

export type ExtensionDefaultStrategy = 'NONE' | 'LITERAL' | 'OWNER_DERIVED';

/** One target as `GET /extensions/targets` returns it (extension-profiles.service.ts targets()). */
export interface ExtensionTargetDescriptor {
  code: ExtensionTargetCode;
  schemaCode: string;
  schemaVersion: number;
  searchable: boolean;
}

/** Response of `GET /api/tenant/trade/v1/extensions/targets`. */
export interface ExtensionTargetsResponse {
  registryVersion: number;
  targets: ExtensionTargetDescriptor[];
  valueKinds: ExtensionValueKind[];
  scalarTypes: ExtensionScalarType[];
  valueSchemas: {
    object: { code: string; version: number };
    collection: { code: string; version: number };
  };
  defaultStrategies: ExtensionDefaultStrategy[];
  limits: { fieldsPerProfile: number; valueBytes: number };
}

export const EXTENSION_REGISTRY_VERSION = 1;
export const EXTENSION_OBJECT_SCHEMA = 'trade.extension.flat-object';
export const EXTENSION_COLLECTION_SCHEMA = 'trade.extension.scalar-collection';
export const EXTENSION_VALUE_SCHEMA_VERSION = 1;

export const TARGETS: readonly ExtensionTargetDescriptor[] = [
  { code: 'CATALOG_ITEM', schemaCode: 'trade.catalog-item.extensions', schemaVersion: 1, searchable: true },
  { code: 'QUOTATION', schemaCode: 'trade.quotation.extensions', schemaVersion: 1, searchable: false },
  { code: 'SALES_ORDER', schemaCode: 'trade.sales-order.extensions', schemaVersion: 1, searchable: false },
  { code: 'PURCHASE_ORDER', schemaCode: 'trade.purchase-order.extensions', schemaVersion: 1, searchable: false },
] as const;

export const TARGET_CODES: readonly ExtensionTargetCode[] = TARGETS.map((t) => t.code);

export const VALUE_KINDS: readonly ExtensionValueKind[] = ['SCALAR', 'OBJECT', 'COLLECTION'];

export const SCALAR_TYPES: readonly ExtensionScalarType[] = [
  'STRING',
  'BOOLEAN',
  'DECIMAL',
  'DATE',
  'UUID',
  'ENUM',
];

export const VISIBILITY: readonly ExtensionVisibility[] = ['INTERNAL', 'USER', 'EXTERNAL_SAFE'];

export const DEFAULT_STRATEGIES: readonly ExtensionDefaultStrategy[] = ['NONE', 'LITERAL'];

/** Backend extensions-registry.ts RESERVED_SEGMENTS, checked on field-key segments with "_" removed. */
export const RESERVED_SEGMENTS: readonly string[] = [
  'id',
  'tenant',
  'tenantid',
  'company',
  'companyid',
  'branch',
  'branchid',
  'status',
  'version',
  'total',
  'subtotal',
  'grandtotal',
  'price',
  'unitprice',
  'tax',
  'quantity',
  'currency',
  'ledger',
  'createdat',
  'createdby',
  'updatedat',
  'updatedby',
  'deletedat',
  'approval',
  'lifecycle',
  'documentnumber',
];

const RESERVED_SET = new Set<string>(RESERVED_SEGMENTS);

export const PROFILE_CODE_PATTERN = /^[A-Z][A-Z0-9_]{1,79}$/;

export const FIELD_KEY = /^[a-z][a-z0-9_]{0,31}\.[a-z][a-z0-9_]{0,66}$/;

export const OBJECT_PROPERTY_KEY = /^[a-z][a-z0-9_]{0,63}$/;

export const LIMITS = {
  fieldsPerProfile: 100,
  valueBytes: 16384,
  maxLength: 4096,
  maxItems: 100,
  decimalScale: 8,
  enumValues: 100,
  objectProperties: 50,
} as const;

export function reservedSegmentOf(key: string): string | null {
  for (const segment of key.split('.')) {
    if (RESERVED_SET.has(segment.replaceAll('_', ''))) {
      return segment;
    }
  }
  return null;
}

export function isReservedKey(key: string): boolean {
  return reservedSegmentOf(key) !== null;
}

export function getExtensionTarget(code: ExtensionTargetCode): ExtensionTargetDescriptor | undefined {
  return TARGETS.find((t) => t.code === code);
}

export function isTargetSearchable(targetCode: ExtensionTargetCode): boolean {
  return getExtensionTarget(targetCode)?.searchable ?? false;
}

/** ENUM choices live in `constraintPayload.allowedValues` (extension-value-schema.ts). */
export function fieldAllowedValues(field: Pick<ExtensionField, 'constraintPayload'>): string[] {
  return [...(field.constraintPayload.allowedValues ?? [])];
}

/** OBJECT properties live in `constraintPayload.properties` (extension-value-schema.ts). */
export function fieldProperties(field: Pick<ExtensionField, 'constraintPayload'>): ExtensionObjectProperty[] {
  return (field.constraintPayload.properties ?? []).map((p) => ({ ...p }));
}

/** Request body item for `ExtensionFieldDto`: the DTO forbids `id` and `ordinal`. */
export function toFieldInput(field: ExtensionField): ExtensionFieldInput {
  return {
    fieldKey: field.fieldKey,
    valueKind: field.valueKind,
    ...(field.scalarType ? { scalarType: field.scalarType } : {}),
    ...(field.schemaCode ? { schemaCode: field.schemaCode } : {}),
    ...(field.schemaVersion ? { schemaVersion: field.schemaVersion } : {}),
    isRequired: field.isRequired,
    isSearchable: field.isSearchable,
    visibilityCode: field.visibilityCode,
    ...(field.maxLength !== null ? { maxLength: field.maxLength } : {}),
    ...(field.maxItems !== null ? { maxItems: field.maxItems } : {}),
    ...(field.decimalScale !== null ? { decimalScale: field.decimalScale } : {}),
    ...(field.minimumDecimal !== null ? { minimumDecimal: field.minimumDecimal } : {}),
    ...(field.maximumDecimal !== null ? { maximumDecimal: field.maximumDecimal } : {}),
    defaultStrategy: field.defaultStrategy,
    ...(field.defaultStrategy === 'LITERAL' ? { defaultValue: field.defaultValue } : {}),
    constraintPayload: field.constraintPayload,
  };
}
