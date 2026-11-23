import type {
  Channel,
  ChannelBranch,
  ChannelStatus,
  ChannelType,
  StatusCounts,
} from '../../shared/trade-foundation.model';

export interface ChannelRow extends Channel {
  activeBranchCount: number;
}

export interface ChannelBranchLink extends ChannelBranch {
  branchName: string | null;
  branchNameAr: string | null;
}

export interface ChannelDetail extends Channel {
  branches: ChannelBranchLink[];
}

export interface ChannelBranchInput {
  branchId: string;
  isActive: boolean;
}

export interface ChannelCreateBody {
  code: string;
  name: string;
  channelType: ChannelType;
}

export interface ChannelPatchBody {
  name?: string;
  status?: ChannelStatus;
}

export type ChannelSortField = 'createdAt' | 'code' | 'name';
export type ChannelSortDirection = 'asc' | 'desc';

export interface ChannelCountFilter {
  search?: string;
  channelType?: ChannelType | readonly ChannelType[];
}

export interface ChannelListQuery extends ChannelCountFilter {
  status?: ChannelStatus;
  sort?: ChannelSortField;
  direction?: ChannelSortDirection;
  page?: number;
  limit?: number;
}

export interface ChannelListResult {
  items: ChannelRow[];
  total: number;
  page: number;
  limit: number;
}

export type ChannelStatusCounts = StatusCounts<ChannelStatus>;

export const CHANNEL_TYPES: readonly ChannelType[] = [
  'INTERNAL_SALES',
  'POS',
  'ECOMMERCE',
  'B2B_PORTAL',
  'MARKETPLACE',
  'FIELD_SALES',
  'API',
];

export const CHANNEL_CODE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/;

export const CHANNEL_LIMITS = {
  code: 80,
  name: 160,
  page: 100,
} as const;

export type ChannelStatusFilter = 'active' | 'inactive' | 'all';
