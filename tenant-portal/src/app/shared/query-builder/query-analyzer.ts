import {
  VALID_RELATIVE_DATES,
  addDaysToDateString,
  calendarDateInTimeZone,
  isValidDateString,
  resolveDate,
} from './query-dates';
import { removeNode, updateCondition } from './query-edit';
import { normalize } from './query-normalize';
import { operatorsFor, valueShape } from './query-operators';
import {
  QUERY_LIMITS,
  type Condition,
  type Group,
  type Issue,
  type Operator,
  type Query,
  type QueryField,
  type RelativeDate,
  type Value,
  getCachedFieldOption,
} from './query.model';

interface NumericRange {
  low: number;
  high: number;
  isPoint: boolean;
}

function isMissingBound(bound: unknown): boolean {
  if (bound === undefined || bound === null) return true;
  if (typeof bound === 'string') return bound.trim() === '';
  if (typeof bound === 'number') return Number.isNaN(bound);
  return false;
}

function isIncomplete(cond: Condition): boolean {
  if (!cond.field.trim() || cond.operator === null) return true;
  const shape = valueShape(cond.operator);
  if (shape === 'none') return false;
  if (cond.value === undefined || cond.value === null) return true;
  if (typeof cond.value === 'string') return cond.value.trim() === '';
  if (typeof cond.value === 'number') return Number.isNaN(cond.value);
  if (shape === 'list') {
    return (
      !Array.isArray(cond.value) ||
      cond.value.length === 0 ||
      cond.value.some((item) => isMissingBound(item))
    );
  }
  if (shape === 'range') {
    return (
      !Array.isArray(cond.value) ||
      cond.value.length !== 2 ||
      isMissingBound(cond.value[0]) ||
      isMissingBound(cond.value[1])
    );
  }
  return false;
}

function optionLabel(field: QueryField | undefined, val: string | number | boolean): string {
  const key = String(val);
  const special = field?.specialOptions?.find((o) => o.value === key);
  if (special) return special.label;
  const opt = field?.options?.find((o) => o.value === key);
  if (opt) return opt.label;
  const cached = getCachedFieldOption(field?.id, key);
  if (cached) return cached.label;
  return key;
}

function valueLabel(field: QueryField | undefined, op: Operator | null, value: Value | undefined): string {
  if (op === null || value === undefined || value === null) return '';
  const shape = valueShape(op);
  if (shape === 'none') return '';
  if (Array.isArray(value)) {
    if (shape === 'range' && value.length === 2) {
      return `${optionLabel(field, value[0])} – ${optionLabel(field, value[1])}`;
    }
    return value.map((item) => optionLabel(field, item)).join(', ');
  }
  return optionLabel(field, value);
}

function canonicalValue(op: Operator, value: Value | undefined): Value | undefined {
  const shape = valueShape(op);
  if (shape === 'none') return undefined;
  if (typeof value === 'string') return value.trim();
  if (shape === 'range' && Array.isArray(value) && value.length === 2) {
    const [from, to] = value;
    if (typeof from === 'string' && typeof to === 'string') {
      return [from.trim(), to.trim()];
    }
    return [from, to] as [string, string] | [number, number];
  }
  if (shape === 'list' && Array.isArray(value)) {
    if (value.every((v): v is number => typeof v === 'number')) {
      return Array.from(new Set(value)).sort((a, b) => a - b);
    }
    const items = value.map((v) => (typeof v === 'string' ? v.trim() : String(v)));
    return Array.from(new Set(items)).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  }
  return value;
}

function sameConditionValue(a: Condition, b: Condition): boolean {
  if (a.field !== b.field || a.operator !== b.operator || a.operator === null) return false;
  const va = canonicalValue(a.operator, a.value);
  const vb = canonicalValue(a.operator, b.value);
  if (Array.isArray(va) && Array.isArray(vb)) {
    return va.length === vb.length && va.every((item, idx) => item === vb[idx]);
  }
  return va === vb;
}

