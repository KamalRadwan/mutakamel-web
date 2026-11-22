/**
 * One fake add-on catalogue for every workspace screen (billing, add-on seats,
 * application activation), so the same add-on keeps the same key, id and name everywhere.
 *
 * Keys follow the backend add-on key shape `<application>.<addon>`. `crm.homes` is the key the
 * core-app and gateway contracts use; the web phone is its own application, not a CRM add-on
 * (WebPhone LLD 00_Overview, rejected alternatives), so `crm.webphone` is not listed.
 */
export interface FakeAddonCatalogueEntry {
  readonly id: string;
  readonly key: string;
  readonly applicationKey: string;
  readonly name: string;
  readonly definitionVersionId: string;
}

export const FAKE_ADDON_HOMES: FakeAddonCatalogueEntry = {
  id: '01950000-0000-7000-8000-000000000101',
  key: 'crm.homes',
  applicationKey: 'crm',
  name: 'Homes',
  definitionVersionId: '01950000-0000-7000-8000-000000001001',
};

export const FAKE_ADDON_WHATSAPP: FakeAddonCatalogueEntry = {
  id: '01950000-0000-7000-8000-000000000102',
  key: 'crm.whatsapp',
  applicationKey: 'crm',
  name: 'WhatsApp business',
  definitionVersionId: '01950000-0000-7000-8000-000000001002',
};

export const FAKE_ADDON_AI_ASSISTANT: FakeAddonCatalogueEntry = {
  id: '01950000-0000-7000-8000-000000000103',
  key: 'crm.ai_assistant',
  applicationKey: 'crm',
  name: 'AI sales assistant',
  definitionVersionId: '01950000-0000-7000-8000-000000001003',
};

export const FAKE_ADDON_POWER_DIALER: FakeAddonCatalogueEntry = {
  id: '01950000-0000-7000-8000-000000000104',
  key: 'crm.power_dialer',
  applicationKey: 'crm',
  name: 'Power dialer',
  definitionVersionId: '01950000-0000-7000-8000-000000001004',
};

export const FAKE_ADDON_CATALOGUE: readonly FakeAddonCatalogueEntry[] = [
  FAKE_ADDON_HOMES,
  FAKE_ADDON_WHATSAPP,
  FAKE_ADDON_AI_ASSISTANT,
  FAKE_ADDON_POWER_DIALER,
];
