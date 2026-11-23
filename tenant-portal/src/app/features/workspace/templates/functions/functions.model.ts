import type { ScopeCompany } from '../../../../core/scope/scope';
import { ApiError } from '../../../../core/api/api-errors';
import { type FormulaReadableLabels, formatFormulaReadable } from '../designer/tables/table-ops';
import type {
  TemplateAuthor,
  TemplateCursorPage,
  TemplateFormulaDimension,
  TemplateFormulaExpression,
  TemplateOwnerContextPins,
  TemplatePageInfo,
} from '../templates.model';

export const FUNCTION_NUMERIC_POLICY = 'typed-scalars-dimensions-exact256s128-v1' as const;
export const FUNCTION_VALIDATION_TTL_MS = 30 * 60 * 1000;
export const FUNCTION_IMPACT_TTL_MS = 15 * 60 * 1000;
export const FUNCTION_MAX_PARAMETERS = 16;
export const FUNCTION_MAX_TESTS = 20;
export const FUNCTION_MAX_IMPACT_TARGETS = 20;
export const FUNCTION_MAX_BODY_BYTES = 46_080;

export const FUNCTION_CODE_RE = /^[A-Z0-9][A-Z0-9_-]{0,99}$/;
export const FUNCTION_PARAM_NAME_RE = /^[a-z][A-Za-z0-9_]{0,39}$/;
export const FUNCTION_DECIMAL_RE = /^-?\d{1,30}(\.\d{1,18})?$/;

export const FUNCTION_COMPANY_NILE_ID = '01948100-0000-7000-8000-00000000c001';
export const FUNCTION_COMPANY_MTG_ID = '01948100-0000-7000-8000-00000000c002';

export type FunctionStatus = 'ACTIVE' | 'ARCHIVED';
export type FunctionScopeType = 'TENANT' | 'COMPANY';

export type FunctionScope =
  | { scopeType: 'TENANT' }
  | { scopeType: 'COMPANY'; companyId: string };

export type FunctionScalarType = 'DECIMAL' | 'STRING' | 'BOOLEAN' | 'DATE';

export interface FunctionParameter {
  name: string;
  type: FunctionScalarType;
  nullable: boolean;
  dimension: TemplateFormulaDimension;
}

export interface FunctionResultSpec {
  type: FunctionScalarType;
  nullable: boolean;
  dimension: TemplateFormulaDimension;
}

export type FunctionValue =
  | {
      kind: 'DECIMAL';
      value: string;
      dimension: TemplateFormulaDimension;
      currencyCode?: string;
      unitCode?: string;
    }
  | { kind: 'STRING'; value: string }
  | { kind: 'BOOLEAN'; value: boolean }
  | { kind: 'DATE'; value: string }
  | { kind: 'NULL' };

export interface FunctionTestArgument {
  name: string;
  value: FunctionValue;
}

export interface FunctionTestCase {
  id: string;
  name: string;
  arguments: FunctionTestArgument[];
  expected: FunctionValue;
}

export interface FunctionWorkingBody {
  numericPolicy: typeof FUNCTION_NUMERIC_POLICY;
  name: string;
  description?: string;
  parameters: FunctionParameter[];
  result: FunctionResultSpec;
  expression: TemplateFormulaExpression;
  tests: FunctionTestCase[];
}

export type FunctionValidationState = 'PASSED' | 'FAILED';

export interface FunctionValidationSummary {
  id: string;
  state: FunctionValidationState;
  contentChecksum: string;
  dependencyChecksum: string;
  validatedAt: string;
}