function validateConditionValue(cond: Condition, field: QueryField | undefined): Issue | null {
  if (!field || cond.operator === null) return null;
  const op = cond.operator;
  const shape = valueShape(op);
  if (shape === 'none') return null;

  if (shape === 'list' && Array.isArray(cond.value) && cond.value.length > QUERY_LIMITS.listMax) {
    return {
      code: 'INVALID_VALUE',
      severity: 'error',
      nodeIds: [cond.id],
      params: { field: field.label, reason: 'listMax', max: QUERY_LIMITS.listMax },
    };
  }

  if (field.kind === 'text' || field.kind === 'textSearch') {
    const maxLen = field.maxLength ?? QUERY_LIMITS.textMax;
    const strings =
      typeof cond.value === 'string'
        ? [cond.value.trim()]
        : Array.isArray(cond.value)
          ? cond.value.map((v) => String(v).trim())
          : [];
    if (strings.some((s) => s.length > maxLen)) {
      return {
        code: 'INVALID_VALUE',
        severity: 'error',
        nodeIds: [cond.id],
        params: { field: field.label, reason: 'maxLength', max: maxLen },
      };
    }
  }

  if (
    (field.kind === 'enum' && field.options && field.options.length > 0) ||
    (field.kind === 'lookup' && field.options !== undefined && !field.searchOptions)
  ) {
    const allowed = new Set([
      ...(field.options ?? []).map((o) => o.value),
      ...(field.specialOptions ?? []).map((o) => o.value),
    ]);
    const values = Array.isArray(cond.value) ? cond.value : [cond.value];
    if (values.some((v) => !allowed.has(String(v)))) {
      return {
        code: 'INVALID_VALUE',
        severity: 'error',
        nodeIds: [cond.id],
        params: { field: field.label, reason: 'invalidOption' },
      };
    }
  }

  if (field.kind === 'rating' || field.kind === 'number') {
    const nums = Array.isArray(cond.value) ? cond.value : [cond.value];
    for (const num of nums) {
      if (typeof num !== 'number' || !Number.isFinite(num)) {
        return {
          code: 'INVALID_VALUE',
          severity: 'error',
          nodeIds: [cond.id],
          params: { field: field.label, reason: 'notNumber' },
        };
      }
      if (field.kind === 'rating' && !Number.isInteger(num)) {
        return {
          code: 'INVALID_VALUE',
          severity: 'error',
          nodeIds: [cond.id],
          params: { field: field.label, reason: 'notInteger' },
        };
      }
      if ((field.min !== undefined && num < field.min) || (field.max !== undefined && num > field.max)) {
        return {
          code: 'INVALID_VALUE',
          severity: 'error',
          nodeIds: [cond.id],
          params: { field: field.label, reason: 'outOfRange' },
        };
      }
    }
  }

  if (field.kind === 'date') {
    if (op === 'relative') {
      if (typeof cond.value !== 'string' || !VALID_RELATIVE_DATES.includes(cond.value as RelativeDate)) {
        return {
          code: 'INVALID_VALUE',
          severity: 'error',
          nodeIds: [cond.id],
          params: { field: field.label, reason: 'invalidDate' },
        };
      }
    } else if (op === 'between') {
      if (
        !Array.isArray(cond.value) ||
        cond.value.length !== 2 ||
        !isValidDateString(cond.value[0]) ||
        !isValidDateString(cond.value[1])
      ) {
        return {
          code: 'INVALID_VALUE',
          severity: 'error',
          nodeIds: [cond.id],
          params: { field: field.label, reason: 'invalidDate' },
        };
      }
    } else if (!isValidDateString(cond.value)) {
      return {
        code: 'INVALID_VALUE',
        severity: 'error',
        nodeIds: [cond.id],
        params: { field: field.label, reason: 'invalidDate' },
      };
    }
  }

  if (field.kind === 'boolean' && op === 'is' && typeof cond.value !== 'boolean') {
    return {
      code: 'INVALID_VALUE',
      severity: 'error',
      nodeIds: [cond.id],
      params: { field: field.label, reason: 'invalidBoolean' },
    };
  }

  return null;
}

function checkRangeInverted(cond: Condition, field: QueryField | undefined): Issue | null {
  if (cond.operator !== 'between' || !Array.isArray(cond.value) || cond.value.length !== 2) return null;
  const [from, to] = cond.value;
  if (typeof from === 'number' && typeof to === 'number' && from > to) {
    return {
      code: 'RANGE_INVERTED',
      severity: 'error',
      nodeIds: [cond.id],
      params: { field: field?.label ?? cond.field, a: String(from), b: String(to) },
    };
  }
  if (field?.kind === 'date' && typeof from === 'string' && typeof to === 'string' && from.trim() > to.trim()) {
    return {
      code: 'RANGE_INVERTED',
      severity: 'error',
      nodeIds: [cond.id],
      params: { field: field.label, a: from.trim(), b: to.trim() },
    };
  }
  return null;
}

function toNumericRange(cond: Condition): NumericRange | null {
  switch (cond.operator) {
    case 'eq':
      return typeof cond.value === 'number' ? { low: cond.value, high: cond.value, isPoint: true } : null;
    case 'gte':
      return typeof cond.value === 'number' ? { low: cond.value, high: Infinity, isPoint: false } : null;
    case 'lte':
      return typeof cond.value === 'number' ? { low: -Infinity, high: cond.value, isPoint: false } : null;
    case 'between':
      return Array.isArray(cond.value) &&
        cond.value.length === 2 &&
        typeof cond.value[0] === 'number' &&
        typeof cond.value[1] === 'number'
        ? { low: cond.value[0], high: cond.value[1], isPoint: false }
        : null;
    default:
      return null;
  }
}

