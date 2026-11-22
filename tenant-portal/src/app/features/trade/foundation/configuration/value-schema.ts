import type { MergeStrategy, ValueSchema } from './configuration.model';

export type ValueErrorRule =
  | 'type'
  | 'enum'
  | 'min'
  | 'max'
  | 'minLength'
  | 'maxLength'
  | 'minItems'
  | 'maxItems'
  | 'required'
  | 'unknownKey';

export interface ValueValidationError {
  path: string;
  rule: ValueErrorRule;
  min?: number;
  max?: number;
  key?: string;
  messageKey?: string;
}

export type SchemaTypeKey =
  | 'boolean'
  | 'integer'
  | 'number'
  | 'string'
  | 'enum'
  | 'enumArray'
  | 'object'
  | 'json';

export interface EnumPlanOption {
  key: string;
  value: unknown;
  label: string;
}

export type SimpleEditorPlan =
  | { kind: 'boolean' }
  | { kind: 'enum'; valueType: 'string' | 'number' | 'integer'; options: EnumPlanOption[] }
  | { kind: 'number'; integer: boolean; minimum?: number; maximum?: number }
  | { kind: 'string'; minLength?: number; maxLength?: number; multiline: boolean }
  | {
      kind: 'enumArray';
      itemType: 'string' | 'number' | 'integer';
      options: EnumPlanOption[];
      minItems?: number;
      maxItems?: number;
    }
  | {
      kind: 'primitiveArray';
      itemType: 'string' | 'number' | 'integer';
      minItems?: number;
      maxItems?: number;
    };

export interface ObjectEditorField {
  key: string;
  label: string;
  required: boolean;
  schema: ValueSchema;
  plan: SimpleEditorPlan;
}

export type EditorPlan =
  | SimpleEditorPlan
  | { kind: 'object'; fields: ObjectEditorField[] }
  | { kind: 'json' };

const ALLOWED_SCHEMA_KEYWORDS: ReadonlySet<string> = new Set([
  'type',
  'enum',
  'properties',
  'required',
  'items',
  'additionalProperties',
  'minimum',
  'maximum',
  'minLength',
  'maxLength',
  'minItems',
  'maxItems',
]);

const VALID_SCHEMA_TYPES: ReadonlySet<string> = new Set([
  'boolean',
  'string',
  'number',
  'integer',
  'object',
  'array',
]);

export function stableJson(value: unknown): string {
  if (value === null) return 'null';
  if (typeof value === 'boolean' || typeof value === 'number' || typeof value === 'string') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableJson(item)).join(',')}]`;
  }
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const entries = Object.keys(record)
      .filter((key) => record[key] !== undefined)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`);
    return `{${entries.join(',')}}`;
  }
  return 'null';
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function matchesSchemaType(type: ValueSchema['type'], value: unknown): boolean {
  switch (type) {
    case 'boolean':
      return typeof value === 'boolean';
    case 'string':
      return typeof value === 'string';
    case 'number':
      return typeof value === 'number' && Number.isFinite(value);
    case 'integer':
      return typeof value === 'number' && Number.isSafeInteger(value);
    case 'array':
      return Array.isArray(value);
    case 'object':
      return isPlainObject(value);
  }
}

function validateNode(
  schema: ValueSchema,
  value: unknown,
  path: string,
  errors: ValueValidationError[],
): void {
  if (!matchesSchemaType(schema.type, value)) {
    errors.push({ path, rule: 'type' });
    return;
  }

  if (Array.isArray(schema.enum)) {
    const serialized = stableJson(value);
    if (!schema.enum.some((opt) => stableJson(opt) === serialized)) {
      errors.push({ path, rule: 'enum' });
    }
  }

  if (schema.type === 'number' || schema.type === 'integer') {
    const num = value as number;
    if (schema.minimum !== undefined && num < schema.minimum) {
      errors.push({ path, rule: 'min', min: schema.minimum });
    }
    if (schema.maximum !== undefined && num > schema.maximum) {
      errors.push({ path, rule: 'max', max: schema.maximum });
    }
    return;
  }

  if (schema.type === 'string') {
    const len = [...(value as string)].length;
    if (schema.minLength !== undefined && len < schema.minLength) {
      errors.push({ path, rule: 'minLength', min: schema.minLength });
    }
    if (schema.maxLength !== undefined && len > schema.maxLength) {
      errors.push({ path, rule: 'maxLength', max: schema.maxLength });
    }
    return;
  }

  if (schema.type === 'array') {
    const items = value as unknown[];
    if (schema.minItems !== undefined && items.length < schema.minItems) {
      errors.push({ path, rule: 'minItems', min: schema.minItems });
    }
    if (schema.maxItems !== undefined && items.length > schema.maxItems) {
      errors.push({ path, rule: 'maxItems', max: schema.maxItems });
    }
    if (schema.items) {
      for (let i = 0; i < items.length; i += 1) {
        validateNode(schema.items, items[i], `${path}[${i}]`, errors);
      }
    }
    return;
  }

  if (schema.type === 'object') {
    const record = value as Record<string, unknown>;
    const props = schema.properties ?? {};
    const requiredKeys = schema.required ?? [];

    for (const reqKey of requiredKeys) {
      if (!Object.prototype.hasOwnProperty.call(record, reqKey) || record[reqKey] === undefined) {
        errors.push({ path: `${path}.${reqKey}`, rule: 'required', key: reqKey });
      }
    }

    for (const [key, propValue] of Object.entries(record)) {
      if (!Object.prototype.hasOwnProperty.call(props, key)) {
        errors.push({ path: `${path}.${key}`, rule: 'unknownKey', key });
        continue;
      }
      if (propValue !== undefined) {
        validateNode(props[key], propValue, `${path}.${key}`, errors);
      }
    }
  }
}

