export * from '../../../../shared/widgets/dashboard/analytics.model';
import type {
  DashboardFilters,
  DisplaySpec,
  QuerySpec,
  UnavailablePlacement,
  Visualization,
} from '../../../../shared/widgets/dashboard/analytics.model';

/** Definition access. MANAGE comes from a MANAGE share (API-gated today, so rare). */
export type DashboardAccessLevel = 'OWNER' | 'MANAGE' | 'EDIT' | 'VIEW';

/** One row of GET dashboards (`DashboardListRow`, crm-app dashboard-access.service.ts). */
export interface DashboardSummary {
  id: string;
  ownerUserId: string;
  ownerName: string | null;
  name: string;
  kind: 'DASHBOARD' | 'REPORT';
  description: string | null;
  defaultFilters: DashboardFilters;
  sourceTemplateKey: string | null;
  schemaVersion: number;
  revision: number;
  createdAt: string;
  updatedAt: string;
  accessLevel: DashboardAccessLevel;
  /** Present only when a stored EDIT/MANAGE share was capped to VIEW (open owner review or inactive owner). */
  capReason?: 'OWNER_REVIEW_OPEN' | 'OWNER_INACTIVE';
  isShared: boolean;
  isDefault: boolean;
  isFavorite: boolean;
  lastOpenedAt: string | null;
  /** The stored blueprint key (REPORT rows and adopted blueprint dashboards); null for user-built ones. The list
   * carries no blueprintRevision or templateVersionPolicy: those are detail-only. */
  blueprintKey: string | null;
}

export interface EmbeddedWidget {
  id: string;
  ownerUserId: string;
  ownerName: string | null;
  name: string;
  visualizationType: Visualization;
  querySpec: QuerySpec;
  displaySpec: DisplaySpec;
  schemaVersion: number;
  revision: number;
  updatedAt: string;
  versionNumber: number;
}

/** Detail placement (dashboard-definitions.service.ts detail()). Geometry lives in `layouts`, never here. */
export interface Placement {
  id: string;
  dashboardId: string;
  widgetId: string;
  sortOrder: number;
  versionPolicy: 'FOLLOW_ACTIVE' | 'PINNED';
  pinnedVersionNumber: number | null;
  widget: EmbeddedWidget;
}

export interface LayoutItem {
  placementId: string;
  x: number;
  y: number;
  w: number;
  h: number;
  zIndex: number;
  isHidden: boolean;
  origin: 'MANUAL' | 'DERIVED' | 'MIGRATED' | 'BLUEPRINT' | 'LEGACY_SYNC';
}

/** An unavailable placement as GET dashboards/:id lists it: id, order and reason only (no geometry). */
export type DetailUnavailablePlacement = Pick<UnavailablePlacement, 'id' | 'sortOrder' | 'reason'>;

/** GET dashboards/:id. No `capReason` and no `lastOpenedAt` here (list-only fields). */
export interface DashboardDetail extends Omit<DashboardSummary, 'lastOpenedAt' | 'capReason'> {
  blueprintRevision: number | null;
  templateVersionPolicy: 'FOLLOW_ACTIVE' | 'PINNED' | null;
  layoutCollisionMode: 'PUSH' | 'BLOCK' | 'ALLOW_OVERLAP';
  isLayoutLocked: boolean;
  breakpoints: {
    breakpointKey: string;
    gridColumns: number;
    rowHeightPx: number;
    minViewportPx: number;
    derivesFromKey: string | null;
    isPrimary: boolean;
    sortOrder: number;
  }[];
  layouts: Record<string, { origin: 'MATERIALIZED' | 'DERIVED'; items: LayoutItem[] }>;
  placements: Placement[];
  unavailablePlacements: DetailUnavailablePlacement[];
  widgets: EmbeddedWidget[];
}