function toDateInterval(
  cond: Condition,
  timeZone: string,
  now: Date,
): { low: number; high: number; isPoint: boolean } | null {
  if (cond.operator === null) return null;
  if (!['on', 'before', 'after', 'between', 'relative'].includes(cond.operator)) return null;
  const resolved = resolveDate(cond.operator, cond.value, timeZone, now);
  if (!resolved.gte && !resolved.lt) return null;
  const low = resolved.gte ? Date.parse(resolved.gte) : -Infinity;
  const high = resolved.lt ? Date.parse(resolved.lt) : Infinity;
  return { low, high, isPoint: cond.operator === 'on' };
}

function replacePair(q: Query, keepId: string, dropId: string, operator: Operator, value: Value): Query {
  return removeNode(updateCondition(q, keepId, { operator, value }), dropId);
}

function analyzeAndPair(
  a: Condition,
  b: Condition,
  field: QueryField | undefined,
  timeZone: string,
  now: Date,
): Issue | null {
  const label = field?.label ?? a.field;
  const valA = valueLabel(field, a.operator, a.value);
  const valB = valueLabel(field, b.operator, b.value);
  const baseParams: Record<string, string | number> = {
    field: label,
    ...(a.operator ? { opA: a.operator, valA } : {}),
    ...(b.operator ? { opB: b.operator, valB } : {}),
  };

  if (sameConditionValue(a, b)) {
    return {
      code: 'DUPLICATE',
      severity: 'error',
      nodeIds: [a.id, b.id],
      params: { field: label, ...(a.operator ? { opA: a.operator, valA } : {}) },
      fix: { label: 'remove', apply: (q) => removeNode(q, b.id) },
    };
  }

  const opA = a.operator!;
  const opB = b.operator!;

  if ((opA === 'isNull' && opB === 'isNotNull') || (opA === 'isNotNull' && opB === 'isNull')) {
    return {
      code: 'CONTRADICTION',
      severity: 'error',
      nodeIds: [a.id, b.id],
      params: baseParams,
    };
  }

  if (opA === 'isNull' || opB === 'isNull') {
    return {
      code: 'CONTRADICTION',
      severity: 'error',
      nodeIds: [a.id, b.id],
      params: baseParams,
    };
  }

  if (opA === 'isNotNull' || opB === 'isNotNull') {
    const nullCond = opA === 'isNotNull' ? a : b;
    return {
      code: 'REDUNDANT',
      severity: 'warning',
      nodeIds: [a.id, b.id],
      params: baseParams,
      fix: { label: 'simplify', apply: (q) => removeNode(q, nullCond.id) },
    };
  }

  if (opA === 'is' && opB === 'is' && a.value !== b.value) {
    return {
      code: 'CONTRADICTION',
      severity: 'error',
      nodeIds: [a.id, b.id],
      params: baseParams,
    };
  }

  // Equality / membership / exclusion pairs
  if (opA === 'eq' && opB === 'eq') {
    if (canonicalValue('eq', a.value) !== canonicalValue('eq', b.value)) {
      const supportsIn = !field || operatorsFor(field).includes('in');
      return {
        code: 'CONTRADICTION',
        severity: 'error',
        nodeIds: [a.id, b.id],
        params: supportsIn ? { ...baseParams, canIn: 1 } : baseParams,
      };
    }
  }

  if ((opA === 'eq' && opB === 'in') || (opA === 'in' && opB === 'eq')) {
    const eqCond = opA === 'eq' ? a : b;
    const inCond = opA === 'in' ? a : b;
    const eqVal = canonicalValue('eq', eqCond.value);
    const list = (canonicalValue('in', inCond.value) as (string | number)[] | undefined) ?? [];
    if (list.some((item) => item === eqVal)) {
      return {
        code: 'REDUNDANT',
        severity: 'warning',
        nodeIds: [a.id, b.id],
        params: baseParams,
        fix: { label: 'simplify', apply: (q) => removeNode(q, inCond.id) },
      };
    }
    return {
      code: 'CONTRADICTION',
      severity: 'error',
      nodeIds: [a.id, b.id],
      params: baseParams,
    };
  }

  if (opA === 'in' && opB === 'in') {
    const listA = (canonicalValue('in', a.value) as (string | number)[] | undefined) ?? [];
    const listB = (canonicalValue('in', b.value) as (string | number)[] | undefined) ?? [];
    const setB = new Set(listB);
    const inter = listA.filter((item) => setB.has(item));
    if (inter.length === 0) {
      return {
        code: 'CONTRADICTION',
        severity: 'error',
        nodeIds: [a.id, b.id],
        params: baseParams,
      };
    }
    return {
      code: 'REDUNDANT',
      severity: 'warning',
      nodeIds: [a.id, b.id],
      params: baseParams,
      fix: {
        label: 'merge',
        apply: (q) => replacePair(q, a.id, b.id, 'in', inter as string[] | number[]),
      },
    };
  }

  if ((opA === 'eq' && opB === 'neq') || (opA === 'neq' && opB === 'eq')) {
    const eqCond = opA === 'eq' ? a : b;
    const neqCond = opA === 'neq' ? a : b;
    if (canonicalValue('eq', eqCond.value) === canonicalValue('neq', neqCond.value)) {
      return {
        code: 'CONTRADICTION',
        severity: 'error',
        nodeIds: [a.id, b.id],
        params: baseParams,
      };
    }
    return {
      code: 'REDUNDANT',
      severity: 'warning',
      nodeIds: [a.id, b.id],
      params: baseParams,
      fix: { label: 'simplify', apply: (q) => removeNode(q, neqCond.id) },
    };
  }

  if ((opA === 'eq' && opB === 'nin') || (opA === 'nin' && opB === 'eq')) {
    const eqCond = opA === 'eq' ? a : b;
    const ninCond = opA === 'nin' ? a : b;
    const eqVal = canonicalValue('eq', eqCond.value);
    const list = (canonicalValue('nin', ninCond.value) as (string | number)[] | undefined) ?? [];
    if (list.some((item) => item === eqVal)) {
      return {
        code: 'CONTRADICTION',
        severity: 'error',
        nodeIds: [a.id, b.id],
        params: baseParams,
      };
    }
    return {
      code: 'REDUNDANT',
      severity: 'warning',
      nodeIds: [a.id, b.id],
      params: baseParams,
      fix: { label: 'simplify', apply: (q) => removeNode(q, ninCond.id) },
    };
  }

  if ((opA === 'in' && opB === 'nin') || (opA === 'nin' && opB === 'in')) {
    const inCond = opA === 'in' ? a : b;
    const ninCond = opA === 'nin' ? a : b;
    const listIn = (canonicalValue('in', inCond.value) as (string | number)[] | undefined) ?? [];
    const listNin = (canonicalValue('nin', ninCond.value) as (string | number)[] | undefined) ?? [];
    const setNin = new Set(listNin);
    const remaining = listIn.filter((item) => !setNin.has(item));
    if (remaining.length === 0) {
      return {
        code: 'CONTRADICTION',
        severity: 'error',
        nodeIds: [a.id, b.id],
        params: baseParams,
      };
    }
    if (remaining.length === listIn.length) {
      return {
        code: 'REDUNDANT',
        severity: 'warning',
        nodeIds: [a.id, b.id],
        params: baseParams,
        fix: { label: 'simplify', apply: (q) => removeNode(q, ninCond.id) },
      };
    }
    return {
      code: 'REDUNDANT',
      severity: 'warning',
      nodeIds: [a.id, b.id],
      params: baseParams,
      fix: {
        label: 'simplify',
        apply: (q) =>
          replacePair(
            q,
            inCond.id,
            ninCond.id,
            remaining.length === 1 ? 'eq' : 'in',
            (remaining.length === 1 ? remaining[0] : remaining) as Value,
          ),
      },
    };
  }

  if ((opA === 'in' && opB === 'neq') || (opA === 'neq' && opB === 'in')) {
    const inCond = opA === 'in' ? a : b;
    const neqCond = opA === 'neq' ? a : b;
    const listIn = (canonicalValue('in', inCond.value) as (string | number)[] | undefined) ?? [];
    const neqVal = canonicalValue('neq', neqCond.value);
    const remaining = listIn.filter((item) => item !== neqVal);
    if (remaining.length === 0) {
      return {
        code: 'CONTRADICTION',
        severity: 'error',
        nodeIds: [a.id, b.id],
        params: baseParams,
      };
    }
    if (remaining.length === listIn.length) {
      return {
        code: 'REDUNDANT',
        severity: 'warning',
        nodeIds: [a.id, b.id],
        params: baseParams,
        fix: { label: 'simplify', apply: (q) => removeNode(q, neqCond.id) },
      };
    }
    return {
      code: 'REDUNDANT',
      severity: 'warning',
      nodeIds: [a.id, b.id],
      params: baseParams,
      fix: {
        label: 'simplify',
        apply: (q) =>
          replacePair(
            q,
            inCond.id,
            neqCond.id,
            remaining.length === 1 ? 'eq' : 'in',
            (remaining.length === 1 ? remaining[0] : remaining) as Value,
          ),
      },
    };
  }

  if (opA === 'neq' && opB === 'neq') {
    const supportsNin = !field || operatorsFor(field).includes('nin');
    if (supportsNin) {
      const va = canonicalValue('neq', a.value) as string | number;
      const vb = canonicalValue('neq', b.value) as string | number;
      const merged = canonicalValue('nin', [va, vb] as string[] | number[]) as string[] | number[];
      return {
        code: 'REDUNDANT',
        severity: 'warning',
        nodeIds: [a.id, b.id],
        params: baseParams,
        fix: {
          label: 'merge',
          apply: (q) => replacePair(q, a.id, b.id, 'nin', merged),
        },
      };
    }
  }

  // Numeric / rating ranges (eq / gte / lte / between)
  if (!field || field.kind === 'rating' || field.kind === 'number') {
    const rA = toNumericRange(a);
    const rB = toNumericRange(b);
    if (rA && rB) {
      const low = Math.max(rA.low, rB.low);
      const high = Math.min(rA.high, rB.high);
      if (low > high) {
        return {
          code: 'CONTRADICTION',
          severity: 'error',
          nodeIds: [a.id, b.id],
          params: baseParams,
        };
      }
      if (rA.isPoint || rB.isPoint) {
        const rangeCond = rA.isPoint ? b : a;
        return {
          code: 'REDUNDANT',
          severity: 'warning',
          nodeIds: [a.id, b.id],
          params: baseParams,
          fix: { label: 'simplify', apply: (q) => removeNode(q, rangeCond.id) },
        };
      }
      const fix: Issue['fix'] =
        Number.isFinite(low) && Number.isFinite(high)
          ? { label: 'merge', apply: (q) => replacePair(q, a.id, b.id, 'between', [low, high]) }
          : Number.isFinite(low)
            ? { label: 'merge', apply: (q) => replacePair(q, a.id, b.id, 'gte', low) }
            : { label: 'merge', apply: (q) => replacePair(q, a.id, b.id, 'lte', high) };
      return {
        code: 'REDUNDANT',
        severity: 'warning',
        nodeIds: [a.id, b.id],
        params: baseParams,
        fix,
      };
    }
  }

  // Date ranges (on / before / after / between / relative)
  if (field?.kind === 'date') {
    const dA = toDateInterval(a, timeZone, now);
    const dB = toDateInterval(b, timeZone, now);
    if (dA && dB) {
      const low = Math.max(dA.low, dB.low);
      const high = Math.min(dA.high, dB.high);
      if (low >= high) {
        return {
          code: 'CONTRADICTION',
          severity: 'error',
          nodeIds: [a.id, b.id],
          params: baseParams,
        };
      }
      if (dA.isPoint || dB.isPoint) {
        const rangeCond = dA.isPoint ? b : a;
        return {
          code: 'REDUNDANT',
          severity: 'warning',
          nodeIds: [a.id, b.id],
          params: baseParams,
          fix: { label: 'simplify', apply: (q) => removeNode(q, rangeCond.id) },
        };
      }
      let fix: Issue['fix'];
      if (Number.isFinite(low) && Number.isFinite(high)) {
        const startDate = calendarDateInTimeZone(new Date(low).toISOString(), timeZone);
        const endExclusive = calendarDateInTimeZone(new Date(high).toISOString(), timeZone);
        const endInclusive = addDaysToDateString(endExclusive, -1);
        fix = {
          label: 'merge',
          apply: (q) => replacePair(q, a.id, b.id, 'between', [startDate, endInclusive]),
        };
      } else if (Number.isFinite(low)) {
        const startDate = calendarDateInTimeZone(new Date(low).toISOString(), timeZone);
        const afterDate = addDaysToDateString(startDate, -1);
        fix = { label: 'merge', apply: (q) => replacePair(q, a.id, b.id, 'after', afterDate) };
      } else {
        const beforeDate = calendarDateInTimeZone(new Date(high).toISOString(), timeZone);
        fix = { label: 'merge', apply: (q) => replacePair(q, a.id, b.id, 'before', beforeDate) };
      }
      return {
        code: 'REDUNDANT',
        severity: 'warning',
        nodeIds: [a.id, b.id],
        params: baseParams,
        fix,
      };
    }
  }

  // Text comparisons
  if (typeof a.value === 'string' && typeof b.value === 'string') {
    const sa = a.value.trim().toLowerCase();
    const sb = b.value.trim().toLowerCase();

    if (opA === 'ilike' && opB === 'ilike') {
      if (sa.includes(sb) || sb.includes(sa)) {
        const dropId = sa.length >= sb.length ? b.id : a.id;
        return {
          code: 'REDUNDANT',
          severity: 'warning',
          nodeIds: [a.id, b.id],
          params: baseParams,
          fix: { label: 'simplify', apply: (q) => removeNode(q, dropId) },
        };
      }
    }

    if (opA === 'startsWith' && opB === 'startsWith') {
      if (!sa.startsWith(sb) && !sb.startsWith(sa)) {
        return {
          code: 'CONTRADICTION',
          severity: 'error',
          nodeIds: [a.id, b.id],
          params: baseParams,
        };
      }
      const dropId = sa.length >= sb.length ? b.id : a.id;
      return {
        code: 'REDUNDANT',
        severity: 'warning',
        nodeIds: [a.id, b.id],
        params: baseParams,
        fix: { label: 'simplify', apply: (q) => removeNode(q, dropId) },
      };
    }

    if (opA === 'endsWith' && opB === 'endsWith') {
      if (!sa.endsWith(sb) && !sb.endsWith(sa)) {
        return {
          code: 'CONTRADICTION',
          severity: 'error',
          nodeIds: [a.id, b.id],
          params: baseParams,
        };
      }
      const dropId = sa.length >= sb.length ? b.id : a.id;
      return {
        code: 'REDUNDANT',
        severity: 'warning',
        nodeIds: [a.id, b.id],
        params: baseParams,
        fix: { label: 'simplify', apply: (q) => removeNode(q, dropId) },
      };
    }
  }

  return null;
}

