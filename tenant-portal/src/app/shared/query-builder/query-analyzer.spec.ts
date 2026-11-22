import { analyze, canApply, fieldAvailability } from './query-analyzer';
import { resolveDate } from './query-dates';
import {
  addCondition,
  addFixed,
  addGroup,
  countConditions,
  depthOf,
  emptyCondition,
  emptyGroup,
  emptyQuery,
  removeFixed,
  removeNode,
  setGroupOp,
  updateCondition,
} from './query-edit';
import { normalize } from './query-normalize';
import { defaultOperator, operatorsFor, valueShape } from './query-operators';
import { summarize } from './query-summary';
import { QUERY_LIMITS, type Condition, type Group, type Query, type QueryField } from './query.model';

const STAGE_OPTIONS = [
  { value: 'stage-new', label: 'New' },
  { value: 'stage-contacted', label: 'Contacted' },
  { value: 'stage-qualifying', label: 'Qualifying' },
  { value: 'stage-qualified', label: 'Qualified' },
  { value: 'stage-disqualified', label: 'Disqualified' },
  { value: 'stage-converted', label: 'Converted' },
];

const CARD_COLOR_OPTIONS = [
  'RED',
  'ORANGE',
  'AMBER',
  'YELLOW',
  'GREEN',
  'TEAL',
  'BLUE',
  'INDIGO',
  'PURPLE',
  'PINK',
  'SLATE',
].map((c) => ({ value: c, label: c }));

const TEST_FIELDS: QueryField[] = [
  {
    id: 'leadType',
    label: 'Lead type',
    kind: 'enum',
    hint: 'Individual or company',
    placement: 'tree',
    options: [
      { value: 'INDIVIDUAL', label: 'Individual' },
      { value: 'CORPORATE', label: 'Company' },
    ],
  },
  {
    id: 'stageId',
    label: 'Stage',
    kind: 'enum',
    hint: 'Lead pipeline stage',
    placement: 'tree',
    options: STAGE_OPTIONS,
  },
  {
    id: 'status',
    label: 'Status',
    kind: 'enum',
    hint: 'Lead status',
    placement: 'tree',
    options: [
      { value: 'OPEN', label: 'Open' },
      { value: 'CONVERTED', label: 'Converted' },
      { value: 'DISQUALIFIED', label: 'Disqualified' },
      { value: 'ON_HOLD', label: 'On hold' },
    ],
  },
  {
    id: 'ownerUserId',
    label: 'Owner',
    kind: 'lookup',
    hint: 'Assigned user',
    placement: 'tree',
    nullable: true,
    specialOptions: [{ value: '$me', label: 'Me' }],
  },
  {
    id: 'sourceId',
    label: 'Source',
    kind: 'lookup',
    hint: 'Acquisition source',
    placement: 'tree',
    nullable: true,
    options: [
      { value: 'src-web', label: 'Website' },
      { value: 'src-ref', label: 'Referral' },
    ],
  },
  {
    id: 'rating',
    label: 'Rating',
    kind: 'rating',
    hint: 'Lead quality rating',
    placement: 'tree',
    min: 0,
    max: 3,
  },
  {
    id: 'createdAt',
    label: 'Created',
    kind: 'date',
    hint: 'Creation date',
    placement: 'tree',
    nullable: true,
  },
  {
    id: 'cardColor',
    label: 'Card colour',
    kind: 'enum',
    hint: 'Card highlight colour',
    placement: 'tree',
    nullable: true,
    options: CARD_COLOR_OPTIONS,
  },
  {
    id: 'displayName',
    label: 'Name',
    kind: 'text',
    hint: 'Lead display name',
    placement: 'tree',
    maxLength: 100,
  },
  {
    id: 'tagIds',
    label: 'Tags',
    kind: 'tags',
    hint: 'Lead tags',
    placement: 'root',
    singleton: true,
    options: [
      { value: 'tag-vip', label: 'VIP' },
      { value: 'tag-erp', label: 'ERP' },
    ],
  },
  {
    id: 'hasOverdue',
    label: 'Overdue activity',
    kind: 'boolean',
    hint: 'Has overdue follow-up',
    placement: 'root',
    singleton: true,
  },
  {
    id: 'searchLead',
    label: 'Lead search',
    kind: 'textSearch',
    hint: 'Search by lead name',
    placement: 'root',
    singleton: true,
    exclusiveWith: ['searchEmail', 'searchPhone', 'searchCustomer'],
  },
  {
    id: 'searchEmail',
    label: 'Email search',
    kind: 'textSearch',
    hint: 'Search by email',
    placement: 'root',
    singleton: true,
    exclusiveWith: ['searchLead', 'searchPhone', 'searchCustomer'],
  },
  {
    id: 'searchPhone',
    label: 'Phone search',
    kind: 'textSearch',
    hint: 'Search by phone',
    placement: 'root',
    singleton: true,
    exclusiveWith: ['searchLead', 'searchEmail', 'searchCustomer'],
  },
  {
    id: 'searchCustomer',
    label: 'Customer search',
    kind: 'textSearch',
    hint: 'Search by customer',
    placement: 'root',
    singleton: true,
    exclusiveWith: ['searchLead', 'searchEmail', 'searchPhone'],
  },
];

