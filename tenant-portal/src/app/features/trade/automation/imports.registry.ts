/** Mirrors trade-app extensions-registry.ts IMPORT_TARGET_FIELDS and import-mappings.service.ts targets(). */

export type ImportTargetCode = 'CATALOG_COMPANY_PROFILE' | 'CATALOG_BRANCH_ASSIGNMENT';

export type ImportTransformCode = 'TRIM' | 'NORMALIZE_CODE' | 'ENUM_MAP';

export const KNOWN_IMPORT_LOOKUP_CODES = ['BOOLEAN_V1', 'TRACKING_MODE_V1'] as const;

export type KnownImportLookupCode = (typeof KNOWN_IMPORT_LOOKUP_CODES)[number];

export type ImportLookupCode = KnownImportLookupCode | (string & {});

export interface ImportTargetFieldSpec {
  code: string;
  required: boolean;
  allowedTransforms: readonly ImportTransformCode[];
  lookupCode: ImportLookupCode | null;
}

export interface ImportTargetSpec {
  code: ImportTargetCode;
  dtoCode: string;
  dtoVersion: number;
  fields: readonly ImportTargetFieldSpec[];
}

/** GET /import-mappings/targets */
export interface ImportTargetsResponse {
  registryVersion: number;
  targets: ImportTargetSpec[];
  lookups: Record<string, Record<string, boolean | string>>;
}

export const OFFERED_TRANSFORMS: readonly ImportTransformCode[] = [
  'TRIM',
  'NORMALIZE_CODE',
  'ENUM_MAP',
];

export const IMPORT_LOOKUPS: Record<KnownImportLookupCode, Record<string, boolean | string>> = {
  BOOLEAN_V1: { TRUE: true, YES: true, Y: true, '1': true, FALSE: false, NO: false, N: false, '0': false },
  TRACKING_MODE_V1: { NONE: 'NONE', LOT: 'LOT', SERIAL: 'SERIAL' },
};

export const IMPORT_TARGETS: readonly ImportTargetSpec[] = [
  {
    code: 'CATALOG_COMPANY_PROFILE',
    dtoCode: 'trade.catalog.company-profile.import-row',
    dtoVersion: 1,
    fields: [
      { code: 'ITEM_CODE', required: true, allowedTransforms: ['NORMALIZE_CODE'], lookupCode: null },
      { code: 'CAN_SELL', required: true, allowedTransforms: ['ENUM_MAP'], lookupCode: 'BOOLEAN_V1' },
      { code: 'CAN_PURCHASE', required: true, allowedTransforms: ['ENUM_MAP'], lookupCode: 'BOOLEAN_V1' },
      { code: 'TRACK_INVENTORY', required: true, allowedTransforms: ['ENUM_MAP'], lookupCode: 'BOOLEAN_V1' },
      {
        code: 'TRACKING_MODE',
        required: true,
        allowedTransforms: ['NORMALIZE_CODE', 'ENUM_MAP'],
        lookupCode: 'TRACKING_MODE_V1',
      },
      { code: 'DEFAULT_SALES_UOM_CODE', required: false, allowedTransforms: ['NORMALIZE_CODE'], lookupCode: null },
      { code: 'DEFAULT_PURCHASE_UOM_CODE', required: false, allowedTransforms: ['NORMALIZE_CODE'], lookupCode: null },
      { code: 'TAX_CLASSIFICATION_KEY', required: false, allowedTransforms: ['TRIM'], lookupCode: null },
    ],
  },
  {
    code: 'CATALOG_BRANCH_ASSIGNMENT',
    dtoCode: 'trade.catalog.branch-assignment.import-row',
    dtoVersion: 1,
    fields: [
      { code: 'ITEM_CODE', required: true, allowedTransforms: ['NORMALIZE_CODE'], lookupCode: null },
      { code: 'BRANCH_CODE', required: true, allowedTransforms: ['NORMALIZE_CODE'], lookupCode: null },
      { code: 'IS_ASSORTED', required: true, allowedTransforms: ['ENUM_MAP'], lookupCode: 'BOOLEAN_V1' },
      {
        code: 'DEFAULT_FULFILLMENT_NODE_CODE',
        required: false,
        allowedTransforms: ['NORMALIZE_CODE'],
        lookupCode: null,
      },
      { code: 'REPLENISHMENT_POLICY_KEY', required: false, allowedTransforms: ['TRIM'], lookupCode: null },
    ],
  },
] as const;

/** Upload limits from import-source.service.ts (CSV_MAX_BYTES, TRADE_IMPORT_XLSX_MAX_BYTES); columns = DTO ArrayMaxSize. */
export const FILE_LIMITS = {
  csvBytes: 16 * 1024 * 1024,
  xlsxBytes: 8 * 1024 * 1024,
  columns: 200,
} as const;

export const RUN_ACTIVE = ['PENDING', 'PREVIEWING', 'EXECUTING'] as const;

export const MAPPING_CODE_PATTERN = /^[A-Z][A-Z0-9_]{1,79}$/;

export const SOURCE_COLUMN_PATTERN = /^[A-Za-z][A-Za-z0-9 _.-]{0,99}$/;

export const CSV_MEDIA_TYPE = 'text/csv';
export const XLSX_MEDIA_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export function getImportTarget(code: string): ImportTargetSpec | undefined {
  return IMPORT_TARGETS.find((t) => t.code === code);
}

export function isRunActive(status: string): boolean {
  return (RUN_ACTIVE as readonly string[]).includes(status);
}