export interface FunctionSummaryDto {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  scope: FunctionScope;
  status: FunctionStatus;
  revision: number;
  etag: string;
  publishedVersionId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FunctionDetailDto extends FunctionSummaryDto {
  working?: FunctionWorkingBody;
  validation?: FunctionValidationSummary | null;
}

export interface FunctionValidationIssue {
  severity: 'ERROR' | 'WARNING';
  code: string;
  path?: string;
  testId?: string;
  jsonPointer?: string;
  nodeId?: string | null;
  messageKey?: string;
  params?: Record<string, never>;
}

export interface FunctionTestResultDto {
  testId: string;
  state: FunctionValidationState;
  issueCodes: string[];
}

export interface ValidateFunctionResponseDto {
  /** Response ETag; the Core validation command advances the function revision. */
  etag?: string;
  functionId: string;
  revision: number;
  validationId: string;
  state: FunctionValidationState;
  contentChecksum: string;
  dependencyChecksum: string;
  issues: FunctionValidationIssue[];
  testResults: FunctionTestResultDto[];
  validatedAt: string;
}

export interface FunctionVersionSummaryDto {
  id: string;
  functionId: string;
  versionNumber: number;
  contentChecksum: string;
  publishedAt: string;
  publishedBy: TemplateAuthor;
  changeNote: string;
}

export interface FunctionVersionDependency {
  functionVersionId: string;
  contentChecksum: string;
}

export interface FunctionVersionTestProof {
  validationId: string;
  passedCount: number;
  totalCount: number;
  checksum: string;
}

export interface FunctionVersionDetailDto extends FunctionVersionSummaryDto {
  parameters: FunctionParameter[];
  result: FunctionResultSpec;
  expression: TemplateFormulaExpression;
  dependencies: FunctionVersionDependency[];
  testProof: FunctionVersionTestProof;
  packagePins: {
    templateSchemaVersion: string;
    templateEngineVersion: string;
  };
}

export type FunctionUsageSourceKind = 'DRAFT' | 'PUBLISHED';

export interface FunctionUsageItemDto {
  templateId: string;
  templateName: string;
  sourceKind: FunctionUsageSourceKind;
  sourceId: string;
  revisionOrVersionNumber: number;
  functionVersionId: string;
}

export interface FunctionImpactTargetRequest {
  templateId: string;
  draftRevision: number;
  fixtureKey: string;
}

export interface FunctionImpactRequestDto {
  versionId: string;
  targets: FunctionImpactTargetRequest[];
}

export interface FunctionImpactComparisonDto {
  nodeId: string;
  formulaId: string;
  previous: FunctionValue;
  proposed: FunctionValue;
}

export interface FunctionImpactTargetResultDto {
  templateId: string;
  draftRevision: number;
  contentChecksum: string;
  fixtureKey: string;
  fixtureChecksum: string;
  previousVersionIds: string[];
  proposedVersionId: string;
  state: FunctionValidationState;
  comparisons: FunctionImpactComparisonDto[];
  totalComparisons: number;
  truncated: boolean;
  issueCodes: string[];
}

export interface FunctionImpactResponseDto {
  impactId: string;
  functionId: string;
  versionId: string;
  createdAt: string;
  expiresAt: string;
  checksum: string;
  state: FunctionValidationState;
  targets: FunctionImpactTargetResultDto[];
}

export interface ApplyFunctionToDraftsTarget {
  templateId: string;
  draftRevision: number;
}

export interface ApplyFunctionToDraftsRequestDto {
  versionId: string;
  impactId: string;
  targets: ApplyFunctionToDraftsTarget[];
  reason: string;
}

export interface ApplyFunctionToDraftsUpdatedItem {
  templateId: string;
  draftRevision: number;
  contentChecksum: string;
  validationState: 'STALE';
}

export interface ApplyFunctionToDraftsResponseDto {
  functionId: string;
  versionId: string;
  updated: ApplyFunctionToDraftsUpdatedItem[];
}

export interface FunctionsListQuery {
  scopeType?: FunctionScopeType;
  companyId?: string;
  code?: string;
  name?: string;
  status?: FunctionStatus;
  cursor?: string | null;
  limit?: number;
}

export interface CreateFunctionRequestDto {
  code: string;
  scope: FunctionScope;
  working: FunctionWorkingBody;
}

export interface PatchFunctionRequestDto {
  working: FunctionWorkingBody;
}

export interface ValidateFunctionRequestDto {
  revision: number;
}

export interface PublishFunctionRequestDto {
  revision: number;
  validationId: string;
  contentChecksum: string;
  dependencyChecksum: string;
  changeNote: string;
}

export interface ArchiveOrRestoreFunctionRequestDto {
  reason: string;
}

export interface FunctionVersionsQuery {
  cursor?: string | null;
  limit?: number;
}

export interface FunctionUsageQuery {
  versionId?: string;
  cursor?: string | null;
  limit?: number;
}

export type FunctionCursorPage<T> = TemplateCursorPage<T>;
export type FunctionPageInfo = TemplatePageInfo;

export interface FunctionCompanyOption {
  id: string;
  label: string;
}

export function normalizeCompanyUuid(companyId: string): string {
  return companyId;
}

export function buildFunctionCompanyOptions(
  companies: readonly ScopeCompany[],
  lang: 'en' | 'ar',
  translate: (key: string) => string,
): FunctionCompanyOption[] {
  const options: FunctionCompanyOption[] = [];
  const seen = new Set<string>();
  for (const company of companies) {
    const uuid = normalizeCompanyUuid(company.id);
    if (seen.has(uuid)) continue;
    seen.add(uuid);
    const label = lang === 'ar' ? company.nameAr : company.nameEn;
    options.push({ id: uuid, label });
  }
  return options;
}

export function describeFunctionScope(
  scope: FunctionScope,
  companies: readonly FunctionCompanyOption[],
  translate: (key: string) => string,
): { label: string; icon: string; tile: string } {
  if (scope.scopeType === 'TENANT') {
    return {
      label: translate('tplFunctions.scopes.tenant'),
      icon: 'tablerWorld',
      tile: 'bg-icon-gray',
    };
  }
  const normalizedId = normalizeCompanyUuid(scope.companyId);
  const found = companies.find((c) => c.id === normalizedId || c.id === scope.companyId);
  return {
    label: found?.label ?? scope.companyId,
    icon: 'tablerBuilding',
    tile: 'bg-icon-navy',
  };
}

export function formatFunctionDate(iso: string, lang: 'en' | 'ar'): string {
  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(iso.trim())
    ? new Date(`${iso.trim()}T00:00:00.000Z`)
    : new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  return new Intl.DateTimeFormat(`${lang}-u-nu-latn`, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(parsed);
}

export function formatFunctionTime(iso: string, lang: 'en' | 'ar'): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  return new Intl.DateTimeFormat(`${lang}-u-nu-latn`, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(parsed);
}

export function formatFunctionDateTime(iso: string, lang: 'en' | 'ar'): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  return `${formatFunctionDate(iso, lang)} · ${formatFunctionTime(iso, lang)}`;
}

const FOUR_DECIMAL_CURRENCIES = new Set(['CLF', 'UYW']);

function formatNumericWithGrouping(raw: string, minFractionDigits: number, maxFractionDigits: number): string {
  const num = Number(raw);
  if (!Number.isFinite(num)) return raw;
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: minFractionDigits,
    maximumFractionDigits: maxFractionDigits,
    useGrouping: true,
  }).format(num);
}

