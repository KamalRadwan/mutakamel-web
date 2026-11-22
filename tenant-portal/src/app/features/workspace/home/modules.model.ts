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

export const COMING_SOON_APPS: readonly AppsOverviewItem[] = [
  { moduleKey: 'pos', nameI18n: { en: 'Point of Sale', ar: 'نقاط البيع' } },
  { moduleKey: 'projects', nameI18n: { en: 'Projects', ar: 'المشاريع' } },
  { moduleKey: 'helpdesk', nameI18n: { en: 'Helpdesk', ar: 'مكتب المساعدة' } },
].map((app) => ({
  ...app,
  iconKey: null,
  group: 'FUTURE',
  isAddon: false,
  myAccessState: null,
  seats: null,
}));

const comingSoonKeys = new Set(COMING_SOON_APPS.map((app) => app.moduleKey));

export function groupWorkspaceApps(items: readonly AppsOverviewItem[]) {
  const subscribed = new Map<string, AppsOverviewItem>();
  const available = new Map<string, AppsOverviewItem>();
  for (const item of items) {
    if (comingSoonKeys.has(item.moduleKey)) continue;
    if (item.group === 'SUBSCRIBED' && !subscribed.has(item.moduleKey)) {
      subscribed.set(item.moduleKey, item);
    }
    if (item.group === 'AVAILABLE' && !available.has(item.moduleKey)) {
      available.set(item.moduleKey, item);
    }
  }
  return {
    subscribed: [...subscribed.values()],
    available: [...available.values()].filter((item) => !subscribed.has(item.moduleKey)),
  };
}

export function appName(item: AppsOverviewItem, language: Language): string {
  return language === 'ar' ? item.nameI18n.ar : item.nameI18n.en;
}

/** Entitlement view read by the app route guard (core/guards/app-entitlement.guard.ts). */
export interface AppModule {
  id: string;
  group: 'subscribed' | 'available' | 'future';
}