export function validateValue(schema: ValueSchema, value: unknown): ValueValidationError[] {
  const errors: ValueValidationError[] = [];
  validateNode(schema, value, '$', errors);
  return errors;
}

function isNonNegativeInt(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

export function validateSchemaSubset(schema: unknown, depth = 1): schema is ValueSchema {
  if (depth > 6 || !isPlainObject(schema)) {
    return false;
  }

  for (const key of Object.keys(schema)) {
    if (!ALLOWED_SCHEMA_KEYWORDS.has(key)) {
      return false;
    }
  }

  const rawType = schema['type'];
  if (typeof rawType !== 'string' || !VALID_SCHEMA_TYPES.has(rawType)) {
    return false;
  }
  const type = rawType as ValueSchema['type'];

  if (schema['enum'] !== undefined) {
    const enumList = schema['enum'];
    if (!Array.isArray(enumList) || enumList.length === 0) {
      return false;
    }
    if (!enumList.every((item) => matchesSchemaType(type, item))) {
      return false;
    }
  }

  if (schema['minimum'] !== undefined && (typeof schema['minimum'] !== 'number' || !Number.isFinite(schema['minimum']))) {
    return false;
  }
  if (schema['maximum'] !== undefined && (typeof schema['maximum'] !== 'number' || !Number.isFinite(schema['maximum']))) {
    return false;
  }
  if (
    typeof schema['minimum'] === 'number' &&
    typeof schema['maximum'] === 'number' &&
    schema['minimum'] > schema['maximum']
  ) {
    return false;
  }

  if (schema['minLength'] !== undefined && !isNonNegativeInt(schema['minLength'])) {
    return false;
  }
  if (schema['maxLength'] !== undefined && !isNonNegativeInt(schema['maxLength'])) {
    return false;
  }
  if (
    typeof schema['minLength'] === 'number' &&
    typeof schema['maxLength'] === 'number' &&
    schema['minLength'] > schema['maxLength']
  ) {
    return false;
  }

  if (schema['minItems'] !== undefined && !isNonNegativeInt(schema['minItems'])) {
    return false;
  }
  if (schema['maxItems'] !== undefined && !isNonNegativeInt(schema['maxItems'])) {
    return false;
  }
  if (
    typeof schema['minItems'] === 'number' &&
    typeof schema['maxItems'] === 'number' &&
    schema['minItems'] > schema['maxItems']
  ) {
    return false;
  }

  if (type === 'object') {
    const props = schema['properties'];
    if (!isPlainObject(props) || schema['additionalProperties'] !== false) {
      return false;
    }
    const propEntries = Object.entries(props);
    for (const [, propSchema] of propEntries) {
      if (!validateSchemaSubset(propSchema, depth + 1)) {
        return false;
      }
    }
    const req = schema['required'];
    if (req !== undefined) {
      if (!Array.isArray(req) || !req.every((k) => typeof k === 'string' && Object.prototype.hasOwnProperty.call(props, k))) {
        return false;
      }
    }
  }

  if (type === 'array') {
    if (!validateSchemaSubset(schema['items'], depth + 1)) {
      return false;
    }
  }

  return true;
}

export function mergeFitsSchema(schema: ValueSchema, merge: MergeStrategy): boolean {
  switch (merge) {
    case 'OVERRIDE':
    case 'FIRST_MATCH':
      return true;
    case 'MIN':
    case 'MAX':
      return schema.type === 'number' || schema.type === 'integer';
    case 'UNION':
      return schema.type === 'array';
    case 'DENY_WINS':
      return schema.type === 'boolean';
  }
}

export function allowedMergesForSchema(schema: ValueSchema): MergeStrategy[] {
  const result: MergeStrategy[] = ['OVERRIDE', 'FIRST_MATCH'];
  if (schema.type === 'number' || schema.type === 'integer') {
    result.push('MIN', 'MAX');
  } else if (schema.type === 'array') {
    result.push('UNION');
  } else if (schema.type === 'boolean') {
    result.push('DENY_WINS');
  }
  return result;
}

function buildEnumOptions(values: readonly unknown[]): EnumPlanOption[] {
  return values.map((item) => ({
    key: stableJson(item),
    value: item,
    label: String(item),
  }));
}

function simplePlan(schema: ValueSchema): SimpleEditorPlan | null {
  if (schema.type === 'boolean' && !schema.enum?.length) {
    return { kind: 'boolean' };
  }

  if (
    (schema.type === 'string' || schema.type === 'number' || schema.type === 'integer') &&
    schema.enum &&
    schema.enum.length > 0
  ) {
    return {
      kind: 'enum',
      valueType: schema.type,
      options: buildEnumOptions(schema.enum),
    };
  }

  if (schema.type === 'integer' || schema.type === 'number') {
    return {
      kind: 'number',
      integer: schema.type === 'integer',
      minimum: schema.minimum,
      maximum: schema.maximum,
    };
  }

  if (schema.type === 'string') {
    return {
      kind: 'string',
      minLength: schema.minLength,
      maxLength: schema.maxLength,
      multiline: (schema.maxLength ?? 0) > 120,
    };
  }

  if (schema.type === 'array' && schema.items && !schema.enum?.length) {
    const item = schema.items;
    if (item.type === 'string' || item.type === 'number' || item.type === 'integer') {
      if (item.enum && item.enum.length > 0) {
        return {
          kind: 'enumArray',
          itemType: item.type,
          options: buildEnumOptions(item.enum),
          minItems: schema.minItems,
          maxItems: schema.maxItems,
        };
      }
      return {
        kind: 'primitiveArray',
        itemType: item.type,
        minItems: schema.minItems,
        maxItems: schema.maxItems,
      };
    }
  }

  return null;
}

export function propertyNameToWords(name: string): string {
  const spaced = name
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_.-]+/g, ' ')
    .trim();
  if (!spaced) return name;
  return spaced.charAt(0).toUpperCase() + spaced.slice(1).toLowerCase();
}