export function formatFunctionValue(
  value: FunctionValue,
  lang: 'en' | 'ar',
  labels: { yes: string; no: string; empty: string },
): string {
  switch (value.kind) {
    case 'NULL':
      return labels.empty;
    case 'BOOLEAN':
      return value.value ? labels.yes : labels.no;
    case 'STRING':
      return value.value;
    case 'DATE':
      return formatFunctionDate(value.value, lang);
    case 'DECIMAL': {
      if (value.dimension === 'MONEY') {
        const decimals = value.currencyCode && FOUR_DECIMAL_CURRENCIES.has(value.currencyCode.toUpperCase()) ? 4 : 3;
        const formatted = formatNumericWithGrouping(value.value, decimals, decimals);
        return value.currencyCode ? `${value.currencyCode.toUpperCase()} ${formatted}` : formatted;
      }
      if (value.dimension === 'UNIT_PRICE') {
        const formatted = formatNumericWithGrouping(value.value, 0, 8);
        const prefix = value.currencyCode ? `${value.currencyCode.toUpperCase()} ` : '';
        const suffix = value.unitCode ? ` / ${value.unitCode}` : '';
        return `${prefix}${formatted}${suffix}`;
      }
      if (value.dimension === 'QUANTITY') {
        const formatted = formatNumericWithGrouping(value.value, 0, 6);
        return value.unitCode ? `${formatted} ${value.unitCode}` : formatted;
      }
      return formatNumericWithGrouping(value.value, 0, 6);
    }
  }
}

