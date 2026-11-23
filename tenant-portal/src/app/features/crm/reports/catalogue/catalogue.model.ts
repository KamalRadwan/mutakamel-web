import type { ReportDomain } from '../../../../shared/widgets/dashboard/analytics.model';

export type { ReportDomain };

export type ReportReadiness = 'READY' | 'EXPERIMENTAL' | 'DEGRADED' | 'NOT_READY' | 'UNAVAILABLE';

export interface ReportCatalogueItem {
  reportKey: string;
  domain: ReportDomain;
  code: string | null;
  title: { en: string; ar: string };
  summary: { en: string; ar: string } | null;
  blueprintRevision: number;
  readiness: ReportReadiness;
  available?: boolean;
  favourite: boolean;
  dashboardId: string | null;
  pinnedCount: number;
}

export type CatalogueView = 'cards' | 'table';

export type ReportBasis = 'asOfNow' | 'eventPeriod';

export interface ReportDomainMeta {
  icon: string;
  tile: string;
  basis: ReportBasis;
}

export const REPORT_DOMAINS: readonly ReportDomain[] = [
  'acquisition',
  'lead-conversion',
  'lead-lifecycle',
  'pipeline',
  'response-sla',
  'activities',
  'team-performance',
  'forecast-targets',
  'customers',
  'commercial',
  'email',
  'data-governance',
];

export const REPORT_DOMAIN_META: Record<ReportDomain, ReportDomainMeta> = {
  acquisition: { icon: 'tablerTrendingUp', tile: 'bg-icon-teal', basis: 'eventPeriod' },
  'lead-conversion': { icon: 'tablerArrowsExchange', tile: 'bg-icon-green', basis: 'eventPeriod' },
  'lead-lifecycle': { icon: 'tablerUserPlus', tile: 'bg-icon-blue', basis: 'asOfNow' },
  pipeline: { icon: 'tablerTarget', tile: 'bg-icon-red', basis: 'asOfNow' },
  'response-sla': { icon: 'tablerClockCheck', tile: 'bg-icon-orange', basis: 'eventPeriod' },
  activities: { icon: 'tablerChecklist', tile: 'bg-icon-violet', basis: 'eventPeriod' },
  'team-performance': { icon: 'tablerUsersGroup', tile: 'bg-icon-navy', basis: 'eventPeriod' },
  'forecast-targets': { icon: 'tablerTargetArrow', tile: 'bg-icon-red', basis: 'asOfNow' },
  customers: { icon: 'tablerUsers', tile: 'bg-icon-blue', basis: 'asOfNow' },
  commercial: { icon: 'tablerFileInvoice', tile: 'bg-icon-teal', basis: 'eventPeriod' },
  email: { icon: 'tablerMail', tile: 'bg-icon-blue', basis: 'eventPeriod' },
  'data-governance': { icon: 'tablerShieldCheck', tile: 'bg-icon-gray', basis: 'asOfNow' },
};

const DOMAIN_ORDER = new Map<ReportDomain, number>(REPORT_DOMAINS.map((domain, index) => [domain, index]));

export function isReportDisabled(readiness: ReportReadiness): boolean {
  return readiness === 'NOT_READY' || readiness === 'UNAVAILABLE';
}

/** Entries per domain, counted on the client from catalogue rows (the backend returns no counts). */
export function countByDomain(items: readonly Pick<ReportCatalogueItem, 'domain'>[]): Record<ReportDomain, number> {
  const counts = Object.fromEntries(REPORT_DOMAINS.map((domain) => [domain, 0])) as Record<ReportDomain, number>;
  for (const item of items) {
    if (item.domain in counts) counts[item.domain] += 1;
  }
  return counts;
}

export function readinessBadge(readiness: ReportReadiness): {
  tone: 'success' | 'warning' | 'none';
  key: 'ready' | 'partial' | 'notConnected';
} {
  switch (readiness) {
    case 'READY':
      return { tone: 'success', key: 'ready' };
    case 'EXPERIMENTAL':
    case 'DEGRADED':
      return { tone: 'warning', key: 'partial' };
    case 'NOT_READY':
    case 'UNAVAILABLE':
      return { tone: 'none', key: 'notConnected' };
  }
}

export function domainOrderIndex(domain: ReportDomain): number {
  return DOMAIN_ORDER.get(domain) ?? REPORT_DOMAINS.length;
}

export function reportTitleIn(report: ReportCatalogueItem, lang: 'ar' | 'en'): string {
  return lang === 'ar' ? report.title.ar : report.title.en;
}

export function reportSummaryIn(report: ReportCatalogueItem, lang: 'ar' | 'en'): string {
  if (!report.summary) return '';
  return lang === 'ar' ? report.summary.ar : report.summary.en;
}
