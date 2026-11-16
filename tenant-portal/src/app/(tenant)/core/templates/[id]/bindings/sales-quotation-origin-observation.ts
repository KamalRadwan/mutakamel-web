import { canonicalJson } from "@mutakamel/template-schema/browser-safe";
import type { TenantProfileCommit } from "@/context/AuthContext";
import type { CorePath } from "@/lib/api/envelope";
import { can, isPermissionScopes } from "@/lib/auth/permission-scope";
import { isUUIDv7 } from "@/lib/uuid";
import { record } from "../../../contracts/core-page";
import { coreGetResponse } from "../../../core-api";
import { parseTemplateDraftDocument, readDraftSavePrecondition, type TemplateDraftDocument } from "../../template-design-api";
import { templateDesignTarget } from "../../template-design-route";
import { readTemplateOwnerAdmission, type TemplateOwnerPins } from "../../template-owner-admission";
import { readTemplateResponse, TEMPLATE_DRAFT_RESPONSE_LIMIT_BYTES } from "../../template-wire";
import {
  parseTemplateDetail, templatePath, TEMPLATE_READ_PERMISSION, TEMPLATE_UPDATE_PERMISSION, type TemplateDetail,
} from "../../templates-contract";
import {
  matchesSalesQuotationDraft, readSalesQuotationDescriptor,
  type SalesQuotationBindingTrust, type SalesQuotationDraftAuthority, type SalesQuotationOwnerObservation,
} from "./sales-quotation-binding-authority";
import { salesQuotationTenantOrigin } from "./sales-quotation-origin";

const source = "TRADE_QUOTATION_PRINT_V1";
type SalesQuotationRelease = {
  readonly schemaChecksum: string;
  readonly descriptorCanonicalSha256: string;
  readonly pins: TemplateOwnerPins;
  readonly requiresScopedDraftPrecondition?: true;
};

const salesQuotationReleases: readonly SalesQuotationRelease[] = Object.freeze([
  {
    schemaChecksum: "a332c8b506930ae099612381137051e40fcaf374e8e1e93d409904b857a3ca7d",
    descriptorCanonicalSha256: "2c39a4244fafa81ec7dac159b6099ff7b78121471a082db3aa3dc22e05200315",
    pins: Object.freeze({
      schema: Object.freeze({
        name: "@mutakamel/template-schema", version: "0.0.7",
        manifestSha256: "2634a838d9191e254873e35890def60d7c9b5dd01cba7eb2d3dc2fa767755138",
        entrypointSha256: "7ae1f4ec622055f360939b51ef67d0b30b29c51fefdf155a404678db7feb77ba",
      }),
      engine: Object.freeze({
        name: "@mutakamel/template-engine", version: "0.0.8",
        manifestSha256: "a7780762e9c8186d48d7e1b57c468cce0cf1e240ef08986bf9e5ef40c0e637fe",
        entrypointSha256: "b7355b4bb3bf54e394a3b1db7976e0cf34e716552ba38af24a94e9943f94c1ed",
      }),
      provider: Object.freeze({
        name: "@mutakamel/trade-app-contracts", version: "0.0.36",
        manifestSha256: "c6b7dde401e2c842812c4e3130cba6c0396fb0a4de858835ca06091d593f1429",
        entrypointSha256: "4d04db269b82dc33aeab35e91bed91b45002bca8c0ae882cab317c549a2ef605",
      }),
    }),
  },
  {
    schemaChecksum: "a8adbfe4c009dfa4f4bcdffb84dc648bc58325a34120449faa6bb4d5f18f18e6",
    descriptorCanonicalSha256: "748c4344dd159e7cfc3bdfeaa78158bd56fcdaba3611e4075b23a4ec84891263",
    requiresScopedDraftPrecondition: true,
    pins: Object.freeze({
      schema: Object.freeze({
        name: "@mutakamel/template-schema", version: "0.0.12",
        manifestSha256: "c4dc7581ccebe8bb08343850b9457846dcb9fdbacb218e16a02aecf7cf2f3a7f",
        entrypointSha256: "280c8c191e11cbb69348cd725d211be97a64ef614c8698e60f1fc0ca27d35f2a",
      }),
      engine: Object.freeze({
        name: "@mutakamel/template-engine", version: "0.0.15",
        manifestSha256: "128e013c3d8ba0f25c5f0108d25460c2f47769e3ab21f38fecef5204705673e7",
        entrypointSha256: "b3524febc5a8a805af2e379ceb45fe225682efcacf05c2cc4d60052b5954f248",
      }),
      provider: Object.freeze({
        name: "@mutakamel/trade-app-contracts", version: "0.0.37",
        manifestSha256: "4e2af27171a7fa300756fe09e43b1f3b00fc5512e85fb4345daf2d88d1c9f580",
        entrypointSha256: "d1d264165a3dd9f90910c3479bc12b111f83ceaa2a6fe2d090fcbea7c887e64b",
      }),
    }),
  },
]);