function analyzeOrPair(
  a: Condition,
  b: Condition,
  field: QueryField | undefined,
): Issue | null {
  const label = field?.label ?? a.field;
  const valA = valueLabel(field, a.operator, a.value);
  const valB = valueLabel(field, b.operator, b.value);
  const baseParams: Record<string, string | number> = {
    field: label,
    ...(a.operator ? { opA: a.operator, valA } : {}),
    ...(b.operator ? { opB: b.operator, valB } : {}),
  };

  if (sameConditionValue(a, b)) {
    return {
      code: 'DUPLICATE',
      severity: 'error',
      nodeIds: [a.id, b.id],
      params: { field: label, ...(a.operator ? { opA: a.operator, valA } : {}) },
      fix: { label: 'remove', apply: (q) => removeNode(q, b.id) },
    };
  }

  const opA = a.operator!;
  const opB = b.operator!;

  if ((opA === 'isNull' && opB === 'isNotNull') || (opA === 'isNotNull' && opB === 'isNull')) {
    return {
      code: 'ALWAYS_TRUE',
      severity: 'warning',
      nodeIds: [a.id, b.id],
      params: baseParams,
      fix: {
        label: 'removeBoth',
        apply: (q) => removeNode(removeNode(q, a.id), b.id),
      },
    };
  }

  const isEqOrIn = (op: Operator): boolean => op === 'eq' || op === 'in';
  if (isEqOrIn(opA) && isEqOrIn(opB)) {
    const valsA = opA === 'eq' ? [a.value as string | number] : (a.value as (string | number)[]);
    const valsB = opB === 'eq' ? [b.value as string | number] : (b.value as (string | number)[]);
    const merged = canonicalValue('in', [...valsA, ...valsB] as string[] | number[]) as
      | string[]
      | number[];
    if (field?.options && field.options.length > 0 && !field.nullable) {
      const selected = new Set(merged.map(String));
      if (field.options.every((opt) => selected.has(opt.value))) {
        return {
          code: 'ALWAYS_TRUE',
          severity: 'warning',
          nodeIds: [a.id, b.id],
          params: baseParams,
          fix: {
            label: 'removeBoth',
            apply: (q) => removeNode(removeNode(q, a.id), b.id),
          },
        };
      }
    }
    const supportsIn = !field || operatorsFor(field).includes('in');
    if (supportsIn) {
      return {
        code: 'OR_MERGE',
        severity: 'warning',
        nodeIds: [a.id, b.id],
        params: baseParams,
        fix: {
          label: 'merge',
          apply: (q) => replacePair(q, a.id, b.id, 'in', merged),
        },
      };
    }
  }

  return null;
}

