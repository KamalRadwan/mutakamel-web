/*
 * What Core really sends (core-app common.module.ts registers ResponseEnvelopeInterceptor as a
 * global APP_INTERCEPTOR; @mutakamel/common-runtime 0.1.0, response-envelope.interceptor.js):
 * every 2xx body is { success: true, data, correlationId, timestamp }. When a handler returns a
 * PaginatedResult ({ items, total, page, limit, totalPages, hasNext, hasPrev }), `data` becomes the
 * items array and the counters move to `meta`; any other key on the result (e.g. checkedAt) is dropped.
 * Core api functions return `data` for single records, { data, meta } for paged lists and
 * { items, nextCursor } for cursor lists. CRM and Trade return bare bodies and do not use this type.
 */

/** EnvelopeMetaDto. */
export interface CorePageMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

/** The part of Core's envelope a paged list needs. */
export interface CorePage<T> {
  data: T[];
  meta: CorePageMeta;
}

/** Fake helper: one page of `rows` in Core's paged shape (page and limit already clamped by the caller). */
export function toCorePage<T>(rows: readonly T[], page: number, limit: number): CorePage<T> {
  const total = rows.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const start = (page - 1) * limit;
  return {
    data: rows.slice(start, start + limit),
    meta: { page, limit, total, totalPages, hasNext: page < totalPages, hasPrev: page > 1 },
  };
}