export function defaultFunctionValue(type: FunctionScalarType, dimension: TemplateFormulaDimension): FunctionValue {
  switch (type) {
    case 'DECIMAL':
      return {
        kind: 'DECIMAL',
        value: '0',
        dimension,
        ...(dimension === 'MONEY' ? { currencyCode: 'EGP' } : {}),
        ...(dimension === 'QUANTITY' || dimension === 'UNIT_PRICE' ? { unitCode: 'pcs' } : {}),
      };
    case 'STRING':
      return { kind: 'STRING', value: '' };
    case 'BOOLEAN':
      return { kind: 'BOOLEAN', value: true };
    case 'DATE':
      return { kind: 'DATE', value: '2026-11-04' };
  }
}

export function normalizeFunctionErrorCode(code: string): string {
  return code.replaceAll('.', '_');
}

export function translateFunctionError(
  error: unknown,
  translate: (key: string, params?: Record<string, unknown>) => string,
): string {
  const status =
    typeof error === 'object' && error !== null && typeof (error as { status?: unknown }).status === 'number'
      ? (error as { status: number }).status
      : null;
  const code =
    typeof error === 'object' && error !== null && typeof (error as { code?: unknown }).code === 'string'
      ? (error as { code: string }).code
      : null;

  if (status === 412 || code === 'STALE' || code === 'CORE.TEMPLATE.CONCURRENCY.STALE_REVISION') {
    return translate('tplFunctions.errors.STALE');
  }

  if (code) {
    const normalized = normalizeFunctionErrorCode(code);
    const candidates = [
      `tplFunctions.errors.${normalized}`,
      `tplFunctions.errors.${code}`,
      `templates.errors.${code}`,
    ];
    for (const key of candidates) {
      const resolved = translate(key);
      if (resolved && resolved !== key) return resolved;
    }
  }

  return translate('tplFunctions.errors.generic');
}

export function translateFunctionIssueCode(code: string, translate: (key: string) => string): string {
  const normalized = normalizeFunctionErrorCode(code);
  const candidates = [`tplFunctions.errors.${normalized}`, `tplFunctions.errors.${code}`];
  for (const key of candidates) {
    const resolved = translate(key);
    if (resolved && resolved !== key) return resolved;
  }
  return code;
}

export function formatFunctionExpression(
  expr: TemplateFormulaExpression | null | undefined,
  translate: (key: string) => string,
): string {
  const labels: FormulaReadableLabels = {
    yes: translate('tplFunctions.formulaWords.yes'),
    no: translate('tplFunctions.formulaWords.no'),
    empty: translate('tplFunctions.formulaWords.empty'),
    fnGated: translate('tplFunctions.formulaWords.fnGated'),
    sumRows: translate('tplFunctions.formulaWords.sumRows'),
    sumWord: translate('tplFunctions.formulaWords.sumRows'),
    ifWord: translate('tplFunctions.formulaWords.if'),
    thenWord: translate('tplFunctions.formulaWords.then'),
    elseWord: translate('tplFunctions.formulaWords.else'),
    isEmptyWord: translate('tplFunctions.formulaWords.isEmpty'),
    roundWord: translate('tplFunctions.formulaWords.round'),
    absWord: translate('tplFunctions.formulaWords.abs'),
    trimWord: translate('tplFunctions.formulaWords.trim'),
    minWord: translate('tplFunctions.formulaWords.min'),
    maxWord: translate('tplFunctions.formulaWords.max'),
    coalesceWord: translate('tplFunctions.formulaWords.coalesce'),
    concatWord: translate('tplFunctions.formulaWords.concat'),
    addDaysWord: translate('tplFunctions.formulaWords.addDays'),
    diffDaysWord: translate('tplFunctions.formulaWords.diffDays'),
    unsetSlot: translate('tplFunctions.formulaWords.unset'),
  };
  return formatFormulaReadable(expr, (p) => p, (id) => id, labels);
}

