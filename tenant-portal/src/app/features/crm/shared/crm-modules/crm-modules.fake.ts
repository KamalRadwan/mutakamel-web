import { fakeDelay } from '../../../../core/fake/fake-utils';
import { FAKE_COMPANIES } from '../../../../core/scope/scope.fake';
import { ApiError } from '../../settings/shared/settings-api';
import { CrmModuleCompany, CrmModuleFlags, CrmModuleOverride, CrmModulesState } from './crm-modules.model';

export const FAKE_READ_ONLY = false;

function activeLanguage(): 'ar' | 'en' {
  if (typeof document !== 'undefined' && document.documentElement.lang === 'ar') return 'ar';
  try {
    if (typeof localStorage !== 'undefined' && localStorage.getItem('lang') === 'ar') return 'ar';
  } catch {
    // Storage unavailable
  }
  return 'en';
}

function companyName(companyId: string, fallback: string): string {
  const company = FAKE_COMPANIES.find((item) => item.id === companyId);
  if (!company) return fallback;
  return activeLanguage() === 'ar' ? company.nameAr : company.nameEn;
}

function computeEffective(defaults: CrmModuleFlags, override: CrmModuleOverride): CrmModuleFlags {
  return {
    leadsEnabled: override.leadsEnabled ?? defaults.leadsEnabled,
    opportunitiesEnabled: override.opportunitiesEnabled ?? defaults.opportunitiesEnabled,
  };
}

let modulesState: CrmModulesState = {
  revision: 1,
  defaults: {
    leadsEnabled: true,
    opportunitiesEnabled: true,
  },
  companies: FAKE_COMPANIES.map((company): CrmModuleCompany => {
    const override: CrmModuleOverride = { leadsEnabled: null, opportunitiesEnabled: null };
    const defaults: CrmModuleFlags = { leadsEnabled: true, opportunitiesEnabled: true };
    return {
      companyId: company.id,
      code: company.nameEn.slice(0, 3).toUpperCase(),
      name: activeLanguage() === 'ar' ? company.nameAr : company.nameEn,
      status: 'ACTIVE',
      override,
      effective: computeEffective(defaults, override),
    };
  }),
};

function cloneState(state: CrmModulesState): CrmModulesState {
  const defaults: CrmModuleFlags = { ...state.defaults };
  return {
    revision: state.revision,
    defaults,
    companies: state.companies.map((company) => {
      const override: CrmModuleOverride = { ...company.override };
      return {
        ...company,
        name: companyName(company.companyId, company.name),
        override,
        effective: computeEffective(defaults, override),
      };
    }),
  };
}

// GET /api/tenant/crm/v1/settings/modules
export async function fakeGetCrmModules(): Promise<CrmModulesState> {
  await fakeDelay();
  return cloneState(modulesState);
}

function isNullableBoolean(value: unknown): boolean {
  return value === undefined || value === null || typeof value === 'boolean';
}

/**
 * UpdateCrmModulesDto through the global ValidationPipe: 400 CRM_VALIDATION_FAILED whose
 * details map each failing property to its message array (AllExceptionsFilter.flattenValidation).
 */
function assertUpdateModulesBody(patch: Partial<CrmModuleOverride>, expectedRevision: number): void {
  const details: Record<string, string[]> = {};
  if (!Number.isInteger(expectedRevision) || expectedRevision < 1) {
    details['expectedRevision'] = ['expectedRevision must not be less than 1'];
  }
  if (!isNullableBoolean(patch.leadsEnabled)) {
    details['leadsEnabled'] = ['leadsEnabled must be a boolean value'];
  }
  if (!isNullableBoolean(patch.opportunitiesEnabled)) {
    details['opportunitiesEnabled'] = ['opportunitiesEnabled must be a boolean value'];
  }
  if (Object.keys(details).length > 0) {
    throw new ApiError(400, 'CRM_VALIDATION_FAILED', details);
  }
}

/** Effective module flag for a company (company override, else the tenant default). */
export function fakeCrmModuleEnabled(module: 'leads' | 'opportunities', companyId: string | null): boolean {
  const key = module === 'leads' ? 'leadsEnabled' : 'opportunitiesEnabled';
  const company = companyId ? modulesState.companies.find((item) => item.companyId === companyId) : undefined;
  return company?.override[key] ?? modulesState.defaults[key];
}

/** CrmModuleSwitchService.companyOfBranch on the fake scope tree. */
export function fakeCompanyOfBranch(branchId: string): string | null {
  return FAKE_COMPANIES.find((company) => company.branches.some((branch) => branch.id === branchId))?.id ?? null;
}

/**
 * PUT /api/tenant/crm/v1/settings/modules/companies/:companyId
 * Gateway: WRITE_SENSITIVE but idempotent: false, so no x-idempotency-key is sent.
 * Order follows CrmModulesService.update: guards (403), DTO (400), revision (409, no details), company (404).
 */
export async function fakeUpdateCompanyModules(
  companyId: string,
  patch: Partial<CrmModuleOverride>,
  expectedRevision: number,
): Promise<CrmModulesState> {
  await fakeDelay();
  if (FAKE_READ_ONLY) {
    throw new ApiError(403, 'CRM_SUBSCRIPTION_READ_ONLY');
  }
  assertUpdateModulesBody(patch, expectedRevision);
  if (expectedRevision !== modulesState.revision) {
    throw new ApiError(409, 'CRM_MODULE_SETTINGS_STALE');
  }

  const index = modulesState.companies.findIndex((item) => item.companyId === companyId);
  if (index === -1) {
    throw new ApiError(404, 'CRM_COMPANY_NOT_FOUND');
  }

  const current = modulesState.companies[index];
  const nextOverride: CrmModuleOverride = {
    leadsEnabled: patch.leadsEnabled !== undefined ? patch.leadsEnabled : current.override.leadsEnabled,
    opportunitiesEnabled:
      patch.opportunitiesEnabled !== undefined ? patch.opportunitiesEnabled : current.override.opportunitiesEnabled,
  };

  const nextCompanies = modulesState.companies.slice();
  nextCompanies[index] = {
    ...current,
    override: nextOverride,
    effective: computeEffective(modulesState.defaults, nextOverride),
  };

  modulesState = {
    ...modulesState,
    revision: modulesState.revision + 1,
    companies: nextCompanies,
  };
  return cloneState(modulesState);
}

export function fakeSyncCrmModulesState(next: CrmModulesState): CrmModulesState {
  modulesState = cloneState(next);
  return cloneState(modulesState);
}

export function fakeSyncCrmModuleDefaults(defaults: Partial<CrmModuleFlags>): CrmModulesState {
  const nextDefaults: CrmModuleFlags = { ...modulesState.defaults, ...defaults };
  modulesState = cloneState({
    ...modulesState,
    defaults: nextDefaults,
  });
  return cloneState(modulesState);
}