function checkPairwiseScope(
  conditions: Condition[],
  op: 'AND' | 'OR',
  fieldsById: Map<string, QueryField>,
  invalidIds: Set<string>,
  timeZone: string,
  now: Date,
  issues: Issue[],
): void {
  const validConds = conditions.filter((c) => !invalidIds.has(c.id));
  for (let i = 0; i < validConds.length; i++) {
    for (let j = i + 1; j < validConds.length; j++) {
      const a = validConds[i];
      const b = validConds[j];
      if (a.field !== b.field) continue;
      const field = fieldsById.get(a.field);
      const issue =
        op === 'AND'
          ? analyzeAndPair(a, b, field, timeZone, now)
          : analyzeOrPair(a, b, field);
      if (issue) issues.push(issue);
    }
  }
}

function groupSignature(group: Group): string {
  const parts = group.children.map((child) => {
    if (child.kind === 'condition') {
      const val = child.operator ? canonicalValue(child.operator, child.value) : child.value;
      return `C:${child.field}|${child.operator ?? ''}|${JSON.stringify(val)}`;
    }
    return groupSignature(child);
  });
  parts.sort();
  return `G:${group.op}:[${parts.join(',')}]`;
}

function checkStructureAndCollect(
  group: Group,
  depth: number,
  fieldsById: Map<string, QueryField>,
  allConditions: Condition[],
  treeConditions: Condition[],
  issues: Issue[],
): void {
  if (depth > QUERY_LIMITS.depth) {
    issues.push({
      code: 'LIMIT',
      severity: 'error',
      nodeIds: [group.id],
      params: { max: QUERY_LIMITS.depth },
    });
  }

  if (group.children.length > QUERY_LIMITS.childrenPerGroup) {
    issues.push({
      code: 'LIMIT',
      severity: 'error',
      nodeIds: [group.id],
      params: { max: QUERY_LIMITS.childrenPerGroup },
    });
  }

  const seenGroups = new Map<string, Group>();

  for (const child of group.children) {
    if (child.kind === 'condition') {
      allConditions.push(child);
      treeConditions.push(child);
    } else {
      if (child.children.length > 0) {
        const sig = groupSignature(child);
        const existing = seenGroups.get(sig);
        if (existing) {
          issues.push({
            code: 'DUPLICATE_GROUP',
            severity: 'warning',
            nodeIds: [existing.id, child.id],
            params: {},
            fix: { label: 'remove', apply: (q) => removeNode(q, child.id) },
          });
        } else {
          seenGroups.set(sig, child);
        }
      }
      checkStructureAndCollect(child, depth + 1, fieldsById, allConditions, treeConditions, issues);
    }
  }
}

