export type { WidgetDraft, WidgetSummary } from '../shared/widget.model';
export type {
  DashboardFilters,
  DisplaySpec,
  PanelOutcome,
  QuerySpec,
  Share,
  ShareListItem,
  SharePreview,
  Visualization,
  WidgetExecution,
} from '../../../../shared/widgets/dashboard/analytics.model';

import type {
  DisplaySpec,
  QuerySpec,
  Visualization,
} from '../../../../shared/widgets/dashboard/analytics.model';
import type { WidgetDraft, WidgetSummary } from '../shared/widget.model';

export type WidgetSourceResource =
  | 'leads'
  | 'opportunities'
  | 'activities'
  | 'customer_profiles'
  | 'targets';

export type WidgetAccessFilter = 'OWNED' | 'SHARED' | 'TEAM';
export type WidgetStatus = 'PUBLISHED' | 'DRAFT' | 'ARCHIVED';

export interface WidgetListQuery {
  search?: string;
  access?: WidgetAccessFilter;
  status?: WidgetStatus;
  source?: string;
  ownerUserId?: string;
  cursor?: string | null;
  limit?: number;
}

export interface WidgetUsagePlacement {
  placementId: string;
  dashboardId: string;
  dashboardName: string;
  dashboardRevision: number;
  /** Grid-48 primary (desktop) box; null when the placement has no primary layout row (LEFT JOIN). */
  x: number | null;
  y: number | null;
  w: number | null;
  h: number | null;
}

export interface WidgetDetail extends WidgetSummary {
  usage: {
    /** The owner counts every placement; other readers count the ones on dashboards they can see. */
    placementCount: number;
    dashboardCount: number;
    /** Owner only (absent for other readers). */
    activeShareCount?: number;
    /** Owner only: placements on dashboards the owner cannot see; always 0 for other readers. */
    hiddenPlacementCount: number;
    placements: WidgetUsagePlacement[];
    nextCursor: string | null;
  };
}

export interface DraftState {
  widgetId: string;
  widgetRevision: number;
  governanceRevision: number;
  activeVersionNumber: number | null;
  draft: WidgetDraft | null;
}

export interface WidgetBody {
  name: string;
  visualizationType: Visualization;
  querySpec: QuerySpec;
  displaySpec: DisplaySpec;
  description?: string | null;
  internalNotes?: string | null;
  changeSummary?: string | null;
}

export interface DependentRef {
  id: string;
  name: string;
}

export interface PublishImpact {
  impactId: string;
  expiresAt: string;
  widgetId: string;
  widgetRevision: number;
  governanceRevision: number;
  draftId: string;
  draftRevision: number;
  nextVersionNumber: number;
  dashboards: { id: string; name: string; revision: number; affected: boolean }[];
  layoutAdjustments: { placementId: string; dashboardId: string; x: number; y: number; w: number; h: number }[];
  /** Counts cover every dependent; items (at most 50 each) are the ones the actor owns or receives. */
  dependents: {
    alertRules: { count: number; items: (DependentRef & { enabled: boolean; suspendedReason: string | null })[] };
    subscriptions: { count: number; items: (DependentRef & { dashboardId: string })[] };
    /** REPORT blueprints whose active revision depends on a metric of the draft (tenant catalogue entries). */
    reports: { count: number; items: { blueprintKey: string; definitionRevision: number; name: string }[] };
  };
  suspendedAlertRules: { count: number; items: (DependentRef & { suspendedReason: string })[] };
}

export interface PublishImpactBody {
  expectedWidgetRevision: number;
  expectedGovernanceRevision: number;
  expectedDraftId: string;
  expectedDraftRevision: number;
}

export type PublishWidgetBody =
  | (PublishImpactBody & { impactId: string })
  | (Record<string, unknown> & { impactId: string });

export interface PublishWidgetResult {
  widgetId: string;
  versionNumber: number;
  widgetRevision: number;
  sourceDraftId: string;
  sourceDraftRevision: number;
  publishedAt: string;
  dashboardRevisions: Record<string, number>;
  replayed: boolean;
}

export interface LifecycleImpact {
  impactId: string;
  expiresAt: string;
  widgetId: string;
  action: 'ARCHIVE' | 'RESTORE';
  widgetRevision: number;
  governanceRevision: number;
  activeVersionNumber: number | null;
  hiddenPlacementCount: number;
  placements: {
    dashboardId: string;
    dashboardName: string;
    dashboardRevision: number;
    placementId: string;
    versionPolicy: 'FOLLOW_ACTIVE' | 'PINNED';
    versionNumber: number | null;
    eligibleToResume: boolean;
  }[];
  /** ARCHIVE: live rules the archive suspends. RESTORE: rules suspended WIDGET_UNAVAILABLE their owners must resume. */
  alertRules: {
    effect: 'WILL_SUSPEND' | 'OWNER_MUST_RESUME';
    count: number;
    items: (DependentRef & { enabled: boolean; suspendedReason: string | null })[];
  };
}

