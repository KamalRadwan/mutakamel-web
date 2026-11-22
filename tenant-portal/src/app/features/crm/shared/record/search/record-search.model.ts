import { Query, QueryField } from '../../../../../shared/query-builder/query.model';
import { SearchFacet } from '../../../../../shared/ui/facet-search/facet-search.model';

export type RecordSearchTranslate = (key: string, params?: Record<string, unknown>) => string;

export interface RecordSearchRejected {
  field: string;
  reasonKey: string;
}

export interface RecordSearchCompileResult<TBody> {
  body: TBody;
  rejected: readonly RecordSearchRejected[];
}

export interface RecordSearchFacetsResult {
  query: Query;
  rejected: readonly RecordSearchRejected[];
}

export interface RecordSearchFieldsHelpers {
  language: 'ar' | 'en';
  t: RecordSearchTranslate;
}

export interface RecordSearchCompileHelpers {
  currentUserId: string;
  timeZone: string;
}

export interface RecordSearchFacetsHelpers {
  prev: Query;
  fields: QueryField[];
  t: RecordSearchTranslate;
}

export interface RecordSearchQueryToFacetsHelpers {
  fields: QueryField[];
  language: 'ar' | 'en';
  t: RecordSearchTranslate;
}

export interface RecordSearchConfig<TCtx, TBody> {
  fields: (ctx: TCtx, helpers: RecordSearchFieldsHelpers) => QueryField[];
  compile: (query: Query, ctx: TCtx, helpers: RecordSearchCompileHelpers) => RecordSearchCompileResult<TBody>;
  defaultQuery: (ctx: TCtx) => Query;
  facetsToQuery: (
    facets: SearchFacet[],
    ctx: TCtx,
    helpers: RecordSearchFacetsHelpers,
  ) => Query | RecordSearchFacetsResult;
  queryToFacets: (query: Query, ctx: TCtx, helpers: RecordSearchQueryToFacetsHelpers) => SearchFacet[];
  rejectedKeyPrefix: string;
  currentUserId: () => string;
  timeZone: () => string;
  emptyQuery?: (ctx: TCtx) => Query;
  initialCtx?: TCtx;
  urlParam?: string;
}
