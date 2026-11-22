export type CrmModule = 'leads' | 'opportunities';

export interface CrmModuleFlags {
  leadsEnabled: boolean;
  opportunitiesEnabled: boolean;
}

export interface CrmModuleOverride {
  leadsEnabled: boolean | null;
  opportunitiesEnabled: boolean | null;
}

export interface CrmModuleCompany {
  companyId: string;
  code: string;
  name: string;
  status: 'ACTIVE';
  override: CrmModuleOverride;
  effective: CrmModuleFlags;
}

export interface CrmModulesState {
  revision: number;
  defaults: CrmModuleFlags;
  companies: CrmModuleCompany[];
}