export interface LifecycleImpactBody {
  action: 'ARCHIVE' | 'RESTORE';
  expectedWidgetRevision: number;
  expectedGovernanceRevision: number;
}

export interface ApplyLifecycleBody extends LifecycleImpactBody {
  impactId: string;
  reason?: string;
}

export interface ApplyLifecycleResult {
  widgetId: string;
  widgetRevision: number;
  governanceRevision: number;
  activeVersionNumber: number | null;
  /** RESTORE of a never-published widget answers DRAFT. */
  status: WidgetStatus;
  affectedDashboardCount: number;
}

export interface VersionSnapshot {
  versionNumber: number;
  name: string;
  visualizationType: Visualization;
  schemaVersion: number;
  querySpec: QuerySpec;
  displaySpec: DisplaySpec;
  publishedAt: string | null;
  provenance: string;
  description: string | null;
  internalNotes: string | null;
  changeSummary: string | null;
  restoredFromVersionNumber: number | null;
  authoredByUserId: string | null;
}

export interface VersionCompare {
  widgetId: string;
  widgetRevision: number;
  governanceRevision: number;
  activeVersionNumber: number;
  archived: boolean;
  left: VersionSnapshot;
  right: VersionSnapshot;
  changedSections: ('NAME' | 'VISUALIZATION' | 'SCHEMA' | 'QUERY' | 'DISPLAY' | 'NOTES')[];
  restoreState: 'AVAILABLE' | 'DRAFT_EXISTS' | 'PERMISSION_REQUIRED';
  proof: { impactId: string; expiresAt: string } | null;
}

export interface WidgetVersionItem {
  versionNumber: number;
  name: string;
  publishedAt: string | null;
  provenance: string;
}

export interface WidgetVersionsPage {
  widgetId: string;
  widgetRevision: number;
  /** Null for a never-published widget (then `items` is empty). */
  activeVersionNumber: number | null;
  items: WidgetVersionItem[];
  nextBeforeVersion: number | null;
}

export interface RestoreVersionBody {
  leftVersionNumber: number;
  rightVersionNumber: number;
  sourceVersionNumber: number;
  expectedWidgetRevision: number;
  expectedGovernanceRevision: number;
  impactId: string;
  acknowledged: true;
}

/** The widget head an ownership-transfer impact describes (`METADATA` in dashboard-widget-ownership.service.ts). */
export interface TransferWidgetHead {
  id: string;
  ownerUserId: string;
  ownerName: string | null;
  name: string;
  widgetRevision: number;
  governanceRevision: number;
  activeVersionNumber: number | null;
  draftRevision: number | null;
  archived: boolean;
}

export interface TransferImpact {
  impactId: string;
  expiresAt: string;
  widget: TransferWidgetHead;
  target: { id: string; name: string };
  affectedPlacementCount: number;
  retainedShareCount: number;
  dashboardOwnerAccessLostCount: number;
  dashboardOwnerAccessRestoredCount: number;
  dashboardReadersMayNeedShareCount: number;
  /** O-7 flag (`CRM_TRANSFER_REVOKES_SHARES`, off by default): shares are kept unless it is on. */
  sharesRevokedOnTransfer: boolean;
}

export interface TransferImpactBody {
  targetUserId: string;
  expectedWidgetRevision: number;
  expectedGovernanceRevision: number;
}

export interface TransferWidgetBody extends TransferImpactBody {
  impactId: string;
  reason: string;
  acknowledged: true;
  /** The OPEN owner review this transfer resolves; when omitted, an OPEN review proposing the same target is adopted. */
  ownerReviewId?: string;
}

/** PATCH widgets/:id/ownership-transfer result. */
export interface TransferWidgetResult {
  widgetId: string;
  previousOwnerUserId: string;
  ownerUserId: string;
  widgetRevision: number;
  governanceRevision: number;
  affectedPlacementCount: number;
  retainedShareCount: number;
  revokedShareCount: number;
  dashboardOwnerAccessLostCount: number;
  dashboardOwnerAccessRestoredCount: number;
  dashboardReadersMayNeedShareCount: number;
  ownerReviewId: string | null;
}

/** POST widgets/:id/versions/restore-draft result: the draft state plus the restored version number. */
export type RestoreVersionResult = DraftState & { restoredFromVersionNumber: number };

export interface GovernedTargetOption {
  id: string;
  branchId: string;
  subjectType: 'USER' | 'TEAM' | 'BRANCH';
  subjectId: string;
  subjectName: string;
  currencyCode: string;
  periodGrain: 'MONTH' | 'QUARTER' | 'YEAR';
  periodStart: string;
  /** MONEY targets carry a currency; PERCENT (rate) targets have an empty currencyCode. */
  unit: 'MONEY' | 'PERCENT';
  /** Decimal string rounded to 2 decimals. */
  targetValue: string;
}

export interface WidgetTabCounts {
  mine: number;
  shared: number;
  published: number;
}