function cond(id: string, field: string, operator: Condition['operator'], value?: Condition['value']): Condition {
  return { kind: 'condition', id, field, operator, value };
}

function queryWithRoot(op: 'AND' | 'OR', children: (Condition | Group)[], fixed: Condition[] = []): Query {
  return { root: { kind: 'group', id: 'root', op, children }, fixed };
}

describe('query-operators', () => {
  it('returns eq only for enum with 2 or fewer options', () => {
    const leadType = TEST_FIELDS.find((f) => f.id === 'leadType')!;
    expect(operatorsFor(leadType)).toEqual(['eq']);
    expect(defaultOperator(leadType)).toBe('eq');
  });

  it('returns full enum operators plus null ops when nullable and > 2 options', () => {
    const cardColor = TEST_FIELDS.find((f) => f.id === 'cardColor')!;
    expect(operatorsFor(cardColor)).toEqual(['eq', 'neq', 'in', 'nin', 'isNull', 'isNotNull']);
  });

  it('intersects field.operators preserving default order and appends null ops when nullable', () => {
    const narrowed: QueryField = {
      id: 'd',
      label: 'D',
      kind: 'date',
      hint: 'Date',
      placement: 'tree',
      nullable: true,
      operators: ['after', 'on'],
    };
    expect(operatorsFor(narrowed)).toEqual(['on', 'after', 'isNull', 'isNotNull']);
  });

  it('maps operator value shapes accurately', () => {
    expect(valueShape('isNull')).toBe('none');
    expect(valueShape('isNotNull')).toBe('none');
    expect(valueShape('in')).toBe('list');
    expect(valueShape('nin')).toBe('list');
    expect(valueShape('ilikeAny')).toBe('list');
    expect(valueShape('hasAny')).toBe('list');
    expect(valueShape('between')).toBe('range');
    expect(valueShape('relative')).toBe('relative');
    expect(valueShape('eq')).toBe('single');
  });
});

describe('query-analyzer per-condition rules', () => {
  it('detects INCOMPLETE for missing operator or empty value', () => {
    const q = queryWithRoot('AND', [
      cond('c1', 'stageId', null),
      cond('c2', 'displayName', 'ilike', '   '),
      cond('c3', 'stageId', 'in', []),
      cond('c4', 'rating', 'between', [1, undefined as unknown as number]),
    ]);
    const issues = analyze(q, TEST_FIELDS);
    expect(issues.filter((i) => i.code === 'INCOMPLETE').map((i) => i.nodeIds[0])).toEqual(['c1', 'c2', 'c3', 'c4']);
    expect(canApply(issues)).toBe(false);
  });

  it('detects INVALID_VALUE for text length, out-of-range rating, non-integer rating, bad option, bad date, and listMax', () => {
    const tooLongList = Array.from({ length: QUERY_LIMITS.listMax + 1 }, (_, i) => `u${i}`);
    const q = queryWithRoot('AND', [
      cond('c1', 'displayName', 'eq', 'x'.repeat(101)),
      cond('c2', 'rating', 'eq', 5),
      cond('c3', 'rating', 'eq', 1.5),
      cond('c4', 'stageId', 'eq', 'nonexistent'),
      cond('c5', 'createdAt', 'on', '2026-02-30'),
      cond('c6', 'ownerUserId', 'in', tooLongList),
    ]);
    const issues = analyze(q, TEST_FIELDS);
    expect(issues.filter((i) => i.code === 'INVALID_VALUE')).toHaveLength(6);
    expect(canApply(issues)).toBe(false);
  });

  it('detects RANGE_INVERTED when Rating between 3 and 1', () => {
    const q = queryWithRoot('AND', [cond('c1', 'rating', 'between', [3, 1])]);
    const issues = analyze(q, TEST_FIELDS);
    expect(issues).toHaveLength(1);
    expect(issues[0].code).toBe('RANGE_INVERTED');
    expect(issues[0].severity).toBe('error');
  });

  it('detects RANGE_INVERTED when date between is inverted', () => {
    const q = queryWithRoot('AND', [cond('c1', 'createdAt', 'between', ['2026-11-10', '2026-11-01'])]);
    const issues = analyze(q, TEST_FIELDS);
    expect(issues.some((i) => i.code === 'RANGE_INVERTED')).toBe(true);
  });
});

