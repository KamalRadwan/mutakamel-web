import { dataRecord, type DataAuthority, type DataCatalogue, type DataDescriptor, type DataField, type DataNative } from "./binding-contract";
import { isUUIDv7 } from "@/lib/uuid";
import type { EditorDocument } from "../../template-editor-model";

export function readDataDescriptor(native: DataNative | null, catalogue: DataCatalogue | null, authority: DataAuthority, document: EditorDocument | null): DataDescriptor | null {
  if (!native || !catalogue || !authority.canRead || !document || catalogue.authorityKey !== authority.key || catalogue.tenantId !== authority.tenantId || catalogue.companyId !== authority.companyId) return null;
  try {
    native.validateDescriptorModel(catalogue.descriptor);
    const descriptor = catalogue.descriptor as DataDescriptor;
    if (descriptor.key !== document.dataSourceKey || descriptor.documentType !== document.documentType ||
      !descriptor.allowedOutputChannels.includes(String(document.outputChannel)) || !descriptor.allowedLayoutModes.includes(String(document.layoutMode))) return null;
    return descriptor;
  } catch { return null; }
}
export function cataloguePin(catalogue: DataCatalogue): string {
  // Full definitions and scope are pinned too: a caller cannot mutate an existing version in an open form.
  return JSON.stringify([catalogue.authorityKey, catalogue.tenantId, catalogue.companyId, catalogue.descriptor, catalogue.versions]);
}
export function availableFunctions(catalogue: DataCatalogue): DataCatalogue["versions"] {
  const counts = new Map<string, number>();
  for (const row of catalogue.versions) counts.set(row.id, (counts.get(row.id) ?? 0) + 1);
  return catalogue.versions.filter(row => counts.get(row.id) === 1 && isUUIDv7(row.id) && isUUIDv7(row.functionId) &&
    /^[0-9a-f]{64}$/.test(row.contentChecksum) && Number.isSafeInteger(row.versionNumber) && row.versionNumber > 0 &&
    (row.scope.scopeType === "TENANT" || row.scope.scopeType === "COMPANY" && row.scope.companyId === catalogue.companyId) &&
    Array.isArray(row.definition.parameters));
}
export function formulaContext(descriptor: DataDescriptor, catalogue: DataCatalogue, rowSourcePath?: string, formulas?: Record<string, unknown>) {
  return { dataSchema: descriptor, rowSourcePath, formulas, identityAuthority: catalogue.identityAuthority,
    functions: Object.fromEntries(availableFunctions(catalogue).map(row => [row.id, {
      numericPolicy: row.definition.numericPolicy, parameters: row.definition.parameters,
      result: row.definition.result, expression: row.definition.expression,
    }])) };
}
export function dataFields(descriptor: DataDescriptor, rowSourcePath?: string): { path: string; field: DataField }[] {
  const prefix = rowSourcePath ? `${rowSourcePath}[].` : "";
  return descriptor.fields.flatMap(field => {
    if (prefix && !field.path.startsWith(prefix)) return [];
    const path = prefix ? field.path.slice(prefix.length) : field.path;
    return !path.includes("[]") && !["ARRAY", "OBJECT", "IMAGE"].includes(field.dataType) ? [{ path, field }] : [];
  });
}
export function documentFormulas(document: EditorDocument): Record<string, unknown> {
  return Object.fromEntries(Object.values(document.nodes).filter(node => node.type === "formula").map(node => [String(node.props.formulaId), dataRecord(node.props.expression)]));
}
