import { Language } from '../../../core/i18n/language';

// GET /api/tenant/core/v1/apps/overview
export type AppGroup = 'SUBSCRIBED' | 'AVAILABLE' | 'FUTURE';
export type MyAccessState = 'ACTIVE' | 'OVER_CAPACITY';

export interface AppSeats {
  used: number;
  total: number;
}

export interface AppsOverviewItem {
  moduleKey: string;
  nameI18n: { en: string; ar: string };
  /** Always null today; the client maps icons by moduleKey. */
  iconKey: string | null;
  group: AppGroup;
  isAddon: boolean;
  myAccessState: MyAccessState | null;
  /** Only for the owner or users.user.read callers, on SUBSCRIBED non-add-on items with a seat module; null otherwise. */
  seats: AppSeats | null;
}

export interface AppsOverviewResponse {
  items: AppsOverviewItem[];
}

export type AppsOverviewGroups = Record<AppGroup, AppsOverviewItem[]>;

/** Splits the items by group; each group keeps the response order (catalogue rank, then moduleKey). FUTURE may be empty. */
export function groupAppsOverview(items: readonly AppsOverviewItem[]): AppsOverviewGroups {
  const groups: AppsOverviewGroups = { SUBSCRIBED: [], AVAILABLE: [], FUTURE: [] };
  for (const item of items) {
    groups[item.group].push(item);
  }
  return groups;
}

export function appName(item: AppsOverviewItem, language: Language): string {
  return language === 'ar' ? item.nameI18n.ar : item.nameI18n.en;
}

/** Entitlement view read by the app route guard (core/guards/app-entitlement.guard.ts). */
export interface AppModule {
  id: string;
  group: 'subscribed' | 'available' | 'future';
}