export function editorPlan(schema: ValueSchema): EditorPlan {
  const direct = simplePlan(schema);
  if (direct) {
    return direct;
  }

  if (schema.type === 'object' && !schema.enum?.length && schema.properties) {
    const entries = Object.entries(schema.properties);
    if (entries.length > 0) {
      const requiredSet = new Set(schema.required ?? []);
      const fields: ObjectEditorField[] = [];
      let allSimple = true;

      for (const [key, propSchema] of entries) {
        const subPlan = simplePlan(propSchema);
        if (!subPlan) {
          allSimple = false;
          break;
        }
        fields.push({
          key,
          label: propertyNameToWords(key),
          required: requiredSet.has(key),
          schema: propSchema,
          plan: subPlan,
        });
      }

      if (allSimple) {
        return { kind: 'object', fields };
      }
    }
  }

  return { kind: 'json' };
}

export function schemaTypeKey(schema: ValueSchema): SchemaTypeKey {
  const plan = editorPlan(schema);
  switch (plan.kind) {
    case 'boolean':
      return 'boolean';
    case 'enum':
      return 'enum';
    case 'number':
      return plan.integer ? 'integer' : 'number';
    case 'string':
      return 'string';
    case 'enumArray':
    case 'primitiveArray':
      return 'enumArray';
    case 'object':
      return 'object';
    case 'json':
      return schema.type === 'object' ? 'object' : 'json';
  }
}

export function defaultValueForSchema(schema: ValueSchema): unknown {
  const plan = editorPlan(schema);
  switch (plan.kind) {
    case 'boolean':
      return false;
    case 'enum':
      return plan.options[0]?.value ?? '';
    case 'number':
      return plan.minimum ?? 0;
    case 'string':
      return '';
    case 'enumArray':
    case 'primitiveArray':
      return [];
    case 'object': {
      const out: Record<string, unknown> = {};
      for (const field of plan.fields) {
        out[field.key] = defaultValueForSchema(field.schema);
      }
      return out;
    }
    case 'json': {
      if (schema.type === 'array') return [];
      if (schema.type === 'object' && schema.properties) {
        const out: Record<string, unknown> = {};
        for (const [key, propSchema] of Object.entries(schema.properties)) {
          out[key] = defaultValueForSchema(propSchema);
        }
        return out;
      }
      return null;
    }
  }
}

