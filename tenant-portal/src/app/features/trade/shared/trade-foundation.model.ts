import type { KnownReasonKind, ReasonLocalizedNames } from './reasons/reason-kinds';

export type LocalizedNames = Record<string, string>;

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

export type ItemKind = 'PRODUCT' | 'SERVICE' | 'COMBO';
export type ItemStatus = 'DRAFT' | 'ACTIVE' | 'INACTIVE' | 'DISCONTINUED';
export type ItemTrackingMode = 'NONE' | 'LOT' | 'SERIAL';
export type ItemUsagePurpose = 'SALES' | 'PURCHASE' | 'POS';
export type UomStatus = 'ACTIVE' | 'RETIRED';
export type CategoryStatus = 'ACTIVE' | 'INACTIVE';
export type ChannelType =
  | 'INTERNAL_SALES'
  | 'POS'
  | 'ECOMMERCE'
  | 'B2B_PORTAL'
  | 'MARKETPLACE'
  | 'FIELD_SALES'
  | 'API';
export type ChannelStatus = 'ACTIVE' | 'INACTIVE';
export type ListingStatus = 'DRAFT' | 'PUBLISHED' | 'RETIRED';
export type CommercialAccountRole = 'CUSTOMER' | 'SUPPLIER';
export type CommercialAccountStatus = 'ACTIVE' | 'BLOCKED';

export interface Uom {
  id: string;
  code: string;
  displayName: string;
  localizedNames: LocalizedNames;
  status: UomStatus;
  version: number;
  updatedAt: string;
}

export interface ItemImageSummary {
  id: string;
  sequence: number;
  thumb: {
    mimeType: 'image/webp';
    widthPx: number;
    heightPx: number;
    sha256: string;
  };
  print: {
    mimeType: 'image/jpeg' | 'image/png';
    widthPx: number;
    heightPx: number;
  };
  hasAlpha: boolean;
  createdAt: string;
}

export interface CategorySummaryRef {
  id: string;
  code: string;
  name: string;
  path: { id: string; code: string; name: string }[];
  effectiveActive: boolean;
  treeVersion: number;
}

export interface ItemEligibility {
  companyProfileId: string;
  companyProfileVersion: number;
  companyProfileStatus: 'DRAFT' | 'ACTIVE';
  canSell: boolean;
  canPurchase: boolean;
  canPos: boolean;
  salesPrice: string | null;
  currencyCode: string | null;
  salesTaxId: string | null;
  purchaseTaxId: string | null;
  baseUomId: string;
  defaultSalesUomId: string;
  defaultPurchaseUomId: string;
  branchProfileId: string | null;
  branchProfileVersion: number | null;
  isAssorted: boolean | null;
}

export interface ItemRow {
  id: string;
  canonicalCode: string;
  itemKind: ItemKind;
  status: ItemStatus;
  localizedNames: LocalizedNames;
  baseUomId: string;
  categoryId: string | null;
  barcode: string | null;
  ownerUserId: string | null;
  weightKg: string | null;
  volumeM3: string | null;
  notes: string | null;
  quotationDescription: string | null;
  salesOrderDescription: string | null;
  receiptDescription: string | null;
  deliveryOrderDescription: string | null;
  variantIdentity: Record<string, unknown> | null;
  currentImageId: string | null;
  image: ItemImageSummary | null;
  categorySummary: CategorySummaryRef | null;
  /** List-only projection; null when no company profile applies (catalogue scope returns null). */
  eligibility: ItemEligibility | null;
  version: number;
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
  updatedBy: string | null;
}

export interface ComboComponent {
  componentItemId: string;
  quantity: string;
  sortOrder: number;
}

export interface OptionalProduct {
  optionalProductItemId: string;
  sortOrder: number;
}

export interface ItemCompanyProfile {
  id: string;
  itemId: string;
  companyId: string;
  canSell: boolean;
  canPurchase: boolean;
  canPos: boolean;
  trackInventory: boolean;
  trackingMode: ItemTrackingMode;
  taxClassificationKey: string | null;
  defaultSalesUomId: string | null;
  defaultPurchaseUomId: string | null;
  salesPrice: string | null;
  currencyCode: string | null;
  salesTaxId: string | null;
  purchaseTaxId: string | null;
  capabilitySet: unknown[];
  capabilitySetVersion: number;
  accountingMappingKey: string | null;
  status: 'DRAFT' | 'ACTIVE';
  version: number;
  updatedAt: string;
}

