import {
  canonicalJson, collectTemplateFormulaFunctionVersionIds, collectTemplateFormulaSites,
  validateDescriptorModel, validateTemplateDocumentModel,
  type TemplateDataSchemaV1,
} from "@mutakamel/template-schema/browser-safe";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import { isUUIDv7 } from "@/lib/uuid";
import type { TemplateDraftDocument } from "../../template-design-api";
import { templateDesignTarget } from "../../template-design-route";
import type { EditorDocument } from "../../template-editor-model";
import type { TemplateOwnerAdmission, TemplateOwnerPins } from "../../template-owner-admission";
import { assertPersistedTemplateJson, retainPersistedTemplateJson } from "../../template-persisted-json";
import type { TemplateDetail } from "../../templates-contract";
import { salesQuotationTenantOrigin } from "./sales-quotation-origin";

const sourceKey = "TRADE_QUOTATION_PRINT_V1";
const checksumPattern = /^[a-f0-9]{64}$/u;
const sourceKeys = ["documentType", "dataSourceKey", "outputChannel", "layoutMode", "locale", "direction"] as const;

/** Supplied by the independent release loader using the qualified browser package and exact Trade registration. */
export interface SalesQuotationBindingTrust {
  readonly pins: TemplateOwnerPins;
  readonly descriptorCanonicalSha256: string;
  isCurrent(): boolean;
}

type SalesQuotationTenantIdentity =
  | { readonly tenantId: string; readonly tenantOrigin?: never }
  | { readonly tenantOrigin: string; readonly tenantId?: never };

export function sameSalesQuotationTenant(left: SalesQuotationTenantIdentity, right: SalesQuotationTenantIdentity): boolean {
  return left.tenantId !== undefined ? left.tenantId === right.tenantId && left.tenantOrigin === undefined && right.tenantOrigin === undefined :
    left.tenantOrigin !== undefined && left.tenantOrigin === right.tenantOrigin && right.tenantId === undefined;
}

/** Captured by the editor when the exact-target schema request is issued. */
export type SalesQuotationOwnerObservation = SalesQuotationTenantIdentity & {
  readonly admission: TemplateOwnerAdmission;
  readonly authorityKey: string;
  readonly companyId: string | null;
  readonly generation: number;
  isCurrent(): boolean;
}

/** Supplied by the authenticated editor after verifying the session and matching draft readback. */
export type SalesQuotationDraftAuthority = SalesQuotationTenantIdentity & {
  readonly key: string;
  readonly companyId: string | null;
  readonly generation: number;
  readonly detail: Pick<TemplateDetail, typeof sourceKeys[number] | "id" | "scope" | "currentDraft" | "lifecycleStatus" | "systemProtected">;
  readonly draft: TemplateDraftDocument;
  /** Rechecks the same authenticated session, scope and draft observation. */
  isCurrent(): boolean;
}

function digest(value: unknown): string {
  return bytesToHex(sha256(new TextEncoder().encode(canonicalJson(value))));
}

export function readSalesQuotationDescriptor(owner: TemplateOwnerAdmission, trust: SalesQuotationBindingTrust): TemplateDataSchemaV1 | null {
  if (!trust.isCurrent() || owner.contract !== "template-owner-context.v1" ||
    !checksumPattern.test(trust.descriptorCanonicalSha256) || owner.descriptorCanonicalSha256 !== trust.descriptorCanonicalSha256 ||
    canonicalJson(owner.pins) !== canonicalJson(trust.pins) ||
    !Object.values(owner.pins).every(pin => !!pin.version && checksumPattern.test(pin.manifestSha256) &&
      checksumPattern.test(pin.entrypointSha256))) return null;

  const descriptor = owner.descriptor as unknown as TemplateDataSchemaV1;
  if (descriptor.key !== sourceKey || descriptor.version !== 1 || descriptor.documentType !== "QUOTATION" ||
    owner.pins.schema.name !== "@mutakamel/template-schema" || owner.pins.engine.name !== "@mutakamel/template-engine" ||
    owner.pins.provider.name !== "@mutakamel/trade-app-contracts" ||
    descriptor.checksum !== owner.descriptorChecksum || digest(descriptor) !== trust.descriptorCanonicalSha256) return null;
  validateDescriptorModel(descriptor);
  const { contract, descriptorChecksum, descriptorCanonicalSha256, pins } = owner;
  return digest({ contract, descriptorChecksum, descriptorCanonicalSha256, pins }) === owner.fingerprint ? descriptor : null;
}

export function matchesSalesQuotationDraft(authority: SalesQuotationDraftAuthority, document: EditorDocument): boolean {
  const { detail, draft } = authority;
  const saved = detail.currentDraft;
  const target = templateDesignTarget(detail.scope);
  return authority.isCurrent() && !!authority.key && (authority.tenantId !== undefined
    ? authority.tenantOrigin === undefined && isUUIDv7(authority.tenantId)
    : !!authority.tenantOrigin && salesQuotationTenantOrigin(authority.tenantOrigin) !== null) &&
    !!target && authority.companyId === target.companyId &&
    detail.dataSourceKey === sourceKey && detail.documentType === "QUOTATION" && detail.outputChannel === "PRINT" &&
    detail.lifecycleStatus === "ACTIVE" && !detail.systemProtected && isUUIDv7(detail.id) &&
    draft.templateId === detail.id && isUUIDv7(draft.draftId) && draft.draftId === saved.draftId &&
    Number.isSafeInteger(draft.revision) && draft.revision > 0 && draft.revision === saved.revision &&
    draft.etag === `"${draft.revision}"` && draft.etag === saved.etag && checksumPattern.test(saved.contentChecksum) &&
    sourceKeys.every(key => document[key] === detail[key] && draft.editorDocument[key] === detail[key]) &&
    digest(draft.editorDocument) === saved.contentChecksum;
}

export function validateSalesQuotationBindingDocument(document: EditorDocument, descriptor: TemplateDataSchemaV1): boolean {
  assertPersistedTemplateJson(document);
  const validated = validateTemplateDocumentModel(document, { dataSchema: descriptor });
  if (!validated.valid || !validated.document) return false;
  // Structural validation can admit function calls without a bound catalogue.
  if (collectTemplateFormulaSites(validated.document).some(({ expression }) =>
    collectTemplateFormulaFunctionVersionIds(expression).length > 0)) return false;
  return !!retainPersistedTemplateJson(document, validated).document;
}
