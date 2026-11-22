import type {
  ChannelType,
  CommercialAccountRole,
  CommercialAccountStatus,
  ItemKind,
  ItemStatus,
  ItemTrackingMode,
  ListingStatus,
  UomStatus,
} from './trade-foundation.model';

export type TradeBadgeTone = 'neutral' | 'success' | 'muted' | 'danger' | 'published';

export interface TileSpec {
  readonly icon: string;
  readonly tile: string;
}

export const ITEM_STATUS_KEY: Record<ItemStatus, string> = {
  DRAFT: 'tradeShared.itemStatus.DRAFT',
  ACTIVE: 'tradeShared.itemStatus.ACTIVE',
  INACTIVE: 'tradeShared.itemStatus.INACTIVE',
  DISCONTINUED: 'tradeShared.itemStatus.DISCONTINUED',
};

export const ITEM_KIND_KEY: Record<ItemKind, string> = {
  PRODUCT: 'tradeShared.itemKind.PRODUCT',
  SERVICE: 'tradeShared.itemKind.SERVICE',
  COMBO: 'tradeShared.itemKind.COMBO',
};

export const TRACKING_KEY: Record<ItemTrackingMode, string> = {
  NONE: 'tradeShared.tracking.NONE',
  LOT: 'tradeShared.tracking.LOT',
  SERIAL: 'tradeShared.tracking.SERIAL',
};

export const CHANNEL_TYPE_KEY: Record<ChannelType, string> = {
  INTERNAL_SALES: 'tradeShared.channelType.INTERNAL_SALES',
  POS: 'tradeShared.channelType.POS',
  ECOMMERCE: 'tradeShared.channelType.ECOMMERCE',
  B2B_PORTAL: 'tradeShared.channelType.B2B_PORTAL',
  MARKETPLACE: 'tradeShared.channelType.MARKETPLACE',
  FIELD_SALES: 'tradeShared.channelType.FIELD_SALES',
  API: 'tradeShared.channelType.API',
};

export const ACCOUNT_ROLE_KEY: Record<CommercialAccountRole, string> = {
  CUSTOMER: 'tradeShared.accountRole.CUSTOMER',
  SUPPLIER: 'tradeShared.accountRole.SUPPLIER',
};

export const ACCOUNT_STATUS_KEY: Record<CommercialAccountStatus, string> = {
  ACTIVE: 'tradeShared.accountStatus.ACTIVE',
  BLOCKED: 'tradeShared.accountStatus.BLOCKED',
};

export const UOM_STATUS_KEY: Record<UomStatus, string> = {
  ACTIVE: 'tradeShared.uomStatus.ACTIVE',
  RETIRED: 'tradeShared.uomStatus.RETIRED',
};

export const LISTING_STATUS_KEY: Record<ListingStatus, string> = {
  DRAFT: 'tradeShared.listingStatus.DRAFT',
  PUBLISHED: 'tradeShared.listingStatus.PUBLISHED',
  RETIRED: 'tradeShared.listingStatus.RETIRED',
};

export const ITEM_STATUS_TONE: Record<ItemStatus, 'neutral' | 'success' | 'muted' | 'danger'> = {
  DRAFT: 'neutral',
  ACTIVE: 'success',
  INACTIVE: 'muted',
  DISCONTINUED: 'danger',
};

export const UOM_STATUS_TONE: Record<UomStatus, 'success' | 'muted'> = {
  ACTIVE: 'success',
  RETIRED: 'muted',
};

const BADGE_BASE =
  'inline-flex h-badge shrink-0 items-center justify-center rounded-8 px-8 text-12 font-medium whitespace-nowrap';

export const BADGE_CLASS: Record<TradeBadgeTone, string> = {
  neutral: `${BADGE_BASE} bg-neutral-soft text-text`,
  success: `${BADGE_BASE} bg-success text-on-success`,
  muted: `${BADGE_BASE} bg-neutral-soft text-text-muted`,
  danger: `${BADGE_BASE} bg-danger text-on-danger`,
  published: `${BADGE_BASE} bg-success-soft text-on-success-soft`,
};

export const ITEM_KIND_TILE: Record<ItemKind, TileSpec> = {
  PRODUCT: { icon: 'tablerBox', tile: 'bg-icon-blue' },
  SERVICE: { icon: 'tablerTool', tile: 'bg-icon-teal' },
  COMBO: { icon: 'tablerPackages', tile: 'bg-icon-violet' },
};

export const CHANNEL_TYPE_TILE: Record<ChannelType, TileSpec> = {
  INTERNAL_SALES: { icon: 'tablerBriefcase', tile: 'bg-icon-navy' },
  POS: { icon: 'tablerCashRegister', tile: 'bg-icon-teal' },
  ECOMMERCE: { icon: 'tablerShoppingCart', tile: 'bg-icon-blue' },
  B2B_PORTAL: { icon: 'tablerBuildingSkyscraper', tile: 'bg-icon-violet' },
  MARKETPLACE: { icon: 'tablerBuildingStore', tile: 'bg-icon-orange' },
  FIELD_SALES: { icon: 'tablerMapPin', tile: 'bg-icon-green' },
  API: { icon: 'tablerPlugConnected', tile: 'bg-icon-gray' },
};

export const ALLOWED_ITEM_STATUS_MOVES: Record<ItemStatus, readonly ItemStatus[]> = {
  DRAFT: ['ACTIVE', 'DISCONTINUED'],
  ACTIVE: ['INACTIVE', 'DISCONTINUED'],
  INACTIVE: ['ACTIVE', 'DISCONTINUED'],
  DISCONTINUED: [],
};