describe('query-analyzer AND-scope rules', () => {
  it('flags Duplicate Status is Open twice as DUPLICATE and removes the second', () => {
    const q = queryWithRoot('AND', [
      cond('c1', 'status', 'eq', 'OPEN'),
      cond('c2', 'status', 'eq', 'OPEN'),
    ]);
    const issues = analyze(q, TEST_FIELDS);
    expect(issues).toHaveLength(1);
    expect(issues[0].code).toBe('DUPLICATE');
    expect(issues[0].severity).toBe('error');
    const fixed = issues[0].fix!.apply(q);
    expect(fixed.root.children.map((c) => c.id)).toEqual(['c1']);
  });

  it('flags Lead type is Individual AND Lead type is Company as CONTRADICTION', () => {
    const q = queryWithRoot('AND', [
      cond('c1', 'leadType', 'eq', 'INDIVIDUAL'),
      cond('c2', 'leadType', 'eq', 'CORPORATE'),
    ]);
    const issues = analyze(q, TEST_FIELDS);
    expect(issues.some((i) => i.code === 'CONTRADICTION' && i.severity === 'error')).toBe(true);
  });

  it('flags Stage is New AND Stage is one of [New, Contacted] as REDUNDANT with simplify fix', () => {
    const q = queryWithRoot('AND', [
      cond('c1', 'stageId', 'eq', 'stage-new'),
      cond('c2', 'stageId', 'in', ['stage-new', 'stage-contacted']),
    ]);
    const issues = analyze(q, TEST_FIELDS);
    const issue = issues.find((i) => i.code === 'REDUNDANT');
    expect(issue).toBeDefined();
    expect(issue!.severity).toBe('warning');
    expect(issue!.fix?.label).toBe('simplify');
    const fixed = issue!.fix!.apply(q);
    expect(fixed.root.children.map((c) => c.id)).toEqual(['c1']);
  });

  it('flags Stage is New AND Stage is one of [Contacted, Qualifying] as CONTRADICTION', () => {
    const q = queryWithRoot('AND', [
      cond('c1', 'stageId', 'eq', 'stage-new'),
      cond('c2', 'stageId', 'in', ['stage-contacted', 'stage-qualifying']),
    ]);
    const issues = analyze(q, TEST_FIELDS);
    expect(issues.some((i) => i.code === 'CONTRADICTION')).toBe(true);
  });

  it('flags Stage one of [A,B] AND one of [C] as CONTRADICTION', () => {
    const q = queryWithRoot('AND', [
      cond('c1', 'stageId', 'in', ['stage-new', 'stage-contacted']),
      cond('c2', 'stageId', 'in', ['stage-qualifying']),
    ]);
    const issues = analyze(q, TEST_FIELDS);
    expect(issues.some((i) => i.code === 'CONTRADICTION')).toBe(true);
  });

  it('flags Stage one of [A,B] AND one of [B,C] as REDUNDANT with merge fix to in [B]', () => {
    const q = queryWithRoot('AND', [
      cond('c1', 'stageId', 'in', ['stage-new', 'stage-contacted']),
      cond('c2', 'stageId', 'in', ['stage-contacted', 'stage-qualifying']),
    ]);
    const issues = analyze(q, TEST_FIELDS);
    const issue = issues.find((i) => i.code === 'REDUNDANT');
    expect(issue?.fix?.label).toBe('merge');
    const fixed = issue!.fix!.apply(q);
    expect(fixed.root.children).toHaveLength(1);
    expect((fixed.root.children[0] as Condition).value).toEqual(['stage-contacted']);
  });

  it('flags eq A + neq A or eq A + nin [A, B] as CONTRADICTION, and eq A + neq B / nin [B] as REDUNDANT', () => {
    const q1 = queryWithRoot('AND', [
      cond('c1', 'stageId', 'eq', 'stage-new'),
      cond('c2', 'stageId', 'neq', 'stage-new'),
    ]);
    expect(analyze(q1, TEST_FIELDS).some((i) => i.code === 'CONTRADICTION')).toBe(true);

    const q2 = queryWithRoot('AND', [
      cond('c1', 'stageId', 'eq', 'stage-new'),
      cond('c2', 'stageId', 'nin', ['stage-new', 'stage-contacted']),
    ]);
    expect(analyze(q2, TEST_FIELDS).some((i) => i.code === 'CONTRADICTION')).toBe(true);

    const q3 = queryWithRoot('AND', [
      cond('c1', 'stageId', 'eq', 'stage-new'),
      cond('c2', 'stageId', 'neq', 'stage-contacted'),
    ]);
    const red = analyze(q3, TEST_FIELDS).find((i) => i.code === 'REDUNDANT');
    expect(red?.fix?.label).toBe('simplify');
    expect(red!.fix!.apply(q3).root.children.map((c) => c.id)).toEqual(['c1']);

    const q4 = queryWithRoot('AND', [
      cond('c1', 'stageId', 'eq', 'stage-new'),
      cond('c2', 'stageId', 'nin', ['stage-contacted']),
    ]);
    const redNin = analyze(q4, TEST_FIELDS).find((i) => i.code === 'REDUNDANT');
    expect(redNin?.fix?.label).toBe('simplify');
    expect(redNin!.fix!.apply(q4).root.children.map((c) => c.id)).toEqual(['c1']);
  });

  it('flags neq A + neq B as REDUNDANT and merges to nin [A, B]', () => {
    const q = queryWithRoot('AND', [
      cond('c1', 'stageId', 'neq', 'stage-new'),
      cond('c2', 'stageId', 'neq', 'stage-contacted'),
    ]);
    const issue = analyze(q, TEST_FIELDS).find((i) => i.code === 'REDUNDANT');
    expect(issue?.fix?.label).toBe('merge');
    const fixed = issue!.fix!.apply(q);
    expect(fixed.root.children).toHaveLength(1);
    expect((fixed.root.children[0] as Condition).operator).toBe('nin');
    expect((fixed.root.children[0] as Condition).value).toEqual(['stage-contacted', 'stage-new']);
  });

  it('flags Owner is Me AND Owner is empty as CONTRADICTION', () => {
    const q = queryWithRoot('AND', [
      cond('c1', 'ownerUserId', 'eq', '$me'),
      cond('c2', 'ownerUserId', 'isNull'),
    ]);
    expect(analyze(q, TEST_FIELDS).some((i) => i.code === 'CONTRADICTION')).toBe(true);
  });

  it('flags isNull + isNotNull in AND as CONTRADICTION, and isNotNull + value op as REDUNDANT', () => {
    const q1 = queryWithRoot('AND', [
      cond('c1', 'ownerUserId', 'isNull'),
      cond('c2', 'ownerUserId', 'isNotNull'),
    ]);
    expect(analyze(q1, TEST_FIELDS).some((i) => i.code === 'CONTRADICTION')).toBe(true);

    const q2 = queryWithRoot('AND', [
      cond('c1', 'ownerUserId', 'isNotNull'),
      cond('c2', 'ownerUserId', 'eq', '$me'),
    ]);
    const red = analyze(q2, TEST_FIELDS).find((i) => i.code === 'REDUNDANT');
    expect(red?.fix?.label).toBe('simplify');
    expect(red!.fix!.apply(q2).root.children.map((c) => c.id)).toEqual(['c2']);
  });

  it('flags Rating >= 3 AND Rating <= 1 as CONTRADICTION, and overlapping ranges as REDUNDANT with merge to between', () => {
    const qContra = queryWithRoot('AND', [
      cond('c1', 'rating', 'gte', 3),
      cond('c2', 'rating', 'lte', 1),
    ]);
    expect(analyze(qContra, TEST_FIELDS).some((i) => i.code === 'CONTRADICTION')).toBe(true);

    const qMerge = queryWithRoot('AND', [
      cond('c1', 'rating', 'gte', 1),
      cond('c2', 'rating', 'lte', 3),
    ]);
    const issue = analyze(qMerge, TEST_FIELDS).find((i) => i.code === 'REDUNDANT');
    expect(issue?.fix?.label).toBe('merge');
    const fixed = issue!.fix!.apply(qMerge);
    expect((fixed.root.children[0] as Condition).operator).toBe('between');
    expect((fixed.root.children[0] as Condition).value).toEqual([1, 3]);

    const qOut = queryWithRoot('AND', [
      cond('c1', 'rating', 'eq', 0),
      cond('c2', 'rating', 'gte', 2),
    ]);
    expect(analyze(qOut, TEST_FIELDS).some((i) => i.code === 'CONTRADICTION')).toBe(true);
  });

  it('flags Created after 2026-11-01 AND before 2026-10-01 as CONTRADICTION', () => {
    const q = queryWithRoot('AND', [
      cond('c1', 'createdAt', 'after', '2026-11-01'),
      cond('c2', 'createdAt', 'before', '2026-10-01'),
    ]);
    expect(analyze(q, TEST_FIELDS).some((i) => i.code === 'CONTRADICTION')).toBe(true);
  });

  it('flags overlapping date ranges as REDUNDANT and merges to one between, and checks on vs range', () => {
    const q = queryWithRoot('AND', [
      cond('c1', 'createdAt', 'after', '2026-10-01'),
      cond('c2', 'createdAt', 'before', '2026-11-01'),
    ]);
    const issue = analyze(q, TEST_FIELDS).find((i) => i.code === 'REDUNDANT');
    expect(issue?.fix?.label).toBe('merge');
    const fixed = issue!.fix!.apply(q);
    expect((fixed.root.children[0] as Condition).operator).toBe('between');
    expect((fixed.root.children[0] as Condition).value).toEqual(['2026-10-02', '2026-10-31']);

    const qOnOut = queryWithRoot('AND', [
      cond('c1', 'createdAt', 'on', '2026-10-01'),
      cond('c2', 'createdAt', 'after', '2026-10-01'),
    ]);
    expect(analyze(qOnOut, TEST_FIELDS).some((i) => i.code === 'CONTRADICTION')).toBe(true);

    const qOnIn = queryWithRoot('AND', [
      cond('c1', 'createdAt', 'on', '2026-10-15'),
      cond('c2', 'createdAt', 'between', ['2026-10-01', '2026-10-31']),
    ]);
    const onInRed = analyze(qOnIn, TEST_FIELDS).find((i) => i.code === 'REDUNDANT');
    expect(onInRed?.fix?.label).toBe('simplify');
    expect(onInRed!.fix!.apply(qOnIn).root.children.map((c) => c.id)).toEqual(['c1']);
  });

  it('handles text eq contradiction, ilike containment, startsWith, and endsWith in AND-scope', () => {
    const qEqContra = queryWithRoot('AND', [
      cond('c1', 'displayName', 'eq', 'Alpha'),
      cond('c2', 'displayName', 'eq', 'Beta'),
    ]);
    expect(analyze(qEqContra, TEST_FIELDS).some((i) => i.code === 'CONTRADICTION')).toBe(true);
    const qIlike = queryWithRoot('AND', [
      cond('c1', 'displayName', 'ilike', 'cairo'),
      cond('c2', 'displayName', 'ilike', 'Cairo East'),
    ]);
    const ilikeIssue = analyze(qIlike, TEST_FIELDS).find((i) => i.code === 'REDUNDANT');
    expect(ilikeIssue?.fix?.label).toBe('simplify');
    expect(ilikeIssue!.fix!.apply(qIlike).root.children.map((c) => c.id)).toEqual(['c2']);

    const qStartContra = queryWithRoot('AND', [
      cond('c1', 'displayName', 'startsWith', 'al'),
      cond('c2', 'displayName', 'startsWith', 'be'),
    ]);
    expect(analyze(qStartContra, TEST_FIELDS).some((i) => i.code === 'CONTRADICTION')).toBe(true);

    const qStartRedundant = queryWithRoot('AND', [
      cond('c1', 'displayName', 'startsWith', 'al'),
      cond('c2', 'displayName', 'startsWith', 'alex'),
    ]);
    expect(analyze(qStartRedundant, TEST_FIELDS).some((i) => i.code === 'REDUNDANT')).toBe(true);

    const qEndContra = queryWithRoot('AND', [
      cond('c1', 'displayName', 'endsWith', 'inc'),
      cond('c2', 'displayName', 'endsWith', 'llc'),
    ]);
    expect(analyze(qEndContra, TEST_FIELDS).some((i) => i.code === 'CONTRADICTION')).toBe(true);

    const qEndRedundant = queryWithRoot('AND', [
      cond('c1', 'displayName', 'endsWith', 'co'),
      cond('c2', 'displayName', 'endsWith', 'tech co'),
    ]);
    expect(analyze(qEndRedundant, TEST_FIELDS).some((i) => i.code === 'REDUNDANT')).toBe(true);
  });
});

