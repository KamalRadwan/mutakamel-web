import { ApiError } from '../../../../core/api/api-errors';
import { newIdempotencyKey } from '../../../../core/api/idempotency';
import type { CoreQuery } from '../../../../core/api/core-http';
import type { CursorPage, InfoPage } from '../../../../shared/widgets/dashboard/analytics-api';
import { crmHttp, crmQueries } from '../../shared/crm-http';
import type {
  AccessPerson, AccessRequest, DecideAccessRequestBody, ExecuteOwnerTransferBody,
  ExecuteOwnerTransferResult, ListAccessRequestsQuery, ListOwnerReviewsQuery,
  OwnerReview, ProposeOwnerBody, SubmitAccessRequestBody,
} from './access.model';

const requests = '/dashboards/access-requests';
const reviews = '/dashboards/owner-reviews';
const queryKey = ['crm-analytics'] as const;
const retryKeys = new Map<string, { bodyJson: string; key: string }>();
const people = new Map<string, AccessPerson>();

function read<T>(path: string, query?: CoreQuery): Promise<T> {
  return crmQueries().fetchQuery({
    queryKey: [...queryKey, 'access', path, query], staleTime: 0,
    queryFn: () => crmHttp().read<T>(path, query),
  });
}

async function write<T>(path: string, body: object, key?: string, ifMatch?: string): Promise<T> {
  const bodyJson = JSON.stringify(body);
  const previous = retryKeys.get(path);
  const receipt = { bodyJson, key: key ?? (previous?.bodyJson === bodyJson ? previous.key : newIdempotencyKey()) };
  retryKeys.set(path, receipt);
  await crmQueries().cancelQueries({ queryKey });
  try {
    const result = await crmHttp().write<T>('POST', path, body, { key: receipt.key, ifMatch });
    retryKeys.delete(path);
    return result.data;
  } catch (error) {
    // An uncertain result (or expired session) must retain the exact action key for retry.
    if (!(error instanceof ApiError) || ![0, 401].includes(error.status) && error.status < 500 && error.code !== 'GW.IDEM.IN_FLIGHT') {
      retryKeys.delete(path);
    }
    throw error;
  } finally {
    await crmQueries().invalidateQueries({ queryKey });
  }
}

function etag(kind: 'access-request' | 'owner-review', id: string, revision: number): string {
  return `"${kind}:${id}:${revision}"`;
}

export function submitAccessRequest(body: SubmitAccessRequestBody, key: string): Promise<AccessRequest> {
  return write(requests, body, key);
}

export function listAccessRequests(box: 'mine' | 'inbox', q: ListAccessRequestsQuery = {}): Promise<InfoPage<AccessRequest>> {
  return read(requests, { box, ...q });
}

export function getAccessRequest(id: string): Promise<AccessRequest> {
  return read(`${requests}/${encodeURIComponent(id)}`);
}

export function cancelAccessRequest(id: string, revision: number): Promise<AccessRequest> {
  return write(`${requests}/${encodeURIComponent(id)}/cancel`, { revision }, undefined, etag('access-request', id, revision));
}

export function decideAccessRequest(id: string, body: DecideAccessRequestBody): Promise<AccessRequest> {
  return write(`${requests}/${encodeURIComponent(id)}/decision`, body, undefined, etag('access-request', id, body.revision));
}

export function listOwnerReviews(q: ListOwnerReviewsQuery = {}): Promise<InfoPage<OwnerReview>> {
  return read(reviews, { ...q, status: q.status === 'ALL' ? undefined : q.status });
}

export function getOwnerReview(id: string): Promise<OwnerReview> {
  return read(`${reviews}/${encodeURIComponent(id)}`);
}

export function proposeOwner(id: string, body: ProposeOwnerBody): Promise<OwnerReview> {
  return write(`${reviews}/${encodeURIComponent(id)}/proposal`, body, undefined, etag('owner-review', id, body.revision));
}

export function cancelOwnerReview(id: string, revision: number): Promise<OwnerReview> {
  return write(`${reviews}/${encodeURIComponent(id)}/cancel`, { revision }, undefined, etag('owner-review', id, revision));
}

export function executeOwnerTransfer(id: string, body: ExecuteOwnerTransferBody, key: string): Promise<ExecuteOwnerTransferResult> {
  return write(`${reviews}/${encodeURIComponent(id)}/transfer`, body, key, etag('owner-review', id, body.revision));
}

export function resourceLabel(row: { resourceName: string | null; resourceId: string }): string {
  return row.resourceName?.trim() || row.resourceId;
}

export function personName(userId: string | null | undefined, lang: 'ar' | 'en'): string {
  if (!userId) return '—';
  const person = people.get(userId);
  return person ? (lang === 'ar' ? person.nameAr : person.name) : userId;
}

export function isPersonInactive(userId: string | null | undefined): boolean {
  return userId ? people.get(userId)?.active === false : false;
}

/** The server supplies active owner options; names absent from this lookup remain IDs. */
export async function listReviewTargets(widgetId: string): Promise<AccessPerson[]> {
  const result: AccessPerson[] = [];
  let cursor: string | null = null;
  do {
    const page: CursorPage<{ id: string; name: string | null }> = await read(`/widgets/${encodeURIComponent(widgetId)}/ownership-transfer/targets`, { cursor, limit: 50 });
    for (const row of page.items) {
      const person = { id: row.id, name: row.name ?? row.id, nameAr: row.name ?? row.id, email: '', active: true };
      people.set(row.id, person);
      result.push(person);
    }
    cursor = page.nextCursor;
  } while (cursor);
  return result;
}

/** FAKE-ONLY, no backend route: unscoped active-owner lookup. AC-1 uses resource transfer targets. */
export async function listActiveOwners(): Promise<AccessPerson[]> {
  const { FAKE_ACTIVE_PEOPLE } = await import('./access.fake');
  return structuredClone(FAKE_ACTIVE_PEOPLE);
}
