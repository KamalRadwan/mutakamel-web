import { FAKE_PEOPLE } from '../../../../../shared/widgets/dashboard/fake/fake-org';
import type { QueryField, Operator, Condition, Group, Query, Value } from '../../../../../shared/query-builder/query.model';
import type { FilterGroup as WireFilterGroup, FilterLeaf as WireFilterLeaf, FilterOperator as WireFilterOperator } from '../../../../../shared/widgets/dashboard/analytics.model';

export type FilterTreeRecordType = 'leads' | 'opportunities';

export const FILTER_TREE_LIMITS = {
  maxDepth: 4,
  maxLeaves: 50,
  maxInValues: 100,
  maxBytes: 16_384,
} as const;

export interface FilterFieldOptionDef {
  value: string;
  labelEn: string;
  labelAr: string;
}

export interface FilterFieldDef {
  id: string;
  recordType: FilterTreeRecordType;
  labelEn: string;
  labelAr: string;
  hintEn: string;
  hintAr: string;
  kind: QueryField['kind'];
  operators?: Operator[];
  min?: number;
  max?: number;
  options?: readonly FilterFieldOptionDef[];
}

export const FAKE_LEAD_SOURCES: readonly FilterFieldOptionDef[] = [
  { value: 'website', labelEn: 'Website', labelAr: 'الموقع الإلكتروني' },
  { value: 'referral', labelEn: 'Referral', labelAr: 'إحالة' },
  { value: 'social', labelEn: 'Social media', labelAr: 'منصات التواصل' },
  { value: 'campaign', labelEn: 'Campaign', labelAr: 'حملة تسويقية' },
  { value: 'direct', labelEn: 'Direct', labelAr: 'مباشر' },
];

export const FAKE_OPPORTUNITY_STAGES: readonly FilterFieldOptionDef[] = [
  { value: 'qualification', labelEn: 'Qualification', labelAr: 'التأهيل' },
  { value: 'proposal', labelEn: 'Proposal', labelAr: 'عرض السعر' },
  { value: 'negotiation', labelEn: 'Negotiation', labelAr: 'التفاوض' },
  { value: 'contract', labelEn: 'Contract', labelAr: 'التعاقد' },
  { value: 'won', labelEn: 'Won', labelAr: 'رابحة' },
  { value: 'lost', labelEn: 'Lost', labelAr: 'خاسرة' },
];

const OWNER_OPTIONS: readonly FilterFieldOptionDef[] = FAKE_PEOPLE.map((p) => ({
  value: p.id,
  labelEn: p.name,
  labelAr: p.nameAr,
}));

