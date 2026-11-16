import type { ComponentType } from "react";
import { parseEditorDocument, type EditorDocument } from "./template-editor-model";
import type { DesignerInteractionBridge, DesignerNativeGeometry } from "./designer-interaction-contract";
import type { DesignerHandleLayerProps } from "./[id]/components/DesignerInteractionPanel";
import type { InspectorDataPortHost } from "./[id]/bindings/inspector-data-contract";

interface NativeAdmission {
  readonly valid: boolean;
  readonly document?: unknown;
  readonly issues: readonly { readonly code: string; readonly message: string; readonly nodeId?: string }[];
}
/** Real native exports; only the owning API may supply the complete descriptor. */
export interface DescriptorAwareDesignerNative extends Omit<DesignerNativeGeometry, "validateTemplateDocumentModel"> {
  validateTemplateDocumentModel(value: unknown, options: { readonly dataSchema: unknown; readonly functions?: unknown; readonly formulaIdentityAuthority?: unknown }): NativeAdmission;
}
export interface DescriptorBoundDesignerProvider {
  readonly bindingKey: string;
  readonly descriptor: unknown;
  readonly identity: DesignerDescriptorIdentity;
  readonly dataHost?: InspectorDataPortHost;
  readonly native: DesignerNativeGeometry;
  readonly Handles?: ComponentType<DesignerHandleLayerProps>;
  isCurrent(): boolean;
  retire(): void;
}
export interface DesignerNativePackagePin {
  readonly name: string; readonly version: string; readonly manifestSha256: string; readonly entrypointSha256: string;
}
export interface DesignerDescriptorIdentity {
  readonly dataSourceKey: string; readonly descriptorVersion: number; readonly descriptorChecksum: string; readonly fingerprint: string;
  readonly descriptorCanonicalSha256: string;
  readonly pins: { readonly schema: DesignerNativePackagePin; readonly engine: DesignerNativePackagePin; readonly provider: DesignerNativePackagePin };
}
export interface DesignerDescriptorBinding {
  readonly identity: DesignerDescriptorIdentity;
  /** Trusted T04 reader lookup. Must change/return null on refresh, revocation or accepted admission replacement. */
  currentIdentity(): DesignerDescriptorIdentity | null;
}
export interface DesignerNativeSource {
  readonly bindingKey: string;
  readonly browser: DescriptorAwareDesignerNative;
  readonly descriptor: unknown;
  readonly Handles?: ComponentType<DesignerHandleLayerProps>;
  readonly binding: DesignerDescriptorBinding;
  readonly dataHost?: InspectorDataPortHost;
  /** Actual current owner options only. Missing catalogue/identity stays absent. */
  readValidationContext?(): { readonly functions?: unknown; readonly formulaIdentityAuthority?: unknown } | null;
}
const admittedProviders = new WeakSet<object>();
const sourceTuple = ["schemaVersion", "documentType", "outputChannel", "layoutMode", "dataSourceKey", "locale"] as const;
const denied = (): NativeAdmission => ({ valid: false, issues: [] });
export function designerDescriptorIdentityKey(identity: DesignerDescriptorIdentity): string {
  try {
    const pin = (value: DesignerNativePackagePin) => [value.name, value.version, value.manifestSha256, value.entrypointSha256];
    return JSON.stringify([identity.dataSourceKey, identity.descriptorVersion, identity.descriptorChecksum, identity.descriptorCanonicalSha256, identity.fingerprint, pin(identity.pins.schema), pin(identity.pins.engine), pin(identity.pins.provider)]);
  } catch { return ""; }
}

