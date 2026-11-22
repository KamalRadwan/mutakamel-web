import { countConditions } from './query-edit';
import { valueShape } from './query-operators';
import {
  type Condition,
  type Group,
  type OperatorLabelFn,
  type Query,
  type QueryField,
  type Value,
  getCachedFieldOption,
} from './query.model';

function countSubGroups(group: Group): number {
  let total = 0;
  for (const child of group.children) {
    if (child.kind === 'group') {
      total += 1 + countSubGroups(child);
    }
  }
  return total;
}

function optionLabelFor(
  field: QueryField | undefined,
  raw: string | number | boolean,
  t: (key: string, p?: object) => string,
): string {
  const key = String(raw);
  const special = field?.specialOptions?.find((o) => o.value === key);
  if (special) return special.label;
  const opt = field?.options?.find((o) => o.value === key);
  if (opt) return opt.label;
  const cached = getCachedFieldOption(field?.id, key);
  if (cached) return cached.label;
  if (typeof raw === 'boolean') {
    const boolKey = raw ? 'qb.bool.true' : 'qb.bool.false';
    const translated = t(boolKey);
    if (translated && translated !== boolKey) return translated;
  }
  return key;
}

function formatConditionValue(
  field: QueryField | undefined,
  op: NonNullable<Condition['operator']>,
  value: Value | undefined,
  t: (key: string, p?: object) => string,
): string {
  const shape = valueShape(op);
  if (shape === 'none' || value === undefined || value === null) return '';

  if (shape === 'relative') {
    return typeof value === 'string' ? t(`qb.date.${value}`) : '';
  }

  if (shape === 'range' && Array.isArray(value) && value.length === 2) {
    return `${optionLabelFor(field, value[0], t)} – ${optionLabelFor(field, value[1], t)}`;
  }

  if (shape === 'list' && Array.isArray(value)) {
    return value.map((item) => optionLabelFor(field, item, t)).join(', ');
  }

  if (!Array.isArray(value)) {
    return optionLabelFor(field, value, t);
  }

  return '';
}

function formatCondition(
  cond: Condition,
  fieldsById: Map<string, QueryField>,
  t: (key: string, p?: object) => string,
  operatorLabel?: OperatorLabelFn | null,
): string {
  if (!cond.field || cond.operator === null) return '';
  const field = fieldsById.get(cond.field);
  const fieldLabel = field?.label ?? cond.field;
  const opLabel =
    operatorLabel?.(cond, cond.operator, field ?? null) ??
    (cond.operator === 'isNull' && field?.nullLabels?.isNull
      ? field.nullLabels.isNull
      : cond.operator === 'isNotNull' && field?.nullLabels?.isNotNull
        ? field.nullLabels.isNotNull
        : t(`qb.op.${cond.operator}`));
  const valueLabel = formatConditionValue(field, cond.operator, cond.value, t);
  return t('qb.summary.cond', { field: fieldLabel, op: opLabel, value: valueLabel }).trim();
}

function formatGroup(
  group: Group,
  fieldsById: Map<string, QueryField>,
  t: (key: string, p?: object) => string,
  operatorLabel?: OperatorLabelFn | null,
): { text: string; partsCount: number } {
  const parts: string[] = [];

  for (const child of group.children) {
    if (child.kind === 'condition') {
      const formatted = formatCondition(child, fieldsById, t, operatorLabel);
      if (formatted) parts.push(formatted);
    } else {
      const nested = formatGroup(child, fieldsById, t, operatorLabel);
      if (nested.text) {
        parts.push(`(${nested.text})`);
      }
    }
  }

  const connector = group.op === 'AND' ? t('qb.summary.and') : t('qb.summary.or');
  return { text: parts.join(connector), partsCount: parts.length };
}

export function summarize(
  query: Query,
  fields: QueryField[],
  t: (key: string, p?: object) => string,
  operatorLabel?: OperatorLabelFn | null,
): { count: number; groups: number; text: string } {
  const fieldsById = new Map(fields.map((field) => [field.id, field]));
  const count = countConditions(query);
  const groups = countSubGroups(query.root);

  const fixedParts = query.fixed
    .map((cond) => formatCondition(cond, fieldsById, t, operatorLabel))
    .filter((part) => part.length > 0);
  const rootFormatted = formatGroup(query.root, fieldsById, t, operatorLabel);

  const andConnector = t('qb.summary.and');
  let text = '';

  if (fixedParts.length > 0 && rootFormatted.text) {
    const wrappedRoot =
      query.root.op === 'OR' && rootFormatted.partsCount > 1
        ? `(${rootFormatted.text})`
        : rootFormatted.text;
    text = [...fixedParts, wrappedRoot].join(andConnector);
  } else if (fixedParts.length > 0) {
    text = fixedParts.join(andConnector);
  } else {
    text = rootFormatted.text;
  }

  return { count, groups, text };
}
