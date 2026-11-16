import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import * as schema from "@mutakamel/template-schema/browser-safe";
import type { DataAuthority, DataBridge } from "./[id]/bindings/binding-contract";
import type { DataFunctionOwner, DataNativeQualification, QualifiedDataNative } from "./[id]/bindings/owner-session-contract";
import { loadTemplateDataOwnerSession } from "./[id]/bindings/template-owner-session";
import type { DesignerInteractionTicket } from "./designer-interaction-exit";
import type { DesignerNativeRuntime, DesignerNativeLoadInput } from "./designer-native-runtime";
import { createReleasedDesignerNativeSource, type CatalogueBoundNativeOptions } from "./designer-released-native-source";
import { fetchTemplateNativeEditorOptions } from "./template-native-editor-options-api";
import type { BoundNativeEditorOptions, NativeEditorOptionsRequest } from "./template-native-editor-options";
import { fetchTemplateOwnerAdmission } from "./template-owner-admission-api";
import type { TemplateOwnerPins } from "./template-owner-admission";
import { TEMPLATE_ADAPTER_KEYS, type TemplateAdapterKey } from "./template-source-metadata";

// Direct assignment against the actual public namespace. No capability shim.
const dataNative: QualifiedDataNative = schema;
const SHA = /^[a-f0-9]{64}$/u;
const candidate = Object.freeze({
  schema: { name: "@mutakamel/template-schema", version: "0.0.9-t12-union.1", manifestSha256: "4b8bc145f397f6ab158c002572fba45b729908665528605e9730037b398f532e", entrypointSha256: "70c2836d13ee59eeab885488e9b18f940212c1ff851662e5f301268a178f5c40" },
  engine: { name: "@mutakamel/template-engine", version: "0.0.10-t12-union.1", manifestSha256: "09c79eedb35eebe46c363ca63dc4561e5021f42a2687be068898b18f9ed96bf7", entrypointSha256: "e36707de99bf35981c8d79fac141afaeee3d396428ea2fe9dd060a6c3ded78cf" },
  browserEntrypointSha256: "e54567462f168e1b6c9bc4cdf2d8107e9e6a20fe50bd9ac5cbed203ed3b19f51",
});

/** Stable independent loader observation. These candidate identities identify the
 * compiled dependency, not an approved producer/function/database release.
 * The loader must verify installed/bundled bytes before supplying this object.
 */
export interface DesignerNativeReleaseQualification {
  readonly key: string;
  readonly ownerPins: TemplateOwnerPins;
  readonly browserEntrypointSha256: string;
  readonly qualifiedFunctionRelease: unknown;
  isCurrent(): boolean;
}
export interface DesignerNativeReleaseHost {
  readQualification(): DesignerNativeReleaseQualification | null;
  /** Real tenant/company authority; auth/me currently does not expose tenantId. */
  readAuthority(ticket: DesignerInteractionTicket, input: DesignerNativeLoadInput): DataAuthority | null;
  /** T15's separate owner adapter must reconcile its independently authorized
   * catalogue against this exact bound result. No echoed fingerprint or raw
   * observation is sufficient. No implementation is supplied in this packet.
   */
  readBoundFunctionOwner(options: CatalogueBoundNativeOptions): DataFunctionOwner | null;
  readRequestedReferences(): Pick<NativeEditorOptionsRequest, "functionVersionIds" | "currencyCodes" | "unitCodes"> | null;
}

/** Construct before the editor load, outside render. Missing qualification has
 * no default. Root/browser entry hashes are intentionally different identities.
 */