/** Do not call with the current field-list wire projection or a guessed context. */
export function createDescriptorBoundDesignerProvider(
  browser: DescriptorAwareDesignerNative, bridge: DesignerInteractionBridge, descriptor: unknown, binding: DesignerDescriptorBinding,
  Handles?: ComponentType<DesignerHandleLayerProps>,
  readValidationContext?: DesignerNativeSource["readValidationContext"], dataHost?: InspectorDataPortHost,
): DescriptorBoundDesignerProvider | null {
  const authority = bridge.context(), source = bridge.read().document;
  if (!authority.canRead || !source || !descriptor || typeof descriptor !== "object" || Array.isArray(descriptor)) return null;
  // Snapshot before validation so a retained response object cannot mutate the
  // schema used by a later property, keyboard or pointer command.
  const dataSchema: unknown = JSON.parse(JSON.stringify(descriptor));
  const row = dataSchema as Record<string, unknown>;
  if (!binding?.identity || !binding.currentIdentity) return null;
  const identity = JSON.parse(JSON.stringify(binding.identity)) as DesignerDescriptorIdentity;
  const identityKey = designerDescriptorIdentityKey(identity);
  if (!identityKey || identity.dataSourceKey !== row.key || identity.descriptorVersion !== row.version || identity.descriptorChecksum !== row.checksum ||
    !/^[0-9a-f]{64}$/u.test(identity.fingerprint) || !/^[0-9a-f]{64}$/u.test(identity.descriptorCanonicalSha256) || ![identity.pins.schema, identity.pins.engine, identity.pins.provider].every(pin =>
      !!pin.name && !!pin.version && /^[0-9a-f]{64}$/u.test(pin.manifestSha256) && /^[0-9a-f]{64}$/u.test(pin.entrypointSha256))) return null;
  if (row.key !== source.dataSourceKey || row.version !== source.schemaVersion || row.documentType !== source.documentType ||
      typeof row.checksum !== "string" || !/^[0-9a-f]{64}$/u.test(row.checksum) || !Array.isArray(row.fields) ||
      !Array.isArray(row.fixtureKeys) || row.fixtureKeys.length !== 2 || !Array.isArray(row.allowedOutputChannels) ||
      !row.allowedOutputChannels.includes(source.outputChannel) || !Array.isArray(row.allowedLayoutModes) || !row.allowedLayoutModes.includes(source.layoutMode)) return null;
  const freeze = (value: unknown): void => { if (value && typeof value === "object") { Object.values(value).forEach(freeze); Object.freeze(value); } };
  freeze(dataSchema);
  freeze(identity);
  const validationContext = readValidationContext?.();
  if (readValidationContext && !validationContext) return null;
  let retired = false;
  const generation = bridge.read().generation;
  const isCurrent = () => {
    if (retired || !bridge.context().canRead || bridge.context().key !== authority.key || bridge.read().generation !== generation) return false;
    try {
      if (readValidationContext && readValidationContext() !== validationContext) return false;
      const current = binding.currentIdentity();
      return !!current && designerDescriptorIdentityKey(current) === identityKey;
    } catch { return false; }
  };
  const retire = () => { retired = true; };
  const validateTemplateDocumentModel = (value: unknown) => {
    if (!isCurrent()) return denied();
    const result = browser.validateTemplateDocumentModel(value, { dataSchema, ...validationContext });
    if (!result.valid || !result.document) return { ...result, document: undefined };
    const document = parseEditorDocument(result.document);
    if (sourceTuple.some(key => document[key] !== source[key])) return denied();
    return { ...result, document };
  };
  try {
    if (!validateTemplateDocumentModel(source).valid) return null;
    const native: DesignerNativeGeometry = {
      ...browser,
      validateTemplateDocumentModel(value: unknown) {
        const result = validateTemplateDocumentModel(value);
        return { ...result, document: result.document ? parseEditorDocument(result.document) : undefined };
      },
    };
    const provider = Object.freeze({ bindingKey: JSON.stringify([authority.key, generation, identityKey]), descriptor: dataSchema, identity, native, Handles, dataHost, isCurrent, retire });
    admittedProviders.add(provider);
    return provider;
  } catch { return null; }
}

export function isDescriptorBoundDesignerProvider(value: unknown): value is DescriptorBoundDesignerProvider {
  return !!value && typeof value === "object" && admittedProviders.has(value) && (value as DescriptorBoundDesignerProvider).isCurrent();
}

export function currentNativeDesignerDocument(provider: DescriptorBoundDesignerProvider, document: EditorDocument): EditorDocument | null {
  if (!isDescriptorBoundDesignerProvider(provider)) return null;
  const result = provider.native.validateTemplateDocumentModel(document);
  return result.valid && result.document ? result.document : null;
}

export function withDescriptorBoundDesignerHandles(provider: DescriptorBoundDesignerProvider, Handles: ComponentType<DesignerHandleLayerProps>): DescriptorBoundDesignerProvider | null {
  if (!isDescriptorBoundDesignerProvider(provider)) return null;
  const bound = Object.freeze({ ...provider, Handles });
  admittedProviders.add(bound);
  return bound;
}
