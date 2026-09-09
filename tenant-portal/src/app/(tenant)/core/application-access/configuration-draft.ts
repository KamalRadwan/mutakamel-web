import { configurationSafeValues } from "./application-configuration-read";
import type { ConfigurationNode, ConfigurationObject } from "./configuration-input-schema";

export type ConfigurationDraft = { kind: "scalar"; text: string }
  | { kind: "object"; fields: Record<string, ConfigurationDraft | undefined> }
  | { kind: "array"; items: (ConfigurationDraft | undefined)[] } | undefined;
export type ConfigurationPath = string[];
export type ConfigurationDraftErrors = Record<string, "required" | "invalid" | "limit">;
export const configurationFieldKey = (path: ConfigurationPath) => JSON.stringify(path);

export function configurationDraftAt(draft: ConfigurationDraft, path: ConfigurationPath): ConfigurationDraft {
  if (!path.length) return draft;
  const [key, ...tail] = path;
  return configurationDraftAt(draft?.kind === "object" ? draft.fields[key] : draft?.kind === "array" ? draft.items[Number(key)] : undefined, tail);
}

export function setConfigurationDraft(schema: ConfigurationNode, draft: ConfigurationDraft, path: ConfigurationPath, next: ConfigurationDraft): ConfigurationDraft {
  if (!path.length) return next;
  const [key, ...tail] = path;
  if (schema.type === "object" && Object.hasOwn(schema.properties, key)) {
    const fields = draft?.kind === "object" ? draft.fields : {};
    return { kind: "object", fields: { ...fields, [key]: setConfigurationDraft(schema.properties[key], fields[key], tail, next) } };
  }
  if (schema.type === "array" && draft?.kind === "array" && /^(0|[1-9][0-9]*)$/u.test(key) && Number(key) < draft.items.length) {
    return { kind: "array", items: draft.items.map((item, index) => index === Number(key) ? setConfigurationDraft(schema.items, item, tail, next) : item) };
  }
  throw new Error("Invalid configuration field path.");
}

export function validateConfigurationDraft(schema: ConfigurationObject, draft: ConfigurationDraft) {
  const errors: ConfigurationDraftErrors = {};
  const visit = (node: ConfigurationNode, input: ConfigurationDraft, path: ConfigurationPath, required: boolean): unknown => {
    const fail = (kind: ConfigurationDraftErrors[string] = "invalid") => { errors[configurationFieldKey(path)] = kind; return undefined; };
    if (input === undefined) return required ? fail("required") : undefined;
    if (node.type === "object") {
      if (input.kind !== "object" || Object.keys(input.fields).some((key) => !Object.hasOwn(node.properties, key))) return fail();
      const output: Record<string, unknown> = {};
      for (const [name, child] of Object.entries(node.properties)) {
        const value = visit(child, input.fields[name], [...path, name], node.required.includes(name));
        if (value !== undefined) output[name] = value;
      }
      return output;
    }
    if (node.type === "array") {
      if (input.kind !== "array" || input.items.length < (node.minItems ?? 0) || input.items.length > node.maxItems) return fail();
      return input.items.map((item, index) => visit(node.items, item, [...path, String(index)], true));
    }
    if (input.kind !== "scalar") return fail();
    let value: string | number | boolean;
    if (node.type === "string") {
      value = input.text;
      if (Array.from(value).length < (node.minLength ?? 0) || Array.from(value).length > (node.maxLength ?? 65_536)) return fail();
    } else if (node.type === "boolean") {
      if (input.text !== "true" && input.text !== "false") return fail();
      value = input.text === "true";
    } else {
      // User-entered configuration scalars, never wire money or revision strings.
      if (!/^[-+]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][-+]?\d+)?$/u.test(input.text.trim())) return fail();
      value = Number(input.text.trim());
      if (!Number.isFinite(value) || (node.type === "integer" && !Number.isSafeInteger(value))
        || (node.minimum !== undefined && value < node.minimum) || (node.maximum !== undefined && value > node.maximum)) return fail();
    }
    if (node.enum && !node.enum.includes(value)) return fail();
    return value;
  };
  const result = visit(schema, draft, [], true);
  if (Object.keys(errors).length) return { values: null, errors };
  const bounded = configurationSafeValues.safeParse(result);
  if (!bounded.success) { errors[configurationFieldKey([])] = "limit"; return { values: null, errors }; }
  return { values: bounded.data, errors };
}
