import type {
  FilterDescriptor,
  Panel,
  PanelManifest,
  PanelTable,
} from '../../../../shared/widgets/dashboard/analytics.model';

export type { FilterDescriptor, Panel, PanelManifest, PanelTable };

export const REPORT_TABS = ['overview', 'records', 'about'] as const;
export type ReportTab = (typeof REPORT_TABS)[number];

export interface ReportRunRequest {
  period?: { preset?: string; from?: string; to?: string };
  comparison?: { kind: 'NONE' | 'PREVIOUS_PERIOD' | 'PREVIOUS_YEAR' };
  filters?: Record<string, unknown>;
  scope?: {
    branchIds?: string[];
    ownerMode?: 'ALL' | 'TEAM' | 'OWN';
    basis?: 'CURRENT' | 'AS_OF';
    asOf?: string;
  };
  panelKeys?: string[];
  tablePage?: Record<string, { cursor?: string; limit?: number }>;
  refresh?: boolean;
  /** Send `filters.schema` back with the results; without it a run returns an empty schema. */
  includeFilterSchema?: boolean;
}

export interface PanelRowsRequest {
  period?: ReportRunRequest['period'];
  filters?: Record<string, unknown>;
  scope?: ReportRunRequest['scope'];
  cursor?: string | null;
  limit?: number;
  sort?: { key: string; direction: 'ASC' | 'DESC' };
}

export interface PanelRowsPage {
  columns: PanelTable['columns'];
  rows: unknown[][];
  pageInfo: { limit: number; hasMore: boolean; nextCursor: string | null };
  receiptId: string | null;
  coverageNotes: string[];
}

/** One row of `GET /api/v1/crm/dashboards?kind=DASHBOARD` (the fields the pin picker reads). */
export interface DashboardListRow {
  id: string;
  ownerUserId: string;
  name: string;
  kind: 'DASHBOARD' | 'REPORT';
  revision: number;
  accessLevel: 'OWNER' | 'MANAGE' | 'EDIT' | 'VIEW';
}

/** `GET /api/v1/crm/dashboards` page: `{ items, nextCursor }`. */
export interface DashboardListPage {
  items: DashboardListRow[];
  nextCursor: string | null;
}

/** One choice of a PIPELINE or SOURCE report filter. */
export interface ReportFilterOption {
  id: string;
  label: { en: string; ar: string };
}

/** Choices of the PIPELINE, SOURCE and CURRENCY report filters, read from the CRM and Core lists. */
export interface ReportFilterLookups {
  pipelines: ReportFilterOption[];
  sources: ReportFilterOption[];
  currencies: string[];
}

/** A dashboard the caller may pin to (EDIT or higher), as the pin picker shows it. */
export interface PinTarget {
  id: string;
  name: string;
  revision: number;
}

export interface PinPanelRequest {
  dashboardId: string;
  revision: number;
}

export interface PinPanelResponse {
  widgetId: string;
  placementId: string;
  dashboardRevision: number;
}
