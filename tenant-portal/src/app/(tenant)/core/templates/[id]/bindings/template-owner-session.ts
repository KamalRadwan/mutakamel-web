import { readDataDescriptor } from "./binding-catalogue";
import type { DataCatalogue } from "./binding-contract";
import type { DataOwnerSessionInput, DataOwnerSessionResult, QualifiedDataNative } from "./owner-session-contract";

const nativeMethods = ["canonicalJson", "validateDescriptorModel", "parseTemplateFormulaExpression", "inferTemplateFormulaType", "validateTemplateDocumentModel"] as const;
const SHA = /^[a-f0-9]{64}$/u;

/** Connect an R8/T04 admission to existing T15 ports. This neither loads native
 * code nor qualifies a release. Missing public native capabilities fail closed.
 * It never writes authored state or derives authority from descriptor metadata.
 */
export async function loadTemplateDataOwnerSession(input: DataOwnerSessionInput): Promise<DataOwnerSessionResult> {
  const unavailable = (reason: Extract<DataOwnerSessionResult, { status: "unavailable" }>["reason"]): DataOwnerSessionResult => ({ status: "unavailable", reason });
  const bridge = input.bridge;
  const authority = { ...bridge.context() };
  const snapshot = bridge.read();
  if (!authority.canRead || !authority.key || !authority.tenantId || !snapshot.document) return unavailable("CONTEXT_UNAVAILABLE");
  const qualification = input.readQualification();
  const candidate = qualification?.native;
  if (!qualification?.key || qualification.publicEntry !== "@mutakamel/template-schema/browser-safe" ||
      !SHA.test(qualification.browserEntrypointSha256) || !candidate || typeof candidate !== "object" ||
      !nativeMethods.every(key => typeof (candidate as Record<string, unknown>)[key] === "function")) return unavailable("NATIVE_PROVIDER_INCOMPLETE");
  const native = candidate as QualifiedDataNative;
  if (qualification.host?.canonicalJson !== native.canonicalJson || typeof qualification.host?.isCurrent !== "function") return unavailable("NATIVE_PROVIDER_INCOMPLETE");
  const owner = input.readFunctionOwner();
  if (!owner?.key || !owner.isCurrent() || owner.tenantId !== authority.tenantId || owner.companyId !== authority.companyId || !Array.isArray(owner.versions)) return unavailable("FUNCTION_OWNER_UNAVAILABLE");
  if (owner.identityAuthority && (typeof owner.identityAuthority.currency !== "function" || typeof owner.identityAuthority.unit !== "function")) return unavailable("FUNCTION_OWNER_UNAVAILABLE");

  // Keep full owner version JSON, including immutable owner metadata. Do not
  // synthesize empty versions or currency/unit membership callbacks.
  const canonical = native.canonicalJson;
  let pinsJson: string, versionsJson: string, versions: DataCatalogue["versions"];
  try {
    pinsJson = canonical(qualification.host.pins);
    versionsJson = canonical(owner.versions);
    versions = freeze(JSON.parse(JSON.stringify(owner.versions)) as DataCatalogue["versions"]);
  } catch { return unavailable("CONTEXT_UNAVAILABLE"); }
  const qualificationKey = qualification.key;
  const browserHash = qualification.browserEntrypointSha256;
  const qualificationHost = qualification.host, qualifiedCurrent = qualificationHost.isCurrent;
  const methods = nativeMethods.map(key => native[key]);
  const ownerKey = owner.key, ownerCurrent = owner.isCurrent;
  const membership = owner.identityAuthority;
  const currency = membership?.currency, unit = membership?.unit;
  const source = sourceTuple(snapshot.document);
  let retired = false;
  const current = (): boolean => {
    if (retired) return false;
    try {
      const context = bridge.context(), live = bridge.read();
      const matches = input.bridge === bridge && context.key === authority.key && context.tenantId === authority.tenantId && context.companyId === authority.companyId &&
        context.canRead && context.readOnly === authority.readOnly && live.generation === snapshot.generation &&
        !!live.document && sourceTuple(live.document) === source &&
        input.readQualification() === qualification && qualification.key === qualificationKey &&
        qualification.publicEntry === "@mutakamel/template-schema/browser-safe" && qualification.browserEntrypointSha256 === browserHash &&
        qualification.native === native && qualification.host === qualificationHost && qualificationHost.isCurrent === qualifiedCurrent &&
        qualificationHost.isCurrent() && qualificationHost.canonicalJson === canonical &&
        nativeMethods.every((key, index) => native[key] === methods[index]) && canonical(qualification.host.pins) === pinsJson &&
        input.readFunctionOwner() === owner && owner.key === ownerKey && owner.isCurrent === ownerCurrent && owner.isCurrent() &&
        owner.tenantId === authority.tenantId && owner.companyId === authority.companyId && canonical(owner.versions) === versionsJson &&
        owner.identityAuthority === membership && membership?.currency === currency && membership?.unit === unit;
      retired = !matches;
      return matches;
    } catch { retired = true; return false; }
  };
  if (!current()) return unavailable("CONTEXT_RETIRED");
  const admission = await input.readOwnerAdmission({
    pins: freeze(JSON.parse(pinsJson)), canonicalJson: canonical, isCurrent: current,
  });
  if (!current()) return unavailable("CONTEXT_RETIRED");
  if (!admission) return unavailable("OWNER_ADMISSION_UNAVAILABLE");
  try {
    if (admission.contract !== "template-owner-context.v1" || canonical(admission.pins) !== pinsJson ||
        !SHA.test(admission.fingerprint) || !Object.isFrozen(admission) || !Object.isFrozen(admission.descriptor)) return unavailable("OWNER_ADMISSION_UNAVAILABLE");
  } catch { return unavailable("OWNER_ADMISSION_UNAVAILABLE"); }
  const catalogue: DataCatalogue = Object.freeze({
    authorityKey: authority.key, tenantId: authority.tenantId, companyId: authority.companyId,
    descriptor: admission.descriptor, versions,
    ...(membership ? { identityAuthority: membership } : {}),
  });
  // Execute the real descriptor guard and match the actual document source tuple.
  // A flat TemplateDataSchema is never converted to a descriptor here.
  if (!readDataDescriptor(native, catalogue, authority, snapshot.document)) return unavailable("NATIVE_DESCRIPTOR_REJECTED");
  if (!current()) return unavailable("CONTEXT_RETIRED");
  return { status: "ready", admission, host: {
    bridge,
    readCatalogue: () => current() ? catalogue : null,
    readNative: () => current() ? native : null,
    readSourceFingerprint: () => current() ? admission.fingerprint : null,
  } };
}

function sourceTuple(document: Record<string, unknown>): string {
  return JSON.stringify([document.schemaVersion, document.dataSourceKey, document.documentType, document.outputChannel, document.layoutMode, document.locale]);
}
function freeze<T>(value: T): T {
  if (value && typeof value === "object") {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}
