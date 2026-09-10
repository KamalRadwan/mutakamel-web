interface ConfigurationText { ar: string; en: string }
interface ConfigurationUi { label: ConfigurationText; help?: ConfigurationText; enumLabels?: ConfigurationText[]; widget?: "textarea" | "password" }
type Scalar = string | number | boolean;
export interface ConfigurationObject { type: "object"; ui: ConfigurationUi; properties: Record<string, ConfigurationNode>; required: string[]; additionalProperties: false }
export type ConfigurationNode = ConfigurationObject
  | { type: "array"; ui: ConfigurationUi; items: ConfigurationNode; minItems?: number; maxItems: number }
  | { type: "string"; ui: ConfigurationUi; minLength?: number; maxLength?: number; enum?: Scalar[]; writeOnly?: true }
  | { type: "number" | "integer"; ui: ConfigurationUi; minimum?: number; maximum?: number; enum?: Scalar[] }
  | { type: "boolean"; ui: ConfigurationUi; enum?: Scalar[] };

// Exact Core addon-configuration-input.schema.ts vocabulary. Inspect semantic depth before recursion.
export function parseConfigurationInputSchema(value: unknown): ConfigurationObject {
  let nodes = 0;
  const visit = (input: unknown, depth: number): ConfigurationNode => {
    if (++nodes > 200 || depth > 10) invalid();
    const row = record(input), type = row.type;
    if (typeof type !== "string" || !["object", "array", "string", "number", "integer", "boolean"].includes(type)) invalid();
    const options = type === "object" ? ["properties", "required", "additionalProperties"] : type === "array" ? ["items", "minItems", "maxItems"]
      : type === "string" ? ["minLength", "maxLength", "enum", "writeOnly"] : type === "boolean" ? ["enum"] : ["minimum", "maximum"];
    keys(row, ["type", "ui", ...options, ...(["number", "integer"].includes(type) ? ["enum"] : [])], ["type", "ui"]);
    const ui = parseUi(row.ui);
    if (type === "object") {
      if (ui.widget !== undefined || ui.enumLabels !== undefined || row.additionalProperties !== false) invalid();
      const source = record(row.properties), names = Object.keys(source), required = array(row.required);
      if (names.length > 100 || names.some((name) => !/^[A-Za-z][A-Za-z0-9_]{0,63}$/u.test(name))
        || required.some((name) => typeof name !== "string" || !names.includes(name)) || new Set(required).size !== required.length) invalid();
      const properties: Record<string, ConfigurationNode> = {};
      for (const name of names) properties[name] = visit(source[name], depth + 1);
      return { type, ui, properties, required: required as string[], additionalProperties: false };
    }
    if (type === "array") {
      if (ui.widget !== undefined || ui.enumLabels !== undefined) invalid();
      const maxItems = integer(row.maxItems, 0, 100), minItems = optionalInteger(row.minItems, 0, maxItems);
      return { type, ui, items: visit(row.items, depth + 1), maxItems, ...(minItems === undefined ? {} : { minItems }) };
    }
    const values = row.enum === undefined ? undefined : array(row.enum);
    if (values && (values.length < 1 || new Set(values).size !== values.length)) invalid();
    if (values ? ui.enumLabels?.length !== values.length : ui.enumLabels !== undefined) invalid();
    if (values?.some((item) => type === "string" ? typeof item !== "string" : type === "boolean" ? typeof item !== "boolean"
      : typeof item !== "number" || !Number.isFinite(item) || (type === "integer" && !Number.isSafeInteger(item)))) invalid();
    const enumeration = values === undefined ? {} : { enum: values as Scalar[] };
    if (type === "string") {
      const maxLength = optionalInteger(row.maxLength, 0, 65_536), minLength = optionalInteger(row.minLength, 0, maxLength ?? 65_536);
      if (row.writeOnly !== undefined && row.writeOnly !== true) invalid();
      if ((row.writeOnly === true) !== (ui.widget === "password") || (row.writeOnly === true && values !== undefined)) invalid();
      if (values?.some((item) => typeof item !== "string" || Array.from(item).length < (minLength ?? 0) || Array.from(item).length > (maxLength ?? 65_536))) invalid();
      return { type, ui, ...enumeration, ...(minLength === undefined ? {} : { minLength }), ...(maxLength === undefined ? {} : { maxLength }),
        ...(row.writeOnly === true ? { writeOnly: true as const } : {}) };
    }
    if (ui.widget !== undefined) invalid();
    if (type === "boolean") return { type, ui, ...enumeration };
    if (type !== "number" && type !== "integer") invalid();
    const minimum = optionalNumber(row.minimum, type === "integer"), maximum = optionalNumber(row.maximum, type === "integer");
    if (minimum !== undefined && maximum !== undefined && minimum > maximum) invalid();
    if (values?.some((item) => typeof item !== "number" || (minimum !== undefined && item < minimum) || (maximum !== undefined && item > maximum))) invalid();
    return { type, ui, ...enumeration, ...(minimum === undefined ? {} : { minimum }), ...(maximum === undefined ? {} : { maximum }) };
  };
  const result = visit(value, 1);
  if (result.type !== "object" || new TextEncoder().encode(JSON.stringify(result)).byteLength > 65_536) invalid();
  return result;
}