export interface ItemBranchProfile {
  id: string;
  itemCompanyProfileId: string;
  companyId: string;
  branchId: string;
  defaultFulfillmentNodeId: string | null;
  isAssorted: boolean;
  replenishmentPolicyKey: string | null;
  restrictions: Record<string, unknown>;
  version: number;
}

/** Backend detail has no eligibility (it is a list-only projection). */
export interface ItemDetail extends Omit<ItemRow, 'eligibility'> {
  companyProfile: ItemCompanyProfile | null;
  branchProfile: ItemBranchProfile | null;
  comboComponents: ComboComponent[];
  optionalProducts: OptionalProduct[];
}

export interface ItemStandardCost {
  itemId: string;
  companyProfileId: string;
  standardCost: string | null;
  currencyCode: string | null;
  version: number;
}

export interface ChannelListing {
  id: string;
  channelId: string;
  branchId: string | null;
  publicationStatus: ListingStatus;
  saleConstraints: Record<string, unknown>;
  version: number;
  updatedAt: string;
}

export interface CategoryOption {
  id: string;
  code: string;
  name: string;
  path: { id: string; code: string; name: string }[];
  depth: number;
}

export interface Channel {
  id: string;
  companyId: string;
  code: string;
  name: string;
  channelType: ChannelType;
  status: ChannelStatus;
  configurationProfileVersionId: string | null;
  activeBranchCount?: number;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface ChannelBranch {
  id: string;
  channelId: string;
  companyId: string;
  branchId: string;
  isActive: boolean;
  version: number;
}

export interface CommercialAccount {
  id: string;
  partyId: string;
  companyId: string;
  accountRole: CommercialAccountRole;
  paymentTermsId: string | null;
  creditLimit: string | null;
  creditCurrencyCode: string | null;
  priceBookId: string | null;
  creditPolicyVersionId: string | null;
  terms: {
    orderingHold?: boolean;
    allowedCurrencies?: string[];
    [k: string]: unknown;
  };
  status: CommercialAccountStatus;
  blockReasonCode: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface PartyRef {
  id: string;
  displayName: string;
  partyType: 'INDIVIDUAL' | 'ORGANIZATION';
  code: string | null;
}

// Foundation entities

export interface CategoryNode {
  id: string;
  code: string;
  displayName: string;
  localizedNames: LocalizedNames;
  parentId: string | null;
  sortOrder: number;
  status: CategoryStatus;
  version: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface Owner {
  id: string;
  name: string;
}

export interface Tax {
  id: string;
  code: string;
  name: string;
  rate: string;
  isInclusive: boolean;
  companyId: string | null;
}

export interface ReferenceData {
  owners: Owner[];
  taxes: Tax[];
  companyCurrencyCode: string | null;
}

// Cross-part views

export interface TaxDefault {
  taxId: string;
  code: string;
  name: string;
  rate: string;
  isInclusive: boolean;
}

export interface ItemSummary {
  id: string;
  sku: string;
  canonicalCode: string;
  itemKind: ItemKind;
  status: ItemStatus;
  displayName: string;
  localizedNames: LocalizedNames;
  categoryId: string | null;
  image: ItemImageSummary | null;
  baseUomId: string;
  defaultUomId: string;
  defaultPurchaseUomId: string;
  trackingMode: ItemTrackingMode;
  companyProfile: {
    id: string;
    version: number;
    canSell: boolean;
    canPurchase: boolean;
    canPos: boolean;
    trackInventory: boolean;
    trackingMode: ItemTrackingMode;
    defaultSalesUomId: string | null;
    defaultPurchaseUomId: string | null;
    salesPrice: string | null;
    currencyCode: string | null;
  } | null;
  salesTaxDefault: TaxDefault | null;
  purchaseTaxDefault: TaxDefault | null;
}

export interface CommercialAccountSummary extends CommercialAccount {
  party: PartyRef;
  partyName: string;
}

export type ReasonKind = KnownReasonKind;

export interface ReasonCode {
  id: string;
  kind: KnownReasonKind;
  code: string;
  localizedNames: ReasonLocalizedNames;
  requiresNote: boolean;
  isActive: boolean;
  sortOrder: number;
  isSystem: boolean;
  version: number;
  updatedAt: string;
}

export type StatusCounts<S extends string> = Record<S, number> & { total: number };
