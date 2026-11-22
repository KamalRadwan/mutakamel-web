// Follows crm-app settings/duplicate-policy.controller.ts, duplicate-policy.service.ts and
// dto/update-duplicate-policy.dto.ts. Order: subscription guard (403) -> ValidationPipe (400, path-keyed)
// -> revision (409 STALE, no details) -> node lookup (404) -> chain conflict (422) -> resets (409).
import { ApiError, fakeDelay } from '../shared/settings-api';
import {
  BranchPatch,
  CompanyPatch,
  DefaultsPatch,
  PolicyTree,
  PolicyWriteResult,
  Reset,
} from './duplicates.model';
import {
  applyResets,
  collectChildResets,
  findNodeChainConflict,
  resolveDefaultsEffective,
  resolvePolicyTree,
} from './duplicates.policy';

export const FAKE_READ_ONLY = false;

let state: PolicyTree = resolvePolicyTree({
  revision: 1,
  truncated: false,
  defaults: {
    allowAcrossUsers: false,
    allowAcrossBranches: false,
    allowAcrossCompanies: false,
    checkEmail: true,
    checkPhone: true,
    checkWhatsapp: true,
  },
  companies: [
    {
      companyId: '01950000-0000-7000-8000-000000000501',
      code: 'EG',
      name: 'Mutakamel Egypt',
      status: 'ACTIVE',
      override: {
        allowAcrossUsers: null,
        allowAcrossBranches: true,
        allowAcrossCompanies: true,
      },
      effective: { u: false, b: true, c: true },
      limits: {},
      branches: [
        {
          branchId: '01950000-0000-7000-8000-000000000601',
          code: 'CAI',
          name: 'Cairo HQ',
          status: 'ACTIVE',
          override: { allowAcrossUsers: true, allowAcrossBranches: null },
          effective: { u: true, b: true, c: true },
          limits: {},
        },
        {
          branchId: '01950000-0000-7000-8000-000000000602',
          code: 'ALX',
          name: 'Alexandria',
          status: 'ACTIVE',
          override: { allowAcrossUsers: null, allowAcrossBranches: null },
          effective: { u: false, b: true, c: true },
          limits: {},
        },
        {
          branchId: '01950000-0000-7000-8000-000000000603',
          code: 'GIZ',
          name: 'Giza',
          status: 'ACTIVE',
          override: { allowAcrossUsers: null, allowAcrossBranches: false },
          effective: { u: false, b: false, c: true },
          limits: {},
        },
      ],
    },
    {
      companyId: '01950000-0000-7000-8000-000000000502',
      code: 'SA',
      name: 'Mutakamel KSA',
      status: 'ACTIVE',
      override: {
        allowAcrossUsers: null,
        allowAcrossBranches: null,
        allowAcrossCompanies: true,
      },
      effective: { u: false, b: false, c: true },
      limits: {},
      branches: [
        {
          branchId: '01950000-0000-7000-8000-000000000604',
          code: 'RUH',
          name: 'Riyadh',
          status: 'ACTIVE',
          override: { allowAcrossUsers: null, allowAcrossBranches: null },
          effective: { u: false, b: false, c: true },
          limits: {},
        },
        {
          branchId: '01950000-0000-7000-8000-000000000605',
          code: 'JED',
          name: 'Jeddah',
          status: 'ACTIVE',
          override: { allowAcrossUsers: null, allowAcrossBranches: null },
          effective: { u: false, b: false, c: true },
          limits: {},
        },
      ],
    },
    {
      companyId: '01950000-0000-7000-8000-000000000503',
      code: 'GT',
      name: 'Gulf Trading',
      status: 'ACTIVE',
      override: {
        allowAcrossUsers: null,
        allowAcrossBranches: null,
        allowAcrossCompanies: null,
      },
      effective: { u: false, b: false, c: false },
      limits: {},
      branches: [
        {
          branchId: '01950000-0000-7000-8000-000000000606',
          code: 'DXB',
          name: 'Dubai',
          status: 'ACTIVE',
          override: { allowAcrossUsers: null, allowAcrossBranches: null },
          effective: { u: false, b: false, c: false },
          limits: {},
        },
      ],
    },
  ],
});

