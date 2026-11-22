import type { InfoPage } from '../analytics-api';

// crm-app crm/dashboards/delivery/exports/exports.dto.ts and packages/contracts/src/analytics/delivery.ts.

export type ExportFormat = 'CSV' | 'XLSX' | 'PDF';

export type ExportStatus = 'QUEUED' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED' | 'EXPIRED';

export type ExportOrigin = 'USER' | 'SUBSCRIPTION';

/** `ExportPeriodDto`: civil dates `YYYY-MM-DD`; `kind` is the preset name (max 32). Any other key is a 400. */
export interface ExportPeriod {
  from: string;
  to: string;
  kind?: string;
}

/** `CreateExportDto`: exactly one of `dashboardId` (UUID v7) or `reportKey`. `locale` defaults to `ar`. */
export interface CreateExportRequest {
  dashboardId?: string;
  reportKey?: string;
  format: ExportFormat;
  locale?: 'ar' | 'en';
  period: ExportPeriod;
  filters?: Record<string, unknown>;
  /** Narrows the requester's own scope; it can never widen it. */
  scope?: Record<string, unknown>;
  /** Max 60 keys. */
  panelKeys?: string[];
}

/** 202 body. A replay with the same key and body answers the same, always `QUEUED`. */
export interface CreateExportResponse {
  exportId: string;
  status: 'QUEUED';
}

/** `ExportDto`. A report export carries its report's backing dashboard id AND the report key. */
export interface Export {
  id: string;
  origin: ExportOrigin;
  dashboardId: string;
  reportKey: string | null;
  format: ExportFormat;
  locale: 'ar' | 'en';
  status: ExportStatus;
  rowCount: number | null;
  pageCount: number | null;
  byteSize: number | null;
  failureCode: string | null;
  queuedAt: string;
  completedAt: string | null;
  expiresAt: string | null;
  revision: number;
}

/** `CrmAnalyticsDeliveryCapabilities`: format admission; PDF carries `reason` only while unavailable. */
export interface DeliveryCapabilities {
  formats: { format: ExportFormat; available: boolean; reason?: string }[];
}

/** GET crm/analytics/exports: a keyset page plus the current format admission. */
export interface ExportListPage extends InfoPage<Export> {
  capabilities: DeliveryCapabilities;
}
