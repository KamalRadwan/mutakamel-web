export type DuplicateScope = 'TENANT' | 'BRANCH' | 'PARTY_ROLE';

export const DUPLICATE_SCOPES: readonly DuplicateScope[] = ['TENANT', 'BRANCH', 'PARTY_ROLE'] as const;

export interface DirectorySettings {
  id: string;
  duplicateScope: DuplicateScope;
  preventDuplicateEmail: boolean;
  preventDuplicatePhone: boolean;
  preventDuplicateWhatsapp: boolean;
  maxContactMethodsPerParty: number;
  maxAddressesPerParty: number;
  createdAt: string;
  updatedAt: string;
}

export interface DirectorySettingsPatch {
  duplicateScope?: DuplicateScope;
  preventDuplicateEmail?: boolean;
  preventDuplicatePhone?: boolean;
  preventDuplicateWhatsapp?: boolean;
  maxContactMethodsPerParty?: number;
  maxAddressesPerParty?: number;
}

export const DIRECTORY_SETTINGS_LIMITS = {
  min: 1,
  max: 200,
} as const;