function cloneTree(tree: PolicyTree): PolicyTree {
  return {
    revision: tree.revision,
    truncated: tree.truncated,
    defaults: { ...tree.defaults },
    companies: tree.companies.map((company) => ({
      ...company,
      override: { ...company.override },
      effective: { ...company.effective },
      limits: { ...company.limits },
      branches: company.branches.map((branch) => ({
        ...branch,
        override: { ...branch.override },
        effective: { ...branch.effective },
        limits: { ...branch.limits },
      })),
    })),
  };
}

const DEFAULT_FIELDS = [
  'allowAcrossUsers',
  'allowAcrossBranches',
  'allowAcrossCompanies',
  'checkEmail',
  'checkPhone',
  'checkWhatsapp',
] as const;
const COMPANY_FIELDS = ['allowAcrossUsers', 'allowAcrossBranches', 'allowAcrossCompanies'] as const;
const BRANCH_FIELDS = ['allowAcrossUsers', 'allowAcrossBranches'] as const;

type Details = Record<string, string[]>;

function addError(details: Details, path: string, constraint: string): void {
  (details[path] ??= []).push(constraint);
}

function assertWritable(): void {
  if (FAKE_READ_ONLY) {
    throw new ApiError(403, 'CRM_SUBSCRIPTION_READ_ONLY');
  }
}

/**
 * The global ValidationPipe on the DTO (whitelist + forbidNonWhitelisted): expectedRevision @IsInt @Min(1);
 * confirmResets and the defaults switches must be booleans when present (null fails); company and branch
 * switches are @IsOptional booleans (null means inherit); any other property is not whitelisted.
 */
function validateBody(
  patch: Record<string, unknown>,
  expectedRevision: number,
  confirmResets: unknown,
  fields: readonly string[],
  nullable: boolean,
): void {
  const details: Details = {};
  if (!Number.isInteger(expectedRevision)) addError(details, 'expectedRevision', 'is_int');
  if (typeof expectedRevision !== 'number' || !(expectedRevision >= 1)) addError(details, 'expectedRevision', 'min');
  if (confirmResets !== undefined && typeof confirmResets !== 'boolean') addError(details, 'confirmResets', 'is_boolean');
  for (const [key, value] of Object.entries(patch)) {
    if (!fields.includes(key)) {
      addError(details, key, 'whitelist_validation');
      continue;
    }
    if (value === undefined || (nullable && value === null)) continue;
    if (typeof value !== 'boolean') addError(details, key, 'is_boolean');
  }
  if (Object.keys(details).length > 0) {
    throw new ApiError(400, 'CRM_VALIDATION_FAILED', details);
  }
}

/** The service answers a stale revision with 409 and no details. */
function assertRevision(expectedRevision: number): void {
  if (expectedRevision !== state.revision) {
    throw new ApiError(409, 'CRM_DUPLICATE_POLICY_STALE');
  }
}

/** DuplicatePolicyService.conflict: details are string arrays, the reason lowercase. */
function chainConflict(key: 'b' | 'u'): ApiError {
  return new ApiError(422, 'CRM_DUPLICATE_POLICY_CONFLICT', { switch: [key], reason: ['chain'] });
}

/** Drops undefined values, as the service does before it applies the patch. */
function definedPatch<T extends object>(patch: T): Partial<T> {
  return Object.fromEntries(Object.entries(patch).filter(([, value]) => value !== undefined)) as Partial<T>;
}

function finalizeWrite(draft: PolicyTree, resets: Reset[], confirmResets: boolean): PolicyWriteResult {
  if (resets.length > 0 && !confirmResets) {
    // Parallel string arrays (scopeType lowercase); the client zips them by index.
    throw new ApiError(409, 'CRM_DUPLICATE_POLICY_RESETS_REQUIRED', {
      scopeType: resets.map((reset) => reset.scopeType.toLowerCase()),
      id: resets.map((reset) => reset.id),
      name: resets.map((reset) => reset.name),
      switch: resets.map((reset) => reset.switch),
    });
  }
  const resolved = resets.length > 0 ? applyResets(draft, resets) : resolvePolicyTree(draft);
  resolved.revision = state.revision + 1;
  state = cloneTree(resolved);
  return {
    ...cloneTree(state),
    resets: resets.map((reset) => ({ ...reset })),
  };
}

