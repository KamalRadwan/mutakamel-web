import type {
  Channel,
  ComboComponent,
  ItemImageSummary,
  ItemKind,
  ItemRow,
  ItemStatus,
  ItemTrackingMode,
  ItemUsagePurpose,
  ListingStatus,
  LocalizedNames,
  OptionalProduct,
} from '../../shared/trade-foundation.model';

export type ItemListScope = 'catalogue' | 'company';
export type ItemApiScope = 'CATALOGUE' | 'COMPANY';
export type ItemView = 'board' | 'cards' | 'table';
export type ItemSortField = 'createdAt' | 'updatedAt' | 'canonicalCode' | 'name';
export type ItemSortDirection = 'asc' | 'desc';
export type ItemSortKey = 'created' | 'updated' | 'code' | 'name';

export const ITEM_VIEWS: readonly ItemView[] = ['board', 'cards', 'table'];
export const ITEM_STATUSES: readonly ItemStatus[] = ['DRAFT', 'ACTIVE', 'INACTIVE', 'DISCONTINUED'];
export const ITEM_KINDS: readonly ItemKind[] = ['PRODUCT', 'SERVICE', 'COMBO'];
export const ITEM_SORTS: readonly ItemSortKey[] = ['created', 'updated', 'code', 'name'];
export const ITEM_SORT_SPEC: Record<ItemSortKey, { sort: ItemSortField; direction: ItemSortDirection }> = {
  created: { sort: 'createdAt', direction: 'desc' },
  updated: { sort: 'updatedAt', direction: 'desc' },
  code: { sort: 'canonicalCode', direction: 'asc' },
  name: { sort: 'name', direction: 'asc' },
};

export interface ItemStatusReason {
  reasonCodeId: string;
  reasonNote?: string;
}

export interface ItemListFilter {
  search?: string;
  itemKind?: ItemKind;
  purpose?: ItemUsagePurpose;
  status?: ItemStatus;
  categoryId?: string;
  includeSubcategories?: boolean;
  ownerUserId?: string;
  hasImage?: boolean;
  scope?: ItemApiScope;
  sort?: ItemSortField;
  direction?: ItemSortDirection;
  categoryIds?: string[];
}

export interface ItemListQuery extends ItemListFilter {
  status?: ItemStatus;
  page: number;
  limit: number;
}

export type ItemStatusCounts = Record<ItemStatus | 'ALL', number>;

export interface ItemSaved extends Omit<ItemRow, 'image' | 'categorySummary' | 'eligibility'> {
  comboComponents: ComboComponent[];
  optionalProducts: OptionalProduct[];
}

export interface ItemCreateBody {
  canonicalCode: string;
  itemKind: ItemKind;
  localizedNames: LocalizedNames;
  baseUomId: string;
  categoryId?: string | null;
  barcode?: string | null;
  notes?: string | null;
  ownerUserId?: string | null;
  weightKg?: string | null;
  volumeM3?: string | null;
  quotationDescription?: string | null;
  salesOrderDescription?: string | null;
  receiptDescription?: string | null;
  deliveryOrderDescription?: string | null;
  comboComponents?: ComboComponent[];
  optionalProducts?: OptionalProduct[];
}

export type ItemPatchBody = Partial<Omit<ItemCreateBody, 'canonicalCode' | 'itemKind' | 'baseUomId'>> & {
  status?: ItemStatus;
  reasonCodeId?: string;
  reasonNote?: string;
};

export interface CompanyProfileBody {
  canSell: boolean;
  canPurchase: boolean;
  canPos?: boolean;
  trackInventory: boolean;
  trackingMode: ItemTrackingMode;
  taxClassificationKey?: string | null;
  accountingMappingKey?: string | null;
  defaultSalesUomId?: string | null;
  defaultPurchaseUomId?: string | null;
  salesPrice?: string | null;
  currencyCode?: string | null;
  salesTaxId?: string | null;
  purchaseTaxId?: string | null;
}

export type CompanyProfilePatch = Partial<CompanyProfileBody>;

export interface BranchProfileBody {
  isAssorted: boolean;
  defaultFulfillmentNodeId?: string | null;
  replenishmentPolicyKey?: string | null;
}

export type BranchProfilePatch = Partial<BranchProfileBody>;

export interface ListingCreateBody {
  channelId: string;
  publicationStatus?: ListingStatus;
}

export interface ListingPatchBody {
  publicationStatus?: ListingStatus;
}

export interface ListingChannelOption extends Channel {
  linkedToBranch: boolean | null;
}

export interface ItemImageReceipt {
  itemId: string;
  itemVersion: number;
  image: ItemImageSummary;
  replaced: boolean;
}

export interface ItemImageRemoved {
  itemId: string;
  itemVersion: number;
  removed: boolean;
}

export interface ItemReferenceData {
  owners: { id: string; name: string }[];
  taxes: { id: string; code: string; name: string; rate: string; isInclusive: boolean; companyId: string | null }[];
  companyCurrencyCode: string | null;
}

export interface FulfillmentNodeOption {
  id: string;
  branchId: string;
  localizedNames: LocalizedNames;
}

export const ITEM_PAGE_SIZES: number[] = [12, 24, 48, 96];
export const ITEM_DEFAULT_PAGE_SIZE = 24;
export const ITEM_BOARD_PAGE = 25;
export const ITEM_CODE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/;
export const POSITIVE_DECIMAL = /^(?!0(?:\.0{1,8})?$)(?:0|[1-9]\d{0,15})(?:\.\d{1,8})?$/;
export const NON_NEGATIVE_DECIMAL = /^(?:0|[1-9]\d{0,15})(?:\.\d{1,8})?$/;
export const ITEM_IMAGE_RULES = {
  types: ['image/png', 'image/jpeg', 'image/webp'],
  maxBytes: 10_485_760,
  minEdge: 32,
} as const;
export const ITEM_LIMITS = {
  code: 80,
  name: 200,
  barcode: 128,
  description: 500,
  notes: 4000,
  key: 80,
  components: 500,
  sortOrder: 10000,
} as const;
