export type FieldKind = 'textSearch' | 'text' | 'enum' | 'lookup' | 'rating' | 'number' | 'date' | 'boolean' | 'tags';

export type Operator =
  | 'contains'
  | 'eq'
  | 'neq'
  | 'in'
  | 'nin'
  | 'gte'
  | 'lte'
  | 'between'
  | 'ilike'
  | 'ilikeAny'
  | 'startsWith'
  | 'endsWith'
  | 'isNull'
  | 'isNotNull'
  | 'on'
  | 'before'
  | 'after'
  | 'relative'
  | 'is'
  | 'hasAny';

export type RelativeDate = 'today' | 'yesterday' | 'last7' | 'last30' | 'thisMonth' | 'lastMonth' | 'thisYear';

export type Value = string | number | boolean | null | string[] | number[] | [string, string] | [number, number] | RelativeDate;

export type ValueShape = 'none' | 'single' | 'list' | 'range' | 'relative';

export interface FieldOption {
  value: string;
  label: string;
  icon?: string;
  colorClass?: string;
}

export interface QueryField {
  id: string;
  label: string;
  kind: FieldKind;
  hint: string;
  group?: string;
  placement: 'tree' | 'root';
  singleton?: boolean;
  exclusiveWith?: string[];
  nullable?: boolean;
  nullLabels?: { isNull: string; isNotNull: string };
  options?: FieldOption[];
  searchOptions?: (term: string) => Promise<FieldOption[]>;
  specialOptions?: FieldOption[];
  min?: number;
  max?: number;
  maxLength?: number;
  minLengthHint?: number;
  inputMode?: 'text' | 'tel' | 'email';
  operators?: Operator[];
  chip?: boolean;
  chipHint?: string;
}

export interface Condition {
  kind: 'condition';
  id: string;
  field: string;
  operator: Operator | null;
  value: Value | undefined;
}

/**
 * Optional host hook for the operator label of one condition. It is asked for every operator offered in the row
 * (the option list, the selected operator and the summary). Return null to keep the built-in label.
 */
export type OperatorLabelFn = (condition: Condition, operator: Operator, field: QueryField | null) => string | null;

export interface Group {
  kind: 'group';
  id: string;
  op: 'AND' | 'OR';
  children: (Condition | Group)[];
}

export type QueryNode = Condition | Group;

export interface Query {
  root: Group;
  fixed: Condition[];
}

export const QUERY_LIMITS = {
  depth: 3,
  conditions: 50,
  childrenPerGroup: 20,
  textMax: 200,
  listMax: 50,
};

export type IssueSeverity = 'error' | 'warning';

export type IssueCode =
  | 'INCOMPLETE'
  | 'INVALID_VALUE'
  | 'RANGE_INVERTED'
  | 'DUPLICATE'
  | 'CONTRADICTION'
  | 'REDUNDANT'
  | 'OR_MERGE'
  | 'ALWAYS_TRUE'
  | 'MATCHES_NOTHING'
  | 'SINGLETON'
  | 'EXCLUSIVE'
  | 'ROOT_ONLY'
  | 'LIMIT'
  | 'DUPLICATE_GROUP';

export interface Fix {
  label: 'merge' | 'simplify' | 'remove' | 'removeBoth';
  apply: (q: Query) => Query;
}

export interface Issue {
  code: IssueCode;
  severity: IssueSeverity;
  nodeIds: string[];
  params: Record<string, string | number>;
  fix?: Fix;
}

const FIELD_OPTION_CACHE = new Map<string, Map<string, FieldOption>>();

export function rememberFieldOptions(fieldId: string, options: readonly FieldOption[]): void {
  if (!fieldId || options.length === 0) return;
  let map = FIELD_OPTION_CACHE.get(fieldId);
  if (!map) {
    map = new Map<string, FieldOption>();
    FIELD_OPTION_CACHE.set(fieldId, map);
  }
  for (const opt of options) {
    map.set(opt.value, opt);
  }
}

export function getCachedFieldOption(fieldId: string | undefined, value: string): FieldOption | undefined {
  if (!fieldId) return undefined;
  return FIELD_OPTION_CACHE.get(fieldId)?.get(value);
}

export * from './query-edit';
