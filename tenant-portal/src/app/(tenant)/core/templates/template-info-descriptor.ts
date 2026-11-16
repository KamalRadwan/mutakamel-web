import { invalidCoreResponse, isMember, record } from "../contracts/core-page";
import { parseTemplateRegisteredSourceIdentity, type TemplateAdapterKey, type TemplateDocumentType, type TemplateLayoutMode, type TemplateOutputChannel } from "./template-source-metadata";

// Structural wire subset of native TemplateDataSchemaV1. The genuine native validator owns field semantics.
const DATA_TYPES = ["STRING", "NUMBER", "DECIMAL", "CURRENCY", "PERCENTAGE", "DATE", "DATETIME", "BOOLEAN", "IMAGE", "OBJECT", "ARRAY"] as const;
const FORMATS = ["TEXT", "NUMBER", "CURRENCY", "PERCENTAGE", "DATE", "DATETIME", "BOOLEAN"] as const;
const ENCODINGS = ["UTF8_NFC", "EMAIL_ADDR_V1", "SAFE_HTTPS_URL", "ASSET_UUIDV7", "ISO_DATE", "ISO_4217_UPPER", "ISO_3166_1_ALPHA2_UPPER", "DECIMAL_STRING_18_6", "DECIMAL_STRING_24_8", "DECIMAL_STRING_20_3", "ARRAY"] as const;
type Dimension = { kind: "SCALAR"; currencyPath?: never; unitPath?: never }
  | { kind: "MONEY"; currencyPath: string; unitPath?: never }
  | { kind: "QUANTITY"; currencyPath?: never; unitPath: string }
  | { kind: "UNIT_PRICE"; currencyPath: string; unitPath: string };
export interface TemplateInfoField {
  path: string; labelKey: string; dataType: (typeof DATA_TYPES)[number]; nullable: boolean; sensitive: boolean; previewAllowed: boolean;
  allowedFormats: (typeof FORMATS)[number][]; valueEncoding?: (typeof ENCODINGS)[number]; maxLength?: number; parentNullable?: boolean;
  minItems?: number; maxItems?: number; itemPathPrefix?: string; dimension?: Dimension;
}
export interface TemplateInfoDescriptor {
  key: TemplateAdapterKey; version: 1; checksum: string; documentType: TemplateDocumentType;
  allowedOutputChannels: readonly [TemplateOutputChannel]; allowedLayoutModes: readonly [TemplateLayoutMode, ...TemplateLayoutMode[]];
  fields: TemplateInfoField[]; fixtureKeys: readonly [string, string]; financialClassification?: "FINANCIAL" | "NON_FINANCIAL";
}

function text(value: unknown): value is string { return typeof value === "string" && value.length > 0; }
function checkField(value: unknown): void {
  const field = record(value);
  const keys = ["path", "labelKey", "dataType", "nullable", "sensitive", "previewAllowed", "allowedFormats", "valueEncoding", "maxLength", "parentNullable", "minItems", "maxItems", "itemPathPrefix", "dimension"];
  if (!field || Object.keys(field).some(key => !keys.includes(key)) || !text(field.path) || !text(field.labelKey) ||
    !isMember(DATA_TYPES, field.dataType) || ["nullable", "sensitive", "previewAllowed"].some(key => typeof field[key] !== "boolean") ||
    !Array.isArray(field.allowedFormats) || !field.allowedFormats.every(format => isMember(FORMATS, format)) ||
    new Set(field.allowedFormats).size !== field.allowedFormats.length) invalidCoreResponse();
  if (Object.hasOwn(field, "valueEncoding") && !isMember(ENCODINGS, field.valueEncoding)) invalidCoreResponse();
  if (Object.hasOwn(field, "parentNullable") && typeof field.parentNullable !== "boolean") invalidCoreResponse();
  if (Object.hasOwn(field, "itemPathPrefix") && !text(field.itemPathPrefix)) invalidCoreResponse();
  for (const key of ["maxLength", "minItems", "maxItems"]) {
    if (Object.hasOwn(field, key) && (!Number.isSafeInteger(field[key]) || (field[key] as number) < 0)) invalidCoreResponse();
  }
  if (Object.hasOwn(field, "dimension")) {
    const dimension = record(field.dimension);
    if (!dimension || !isMember(["SCALAR", "MONEY", "QUANTITY", "UNIT_PRICE"] as const, dimension.kind) ||
      Object.keys(dimension).some(key => !["kind", "currencyPath", "unitPath"].includes(key))) invalidCoreResponse();
    if (["MONEY", "UNIT_PRICE"].includes(dimension.kind) ? !text(dimension.currencyPath) : Object.hasOwn(dimension, "currencyPath")) invalidCoreResponse();
    if (["QUANTITY", "UNIT_PRICE"].includes(dimension.kind) ? !text(dimension.unitPath) : Object.hasOwn(dimension, "unitPath")) invalidCoreResponse();
  }
}

/** Preserve the actual descriptor, including omitted encodings, explicit dimensions and preview flags. */
export function parseTemplateInfoDescriptor(value: unknown): TemplateInfoDescriptor {
  const row = record(value);
  const keys = ["key", "version", "checksum", "documentType", "allowedOutputChannels", "allowedLayoutModes", "fields", "fixtureKeys", "financialClassification"];
  if (!row || Object.keys(row).some(key => !keys.includes(key)) || !Array.isArray(row.fields) || !Array.isArray(row.fixtureKeys) ||
    row.fixtureKeys.length !== 2 || !row.fixtureKeys.every(text) || new Set(row.fixtureKeys).size !== 2) invalidCoreResponse();
  parseTemplateRegisteredSourceIdentity({ ...row, adapterKey: row.key, schemaVersion: row.version, schemaChecksum: row.checksum });
  if (!Array.isArray(row.allowedOutputChannels) || row.allowedOutputChannels.length !== 1) invalidCoreResponse();
  if (Object.hasOwn(row, "financialClassification") && !isMember(["FINANCIAL", "NON_FINANCIAL"] as const, row.financialClassification)) invalidCoreResponse();
  row.fields.forEach(checkField);
  return row as unknown as TemplateInfoDescriptor;
}
