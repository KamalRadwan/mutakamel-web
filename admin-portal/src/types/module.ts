export interface ModuleView {
  id: string;
  key: string;
  name: string;
  description: string | null;
  avatarDataUrl: string | null;
  rank: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  tiers?: TierView[];
  features?: FeatureView[];
}

export interface TierView {
  id: string;
  moduleId: string;
  key: string;
  name: string;
  rank: number;
  color: string;
  isActive: boolean;
}

export interface FeatureView {
  id: string;
  moduleId: string;
  key: string;
  name: string;
  description: string | null;
  rank: number;
  isActive: boolean;
}

export interface TierFeatureGrantView {
  id: string;
  tierId: string;
  featureId: string;
  config: Record<string, unknown> | null;
  configRevision: number;
}

export interface PriceTierView {
  id: string;
  tierId: string;
  billingCycle: "MONTHLY" | "ANNUAL";
  minUsers: number;
  maxUsers: number | null;
  unitPriceUsd: string;
}

export interface CurrencyRateView {
  currencyCode: string;
  baseCurrencyCode: string;
  rate: string;
  updatedAt: string;
}