describe('query-analyzer OR-scope and list rules', () => {
  it('flags Stage is New OR Stage is Contacted (and eq + in) as OR_MERGE and merges to in', () => {
    const q = queryWithRoot('OR', [
      cond('c1', 'stageId', 'eq', 'stage-new'),
      cond('c2', 'stageId', 'eq', 'stage-contacted'),
    ]);
    const issue = analyze(q, TEST_FIELDS).find((i) => i.code === 'OR_MERGE');
    expect(issue?.severity).toBe('warning');
    expect(issue?.fix?.label).toBe('merge');
    const fixed = issue!.fix!.apply(q);
    expect(fixed.root.children).toHaveLength(1);
    expect((fixed.root.children[0] as Condition).operator).toBe('in');
    expect((fixed.root.children[0] as Condition).value).toEqual(['stage-contacted', 'stage-new']);

    const qEqIn = queryWithRoot('OR', [
      cond('c1', 'stageId', 'eq', 'stage-new'),
      cond('c2', 'stageId', 'in', ['stage-contacted', 'stage-qualifying']),
    ]);
    const issueEqIn = analyze(qEqIn, TEST_FIELDS).find((i) => i.code === 'OR_MERGE');
    expect(issueEqIn?.fix?.label).toBe('merge');
    const fixedEqIn = issueEqIn!.fix!.apply(qEqIn);
    expect((fixedEqIn.root.children[0] as Condition).value).toEqual([
      'stage-contacted',
      'stage-new',
      'stage-qualifying',
    ]);
  });

  it('flags nested same-operator group contradictions, side labels, in vs nin, and all-options OR', () => {
    const nested = queryWithRoot('AND', [
      cond('c1', 'stageId', 'eq', 'stage-new'),
      {
        kind: 'group',
        id: 'g1',
        op: 'AND',
        children: [
          cond('c2', 'stageId', 'eq', 'stage-contacted'),
          cond('c3', 'rating', 'gte', 2),
        ],
      },
    ]);
    const nestedIssue = analyze(nested, TEST_FIELDS).find((i) => i.code === 'CONTRADICTION');
    expect(nestedIssue?.params['opA']).toBe('eq');
    expect(nestedIssue?.params['valA']).toBe('New');
    expect(nestedIssue?.params['opB']).toBe('eq');
    expect(nestedIssue?.params['valB']).toBe('Contacted');
    expect(nestedIssue?.params['canIn']).toBe(1);

    const leadTypeContra = analyze(
      queryWithRoot('AND', [
        cond('c1', 'leadType', 'eq', 'INDIVIDUAL'),
        cond('c2', 'leadType', 'eq', 'CORPORATE'),
      ]),
      TEST_FIELDS,
    ).find((i) => i.code === 'CONTRADICTION');
    expect(leadTypeContra?.params['canIn']).toBeUndefined();

    const sourceNull = analyze(
      queryWithRoot('AND', [
        cond('c1', 'sourceId', 'isNull'),
        cond('c2', 'sourceId', 'eq', 'src-web'),
      ]),
      TEST_FIELDS,
    ).find((i) => i.code === 'CONTRADICTION');
    expect(sourceNull?.params['opA']).toBe('isNull');
    expect(sourceNull?.params['valA']).toBe('');
    expect(sourceNull?.params['opB']).toBe('eq');
    expect(sourceNull?.params['valB']).toBe('Website');

    const inNinFull = analyze(
      queryWithRoot('AND', [
        cond('c1', 'stageId', 'in', ['stage-new', 'stage-contacted']),
        cond('c2', 'stageId', 'nin', ['stage-new', 'stage-contacted']),
      ]),
      TEST_FIELDS,
    );
    expect(inNinFull.some((i) => i.code === 'CONTRADICTION')).toBe(true);

    const inNinPartial = queryWithRoot('AND', [
      cond('c1', 'stageId', 'in', ['stage-new', 'stage-contacted']),
      cond('c2', 'stageId', 'nin', ['stage-contacted']),
    ]);
    const inNinPartialIssue = analyze(inNinPartial, TEST_FIELDS).find((i) => i.code === 'REDUNDANT');
    expect(inNinPartialIssue?.fix?.label).toBe('simplify');
    const inNinFixed = inNinPartialIssue!.fix!.apply(inNinPartial);
    expect(inNinFixed.root.children).toHaveLength(1);
    expect((inNinFixed.root.children[0] as Condition).operator).toBe('eq');
    expect((inNinFixed.root.children[0] as Condition).value).toBe('stage-new');

    const inNinDisjoint = queryWithRoot('AND', [
      cond('c1', 'stageId', 'in', ['stage-new', 'stage-contacted']),
      cond('c2', 'stageId', 'nin', ['stage-qualifying']),
    ]);
    const inNinDisjointIssue = analyze(inNinDisjoint, TEST_FIELDS).find((i) => i.code === 'REDUNDANT');
    expect(inNinDisjointIssue?.fix?.label).toBe('simplify');
    expect(inNinDisjointIssue!.fix!.apply(inNinDisjoint).root.children.map((c) => c.id)).toEqual(['c1']);

    const leadTypeOr = queryWithRoot('OR', [
      cond('c1', 'leadType', 'eq', 'INDIVIDUAL'),
      cond('c2', 'leadType', 'eq', 'CORPORATE'),
    ]);
    const leadTypeAlwaysTrue = analyze(leadTypeOr, TEST_FIELDS).find((i) => i.code === 'ALWAYS_TRUE');
    expect(leadTypeAlwaysTrue?.fix?.label).toBe('removeBoth');
    expect(leadTypeAlwaysTrue!.fix!.apply(leadTypeOr).root.children).toHaveLength(0);
  });

  it('flags Source empty OR not empty as ALWAYS_TRUE with removeBoth fix', () => {
    const q = queryWithRoot('OR', [
      cond('c1', 'sourceId', 'isNull'),
      cond('c2', 'sourceId', 'isNotNull'),
    ]);
    const issue = analyze(q, TEST_FIELDS).find((i) => i.code === 'ALWAYS_TRUE');
    expect(issue?.severity).toBe('warning');
    expect(issue?.fix?.label).toBe('removeBoth');
    expect(issue!.fix!.apply(q).root.children).toHaveLength(0);
  });

  it('flags Card colour none of all 11 as MATCHES_NOTHING and in all 11 as ALWAYS_TRUE', () => {
    const all11 = CARD_COLOR_OPTIONS.map((o) => o.value);
    const qNin = queryWithRoot('AND', [cond('c1', 'cardColor', 'nin', all11)]);
    const ninIssues = analyze(qNin, TEST_FIELDS);
    expect(ninIssues.some((i) => i.code === 'MATCHES_NOTHING' && i.severity === 'error')).toBe(true);

    const qIn = queryWithRoot('AND', [cond('c1', 'cardColor', 'in', all11)]);
    const inIssues = analyze(qIn, TEST_FIELDS);
    const alwaysTrue = inIssues.find((i) => i.code === 'ALWAYS_TRUE');
    expect(alwaysTrue?.severity).toBe('warning');
    expect(alwaysTrue?.fix?.label).toBe('remove');
    expect(alwaysTrue!.fix!.apply(qIn).root.children).toHaveLength(0);
  });
});