export interface NavigationItem {
  id: string;
  name: string;
  isDefault: boolean;
  isFavorite: boolean;
  isShared: boolean;
  accessLevel: DashboardAccessLevel;
  ownerUserId: string;
  ownerName: string | null;
  revision: number;
  updatedAt: string;
}

export interface BlueprintItem {
  key: string;
  definitionRevision: number;
  audience: 'USER' | 'TEAM_LEADER' | 'CRM_ADMIN' | 'ALL_BRANCHES' | 'DEFINITION_ADMIN';
  name: string;
  /** Present only when the blueprint payload carries an Arabic name. */
  nameAr?: string;
  description: string;
  descriptionAr?: string;
  widgetCount: number;
  branchSelectionRequired: boolean;
  /** `comparison.target` of each TARGET widget: a JSON number (not a decimal string). */
  targets: { widgetName: string; target: number }[];
  adoption:
    | { state: 'AVAILABLE' }
    | { state: 'ADOPTED_ELSEWHERE' }
    | { state: 'ADOPTED'; dashboardId: string; definitionRevision: number };
}

/**
 * One drill record: only the fields of the metric's projection are present, and any present field may be null
 * (dashboard-drilldown.service.ts redactRecord). Dates are ISO strings; `amount` is a float number.
 */
export interface DrillRecord {
  id: string;
  entityType?: string | null;
  title?: string | null;
  status?: string | null;
  stageName?: string | null;
  ownerName?: string | null;
  branchName?: string | null;
  pipelineName?: string | null;
  sourceName?: string | null;
  activityType?: string | null;
  reason?: string | null;
  amount?: number | null;
  currencyCode?: string | null;
  rank?: number | null;
  value?: number | null;
  occurredAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  dueAt?: string | null;
  closedAt?: string | null;
  convertedAt?: string | null;
}

export interface DrillResult {
  dashboardId: string;
  widgetId: string;
  placementId: string;
  widgetRevision: number;
  versionNumber: number;
  selection: { pointKey: string; seriesKey?: string };
  records: DrillRecord[];
  pageInfo: { limit: number; hasMore: boolean; nextCursor: string | null };
}

export interface ScopeInspector {
  userId: string;
  effectiveLevel: 'OWNER' | 'MANAGE' | 'EDIT' | 'VIEW' | 'NONE';
  capReason: 'OWNER_REVIEW_OPEN' | 'OWNER_INACTIVE' | null;
  branches: string[] | 'ALL';
  ownerMode: 'ALL' | 'TEAM' | 'OWN';
  sources: { resource: string; granted: boolean; scope: 'own' | 'team' | 'all' | null }[];
  permissionRevision: number;
}

export interface VersionBinding {
  dashboardId: string;
  placementId: string;
  widgetId: string;
  dashboardRevision: number;
  widgetRevision: number;
  governanceRevision: number;
  versionPolicy: 'FOLLOW_ACTIVE' | 'PINNED';
  pinnedVersionNumber: number | null;
  activeVersionNumber: number;
  selectedVersionNumber: number;
  placement: { x: number; y: number; w: number; h: number };
}

/** POST .../version-policy/impact `proposed` (dashboard-placement-version.service.ts plan()). */
export interface VersionPolicyProposal {
  versionPolicy: 'FOLLOW_ACTIVE' | 'PINNED';
  /** Echo of the request (null for FOLLOW_ACTIVE). */
  pinnedVersionNumber: number | null;
  selectedVersionNumber: number;
  placement: { x: number; y: number; w: number; h: number };
  visualizationType: Visualization;
  layoutChanged: boolean;
  changed: boolean;
}

/** PATCH .../version-policy: the binding after the change; `changed: false` is a no-op (no revision bump). */
export type VersionBindingResult = VersionBinding & { changed: boolean };

/** PUT dashboards/blueprints/:blueprintKey/adoption. */
export interface BlueprintAdoptionResult {
  dashboardId: string;
  definitionRevision: number;
  /** false when an existing adoption (or a replay) answered. */
  created: boolean;
}