function checkScopesRecursive(
  group: Group,
  isRoot: boolean,
  fixed: Condition[],
  fieldsById: Map<string, QueryField>,
  invalidIds: Set<string>,
  timeZone: string,
  now: Date,
  issues: Issue[],
): void {
  const direct = group.children.filter((c): c is Condition => c.kind === 'condition');

  if (isRoot) {
    if (group.op === 'AND') {
      checkPairwiseScope([...fixed, ...direct], 'AND', fieldsById, invalidIds, timeZone, now, issues);
    } else {
      checkPairwiseScope(fixed, 'AND', fieldsById, invalidIds, timeZone, now, issues);
      checkPairwiseScope(direct, 'OR', fieldsById, invalidIds, timeZone, now, issues);
    }
  } else {
    checkPairwiseScope(direct, group.op, fieldsById, invalidIds, timeZone, now, issues);
  }

  for (const child of group.children) {
    if (child.kind === 'group') {
      checkScopesRecursive(child, false, fixed, fieldsById, invalidIds, timeZone, now, issues);
    }
  }
}

export function analyze(
  query: Query,
  fields: QueryField[],
  now: Date = new Date(),
  timeZone = 'Africa/Cairo',
): Issue[] {
  const issues: Issue[] = [];
  const fieldsById = new Map(fields.map((field) => [field.id, field]));

  const allConditions: Condition[] = [...query.fixed];
  const treeConditions: Condition[] = [];

  checkStructureAndCollect(query.root, 1, fieldsById, allConditions, treeConditions, issues);

  const compiledTreeLeaves = treeConditions.reduce((sum, cond) => {
    const field = fieldsById.get(cond.field);
    const isTwoLeafDate =
      field?.kind === 'date' &&
      (cond.operator === 'on' || cond.operator === 'between' || cond.operator === 'relative');
    return sum + (isTwoLeafDate ? 2 : 1);
  }, 0);

  if (allConditions.length > QUERY_LIMITS.conditions || compiledTreeLeaves >= QUERY_LIMITS.conditions * 2) {
    issues.push({
      code: 'LIMIT',
      severity: 'error',
      nodeIds: [query.root.id],
      params: { max: QUERY_LIMITS.conditions },
    });
  }

  // Per-condition checks
  const invalidIds = new Set<string>();
  for (const cond of allConditions) {
    const field = fieldsById.get(cond.field);
    if (isIncomplete(cond)) {
      invalidIds.add(cond.id);
      issues.push({
        code: 'INCOMPLETE',
        severity: 'error',
        nodeIds: [cond.id],
        params: { field: field?.label ?? cond.field },
      });
      continue;
    }

    const invalidIssue = validateConditionValue(cond, field);
    if (invalidIssue) {
      invalidIds.add(cond.id);
      issues.push(invalidIssue);
      continue;
    }

    const invertedIssue = checkRangeInverted(cond, field);
    if (invertedIssue) {
      invalidIds.add(cond.id);
      issues.push(invertedIssue);
      continue;
    }

    // Lists matching all options
    if (
      field?.options &&
      field.options.length > 0 &&
      (cond.operator === 'in' || cond.operator === 'nin') &&
      Array.isArray(cond.value)
    ) {
      const selected = new Set(cond.value.map(String));
      if (field.options.every((opt) => selected.has(opt.value))) {
        const valText = valueLabel(field, cond.operator, cond.value);
        if (cond.operator === 'in') {
          issues.push({
            code: 'ALWAYS_TRUE',
            severity: 'warning',
            nodeIds: [cond.id],
            params: { field: field.label, opA: cond.operator, valA: valText },
            fix: { label: 'remove', apply: (q) => removeNode(q, cond.id) },
          });
        } else {
          issues.push({
            code: 'MATCHES_NOTHING',
            severity: 'error',
            nodeIds: [cond.id],
            params: { field: field.label, opA: cond.operator, valA: valText },
          });
        }
      }
    }
  }

  // Placement check: root-only fields cannot sit in the tree
  for (const cond of treeConditions) {
    const field = fieldsById.get(cond.field);
    if (field?.placement === 'root') {
      issues.push({
        code: 'ROOT_ONLY',
        severity: 'error',
        nodeIds: [cond.id],
        params: { field: field.label },
      });
    }
  }

  // Singleton and Exclusive checks across the whole query
  const byField = new Map<string, Condition[]>();
  for (const cond of allConditions) {
    if (!cond.field) continue;
    const list = byField.get(cond.field);
    if (list) list.push(cond);
    else byField.set(cond.field, [cond]);
  }

  for (const [fieldId, conds] of byField) {
    const field = fieldsById.get(fieldId);
    if (field?.singleton && conds.length > 1) {
      issues.push({
        code: 'SINGLETON',
        severity: 'error',
        nodeIds: conds.map((c) => c.id),
        params: { field: field.label },
      });
    }
  }

  const presentIds = Array.from(byField.keys()).sort();
  for (let i = 0; i < presentIds.length; i++) {
    for (let j = i + 1; j < presentIds.length; j++) {
      const idA = presentIds[i];
      const idB = presentIds[j];
      const fieldA = fieldsById.get(idA);
      const fieldB = fieldsById.get(idB);
      if (fieldA?.exclusiveWith?.includes(idB) || fieldB?.exclusiveWith?.includes(idA)) {
        const condsA = byField.get(idA) ?? [];
        const condsB = byField.get(idB) ?? [];
        issues.push({
          code: 'EXCLUSIVE',
          severity: 'error',
          nodeIds: [...condsA.map((c) => c.id), ...condsB.map((c) => c.id)],
          params: {
            field: fieldA?.label ?? idA,
            a: fieldA?.label ?? idA,
            b: fieldB?.label ?? idB,
          },
        });
      }
    }
  }

  // Pairwise AND/OR scope checks
  const normalizedForScopes = normalize(query, fields);
  checkScopesRecursive(
    normalizedForScopes.root,
    true,
    normalizedForScopes.fixed,
    fieldsById,
    invalidIds,
    timeZone,
    now,
    issues,
  );

  return issues;
}