export async function fakeGetPolicy(): Promise<PolicyTree> {
  await fakeDelay();
  return cloneTree(state);
}

export async function fakePutDefaults(
  patch: DefaultsPatch,
  expectedRevision: number,
  confirmResets = false,
): Promise<PolicyWriteResult> {
  await fakeDelay();
  assertWritable();
  validateBody(patch as Record<string, unknown>, expectedRevision, confirmResets, DEFAULT_FIELDS, false);
  assertRevision(expectedRevision);

  const nextDefaults = {
    ...state.defaults,
    ...definedPatch(patch),
  };
  // Tenant scope: b needs c, then u needs b (raw defaults).
  if (nextDefaults.allowAcrossBranches && !nextDefaults.allowAcrossCompanies) throw chainConflict('b');
  if (nextDefaults.allowAcrossUsers && !nextDefaults.allowAcrossBranches) throw chainConflict('u');

  const draft: PolicyTree = {
    ...cloneTree(state),
    defaults: nextDefaults,
  };
  const resets = collectChildResets(draft, 'WORKSPACE');
  return finalizeWrite(draft, resets, confirmResets);
}

export async function fakePutCompany(
  companyId: string,
  patch: CompanyPatch,
  expectedRevision: number,
  confirmResets = false,
): Promise<PolicyWriteResult> {
  await fakeDelay();
  assertWritable();
  validateBody(patch as Record<string, unknown>, expectedRevision, confirmResets, COMPANY_FIELDS, true);
  assertRevision(expectedRevision);

  const id = companyId.toLowerCase();
  const companyIndex = state.companies.findIndex((item) => item.companyId.toLowerCase() === id);
  if (companyIndex < 0) {
    throw new ApiError(404, 'CRM_COMPANY_NOT_FOUND');
  }

  const draft = cloneTree(state);
  const company = draft.companies[companyIndex];
  const nextOverride = {
    ...company.override,
    ...definedPatch(patch),
  };
  const workspaceEffective = resolveDefaultsEffective(draft.defaults);
  const effectiveC = nextOverride.allowAcrossCompanies ?? workspaceEffective.c;
  const rawB = nextOverride.allowAcrossBranches ?? workspaceEffective.b;

  const conflictSwitch = findNodeChainConflict({
    effectiveC,
    rawB,
    explicitB: nextOverride.allowAcrossBranches === true,
    explicitU: nextOverride.allowAcrossUsers === true,
  });
  if (conflictSwitch) throw chainConflict(conflictSwitch);

  company.override = nextOverride;
  const resets = collectChildResets(draft, 'COMPANY', company.companyId);
  return finalizeWrite(draft, resets, confirmResets);
}

export async function fakePutBranch(
  branchId: string,
  patch: BranchPatch,
  expectedRevision: number,
  confirmResets = false,
): Promise<PolicyWriteResult> {
  await fakeDelay();
  assertWritable();
  validateBody(patch as Record<string, unknown>, expectedRevision, confirmResets, BRANCH_FIELDS, true);
  assertRevision(expectedRevision);

  const id = branchId.toLowerCase();
  let targetCompanyIndex = -1;
  let targetBranchIndex = -1;
  for (let i = 0; i < state.companies.length; i++) {
    const j = state.companies[i].branches.findIndex((item) => item.branchId.toLowerCase() === id);
    if (j >= 0) {
      targetCompanyIndex = i;
      targetBranchIndex = j;
      break;
    }
  }
  if (targetCompanyIndex < 0 || targetBranchIndex < 0) {
    throw new ApiError(404, 'CRM_BRANCH_NOT_FOUND');
  }

  const draft = cloneTree(state);
  const company = draft.companies[targetCompanyIndex];
  const branch = company.branches[targetBranchIndex];
  const nextOverride = {
    ...branch.override,
    ...definedPatch(patch),
  };
  const effectiveC = company.effective.c;
  const rawB = nextOverride.allowAcrossBranches ?? company.effective.b;

  const conflictSwitch = findNodeChainConflict({
    effectiveC,
    rawB,
    explicitB: nextOverride.allowAcrossBranches === true,
    explicitU: nextOverride.allowAcrossUsers === true,
  });
  if (conflictSwitch) throw chainConflict(conflictSwitch);

  branch.override = nextOverride;
  return finalizeWrite(draft, [], confirmResets);
}