describe('query-analyzer structure and fieldAvailability rules', () => {
  it('flags Tags inside an OR group as ROOT_ONLY', () => {
    const q = queryWithRoot('OR', [cond('c1', 'tagIds', 'hasAny', ['tag-vip'])]);
    const issues = analyze(q, TEST_FIELDS);
    expect(issues.some((i) => i.code === 'ROOT_ONLY' && i.severity === 'error')).toBe(true);
  });

  it('flags Two text searches (lead + email) as EXCLUSIVE', () => {
    const q = queryWithRoot('AND', [], [
      cond('f1', 'searchLead', 'contains', 'Cairo'),
      cond('f2', 'searchEmail', 'contains', 'info@cairo.com'),
    ]);
    const issues = analyze(q, TEST_FIELDS);
    expect(issues.some((i) => i.code === 'EXCLUSIVE' && i.severity === 'error')).toBe(true);
  });

  it('flags singleton fields used more than once as SINGLETON', () => {
    const q = queryWithRoot('AND', [], [
      cond('f1', 'hasOverdue', 'is', true),
      cond('f2', 'hasOverdue', 'is', false),
    ]);
    expect(analyze(q, TEST_FIELDS).some((i) => i.code === 'SINGLETON')).toBe(true);
  });

  it('flags duplicate sibling groups as DUPLICATE_GROUP with remove fix', () => {
    const g1: Group = {
      kind: 'group',
      id: 'g1',
      op: 'OR',
      children: [cond('c1', 'stageId', 'eq', 'stage-new'), cond('c2', 'stageId', 'eq', 'stage-contacted')],
    };
    const g2: Group = {
      kind: 'group',
      id: 'g2',
      op: 'OR',
      children: [cond('c3', 'stageId', 'eq', 'stage-contacted'), cond('c4', 'stageId', 'eq', 'stage-new')],
    };
    const q = queryWithRoot('AND', [g1, g2]);
    const dup = analyze(q, TEST_FIELDS).find((i) => i.code === 'DUPLICATE_GROUP');
    expect(dup?.severity).toBe('warning');
    expect(dup?.fix?.label).toBe('remove');
    expect(dup!.fix!.apply(q).root.children.map((n) => n.id)).toEqual(['g1']);
  });

  it('flags depth > 3, children > 20, and conditions > 50 with LIMIT', () => {
    const deep: Group = {
      kind: 'group',
      id: 'g2',
      op: 'OR',
      children: [
        {
          kind: 'group',
          id: 'g3',
          op: 'AND',
          children: [
            {
              kind: 'group',
              id: 'g4',
              op: 'OR',
              children: [cond('c1', 'rating', 'eq', 1)],
            },
          ],
        },
      ],
    };
    expect(analyze(queryWithRoot('AND', [deep]), TEST_FIELDS).some((i) => i.code === 'LIMIT')).toBe(true);

    const manyChildren = Array.from({ length: 21 }, (_, idx) => cond(`c${idx}`, 'displayName', 'ilike', `x${idx}`));
    expect(analyze(queryWithRoot('AND', manyChildren), TEST_FIELDS).some((i) => i.code === 'LIMIT')).toBe(true);

    const gA: Group = {
      kind: 'group',
      id: 'ga',
      op: 'OR',
      children: Array.from({ length: 18 }, (_, idx) => cond(`a${idx}`, 'displayName', 'ilike', `a${idx}`)),
    };
    const gB: Group = {
      kind: 'group',
      id: 'gb',
      op: 'OR',
      children: Array.from({ length: 18 }, (_, idx) => cond(`b${idx}`, 'displayName', 'ilike', `b${idx}`)),
    };
    const gC: Group = {
      kind: 'group',
      id: 'gc',
      op: 'OR',
      children: Array.from({ length: 15 }, (_, idx) => cond(`c${idx}`, 'displayName', 'ilike', `c${idx}`)),
    };
    const over50 = analyze(queryWithRoot('AND', [gA, gB, gC]), TEST_FIELDS);
    expect(over50.some((i) => i.code === 'LIMIT' && i.params['max'] === QUERY_LIMITS.conditions)).toBe(true);
  });

  it('computes fieldAvailability for fixed vs tree targets', () => {
    const q = queryWithRoot('AND', [], [
      cond('f1', 'searchLead', 'contains', 'Cairo'),
      cond('f2', 'tagIds', 'hasAny', ['tag-vip']),
    ]);
    const treeAvail = fieldAvailability(q, TEST_FIELDS, { groupId: 'root', depth: 1 });
    expect(treeAvail['tagIds']).toEqual({ enabled: false, reason: 'ROOT_ONLY' });
    expect(treeAvail['searchLead']).toEqual({ enabled: false, reason: 'ROOT_ONLY' });
    expect(treeAvail['stageId']).toEqual({ enabled: true });

    const fixedAvail = fieldAvailability(q, TEST_FIELDS, { groupId: 'fixed', depth: 0 });
    expect(fixedAvail['tagIds']).toEqual({ enabled: false, reason: 'SINGLETON' });
    expect(fixedAvail['searchLead']).toEqual({ enabled: false, reason: 'SINGLETON' });
    expect(fixedAvail['searchEmail']).toEqual({ enabled: false, reason: 'EXCLUSIVE' });
    expect(fixedAvail['hasOverdue']).toEqual({ enabled: true });
  });
});

