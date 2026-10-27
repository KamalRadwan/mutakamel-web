import { isUUIDv7 } from '@/lib/uuid';
import { boundedArray, invalidResponse, record } from './dashboard-parse';

// dashboard-limits.ts and DashboardListQueryDto in crm-app.
export const DEFINITION_PAGE_LIMIT = 100;

export interface DefinitionPage<T> {
  items: T[];
  nextCursor: string | null;
}

export function parseDefinitionPage<T>(payload: unknown, parseItem: (item: unknown) => T): DefinitionPage<T> {
  const source = record(payload);
  if (!source || !boundedArray(source.items, DEFINITION_PAGE_LIMIT)
    || (source.nextCursor !== null && !isUUIDv7(source.nextCursor))) {
    invalidResponse('definition page');
  }
  return { items: source.items.map(parseItem), nextCursor: source.nextCursor as string | null };
}

export function definitionListPath(path: string, cursor?: string): string {
  // The first page uses the server default. Cursors remain opaque to callers.
  return cursor ? `${path}?cursor=${encodeURIComponent(cursor)}` : path;
}

export function mergeDefinitionItems<T extends { id: string }>(current: T[], incoming: T[]): T[] {
  return [...new Map([...current, ...incoming].map((item) => [item.id, item])).values()];
}