// Phase 5: replace with the registered field catalogue
export const FILTER_FIELDS: Record<FilterTreeRecordType, readonly FilterFieldDef[]> = {
  leads: [
    {
      id: 'leads.status',
      recordType: 'leads',
      labelEn: 'Lead status',
      labelAr: 'حالة العميل المحتمل',
      hintEn: 'Filter by lead lifecycle status.',
      hintAr: 'التصفية حسب حالة العميل المحتمل.',
      kind: 'enum',
      options: [
        { value: 'OPEN', labelEn: 'Open', labelAr: 'مفتوح' },
        { value: 'QUALIFIED', labelEn: 'Qualified', labelAr: 'مؤهل' },
        { value: 'CONVERTED', labelEn: 'Converted', labelAr: 'محوّل' },
        { value: 'LOST', labelEn: 'Lost', labelAr: 'مفقود' },
      ],
    },
    {
      id: 'leads.rating',
      recordType: 'leads',
      labelEn: 'Lead rating',
      labelAr: 'تقييم العميل المحتمل',
      hintEn: 'Filter by lead rating score from 0 to 5.',
      hintAr: 'التصفية حسب تقييم العميل المحتمل من 0 إلى 5.',
      kind: 'number',
      min: 0,
      max: 5,
    },
    {
      id: 'leads.sourceId',
      recordType: 'leads',
      labelEn: 'Lead source',
      labelAr: 'مصدر العميل المحتمل',
      hintEn: 'Filter by acquisition source.',
      hintAr: 'التصفية حسب مصدر الاستحواذ.',
      kind: 'enum',
      options: FAKE_LEAD_SOURCES,
    },
    {
      id: 'leads.ownerUserId',
      recordType: 'leads',
      labelEn: 'Lead owner',
      labelAr: 'مسؤول العميل المحتمل',
      hintEn: 'Filter by assigned salesperson.',
      hintAr: 'التصفية حسب مسؤول المبيعات المعين.',
      kind: 'enum',
      options: OWNER_OPTIONS,
    },
    {
      id: 'leads.createdAt',
      recordType: 'leads',
      labelEn: 'Created date',
      labelAr: 'تاريخ الإنشاء',
      hintEn: 'Filter by when the lead was created.',
      hintAr: 'التصفية حسب تاريخ إنشاء العميل المحتمل.',
      kind: 'date',
      operators: ['on', 'before', 'after', 'between'],
    },
  ],
  opportunities: [
    {
      id: 'opportunities.stageId',
      recordType: 'opportunities',
      labelEn: 'Stage',
      labelAr: 'المرحلة',
      hintEn: 'Filter by current opportunity stage.',
      hintAr: 'التصفية حسب المرحلة الحالية للفرصة.',
      kind: 'enum',
      options: FAKE_OPPORTUNITY_STAGES,
    },
    {
      id: 'opportunities.estimatedValue',
      recordType: 'opportunities',
      labelEn: 'Estimated value',
      labelAr: 'القيمة التقديرية',
      hintEn: 'Filter by expected deal amount.',
      hintAr: 'التصفية حسب القيمة المتوقعة للصفقة.',
      kind: 'number',
      min: 0,
    },
    {
      id: 'opportunities.ownerUserId',
      recordType: 'opportunities',
      labelEn: 'Opportunity owner',
      labelAr: 'مسؤول الفرصة',
      hintEn: 'Filter by assigned salesperson.',
      hintAr: 'التصفية حسب مسؤول المبيعات المعين.',
      kind: 'enum',
      options: OWNER_OPTIONS,
    },
    {
      id: 'opportunities.expectedCloseDate',
      recordType: 'opportunities',
      labelEn: 'Expected close date',
      labelAr: 'تاريخ الإغلاق المتوقع',
      hintEn: 'Filter by expected closing date.',
      hintAr: 'التصفية حسب تاريخ الإغلاق المتوقع.',
      kind: 'date',
      operators: ['on', 'before', 'after', 'between'],
    },
  ],
};

/** Every metric a filter tree applies to: each series metric and its calculation operand. */
export function filterTreeMetricKeys(
  series: readonly { metricKey: string; calculation?: { operandMetricKey: string } }[],
): string[] {
  const keys: string[] = [];
  for (const s of series) {
    if (s.metricKey) keys.push(s.metricKey);
    if (s.calculation?.operandMetricKey) keys.push(s.calculation.operandMetricKey);
  }
  return keys;
}

export function filterTreeRecordType(metricKeys: readonly string[]): FilterTreeRecordType | null {
  if (metricKeys.length === 0) return null;
  if (metricKeys.every((key) => key.startsWith('crm.leads.'))) {
    return 'leads';
  }
  if (
    metricKeys.every(
      (key) => key.startsWith('crm.opportunities.') && !key.startsWith('crm.opportunities.stage_flow'),
    )
  ) {
    return 'opportunities';
  }
  return null;
}

export function filterTreeSupported(metricKeys: readonly string[]): boolean {
  return filterTreeRecordType(metricKeys) !== null;
}

export function isKnownFilterField(fieldId: string, recordType?: FilterTreeRecordType | null): boolean {
  if (recordType) {
    return FILTER_FIELDS[recordType].some((f) => f.id === fieldId);
  }
  return (
    FILTER_FIELDS.leads.some((f) => f.id === fieldId) ||
    FILTER_FIELDS.opportunities.some((f) => f.id === fieldId)
  );
}

export function filterFieldsFor(recordType: FilterTreeRecordType, lang: 'ar' | 'en'): QueryField[] {
  return FILTER_FIELDS[recordType].map((def) => ({
    id: def.id,
    label: lang === 'ar' ? def.labelAr : def.labelEn,
    kind: def.kind,
    hint: lang === 'ar' ? def.hintAr : def.hintEn,
    placement: 'tree',
    ...(def.operators ? { operators: def.operators } : {}),
    ...(def.min !== undefined ? { min: def.min } : {}),
    ...(def.max !== undefined ? { max: def.max } : {}),
    ...(def.options
      ? {
          options: def.options.map((opt) => ({
            value: opt.value,
            label: lang === 'ar' ? opt.labelAr : opt.labelEn,
          })),
        }
      : {}),
  }));
}

