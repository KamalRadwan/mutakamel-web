import { sha256 } from "@noble/hashes/sha2.js";
import { invalidCoreResponse, isMember, record, requiredText } from "../contracts/core-page";
import { parseTemplateSourceMetadata, type TemplateAdapterKey, type TemplateSourceMetadata } from "./template-source-metadata";
import { parseTemplateInfoDescriptor, type TemplateInfoDescriptor } from "./template-info-descriptor";
import { templateChecksum } from "./template-info-checksum";
import { readTemplateResponse } from "./template-wire";

export interface TemplateInfoPackagePin { readonly name: string; readonly version: string; readonly manifestSha256: string; readonly entrypointSha256: string }
export interface TemplateInfoAdmission {
  readonly contract: "template-data-source-admission.v1"; readonly descriptorChecksum: string; readonly fingerprint: string;
  readonly pins: { readonly schema: TemplateInfoPackagePin; readonly engine: TemplateInfoPackagePin; readonly provider: TemplateInfoPackagePin };
  readonly descriptor: TemplateInfoDescriptor;
}
export interface TemplateInfo { readonly source: TemplateSourceMetadata; readonly admission: TemplateInfoAdmission }
export interface TemplateInfoCanonical { canonicalJson(value: unknown): string }

function hash(value: unknown, canonical: TemplateInfoCanonical): string {
  return Array.from(sha256(new TextEncoder().encode(canonical.canonicalJson(value))), byte => byte.toString(16).padStart(2, "0")).join("");
}
function closed(row: Record<string, unknown>, keys: readonly string[]): void {
  if (Object.keys(row).length !== keys.length || Object.keys(row).some(key => !keys.includes(key))) invalidCoreResponse();
}
function packagePin(value: unknown, expectedName: string): TemplateInfoPackagePin {
  const row = record(value);
  if (!row) invalidCoreResponse();
  closed(row, ["name", "version", "manifestSha256", "entrypointSha256"]);
  const version = requiredText(row, "version", 200);
  if (row.name !== expectedName || !/^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/u.test(version) ||
    version.split("+", 1)[0].split("-").slice(1).join("-").split(".").some(part => /^0[0-9]+$/u.test(part))) invalidCoreResponse();
  return { name: expectedName, version, manifestSha256: templateChecksum(row, "manifestSha256"), entrypointSha256: templateChecksum(row, "entrypointSha256") };
}
function freeze(value: object): void {
  for (const child of Object.values(value)) if (child && typeof child === "object") freeze(child);
  Object.freeze(value);
}

/** T03 R4 admission contract. canonicalJson must be the actual qualified native browser-safe function. */
export function readTemplateInfoResponse(response: { status: number; data: unknown }, expectedAdapter: TemplateAdapterKey, canonical: TemplateInfoCanonical): TemplateInfo {
  const body = record(readTemplateResponse(response, [200]));
  if (!body) invalidCoreResponse();
  const source = parseTemplateSourceMetadata(body);
  if (source.adapterKey !== expectedAdapter) invalidCoreResponse();
  const admission = record(body.admission), pins = record(admission?.pins);
  if (!admission || !pins) invalidCoreResponse();
  closed(admission, ["contract", "descriptorChecksum", "pins", "fingerprint", "descriptor"]);
  closed(pins, ["schema", "engine", "provider"]);
  if (admission.contract !== "template-data-source-admission.v1") invalidCoreResponse();
  const descriptor = parseTemplateInfoDescriptor(admission.descriptor);
  const descriptorChecksum = templateChecksum(admission, "descriptorChecksum");
  const fingerprint = templateChecksum(admission, "fingerprint");
  if (descriptor.key !== expectedAdapter || descriptor.checksum !== descriptorChecksum || descriptorChecksum !== source.schemaChecksum ||
    descriptor.documentType !== source.documentType || canonical.canonicalJson(descriptor.allowedOutputChannels) !== canonical.canonicalJson(source.allowedOutputChannels) ||
    canonical.canonicalJson(descriptor.allowedLayoutModes) !== canonical.canonicalJson(source.allowedLayoutModes)) invalidCoreResponse();
  // Exact native registry.ts checksum projection: labelKey is presentation metadata; no inferred/default field values.
  const semantic = { key: descriptor.key, version: descriptor.version, documentType: descriptor.documentType,
    allowedOutputChannels: descriptor.allowedOutputChannels, allowedLayoutModes: descriptor.allowedLayoutModes,
    fields: descriptor.fields.map(field => Object.fromEntries(Object.entries(field).filter(([key]) => key !== "labelKey"))),
    fixtureKeys: descriptor.fixtureKeys,
    ...(descriptor.financialClassification === undefined ? {} : { financialClassification: descriptor.financialClassification }) };
  if (hash(semantic, canonical) !== descriptorChecksum) invalidCoreResponse();
  const checkedPins = { schema: packagePin(pins.schema, "@mutakamel/template-schema"), engine: packagePin(pins.engine, "@mutakamel/template-engine"),
    provider: packagePin(pins.provider, expectedAdapter.startsWith("TRADE_") ? "@mutakamel/trade-app-contracts" : "@mutakamel/crm-app-contracts") };
  if (hash({ contract: admission.contract, descriptorChecksum, pins: checkedPins }, canonical) !== fingerprint) invalidCoreResponse();
  const result: TemplateInfo = { source, admission: { contract: admission.contract, descriptorChecksum, fingerprint, pins: checkedPins, descriptor } };
  // Canonical clone prevents retaining mutable transport objects; it is not reconstructed from the lossy fields projection.
  const snapshot: TemplateInfo = JSON.parse(canonical.canonicalJson(result));
  freeze(snapshot);
  return snapshot;
}

export interface TemplateInfoNative {
  validateTemplateDocumentModel(value: unknown, options: { readonly dataSchema: TemplateInfoDescriptor }): {
    readonly valid: boolean; readonly issues: readonly { readonly code: string; readonly path: string; readonly nodeId?: string }[];
  };
}
export type TemplateInfoQualification = { kind: "valid"; descriptor: TemplateInfoDescriptor; admission: TemplateInfoAdmission }
  | { kind: "unavailable" } | { kind: "refused"; issues: readonly { code: string; path: string; nodeId?: string }[] };

/** Pure current-document feedback. Host session/source/package admission still gates editing and server writes. */
export function qualifyTemplateInfo(info: TemplateInfo, document: unknown, native: TemplateInfoNative | null): TemplateInfoQualification {
  if (!native) return { kind: "unavailable" };
  const row = record(document);
  if (!row || row.dataSourceKey !== info.source.adapterKey || row.documentType !== info.source.documentType || !isMember(info.source.supportedLocales, row.locale) ||
    !isMember(info.source.allowedOutputChannels, row.outputChannel) || !isMember(info.source.allowedLayoutModes, row.layoutMode)) return { kind: "refused", issues: [] };
  try {
    const result = native.validateTemplateDocumentModel(document, { dataSchema: info.admission.descriptor });
    return result.valid ? { kind: "valid", descriptor: info.admission.descriptor, admission: info.admission } : {
      kind: "refused", issues: result.issues.map(issue => ({ code: issue.code, path: issue.path, ...(issue.nodeId ? { nodeId: issue.nodeId } : {}) })),
    };
  } catch { return { kind: "refused", issues: [] }; }
}
