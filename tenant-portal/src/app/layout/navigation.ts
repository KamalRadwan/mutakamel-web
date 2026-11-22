export type AppId = 'workspace' | 'crm' | 'trade' | 'accounting';

interface AppDefinition {
  id: AppId;
  icon: string;
  tile: string;
  features: readonly string[];
}

export const APPS: readonly AppDefinition[] = [
  {
    id: 'workspace',
    icon: 'tablerBuilding',
    tile: 'bg-icon-navy',
    features: ['home', 'staff', 'operations', 'billing', 'account', 'settings'],
  },
  {
    id: 'crm',
    icon: 'tablerUsers',
    tile: 'bg-icon-blue',
    features: ['dashboard', 'leads', 'customers', 'opportunities', 'reports', 'settings'],
  },
  {
    id: 'trade',
    icon: 'tablerShoppingCart',
    tile: 'bg-icon-orange',
    features: ['dashboard', 'foundation', 'documents', 'inventory', 'governance', 'automation', 'settings'],
  },
  {
    id: 'accounting',
    icon: 'tablerCalculator',
    tile: 'bg-icon-green',
    features: ['dashboard', 'journal', 'accounts', 'receivables', 'payables', 'banking', 'assets', 'tax', 'closing', 'reports', 'settings'],
  },
];

export const APP_MAP = new Map<AppId, AppDefinition>(APPS.map((app) => [app.id, app]));

export const FEATURE_ICONS: Readonly<Record<string, { icon: string; tile: string }>> = {
  'workspace/home': { icon: 'tablerHome', tile: 'bg-icon-navy' },
  'workspace/staff': { icon: 'tablerUsers', tile: 'bg-icon-blue' },
  'workspace/operations': { icon: 'tablerLayoutGrid', tile: 'bg-icon-teal' },
  'workspace/billing': { icon: 'tablerCreditCard', tile: 'bg-icon-green' },
  'workspace/account': { icon: 'tablerUserCircle', tile: 'bg-icon-violet' },
  'workspace/settings': { icon: 'tablerSettings', tile: 'bg-icon-gray' },
  'crm/dashboard': { icon: 'tablerLayoutDashboard', tile: 'bg-icon-navy' },
  'crm/leads': { icon: 'tablerUserPlus', tile: 'bg-icon-green' },
  'crm/customers': { icon: 'tablerUsers', tile: 'bg-icon-blue' },
  'crm/opportunities': { icon: 'tablerTarget', tile: 'bg-icon-red' },
  'crm/reports': { icon: 'tablerChartBar', tile: 'bg-icon-teal' },
  'crm/settings': { icon: 'tablerSettings', tile: 'bg-icon-gray' },
  'trade/dashboard': { icon: 'tablerLayoutDashboard', tile: 'bg-icon-navy' },
  'trade/foundation': { icon: 'tablerBox', tile: 'bg-icon-blue' },
  'trade/documents': { icon: 'tablerFileText', tile: 'bg-icon-orange' },
  'trade/inventory': { icon: 'tablerStack2', tile: 'bg-icon-teal' },
  'trade/governance': { icon: 'tablerShieldCheck', tile: 'bg-icon-violet' },
  'trade/automation': { icon: 'tablerAntenna', tile: 'bg-icon-red' },
  'trade/settings': { icon: 'tablerSettings', tile: 'bg-icon-gray' },
  'accounting/dashboard': { icon: 'tablerLayoutDashboard', tile: 'bg-icon-navy' },
  'accounting/journal': { icon: 'tablerNotebook', tile: 'bg-icon-blue' },
  'accounting/accounts': { icon: 'tablerListTree', tile: 'bg-icon-violet' },
  'accounting/receivables': { icon: 'tablerCashBanknote', tile: 'bg-icon-green' },
  'accounting/payables': { icon: 'tablerReceipt', tile: 'bg-icon-red' },
  'accounting/banking': { icon: 'tablerBuildingBank', tile: 'bg-icon-teal' },
  'accounting/assets': { icon: 'tablerBox', tile: 'bg-icon-orange' },
  'accounting/tax': { icon: 'tablerPercentage', tile: 'bg-icon-violet' },
  'accounting/closing': { icon: 'tablerLock', tile: 'bg-icon-navy' },
  'accounting/reports': { icon: 'tablerChartBar', tile: 'bg-icon-teal' },
  'accounting/settings': { icon: 'tablerSettings', tile: 'bg-icon-gray' },
};

export const NAV_GROUPS: ReadonlySet<string> = new Set([
  'workspace/staff',
  'workspace/operations',
  'workspace/billing',
  'workspace/account',
  'workspace/settings',
  'trade/foundation',
  'trade/documents',
  'trade/inventory',
  'trade/governance',
  'trade/automation',
  'trade/settings',
]);

