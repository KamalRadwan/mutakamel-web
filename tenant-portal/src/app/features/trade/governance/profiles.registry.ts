import type { ProfileContent } from './profiles.model';

export type DocumentType = 'QUOTATION' | 'SALES_ORDER' | 'PURCHASE_ORDER';

export const DOCUMENT_TYPES: readonly DocumentType[] = [
  'QUOTATION',
  'SALES_ORDER',
  'PURCHASE_ORDER',
];

export const PROFILE_REGISTRY_VERSION = '2026.11.1';

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
  { code: 'PARTIES', mandatory: false, defaultOrder: 20, defaultVisible: true },
  { code: 'LINE_ITEMS', mandatory: true, defaultOrder: 30, defaultVisible: true },
  { code: 'TOTALS', mandatory: false, defaultOrder: 40, defaultVisible: true },
  { code: 'TERMS', mandatory: false, defaultOrder: 50, defaultVisible: true },
  { code: 'DELIVERY', mandatory: false, defaultOrder: 60, defaultVisible: true },
  { code: 'ATTACHMENTS', mandatory: false, defaultOrder: 70, defaultVisible: true },
  { code: 'AUDIT_HISTORY', mandatory: false, defaultOrder: 80, defaultVisible: false },
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
        { code: 'customerAccountId', familyRequired: true, serverOwned: false, defaultVisible: true, defaultRequired: true },
        { code: 'contactPartyId', familyRequired: false, serverOwned: false, defaultVisible: true, defaultRequired: false },
        { code: 'currencyCode', familyRequired: true, serverOwned: false, defaultVisible: true, defaultRequired: true },
        { code: 'validUntil', familyRequired: true, serverOwned: false, defaultVisible: true, defaultRequired: true },
        { code: 'paymentTermsId', familyRequired: false, serverOwned: false, defaultVisible: true, defaultRequired: false },
        { code: 'branchId', familyRequired: false, serverOwned: false, defaultVisible: true, defaultRequired: false },
        { code: 'channelId', familyRequired: false, serverOwned: false, defaultVisible: true, defaultRequired: false },
        { code: 'externalReference', familyRequired: false, serverOwned: false, defaultVisible: true, defaultRequired: false },
        { code: 'notes', familyRequired: false, serverOwned: false, defaultVisible: true, defaultRequired: false },
        { code: 'documentNumber', familyRequired: false, serverOwned: true, defaultVisible: true, defaultRequired: false },
        { code: 'grandTotal', familyRequired: false, serverOwned: true, defaultVisible: true, defaultRequired: false },
        { code: 'approvalStatus', familyRequired: false, serverOwned: true, defaultVisible: false, defaultRequired: false },
      ],
      components: SHARED_COMPONENTS,
      modes: [
        {
          key: 'acceptanceMode',
          kind: 'enum',
          allowedValues: ['INTERNAL_AUTHORIZED_ONLY'],
          defaultValue: 'INTERNAL_AUTHORIZED_ONLY',
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
        { code: 'customerAccountId', familyRequired: true, serverOwned: false, defaultVisible: true, defaultRequired: true },
        { code: 'contactPartyId', familyRequired: false, serverOwned: false, defaultVisible: true, defaultRequired: false },
        { code: 'currencyCode', familyRequired: true, serverOwned: false, defaultVisible: true, defaultRequired: true },
        { code: 'orderDate', familyRequired: true, serverOwned: false, defaultVisible: true, defaultRequired: true },
        { code: 'requestedDeliveryDate', familyRequired: false, serverOwned: false, defaultVisible: true, defaultRequired: false },
        { code: 'paymentTermsId', familyRequired: false, serverOwned: false, defaultVisible: true, defaultRequired: false },
        { code: 'branchId', familyRequired: false, serverOwned: false, defaultVisible: true, defaultRequired: false },
        { code: 'channelId', familyRequired: false, serverOwned: false, defaultVisible: true, defaultRequired: false },
        { code: 'notes', familyRequired: false, serverOwned: false, defaultVisible: true, defaultRequired: false },
        { code: 'documentNumber', familyRequired: false, serverOwned: true, defaultVisible: true, defaultRequired: false },
        { code: 'grandTotal', familyRequired: false, serverOwned: true, defaultVisible: true, defaultRequired: false },
        { code: 'confirmationStatus', familyRequired: false, serverOwned: true, defaultVisible: true, defaultRequired: false },
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
        { code: 'supplierAccountId', familyRequired: true, serverOwned: false, defaultVisible: true, defaultRequired: true },
        { code: 'contactPartyId', familyRequired: false, serverOwned: false, defaultVisible: true, defaultRequired: false },
        { code: 'currencyCode', familyRequired: true, serverOwned: false, defaultVisible: true, defaultRequired: true },
        { code: 'orderDate', familyRequired: true, serverOwned: false, defaultVisible: true, defaultRequired: true },
        { code: 'expectedReceiptDate', familyRequired: false, serverOwned: false, defaultVisible: true, defaultRequired: false },
        { code: 'paymentTermsId', familyRequired: false, serverOwned: false, defaultVisible: true, defaultRequired: false },
        { code: 'branchId', familyRequired: false, serverOwned: false, defaultVisible: true, defaultRequired: false },
        { code: 'externalReference', familyRequired: false, serverOwned: false, defaultVisible: true, defaultRequired: false },
        { code: 'notes', familyRequired: false, serverOwned: false, defaultVisible: true, defaultRequired: false },
        { code: 'documentNumber', familyRequired: false, serverOwned: true, defaultVisible: true, defaultRequired: false },
        { code: 'grandTotal', familyRequired: false, serverOwned: true, defaultVisible: true, defaultRequired: false },
        { code: 'approvalStatus', familyRequired: false, serverOwned: true, defaultVisible: true, defaultRequired: false },
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
          allowedValues: ['IMMEDIATE', 'QUEUED'],
          defaultValue: 'IMMEDIATE',
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

export function defaultProfileContent(type: DocumentType): ProfileContent {
  const family = PROFILE_REGISTRY.families[type];
  const modes: Record<string, string | boolean> = {};
  for (const mode of family.modes) {
    modes[mode.key] = mode.defaultValue;
  }

  return {
    fields: family.fields.map((f) => ({
      code: f.code,
      visible: f.defaultVisible,
      required: f.familyRequired ? true : f.serverOwned ? false : f.defaultRequired,
    })),
    components: family.components.map((c) => ({
      code: c.code,
      order: c.defaultOrder,
      visible: c.mandatory ? true : c.defaultVisible,
    })),
    modes,
    evidence: family.evidence.map((e) => ({
      code: e.code,
      include: e.defaultInclude,
      required: e.defaultRequired,
    })),
  };
}
