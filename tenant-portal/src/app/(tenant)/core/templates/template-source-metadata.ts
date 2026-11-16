import { invalidCoreResponse, isMember, record, requiredText } from "../contracts/core-page";

// Installed Trade 0.0.36 COMPLETE_PRINT registrations and CRM 0.0.20 schema contributions.
// Core composes these and the Core-local Letter registration in registry/template-registry.contributions.ts.
export const TEMPLATE_DOCUMENT_TYPES = ["QUOTATION", "PURCHASE_QUOTATION", "SALES_ORDER", "PURCHASE_ORDER", "INVOICE", "CONTRACT", "CRM_OUTBOUND_EMAIL"] as const;
export const TEMPLATE_OUTPUT_CHANNELS = ["PRINT", "EMAIL"] as const;
export const TEMPLATE_LAYOUT_MODES = ["HYBRID_DOCUMENT", "FLOW_DOCUMENT", "FIXED_CANVAS", "EMAIL_FLOW"] as const;
export const TEMPLATE_ADAPTER_KEYS = [
  "TRADE_QUOTATION_PRINT_V1", "TRADE_PURCHASE_QUOTATION_PRINT_V1", "TRADE_SALES_ORDER_PRINT_V1",
  "TRADE_PURCHASE_ORDER_PRINT_V1", "TRADE_INVOICE_PRINT_V1", "TRADE_CONTRACT_PRINT_V1",
  "CRM_LEAD_OUTBOUND_EMAIL_V1", "CRM_CUSTOMER_OUTBOUND_EMAIL_V1", "CRM_OPPORTUNITY_OUTBOUND_EMAIL_V1",
] as const;
const AUTHORING_TEMPLATE_DOCUMENT_TYPES = [...TEMPLATE_DOCUMENT_TYPES, "LETTER"] as const;
const AUTHORING_TEMPLATE_ADAPTER_KEYS = [...TEMPLATE_ADAPTER_KEYS, "CORE_BUSINESS_LETTER_PRINT_V1"] as const;
export const MAX_TEMPLATE_DATA_SOURCES = AUTHORING_TEMPLATE_ADAPTER_KEYS.length;
export type TemplateDocumentType = (typeof AUTHORING_TEMPLATE_DOCUMENT_TYPES)[number];
export type TemplateOutputChannel = (typeof TEMPLATE_OUTPUT_CHANNELS)[number];
export type TemplateLayoutMode = (typeof TEMPLATE_LAYOUT_MODES)[number];
export type TemplateAdapterKey = (typeof AUTHORING_TEMPLATE_ADAPTER_KEYS)[number];
const PRINT_LAYOUTS = ["HYBRID_DOCUMENT", "FLOW_DOCUMENT", "FIXED_CANVAS"] as const;
const KNOWN_SOURCE = {
  TRADE_QUOTATION_PRINT_V1: { documentType: "QUOTATION", outputChannels: ["PRINT"], layoutModes: PRINT_LAYOUTS },
  TRADE_PURCHASE_QUOTATION_PRINT_V1: { documentType: "PURCHASE_QUOTATION", outputChannels: ["PRINT"], layoutModes: PRINT_LAYOUTS },
  TRADE_SALES_ORDER_PRINT_V1: { documentType: "SALES_ORDER", outputChannels: ["PRINT"], layoutModes: PRINT_LAYOUTS },
  TRADE_PURCHASE_ORDER_PRINT_V1: { documentType: "PURCHASE_ORDER", outputChannels: ["PRINT"], layoutModes: PRINT_LAYOUTS },
  TRADE_INVOICE_PRINT_V1: { documentType: "INVOICE", outputChannels: ["PRINT"], layoutModes: PRINT_LAYOUTS },
  TRADE_CONTRACT_PRINT_V1: { documentType: "CONTRACT", outputChannels: ["PRINT"], layoutModes: PRINT_LAYOUTS },
  CORE_BUSINESS_LETTER_PRINT_V1: { documentType: "LETTER", outputChannels: ["PRINT"], layoutModes: PRINT_LAYOUTS },
  CRM_LEAD_OUTBOUND_EMAIL_V1: { documentType: "CRM_OUTBOUND_EMAIL", outputChannels: ["EMAIL"], layoutModes: ["EMAIL_FLOW"] },
  CRM_CUSTOMER_OUTBOUND_EMAIL_V1: { documentType: "CRM_OUTBOUND_EMAIL", outputChannels: ["EMAIL"], layoutModes: ["EMAIL_FLOW"] },
  CRM_OPPORTUNITY_OUTBOUND_EMAIL_V1: { documentType: "CRM_OUTBOUND_EMAIL", outputChannels: ["EMAIL"], layoutModes: ["EMAIL_FLOW"] },
} as const;

