import type { Operator, QueryField, ValueShape } from './query.model';

function baseOperatorsFor(field: QueryField): Operator[] {
  switch (field.kind) {
    case 'textSearch':
      return ['contains'];
    case 'text':
      return ['ilike', 'ilikeAny', 'startsWith', 'endsWith', 'eq'];
    case 'enum':
      return field.options && field.options.length <= 2 ? ['eq'] : ['eq', 'neq', 'in', 'nin'];
    case 'lookup':
      return ['eq', 'neq', 'in', 'nin'];
    case 'rating':
    case 'number':
      return ['eq', 'neq', 'gte', 'lte', 'between', 'in'];
    case 'date':
      return ['on', 'before', 'after', 'between', 'relative'];
    case 'boolean':
      return ['is'];
    case 'tags':
      return ['hasAny'];
  }
}

export function operatorsFor(field: QueryField): Operator[] {
  const defaults = baseOperatorsFor(field);
  const narrowed = field.operators ? defaults.filter((op) => field.operators!.includes(op)) : defaults;
  if (!field.nullable) return narrowed;

  const result = [...narrowed];
  if (!result.includes('isNull')) result.push('isNull');
  if (!result.includes('isNotNull')) result.push('isNotNull');
  return result;
}

export function defaultOperator(field: QueryField): Operator {
  const ops = operatorsFor(field);
  return ops[0] ?? 'eq';
}

export function valueShape(op: Operator): ValueShape {
  switch (op) {
    case 'isNull':
    case 'isNotNull':
      return 'none';
    case 'in':
    case 'nin':
    case 'ilikeAny':
    case 'hasAny':
      return 'list';
    case 'between':
      return 'range';
    case 'relative':
      return 'relative';
    default:
      return 'single';
  }
}
