import { TemplateApiError } from '../templates.api';
import {
  FAKE_TEMPLATE_IDS,
  fakeGetDataSourceSchema as getDataSourceSchema,
  fakeGetDraft as getDraft,
  fakeGetTemplate as getTemplate,
} from '../templates.fake';
import type { TemplateFormulaExpression, TemplateFormulaRounding } from '../templates.model';
import {
  ApplyFunctionToDraftsRequestDto,
  ApplyFunctionToDraftsResponseDto,
  ArchiveOrRestoreFunctionRequestDto,
  CreateFunctionRequestDto,
  FUNCTION_COMPANY_NILE_ID,
  FUNCTION_CODE_RE,
  FUNCTION_DECIMAL_RE,
  FUNCTION_EDITOR_CONTEXT_CONTRACT,
  FUNCTION_EDITOR_CONTEXT_MAX_CODES,
  FUNCTION_EDITOR_CONTEXT_MAX_VERSIONS,
  FUNCTION_EDITOR_CONTEXT_TTL_MS,
  FUNCTION_IMPACT_TTL_MS,
  FUNCTION_MAX_BODY_BYTES,
  FUNCTION_MAX_IMPACT_TARGETS,
  FUNCTION_MAX_PARAMETERS,
  FUNCTION_MAX_TESTS,
  FUNCTION_NUMERIC_POLICY,
  FUNCTION_PARAM_NAME_RE,
  FUNCTION_VALIDATION_TTL_MS,
  FunctionCursorPage,
  FunctionDetailDto,
  FunctionEditorContextRequestDto,
  FunctionEditorContextResponseDto,
  FunctionEditorContextVersion,
  FunctionImpactComparisonDto,
  FunctionImpactRequestDto,
  FunctionImpactResponseDto,
  FunctionImpactTargetResultDto,
  FunctionParameter,
  FunctionSummaryDto,
  FunctionTestCase,
  FunctionTestResultDto,
  FunctionUsageItemDto,
  FunctionUsageQuery,
  FunctionValidationIssue,
  FunctionValue,
  FunctionVersionDetailDto,
  FunctionVersionSummaryDto,
  FunctionVersionsQuery,
  FunctionWorkingBody,
  FunctionsListQuery,
  PatchFunctionRequestDto,
  PublishFunctionRequestDto,
  ValidateFunctionRequestDto,
  ValidateFunctionResponseDto,
} from './functions.model';

