import { ApiError } from '../../shared/trade-api';
import type { CategoryStatus, LocalizedNames } from '../../shared/trade-foundation.model';

export interface CategoryPathStep {
  id: string;
  code: string;
  name: string;
  siblingPosition: number;
  siblingTotal: number;
}

export interface CategorySummary {
  id: string;
  code: string;
  displayName: string;
  name: string;
  parentId: string | null;
  sortOrder: number;
  status: CategoryStatus;
  version: number;
  effectiveActive: boolean;
  inactiveAncestorId: string | null;
  depth: number;
  childCount: number;
  hasChildren: boolean;
  path: CategoryPathStep[];
}

export interface CategoryPage {
  items: CategorySummary[];
  total: number;
  page: number;
  limit: number;
  treeVersion: number;
  asOf: string;
}

export interface CategoryTreePage extends CategoryPage {
  parentId: string | null;
}

export type DeleteBlocker = 'ACTIVE' | 'HAS_CHILDREN' | 'HAS_ITEM_REFERENCES';

export interface CategoryUsage {
  directItemCount: number;
  subtreeItemCount: number;
  descendantCount: number;
  hasRetainedItemReferences: boolean;
  canDelete: boolean;
  deleteBlockers: DeleteBlocker[];
  asOf: string;
}

export interface CategoryDetail extends CategorySummary {
  localizedNames: LocalizedNames;
  treeVersion: number;
  subtreeHeight: number;
  createdAt: string;
  updatedAt: string;
  usage: CategoryUsage;
}

export interface CategoryReceipt {
  id: string;
  version: number;
  treeVersion: number;
  changed: boolean;
}

export interface CategoryDeleteReceipt {
  id: string;
  deleted: true;
  version: number;
  treeVersion: number;
  deletedAt: string;
}

export interface CategorySearch {
  search?: string;
  parentId?: 'ROOT' | string;
  ancestorId?: string;
  moveSourceId?: string;
  status?: CategoryStatus;
  page?: number;
  limit?: number;
}

export interface CreateCategoryBody {
  expectedTreeVersion: number;
  code: string;
  displayName: string;
  localizedNames: LocalizedNames;
  parentId?: string | null;
  beforeId?: string | null;
}

export interface RenameCategoryBody {
  displayName?: string;
  localizedNames?: LocalizedNames;
}

export interface MoveCategoryBody {
  expectedTreeVersion: number;
  parentId: string | null;
  beforeId?: string | null;
}

export interface ReorderCategoryBody {
  expectedTreeVersion: number;
  beforeId: string | null;
}

export interface CategoryReasonPayload {
  reasonCodeId: string;
  reasonNote?: string;
}

export interface SetCategoryStatusBody {
  expectedTreeVersion: number;
  status: CategoryStatus;
  reasonCodeId: string;
  reasonNote?: string;
}

export interface DeleteCategoryBody {
  expectedTreeVersion: number;
  reasonCodeId: string;
  reasonNote?: string;
}

export type CategoryViewMode = 'rows' | 'columns' | 'chart';
export const CATEGORY_VIEW_MODES: readonly CategoryViewMode[] = ['rows', 'columns', 'chart'];

export type CategoryStatusFilter = 'ALL' | CategoryStatus;

export type CategoryNodeAction =
  | 'open'
  | 'addChild'
  | 'move'
  | 'moveUp'
  | 'moveDown'
  | 'activate'
  | 'deactivate'
  | 'delete'
  | 'showInTree';

export interface CategoryActionEvent {
  node: CategorySummary;
  action: CategoryNodeAction;
}

export interface CategoryReorderEvent {
  id: string;
  parentId: string | null;
  beforeId: string | null;
}

export const CATEGORY_MAX_DEPTH = 8;
export const CATEGORY_CODE_MAX = 80;
export const CATEGORY_NAME_MAX = 160;
export const CATEGORY_REASON_MAX = 500;
export const CATEGORY_CODE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/;
export const CATEGORY_LOCALE_KEY_PATTERN = /^[a-z]{2}(?:-[A-Z]{2})?$/;
export const CATEGORY_CONTROL_BIDI_PATTERN = /[\u0000-\u001F\u007F\u200E-\u200F\u202A-\u202E\u2066-\u2069]/;

export function categoryDepthTile(depth: number): string {
  if (depth <= 1) return 'bg-icon-navy';
  if (depth === 2) return 'bg-icon-blue';
  if (depth === 3) return 'bg-icon-teal';
  return 'bg-icon-gray';
}

export function isMutedByAncestor(node: Pick<CategorySummary, 'status' | 'effectiveActive'>): boolean {
  return node.status === 'ACTIVE' && !node.effectiveActive;
}

export function categoryNodeTile(node: Pick<CategorySummary, 'depth' | 'status' | 'effectiveActive'>): string {
  return isMutedByAncestor(node) ? 'bg-icon-gray' : categoryDepthTile(node.depth);
}

export function inactiveAncestorName(node: Pick<CategorySummary, 'inactiveAncestorId' | 'path'>): string {
  if (!node.inactiveAncestorId) return '';
  return node.path.find((step) => step.id === node.inactiveAncestorId)?.name ?? '';
}

export function formatCategoryPathText(steps: readonly { name: string }[], rtl: boolean): string {
  if (steps.length === 0) return '';
  const separator = rtl ? ' \u200F›\u200F ' : ' › ';
  return steps.map((step) => step.name).join(separator);
}

export function normalizeClientText(raw: string): string {
  return raw.normalize('NFC').trim().replace(/\s+/g, ' ');
}

export function deleteBlockerKey(blocker: DeleteBlocker): string {
  switch (blocker) {
    case 'ACTIVE':
      return 'tradeCategories.reason.deactivateFirst';
    case 'HAS_CHILDREN':
      return 'tradeCategories.reason.hasChildren';
    case 'HAS_ITEM_REFERENCES':
      return 'tradeCategories.reason.itemsUseIt';
  }
}

export type CategoryConflictStale = 'TREE' | 'NODE' | null;

export function staleKindOf(error: unknown): CategoryConflictStale {
  if (!(error instanceof ApiError)) return null;
  const stale: unknown = error.details?.['stale'];
  if (!Array.isArray(stale)) return null;
  const kinds = stale
    .filter((entry: unknown): entry is string => typeof entry === 'string')
    .map((entry) => entry.toLowerCase());
  if (kinds.includes('tree')) return 'TREE';
  if (kinds.includes('node')) return 'NODE';
  return null;
}