export const CRM_FEATURE_MODULE: Readonly<Partial<Record<string, 'leads' | 'opportunities'>>> = {
  leads: 'leads',
  opportunities: 'opportunities',
};

export const PAGES: Readonly<Record<string, readonly { id: string; icon: string; color: string; module?: 'leads' | 'opportunities' }[]>> = {
  'workspace/staff': [
    { id: 'organization', icon: 'tablerHierarchy2', color: 'text-icon-blue' },
    { id: 'companies', icon: 'tablerBuildingSkyscraper', color: 'text-icon-navy' },
    { id: 'branches', icon: 'tablerBuildingStore', color: 'text-icon-teal' },
    { id: 'departments', icon: 'tablerSitemap', color: 'text-icon-orange' },
    { id: 'teams', icon: 'tablerUsersGroup', color: 'text-icon-green' },
    { id: 'users', icon: 'tablerUser', color: 'text-icon-blue' },
    { id: 'roles', icon: 'tablerShieldLock', color: 'text-icon-violet' },
  ],
  'workspace/operations': [
    { id: 'party-directory', icon: 'tablerAddressBook', color: 'text-icon-green' },
    { id: 'directory-settings', icon: 'tablerAdjustmentsHorizontal', color: 'text-icon-navy' },
    { id: 'template-platform', icon: 'tablerTemplate', color: 'text-icon-orange' },
    { id: 'template-assets', icon: 'tablerPhoto', color: 'text-icon-blue' },
    { id: 'template-assignments', icon: 'tablerRoute', color: 'text-icon-violet' },
    { id: 'activities', icon: 'tablerChecklist', color: 'text-icon-teal' },
    { id: 'audit-log', icon: 'tablerHistory', color: 'text-icon-navy' },
    { id: 'application-activation', icon: 'tablerPuzzle', color: 'text-icon-green' },
    { id: 'addon-seats', icon: 'tablerArmchair', color: 'text-icon-orange' },
  ],
  'workspace/billing': [
    { id: 'overview', icon: 'tablerCreditCard', color: 'text-icon-green' },
    { id: 'invoices', icon: 'tablerFileInvoice', color: 'text-icon-red' },
    { id: 'subscription', icon: 'tablerRepeat', color: 'text-icon-blue' },
    { id: 'catalogue', icon: 'tablerApps', color: 'text-icon-violet' },
  ],
  'workspace/account': [
    { id: 'notifications', icon: 'tablerBell', color: 'text-icon-red' },
    { id: 'preferences', icon: 'tablerSettings2', color: 'text-icon-blue' },
    { id: 'security', icon: 'tablerKey', color: 'text-icon-violet' },
  ],
  'workspace/settings': [
    { id: 'workspace', icon: 'tablerSettings', color: 'text-icon-gray' },
    { id: 'currencies', icon: 'tablerCoins', color: 'text-icon-green' },
    { id: 'taxes', icon: 'tablerPercentage', color: 'text-icon-violet' },
    { id: 'numbering', icon: 'tablerHash', color: 'text-icon-navy' },
    { id: 'email', icon: 'tablerMail', color: 'text-icon-blue' },
    { id: 'phone', icon: 'tablerPhone', color: 'text-icon-green' },
    { id: 'branding', icon: 'tablerPalette', color: 'text-icon-orange' },
    { id: 'geography', icon: 'tablerWorld', color: 'text-icon-teal' },
    { id: 'updates', icon: 'tablerPackage', color: 'text-icon-violet' },
  ],
  'crm/dashboard': [
    { id: 'home', icon: 'tablerHome', color: 'text-icon-navy' },
    { id: 'dashboards', icon: 'tablerLayoutDashboard', color: 'text-icon-blue' },
    { id: 'widgets', icon: 'tablerChartDots3', color: 'text-icon-violet' },
    { id: 'alerts', icon: 'tablerBellRinging', color: 'text-icon-orange' },
    { id: 'access', icon: 'tablerKey', color: 'text-icon-teal' },
  ],
  'crm/reports': [
    { id: 'catalogue', icon: 'tablerChartBar', color: 'text-icon-teal' },
    { id: 'schedules', icon: 'tablerCalendarTime', color: 'text-icon-blue' },
    { id: 'exports', icon: 'tablerFileDownload', color: 'text-icon-green' },
  ],
  'crm/settings': [
    { id: 'lead-stages', icon: 'tablerListNumbers', color: 'text-icon-green', module: 'leads' },
    { id: 'pipelines', icon: 'tablerHierarchy2', color: 'text-icon-violet', module: 'opportunities' },
    { id: 'opportunity-stages', icon: 'tablerLayoutRows', color: 'text-icon-red', module: 'opportunities' },
    { id: 'lead-sources', icon: 'tablerTrendingUp', color: 'text-icon-teal' },
    { id: 'tags', icon: 'tablerTag', color: 'text-icon-orange' },
    { id: 'custom-fields', icon: 'tablerAdjustmentsHorizontal', color: 'text-icon-navy' },
    { id: 'reasons', icon: 'tablerListCheck', color: 'text-icon-violet' },
    { id: 'outbound-emails', icon: 'tablerMail', color: 'text-icon-blue' },
    { id: 'general', icon: 'tablerSettings', color: 'text-icon-gray' },
    { id: 'duplicates', icon: 'tablerCopy', color: 'text-icon-orange' },
    { id: 'static-data', icon: 'tablerDatabase', color: 'text-icon-violet' },
    { id: 'targets', icon: 'tablerTargetArrow', color: 'text-icon-red' },
    { id: 'sla', icon: 'tablerClockCheck', color: 'text-icon-orange' },
    { id: 'calendars', icon: 'tablerCalendar', color: 'text-icon-blue' },
    { id: 'data-readiness', icon: 'tablerActivityHeartbeat', color: 'text-icon-teal' },
  ],
  'trade/foundation': [
    { id: 'items', icon: 'tablerBox', color: 'text-icon-blue' },
    { id: 'units', icon: 'tablerRuler', color: 'text-icon-teal' },
    { id: 'categories', icon: 'tablerSitemap', color: 'text-icon-orange' },
    { id: 'channels', icon: 'tablerBroadcast', color: 'text-icon-violet' },
    { id: 'commercial-accounts', icon: 'tablerHeartHandshake', color: 'text-icon-green' },
    { id: 'configuration', icon: 'tablerAdjustmentsHorizontal', color: 'text-icon-navy' },
  ],
  'trade/documents': [
    { id: 'quotations', icon: 'tablerFileDescription', color: 'text-icon-teal' },
    { id: 'sales-orders', icon: 'tablerClipboardCheck', color: 'text-icon-green' },
    { id: 'purchase-orders', icon: 'tablerShoppingCart', color: 'text-icon-orange' },
    { id: 'purchase-quotations', icon: 'tablerFileSearch', color: 'text-icon-blue' },
  ],
  'trade/inventory': [
    { id: 'availability', icon: 'tablerStack2', color: 'text-icon-teal' },
    { id: 'fulfilment-nodes', icon: 'tablerBuildingWarehouse', color: 'text-icon-navy' },
    { id: 'periods', icon: 'tablerCalendarStats', color: 'text-icon-blue' },
    { id: 'uom-conversions', icon: 'tablerArrowsExchange', color: 'text-icon-violet' },
    { id: 'movements', icon: 'tablerTruck', color: 'text-icon-orange' },
    { id: 'serials', icon: 'tablerBarcode', color: 'text-icon-green' },
    { id: 'decisions', icon: 'tablerGavel', color: 'text-icon-red' },
  ],
  'trade/governance': [
    { id: 'price-books', icon: 'tablerBook', color: 'text-icon-blue' },
    { id: 'price-evaluation', icon: 'tablerCalculator', color: 'text-icon-green' },
    { id: 'policy-studio', icon: 'tablerShieldCheck', color: 'text-icon-violet' },
    { id: 'workflows', icon: 'tablerGitBranch', color: 'text-icon-teal' },
    { id: 'document-profiles', icon: 'tablerFileSettings', color: 'text-icon-orange' },
  ],
  'trade/automation': [
    { id: 'extension-profiles', icon: 'tablerPuzzle', color: 'text-icon-violet' },
    { id: 'import-runs', icon: 'tablerUpload', color: 'text-icon-blue' },
    { id: 'import-mappings', icon: 'tablerTable', color: 'text-icon-teal' },
    { id: 'webhooks', icon: 'tablerWebhook', color: 'text-icon-orange' },
    { id: 'control-tower', icon: 'tablerBuildingBroadcastTower', color: 'text-icon-red' },
  ],
  'trade/settings': [
    { id: 'terms', icon: 'tablerFileText', color: 'text-icon-teal' },
    { id: 'reasons', icon: 'tablerListCheck', color: 'text-icon-violet' },
  ],
};

/** True when the URL points at an app, one of its features, and (if given) one of that feature's pages. */
export function isKnownPath(segments: readonly string[]): boolean {
  const [app, feature, page, ...rest] = segments;
  const definition = APP_MAP.get(app as AppId);
  if (!definition || rest.length > 0) return false;
  if (feature === undefined) return true;
  if (!definition.features.includes(feature)) return false;
  return page === undefined || (PAGES[app + '/' + feature] ?? []).some((item) => item.id === page);
}