export interface TemplateSourceMetadata {
  adapterKey: TemplateAdapterKey;
  schemaVersion: 1;
  schemaChecksum: string;
  documentType: TemplateDocumentType;
  allowedOutputChannels: TemplateOutputChannel[];
  allowedLayoutModes: TemplateLayoutMode[];
  supportedLocales: ("ar-EG" | "en-US")[];
}

function members<const T extends readonly string[]>(value: unknown, allowed: T): T[number][] {
  if (!Array.isArray(value) || value.length === 0 || value.length > allowed.length ||
    !value.every(entry => isMember(allowed, entry)) || new Set(value).size !== value.length) invalidCoreResponse();
  return value as T[number][];
}

/** A server may narrow its advertised modes; it cannot widen its registered family contract. */
export function parseTemplateRegisteredSourceIdentity(payload: unknown): Omit<TemplateSourceMetadata, "supportedLocales"> {
  const row = record(payload);
  if (!row || !isMember(AUTHORING_TEMPLATE_ADAPTER_KEYS, row.adapterKey) || row.schemaVersion !== 1) invalidCoreResponse();
  const known = KNOWN_SOURCE[row.adapterKey];
  if (row.documentType !== known.documentType) invalidCoreResponse();
  const schemaChecksum = requiredText(row, "schemaChecksum", 64);
  if (!/^[a-f0-9]{64}$/u.test(schemaChecksum)) invalidCoreResponse();
  return {
    adapterKey: row.adapterKey, schemaVersion: 1, schemaChecksum, documentType: known.documentType,
    allowedOutputChannels: members(row.allowedOutputChannels, known.outputChannels),
    allowedLayoutModes: members(row.allowedLayoutModes, known.layoutModes),
  };
}

export function parseTemplateSourceMetadata(payload: unknown): TemplateSourceMetadata {
  const row = record(payload);
  if (!row) invalidCoreResponse();
  return { ...parseTemplateRegisteredSourceIdentity(row), supportedLocales: members(row.supportedLocales, ["ar-EG", "en-US"] as const) };
}

export function parseTemplateDocumentIdentity(row: Record<string, unknown>) {
  if (!isMember(AUTHORING_TEMPLATE_DOCUMENT_TYPES, row.documentType) || !isMember(TEMPLATE_OUTPUT_CHANNELS, row.outputChannel) ||
    !isMember(TEMPLATE_LAYOUT_MODES, row.layoutMode)) invalidCoreResponse();
  const email = row.documentType === "CRM_OUTBOUND_EMAIL";
  if (email ? row.outputChannel !== "EMAIL" || row.layoutMode !== "EMAIL_FLOW"
    : row.outputChannel !== "PRINT" || !isMember(PRINT_LAYOUTS, row.layoutMode)) invalidCoreResponse();
  return { documentType: row.documentType, outputChannel: row.outputChannel, layoutMode: row.layoutMode };
}

export function parseTemplateSourceTuple(row: Record<string, unknown>) {
  const identity = parseTemplateDocumentIdentity(row);
  if (!isMember(AUTHORING_TEMPLATE_ADAPTER_KEYS, row.dataSourceKey) || KNOWN_SOURCE[row.dataSourceKey].documentType !== identity.documentType) invalidCoreResponse();
  return { ...identity, dataSourceKey: row.dataSourceKey };
}