function parseUi(value: unknown): ConfigurationUi {
  const row = record(value); keys(row, ["label", "help", "enumLabels", "widget"], ["label"]);
  if (row.widget !== undefined && row.widget !== "textarea" && row.widget !== "password") invalid();
  const labels = row.enumLabels === undefined ? undefined : array(row.enumLabels);
  return { label: localized(row.label, 300), ...(row.help === undefined ? {} : { help: localized(row.help, 1000) }),
    ...(labels === undefined ? {} : { enumLabels: labels.map((label) => localized(label, 300)) }),
    ...(row.widget === undefined ? {} : { widget: row.widget as "textarea" | "password" }) };
}
function localized(value: unknown, limit: number): ConfigurationText {
  const row = record(value); keys(row, ["ar", "en"], ["ar", "en"]);
  for (const text of [row.ar, row.en]) if (typeof text !== "string" || !text.trim() || text.length > limit
    || Array.from(text).some((character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)) invalid();
  return { ar: row.ar as string, en: row.en as string };
}
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Object.getPrototypeOf(value) !== Object.prototype) invalid();
  const result: Record<string, unknown> = {};
  for (const key of Reflect.ownKeys(value)) {
    const field = Object.getOwnPropertyDescriptor(value, key);
    if (typeof key !== "string" || ["__proto__", "prototype", "constructor"].includes(key) || !field?.enumerable || !Object.hasOwn(field, "value")) invalid();
    result[key] = field.value;
  }
  return result;
}
function array(value: unknown): unknown[] {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype || value.length > 100 || Reflect.ownKeys(value).length !== value.length + 1) invalid();
  return Array.from({ length: value.length }, (_, index) => {
    const field = Object.getOwnPropertyDescriptor(value, String(index));
    if (!field?.enumerable || !Object.hasOwn(field, "value")) invalid();
    return field.value as unknown;
  });
}
function keys(row: Record<string, unknown>, allowed: string[], required: string[]) {
  if (Object.keys(row).some((key) => !allowed.includes(key)) || required.some((key) => !Object.hasOwn(row, key))) invalid();
}
function integer(value: unknown, min: number, max: number): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < min || value > max) invalid(); return value;
}
function optionalInteger(value: unknown, min: number, max: number) { return value === undefined ? undefined : integer(value, min, max); }
function optionalNumber(value: unknown, safe: boolean): number | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "number" || !Number.isFinite(value) || (safe && !Number.isSafeInteger(value))) invalid(); return value;
}
function invalid(): never { throw new Error("The configuration input schema could not be verified."); }