/**
 * POST templates/functions/editor-context (TemplateFunctionEditorContextRequestDto).
 * Closed body: every key is required. The backend sorts and de-duplicates the lists.
 */
export interface FunctionEditorContextRequestDto {
  templateId: string;
  expectedDraftRevision: number;
  expectedContentChecksum: string;
  expectedOwnerContextFingerprint: string;
  /** At most 20 UUID v7 function version ids. */
  functionVersionIds: string[];
  /** At most 200 ISO 4217 codes (/^[A-Z]{3}$/). */
  currencyCodes: string[];
  /** At most 200 NFC unit codes, 1..200 characters, no control characters. */
  unitCodes: string[];
}

export const FUNCTION_EDITOR_CONTEXT_CONTRACT = 'template-native-editor-options.v1' as const;
export const FUNCTION_EDITOR_CONTEXT_TTL_MS = 30_000;
export const FUNCTION_EDITOR_CONTEXT_MAX_VERSIONS = 20;
export const FUNCTION_EDITOR_CONTEXT_MAX_CODES = 200;

export interface FunctionPackagePins {
  templateSchemaVersion: string;
  templateEngineVersion: string;
}

/** Backend TemplateOwnerContextPins (same shape as the data-source owner context pins). */
export type FunctionOwnerContextPins = TemplateOwnerContextPins;

/** Backend Pick<TemplateImmutableFunctionVersionV1, ...> inside the editor context. */
export interface FunctionEditorContextVersion {
  id: string;
  functionId: string;
  versionNumber: number;
  definition: FunctionWorkingBody;
  contentChecksum: string;
  dependencies: FunctionVersionDependency[];
  testProof: FunctionVersionTestProof;
  packagePins: FunctionPackagePins;
}

/** Backend TemplateFunctionEditorContextResponseDto (valid for 30 seconds after issuedAt). */
export interface FunctionEditorContextResponseDto {
  contract: typeof FUNCTION_EDITOR_CONTEXT_CONTRACT;
  source: {
    templateId: string;
    draftId: string;
    draftRevision: number;
    contentChecksum: string;
  };
  ownerContextFingerprint: string;
  request: FunctionEditorContextRequestDto;
  rootFunctionVersionIds: string[];
  release: {
    qualifiedManifestSha256: string;
    executionPackagePins: FunctionPackagePins;
    compatibleProducerPins: FunctionPackagePins[];
    ownerPackagePins: FunctionOwnerContextPins;
  };
  versions: FunctionEditorContextVersion[];
  membership: {
    currencyCodes: string[];
    unitCodes: string[];
  };
  issuedAt: string;
  expiresAt: string;
  fingerprint: string;
}

function contractFailure(): never { throw new ApiError(502, 'COMMON.GENERIC.INTERNAL_ERROR'); }
function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function string(value: unknown): value is string { return typeof value === 'string'; }
function positive(value: unknown): boolean { return Number.isSafeInteger(value) && Number(value) > 0; }
function strings(value: unknown): value is string[] { return Array.isArray(value) && value.every(string); }
function dimension(value: unknown): boolean { return ['SCALAR', 'MONEY', 'QUANTITY', 'UNIT_PRICE'].includes(String(value)); }
function signature(value: unknown): boolean {
  return record(value) && ['DECIMAL', 'STRING', 'BOOLEAN', 'DATE'].includes(String(value['type'])) &&
    typeof value['nullable'] === 'boolean' && dimension(value['dimension']);
}

