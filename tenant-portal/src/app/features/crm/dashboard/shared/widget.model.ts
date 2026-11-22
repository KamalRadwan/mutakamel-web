import type { DisplaySpec, QuerySpec, Visualization } from '../../../../shared/widgets/dashboard/analytics.model';

export type WidgetSourceResource = 'leads' | 'opportunities' | 'activities' | 'customer_profiles' | 'targets';

export interface WidgetSummary {
  id: string;
  ownerUserId: string;
  ownerName: string | null;
  name: string;
  visualizationType: Visualization | null;
  querySpec: QuerySpec | null;
  displaySpec: DisplaySpec | null;
  schemaVersion: number | null;
  versionNumber: number | null;
  revision: number;
  governanceRevision: number;
  updatedAt: string;
  createdAt: string;
  accessLevel: 'OWNER' | 'EDIT' | 'VIEW';
  /** Present only when a stored EDIT share was capped to VIEW (open owner review or inactive owner). */
  capReason?: 'OWNER_REVIEW_OPEN' | 'OWNER_INACTIVE';
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  hasDraft: boolean | null;
  draftRevision: number | null;
  sourceResources: WidgetSourceResource[];
  isShared: boolean;
}

/** `WidgetDraftView` (crm-app dashboard-widget-drafts.service.ts). */
export interface WidgetDraft {
  draftId: string;
  revision: number;
  baseVersionNumber: number | null;
  schemaVersion: number;
  updatedAt: string;
  updatedByUserId: string;
  createdAt: string;
  createdByUserId: string | null;
  name: string;
  visualizationType: Visualization | null;
  querySpec: QuerySpec;
  displaySpec: DisplaySpec;
  description: string | null;
  /** Present only for readers with EDIT or OWNER access (every draft reader today). */
  internalNotes?: string | null;
  changeSummary: string | null;
  restoredFromVersionNumber: number | null;
}