export function formatValueSummary(value: unknown, yesLabel: string, noLabel: string): string {
  if (typeof value === 'boolean') {
    return value ? yesLabel : noLabel;
  }
  if (typeof value === 'number' || typeof value === 'string') {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value.map((item) => (typeof item === 'object' && item !== null ? '{…}' : String(item))).join(', ');
  }
  if (isPlainObject(value)) {
    return '{…}';
  }
  return value === null || value === undefined ? '—' : String(value);
}

export type TranslateFn = (key: string, params?: Record<string, unknown>) => string;

export function describeSchemaLimits(
  schema: ValueSchema,
  translate: TranslateFn,
): { typeWithLimits: string; valueHint: string } {
  const typeLabel = translate(`tradeConfig.type.${schemaTypeKey(schema)}`);
  const plan = editorPlan(schema);

  let details = '';
  let valueHint = '';

  switch (plan.kind) {
    case 'boolean':
      valueHint = translate('tradeConfig.limits.allowedBoolean');
      break;
    case 'enum': {
      const choices = plan.options.map((o) => o.label).join(', ');
      details = choices;
      valueHint = translate('tradeConfig.limits.allowedEnum', { choices });
      break;
    }
    case 'number': {
      if (plan.minimum !== undefined && plan.maximum !== undefined) {
        details = translate('tradeConfig.limits.range', { min: plan.minimum, max: plan.maximum });
        valueHint = translate('tradeConfig.limits.allowedRange', { min: plan.minimum, max: plan.maximum });
      } else if (plan.minimum !== undefined) {
        details = translate('tradeConfig.limits.minOnly', { min: plan.minimum });
        valueHint = translate('tradeConfig.limits.allowedMin', { min: plan.minimum });
      } else if (plan.maximum !== undefined) {
        details = translate('tradeConfig.limits.maxOnly', { max: plan.maximum });
        valueHint = translate('tradeConfig.limits.allowedMax', { max: plan.maximum });
      } else {
        valueHint = translate('tradeConfig.limits.allowedAny');
      }
      break;
    }
    case 'string': {
      if (plan.minLength !== undefined && plan.maxLength !== undefined && plan.minLength > 0) {
        details = translate('tradeConfig.limits.range', { min: plan.minLength, max: plan.maxLength });
        valueHint = translate('tradeConfig.limits.allowedCharsRange', { min: plan.minLength, max: plan.maxLength });
      } else if (plan.maxLength !== undefined) {
        details = translate('tradeConfig.limits.maxOnly', { max: plan.maxLength });
        valueHint = translate('tradeConfig.limits.allowedChars', { max: plan.maxLength });
      } else if (plan.minLength !== undefined && plan.minLength > 0) {
        details = translate('tradeConfig.limits.minOnly', { min: plan.minLength });
        valueHint = translate('tradeConfig.limits.allowedMin', { min: plan.minLength });
      } else {
        valueHint = translate('tradeConfig.limits.allowedAny');
      }
      break;
    }
    case 'enumArray':
    case 'primitiveArray': {
      if (plan.minItems !== undefined && plan.maxItems !== undefined) {
        details = translate('tradeConfig.limits.range', { min: plan.minItems, max: plan.maxItems });
        valueHint = translate('tradeConfig.limits.allowedItems', { min: plan.minItems, max: plan.maxItems });
      } else if (plan.maxItems !== undefined) {
        details = translate('tradeConfig.limits.maxOnly', { max: plan.maxItems });
        valueHint = translate('tradeConfig.limits.allowedItemsMax', { max: plan.maxItems });
      } else if (plan.minItems !== undefined) {
        details = translate('tradeConfig.limits.minOnly', { min: plan.minItems });
        valueHint = translate('tradeConfig.limits.allowedItemsMin', { min: plan.minItems });
      } else {
        valueHint = translate('tradeConfig.limits.allowedAny');
      }
      break;
    }
    case 'object':
    case 'json':
      valueHint = translate('tradeConfig.limits.allowedAny');
      break;
  }

  const typeWithLimits = details
    ? translate('tradeConfig.limits.typeWithDetails', { type: typeLabel, details })
    : typeLabel;

  return { typeWithLimits, valueHint };
}
