import { crmHttp, crmQueries } from '../../shared/crm-http';
import type { SourceReadiness } from '../../../../shared/widgets/dashboard/analytics.model';

export interface ReadinessDetail extends SourceReadiness {
  captureSourceKey: string | null;
  lastConfirmedAt: string | null;
  watermarkPinned: { watermark: string; firstSeenAt: string } | null;
  affected: { kind: 'REPORT' | 'WIDGET' | 'ALERT' | 'SUBSCRIPTION'; id: string; name: string }[];
  pageInfo: { limit: number; hasMore: boolean; nextCursor: string | null };
}

export function listReadiness(): Promise<{ items: SourceReadiness[] }> {
  return crmQueries().fetchQuery({
    queryKey: ['crm-settings', 'data-readiness'],
    queryFn: () => crmHttp().read('/analytics/readiness'),
  });
}

export function getReadiness(
  sourceKey: string,
  { cursor = null, limit = 20 }: { cursor?: string | null; limit?: number } = {},
): Promise<ReadinessDetail> {
  return crmQueries().fetchQuery({
    queryKey: ['crm-settings', 'data-readiness', sourceKey, cursor, limit],
    queryFn: () => crmHttp().read(`/analytics/readiness/${encodeURIComponent(sourceKey)}`, { cursor, limit }),
  });
}