/** Core's ordinary function grammar excludes the dynamic-table SUM_ROWS variant at every depth. */
export function checkFunctionExpression(value: unknown): asserts value is TemplateFormulaExpression {
  let nodes = 0;
  const visit = (v: unknown, depth: number): boolean => {
    if (!record(v) || depth > 64 || ++nodes > 4096) return false;
    const child = (x: unknown) => visit(x, depth + 1);
    switch (v['kind']) {
      case 'DECIMAL_LITERAL': return string(v['value']) && FUNCTION_DECIMAL_RE.test(v['value']) &&
        (v['dimension'] === undefined || dimension(v['dimension'])) &&
        (v['currencyCode'] === undefined || string(v['currencyCode'])) && (v['unitCode'] === undefined || string(v['unitCode']));
      case 'STRING_LITERAL': case 'DATE_LITERAL': return string(v['value']);
      case 'BOOLEAN_LITERAL': return typeof v['value'] === 'boolean';
      case 'NULL_LITERAL': return true;
      case 'BINDING': return string(v['path']) && (v['currencyCodePath'] === undefined || string(v['currencyCodePath']));
      case 'ROOT_BINDING': case 'ROW_BINDING': return string(v['path']);
      case 'FORMULA_REF': return string(v['formulaId']);
      case 'PARAMETER': return string(v['name']);
      case 'FUNCTION_CALL': return string(v['functionVersionId']) && Array.isArray(v['arguments']) &&
        v['arguments'].every(arg => record(arg) && string(arg['name']) && child(arg['expression']));
      case 'ADD': case 'SUBTRACT': case 'MULTIPLY': case 'SUM': case 'MIN': case 'MAX': case 'COALESCE': case 'CONCAT':
        return Array.isArray(v['operands']) && v['operands'].every(child);
      case 'DIVIDE': case 'ROUND': return Number.isInteger(v['scale']) &&
        ['HALF_UP', 'HALF_EVEN', 'DOWN'].includes(String(v['rounding'])) &&
        (v['kind'] === 'ROUND' ? child(v['value']) : child(v['dividend']) && child(v['divisor']));
      case 'ABS': case 'NEGATE': case 'IS_NULL': case 'TRIM': return child(v['value']);
      case 'DATE_ADD_DAYS': return child(v['date']) && child(v['days']);
      case 'DATE_DIFF_DAYS': return child(v['left']) && child(v['right']);
      case 'COMPARE': return ['EQ', 'NE', 'LT', 'LTE', 'GT', 'GTE'].includes(String(v['operator'])) && child(v['left']) && child(v['right']);
      case 'IF': return child(v['condition']) && child(v['whenTrue']) && child(v['whenFalse']);
      default: return false;
    }
  };
  if (!visit(value, 0)) contractFailure();
}

export function checkFunctionSignature(parameters: unknown, result: unknown): void {
  if (!Array.isArray(parameters) || !parameters.every(p => signature(p) && record(p) && string(p['name'])) || !signature(result)) contractFailure();
}

export function isFunctionValue(value: unknown): value is FunctionValue {
  if (!record(value)) return false;
  switch (value['kind']) {
    case 'NULL': return true;
    case 'STRING': case 'DATE': return string(value['value']);
    case 'BOOLEAN': return typeof value['value'] === 'boolean';
    // Evaluated values use exact256/128, which is wider than authored 30/18 literals.
    case 'DECIMAL': return string(value['value']) && /^-?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(value['value']) &&
      value['value'].replace(/[-.]/g, '').replace(/^0+/, '').length <= 256 &&
      (value['value'].split('.')[1]?.length ?? 0) <= 128 && dimension(value['dimension']) &&
      (value['currencyCode'] === undefined || string(value['currencyCode'])) && (value['unitCode'] === undefined || string(value['unitCode']));
    default: return false;
  }
}

export function checkFunctionWorking(value: unknown): asserts value is FunctionWorkingBody {
  if (!record(value) || value['numericPolicy'] !== FUNCTION_NUMERIC_POLICY || !string(value['name']) ||
      !(value['description'] === undefined || string(value['description'])) || !Array.isArray(value['tests']) ||
      !value['tests'].every(test => record(test) && string(test['id']) && string(test['name']) && isFunctionValue(test['expected']) &&
        Array.isArray(test['arguments']) && test['arguments'].every(arg => record(arg) && string(arg['name']) && isFunctionValue(arg['value'])))) contractFailure();
  checkFunctionSignature(value['parameters'], value['result']);
  checkFunctionExpression(value['expression']);
}

