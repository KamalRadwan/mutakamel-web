// Client-side look of each app card; the overview API carries no colour, route or description.
// Descriptions are i18n keys home.apps.<moduleKey>.

const TILES: Record<string, string> = {
  crm: 'bg-icon-blue',
  trade: 'bg-icon-orange',
  accounting: 'bg-icon-green',
  pos: 'bg-icon-teal',
  projects: 'bg-icon-violet',
  helpdesk: 'bg-icon-red',
  hr: 'bg-icon-navy',
  manufacturing: 'bg-icon-gray',
  fleet: 'bg-icon-blue',
  recruitment: 'bg-icon-teal',
  procurement: 'bg-icon-orange',
  warehouse: 'bg-icon-navy',
  quality: 'bg-icon-green',
  maintenance: 'bg-icon-gray',
  assets: 'bg-icon-blue',
  documents: 'bg-icon-violet',
  ecommerce: 'bg-icon-red',
  marketing: 'bg-icon-orange',
  'field-service': 'bg-icon-teal',
  subscriptions: 'bg-icon-violet',
  budgeting: 'bg-icon-green',
  bi: 'bg-icon-navy',
  'real-estate': 'bg-icon-orange',
  clinics: 'bg-icon-red',
  schools: 'bg-icon-green',
  restaurants: 'bg-icon-teal',
  hotels: 'bg-icon-blue',
  pharmacies: 'bg-icon-green',
  construction: 'bg-icon-orange',
  gyms: 'bg-icon-red',
  'car-rental': 'bg-icon-gray',
};

const ROUTES: Record<string, string> = {
  crm: '/crm/dashboard',
  trade: '/trade/dashboard',
  accounting: '/accounting/dashboard',
};

const FALLBACK_TILE = 'bg-icon-gray';
export const FALLBACK_ICON = 'tablerApps';

export function appTile(moduleKey: string): string {
  return TILES[moduleKey] ?? FALLBACK_TILE;
}

export function appRoute(moduleKey: string): string | null {
  return ROUTES[moduleKey] ?? null;
}

/** Only known apps have a description in home.apps; unknown keys show none instead of a raw key. */
export function appDescriptionKey(moduleKey: string): string | null {
  return moduleKey in TILES ? `home.apps.${moduleKey}` : null;
}

// The overview sends iconKey null today, so icons are mapped by moduleKey here.
const ICON_BY_MODULE: Record<string, string> = {
  crm: 'tablerUsers',
  trade: 'tablerShoppingCart',
  accounting: 'tablerCalculator',
  pos: 'tablerDeviceDesktop',
  projects: 'tablerLayoutKanban',
  helpdesk: 'tablerHeadset',
  hr: 'tablerUsersGroup',
  manufacturing: 'tablerBuildingFactory',
  fleet: 'tablerCar',
  recruitment: 'tablerUserSearch',
  procurement: 'tablerTruckDelivery',
  warehouse: 'tablerBuildingWarehouse',
  quality: 'tablerRosetteDiscountCheck',
  maintenance: 'tablerTool',
  assets: 'tablerCube',
  documents: 'tablerFiles',
  ecommerce: 'tablerBuildingStore',
  marketing: 'tablerSpeakerphone',
  'field-service': 'tablerMapPin',
  subscriptions: 'tablerRepeat',
  budgeting: 'tablerChartPie',
  bi: 'tablerChartBar',
  'real-estate': 'tablerBuildingEstate',
  clinics: 'tablerStethoscope',
  schools: 'tablerSchool',
  restaurants: 'tablerToolsKitchen2',
  hotels: 'tablerBed',
  pharmacies: 'tablerPill',
  construction: 'tablerCrane',
  gyms: 'tablerBarbell',
  'car-rental': 'tablerKey',
};

/** Icon name for an app; an unknown moduleKey gets the generic app icon. */
export function appIcon(moduleKey: string): string {
  return ICON_BY_MODULE[moduleKey] ?? FALLBACK_ICON;
}
