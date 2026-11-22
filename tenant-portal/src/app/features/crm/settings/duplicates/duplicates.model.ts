export type Tri = boolean | null;

export type PolicySwitch = 'u' | 'b' | 'c';

export type ContactCheckKey = 'checkEmail' | 'checkPhone' | 'checkWhatsapp';

export interface Effective {
  u: boolean;
  b: boolean;
  c: boolean;
}

export interface NodeOverrides {
  u: Tri;
  b: Tri;
  c: Tri;
}

export interface Limits {
  u?: 'CHAIN';
  b?: 'CHAIN';
  c?: 'CHAIN';
}

export interface PolicyDefaults {
  allowAcrossUsers: boolean;
  allowAcrossBranches: boolean;
  allowAcrossCompanies: boolean;
  checkEmail: boolean;
  checkPhone: boolean;
  checkWhatsapp: boolean;
}

export interface CompanyOverride {
  allowAcrossUsers: Tri;
  allowAcrossBranches: Tri;
  allowAcrossCompanies: Tri;
}

export interface BranchOverride {
  allowAcrossUsers: Tri;
  allowAcrossBranches: Tri;
}

export interface PolicyBranch {
  branchId: string;
  code: string;
  name: string;
  status: 'ACTIVE';
  override: BranchOverride;
  effective: Effective;
  limits: Limits;
}

export interface PolicyCompany {
  companyId: string;
  code: string;
  name: string;
  status: 'ACTIVE';
  override: CompanyOverride;
  effective: Effective;
  limits: Limits;
  branches: PolicyBranch[];
}

export interface PolicyTree {
  revision: number;
  truncated: boolean;
  defaults: PolicyDefaults;
  companies: PolicyCompany[];
}

export interface Reset {
  scopeType: 'COMPANY' | 'BRANCH';
  id: string;
  name: string;
  switch: 'u' | 'b';
}

export type PolicyWriteResult = PolicyTree & { resets: Reset[] };

export type DefaultsPatch = Partial<PolicyDefaults>;

export type CompanyPatch = Partial<CompanyOverride>;

export type BranchPatch = Partial<BranchOverride>;

export type DisabledReasonKey = 'needsB' | 'needsC' | 'blocksB' | 'blocksU';

export interface DisabledChoices {
  inherit: DisabledReasonKey | null;
  allow: DisabledReasonKey | null;
  deny: DisabledReasonKey | null;
}