function pins(value: unknown): boolean {
  return record(value) && string(value['templateSchemaVersion']) && string(value['templateEngineVersion']);
}

export function checkFunctionVersionProof(value: Record<string, unknown>): void {
  const proof = value['testProof'];
  if (!Array.isArray(value['dependencies']) || !value['dependencies'].every(dep => record(dep) &&
      string(dep['functionVersionId']) && string(dep['contentChecksum'])) || !pins(value['packagePins']) ||
      !record(proof) || !string(proof['validationId']) || !string(proof['checksum']) ||
      !Number.isSafeInteger(proof['passedCount']) || Number(proof['passedCount']) < 0 ||
      !Number.isSafeInteger(proof['totalCount']) || Number(proof['totalCount']) < Number(proof['passedCount'])) contractFailure();
}

export function checkFunctionEditorContext(value: unknown, request: FunctionEditorContextRequestDto): FunctionEditorContextResponseDto {
  if (!record(value) || value['contract'] !== FUNCTION_EDITOR_CONTEXT_CONTRACT || !record(value['source']) ||
      value['source']['templateId'] !== request.templateId || value['source']['draftRevision'] !== request.expectedDraftRevision ||
      value['source']['contentChecksum'] !== request.expectedContentChecksum || !string(value['source']['draftId']) ||
      value['ownerContextFingerprint'] !== request.expectedOwnerContextFingerprint || !record(value['request']) ||
      !strings(value['rootFunctionVersionIds']) || !record(value['release']) || !record(value['membership']) ||
      !strings(value['membership']['currencyCodes']) || !strings(value['membership']['unitCodes']) ||
      !string(value['fingerprint']) || !string(value['issuedAt']) || !string(value['expiresAt']) ||
      !Array.isArray(value['versions'])) contractFailure();
  const echo = value['request'];
  const equalSet = (a: unknown, b: readonly string[]) => strings(a) && a.length === b.length &&
    [...a].sort().every((v, i) => v === [...b].sort()[i]);
  for (const key of ['templateId', 'expectedDraftRevision', 'expectedContentChecksum', 'expectedOwnerContextFingerprint'] as const) {
    if (echo[key] !== request[key]) contractFailure();
  }
  for (const key of ['functionVersionIds', 'currencyCodes', 'unitCodes'] as const) {
    if (!equalSet(echo[key], request[key])) contractFailure();
  }
  if (!equalSet(value['rootFunctionVersionIds'], request.functionVersionIds) ||
      !equalSet(value['membership']['currencyCodes'], request.currencyCodes) || !equalSet(value['membership']['unitCodes'], request.unitCodes)) contractFailure();
  const release = value['release'];
  if (!string(release['qualifiedManifestSha256']) || !pins(release['executionPackagePins']) ||
      !Array.isArray(release['compatibleProducerPins']) || !release['compatibleProducerPins'].every(pins) ||
      !record(release['ownerPackagePins'])) contractFailure();
  const issued = Date.parse(value['issuedAt']);
  const expires = Date.parse(value['expiresAt']);
  if (!Number.isFinite(issued) || expires - issued !== FUNCTION_EDITOR_CONTEXT_TTL_MS || expires <= Date.now()) contractFailure();
  const ids = new Set<string>();
  for (const version of value['versions']) {
    if (!record(version) || !string(version['id']) || ids.has(version['id']) || !string(version['functionId']) ||
        !positive(version['versionNumber']) || !string(version['contentChecksum'])) contractFailure();
    ids.add(version['id']);
    checkFunctionWorking(version['definition']);
    checkFunctionVersionProof(version);
  }
  if (request.functionVersionIds.some(id => !ids.has(id))) contractFailure();
  for (const version of value['versions']) {
    const item = version as Record<string, unknown>;
    if ((item['dependencies'] as FunctionVersionDependency[]).some(dep => !ids.has(dep.functionVersionId))) contractFailure();
  }
  return value as unknown as FunctionEditorContextResponseDto;
}
