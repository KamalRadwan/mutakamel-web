import * as schema from "@mutakamel/template-schema/browser-safe";
import type { TemplateDocumentV1 } from "@mutakamel/template-schema/browser-safe";
import type { InspectorDataPortHost } from "./[id]/bindings/inspector-data-contract";
import type { DataNative } from "./[id]/bindings/binding-contract";
import type { DesignerInteractionTicket } from "./designer-interaction-exit";
import type { DescriptorAwareDesignerNative, DesignerDescriptorIdentity, DesignerNativeSource } from "./designer-native-context";
import type { BoundNativeEditorOptions } from "./template-native-editor-options";
import type { TemplateOwnerAdmission } from "./template-owner-admission";
import { parseEditorDocument, type EditorDocument } from "./template-editor-model";

/** Required future owner capability on the genuine R10 bound result. The
 * current opaque R10 implementation deliberately does not satisfy this port. */
export interface CatalogueBoundNativeOptions extends BoundNativeEditorOptions {
  readCatalogueEvidence(): unknown;
  inferTemplateFormulaType(value: unknown, context: { readonly rowSourcePath?: unknown; readonly formulas?: unknown }):
    ReturnType<DataNative["inferTemplateFormulaType"]>;
}

/** R10's actual opaque validator retains its immutable functions and finite
 * identity memberships. Geometry and every final inspector Apply use it.
 */
export function createReleasedDesignerNativeSource(ticket: DesignerInteractionTicket, admission: TemplateOwnerAdmission,
  options: CatalogueBoundNativeOptions, host: InspectorDataPortHost, current: () => boolean): DesignerNativeSource | null {
  const identity: DesignerDescriptorIdentity = Object.freeze({
    dataSourceKey: String(admission.descriptor.key), descriptorVersion: Number(admission.descriptor.version),
    descriptorChecksum: admission.descriptorChecksum, descriptorCanonicalSha256: admission.descriptorCanonicalSha256,
    fingerprint: admission.fingerprint, pins: admission.pins,
  });
  const descriptorJson = schema.canonicalJson(admission.descriptor);
  const matchesDescriptor = (value: unknown) => {
    try { return schema.canonicalJson(value) === descriptorJson; } catch { return false; }
  };
  const live = () => current() && options.isCurrent() && host.readSourceFingerprint() === admission.fingerprint;
  const validate = (value: unknown): ReturnType<BoundNativeEditorOptions["validateTemplateDocumentModel"]> => {
    try { if (live()) return options.validateTemplateDocumentModel(value); } catch { /* Refuse malformed input. */ }
    return { valid: false, issues: [], bindingPaths: [], assetIds: [] };
  };
  const admit = (value: unknown): TemplateDocumentV1 => {
    const result = validate(value);
    if (!result.valid || !result.document) throw new Error("Current native editor context refused the document");
    return result.document;
  };
  const browser: DescriptorAwareDesignerNative = {
    validateTemplateDocumentModel(value, validation) {
      if (!matchesDescriptor(validation.dataSchema)) return { valid: false, issues: [] };
      return validate(value);
    },
    prepareTemplateGraphCommand(document, command) {
      const result = schema.prepareTemplateGraphCommand(admit(document), command);
      return { status: result.status, candidate: parseEditorDocument(result.candidate) };
    },
    remapTemplateDocumentNodes(document, idMap) { return parseEditorDocument(schema.remapTemplateDocumentNodes(admit(document), idMap)); },
    collectTemplateCopyIds(document, nodeIds) { return schema.collectTemplateCopyIds(admit(document), nodeIds); },
    projectTemplateGeometry(document) { return schema.projectTemplateGeometry(admit(document)); },
    resolveTemplateTextDirection: schema.resolveTemplateTextDirection,
    multiplyTemplateMatrices: schema.multiplyTemplateMatrices, invertTemplateMatrix: schema.invertTemplateMatrix,
    transformTemplatePoint: schema.transformTemplatePoint, templateFrameMatrix: schema.templateFrameMatrix,
    templateFrameCorners: schema.templateFrameCorners, templateFrameFromMatrix: schema.templateFrameFromMatrix,
    translateTemplateMatrix: schema.translateTemplateMatrix, scaleTemplateMatrix: schema.scaleTemplateMatrix,
  };
  const native = host.readNative();
  if (!native || !live()) return null;
  // The qualification above receives the unchanged archive namespace. This
  // stable command adapter adds the authoritative R10 final check, not exports.
  const inspectorNative = Object.freeze<DataNative>({
    validateDescriptorModel: native.validateDescriptorModel,
    parseTemplateFormulaExpression: native.parseTemplateFormulaExpression,
    inferTemplateFormulaType(value, validation) {
      if (!live() || !matchesDescriptor(validation.dataSchema)) throw new Error("Native catalogue is unavailable");
      return options.inferTemplateFormulaType(value, { rowSourcePath: validation.rowSourcePath, formulas: validation.formulas });
    },
    validateTemplateDocumentModel(value, validation) {
      if (!matchesDescriptor(validation.dataSchema)) return { valid: false };
      return validate(value);
    },
  });
  const execute = (value: EditorDocument, isCurrent?: () => boolean): boolean => {
    if (!live() || !host.bridge.canEdit()) return false;
    const result = validate(value);
    if (!result.document || !result.valid || !live()) return false;
    const document = parseEditorDocument(result.document);
    return isCurrent ? host.bridge.executeScoped?.(document, isCurrent) === true : host.bridge.execute(document);
  };
  const dataHost: InspectorDataPortHost = {
    bridge: { ...host.bridge,
      read: () => { const snapshot = host.bridge.read(); return live() ? snapshot : { ...snapshot, document: null }; },
      context: () => ({ ...host.bridge.context(), canRead: live() }),
      canEdit: () => live() && host.bridge.canEdit(),
      execute: value => execute(value),
      executeScoped: (value, isCurrent) => execute(value, isCurrent),
    },
    readCatalogue: () => live() ? host.readCatalogue() : null,
    readNative: () => live() ? inspectorNative : null,
    readSourceFingerprint: () => live() ? admission.fingerprint : null,
  };
  return Object.freeze({
    bindingKey: JSON.stringify([ticket.bridgeKey, ticket.generation, admission.fingerprint, options.fingerprint]),
    descriptor: admission.descriptor, browser, dataHost,
    binding: Object.freeze({ identity, currentIdentity: () => live() ? identity : null }),
  });
}