function fakeDelay(ms = 160): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function uuidv7(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const now = Date.now();
  bytes[0] = Math.floor(now / 2 ** 40) & 0xff;
  bytes[1] = Math.floor(now / 2 ** 32) & 0xff;
  bytes[2] = Math.floor(now / 2 ** 24) & 0xff;
  bytes[3] = Math.floor(now / 2 ** 16) & 0xff;
  bytes[4] = Math.floor(now / 2 ** 8) & 0xff;
  bytes[5] = now & 0xff;
  bytes[6] = (bytes[6] & 0x0f) | 0x70;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function pseudoSha256(seed: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x9e3779b9;
  for (let i = 0; i < seed.length; i++) {
    const ch = seed.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ (ch + i), 0x85ebca6b) >>> 0;
  }
  const part = h1.toString(16).padStart(8, '0') + h2.toString(16).padStart(8, '0');
  return part.repeat(4).slice(0, 64);
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function parseIfMatchRevision(ifMatch: string): number {
  const match = /^"(\d+)"$/.exec(ifMatch.trim());
  if (!match) {
    throw new TemplateApiError(400, 'FUNCTION_DEFINITION_INVALID');
  }
  return Number(match[1]);
}

function computeContentChecksum(working: FunctionWorkingBody): string {
  return pseudoSha256(JSON.stringify(working));
}

function collectDependencyVersionIds(expr: TemplateFormulaExpression, out: Set<string>): void {
  switch (expr.kind) {
    case 'FUNCTION_CALL':
      out.add(expr.functionVersionId);
      for (const arg of expr.arguments) {
        collectDependencyVersionIds(arg.expression, out);
      }
      break;
    case 'ADD':
    case 'SUBTRACT':
    case 'MULTIPLY':
    case 'SUM':
    case 'MIN':
    case 'MAX':
    case 'COALESCE':
    case 'CONCAT':
      for (const op of expr.operands) collectDependencyVersionIds(op, out);
      break;
    case 'DIVIDE':
      collectDependencyVersionIds(expr.dividend, out);
      collectDependencyVersionIds(expr.divisor, out);
      break;
    case 'ROUND':
    case 'ABS':
    case 'NEGATE':
    case 'IS_NULL':
    case 'TRIM':
      collectDependencyVersionIds(expr.value, out);
      break;
    case 'DATE_ADD_DAYS':
      collectDependencyVersionIds(expr.date, out);
      collectDependencyVersionIds(expr.days, out);
      break;
    case 'DATE_DIFF_DAYS':
    case 'COMPARE':
      collectDependencyVersionIds(expr.left, out);
      collectDependencyVersionIds(expr.right, out);
      break;
    case 'IF':
      collectDependencyVersionIds(expr.condition, out);
      collectDependencyVersionIds(expr.whenTrue, out);
      collectDependencyVersionIds(expr.whenFalse, out);
      break;
    case 'SUM_ROWS':
      collectDependencyVersionIds(expr.item, out);
      break;
  }
}

function computeDependencyChecksum(working: FunctionWorkingBody): string {
  const deps = new Set<string>();
  collectDependencyVersionIds(working.expression, deps);
  return pseudoSha256(Array.from(deps).sort().join(','));
}

const AUTHOR_USER = {
  kind: 'USER' as const,
  actorId: '01948100-0000-7000-8000-00000000a001',
  displayName: 'User',
};

const FN_IDS = {
  lineDiscount: '01948100-0000-7000-8000-00000000f001',
  vat14: '01948100-0000-7000-8000-00000000f002',
  shippingFee: '01948100-0000-7000-8000-00000000f003',
} as const;

const VER_IDS = {
  lineDiscountV1: '01948100-0000-7000-8000-00000000f101',
  lineDiscountV2: '01948100-0000-7000-8000-00000000f102',
  vat14V1: '01948100-0000-7000-8000-00000000f201',
  shippingFeeV1: '01948100-0000-7000-8000-00000000f301',
} as const;

interface StoredFunction {
  detail: FunctionDetailDto;
  versions: FunctionVersionDetailDto[];
  usage: FunctionUsageItemDto[];
}

interface StoredImpact {
  response: FunctionImpactResponseDto;
  consumed: boolean;
  snapshots: Map<string, number>;
}

const STORE = createInitialStore();

function createInitialStore(): {
  functions: StoredFunction[];
  impacts: Map<string, StoredImpact>;
  idempotency: Map<string, unknown>;
} {
  const lineDiscountWorking: FunctionWorkingBody = {
    numericPolicy: FUNCTION_NUMERIC_POLICY,
    name: 'Line net after discount',
    description: 'Calculates net line amount by subtracting a fractional discount rate from gross amount.',
    parameters: [
      { name: 'gross', type: 'DECIMAL', nullable: false, dimension: 'MONEY' },
      { name: 'discountRate', type: 'DECIMAL', nullable: false, dimension: 'SCALAR' },
    ],
    result: { type: 'DECIMAL', nullable: false, dimension: 'MONEY' },
    expression: {
      kind: 'MULTIPLY',
      operands: [
        { kind: 'PARAMETER', name: 'gross' },
        {
          kind: 'SUBTRACT',
          operands: [
            { kind: 'DECIMAL_LITERAL', value: '1', dimension: 'SCALAR' },
            { kind: 'PARAMETER', name: 'discountRate' },
          ],
        },
      ],
    },
    tests: [
      {
        id: '01948100-0000-7000-8000-00000000e101',
        name: 'Standard 10% discount',
        arguments: [
          { name: 'gross', value: { kind: 'DECIMAL', value: '1000', dimension: 'MONEY', currencyCode: 'EGP' } },
          { name: 'discountRate', value: { kind: 'DECIMAL', value: '0.1', dimension: 'SCALAR' } },
        ],
        expected: { kind: 'DECIMAL', value: '900', dimension: 'MONEY', currencyCode: 'EGP' },
      },
      {
        id: '01948100-0000-7000-8000-00000000e102',
        name: 'Zero discount',
        arguments: [
          { name: 'gross', value: { kind: 'DECIMAL', value: '2500', dimension: 'MONEY', currencyCode: 'EGP' } },
          { name: 'discountRate', value: { kind: 'DECIMAL', value: '0', dimension: 'SCALAR' } },
        ],
        expected: { kind: 'DECIMAL', value: '2500', dimension: 'MONEY', currencyCode: 'EGP' },
      },
    ],
  };

  const lineDiscountChecksum = computeContentChecksum(lineDiscountWorking);
  const lineDiscountDepChecksum = computeDependencyChecksum(lineDiscountWorking);
  const nowIso = new Date().toISOString();

  const vat14Working: FunctionWorkingBody = {
    numericPolicy: FUNCTION_NUMERIC_POLICY,
    name: 'VAT 14% amount',
    description: 'Computes Egypt 14% VAT rounded half-up to 2 fraction digits.',
    parameters: [{ name: 'netAmount', type: 'DECIMAL', nullable: false, dimension: 'MONEY' }],
    result: { type: 'DECIMAL', nullable: false, dimension: 'MONEY' },
    expression: {
      kind: 'ROUND',
      value: {
        kind: 'MULTIPLY',
        operands: [
          { kind: 'PARAMETER', name: 'netAmount' },
          { kind: 'DECIMAL_LITERAL', value: '0.14', dimension: 'SCALAR' },
        ],
      },
      scale: 2,
      rounding: 'HALF_UP',
    },
    tests: [
      {
        id: '01948100-0000-7000-8000-00000000e201',
        name: 'Standard VAT on 1,000 EGP',
        arguments: [
          { name: 'netAmount', value: { kind: 'DECIMAL', value: '1000', dimension: 'MONEY', currencyCode: 'EGP' } },
        ],
        expected: { kind: 'DECIMAL', value: '140', dimension: 'MONEY', currencyCode: 'EGP' },
      },
    ],
  };

  const vat14Checksum = computeContentChecksum(vat14Working);

  const shippingWorking: FunctionWorkingBody = {
    numericPolicy: FUNCTION_NUMERIC_POLICY,
    name: 'Legacy shipping fee',
    description: 'Deprecated weight-based freight fee replaced by rate cards.',
    parameters: [
      { name: 'weightKg', type: 'DECIMAL', nullable: false, dimension: 'QUANTITY' },
      { name: 'unitRate', type: 'DECIMAL', nullable: false, dimension: 'UNIT_PRICE' },
    ],
    result: { type: 'DECIMAL', nullable: false, dimension: 'MONEY' },
    expression: {
      kind: 'MULTIPLY',
      operands: [
        { kind: 'PARAMETER', name: 'weightKg' },
        { kind: 'PARAMETER', name: 'unitRate' },
      ],
    },
    tests: [
      {
        id: '01948100-0000-7000-8000-00000000e301',
        name: '10 units at 25 EGP',
        arguments: [
          { name: 'weightKg', value: { kind: 'DECIMAL', value: '10', dimension: 'QUANTITY', unitCode: 'kg' } },
          { name: 'unitRate', value: { kind: 'DECIMAL', value: '25', dimension: 'UNIT_PRICE', currencyCode: 'EGP', unitCode: 'kg' } },
        ],
        expected: { kind: 'DECIMAL', value: '250', dimension: 'MONEY', currencyCode: 'EGP' },
      },
    ],
  };

  const shippingChecksum = computeContentChecksum(shippingWorking);

  return {
    functions: [
      {
        detail: {
          id: FN_IDS.lineDiscount,
          code: 'LINE_NET_AFTER_DISCOUNT',
          name: lineDiscountWorking.name,
          description: lineDiscountWorking.description,
          scope: { scopeType: 'TENANT' },
          status: 'ACTIVE',
          revision: 3,
          etag: '"3"',
          publishedVersionId: VER_IDS.lineDiscountV2,
          createdAt: '2026-10-12T09:00:00.000Z',
          updatedAt: '2026-11-18T14:20:00.000Z',
          working: clone(lineDiscountWorking),
          validation: {
            id: '01948100-0000-7000-8000-00000000v102',
            state: 'PASSED',
            contentChecksum: lineDiscountChecksum,
            dependencyChecksum: lineDiscountDepChecksum,
            validatedAt: nowIso,
          },
        },
        versions: [
          {
            id: VER_IDS.lineDiscountV2,
            functionId: FN_IDS.lineDiscount,
            versionNumber: 2,
            contentChecksum: lineDiscountChecksum,
            publishedAt: '2026-11-18T14:20:00.000Z',
            publishedBy: AUTHOR_USER,
            changeNote: 'Added zero-discount test case and exact scalar alignment.',
            parameters: clone(lineDiscountWorking.parameters),
            result: clone(lineDiscountWorking.result),
            expression: clone(lineDiscountWorking.expression),
            dependencies: [],
            testProof: {
              validationId: '01948100-0000-7000-8000-00000000v102',
              passedCount: 2,
              totalCount: 2,
              checksum: pseudoSha256('proof-v2'),
            },
            packagePins: {
              templateSchemaVersion: '1.0.0',
              templateEngineVersion: '1.2.0',
            },
          },
          {
            id: VER_IDS.lineDiscountV1,
            functionId: FN_IDS.lineDiscount,
            versionNumber: 1,
            contentChecksum: pseudoSha256('lineDiscountV1'),
            publishedAt: '2026-10-15T11:30:00.000Z',
            publishedBy: AUTHOR_USER,
            changeNote: 'Initial line net calculation.',
            parameters: clone(lineDiscountWorking.parameters),
            result: clone(lineDiscountWorking.result),
            expression: clone(lineDiscountWorking.expression),
            dependencies: [],
            testProof: {
              validationId: '01948100-0000-7000-8000-00000000v101',
              passedCount: 1,
              totalCount: 1,
              checksum: pseudoSha256('proof-v1'),
            },
            packagePins: {
              templateSchemaVersion: '1.0.0',
              templateEngineVersion: '1.1.0',
            },
          },
        ],
        usage: [
          {
            templateId: FAKE_TEMPLATE_IDS.corporateQuotationId,
            templateName: 'Corporate Quotation',
            sourceKind: 'DRAFT',
            sourceId: '01948100-0000-7000-8000-000000002001',
            revisionOrVersionNumber: 4,
            functionVersionId: VER_IDS.lineDiscountV1,
          },
          {
            templateId: FAKE_TEMPLATE_IDS.corporateQuotationId,
            templateName: 'Corporate Quotation',
            sourceKind: 'PUBLISHED',
            sourceId: '01948100-0000-7000-8000-000000002101',
            revisionOrVersionNumber: 2,
            functionVersionId: VER_IDS.lineDiscountV1,
          },
          {
            templateId: '01948100-0000-7000-8000-000000001002',
            templateName: 'Classic Quotation',
            sourceKind: 'DRAFT',
            sourceId: '01948100-0000-7000-8000-000000002002',
            revisionOrVersionNumber: 2,
            functionVersionId: VER_IDS.lineDiscountV1,
          },
        ],
      },
      {
        detail: {
          id: FN_IDS.vat14,
          code: 'VAT_14_AMOUNT',
          name: vat14Working.name,
          description: vat14Working.description,
          scope: { scopeType: 'COMPANY', companyId: FUNCTION_COMPANY_NILE_ID },
          status: 'ACTIVE',
          revision: 2,
          etag: '"2"',
          publishedVersionId: VER_IDS.vat14V1,
          createdAt: '2026-10-20T10:15:00.000Z',
          updatedAt: '2026-11-12T08:45:00.000Z',
          working: clone(vat14Working),
          validation: {
            id: '01948100-0000-7000-8000-00000000v201',
            state: 'PASSED',
            contentChecksum: vat14Checksum,
            dependencyChecksum: pseudoSha256(''),
            validatedAt: nowIso,
          },
        },
        versions: [
          {
            id: VER_IDS.vat14V1,
            functionId: FN_IDS.vat14,
            versionNumber: 1,
            contentChecksum: vat14Checksum,
            publishedAt: '2026-11-12T08:45:00.000Z',
            publishedBy: AUTHOR_USER,
            changeNote: 'Initial VAT 14% rule for Nile Trading.',
            parameters: clone(vat14Working.parameters),
            result: clone(vat14Working.result),
            expression: clone(vat14Working.expression),
            dependencies: [],
            testProof: {
              validationId: '01948100-0000-7000-8000-00000000v201',
              passedCount: 1,
              totalCount: 1,
              checksum: pseudoSha256('vat-proof-v1'),
            },
            packagePins: {
              templateSchemaVersion: '1.0.0',
              templateEngineVersion: '1.2.0',
            },
          },
        ],
        usage: [
          {
            templateId: FAKE_TEMPLATE_IDS.corporateQuotationId,
            templateName: 'Corporate Quotation',
            sourceKind: 'DRAFT',
            sourceId: '01948100-0000-7000-8000-000000002001',
            revisionOrVersionNumber: 4,
            functionVersionId: VER_IDS.vat14V1,
          },
        ],
      },
      {
        detail: {
          id: FN_IDS.shippingFee,
          code: 'LEGACY_SHIPPING_FEE',
          name: shippingWorking.name,
          description: shippingWorking.description,
          scope: { scopeType: 'TENANT' },
          status: 'ARCHIVED',
          revision: 4,
          etag: '"4"',
          publishedVersionId: VER_IDS.shippingFeeV1,
          createdAt: '2026-09-02T12:00:00.000Z',
          updatedAt: '2026-11-01T16:00:00.000Z',
          working: clone(shippingWorking),
          validation: {
            id: '01948100-0000-7000-8000-00000000v301',
            state: 'PASSED',
            contentChecksum: shippingChecksum,
            dependencyChecksum: pseudoSha256(''),
            validatedAt: '2026-10-25T10:00:00.000Z',
          },
        },
        versions: [
          {
            id: VER_IDS.shippingFeeV1,
            functionId: FN_IDS.shippingFee,
            versionNumber: 1,
            contentChecksum: shippingChecksum,
            publishedAt: '2026-09-03T09:10:00.000Z',
            publishedBy: AUTHOR_USER,
            changeNote: 'Initial shipping fee calculation.',
            parameters: clone(shippingWorking.parameters),
            result: clone(shippingWorking.result),
            expression: clone(shippingWorking.expression),
            dependencies: [],
            testProof: {
              validationId: '01948100-0000-7000-8000-00000000v301',
              passedCount: 1,
              totalCount: 1,
              checksum: pseudoSha256('ship-proof-v1'),
            },
            packagePins: {
              templateSchemaVersion: '1.0.0',
              templateEngineVersion: '1.1.0',
            },
          },
        ],
        usage: [],
      },
    ],
    impacts: new Map<string, StoredImpact>(),
    idempotency: new Map<string, unknown>(),
  };
}

function toSummary(detail: FunctionDetailDto): FunctionSummaryDto {
  return {
    id: detail.id,
    code: detail.code,
    name: detail.name,
    description: detail.description ?? null,
    scope: clone(detail.scope),
    status: detail.status,
    revision: detail.revision,
    etag: detail.etag,
    publishedVersionId: detail.publishedVersionId ?? null,
    createdAt: detail.createdAt,
    updatedAt: detail.updatedAt,
  };
}

function paginate<T>(items: readonly T[], cursor: string | null | undefined, limitInput?: number): FunctionCursorPage<T> {
  const limit = Math.min(100, Math.max(1, limitInput ?? 25));
  let offset = 0;
  if (cursor) {
    const parsed = Number(cursor);
    if (!Number.isInteger(parsed) || parsed < 0) {
      throw new TemplateApiError(400, 'FUNCTION_DEFINITION_INVALID');
    }
    offset = parsed;
  }
  const slice = items.slice(offset, offset + limit);
  const hasNextPage = offset + limit < items.length;
  return {
    items: clone(slice),
    pageInfo: {
      limit,
      hasNextPage,
      nextCursor: hasNextPage ? String(offset + limit) : null,
    },
  };
}

function inspectAst(
  expr: TemplateFormulaExpression,
  paramNames: ReadonlySet<string>,
  ownVersionIds: ReadonlySet<string>,
  depth: number,
): { nodes: number; maxDepth: number; issues: FunctionValidationIssue[] } {
  const issues: FunctionValidationIssue[] = [];
  if (depth > 16) {
    issues.push({ severity: 'ERROR', code: 'FUNCTION_LIMIT_EXCEEDED', path: 'expression' });
    return { nodes: 1, maxDepth: depth, issues };
  }

  let nodes = 1;
  let maxDepth = depth;
  const walk = (child: TemplateFormulaExpression) => {
    const res = inspectAst(child, paramNames, ownVersionIds, depth + 1);
    nodes += res.nodes;
    if (res.maxDepth > maxDepth) maxDepth = res.maxDepth;
    issues.push(...res.issues);
  };

  switch (expr.kind) {
    case 'BINDING':
    case 'ROOT_BINDING':
    case 'ROW_BINDING':
    case 'FORMULA_REF':
    case 'SUM_ROWS':
      issues.push({ severity: 'ERROR', code: 'FUNCTION_DEFINITION_INVALID', path: 'expression' });
      break;
    case 'PARAMETER':
      if (!paramNames.has(expr.name)) {
        issues.push({ severity: 'ERROR', code: 'FUNCTION_DEFINITION_INVALID', path: 'expression' });
      }
      break;
    case 'FUNCTION_CALL':
      if (ownVersionIds.has(expr.functionVersionId)) {
        issues.push({ severity: 'ERROR', code: 'FUNCTION_DEPENDENCY_CYCLE', path: 'expression' });
      }
      for (const arg of expr.arguments) walk(arg.expression);
      break;
    case 'ADD':
    case 'SUBTRACT':
    case 'MULTIPLY':
    case 'SUM':
    case 'MIN':
    case 'MAX':
    case 'COALESCE':
    case 'CONCAT':
      for (const op of expr.operands) walk(op);
      break;
    case 'DIVIDE':
      walk(expr.dividend);
      walk(expr.divisor);
      break;
    case 'ROUND':
    case 'ABS':
    case 'NEGATE':
    case 'IS_NULL':
    case 'TRIM':
      walk(expr.value);
      break;
    case 'DATE_ADD_DAYS':
      walk(expr.date);
      walk(expr.days);
      break;
    case 'DATE_DIFF_DAYS':
    case 'COMPARE':
      walk(expr.left);
      walk(expr.right);
      break;
    case 'IF':
      walk(expr.condition);
      walk(expr.whenTrue);
      walk(expr.whenFalse);
      break;
  }

  return { nodes, maxDepth, issues };
}

function roundNumber(value: number, scale: number, rounding: TemplateFormulaRounding): number {
  const factor = 10 ** Math.min(18, Math.max(0, Math.trunc(scale)));
  const scaled = value * factor;
  if (rounding === 'DOWN') {
    return Math.trunc(scaled) / factor;
  }
  if (rounding === 'HALF_EVEN') {
    const floor = Math.floor(scaled);
    const diff = scaled - floor;
    if (Math.abs(diff - 0.5) < 1e-10) {
      return (floor % 2 === 0 ? floor : floor + 1) / factor;
    }
    return Math.round(scaled) / factor;
  }
  return Math.round(scaled) / factor;
}

type EvalScalar = number | string | boolean | null;

function functionValueToEval(val: FunctionValue): EvalScalar {
  switch (val.kind) {
    case 'NULL':
      return null;
    case 'DECIMAL':
      return Number(val.value);
    case 'STRING':
    case 'DATE':
      return val.value;
    case 'BOOLEAN':
      return val.value;
  }
}

function evaluateAst(expr: TemplateFormulaExpression, env: ReadonlyMap<string, EvalScalar>): EvalScalar {
  switch (expr.kind) {
    case 'DECIMAL_LITERAL': {
      const n = Number(expr.value);
      if (!Number.isFinite(n)) throw new Error('INVALID_DECIMAL');
      return n;
    }
    case 'STRING_LITERAL':
    case 'DATE_LITERAL':
    case 'BOOLEAN_LITERAL':
      return expr.value;
    case 'NULL_LITERAL':
      return null;
    case 'PARAMETER':
      return env.has(expr.name) ? (env.get(expr.name) ?? null) : null;
    case 'ADD':
    case 'SUM': {
      let sum = 0;
      for (const op of expr.operands) {
        const v = evaluateAst(op, env);
        if (typeof v !== 'number') throw new Error('TYPE_ERROR');
        sum += v;
      }
      return sum;
    }
    case 'SUBTRACT': {
      const first = evaluateAst(expr.operands[0], env);
      const second = evaluateAst(expr.operands[1], env);
      if (typeof first !== 'number' || typeof second !== 'number') throw new Error('TYPE_ERROR');
      return first - second;
    }
    case 'MULTIPLY': {
      let prod = 1;
      for (const op of expr.operands) {
        const v = evaluateAst(op, env);
        if (typeof v !== 'number') throw new Error('TYPE_ERROR');
        prod *= v;
      }
      return prod;
    }
    case 'DIVIDE': {
      const a = evaluateAst(expr.dividend, env);
      const b = evaluateAst(expr.divisor, env);
      if (typeof a !== 'number' || typeof b !== 'number') throw new Error('TYPE_ERROR');
      if (b === 0) throw new Error('DIV_ZERO');
      return roundNumber(a / b, expr.scale, expr.rounding);
    }
    case 'ROUND': {
      const v = evaluateAst(expr.value, env);
      if (typeof v !== 'number') throw new Error('TYPE_ERROR');
      return roundNumber(v, expr.scale, expr.rounding);
    }
    case 'MIN': {
      const nums = expr.operands.map((o) => evaluateAst(o, env));
      if (nums.some((n) => typeof n !== 'number')) throw new Error('TYPE_ERROR');
      return Math.min(...(nums as number[]));
    }
    case 'MAX': {
      const nums = expr.operands.map((o) => evaluateAst(o, env));
      if (nums.some((n) => typeof n !== 'number')) throw new Error('TYPE_ERROR');
      return Math.max(...(nums as number[]));
    }
    case 'COALESCE': {
      for (const op of expr.operands) {
        const v = evaluateAst(op, env);
        if (v !== null) return v;
      }
      return null;
    }
    case 'CONCAT':
      return expr.operands
        .map((op) => {
          const v = evaluateAst(op, env);
          return v === null ? '' : String(v);
        })
        .join('');
    case 'ABS': {
      const v = evaluateAst(expr.value, env);
      if (typeof v !== 'number') throw new Error('TYPE_ERROR');
      return Math.abs(v);
    }
    case 'NEGATE': {
      const v = evaluateAst(expr.value, env);
      if (typeof v !== 'number') throw new Error('TYPE_ERROR');
      return -v;
    }
    case 'IS_NULL':
      return evaluateAst(expr.value, env) === null;
    case 'TRIM': {
      const v = evaluateAst(expr.value, env);
      if (v === null) return null;
      return String(v).trim();
    }
    case 'DATE_ADD_DAYS': {
      const d = evaluateAst(expr.date, env);
      const days = evaluateAst(expr.days, env);
      if (typeof d !== 'string' || typeof days !== 'number') throw new Error('TYPE_ERROR');
      const parsed = new Date(`${d}T00:00:00.000Z`);
      if (Number.isNaN(parsed.getTime())) throw new Error('TYPE_ERROR');
      parsed.setUTCDate(parsed.getUTCDate() + Math.trunc(days));
      return parsed.toISOString().slice(0, 10);
    }
    case 'DATE_DIFF_DAYS': {
      const l = evaluateAst(expr.left, env);
      const r = evaluateAst(expr.right, env);
      if (typeof l !== 'string' || typeof r !== 'string') throw new Error('TYPE_ERROR');
      const dl = Date.parse(`${l}T00:00:00.000Z`);
      const dr = Date.parse(`${r}T00:00:00.000Z`);
      if (Number.isNaN(dl) || Number.isNaN(dr)) throw new Error('TYPE_ERROR');
      return Math.round((dl - dr) / 86_400_000);
    }
    case 'COMPARE': {
      const l = evaluateAst(expr.left, env);
      const r = evaluateAst(expr.right, env);
      if (l === null || r === null) {
        return expr.operator === 'EQ' ? l === r : expr.operator === 'NE' ? l !== r : false;
      }
      switch (expr.operator) {
        case 'EQ':
          return typeof l === 'number' && typeof r === 'number' ? Math.abs(l - r) < 1e-9 : l === r;
        case 'NE':
          return typeof l === 'number' && typeof r === 'number' ? Math.abs(l - r) >= 1e-9 : l !== r;
        case 'LT':
          return l < r;
        case 'LTE':
          return l <= r;
        case 'GT':
          return l > r;
        case 'GTE':
          return l >= r;
      }
    }
    case 'IF': {
      const cond = evaluateAst(expr.condition, env);
      return evaluateAst(cond ? expr.whenTrue : expr.whenFalse, env);
    }
    default:
      throw new Error('UNSUPPORTED_NODE');
  }
}

function valuesMatch(actual: EvalScalar, expected: FunctionValue): boolean {
  if (expected.kind === 'NULL') return actual === null;
  if (actual === null) return false;
  switch (expected.kind) {
    case 'DECIMAL': {
      const expNum = Number(expected.value);
      return typeof actual === 'number' && Number.isFinite(expNum) && Math.abs(actual - expNum) < 1e-9;
    }
    case 'STRING':
    case 'DATE':
      return actual === expected.value;
    case 'BOOLEAN':
      return actual === expected.value;
  }
}

function validateWorkingBodyShape(working: FunctionWorkingBody): void {
  if (working.numericPolicy !== FUNCTION_NUMERIC_POLICY) {
    throw new TemplateApiError(422, 'FUNCTION_DEFINITION_INVALID');
  }
  const trimmedName = working.name.trim();
  if (!trimmedName || trimmedName.length > 200) {
    throw new TemplateApiError(422, 'FUNCTION_DEFINITION_INVALID');
  }
  if (working.description !== undefined && working.description.length > 1000) {
    throw new TemplateApiError(422, 'FUNCTION_DEFINITION_INVALID');
  }
  if (working.parameters.length < 1 || working.parameters.length > FUNCTION_MAX_PARAMETERS) {
    throw new TemplateApiError(422, 'FUNCTION_DEFINITION_INVALID');
  }
  const seenParams = new Set<string>();
  for (const p of working.parameters) {
    if (!FUNCTION_PARAM_NAME_RE.test(p.name) || seenParams.has(p.name)) {
      throw new TemplateApiError(422, 'FUNCTION_DEFINITION_INVALID');
    }
    seenParams.add(p.name);
    if (p.type !== 'DECIMAL' && p.dimension !== 'SCALAR') {
      throw new TemplateApiError(422, 'FUNCTION_ARGUMENT_TYPE_MISMATCH');
    }
  }
  if (working.result.type !== 'DECIMAL' && working.result.dimension !== 'SCALAR') {
    throw new TemplateApiError(422, 'FUNCTION_ARGUMENT_TYPE_MISMATCH');
  }
  if (working.tests.length > FUNCTION_MAX_TESTS) {
    throw new TemplateApiError(422, 'FUNCTION_LIMIT_EXCEEDED');
  }
  if (new TextEncoder().encode(JSON.stringify(working)).length > FUNCTION_MAX_BODY_BYTES) {
    throw new TemplateApiError(422, 'FUNCTION_LIMIT_EXCEEDED');
  }
}

function runValidationChecks(
  stored: StoredFunction,
): { issues: FunctionValidationIssue[]; testResults: FunctionTestResultDto[] } {
  const working = stored.detail.working!;
  const issues: FunctionValidationIssue[] = [];
  const paramMap = new Map<string, FunctionParameter>(working.parameters.map((p) => [p.name, p]));
  const paramNames = new Set(paramMap.keys());
  const ownVersionIds = new Set(stored.versions.map((v) => v.id));

  if (new TextEncoder().encode(JSON.stringify(working)).length > FUNCTION_MAX_BODY_BYTES) {
    issues.push({ severity: 'ERROR', code: 'FUNCTION_LIMIT_EXCEEDED', path: 'working' });
  }

  const astReport = inspectAst(working.expression, paramNames, ownVersionIds, 1);
  issues.push(...astReport.issues);
  if (astReport.nodes > 100) {
    issues.push({ severity: 'ERROR', code: 'FUNCTION_LIMIT_EXCEEDED', path: 'expression' });
  }

  if (working.tests.length < 1) {
    issues.push({ severity: 'ERROR', code: 'FUNCTION_TEST_PROOF_INVALID', path: 'tests' });
  }

  const testResults: FunctionTestResultDto[] = working.tests.map((test: FunctionTestCase) => {
    const testIssues: string[] = [];
    if (!test.name.trim() || test.name.trim().length > 100) {
      testIssues.push('FUNCTION_DEFINITION_INVALID');
    }

    const env = new Map<string, EvalScalar>();
    for (const param of working.parameters) {
      const arg = test.arguments.find((a) => a.name === param.name);
      if (!arg) {
        testIssues.push('FUNCTION_ARGUMENT_TYPE_MISMATCH');
        continue;
      }
      if (arg.value.kind === 'NULL') {
        if (!param.nullable) {
          testIssues.push('FUNCTION_ARGUMENT_TYPE_MISMATCH');
        }
        env.set(param.name, null);
        continue;
      }
      if (arg.value.kind !== param.type) {
        testIssues.push('FUNCTION_ARGUMENT_TYPE_MISMATCH');
        continue;
      }
      if (arg.value.kind === 'DECIMAL' && !FUNCTION_DECIMAL_RE.test(arg.value.value.trim())) {
        testIssues.push('FUNCTION_ARGUMENT_TYPE_MISMATCH');
        continue;
      }
      env.set(param.name, functionValueToEval(arg.value));
    }

    if (test.expected.kind === 'NULL') {
      if (!working.result.nullable) {
        testIssues.push('FUNCTION_ARGUMENT_TYPE_MISMATCH');
      }
    } else if (test.expected.kind !== working.result.type) {
      testIssues.push('FUNCTION_ARGUMENT_TYPE_MISMATCH');
    } else if (test.expected.kind === 'DECIMAL' && !FUNCTION_DECIMAL_RE.test(test.expected.value.trim())) {
      testIssues.push('FUNCTION_ARGUMENT_TYPE_MISMATCH');
    }

    if (testIssues.length === 0) {
      try {
        const result = evaluateAst(working.expression, env);
        if (!valuesMatch(result, test.expected)) {
          testIssues.push('FUNCTION_TEST_MISMATCH');
        }
      } catch {
        testIssues.push('FUNCTION_VALIDATION_FAILED');
      }
    }

    for (const code of testIssues) {
      issues.push({ severity: 'ERROR', code, testId: test.id });
    }

    return {
      testId: test.id,
      state: testIssues.length === 0 ? 'PASSED' : 'FAILED',
      issueCodes: Array.from(new Set(testIssues)),
    };
  });

  return { issues, testResults };
}

function findFunctionOrThrow(id: string): StoredFunction {
  const found = STORE.functions.find((item) => item.detail.id === id);
  if (!found) {
    throw new TemplateApiError(404, 'CORE.TEMPLATE.NOT_FOUND');
  }
  return found;
}

export async function fakeListFunctions(query: FunctionsListQuery = {}): Promise<FunctionCursorPage<FunctionSummaryDto>> {
  await fakeDelay();
  let items = STORE.functions.map((entry) => entry.detail);

  if (query.scopeType) {
    items = items.filter((item) => item.scope.scopeType === query.scopeType);
  }
  if (query.companyId) {
    items = items.filter((item) => item.scope.scopeType === 'COMPANY' && item.scope.companyId === query.companyId);
  }
  if (query.status) {
    items = items.filter((item) => item.status === query.status);
  }
  if (query.code?.trim()) {
    const codeUpper = query.code.trim().toUpperCase();
    items = items.filter((item) => item.code === codeUpper);
  }
  if (query.name?.trim()) {
    const needle = query.name.trim().toLowerCase();
    items = items.filter(
      (item) => item.name.toLowerCase().includes(needle) || item.code.toLowerCase().includes(needle),
    );
  }

  const sorted = [...items].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return paginate(sorted.map(toSummary), query.cursor, query.limit);
}

export async function fakeCreateFunction(
  body: CreateFunctionRequestDto,
  idempotencyKey: string,
): Promise<FunctionDetailDto> {
  await fakeDelay();
  const idemKey = `create-fn:${idempotencyKey}`;
  if (STORE.idempotency.has(idemKey)) {
    return clone(STORE.idempotency.get(idemKey) as FunctionDetailDto);
  }

  const normalizedCode = body.code.trim().toUpperCase();
  if (!FUNCTION_CODE_RE.test(normalizedCode)) {
    throw new TemplateApiError(422, 'FUNCTION_DEFINITION_INVALID');
  }
  if (STORE.functions.some((f) => f.detail.code === normalizedCode)) {
    throw new TemplateApiError(409, 'FUNCTION_CODE_CONFLICT');
  }
  if (body.scope.scopeType === 'COMPANY' && !body.scope.companyId.trim()) {
    throw new TemplateApiError(422, 'FUNCTION_SCOPE_MISMATCH');
  }

  validateWorkingBodyShape(body.working);

  const now = new Date().toISOString();
  const working: FunctionWorkingBody = clone(body.working);
  working.name = working.name.trim();
  if (working.description !== undefined) {
    const trimmed = working.description.trim();
    working.description = trimmed || undefined;
  }

  const detail: FunctionDetailDto = {
    id: uuidv7(),
    code: normalizedCode,
    name: working.name,
    description: working.description ?? null,
    scope: clone(body.scope),
    status: 'ACTIVE',
    revision: 1,
    etag: '"1"',
    publishedVersionId: null,
    createdAt: now,
    updatedAt: now,
    working,
    validation: null,
  };

  STORE.functions.unshift({ detail, versions: [], usage: [] });
  const copy = clone(detail);
  STORE.idempotency.set(idemKey, copy);
  return clone(copy);
}

export async function fakeGetFunction(functionId: string): Promise<FunctionDetailDto> {
  await fakeDelay();
  const found = findFunctionOrThrow(functionId);
  return clone(found.detail);
}

export async function fakePatchFunction(
  functionId: string,
  body: PatchFunctionRequestDto,
  ifMatch: string,
  idempotencyKey: string,
): Promise<FunctionDetailDto> {
  await fakeDelay();
  const idemKey = `patch-fn:${functionId}:${ifMatch}:${idempotencyKey}`;
  if (STORE.idempotency.has(idemKey)) {
    return clone(STORE.idempotency.get(idemKey) as FunctionDetailDto);
  }

  const stored = findFunctionOrThrow(functionId);
  const expectedRev = parseIfMatchRevision(ifMatch);
  if (expectedRev !== stored.detail.revision) {
    throw new TemplateApiError(412, 'CORE.TEMPLATE.CONCURRENCY.STALE_REVISION');
  }
  if (stored.detail.status === 'ARCHIVED') {
    throw new TemplateApiError(409, 'FUNCTION_ARCHIVED');
  }

  validateWorkingBodyShape(body.working);

  const working: FunctionWorkingBody = clone(body.working);
  working.name = working.name.trim();
  if (working.description !== undefined) {
    const trimmed = working.description.trim();
    working.description = trimmed || undefined;
  }

  stored.detail.working = working;
  stored.detail.name = working.name;
  stored.detail.description = working.description ?? null;
  stored.detail.revision += 1;
  stored.detail.etag = `"${stored.detail.revision}"`;
  stored.detail.updatedAt = new Date().toISOString();
  stored.detail.validation = null;

  const copy = clone(stored.detail);
  STORE.idempotency.set(idemKey, copy);
  return clone(copy);
}

export async function fakeValidateFunction(
  functionId: string,
  body: ValidateFunctionRequestDto,
  ifMatch: string,
): Promise<ValidateFunctionResponseDto> {
  await fakeDelay();
  const stored = findFunctionOrThrow(functionId);
  const expectedRev = parseIfMatchRevision(ifMatch);
  if (expectedRev !== body.revision) {
    throw new TemplateApiError(400, 'FUNCTION_DEFINITION_INVALID');
  }
  if (expectedRev !== stored.detail.revision) {
    throw new TemplateApiError(412, 'CORE.TEMPLATE.CONCURRENCY.STALE_REVISION');
  }
  if (stored.detail.status === 'ARCHIVED') {
    throw new TemplateApiError(409, 'FUNCTION_ARCHIVED');
  }
  if (!stored.detail.working) {
    throw new TemplateApiError(422, 'FUNCTION_DEFINITION_INVALID');
  }

  const { issues, testResults } = runValidationChecks(stored);
  const hasErrors = issues.some((issue) => issue.severity === 'ERROR');
  const state = hasErrors ? 'FAILED' : 'PASSED';
  const validationId = uuidv7();
  const validatedAt = new Date().toISOString();
  const contentChecksum = computeContentChecksum(stored.detail.working);
  const dependencyChecksum = computeDependencyChecksum(stored.detail.working);

  stored.detail.validation = {
    id: validationId,
    state,
    contentChecksum,
    dependencyChecksum,
    validatedAt,
  };

  return clone({
    functionId: stored.detail.id,
    revision: stored.detail.revision,
    validationId,
    state,
    contentChecksum,
    dependencyChecksum,
    issues,
    testResults,
    validatedAt,
  });
}

export async function fakePublishFunction(
  functionId: string,
  body: PublishFunctionRequestDto,
  ifMatch: string,
  idempotencyKey: string,
): Promise<FunctionVersionDetailDto> {
  await fakeDelay();
  const idemKey = `publish-fn:${functionId}:${ifMatch}:${idempotencyKey}`;
  if (STORE.idempotency.has(idemKey)) {
    return clone(STORE.idempotency.get(idemKey) as FunctionVersionDetailDto);
  }

  const stored = findFunctionOrThrow(functionId);
  const expectedRev = parseIfMatchRevision(ifMatch);
  if (expectedRev !== body.revision) {
    throw new TemplateApiError(400, 'FUNCTION_DEFINITION_INVALID');
  }
  if (expectedRev !== stored.detail.revision) {
    throw new TemplateApiError(412, 'CORE.TEMPLATE.CONCURRENCY.STALE_REVISION');
  }
  if (stored.detail.status === 'ARCHIVED') {
    throw new TemplateApiError(409, 'FUNCTION_ARCHIVED');
  }
  const changeNote = body.changeNote.trim();
  if (!changeNote || changeNote.length > 1000) {
    throw new TemplateApiError(422, 'FUNCTION_DEFINITION_INVALID');
  }
  const working = stored.detail.working;
  if (!working || working.tests.length < 1) {
    throw new TemplateApiError(422, 'FUNCTION_TEST_PROOF_INVALID');
  }
  const val = stored.detail.validation;
  if (
    !val ||
    val.id !== body.validationId ||
    val.contentChecksum !== body.contentChecksum ||
    val.dependencyChecksum !== body.dependencyChecksum
  ) {
    throw new TemplateApiError(409, 'FUNCTION_VALIDATION_STALE');
  }
  const ageMs = Date.now() - Date.parse(val.validatedAt);
  if (Number.isNaN(ageMs) || ageMs > FUNCTION_VALIDATION_TTL_MS) {
    throw new TemplateApiError(409, 'FUNCTION_VALIDATION_STALE');
  }
  if (val.state !== 'PASSED') {
    throw new TemplateApiError(422, 'FUNCTION_VALIDATION_FAILED');
  }

  const nextVersionNumber = stored.versions.reduce((max, v) => Math.max(max, v.versionNumber), 0) + 1;
  const now = new Date().toISOString();
  const depIds = new Set<string>();
  collectDependencyVersionIds(working.expression, depIds);

  const version: FunctionVersionDetailDto = {
    id: uuidv7(),
    functionId: stored.detail.id,
    versionNumber: nextVersionNumber,
    contentChecksum: val.contentChecksum,
    publishedAt: now,
    publishedBy: AUTHOR_USER,
    changeNote,
    parameters: clone(working.parameters),
    result: clone(working.result),
    expression: clone(working.expression),
    dependencies: Array.from(depIds).map((id) => ({
      functionVersionId: id,
      contentChecksum: pseudoSha256(id),
    })),
    testProof: {
      validationId: val.id,
      passedCount: working.tests.length,
      totalCount: working.tests.length,
      checksum: pseudoSha256(`proof:${val.id}:${working.tests.length}`),
    },
    packagePins: {
      templateSchemaVersion: '1.0.0',
      templateEngineVersion: '1.2.0',
    },
  };

  stored.versions.unshift(version);
  stored.detail.publishedVersionId = version.id;
  stored.detail.revision += 1;
  stored.detail.etag = `"${stored.detail.revision}"`;
  stored.detail.updatedAt = now;

  const copy = clone(version);
  STORE.idempotency.set(idemKey, copy);
  return clone(copy);
}

export async function fakeArchiveFunction(
  functionId: string,
  body: ArchiveOrRestoreFunctionRequestDto,
  ifMatch: string,
  idempotencyKey: string,
): Promise<FunctionDetailDto> {
  await fakeDelay();
  const idemKey = `archive-fn:${functionId}:${ifMatch}:${idempotencyKey}`;
  if (STORE.idempotency.has(idemKey)) {
    return clone(STORE.idempotency.get(idemKey) as FunctionDetailDto);
  }

  const stored = findFunctionOrThrow(functionId);
  const expectedRev = parseIfMatchRevision(ifMatch);
  if (expectedRev !== stored.detail.revision) {
    throw new TemplateApiError(412, 'CORE.TEMPLATE.CONCURRENCY.STALE_REVISION');
  }
  if (!body.reason.trim() || body.reason.trim().length > 1000) {
    throw new TemplateApiError(422, 'FUNCTION_DEFINITION_INVALID');
  }
  if (stored.detail.status === 'ARCHIVED') {
    throw new TemplateApiError(409, 'FUNCTION_ARCHIVED');
  }

  stored.detail.status = 'ARCHIVED';
  stored.detail.revision += 1;
  stored.detail.etag = `"${stored.detail.revision}"`;
  stored.detail.updatedAt = new Date().toISOString();

  const copy = clone(stored.detail);
  STORE.idempotency.set(idemKey, copy);
  return clone(copy);
}

export async function fakeRestoreFunction(
  functionId: string,
  body: ArchiveOrRestoreFunctionRequestDto,
  ifMatch: string,
  idempotencyKey: string,
): Promise<FunctionDetailDto> {
  await fakeDelay();
  const idemKey = `restore-fn:${functionId}:${ifMatch}:${idempotencyKey}`;
  if (STORE.idempotency.has(idemKey)) {
    return clone(STORE.idempotency.get(idemKey) as FunctionDetailDto);
  }

  const stored = findFunctionOrThrow(functionId);
  const expectedRev = parseIfMatchRevision(ifMatch);
  if (expectedRev !== stored.detail.revision) {
    throw new TemplateApiError(412, 'CORE.TEMPLATE.CONCURRENCY.STALE_REVISION');
  }
  if (!body.reason.trim() || body.reason.trim().length > 1000) {
    throw new TemplateApiError(422, 'FUNCTION_DEFINITION_INVALID');
  }
  if (stored.detail.status !== 'ARCHIVED') {
    throw new TemplateApiError(409, 'FUNCTION_NOT_ARCHIVED');
  }

  stored.detail.status = 'ACTIVE';
  stored.detail.revision += 1;
  stored.detail.etag = `"${stored.detail.revision}"`;
  stored.detail.updatedAt = new Date().toISOString();

  const copy = clone(stored.detail);
  STORE.idempotency.set(idemKey, copy);
  return clone(copy);
}

export async function fakeListFunctionVersions(
  functionId: string,
  query: FunctionVersionsQuery = {},
): Promise<FunctionCursorPage<FunctionVersionSummaryDto>> {
  await fakeDelay();
  const stored = findFunctionOrThrow(functionId);
  const summaries: FunctionVersionSummaryDto[] = [...stored.versions]
    .sort((a, b) => b.versionNumber - a.versionNumber)
    .map((v) => ({
      id: v.id,
      functionId: v.functionId,
      versionNumber: v.versionNumber,
      contentChecksum: v.contentChecksum,
      publishedAt: v.publishedAt,
      publishedBy: clone(v.publishedBy),
      changeNote: v.changeNote,
    }));
  return paginate(summaries, query.cursor, query.limit);
}

export async function fakeGetFunctionVersion(
  functionId: string,
  versionId: string,
): Promise<FunctionVersionDetailDto> {
  await fakeDelay(100);
  const stored = findFunctionOrThrow(functionId);
  const version = stored.versions.find((v) => v.id === versionId);
  if (!version) {
    throw new TemplateApiError(404, 'CORE.TEMPLATE.NOT_FOUND');
  }
  return clone(version);
}

export async function fakeListFunctionUsage(
  functionId: string,
  query: FunctionUsageQuery = {},
): Promise<FunctionCursorPage<FunctionUsageItemDto>> {
  await fakeDelay();
  const stored = findFunctionOrThrow(functionId);
  let items = [...stored.usage];
  if (query.versionId) {
    items = items.filter((u) => u.functionVersionId === query.versionId);
  }
  return paginate(items, query.cursor, query.limit);
}

function buildComparisonValues(
  version: FunctionVersionDetailDto,
  targetIndex: number,
): FunctionImpactComparisonDto[] {
  const sampleMoneyPrev = ['12500.000', '7800.000'][targetIndex % 2];
  const sampleMoneyNext = ['11875.000', '7410.000'][targetIndex % 2];

  const makeValue = (raw: string, proposed: boolean): FunctionValue => {
    switch (version.result.type) {
      case 'DECIMAL':
        if (version.result.dimension === 'MONEY') {
          return {
            kind: 'DECIMAL',
            value: proposed ? sampleMoneyNext : sampleMoneyPrev,
            dimension: 'MONEY',
            currencyCode: 'EGP',
          };
        }
        return {
          kind: 'DECIMAL',
          value: proposed ? '118.75' : '125',
          dimension: version.result.dimension,
        };
      case 'STRING':
        return { kind: 'STRING', value: proposed ? `${raw} (v${version.versionNumber})` : raw };
      case 'BOOLEAN':
        return { kind: 'BOOLEAN', value: proposed };
      case 'DATE':
        return { kind: 'DATE', value: proposed ? '2026-12-04' : '2026-11-04' };
    }
  };

  return [
    {
      nodeId: `01948100-0000-7000-8000-00000000401${targetIndex + 1}`,
      formulaId: `01948100-0000-7000-8000-00000000900${targetIndex + 1}`,
      previous: makeValue('Previous', false),
      proposed: makeValue('Proposed', true),
    },
    {
      nodeId: `01948100-0000-7000-8000-00000000402${targetIndex + 1}`,
      formulaId: `01948100-0000-7000-8000-00000000901${targetIndex + 1}`,
      previous: makeValue('Subtotal', false),
      proposed: makeValue('Subtotal', true),
    },
  ];
}

export async function fakeCheckFunctionImpact(
  functionId: string,
  body: FunctionImpactRequestDto,
  idempotencyKey: string,
): Promise<FunctionImpactResponseDto> {
  await fakeDelay(220);
  const idemKey = `impact-fn:${functionId}:${idempotencyKey}`;
  if (STORE.idempotency.has(idemKey)) {
    return clone(STORE.idempotency.get(idemKey) as FunctionImpactResponseDto);
  }

  const stored = findFunctionOrThrow(functionId);
  const version = stored.versions.find((v) => v.id === body.versionId);
  if (!version) {
    throw new TemplateApiError(404, 'CORE.TEMPLATE.NOT_FOUND');
  }
  if (body.targets.length < 1 || body.targets.length > FUNCTION_MAX_IMPACT_TARGETS) {
    throw new TemplateApiError(422, 'FUNCTION_LIMIT_EXCEEDED');
  }

  const snapshots = new Map<string, number>();
  const targetResults: FunctionImpactTargetResultDto[] = body.targets.map((target, index) => {
    const usageRow = stored.usage.find(
      (u) => u.sourceKind === 'DRAFT' && u.templateId === target.templateId,
    );
    if (!usageRow) {
      throw new TemplateApiError(422, 'FUNCTION_NOT_REFERENCED');
    }
    if (usageRow.revisionOrVersionNumber !== target.draftRevision) {
      throw new TemplateApiError(409, 'FUNCTION_IMPACT_STALE');
    }
    snapshots.set(target.templateId, usageRow.revisionOrVersionNumber);

    const comparisons = buildComparisonValues(version, index);
    return {
      templateId: target.templateId,
      draftRevision: target.draftRevision,
      contentChecksum: pseudoSha256(`draft:${target.templateId}:${target.draftRevision}`),
      fixtureKey: target.fixtureKey,
      fixtureChecksum: pseudoSha256(`fixture:${target.fixtureKey}`),
      previousVersionIds: [usageRow.functionVersionId],
      proposedVersionId: version.id,
      state: 'PASSED',
      comparisons,
      totalComparisons: index === 0 ? 24 : comparisons.length,
      truncated: index === 0,
      issueCodes: [],
    };
  });

  const now = new Date();
  const expiresAt = new Date(now.getTime() + FUNCTION_IMPACT_TTL_MS).toISOString();
  const impactId = uuidv7();

  const response: FunctionImpactResponseDto = {
    impactId,
    functionId: stored.detail.id,
    versionId: version.id,
    createdAt: now.toISOString(),
    expiresAt,
    checksum: pseudoSha256(`impact:${impactId}:${version.id}`),
    state: 'PASSED',
    targets: targetResults,
  };

  STORE.impacts.set(impactId, {
    response: clone(response),
    consumed: false,
    snapshots,
  });

  const copy = clone(response);
  STORE.idempotency.set(idemKey, copy);
  return clone(copy);
}

export async function fakeApplyFunctionToDrafts(
  functionId: string,
  body: ApplyFunctionToDraftsRequestDto,
  idempotencyKey: string,
): Promise<ApplyFunctionToDraftsResponseDto> {
  await fakeDelay(200);
  const idemKey = `apply-fn:${functionId}:${idempotencyKey}`;
  if (STORE.idempotency.has(idemKey)) {
    return clone(STORE.idempotency.get(idemKey) as ApplyFunctionToDraftsResponseDto);
  }

  const stored = findFunctionOrThrow(functionId);
  const version = stored.versions.find((v) => v.id === body.versionId);
  if (!version) {
    throw new TemplateApiError(404, 'CORE.TEMPLATE.NOT_FOUND');
  }
  const reason = body.reason.trim();
  if (!reason || reason.length > 1000) {
    throw new TemplateApiError(422, 'FUNCTION_DEFINITION_INVALID');
  }
  if (body.targets.length < 1 || body.targets.length > FUNCTION_MAX_IMPACT_TARGETS) {
    throw new TemplateApiError(422, 'FUNCTION_LIMIT_EXCEEDED');
  }

  const impact = STORE.impacts.get(body.impactId);
  if (!impact || impact.consumed || impact.response.functionId !== functionId || impact.response.versionId !== body.versionId) {
    throw new TemplateApiError(409, 'FUNCTION_IMPACT_STALE');
  }
  if (Date.now() > Date.parse(impact.response.expiresAt)) {
    throw new TemplateApiError(409, 'FUNCTION_IMPACT_STALE');
  }

  // Verify all-or-none preconditions before mutating any draft usage.
  for (const target of body.targets) {
    const usageRow = stored.usage.find(
      (u) => u.sourceKind === 'DRAFT' && u.templateId === target.templateId,
    );
    const snappedRev = impact.snapshots.get(target.templateId);
    if (!usageRow || snappedRev === undefined || usageRow.revisionOrVersionNumber !== target.draftRevision) {
      throw new TemplateApiError(409, 'FUNCTION_IMPACT_STALE');
    }
  }

  const updated = body.targets.map((target) => {
    const usageRow = stored.usage.find(
      (u) => u.sourceKind === 'DRAFT' && u.templateId === target.templateId,
    )!;
    usageRow.revisionOrVersionNumber += 1;
    usageRow.functionVersionId = version.id;
    return {
      templateId: target.templateId,
      draftRevision: usageRow.revisionOrVersionNumber,
      contentChecksum: pseudoSha256(`updated-draft:${target.templateId}:${usageRow.revisionOrVersionNumber}`),
      validationState: 'STALE' as const,
    };
  });

  impact.consumed = true;

  const response: ApplyFunctionToDraftsResponseDto = {
    functionId: stored.detail.id,
    versionId: version.id,
    updated,
  };
  STORE.idempotency.set(idemKey, clone(response));
  return clone(response);
}

/* ------------------------------------------------------------------ */
/* Editor context (POST templates/functions/editor-context)            */
/* ------------------------------------------------------------------ */

const EDITOR_CONTEXT_KEYS = [
  'templateId',
  'expectedDraftRevision',
  'expectedContentChecksum',
  'expectedOwnerContextFingerprint',
  'functionVersionIds',
  'currencyCodes',
  'unitCodes',
] as const;
const UUID_V7_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const SHA256_RE = /^[0-9a-f]{64}$/;
// eslint-disable-next-line no-control-regex -- unit codes deny control characters, as in the backend DTO
const EDITOR_UNIT_RE = /^[^\u0000-\u001F\u007F]{1,200}$/;
/** Fake owner authority: active currencies and units the caller may use. */
const FAKE_ACTIVE_CURRENCIES = new Set(['EGP', 'USD', 'EUR', 'SAR', 'AED']);
const FAKE_AUTHORIZED_UNITS = new Set(['PCS', 'BOX', 'KG', 'M', 'L', 'HOUR']);

function normalizeEditorContextList(values: unknown, max: number, valid: (value: string) => boolean): string[] {
  if (
    !Array.isArray(values) ||
    values.length > max ||
    values.some((value) => typeof value !== 'string' || !valid(value)) ||
    new Set(values).size !== values.length
  ) {
    throw new TemplateApiError(400, 'CORE.TEMPLATE.SCHEMA.INVALID');
  }
  return [...(values as string[])].sort();
}

/** Mirrors normalizeEditorContextRequest: a closed body with canonical, bounded, unique lists. */
function normalizeEditorContextRequest(input: FunctionEditorContextRequestDto): FunctionEditorContextRequestDto {
  const record = input as unknown as Record<string, unknown>;
  if (
    !input ||
    typeof input !== 'object' ||
    Object.keys(record).length !== EDITOR_CONTEXT_KEYS.length ||
    EDITOR_CONTEXT_KEYS.some((key) => !Object.hasOwn(record, key)) ||
    typeof input.templateId !== 'string' ||
    !UUID_V7_RE.test(input.templateId) ||
    !Number.isSafeInteger(input.expectedDraftRevision) ||
    input.expectedDraftRevision < 1 ||
    input.expectedDraftRevision > 2_147_483_647 ||
    !SHA256_RE.test(input.expectedContentChecksum ?? '') ||
    !SHA256_RE.test(input.expectedOwnerContextFingerprint ?? '')
  ) {
    throw new TemplateApiError(400, 'CORE.TEMPLATE.SCHEMA.INVALID');
  }
  return {
    templateId: input.templateId,
    expectedDraftRevision: input.expectedDraftRevision,
    expectedContentChecksum: input.expectedContentChecksum,
    expectedOwnerContextFingerprint: input.expectedOwnerContextFingerprint,
    functionVersionIds: normalizeEditorContextList(input.functionVersionIds, FUNCTION_EDITOR_CONTEXT_MAX_VERSIONS, (v) =>
      UUID_V7_RE.test(v),
    ),
    currencyCodes: normalizeEditorContextList(input.currencyCodes, FUNCTION_EDITOR_CONTEXT_MAX_CODES, (v) =>
      /^[A-Z]{3}$/.test(v),
    ),
    unitCodes: normalizeEditorContextList(
      input.unitCodes,
      FUNCTION_EDITOR_CONTEXT_MAX_CODES,
      (v) => EDITOR_UNIT_RE.test(v) && v.normalize('NFC') === v,
    ),
  };
}

function findVersionById(versionId: string): { stored: StoredFunction; version: FunctionVersionDetailDto } | null {
  for (const stored of STORE.functions) {
    const version = stored.versions.find((item) => item.id === versionId);
    if (version) return { stored, version };
  }
  return null;
}

/** Closed dependency graph of the root versions (active functions only), sorted by id. */
function resolveEditorContextVersions(roots: readonly string[]): FunctionEditorContextVersion[] {
  const out = new Map<string, FunctionEditorContextVersion>();
  const queue = [...roots];
  while (queue.length > 0) {
    const id = queue.shift() as string;
    if (out.has(id)) continue;
    const found = findVersionById(id);
    if (!found) throw new TemplateApiError(404, 'CORE.TEMPLATE.NOT_FOUND');
    if (found.stored.detail.status !== 'ACTIVE') {
      throw new TemplateApiError(422, 'FUNCTION_ARCHIVED');
    }
    const { version, stored } = found;
    out.set(id, {
      id: version.id,
      functionId: version.functionId,
      versionNumber: version.versionNumber,
      definition: {
        numericPolicy: FUNCTION_NUMERIC_POLICY,
        name: stored.detail.name,
        ...(stored.detail.description ? { description: stored.detail.description } : {}),
        parameters: clone(version.parameters),
        result: clone(version.result),
        expression: clone(version.expression),
        tests: [],
      },
      contentChecksum: version.contentChecksum,
      dependencies: clone(version.dependencies),
      testProof: clone(version.testProof),
      packagePins: clone(version.packagePins),
    });
    for (const dep of version.dependencies) queue.push(dep.functionVersionId);
    if (out.size > FUNCTION_EDITOR_CONTEXT_MAX_VERSIONS) {
      throw new TemplateApiError(422, 'FUNCTION_LIMIT_EXCEEDED');
    }
  }
  return [...out.values()].sort((a, b) => a.id.localeCompare(b.id));
}

/**
 * Mirrors TemplateFunctionsService.getEditorContext: pins the persisted draft
 * (revision + content checksum) and owner context fingerprint, resolves the closed
 * function graph and identity membership, and issues a context valid for 30 seconds.
 */
export async function fakeGetFunctionEditorContext(
  input: FunctionEditorContextRequestDto,
): Promise<FunctionEditorContextResponseDto> {
  await fakeDelay();
  const request = normalizeEditorContextRequest(input);
  const definition = await getTemplate(request.templateId);
  if (definition.lifecycleStatus === 'ARCHIVED') {
    throw new TemplateApiError(409, 'CORE.TEMPLATE.DEFINITION.ARCHIVED');
  }
  if (definition.systemProtected) {
    throw new TemplateApiError(422, 'CORE.TEMPLATE.DEFINITION.SYSTEM_PROTECTED');
  }
  const draft = await getDraft(request.templateId);
  if (draft.revision !== request.expectedDraftRevision || draft.contentChecksum !== request.expectedContentChecksum) {
    throw new TemplateApiError(412, 'CORE.TEMPLATE.CONCURRENCY.STALE_REVISION');
  }
  const schema = await getDataSourceSchema(definition.dataSourceKey, {
    scopeType: definition.scope.type,
    companyId: definition.scope.type === 'COMPANY' ? definition.scope.companyId : undefined,
    schemaVersion: definition.dataSourceSchemaVersion === 2 ? 2 : 1,
  });
  const ownerContext = schema.ownerContext;
  if (!ownerContext) throw new TemplateApiError(503, 'CORE.TEMPLATE.DEPENDENCY.UNAVAILABLE');
  if (ownerContext.fingerprint !== request.expectedOwnerContextFingerprint) {
    throw new TemplateApiError(412, 'CORE.TEMPLATE.CONCURRENCY.STALE_REVISION');
  }

  const roots = [...new Set(request.functionVersionIds)].sort();
  const versions = resolveEditorContextVersions(roots);
  if (request.currencyCodes.some((code) => !FAKE_ACTIVE_CURRENCIES.has(code))) {
    throw new TemplateApiError(422, 'FUNCTION_DEFINITION_INVALID');
  }
  if (request.unitCodes.some((code) => !FAKE_AUTHORIZED_UNITS.has(code))) {
    throw new TemplateApiError(422, 'FUNCTION_DEFINITION_INVALID');
  }

  const executionPackagePins = {
    templateSchemaVersion: ownerContext.pins.schema.version,
    templateEngineVersion: ownerContext.pins.engine.version,
  };
  const issuedAt = new Date();
  const committed: Omit<FunctionEditorContextResponseDto, 'fingerprint'> = {
    contract: FUNCTION_EDITOR_CONTEXT_CONTRACT,
    source: {
      templateId: definition.templateId,
      draftId: draft.draftId,
      draftRevision: draft.revision,
      contentChecksum: draft.contentChecksum,
    },
    ownerContextFingerprint: ownerContext.fingerprint,
    request,
    rootFunctionVersionIds: roots,
    release: {
      qualifiedManifestSha256: pseudoSha256(`release:${ownerContext.fingerprint}`),
      executionPackagePins,
      compatibleProducerPins: [clone(executionPackagePins)],
      ownerPackagePins: clone(ownerContext.pins),
    },
    versions,
    membership: { currencyCodes: [...request.currencyCodes], unitCodes: [...request.unitCodes] },
    issuedAt: issuedAt.toISOString(),
    expiresAt: new Date(issuedAt.getTime() + FUNCTION_EDITOR_CONTEXT_TTL_MS).toISOString(),
  };
  return { ...committed, fingerprint: pseudoSha256(JSON.stringify(committed)) };
}
