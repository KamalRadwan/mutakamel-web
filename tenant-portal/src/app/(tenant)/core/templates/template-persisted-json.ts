import type { TemplateDocumentModelValidationResult } from "@mutakamel/template-schema/browser-safe";

/** Refuse values JSON serialization would silently drop, coerce or execute. */
export function assertPersistedTemplateJson(value: unknown): void {
  const ancestors = new Set<object>();
  const visit = (entry: unknown): void => {
    if (entry === null || typeof entry === "string" || typeof entry === "boolean") return;
    if (typeof entry === "number" && Number.isFinite(entry) && !Object.is(entry, -0)) return;
    if (!entry || typeof entry !== "object" || ancestors.has(entry)) {
      throw new Error("Invalid persisted template JSON.");
    }
    const array = Array.isArray(entry);
    const prototype: unknown = Object.getPrototypeOf(entry);
    if (array ? prototype !== Array.prototype : prototype !== Object.prototype && prototype !== null) {
      throw new Error("Invalid persisted template JSON.");
    }
    const descriptors = Object.getOwnPropertyDescriptors(entry);
    const keys = Reflect.ownKeys(entry);
    if (array && keys.length !== entry.length + 1) throw new Error("Invalid persisted template JSON.");
    ancestors.add(entry);
    for (const key of keys) {
      if (typeof key !== "string") throw new Error("Invalid persisted template JSON.");
      if (array && key === "length") continue;
      const field = descriptors[key];
      if (!field || !field.enumerable || !Object.hasOwn(field, "value") ||
        (array && (!/^(0|[1-9]\d*)$/u.test(key) || Number(key) >= entry.length))) {
        throw new Error("Invalid persisted template JSON.");
      }
      visit(field.value);
    }
    ancestors.delete(entry);
  };
  visit(value);
}

/** Keep the raw persisted values after the qualified SDK has validated them.
 * Its normalized document is feedback; it must not become a silent write.
 */
export function retainPersistedTemplateJson(
  value: unknown,
  validation: TemplateDocumentModelValidationResult,
): TemplateDocumentModelValidationResult {
  assertPersistedTemplateJson(value);
  if (!validation.valid || !validation.document) return validation;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Invalid persisted template document.");
  }
  // Validation may normalize strings, but must not fill or drop JSON fields.
  const sameShape = (raw: unknown, checked: unknown): boolean => {
    if (raw === null || checked === null) return raw === checked;
    if (typeof raw !== "object" || typeof checked !== "object") return typeof raw === typeof checked;
    if (Array.isArray(raw) !== Array.isArray(checked)) return false;
    const rawKeys = Object.keys(raw), checkedKeys = Object.keys(checked);
    if (rawKeys.length !== checkedKeys.length) return false;
    const original = Object.getOwnPropertyDescriptors(raw), normalized = Object.getOwnPropertyDescriptors(checked);
    return rawKeys.every(key => Object.hasOwn(normalized, key) && sameShape(original[key].value, normalized[key].value));
  };
  if (!sameShape(value, validation.document)) throw new Error("Persisted template validation changed its JSON shape.");
  return { ...validation, document: value as NonNullable<TemplateDocumentModelValidationResult["document"]> };
}