describe('query-normalize', () => {
  it('converts in [A] -> eq A, nin [A] -> neq A, trims text, and sorts lists', () => {
    const q = queryWithRoot(
      'AND',
      [
        cond('c1', 'stageId', 'in', ['stage-new']),
        cond('c2', 'stageId', 'nin', ['stage-contacted']),
        cond('c3', 'displayName', 'ilike', '  Cairo  '),
        cond('c4', 'stageId', 'in', ['stage-qualifying', 'stage-contacted']),
      ],
    );
    const norm = normalize(q, TEST_FIELDS);
    const children = norm.root.children as Condition[];
    expect(children[0]).toMatchObject({ id: 'c1', operator: 'eq', value: 'stage-new' });
    expect(children[1]).toMatchObject({ id: 'c2', operator: 'neq', value: 'stage-contacted' });
    expect(children[2]).toMatchObject({ id: 'c3', operator: 'ilike', value: 'Cairo' });
    expect(children[3]).toMatchObject({ id: 'c4', operator: 'in', value: ['stage-contacted', 'stage-qualifying'] });
  });

  it('flattens nested same-op groups, drops empty groups, and unwraps single-child groups keeping ids stable', () => {
    const q: Query = {
      fixed: [],
      root: {
        kind: 'group',
        id: 'root',
        op: 'AND',
        children: [
          {
            kind: 'group',
            id: 'same-op',
            op: 'AND',
            children: [cond('c1', 'rating', 'gte', 1), cond('c2', 'displayName', 'ilike', 'Nile')],
          },
          {
            kind: 'group',
            id: 'single-child',
            op: 'OR',
            children: [cond('c3', 'status', 'eq', 'OPEN')],
          },
          {
            kind: 'group',
            id: 'empty-grp',
            op: 'OR',
            children: [],
          },
        ],
      },
    };
    const norm = normalize(q, TEST_FIELDS);
    expect(norm.root.id).toBe('root');
    expect(norm.root.children.map((c) => c.id)).toEqual(['c1', 'c2', 'c3']);
  });
});