function findFieldDef(fieldId: string): FilterFieldDef | undefined {
  return (
    FILTER_FIELDS.leads.find((f) => f.id === fieldId) ??
    FILTER_FIELDS.opportunities.find((f) => f.id === fieldId)
  );
}

/**
 * A condition read from the wire keeps the operator it came with. GT/LT on a number field have no strict UI
 * operator, so the condition keeps gte/lte and remembers the strict wire operator; it is sent back as long as the UI
 * operator was not changed, and the editor labels it through `strictWireOperator`.
 */
export type WireCondition = Condition & { wireOperator?: WireFilterOperator };

const WIRE_OPERATORS: readonly WireFilterOperator[] = [
  'EQ',
  'NEQ',
  'GT',
  'GTE',
  'LT',
  'LTE',
  'IN',
  'NOT_IN',
  'BETWEEN',
  'IS_EMPTY',
  'IS_NOT_EMPTY',
  'CONTAINS',
];

/** Exact UI to wire mapping. An operator with no wire meaning returns null: it is refused, never guessed. */
function toWireOperator(op: Operator): WireFilterOperator | null {
  switch (op) {
    case 'eq':
    case 'on':
    case 'is':
      return 'EQ';
    case 'neq':
      return 'NEQ';
    case 'after':
      return 'GT';
    case 'gte':
      return 'GTE';
    case 'before':
      return 'LT';
    case 'lte':
      return 'LTE';
    case 'in':
      return 'IN';
    case 'nin':
      return 'NOT_IN';
    case 'between':
      return 'BETWEEN';
    case 'isNull':
      return 'IS_EMPTY';
    case 'isNotNull':
      return 'IS_NOT_EMPTY';
    case 'contains':
      return 'CONTAINS';
    default:
      return null;
  }
}

/** Wire to UI mapping; null for an operator this client does not know (flagged, never defaulted). */
function fromWireOperator(op: WireFilterOperator, fieldId: string): Operator | null {
  const def = findFieldDef(fieldId);
  const isDate = def?.kind === 'date';
  switch (op) {
    case 'EQ':
      return isDate ? 'on' : 'eq';
    case 'NEQ':
      return 'neq';
    case 'GT':
      return isDate ? 'after' : 'gte';
    case 'GTE':
      return 'gte';
    case 'LT':
      return isDate ? 'before' : 'lte';
    case 'LTE':
      return 'lte';
    case 'IN':
      return 'in';
    case 'NOT_IN':
      return 'nin';
    case 'BETWEEN':
      return 'between';
    case 'IS_EMPTY':
      return 'isNull';
    case 'IS_NOT_EMPTY':
      return 'isNotNull';
    case 'CONTAINS':
      return 'contains';
    default:
      return null;
  }
}

function wireOperatorFor(cond: WireCondition): WireFilterOperator | null {
  if (cond.operator === null) return null;
  // Keep the strict wire operator (GT/LT) while the UI operator is still the one it was shown as.
  if (cond.wireOperator && fromWireOperator(cond.wireOperator, cond.field) === cond.operator) {
    return cond.wireOperator;
  }
  return toWireOperator(cond.operator);
}

function conditionToLeaf(cond: WireCondition): WireFilterLeaf | null {
  if (!cond.field || cond.operator === null) return null;
  const wireOp = wireOperatorFor(cond);
  if (!wireOp) return null;
  if (wireOp === 'IS_EMPTY' || wireOp === 'IS_NOT_EMPTY') {
    return { field: cond.field, operator: wireOp };
  }
  return {
    field: cond.field,
    operator: wireOp,
    value: (cond.value ?? null) as WireFilterLeaf['value'],
  };
}

/** UI operators in the query that have no wire meaning. The caller refuses to apply the query while any remain. */
export function unmappableOperators(query: Query): Operator[] {
  const found = new Set<Operator>();
  const visit = (node: Condition | Group) => {
    if (node.kind === 'group') {
      node.children.forEach(visit);
    } else if (node.field && node.operator !== null && !wireOperatorFor(node)) {
      found.add(node.operator);
    }
  };
  visit(query.root);
  query.fixed.forEach(visit);
  return [...found];
}

/** Wire operators in a stored tree that this client cannot show. They are flagged, never mapped to another one. */
export function unknownWireOperators(tree: WireFilterGroup | undefined | null): string[] {
  return Array.from(
    new Set(
      collectFilterLeaves(tree)
        .map((leaf) => leaf.operator as string)
        .filter((op) => !(WIRE_OPERATORS as readonly string[]).includes(op)),
    ),
  );
}

