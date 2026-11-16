import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import { parseTemplateSourceMetadata } from "./template-source-metadata";

export interface TemplateOwnerPackagePin {
  readonly name: string;
  readonly version: string;
  readonly manifestSha256: string;
  readonly entrypointSha256: string;
}
export interface TemplateOwnerPins {
  readonly schema: TemplateOwnerPackagePin;
  readonly engine: TemplateOwnerPackagePin;
  readonly provider: TemplateOwnerPackagePin;
}
export interface TemplateOwnerAdmission {
  readonly contract: "template-owner-context.v1";
  readonly descriptorChecksum: string;
  readonly descriptorCanonicalSha256: string;
  readonly fingerprint: string;
  readonly pins: TemplateOwnerPins;
  /** Exact owner JSON, never a TemplateDataSchema field-list reconstruction. */
  readonly descriptor: Readonly<Record<string, unknown>>;
}
export interface TemplateOwnerAdmissionHost {
  /** From the independently qualified loader/producer release, never this response. */
  readonly pins: TemplateOwnerPins;
  /** Actual qualified template-schema/browser-safe export. */
  canonicalJson(value: unknown): string;
  /** The host captures its tenant/session/source/scope generation before fetching. */
  isCurrent(): boolean;
}

const SHA = /^[a-f0-9]{64}$/u;
const VERSION = /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/u;

/** Parse the authorized schema row; this is freshness evidence, not write authority. */
export async function readTemplateOwnerAdmission(payload: unknown, host: TemplateOwnerAdmissionHost): Promise<TemplateOwnerAdmission | null> {
  try {
    if (!host.isCurrent()) return null;
    // Detach before hashing/awaiting so retained transport aliases cannot retarget the context.
    const row = object(JSON.parse(JSON.stringify(payload)) as unknown);
    const source = parseTemplateSourceMetadata(row);
    const admission = object(row.ownerContext);
    closed(admission, ["contract", "descriptorChecksum", "descriptorCanonicalSha256", "pins", "fingerprint", "descriptor"]);
    if (admission.contract !== "template-owner-context.v1" || !hash(admission.descriptorChecksum) ||
        !hash(admission.descriptorCanonicalSha256) || !hash(admission.fingerprint)) return null;
    const descriptor = object(admission.descriptor);
    if (descriptor.key !== source.adapterKey || descriptor.version !== source.schemaVersion ||
        descriptor.documentType !== source.documentType || descriptor.checksum !== source.schemaChecksum ||
        descriptor.checksum !== admission.descriptorChecksum || !Array.isArray(descriptor.fields) ||
        !Array.isArray(descriptor.fixtureKeys) || descriptor.fixtureKeys.length !== 2 ||
        !descriptor.fixtureKeys.every(key => typeof key === "string") ||
        host.canonicalJson(descriptor.allowedOutputChannels) !== host.canonicalJson(source.allowedOutputChannels) ||
        host.canonicalJson(descriptor.allowedLayoutModes) !== host.canonicalJson(source.allowedLayoutModes)) return null;
    const pins = object(admission.pins);
    closed(pins, ["schema", "engine", "provider"]);
    for (const key of ["schema", "engine", "provider"] as const) {
      const pin = object(pins[key]);
      closed(pin, ["name", "version", "manifestSha256", "entrypointSha256"]);
      const name = key === "schema" ? "@mutakamel/template-schema" : key === "engine" ? "@mutakamel/template-engine" :
        source.adapterKey.startsWith("TRADE_") ? "@mutakamel/trade-app-contracts" : "@mutakamel/crm-app-contracts";
      if (pin.name !== name || typeof pin.version !== "string" || !VERSION.test(pin.version) ||
          pin.version.split("+", 1)[0].split("-").slice(1).join("-").split(".").some(part => /^0[0-9]+$/u.test(part)) ||
          !hash(pin.manifestSha256) || !hash(pin.entrypointSha256) ||
          host.canonicalJson(pin) !== host.canonicalJson(host.pins[key])) return null;
    }
    if (await digest(host.canonicalJson(descriptor)) !== admission.descriptorCanonicalSha256) return null;
    const fingerprint = await digest(host.canonicalJson({
      contract: admission.contract, descriptorChecksum: admission.descriptorChecksum,
      descriptorCanonicalSha256: admission.descriptorCanonicalSha256, pins,
    }));
    if (fingerprint !== admission.fingerprint || !host.isCurrent()) return null;
    // Preserve all original descriptor keys/fields/omissions. Native descriptor-bound
    // validation and any required function/identity context remain mandatory at use.
    freeze(admission);
    return admission as unknown as TemplateOwnerAdmission;
  } catch { return null; }
}

async function digest(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  return bytesToHex(sha256(bytes));
}

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid owner admission");
  return value as Record<string, unknown>;
}
function hash(value: unknown): value is string { return typeof value === "string" && SHA.test(value); }
function closed(value: Record<string, unknown>, keys: readonly string[]): void {
  if (Object.keys(value).length !== keys.length || Object.keys(value).some(key => !keys.includes(key))) throw new Error("Invalid owner admission");
}
function freeze(value: object): void {
  const pending = [value];
  while (pending.length) {
    const current = pending.pop()!;
    for (const child of Object.values(current)) if (child && typeof child === "object") pending.push(child);
    Object.freeze(current);
  }
}