export function canApply(issues: Issue[]): boolean {
  return !issues.some((issue) => issue.severity === 'error');
}

function collectUsedFields(query: Query): Set<string> {
  const used = new Set<string>();
  for (const c of query.fixed) {
    if (c.field) used.add(c.field);
  }
  const walk = (group: Group): void => {
    for (const child of group.children) {
      if (child.kind === 'condition') {
        if (child.field) used.add(child.field);
      } else {
        walk(child);
      }
    }
  };
  walk(query.root);
  return used;
}

export function fieldAvailability(
  query: Query,
  fields: QueryField[],
  target: { groupId: string; depth: number },
): Record<string, { enabled: boolean; reason?: 'SINGLETON' | 'EXCLUSIVE' | 'ROOT_ONLY' }> {
  const used = collectUsedFields(query);
  const fieldsById = new Map(fields.map((field) => [field.id, field]));
  const result: Record<string, { enabled: boolean; reason?: 'SINGLETON' | 'EXCLUSIVE' | 'ROOT_ONLY' }> = {};

  for (const field of fields) {
    if (field.placement === 'root' && target.groupId !== 'fixed') {
      result[field.id] = { enabled: false, reason: 'ROOT_ONLY' };
      continue;
    }

    if (field.singleton && used.has(field.id)) {
      result[field.id] = { enabled: false, reason: 'SINGLETON' };
      continue;
    }

    let exclusiveConflict = false;
    for (const usedId of used) {
      if (usedId === field.id) continue;
      const usedField = fieldsById.get(usedId);
      if (field.exclusiveWith?.includes(usedId) || usedField?.exclusiveWith?.includes(field.id)) {
        exclusiveConflict = true;
        break;
      }
    }
    if (exclusiveConflict) {
      result[field.id] = { enabled: false, reason: 'EXCLUSIVE' };
      continue;
    }

    result[field.id] = { enabled: true };
  }

  return result;
}