function groupToWire(group: Group): WireFilterGroup | null {
  const children: (WireFilterGroup | WireFilterLeaf)[] = [];
  for (const child of group.children) {
    if (child.kind === 'condition') {
      const leaf = conditionToLeaf(child);
      if (leaf) children.push(leaf);
    } else {
      const nested = groupToWire(child);
      if (nested) children.push(nested);
    }
  }
  if (children.length === 0) return null;
  return { kind: group.op, children };
}

export function toWire(query: Query): WireFilterGroup | undefined {
  const top = groupToWire(query.root);
  const fixedLeaves = query.fixed
    .map(conditionToLeaf)
    .filter((item): item is WireFilterLeaf => item !== null);
  if (!top && fixedLeaves.length === 0) return undefined;
  if (!top) {
    return { kind: 'AND', children: fixedLeaves };
  }
  if (fixedLeaves.length === 0) {
    return top;
  }
  if (top.kind === 'AND') {
    return { kind: 'AND', children: [...top.children, ...fixedLeaves] };
  }
  return { kind: 'AND', children: [top, ...fixedLeaves] };
}

function isWireGroup(node: WireFilterGroup | WireFilterLeaf): node is WireFilterGroup {
  return 'kind' in node && Array.isArray(node.children);
}

export function fromWire(tree: WireFilterGroup | undefined | null): Query {
  let nextId = 1;
  const makeId = (prefix: string) => `${prefix}-${nextId++}`;

  if (!tree || !Array.isArray(tree.children) || tree.children.length === 0) {
    return {
      root: { kind: 'group', id: makeId('g'), op: 'AND', children: [] },
      fixed: [],
    };
  }

  const convertGroup = (g: WireFilterGroup): Group => ({
    kind: 'group',
    id: makeId('g'),
    op: g.kind === 'OR' ? 'OR' : 'AND',
    children: g.children.map((child) => {
      if (isWireGroup(child)) {
        return convertGroup(child);
      }
      const cond: WireCondition = {
        kind: 'condition',
        id: makeId('c'),
        field: child.field,
        operator: fromWireOperator(child.operator, child.field),
        value: child.value as Value | undefined,
        wireOperator: child.operator,
      };
      return cond;
    }),
  });

  return {
    root: convertGroup(tree),
    fixed: [],
  };
}

/**
 * The strict wire operator (GT/LT) a non-date condition still sends for `operator`, or null. The shared rules editor
 * asks this per operator so the row, its option list and the summary state the stored strict meaning themselves.
 * Date GT/LT already read as after/before.
 */
export function strictWireOperator(condition: Condition, operator: Operator): 'GT' | 'LT' | null {
  const wireOp = (condition as WireCondition).wireOperator;
  if (wireOp !== 'GT' && wireOp !== 'LT') return null;
  if (findFieldDef(condition.field)?.kind === 'date') return null;
  return fromWireOperator(wireOp, condition.field) === operator ? wireOp : null;
}

export function collectFilterLeaves(tree: WireFilterGroup | undefined | null): WireFilterLeaf[] {
  if (!tree) return [];
  const leaves: WireFilterLeaf[] = [];
  const walk = (g: WireFilterGroup) => {
    for (const child of g.children) {
      if (isWireGroup(child)) {
        walk(child);
      } else {
        leaves.push(child);
      }
    }
  };
  walk(tree);
  return leaves;
}

export function countFilterLeaves(tree: WireFilterGroup | undefined | null): number {
  return collectFilterLeaves(tree).length;
}

export function filterTreeDepth(tree: WireFilterGroup | undefined | null): number {
  if (!tree || tree.children.length === 0) return 0;
  let maxChild = 0;
  for (const child of tree.children) {
    if (isWireGroup(child)) {
      const d = filterTreeDepth(child);
      if (d > maxChild) maxChild = d;
    }
  }
  return 1 + maxChild;
}

export function maxInListLength(tree: WireFilterGroup | undefined | null): number {
  let maxLen = 0;
  for (const leaf of collectFilterLeaves(tree)) {
    if ((leaf.operator === 'IN' || leaf.operator === 'NOT_IN') && Array.isArray(leaf.value)) {
      if (leaf.value.length > maxLen) maxLen = leaf.value.length;
    }
  }
  return maxLen;
}

export function filterTreeBytes(tree: WireFilterGroup | undefined | null): number {
  if (!tree) return 0;
  const serialized = JSON.stringify(tree);
  return new TextEncoder().encode(serialized).length;
}