export function createDesignerNativeReleaseRuntime(host: DesignerNativeReleaseHost): DesignerNativeRuntime | null {
  let qualification: DesignerNativeReleaseQualification | null;
  let commitment: string;
  try {
    qualification = host.readQualification();
    if (!qualification || !qualified(qualification)) return null;
    commitment = schema.canonicalJson([qualification.key, qualification.ownerPins, qualification.qualifiedFunctionRelease]);
  } catch { return null; }
  let retired = false;
  const current = (): boolean => {
    try {
      if (retired || host.readQualification() !== qualification || !qualified(qualification) ||
        schema.canonicalJson([qualification.key, qualification.ownerPins, qualification.qualifiedFunctionRelease]) !== commitment) retired = true;
    } catch { retired = true; }
    return !retired;
  };
  return Object.freeze({
    pins: qualification.ownerPins, canonicalJson: schema.canonicalJson, isCurrent: current,
    async createSource(admission, currentAdmission, ticket, input) {
      if (!input || !current() || !input.isCurrent() || input.signal.aborted) return null;
      const authority = host.readAuthority(ticket, input);
      const generation = input.bridge.read().generation;
      const expectedCompany = input.scope.type === "TENANT" ? null : input.scope.companyId;
      if (!authority?.canRead || !authority.tenantId || authority.key !== ticket.bridgeKey || authority.companyId !== expectedCompany ||
          generation !== ticket.generation || authority.readOnly !== input.bridge.context().readOnly) return null;
      const authorityCommitment = schema.canonicalJson(authority);
      let sourceRetired = false;
      const live = (): boolean => {
        try {
          const context = input.bridge.context(), snapshot = input.bridge.read();
          if (sourceRetired || !current() || input.signal.aborted || !input.isCurrent() ||
            currentAdmission() !== admission || schema.canonicalJson(admission.pins) !== schema.canonicalJson(qualification.ownerPins) ||
            !context.canRead || context.key !== ticket.bridgeKey || context.readOnly !== authority.readOnly ||
            snapshot.generation !== generation || !snapshot.document ||
            schema.canonicalJson(host.readAuthority(ticket, input)) !== authorityCommitment) sourceRetired = true;
        } catch { sourceRetired = true; }
        return !sourceRetired;
      };
      if (!live()) return null;
      const references = host.readRequestedReferences();
      if (!references || !qualification.qualifiedFunctionRelease) return null;
      const contentChecksum = await digest(schema.canonicalJson(input.draft.editorDocument));
      if (!live()) return null;
      const request: NativeEditorOptionsRequest = {
        templateId: input.draft.templateId, expectedDraftRevision: input.draft.revision,
        expectedContentChecksum: contentChecksum, expectedOwnerContextFingerprint: admission.fingerprint,
        functionVersionIds: [...references.functionVersionIds], currencyCodes: [...references.currencyCodes], unitCodes: [...references.unitCodes],
      };
      const options = await fetchTemplateNativeEditorOptions({ native: schema, owner: admission,
        persistedDocument: input.draft.editorDocument,
        source: { templateId: input.draft.templateId, draftId: input.draft.draftId, draftRevision: input.draft.revision, contentChecksum },
        request, qualifiedRelease: qualification.qualifiedFunctionRelease, isCurrent: live }, input.signal);
      if (!options || !live() || !options.isCurrent() || !hasCatalogueAuthority(options)) return null;
      if (!options.readCatalogueEvidence()) return null;
      const owner = host.readBoundFunctionOwner(options);
      if (!owner?.isCurrent() || !owner.identityAuthority || typeof owner.identityAuthority.currency !== "function" ||
          typeof owner.identityAuthority.unit !== "function") return null;
      let ownerRetired = false;
      const ownerCurrent = () => {
        try {
          ownerRetired ||= !live() || !options.isCurrent() || host.readBoundFunctionOwner(options) !== owner || !owner.isCurrent();
        } catch { ownerRetired = true; }
        return !ownerRetired;
      };
      const bridge: DataBridge = { ...input.bridge, context: () => ({ ...authority, canRead: ownerCurrent() }) };
      const dataQualification: DataNativeQualification = Object.freeze({
        key: qualification.key, publicEntry: "@mutakamel/template-schema/browser-safe",
        browserEntrypointSha256: qualification.browserEntrypointSha256, native: dataNative,
        host: { pins: qualification.ownerPins, canonicalJson: schema.canonicalJson, isCurrent: ownerCurrent },
      });
      const adapterKey = admission.descriptor.key;
      if (!isAdapter(adapterKey)) return null;
      const session = await loadTemplateDataOwnerSession({ bridge,
        readQualification: () => ownerCurrent() ? dataQualification : null,
        readFunctionOwner: () => ownerCurrent() ? owner : null,
        readOwnerAdmission: async admissionHost => {
          const fetched = await fetchTemplateOwnerAdmission(adapterKey, input.scope, admissionHost, input.signal);
          return fetched && schema.canonicalJson(fetched) === schema.canonicalJson(admission) ? fetched : null;
        },
      });
      if (session.status !== "ready" || !ownerCurrent()) return null;
      return createReleasedDesignerNativeSource(ticket, admission, options, session.host, ownerCurrent);
    },
  } satisfies DesignerNativeRuntime);
}

function hasCatalogueAuthority(value: BoundNativeEditorOptions): value is CatalogueBoundNativeOptions {
  return "readCatalogueEvidence" in value && typeof value.readCatalogueEvidence === "function" &&
    "inferTemplateFormulaType" in value && typeof value.inferTemplateFormulaType === "function";
}
function qualified(value: DesignerNativeReleaseQualification): boolean {
  if (typeof schema.validateDescriptorModel !== "function" || typeof schema.validateTemplateDocumentModel !== "function" ||
      typeof schema.prepareTemplateGraphCommand !== "function" || !value.key || !value.isCurrent() ||
      !value.qualifiedFunctionRelease || value.browserEntrypointSha256 !== candidate.browserEntrypointSha256 ||
      schema.canonicalJson(value.ownerPins.schema) !== schema.canonicalJson(candidate.schema) ||
      schema.canonicalJson(value.ownerPins.engine) !== schema.canonicalJson(candidate.engine)) return false;
  return [value.ownerPins.schema, value.ownerPins.engine, value.ownerPins.provider].every(pin =>
    !!pin.name && !!pin.version && SHA.test(pin.manifestSha256) && SHA.test(pin.entrypointSha256));
}
function isAdapter(value: unknown): value is TemplateAdapterKey { return typeof value === "string" && TEMPLATE_ADAPTER_KEYS.some(key => key === value); }
async function digest(value: string): Promise<string> {
  return bytesToHex(sha256(new TextEncoder().encode(value)));
}
