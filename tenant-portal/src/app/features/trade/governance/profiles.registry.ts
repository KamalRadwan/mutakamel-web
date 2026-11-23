import type { ProfileContent } from './profiles.model';

export type DocumentType = 'QUOTATION' | 'SALES_ORDER' | 'PURCHASE_ORDER';

export const DOCUMENT_TYPES: readonly DocumentType[] = [
  'QUOTATION',
  'SALES_ORDER',
  'PURCHASE_ORDER',
];

export const PROFILE_REGISTRY_VERSION = 'trade-document-registry.v1';

export interface ProfileFieldDef {
  code: string;
  familyRequired: boolean;
  serverOwned: boolean;
  defaultVisible: boolean;
  defaultRequired: boolean;
}

export interface ProfileComponentDef {
  code: string;
  mandatory: boolean;
  defaultOrder: number;
  defaultVisible: boolean;
}

export interface ProfileModeDef {
  key: string;
  kind: 'enum' | 'boolean';
  allowedValues: readonly string[];
  defaultValue: string | boolean;
  locked: boolean;
}

export interface ProfileEvidenceDef {
  code: string;
  defaultInclude: boolean;
  defaultRequired: boolean;
}

export interface ProfileSystemCaseDef {
  code: string;
}

export interface ProfileFamilyRegistry {
  documentType: DocumentType;
  fields: readonly ProfileFieldDef[];
  components: readonly ProfileComponentDef[];
  modes: readonly ProfileModeDef[];
  evidence: readonly ProfileEvidenceDef[];
  systemCases: readonly ProfileSystemCaseDef[];
}

export interface ProfileRegistry {
  registryVersion: string;
  families: Readonly<Record<DocumentType, ProfileFamilyRegistry>>;
}

const SHARED_COMPONENTS: readonly ProfileComponentDef[] = [
  { code: 'HEADER', mandatory: true, defaultOrder: 10, defaultVisible: true },
  { code: 'PARTY_SUMMARY', mandatory: false, defaultOrder: 20, defaultVisible: true },
  { code: 'LINE_ITEMS', mandatory: true, defaultOrder: 30, defaultVisible: true },
  { code: 'TOTALS', mandatory: false, defaultOrder: 40, defaultVisible: true },
  { code: 'TERMS', mandatory: false, defaultOrder: 50, defaultVisible: true },
  { code: 'APPROVAL', mandatory: false, defaultOrder: 60, defaultVisible: true },
  { code: 'FULFILLMENT', mandatory: false, defaultOrder: 70, defaultVisible: true },
  { code: 'NOTES', mandatory: false, defaultOrder: 80, defaultVisible: true },
];

const SERVER_OWNED_FIELDS: readonly ProfileFieldDef[] = [
  { code: 'GRAND_TOTAL', familyRequired: false, serverOwned: true, defaultVisible: true, defaultRequired: false },
  { code: 'DOCUMENT_NUMBER', familyRequired: false, serverOwned: true, defaultVisible: true, defaultRequired: false },
  { code: 'LIFECYCLE_STATUS', familyRequired: false, serverOwned: true, defaultVisible: true, defaultRequired: false },
  { code: 'APPROVAL_STATUS', familyRequired: false, serverOwned: true, defaultVisible: true, defaultRequired: false },
  { code: 'FULFILLMENT_STATUS', familyRequired: false, serverOwned: true, defaultVisible: true, defaultRequired: false },
  { code: 'BILLING_STATUS', familyRequired: false, serverOwned: true, defaultVisible: true, defaultRequired: false },
];

const SHARED_EVIDENCE: readonly ProfileEvidenceDef[] = [
  { code: 'CUSTOMER_ACCEPTANCE', defaultInclude: true, defaultRequired: false },
  { code: 'APPROVAL_DECISION', defaultInclude: true, defaultRequired: true },
  { code: 'PRICE_DECISION', defaultInclude: true, defaultRequired: false },
  { code: 'CREDIT_DECISION', defaultInclude: true, defaultRequired: false },
  { code: 'SUPPLIER_ACKNOWLEDGEMENT', defaultInclude: false, defaultRequired: false },
];

/** Server cases the backend adds to every version (document-profile-registry.ts mandatoryCases). */
function serverCases(type: DocumentType): readonly ProfileSystemCaseDef[] {
  return [
    { code: 'MINIMAL_VALID' },
    { code: 'MISSING_REQUIRED_REJECTED' },
    { code: 'SERVER_OWNED_REJECTED' },
    { code: `${type}_REGISTRY_COMPATIBLE` },
  ];
}