describe('query-dates resolveDate', () => {
  it('resolves on 2026-03-15 in Africa/Cairo to half-open ISO range with +02:00 offset', () => {
    expect(resolveDate('on', '2026-03-15', 'Africa/Cairo')).toEqual({
      gte: '2026-03-15T00:00:00+02:00',
      lt: '2026-03-16T00:00:00+02:00',
    });
  });

  it('resolves before, after, between, relative, and null operators', () => {
    const now = new Date('2026-03-15T12:00:00Z');
    expect(resolveDate('before', '2026-03-15', 'Africa/Cairo')).toEqual({
      lt: '2026-03-15T00:00:00+02:00',
    });
    expect(resolveDate('after', '2026-03-15', 'Africa/Cairo')).toEqual({
      gte: '2026-03-16T00:00:00+02:00',
    });
    expect(resolveDate('between', ['2026-03-10', '2026-03-15'], 'Africa/Cairo')).toEqual({
      gte: '2026-03-10T00:00:00+02:00',
      lt: '2026-03-16T00:00:00+02:00',
    });
    expect(resolveDate('relative', 'last7', 'Africa/Cairo', now)).toEqual({
      gte: '2026-03-09T00:00:00+02:00',
      lt: '2026-03-16T00:00:00+02:00',
    });
    expect(resolveDate('isNull', undefined, 'Africa/Cairo')).toEqual({ isNull: true });
    expect(resolveDate('isNotNull', undefined, 'Africa/Cairo')).toEqual({ isNull: false });
  });
});