export interface SalesQuotationOriginRequest {
  readonly profile: TenantProfileCommit;
  readonly detail: TemplateDetail;
  readonly draft: TemplateDraftDocument;
  readonly authorityKey: string;
  readonly generation: number;
  readonly signal: AbortSignal;
  readProfile(): TenantProfileCommit | null;
  readOrigin(): string;
  /** Rechecks the nonce, current design route, draft and canonical store generation. */
  isCurrent(): boolean;
}

export interface SalesQuotationOriginObservation {
  readonly owner: SalesQuotationOwnerObservation;
  readonly authority: SalesQuotationDraftAuthority;
  readonly trust: SalesQuotationBindingTrust;
  readonly saveDescriptorChecksum: string | null;
}

function isBindableDefinition(detail: TemplateDetail): boolean {
  return isUUIDv7(detail.id) && detail.documentType === "QUOTATION" && detail.outputChannel === "PRINT" &&
    detail.dataSourceKey === source && detail.lifecycleStatus === "ACTIVE" && !detail.systemProtected &&
    (detail.layoutMode === "FLOW_DOCUMENT" || detail.layoutMode === "HYBRID_DOCUMENT");
}

const tuple = (detail: TemplateDetail) => [
  detail.id, detail.definitionRevision, detail.definitionEtag, detail.documentType, detail.outputChannel,
  detail.layoutMode, detail.dataSourceKey, detail.locale, detail.direction, detail.lifecycleStatus, detail.systemProtected,
  detail.scope.type, detail.scope.companyId, detail.scope.branchId,
];

function requireTarget(
  response: Awaited<ReturnType<typeof coreGetResponse>>,
  origin: string,
  endpoint: CorePath,
): void {
  const request = response.request;
  if (response.provenance !== "http" || !request || request.method !== "GET" || request.origin !== origin ||
      request.endpoint !== endpoint || request.redirected !== false || request.finalUrl !== origin + endpoint) {
    throw new Error("Unconfirmed Sales Quotation response target");
  }
  if (response.status !== 200) throw new Error("Sales Quotation response failed");
}

function permissionProjection(profile: Record<string, unknown>): string | null {
  const { id, permissions, permissionScopes } = profile;
  if (typeof id !== "string" || !id || !Array.isArray(permissions) ||
      !permissions.every(key => typeof key === "string") || !isPermissionScopes(permissionScopes, permissions)) return null;
  return canonicalJson([id, [...permissions].sort().map(key => {
    const { tenantWide, companyIds, branchIds } = permissionScopes[key];
    return [key, tenantWide, [...companyIds].sort(), [...branchIds].sort()];
  })]);
}

function confirmProfile(payload: unknown, expected: string): boolean {
  const outer = record(payload);
  const wrapped = !!outer && Object.hasOwn(outer, "data");
  const profile = wrapped ? record(outer?.data) : outer;
  return !!outer && !!profile && !Object.hasOwn(profile, "data") &&
    (!wrapped || !Object.hasOwn(outer, "id")) &&
    (wrapped ? [outer, profile] : [profile]).every(layer =>
      (!Object.hasOwn(layer, "success") || layer.success === true) &&
      (!Object.hasOwn(layer, "statusCode") || layer.statusCode === 200) &&
      !["errorCode", "errorCategory", "errors", "type", "title", "detail"].some(key => Object.hasOwn(layer, key))) &&
    permissionProjection(profile) === expected;
}

// An exact read can be shared only within the identical verified profile commit and origin.
const exactProfiles = new WeakMap<TenantProfileCommit, { origin: string; projection: string }>();