export const PROFILE_REGISTRY: ProfileRegistry = {
  registryVersion: PROFILE_REGISTRY_VERSION,
  families: {
    QUOTATION: {
      documentType: 'QUOTATION',
      fields: [
        { code: 'PARTY', familyRequired: true, serverOwned: false, defaultVisible: true, defaultRequired: true },
        { code: 'CONTACT', familyRequired: false, serverOwned: false, defaultVisible: true, defaultRequired: false },
        { code: 'CURRENCY', familyRequired: true, serverOwned: false, defaultVisible: true, defaultRequired: true },
        { code: 'VALID_UNTIL', familyRequired: true, serverOwned: false, defaultVisible: true, defaultRequired: true },
        { code: 'LINES', familyRequired: true, serverOwned: false, defaultVisible: true, defaultRequired: true },
        { code: 'TERMS', familyRequired: false, serverOwned: false, defaultVisible: true, defaultRequired: false },
        ...SERVER_OWNED_FIELDS,
      ],
      components: SHARED_COMPONENTS,
      modes: [
        {
          key: 'acceptanceMode',
          kind: 'enum',
          allowedValues: ['INTERNAL_AUTHORIZED'],
          defaultValue: 'INTERNAL_AUTHORIZED',
          locked: true,
        },
        {
          key: 'priceLockRequired',
          kind: 'boolean',
          allowedValues: ['true', 'false'],
          defaultValue: true,
          locked: false,
        },
      ],
      evidence: SHARED_EVIDENCE,
      systemCases: serverCases('QUOTATION'),
    },
    SALES_ORDER: {
      documentType: 'SALES_ORDER',
      fields: [
        { code: 'PARTY', familyRequired: true, serverOwned: false, defaultVisible: true, defaultRequired: true },
        { code: 'CONTACT', familyRequired: false, serverOwned: false, defaultVisible: true, defaultRequired: false },
        { code: 'CURRENCY', familyRequired: true, serverOwned: false, defaultVisible: true, defaultRequired: true },
        { code: 'LINES', familyRequired: true, serverOwned: false, defaultVisible: true, defaultRequired: true },
        { code: 'FULFILLMENT_NODE', familyRequired: false, serverOwned: false, defaultVisible: true, defaultRequired: false },
        { code: 'HOLD_REASON', familyRequired: false, serverOwned: false, defaultVisible: true, defaultRequired: false },
        ...SERVER_OWNED_FIELDS,
      ],
      components: SHARED_COMPONENTS,
      modes: [
        {
          key: 'confirmationMode',
          kind: 'enum',
          allowedValues: ['SYNC'],
          defaultValue: 'SYNC',
          locked: true,
        },
        {
          key: 'reservationRequired',
          kind: 'boolean',
          allowedValues: ['true', 'false'],
          defaultValue: true,
          locked: false,
        },
      ],
      evidence: SHARED_EVIDENCE,
      systemCases: serverCases('SALES_ORDER'),
    },
    PURCHASE_ORDER: {
      documentType: 'PURCHASE_ORDER',
      fields: [
        { code: 'SUPPLIER', familyRequired: true, serverOwned: false, defaultVisible: true, defaultRequired: true },
        { code: 'CURRENCY', familyRequired: true, serverOwned: false, defaultVisible: true, defaultRequired: true },
        { code: 'LINES', familyRequired: true, serverOwned: false, defaultVisible: true, defaultRequired: true },
        { code: 'RECEIVING_NODE', familyRequired: true, serverOwned: false, defaultVisible: true, defaultRequired: true },
        { code: 'EXPECTED_DATE', familyRequired: false, serverOwned: false, defaultVisible: true, defaultRequired: false },
        { code: 'TERMS', familyRequired: false, serverOwned: false, defaultVisible: true, defaultRequired: false },
        ...SERVER_OWNED_FIELDS,
      ],
      components: SHARED_COMPONENTS,
      modes: [
        {
          key: 'approvalMode',
          kind: 'enum',
          allowedValues: ['NONE', 'WORKFLOW'],
          defaultValue: 'WORKFLOW',
          locked: false,
        },
        {
          key: 'dispatchMode',
          kind: 'enum',
          allowedValues: ['SYNC', 'ASYNC'],
          defaultValue: 'SYNC',
          locked: false,
        },
      ],
      evidence: [
        { code: 'CUSTOMER_ACCEPTANCE', defaultInclude: false, defaultRequired: false },
        { code: 'APPROVAL_DECISION', defaultInclude: true, defaultRequired: true },
        { code: 'PRICE_DECISION', defaultInclude: true, defaultRequired: false },
        { code: 'CREDIT_DECISION', defaultInclude: false, defaultRequired: false },
        { code: 'SUPPLIER_ACKNOWLEDGEMENT', defaultInclude: true, defaultRequired: false },
      ],
      systemCases: serverCases('PURCHASE_ORDER'),
    },
  },
};

export function defaultProfileContent(type: DocumentType, family?: ProfileFamilyRegistry): ProfileContent {
  const resolved = family ?? PROFILE_REGISTRY.families[type];
  const modes: Record<string, string | boolean> = {};
  for (const mode of resolved.modes) {
    modes[mode.key] = mode.defaultValue;
  }

  return {
    fields: resolved.fields.map((f) => ({
      code: f.code,
      visible: f.defaultVisible,
      required: f.familyRequired ? true : f.serverOwned ? false : f.defaultRequired,
    })),
    components: resolved.components.map((c) => ({
      code: c.code,
      order: c.defaultOrder,
      visible: c.mandatory ? true : c.defaultVisible,
    })),
    modes,
    evidence: resolved.evidence
      .filter((e) => e.defaultInclude)
      .map((e) => ({
        code: e.code,
        required: e.defaultRequired,
      })),
  };
}