describe('query-summary and query-edit', () => {
  it('counts conditions and groups and builds a readable summary', () => {
    const q = queryWithRoot(
      'AND',
      [
        cond('c1', 'stageId', 'eq', 'stage-new'),
        {
          kind: 'group',
          id: 'g1',
          op: 'OR',
          children: [
            cond('c2', 'rating', 'gte', 2),
            cond('c3', 'createdAt', 'relative', 'today'),
          ],
        },
      ],
      [cond('f1', 'tagIds', 'hasAny', ['tag-vip', 'tag-erp'])],
    );

    const t = (key: string, p?: object): string => {
      const dict: Record<string, string> = {
        'qb.summary.and': ', and ',
        'qb.summary.or': ' or ',
        'qb.op.eq': 'is',
        'qb.op.gte': '>=',
        'qb.op.relative': 'is',
        'qb.op.hasAny': 'has any of',
        'qb.date.today': 'Today',
      };
      if (key === 'qb.summary.cond' && p) {
        const rec = p as Record<string, string>;
        return `${rec['field']} ${rec['op']} ${rec['value']}`;
      }
      return dict[key] ?? key;
    };

    const summary = summarize(q, TEST_FIELDS, t);
    expect(summary.count).toBe(4);
    expect(summary.groups).toBe(1);
    expect(summary.text).toBe(
      'Tags has any of VIP, ERP, and Stage is New, and (Rating >= 2 or Created is Today)',
    );
  });

  it('supports immutable edit helpers and depthOf', () => {
    let q = emptyQuery();
    q = addFixed(q, emptyCondition({ id: 'f1', field: 'tagIds', operator: 'hasAny', value: ['tag-vip'] }));
    q = addCondition(q, q.root.id, { id: 'c1', field: 'stageId', operator: 'eq', value: 'stage-new' });
    q = addGroup(q, q.root.id, 'OR');
    const subGroup = q.root.children.find((n): n is Group => n.kind === 'group')!;
    q = addCondition(q, subGroup.id, { id: 'c2', field: 'rating', operator: 'gte', value: 2 });
    q = setGroupOp(q, subGroup.id, 'AND');
    q = updateCondition(q, 'c2', { value: 3 });

    expect(countConditions(q)).toBe(3);
    expect(depthOf(q, 'f1')).toBe(0);
    expect(depthOf(q, q.root.id)).toBe(1);
    expect(depthOf(q, 'c1')).toBe(1);
    expect(depthOf(q, subGroup.id)).toBe(2);
    expect(depthOf(q, 'c2')).toBe(2);

    q = removeFixed(q, 'f1');
    q = removeNode(q, 'c1');
    expect(countConditions(q)).toBe(1);
  });
});