/** Binds ordinary browser commands to Core's verified tenant origin and current /auth/me commit. */
export async function observeSalesQuotationOrigin(
  observation: SalesQuotationOriginRequest,
): Promise<SalesQuotationOriginObservation | null> {
  const { detail, draft, profile, signal, authorityKey, generation } = observation;
  const tenantOrigin = salesQuotationTenantOrigin(observation.readOrigin());
  const target = templateDesignTarget(detail.scope);
  if (!tenantOrigin || !target || !isBindableDefinition(detail) || !profile.sessionRevision || !profile.user.id || !authorityKey) return null;
  const { companyId } = target;
  const permissionTarget = companyId === null ? { tenantWide: true } : { companyId };
  const expectedTuple = canonicalJson(tuple(detail).map(value => value ?? null));
  const expectedProfile = permissionProjection({ ...profile.user });
  if (!expectedProfile) return null;
  const isCurrent = () => !signal.aborted && observation.isCurrent() &&
    observation.readProfile() === profile && salesQuotationTenantOrigin(observation.readOrigin()) === tenantOrigin &&
    expectedTuple === canonicalJson(tuple(detail).map(value => value ?? null)) &&
    expectedProfile === permissionProjection({ ...profile.user }) &&
    can(profile.user, TEMPLATE_READ_PERMISSION, permissionTarget) && can(profile.user, TEMPLATE_UPDATE_PERMISSION, permissionTarget);
  const assertCurrent = () => {
    if (!isCurrent()) throw new Error("Sales Quotation observation is obsolete");
  };
  const read = async (endpoint: CorePath, maxResponseBytes: number) => {
    assertCurrent();
    const response = await coreGetResponse(endpoint, {
      assertCurrent, signal, redirect: "error", cache: "no-store", maxResponseBytes, requireExactResponseTarget: true,
    });
    assertCurrent();
    requireTarget(response, tenantOrigin, endpoint);
    return response;
  };
  const definitionPath = templatePath(detail.id);
  const draftPath = (definitionPath + "/draft") as CorePath;
  const query = new URLSearchParams({ scopeType: detail.scope.type, schemaVersion: "1" });
  if (companyId !== null) query.set("companyId", companyId);
  const schemaPath = ("/api/tenant/core/v1/templates/data-sources/" + source + "/schema?" + query) as CorePath;

  try {
    assertCurrent();
    const previousProfile = exactProfiles.get(profile);
    const confirmExactProfile = async () => {
      if (previousProfile?.origin === tenantOrigin && previousProfile.projection === expectedProfile) return true;
      const response = await read("/api/tenant/core/v1/auth/me", 900_000);
      if (!confirmProfile(response.data, expectedProfile) || !isCurrent()) return false;
      exactProfiles.set(profile, { origin: tenantOrigin, projection: expectedProfile });
      return true;
    };
    const [definitionReply, draftReply, schemaReply, profileConfirmed] = await Promise.all([
      read(definitionPath, 400_000), read(draftPath, TEMPLATE_DRAFT_RESPONSE_LIMIT_BYTES), read(schemaPath, 900_000),
      confirmExactProfile(),
    ]);
    if (!profileConfirmed) return null;
    const checkedDetail = parseTemplateDetail(readTemplateResponse(definitionReply, [200]));
    const checkedDraft = parseTemplateDraftDocument(readTemplateResponse(draftReply, [200]));
    if (canonicalJson(tuple(checkedDetail).map(value => value ?? null)) !== expectedTuple ||
        checkedDraft.templateId !== draft.templateId || checkedDraft.draftId !== draft.draftId ||
        checkedDraft.revision !== draft.revision || checkedDraft.etag !== draft.etag ||
        canonicalJson(checkedDraft.editorDocument) !== canonicalJson(draft.editorDocument)) return null;
    const schema = record(readTemplateResponse(schemaReply, [200]));
    const release = salesQuotationReleases.find(item => item.schemaChecksum === schema?.schemaChecksum);
    if (!schema || !release) return null;
    const draftPrecondition = readDraftSavePrecondition(schema, source, checkedDetail.scope, schemaReply.status);
    if (release.requiresScopedDraftPrecondition && !draftPrecondition) return null;
    const trust = Object.freeze({ pins: release.pins, descriptorCanonicalSha256: release.descriptorCanonicalSha256, isCurrent });
    const admission = await readTemplateOwnerAdmission(schema, { pins: release.pins, canonicalJson, isCurrent });
    if (!admission || !readSalesQuotationDescriptor(admission, trust) || !isCurrent()) return null;
    const authority = Object.freeze({
      key: authorityKey, tenantOrigin, companyId, generation, detail: checkedDetail, draft: checkedDraft, isCurrent,
    });
    if (!matchesSalesQuotationDraft(authority, draft.editorDocument)) return null;
    const owner = Object.freeze({ admission, authorityKey, tenantOrigin, companyId, generation, isCurrent });
    const saveDescriptorChecksum = release.requiresScopedDraftPrecondition && draftPrecondition === "draft-schema"
      ? admission.descriptorChecksum : null;
    return Object.freeze({ owner, authority, trust, saveDescriptorChecksum });
  } catch { return null; }
}
